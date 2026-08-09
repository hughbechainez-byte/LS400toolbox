#!/usr/bin/env python3
"""Produce the private, deterministic native-resolution foundation QA bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from validate_model_manifest import validate_manifest


ROOT = Path(__file__).resolve().parents[1]
NODE = Path(r"C:\Users\blowb\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
CHROME_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def polygon_mask(points: list[list[float]], size: tuple[int, int]) -> np.ndarray:
    image = Image.new("L", size, 0)
    ImageDraw.Draw(image).polygon([(float(x), float(y)) for x, y in points], fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def silhouette_mask(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    data = np.asarray(image)
    return np.all(data > 210, axis=2)


def boundary(mask: np.ndarray) -> np.ndarray:
    result = mask.copy()
    for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
        result &= np.roll(mask, shift, axis=axis)
    return mask & ~result


def mean_boundary_distance(left: np.ndarray, right: np.ndarray) -> float:
    left_points = np.argwhere(boundary(left))[::2]
    right_points = np.argwhere(boundary(right))[::2]
    if len(left_points) == 0 or len(right_points) == 0:
        return float("inf")
    distances = []
    for start in range(0, len(left_points), 512):
        chunk = left_points[start:start + 512].astype(np.float32)
        delta = chunk[:, None, :] - right_points[None, :, :].astype(np.float32)
        distances.extend(np.sqrt(np.sum(delta * delta, axis=2)).min(axis=1).tolist())
    for start in range(0, len(right_points), 512):
        chunk = right_points[start:start + 512].astype(np.float32)
        delta = chunk[:, None, :] - left_points[None, :, :].astype(np.float32)
        distances.extend(np.sqrt(np.sum(delta * delta, axis=2)).min(axis=1).tolist())
    return float(np.mean(distances))


def bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    points = np.argwhere(mask)
    if len(points) == 0:
        return None
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0)
    return int(x0), int(y0), int(x1), int(y1)


def centroid(mask: np.ndarray) -> tuple[float, float] | None:
    points = np.argwhere(mask)
    if len(points) == 0:
        return None
    y, x = points.mean(axis=0)
    return float(x), float(y)


def polygon_centroid(points: list[list[float]]) -> tuple[float, float]:
    array = np.asarray(points, dtype=np.float64)
    return float(array[:, 0].mean()), float(array[:, 1].mean())


def relative_size_error(reference: tuple[int, int, int, int] | None, model: tuple[int, int, int, int] | None) -> dict[str, float | None]:
    if reference is None or model is None:
        return {"widthPercent": None, "heightPercent": None}
    reference_width = max(1, reference[2] - reference[0])
    reference_height = max(1, reference[3] - reference[1])
    model_width = max(1, model[2] - model[0])
    model_height = max(1, model[3] - model[1])
    return {
        "widthPercent": abs(model_width - reference_width) / reference_width * 100,
        "heightPercent": abs(model_height - reference_height) / reference_height * 100,
    }


def draw_reference_frame(reference: Image.Image, annotations: dict, output: Path) -> None:
    frame = reference.convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    for feature in annotations["bodyFeatures"]:
        x, y = feature["pixel"]
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(255, 206, 86, 220), outline=(10, 20, 26, 255))
    for mask in annotations["masks"]:
        points = [tuple(point) for point in mask["referencePolygonPx"]]
        draw.line(points + [points[0]], fill=(72, 219, 195, 135), width=2, joint="curve")
    frame.save(output)


def write_edges(model_path: Path, reference: Image.Image, output: Path) -> None:
    model = Image.open(model_path).convert("L").filter(ImageFilter.FIND_EDGES)
    ref = reference.convert("L").filter(ImageFilter.FIND_EDGES)
    model_data = np.asarray(model, dtype=np.uint8)
    ref_data = np.asarray(ref, dtype=np.uint8)
    combined = np.zeros((ref_data.shape[0], ref_data.shape[1], 4), dtype=np.uint8)
    combined[..., 0] = np.maximum(model_data, ref_data // 4)
    combined[..., 1] = ref_data
    combined[..., 2] = ref_data
    combined[..., 3] = 255
    Image.fromarray(combined, "RGBA").save(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--reference-image", type=Path)
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--browser", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    output = (args.output or root / "qa" / "model-foundation").resolve()
    output.mkdir(parents=True, exist_ok=True)
    reference_path = args.reference_image
    if reference_path is None:
        sibling = root.parent.parent / "release-repo" / "windows" / "interactive-3d-prototype" / "references" / "user-1990-ls400-inline1.jpg"
        reference_path = sibling if sibling.exists() else None
    if reference_path is None or not reference_path.exists():
        print("BLOCKED: private 800x489 reference image is not available; pass --reference-image.", file=sys.stderr)
        return 2
    reference_path = reference_path.resolve()
    manifest_path = root / "shared" / "model-manifest.json"
    annotations_path = root / "shared" / "photo-annotations.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    annotations = json.loads(annotations_path.read_text(encoding="utf-8"))
    validation = validate_manifest(manifest)
    (output / "manifest-validation.json").write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    if validation["status"] != "PASS":
        print("BLOCKED: manifest validation failed", file=sys.stderr)
        return 1
    reference = Image.open(reference_path).convert("RGB")
    if reference.size != (800, 489):
        print(f"BLOCKED: reference image is {reference.size}, expected 800x489.", file=sys.stderr)
        return 2
    browser = args.browser or next((path for path in CHROME_CANDIDATES if path.exists()), None)
    if browser is None or not NODE.exists():
        print("BLOCKED: bundled Node or a local Chrome/Edge executable is unavailable.", file=sys.stderr)
        return 2
    command = [str(NODE), str(root / "tools" / "render_model_foundation.mjs"), "--root", str(root), "--output", str(output), "--browser", str(browser), "--private-reference", str(reference_path)]
    subprocess.run(command, cwd=root, check=True)
    runtime = json.loads((output / "runtime.json").read_text(encoding="utf-8"))
    model = Image.open(output / "model-render.png").convert("RGB")
    model_silhouette = silhouette_mask(output / "model-silhouette.png")
    reference_silhouette = polygon_mask(annotations["masks"][0]["referencePolygonPx"], reference.size)

    draw_reference_frame(reference, annotations, output / "reference-frame.png")
    Image.blend(reference.convert("RGBA"), model.convert("RGBA"), 0.5).save(output / "overlay-50.png")
    write_edges(output / "model-render.png", reference, output / "edges.png")
    ImageChops.difference(reference, model).save(output / "difference.png")

    feature_runtime = runtime["projectedBodyFeatures"]
    landmark_rows = []
    for feature, projected in zip(feature_runtime["features"], feature_runtime["points"]):
        expected = np.asarray(feature["pixel"], dtype=np.float64)
        actual = np.asarray(projected, dtype=np.float64)
        landmark_rows.append({"id": feature["id"], "referencePx": feature["pixel"], "projectedPx": [round(float(value), 3) for value in actual], "errorPx": round(float(np.linalg.norm(actual - expected)), 3)})
    landmark_errors = [row["errorPx"] for row in landmark_rows]

    projected_masks = {item["id"]: item["points"] for item in runtime["projectedMasks"]}
    mask_metrics = {}
    centroid_errors = []
    for mask in annotations["masks"]:
        reference_mask = polygon_mask(mask["referencePolygonPx"], reference.size)
        model_points = projected_masks.get(mask["id"], [])
        model_mask = polygon_mask(model_points, reference.size) if model_points else np.zeros_like(reference_mask)
        reference_centroid = centroid(reference_mask)
        model_centroid = centroid(model_mask)
        centroid_error = None
        if reference_centroid and model_centroid:
            centroid_error = float(np.linalg.norm(np.asarray(reference_centroid) - np.asarray(model_centroid)))
            centroid_errors.append(centroid_error)
        overlap = np.logical_and(reference_mask, model_mask).sum()
        union = np.logical_or(reference_mask, model_mask).sum()
        mask_metrics[mask["id"]] = {
            "referencePixels": int(reference_mask.sum()),
            "modelPixels": int(model_mask.sum()),
            "centroidErrorPx": None if centroid_error is None else round(centroid_error, 3),
            "iou": None if not union else round(float(overlap / union), 6),
        }
        Image.fromarray(np.where(reference_mask, 255, 0).astype(np.uint8), "L").save(output / f"mask-{mask['id']}-reference.png")
        Image.fromarray(np.where(model_mask, 255, 0).astype(np.uint8), "L").save(output / f"mask-{mask['id']}-model.png")

    silhouette_intersection = np.logical_and(reference_silhouette, model_silhouette).sum()
    silhouette_union = np.logical_or(reference_silhouette, model_silhouette).sum()
    silhouette_iou = float(silhouette_intersection / silhouette_union) if silhouette_union else 0.0
    model_bbox = bbox(model_silhouette)
    reference_bbox = bbox(reference_silhouette)
    size_error = relative_size_error(reference_bbox, model_bbox)
    missing = np.logical_and(reference_silhouette, ~model_silhouette).sum()
    extra = np.logical_and(model_silhouette, ~reference_silhouette).sum()
    metrics = {
        "manifest": {
            "version": manifest["manifestVersion"],
            "buildKey": runtime["buildKey"],
            "sourcePhotoSha256": sha256(reference_path),
            "privateNoShip": True,
        },
        "environment": runtime["environment"],
        "runtime": {"canvasSize": runtime["canvasSize"], "camera": runtime["camera"], "consoleErrors": runtime["consoleErrors"], "pageErrors": runtime["pageErrors"], "failedResponses": runtime["failedResponses"]},
        "bodyLandmarks": {"count": len(landmark_rows), "medianErrorPx": float(np.median(landmark_errors)) if landmark_errors else None, "maximumErrorPx": max(landmark_errors) if landmark_errors else None, "rows": landmark_rows},
        "majorComponentCentroidErrorPx": {"count": len(centroid_errors), "median": float(np.median(centroid_errors)) if centroid_errors else None, "maximum": max(centroid_errors) if centroid_errors else None},
        "projectedBodySilhouette": {"referenceBBox": reference_bbox, "modelBBox": model_bbox, **size_error},
        "silhouette": {"intersectionOverUnion": round(silhouette_iou, 6), "meanBoundaryDistancePx": round(mean_boundary_distance(reference_silhouette, model_silhouette), 3), "missingPixels": int(missing), "extraPixels": int(extra), "missingExtraAreaPercent": round(float((missing + extra) / max(1, reference_silhouette.sum()) * 100), 3)},
        "masks": mask_metrics,
        "targets": {"bodyLandmarkMedianErrorPx": 8, "bodyLandmarkMaximumErrorPx": 20, "majorProjectedWidthHeightErrorPercent": 5, "majorSilhouetteIoU": 0.80, "meanMajorBoundaryDistancePx": 6},
        "acceptance": {
            "bodyLandmarkMedian": bool(landmark_errors) and float(np.median(landmark_errors)) <= 8,
            "bodyLandmarkMaximum": bool(landmark_errors) and max(landmark_errors) <= 20,
            "projectedWidth": size_error["widthPercent"] is not None and size_error["widthPercent"] <= 5,
            "projectedHeight": size_error["heightPercent"] is not None and size_error["heightPercent"] <= 5,
            "silhouetteIoU": silhouette_iou >= 0.80,
            "boundaryDistance": mean_boundary_distance(reference_silhouette, model_silhouette) <= 6,
            "noNewConsoleErrors": not runtime["consoleErrors"] and not runtime["pageErrors"],
        },
        "evidenceBlockers": [
            "The source photo has no calibrated lens intrinsics or subject-car survey; residuals above target are reported rather than camera/mask-manipulated.",
            "Component-region masks are comparison-only and were excluded from camera calibration.",
        ],
    }
    metrics["acceptance"]["overallTargets"] = all(value for key, value in metrics["acceptance"].items() if key != "noNewConsoleErrors")
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    acceptance = metrics["acceptance"]
    summary_lines = [
        f"LS400 model-foundation QA: {'PASS' if acceptance['overallTargets'] else 'PASS_WITH_RESIDUALS'}",
        f"Build {runtime['buildKey']} · native canvas {runtime['canvasSize'][0]}x{runtime['canvasSize'][1]} · browser {runtime['environment']['browserVersion']}",
        f"Body landmarks: median {metrics['bodyLandmarks']['medianErrorPx']:.2f}px, max {metrics['bodyLandmarks']['maximumErrorPx']:.2f}px; projected size width {size_error['widthPercent']:.2f}%, height {size_error['heightPercent']:.2f}%.",
        f"Silhouette: IoU {silhouette_iou:.4f}, mean boundary distance {metrics['silhouette']['meanBoundaryDistancePx']:.2f}px, missing {missing}px, extra {extra}px.",
        "Private source and derived QA images are local/no-ship; unresolved camera/lens evidence is recorded in metrics.json.",
    ]
    (output / "summary.txt").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print("\n".join(summary_lines))
    return 0 if acceptance["overallTargets"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
