import * as THREE from 'three';

// Experimental only: this builder is deliberately independent of the
// recovered LANDMARK_AIRBOX/LANDMARK_INTAKE_TUBE generators.  It uses the
// physical vehicle-coordinate anchors and closed solids, never photo-mask
// vertices or camera-facing plates.
export function buildCandidateAirboxMaf(api) {
  const { BAY_ANCHORS, vehicleToWorld, vehicleTopProfile, roundedBox, tube,
    betweenCylinder, betweenTaperedCylinder, torus, material } = api;
  const group = new THREE.Group();
  group.name = 'CANDIDATE_AIRBOX_MAF_SOLID_3D';
  group.userData.experimentalCandidate = true;
  group.userData.candidateComponent = 'airbox-maf-assembly';

  const [ax, ay, az] = BAY_ANCHORS.airbox;
  const [mx, my, mz] = BAY_ANCHORS.maf;
  const darkPlastic = 0x1a2225;
  const lidPlastic = 0x232c2f;
  const rubber = 0x151b1e;
  const metal = 0xaab3b4;

  // The lower tray and lid are separate, closed, chamfered extrusions.  Their
  // proportions are physical (roughly 470 x 300 x 150 mm), not a traced
  // projection of the frozen reference mask.
  const trayPlan = [
    [ax + .245, ay - .155], [ax + .205, ay - .235], [ax - .145, ay - .245],
    [ax - .255, ay - .155], [ax - .265, ay + .110], [ax - .165, ay + .195],
    [ax + .150, ay + .190], [ax + .255, ay + .095]
  ];
  const tray = vehicleTopProfile(trayPlan, az - .075, .105, darkPlastic, {
    bevelSize: .026, bevelThickness: .014, bevelSegments: 3, curveSegments: 14,
    roughness: .82, metalness: .04
  });
  tray.userData.candidatePart = 'lower-filter-box';
  group.add(tray);

  const lidPlan = trayPlan.map(([f, l]) => [
    ax + (f - ax) * .91 + .018,
    ay + (l - ay) * .91 + .006
  ]);
  const lid = vehicleTopProfile(lidPlan, az + .035, .050, lidPlastic, {
    bevelSize: .022, bevelThickness: .012, bevelSegments: 3, curveSegments: 14,
    roughness: .70, metalness: .08
  });
  lid.userData.candidatePart = 'removable-airbox-lid';
  group.add(lid);

  // A raised gasket/seam and six small fasteners make the lid read as a
  // serviceable housing rather than one anonymous cuboid.
  const seam = tube([
    [ax + .185, ay - .150, az + .090], [ax + .140, ay - .205, az + .090],
    [ax - .135, ay - .212, az + .090], [ax - .215, ay - .135, az + .090],
    [ax - .220, ay + .085, az + .090], [ax - .135, ay + .145, az + .090],
    [ax + .135, ay + .140, az + .090], [ax + .198, ay + .070, az + .090]
  ], .009, 0x4a5557, { segments: 32, radialSegments: 7, roughness: .76, metalness: .08 });
  seam.userData.candidatePart = 'lid-seam';
  group.add(seam);
  for (const [f, l] of [[.19,-.16],[-.18,-.16],[-.20,.13],[.16,.13],[.02,-.20],[.02,.16]]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .010, 10), material(0x7f8a8c, { metalness: .72, roughness: .34 }));
    bolt.position.copy(vehicleToWorld([ax + f, ay + l, az + .101]));
    bolt.userData.candidatePart = 'lid-fastener';
    group.add(bolt);
  }

  // An outboard inlet snorkel and a short, tapered outlet boot are closed
  // tube solids.  The outlet intentionally stops at the future duct handoff.
  const inletPath = [[ax + .220, ay - .020, az + .015], [ax + .325, ay - .080, az + .010], [ax + .395, ay - .145, az + .010]];
  const inlet = tube(inletPath, .080, rubber, { segments: 24, radialSegments: 12, roughness: .88, metalness: .02 });
  inlet.userData.candidatePart = 'airbox-inlet-snorkel';
  group.add(inlet);
  const outletPath = [[ax - .020, ay + .205, az + .035], [ax - .010, ay + .285, az + .050], [mx + .115, my + .045, mz + .020]];
  const outlet = tube(outletPath, .070, rubber, { segments: 28, radialSegments: 14, roughness: .86, metalness: .02 });
  outlet.userData.candidatePart = 'outlet-neck';
  group.add(outlet);

  // MAF is a metallic, closed barrel between rubber couplers, with collar
  // rings and a separate sensor/connector block.
  const mafStart = vehicleToWorld([mx + .115, my + .045, mz + .020]);
  const mafEnd = vehicleToWorld([mx - .105, my + .018, mz + .030]);
  const mafBody = betweenTaperedCylinder(mafStart, mafEnd, .075, .082, metal, { segments: 20, metalness: .72, roughness: .32 });
  mafBody.userData.candidatePart = 'metallic-maf-body';
  group.add(mafBody);
  const mafMid = mafStart.clone().add(mafEnd).multiplyScalar(.5);
  const collarA = torus(.079, .010, 0x596568, 'y', { tubularSegments: 22, radialSegments: 8, metalness: .70, roughness: .34 });
  collarA.position.copy(mafStart);
  collarA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mafEnd.clone().sub(mafStart).normalize());
  const collarB = collarA.clone();
  collarB.position.copy(mafEnd);
  group.add(collarA, collarB);
  const sensor = roundedBox(.065, .040, .105, .014, 0x101719, { segments: 5, roughness: .78, metalness: .04 });
  sensor.position.copy(vehicleToWorld([mx - .010, my + .002, mz + .115]));
  sensor.rotation.y = -.16;
  sensor.userData.candidatePart = 'maf-sensor';
  group.add(sensor);
  const connector = roundedBox(.058, .050, .080, .012, 0x303a3c, { segments: 5, roughness: .68, metalness: .10 });
  connector.position.copy(vehicleToWorld([mx - .060, my + .010, mz + .150]));
  connector.rotation.y = -.16;
  connector.userData.candidatePart = 'maf-connector';
  group.add(connector);

  // The neck on the engine-facing side is a real collar and a capped boot,
  // preserving a visible future connection without touching the baseline duct.
  const handoffStart = vehicleToWorld([mx - .105, my + .018, mz + .030]);
  const handoffEnd = vehicleToWorld([mx - .255, my + .010, mz + .055]);
  const handoff = betweenTaperedCylinder(handoffStart, handoffEnd, .074, .060, rubber, { segments: 18, metalness: .03, roughness: .84 });
  handoff.userData.candidatePart = 'future-duct-handoff';
  group.add(handoff);

  // A few ribs are circumferential collars, not a spring-like open route.
  for (const t of [.18, .38, .58, .78]) {
    const p = handoffStart.clone().lerp(handoffEnd, t);
    const ring = torus(.067 - t * .008, .006, 0x3c4749, 'y', { tubularSegments: 18, radialSegments: 7, roughness: .80, metalness: .08 });
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), handoffEnd.clone().sub(handoffStart).normalize());
    ring.userData.candidatePart = 'handoff-collar';
    group.add(ring);
  }

  group.traverse(node => {
    if (node.isMesh) {
      node.userData.candidateOnly = true;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return group;
}
