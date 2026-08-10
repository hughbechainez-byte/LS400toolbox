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


def principal_orientation(mask: np.ndarray) -> float | None:
    """Return the major-axis screen angle in degrees, modulo 180."""
    points = np.argwhere(mask)
    if len(points) < 3:
        return None
    xy = points[:, [1, 0]].astype(np.float64)
    centered = xy - xy.mean(axis=0)
    values, vectors = np.linalg.eigh(np.cov(centered, rowvar=False))
    vector = vectors[:, int(np.argmax(values))]
    return float(math.degrees(math.atan2(vector[1], vector[0])) % 180.0)


def orientation_error(reference: float | None, model: float | None) -> float | None:
    if reference is None or model is None:
        return None
    return float(abs((reference - model + 90.0) % 180.0 - 90.0))


def write_component_overlay(reference_mask: np.ndarray, model_mask: np.ndarray, output: Path) -> None:
    """Cyan reference / red model isolated component comparison."""
    data = np.zeros((*reference_mask.shape, 4), dtype=np.uint8)
    data[reference_mask, 1] = 225
    data[reference_mask, 2] = 255
    data[model_mask, 0] = 255
    data[model_mask, 1] = np.maximum(data[model_mask, 1], 84)
    data[np.logical_and(reference_mask, model_mask)] = (238, 232, 118, 255)
    data[np.logical_or(reference_mask, model_mask), 3] = 190
    Image.fromarray(data, "RGBA").save(output)


def draw_component_labels(image: Image.Image, rows: list[dict], key: str, output: Path) -> None:
    frame = image.convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    for row in rows:
        location = row.get(key)
        if location is None:
            continue
        x, y = location
        label = row["id"].replace("-", " ")
        draw.rectangle((x - 3, y - 10, x + max(30, len(label) * 6), y + 4), fill=(8, 15, 18, 185))
        draw.text((x, y - 9), label, fill=(246, 236, 140, 255), stroke_width=1, stroke_fill=(0, 0, 0, 245))
    frame.save(output)


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
        if "referencePolygonPx" not in mask:
            continue
        reference_mask = polygon_mask(mask["referencePolygonPx"], reference.size)
        semantic_path = output / f"photo-mask-{mask['id']}.png"
        if semantic_path.exists():
            model_mask = silhouette_mask(semantic_path)
        else:
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

    # These are visible housing centroids, rendered through the fixed body
    # occlusion.  They supplement anchor projection rows for the major named
    # accessories whose routework would otherwise distort a grouped centroid.
    landmark_by_id = {item["id"]: item for item in photo_landmarks["landmarks"]}
    visible_component_targets = {
        "ENGINE_1UZ_FE": "engine.center",
        "LANDMARK_AIRBOX": "accessory.airbox",
        "LANDMARK_BATTERY": "accessory.battery",
        "LANDMARK_ENGINE_BAY_FUSE_BOX": "accessory.fuse_box",
        "LANDMARK_BRAKE_BOOSTER": "accessory.brake_booster",
        "LANDMARK_COOLANT_OVERFLOW_RESERVOIR": "accessory.coolant_reservoir",
    }
    visible_component_centers = []
    for component_id, landmark_id in visible_component_targets.items():
        mask_path = output / f"photo-component-{component_id}.png"
        if not mask_path.exists() or landmark_id not in landmark_by_id:
            continue
        actual_center = centroid(silhouette_mask(mask_path))
        expected_center = landmark_by_id[landmark_id]["referencePx"]
        if actual_center is None:
            continue
        residual = float(np.linalg.norm(np.asarray(actual_center) - np.asarray(expected_center)))
        visible_component_centers.append({
            "componentId": component_id,
            "landmarkId": landmark_id,
            "referencePx": [round(float(value), 3) for value in expected_center],
            "visibleCenterPx": [round(float(value), 3) for value in actual_center],
            "residualPx": round(residual, 3),
            "bbox": bbox(silhouette_mask(mask_path)),
        })

    # Component-fit mode is deliberately based on an isolated object-ID mask
    # against a reviewed reference polygon.  It records the shape properties
    # that a centre-point gate cannot see: all four bbox edges, visible area,
    # major-axis orientation, silhouette overlap and boundary distance.
    component_fit_rows = []
    component_fit_targets = {
        "centerResidualPx": 12.0,
        "bboxEdgeResidualPx": 16.0,
        "visibleAreaRatioMin": 0.80,
        "visibleAreaRatioMax": 1.25,
        "silhouetteIoU": 0.75,
    }
    for fit in photo_landmarks.get("componentFits", []):
        reference_mask = polygon_mask(fit["referencePolygonPx"], reference.size)
        model_path = output / f"photo-fit-{fit['id']}.png"
        model_mask = silhouette_mask(model_path) if model_path.exists() else np.zeros_like(reference_mask)
        reference_bbox = bbox(reference_mask)
        model_bbox = bbox(model_mask)
        reference_center = centroid(reference_mask)
        model_center = centroid(model_mask)
        center_residual = None if reference_center is None or model_center is None else float(np.linalg.norm(np.asarray(reference_center) - np.asarray(model_center)))
        if reference_bbox is None or model_bbox is None:
            bbox_edges = None
        else:
            bbox_edges = {
                name: abs(model_bbox[index] - reference_bbox[index])
                for index, name in enumerate(("left", "top", "right", "bottom"))
            }
        reference_pixels = int(reference_mask.sum())
        model_pixels = int(model_mask.sum())
        area_ratio = None if not reference_pixels else model_pixels / reference_pixels
        intersection = np.logical_and(reference_mask, model_mask).sum()
        union = np.logical_or(reference_mask, model_mask).sum()
        iou = None if not union else float(intersection / union)
        ref_orientation = principal_orientation(reference_mask)
        model_orientation = principal_orientation(model_mask)
        row = {
            "id": fit["id"],
            "category": fit["category"],
            "photoFitGroup": fit["photoFitGroup"],
            "generator": fit["generator"],
            "referenceCenterPx": None if reference_center is None else [round(value, 3) for value in reference_center],
            "modelCenterPx": None if model_center is None else [round(value, 3) for value in model_center],
            "centerResidualPx": None if center_residual is None else round(center_residual, 3),
            "referenceBBoxPx": reference_bbox,
            "modelBBoxPx": model_bbox,
            "bboxEdgeResidualPx": bbox_edges,
            "referencePixels": reference_pixels,
            "modelPixels": model_pixels,
            "visibleAreaRatio": None if area_ratio is None else round(area_ratio, 4),
            "referenceOrientationDeg": None if ref_orientation is None else round(ref_orientation, 3),
            "modelOrientationDeg": None if model_orientation is None else round(model_orientation, 3),
            "orientationResidualDeg": None if orientation_error(ref_orientation, model_orientation) is None else round(orientation_error(ref_orientation, model_orientation), 3),
            "silhouetteIoU": None if iou is None else round(iou, 6),
            "meanBoundaryDistancePx": round(mean_boundary_distance(reference_mask, model_mask), 3),
        }
        edges_pass = bbox_edges is not None and max(bbox_edges.values()) <= component_fit_targets["bboxEdgeResidualPx"]
        row["passes"] = bool(
            row["centerResidualPx"] is not None and row["centerResidualPx"] <= component_fit_targets["centerResidualPx"]
            and edges_pass
            and row["visibleAreaRatio"] is not None and component_fit_targets["visibleAreaRatioMin"] <= row["visibleAreaRatio"] <= component_fit_targets["visibleAreaRatioMax"]
            and row["silhouetteIoU"] is not None and row["silhouetteIoU"] >= component_fit_targets["silhouetteIoU"]
        )
        component_fit_rows.append(row)
        Image.fromarray(np.where(reference_mask, 255, 0).astype(np.uint8), "L").save(output / f"component-fit-{fit['id']}-reference.png")
        Image.fromarray(np.where(model_mask, 255, 0).astype(np.uint8), "L").save(output / f"component-fit-{fit['id']}-model.png")
        write_component_overlay(reference_mask, model_mask, output / f"component-fit-{fit['id']}-overlay.png")
    with (output / "per-component-fit.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "category", "generator", "center_residual_px", "bbox_left_px", "bbox_top_px", "bbox_right_px", "bbox_bottom_px", "visible_area_ratio", "orientation_residual_deg", "silhouette_iou", "mean_boundary_distance_px", "passes"])
        for row in component_fit_rows:
            edges = row["bboxEdgeResidualPx"] or {}
            writer.writerow([row["id"], row["category"], row["generator"], row["centerResidualPx"], edges.get("left"), edges.get("top"), edges.get("right"), edges.get("bottom"), row["visibleAreaRatio"], row["orientationResidualDeg"], row["silhouetteIoU"], row["meanBoundaryDistancePx"], row["passes"]])
    draw_component_labels(reference, component_fit_rows, "referenceCenterPx", output / "labeled-reference.png")
    draw_component_labels(model, component_fit_rows, "modelCenterPx", output / "labeled-render.png")
    intake_route_fit = None
    route_definition = photo_landmarks.get("intakeRouteFit")
    if route_definition and runtime.get("projectedIntakeRoute"):
        expected_route = np.asarray(route_definition["referenceCenterlinePx"], dtype=np.float64)
        actual_route = np.asarray(runtime["projectedIntakeRoute"], dtype=np.float64)
        if expected_route.shape == actual_route.shape:
            route_errors = np.linalg.norm(actual_route - expected_route, axis=1)
            intake_route_fit = {
                "referenceCenterlinePx": expected_route.round(3).tolist(),
                "modelCenterlinePx": actual_route.round(3).tolist(),
                "endpointResidualPx": [round(float(route_errors[0]), 3), round(float(route_errors[-1]), 3)],
                "meanCenterlineDeviationPx": round(float(route_errors.mean()), 3),
                "passes": bool(route_errors[0] <= 8 and route_errors[-1] <= 8 and route_errors.mean() <= 12),
                "source": route_definition["source"],
            }

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
        "visibleComponentCenters": visible_component_centers,
        "componentFit": {"targets": component_fit_targets, "rows": component_fit_rows, "allPass": bool(component_fit_rows) and all(row["passes"] for row in component_fit_rows), "generatorMap": runtime.get("photoFitGenerators", [])},
        "intakeRouteFit": intake_route_fit,
        "renderedBodyGeometry": {"referenceMaskPath": "reference-body-geometry-mask.png", "modelMaskPath": "photo-body-geometry-mask.png", "referenceBBox": reference_bbox, "modelBBox": rendered_body_bbox, **size_error, "intersectionOverUnion": round(body_iou, 6), "meanBoundaryDistancePx": round(body_boundary_error, 3), "missingPixels": int(body_missing), "extraPixels": int(body_extra), "referencePixels": int(reference_body_geometry.sum()), "modelPixels": int(rendered_photo_body.sum()), "source": body_mask["source"]},
        "masks": mask_metrics,
        "targets": {"bodyLandmarkMedianErrorPx": 14.07, "bodyLandmarkMaximumErrorPx": 28.14, "allLandmarkMedianErrorPx": round(landmark_median_target, 3), "allLandmarkMaximumErrorPx": round(landmark_maximum_target, 3), "majorComponentCenterMaximumErrorPx": round(component_center_target, 3), "majorProjectedWidthHeightErrorPercent": 5, "majorSilhouetteIoU": 0.92, "meanMajorBoundaryDistancePx": 18.76, "componentFit": component_fit_targets},
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
            "componentFit": bool(component_fit_rows) and all(row["passes"] for row in component_fit_rows),
            "intakeRouteFit": intake_route_fit is not None and intake_route_fit["passes"],
            "noNewConsoleErrors": not runtime["consoleErrors"] and not runtime["pageErrors"],
        },
        "evidenceBlockers": [
            "The body comparison uses manually traced cowl/fender/support regions and a grouped render mask; it excludes engine and accessory pixels by construction.",
        ],
        "stageStatus": "COMPONENT_FIT_GATE_PASSED" if bool(component_fit_rows) and all(row["passes"] for row in component_fit_rows) else "COMPONENT_FIT_INCOMPLETE",
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
