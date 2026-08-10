#!/usr/bin/env python3
"""Freeze photograph-traced top-engine reference fixtures at 640x484."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = Path(r"C:\Users\blowb\Desktop\LS400toolbox\ls400_engine_bay_reference_exact.jpg")
OUTPUT = ROOT / "shared" / "photo-top-engine-reference-fixtures"
SIZE = (640, 484)
REFERENCE_SHA256 = "f8d74eec1af9c3014c107e0be18fc1fb83f5aff5d50e7ccd34d2da5318bfb725"


# These are direct visible-boundary traces in reference-image pixels.  They
# intentionally do not reuse component-fit polygons from photo-layout-landmarks
# or any projected model bounds.  Multiple regions represent visible islands of
# a single physical casting; they do not group separate service components.
FIXTURES = {
    "airbox-maf-assembly": {
        "label": "airbox / MAF assembly",
        "generatorIds": ["airbox", "intake-duct"],
        "regions": [
            [[0, 258], [54, 253], [86, 262], [112, 281], [123, 310], [115, 340], [86, 356], [0, 351]],
            [[76, 278], [104, 252], [137, 270], [162, 308], [149, 342], [118, 337], [95, 315]],
        ],
        "source": "direct visible-boundary trace from canonical exact JPG: black passenger-front air cleaner and metallic AFM housing",
    },
    "corrugated-intake-duct": {
        "label": "corrugated intake duct",
        "generatorIds": ["intake-duct"],
        "centerlinePx": [[132, 285], [151, 263], [158, 230], [160, 196], [171, 171], [194, 157], [213, 171]],
        "widthSamplesPx": [38, 43, 47, 48, 43, 36, 31],
        "source": "direct centreline and visible rubber-width samples from canonical exact JPG: AFM outlet through vertical sweep to throttle inlet",
    },
    "trac-throttle-assembly": {
        "label": "TRAC / throttle assembly",
        "generatorIds": ["trac-housing", "throttle-body"],
        "regions": [
            [[203, 108], [299, 108], [311, 119], [308, 147], [286, 157], [217, 153], [202, 139]],
            [[191, 151], [231, 148], [254, 163], [259, 190], [245, 215], [218, 222], [193, 205], [184, 180]],
        ],
        "source": "direct visible-boundary trace from canonical exact JPG: black TRAC cover plus adjoining offset throttle casting",
    },
    "silver-intake-manifold": {
        "label": "silver intake manifold and Lexus plate",
        "generatorIds": ["intake-manifold"],
        "regions": [
            [[270, 125], [331, 121], [360, 139], [374, 167], [378, 214], [364, 251], [341, 269], [300, 265], [270, 242], [258, 207], [259, 165]],
            [[286, 155], [345, 155], [357, 170], [353, 219], [335, 235], [298, 226], [284, 204]],
        ],
        "source": "direct visible-boundary trace from canonical exact JPG: curved alloy runner pack, center cover and Lexus plate",
    },
    "valve-cover-passenger": {
        "label": "image-left valve cover",
        "generatorIds": ["valve-cover-passenger"],
        "regions": [
            [[177, 183], [208, 169], [239, 181], [259, 212], [266, 248], [250, 287], [214, 285], [188, 259], [177, 222]],
        ],
        "source": "direct visible-boundary trace from canonical exact JPG: long passenger-bank cover",
    },
    "valve-cover-driver-four-cam": {
        "label": "image-right FOUR CAM 32 valve cover",
        "generatorIds": ["valve-cover-driver"],
        "regions": [
            [[401, 153], [446, 158], [468, 184], [478, 225], [469, 299], [437, 312], [407, 289], [396, 247], [393, 197]],
        ],
        "source": "direct visible-boundary trace from canonical exact JPG: long driver-bank FOUR CAM 32 cover",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mask_for(spec: dict) -> Image.Image:
    mask = Image.new("L", SIZE, 0)
    draw = ImageDraw.Draw(mask)
    for region in spec.get("regions", []):
        draw.polygon(region, fill=255)
    if "centerlinePx" in spec:
        points = [tuple(point) for point in spec["centerlinePx"]]
        widths = spec["widthSamplesPx"]
        for left, right, left_width, right_width in zip(points, points[1:], widths, widths[1:]):
            # Draw a taper as overlapping circles; this preserves the measured
            # width at every reviewed sample while giving the duct a continuous
            # photographic contour rather than a model-shaped polygon.
            steps = max(2, int(math.dist(left, right) / 2))
            for index in range(steps + 1):
                t = index / steps
                x = left[0] + (right[0] - left[0]) * t
                y = left[1] + (right[1] - left[1]) * t
                radius = (left_width + (right_width - left_width) * t) / 2
                draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=255)
    return mask


def metrics(mask: Image.Image) -> dict:
    data = np.asarray(mask) > 0
    points = np.argwhere(data)
    y0, x0 = points.min(axis=0)
    y1, x1 = points.max(axis=0)
    xy = points[:, [1, 0]].astype(np.float64)
    centered = xy - xy.mean(axis=0)
    values, vectors = np.linalg.eigh(np.cov(centered, rowvar=False))
    vector = vectors[:, int(np.argmax(values))]
    return {
        "bboxPx": [int(x0), int(y0), int(x1), int(y1)],
        "visibleAreaPx": int(data.sum()),
        "centerPx": [round(float(xy[:, 0].mean()), 3), round(float(xy[:, 1].mean()), 3)],
        "principalOrientationDeg": round(float(math.degrees(math.atan2(vector[1], vector[0])) % 180), 3),
    }


def main() -> int:
    if not REFERENCE.exists():
        raise SystemExit(f"BLOCKED: canonical reference is missing: {REFERENCE}")
    if sha256(REFERENCE) != REFERENCE_SHA256:
        raise SystemExit("BLOCKED: canonical reference hash differs from the locked fixture source.")
    reference = Image.open(REFERENCE).convert("RGB")
    if reference.size != SIZE:
        raise SystemExit(f"BLOCKED: canonical reference dimensions are {reference.size}, expected {SIZE}.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    labeled = reference.convert("RGBA")
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    colors = [(84, 225, 255, 115), (255, 180, 62, 115), (241, 92, 124, 115), (126, 225, 140, 115), (178, 136, 255, 115), (255, 235, 98, 115)]
    manifest = {"fixtureSetId": "LS400_TOP_ENGINE_REFERENCE_FIXTURES_V1", "reference": {"path": str(REFERENCE), "dimensionsPx": list(SIZE), "sha256": REFERENCE_SHA256}, "fixtures": []}
    for index, (fixture_id, spec) in enumerate(FIXTURES.items()):
        mask = mask_for(spec)
        filename = f"{fixture_id}.png"
        path = OUTPUT / filename
        mask.save(path)
        color = colors[index]
        binary = np.asarray(mask) > 0
        tint = Image.new("RGBA", SIZE, color)
        overlay.alpha_composite(Image.composite(tint, Image.new("RGBA", SIZE, (0, 0, 0, 0)), mask))
        draw.text((metrics(mask)["bboxPx"][0], max(0, metrics(mask)["bboxPx"][1] - 14)), f"{index + 1}. {spec['label']}", fill=(255, 246, 184, 255), stroke_width=2, stroke_fill=(0, 0, 0, 245))
        manifest["fixtures"].append({"id": fixture_id, "label": spec["label"], "mask": filename, "maskSha256": sha256(path), "generatorIds": spec["generatorIds"], "source": spec["source"], **metrics(mask), **({"centerlinePx": spec["centerlinePx"], "widthSamplesPx": spec["widthSamplesPx"]} if "centerlinePx" in spec else {})})
    labeled.alpha_composite(overlay)
    labeled.save(OUTPUT / "labeled-reference.png")
    manifest["labeledReferenceSha256"] = sha256(OUTPUT / "labeled-reference.png")
    (OUTPUT / "reference-fixtures.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "fixtures": len(manifest["fixtures"]), "reference": manifest["reference"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
