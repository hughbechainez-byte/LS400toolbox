#!/usr/bin/env python3
"""Produce the private, deterministic native-resolution foundation QA bundle."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import shutil
import subprocess
import sys
from collections import deque
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


def region_mask(regions: list[list[list[float]]], size: tuple[int, int]) -> np.ndarray:
    """Rasterize an explicit semantic region set, never photo brightness."""
    image = Image.new("L", size, 0)
    draw = ImageDraw.Draw(image)
    for region in regions:
        draw.polygon([(float(x), float(y)) for x, y in region], fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def silhouette_mask(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    data = np.asarray(image)
    return np.all(data > 210, axis=2)


def boundary(mask: np.ndarray) -> np.ndarray:
    result = mask.copy()
    for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
        result &= np.roll(mask, shift, axis=axis)
    result = mask & ~result
    # A contour that reaches the frame is a crop continuation, not an
    # observable physical perimeter.  Remove its complete connected fragment
    # (rather than only its first border pixel) while retaining every fully
    # visible interior contour.  This avoids measuring arbitrary crop cuts as
    # a body-shape error.
    height, width = result.shape
    crop_connected = np.zeros_like(result, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for y, x in np.argwhere(result & ((np.indices(result.shape)[0] == 0) | (np.indices(result.shape)[0] == height - 1) | (np.indices(result.shape)[1] == 0) | (np.indices(result.shape)[1] == width - 1))):
        crop_connected[y, x] = True
        queue.append((int(y), int(x)))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width and result[ny, nx] and not crop_connected[ny, nx]:
                crop_connected[ny, nx] = True
                queue.append((ny, nx))
    return result & ~crop_connected


def mean_boundary_distance(left: np.ndarray, right: np.ndarray) -> float:
    # Do not stride a raster-ordered outline: paired left/right edge pixels
    # then collapse to only one side and inflate a symmetric boundary error.
    left_points = np.argwhere(boundary(left))
    right_points = np.argwhere(boundary(right))
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


def draw_numbered_landmarks(image: Image.Image, rows: list[dict], output: Path, key: str) -> None:
    frame = image.convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    for index, row in enumerate(rows, 1):
        x, y = row[key]
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 205, 70, 235), outline=(10, 20, 26, 255), width=1)
        draw.text((x + 6, y - 8), str(index), fill=(10, 20, 26, 255), stroke_width=2, stroke_fill=(255, 255, 255, 235))
    frame.save(output)


def draw_residual_vectors(reference: Image.Image, rows: list[dict], output: Path) -> None:
    frame = reference.convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    for index, row in enumerate(rows, 1):
        rendered = tuple(row["projectedPx"])
        expected = tuple(row["referencePx"])
        draw.line([rendered, expected], fill=(255, 72, 72, 225), width=2)
        draw.ellipse((rendered[0] - 3, rendered[1] - 3, rendered[0] + 3, rendered[1] + 3), fill=(255, 72, 72, 230))
        draw.ellipse((expected[0] - 3, expected[1] - 3, expected[0] + 3, expected[1] + 3), fill=(72, 219, 195, 230))
        draw.text((expected[0] + 5, expected[1] - 8), str(index), fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 235))
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
        reference_path = Path(r"C:\Users\blowb\Desktop\LS400toolbox\ls400_engine_bay_reference_exact.jpg")
    if reference_path is None or not reference_path.exists():
        print("BLOCKED: canonical 640x484 reference image is not available; pass --reference-image.", file=sys.stderr)
        return 2
    reference_path = reference_path.resolve()
    manifest_path = root / "shared" / "model-manifest.json"
    landmarks_path = root / "shared" / "photo-layout-landmarks.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    photo_landmarks = json.loads(landmarks_path.read_text(encoding="utf-8"))
    validation = validate_manifest(manifest)
    (output / "manifest-validation.json").write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    if validation["status"] != "PASS":
        print("BLOCKED: manifest validation failed", file=sys.stderr)
        return 1
    reference = Image.open(reference_path).convert("RGB")
    expected_size = (photo_landmarks["reference"]["widthPx"], photo_landmarks["reference"]["heightPx"])
    if reference.size != expected_size:
        print(f"BLOCKED: reference image is {reference.size}, expected {expected_size}.", file=sys.stderr)
        return 2
    if sha256(reference_path) != photo_landmarks["reference"]["sha256"]:
        print("BLOCKED: reference SHA-256 does not match the canonical landmark set.", file=sys.stderr)
        return 2
    browser = args.browser or next((path for path in CHROME_CANDIDATES if path.exists()), None)
    if browser is None or not NODE.exists():
        print("BLOCKED: bundled Node or a local Chrome/Edge executable is unavailable.", file=sys.stderr)
        return 2
    command = [str(NODE), str(root / "tools" / "render_model_foundation.mjs"), "--root", str(root), "--output", str(output), "--browser", str(browser), "--private-reference", str(reference_path)]
    subprocess.run(command, cwd=root, check=True)
    runtime = json.loads((output / "runtime.json").read_text(encoding="utf-8"))
    model = Image.open(output / "model-render.png").convert("RGB")
    # `model-silhouette.png` is retained as an all-mesh diagnostic.  The
    # body-only capture is the only image that can support a body-geometry
    # measurement; projected landmark polygons are never a rendered mask.
    rendered_body_silhouette = silhouette_mask(output / "body-silhouette.png")
    rendered_photo_body = silhouette_mask(output / "photo-body-geometry-mask.png")
    side_by_side = Image.new("RGB", (reference.size[0] * 2, reference.size[1]))
    side_by_side.paste(reference, (0, 0))
    side_by_side.paste(model, (reference.size[0], 0))
    side_by_side.save(output / "side-by-side.png")
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

    calibrated_rows = []
    class_errors: dict[str, list[float]] = {}
    for landmark, projected in zip(runtime["projectedLandmarks"]["landmarks"], runtime["projectedLandmarks"]["points"]):
        expected = np.asarray(landmark["referencePx"], dtype=np.float64)
        actual = np.asarray(projected, dtype=np.float64)
        error = float(np.linalg.norm(actual - expected))
        calibrated_rows.append({"id": landmark["id"], "class": landmark["category"], "referencePx": [round(float(value), 3) for value in expected], "projectedPx": [round(float(value), 3) for value in actual], "errorPx": round(error, 3)})
        class_errors.setdefault(landmark["category"], []).append(error)
    landmark_class_metrics = {
        feature_class: {"count": len(errors), "medianErrorPx": round(float(np.median(errors)), 3), "maximumErrorPx": round(float(np.max(errors)), 3)}
        for feature_class, errors in class_errors.items()
    }
    all_landmark_errors = [float(row["errorPx"]) for row in calibrated_rows]
    component_center_errors = [
        float(row["errorPx"])
        for row in calibrated_rows
        if row["class"] != "body" and ".bound." not in row["id"]
    ]
    image_diagonal = float(math.hypot(reference.size[0], reference.size[1]))
    landmark_median_target = image_diagonal * .015
    landmark_maximum_target = image_diagonal * .03
    component_center_target = image_diagonal * .025

    draw_numbered_landmarks(reference, calibrated_rows, output / "reference-numbered-landmarks.png", "referencePx")
    draw_numbered_landmarks(model, calibrated_rows, output / "render-numbered-landmarks.png", "projectedPx")
    draw_residual_vectors(reference, calibrated_rows, output / "landmark-residual-vectors.png")
    with (output / "per-landmark-residuals.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "category", "reference_x_px", "reference_y_px", "render_x_px", "render_y_px", "residual_px"])
        for row in calibrated_rows:
            writer.writerow([row["id"], row["class"], *row["referencePx"], *row["projectedPx"], row["errorPx"]])
    largest_residuals = sorted(calibrated_rows, key=lambda row: row["errorPx"], reverse=True)[:10]
    (output / "ten-largest-residuals.json").write_text(json.dumps(largest_residuals, indent=2) + "\n", encoding="utf-8")

    projected_masks = {item["id"]: item["points"] for item in runtime["projectedMasks"]}
    mask_metrics = {}
    centroid_errors = []
    for mask in photo_landmarks["masks"]:
        if "referencePolygonPx" not in mask or "modelPolygonMm" not in mask:
            continue
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

    body_mask = next(item for item in photo_landmarks["masks"] if item["id"] == "body-shell")
    reference_body_geometry = region_mask(body_mask["referenceRegionsPx"], reference.size)
    body_intersection = np.logical_and(reference_body_geometry, rendered_photo_body).sum()
    body_union = np.logical_or(reference_body_geometry, rendered_photo_body).sum()
    body_iou = float(body_intersection / body_union) if body_union else 0.0
    rendered_body_bbox = bbox(rendered_photo_body)
    reference_bbox = bbox(reference_body_geometry)
    size_error = relative_size_error(reference_bbox, rendered_body_bbox)
    body_missing = np.logical_and(reference_body_geometry, ~rendered_photo_body).sum()
    body_extra = np.logical_and(rendered_photo_body, ~reference_body_geometry).sum()
    body_boundary_error = mean_boundary_distance(reference_body_geometry, rendered_photo_body)
    Image.fromarray(np.where(reference_body_geometry, 255, 0).astype(np.uint8), "L").save(output / "reference-body-geometry-mask.png")
    Image.blend(
        Image.open(output / "reference-body-geometry-mask.png").convert("RGBA"),
        Image.open(output / "photo-body-geometry-mask.png").convert("RGBA"),
        0.5,
    ).save(output / "body-geometry-overlay-50.png")
    write_edges(output / "photo-body-geometry-mask.png", Image.open(output / "reference-body-geometry-mask.png").convert("RGB"), output / "body-geometry-edges.png")
    Image.fromarray(np.where(rendered_body_silhouette, 255, 0).astype(np.uint8), "L").save(output / "rendered-body-geometry-mask.png")
    metrics = {
        "manifest": {
            "version": manifest["manifestVersion"],
            "buildKey": runtime["buildKey"],
            "sourcePhotoSha256": sha256(reference_path),
            "localNoShip": True,
        },
        "environment": runtime["environment"],
        "runtime": {"canvasSize": runtime["canvasSize"], "camera": runtime["camera"], "consoleErrors": runtime["consoleErrors"], "pageErrors": runtime["pageErrors"], "failedResponses": runtime["failedResponses"]},
        "bodyLandmarks": {"count": len(landmark_rows), "medianErrorPx": float(np.median(landmark_errors)) if landmark_errors else None, "maximumErrorPx": max(landmark_errors) if landmark_errors else None, "rows": landmark_rows},
        "photoLandmarks": {"count": len(calibrated_rows), "rows": calibrated_rows, "classes": landmark_class_metrics},
        "allLandmarkResidualPx": {"median": round(float(np.median(all_landmark_errors)), 3), "maximum": round(float(np.max(all_landmark_errors)), 3), "imageDiagonalPx": round(image_diagonal, 3)},
        "majorComponentCenterResidualPx": {"count": len(component_center_errors), "median": round(float(np.median(component_center_errors)), 3), "maximum": round(float(np.max(component_center_errors)), 3)},
        "tenLargestLandmarkResiduals": largest_residuals,
        "majorComponentCentroidErrorPx": {"count": len(centroid_errors), "median": float(np.median(centroid_errors)) if centroid_errors else None, "maximum": max(centroid_errors) if centroid_errors else None},
        "renderedBodyGeometry": {"referenceMaskPath": "reference-body-geometry-mask.png", "modelMaskPath": "photo-body-geometry-mask.png", "referenceBBox": reference_bbox, "modelBBox": rendered_body_bbox, **size_error, "intersectionOverUnion": round(body_iou, 6), "meanBoundaryDistancePx": round(body_boundary_error, 3), "missingPixels": int(body_missing), "extraPixels": int(body_extra), "referencePixels": int(reference_body_geometry.sum()), "modelPixels": int(rendered_photo_body.sum()), "source": body_mask["source"]},
        "masks": mask_metrics,
        "targets": {"bodyLandmarkMedianErrorPx": 14.07, "bodyLandmarkMaximumErrorPx": 28.14, "allLandmarkMedianErrorPx": round(landmark_median_target, 3), "allLandmarkMaximumErrorPx": round(landmark_maximum_target, 3), "majorComponentCenterMaximumErrorPx": round(component_center_target, 3), "majorProjectedWidthHeightErrorPercent": 5, "majorSilhouetteIoU": 0.92, "meanMajorBoundaryDistancePx": 18.76},
        "acceptance": {
            "bodyLandmarkMedian": bool(landmark_errors) and float(np.median(landmark_errors)) <= 14.07,
            "bodyLandmarkMaximum": bool(landmark_errors) and max(landmark_errors) <= 28.14,
            "allLandmarkMedian": bool(all_landmark_errors) and float(np.median(all_landmark_errors)) <= landmark_median_target,
            "allLandmarkMaximum": bool(all_landmark_errors) and max(all_landmark_errors) <= landmark_maximum_target,
            "majorComponentCenters": bool(component_center_errors) and max(component_center_errors) <= component_center_target,
            "projectedWidth": size_error["widthPercent"] is not None and size_error["widthPercent"] <= 5,
            "projectedHeight": size_error["heightPercent"] is not None and size_error["heightPercent"] <= 5,
            "renderedSilhouetteIoU": body_iou >= 0.92,
            "renderedBoundaryDistance": body_boundary_error <= 18.76,
            "noNewConsoleErrors": not runtime["consoleErrors"] and not runtime["pageErrors"],
        },
        "evidenceBlockers": [
            "The body comparison uses manually traced cowl/fender/support regions and a grouped render mask; it excludes engine and accessory pixels by construction.",
        ],
        "stageStatus": "BODY_GATE_FAILED" if not (body_iou >= 0.92 and body_boundary_error <= 18.76) else "BODY_MASK_GATE_PASSED",
    }
    metrics["acceptance"]["overallTargets"] = all(value for key, value in metrics["acceptance"].items() if key != "overallTargets")
    (output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    calibration_report = {
        "reference": {
            "path": str(reference_path),
            "dimensionsPx": list(reference.size),
            "sha256": sha256(reference_path),
            "orientation": photo_landmarks["reference"]["orientation"],
        },
        "camera": runtime["camera"],
        "acceptance": metrics["acceptance"],
        "allLandmarkResidualPx": metrics["allLandmarkResidualPx"],
        "renderedBodyGeometry": metrics["renderedBodyGeometry"],
    }
    (output / "calibration-report.json").write_text(json.dumps(calibration_report, indent=2) + "\n", encoding="utf-8")
    acceptance = metrics["acceptance"]
    summary_lines = [
        f"LS400 model-foundation QA: {'PASS' if acceptance['overallTargets'] else 'INCOMPLETE'}",
        f"Build {runtime['buildKey']} · native canvas {runtime['canvasSize'][0]}x{runtime['canvasSize'][1]} · browser {runtime['environment']['browserVersion']}",
        f"Body landmarks: median {metrics['bodyLandmarks']['medianErrorPx']:.2f}px, max {metrics['bodyLandmarks']['maximumErrorPx']:.2f}px; projected size width {size_error['widthPercent']:.2f}%, height {size_error['heightPercent']:.2f}%.",
        f"All landmarks: median {metrics['allLandmarkResidualPx']['median']:.2f}px, max {metrics['allLandmarkResidualPx']['maximum']:.2f}px; major centres max {metrics['majorComponentCenterResidualPx']['maximum']:.2f}px.",
        f"Rendered body geometry: IoU {body_iou:.4f}, mean boundary distance {body_boundary_error:.2f}px, missing {body_missing}px, extra {body_extra}px.",
        "Body comparison uses the explicit semantic cowl/fender/support masks in the canonical landmark file.",
    ]
    (output / "summary.txt").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print("\n".join(summary_lines))
    return 0 if acceptance["overallTargets"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
