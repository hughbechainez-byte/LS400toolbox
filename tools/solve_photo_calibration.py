#!/usr/bin/env python3
"""Deterministically fit the reference camera to body-only annotations.

The solver never consumes component masks or component centers.  Bounds keep
the result in a plausible camera family; residuals are retained when evidence
cannot meet the requested target.
"""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
BOUNDS = np.array([[0.5, 4.0], [1.0, 4.0], [-1.0, 0.5], [0.4, 1.2], [20.0, 60.0]], dtype=float)


def vehicle_to_world(point):
    forward, left, up = np.asarray(point, dtype=float)
    return np.array([-left, up, -forward], dtype=float)


def project(points, camera, width=800, height=489):
    position = vehicle_to_world([camera[0], 0, camera[1]])
    target = vehicle_to_world([camera[2], 0, camera[3]])
    forward = target - position
    distance = np.linalg.norm(forward)
    if not np.isfinite(distance) or distance < 0.2:
        return None
    forward /= distance
    right = np.cross(forward, np.array([0.0, 1.0, 0.0]))
    right_norm = np.linalg.norm(right)
    if not np.isfinite(right_norm) or right_norm < 1e-8:
        return None
    right /= right_norm
    up = np.cross(right, forward)
    tangent = math.tan(math.radians(camera[4]) / 2)
    result = []
    for point in points:
        delta = vehicle_to_world(np.asarray(point, dtype=float) / 1000.0) - position
        depth = float(delta @ forward)
        if not math.isfinite(depth) or depth <= 1e-5:
            return None
        horizontal = float(delta @ right)
        vertical = float(delta @ up)
        result.append([
            (horizontal / (depth * tangent * width / height) * 0.5 + 0.5) * width,
            (0.5 - vertical / (depth * tangent) * 0.5) * height,
        ])
    projected = np.asarray(result)
    return projected if np.all(np.isfinite(projected)) else None


def score(points, pixels, camera):
    projected = project(points, camera)
    if projected is None:
        return float("inf")
    return float(np.sqrt(np.mean((projected - pixels) ** 2)))


def fit(points, pixels, seed=20260809):
    rng = random.Random(seed)
    best = (float("inf"), None)
    starts = [
        np.array([1.5, 2.08, -0.20, 0.66, 40.0]),
        np.array([2.0, 2.5, -0.20, 0.70, 28.0]),
        np.array([3.0, 3.0, -0.20, 0.70, 30.0]),
        np.array([1.0, 3.0, -0.20, 0.70, 25.0]),
        np.array([3.0, 2.0, -0.20, 0.70, 35.0]),
    ]
    for start in starts:
        camera = start.copy()
        current = score(points, pixels, camera)
        scales = np.array([0.20, 0.20, 0.20, 0.10, 1.20])
        for iteration in range(7000):
            index = iteration % len(camera)
            candidate = camera.copy()
            candidate[index] += rng.uniform(-float(scales[index]), float(scales[index]))
            candidate = np.minimum(np.maximum(candidate, BOUNDS[:, 0]), BOUNDS[:, 1])
            candidate_score = score(points, pixels, candidate)
            if candidate_score < current:
                camera, current = candidate, candidate_score
            if iteration % 50 == 0:
                scales *= 0.99
        if current < best[0]:
            best = (current, camera.copy())
    return best


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "shared" / "model-manifest.json")
    parser.add_argument("--annotations", type=Path, default=ROOT / "shared" / "photo-annotations.json")
    parser.add_argument("--report", type=Path, default=ROOT / "qa" / "model-foundation" / "calibration-solver.json")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    annotations = json.loads(args.annotations.read_text(encoding="utf-8"))
    features = [item for item in annotations["bodyFeatures"] if item.get("useForCalibration")]
    points = np.asarray([item["modelPointMm"] for item in features], dtype=float)
    pixels = np.asarray([item["pixel"] for item in features], dtype=float)
    rmse, solution = fit(points, pixels)
    if solution is None:
        raise RuntimeError("No valid camera remained inside the bounded search space")
    residuals = np.linalg.norm(project(points, solution) - pixels, axis=1)
    camera = manifest["foundation"]["referencePhotoReplica"]["camera"]
    camera["positionMm"] = [round(float(solution[0] * 1000), 3), 0, round(float(solution[1] * 1000), 3)]
    camera["targetMm"] = [round(float(solution[2] * 1000), 3), 0, round(float(solution[3] * 1000), 3)]
    camera["fovDeg"] = round(float(solution[4]), 6)
    camera["solver"] = {
        "method": "bounded deterministic coordinate descent",
        "seed": 20260809,
        "featureClass": "body-only",
        "featureIds": [item["id"] for item in features],
        "bounds": {"cameraForwardM": [0.5, 4.0], "cameraHeightM": [1.0, 4.0], "targetForwardM": [-1.0, 0.5], "targetHeightM": [0.4, 1.2], "fovDeg": [20.0, 60.0]},
        "rmsePx": round(rmse, 6),
        "medianResidualPx": round(float(np.median(residuals)), 6),
        "maximumResidualPx": round(float(np.max(residuals)), 6),
        "status": "locked_with_evidence_residual" if np.median(residuals) > 8 or np.max(residuals) > 20 else "locked_within_target",
    }
    args.manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(camera["solver"], indent=2) + "\n", encoding="utf-8")
    print(json.dumps(camera["solver"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
