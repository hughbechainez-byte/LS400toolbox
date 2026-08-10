#!/usr/bin/env python3
"""Robust multistart camera solve for the exact 640x484 LS400 photo layout.

Only canonical body landmarks participate.  The solver retains the previous
camera when no candidate improves the weighted Huber objective.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
BOUNDS = np.array([
    [0.5, 12.0], [-3.0, 3.0], [1.0, 12.0],     # position X/Y/Z metres
    [-1.5, 2.0], [-1.5, 1.5], [0.3, 2.0],       # target X/Y/Z metres
    [-12.0, 12.0], [12.0, 80.0],                # roll degrees, vertical FOV
    [-0.5, 0.5], [-0.5, 0.5],                   # principal-point offset, frame fractions
], dtype=float)
HUBER_DELTA_PX = 12.0
CLEAR_IMPROVEMENT_RATIO = 0.95


def vehicle_to_world(point: np.ndarray) -> np.ndarray:
    """Convert vehicle metres (+X forward/+Y driver/+Z up) to Three world."""
    return np.asarray([-point[1], point[2], -point[0]], dtype=float)


def camera_vector(camera: dict) -> np.ndarray:
    offset = camera.get("principalPointOffset", [0.0, 0.0])
    return np.array([
        *[value / 1000.0 for value in camera["positionMm"]],
        *[value / 1000.0 for value in camera["targetMm"]],
        float(camera.get("rollDeg", 0.0)), float(camera["fovDeg"]),
        float(offset[0]), float(offset[1]),
    ], dtype=float)


def camera_record(vector: np.ndarray) -> dict:
    return {
        "positionMm": [round(float(value * 1000), 3) for value in vector[:3]],
        "targetMm": [round(float(value * 1000), 3) for value in vector[3:6]],
        "rollDeg": round(float(vector[6]), 6),
        "fovDeg": round(float(vector[7]), 6),
        "principalPointOffset": [round(float(vector[8]), 8), round(float(vector[9]), 8)],
    }


def project(points_mm: np.ndarray, vector: np.ndarray, width: int, height: int) -> np.ndarray | None:
    position = vehicle_to_world(vector[:3])
    target = vehicle_to_world(vector[3:6])
    forward = target - position
    distance = np.linalg.norm(forward)
    if not np.isfinite(distance) or distance < 0.05:
        return None
    forward /= distance
    right = np.cross(forward, np.array([0.0, 1.0, 0.0]))
    right_norm = np.linalg.norm(right)
    if right_norm < 1e-8:
        return None
    right /= right_norm
    up = np.cross(right, forward)
    roll = math.radians(vector[6])
    right, up = right * math.cos(roll) + up * math.sin(roll), -right * math.sin(roll) + up * math.cos(roll)
    tangent = math.tan(math.radians(vector[7]) / 2)
    if tangent <= 0:
        return None
    result: list[list[float]] = []
    for point in points_mm:
        delta = vehicle_to_world(point / 1000.0) - position
        depth = float(delta @ forward)
        if depth <= 1e-5:
            return None
        x = (float(delta @ right) / (depth * tangent * width / height) * 0.5 + 0.5 + vector[8]) * width
        y = (0.5 - float(delta @ up) / (depth * tangent) * 0.5 + vector[9]) * height
        result.append([x, y])
    return np.asarray(result, dtype=float)


def raw_errors(points: np.ndarray, pixels: np.ndarray, vector: np.ndarray, width: int, height: int) -> np.ndarray | None:
    projected = project(points, vector, width, height)
    return None if projected is None else np.linalg.norm(projected - pixels, axis=1)


def huber_residual(points: np.ndarray, pixels: np.ndarray, weights: np.ndarray, vector: np.ndarray, width: int, height: int) -> np.ndarray:
    projected = project(points, vector, width, height)
    if projected is None:
        return np.full(points.shape[0] * 2, 1e6, dtype=float)
    delta = projected - pixels
    norms = np.linalg.norm(delta, axis=1)
    huber_weights = np.where(norms <= HUBER_DELTA_PX, 1.0, HUBER_DELTA_PX / np.maximum(norms, 1e-9))
    return (delta * np.sqrt(weights * huber_weights)[:, None]).ravel()


def optimize(points: np.ndarray, pixels: np.ndarray, weights: np.ndarray, start: np.ndarray, width: int, height: int) -> np.ndarray:
    candidate = np.clip(start.copy(), BOUNDS[:, 0], BOUNDS[:, 1])
    damping = 1.0
    for _ in range(260):
        residual = huber_residual(points, pixels, weights, candidate, width, height)
        jacobian = np.empty((len(residual), len(candidate)), dtype=float)
        for column in range(len(candidate)):
            step = 1e-4 * max(1.0, abs(candidate[column]))
            nudged = candidate.copy()
            nudged[column] += step
            jacobian[:, column] = (huber_residual(points, pixels, weights, nudged, width, height) - residual) / step
        try:
            delta = np.linalg.solve(jacobian.T @ jacobian + damping * np.eye(len(candidate)), -jacobian.T @ residual)
        except np.linalg.LinAlgError:
            break
        proposal = np.clip(candidate + delta, BOUNDS[:, 0], BOUNDS[:, 1])
        if np.mean(huber_residual(points, pixels, weights, proposal, width, height) ** 2) < np.mean(residual ** 2):
            candidate = proposal
            damping = max(damping * 0.35, 1e-6)
        else:
            damping = min(damping * 8.0, 1e12)
        if np.linalg.norm(delta) < 1e-5:
            break
    return candidate


def summary(points: np.ndarray, pixels: np.ndarray, weights: np.ndarray, vector: np.ndarray, width: int, height: int) -> dict:
    errors = raw_errors(points, pixels, vector, width, height)
    if errors is None:
        return {"objective": float("inf"), "medianResidualPx": float("inf"), "maximumResidualPx": float("inf")}
    residual = huber_residual(points, pixels, weights, vector, width, height)
    return {
        "objective": round(float(np.mean(residual ** 2)), 8),
        "medianResidualPx": round(float(np.median(errors)), 6),
        "maximumResidualPx": round(float(np.max(errors)), 6),
        "rmsePx": round(float(np.sqrt(np.mean(errors ** 2))), 6),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "shared" / "model-manifest.json")
    parser.add_argument("--landmarks", type=Path, default=ROOT / "shared" / "photo-layout-landmarks.json")
    parser.add_argument("--report", type=Path, default=ROOT / "qa" / "photo-layout" / "camera-solve.json")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    landmark_set = json.loads(args.landmarks.read_text(encoding="utf-8"))
    body = [item for item in landmark_set["landmarks"] if item["category"] == "body" and "camera" in item["fit"]]
    width, height = landmark_set["viewport"]["widthPx"], landmark_set["viewport"]["heightPx"]
    points = np.asarray([item["worldAnchorMm"] for item in body], dtype=float)
    pixels = np.asarray([item["referencePx"] for item in body], dtype=float)
    weights = np.asarray([item["weight"] for item in body], dtype=float)
    before = camera_vector(manifest["foundation"]["referencePhotoReplica"]["camera"])
    starts = [
        before,
        np.array([2.7, 0, 2.3, -0.2, 0, 0.7, 0, 20, 0, 0], dtype=float),
        np.array([4.0, 0, 3.0, -0.2, 0, 0.7, 0, 30, 0, 0.2], dtype=float),
        np.array([5.0, 0, 4.0, -0.2, 0, 0.7, 0, 25, 0, 0.2], dtype=float),
        np.array([2.0, 0, 4.0, -0.2, 0, 0.7, 0, 40, 0, 0.2], dtype=float),
        np.array([7.0, 0, 5.0, -0.2, 0, 0.7, 0, 20, 0, 0.2], dtype=float),
    ]
    candidates = [before, *(optimize(points, pixels, weights, start, width, height) for start in starts)]
    best = min(candidates, key=lambda item: summary(points, pixels, weights, item, width, height)["objective"])
    before_summary = summary(points, pixels, weights, before, width, height)
    best_summary = summary(points, pixels, weights, best, width, height)
    # A numerical nudge that merely trades median error for a tiny weighted
    # objective reduction is not a Stage-1 calibration improvement.  Retain
    # the best-so-far camera unless both robust objective and median residual
    # improve by a material margin.
    accepted = (
        best_summary["objective"] <= before_summary["objective"] * CLEAR_IMPROVEMENT_RATIO
        and best_summary["medianResidualPx"] <= before_summary["medianResidualPx"] * CLEAR_IMPROVEMENT_RATIO
    )
    final = best if accepted else before
    final_summary = best_summary if accepted else before_summary
    projected = project(points, final, width, height)
    rows = [{"id": item["id"], "referencePx": item["referencePx"], "projectedPx": [round(float(value), 3) for value in rendered], "errorPx": round(float(error), 3)} for item, rendered, error in zip(body, projected, raw_errors(points, pixels, final, width, height))]
    report = {
        "solver": "deterministic multistart damped least-squares with Huber loss",
        "landmarkSet": str(args.landmarks), "viewport": [width, height], "bodyLandmarkCount": len(body),
        "before": {**camera_record(before), **before_summary}, "bestCandidate": {**camera_record(best), **best_summary},
        "accepted": accepted, "acceptanceRule": f"objective and median residual each improve by at least {(1 - CLEAR_IMPROVEMENT_RATIO) * 100:.0f} percent", "final": {**camera_record(final), **final_summary}, "rows": rows,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.apply and accepted:
        camera = manifest["foundation"]["referencePhotoReplica"]["camera"]
        camera.update(camera_record(final))
        camera["solver"] = {
            "method": report["solver"], "featureClass": "body-only", "landmarkSet": "shared/photo-layout-landmarks.json",
            "rmsePx": final_summary["rmsePx"], "medianResidualPx": final_summary["medianResidualPx"], "maximumResidualPx": final_summary["maximumResidualPx"], "objective": final_summary["objective"], "status": "camera_stage_candidate",
        }
        args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
