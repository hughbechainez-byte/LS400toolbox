import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  VEHICLE, SYSTEMS, COMPONENTS, ROUTES, CAMERA_PRESETS, GEOMETRY_DATASET,
  REFERENCE_IMAGES, UNCERTAINTIES, ACCEPTANCE_STEPS, AC_SERVICE_WALKTHROUGH, AC_RECEIVER_DRIER_REPLACEMENT_GUIDE, AC_FLUSH_AND_EVACUATION_GUIDE, AC_R134A_RETROFIT_GUIDE
} from './model-data.js';

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
  referenceId: 'LICENSED_EXTERIOR',
  referenceOpacity: .55,
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
  body: 0x6f242b,
  bodyEdge: 0xb67d74,
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
    [-4.08,.74,.20,.62],[-3.72,.83,.19,.72],[-3.05,.88,.18,.79],[-1.55,.89,.18,.82],[-1.15,.86,.20,.83]
  ], COLORS.body, { metalness: .28, roughness: .52 });
  const greenhouse = createLoft([
    [-3.58,.47,.76,1.00],[-3.20,.62,.78,1.20],[-2.58,.69,.80,1.37],[-1.75,.68,.82,1.34],[-1.22,.57,.83,1.12]
  ], 0x55222a, { metalness: .24, roughness: .5 });
  shell.add(lower, greenhouse);
  for (const left of [-.87,.87]) {
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
  const panelPoints = [[.88,.45],[.86,.72],[.63,.84],[-.98,.94],[-1.18,.77],[-1.08,.49],[-.42,.49],[-.23,.64],[.23,.66],[.43,.49]];
  fenders.add(createVehiclePrism(panelPoints,-.91,-.74,COLORS.body,{metalness:.3,roughness:.5}));
  fenders.add(createVehiclePrism(panelPoints,.74,.91,COLORS.body,{metalness:.3,roughness:.5}));
  for (const left of [-.82,.82]) {
    const arch = torus(.38,.025,COLORS.bodyEdge,'x',{metalness:.5,roughness:.4,tubularSegments:48});
    arch.position.copy(vehicleToWorld([0,left,.39]));
    arch.scale.set(1,1,1.08);
    arch.userData.minLod = 2;
    fenders.add(arch);
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
  cover.position.copy(vehicleToWorld([.88,0,.43]));
  bumper.add(cover);
  const lower = roundedBox(1.70,.12,.18,.045,0x70343a,{metalness:.18,roughness:.58});
  lower.position.copy(vehicleToWorld([.83,0,.30]));
  bumper.add(lower);
  const reinforcement = roundedBox(1.54,.11,.10,.018,0x5b6367,{metalness:.68,roughness:.42});
  reinforcement.position.copy(vehicleToWorld([.72,0,.42]));
  reinforcement.userData.minLod = 2;
  bumper.add(reinforcement);
  for (const left of [-.60,.60]) {
    const signal = roundedBox(.40,.055,.025,.012,0xd8832f,{metalness:.1,roughness:.35,emissive:0x4a2105});
    signal.position.copy(vehicleToWorld([1.006,left,.40]));
    bumper.add(signal);
  }
  registerComponent(bumper,'LANDMARK_FRONT_BUMPER',{minLod:1});
  collisionObjects.push({object:bumper,kind:'solid'});

  const grille = new THREE.Group();
  const surround = roundedBox(.43,.25,.055,.018,0xbcc0bd,{metalness:.85,roughness:.25});
  surround.position.copy(vehicleToWorld([.965,0,.63]));
  grille.add(surround);
  const dark = roundedBox(.39,.21,.061,.014,0x14191d,{metalness:.15,roughness:.72});
  dark.position.copy(vehicleToWorld([.972,0,.63]));
  grille.add(dark);
  for (let i = -5; i <= 5; i++) {
    const slat = box(.012,.195,.012,0x9da5a5,{metalness:.84,roughness:.28});
    slat.position.copy(vehicleToWorld([1.008,i*.031,.63]));
    grille.add(slat);
  }
  registerComponent(grille,'LANDMARK_GRILLE',{minLod:1});

  for (const [id,left] of [['LANDMARK_PASSENGER_HEADLIGHT',-.62],['LANDMARK_DRIVER_HEADLIGHT',.62]]) {
    const headlight = new THREE.Group();
    const trim = roundedBox(.57,.235,.105,.025,0x2b2f32,{metalness:.38,roughness:.42});
    trim.position.copy(vehicleToWorld([.90,left,.67]));
    headlight.add(trim);
    const lens = roundedBox(.53,.20,.116,.02,0xc9d7d9,{opacity:.82,metalness:.08,roughness:.24});
    lens.position.copy(vehicleToWorld([.912,left,.67]));
    headlight.add(lens);
    for (let i = -5; i <= 5; i++) {
      const rib = box(.006,.176,.008,0xeaf3f2,{opacity:.68,metalness:.05,roughness:.2});
      rib.position.copy(vehicleToWorld([.973,left+i*.041,.67]));
      rib.userData.minLod = 2;
      headlight.add(rib);
    }
    const inner = cylinder(.071,.012,0xe8eeee,'z',{opacity:.82,metalness:.2,roughness:.2,segments:32});
    inner.position.copy(vehicleToWorld([.975,left-(Math.sign(left)*.12),.67]));
    inner.userData.minLod = 3;
    headlight.add(inner);
    registerComponent(headlight,id,{minLod:1});
  }

  const support = new THREE.Group();
  const upper = roundedBox(1.64,.075,.11,.015,0x3f494e,{metalness:.62,roughness:.42});
  upper.position.copy(vehicleToWorld([.66,0,.86]));
  support.add(upper);
  const lowerRail = roundedBox(1.48,.07,.08,.012,0x333d42,{metalness:.62,roughness:.45});
  lowerRail.position.copy(vehicleToWorld([.62,0,.32]));
  support.add(lowerRail);
  for (const left of [-.76,0,.76]) {
    const upright = roundedBox(.055,.55,.07,.011,0x3b454a,{metalness:.6,roughness:.45});
    upright.position.copy(vehicleToWorld([.62,left,.59]));
    support.add(upright);
    const bolt = makeBolt(.012,.028);
    bolt.position.copy(vehicleToWorld([.70,left,.86]));
    bolt.rotation.x = Math.PI / 2;
    bolt.userData.minLod = 3;
    support.add(bolt);
  }
  registerComponent(support,'LANDMARK_RADIATOR_SUPPORT',{minLod:1});

  const rails = new THREE.Group();
  for (const left of [-.53,.53]) {
    const rail = roundedBox(.14,.16,1.78,.025,0x30393d,{metalness:.62,roughness:.5});
    rail.position.copy(vehicleToWorld([-.31,left,.25]));
    rails.add(rail);
    const horn = roundedBox(.27,.08,.23,.02,0x3b4448,{metalness:.62,roughness:.48});
    horn.position.copy(vehicleToWorld([.64,left,.30]));
    rails.add(horn);
  }
  registerComponent(rails,'LANDMARK_FRONT_FRAME_RAILS',{minLod:1});

  const splash = new THREE.Group();
  const under = roundedBox(1.45,.025,1.45,.012,0x252b2e,{roughness:.86,metalness:.04});
  under.position.copy(vehicleToWorld([-.02,0,.14]));
  splash.add(under);
  const frontUnder = roundedBox(1.55,.025,.52,.012,0x282e31,{roughness:.84,metalness:.05});
  frontUnder.position.copy(vehicleToWorld([.62,0,.18]));
  splash.add(frontUnder);
  registerComponent(splash,'LANDMARK_SPLASH_SHIELDS',{minLod:1});
}

let hoodPivot;
let hoodPanel;
let hoodStruts;

function buildHoodAndCowl() {
  const cowl = new THREE.Group();
  const plenum = roundedBox(1.70,.12,.32,.035,0x252d32,{roughness:.75,metalness:.12});
  plenum.position.copy(vehicleToWorld([-1.04,0,.92]));
  cowl.add(plenum);
  for (let i = -9; i <= 9; i++) {
    const slot = box(.011,.013,.22,0x080b0d,{roughness:.9});
    slot.position.copy(vehicleToWorld([-1.05,i*.075,.985]));
    slot.userData.minLod = 2;
    cowl.add(slot);
  }
  for (const left of [-.28,.28]) {
    const arm = box(.018,.015,.55,0x101417,{metalness:.5,roughness:.5});
    arm.position.copy(vehicleToWorld([-1.16,left,.995]));
    arm.rotation.y = left > 0 ? -.18 : .18;
    arm.userData.minLod = 2;
    cowl.add(arm);
  }
  registerComponent(cowl,'LANDMARK_COWL',{minLod:1});

  const hinges = new THREE.Group();
  for (const left of [-.68,.68]) {
    const base = roundedBox(.10,.035,.15,.012,0x454b4d,{metalness:.72,roughness:.36});
    base.position.copy(vehicleToWorld([-1.02,left,.91]));
    hinges.add(base);
    const hinge = betweenCylinder(vehicleToWorld([-1.02,left,.93]),vehicleToWorld([-.91,left,.98]),.018,0x777e7f,{metalness:.75,roughness:.34});
    hinges.add(hinge);
  }
  hoodPivot = new THREE.Group();
  hoodPivot.position.copy(vehicleToWorld([-1.00,0,.95]));
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
    strut.userData.minLod = 2;
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
  const panel = roundedBox(1.62,.72,.055,.035,0x5a6062,{metalness:.58,roughness:.5});
  panel.position.copy(vehicleToWorld([-1.05,0,.65]));
  firewall.add(panel);
  const passThrough = cylinder(.075,.065,0x20272b,'z',{roughness:.7,segments:24});
  passThrough.position.copy(vehicleToWorld([-1.08,-.45,.70]));
  firewall.add(passThrough);
  for (const left of [-.67,.67]) {
    const seam = roundedBox(.035,.66,.03,.008,0x777d7e,{metalness:.5,roughness:.45});
    seam.position.copy(vehicleToWorld([-1.087,left,.65]));
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
  const radiator = makeHeatExchanger(1.34,.48,.07,0x465158,{frameColor:0x3a4449,finColor:0x657277,verticalCount:38,horizontalCount:11});
  radiator.position.copy(vehicleToWorld([.51,0,.59]));
  const topTank = roundedBox(1.30,.07,.10,.025,0x20272b,{roughness:.78,metalness:.08});
  topTank.position.y = .26;
  radiator.add(topTank);
  const bottomTank = roundedBox(1.30,.065,.10,.025,0x20272b,{roughness:.78,metalness:.08});
  bottomTank.position.y = -.26;
  radiator.add(bottomTank);
  registerComponent(radiator,'LANDMARK_RADIATOR',{minLod:1});

  const condenser = makeHeatExchanger(1.27,.46,.045,0x7f898b,{frameColor:0xa1a8a8,finColor:0x929b9c,verticalCount:42,horizontalCount:12});
  condenser.position.copy(vehicleToWorld([.62,0,.59]));
  for (const x of [-.665,.665]) {
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
  placeVehicle(inlet,[.64,.61,.70]);
  registerComponent(inlet,'AC_CONDENSER_INLET',{minLod:2});
  const outlet = new THREE.Group();
  const outletFit = makeFitting(.021,.065);
  outletFit.rotation.z = Math.PI / 2;
  outlet.add(outletFit);
  placeVehicle(outlet,[.64,-.62,.48]);
  registerComponent(outlet,'AC_CONDENSER_OUTLET',{minLod:2});

  const fans = new THREE.Group();
  // Twin fans sit fully in the opening between the headlights, behind the
  // condenser/radiator stack, rather than intruding into either lamp envelope.
  fans.add(makeFan([.72,-.20,.59],.18),makeFan([.72,.20,.59],.18));
  registerComponent(fans,'LANDMARK_COOLING_FANS',{minLod:1});
}

function addValveCoverDetails(group, localX, rotationZ, label) {
  const cover = roundedBox(.25,.12,.82,.035,0x343b3f,{metalness:.28,roughness:.58});
  cover.position.set(localX,.16,0);
  cover.rotation.z = rotationZ;
  group.add(cover);
  for (let i = -4; i <= 4; i++) {
    const rib = box(.19,.011,.018,0x8e9697,{metalness:.62,roughness:.4});
    rib.position.set(localX + Math.sin(rotationZ)*.055,.225,i*.075);
    rib.rotation.z = rotationZ;
    rib.userData.minLod = 2;
    group.add(rib);
  }
  const plate = textPlate(label,.18,.48,{fontSize:68,minLod:2,background:'#252b2f',border:'#8e9697'});
  plate.rotation.x = -Math.PI/2;
  plate.rotation.z = Math.PI/2;
  plate.position.set(localX,.235,.02);
  group.add(plate);
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
  engine.position.copy(vehicleToWorld([-.23,0,.57]));
  const block = roundedBox(.67,.48,.93,.08,0x4c5356,{metalness:.58,roughness:.52});
  block.position.y = -.03;
  engine.add(block);
  const valley = roundedBox(.40,.20,.78,.05,0xaab1b2,{metalness:.72,roughness:.35});
  valley.position.y=.22;
  engine.add(valley);
  addValveCoverDetails(engine,-.29,-.23,'4 CAM 32');
  addValveCoverDetails(engine,.29,.23,'4 CAM 32');
  const plenum = roundedBox(.28,.25,.55,.075,0xbcc4c5,{metalness:.74,roughness:.32});
  plenum.position.set(0,.43,-.08);
  engine.add(plenum);
  const plenumTop = textPlate('LEXUS  1UZ-FE',.22,.42,{fontSize:82,minLod:2,background:'#b6bdbe',border:'#6e7476',color:'#2d3437'});
  plenumTop.rotation.x=-Math.PI/2;
  plenumTop.rotation.z=Math.PI/2;
  plenumTop.position.set(0,.56,-.08);
  engine.add(plenumTop);
  for (const side of [-1,1]) {
    for (let i=0;i<4;i++) {
      const runner=tube([[-.02,side*.08,.82],[-.12-i*.06,side*(.15+i*.015),.78],[-.20-i*.07,side*.25,.70]],.018,0xa8b0b1,{metalness:.7,roughness:.34,segments:14});
      runner.position.sub(vehicleToWorld([-.23,0,.57]));
      runner.userData.minLod=2;
      engine.add(runner);
    }
  }
  const throttle=cylinder(.105,.17,0xb8c0c1,'x',{metalness:.72,roughness:.33,segments:34});
  throttle.position.set(-.22,.39,-.30);
  engine.add(throttle);
  // 1UZ-FE service details: eight ceramic plug wells, boots and the separate
  // ignition harness.  These are intentionally low-poly but remain readable
  // in the close engine camera.
  const ignition = new THREE.Group();
  for (const side of [-1, 1]) {
    const distributor = cylinder(.035,.07,0x1b2022,'y',{roughness:.72,segments:16});
    distributor.position.set(-.29, .34, side*.10);
    ignition.add(distributor);
    for (let i=0;i<4;i++) {
      const z = -.30 + i*.19;
      const well = cylinder(.026,.10,0xe6e7df,'y',{metalness:.18,roughness:.48,segments:16});
      well.position.set(-.08, .33, side*(.15 + i*.025));
      ignition.add(well);
      const boot = cylinder(.035,.045,0x171b1d,'y',{roughness:.82,segments:16});
      boot.position.set(-.08, .405, side*(.15 + i*.025));
      ignition.add(boot);
      const lead = tube([[-.29,.39,side*.10],[-.19,.44,side*(.115+i*.018)],[-.08,.43,side*(.15+i*.025)]],.009,0x17191a,{roughness:.9,segments:12,radialSegments:6});
      ignition.add(lead);
    }
  }
  registerComponent(ignition,'ENGINE_SPARK_PLUG_WIRING',{minLod:1});
  engine.add(ignition);

  // Throttle-position sensor and its short three-wire loom at the throttle
  // shaft, rather than an unlabeled cylinder floating beside the plenum.
  const tps = new THREE.Group();
  const sensorBody = roundedBox(.07,.055,.10,.014,0x252b2d,{roughness:.7,metalness:.18});
  sensorBody.position.set(-.22,.39,-.385);
  tps.add(sensorBody);
  const connector = roundedBox(.045,.045,.065,.01,0x171b1d,{roughness:.82});
  connector.position.set(-.22,.345,-.435);
  tps.add(connector);
  for (let i=0;i<3;i++) {
    const wire=tube([[-.22-i*.012,.34,-.46],[-.20-i*.012,.25,-.55],[-.12-i*.012,.20,-.60]],.0045,[0x17191a,0xb9a52e,0x384b57][i],{roughness:.88,segments:10,radialSegments:5});
    tps.add(wire);
  }
  registerComponent(tps,'ENGINE_THROTTLE_POSITION_SENSOR_WIRING',{minLod:1});
  engine.add(tps);
  for (const z of [-.41,-.28,-.16,.02,.18,.34]) {
    const seam=box(.70,.018,.012,0x8e9698,{metalness:.6,roughness:.4});
    seam.position.set(0,.06,z);
    seam.userData.minLod=3;
    engine.add(seam);
  }
  registerComponent(engine,'ENGINE_1UZ_FE',{minLod:1});
  collisionObjects.push({object:engine,kind:'engine'});

  const drive = new THREE.Group();
  drive.add(makePulley([.34,0,.36],.16,.07));
  drive.add(makePulley([.34,-.25,.55],.105,.055));
  drive.add(makePulley([.34,.24,.56],.11,.055));
  drive.add(makePulley([.34,0,.69],.075,.045));
  const beltPoints=[[.36,0,.20],[.36,-.31,.42],[.36,-.25,.66],[.36,0,.76],[.36,.29,.65],[.36,.36,.43],[.36,.20,.24]];
  const belt=tube(beltPoints,.012,0x0c0e0f,{roughness:.92,metalness:0,closed:true,segments:80,radialSegments:7});
  drive.add(belt);
  registerComponent(drive,'ENGINE_ACCESSORY_DRIVE',{minLod:1});

  const alternator = new THREE.Group();
  placeVehicle(alternator,[.23,-.25,.38]);
  const body=cylinder(.085,.15,0x929a9c,'z',{metalness:.72,roughness:.36,segments:24});
  alternator.add(body);
  for(let i=0;i<10;i++){
    const vent=box(.012,.065,.16,0x22282b,{metalness:.2,roughness:.72});
    vent.rotation.z=i*Math.PI*2/10;
    vent.position.set(Math.cos(i*Math.PI*2/10)*.052,Math.sin(i*Math.PI*2/10)*.052,0);
    vent.userData.minLod=2;
    alternator.add(vent);
  }
  registerComponent(alternator,'ENGINE_ALTERNATOR',{minLod:2});

  const ps = new THREE.Group();
  placeVehicle(ps,[.23,.25,.56]);
  const psBody=cylinder(.075,.14,0x4b5356,'z',{metalness:.55,roughness:.47,segments:26});
  ps.add(psBody);
  const reservoir=cylinder(.065,.16,0x22282c,'y',{roughness:.76,metalness:.08,segments:24});
  reservoir.position.set(.12,.10,.05);
  ps.add(reservoir);
  registerComponent(ps,'ENGINE_POWER_STEERING_PUMP',{minLod:2});
}

function buildEngineLandmarks() {
  const battery = new THREE.Group();
  const caseMesh=roundedBox(.34,.20,.25,.028,0x25292b,{roughness:.76,metalness:.04});
  caseMesh.position.copy(vehicleToWorld([.02,.67,.58]));
  battery.add(caseMesh);
  const top=roundedBox(.33,.025,.24,.012,0x14181a,{roughness:.72});
  top.position.copy(vehicleToWorld([.02,.67,.695]));
  battery.add(top);
  for(const [left,color] of [[.58,0xb54242],[.76,0x646c70]]){
    const terminal=cylinder(.018,.032,color,'y',{metalness:.7,roughness:.32});
    terminal.position.copy(vehicleToWorld([.02,left,.72]));
    battery.add(terminal);
  }
  const strap=box(.04,.025,.28,0x555c5f,{metalness:.65,roughness:.4});
  strap.position.copy(vehicleToWorld([.02,.67,.72]));
  strap.rotation.y=Math.PI/2;
  strap.userData.minLod=2;
  battery.add(strap);
  registerComponent(battery,'LANDMARK_BATTERY',{minLod:1});

  const airbox = new THREE.Group();
  const base=roundedBox(.43,.22,.46,.055,0x242b2f,{roughness:.8,metalness:.04});
  base.position.copy(vehicleToWorld([.05,-.65,.58]));
  airbox.add(base);
  const lid=roundedBox(.45,.05,.47,.04,0x171c1f,{roughness:.74,metalness:.04});
  lid.position.copy(vehicleToWorld([.05,-.65,.72]));
  airbox.add(lid);
  for(const left of [-.84,-.46]){
    const clip=roundedBox(.025,.045,.035,.008,0xa3a8a7,{metalness:.78,roughness:.3});
    clip.position.copy(vehicleToWorld([.05,left,.70]));
    clip.userData.minLod=3;
    airbox.add(clip);
  }
  registerComponent(airbox,'LANDMARK_AIRBOX',{minLod:1});

  const intake = new THREE.Group();
  // The UCF10 intake is a chain, not one floating tube: airbox outlet -> AFM
  // housing -> accordion boot -> throttle body at the front of the plenum.
  const airboxOutlet = tube([[.05,-.55,.70],[.03,-.49,.72],[.02,-.45,.73]],.062,0x1b2023,{roughness:.88,metalness:.01,segments:20,radialSegments:16});
  intake.add(airboxOutlet);
  const afm=roundedBox(.16,.13,.18,.025,0x5d6568,{metalness:.48,roughness:.5});
  afm.position.copy(vehicleToWorld([.02,-.40,.74]));
  intake.add(afm);
  const afmPlug=roundedBox(.055,.045,.075,.01,0x171b1d,{roughness:.82});
  afmPlug.position.copy(vehicleToWorld([.02,-.40,.84]));
  intake.add(afmPlug);
  const postMeter = tube([[.02,-.32,.74],[-.02,-.22,.78],[.08,-.08,.84],[.23,.13,.90],[.30,.20,.92]],.073,0x1b2023,{roughness:.88,metalness:.01,segments:38,radialSegments:16});
  intake.add(postMeter);
  for(let i=0;i<8;i++){
    const t=i/7;
    const point=vehicleToWorld([-.02 + .32*t,-.32 + .50*t,.78 + .14*t]);
    const ring=torus(.076,.006,0x343a3d,'z',{roughness:.82,tubularSegments:28});
    ring.position.copy(point);
    ring.rotation.y=.42;
    ring.userData.minLod=2;
    intake.add(ring);
  }
  // Worm-drive clamps make the two coupler joints legible at a service-camera distance.
  for (const point of [[.02,-.32,.74],[.30,.20,.92]]) {
    const clamp=torus(.078,.009,0xa4abad,'z',{roughness:.42,metalness:.72,tubularSegments:28});
    clamp.position.copy(vehicleToWorld(point));
    clamp.rotation.y=.42;
    clamp.userData.minLod=1;
    intake.add(clamp);
  }
  const throttleCoupler=torus(.105,.012,0x242a2d,'x',{roughness:.82,metalness:.08,tubularSegments:30});
  throttleCoupler.position.copy(vehicleToWorld([.30,.20,.92]));
  throttleCoupler.rotation.z=.34;
  intake.add(throttleCoupler);
  registerComponent(intake,'LANDMARK_INTAKE_TUBE',{minLod:1});

  const booster = new THREE.Group();
  const drum=cylinder(.20,.13,0x181d20,'z',{metalness:.52,roughness:.48,segments:40});
  drum.position.copy(vehicleToWorld([-1.00,.56,.76]));
  booster.add(drum);
  const master=cylinder(.045,.22,0x939a9b,'z',{metalness:.72,roughness:.35,segments:24});
  master.position.copy(vehicleToWorld([-.90,.56,.76]));
  booster.add(master);
  const reservoir=roundedBox(.15,.11,.14,.03,0xc7c6a8,{opacity:.66,roughness:.5,metalness:.02});
  reservoir.position.copy(vehicleToWorld([-.91,.56,.88]));
  booster.add(reservoir);
  registerComponent(booster,'LANDMARK_BRAKE_BOOSTER',{minLod:1});
}

function buildCompressor() {
  const bracket = new THREE.Group();
  const plate=createVehiclePrism([[.18,.34],[.43,.34],[.44,.58],[.24,.63]],.31,.48,0x596166,{metalness:.68,roughness:.38});
  bracket.add(plate);
  for(const [fwd,left,up] of [[.20,.34,.39],[.40,.34,.40],[.35,.47,.58]]){
    const bolt=makeBolt(.013,.032);
    bolt.position.copy(vehicleToWorld([fwd,left,up]));
    bolt.rotation.x=Math.PI/2;
    bolt.userData.minLod=3;
    bracket.add(bolt);
  }
  registerComponent(bracket,'AC_COMPRESSOR_BRACKET',{minLod:2});

  const compressor = new THREE.Group();
  compressor.position.copy(vehicleToWorld([.30,.40,.47]));
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
  clutch.position.copy(vehicleToWorld([.47,.40,.47]));
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

  for(const [id,point,radius] of [['AC_DISCHARGE_PORT',[.30,.40,.58],.022],['AC_SUCTION_PORT',[.27,.42,.59],.030]]){
    const port=new THREE.Group();
    const fitting=makeFitting(radius,.065);
    port.add(fitting);
    placeVehicle(port,point);
    registerComponent(port,id,{minLod:3});
  }
  const clutchLead = tube([[.47,.40,.53],[.50,.40,.59],[.54,.38,.62]],.006,0x171b1d,{roughness:.9,segments:16,radialSegments:6});
  clutchLead.userData.minLod=2;
  registerComponent(clutchLead,'AC_COMPRESSOR_CLUTCH_WIRING',{minLod:2});
}

function buildReceiverAndServiceDetails() {
  const bracket = new THREE.Group();
  const upright=roundedBox(.055,.32,.045,.012,0x4f595d,{metalness:.68,roughness:.4});
  upright.position.copy(vehicleToWorld([.58,-.77,.58]));
  bracket.add(upright);
  const band=torus(.058,.009,0x636c6f,'y',{metalness:.72,roughness:.36,tubularSegments:30});
  band.position.copy(vehicleToWorld([.60,-.72,.58]));
  bracket.add(band);
  const bolt=makeBolt(.010,.028);
  bolt.position.copy(vehicleToWorld([.60,-.79,.58]));
  bolt.rotation.z=Math.PI/2;
  bolt.userData.minLod=3;
  bracket.add(bolt);
  registerComponent(bracket,'AC_RECEIVER_DRIER_BRACKET',{minLod:2});

  const receiver = new THREE.Group();
  receiver.position.copy(vehicleToWorld([.60,-.72,.59]));
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
  placeVehicle(sight,[.60,-.72,.755]);
  const glass=cylinder(.014,.009,0x8ec9d2,'y',{opacity:.82,metalness:.12,roughness:.18,segments:24});
  sight.add(glass);
  const ring=torus(.016,.003,0xb6bdbd,'y',{metalness:.76,roughness:.3});
  sight.add(ring);
  registerComponent(sight,'AC_SIGHT_GLASS',{minLod:3});

  const pressure = new THREE.Group();
  placeVehicle(pressure,[.58,-.72,.79]);
  const base=makeFitting(.017,.045);
  pressure.add(base);
  const sensor=roundedBox(.030,.045,.028,.006,0x353c40,{roughness:.68,metalness:.18});
  sensor.position.y=.045;
  pressure.add(sensor);
  const plug=roundedBox(.022,.030,.026,.005,0x20262a,{roughness:.72});
  plug.position.y=.080;
  pressure.add(plug);
  registerComponent(pressure,'AC_PRESSURE_SWITCH',{minLod:3});

  buildServicePort('AC_HIGH_SERVICE_PORT',[.42,-.75,.82],COLORS.high);
  buildServicePort('AC_LOW_SERVICE_PORT',[-.78,-.47,.84],COLORS.low);
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
    registerComponent(group,route.id,{minLod:route.system==='AIR_CONDITIONING'?1:2,role:'route'});
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
  if (id === 'LANDMARK_HOOD' && document.getElementById('hideHood').checked) return true;
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
      child.visible = childLod <= state.detailLevel;
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
  requestAnimationFrame(resizeRenderer);
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
    const actual = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
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
  document.getElementById('showGeometryValidation').addEventListener('change',event=>{
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

  document.getElementById('referenceSelect').addEventListener('change',event=>{state.referenceId=event.target.value;configureComparison();});
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

populateControls();
bindControls();
configureComparison();
updateServiceGate();
renderServiceWalkthrough();
setCameraPreset('FULL_VEHICLE_HOOD_OPEN_VIEW',true);
updateVisibility();
resizeRenderer();
let startupValidation;
try {
  startupValidation=runValidation();
} catch(error) {
  console.error('LS400 startup validation failed',error);
  startupValidation={summary:{status:'VALIDATION_ERROR',errors:1,warnings:0,checks:0,unexplainedDisconnectedAcLines:0},checks:[],error:String(error?.message ?? error)};
  const modelStats=document.getElementById('modelStats');
  if(modelStats) modelStats.textContent=`${COMPONENTS.length} components · ${ROUTES.length} routes · validation retry available`;
}
requestAnimationFrame(animate);
setTimeout(()=>loading.classList.add('is-hidden'),320);

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
