from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from validate_model_manifest import validate_manifest  # noqa: E402


class ModelFoundationValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "shared" / "model-manifest.json").read_text(encoding="utf-8"))

    def assertCode(self, manifest, code):
        report = validate_manifest(manifest)
        self.assertIn(code, {item["code"] for item in report["errors"]})

    def test_current_source_counts_and_ac_counts(self):
        summary = self.manifest["summary"]
        self.assertEqual(summary["componentCount"], 189)
        self.assertEqual(summary["connectionCount"], 209)
        self.assertEqual(summary["airConditioningComponentCount"], 19)
        self.assertEqual(summary["airConditioningConnectionCount"], 22)

    def test_duplicate_ids_are_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["components"].append(copy.deepcopy(manifest["components"][0]))
        self.assertCode(manifest, "duplicate_id")

    def test_missing_endpoint_and_orphan_port_are_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["connections"][0]["to"]["componentStableId"] = "component.missing"
        self.assertCode(manifest, "missing_endpoint")

    def test_invalid_option_reference_is_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["components"][0]["applicability"]["optionIds"] = ["option.does_not_exist"]
        self.assertCode(manifest, "invalid_option_reference")

    def test_non_finite_coordinates_are_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["foundation"]["historicalBaseline"]["shellHardpointsMm"]["cowlX"] = float("nan")
        self.assertCode(manifest, "non_finite_coordinate")

    def test_invalid_truth_state_is_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["components"][0]["geometry"]["truthState"] = "guessed"
        self.assertCode(manifest, "invalid_truth_state")

    def test_ac_high_low_contradiction_is_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        connection = next(item for item in manifest["connections"] if item["system"] == "AIR_CONDITIONING")
        connection["medium"] = "low_pressure_refrigerant_vapor"
        connection["from"]["portStableId"] = "port.ac_001_discharge_port"
        self.assertCode(manifest, "ac_side_contradiction")

    def test_physical_width_and_camera_contract_are_locked(self):
        report = validate_manifest(self.manifest)
        self.assertNotIn("envelope_contract", {item["code"] for item in report["errors"]})
        self.assertNotIn("impossible_span", {item["code"] for item in report["errors"]})
        replica = self.manifest["foundation"]["referencePhotoReplica"]
        self.assertEqual(replica["viewport"]["widthPx"], 640)
        self.assertEqual(replica["viewport"]["heightPx"], 484)
        self.assertEqual(replica["calibrationUse"], "body-only")


if __name__ == "__main__":
    unittest.main()
