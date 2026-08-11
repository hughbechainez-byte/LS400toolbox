#!/usr/bin/env python3
"""Measure the frozen airbox mask against the preserved v2 and inactive v3."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from PIL import Image

from run_airbox_candidate_qa import contour, label, mask, metrics, overlay


def passes(row: dict) -> bool:
    return (
        row['silhouetteIoU'] >= .75
        and max(row['bboxEdgeResidualPx']) <= 12
        and .90 <= row['visibleAreaRatio'] <= 1.10
        and row['orientationDifferenceDeg'] <= 8
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--output', default='qa/airbox-candidate-v3')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)

    reference_mask = mask(root / 'shared/photo-top-engine-reference-fixtures/airbox-maf-assembly.png')
    variants = {
        name: mask(output / f'photo-{name}-mask.png')
        for name in ('baseline', 'v2', 'v3')
    }
    report = {
        'referenceMask': str((root / 'shared/photo-top-engine-reference-fixtures/airbox-maf-assembly.png').resolve()),
        'variants': {name: metrics(reference_mask, value) for name, value in variants.items()},
        'targets': {
            'silhouetteIoUMin': .75,
            'bboxEdgeResidualMaxPx': 12,
            'visibleAreaRatioRange': [.90, 1.10],
            'orientationDifferenceMaxDeg': 8,
        },
    }
    report['passesNumericTargets'] = {name: passes(value) for name, value in report['variants'].items()}
    report['status'] = 'CANDIDATE V3 READY FOR HUMAN REVIEW' if report['passesNumericTargets']['v3'] else 'CANDIDATE V3 REJECTED — BASELINE PRESERVED'

    reference = Image.open(output / 'reference.jpg').convert('RGB')
    images = {name: Image.open(output / f'photo-{name}.png').convert('RGB') for name in variants}
    overview = Image.new('RGB', (reference.width * 4, reference.height))
    for index, (image, title) in enumerate([
        (reference, 'REFERENCE'),
        (images['baseline'], 'BASELINE'),
        (images['v2'], 'V2 PRESERVED'),
        (images['v3'], 'V3 CANDIDATE'),
    ]):
        overview.paste(label(image, title), (reference.width * index, 0))
    overview.save(output / 'reference-baseline-v2-v3-overhead.png')
    overlay(reference, images['v3'], 'REFERENCE / V3 50% OVERLAY').save(output / 'reference-v3-overlay-50.png')
    overlay(Image.open(output / 'photo-v2-mask.png'), Image.open(output / 'photo-v3-mask.png'), 'V2 / V3 MASK OVERLAY 50%').save(output / 'v2-v3-mask-overlay-50.png')
    contour(reference_mask, variants['v3']).save(output / 'v3-reference-contours.png')

    for stem in ('passenger-oblique', 'driver-oblique'):
        canvas = Image.new('RGB', (1920, 484))
        for index, (suffix, title) in enumerate([('baseline', 'BASELINE'), ('v2', 'V2 PRESERVED'), ('v3', 'V3 CANDIDATE')]):
            canvas.paste(label(Image.open(output / f'{stem}-{suffix}.png').convert('RGB'), f'{title} - {stem}'), (640 * index, 0))
        canvas.save(output / f'{stem}-baseline-v2-v3.png')

    with (output / 'metrics.csv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['variant', 'bbox', 'visibleAreaPx', 'centerPx', 'orientationDeg', 'bboxEdgeResidualPx', 'centerResidualPx', 'visibleAreaRatio', 'orientationDifferenceDeg', 'silhouetteIoU', 'meanBoundaryDistancePx'])
        for name, row in report['variants'].items():
            writer.writerow([name, row['candidate']['bbox'], row['candidate']['visibleAreaPx'], row['candidate']['centerPx'], row['candidate']['orientationDeg'], row['bboxEdgeResidualPx'], row['centerResidualPx'], row['visibleAreaRatio'], row['orientationDifferenceDeg'], row['silhouetteIoU'], row['meanBoundaryDistancePx']])
    (output / 'metrics.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
