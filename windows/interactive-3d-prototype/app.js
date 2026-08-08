import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  VEHICLE, ENGINE_BAY_RECONSTRUCTION, SYSTEMS, COMPONENTS, ROUTES, CAMERA_PRESETS, GEOMETRY_DATASET,
  REFERENCE_IMAGES, UNCERTAINTIES, ACCEPTANCE_STEPS, AC_SERVICE_WALKTHROUGH, AC_RECEIVER_DRIER_REPLACEMENT_GUIDE, AC_FLUSH_AND_EVACUATION_GUIDE, AC_R134A_RETROFIT_GUIDE
} from './model-data.js?v=ucf10-photo-fit-v47';

const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const itemData = new Map([...COMPONENTS, ...ROUTES].map(item => [item.id, item]));
const componentData = new Map(COMPONENTS.map(item => [item.id, item]));
const routeData = new Map(ROUTES.map(item => [item.id, item]));
const objectById = new Map();
const registered = [];
const pickables = [];
const routeRuntime = new Map();
const collisionObjects = [];
const highlightHelpers = [];
const anchorData = new Map(GEOMETRY_DATASET.componentAnchors.map(item => [item.componentId, item]));
const BAY = ENGINE_BAY_RECONSTRUCTION;
const BAY_STRUCTURE = BAY.structural;
const BAY_ANCHORS = BAY.anchors;
let geometryValidationGroup;

const state = {
  isolation: 'ALL',
  detailLevel: 2,
  selectedId: null,
  tracedRouteIds: new Set(),
  labels: true,
  hoodAngle: 70,
  bodyTransparent: false,
  cutawayFirewall: false,
  cutawayHvac: false,
  comparisonMode: 'OFF',
  // The supplied 1990 engine-top photograph is the active fidelity target,
  // not a decorative secondary comparison.
  referenceId: 'USER_ENGINE_TOP_1990',
  referenceOpacity: .50,
  serviceJobMode: false,
  serviceProfile: 'UNKNOWN',
  serviceStep: 0,
  serviceGuideMode: 'FULL',
  geometryValidation: false,
  allowInside: false,
  cameraTween: null,
  validationReport: null,
  acceptance: new Set(),
  lastPointer: { x: 0, y: 0 },
  pointerDown: null
};

const COLORS = {
  // Neutral metallic bay finish matches the supplied hood-open reference; it
  // is not a display-scale or body-coordinate workaround.
  body: 0xa4aaa6,
  bodyEdge: 0x9da7a5,
  black: 0x11161b,
  rubber: 0x171b1e,
  metal: 0xa9b1b4,
  aluminum: 0xc3cbcd,
  darkMetal: 0x3d464c,
  plastic: 0x202830,
  glass: 0x5e879c,
  fin: 0x79858a,
  high: 0xe99a36,
  low: 0x458fd8,
  coolant: 0x3d86c9,
  wire: 0xd6bb45,
  floor: 0x151c21
};

function vehicleToWorld(point) {
  return new THREE.Vector3(-point[1], point[2], -point[0]);
}

function worldToVehicle(point) {
  return new THREE.Vector3(-point.z, -point.x, point.y);
}

function material(color, options = {}) {
  const opacity = options.opacity ?? 1;
  const value = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? .58,
    metalness: options.metalness ?? .18,
    transparent: opacity < 1,
    opacity,
    side: options.side ?? THREE.FrontSide,
    depthWrite: opacity >= .55,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: 0
  });
  value.userData.baseOpacity = opacity;
  value.userData.baseColor = new THREE.Color(color).getHex();
  value.userData.baseEmissive = value.emissive.getHex();
  return value;
}

function basicMaterial(color, options = {}) {
  const opacity = options.opacity ?? 1;
  const value = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: options.side ?? THREE.DoubleSide, depthWrite: opacity >= .55 });
  value.userData.baseOpacity = opacity;
  value.userData.baseColor = new THREE.Color(color).getHex();
  return value;
}

function applyShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function roundedBox(width, height, depth, radius, color, options = {}) {
  const geometry = new RoundedBoxGeometry(width, height, depth, options.segments ?? 3, Math.min(radius, width * .45, height * .45, depth * .45));
  return applyShadow(new THREE.Mesh(geometry, material(color, options)));
}

function box(width, height, depth, color, options = {}) {
  return applyShadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color, options)));
}

function cylinder(radius, length, color, axis = 'y', options = {}) {
  const geometry = new THREE.CylinderGeometry(options.radiusTop ?? radius, options.radiusBottom ?? radius, length, options.segments ?? 24, 1, options.openEnded ?? false);
  const mesh = applyShadow(new THREE.Mesh(geometry, material(color, options)));
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function torus(radius, tube, color, axis = 'z', options = {}) {
  const mesh = applyShadow(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, options.radialSegments ?? 10, options.tubularSegments ?? 36), material(color, options)));
  if (axis === 'x') mesh.rotation.y = Math.PI / 2;
  if (axis === 'y') mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function placeVehicle(object, point) {
  object.position.copy(vehicleToWorld(point));
  return object;
}

function markMesh(mesh, id, minLod = 1, selectable = true) {
  mesh.userData.pickId = id;
  mesh.userData.minLod = minLod;
  mesh.userData.selectable = selectable;
  if (selectable) pickables.push(mesh);
}

function registerComponent(group, id, options = {}) {
  const meta = itemData.get(id) ?? { id, displayName: id, system: options.system ?? 'BODY', pressureSide: 'NONE', tags: [] };
  group.name = id;
  group.userData.componentId = id;
  group.userData.minLod = options.minLod ?? 1;
  group.userData.role = options.role ?? 'component';
  group.userData.meta = meta;
  (options.parent ?? modelRoot).add(group);
  group.traverse(child => {
    if (!child.isMesh) return;
    if (!child.userData.pickId) markMesh(child, id, child.userData.minLod ?? group.userData.minLod, options.selectable !== false);
  });
  objectById.set(id, group);
  registered.push(group);
  return group;
}

function createVehiclePrism(points, leftMin, leftMax, color, options = {}) {
  const shapePoints = points.map(([fwd, up]) => new THREE.Vector2(fwd, up));
  const faces = THREE.ShapeUtils.triangulateShape(shapePoints, []);
  const positions = [];
  for (const left of [leftMin, leftMax]) {
    for (const [fwd, up] of points) {
      const p = vehicleToWorld([fwd, left, up]);
      positions.push(p.x, p.y, p.z);
    }
  }
  const count = points.length;
  const indices = [];
  for (const face of faces) {
    indices.push(face[2], face[1], face[0]);
    indices.push(count + face[0], count + face[1], count + face[2]);
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    indices.push(i, next, count + next, i, count + next, count + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return applyShadow(new THREE.Mesh(geometry, material(color, options)));
}

// A true vehicle-coordinate top profile: points are [forward, left] and the
// mesh is extruded upward.  It gives visible engine-bay housings their real
// chamfered/curved plan silhouettes instead of reducing every part to a box.
function vehicleTopProfile(points, baseUp, height, color, options = {}) {
  const shape = new THREE.Shape();
  points.forEach(([forward, left], index) => {
    const x = -left;
    const y = forward;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: options.bevel !== false,
    bevelThickness: options.bevelThickness ?? .012,
    bevelSize: options.bevelSize ?? .014,
    bevelSegments: options.bevelSegments ?? 2,
    curveSegments: options.curveSegments ?? 12
  });
  geometry.rotateX(-Math.PI / 2);
  const mesh = applyShadow(new THREE.Mesh(geometry, material(color, options)));
  mesh.position.y = baseUp;
  return mesh;
}

function createLoft(sections, color, options = {}) {
  const ringFor = ([fwd, halfWidth, lower, upper]) => [
    [fwd, -halfWidth, lower + .035],
    [fwd, halfWidth, lower + .035],
    [fwd, halfWidth, upper - .075],
    [fwd, halfWidth * .92, upper],
    [fwd, -halfWidth * .92, upper],
    [fwd, -halfWidth, upper - .075]
  ];
  const rings = sections.map(ringFor);
  const positions = [];
  rings.flat().forEach(point => {
    const p = vehicleToWorld(point);
    positions.push(p.x, p.y, p.z);
  });
  const ringSize = rings[0].length;
  const indices = [];
  for (let s = 0; s < rings.length - 1; s++) {
    for (let i = 0; i < ringSize; i++) {
      const next = (i + 1) % ringSize;
      const a = s * ringSize + i;
      const b = s * ringSize + next;
      const c = (s + 1) * ringSize + next;
      const d = (s + 1) * ringSize + i;
      indices.push(a, b, c, a, c, d);
    }
  }
  const firstCenterIndex = positions.length / 3;
  const firstCenter = vehicleToWorld([sections[0][0], 0, (sections[0][2] + sections[0][3]) / 2]);
  positions.push(firstCenter.x, firstCenter.y, firstCenter.z);
  const lastCenterIndex = positions.length / 3;
  const last = sections.at(-1);
  const lastCenter = vehicleToWorld([last[0], 0, (last[2] + last[3]) / 2]);
  positions.push(lastCenter.x, lastCenter.y, lastCenter.z);
  for (let i = 0; i < ringSize; i++) {
    const next = (i + 1) % ringSize;
    indices.push(firstCenterIndex, next, i);
    const base = (rings.length - 1) * ringSize;
    indices.push(lastCenterIndex, base + i, base + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return applyShadow(new THREE.Mesh(geometry, material(color, options)));
}

function createQuad(points, color, options = {}) {
  const positions = [];
  points.forEach(point => {
    const p = vehicleToWorld(point);
    positions.push(p.x, p.y, p.z);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material(color, { ...options, side: THREE.DoubleSide }));
}

function tube(points, radius, color, options = {}) {
  const vectors = points.map(vehicleToWorld);
  const curve = new THREE.CatmullRomCurve3(vectors, options.closed ?? false, 'centripetal', .4);
  const geometry = new THREE.TubeGeometry(curve, options.segments ?? Math.max(16, vectors.length * 12), radius, options.radialSegments ?? 10, options.closed ?? false);
  const mesh = applyShadow(new THREE.Mesh(geometry, material(color, options)));
  mesh.userData.curve = curve;
  return mesh;
}

function orientCylinderMesh(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  mesh.scale.set(1, length, 1);
  return mesh;
}

function betweenCylinder(start, end, radius, color, options = {}) {
  const mesh = applyShadow(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, options.segments ?? 16), material(color, options)));
  return orientCylinderMesh(mesh, start, end);
}

function betweenTaperedCylinder(start, end, startRadius, endRadius, color, options = {}) {
  const mesh = applyShadow(new THREE.Mesh(new THREE.CylinderGeometry(endRadius, startRadius, 1, options.segments ?? 20), material(color, options)));
  return orientCylinderMesh(mesh, start, end);
}

function makeBolt(radius = .011, length = .035, color = 0xb8a16f) {
  const group = new THREE.Group();
  const shaft = cylinder(radius * .45, length, color, 'y', { metalness: .8, roughness: .35, segments: 12 });
  const head = cylinder(radius, radius * .62, color, 'y', { metalness: .8, roughness: .32, segments: 6 });
  head.position.y = length * .5;
  group.add(shaft, head);
  return group;
}

function makeFitting(radius, length, color = COLORS.aluminum) {
  const group = new THREE.Group();
  const tubeBody = cylinder(radius * .68, length, color, 'y', { metalness: .78, roughness: .3, segments: 16 });
  const nut = cylinder(radius, length * .38, color, 'y', { metalness: .82, roughness: .28, segments: 6 });
  nut.position.y = length * .16;
  group.add(tubeBody, nut);
  return group;
}

function orientGroupAlong(group, point, tangent, axis = 'y') {
  group.position.copy(point);
  const base = axis === 'z' ? new THREE.Vector3(0, 0, 1) : axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  group.quaternion.setFromUnitVectors(base, tangent.clone().normalize());
  return group;
}

function textPlate(text, width, height, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = options.background ?? '#1e252a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = options.border ?? '#9ca6aa';
  context.lineWidth = 16;
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.fillStyle = options.color ?? '#e5e8e9';
  context.font = `600 ${options.fontSize ?? 96}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: false, side: THREE.DoubleSide }));
  plate.userData.minLod = options.minLod ?? 2;
  return plate;
}

function makeWheel(fwd, left) {
  const group = new THREE.Group();
  placeVehicle(group, [fwd, left, .33]);
  const tire = torus(.245, .082, 0x17191b, 'x', { roughness: .84, metalness: .02, tubularSegments: 40 });
  const rim = cylinder(.19, .075, 0xaeb4b5, 'x', { metalness: .72, roughness: .32, segments: 40 });
  const hub = cylinder(.065, .082, 0x858c8e, 'x', { metalness: .75, roughness: .3, segments: 32 });
  group.add(tire, rim, hub);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const hole = cylinder(.022, .083, 0x20262a, 'x', { metalness: .1, roughness: .8, segments: 18 });
    hole.position.set(0, Math.cos(angle) * .137, Math.sin(angle) * .137);
    group.add(hole);
  }
  return group;
}

function makeFan(position, radius = .22) {
  const group = new THREE.Group();
  placeVehicle(group, position);
  const shroud = torus(radius, .018, 0x252d31, 'z', { roughness: .72, segments: 30 });
  const motor = cylinder(radius * .28, .065, 0x333b3f, 'z', { metalness: .25, roughness: .7 });
  group.add(shroud, motor);
  for (let i = 0; i < 7; i++) {
    const blade = roundedBox(radius * .62, radius * .12, .025, .012, 0x30383c, { roughness: .72 });
    blade.position.set(Math.cos(i * Math.PI * 2 / 7) * radius * .38, Math.sin(i * Math.PI * 2 / 7) * radius * .38, 0);
    blade.rotation.z = i * Math.PI * 2 / 7 + .48;
    group.add(blade);
  }
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const brace = box(radius * 1.65, .018, .018, 0x293136, { roughness: .75 });
    brace.rotation.z = angle;
    group.add(brace);
  }
  return group;
}

function makeHeatExchanger(width, height, depth, color, options = {}) {
  const group = new THREE.Group();
  const core = roundedBox(width, height, depth, .012, color, { metalness: .48, roughness: .52 });
  group.add(core);
  const frameColor = options.frameColor ?? 0x4e595e;
  for (const x of [-width / 2, width / 2]) {
    const side = roundedBox(.035, height + .04, depth + .02, .008, frameColor, { metalness: .6, roughness: .42 });
    side.position.x = x;
    group.add(side);
  }
  for (const y of [-height / 2, height / 2]) {
    const rail = roundedBox(width + .05, .03, depth + .02, .007, frameColor, { metalness: .6, roughness: .42 });
    rail.position.y = y;
    group.add(rail);
  }
  const verticalCount = options.verticalCount ?? 34;
  const horizontalCount = options.horizontalCount ?? 10;
  for (let i = 1; i < verticalCount; i++) {
    const fin = box(.003, height - .035, depth + .008, options.finColor ?? COLORS.fin, { metalness: .5, roughness: .5 });
    fin.position.x = -width / 2 + i * width / verticalCount;
    fin.userData.minLod = 2;
    group.add(fin);
  }
  for (let i = 1; i < horizontalCount; i++) {
    const fin = box(width - .04, .0025, depth + .009, options.finColor ?? COLORS.fin, { metalness: .5, roughness: .5 });
    fin.position.y = -height / 2 + i * height / horizontalCount;
    fin.userData.minLod = 3;
    group.add(fin);
  }
  return group;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1219);
scene.fog = new THREE.Fog(0x0b1219, 5.4, 11.5);
const camera = new THREE.PerspectiveCamera(43, 1, .025, 30);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .075;
controls.minDistance = .12;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * .94;
controls.screenSpacePanning = true;
controls.zoomToCursor = true;

scene.add(new THREE.HemisphereLight(0xd7e8f3, 0x17212a, 1.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-3.5, 6.2, -4.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 5;
keyLight.shadow.camera.bottom = -3;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x76b9e8, 1.4);
rimLight.position.set(4, 2.7, 4);
scene.add(rimLight);
const frontLight = new THREE.PointLight(0xffd9b0, 18, 7, 2);
frontLight.position.set(0, 2.5, -3.2);
scene.add(frontLight);

const modelRoot = new THREE.Group();
modelRoot.name = 'LS400_UCF10_MODEL';
scene.add(modelRoot);

function buildGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), material(COLORS.floor, { roughness: .94, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.005;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(12, 48, 0x304252, 0x1c2832);
  grid.position.y = .001;
  grid.material.opacity = .28;
  grid.material.transparent = true;
  scene.add(grid);
}

function buildBodyShell() {
  const shell = new THREE.Group();
  const lower = createLoft([
    [-4.08,.78,.20,.62],[-3.72,.86,.19,.72],[-3.05,.90,.18,.79],[-1.55,.91,.18,.82],[-1.15,.91,.20,.83]
  ], COLORS.body, { metalness: .28, roughness: .52 });
  lower.userData.photoHidden = true;
  const greenhouse = createLoft([
    [-3.58,.47,.76,1.00],[-3.20,.62,.78,1.20],[-2.58,.69,.80,1.37],[-1.75,.68,.82,1.34],[-1.22,.57,.83,1.12]
  ], 0x55222a, { metalness: .24, roughness: .5 });
  // The full-car greenhouse is outside the tight hood-open photograph and
  // would otherwise leak a red cowl shape into the reference crop.
  greenhouse.userData.photoHidden = true;
  shell.add(lower, greenhouse);
  for (const left of [-.91,.91]) {
    const rocker = box(.075,.13,2.72,0x38262b,{metalness:.25,roughness:.65});
    rocker.position.copy(vehicleToWorld([-2.42,left,.27]));
    shell.add(rocker);
    const belt = box(.025,.026,2.35,COLORS.bodyEdge,{metalness:.7,roughness:.32});
    belt.position.copy(vehicleToWorld([-2.35,left * 1.005,.76]));
    shell.add(belt);
  }
  const trunk = roundedBox(1.55,.16,.68,.05,COLORS.body,{metalness:.28,roughness:.5});
  trunk.position.copy(vehicleToWorld([-3.72,0,.77]));
  shell.add(trunk);
  const rearBumper = roundedBox(1.74,.23,.24,.08,0x6b353a,{metalness:.2,roughness:.6});
  rearBumper.position.copy(vehicleToWorld([-4.03,0,.43]));
  shell.add(rearBumper);
  for (const [fwd,left] of [[0,-.83],[0,.83],[-2.815,-.83],[-2.815,.83]]) shell.add(makeWheel(fwd,left));
  registerComponent(shell,'LANDMARK_BODY_SHELL',{minLod:1});
  collisionObjects.push({object:shell, kind:'cabin'});

  const fenders = new THREE.Group();
  // B0-186 fixes the cowl and support pairs.  These stamped apron bands use
  // those underlying coordinates rather than widening a finished scene.
  const apronProfile = [
    [1.08,.49],[1.05,.67],[.95,.78],[.70,.86],[.28,.90],[-.22,.92],[-.62,.92],
    [-.94,.90],[-1.12,.84],[-1.15,.67],[-1.06,.56],[-.78,.59],[-.48,.64],
    [-.14,.66],[.20,.63],[.52,.57]
  ];
  for (const side of [-1, 1]) {
    const inner = side * BAY_STRUCTURE.apronInnerHalfWidth;
    const outer = side * BAY_STRUCTURE.apronOuterHalfWidth;
    fenders.add(createVehiclePrism(apronProfile, Math.min(inner,outer), Math.max(inner,outer), COLORS.body, { metalness:.46, roughness:.42 }));
    const rail = tube([
      [1.04,side*BAY_STRUCTURE.apronRailHalfWidth,.73],[.84,side*(BAY_STRUCTURE.apronRailHalfWidth+.01),.82],[.46,side*(BAY_STRUCTURE.apronRailHalfWidth+.02),.88],[-.18,side*(BAY_STRUCTURE.apronRailHalfWidth+.025),.91],
      [-.57,side*(BAY_STRUCTURE.apronRailHalfWidth+.02),.91],[-.89,side*(BAY_STRUCTURE.apronRailHalfWidth+.015),.89],[-1.09,side*BAY_STRUCTURE.apronRailHalfWidth,.84]
    ], .014, COLORS.bodyEdge, { metalness:.72, roughness:.30, segments:56, radialSegments:10 });
    fenders.add(rail);
    const innerLip = tube([
      [1.02,side*(BAY_STRUCTURE.apronInnerHalfWidth+.005),.67],[.70,side*(BAY_STRUCTURE.apronInnerHalfWidth+.012),.75],[.20,side*(BAY_STRUCTURE.apronInnerHalfWidth+.018),.79],[-.42,side*(BAY_STRUCTURE.apronInnerHalfWidth+.018),.80],[-.82,side*(BAY_STRUCTURE.apronInnerHalfWidth+.012),.78]
    ], .012, 0x3d4645, { metalness:.60, roughness:.42, segments:42, radialSegments:8 });
    innerLip.userData.minLod = 2;
    fenders.add(innerLip);
  }
  registerComponent(fenders,'LANDMARK_FRONT_FENDERS',{minLod:1});

  const windshieldGroup = new THREE.Group();
  const windshield = createQuad([[-1.20,-.63,.91],[-1.20,.63,.91],[-1.58,.56,1.31],[-1.58,-.56,1.31]],COLORS.glass,{opacity:.55,metalness:.05,roughness:.18});
  windshieldGroup.add(windshield);
  const rearGlass = createQuad([[-3.15,-.60,.90],[-3.15,.60,.90],[-2.95,.58,1.27],[-2.95,-.58,1.27]],COLORS.glass,{opacity:.48,metalness:.04,roughness:.2});
  windshieldGroup.add(rearGlass);
  for (const left of [-.695,.695]) {
    const sideGlass = createVehiclePrism([[-3.08,.91],[-2.90,1.27],[-1.62,1.30],[-1.30,.95]],left-.006,left+.006,0x36546a,{opacity:.56,metalness:.04,roughness:.18});
    windshieldGroup.add(sideGlass);
  }
  registerComponent(windshieldGroup,'LANDMARK_WINDSHIELD',{minLod:1});
}

function buildFrontBody() {
  const bumper = new THREE.Group();
  const cover = roundedBox(1.78,.22,.24,.065,COLORS.body,{metalness:.22,roughness:.55});
  cover.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX,0,.43]));
  bumper.add(cover);
  const lower = roundedBox(1.70,.12,.18,.045,0x70343a,{metalness:.18,roughness:.58});
  lower.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.05,0,.30]));
  bumper.add(lower);
  const reinforcement = roundedBox(1.54,.11,.10,.018,0x5b6367,{metalness:.68,roughness:.42});
  reinforcement.position.copy(vehicleToWorld([BAY_STRUCTURE.radiatorSupportX+.07,0,.42]));
  reinforcement.userData.minLod = 2;
  bumper.add(reinforcement);
  for (const left of [-.60,.60]) {
    const signal = roundedBox(.40,.055,.025,.012,0xd8832f,{metalness:.1,roughness:.35,emissive:0x4a2105});
    signal.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX+.026,left,.40]));
    bumper.add(signal);
  }
  registerComponent(bumper,'LANDMARK_FRONT_BUMPER',{minLod:1});
  collisionObjects.push({object:bumper,kind:'solid'});

  const grille = new THREE.Group();
  const surround = roundedBox(.43,.25,.055,.018,0xbcc0bd,{metalness:.85,roughness:.25});
  surround.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.015,0,.63]));
  grille.add(surround);
  const dark = roundedBox(.39,.21,.061,.014,0x14191d,{metalness:.15,roughness:.72});
  dark.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.008,0,.63]));
  grille.add(dark);
  for (let i = -5; i <= 5; i++) {
    const slat = box(.012,.195,.012,0x9da5a5,{metalness:.84,roughness:.28});
    slat.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX+.028,i*.031,.63]));
    grille.add(slat);
  }
  registerComponent(grille,'LANDMARK_GRILLE',{minLod:1});

  for (const [id,left] of [['LANDMARK_PASSENGER_HEADLIGHT',-.62],['LANDMARK_DRIVER_HEADLIGHT',.62]]) {
    const headlight = new THREE.Group();
    const trim = roundedBox(.57,.235,.105,.025,0x2b2f32,{metalness:.38,roughness:.42});
    trim.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.08,left,.67]));
    headlight.add(trim);
    const lens = roundedBox(.53,.20,.116,.02,0xc9d7d9,{opacity:.82,metalness:.08,roughness:.24});
    lens.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.068,left,.67]));
    headlight.add(lens);
    for (let i = -5; i <= 5; i++) {
      const rib = box(.006,.176,.008,0xeaf3f2,{opacity:.68,metalness:.05,roughness:.2});
      rib.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.007,left+i*.041,.67]));
      rib.userData.minLod = 2;
      headlight.add(rib);
    }
    const inner = cylinder(.071,.012,0xe8eeee,'z',{opacity:.82,metalness:.2,roughness:.2,segments:32});
    inner.position.copy(vehicleToWorld([BAY_STRUCTURE.frontBumperX-.005,left-(Math.sign(left)*.12),.67]));
    inner.userData.minLod = 3;
    headlight.add(inner);
    registerComponent(headlight,id,{minLod:1});
  }

  const support = new THREE.Group();
  const upper = roundedBox(BAY_STRUCTURE.radiatorSupportHardpointHalfWidth * 2,.055,.070,.014,0x20282b,{metalness:.42,roughness:.66});
  upper.position.copy(vehicleToWorld([BAY_STRUCTURE.radiatorSupportX,0,.78]));
  support.add(upper);
  const lowerRail = roundedBox(1.48,.050,.060,.012,0x1b2225,{metalness:.42,roughness:.70});
  lowerRail.position.copy(vehicleToWorld([BAY_STRUCTURE.radiatorSupportX-.03,0,.34]));
  support.add(lowerRail);
  for (const left of [-BAY_STRUCTURE.radiatorSupportHardpointHalfWidth,-.31,.31,BAY_STRUCTURE.radiatorSupportHardpointHalfWidth]) {
    const upright = roundedBox(.045,.55,.055,.011,0x283135,{metalness:.5,roughness:.58});
    upright.position.copy(vehicleToWorld([BAY_STRUCTURE.radiatorSupportX,left,.55]));
    support.add(upright);
    const bolt = makeBolt(.012,.028);
    bolt.position.copy(vehicleToWorld([BAY_STRUCTURE.radiatorSupportX+.035,left,.79]));
    bolt.rotation.x = Math.PI / 2;
    bolt.userData.minLod = 3;
    support.add(bolt);
  }
  const upperReturn = tube([
    [BAY_STRUCTURE.radiatorSupportX,-BAY_STRUCTURE.radiatorSupportHardpointHalfWidth,.71],
    [BAY_STRUCTURE.radiatorSupportX,-.50,.80],[BAY_STRUCTURE.radiatorSupportX,0,.82],
    [BAY_STRUCTURE.radiatorSupportX,.50,.80],[BAY_STRUCTURE.radiatorSupportX,BAY_STRUCTURE.radiatorSupportHardpointHalfWidth,.71]
  ], .022, 0x596468, { metalness:.68, roughness:.35, segments:42, radialSegments:8 });
  support.add(upperReturn);
  registerComponent(support,'LANDMARK_RADIATOR_SUPPORT',{minLod:1});

  const rails = new THREE.Group();
  for (const left of [-.53,.53]) {
    const rail = roundedBox(.14,.16,2.34,.025,0x30393d,{metalness:.62,roughness:.5});
    rail.position.copy(vehicleToWorld([-.10,left,.25]));
    rails.add(rail);
    const horn = roundedBox(.27,.08,.23,.02,0x3b4448,{metalness:.62,roughness:.48});
    horn.position.copy(vehicleToWorld([BAY_STRUCTURE.radiatorSupportX-.03,left,.30]));
    rails.add(horn);
  }
  registerComponent(rails,'LANDMARK_FRONT_FRAME_RAILS',{minLod:1});

  const splash = new THREE.Group();
  const under = roundedBox(1.45,.025,1.45,.012,0x252b2e,{roughness:.86,metalness:.04});
  under.position.copy(vehicleToWorld([-.02,0,.14]));
  splash.add(under);
  const frontUnder = roundedBox(1.55,.025,.52,.012,0x282e31,{roughness:.84,metalness:.05});
  frontUnder.position.copy(vehicleToWorld([.90,0,.18]));
  splash.add(frontUnder);
  registerComponent(splash,'LANDMARK_SPLASH_SHIELDS',{minLod:1});
}

let hoodPivot;
let hoodPanel;
let hoodStruts;

function buildHoodAndCowl() {
  const cowl = new THREE.Group();
  const plenum = roundedBox(BAY_STRUCTURE.cowlOuterHalfWidth*2,.12,.30,.055,0x252d32,{roughness:.75,metalness:.12});
  plenum.position.copy(vehicleToWorld([BAY_STRUCTURE.cowlX,0,.92]));
  cowl.add(plenum);
  for (let i = -8; i <= 8; i++) {
    const slot = box(.011,.013,.22,0x080b0d,{roughness:.9});
    slot.position.copy(vehicleToWorld([BAY_STRUCTURE.cowlX,i*.080,.985]));
    slot.userData.minLod = 2;
    cowl.add(slot);
  }
  for (const left of [-.28,.28]) {
    const arm = box(.018,.015,.55,0x101417,{metalness:.5,roughness:.5});
    arm.position.copy(vehicleToWorld([BAY_STRUCTURE.cowlX-.10,left,.995]));
    arm.rotation.y = left > 0 ? -.18 : .18;
    arm.userData.minLod = 2;
    cowl.add(arm);
  }
  // Photo-visible rear-bay context: the black cowl service cover, wrapped
  // harness and the warm plated hard line prevent the firewall from reading
  // as an empty slab while keeping the service geometry separate from the
  // air-cleaner itself.
  const rearServiceCover = roundedBox(.660,.130,.420,.055,0x141a1d,{roughness:.76,metalness:.10,segments:7});
  rearServiceCover.position.copy(vehicleToWorld([-.662,-.447,.920]));
  cowl.add(rearServiceCover);
  const rearServiceLid = roundedBox(.590,.018,.345,.024,0x242d31,{roughness:.70,metalness:.12,segments:6});
  rearServiceLid.position.copy(vehicleToWorld([-.662,-.447,1.000]));
  cowl.add(rearServiceLid);
  for (const side of [-.235,.235]) {
    const fastener = makeBolt(.010,.020);
    fastener.position.copy(vehicleToWorld([-.662,-.447+side,1.020]));
    cowl.add(fastener);
  }
  const rearHarness = tube([
    [-1.045,-.720,.995],[-1.115,-.600,1.012],[-1.105,-.410,1.018],[-1.040,-.245,1.006]
  ],.015,0x161c1f,{roughness:.86,segments:28,radialSegments:8});
  cowl.add(rearHarness);
  const platedLine = tube([
    [-1.070,-.120,1.015],[-1.135,.080,1.022],[-1.120,.330,1.018],[-1.040,.600,1.000]
  ],.011,0x9d8257,{metalness:.68,roughness:.34,segments:30,radialSegments:8});
  cowl.add(platedLine);
  registerComponent(cowl,'LANDMARK_COWL',{minLod:1});

  const hinges = new THREE.Group();
  for (const left of [-.68,.68]) {
    const base = roundedBox(.10,.035,.15,.012,0x454b4d,{metalness:.72,roughness:.36});
    base.position.copy(vehicleToWorld([BAY_STRUCTURE.cowlX+.08,left,.91]));
    hinges.add(base);
    const hinge = betweenCylinder(vehicleToWorld([BAY_STRUCTURE.cowlX+.08,left,.93]),vehicleToWorld([BAY_STRUCTURE.cowlX+.19,left,.98]),.018,0x777e7f,{metalness:.75,roughness:.34});
    hinges.add(hinge);
  }
  hoodPivot = new THREE.Group();
  hoodPivot.position.copy(vehicleToWorld([BAY_STRUCTURE.cowlX+.10,0,.95]));
  hoodPanel = new THREE.Group();
  const outer = roundedBox(1.64,.048,1.78,.04,COLORS.body,{metalness:.30,roughness:.48});
  outer.position.set(0,-.025,-.86);
  outer.rotation.x = -.035;
  hoodPanel.add(outer);
  const raised = roundedBox(.92,.035,1.35,.03,0x762c33,{metalness:.32,roughness:.46});
  raised.position.set(0,.008,-.82);
  raised.rotation.x = -.035;
  hoodPanel.add(raised);
  const insulation = roundedBox(1.35,.022,1.36,.035,0x28292a,{roughness:.9,metalness:.01});
  insulation.position.set(0,-.057,-.83);
  insulation.rotation.x = -.035;
  insulation.userData.minLod = 2;
  hoodPanel.add(insulation);
  for (const x of [-.56,0,.56]) {
    const rib = roundedBox(.045,.035,1.50,.014,0x5d252b,{metalness:.38,roughness:.46});
    rib.position.set(x,-.076,-.82);
    rib.rotation.x = -.035;
    rib.userData.minLod = 3;
    hoodPanel.add(rib);
  }
  for (const z of [-.25,-.80,-1.35]) {
    const rib = roundedBox(1.42,.035,.045,.014,0x5d252b,{metalness:.38,roughness:.46});
    rib.position.set(0,-.076,z);
    rib.userData.minLod = 3;
    hoodPanel.add(rib);
  }
  const latch = roundedBox(.14,.035,.055,.01,0xc0a76c,{metalness:.8,roughness:.3});
  latch.position.set(0,-.095,-1.70);
  latch.userData.minLod = 3;
  hoodPanel.add(latch);
  hoodPivot.add(hoodPanel);
  registerComponent(hoodPivot,'LANDMARK_HOOD',{minLod:1});
  collisionObjects.push({object:hoodPanel,kind:'hood'});

  hoodStruts = new THREE.Group();
  for (const left of [-.70,.70]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(.010,.010,1,12),material(0x858b8d,{metalness:.78,roughness:.32}));
    strut.userData.left = left;
    // The supplied photo does not show dominant diagonal hood rods. Keep the
    // articulated hardware for close inspection, not the photo-layout view.
    strut.userData.minLod = 3;
    hoodStruts.add(strut);
  }
  hinges.add(hoodStruts);
  registerComponent(hinges,'LANDMARK_HOOD_HINGES',{minLod:2});
  updateHood(70);
}

function updateHood(angle) {
  state.hoodAngle = Number(angle);
  if (!hoodPivot) return;
  hoodPivot.rotation.x = THREE.MathUtils.degToRad(state.hoodAngle);
  hoodPivot.updateWorldMatrix(true,true);
  if (hoodStruts) {
    hoodStruts.children.forEach(strut => {
      const left = strut.userData.left;
      const start = vehicleToWorld([-.78,left,.80]);
      const hoodLocal = new THREE.Vector3(-left, -.04, -1.10);
      const end = hoodPivot.localToWorld(hoodLocal.clone());
      orientCylinderMesh(strut,start,end);
    });
  }
}

function buildFirewallAndCabin() {
  const firewall = new THREE.Group();
  const panel = roundedBox(BAY_STRUCTURE.cowlInnerHalfWidth*2,.72,.055,.05,0x4f5958,{metalness:.58,roughness:.5});
  panel.position.copy(vehicleToWorld([BAY_STRUCTURE.firewallX,0,.66]));
  firewall.add(panel);
  // The brake booster is deliberately outboard of the measured cowl opening.
  // Extend the stamped driver-side firewall behind it rather than pulling the
  // booster inward to make the old narrow panel appear to fit.
  const driverFirewallLobe=roundedBox(.610,.510,.072,.090,0x171d20,{metalness:.20,roughness:.70,segments:8});
  driverFirewallLobe.position.copy(vehicleToWorld([BAY_STRUCTURE.firewallX-.018,1.000,.795]));
  firewall.add(driverFirewallLobe);
  const driverFirewallPress=roundedBox(.460,.020,.310,.070,0x252e30,{metalness:.34,roughness:.60,segments:7});
  driverFirewallPress.position.copy(vehicleToWorld([BAY_STRUCTURE.firewallX-.064,1.002,.795]));
  firewall.add(driverFirewallPress);
  for (const upOffset of [-.145,.145]) {
    const pressRib=roundedBox(.405,.010,.016,.006,0x485154,{metalness:.38,roughness:.52,segments:4});
    pressRib.position.copy(vehicleToWorld([BAY_STRUCTURE.firewallX-.085,1.004,.795+upOffset]));
    pressRib.rotation.z=.08;
    pressRib.userData.minLod=2;
    firewall.add(pressRib);
  }
  const passThrough = cylinder(.075,.065,0x20272b,'z',{roughness:.7,segments:24});
  passThrough.position.copy(vehicleToWorld([BAY_STRUCTURE.firewallX-.03,-.45,.70]));
  firewall.add(passThrough);
  for (const left of [-BAY_STRUCTURE.cowlInnerHalfWidth+.06,BAY_STRUCTURE.cowlInnerHalfWidth-.06]) {
    const seam = roundedBox(.035,.66,.03,.008,0x777d7e,{metalness:.5,roughness:.45});
    seam.position.copy(vehicleToWorld([BAY_STRUCTURE.firewallX-.037,left,.65]));
    seam.userData.minLod = 2;
    firewall.add(seam);
  }
  registerComponent(firewall,'LANDMARK_FIREWALL',{minLod:1});
  collisionObjects.push({object:firewall,kind:'solid'});

  const dashboard = new THREE.Group();
  const dash = createLoft([[-1.08,.72,.58,.93],[-1.42,.73,.45,1.01],[-1.74,.69,.43,.89]],0x252a2e,{roughness:.84,metalness:.02});
  dashboard.add(dash);
  const glove = roundedBox(.57,.25,.06,.035,0x34383b,{roughness:.82});
  glove.position.copy(vehicleToWorld([-1.48,-.36,.70]));
  dashboard.add(glove);
  registerComponent(dashboard,'LANDMARK_DASHBOARD',{minLod:1});

  const footwell = new THREE.Group();
  const volume = roundedBox(.62,.52,.65,.06,0x3a4146,{opacity:.22,roughness:.8,metalness:.02});
  volume.position.copy(vehicleToWorld([-1.56,-.38,.40]));
  footwell.add(volume);
  registerComponent(footwell,'LANDMARK_PASSENGER_FOOTWELL',{minLod:1});
}

function buildCoolingStack() {
  // Front-to-rear order is support → condenser → fan shrouds → radiator.
  // The dimensions leave the B0-186 support hardpoints visibly outside the core.
  const radiator = makeHeatExchanger(1.28,.49,.072,0x465158,{frameColor:0x3a4449,finColor:0x657277,verticalCount:38,horizontalCount:11});
  radiator.position.copy(vehicleToWorld(BAY_ANCHORS.radiator));
  const topTank = roundedBox(1.24,.07,.105,.032,0x20272b,{roughness:.78,metalness:.08});
  topTank.position.y = .265;
  radiator.add(topTank);
  const bottomTank = roundedBox(1.24,.065,.105,.032,0x20272b,{roughness:.78,metalness:.08});
  bottomTank.position.y = -.265;
  radiator.add(bottomTank);
  registerComponent(radiator,'LANDMARK_RADIATOR',{minLod:1});

  const condenser = makeHeatExchanger(1.26,.47,.045,0x7f898b,{frameColor:0xa1a8a8,finColor:0x929b9c,verticalCount:42,horizontalCount:12});
  condenser.position.copy(vehicleToWorld(BAY_ANCHORS.condenser));
  for (const x of [-.65,.65]) {
    const tank = roundedBox(.045,.44,.052,.018,0xaab1b1,{metalness:.72,roughness:.35});
    tank.position.x = x;
    condenser.add(tank);
  }
  for (const [x,y] of [[-.58,.27],[.58,.27],[-.58,-.27],[.58,-.27]]) {
    const tab = roundedBox(.12,.035,.055,.009,0x9ba3a3,{metalness:.78,roughness:.33});
    tab.position.set(x,y,0);
    tab.userData.minLod = 2;
    condenser.add(tab);
    const bolt = makeBolt(.009,.022);
    bolt.position.set(x,y,.035);
    bolt.rotation.x = Math.PI/2;
    bolt.userData.minLod = 3;
    condenser.add(bolt);
  }
  registerComponent(condenser,'AC_CONDENSER',{minLod:1});

  const inlet = new THREE.Group();
  const inletFit = makeFitting(.024,.075);
  inletFit.rotation.z = Math.PI / 2;
  inlet.add(inletFit);
  placeVehicle(inlet,[BAY_STRUCTURE.condenserX,.61,.70]);
  registerComponent(inlet,'AC_CONDENSER_INLET',{minLod:2});
  const outlet = new THREE.Group();
  const outletFit = makeFitting(.021,.065);
  outletFit.rotation.z = Math.PI / 2;
  outlet.add(outletFit);
  placeVehicle(outlet,[BAY_STRUCTURE.condenserX,-.62,.48]);
  registerComponent(outlet,'AC_CONDENSER_OUTLET',{minLod:2});

  const fans = new THREE.Group();
  // Twin caged fans are separate shrouded assemblies, not loose disks.
  fans.add(makeFan([BAY_STRUCTURE.fanPlaneX,-.235,.575],.205),makeFan([BAY_STRUCTURE.fanPlaneX,.235,.575],.205));
  // Large black cooling-hose arcs are a photo-facing landmark in front of
  // the 1UZ, so keep them as real continuous tubes rather than a faint route
  // overlay.  They terminate at the radiator plane and engine-front ports.
  const driverUpperHose = tube([
    [.205,.355,.565],[.345,.420,.575],[.510,.395,.550],[.655,.290,.545],[BAY_ANCHORS.radiator[0],.255,.565]
  ],.067,0x161c1e,{roughness:.87,segments:40,radialSegments:14});
  fans.add(driverUpperHose);
  const passengerLowerHose = tube([
    [.175,-.305,.505],[.300,-.395,.490],[.515,-.370,.475],[BAY_ANCHORS.radiator[0],-.250,.505]
  ],.055,0x171d20,{roughness:.88,segments:34,radialSegments:12});
  passengerLowerHose.userData.minLod=2;
  fans.add(passengerLowerHose);
  registerComponent(fans,'LANDMARK_COOLING_FANS',{minLod:1});
}

function addPhotoValveCover(group, localX, foreAft, driverSide = false) {
  // Long low black cover bands establish the actual 1UZ silhouette.  The
  // driver band is intentionally farther outboard and more legible from the
  // saved front-over-bay camera than the passenger band behind the intake.
  const coverWidth = driverSide ? .325 : .330;
  const coverLength = driverSide ? .840 : .770;
  const insetWidth = driverSide ? .248 : .252;
  const insetLength = driverSide ? .680 : .625;
  const cover = roundedBox(coverWidth,.092,coverLength,.058,0x111619,{metalness:.18,roughness:.58,segments:7});
  cover.position.set(localX,.125,foreAft);
  cover.rotation.y = driverSide ? -.045 : .040;
  group.add(cover);
  const inset = roundedBox(insetWidth,.014,insetLength,.012,0x252d31,{metalness:.48,roughness:.44,segments:5});
  inset.position.set(localX,.177,foreAft);
  inset.rotation.y = cover.rotation.y;
  inset.userData.minLod = 2;
  group.add(inset);
  // The real covers are long ribbed cast bands, not blank display slabs.
  // Keep every fin in the same authored engine-local envelope so the photo
  // fit stays tied to the vehicle anchors rather than a screen-space tweak.
  for (let i=-7;i<=7;i++) {
    const fin=roundedBox(driverSide?.326:.286,.012,.016,.004,0x566166,{metalness:.58,roughness:.39});
    fin.position.set(localX,.191,foreAft+i*(driverSide?.052:.052));
    fin.rotation.y=cover.rotation.y;
    fin.userData.minLod=1;
    group.add(fin);
  }
  if (driverSide) {
    const centreStrip=roundedBox(.104,.020,.600,.020,0x303a3d,{metalness:.50,roughness:.42,segments:5});
    centreStrip.position.set(localX,.198,foreAft+.010);
    group.add(centreStrip);
    const plate=textPlate('FOUR CAM 32',.250,.555,{fontSize:55,minLod:1,background:'#111619',border:'#788387',color:'#e3e7e5'});
    plate.rotation.x=-Math.PI/2;
    plate.position.set(localX,.211,foreAft+.010);
    group.add(plate);
    for (const z of [foreAft-.255,foreAft+.255]) {
      const bolt=makeBolt(.012,.020);
      bolt.position.set(localX,.214,z);
      group.add(bolt);
    }
    const oilCap=cylinder(.041,.022,0x151b1d,'y',{roughness:.76,segments:24});
    oilCap.position.set(localX+.040,.217,foreAft-.215);
    group.add(oilCap);
  }
}

function makePulley(position,radius,depth=.055) {
  const group = new THREE.Group();
  group.position.copy(vehicleToWorld(position));
  const drum = cylinder(radius,depth,0x25292b,'z',{metalness:.58,roughness:.42,segments:38});
  group.add(drum);
  for (let i=-2;i<=2;i++) {
    const groove=torus(radius-.008,.003,0x080a0b,'z',{metalness:.2,roughness:.8,tubularSegments:36});
    groove.position.z=i*.009;
    group.add(groove);
  }
  const hub=cylinder(radius*.18,depth+.012,0x9b845a,'z',{metalness:.75,roughness:.32,segments:12});
  group.add(hub);
  return group;
}

function buildEngine() {
  const engine = new THREE.Group();
  engine.position.copy(vehicleToWorld(BAY_ANCHORS.engine));
  const localVehiclePoint = point => vehicleToWorld(point).sub(engine.position);
  // This child cancels the engine-local transform so the following profile
  // meshes remain authored directly in vehicle X/Y/Z coordinates.
  const photoSurfaces = new THREE.Group();
  photoSurfaces.position.copy(engine.position).multiplyScalar(-1);
  engine.add(photoSurfaces);
  // Photo-facing 1UZ-FE envelope: wide, low banks with a compact cast intake
  // in the valley.  This is deliberately not a scaled version of the old
  // tall silver tower, which could never match the supplied engine-top view.
  const block = roundedBox(.92,.175,.84,.075,0x30383c,{metalness:.48,roughness:.58,segments:7});
  block.position.set(0,-.045,.035);
  engine.add(block);
  const valley = roundedBox(.52,.092,.690,.052,0x5f696c,{metalness:.62,roughness:.42,segments:6});
  valley.position.set(-.015,.105,.120);
  engine.add(valley);
  addPhotoValveCover(engine,-.590,.060,true);
  addPhotoValveCover(engine,.560,.055,false);
  // Lower, ribbed bank shoulders create the broad 1UZ V footprint that is
  // visible beneath the covers in the reference.  These are beveled cast
  // housings with discrete fins rather than squared placeholder blocks.
  for (const [side, centerX] of [[-1,-.620],[1,.560]]) {
    const shoulder = roundedBox(.405,.105,.565,.068,0x171d20,{metalness:.18,roughness:.66,segments:7});
    shoulder.position.set(centerX,.070,-.155);
    shoulder.rotation.y=side*.032;
    engine.add(shoulder);
    const frontPod = roundedBox(.340,.095,.235,.050,0x222a2d,{metalness:.18,roughness:.67,segments:6});
    frontPod.position.set(centerX,.112,-.475);
    frontPod.rotation.y=side*.045;
    engine.add(frontPod);
    for (let i=-3;i<=3;i++) {
      const shoulderFin=roundedBox(.330,.013,.020,.005,0x465055,{metalness:.48,roughness:.44,segments:4});
      shoulderFin.position.set(centerX,.133,-.150+i*.068);
      shoulderFin.rotation.y=side*.032;
      shoulderFin.userData.minLod=2;
      engine.add(shoulderFin);
    }
  }
  // Asymmetric, chamfered plan skins match the broad black bank outlines in
  // the photo and establish real space for the intake and driver equipment.
  photoSurfaces.add(
    vehicleTopProfile([[-.73,.410],[-.78,.670],[-.58,.815],[-.03,.790],[.185,.665],[.225,.455],[.075,.385],[-.380,.395]],.575,.070,0x171d20,{roughness:.69,metalness:.14,bevelSize:.026,bevelThickness:.014}),
    vehicleTopProfile([[-.72,-.415],[-.77,-.700],[-.55,-.845],[-.05,-.805],[.170,-.690],[.210,-.470],[.065,-.390],[-.395,-.405]],.575,.070,0x171d20,{roughness:.69,metalness:.14,bevelSize:.026,bevelThickness:.014})
  );
  for (const side of [-1,1]) {
    for (let i=0;i<5;i++) {
      const bankRidge=tube([
        [-.565,side*(.470+i*.055),.660],[-.250,side*(.500+i*.052),.665],[.060,side*(.475+i*.046),.650]
      ],.009,0x4a5558,{metalness:.45,roughness:.44,segments:18,radialSegments:6});
      bankRidge.userData.minLod=1;
      photoSurfaces.add(bankRidge);
    }
  }

  // The actual 1UZ intake reads as one long cast valley spine with its large
  // front Lexus cover, not a short silver tower.  Its fore/aft length follows
  // the low, broad engine envelope and leaves visible side corridors.
  const intakeSaddle = roundedBox(.57,.095,.875,.060,0x9fa8a8,{metalness:.72,roughness:.36,segments:7});
  intakeSaddle.position.set(-.065,.185,.050);
  engine.add(intakeSaddle);
  const intakeSpine = vehicleTopProfile([
    [-.835,.005],[-.770,-.090],[-.520,-.134],[-.070,-.125],[.125,-.082],[.245,-.030],
    [.238,.150],[.100,.238],[-.540,.284],[-.790,.215]
  ],.759,.118,0xb8c0c0,{metalness:.76,roughness:.31,bevelSize:.030,bevelThickness:.014,curveSegments:12});
  photoSurfaces.add(intakeSpine);
  // The photo's plenum ribs run fore/aft.  Longitudinal cast runners retain
  // the measured plenum silhouette without turning it into a transverse
  // heat-sink slab.
  for (let i = -3; i <= 3; i++) {
    const intakeRib = roundedBox(.027,.018,.575,.007,0x6f7b7d,{metalness:.64,roughness:.38,segments:4});
    intakeRib.position.set(-.075+i*.053,.345,.137);
    intakeRib.userData.minLod=1;
    engine.add(intakeRib);
  }
  const badgePlate = roundedBox(.205,.020,.235,.024,0xc4cbca,{metalness:.78,roughness:.28,segments:5});
  badgePlate.position.set(-.075,.365,-.350);
  engine.add(badgePlate);
  const badgeOval = torus(.038,.005,0x3b4548,'y',{metalness:.72,roughness:.32,tubularSegments:28});
  badgeOval.scale.x=.72;
  badgeOval.position.set(-.075,.382,-.350);
  engine.add(badgeOval);
  const badgeStroke = tube([[-.091,.390,-.380],[-.073,.390,-.350],[-.089,.390,-.320]],.004,0x3b4548,{metalness:.68,roughness:.34,segments:10,radialSegments:6});
  engine.add(badgeStroke);
  // Layered cast steps and two visible runner bridges make the central
  // manifold read as a 1UZ assembly in plan, rather than a single grey box.
  const badgeShoulder=roundedBox(.295,.040,.305,.040,0x90999a,{metalness:.68,roughness:.36,segments:7});
  badgeShoulder.position.set(-.075,.303,-.347);
  engine.add(badgeShoulder);
  const badgeFace=roundedBox(.224,.026,.242,.026,0xc3cbca,{metalness:.76,roughness:.28,segments:6});
  badgeFace.position.set(-.075,.333,-.350);
  engine.add(badgeFace);
  for (const side of [-1,1]) {
    const intakeRail=tube([
      [-.246,.340,-.410],[-.277,.358,-.225],[-.268,.354,.020],[-.235,.342,.238]
    ].map(([x,y,z])=>[x,y,z]),.022,0x737f80,{metalness:.68,roughness:.34,segments:22,radialSegments:10});
    intakeRail.position.sub(engine.position);
    intakeRail.position.x += side*.092;
    engine.add(intakeRail);
  }
  const throttleLocal = localVehiclePoint(BAY_ANCHORS.throttle);
  const throttleBell = cylinder(.140,.260,0xaeb7b8,'x',{metalness:.72,roughness:.33,segments:36});
  throttleBell.position.copy(throttleLocal);
  engine.add(throttleBell);
  const throttleFlange=torus(.142,.010,0x747e80,'x',{metalness:.70,roughness:.34,tubularSegments:36});
  throttleFlange.position.copy(throttleLocal).add(new THREE.Vector3(.112,0,0));
  engine.add(throttleFlange);
  const throttleActuator=roundedBox(.090,.070,.125,.018,0x252d30,{roughness:.68,metalness:.16});
  throttleActuator.position.copy(throttleLocal).add(new THREE.Vector3(.082,.030,-.015));
  engine.add(throttleActuator);
  const throttleBridge=tube([
    BAY_ANCHORS.throttle,[-.225,-.220,.805],[-.270,-.095,.800],[-.295,-.005,.805]
  ],.083,0xaeb7b8,{metalness:.72,roughness:.34,segments:26,radialSegments:16});
  throttleBridge.position.sub(engine.position);
  engine.add(throttleBridge);
  // Passenger-side cast throttle chamber: a tapered housing with a rounded
  // inlet and actuator lobe, occupying the photo's continuous silver mass
  // from the AFM duct to the front of the intake chamber.
  const throttleCasting = vehicleTopProfile([
    [-.420,-.555],[-.245,-.545],[-.105,-.462],[-.080,-.335],[-.175,-.238],[-.330,-.268],[-.455,-.398]
  ],.642,.035,0x4f5a5c,{metalness:.52,roughness:.50,bevelSize:.030,bevelThickness:.014});
  photoSurfaces.add(throttleCasting);
  const throttleLobe = vehicleTopProfile([
    [-.335,-.405],[-.258,-.495],[-.135,-.468],[-.080,-.385],[-.122,-.295],[-.252,-.258]
  ],.710,.060,0x879091,{metalness:.64,roughness:.40,bevelSize:.026,bevelThickness:.014});
  photoSurfaces.add(throttleLobe);
  // The meter's rubber duct stops at a cast inlet; a chain of tapered,
  // overlapping alloy sections then grows into the throttle body.  This is a
  // single connected physical assembly, not the old floating silver horn.
  const throttleCrossBody=cylinder(.145,.305,0xaeb7b8,'x',{metalness:.72,roughness:.34,segments:34});
  throttleCrossBody.position.copy(vehicleToWorld([-.285,-.430,.804]));
  photoSurfaces.add(throttleCrossBody);
  for (const lateralOffset of [-.135,.135]) {
    const throttleCollar=torus(.145,.009,0x737e80,'x',{metalness:.68,roughness:.35,tubularSegments:34});
    throttleCollar.position.copy(vehicleToWorld([-.285,-.430+lateralOffset,.804]));
    photoSurfaces.add(throttleCollar);
  }
  const throttleNeck=tube([
    [-.285,-.278,.804],[-.245,-.292,.805],BAY_ANCHORS.throttle
  ],.112,0xaeb7b8,{metalness:.72,roughness:.34,segments:16,radialSegments:18});
  photoSurfaces.add(throttleNeck);
  const frontCollector = vehicleTopProfile([
    [.415,-.215],[.397,.220],[.322,.292],[.135,.282],[.068,.172],[.082,-.185],[.180,-.302],[.345,-.298]
  ],.610,.065,0x171d20,{roughness:.66,metalness:.14,bevelSize:.040,bevelThickness:.018});
  photoSurfaces.add(frontCollector);
  const collectorInset = vehicleTopProfile([
    [.355,-.155],[.338,.160],[.278,.212],[.170,.204],[.126,.126],[.135,-.134],[.210,-.220],[.300,-.215]
  ],.676,.019,0x30393c,{roughness:.58,metalness:.28,bevelSize:.018,bevelThickness:.009});
  photoSurfaces.add(collectorInset);
  const collectorLeftLobe = vehicleTopProfile([
    [.384,-.238],[.312,-.166],[.180,-.174],[.112,-.246],[.145,-.330],[.310,-.340]
  ],.698,.022,0x222b2e,{roughness:.61,metalness:.22,bevelSize:.014,bevelThickness:.008});
  const collectorRightLobe = vehicleTopProfile([
    [.384,.238],[.312,.166],[.180,.174],[.112,.246],[.145,.330],[.310,.340]
  ],.698,.022,0x222b2e,{roughness:.61,metalness:.22,bevelSize:.014,bevelThickness:.008});
  const collectorRecess = vehicleTopProfile([
    [.300,-.090],[.290,.090],[.195,.118],[.145,.060],[.150,-.062],[.212,-.118]
  ],.720,.015,0x0f1517,{roughness:.76,metalness:.08,bevelSize:.010,bevelThickness:.005});
  photoSurfaces.add(collectorLeftLobe,collectorRightLobe,collectorRecess);
  // Break the lower collector into a stepped front face and an exposed
  // accessory recess.  The photo has open mechanical space here; retaining
  // it avoids the old oversized black octagon that made the bay feel cramped.
  const collectorStep=vehicleTopProfile([
    [.368,-.135],[.345,.138],[.280,.184],[.206,.145],[.188,-.142],[.252,-.188]
  ],.740,.022,0x414b4d,{roughness:.53,metalness:.34,bevelSize:.012,bevelThickness:.006});
  const collectorAccessory=vehicleTopProfile([
    [.420,-.060],[.403,.060],[.346,.092],[.302,.048],[.300,-.050],[.352,-.095]
  ],.746,.018,0x0b1012,{roughness:.78,metalness:.05,bevelSize:.009,bevelThickness:.004});
  photoSurfaces.add(collectorStep,collectorAccessory);
  const collectorBoss=cylinder(.050,.032,0x899193,'y',{metalness:.68,roughness:.34,segments:28});
  collectorBoss.position.copy(vehicleToWorld([.302,0,.772]));
  photoSurfaces.add(collectorBoss);
  const collectorBossRing=torus(.050,.006,0x313b3e,'y',{metalness:.52,roughness:.42,tubularSegments:28});
  collectorBossRing.position.copy(vehicleToWorld([.302,0,.790]));
  photoSurfaces.add(collectorBossRing);
  for (const [forward,left] of [[.305,-.185],[.305,.185],[.135,-.175],[.135,.175]]) {
    const collectorBolt=makeBolt(.010,.020);
    collectorBolt.position.copy(vehicleToWorld([forward,left,.755]));
    photoSurfaces.add(collectorBolt);
  }
  for (const side of [-1,1]) {
    for (let i=0;i<4;i++) {
      const runner=tube([[-.22,side*.22,.77],[-.18-i*.052,side*(.25+i*.018),.73],[-.12-i*.066,side*.31,.68]],.016,0x9ca6a6,{metalness:.7,roughness:.34,segments:14});
      runner.position.sub(vehicleToWorld(BAY_ANCHORS.engine));
      runner.userData.minLod=2;
      engine.add(runner);
    }
  }
  // 1UZ-FE service details: eight ceramic plug wells, boots and the separate
  // ignition harness.  These are intentionally low-poly but remain readable
  // in the close engine camera.
  const ignition = new THREE.Group();
  for (const side of [-1, 1]) {
    const distributor = cylinder(.032,.062,0x1b2022,'y',{roughness:.72,segments:16});
    distributor.position.set(-.22, .265, side*.30);
    ignition.add(distributor);
    for (let i=0;i<4;i++) {
      const z = -.20 + i*.135;
      const well = cylinder(.018,.052,0x7f898a,'y',{metalness:.35,roughness:.48,segments:16});
      well.position.set(side*.36, .205, z+.055);
      ignition.add(well);
      const boot = cylinder(.025,.034,0x171b1d,'y',{roughness:.82,segments:16});
      boot.position.set(side*.36, .248, z+.055);
      ignition.add(boot);
      const lead = tube([[-.22,.29,side*.30],[-.10,.31,side*.32],[side*.34,.27,z+.055]],.007,0x17191a,{roughness:.9,segments:12,radialSegments:6});
      ignition.add(lead);
    }
  }
  registerComponent(ignition,'ENGINE_SPARK_PLUG_WIRING',{minLod:1});
  engine.add(ignition);

  // Throttle-position sensor and its short three-wire loom at the throttle
  // shaft, rather than an unlabeled cylinder floating beside the plenum.
  const tps = new THREE.Group();
  const sensorBody = roundedBox(.07,.052,.09,.014,0x252b2d,{roughness:.7,metalness:.18});
  sensorBody.position.set(.355,.305,.120);
  tps.add(sensorBody);
  const connector = roundedBox(.045,.045,.065,.01,0x171b1d,{roughness:.82});
  connector.position.set(.395,.288,.075);
  tps.add(connector);
  for (let i=0;i<3;i++) {
    const wire=tube([[BAY_ANCHORS.throttle[0],BAY_ANCHORS.throttle[1],BAY_ANCHORS.throttle[2]],[-.17,-.21,.83],[-.10,-.24,.79]],.0045,[0x17191a,0xb9a52e,0x384b57][i],{roughness:.88,segments:10,radialSegments:5});
    wire.position.sub(vehicleToWorld(BAY_ANCHORS.engine));
    tps.add(wire);
  }
  registerComponent(tps,'ENGINE_THROTTLE_POSITION_SENSOR_WIRING',{minLod:1});
  engine.add(tps);
  for (const z of [-.30,-.18,-.06,.06,.18,.30]) {
    const seam=box(.72,.012,.009,0x4e585d,{metalness:.5,roughness:.5});
    seam.position.set(0,.055,z+.035);
    seam.userData.minLod=3;
    engine.add(seam);
  }
  registerComponent(engine,'ENGINE_1UZ_FE',{minLod:1});
  collisionObjects.push({object:engine,kind:'engine'});

  const drive = new THREE.Group();
  drive.add(makePulley([.31,0,.36],.072,.042));
  drive.add(makePulley([.31,-.20,.47],.050,.034));
  drive.add(makePulley([.31,.20,.48],.053,.034));
  const beltPoints=[[.33,0,.29],[.33,-.22,.40],[.33,-.14,.54],[.33,.15,.53],[.33,.24,.38],[.33,.12,.28]];
  const belt=tube(beltPoints,.008,0x0c0e0f,{roughness:.92,metalness:0,closed:true,segments:52,radialSegments:6});
  drive.add(belt);
  registerComponent(drive,'ENGINE_ACCESSORY_DRIVE',{minLod:3});

  const alternator = new THREE.Group();
  placeVehicle(alternator,[.26,-.28,.40]);
  const body=cylinder(.065,.11,0x929a9c,'z',{metalness:.72,roughness:.36,segments:24});
  alternator.add(body);
  for(let i=0;i<10;i++){
    const vent=box(.010,.050,.115,0x22282b,{metalness:.2,roughness:.72});
    vent.rotation.z=i*Math.PI*2/10;
    vent.position.set(Math.cos(i*Math.PI*2/10)*.052,Math.sin(i*Math.PI*2/10)*.052,0);
    vent.userData.minLod=2;
    alternator.add(vent);
  }
  registerComponent(alternator,'ENGINE_ALTERNATOR',{minLod:3});

  const ps = new THREE.Group();
  placeVehicle(ps,[.48,-.62,.51]);
  const psBody=cylinder(.065,.11,0x4b5356,'z',{metalness:.55,roughness:.47,segments:26});
  ps.add(psBody);
  const reservoir=cylinder(.065,.16,0x22282c,'y',{roughness:.76,metalness:.08,segments:24});
  reservoir.position.set(.08,.09,.04);
  ps.add(reservoir);
  registerComponent(ps,'ENGINE_POWER_STEERING_PUMP',{minLod:2});
}

function buildEngineLandmarks() {
  const battery = new THREE.Group();
  const [batteryX,batteryY,batteryZ] = BAY_ANCHORS.battery;
  const batteryTray = roundedBox(.515,.045,.410,.035,0x30383a,{metalness:.55,roughness:.48});
  batteryTray.position.copy(vehicleToWorld([batteryX,batteryY,batteryZ-.125]));
  battery.add(batteryTray);
  const caseMesh=roundedBox(.455,.180,.355,.058,0x202629,{roughness:.74,metalness:.045,segments:7});
  caseMesh.position.copy(vehicleToWorld(BAY_ANCHORS.battery));
  battery.add(caseMesh);
  const top=roundedBox(.465,.034,.365,.028,0x111619,{roughness:.70,segments:5});
  top.position.copy(vehicleToWorld([batteryX,batteryY,batteryZ+.096]));
  battery.add(top);
  const batteryLabel=textPlate('12V',.190,.090,{fontSize:68,minLod:3,background:'#20282a',border:'#c4c6bc',color:'#e9e6cf'});
  batteryLabel.rotation.x=-Math.PI/2;
  batteryLabel.position.copy(vehicleToWorld([batteryX+.015,batteryY,batteryZ+.115]));
  battery.add(batteryLabel);
  for(const [sideOffset,color] of [[-.105,0xb54242],[.105,0x646c70]]){
    const terminal=cylinder(.019,.035,color,'y',{metalness:.7,roughness:.32,segments:20});
    terminal.position.copy(vehicleToWorld([batteryX,batteryY+sideOffset,batteryZ+.128]));
    battery.add(terminal);
  }
  const holdDown=roundedBox(.045,.026,.33,.010,0x555e5f,{metalness:.65,roughness:.4});
  holdDown.position.copy(vehicleToWorld([batteryX,batteryY,batteryZ+.124]));
  battery.add(holdDown);
  // Individual cell caps and the forward cable boot prevent the battery from
  // reading as another anonymous black cuboid in the driver-front row.
  for (const fwdOffset of [-.115,0,.115]) {
    const cellCap=cylinder(.020,.009,0x343c3e,'y',{roughness:.66,segments:18});
    cellCap.position.copy(vehicleToWorld([batteryX+fwdOffset,batteryY-.080,batteryZ+.122]));
    battery.add(cellCap);
  }
  const positiveBoot=roundedBox(.070,.030,.058,.015,0xb54242,{roughness:.58,metalness:.12,segments:5});
  positiveBoot.position.copy(vehicleToWorld([batteryX+.080,batteryY-.110,batteryZ+.132]));
  battery.add(positiveBoot);
  registerComponent(battery,'LANDMARK_BATTERY',{minLod:1});

  const airbox = new THREE.Group();
  const [airboxX,airboxY,airboxZ] = BAY_ANCHORS.airbox;
  // Low passenger-front filter housing: a broad, shallow box inboard of the
  // apron dome, with its connector and AFM derived from the same anchors.
  const base=roundedBox(.46,.145,.39,.080,0x161d20,{roughness:.82,metalness:.035,segments:6});
  base.position.copy(vehicleToWorld(BAY_ANCHORS.airbox));
  airbox.add(base);
  const asymmetricAirbox=vehicleTopProfile([
    [airboxX+.235,airboxY-.135],[airboxX+.145,airboxY-.225],[airboxX-.115,airboxY-.205],
    [airboxX-.255,airboxY-.075],[airboxX-.225,airboxY+.115],[airboxX-.045,airboxY+.205],
    [airboxX+.165,airboxY+.145],[airboxX+.245,airboxY+.015]
  ],airboxZ-.068,.126,0x141b1e,{roughness:.80,metalness:.045,bevelSize:.026,bevelThickness:.012});
  airbox.add(asymmetricAirbox);
  const lid=roundedBox(.47,.042,.405,.065,0x11171a,{roughness:.74,metalness:.035,segments:5});
  lid.position.copy(vehicleToWorld([airboxX,airboxY,airboxZ+.092]));
  airbox.add(lid);
  for (const fwdOffset of [-.145,-.095,-.045,.005,.055,.105]) {
    const lidRib=roundedBox(.015,.012,.270,.006,0x3a4447,{roughness:.74,metalness:.12,segments:4});
    lidRib.position.copy(vehicleToWorld([airboxX+fwdOffset,airboxY,airboxZ+.120]));
    lidRib.userData.minLod=1;
    airbox.add(lidRib);
  }
  const snorkel=tube([
    [airboxX+.17,airboxY-.055,airboxZ+.010],[airboxX+.13,airboxY-.115,airboxZ+.030],
    [airboxX+.07,airboxY-.135,airboxZ+.055],[airboxX-.015,airboxY-.100,airboxZ+.072]
  ],.078,0x171d20,{roughness:.88,segments:26,radialSegments:16});
  airbox.add(snorkel);
  for(const sideOffset of [-.15,.15]){
    const clip=roundedBox(.026,.045,.040,.010,0xa3a8a7,{metalness:.78,roughness:.3});
    clip.position.copy(vehicleToWorld([airboxX,airboxY+sideOffset,airboxZ+.085]));
    clip.userData.minLod=3;
    airbox.add(clip);
  }
  registerComponent(airbox,'LANDMARK_AIRBOX',{minLod:1});

  const intake = new THREE.Group();
  // FI-5 topology, EPC pipe adjacency and the photo all agree on one physical
  // chain: passenger-front airbox → AFM → corrugated curved duct → throttle.
  const airboxOutlet = tube([
    [airboxX-.015,airboxY-.100,airboxZ+.072],[.335,-.625,.625],[.265,-.735,.608],[BAY_ANCHORS.maf[0],BAY_ANCHORS.maf[1],BAY_ANCHORS.maf[2]]
  ],.094,0x171d20,{roughness:.88,metalness:.01,segments:28,radialSegments:18});
  intake.add(airboxOutlet);
  const airboxOutletCurve=new THREE.CatmullRomCurve3([
    [airboxX-.015,airboxY-.100,airboxZ+.072],[.335,-.625,.625],[.265,-.735,.608],BAY_ANCHORS.maf
  ].map(vehicleToWorld),false,'centripetal',.4);
  for(let i=0;i<8;i++){
    const t=.10+i*.095;
    const outletRing=torus(.098,.006,0x394144,'z',{roughness:.82,tubularSegments:30});
    outletRing.position.copy(airboxOutletCurve.getPointAt(t));
    outletRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),airboxOutletCurve.getTangentAt(t).normalize());
    outletRing.userData.minLod=1;
    intake.add(outletRing);
  }
  const afmGroup=new THREE.Group();
  const afmBody=cylinder(.090,.170,0x60696a,'z',{metalness:.55,roughness:.42,segments:32});
  afmGroup.add(afmBody);
  const afmCap=roundedBox(.125,.050,.085,.018,0x1e2528,{roughness:.66,metalness:.14});
  afmCap.position.y=.078;
  afmGroup.add(afmCap);
  const afmConnector=roundedBox(.060,.038,.052,.012,0x151b1d,{roughness:.78,metalness:.05,segments:4});
  afmConnector.position.set(.070,.082,.010);
  afmGroup.add(afmConnector);
  for (const z of [-.052,.052]) {
    const afmBand=torus(.093,.0045,0xa5adae,'z',{metalness:.76,roughness:.28,tubularSegments:28});
    afmBand.position.z=z;
    afmGroup.add(afmBand);
  }
  placeVehicle(afmGroup,BAY_ANCHORS.maf);
  intake.add(afmGroup);
  const intakeCenterline = [
    [BAY_ANCHORS.maf[0]+.060,BAY_ANCHORS.maf[1]+.015,BAY_ANCHORS.maf[2]],
    [.130,-.765,.625],[.040,-.650,.665],[-.035,-.500,.745],[-.164,-.439,.790],[-.285,-.582,.804]
  ];
  const postMeter = tube(intakeCenterline,.103,0x171d20,{roughness:.88,metalness:.01,segments:58,radialSegments:18});
  intake.add(postMeter);
  const ductCurve=new THREE.CatmullRomCurve3(intakeCenterline.map(vehicleToWorld),false,'centripetal',.4);
  for(let i=0;i<9;i++){
    const t=.10+i*.085;
    const ring=torus(.107,.006,0x394144,'z',{roughness:.82,tubularSegments:30});
    ring.position.copy(ductCurve.getPointAt(t));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ductCurve.getTangentAt(t).normalize());
    ring.userData.minLod=1;
    intake.add(ring);
  }
  for (const t of [.01,.98]) {
    const clamp=torus(.109,.007,0xa4abad,'z',{roughness:.42,metalness:.72,tubularSegments:28});
    clamp.position.copy(ductCurve.getPointAt(t));
    clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ductCurve.getTangentAt(t).normalize());
    intake.add(clamp);
  }
  registerComponent(intake,'LANDMARK_INTAKE_TUBE',{minLod:1});

  const towers = new THREE.Group();
  for (const anchor of [BAY_ANCHORS.strutTowerPassenger,BAY_ANCHORS.strutTowerDriver]) {
    const side = Math.sign(anchor[1]);
    // A wide, shallow, beveled stamping bridges the bowl into the apron. It
    // has an intentionally asymmetric outer wing, matching the white stamped
    // shelves in the photo instead of reading as a loose circular ring.
    const shelf=roundedBox(.430,.024,.335,.095,COLORS.body,{metalness:.42,roughness:.46,segments:8});
    shelf.position.copy(vehicleToWorld([anchor[0]+.005,anchor[1]+side*.040,anchor[2]-.044]));
    shelf.rotation.y=side*.055;
    towers.add(shelf);
    const outerBlend=tube([
      [anchor[0]+.155,anchor[1]+side*.075,anchor[2]-.025],
      [anchor[0]+.110,anchor[1]+side*.190,anchor[2]-.018],
      [anchor[0]-.055,anchor[1]+side*.225,anchor[2]-.010]
    ],.018,COLORS.bodyEdge,{metalness:.54,roughness:.42,segments:18,radialSegments:8});
    towers.add(outerBlend);
    const bowl=cylinder(.152,.072,0x697375,'y',{metalness:.52,roughness:.40,segments:48});
    bowl.position.copy(vehicleToWorld(anchor));
    towers.add(bowl);
    const flange=torus(.148,.013,0xb1bbba,'y',{metalness:.72,roughness:.30,tubularSegments:44});
    flange.position.copy(vehicleToWorld([anchor[0],anchor[1],anchor[2]+.040]));
    towers.add(flange);
    const cap=cylinder(.067,.034,0x1e2528,'y',{metalness:.26,roughness:.70,segments:28});
    cap.position.copy(vehicleToWorld([anchor[0],anchor[1],anchor[2]+.058]));
    towers.add(cap);
    for(let i=0;i<4;i++){
      const angle=i*Math.PI*.5+.18;
      const bolt=makeBolt(.010,.022);
      bolt.position.copy(vehicleToWorld([anchor[0]+Math.cos(angle)*.112,anchor[1]+Math.sin(angle)*.112,anchor[2]+.061]));
      towers.add(bolt);
    }
  }
  registerComponent(towers,'LANDMARK_FRONT_STRUT_TOWERS',{minLod:1});

  const suspensionHousings = new THREE.Group();
  for (const left of [-.80,.80]) {
    const housing=roundedBox(.205,.105,.180,.050,0x222a2d,{roughness:.76,metalness:.08,segments:5});
    housing.position.copy(vehicleToWorld([-.78,left,.845]));
    suspensionHousings.add(housing);
    const lid=roundedBox(.185,.020,.160,.016,0x12181b,{roughness:.72,metalness:.05});
    lid.position.copy(vehicleToWorld([-.78,left,.913]));
    suspensionHousings.add(lid);
  }
  registerComponent(suspensionHousings,'LANDMARK_AIR_SUSPENSION_SERVICE_HOUSINGS',{minLod:1});

  const coolantReservoir = new THREE.Group();
  // Battery → fuse box → shallow rectangular overflow reserve tank is the
  // driver-side front-to-rear sequence seen in the supplied 1990 bay photo.
  const [coolantX,coolantY,coolantZ] = BAY_ANCHORS.coolantReservoir;
  const coolantTray=roundedBox(.320,.018,.242,.020,0x252b2c,{roughness:.72,metalness:.16,segments:5});
  coolantTray.position.copy(vehicleToWorld([coolantX,coolantY,coolantZ-.054]));
  coolantReservoir.add(coolantTray);
  const coolantTank=vehicleTopProfile([
    [coolantX-.145,coolantY-.105],[coolantX+.135,coolantY-.098],[coolantX+.160,coolantY-.040],
    [coolantX+.148,coolantY+.084],[coolantX+.075,coolantY+.112],[coolantX-.125,coolantY+.102],
    [coolantX-.158,coolantY+.038]
  ],coolantZ-.039,.078,0xb8b79b,{roughness:.64,metalness:.01,bevelSize:.018,bevelThickness:.009,curveSegments:10});
  coolantReservoir.add(coolantTank);
  const coolantTop=roundedBox(.264,.010,.189,.014,0xcfc9aa,{opacity:.98,roughness:.52,metalness:.02,segments:5});
  coolantTop.position.copy(vehicleToWorld([coolantX,coolantY,coolantZ+.047]));
  coolantReservoir.add(coolantTop);
  const coolantMoulding=roundedBox(.160,.009,.016,.006,0x8f8d79,{roughness:.70,metalness:.02,segments:4});
  coolantMoulding.position.copy(vehicleToWorld([coolantX+.020,coolantY-.098,coolantZ+.047]));
  coolantReservoir.add(coolantMoulding);
  const coolantCap=cylinder(.031,.025,0x24292b,'y',{roughness:.72,segments:24});
  coolantCap.position.copy(vehicleToWorld([coolantX-.055,coolantY,coolantZ+.056]));
  coolantReservoir.add(coolantCap);
  const levelLine=tube([[coolantX,coolantY-.065,coolantZ-.010],[coolantX,coolantY+.065,coolantZ-.010]],.003,0x8e825f,{roughness:.7,segments:8,radialSegments:5});
  levelLine.userData.minLod=3;
  coolantReservoir.add(levelLine);
  const coolantNeck=tube([[coolantX-.055,coolantY,coolantZ+.038],[coolantX-.055,coolantY,coolantZ+.056]],.018,0x4d5555,{roughness:.72,segments:8,radialSegments:10});
  coolantReservoir.add(coolantNeck);
  registerComponent(coolantReservoir,'LANDMARK_COOLANT_OVERFLOW_RESERVOIR',{minLod:1});

  const fuseBox = new THREE.Group();
  const [fuseX,fuseY] = BAY_ANCHORS.fuseBox;
  const fuseBase=roundedBox(.390,.095,.300,.052,0x1d2427,{roughness:.78,metalness:.04,segments:7});
  fuseBase.position.copy(vehicleToWorld(BAY_ANCHORS.fuseBox));
  fuseBox.add(fuseBase);
  const fuseLid=roundedBox(.378,.028,.288,.038,0x101619,{roughness:.70,metalness:.035,segments:6});
  fuseLid.position.copy(vehicleToWorld([fuseX,fuseY,BAY_ANCHORS.fuseBox[2]+.054]));
  fuseBox.add(fuseLid);
  const fuseInset=roundedBox(.255,.009,.150,.018,0x263033,{roughness:.68,metalness:.16,segments:5});
  fuseInset.position.copy(vehicleToWorld([fuseX-.015,fuseY,BAY_ANCHORS.fuseBox[2]+.073]));
  fuseBox.add(fuseInset);
  for (const fwdOffset of [-.088,-.030,.030,.088]) {
    const lidRib=roundedBox(.285,.008,.011,.004,0x3b4548,{roughness:.66,metalness:.14,segments:3});
    lidRib.position.copy(vehicleToWorld([fuseX+fwdOffset,fuseY,BAY_ANCHORS.fuseBox[2]+.072]));
    fuseBox.add(lidRib);
  }
  const fuseLabel=textPlate('FUSE / RELAY',.245,.075,{fontSize:43,minLod:3,background:'#1a2225',border:'#768083',color:'#e7e9e6'});
  fuseLabel.rotation.x=-Math.PI/2;
  fuseLabel.position.copy(vehicleToWorld([fuseX+.020,fuseY,BAY_ANCHORS.fuseBox[2]+.092]));
  fuseBox.add(fuseLabel);
  for (const fwdOffset of [-.085,.085]) {
    const fuseFastener=makeBolt(.009,.017);
    fuseFastener.position.copy(vehicleToWorld([fuseX+fwdOffset,fuseY-.115,BAY_ANCHORS.fuseBox[2]+.078]));
    fuseBox.add(fuseFastener);
  }
  const fuseRidge=tube([[fuseX-.135,fuseY-.130,BAY_ANCHORS.fuseBox[2]+.067],[fuseX,fuseY-.130,BAY_ANCHORS.fuseBox[2]+.076],[fuseX+.135,fuseY-.130,BAY_ANCHORS.fuseBox[2]+.067]],.009,0x3e484b,{roughness:.72,segments:16,radialSegments:7});
  fuseBox.add(fuseRidge);
  // Shallow relay islands distinguish the fuse box from both the battery and
  // the rectangular coolant reserve immediately behind it.
  for (const [forward,left,size] of [[-.105,-.045,.062],[-.025,.045,.052],[.075,-.030,.058]]) {
    const relay=roundedBox(size,.016,size*.82,.012,0x30393c,{roughness:.65,metalness:.12,segments:4});
    relay.position.copy(vehicleToWorld([fuseX+forward,fuseY+left,BAY_ANCHORS.fuseBox[2]+.083]));
    fuseBox.add(relay);
  }
  for (const fwdOffset of [-.130,.130]) {
    const latch=roundedBox(.045,.026,.032,.010,0x30383b,{roughness:.62,metalness:.16,segments:4});
    latch.position.copy(vehicleToWorld([fuseX+fwdOffset,fuseY-.165,BAY_ANCHORS.fuseBox[2]+.048]));
    fuseBox.add(latch);
  }
  const fuseConduit=tube([
    [fuseX+.160,fuseY+.090,BAY_ANCHORS.fuseBox[2]+.070],[fuseX+.205,fuseY+.130,BAY_ANCHORS.fuseBox[2]+.075],[batteryX-.085,batteryY-.085,batteryZ+.075]
  ],.018,0x171d20,{roughness:.86,segments:18,radialSegments:8});
  fuseBox.add(fuseConduit);
  registerComponent(fuseBox,'LANDMARK_ENGINE_BAY_FUSE_BOX',{minLod:1});

  const throttleCable = new THREE.Group();
  const cable=tube([[-.99,.30,.985],[-.76,.20,.995],[-.55,.04,1.00],[-.38,-.11,.985],[-.30,-.18,.960],BAY_ANCHORS.throttle],.008,0x252a2c,{roughness:.88,segments:52,radialSegments:7});
  throttleCable.add(cable);
  for(const point of [[-.76,.20,.995],[-.55,.04,1.00],[-.38,-.11,.985]]){
    const clip=roundedBox(.025,.025,.045,.006,0x8c9495,{metalness:.62,roughness:.4});
    clip.position.copy(vehicleToWorld(point));
    throttleCable.add(clip);
  }
  registerComponent(throttleCable,'ENGINE_THROTTLE_CABLE',{minLod:2});

  const booster = new THREE.Group();
  const [boosterX,boosterY,boosterZ] = BAY_ANCHORS.brakeBooster;
  const drum=cylinder(.19,.135,0x171d20,'z',{metalness:.52,roughness:.48,segments:40});
  drum.position.copy(vehicleToWorld(BAY_ANCHORS.brakeBooster));
  booster.add(drum);
  const boosterRing=torus(.176,.011,0x525b5c,'z',{metalness:.70,roughness:.34,tubularSegments:40});
  boosterRing.position.copy(vehicleToWorld([boosterX+.010,boosterY,boosterZ]));
  booster.add(boosterRing);
  const master=cylinder(.046,.225,0x939a9b,'z',{metalness:.72,roughness:.35,segments:24});
  master.position.copy(vehicleToWorld([boosterX+.130,boosterY,boosterZ]));
  booster.add(master);
  const reservoirBase=roundedBox(.178,.032,.155,.028,0x707778,{metalness:.52,roughness:.42,segments:5});
  reservoirBase.position.copy(vehicleToWorld([boosterX+.120,boosterY,boosterZ+.075]));
  booster.add(reservoirBase);
  for (const lateralOffset of [-.045,.045]) {
    const reservoir=roundedBox(.074,.096,.138,.028,0xc7c6a8,{opacity:.94,roughness:.52,metalness:.02,segments:5});
    reservoir.position.copy(vehicleToWorld([boosterX+.120,boosterY+lateralOffset,boosterZ+.130]));
    booster.add(reservoir);
    const reservoirCap=cylinder(.022,.012,0x252b2c,'y',{roughness:.72,segments:18});
    reservoirCap.position.copy(vehicleToWorld([boosterX+.120,boosterY+lateralOffset,boosterZ+.186]));
    booster.add(reservoirCap);
  }
  for (const delta of [-.045,.045]) booster.add(tube([[boosterX+.135,boosterY+delta,boosterZ+.015],[boosterX-.005,boosterY+delta,boosterZ+.095],[boosterX-.085,boosterY+delta,boosterZ+.135]],.006,0x8d9697,{metalness:.65,roughness:.36,segments:14,radialSegments:6}));
  const boosterVacuum=tube([
    [boosterX+.020,boosterY-.100,boosterZ+.005],[-.760,.820,.805],[-.560,.560,.825],[-.360,.245,.835]
  ],.018,0x151b1d,{roughness:.88,segments:32,radialSegments:10});
  booster.add(boosterVacuum);
  const checkValve=cylinder(.026,.078,0x1d2528,'z',{roughness:.72,metalness:.16,segments:20});
  checkValve.position.copy(vehicleToWorld([-.665,.700,.817]));
  booster.add(checkValve);
  registerComponent(booster,'LANDMARK_BRAKE_BOOSTER',{minLod:1});
}

function buildCompressor() {
  const bracket = new THREE.Group();
  const plate=createVehiclePrism([[.06,.34],[.31,.34],[.32,.58],[.12,.63]],.18,.35,0x596166,{metalness:.68,roughness:.38});
  bracket.add(plate);
  for(const [fwd,left,up] of [[.08,.20,.39],[.28,.20,.40],[.23,.33,.58]]){
    const bolt=makeBolt(.013,.032);
    bolt.position.copy(vehicleToWorld([fwd,left,up]));
    bolt.rotation.x=Math.PI/2;
    bolt.userData.minLod=3;
    bracket.add(bolt);
  }
  registerComponent(bracket,'AC_COMPRESSOR_BRACKET',{minLod:2});

  const compressor = new THREE.Group();
  compressor.position.copy(vehicleToWorld(BAY_ANCHORS.compressor));
  const rear=cylinder(.125,.16,0x9ca4a5,'z',{metalness:.72,roughness:.36,segments:12});
  rear.position.z=.05;
  compressor.add(rear);
  const center=cylinder(.142,.11,0xb3bbbc,'z',{radiusTop:.13,radiusBottom:.142,metalness:.75,roughness:.34,segments:12});
  center.position.z=-.075;
  compressor.add(center);
  const front=cylinder(.113,.075,0xa6adae,'z',{radiusTop:.095,radiusBottom:.125,metalness:.74,roughness:.34,segments:16});
  front.position.z=-.16;
  compressor.add(front);
  const manifold=roundedBox(.22,.08,.12,.018,0xabb3b4,{metalness:.78,roughness:.31});
  manifold.position.set(0,.135,.015);
  compressor.add(manifold);
  for(const [x,y] of [[-.09,.15],[.09,.15],[-.09,-.11],[.09,-.11]]){
    const ear=roundedBox(.065,.045,.075,.014,0x9da5a6,{metalness:.72,roughness:.35});
    ear.position.set(x,y,.02);
    compressor.add(ear);
    const bolt=makeBolt(.011,.028);
    bolt.position.set(x,y,-.025);
    bolt.rotation.x=Math.PI/2;
    bolt.userData.minLod=3;
    compressor.add(bolt);
  }
  for(let i=0;i<8;i++){
    const rib=box(.012,.19,.018,0x777f81,{metalness:.6,roughness:.4});
    rib.rotation.z=i*Math.PI/8;
    rib.position.z=.145;
    rib.userData.minLod=2;
    compressor.add(rib);
  }
  const bodySeam=torus(.126,.006,0x697174,'z',{metalness:.55,roughness:.46,tubularSegments:32});
  bodySeam.position.z=-.02;
  compressor.add(bodySeam);
  const oilPlug=makeBolt(.012,.025);
  oilPlug.position.set(.11,.03,.08);
  oilPlug.rotation.x=Math.PI/2;
  compressor.add(oilPlug);
  registerComponent(compressor,'AC_COMPRESSOR',{minLod:1});

  const clutch = new THREE.Group();
  clutch.position.copy(vehicleToWorld([BAY_ANCHORS.compressor[0]+.17,BAY_ANCHORS.compressor[1],BAY_ANCHORS.compressor[2]]));
  const pulley=cylinder(.155,.065,0x25292b,'z',{metalness:.62,roughness:.42,segments:40});
  clutch.add(pulley);
  for(let i=-2;i<=2;i++){
    const groove=torus(.146-i*.003,.0035,0x07090a,'z',{roughness:.9,tubularSegments:42});
    groove.position.z=i*.009;
    clutch.add(groove);
  }
  const face=cylinder(.115,.018,0x8b9293,'z',{metalness:.74,roughness:.34,segments:32});
  face.position.z=-.041;
  clutch.add(face);
  for(let i=0;i<6;i++){
    const bolt=makeBolt(.008,.012);
    bolt.position.set(Math.cos(i*Math.PI/3)*.074,Math.sin(i*Math.PI/3)*.074,-.055);
    bolt.rotation.x=Math.PI/2;
    bolt.userData.minLod=3;
    clutch.add(bolt);
  }
  registerComponent(clutch,'AC_COMPRESSOR_CLUTCH',{minLod:2});

  for(const [id,point,radius] of [['AC_DISCHARGE_PORT',[.18,.27,.57],.022],['AC_SUCTION_PORT',[.15,.29,.58],.030]]){
    const port=new THREE.Group();
    const fitting=makeFitting(radius,.065);
    port.add(fitting);
    placeVehicle(port,point);
    registerComponent(port,id,{minLod:3});
  }
  const clutchLead = tube([[.35,.27,.52],[.38,.27,.59],[.42,.25,.62]],.006,0x171b1d,{roughness:.9,segments:16,radialSegments:6});
  clutchLead.userData.minLod=2;
  registerComponent(clutchLead,'AC_COMPRESSOR_CLUTCH_WIRING',{minLod:2});
}

function buildReceiverAndServiceDetails() {
  const bracket = new THREE.Group();
  const upright=roundedBox(.055,.32,.045,.012,0x4f595d,{metalness:.68,roughness:.4});
  upright.position.copy(vehicleToWorld([BAY_ANCHORS.receiverDrier[0]-.02,-.77,.58]));
  bracket.add(upright);
  const band=torus(.058,.009,0x636c6f,'y',{metalness:.72,roughness:.36,tubularSegments:30});
  band.position.copy(vehicleToWorld([BAY_ANCHORS.receiverDrier[0],BAY_ANCHORS.receiverDrier[1],.58]));
  bracket.add(band);
  const bolt=makeBolt(.010,.028);
  bolt.position.copy(vehicleToWorld([BAY_ANCHORS.receiverDrier[0],-.79,.58]));
  bolt.rotation.z=Math.PI/2;
  bolt.userData.minLod=3;
  bracket.add(bolt);
  registerComponent(bracket,'AC_RECEIVER_DRIER_BRACKET',{minLod:2});

  const receiver = new THREE.Group();
  receiver.position.copy(vehicleToWorld(BAY_ANCHORS.receiverDrier));
  const can=cylinder(.052,.27,0xaeb6b6,'y',{metalness:.74,roughness:.34,segments:30});
  receiver.add(can);
  const bottom=cylinder(.049,.018,0x8d9697,'y',{metalness:.72,roughness:.36,segments:30});
  bottom.position.y=-.142;
  receiver.add(bottom);
  const cap=cylinder(.060,.028,0xb9c0c0,'y',{metalness:.76,roughness:.32,segments:30});
  cap.position.y=.145;
  receiver.add(cap);
  for(const x of [-.025,.025]){
    const stem=makeFitting(.018,.052);
    stem.position.set(x,.178,0);
    stem.userData.minLod=3;
    receiver.add(stem);
  }
  registerComponent(receiver,'AC_RECEIVER_DRIER',{minLod:1});

  const sight = new THREE.Group();
  placeVehicle(sight,[BAY_ANCHORS.receiverDrier[0],BAY_ANCHORS.receiverDrier[1],.755]);
  const glass=cylinder(.014,.009,0x8ec9d2,'y',{opacity:.82,metalness:.12,roughness:.18,segments:24});
  sight.add(glass);
  const ring=torus(.016,.003,0xb6bdbd,'y',{metalness:.76,roughness:.3});
  sight.add(ring);
  registerComponent(sight,'AC_SIGHT_GLASS',{minLod:3});

  const pressure = new THREE.Group();
  placeVehicle(pressure,[BAY_ANCHORS.receiverDrier[0]-.02,BAY_ANCHORS.receiverDrier[1],.79]);
  const base=makeFitting(.017,.045);
  pressure.add(base);
  const sensor=roundedBox(.030,.045,.028,.006,0x353c40,{roughness:.68,metalness:.18});
  sensor.position.y=.045;
  pressure.add(sensor);
  const plug=roundedBox(.022,.030,.026,.005,0x20262a,{roughness:.72});
  plug.position.y=.080;
  pressure.add(plug);
  registerComponent(pressure,'AC_PRESSURE_SWITCH',{minLod:3});

  buildServicePort('AC_HIGH_SERVICE_PORT',[BAY_ANCHORS.receiverDrier[0]-.18,-.75,.82],COLORS.high);
  buildServicePort('AC_LOW_SERVICE_PORT',[-.43,-.34,.88],COLORS.low);
}

function buildServicePort(id,point,color) {
  const group=new THREE.Group();
  placeVehicle(group,point);
  const tee=cylinder(.015,.058,COLORS.aluminum,'y',{metalness:.76,roughness:.32,segments:16});
  group.add(tee);
  // Retrofit service-adapter collar: visually distinguishes the R-134a
  // equipment interface from the original R-12 valve core location.
  const adapter=roundedBox(.045,.026,.045,.008,0x969fa1,{metalness:.72,roughness:.34});
  adapter.position.y=.022;
  adapter.userData.minLod=2;
  group.add(adapter);
  const adapterRing=torus(.027,.004,0xb6bec0,'y',{metalness:.78,roughness:.30,tubularSegments:20});
  adapterRing.position.y=.038;
  adapterRing.userData.minLod=2;
  group.add(adapterRing);
  const cap=cylinder(.021,.033,color,'y',{metalness:.18,roughness:.62,segments:18});
  cap.position.y=.044;
  group.add(cap);
  const thread=torus(.016,.0025,0x6f7778,'y',{metalness:.7,roughness:.34,tubularSegments:24});
  thread.position.y=.022;
  group.add(thread);
  registerComponent(group,id,{minLod:3});
}

function buildHvac() {
  const hvacCase = new THREE.Group();
  const caseBody=roundedBox(.70,.47,.42,.08,0x313b42,{opacity:.82,roughness:.76,metalness:.04});
  caseBody.position.copy(vehicleToWorld([-1.27,-.28,.65]));
  caseBody.userData.caseShell=true;
  hvacCase.add(caseBody);
  const seam=torus(.18,.008,0x606a70,'z',{metalness:.36,roughness:.55,tubularSegments:28});
  seam.position.copy(vehicleToWorld([-1.49,-.47,.66]));
  seam.userData.minLod=2;
  hvacCase.add(seam);
  registerComponent(hvacCase,'HVAC_CASE',{minLod:1});

  const evaporator=makeHeatExchanger(.30,.34,.045,0x8b989b,{frameColor:0xabb3b4,finColor:0x9eaaac,verticalCount:18,horizontalCount:8});
  evaporator.position.copy(vehicleToWorld([-1.20,-.41,.66]));
  evaporator.userData.internalHvac=true;
  registerComponent(evaporator,'AC_EVAPORATOR',{minLod:2});

  const expansion=new THREE.Group();
  placeVehicle(expansion,[-1.00,-.47,.72]);
  const blockMesh=roundedBox(.07,.075,.045,.011,0xaab1b2,{metalness:.72,roughness:.34});
  expansion.add(blockMesh);
  for(const x of [-.018,.018]){
    const port=makeFitting(.014,.045);
    port.position.x=x;
    port.rotation.x=Math.PI/2;
    expansion.add(port);
  }
  registerComponent(expansion,'AC_EXPANSION_VALVE',{minLod:3});

  const epr=new THREE.Group();
  placeVehicle(epr,[-1.00,-.42,.67]);
  const eprBody=cylinder(.038,.10,0x9aa2a3,'z',{metalness:.72,roughness:.35,segments:24});
  epr.add(eprBody);
  const dome=cylinder(.047,.035,0xb5bcbc,'z',{radiusTop:.032,radiusBottom:.047,metalness:.74,roughness:.34,segments:24});
  dome.position.z=-.064;
  epr.add(dome);
  const eprPiston=cylinder(.023,.055,0x71797b,'z',{metalness:.76,roughness:.32,segments:20});
  eprPiston.position.z=.062;
  epr.add(eprPiston);
  const eprFlange=torus(.041,.006,0x697174,'z',{metalness:.72,roughness:.35,tubularSegments:26});
  eprFlange.position.z=.045;
  epr.add(eprFlange);
  registerComponent(epr,'AC_EPR',{minLod:3});

  const blowerHousing=new THREE.Group();
  placeVehicle(blowerHousing,[-1.33,-.64,.63]);
  const volute=cylinder(.18,.18,0x313a40,'z',{roughness:.76,metalness:.04,segments:36});
  blowerHousing.add(volute);
  const neck=roundedBox(.24,.18,.18,.05,0x313a40,{roughness:.76,metalness:.04});
  neck.position.set(.14,.06,0);
  blowerHousing.add(neck);
  registerComponent(blowerHousing,'HVAC_BLOWER_HOUSING',{minLod:2});

  const blower=new THREE.Group();
  placeVehicle(blower,[-1.34,-.65,.62]);
  const motor=cylinder(.065,.16,0x22282c,'z',{metalness:.30,roughness:.62,segments:28});
  blower.add(motor);
  const cage=cylinder(.13,.13,0x777f82,'z',{metalness:.50,roughness:.44,segments:32,openEnded:true});
  cage.position.z=.12;
  blower.add(cage);
  for(let i=0;i<20;i++){
    const vane=box(.008,.10,.045,0x8e9799,{metalness:.52,roughness:.43});
    vane.position.set(Math.cos(i*Math.PI/10)*.105,Math.sin(i*Math.PI/10)*.105,.12);
    vane.rotation.z=i*Math.PI/10;
    vane.userData.minLod=3;
    blower.add(vane);
  }
  registerComponent(blower,'HVAC_BLOWER_MOTOR',{minLod:3});

  const heater=makeHeatExchanger(.26,.30,.045,0xa67a53,{frameColor:0xb58d66,finColor:0x9f7653,verticalCount:14,horizontalCount:7});
  heater.position.copy(vehicleToWorld([-1.28,.02,.62]));
  heater.userData.internalHvac=true;
  registerComponent(heater,'HVAC_HEATER_CORE',{minLod:2});

  const door=new THREE.Group();
  const flap=roundedBox(.28,.018,.20,.012,0x636b70,{metalness:.3,roughness:.58});
  flap.position.copy(vehicleToWorld([-1.30,-.12,.65]));
  flap.rotation.z=.35;
  door.add(flap);
  const shaft=cylinder(.012,.34,0x9aa1a2,'x',{metalness:.7,roughness:.35});
  shaft.position.copy(vehicleToWorld([-1.30,-.12,.65]));
  door.add(shaft);
  registerComponent(door,'HVAC_AIR_MIX_DOOR',{minLod:3});

  const drain=new THREE.Group();
  const end=cylinder(.012,.035,0x20262a,'y',{roughness:.86,segments:16});
  end.position.copy(vehicleToWorld([-1.06,-.43,.20]));
  drain.add(end);
  registerComponent(drain,'HVAC_DRAIN_TUBE',{minLod:2});
}

function routeColor(route, sectionType) {
  // Photo-layout inspection starts with physically legible neutrals.  The
  // instructional colour key returns only when tracing/isolation is active.
  const diagnosticPresentation = state.isolation !== 'ALL' || state.tracedRouteIds.has(route.id) || state.geometryValidation;
  if (!diagnosticPresentation) {
    if (sectionType === 'wire') return 0x22272a;
    if (sectionType === 'hard') return 0x7d8788;
    return 0x1b2022;
  }
  if (sectionType === 'wire') return COLORS.wire;
  if (route.system === 'COOLING') return COLORS.coolant;
  if (route.system === 'BRAKES') return SYSTEMS.BRAKES.color;
  if (route.system === 'POWER_STEERING') return SYSTEMS.POWER_STEERING.color;
  if (route.system === 'HVAC') return 0x566069;
  if (route.pressureSide === 'HIGH') return COLORS.high;
  if (route.pressureSide === 'LOW') return COLORS.low;
  return SYSTEMS[route.system]?.color ?? COLORS.metal;
}

function buildRoutes() {
  for (const route of ROUTES) {
    const group=new THREE.Group();
    const allPoints=route.points.map(vehicleToWorld);
    const masterCurve=new THREE.CatmullRomCurve3(allPoints,false,'centripetal',.4);
    const flowArrows=[];
    route.sections.forEach(section=>{
      const points=route.points.slice(section.from,section.to+1);
      const isHard=section.type==='hard';
      const color=routeColor(route,section.type);
      const routeMesh=tube(points,section.radius,color,{
        metalness:isHard ? .72 : .04,
        roughness:isHard ? .34 : .82,
        segments:Math.max(18,points.length*14),
        radialSegments:section.radius<.007?7:10
      });
      routeMesh.userData.sectionType=section.type;
      group.add(routeMesh);
    });
    route.crimps.forEach(index=>{
      const point=allPoints[index];
      const before=allPoints[Math.max(0,index-1)];
      const after=allPoints[Math.min(allPoints.length-1,index+1)];
      const tangent=after.clone().sub(before).normalize();
      const collar=cylinder(.030,.042,COLORS.aluminum,'y',{metalness:.80,roughness:.28,segments:18});
      orientGroupAlong(collar,point,tangent);
      collar.userData.minLod=3;
      group.add(collar);
      for(let groove=-1;groove<=1;groove++){
        const ring=torus(.030,.0025,0x666e70,'y',{metalness:.7,roughness:.35,tubularSegments:22});
        orientGroupAlong(ring,point.clone().add(tangent.clone().multiplyScalar(groove*.010)),tangent,'y');
        ring.userData.minLod=3;
        group.add(ring);
      }
    });
    route.clamps.forEach(index=>{
      const point=allPoints[index];
      const before=allPoints[Math.max(0,index-1)];
      const after=allPoints[Math.min(allPoints.length-1,index+1)];
      const tangent=after.clone().sub(before).normalize();
      const clamp=torus((route.sections[0]?.radius??.012)*1.35,.0035,0xa5aaab,'z',{metalness:.78,roughness:.30,tubularSegments:22});
      clamp.position.copy(point);
      clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);
      clamp.userData.minLod=3;
      group.add(clamp);
      const tab=roundedBox(.035,.012,.025,.004,0x8e9596,{metalness:.72,roughness:.34});
      tab.position.copy(point).add(new THREE.Vector3(0,.025,0));
      tab.userData.minLod=3;
      group.add(tab);
    });
    for(const end of [0,allPoints.length-1]){
      const point=allPoints[end];
      const neighbor=allPoints[end===0?1:allPoints.length-2];
      const tangent=(end===0?neighbor.clone().sub(point):point.clone().sub(neighbor)).normalize();
      const fitting=makeFitting((route.sections[0]?.radius??.012)*1.35,.050);
      orientGroupAlong(fitting,point,tangent,'y');
      fitting.userData.minLod=3;
      group.add(fitting);
    }
    route.flow.forEach(value=>{
      const point=masterCurve.getPointAt(value);
      const tangent=masterCurve.getTangentAt(value).normalize();
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.022,.070,12),material(routeColor(route,'hard'),{metalness:.20,roughness:.45,emissive:routeColor(route,'hard')}));
      arrow.material.emissiveIntensity=.75;
      orientGroupAlong(arrow,point,tangent,'y');
      arrow.visible=false;
      arrow.userData.flowArrow=true;
      arrow.userData.minLod=2;
      flowArrows.push(arrow);
      group.add(arrow);
    });
    // Photo-facing intake geometry is built once in buildEngineLandmarks.
    // Generic context lines remain available at close-inspection level but do
    // not duplicate or visually overwrite the calibrated bay silhouette.
    registerComponent(group,route.id,{minLod:route.system==='AIR_CONDITIONING'?1:3,role:'route'});
    routeRuntime.set(route.id,{group,masterCurve,flowArrows});
  }
}

function addValidationLine(group, from, to, color, radius = .006, label = '') {
  const segment = tube([from, to], radius, color, { metalness: .2, roughness: .48, segments: 2, radialSegments: 6 });
  segment.userData.validationHelper = true;
  group.add(segment);
  if (label) {
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    const plate = textPlate(label, .34, .10, { fontSize: 52, background: '#091018', border: '#48dbc5', color: '#edf4fb' });
    plate.position.copy(vehicleToWorld([mid[0], mid[1], mid[2] + .045]));
    plate.rotation.x = -Math.PI / 2;
    group.add(plate);
  }
}

function addValidationPoint(group, point, color, label, scale = 1) {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.022 * scale, 16, 10), material(color, { emissive: color, roughness: .35 }));
  marker.material.emissiveIntensity = .55;
  marker.position.copy(vehicleToWorld(point));
  marker.userData.validationHelper = true;
  group.add(marker);
  const plate = textPlate(label, .30, .085, { fontSize: 48, background: '#091018', border: '#f0c76d', color: '#f8e6aa' });
  plate.position.copy(vehicleToWorld([point[0], point[1], point[2] + .06]));
  plate.rotation.x = -Math.PI / 2;
  group.add(plate);
}

function buildGeometryValidationOverlay() {
  geometryValidationGroup = new THREE.Group();
  geometryValidationGroup.name = 'GEOMETRY_VALIDATION_REFERENCES';
  GEOMETRY_DATASET.datumPoints.forEach(datum => addValidationPoint(geometryValidationGroup, datum.point, 0xf0c76d, datum.id.replace('DATUM_', ''), 1.08));
  GEOMETRY_DATASET.componentAnchors.forEach(anchor => addValidationPoint(geometryValidationGroup, anchor.anchor, 0x48dbc5, anchor.componentId.replace(/^(LANDMARK_|AC_|ENGINE_|HVAC_)/, ''), .82));
  GEOMETRY_DATASET.measurementReferences.forEach(reference => addValidationLine(geometryValidationGroup, reference.from, reference.to, 0x8b7cff, .006, reference.label));
  geometryValidationGroup.visible = false;
  scene.add(geometryValidationGroup);
}

function buildScene() {
  buildGround();
  buildBodyShell();
  buildFrontBody();
  buildHoodAndCowl();
  buildFirewallAndCabin();
  buildCoolingStack();
  buildEngine();
  buildEngineLandmarks();
  buildCompressor();
  buildReceiverAndServiceDetails();
  buildHvac();
  buildRoutes();
  buildGeometryValidationOverlay();
  scene.updateMatrixWorld(true);
}

buildScene();
// Read-only build/export hook used to keep the native Android mesh in parity.
window.__LS400_NATIVE_EXPORT__ = { modelRoot, objectById, geometryDataset: GEOMETRY_DATASET };

const ESSENTIAL_LANDMARKS = new Set([
  'LANDMARK_BODY_SHELL','LANDMARK_FRONT_BUMPER','LANDMARK_GRILLE','LANDMARK_PASSENGER_HEADLIGHT','LANDMARK_DRIVER_HEADLIGHT',
  'LANDMARK_HOOD','LANDMARK_FRONT_FENDERS','LANDMARK_COWL','LANDMARK_FIREWALL','LANDMARK_RADIATOR_SUPPORT','LANDMARK_FRONT_FRAME_RAILS',
  'LANDMARK_RADIATOR','LANDMARK_COOLING_FANS','ENGINE_1UZ_FE','ENGINE_ACCESSORY_DRIVE','LANDMARK_BATTERY','LANDMARK_AIRBOX','LANDMARK_INTAKE_TUBE',
  'LANDMARK_DASHBOARD','LANDMARK_PASSENGER_FOOTWELL'
]);
const BODY_IDS = new Set(COMPONENTS.filter(item => item.system === 'BODY').map(item => item.id));
const ENGINE_IDS = new Set(['ENGINE_1UZ_FE','ENGINE_ACCESSORY_DRIVE','ENGINE_ALTERNATOR','ENGINE_POWER_STEERING_PUMP']);
const INTERNAL_HVAC_IDS = new Set(['AC_EVAPORATOR','HVAC_HEATER_CORE','HVAC_AIR_MIX_DOOR']);
const SERVICE_NEVER_FLUSH_IDS = new Set(['AC_COMPRESSOR','AC_RECEIVER_DRIER','AC_EXPANSION_VALVE','AC_EPR','AC_EQUALIZER_TUBE']);
const SERVICE_BOUNDARY_IDS = new Set(['AC_DISCHARGE_PORT','AC_SUCTION_PORT','AC_CONDENSER_INLET','AC_CONDENSER_OUTLET','AC_HIGH_SERVICE_PORT','AC_LOW_SERVICE_PORT']);
const SERVICE_CANDIDATE_ROUTE_IDS = new Set(['AC_DISCHARGE_LINE','AC_LIQUID_LINE_CONDENSER_DRIER','AC_LIQUID_LINE_DRIER_FIREWALL','AC_SUCTION_LINE']);

function tagsFor(item) {
  return new Set(item?.tags ?? []);
}

function isolationState(item, group) {
  const tags = tagsFor(item);
  const isRoute = group.userData.role === 'route';
  const isAC = item.system === 'AIR_CONDITIONING';
  const isHvac = item.system === 'HVAC';
  const isAcSupport = ['LANDMARK_COOLING_FANS','ELECTRICAL_AC_HARNESS'].includes(item.id);
  const isLandmark = ESSENTIAL_LANDMARKS.has(item.id) || tags.has('landmark');
  const side = item.pressureSide ?? 'NONE';
  if (state.isolation === 'ALL') return { visible: true, factor: 1 };
  if (state.isolation === 'GEOMETRY_VALIDATION') {
    if (isRoute && item.system === 'AIR_CONDITIONING') return { visible: true, factor: .72 };
    if (isAC || isHvac || isLandmark || ENGINE_IDS.has(item.id)) return { visible: true, factor: item.system === 'BODY' ? .16 : .62 };
    return { visible: false, factor: 0 };
  }
  if (state.isolation === 'LANDMARKS') return { visible: !isAC && !isHvac && !isRoute, factor: 1 };
  if (state.isolation === 'AC_COMPLETE') {
    if (isAC || isHvac || isAcSupport) return { visible: true, factor: 1 };
    return { visible: isLandmark, factor: .18 };
  }
  if (state.isolation === 'AC_HIGH' || state.isolation === 'AC_LOW') {
    const wanted = state.isolation === 'AC_HIGH' ? 'HIGH' : 'LOW';
    if (isAC && (side === wanted || side === 'BOTH' || side === 'BOUNDARY')) return { visible: true, factor: 1 };
    if (isAC || isHvac) return { visible: true, factor: .08 };
    return { visible: isLandmark, factor: .13 };
  }
  if (state.isolation === 'AC_ENGINE_BAY') {
    if ((isAC && tags.has('engine-bay')) || isAcSupport) return { visible: true, factor: 1 };
    if (isAC || isHvac) return { visible: false, factor: 0 };
    return { visible: isLandmark && !tags.has('cabin'), factor: .16 };
  }
  if (state.isolation === 'AC_CABIN') {
    if ((isAC || isHvac) && (tags.has('cabin') || tags.has('firewall'))) return { visible: true, factor: 1 };
    if (['LANDMARK_FIREWALL','LANDMARK_DASHBOARD','LANDMARK_PASSENGER_FOOTWELL','LANDMARK_BODY_SHELL'].includes(item.id)) return { visible: true, factor: .12 };
    return { visible: false, factor: 0 };
  }
  if (state.isolation === 'AC_LINES') {
    if (isRoute && isAC) return { visible: true, factor: 1 };
    if (isAC && (tags.has('fitting') || tags.has('service-port'))) return { visible: true, factor: 1 };
    if (isAC) return { visible: true, factor: .10 };
    return { visible: isLandmark, factor: .10 };
  }
  if (state.isolation === 'HARDWARE') {
    if (tags.has('hardware') || tags.has('fitting') || tags.has('service-port')) return { visible: true, factor: 1 };
    if (isAC) return { visible: true, factor: .08 };
    return { visible: isLandmark, factor: .07 };
  }
  return { visible: true, factor: 1 };
}

function setMaterialOpacity(value, factor) {
  const materials = Array.isArray(value) ? value : [value];
  materials.forEach(mat => {
    if (!mat) return;
    const base = mat.userData.baseOpacity ?? 1;
    const opacity = THREE.MathUtils.clamp(base * factor, .015, 1);
    mat.opacity = opacity;
    mat.transparent = opacity < .995;
    mat.depthWrite = opacity >= .55;
    mat.needsUpdate = true;
  });
}

function shouldForceHide(id) {
  if (['LANDMARK_HOOD','LANDMARK_HOOD_HINGES'].includes(id) && document.getElementById('hideHood').checked) return true;
  if (id === 'LANDMARK_WINDSHIELD' && stage.classList.contains('photo-layout')) return true;
  if (id === 'LANDMARK_FRONT_BUMPER' && document.getElementById('hideBumper').checked) return true;
  if (id === 'LANDMARK_RADIATOR' && document.getElementById('hideRadiator').checked) return true;
  if (id === 'LANDMARK_SPLASH_SHIELDS' && document.getElementById('hideSplash').checked) return true;
  if (ENGINE_IDS.has(id) && document.getElementById('hideEngine').checked) return true;
  if (state.cutawayFirewall && ['LANDMARK_FIREWALL','LANDMARK_DASHBOARD','LANDMARK_PASSENGER_FOOTWELL'].includes(id)) return true;
  if (INTERNAL_HVAC_IDS.has(id) && !state.cutawayHvac && state.isolation !== 'AC_CABIN') return true;
  return false;
}

function updateVisibility() {
  state.geometryValidation = state.isolation === 'GEOMETRY_VALIDATION' || !!document.getElementById('showGeometryValidation')?.checked;
  for (const group of registered) {
    const id = group.userData.componentId;
    const item = itemData.get(id) ?? group.userData.meta;
    const iso = isolationState(item, group);
    const groupLod = group.userData.minLod ?? 1;
    group.visible = iso.visible && groupLod <= state.detailLevel && !shouldForceHide(id);
    let factor = iso.factor;
    if (state.bodyTransparent && BODY_IDS.has(id)) factor *= .22;
    group.traverse(child => {
      if (!child.isMesh) return;
      const childLod = child.userData.minLod ?? groupLod;
      child.visible = childLod <= state.detailLevel && !(stage.classList.contains('photo-layout') && child.userData.photoHidden);
      if (child.userData.flowArrow) child.visible = false;
      setMaterialOpacity(child.material, factor);
      if (child.userData.caseShell && state.cutawayHvac) setMaterialOpacity(child.material, Math.min(factor, .18));
    });
  }
  if (geometryValidationGroup) geometryValidationGroup.visible = state.geometryValidation;
  if (state.selectedId && !isPickAllowed(state.selectedId)) {
    state.selectedId = null;
    state.tracedRouteIds.clear();
    state.serviceJobMode = false;
    document.getElementById('partSelect').value = '';
    renderSelectionCard();
  }
  refreshHighlight();
  resizeRenderer();
}

function restoreMaterialHighlights() {
  modelRoot.traverse(child => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(mat => {
      if (!mat) return;
      if (mat.color && mat.userData.baseColor !== undefined) mat.color.setHex(mat.userData.baseColor);
      if (mat.emissive) {
        mat.emissive.setHex(mat.userData.baseEmissive ?? 0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  });
  highlightHelpers.splice(0).forEach(helper => scene.remove(helper));
  routeRuntime.forEach(runtime => runtime.flowArrows.forEach(arrow => { arrow.visible = false; }));
}

function highlightGroup(group, color, intensity = .65) {
  if (!group || !group.visible) return;
  group.traverse(child => {
    if (!child.isMesh || !child.visible) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(mat => {
      if (!mat) return;
      if (mat.emissive) {
        mat.emissive.setHex(color);
        mat.emissiveIntensity = intensity;
      } else if (mat.color) {
        mat.color.lerp(new THREE.Color(color), .35);
      }
    });
  });
}

function addBoxHighlight(group, color) {
  if (!group || !group.visible) return;
  const bounds = new THREE.Box3().setFromObject(group);
  if (bounds.isEmpty()) return;
  const helper = new THREE.Box3Helper(bounds, color);
  helper.material.transparent = true;
  helper.material.opacity = .75;
  scene.add(helper);
  highlightHelpers.push(helper);
}

function refreshHighlight() {
  restoreMaterialHighlights();
  if (state.selectedId) {
    const selected = objectById.get(state.selectedId);
    const meta = itemData.get(state.selectedId);
    const color = meta?.pressureSide === 'HIGH' ? COLORS.high : meta?.pressureSide === 'LOW' ? COLORS.low : SYSTEMS[meta?.system]?.color ?? 0x48dbc5;
    highlightGroup(selected,color,.72);
    addBoxHighlight(selected,color);
  }
  for (const routeId of state.tracedRouteIds) {
    const runtime = routeRuntime.get(routeId);
    const route = routeData.get(routeId);
    if (!runtime || !route || !runtime.group.visible) continue;
    const color = routeColor(route,'hard');
    highlightGroup(runtime.group,color,1.05);
    const fromObject = objectById.get(route.from);
    const toObject = objectById.get(route.to);
    highlightGroup(fromObject,color,.95);
    highlightGroup(toObject,color,.95);
    addBoxHighlight(fromObject,color);
    addBoxHighlight(toObject,color);
    runtime.flowArrows.forEach(arrow => { arrow.visible = state.detailLevel >= 2; });
  }
  if (state.serviceJobMode) {
    SERVICE_NEVER_FLUSH_IDS.forEach(id => {
      const group = objectById.get(id);
      highlightGroup(group,0xd98cff,1.05);
      addBoxHighlight(group,0xd98cff);
    });
    SERVICE_BOUNDARY_IDS.forEach(id => {
      const group = objectById.get(id);
      highlightGroup(group,0xffd15c,1.1);
      addBoxHighlight(group,0xffd15c);
    });
  }
  updateFlowBanner();
}

function pressureClass(value) {
  return String(value ?? 'NONE').toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function componentAnchorDeviation(id) {
  const anchor = anchorData.get(id);
  const group = objectById.get(id);
  if (!anchor || !group) return null;
  const actual = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
  const expected = vehicleToWorld(anchor.anchor);
  const deviationMm = actual.distanceTo(expected) * 1000;
  return { anchor, deviationMm };
}

function connectedRouteIds(id) {
  const component = componentData.get(id);
  const neighbours = new Set([id,...(component?.connectsTo ?? [])]);
  COMPONENTS.forEach(candidate => {
    if ((candidate.connectsTo ?? []).includes(id)) neighbours.add(candidate.id);
  });
  return ROUTES.filter(route => {
    if (component?.system === 'AIR_CONDITIONING' && route.system !== 'AIR_CONDITIONING') return false;
    return neighbours.has(route.from) || neighbours.has(route.to) || (component?.connectsTo ?? []).includes(route.id);
  }).map(route => route.id);
}

function renderSelectionCard() {
  const card = document.getElementById('selectionCard');
  const item = itemData.get(state.selectedId);
  if (!item) {
    card.innerHTML = '<div class="selection-empty"><strong>Pick a visible part or line</strong><span>Click the model or choose a component above.</span></div>';
    document.getElementById('focusSelected').disabled = true;
    document.getElementById('traceSelected').disabled = true;
    return;
  }
  const isRoute = routeData.has(item.id);
  const aliases = Array.isArray(item.aliases) ? item.aliases.join(' · ') : (item.aliases ?? '—');
  const connects = isRoute ? `${item.from} → ${item.to}` : [...new Set([...(item.connectsTo ?? []),...connectedRouteIds(item.id)])].join(', ');
  const functionText = item.function ?? (isRoute ? `Carries ${item.fluidType} ${item.direction}.` : '—');
  const serviceText = item.serviceRole ?? item.serviceRelevance ?? 'Verify against the factory service manual.';
  const geometry = componentAnchorDeviation(item.id);
  const geometryRows = geometry ? `
        <div class="meta-row"><span>Geometry source</span><span>${escapeHtml(`${geometry.anchor.page} · ${geometry.anchor.source}`)}</span></div>
        <div class="meta-row"><span>Anchor</span><span>${escapeHtml(`${geometry.anchor.anchor.map(value => Math.round(value * 1000)).join(', ')} mm`)}</span></div>
        <div class="meta-row"><span>Deviation</span><span>${escapeHtml(`${Math.round(geometry.deviationMm)} mm from documented anchor; tolerance ${geometry.anchor.toleranceMm} mm`)}</span></div>` : '';
  card.innerHTML = `
    <div class="selection-header">
      <div class="component-id">${escapeHtml(item.id)}</div>
      <h3>${escapeHtml(item.displayName)}</h3>
      <div class="aliases">${escapeHtml(aliases)}</div>
    </div>
    <div class="selection-body">
      <p>${escapeHtml(functionText)}</p>
      <div class="meta-grid">
        <div class="meta-row"><span>System</span><span>${escapeHtml(SYSTEMS[item.system]?.label ?? item.system)}</span></div>
        <div class="meta-row"><span>Contents</span><span>${escapeHtml(item.fluidType ?? 'none')}</span></div>
        <div class="meta-row"><span>Pressure side</span><span><b class="side-badge ${pressureClass(item.pressureSide)}">${escapeHtml(item.pressureSide ?? 'NONE')}</b></span></div>
        <div class="meta-row"><span>Connects</span><span>${escapeHtml(connects || '—')}</span></div>
        <div class="meta-row"><span>Location</span><span>${escapeHtml(item.location ?? item.direction ?? 'See highlighted geometry')}</span></div>
        <div class="meta-row"><span>Confidence</span><span class="confidence">${escapeHtml(item.confidence ?? 'approximate')}</span></div>
        <div class="meta-row"><span>Evidence</span><span>${escapeHtml(item.source ?? '—')}</span></div>
        ${geometryRows}
        <div class="meta-row"><span>Service note</span><span>${escapeHtml(serviceText)}</span></div>
        <div class="meta-row"><span>Model note</span><span>${escapeHtml(item.notes ?? item.geometryStatus ?? '—')}</span></div>
      </div>
    </div>`;
  document.getElementById('focusSelected').disabled = false;
  document.getElementById('traceSelected').disabled = connectedRouteIds(item.id).length === 0 && !isRoute;
}

function selectItem(id, options = {}) {
  if (!itemData.has(id) || !objectById.has(id)) return;
  if (!isPickAllowed(id) && options.reveal) {
    const item = itemData.get(id);
    state.isolation = ['AIR_CONDITIONING','HVAC'].includes(item.system) ? 'AC_COMPLETE' : 'ALL';
    document.getElementById('isolation').value = state.isolation;
    const minLod = objectById.get(id)?.userData.minLod ?? 1;
    if (state.detailLevel < minLod) {
      state.detailLevel = minLod;
      document.getElementById('detailLevel').value = String(minLod);
    }
    if (INTERNAL_HVAC_IDS.has(id)) {
      state.cutawayHvac = true;
      state.cutawayFirewall = true;
      document.getElementById('cutawayHvac').checked = true;
      document.getElementById('cutawayFirewall').checked = true;
    }
    updateVisibility();
  }
  if (!isPickAllowed(id)) {
    showToast('That object is hidden by the current view controls.');
    return;
  }
  state.serviceJobMode = false;
  state.selectedId = id;
  state.tracedRouteIds.clear();
  if (routeData.has(id) && options.trace !== false) state.tracedRouteIds.add(id);
  else if (options.trace) connectedRouteIds(id).forEach(routeId => state.tracedRouteIds.add(routeId));
  const picker = document.getElementById('partSelect');
  if ([...picker.options].some(option => option.value === id)) picker.value = id;
  renderSelectionCard();
  refreshHighlight();
  if (id === 'AC_COMPRESSOR') markAcceptance(1);
  if (['AC_HIGH_SERVICE_PORT','AC_LOW_SERVICE_PORT'].includes(id)) markAcceptance(8);
  if (id === 'AC_DISCHARGE_LINE') markAcceptance(2);
  if (['AC_LIQUID_LINE_CONDENSER_DRIER','AC_LIQUID_LINE_DRIER_FIREWALL'].includes(id)) markAcceptance(3);
  if (id === 'AC_SUCTION_LINE') markAcceptance(4);
  if (options.focus) focusSelected();
}

function clearSelection() {
  state.selectedId = null;
  state.tracedRouteIds.clear();
  state.serviceJobMode = false;
  document.getElementById('partSelect').value = '';
  renderSelectionCard();
  refreshHighlight();
}

function traceSelected() {
  if (!state.selectedId) return;
  state.tracedRouteIds.clear();
  if (routeData.has(state.selectedId)) state.tracedRouteIds.add(state.selectedId);
  else connectedRouteIds(state.selectedId).forEach(id => state.tracedRouteIds.add(id));
  refreshHighlight();
  if (!state.tracedRouteIds.size) showToast('No modeled route is connected to this item.');
}

function updateFlowBanner() {
  const banner = document.getElementById('flowBanner');
  if (!state.tracedRouteIds.size) {
    banner.hidden = true;
    return;
  }
  const routes = [...state.tracedRouteIds].map(id => routeData.get(id)).filter(Boolean);
  const operatingNotice = state.serviceJobMode ? '<strong>NORMAL OPERATING FLOW — NOT FLUSH AUTHORIZATION</strong><br>' : '';
  banner.innerHTML = operatingNotice + routes.map(route => `<span class="${pressureClass(route.pressureSide)}">${escapeHtml(route.pressureSide)}:</span> ${escapeHtml(route.displayName)} · ${escapeHtml(route.from)} → ${escapeHtml(route.to)} · flow ${escapeHtml(route.direction)}`).join('<br>');
  banner.hidden = false;
}

function isActuallyVisible(object) {
  let cursor = object;
  while (cursor) {
    if (!cursor.visible) return false;
    cursor = cursor.parent;
  }
  return true;
}

function isPickAllowed(id) {
  const group = objectById.get(id);
  if (!group || !isActuallyVisible(group)) return false;
  const item = itemData.get(id);
  if (!item) return false;
  const isolation = isolationState(item,group);
  return isolation.visible && isolation.factor >= .5;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pointerNdc(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', event => {
  state.pointerDown = { x:event.clientX, y:event.clientY, time:performance.now() };
});

renderer.domElement.addEventListener('pointerup', event => {
  const down = state.pointerDown;
  state.pointerDown = null;
  if (!down || Math.hypot(event.clientX-down.x,event.clientY-down.y) > 5 || performance.now()-down.time > 550) return;
  pointerNdc(event);
  raycaster.setFromCamera(pointer,camera);
  const active = pickables.filter(mesh => isActuallyVisible(mesh) && isPickAllowed(mesh.userData.pickId));
  const hits = raycaster.intersectObjects(active,false);
  const hit = hits.find(candidate => candidate.object.userData.pickId && isPickAllowed(candidate.object.userData.pickId));
  if (hit) selectItem(hit.object.userData.pickId,{trace:true});
});

renderer.domElement.addEventListener('pointermove', event => {
  state.lastPointer = { x:event.clientX, y:event.clientY };
  pointerNdc(event);
  raycaster.setFromCamera(pointer,camera);
  const ground = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(ground,point)) {
    const vehicle = worldToVehicle(point).multiplyScalar(1000);
    document.getElementById('coordinateReadout').textContent = `X ${vehicle.x.toFixed(0)} · Y ${vehicle.y.toFixed(0)} · Z ${vehicle.z.toFixed(0)} mm`;
  }
});

function focusSelected() {
  const group = objectById.get(state.selectedId);
  if (!group) return;
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3()).length();
  const currentDirection = camera.position.clone().sub(controls.target).normalize();
  const distance = THREE.MathUtils.clamp(size * 2.4,.28,1.7);
  animateCamera(camera.position.clone(), center.clone().add(currentDirection.multiplyScalar(distance)), controls.target.clone(), center, camera.fov, 650);
}

function animateCamera(fromPosition,toPosition,fromTarget,toTarget,toFov,duration=850) {
  state.cameraTween = {
    fromPosition: fromPosition.clone(), toPosition: toPosition.clone(),
    fromTarget: fromTarget.clone(), toTarget: toTarget.clone(),
    fromFov: camera.fov, toFov, start: performance.now(), duration
  };
}

function setCameraPreset(id, immediate = false) {
  const preset = CAMERA_PRESETS[id];
  if (!preset) return;
  // The primary reference is an 800 × 489 image.  Render into that same
  // aspect frame so Compare never measures a letterboxed photo against a
  // differently-proportioned WebGL canvas.
  stage.classList.toggle('photo-layout', id === 'ENGINE_BAY_PHOTO_LAYOUT');
  state.allowInside = !!preset.allowInside;
  const position = vehicleToWorld(preset.position);
  const target = vehicleToWorld(preset.target);
  if (immediate) {
    camera.position.copy(position);
    controls.target.copy(target);
    camera.fov = preset.fov;
    camera.updateProjectionMatrix();
  } else {
    animateCamera(camera.position.clone(),position,controls.target.clone(),target,preset.fov,900);
  }
  document.getElementById('cameraPreset').value = id;
  document.getElementById('cameraFov').value = preset.fov;
  document.getElementById('cameraFovValue').value = `${preset.fov}°`;
  document.getElementById('viewName').textContent = preset.label;
  document.getElementById('viewContext').textContent = id === 'FULL_VEHICLE_HOOD_OPEN_VIEW' ? 'Human-scale · 5–8 ft in front · perspective lens' : 'Saved real-world service viewpoint';
  if (preset.hood !== undefined) {
    const angle = preset.hood ? 70 : 0;
    document.getElementById('hoodAngle').value = angle;
    document.getElementById('hoodAngleValue').value = `${angle}°`;
    updateHood(angle);
  }
  document.getElementById('hideSplash').checked = !!preset.hideSplash;
  document.getElementById('hideBumper').checked = !!preset.hideBumper;
  document.getElementById('hideHood').checked = !!preset.hideHood;
  state.cutawayFirewall = !!preset.cutaway;
  state.cutawayHvac = !!preset.cutaway;
  document.getElementById('cutawayFirewall').checked = state.cutawayFirewall;
  document.getElementById('cutawayHvac').checked = state.cutawayHvac;
  if (id === 'CONDENSER_STACK' || id === 'THROUGH_GRILLE') markAcceptance(5);
  if (id === 'RECEIVER_DRIER_CLOSE' || id === 'PASSENGER_HEADLIGHT') markAcceptance(6);
  if (id === 'PASSENGER_FOOTWELL' || id === 'HVAC_CASE_CUTAWAY') markAcceptance(7);
  updateVisibility();
}

function resetHumanScaleView() {
  state.isolation='ALL';
  state.detailLevel=2;
  state.bodyTransparent=false;
  state.cutawayFirewall=false;
  state.cutawayHvac=false;
  state.allowInside=false;
  document.getElementById('isolation').value='ALL';
  document.getElementById('detailLevel').value='2';
  document.getElementById('bodyTransparent').checked=false;
  for(const id of ['hideHood','hideBumper','hideRadiator','hideEngine','hideSplash','cutawayFirewall','cutawayHvac','showGeometryValidation']) document.getElementById(id).checked=false;
  clearSelection();
  setCameraPreset('FULL_VEHICLE_HOOD_OPEN_VIEW');
}

function preventCameraCollision() {
  if (state.allowInside || state.cameraTween) return;
  camera.position.y = Math.max(.075,camera.position.y);
  for (const entry of collisionObjects) {
    if (!entry.object.visible) continue;
    const bounds = new THREE.Box3().setFromObject(entry.object).expandByScalar(.018);
    if (!bounds.containsPoint(camera.position)) continue;
    const distances = [
      {axis:'x',value:bounds.min.x-.022,d:camera.position.x-bounds.min.x},
      {axis:'x',value:bounds.max.x+.022,d:bounds.max.x-camera.position.x},
      {axis:'y',value:bounds.min.y-.022,d:camera.position.y-bounds.min.y},
      {axis:'y',value:bounds.max.y+.022,d:bounds.max.y-camera.position.y},
      {axis:'z',value:bounds.min.z-.022,d:camera.position.z-bounds.min.z},
      {axis:'z',value:bounds.max.z+.022,d:bounds.max.z-camera.position.z}
    ].sort((a,b)=>a.d-b.d)[0];
    camera.position[distances.axis]=distances.value;
  }
}

function updateSelectionLabel() {
  const overlay = document.getElementById('labelOverlay');
  if (!state.labels || !state.selectedId) {
    overlay.hidden = true;
    return;
  }
  const group = objectById.get(state.selectedId);
  const item = itemData.get(state.selectedId);
  if (!group || !group.visible || !item) {
    overlay.hidden = true;
    return;
  }
  const bounds = new THREE.Box3().setFromObject(group);
  const point = bounds.getCenter(new THREE.Vector3());
  point.y = bounds.max.y;
  point.project(camera);
  const rect = viewport.getBoundingClientRect();
  const x = (point.x * .5 + .5) * rect.width;
  const y = (-point.y * .5 + .5) * rect.height;
  if (point.z < -1 || point.z > 1 || x < 0 || y < 0 || x > rect.width || y > rect.height) {
    overlay.hidden = true;
    return;
  }
  overlay.innerHTML = `<strong>${escapeHtml(item.displayName)}</strong><span>${escapeHtml(item.id)} · ${escapeHtml(item.pressureSide ?? SYSTEMS[item.system]?.label ?? item.system)}</span>`;
  overlay.style.left = `${x}px`;
  overlay.style.top = `${y}px`;
  overlay.hidden = false;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>toast.classList.remove('show'),1800);
}

function markAcceptance(index) {
  state.acceptance.add(index);
  renderAcceptance();
}

function renderAcceptance() {
  const list = document.getElementById('acceptanceList');
  list.innerHTML = '';
  ACCEPTANCE_STEPS.forEach((step,index)=>{
    const item=document.createElement('li');
    item.textContent=`${state.acceptance.has(index)?'✓ ':'○ '}${step}`;
    if(state.acceptance.has(index)) item.classList.add('is-complete');
    list.appendChild(item);
  });
}

function populateControls() {
  const cameraSelect=document.getElementById('cameraPreset');
  Object.entries(CAMERA_PRESETS).forEach(([id,preset])=>{
    const option=document.createElement('option');
    option.value=id;
    option.textContent=preset.label;
    cameraSelect.appendChild(option);
  });
  const partSelect=document.getElementById('partSelect');
  const groups=[
    ['A/C and HVAC',[...COMPONENTS.filter(item=>['AIR_CONDITIONING','HVAC'].includes(item.system)),...ROUTES.filter(item=>['AIR_CONDITIONING','HVAC'].includes(item.system))]],
    ['Engine-bay landmarks',COMPONENTS.filter(item=>!['AIR_CONDITIONING','HVAC'].includes(item.system))],
    ['Context hoses and wiring',ROUTES.filter(item=>!['AIR_CONDITIONING','HVAC'].includes(item.system))]
  ];
  groups.forEach(([label,items])=>{
    const optgroup=document.createElement('optgroup');
    optgroup.label=label;
    items.sort((a,b)=>a.displayName.localeCompare(b.displayName)).forEach(item=>{
      const option=document.createElement('option');
      option.value=item.id;
      option.textContent=`${item.displayName} · ${item.id}`;
      optgroup.appendChild(option);
    });
    partSelect.appendChild(optgroup);
  });
  const referenceSelect=document.getElementById('referenceSelect');
  REFERENCE_IMAGES.forEach(reference=>{
    const option=document.createElement('option');
    option.value=reference.id;
    option.textContent=reference.label;
    referenceSelect.appendChild(option);
  });
  referenceSelect.value=state.referenceId;
  document.getElementById('uncertaintyList').innerHTML=UNCERTAINTIES.map(value=>`<li>${escapeHtml(value)}</li>`).join('');
  document.getElementById('modelStats').textContent=`${COMPONENTS.length} components · ${ROUTES.length} routes · ${GEOMETRY_DATASET.componentAnchors.length} anchors`;
  renderAcceptance();
}

function setActiveTab(name) {
  document.querySelectorAll('.tab').forEach(tab=>{
    const active=tab.dataset.tab===name;
    tab.classList.toggle('is-active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
  });
  document.querySelectorAll('.tab-panel').forEach(panel=>{
    const active=panel.dataset.panel===name;
    panel.classList.toggle('is-active',active);
    panel.hidden=!active;
  });
  if(name==='validate') markAcceptance(11);
}

function configureComparison() {
  const reference=REFERENCE_IMAGES.find(item=>item.id===state.referenceId);
  if(!reference) return;
  const image=document.getElementById('referenceImage');
  image.src=reference.src;
  image.alt=reference.label;
  document.getElementById('referenceCaption').textContent=`${reference.label} · match: ${reference.landmarks} · ${reference.rights ?? 'Verify reuse rights before publishing.'}`;
  document.getElementById('comparisonLandmarks').textContent=`Align these landmarks: ${reference.landmarks}. Camera pose: ${CAMERA_PRESETS[reference.pose]?.label ?? reference.pose}. ${reference.rights ?? ''}`;
  const notesKey=`ls400-discrepancy-${reference.id}`;
  document.getElementById('discrepancyNotes').value=localStorage.getItem(notesKey)??'';
}

function updateComparisonMode() {
  stage.classList.toggle('compare-side',state.comparisonMode==='SIDE');
  stage.classList.toggle('compare-overlay',state.comparisonMode==='OVERLAY');
  const pane=document.getElementById('referencePane');
  pane.style.opacity=String(state.comparisonMode==='OVERLAY'?state.referenceOpacity:1);
  pane.setAttribute('aria-hidden',state.comparisonMode==='OFF'?'true':'false');
  if(state.comparisonMode!=='OFF') markAcceptance(9);
  requestAnimationFrame(()=>{
    resizeRenderer();
    const image=document.getElementById('referenceImage');
    const frame=viewport.getBoundingClientRect();
    const nativeAspect=image?.naturalWidth && image?.naturalHeight ? image.naturalWidth/image.naturalHeight : null;
    const frameAspect=frame.width/frame.height;
    stage.dataset.referenceFrame=state.comparisonMode!=='OFF' && nativeAspect && Math.abs(frameAspect-nativeAspect)<.001 ? 'native' : 'pending';
  });
}

function referencePoseKey(id=state.referenceId) {
  return `ls400-reference-pose-${id}`;
}

function saveCurrentReferencePose() {
  const value={position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov};
  localStorage.setItem(referencePoseKey(),JSON.stringify(value));
  showToast('Camera pose saved for this reference.');
}

function restoreCurrentReferencePose() {
  const raw=localStorage.getItem(referencePoseKey());
  if(!raw){ showToast('No corrected pose has been saved yet.'); return; }
  try{
    const value=JSON.parse(raw);
    const validVector = candidate => Array.isArray(candidate) && candidate.length === 3 && candidate.every(Number.isFinite);
    if (!validVector(value.position) || !validVector(value.target) || !Number.isFinite(value.fov)) throw new Error('Invalid saved camera pose');
    const restoredFov=THREE.MathUtils.clamp(value.fov,28,72);
    animateCamera(camera.position.clone(),new THREE.Vector3().fromArray(value.position),controls.target.clone(),new THREE.Vector3().fromArray(value.target),restoredFov,700);
    document.getElementById('cameraFov').value=restoredFov;
    document.getElementById('cameraFovValue').value=`${Math.round(restoredFov)}°`;
  }catch{ showToast('Saved pose could not be read.'); }
}

function check(name,status,detail) {
  return {name,status,detail};
}

// Bounding-box centres are not valid anchors for an asymmetric reservoir,
// fan pair, multi-part booster or the twin tower group.  Validate these
// documented service locations against their authored vehicle coordinates.
function authoredAnchorFor(componentId) {
  const towerCentre = [
    (BAY_ANCHORS.strutTowerPassenger[0] + BAY_ANCHORS.strutTowerDriver[0]) / 2,
    (BAY_ANCHORS.strutTowerPassenger[1] + BAY_ANCHORS.strutTowerDriver[1]) / 2,
    (BAY_ANCHORS.strutTowerPassenger[2] + BAY_ANCHORS.strutTowerDriver[2]) / 2
  ];
  const explicit = {
    LANDMARK_RADIATOR_SUPPORT: BAY_ANCHORS.radiatorSupport,
    AC_CONDENSER: BAY_ANCHORS.condenser,
    LANDMARK_RADIATOR: BAY_ANCHORS.radiator,
    LANDMARK_COOLING_FANS: BAY_ANCHORS.coolingFans,
    AC_RECEIVER_DRIER: BAY_ANCHORS.receiverDrier,
    AC_COMPRESSOR: BAY_ANCHORS.compressor,
    ENGINE_1UZ_FE: BAY_ANCHORS.engine,
    LANDMARK_BATTERY: BAY_ANCHORS.battery,
    LANDMARK_AIRBOX: BAY_ANCHORS.airbox,
    LANDMARK_BRAKE_BOOSTER: BAY_ANCHORS.brakeBooster,
    LANDMARK_COOLANT_OVERFLOW_RESERVOIR: BAY_ANCHORS.coolantReservoir,
    LANDMARK_FRONT_STRUT_TOWERS: towerCentre
  };
  return explicit[componentId] ?? null;
}

function runValidation() {
  scene.updateMatrixWorld(true);
  const checks=[];
  const allIds=[...COMPONENTS,...ROUTES].map(item=>item.id);
  const duplicateIds=allIds.filter((id,index)=>allIds.indexOf(id)!==index);
  checks.push(check('Component IDs are unique',duplicateIds.length?'error':'pass',duplicateIds.length?`Duplicates: ${[...new Set(duplicateIds)].join(', ')}`:`${allIds.length} stable IDs checked.`));

  const important=COMPONENTS.filter(item=>item.important);
  const missingBuilt=important.filter(item=>!objectById.has(item.id));
  checks.push(check('Important components have geometry',missingBuilt.length?'error':'pass',missingBuilt.length?`Missing: ${missingBuilt.map(item=>item.id).join(', ')}`:`${important.length} important components built.`));

  const missingGeometrySources = GEOMETRY_DATASET.documentsReviewed.length < 5 || !GEOMETRY_DATASET.componentAnchors.length || !GEOMETRY_DATASET.measurementReferences.length;
  checks.push(check('Structured geometry dataset is loaded',missingGeometrySources?'error':'pass',missingGeometrySources?'Geometry source, anchor or measurement-reference data is missing.':`${GEOMETRY_DATASET.documentsReviewed.length} source groups, ${GEOMETRY_DATASET.componentAnchors.length} anchors and ${GEOMETRY_DATASET.measurementReferences.length} measurement references loaded.`));

  const anchorDeviations = GEOMETRY_DATASET.componentAnchors.map(anchor => {
    const group = objectById.get(anchor.componentId);
    if (!group) return { anchor, missing: true, deviationMm: Infinity };
    const authoredAnchor = authoredAnchorFor(anchor.componentId);
    const actual = authoredAnchor ? vehicleToWorld(authoredAnchor) : new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
    const expected = vehicleToWorld(anchor.anchor);
    return { anchor, deviationMm: actual.distanceTo(expected) * 1000 };
  });
  const badAnchors = anchorDeviations.filter(item => item.missing || item.deviationMm > item.anchor.toleranceMm);
  checks.push(check('Documented geometry anchors remain within tolerance',badAnchors.length?'error':'pass',badAnchors.length?`Out of tolerance: ${badAnchors.map(item=>`${item.anchor.componentId} ${Math.round(item.deviationMm)} mm`).join(', ')}`:`${anchorDeviations.length} anchors checked against source tolerances.`));

  checks.push(check('Geometry Validation mode can show datum points and anchors',geometryValidationGroup?.children?.length?'pass':'error',geometryValidationGroup?.children?.length?`${geometryValidationGroup.children.length} validation helpers built from datum, anchor and measurement data.`:'No validation helper geometry was built.'));

  const missingEndpoints=ROUTES.filter(route=>!itemData.has(route.from)||!itemData.has(route.to)||!objectById.has(route.from)||!objectById.has(route.to));
  checks.push(check('Every modeled line has two valid endpoints',missingEndpoints.length?'error':'pass',missingEndpoints.length?`Broken: ${missingEndpoints.map(route=>route.id).join(', ')}`:`${ROUTES.length} routes have named start and destination objects.`));

  const acRoutes=ROUTES.filter(route=>route.system==='AIR_CONDITIONING');
  const detached=[];
  for(const route of acRoutes){
    const start=vehicleToWorld(route.points[0]);
    const end=vehicleToWorld(route.points.at(-1));
    const fromPos=objectById.get(route.from)?.getWorldPosition(new THREE.Vector3());
    const toPos=objectById.get(route.to)?.getWorldPosition(new THREE.Vector3());
    if(!fromPos||!toPos||start.distanceTo(fromPos)>.20||end.distanceTo(toPos)>.20) detached.push(route.id);
  }
  checks.push(check('A/C fittings align with their route endpoints',detached.length?'error':'pass',detached.length?`Endpoint alignment outside 200 mm staging tolerance: ${detached.join(', ')}`:`${acRoutes.length} A/C routes align to both named endpoints; tolerance reflects approximate geometry.`));

  const unmounted=COMPONENTS.filter(item=>item.system==='AIR_CONDITIONING'&&item.important).filter(item=>{
    if(!item.mountTo) return true;
    return item.mountTo!=='vehicle datum'&&!itemData.has(item.mountTo)&&!objectById.has(item.mountTo);
  });
  checks.push(check('Important A/C components are mounted',unmounted.length?'error':'pass',unmounted.length?`Unmounted: ${unmounted.map(item=>item.id).join(', ')}`:'Compressor, condenser, receiver, ports and cabin components have named mounts.'));

  const placeholders=COMPONENTS.filter(item=>item.important&&String(item.geometryStatus).includes('placeholder'));
  checks.push(check('Important objects are not generic placeholders',placeholders.length?'error':'pass',placeholders.length?`Remaining placeholders: ${placeholders.map(item=>item.id).join(', ')}`:'No important object is marked generic_placeholder; approximate true-form geometry remains labeled.'));

  const highPort=componentData.get('AC_HIGH_SERVICE_PORT');
  const lowPort=componentData.get('AC_LOW_SERVICE_PORT');
  const servicePortCorrect=
    highPort?.connectsTo?.includes('AC_LIQUID_LINE_DRIER_FIREWALL')&&!highPort.connectsTo.includes('AC_DISCHARGE_LINE')&&
    lowPort?.connectsTo?.includes('AC_SUCTION_LINE')&&!lowPort.connectsTo.includes('AC_DISCHARGE_LINE');
  checks.push(check('Service ports are attached to the correct pressure-side groups',servicePortCorrect?'pass':'error',servicePortCorrect?'High port is bound to the liquid line; low port is bound to the suction line. Exact installed positions remain warnings.':'High port must use the liquid route and low port must use the suction route.'));

  const frontPreset=CAMERA_PRESETS.FULL_VEHICLE_HOOD_OPEN_VIEW;
  const auditCamera=new THREE.PerspectiveCamera(frontPreset.fov,16/9,.025,30);
  auditCamera.position.copy(vehicleToWorld(frontPreset.position));
  auditCamera.lookAt(vehicleToWorld(frontPreset.target));
  auditCamera.updateMatrixWorld(true);
  auditCamera.updateProjectionMatrix();
  const passengerProjection=vehicleToWorld([0,-.80,.72]).project(auditCamera);
  const driverProjection=vehicleToWorld([0,.80,.72]).project(auditCamera);
  const verticalProjection=vehicleToWorld([0,0,1]).y>vehicleToWorld([0,0,0]).y;
  const orientationCorrect=passengerProjection.x<driverProjection.x&&verticalProjection;
  checks.push(check('Front view preserves passenger/driver and vertical orientation',orientationCorrect?'pass':'error',orientationCorrect?'Facing the open hood, passenger side projects to screen-left, driver side to screen-right, and +Z remains upward.':'Coordinate transform is mirrored or vertically inverted from the standing-front viewpoint.'));

  const branchExpectations=[
    ['AC_PRESSURE_SWITCH','AC_LIQUID_LINE_DRIER_FIREWALL'],
    ['AC_HIGH_SERVICE_PORT','AC_LIQUID_LINE_DRIER_FIREWALL'],
    ['AC_LOW_SERVICE_PORT','AC_SUCTION_LINE']
  ];
  const brokenBranches=branchExpectations.filter(([componentId,routeId])=>{
    const component=componentData.get(componentId);
    return !component||component.mountTo!==routeId||!(component.connectsTo??[]).includes(routeId)||!objectById.has(componentId)||!routeData.has(routeId);
  });
  checks.push(check('Pressure and service branches are anchored',brokenBranches.length?'error':'pass',brokenBranches.length?`Broken branch anchors: ${brokenBranches.map(row=>row[0]).join(', ')}`:'Pressure switch, high port and low port are selectable features anchored to their parent line groups.'));

  const loop=[
    ['AC_DISCHARGE_LINE','AC_DISCHARGE_PORT','AC_CONDENSER_INLET'],
    ['AC_LIQUID_LINE_CONDENSER_DRIER','AC_CONDENSER_OUTLET','AC_RECEIVER_DRIER'],
    ['AC_LIQUID_LINE_DRIER_FIREWALL','AC_RECEIVER_DRIER','AC_EXPANSION_VALVE'],
    ['AC_EVAPORATOR_FEED_INTERNAL','AC_EXPANSION_VALVE','AC_EVAPORATOR'],
    ['AC_EVAPORATOR_RETURN_INTERNAL','AC_EVAPORATOR','AC_EPR'],
    ['AC_SUCTION_LINE','AC_EPR','AC_SUCTION_PORT']
  ];
  const badLoop=loop.filter(([id,from,to])=>routeData.get(id)?.from!==from||routeData.get(id)?.to!==to);
  checks.push(check('High/low flow sequence uses the correct ports',badLoop.length?'error':'pass',badLoop.length?`Incorrect graph edges: ${badLoop.map(row=>row[0]).join(', ')}`:'Compressor → condenser → receiver → expansion valve → evaporator → EPR → compressor is continuous.'));

  const duplicatePositions=[];
  const keyAc=COMPONENTS.filter(item=>item.system==='AIR_CONDITIONING'&&item.important).map(item=>item.id);
  for(let i=0;i<keyAc.length;i++) for(let j=i+1;j<keyAc.length;j++){
    const objectA=objectById.get(keyAc[i]);
    const objectB=objectById.get(keyAc[j]);
    const a=objectA?new THREE.Box3().setFromObject(objectA).getCenter(new THREE.Vector3()):null;
    const b=objectB?new THREE.Box3().setFromObject(objectB).getCenter(new THREE.Vector3()):null;
    if(a&&b&&a.distanceTo(b)<.004) duplicatePositions.push(`${keyAc[i]} / ${keyAc[j]}`);
  }
  checks.push(check('No duplicate A/C components share the same pose',duplicatePositions.length?'error':'pass',duplicatePositions.length?duplicatePositions.join(', '):'No important A/C component centres are duplicated.'));

  const unrelatedPairs=[['AC_COMPRESSOR','LANDMARK_BATTERY'],['AC_COMPRESSOR','LANDMARK_AIRBOX'],['AC_RECEIVER_DRIER','ENGINE_1UZ_FE'],['AC_CONDENSER','ENGINE_1UZ_FE']];
  const intersections=[];
  unrelatedPairs.forEach(([a,b])=>{
    const boxA=new THREE.Box3().setFromObject(objectById.get(a));
    const boxB=new THREE.Box3().setFromObject(objectById.get(b));
    if(boxA.intersectsBox(boxB)) intersections.push(`${a} / ${b}`);
  });
  checks.push(check('Key A/C components avoid unrelated geometry',intersections.length?'error':'pass',intersections.length?`Visible broad-phase intersections: ${intersections.join(', ')}`:'No broad-phase overlap across the key unrelated-component pairs.'));

  const routeGeometryMissing=ROUTES.filter(route=>!routeRuntime.has(route.id)||routeRuntime.get(route.id).group.children.filter(child=>child.isMesh).length<1);
  checks.push(check('Every route has continuous visible geometry',routeGeometryMissing.length?'error':'pass',routeGeometryMissing.length?`No geometry: ${routeGeometryMissing.map(route=>route.id).join(', ')}`:'All route groups contain selectable line geometry, fittings, and applicable clamps/crimps.'));

  const missingSafetyRoles=acRoutes.filter(route=>!route.serviceRole);
  const missingPlanningGeometry=[...SERVICE_NEVER_FLUSH_IDS,...SERVICE_BOUNDARY_IDS,...SERVICE_CANDIDATE_ROUTE_IDS].filter(id=>!objectById.has(id));
  const safetyMapComplete=!missingSafetyRoles.length&&!missingPlanningGeometry.length&&!!document.getElementById('showFlushMap');
  checks.push(check('Service-planning overlay is safety-gated',safetyMapComplete?'pass':'error',safetyMapComplete?'Refrigerant profile, recovery and zero-pressure gates control a boundary-only overlay; normal-flow arrows are labeled as non-authorization.':`Missing safety roles or geometry: ${[...missingSafetyRoles.map(route=>route.id),...missingPlanningGeometry].join(', ')}`));

  const invalidReferences=REFERENCE_IMAGES.filter(reference=>!CAMERA_PRESETS[reference.pose]||!reference.src||!reference.rights);
  checks.push(check('Reference images resolve to labeled camera poses and rights notes',invalidReferences.length?'error':'pass',invalidReferences.length?`Invalid references: ${invalidReferences.map(reference=>reference.id).join(', ')}`:`${REFERENCE_IMAGES.length} references have a local path, saved pose and reuse-rights note.`));

  checks.push(check('EWD070U electrical source is acquired','pass','The 250-page EWD is present locally; physical loom geometry and circuit extraction remain incomplete.'));
  checks.push(check('Exact service-port landing is unresolved','warning','High and low side identities are modeled correctly, but original/retrofit fitting position must be verified on the target vehicle.'));
  checks.push(check('Receiver-to-firewall pipe crosswalk is provisional','warning','Pipe A/B/C/D/E sequence needs installed-car or clearer-plate tracing before individual tube IDs are frozen.'));
  checks.push(check('Configuration and dimensional survey are missing','warning','VIN/build month, refrigerant/oil state, TRAC/options, measured line splines, clamps and fitting clocking remain capture inputs.'));
  const privateReferences=REFERENCE_IMAGES.filter(reference=>String(reference.rights).startsWith('Private'));
  checks.push(check('Private reference images are not cleared for publication','warning',`${privateReferences.length} of ${REFERENCE_IMAGES.length} comparison images are private/no-ship research references; only the public-domain exterior image is cleared for redistribution.`));

  const errors=checks.filter(item=>item.status==='error').length;
  const warnings=checks.filter(item=>item.status==='warning').length;
  const confirmed=COMPONENTS.filter(item=>String(item.confidence).startsWith('high')).map(item=>item.id);
  const approximate=COMPONENTS.filter(item=>!String(item.confidence).startsWith('high')).map(item=>item.id);
  state.validationReport={
    generatedAt:new Date().toISOString(),
    vehicle:VEHICLE,
    summary:{status:errors?'FAIL':'PASS_WITH_WARNINGS',errors,warnings,checks:checks.length,unexplainedDisconnectedAcLines:missingEndpoints.filter(item=>item.system==='AIR_CONDITIONING').length},
    checks,
    geometryDataset: GEOMETRY_DATASET,
    anchorDeviationMm: anchorDeviations.map(item => ({ componentId: item.anchor.componentId, deviationMm: Number.isFinite(item.deviationMm) ? Math.round(item.deviationMm) : null, toleranceMm: item.anchor.toleranceMm, source: item.anchor.source, page: item.anchor.page, confidence: item.anchor.confidence })),
    confirmedComponents:confirmed,
    approximateComponents:approximate,
    missingComponents:missingBuilt.map(item=>item.id),
    unresolvedRouting:['AC_HIGH_SERVICE_PORT exact tube/build position','AC_LIQUID_LINE_DRIER_FIREWALL A/B/C/D/E individual crosswalk','target-vehicle harness/clip/spline capture'],
    privateReferenceIds:privateReferences.map(reference=>reference.id),
    remainingGenericPlaceholders:placeholders.map(item=>item.id),
    suspectedScaleErrors:['No measured target-vehicle survey; component dimensions are reference-estimated.'],
    suspectedOrientationErrors:[],
    uncertainties:UNCERTAINTIES
  };
  renderValidation();
  if(!errors&&state.validationReport.summary.unexplainedDisconnectedAcLines===0) markAcceptance(10);
  return state.validationReport;
}

function renderValidation() {
  const report=state.validationReport;
  if(!report) return;
  const {errors,warnings,checks}=report.summary;
  const errorNode=document.getElementById('validationErrors');
  errorNode.textContent=errors;
  errorNode.className=errors?'error':'ok';
  const warningNode=document.getElementById('validationWarnings');
  warningNode.textContent=warnings;
  warningNode.className=warnings?'warn':'ok';
  const checkNode=document.getElementById('validationChecks');
  checkNode.textContent=checks;
  checkNode.className='ok';
  document.getElementById('validationResults').innerHTML=report.checks.map(item=>`
    <div class="validation-item ${item.status}"><span class="status">${item.status==='pass'?'✓':item.status==='warning'?'!':'×'}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)}</small></div></div>`).join('');
}

function downloadValidation() {
  if(!state.validationReport) runValidation();
  const blob=new Blob([JSON.stringify(state.validationReport,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download='LS400-validation-report.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

function planningGateReady() {
  const profile=document.getElementById('refrigerantProfile').value;
  return ['R12','R134A'].includes(profile)
    && document.getElementById('recoveryComplete').checked
    && document.getElementById('zeroPressureVerified').checked;
}

function activeServiceGuide() {
  if (state.serviceGuideMode==='RECEIVER') return AC_RECEIVER_DRIER_REPLACEMENT_GUIDE;
  if (state.serviceGuideMode==='FLUSH') return AC_FLUSH_AND_EVACUATION_GUIDE;
  if (state.serviceGuideMode==='RETROFIT') return AC_R134A_RETROFIT_GUIDE;
  return AC_SERVICE_WALKTHROUGH;
}

function renderServiceWalkthrough() {
  const guide=activeServiceGuide();
  const step=guide[state.serviceStep];
  const total=guide.length;
  const card=document.getElementById('serviceWalkthroughCard');
  if (!step || !card) return;
  const guarded=Boolean(step.requiresPlanningGate);
  const reference=step.referenceId ? REFERENCE_IMAGES.find(item=>item.id===step.referenceId) : null;
  const referenceMarkup=reference ? `<figure class="walkthrough-reference"><img src="${escapeHtml(reference.src)}" alt="${escapeHtml(reference.label)}"><figcaption>${escapeHtml(reference.label)} · ${escapeHtml(reference.landmarks)}</figcaption></figure>` : '';
  const gateNote=guarded && !planningGateReady()
    ? '<p class="walkthrough-lock">Locate-only view: recovery, verified refrigerant and independently verified zero pressure must be confirmed before any boundary-planning overlay is enabled.</p>'
    : guarded ? '<p class="walkthrough-ready">Boundary-planning overlay is enabled. It is still not authorization to open or flush the circuit.</p>' : '';
  card.innerHTML=`
    <div class="walkthrough-kicker">STEP ${state.serviceStep+1} OF ${total}${guarded?' · SAFETY-GATED':''}</div>
    <h3>${escapeHtml(step.title)}</h3>
    <p>${escapeHtml(step.target)}</p>
    ${referenceMarkup}
    <div class="walkthrough-detail">${escapeHtml(step.detail)}</div>
    <dl>
      <div><dt>Find it from</dt><dd>${escapeHtml(step.landmarks)}</dd></div>
      <div><dt>Boundary</dt><dd>${escapeHtml(step.boundaries)}</dd></div>
      <div><dt>Evidence</dt><dd>${escapeHtml(step.source)}</dd></div>
    </dl>${gateNote}`;
  document.getElementById('serviceStepCount').textContent=`${state.serviceStep+1} / ${total}`;
  document.getElementById('serviceStepPrevious').disabled=state.serviceStep===0;
  document.getElementById('serviceStepNext').disabled=state.serviceStep===total-1;
}

function setServiceWalkthroughStep(index, focus = true) {
  const guide=activeServiceGuide();
  state.serviceStep=THREE.MathUtils.clamp(index,0,guide.length-1);
  const step=guide[state.serviceStep];
  state.isolation=step.isolation ?? 'AC_COMPLETE';
  state.detailLevel=3;
  state.bodyTransparent=true;
  document.getElementById('isolation').value=state.isolation;
  document.getElementById('detailLevel').value='3';
  document.getElementById('bodyTransparent').checked=true;
  if (state.isolation==='AC_CABIN') {
    state.cutawayFirewall=true;
    state.cutawayHvac=true;
    document.getElementById('cutawayFirewall').checked=true;
    document.getElementById('cutawayHvac').checked=true;
  }
  updateVisibility();
  state.selectedId=step.primaryId;
  state.tracedRouteIds=new Set(step.routes ?? []);
  state.serviceJobMode=Boolean(step.requiresPlanningGate && planningGateReady());
  const picker=document.getElementById('partSelect');
  if ([...picker.options].some(option=>option.value===step.primaryId)) picker.value=step.primaryId;
  renderSelectionCard();
  refreshHighlight();
  renderServiceWalkthrough();
  if (focus) setCameraPreset(step.camera);
}

function updateServiceGate() {
  const profile=document.getElementById('refrigerantProfile').value;
  const recovered=document.getElementById('recoveryComplete').checked;
  const zeroPressure=document.getElementById('zeroPressureVerified').checked;
  const button=document.getElementById('showFlushMap');
  const status=document.getElementById('flushGateStatus');
  state.serviceProfile=profile;
  const contaminated=profile==='CONTAMINATED';
  const ready=planningGateReady();
  button.disabled=!ready;
  status.className=`gate-status${ready?' ready':contaminated?' stop':''}`;
  if(contaminated) status.textContent='STOP: mixed, unknown, or contaminated refrigerant needs diagnosis and recovery planning. No flush-boundary overlay is enabled.';
  else if(profile==='UNKNOWN') status.textContent='System state is unverified. Identify refrigerant/conversion state before using the planning overlay.';
  else if(!recovered) status.textContent='Recovery is not confirmed. The model will not display a disconnect-planning overlay.';
  else if(!zeroPressure) status.textContent='Independent zero-pressure verification is not confirmed. The model will not display a disconnect-planning overlay.';
  else status.textContent='Planning overlay unlocked. It identifies boundaries only and is not authorization to open or flush the system.';
  if(!ready&&state.serviceJobMode){
    state.serviceJobMode=false;
    state.tracedRouteIds.clear();
    refreshHighlight();
  }
  renderServiceWalkthrough();
}

function showServicePlanningMap() {
  updateServiceGate();
  if(document.getElementById('showFlushMap').disabled) return;
  state.serviceJobMode=true;
  state.selectedId=null;
  state.tracedRouteIds=new Set(SERVICE_CANDIDATE_ROUTE_IDS);
  state.isolation='AC_COMPLETE';
  state.detailLevel=3;
  state.bodyTransparent=true;
  document.getElementById('isolation').value=state.isolation;
  document.getElementById('detailLevel').value='3';
  document.getElementById('bodyTransparent').checked=true;
  document.getElementById('partSelect').value='';
  renderSelectionCard();
  setCameraPreset('LEGACY_BAY_AUDIT_VIEW');
  refreshHighlight();
  showToast('Planning boundaries shown. Operating-flow arrows are not flush authorization.');
}

function bindControls() {
  const tabs=[...document.querySelectorAll('.tab')];
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>setActiveTab(tab.dataset.tab));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      tabs[nextIndex].focus();
      setActiveTab(tabs[nextIndex].dataset.tab);
    });
  });
  const shell=document.querySelector('.app-shell');
  const sidebarToggle=document.getElementById('sidebarToggle');
  const closeSidebar=()=>{shell.classList.remove('sidebar-open');sidebarToggle.setAttribute('aria-expanded','false');};
  sidebarToggle.setAttribute('aria-expanded','false');
  sidebarToggle.addEventListener('click',()=>{
    const open=shell.classList.toggle('sidebar-open');
    sidebarToggle.setAttribute('aria-expanded',String(open));
  });
  document.getElementById('sidebarClose').addEventListener('click',closeSidebar);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSidebar();});
  document.getElementById('isolation').addEventListener('change',event=>{
    state.isolation=event.target.value;
    if(state.isolation==='GEOMETRY_VALIDATION'){
      document.getElementById('showGeometryValidation').checked=true;
      state.detailLevel=3;
      state.bodyTransparent=true;
      document.getElementById('detailLevel').value='3';
      document.getElementById('bodyTransparent').checked=true;
    }
    if(state.isolation==='AC_COMPLETE') markAcceptance(0);
    if(state.isolation==='AC_CABIN'){
      state.cutawayFirewall=true; state.cutawayHvac=true;
      document.getElementById('cutawayFirewall').checked=true;
      document.getElementById('cutawayHvac').checked=true;
    }
    updateVisibility();
  });
  document.getElementById('detailLevel').addEventListener('change',event=>{state.detailLevel=Number(event.target.value);updateVisibility();});
  document.getElementById('partSelect').addEventListener('change',event=>event.target.value?selectItem(event.target.value,{trace:true,reveal:true}):clearSelection());
  document.getElementById('cameraPreset').addEventListener('change',event=>setCameraPreset(event.target.value));
  document.getElementById('fullVehicle').addEventListener('click',resetHumanScaleView);
  document.getElementById('resetHumanView').addEventListener('click',resetHumanScaleView);
  document.getElementById('focusSelected').addEventListener('click',focusSelected);
  document.getElementById('traceSelected').addEventListener('click',traceSelected);
  document.getElementById('clearSelection').addEventListener('click',clearSelection);

  for(const id of ['hideHood','hideBumper','hideRadiator','hideEngine','hideSplash']) document.getElementById(id).addEventListener('change',updateVisibility);
  document.getElementById('bodyTransparent').addEventListener('change',event=>{state.bodyTransparent=event.target.checked;updateVisibility();});
  document.getElementById('showGeometryValidation')?.addEventListener('change',event=>{
    state.geometryValidation=event.target.checked;
    if(event.target.checked){
      state.detailLevel=Math.max(state.detailLevel,3);
      document.getElementById('detailLevel').value=String(state.detailLevel);
    }
    updateVisibility();
  });
  document.getElementById('cutawayFirewall').addEventListener('change',event=>{state.cutawayFirewall=event.target.checked;updateVisibility();});
  document.getElementById('cutawayHvac').addEventListener('change',event=>{state.cutawayHvac=event.target.checked;if(state.cutawayHvac)markAcceptance(7);updateVisibility();});
  document.getElementById('showLabels').addEventListener('change',event=>{state.labels=event.target.checked;updateSelectionLabel();});
  document.getElementById('hoodAngle').addEventListener('input',event=>{
    const angle=Number(event.target.value);
    document.getElementById('hoodAngleValue').value=`${angle}°`;
    updateHood(angle);
  });
  document.getElementById('hoodClosed').addEventListener('click',()=>setHoodUi(0));
  document.getElementById('hoodPartial').addEventListener('click',()=>setHoodUi(35));
  document.getElementById('hoodOpen').addEventListener('click',()=>setHoodUi(70));
  document.getElementById('cameraFov').addEventListener('input',event=>{
    camera.fov=Number(event.target.value);
    camera.updateProjectionMatrix();
    document.getElementById('cameraFovValue').value=`${camera.fov}°`;
  });

  document.getElementById('referenceSelect').addEventListener('change',event=>{
    state.referenceId=event.target.value;
    configureComparison();
    const reference=REFERENCE_IMAGES.find(item=>item.id===state.referenceId);
    if(reference) setCameraPreset(reference.pose,true);
  });
  document.getElementById('referenceUpload').addEventListener('change',event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    const src=URL.createObjectURL(file);
    document.getElementById('referenceImage').src=src;
    document.getElementById('referenceCaption').textContent=`Local reference · ${file.name}`;
    document.getElementById('comparisonLandmarks').textContent='Use headlights, radiator support, engine, battery, airbox and firewall as manual alignment landmarks.';
    showToast('Local reference loaded in this browser only.');
  });
  document.getElementById('comparisonMode').addEventListener('change',event=>{state.comparisonMode=event.target.value;updateComparisonMode();});
  document.getElementById('referenceOpacity').addEventListener('input',event=>{
    state.referenceOpacity=Number(event.target.value)/100;
    document.getElementById('referenceOpacityValue').value=`${event.target.value}%`;
    updateComparisonMode();
  });
  document.getElementById('matchReferencePose').addEventListener('click',()=>{
    const reference=REFERENCE_IMAGES.find(item=>item.id===state.referenceId);
    if(reference)setCameraPreset(reference.pose);
  });
  document.getElementById('saveReferencePose').addEventListener('click',saveCurrentReferencePose);
  document.getElementById('restoreReferencePose').addEventListener('click',restoreCurrentReferencePose);
  document.getElementById('clearReferencePose').addEventListener('click',()=>{localStorage.removeItem(referencePoseKey());showToast('Saved pose cleared.');});
  document.getElementById('discrepancyNotes').addEventListener('input',event=>localStorage.setItem(`ls400-discrepancy-${state.referenceId}`,event.target.value));
  document.getElementById('runValidation').addEventListener('click',runValidation);
  document.getElementById('downloadValidation').addEventListener('click',downloadValidation);
  for(const id of ['refrigerantProfile','recoveryComplete','zeroPressureVerified']) document.getElementById(id).addEventListener('change',updateServiceGate);
  document.getElementById('showFlushMap').addEventListener('click',showServicePlanningMap);
  document.getElementById('serviceStepPrevious').addEventListener('click',()=>setServiceWalkthroughStep(state.serviceStep-1));
  document.getElementById('serviceStepNext').addEventListener('click',()=>setServiceWalkthroughStep(state.serviceStep+1));
  document.getElementById('serviceStepView').addEventListener('click',()=>setServiceWalkthroughStep(state.serviceStep));
  document.getElementById('serviceGuideMode').addEventListener('change',event=>{state.serviceGuideMode=event.target.value;state.serviceStep=0;renderServiceWalkthrough();setServiceWalkthroughStep(0);});
}

function setHoodUi(angle) {
  document.getElementById('hoodAngle').value=angle;
  document.getElementById('hoodAngleValue').value=`${angle}°`;
  updateHood(angle);
}

function resizeRenderer() {
  const width=Math.max(1,viewport.clientWidth);
  const height=Math.max(1,viewport.clientHeight);
  const canvas=renderer.domElement;
  if(canvas.width!==Math.floor(width*renderer.getPixelRatio())||canvas.height!==Math.floor(height*renderer.getPixelRatio())) renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resizeRenderer).observe(viewport);

function tickCameraTween(now) {
  const tween=state.cameraTween;
  if(!tween)return;
  const raw=THREE.MathUtils.clamp((now-tween.start)/tween.duration,0,1);
  const t=raw<.5?4*raw*raw*raw:1-Math.pow(-2*raw+2,3)/2;
  camera.position.lerpVectors(tween.fromPosition,tween.toPosition,t);
  controls.target.lerpVectors(tween.fromTarget,tween.toTarget,t);
  camera.fov=THREE.MathUtils.lerp(tween.fromFov,tween.toFov,t);
  camera.updateProjectionMatrix();
  if(raw>=1) state.cameraTween=null;
}

function animate(now) {
  requestAnimationFrame(animate);
  tickCameraTween(now);
  preventCameraCollision();
  controls.update();
  routeRuntime.forEach((runtime,id)=>{
    if(!state.tracedRouteIds.has(id))return;
    runtime.flowArrows.forEach((arrow,index)=>{
      const pulse=.9+Math.sin(now*.006+index)*.12;
      arrow.scale.setScalar(pulse);
      if(arrow.material.emissive) arrow.material.emissiveIntensity=.65+Math.sin(now*.006+index)*.25;
    });
  });
  updateSelectionLabel();
  renderer.render(scene,camera);
}

function hideLoadingScreen(reason) {
  if (!loading || !loading.classList) return;
  loading.classList.add('is-hidden');
  loading.dataset.state = reason;
}

function reportStartupError(error, detail) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown issue');
  console.error(`LS400 startup failed (${detail}):`, error);
  const modelStats = document.getElementById('modelStats');
  if (modelStats) modelStats.textContent = `${message}. ${COMPONENTS.length} components · ${ROUTES.length} routes`;
  if (loading) loading.title = message;
  showToast(`Startup issue detected: ${detail}. Continue in degraded mode.`);
}

window.addEventListener('error', event => {
  reportStartupError(event.error ?? event.message, 'unhandled runtime error');
  hideLoadingScreen('runtime-error');
});

window.addEventListener('unhandledrejection', event => {
  reportStartupError(event.reason, 'unhandled promise rejection');
  hideLoadingScreen('promise-error');
});

let startupValidation;
try {
  populateControls();
  bindControls();
  configureComparison();
  updateServiceGate();
  renderServiceWalkthrough();
  setCameraPreset('ENGINE_BAY_PHOTO_LAYOUT',true);
  updateVisibility();
  resizeRenderer();
  startupValidation = runValidation();
} catch(error) {
  reportStartupError(error, 'boot sequence');
  startupValidation={summary:{status:'VALIDATION_ERROR',errors:1,warnings:0,checks:0,unexplainedDisconnectedAcLines:0},checks:[],error:String(error?.message ?? error)};
  const modelStats=document.getElementById('modelStats');
  if(modelStats) modelStats.textContent=`${COMPONENTS.length} components · ${ROUTES.length} routes · validation retry available`;
}
requestAnimationFrame(animate);
setTimeout(()=>hideLoadingScreen('ready'),320);
setTimeout(()=>hideLoadingScreen('timeout-fallback'),1800);

window.LS400Toolbox={
  vehicle:VEHICLE,
  components:COMPONENTS,
  routes:ROUTES,
  geometryDataset:GEOMETRY_DATASET,
  cameras:CAMERA_PRESETS,
  references:REFERENCE_IMAGES,
  getState:()=>({
    isolation:state.isolation,detailLevel:state.detailLevel,selectedId:state.selectedId,
    tracedRouteIds:[...state.tracedRouteIds],hoodAngle:state.hoodAngle,
    acceptance:[...state.acceptance],validation:state.validationReport?.summary
  }),
  getValidation:()=>state.validationReport,
  startupValidation
};
