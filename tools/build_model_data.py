#!/usr/bin/env python3
"""Build the renderer-neutral LS400 model-foundation data.

The manifest is the checked-in source of truth.  A source-root ingest is used
when the evidence CSVs are available locally; a clean checkout can regenerate
the platform outputs from the checked-in manifest without network access.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "shared" / "model-manifest.json"
ANNOTATIONS_PATH = ROOT / "shared" / "photo-annotations.json"
FOUNDATION_VERSION = "ls400-model-foundation-2026-08-09"

TRUTH_STATES = {
    "measured",
    "photo_solved",
    "diagram_only",
    "placeholder",
    "variant_unresolved",
}

GEOMETRY_TO_TRUTH = {
    "catalog_2d_only": "diagram_only",
    "hidden_route_geometry_pending": "placeholder",
    "location_verified_geometry_pending": "placeholder",
    "numbered_tube_endpoints_unresolved": "variant_unresolved",
    "off_scene_endpoint": "diagram_only",
    "option_specific_geometry_pending": "variant_unresolved",
    "photogrammetry_required": "placeholder",
    "schematic_only": "diagram_only",
}

OPTION_DEFINITIONS = [
    {"id": "all_1990_usa_ucf10", "label": "All 1990 USA UCF10"},
    {"id": "air_suspension", "label": "Air suspension"},
    {"id": "trac", "label": "TRAC"},
    {"id": "federal_emissions", "label": "Federal emissions"},
    {"id": "california_emissions", "label": "California emissions"},
    {"id": "original_r12", "label": "Original R-12 baseline"},
    {"id": "r134a_conversion", "label": "R-134a conversion"},
    {"id": "production_month", "label": "Production-month variant"},
    {"id": "build_date", "label": "Build-date variant"},
    {"id": "vin_required", "label": "VIN/build verification required"},
    {"id": "harness_variant", "label": "Harness variant"},
    {"id": "equipment_variant", "label": "Equipment variant"},
    {"id": "replacement_supersession", "label": "Replacement/supersession variant"},
    {"id": "conversion_state", "label": "Conversion state"},
    {"id": "option_specific", "label": "Option-specific configuration"},
]


# These are deliberately conservative structural values.  The factory spans
# stay in the baseline; the photo replica gets a camera and explicit visible
# hardpoints but never widens the physical envelope.
FOUNDATION_MM: dict[str, Any] = {
    "coordinateContract": {
        "units": "millimetres",
        "handedness": "right-handed",
        "origin": "front-axle-centerline-ground-projection",
        "axes": {"x": "forward", "y": "vehicle-left-driver-side", "z": "up"},
        "runtimeScale": {"metresPerMillimetre": 0.001},
    },
    "variants": [
        {
            "id": "DEC_1989_HISTORICAL_BASELINE",
            "kind": "historical-baseline",
            "configuration": "December 1989 U.S. UCF10L-AEPGKA; CA emissions and air suspension are working assumptions.",
            "truthState": "variant_unresolved",
            "notes": [
                "VIN, production month, TRAC state, emissions hardware, refrigerant, retrofit and collision state remain unresolved.",
                "Factory body spans are retained as measured source constraints; they are not photo-derived component anchors.",
            ],
        },
        {
            "id": "REFERENCE_PHOTO_REPLICA",
            "kind": "photo-replica",
            "configuration": "Calibrated comparison view for the private 800x489 engine-top reference.",
            "truthState": "photo_solved",
            "notes": [
                "This is a camera/framing replica, not a claim that the private subject photo is a measured neutral vehicle.",
                "Movable components are excluded from camera calibration constraints.",
            ],
        },
    ],
    "vehicleDimensionsMm": {
        "overallLength": 4995,
        "overallWidth": 1820,
        "overallHeight": 1400,
        "wheelbase": 2815,
    },
    "physicalEnvelope": {
        "overallWidthMm": 1820,
        "halfWidthMm": 910,
        "hardpointClearanceMm": 0,
        "note": "No structural hardpoint or visible envelope may exceed +/-910 mm lateral merely to match pixels.",
    },
    "historicalBaseline": {
        "variantId": "DEC_1989_HISTORICAL_BASELINE",
        "shellHardpointsMm": {
            "cowlOuterHalfWidth": 776,
            "cowlInnerHalfWidth": 747,
            "radiatorSupportHardpointHalfWidth": 754.5,
            "springSupportInnerHoleHalfWidth": 525,
            "strutTowerCenterHalfWidth": 735,
            "apronOuterHalfWidth": 900,
            "apronInnerHalfWidth": 720,
            "apronRailHalfWidth": 850,
            "firewallX": -1045,
            "cowlX": -1110,
            "radiatorSupportX": 1060,
            "condenserX": 960,
            "fanPlaneX": 870,
            "radiatorX": 785,
            "frontBumperX": 1375,
        },
        "anchorsMm": {
            "engine": [-220, 0, 540],
            "engineFrontX": 310,
            "engineRearX": -770,
            "compressor": [180, 270, 460],
            "throttle": [-182, -321, 800],
            "airbox": [411, -508, 570],
            "maf": [204, -720, 600],
            "battery": [542, 675, 590],
            "fuseBox": [297, 690, 640],
            "coolantReservoir": [25, 720, 770],
            "brakeBooster": [-946, 690, 790],
            "strutTowerPassenger": [-353, -735, 700],
            "strutTowerDriver": [-353, 735, 700],
            "radiatorSupport": [1060, 0, 610],
            "condenser": [960, 0, 555],
            "coolingFans": [870, 0, 575],
            "radiator": [785, 0, 570],
            "receiverDrier": [950, -690, 590],
        },
    },
    "referencePhotoReplica": {
        "variantId": "REFERENCE_PHOTO_REPLICA",
        "sourcePhoto": {
            "logicalName": "ls400_engine_bay_reference_exact.jpg",
            "path": "C:/Users/blowb/Desktop/LS400toolbox/ls400_engine_bay_reference_exact.jpg",
            "widthPx": 640,
            "heightPx": 484,
            "privacy": "private-no-ship",
        },
        "viewport": {"widthPx": 800, "heightPx": 489, "devicePixelRatio": 1},
        "crop": {"xPx": 0, "yPx": 0, "widthPx": 800, "heightPx": 489},
        "camera": {
            "coordinateSpace": "vehicle-millimetres",
            "positionMm": [2758.506, 0, 2295.073],
            "targetMm": [-200.456, 0, 708.148],
            "rollDeg": 0,
            "fovDeg": 20,
            "nearMm": 25,
            "farMm": 30000,
            "projection": "perspective",
            "lensFocalLengthMm": None,
            "lensAmbiguity": "Unresolved: the private image does not include calibrated intrinsics or an exact subject-camera distance.",
            "locked": True,
            "solver": {
                "method": "bounded deterministic coordinate descent",
                "seed": 20260809,
                "featureClass": "body-only",
                "featureIds": [
                    "body.cowl.outer.passenger",
                    "body.cowl.center",
                    "body.cowl.outer.driver",
                    "body.firewall.passenger",
                    "body.firewall.driver",
                    "body.tower.passenger",
                    "body.tower.driver",
                    "body.spring-hole.passenger",
                    "body.spring-hole.driver",
                    "body.radiator-support.passenger",
                    "body.radiator-support.center",
                    "body.radiator-support.driver",
                    "body.hood-latch",
                    "body.centerline.rear",
                    "body.centerline.front",
                ],
                "bounds": {
                    "cameraForwardM": [0.5, 4.0],
                    "cameraHeightM": [1.0, 4.0],
                    "targetForwardM": [-1.0, 0.5],
                    "targetHeightM": [0.4, 1.2],
                    "fovDeg": [20.0, 60.0],
                },
                "rmsePx": 44.483318,
                "medianResidualPx": 53.536546,
                "maximumResidualPx": 90.265457,
                "status": "locked_with_evidence_residual",
            },
        },
        "rootScale": {"value": 1, "unit": "model-scale", "truthState": "measured"},
        "shellHardpointsMm": {
            "cowlOuterHalfWidth": 776,
            "cowlInnerHalfWidth": 747,
            "radiatorSupportHardpointHalfWidth": 754.5,
            "springSupportInnerHoleHalfWidth": 525,
            "strutTowerCenterHalfWidth": 735,
            "apronOuterHalfWidth": 900,
            "apronInnerHalfWidth": 720,
            "apronRailHalfWidth": 850,
            "firewallX": -1045,
            "cowlX": -1110,
            "radiatorSupportX": 1060,
            "condenserX": 960,
            "fanPlaneX": 870,
            "radiatorX": 785,
            "frontBumperX": 1375,
        },
        "handednessChecks": {
            "passengerSideProjectsScreenLeft": True,
            "driverSideProjectsScreenRight": True,
            "positiveZProjectsScreenUp": True,
        },
        "calibrationUse": "body-only",
        "unresolvedEvidence": [
            "The photograph supplies image-space evidence, not a calibrated survey of the target vehicle.",
            "Visible tower/apron and radiator-support edges are photo-solved comparison features; hidden offsets remain unresolved.",
        ],
    },
}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def stable_id(kind: str, value: str) -> str:
    return f"{kind}.{slug(value)}"


def split_semicolon(value: str) -> list[str]:
    return [part.strip() for part in value.split(";") if part.strip()]


def truth_state(raw: str) -> str:
    return GEOMETRY_TO_TRUTH.get(raw, "placeholder")


def option_ids(raw: str) -> list[str]:
    text = raw.lower()
    result: list[str] = []
    checks = [
        ("all_1990_usa_ucf10", "all 1990 usa ucf10"),
        ("air_suspension", "air suspension"),
        ("trac", "trac"),
        ("federal_emissions", "federal"),
        ("california_emissions", "california"),
        ("original_r12", "r-12"),
        ("r134a_conversion", "conversion"),
        ("production_month", "production-month"),
        ("build_date", "build-date"),
        ("vin_required", "vin"),
        ("harness_variant", "harness"),
        ("equipment_variant", "equipment"),
        ("replacement_supersession", "supersession"),
        ("conversion_state", "conversion status"),
        ("option_specific", "option-specific"),
    ]
    for key, needle in checks:
        if needle in text and key not in result:
            result.append(key)
    return result or ["option_specific"]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def source_tokens(rows: list[dict[str, str]]) -> set[str]:
    result: set[str] = set()
    for row in rows:
        result.update(split_semicolon(row.get("source_reference", "")))
    return result


def runtime_inventory(model_data: Path) -> dict[str, list[str]]:
    """Extract only the stable viewer IDs; geometry stays in the renderer."""

    text = model_data.read_text(encoding="utf-8")

    def ids_between(start: str, end: str) -> list[str]:
        section = text.split(start, 1)[1].split(end, 1)[0]
        ids = re.findall(r"\bid:\s*'([^']+)'", section)
        return list(dict.fromkeys(ids))

    return {
        "windowsComponents": ids_between("export const COMPONENTS = [", "export const ROUTES = ["),
        "windowsRoutes": ids_between("export const ROUTES = [", "export const CAMERA_PRESETS = {") ,
    }


def port_transform(component_id: str, port_name: str) -> dict[str, Any]:
    # The CSVs establish named endpoints, not local fitting coordinates.  A
    # null transform is intentional and must remain visibly unresolved until a
    # subject-car capture supplies it.
    return {
        "units": "millimetres",
        "truthState": "placeholder",
        "positionMm": None,
        "rotationEulerDeg": None,
        "evidenceSourceIds": [],
        "uncertainty": "Named port is known from the connection ledger; local fitting transform requires physical capture.",
    }


def build_manifest(source_root: Path, reference_image: Path | None = None) -> dict[str, Any]:
    components_rows = read_csv(source_root / "data" / "component_registry.csv")
    connection_rows = read_csv(source_root / "data" / "connections.csv")
    if len(components_rows) != 189 or len(connection_rows) != 209:
        raise ValueError(f"unexpected evidence counts: components={len(components_rows)} connections={len(connection_rows)}")

    component_ids = {row["component_id"] for row in components_rows}
    connection_ids = {row["connection_id"] for row in connection_rows}
    if len(component_ids) != len(components_rows) or len(connection_ids) != len(connection_rows):
        raise ValueError("duplicate source IDs in evidence CSVs")

    all_source_ids = source_tokens(components_rows) | source_tokens(connection_rows)
    sources = [
        {
            "id": "LOCAL_COMPONENT_REGISTRY",
            "kind": "structured-evidence",
            "label": "component_registry.csv",
            "privacy": "local-derived-structured-data",
        },
        {
            "id": "LOCAL_CONNECTION_LEDGER",
            "kind": "structured-evidence",
            "label": "connections.csv",
            "privacy": "local-derived-structured-data",
        },
        {
            "id": "RM144U_B0_186",
            "kind": "body-dimension-source",
            "label": "RM144U B0-186 body hardpoint network",
            "privacy": "private-local-reference",
            "truthState": "measured",
        },
        {
            "id": "PRIVATE_REFERENCE_PHOTO",
            "kind": "photo",
            "label": "Private user engine-top reference",
            "privacy": "private-no-ship",
            "truthState": "photo_solved",
        },
    ]
    known = {entry["id"] for entry in sources}
    for source_id in sorted(all_source_ids - known):
        sources.append({
            "id": source_id,
            "kind": "record-reference",
            "label": source_id,
            "privacy": "provenance-only",
        })

    ports_by_component: dict[str, dict[str, dict[str, Any]]] = {cid: {} for cid in component_ids}
    for row in connection_rows:
        for side, field, direction in (("from", "from_port", "out"), ("to", "to_port", "in")):
            cid = row[f"{side}_component_id"]
            port_name = row[field]
            port_id = stable_id("port", f"{cid}_{port_name}")
            port = ports_by_component[cid].setdefault(port_name, {
                "stableId": port_id,
                "legacyIds": [port_name],
                "name": port_name,
                "directions": [],
                "media": [],
                "localTransform": port_transform(cid, port_name),
            })
            if direction not in port["directions"]:
                port["directions"].append(direction)
            if row["medium"] not in port["media"]:
                port["media"].append(row["medium"])

    component_records = []
    for row in components_rows:
        cid = row["component_id"]
        component_records.append({
            "stableId": stable_id("component", cid),
            "legacyIds": [cid],
            "system": row["system_id"],
            "displayName": row["display_name"],
            "aliases": [],
            "componentClass": row["component_class"],
            "oemPartNumbers": split_semicolon(row["oem_part_numbers"]),
            "vehicleLocation": row["vehicle_location"],
            "function": row["endpoints_or_function"],
            "applicability": {
                "raw": row["option_build_applicability"],
                "optionIds": option_ids(row["option_build_applicability"]),
                "unresolved": any(token in row["option_build_applicability"].lower() for token in ("vin", "exact", "pending", "variant", "depends")),
            },
            "ports": list(ports_by_component[cid].values()),
            "geometry": {
                "units": "millimetres",
                "truthState": truth_state(row["geometry_status"]),
                "statusRaw": row["geometry_status"],
                "centerMm": None,
                "envelopeMm": None,
                "sourceIds": split_semicolon(row["source_reference"]),
                "uncertainty": "No silent geometry was inferred from a semantic registry record.",
            },
            "confidence": row["confidence"],
            "sourceIds": split_semicolon(row["source_reference"]),
            "service": {"role": row["service_role"], "actionGate": row["service_action_gate"]},
            "uncertaintyNotes": [row["service_notes"]],
            "rawRecord": row,
        })

    connections = []
    for row in connection_rows:
        from_id = stable_id("component", row["from_component_id"])
        to_id = stable_id("component", row["to_component_id"])
        from_port = stable_id("port", f"{row['from_component_id']}_{row['from_port']}")
        to_port = stable_id("port", f"{row['to_component_id']}_{row['to_port']}")
        line_truth = truth_state(row["geometry_status"])
        connections.append({
            "stableId": stable_id("connection", row["connection_id"]),
            "legacyIds": [row["connection_id"]],
            "system": row["system_id"],
            "from": {"componentStableId": from_id, "portStableId": from_port},
            "to": {"componentStableId": to_id, "portStableId": to_port},
            "medium": row["medium"],
            "direction": row["direction"],
            "connectionType": row["connection_type"],
            "routeLandmarks": row["route_landmarks"],
            "applicability": {
                "raw": row["option_build_applicability"],
                "optionIds": option_ids(row["option_build_applicability"]),
                "unresolved": any(token in row["option_build_applicability"].lower() for token in ("vin", "exact", "pending", "variant", "depends")),
            },
            "centerline": {
                "units": "millimetres",
                "truthState": line_truth,
                "pointsMm": [],
                "segments": [],
                "editable": True,
                "uncertainty": "Endpoint topology is preserved; installed centerline and per-segment evidence require capture or explicit diagram tracing.",
            },
            "geometryStatus": row["geometry_status"],
            "confidence": row["confidence"],
            "sourceIds": split_semicolon(row["source_reference"]),
            "service": {"role": row["service_role"], "actionGate": row["service_action_gate"]},
            "uncertaintyNotes": [row["service_notes"]],
            "rawRecord": row,
        })

    runtime = runtime_inventory(ROOT / "windows" / "interactive-3d-prototype" / "model-data.js")
    runtime_mappings = []
    for kind, key in (("component", "windowsComponents"), ("route", "windowsRoutes")):
        for viewer_id in runtime[key]:
            runtime_mappings.append({
                "stableId": stable_id(f"runtime.windows.{kind}", viewer_id),
                "viewerId": viewer_id,
                "kind": kind,
                "legacyIds": [viewer_id],
                "source": "windows/interactive-3d-prototype/model-data.js",
                "semanticRecord": None,
                "mappingStatus": "explicit-runtime-legacy-id",
            })

    if reference_image and reference_image.exists():
        image_sha = hashlib.sha256(reference_image.read_bytes()).hexdigest()
        FOUNDATION_MM["referencePhotoReplica"]["sourcePhoto"]["sha256"] = image_sha

    manifest = {
        "$schema": "./model-manifest.schema.json",
        "manifestId": "LS400_MODEL_FOUNDATION",
        "manifestVersion": FOUNDATION_VERSION,
        "units": "millimetres",
        "coordinateContract": FOUNDATION_MM["coordinateContract"],
        "truthStates": sorted(TRUTH_STATES),
        "options": OPTION_DEFINITIONS,
        "variants": FOUNDATION_MM["variants"],
        "sources": sources,
        "foundation": FOUNDATION_MM,
        "components": component_records,
        "connections": connections,
        "runtimeMappings": runtime_mappings,
        "platformTargets": {
            "windows": {"generatedModule": "windows/interactive-3d-prototype/model-foundation.generated.js", "runtimeUnits": "metres"},
            "android": {"generatedClass": "com.ls400.toolbox.ModelManifest", "runtimeUnits": "metres"},
        },
        "sourceSnapshot": {
            "componentRegistryFile": "component_registry.csv",
            "connectionsFile": "connections.csv",
            "componentRecords": components_rows,
            "connectionRecords": connection_rows,
        },
        "summary": {
            "componentCount": len(component_records),
            "connectionCount": len(connections),
            "airConditioningComponentCount": sum(row["system_id"] == "AIR_CONDITIONING" for row in components_rows),
            "airConditioningConnectionCount": sum(row["system_id"] == "AIR_CONDITIONING" for row in connection_rows),
            "runtimeWindowsComponentCount": len(runtime["windowsComponents"]),
            "runtimeWindowsRouteCount": len(runtime["windowsRoutes"]),
        },
        "integrity": {"sha256": None},
    }
    return manifest


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json_bytes(value))


def manifest_hash(manifest: dict[str, Any]) -> str:
    copy = json.loads(json.dumps(manifest))
    copy.setdefault("integrity", {})["sha256"] = None
    return hashlib.sha256(json_bytes(copy)).hexdigest()


def millimetres_to_metres(value: Any) -> Any:
    if isinstance(value, (int, float)):
        return round(float(value) * 0.001, 9)
    if isinstance(value, list):
        return [millimetres_to_metres(item) for item in value]
    if isinstance(value, dict):
        return {key: millimetres_to_metres(item) for key, item in value.items()}
    return value


def platform_contract(manifest: dict[str, Any]) -> dict[str, Any]:
    foundation = manifest["foundation"]
    base = foundation["historicalBaseline"]
    replica = foundation["referencePhotoReplica"]
    hardpoints = base["shellHardpointsMm"]
    anchors = base["anchorsMm"]
    structural = {
        "cowlOuterHalfWidth": millimetres_to_metres(hardpoints["cowlOuterHalfWidth"]),
        "cowlInnerHalfWidth": millimetres_to_metres(hardpoints["cowlInnerHalfWidth"]),
        "radiatorSupportHardpointHalfWidth": millimetres_to_metres(hardpoints["radiatorSupportHardpointHalfWidth"]),
        "springSupportInnerHoleHalfWidth": millimetres_to_metres(hardpoints["springSupportInnerHoleHalfWidth"]),
        "strutTowerPhotoCenterHalfWidth": millimetres_to_metres(hardpoints["strutTowerCenterHalfWidth"]),
        "apronOuterHalfWidth": millimetres_to_metres(hardpoints["apronOuterHalfWidth"]),
        "apronInnerHalfWidth": millimetres_to_metres(hardpoints["apronInnerHalfWidth"]),
        "apronRailHalfWidth": millimetres_to_metres(hardpoints["apronRailHalfWidth"]),
        "firewallX": millimetres_to_metres(hardpoints["firewallX"]),
        "cowlX": millimetres_to_metres(hardpoints["cowlX"]),
        "radiatorSupportX": millimetres_to_metres(hardpoints["radiatorSupportX"]),
        "condenserX": millimetres_to_metres(hardpoints["condenserX"]),
        "fanPlaneX": millimetres_to_metres(hardpoints["fanPlaneX"]),
        "radiatorX": millimetres_to_metres(hardpoints["radiatorX"]),
        "frontBumperX": millimetres_to_metres(hardpoints["frontBumperX"]),
    }
    camera = replica["camera"]
    camera_metres = {
        "position": millimetres_to_metres(camera["positionMm"]),
        "target": millimetres_to_metres(camera["targetMm"]),
        "roll": camera["rollDeg"],
        "fov": camera["fovDeg"],
        "principalPointOffset": camera.get("principalPointOffset", [0.0, 0.0]),
        "near": millimetres_to_metres(camera["nearMm"]),
        "far": millimetres_to_metres(camera["farMm"]),
        "locked": camera["locked"],
    }
    return {
        "structural": structural,
        "anchors": millimetres_to_metres(anchors),
        "vehicleDimensions": millimetres_to_metres(foundation["vehicleDimensionsMm"]),
        "camera": camera_metres,
        "coordinateScale": 0.001,
    }


def js_literal(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False)


def write_platform_outputs(manifest: dict[str, Any], root: Path) -> None:
    manifest_digest = manifest_hash(manifest)
    build_key = manifest_digest[:16]
    manifest["integrity"]["sha256"] = manifest_digest
    write_json(root / "shared" / "model-manifest.json", manifest)
    calibration = {
        "$schema": "./photo-calibration.schema.json",
        "manifestId": manifest["manifestId"],
        "manifestVersion": manifest["manifestVersion"],
        "calibrationId": "REFERENCE_PHOTO_REPLICA",
        "sourceManifest": "model-manifest.json#/foundation/referencePhotoReplica",
        **manifest["foundation"]["referencePhotoReplica"],
        "bodyConstraints": [
            {"id": "B0_186_COWL_OUTER_JJ", "spanMm": 1552, "truthState": "measured", "sourceIds": ["RM144U_B0_186"], "confidence": "factory-body-dimension"},
            {"id": "B0_186_COWL_CC", "spanMm": 1494, "truthState": "measured", "sourceIds": ["RM144U_B0_186"], "confidence": "factory-body-dimension"},
            {"id": "B0_186_RADIATOR_AA", "spanMm": 1509, "truthState": "measured", "sourceIds": ["RM144U_B0_186"], "confidence": "factory-body-dimension"},
            {"id": "B0_186_SPRING_BB", "spanMm": 1050, "truthState": "measured", "sourceIds": ["RM144U_B0_186"], "confidence": "factory-body-dimension"},
            {"id": "OVERALL_WIDTH", "spanMm": 1820, "truthState": "diagram_only", "sourceIds": ["LOCAL_COMPONENT_REGISTRY"], "confidence": "vehicle-envelope-contract"},
        ],
        "residuals": None,
    }
    write_json(root / "shared" / "photo-calibration.json", calibration)

    contract = platform_contract(manifest)
    js = """/* GENERATED by tools/build_model_data.py; edit shared/model-manifest.json instead. */\n"""
    js += f"export const MODEL_FOUNDATION_MANIFEST_VERSION = {json.dumps(manifest['manifestVersion'])};\n"
    js += f"export const MODEL_FOUNDATION_BUILD_KEY = {json.dumps(build_key)};\n"
    js += f"export const MODEL_FOUNDATION_SHA256 = {json.dumps(manifest_digest)};\n"
    js += f"export const MODEL_FOUNDATION_SUMMARY = {js_literal(manifest['summary'])};\n"
    js += f"export const MODEL_FOUNDATION_MM = {js_literal(manifest['foundation'])};\n"
    js += f"export const MODEL_FOUNDATION_METRES = {js_literal(contract)};\n"
    (root / "windows" / "interactive-3d-prototype" / "model-foundation.generated.js").write_text(js, encoding="utf-8")

    android_assets = root / "android-native" / "app" / "src" / "main" / "assets"
    android_assets.mkdir(parents=True, exist_ok=True)
    write_json(android_assets / "model-manifest.json", manifest)
    dimensions = contract["vehicleDimensions"]
    structural = contract["structural"]
    camera = contract["camera"]
    java = f"""// GENERATED by tools/build_model_data.py; edit shared/model-manifest.json instead.
package com.ls400.toolbox;

public final class ModelManifest {{
    public static final String VERSION = {json.dumps(manifest['manifestVersion'])};
    public static final String BUILD_KEY = {json.dumps(build_key)};
    public static final String SHA256 = {json.dumps(manifest_digest)};
    public static final int COMPONENT_COUNT = {manifest['summary']['componentCount']};
    public static final int CONNECTION_COUNT = {manifest['summary']['connectionCount']};
    public static final float VEHICLE_WIDTH_M = {dimensions['overallWidth']:.9f}f;
    public static final float COWL_J_J_SPAN_M = 1.552f;
    public static final float INNER_COWL_C_C_SPAN_M = 1.494f;
    public static final float RADIATOR_SUPPORT_A_A_SPAN_M = 1.509f;
    public static final float SPRING_SUPPORT_B_B_SPAN_M = 1.050f;
    public static final float STRUT_TOWER_APRON_CENTER_OFFSET_M = {structural['strutTowerPhotoCenterHalfWidth']:.9f}f;
    public static final float OUTER_TOP_APRON_HALF_WIDTH_M = {structural['apronOuterHalfWidth']:.9f}f;
    public static final float INNER_APRON_RAIL_CENTER_OFFSET_M = {structural['apronInnerHalfWidth']:.9f}f;
    public static final float OUTER_APRON_RAIL_CENTER_OFFSET_M = {structural['apronRailHalfWidth']:.9f}f;
    public static final float PASSENGER_STRUT_TOWER_FORWARD_M = {contract['anchors']['strutTowerPassenger'][0]:.9f}f;
    public static final float PASSENGER_STRUT_TOWER_LATERAL_M = {contract['anchors']['strutTowerPassenger'][1]:.9f}f;
    public static final float DRIVER_STRUT_TOWER_FORWARD_M = {contract['anchors']['strutTowerDriver'][0]:.9f}f;
    public static final float DRIVER_STRUT_TOWER_LATERAL_M = {contract['anchors']['strutTowerDriver'][1]:.9f}f;
    public static final float ENGINE_FORWARD_M = {contract['anchors']['engine'][0]:.9f}f;
    public static final float ENGINE_UP_M = {contract['anchors']['engine'][2]:.9f}f;
    public static final float THROTTLE_FORWARD_M = {contract['anchors']['throttle'][0]:.9f}f;
    public static final float THROTTLE_LATERAL_M = {contract['anchors']['throttle'][1]:.9f}f;
    public static final float THROTTLE_UP_M = {contract['anchors']['throttle'][2]:.9f}f;
    public static final float AIRBOX_FORWARD_M = {contract['anchors']['airbox'][0]:.9f}f;
    public static final float AIRBOX_LATERAL_M = {contract['anchors']['airbox'][1]:.9f}f;
    public static final float AIRBOX_UP_M = {contract['anchors']['airbox'][2]:.9f}f;
    public static final float MAF_FORWARD_M = {contract['anchors']['maf'][0]:.9f}f;
    public static final float MAF_LATERAL_M = {contract['anchors']['maf'][1]:.9f}f;
    public static final float MAF_UP_M = {contract['anchors']['maf'][2]:.9f}f;
    public static final float DRIVER_BATTERY_FORWARD_M = {contract['anchors']['battery'][0]:.9f}f;
    public static final float DRIVER_BATTERY_LATERAL_M = {contract['anchors']['battery'][1]:.9f}f;
    public static final float DRIVER_BATTERY_UP_M = {contract['anchors']['battery'][2]:.9f}f;
    public static final float DRIVER_FUSE_FORWARD_M = {contract['anchors']['fuseBox'][0]:.9f}f;
    public static final float DRIVER_FUSE_LATERAL_M = {contract['anchors']['fuseBox'][1]:.9f}f;
    public static final float DRIVER_FUSE_UP_M = {contract['anchors']['fuseBox'][2]:.9f}f;
    public static final float DRIVER_COOLANT_RESERVE_FORWARD_M = {contract['anchors']['coolantReservoir'][0]:.9f}f;
    public static final float DRIVER_COOLANT_RESERVE_LATERAL_M = {contract['anchors']['coolantReservoir'][1]:.9f}f;
    public static final float DRIVER_COOLANT_RESERVE_UP_M = {contract['anchors']['coolantReservoir'][2]:.9f}f;
    public static final float BRAKE_BOOSTER_FORWARD_M = {contract['anchors']['brakeBooster'][0]:.9f}f;
    public static final float BRAKE_BOOSTER_LATERAL_M = {contract['anchors']['brakeBooster'][1]:.9f}f;
    public static final float BRAKE_BOOSTER_UP_M = {contract['anchors']['brakeBooster'][2]:.9f}f;
    public static final float RADIATOR_SUPPORT_FORWARD_M = {contract['anchors']['radiatorSupport'][0]:.9f}f;
    public static final float CONDENSER_FORWARD_M = {contract['anchors']['condenser'][0]:.9f}f;
    public static final float FAN_PLANE_FORWARD_M = {contract['anchors']['coolingFans'][0]:.9f}f;
    public static final float RADIATOR_FORWARD_M = {contract['anchors']['radiator'][0]:.9f}f;
    public static final float FRONT_BUMPER_FORWARD_M = {structural['frontBumperX']:.9f}f;
    public static final float RECEIVER_DRIER_FORWARD_M = {contract['anchors']['receiverDrier'][0]:.9f}f;
    public static final float RECEIVER_DRIER_LATERAL_M = {contract['anchors']['receiverDrier'][1]:.9f}f;
    public static final float RECEIVER_DRIER_UP_M = {contract['anchors']['receiverDrier'][2]:.9f}f;
    public static final float PHOTO_CAMERA_FOV_DEG = {camera['fov']:.9f}f;
    public static final float PHOTO_CAMERA_POSITION_WORLD_X_M = 0f;
    public static final float PHOTO_CAMERA_POSITION_WORLD_Y_M = {camera['position'][2]:.9f}f;
    public static final float PHOTO_CAMERA_POSITION_WORLD_Z_M = {-camera['position'][0]:.9f}f;
    public static final float PHOTO_CAMERA_TARGET_WORLD_X_M = 0f;
    public static final float PHOTO_CAMERA_TARGET_WORLD_Y_M = {camera['target'][2]:.9f}f;
    public static final float PHOTO_CAMERA_TARGET_WORLD_Z_M = {-camera['target'][0]:.9f}f;
    private ModelManifest() {{}}
}}
"""
    java_path = root / "android-native" / "app" / "src" / "main" / "java" / "com" / "ls400" / "toolbox" / "ModelManifest.java"
    java_path.parent.mkdir(parents=True, exist_ok=True)
    java_path.write_text(java, encoding="utf-8")

    # The query key is deliberately tied to the manifest bytes so a clean
    # browser session cannot reuse a stale generated contract.
    for relative in ("windows/interactive-3d-prototype/app.js", "windows/interactive-3d-prototype/model-data.js"):
        path = root / relative
        text = path.read_text(encoding="utf-8")
        text = text.replace("__FOUNDATION_BUILD_KEY__", build_key)
        text = re.sub(r"\?foundation=[A-Za-z0-9]+", f"?foundation={build_key}", text)
        path.write_text(text, encoding="utf-8")

    print(json.dumps({
        "manifest": str(root / "shared" / "model-manifest.json"),
        "buildKey": build_key,
        "summary": manifest["summary"],
        "generated": [
            str(root / "windows" / "interactive-3d-prototype" / "model-foundation.generated.js"),
            str(java_path),
            str(android_assets / "model-manifest.json"),
            str(root / "shared" / "photo-calibration.json"),
        ],
    }, indent=2))


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, help="Local evidence package containing data/*.csv")
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--reference-image", type=Path, help="Private local photo used only for hash provenance")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()

    manifest_path = args.root / args.manifest if not args.manifest.is_absolute() else args.manifest
    if args.source_root:
        manifest = build_manifest(args.source_root.resolve(), args.reference_image.resolve() if args.reference_image else None)
    elif manifest_path.exists():
        manifest = load_manifest(manifest_path)
    else:
        raise SystemExit("manifest missing; supply --source-root for the initial local ingest")
    write_platform_outputs(manifest, args.root.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
