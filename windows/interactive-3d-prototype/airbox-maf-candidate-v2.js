import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Candidate v2 is authored from the supplied isolated-part photographs.  The
// local assembly is a real, closed 3D part; only its final installation pose
// is fitted against the locked overhead engine-bay view.
export function buildCandidateAirboxMafV2(api) {
  const { vehicleToWorld, material, BAY_ANCHORS } = api;
  const group = new THREE.Group();
  group.name = 'CANDIDATE_AIRBOX_MAF_V2';
  group.userData.experimentalCandidate = true;
  group.userData.candidateVersion = 'v2-ebay-references';
  group.userData.candidateComponent = 'airbox-maf-assembly';

  const black = 0x171d20;
  const lidBlack = 0x20272a;
  const rubber = 0x111719;
  const aluminum = 0xa9b0ae;
  const darkMetal = 0x4b5555;

  function profile(points, baseY, height, color, options = {}) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelThickness: options.bevelThickness ?? .012,
      bevelSize: options.bevelSize ?? .018,
      bevelSegments: options.bevelSegments ?? 3,
      curveSegments: options.curveSegments ?? 12
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material(color, options));
    mesh.position.y = baseY;
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  function rounded(width, height, depth, radius, color, options = {}) {
    const geometry = new RoundedBoxGeometry(width, height, depth, options.segments ?? 3, Math.min(radius, width*.45, height*.45, depth*.45));
    const mesh = new THREE.Mesh(geometry, material(color, options));
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  function tube(points, radius, color, options = {}) {
    const vectors = points.map(([x,y,z]) => new THREE.Vector3(x,y,z));
    const curve = new THREE.CatmullRomCurve3(vectors, options.closed ?? false, 'centripetal', .4);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, options.segments ?? 24, radius, options.radialSegments ?? 12, options.closed ?? false), material(color, options));
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  function between(start, end, radiusStart, radiusEnd, color, options = {}) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const delta = b.clone().sub(a); const length = Math.max(.001, delta.length());
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radiusStart, length, options.segments ?? 20), material(color, options));
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  function ring(point, radius, thickness, tangent, color) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 24), material(color, { metalness: .72, roughness: .32 }));
    mesh.position.set(...point);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(...tangent).normalize());
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  // Main shell: a deep, asymmetric molded box with a separate removable lid.
  const trayPlan = [[-.255,-.17],[-.225,-.215],[.035,-.205],[.085,-.135],[.075,.145],[.015,.195],[-.225,.18],[-.275,.08]];
  const tray = profile(trayPlan, -.080, .145, black, { bevelSize: .026, bevelThickness: .016, bevelSegments: 4, roughness: .82, metalness: .03 });
  tray.userData.candidatePart = 'deep-lower-airbox'; group.add(tray);
  const lidPlan = trayPlan.map(([x,z]) => [x*.94-.004, z*.94]);
  const lid = profile(lidPlan, .066, .052, lidBlack, { bevelSize: .022, bevelThickness: .013, bevelSegments: 4, roughness: .70, metalness: .06 });
  lid.userData.candidatePart = 'separate-upper-lid'; group.add(lid);
  const seam = tube([[-.235,-.145,.124],[-.205,-.185,.124],[.008,-.175,.124],[.052,-.115,.124],[.048,.118,.124],[-.005,.162,.124],[-.205,.15,.124],[-.25,.07,.124]], .009, darkMetal, { closed: true, segments: 40, radialSegments: 7 });
  seam.userData.candidatePart = 'lid-seam'; group.add(seam);
  for (const [x,z] of [[-.205,-.155],[-.205,.145],[.02,-.15],[.035,.14]]) {
    const fastener = rounded(.024,.012,.024,.006,0x7b8584,{metalness:.74,roughness:.34,segments:5});
    fastener.position.set(x,.128,z); fastener.userData.candidatePart='lid-fastener'; group.add(fastener);
  }

  // Lower resonator and molded outlet, kept underneath the housing rather
  // than represented by a disconnected screen-space hose.
  const resonator = rounded(.18,.12,.22,.042,black,{roughness:.84,metalness:.03,segments:5});
  resonator.position.set(-.17,-.135,.10); resonator.rotation.y=-.18; resonator.userData.candidatePart='lower-resonator'; group.add(resonator);
  const outlet = tube([[-.20,-.10,.12],[-.28,-.075,.16],[-.34,-.025,.19]], .068, rubber, { segments: 24, radialSegments: 12, roughness: .88, metalness: .02 });
  outlet.userData.candidatePart='lower-outlet-neck'; group.add(outlet);
  const outletClamp = ring([-.275,-.075,.16], .071, .010, [-.84,.25,.49], darkMetal); outletClamp.userData.candidatePart='outlet-clamp'; group.add(outletClamp);

  // Four molded mounting ears and two raised brackets follow the reference
  // part's real attachment strategy.
  for (const [x,z,angle] of [[-.22,-.205,-.12],[-.02,-.198,.10],[-.22,.19,.10],[.02,.185,-.10]]) {
    const ear = rounded(.095,.030,.070,.018,black,{roughness:.80,metalness:.04,segments:4});
    ear.position.set(x,-.01,z); ear.rotation.y=angle; ear.userData.candidatePart='mounting-ear'; group.add(ear);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.036,12), material(0x353e3e,{metalness:.64,roughness:.38}));
    hole.position.set(x,.010,z); hole.userData.candidatePart='mounting-hole'; group.add(hole);
  }

  // Short closed coupling into the cast meter body.
  const coupling = between([.035,.018,.0],[.095,.018,.0],.068,.072,rubber,{segments:20,roughness:.86,metalness:.02});
  coupling.userData.candidatePart='airbox-maf-coupling'; group.add(coupling);

  // Cast aluminum MAF barrel with a pronounced flange and metal clamp.
  const maf = between([.075,.018,0],[.285,.018,0],.078,.082,aluminum,{segments:24,metalness:.72,roughness:.32});
  maf.userData.candidatePart='cast-aluminum-maf-body'; group.add(maf);
  group.add(ring([.085,.018,0],.080,.010,[1,0,0],darkMetal));
  group.add(ring([.277,.018,0],.084,.011,[1,0,0],darkMetal));

  // Rectangular Hitachi sensor cover and its connector block, lifted above
  // the barrel so it remains recognizable in the oblique captures.
  const hitachi = rounded(.105,.045,.105,.016,0x111719,{roughness:.76,metalness:.05,segments:5});
  hitachi.position.set(.175,.105,-.005); hitachi.rotation.y=.06; hitachi.userData.candidatePart='hitachi-sensor-cover'; group.add(hitachi);
  const sensorInset = rounded(.078,.008,.068,.008,0x252d2f,{roughness:.82,metalness:.03,segments:4});
  sensorInset.position.set(.175,.131,-.005); sensorInset.userData.candidatePart='hitachi-cover-inset'; group.add(sensorInset);
  const connector = rounded(.070,.050,.062,.012,0x30393a,{roughness:.66,metalness:.10,segments:5});
  connector.position.set(.185,.105,.082); connector.rotation.y=.06; connector.userData.candidatePart='sensor-connector'; group.add(connector);

  // One continuous ribbed rubber boot leaves the MAF through the future duct
  // interface.  Ribs are attached circumferential collars on that tube.
  const bootPath = [[.285,.018,0],[.335,.020,.005],[.410,.025,.018]];
  const boot = tube(bootPath,.073,rubber,{segments:32,radialSegments:14,roughness:.88,metalness:.02});
  boot.userData.candidatePart='immediate-ribbed-boot'; group.add(boot);
  for (const t of [.18,.36,.54,.72,.90]) {
    const p = new THREE.CatmullRomCurve3(bootPath.map(v=>new THREE.Vector3(...v))).getPoint(t);
    const rib = ring([p.x,p.y,p.z],.075,.006,[1,.03,.12],darkMetal); rib.userData.candidatePart='boot-rib'; group.add(rib);
  }
  const bootClamp = ring([.400,.025,.018],.076,.010,[1,0,.12],0x9ba2a0); bootClamp.userData.candidatePart='boot-clamp'; group.add(bootClamp);

  const [anchorX, anchorY, anchorZ] = BAY_ANCHORS.airbox;
  group.position.copy(vehicleToWorld([anchorX, anchorY, anchorZ]));
  group.position.x += .075;
  group.position.y -= .018;
  // Initial physical installation pose.  QA may adjust only this group pose
  // during fitting; individual parts stay uniformly scaled and articulated.
  group.rotation.y = 0.02;
  group.scale.setScalar(.80);
  group.traverse(node => { if (node.isMesh) { node.userData.candidateOnly=true; node.castShadow=true; node.receiveShadow=true; } });
  return group;
}
