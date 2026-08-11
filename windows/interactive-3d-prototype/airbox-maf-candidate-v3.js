import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// V3 stays deliberately separate from the recovered production airbox and the
// prior v1/v2 experiments.  It is a closed, object-form reconstruction from
// the supplied part photographs; only the whole assembly pose is calibrated to
// the locked overhead camera.
export function buildCandidateAirboxMafV3(api) {
  const { vehicleToWorld, material, BAY_ANCHORS } = api;
  const group = new THREE.Group();
  group.name = 'CANDIDATE_AIRBOX_MAF_V3';
  group.userData.experimentalCandidate = true;
  group.userData.candidateVersion = 'v3-shape-revision';
  group.userData.candidateComponent = 'airbox-maf-assembly';

  const plastic = 0x151b1e;
  const lidPlastic = 0x222a2d;
  const rubber = 0x111719;
  const aluminum = 0x7e8989;
  const darkMetal = 0x394345;
  const clampMetal = 0x9ca4a3;

  function finish(mesh, part) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (part) mesh.userData.candidatePart = part;
    return mesh;
  }

  function profile(points, baseY, height, color, options = {}) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z));
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
    return finish(mesh);
  }

  function rounded(width, height, depth, radius, color, options = {}) {
    const geometry = new RoundedBoxGeometry(
      width,
      height,
      depth,
      options.segments ?? 4,
      Math.min(radius, width * .45, height * .45, depth * .45)
    );
    return finish(new THREE.Mesh(geometry, material(color, options)));
  }

  function tube(points, radius, color, options = {}) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(value => new THREE.Vector3(...value)),
      options.closed ?? false,
      'centripetal',
      .42
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, options.segments ?? 32, radius, options.radialSegments ?? 14, options.closed ?? false),
      material(color, options)
    );
    return { curve, mesh: finish(mesh) };
  }

  function between(start, end, radiusStart, radiusEnd, color, options = {}) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusEnd, radiusStart, Math.max(.001, delta.length()), options.segments ?? 20),
      material(color, options)
    );
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return finish(mesh);
  }

  function ring(point, radius, thickness, tangent, color = clampMetal, part = 'clamp-band') {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, thickness, 9, 28),
      material(color, { metalness: .76, roughness: .28 })
    );
    mesh.position.set(...point);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...tangent).normalize());
    return finish(mesh, part);
  }

  // A closed loft is used for the casting so the MAF reads as a substantial
  // asymmetric aluminum transition rather than a generic cylinder.
  function loft(sections, color, options = {}) {
    const radial = options.radialSegments ?? 10;
    const vertices = [];
    const indices = [];
    const exponent = options.exponent ?? .78;
    for (const section of sections) {
      for (let i = 0; i < radial; i += 1) {
        const theta = i / radial * Math.PI * 2;
        const sy = Math.sign(Math.sin(theta)) * Math.pow(Math.abs(Math.sin(theta)), exponent);
        const sz = Math.sign(Math.cos(theta)) * Math.pow(Math.abs(Math.cos(theta)), exponent);
        vertices.push(section.x, section.y + sy * section.ry, section.z + sz * section.rz);
      }
    }
    for (let section = 0; section < sections.length - 1; section += 1) {
      for (let i = 0; i < radial; i += 1) {
        const next = (i + 1) % radial;
        const a = section * radial + i;
        const b = section * radial + next;
        const c = (section + 1) * radial + next;
        const d = (section + 1) * radial + i;
        indices.push(a, b, d, b, c, d);
      }
    }
    const start = vertices.length / 3;
    vertices.push(sections[0].x, sections[0].y, sections[0].z);
    const end = vertices.length / 3;
    const last = sections[sections.length - 1];
    vertices.push(last.x, last.y, last.z);
    for (let i = 0; i < radial; i += 1) {
      const next = (i + 1) % radial;
      indices.push(start, next, i);
      const offset = (sections.length - 1) * radial;
      indices.push(end, offset + i, offset + next);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return finish(new THREE.Mesh(geometry, material(color, { ...options, side: THREE.DoubleSide })));
  }

  // The lower bucket is intentionally bulbous at the filter end and narrows
  // into the MAF flange, matching the large molded form in the part photos.
  const lowerPlan = [
    [-.255, -.170], [-.225, -.215], [.035, -.205], [.085, -.135],
    [.075, .145], [.015, .195], [-.225, .180], [-.275, .080]
  ];
  const lower = profile(lowerPlan, -.102, .158, plastic, {
    bevelSize: .028, bevelThickness: .020, bevelSegments: 5, roughness: .84, metalness: .02
  });
  group.add(finish(lower, 'deep-lower-airbox'));

  const lidPlan = [
    [-.245, -.155], [-.218, -.198], [.029, -.188], [.075, -.126],
    [.066, .135], [.011, .180], [-.213, .168], [-.260, .075]
  ];
  const lid = profile(lidPlan, .058, .063, lidPlastic, {
    bevelSize: .024, bevelThickness: .016, bevelSegments: 5, roughness: .70, metalness: .045
  });
  group.add(finish(lid, 'separate-upper-lid'));

  const seamPoints = [
    [-.248, .120, -.153], [-.220, .120, -.195], [.030, .120, -.185], [.074, .120, -.124],
    [.065, .120, .132], [.010, .120, .177], [-.215, .120, .165], [-.258, .120, .073]
  ];
  const seam = tube(seamPoints, .0085, darkMetal, { closed: true, segments: 48, radialSegments: 8 });
  group.add(finish(seam.mesh, 'lid-seam'));

  // The real lid has long molded ribs/straps, rather than a featureless flat
  // rectangle.  These are raised, continuous plastic details connected to it.
  for (const z of [-.071, .052]) {
    const ridge = tube([[-.230, .128, z - .018], [-.138, .134, z], [-.026, .128, z + .010]], .012, 0x30393b, {
      segments: 24, radialSegments: 8, roughness: .74, metalness: .03
    });
    group.add(finish(ridge.mesh, 'lid-molded-ridge'));
  }

  // Perimeter clips and fasteners visibly distinguish the lid from the lower
  // bucket without inventing unsupported labels or texture decals.
  for (const [x, z, angle] of [[-.222, -.147, -.18], [-.236, .128, .20], [-.012, -.143, .06], [.020, .120, -.06]]) {
    const clip = rounded(.055, .026, .030, .009, darkMetal, { roughness: .52, metalness: .35, segments: 4 });
    clip.position.set(x, .094, z);
    clip.rotation.y = angle;
    group.add(finish(clip, 'lid-retaining-clip'));
  }
  for (const [x, z] of [[-.202, -.153], [-.190, .145], [.000, -.132], [.020, .112]]) {
    const fastener = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .014, 12), material(clampMetal, { metalness: .82, roughness: .27 }));
    fastener.position.set(x, .132, z);
    fastener.rotation.x = Math.PI / 2;
    group.add(finish(fastener, 'lid-fastener'));
  }

  // The deep underside resonator is a separate solid bulb, attached into the
  // lower bucket with a molded neck; it is deliberately not a flat plate.
  const resonatorPlan = [[-.252, -.066], [-.232, -.151], [-.124, -.182], [-.048, -.138], [-.058, -.034], [-.150, .014], [-.226, -.010]];
  const resonator = profile(resonatorPlan, -.188, .112, plastic, {
    bevelSize: .025, bevelThickness: .017, bevelSegments: 4, roughness: .86, metalness: .02
  });
  group.add(finish(resonator, 'lower-resonator'));
  const resonatorNeck = between([-.178, -.104, .096], [-.354, -.026, .188], .084, .053, plastic, {
    segments: 20, roughness: .84, metalness: .025
  });
  group.add(finish(resonatorNeck, 'lower-resonator-neck'));
  group.add(ring([-.278, -.060, .148], .067, .008, [-.86, .38, .45], darkMetal, 'resonator-clamp'));
  const inletLip = between([-.354, -.026, .188], [-.382, -.016, .205], .058, .050, rubber, {
    segments: 18, roughness: .88, metalness: .02
  });
  group.add(finish(inletLip, 'lower-inlet-interface'));

  // Four molded ears and a tall MAF support reproduce the real mounting
  // topology.  The round inserts are embedded in each ear, not floating rings.
  for (const [x, z, rotation] of [[-.230, -.135, -.16], [-.218, .142, .17], [-.070, -.185, .10], [.020, .140, -.08]]) {
    const ear = rounded(.092, .026, .064, .017, plastic, { roughness: .80, metalness: .03, segments: 4 });
    ear.position.set(x, -.018, z);
    ear.rotation.y = rotation;
    group.add(finish(ear, 'mounting-ear'));
    const insert = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .029, 14), material(0x545e5e, { metalness: .68, roughness: .34 }));
    insert.position.set(x, -.003, z);
    group.add(finish(insert, 'mounting-ear-insert'));
  }

  const mafSupport = rounded(.040, .140, .050, .012, darkMetal, { roughness: .54, metalness: .33, segments: 4 });
  mafSupport.position.set(.226, .075, .083);
  mafSupport.rotation.z = -.12;
  group.add(finish(mafSupport, 'maf-support-bracket'));
  const supportFoot = rounded(.106, .026, .074, .015, plastic, { roughness: .80, metalness: .04, segments: 4 });
  supportFoot.position.set(.226, .018, .103);
  group.add(finish(supportFoot, 'maf-bracket-foot'));

  const coupling = between([.035, .010, 0], [.095, .011, 0], .075, .088, rubber, { segments: 24, roughness: .86, metalness: .02 });
  group.add(finish(coupling, 'airbox-maf-coupling'));
  group.add(ring([.070, .010, 0], .086, .010, [1, 0, 0], darkMetal, 'airbox-coupling-clamp'));

  const maf = loft([
    { x: .090, y: .011, z: 0, ry: .086, rz: .101 },
    { x: .138, y: .011, z: 0, ry: .079, rz: .092 },
    { x: .226, y: .012, z: .002, ry: .068, rz: .080 },
    { x: .283, y: .016, z: .010, ry: .066, rz: .073 }
  ], aluminum, { radialSegments: 12, exponent: .72, metalness: .67, roughness: .38 });
  group.add(finish(maf, 'cast-aluminum-maf-body'));
  group.add(ring([.098, .011, 0], .094, .010, [1, 0, 0], darkMetal, 'maf-inlet-flange'));
  group.add(ring([.279, .016, .010], .075, .010, [1, .04, .12], darkMetal, 'maf-outlet-flange'));

  // Raised casting ribs make the tapered meter legible from an oblique view.
  for (const z of [-.069, .069]) {
    const rib = tube([[.115, .028, z], [.174, .040, z * .90], [.238, .037, z * .78]], .007, 0x667171, {
      segments: 22, radialSegments: 7, roughness: .46, metalness: .56
    });
    group.add(finish(rib.mesh, 'maf-casting-rib'));
  }

  // The black Hitachi cover is deliberately wide, stepped and side-mounted;
  // the connector exits from its outer face rather than reading as a loose top
  // cube on a cylindrical meter.
  const hitachiFrame = rounded(.142, .057, .126, .018, 0x101618, { roughness: .74, metalness: .05, segments: 5 });
  hitachiFrame.position.set(.190, .075, -.080);
  hitachiFrame.rotation.y = .035;
  group.add(finish(hitachiFrame, 'hitachi-sensor-cover'));
  const hitachiFace = rounded(.112, .010, .096, .010, 0x2b3435, { roughness: .78, metalness: .035, segments: 4 });
  hitachiFace.position.set(.190, .106, -.080);
  hitachiFace.rotation.y = .035;
  group.add(finish(hitachiFace, 'hitachi-cover-inset'));
  for (const [x, z] of [[.142, -.118], [.238, -.118]]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .009, 10), material(clampMetal, { metalness: .78, roughness: .27 }));
    bolt.position.set(x, .114, z);
    bolt.rotation.x = Math.PI / 2;
    group.add(finish(bolt, 'hitachi-cover-fastener'));
  }
  const connector = rounded(.078, .050, .070, .013, 0x20292b, { roughness: .64, metalness: .11, segments: 5 });
  connector.position.set(.190, .062, -.164);
  connector.rotation.y = .035;
  group.add(finish(connector, 'hitachi-connector'));

  // A long, continuous ribbed boot leaves the MAF in the direction reserved
  // for the later full intake trace.  Every rib overlaps the solid boot.
  const bootPath = [[.282, .016, .010], [.326, .019, .012], [.373, .026, .025], [.415, .038, .044]];
  const boot = tube(bootPath, .076, rubber, { segments: 40, radialSegments: 16, roughness: .90, metalness: .015 });
  group.add(finish(boot.mesh, 'immediate-ribbed-boot'));
  for (const t of [.10, .23, .36, .49, .62, .75, .88]) {
    const point = boot.curve.getPoint(t);
    const tangent = boot.curve.getTangent(t);
    group.add(ring([point.x, point.y, point.z], .080, .007, tangent.toArray(), darkMetal, 'attached-boot-rib'));
  }
  group.add(ring([.398, .033, .038], .080, .011, [.97, .20, .32], clampMetal, 'boot-outlet-clamp'));
  const outletInterface = between([.415, .038, .044], [.442, .048, .058], .078, .076, rubber, { segments: 22, roughness: .88, metalness: .02 });
  group.add(finish(outletInterface, 'future-duct-outlet-interface'));

  const [anchorX, anchorY, anchorZ] = BAY_ANCHORS.airbox;
  group.position.copy(vehicleToWorld([anchorX, anchorY, anchorZ]));
  // The locked-photo fit is an assembly-level pose only; no child mesh is
  // flattened or non-uniformly scaled to obtain this placement.
  group.position.x += .055;
  group.position.y -= .018;
  group.rotation.y = .32;
  group.scale.setScalar(.80);
  group.traverse(node => {
    if (node.isMesh) {
      node.userData.candidateOnly = true;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return group;
}
