#!/usr/bin/env python3
"""Dependency-free semantic validation for the LS400 model foundation."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict, deque
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ALLOWED_TRUTH = {"measured", "photo_solved", "diagram_only", "placeholder", "variant_unresolved"}
REQUIRED_SYSTEMS = {"AIR_CONDITIONING", "AIR_INTAKE", "COOLING_HEATER", "BRAKE_VACUUM"}


def issue(code: str, message: str, path: str | None = None) -> dict[str, str]:
    result = {"code": code, "message": message}
    if path:
        result["path"] = path
    return result


def walk_values(value: Any, path: str = ""):
    yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            next_path = f"{path}.{key}" if path else key
            yield from walk_values(child, next_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_values(child, f"{path}[{index}]")


def stable_ids(items: list[dict[str, Any]], field: str, label: str) -> list[dict[str, str]]:
    seen: dict[str, int] = defaultdict(int)
    errors = []
    for index, item in enumerate(items):
        value = item.get(field)
        if not isinstance(value, str) or not value:
            errors.append(issue("missing_id", f"{label}[{index}] has no {field}.", f"{label}[{index}].{field}"))
        else:
            seen[value] += 1
    for value, count in seen.items():
        if count > 1:
            errors.append(issue("duplicate_id", f"{label} contains duplicate {field} {value!r}."))
    return errors


def component_ports(manifest: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], list[dict[str, str]]]:
    components = {item["stableId"]: item for item in manifest.get("components", []) if isinstance(item.get("stableId"), str)}
    ports: dict[str, dict[str, Any]] = {}
    errors: list[dict[str, str]] = []
    for component_id, component in components.items():
        for index, port in enumerate(component.get("ports", [])):
            port_id = port.get("stableId")
            if not isinstance(port_id, str) or not port_id:
                errors.append(issue("missing_port_id", f"{component_id} port {index} has no stableId."))
                continue
            if port_id in ports:
                errors.append(issue("duplicate_port_id", f"Port stableId {port_id!r} is duplicated."))
            ports[port_id] = {"component": component_id, **port}
            transform = port.get("localTransform")
            if not isinstance(transform, dict):
                errors.append(issue("missing_port_transform", f"Port {port_id} has no named local transform."))
            elif transform.get("units") != "millimetres":
                errors.append(issue("incorrect_units", f"Port {port_id} local transform must use millimetres."))
    return components, ports, errors


def option_errors(manifest: dict[str, Any]) -> list[dict[str, str]]:
    known = {item.get("id") for item in manifest.get("options", [])}
    errors = []
    for section in ("components", "connections"):
        for index, item in enumerate(manifest.get(section, [])):
            refs = item.get("applicability", {}).get("optionIds", [])
            for ref in refs:
                if ref not in known:
                    errors.append(issue("invalid_option_reference", f"Unknown option reference {ref!r}.", f"{section}[{index}].applicability.optionIds"))
    return errors


def finite_coordinate_errors(manifest: dict[str, Any]) -> list[dict[str, str]]:
    errors = []
    for path, value in walk_values(manifest):
        if isinstance(value, (int, float)) and (path.endswith("Mm") or "positionMm" in path or "pointsMm" in path or "centerMm" in path or "envelopeMm" in path):
            if not math.isfinite(float(value)):
                errors.append(issue("non_finite_coordinate", f"Non-finite coordinate at {path}."))
        if isinstance(value, dict) and value.get("units") == "metres" and ("geometry" in path or "centerline" in path or "Transform" in path):
            errors.append(issue("incorrect_units", f"Renderer-neutral geometry uses metres at {path}; use millimetres."))
    return errors


def truth_errors(manifest: dict[str, Any]) -> list[dict[str, str]]:
    errors = []
    for path, value in walk_values(manifest):
        if path.endswith("truthState") and value not in ALLOWED_TRUTH:
            errors.append(issue("invalid_truth_state", f"Invalid truth state {value!r} at {path}."))
    if set(manifest.get("truthStates", [])) != ALLOWED_TRUTH:
        errors.append(issue("truth_state_contract", "Manifest truthStates must contain exactly the five allowed states."))
    return errors


def endpoint_errors(manifest: dict[str, Any], components: dict[str, dict[str, Any]], ports: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    errors = []
    for index, connection in enumerate(manifest.get("connections", [])):
        for side in ("from", "to"):
            endpoint = connection.get(side, {})
            component_id = endpoint.get("componentStableId")
            port_id = endpoint.get("portStableId")
            if component_id not in components:
                errors.append(issue("missing_endpoint", f"Connection {connection.get('stableId')} {side} component {component_id!r} does not exist."))
            if port_id not in ports:
                errors.append(issue("orphan_port", f"Connection {connection.get('stableId')} {side} port {port_id!r} does not exist."))
            elif ports[port_id].get("component") != component_id:
                errors.append(issue("orphan_port", f"Connection {connection.get('stableId')} {side} port {port_id!r} belongs to another component."))
        centerline = connection.get("centerline")
        if not isinstance(centerline, dict) or centerline.get("units") != "millimetres" or not isinstance(centerline.get("pointsMm"), list) or not isinstance(centerline.get("segments"), list):
            errors.append(issue("centerline_contract", f"Connection {connection.get('stableId')} lacks an editable millimetre centerline and segment evidence list."))
    return errors


def graph_errors(manifest: dict[str, Any], components: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    edges_by_system: dict[str, list[tuple[str, str]]] = defaultdict(list)
    nodes_by_system: dict[str, set[str]] = defaultdict(set)
    for component_id, component in components.items():
        nodes_by_system[component.get("system", "")].add(component_id)
    for connection in manifest.get("connections", []):
        system = connection.get("system", "")
        left = connection.get("from", {}).get("componentStableId")
        right = connection.get("to", {}).get("componentStableId")
        if left and right:
            edges_by_system[system].append((left, right))
            nodes_by_system[system].update((left, right))
    errors = []
    for system in REQUIRED_SYSTEMS:
        nodes = nodes_by_system.get(system, set())
        if not nodes:
            errors.append(issue("disconnected_required_system", f"Required system graph {system} has no nodes."))
            continue
        adjacency: dict[str, set[str]] = defaultdict(set)
        for left, right in edges_by_system.get(system, []):
            adjacency[left].add(right)
            adjacency[right].add(left)
        start = next(iter(nodes))
        reached = set([start])
        queue = deque([start])
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if neighbor not in reached:
                    reached.add(neighbor)
                    queue.append(neighbor)
        # Isolated semantic records are valid only when explicitly unresolved;
        # a split graph among connected records is a foundation error.
        disconnected = [node for node in nodes - reached if not any(item.get("stableId") == node and item.get("geometry", {}).get("truthState") in {"placeholder", "variant_unresolved", "diagram_only"} for item in manifest.get("components", []))]
        if disconnected:
            errors.append(issue("disconnected_required_system", f"Required system graph {system} is disconnected at {disconnected[:5]}"))
    return errors


def ac_contradiction_errors(manifest: dict[str, Any]) -> list[dict[str, str]]:
    errors = []
    high_media = {"high_pressure_refrigerant_vapor", "high_pressure_liquid_refrigerant"}
    low_media = {"low_pressure_refrigerant_mixture", "low_pressure_refrigerant_vapor"}
    for connection in manifest.get("connections", []):
        if connection.get("system") != "AIR_CONDITIONING":
            continue
        medium = connection.get("medium")
        ports = [connection.get("from", {}).get("portStableId", ""), connection.get("to", {}).get("portStableId", "")]
        legacy_names = " ".join(ports).lower()
        if medium in low_media and ("high" in legacy_names or "discharge" in legacy_names):
            errors.append(issue("ac_side_contradiction", f"A/C low-side medium contradicts high/discharge endpoint in {connection.get('stableId')}"))
        if medium in high_media and ("low" in legacy_names or "suction" in legacy_names):
            errors.append(issue("ac_side_contradiction", f"A/C high-side medium contradicts low/suction endpoint in {connection.get('stableId')}"))
    return errors


def foundation_errors(manifest: dict[str, Any]) -> list[dict[str, str]]:
    errors = []
    foundation = manifest.get("foundation", {})
    envelope = foundation.get("physicalEnvelope", {})
    half = envelope.get("halfWidthMm")
    if half != 910:
        errors.append(issue("envelope_contract", f"Expected 1,820 mm body width / 910 mm half-width, got {half!r}."))
    for variant_key in ("historicalBaseline", "referencePhotoReplica"):
        hardpoints = foundation.get(variant_key, {}).get("shellHardpointsMm", {})
        for name in ("cowlOuterHalfWidth", "cowlInnerHalfWidth", "radiatorSupportHardpointHalfWidth", "springSupportInnerHoleHalfWidth", "strutTowerCenterHalfWidth", "apronOuterHalfWidth", "apronInnerHalfWidth", "apronRailHalfWidth"):
            value = hardpoints.get(name)
            if not isinstance(value, (int, float)) or abs(value) > half:
                errors.append(issue("impossible_span", f"{variant_key}.{name}={value!r} exceeds the physical lateral envelope."))
    replica = foundation.get("referencePhotoReplica", {})
    camera = replica.get("camera", {})
    if replica.get("viewport") != {"widthPx": 640, "heightPx": 484, "devicePixelRatio": 1}:
        errors.append(issue("camera_contract", "Reference replica viewport must be locked at native 640x484 DPR 1."))
    if camera.get("projection") != "perspective" or camera.get("locked") is not True:
        errors.append(issue("camera_contract", "Reference camera must be a locked perspective camera."))
    if replica.get("calibrationUse") != "body-only":
        errors.append(issue("camera_contract", "Camera calibration must be explicitly body-only."))
    return errors


def validate_manifest(manifest: dict[str, Any], schema_path: Path | None = None) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    if manifest.get("manifestId") != "LS400_MODEL_FOUNDATION":
        errors.append(issue("manifest_id", "Manifest ID is not LS400_MODEL_FOUNDATION."))
    if manifest.get("units") != "millimetres":
        errors.append(issue("incorrect_units", "Top-level manifest units must be millimetres."))
    errors.extend(stable_ids(manifest.get("components", []), "stableId", "components"))
    errors.extend(stable_ids(manifest.get("connections", []), "stableId", "connections"))
    errors.extend(stable_ids(manifest.get("runtimeMappings", []), "stableId", "runtimeMappings"))
    components, ports, port_issues = component_ports(manifest)
    errors.extend(port_issues)
    errors.extend(option_errors(manifest))
    errors.extend(finite_coordinate_errors(manifest))
    errors.extend(truth_errors(manifest))
    errors.extend(endpoint_errors(manifest, components, ports))
    errors.extend(graph_errors(manifest, components))
    errors.extend(ac_contradiction_errors(manifest))
    errors.extend(foundation_errors(manifest))

    snapshot = manifest.get("sourceSnapshot", {})
    if len(snapshot.get("componentRecords", [])) != manifest.get("summary", {}).get("componentCount"):
        errors.append(issue("source_coverage", "Component source snapshot count does not equal normalized manifest count."))
    if len(snapshot.get("connectionRecords", [])) != manifest.get("summary", {}).get("connectionCount"):
        errors.append(issue("source_coverage", "Connection source snapshot count does not equal normalized manifest count."))
    if manifest.get("summary", {}).get("airConditioningComponentCount") != 19 or manifest.get("summary", {}).get("airConditioningConnectionCount") != 22:
        warnings.append(issue("evidence_count", "Expected current A/C counts are 19 components and 22 connections; inspect the live source snapshot."))
    if any(item.get("geometry", {}).get("truthState") in {"placeholder", "variant_unresolved", "diagram_only"} for item in manifest.get("components", [])):
        warnings.append(issue("unresolved_geometry", "Semantic records with unresolved geometry are retained explicitly; this is expected for foundation ingest."))
    return {"status": "PASS" if not errors else "FAIL", "errors": errors, "warnings": warnings, "counts": manifest.get("summary", {})}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=ROOT / "shared" / "model-manifest.json")
    parser.add_argument("--schema", type=Path, default=ROOT / "shared" / "model-manifest.schema.json")
    parser.add_argument("--json-report", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    report = validate_manifest(manifest, args.schema)
    if args.json_report:
        args.json_report.parent.mkdir(parents=True, exist_ok=True)
        args.json_report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
