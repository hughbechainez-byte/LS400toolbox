#!/usr/bin/env python3
"""Offline comparison for the inactive airbox/MAF candidate.

The frozen reference mask is read-only evidence; this script never edits it or
uses its contour to construct runtime geometry.
"""
from __future__ import annotations
import argparse, json, math, csv
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

def mask(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert('L')) > 127

def bbox(m: np.ndarray):
    ys, xs = np.where(m)
    if len(xs) == 0: return [None, None, None, None]
    return [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]

def orientation(m: np.ndarray) -> float:
    ys, xs = np.where(m)
    if len(xs) < 2: return 0.0
    cov = np.cov(np.stack([xs, ys], axis=0))
    vals, vecs = np.linalg.eigh(cov)
    v = vecs[:, np.argmax(vals)]
    return math.degrees(math.atan2(float(v[1]), float(v[0]))) % 180.0

def center(m: np.ndarray):
    ys, xs = np.where(m)
    return [float(xs.mean()), float(ys.mean())] if len(xs) else [None, None]

def boundary(m: np.ndarray) -> np.ndarray:
    up = np.zeros_like(m); up[1:] = m[:-1]
    down = np.zeros_like(m); down[:-1] = m[1:]
    left = np.zeros_like(m); left[:,1:] = m[:,:-1]
    right = np.zeros_like(m); right[:,:-1] = m[:,1:]
    return m & ~(up & down & left & right)

def mean_boundary_distance(a: np.ndarray, b: np.ndarray) -> float:
    ba, bb = boundary(a), boundary(b)
    ya, xa = np.where(ba); yb, xb = np.where(bb)
    if not len(xa) or not len(xb): return float('inf')
    def one(xs, ys, tx, ty):
        best = 0.0; total = 0.0
        for i in range(0, len(xs), 256):
            dx = xs[i:i+256,None].astype(float) - tx[None,:]
            dy = ys[i:i+256,None].astype(float) - ty[None,:]
            d = np.sqrt(np.min(dx*dx + dy*dy, axis=1))
            total += float(d.sum()); best = max(best, float(d.max()))
        return total / len(xs), best
    p, _ = one(xa, ya, xb, yb); q, _ = one(xb, yb, xa, ya)
    return (p + q) / 2.0

def metrics(reference: np.ndarray, candidate: np.ndarray):
    rb, cb = bbox(reference), bbox(candidate)
    area_r, area_c = int(reference.sum()), int(candidate.sum())
    angle_r, angle_c = orientation(reference), orientation(candidate)
    angle_diff = abs(angle_r-angle_c); angle_diff = min(angle_diff, 180-angle_diff)
    iou = float((reference & candidate).sum() / max(1, (reference | candidate).sum()))
    return {
        'reference': {'bbox': rb, 'visibleAreaPx': area_r, 'centerPx': center(reference), 'orientationDeg': angle_r},
        'candidate': {'bbox': cb, 'visibleAreaPx': area_c, 'centerPx': center(candidate), 'orientationDeg': angle_c},
        'bboxEdgeResidualPx': [None if x is None or y is None else abs(x-y) for x,y in zip(rb, cb)],
        'centerResidualPx': [None if x is None or y is None else abs(x-y) for x,y in zip(center(reference), center(candidate))],
        'visibleAreaRatio': area_c / max(1, area_r),
        'orientationDifferenceDeg': angle_diff,
        'silhouetteIoU': iou,
        'meanBoundaryDistancePx': mean_boundary_distance(reference, candidate),
    }

def label(im: Image.Image, title: str) -> Image.Image:
    out = im.convert('RGB').copy(); d = ImageDraw.Draw(out); d.rectangle((0,0,out.width,28), fill=(5,10,14)); d.text((8,7), title, fill=(245,232,188)); return out

def side_by_side(a: Image.Image, b: Image.Image, title_a: str, title_b: str) -> Image.Image:
    out = Image.new('RGB', (a.width*2, a.height), (0,0,0)); out.paste(label(a,title_a),(0,0)); out.paste(label(b,title_b),(a.width,0)); return out

def overlay(a: Image.Image, b: Image.Image, title: str) -> Image.Image:
    out = Image.blend(a.convert('RGB'), b.convert('RGB'), .5); return label(out, title)

def contour(ref: np.ndarray, cand: np.ndarray) -> Image.Image:
    out = np.zeros((ref.shape[0], ref.shape[1], 3), dtype=np.uint8)
    br, bc = boundary(ref), boundary(cand)
    out[br] = (255,70,70); out[bc] = (70,150,255)
    both = br & bc; out[both] = (255,220,70)
    return Image.fromarray(out, 'RGB')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--root', default='.'); ap.add_argument('--output', default='qa/airbox-candidate'); args = ap.parse_args()
    root, out = Path(args.root).resolve(), Path(args.output).resolve(); out.mkdir(parents=True, exist_ok=True)
    ref_path = root/'shared/photo-top-engine-reference-fixtures/airbox-maf-assembly.png'
    ref = mask(ref_path)
    cand = mask(out/'photo-candidate-mask.png'); base = mask(out/'photo-baseline-mask.png')
    report = {'referenceMask': str(ref_path), 'candidateRender': str(out/'photo-candidate-mask.png'), 'baselineRender': str(out/'photo-baseline-mask.png'), 'candidate': metrics(ref,cand), 'baseline': metrics(ref,base), 'acceptance': {'silhouetteIoUMin': .85, 'bboxEdgeResidualMaxPx': 10, 'visibleAreaRatioRange': [0.90,1.10], 'orientationDifferenceMaxDeg': 5}}
    report['candidatePassesNumericTargets'] = bool(report['candidate']['silhouetteIoU'] >= .85 and max(report['candidate']['bboxEdgeResidualPx']) <= 10 and .90 <= report['candidate']['visibleAreaRatio'] <= 1.10 and report['candidate']['orientationDifferenceDeg'] <= 5)
    Image.open(out/'reference.jpg').save(out/'labeled-reference.jpg')
    Image.open(out/'photo-candidate.png').save(out/'labeled-render.png')
    ref_photo = Image.open(out/'reference.jpg').convert('RGB'); base_photo = Image.open(out/'photo-baseline.png').convert('RGB'); cand_photo = Image.open(out/'photo-candidate.png').convert('RGB')
    label(ref_photo,'REFERENCE 640x484').save(out/'labeled-reference.jpg')
    label(cand_photo,'CANDIDATE — explicit candidate mode').save(out/'labeled-render.png')
    trip = Image.new('RGB',(ref_photo.width*3,ref_photo.height)); trip.paste(label(ref_photo,'REFERENCE'),(0,0)); trip.paste(label(base_photo,'BASELINE'),(640,0)); trip.paste(label(cand_photo,'CANDIDATE'),(1280,0)); trip.save(out/'reference-baseline-candidate-photo.png')
    overlay(base_photo,cand_photo,'BASELINE / CANDIDATE 50% OVERLAY').save(out/'baseline-candidate-overlay-50.png')
    overlay(Image.open(out/'photo-baseline-mask.png'),Image.open(out/'photo-candidate-mask.png'),'MASK OVERLAY 50%').save(out/'baseline-candidate-mask-overlay-50.png')
    contour(ref,cand).save(out/'candidate-reference-contours.png')
    for stem,title_a,title_b in [('passenger-oblique','BASELINE — passenger oblique','CANDIDATE — passenger oblique'),('driver-oblique','BASELINE — driver oblique','CANDIDATE — driver oblique'),('isolated-three-quarter','BASELINE — isolated three-quarter','CANDIDATE — isolated three-quarter')]:
        side_by_side(Image.open(out/f'{stem}-baseline.png'),Image.open(out/f'{stem}-candidate.png'),title_a,title_b).save(out/f'{stem}-ab.png')
    report['visualReview'] = 'CANDIDATE REJECTED — BASELINE PRESERVED' if not report['candidatePassesNumericTargets'] else 'CANDIDATE READY FOR HUMAN REVIEW'
    (out/'metrics.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    with (out/'metrics.csv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle); writer.writerow(['variant','bbox','visibleAreaPx','centerPx','orientationDeg','bboxEdgeResidualPx','centerResidualPx','visibleAreaRatio','orientationDifferenceDeg','silhouetteIoU','meanBoundaryDistancePx'])
        for variant in ('baseline','candidate'):
            row = report[variant]; writer.writerow([variant, row['candidate']['bbox'], row['candidate']['visibleAreaPx'], row['candidate']['centerPx'], row['candidate']['orientationDeg'], row['bboxEdgeResidualPx'], row['centerResidualPx'], row['visibleAreaRatio'], row['orientationDifferenceDeg'], row['silhouetteIoU'], row['meanBoundaryDistancePx']])
    print(json.dumps(report, indent=2))

if __name__ == '__main__': main()
