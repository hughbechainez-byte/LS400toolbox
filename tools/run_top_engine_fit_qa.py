#!/usr/bin/env python3
"""Compare the six frozen top-engine photo fixtures to named render groups."""

from __future__ import annotations

import argparse
import csv
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
NODE = Path(r"C:\Users\blowb\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
FIXTURE_DIR = ROOT / "shared" / "photo-top-engine-reference-fixtures"
MODEL_FIT_GROUPS = {
    # The recovered 3e6f937 runtime has no experimental MAF-only fit group;
    # this offline comparator therefore uses its two established intake fit
    # groups without adding or altering runtime scene nodes.
    "airbox-maf-assembly": ["airbox", "intake-duct"],
    "corrugated-intake-duct": ["intake-duct"],
    "trac-throttle-assembly": ["trac-housing", "throttle-body"],
    "silver-intake-manifold": ["intake-manifold"],
    "valve-cover-passenger": ["valve-cover-passenger"],
    "valve-cover-driver-four-cam": ["valve-cover-driver"],
}


def binary(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("L"), dtype=np.uint8) > 210


def bbox(mask: np.ndarray) -> list[int] | None:
    points = np.argwhere(mask)
    if not len(points):
        return None
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0)
    return [int(x0), int(y0), int(x1), int(y1)]


def orientation(mask: np.ndarray) -> float | None:
    points = np.argwhere(mask)
    if len(points) < 3:
        return None
    xy = points[:, [1, 0]].astype(float)
    vals, vectors = np.linalg.eigh(np.cov((xy - xy.mean(axis=0)), rowvar=False))
    v = vectors[:, int(np.argmax(vals))]
    return float(math.degrees(math.atan2(v[1], v[0])) % 180)


def orientation_error(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return float(abs((left - right + 90) % 180 - 90))


def edge(mask: np.ndarray) -> np.ndarray:
    inner = mask.copy()
    for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
        inner &= np.roll(mask, shift, axis=axis)
    return mask & ~inner


def boundary_distance(left: np.ndarray, right: np.ndarray) -> float:
    a, b = np.argwhere(edge(left)), np.argwhere(edge(right))
    if not len(a) or not len(b):
        return float("inf")
    distances: list[float] = []
    for source, target in ((a, b), (b, a)):
        for start in range(0, len(source), 512):
            delta = source[start:start + 512, None, :].astype(float) - target[None, :, :].astype(float)
            distances.extend(np.sqrt((delta * delta).sum(axis=2)).min(axis=1).tolist())
    return float(np.mean(distances))


def overlay(reference: np.ndarray, model: np.ndarray, path: Path) -> None:
    data = np.zeros((*reference.shape, 4), dtype=np.uint8)
    data[reference, 1:3] = (225, 255)
    data[model, 0] = 255
    data[model, 1] = np.maximum(data[model, 1], 84)
    data[reference & model] = (238, 232, 118, 210)
    data[reference | model, 3] = 190
    Image.fromarray(data, "RGBA").save(path)


def contour(reference: np.ndarray, model: np.ndarray, path: Path) -> None:
    data = np.zeros((*reference.shape, 4), dtype=np.uint8)
    data[edge(reference), 1:3] = (225, 255)
    data[edge(model), 0] = 255
    data[edge(reference) & edge(model)] = (238, 232, 118, 255)
    data[edge(reference) | edge(model), 3] = 255
    Image.fromarray(data, "RGBA").save(path)


def row_for(spec: dict, output: Path) -> tuple[dict, np.ndarray, np.ndarray]:
    reference = binary(FIXTURE_DIR / spec["mask"])
    model = np.zeros_like(reference)
    model_groups = MODEL_FIT_GROUPS[spec["id"]]
    for generator_id in model_groups:
        model |= binary(output / f"photo-fit-{generator_id}.png")
    reference_bbox, model_bbox = bbox(reference), bbox(model)
    inter = int((reference & model).sum())
    union = int((reference | model).sum())
    reference_orientation, model_orientation = orientation(reference), orientation(model)
    edge_errors = [abs(a - b) for a, b in zip(reference_bbox, model_bbox)] if reference_bbox and model_bbox else [float("inf")] * 4
    result = {
        "id": spec["id"], "label": spec["label"], "generators": "+".join(model_groups),
        "reference_bbox": reference_bbox, "model_bbox": model_bbox,
        "bbox_edge_residual_max_px": round(max(edge_errors), 3),
        "reference_area_px": int(reference.sum()), "model_area_px": int(model.sum()),
        "visible_area_ratio": round(float(model.sum() / max(1, reference.sum())), 4),
        "silhouette_iou": round(float(inter / max(1, union)), 6),
        "reference_orientation_deg": round(reference_orientation, 3) if reference_orientation is not None else None,
        "model_orientation_deg": round(model_orientation, 3) if model_orientation is not None else None,
        "orientation_difference_deg": round(orientation_error(reference_orientation, model_orientation) or float("inf"), 3),
        "mean_boundary_distance_px": round(boundary_distance(reference, model), 3),
    }
    result["passes"] = bool(result["silhouette_iou"] >= .85 and result["bbox_edge_residual_max_px"] <= 10 and .90 <= result["visible_area_ratio"] <= 1.10 and result["orientation_difference_deg"] <= 5)
    return result, reference, model


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--skip-render", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    fixture = json.loads((FIXTURE_DIR / "reference-fixtures.json").read_text(encoding="utf-8"))
    if not args.skip_render:
        subprocess.run([str(NODE), str(ROOT / "tools" / "render_model_foundation.mjs"), "--root", str(ROOT), "--output", str(output), "--private-reference", fixture["reference"]["path"]], check=True, cwd=ROOT)
    rows = []
    for spec in fixture["fixtures"]:
        row, reference, model = row_for(spec, output)
        rows.append(row)
        Image.fromarray(np.where(reference, 255, 0).astype(np.uint8), "L").save(output / f"top-engine-{spec['id']}-reference.png")
        Image.fromarray(np.where(model, 255, 0).astype(np.uint8), "L").save(output / f"top-engine-{spec['id']}-model.png")
        overlay(reference, model, output / f"top-engine-{spec['id']}-overlay.png")
        contour(reference, model, output / f"top-engine-{spec['id']}-contours.png")
    with (output / "top-engine-component-fit.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
    duct = next(item for item in fixture["fixtures"] if item["id"] == "corrugated-intake-duct")
    # The immutable samples are included verbatim so review always checks the
    # same endpoints, bend stations, and width target rather than a post-fit path.
    (output / "top-engine-duct-samples.json").write_text(json.dumps({"referenceCenterlinePx": duct["centerlinePx"], "referenceWidthSamplesPx": duct["widthSamplesPx"], "note": "Model contour and isolated overlay are authoritative; sample list is frozen with fixture commit."}, indent=2) + "\n", encoding="utf-8")
    report = {"fixtureSetId": fixture["fixtureSetId"], "reference": fixture["reference"], "targets": {"silhouetteIoU": .85, "bboxEdgeResidualPx": 10, "visibleAreaRatio": [.90, 1.10], "orientationDifferenceDeg": 5}, "rows": rows, "allPass": all(row["passes"] for row in rows)}
    (output / "top-engine-component-fit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"allPass": report["allPass"], "rows": [{key: row[key] for key in ("id", "silhouette_iou", "bbox_edge_residual_max_px", "visible_area_ratio", "orientation_difference_deg", "passes")} for row in rows]}, indent=2))
    return 0 if report["allPass"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
