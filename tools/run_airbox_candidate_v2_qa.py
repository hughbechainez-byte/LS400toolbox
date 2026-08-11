#!/usr/bin/env python3
"""Compare the frozen airbox mask against v1 and inactive v2 captures."""
from __future__ import annotations
import argparse, json, csv
from pathlib import Path
from PIL import Image
import numpy as np
from run_airbox_candidate_qa import mask, metrics, label, side_by_side, overlay, contour

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',default='.'); ap.add_argument('--output',default='qa/airbox-candidate-v2'); args=ap.parse_args()
    root=Path(args.root).resolve(); out=Path(args.output).resolve(); out.mkdir(parents=True,exist_ok=True)
    reference=mask(root/'shared/photo-top-engine-reference-fixtures/airbox-maf-assembly.png')
    baseline=mask(out/'photo-baseline-mask.png'); v1=mask(out/'photo-v1-mask.png'); v2=mask(out/'photo-v2-mask.png')
    report={'referenceMask':str((root/'shared/photo-top-engine-reference-fixtures/airbox-maf-assembly.png').resolve()),'variants':{name:metrics(reference,value) for name,value in [('baseline',baseline),('candidate-v1',v1),('candidate-v2',v2)]},'targets':{'silhouetteIoUMin':.75,'bboxEdgeResidualMaxPx':12,'visibleAreaRatioRange':[.90,1.10],'orientationDifferenceMaxDeg':8}}
    def passes(row): return row['silhouetteIoU']>=.75 and max(row['bboxEdgeResidualPx'])<=12 and .90<=row['visibleAreaRatio']<=1.10 and row['orientationDifferenceDeg']<=8
    report['passesNumericTargets']={name:passes(row) for name,row in report['variants'].items()}
    report['status']='CANDIDATE V2 READY FOR HUMAN REVIEW' if report['passesNumericTargets']['candidate-v2'] else 'CANDIDATE V2 REJECTED — BASELINE PRESERVED'
    ref=Image.open(out/'reference.jpg').convert('RGB'); base=Image.open(out/'photo-baseline.png').convert('RGB'); one=Image.open(out/'photo-v1.png').convert('RGB'); two=Image.open(out/'photo-v2.png').convert('RGB')
    trip=Image.new('RGB',(ref.width*4,ref.height));
    for i,(im,title) in enumerate([(ref,'REFERENCE'),(base,'BASELINE'),(one,'V1 REJECTED'),(two,'V2 CANDIDATE')]): trip.paste(label(im,title),(640*i,0))
    trip.save(out/'reference-baseline-v1-v2-overhead.png')
    overlay(ref,two,'REFERENCE / V2 50% OVERLAY').save(out/'reference-v2-overlay-50.png')
    overlay(Image.open(out/'photo-v1-mask.png'),Image.open(out/'photo-v2-mask.png'),'V1 / V2 MASK OVERLAY 50%').save(out/'v1-v2-mask-overlay-50.png')
    contour(reference,v2).save(out/'v2-reference-contours.png')
    for stem in ('passenger-oblique','driver-oblique'):
        canvas=Image.new('RGB',(1920,484));
        for i,(suffix,title) in enumerate([('baseline','BASELINE'),('v1','V1 REJECTED'),('v2','V2 CANDIDATE')]): canvas.paste(label(Image.open(out/f'{stem}-{suffix}.png'),f'{title} — {stem}'),(640*i,0))
        canvas.save(out/f'{stem}-baseline-v1-v2.png')
    with (out/'metrics.csv').open('w',newline='',encoding='utf-8') as handle:
        writer=csv.writer(handle); writer.writerow(['variant','bbox','visibleAreaPx','centerPx','orientationDeg','bboxEdgeResidualPx','centerResidualPx','visibleAreaRatio','orientationDifferenceDeg','silhouetteIoU','meanBoundaryDistancePx'])
        for name,row in report['variants'].items(): writer.writerow([name,row['candidate']['bbox'],row['candidate']['visibleAreaPx'],row['candidate']['centerPx'],row['candidate']['orientationDeg'],row['bboxEdgeResidualPx'],row['centerResidualPx'],row['visibleAreaRatio'],row['orientationDifferenceDeg'],row['silhouetteIoU'],row['meanBoundaryDistancePx']])
    (out/'metrics.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
