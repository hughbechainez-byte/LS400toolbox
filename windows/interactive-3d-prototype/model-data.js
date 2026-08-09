import { MODEL_FOUNDATION_METRES } from './model-foundation.generated.js?foundation=15f305d514141ee6';

export const VEHICLE = {
  name: '1990 Lexus LS 400 (UCF10)',
  units: 'metres (generated from the shared millimetre manifest with an explicit x0.001 conversion)',
  coordinateContract: '+X vehicle forward, +Y vehicle-left (driver side), +Z up; canonical source units are millimetres',
  dimensions: MODEL_FOUNDATION_METRES.vehicleDimensions,
  origin: 'front axle centre projected to the ground plane',
  configuration: 'Target: December 1989 U.S. UCF10L-AEPGKA, CA emissions, air suspension, original R12 context; VIN and retrofit state remain unverified'
};

// Compact reconstruction manifest for the hood-open engine-bay pass. The
// factory entries are 3-D centre-to-centre hardpoints; component envelopes are
// photo-calibrated layout targets, not invented CAD dimensions.
export const ENGINE_BAY_RECONSTRUCTION = {
  version: 'ucf10-bay-reconstruction-2026-08-08',
  referenceFrame: {
    image: 'references/user-1990-ls400-inline1.jpg', pixels: [800, 489],
    crop: 'native engine-top crop',
    use: 'ENGINE_BAY_PHOTO_LAYOUT camera plus normal 50 percent alpha overlay'
  },
  sources: {
    bodyHardpoints: {
      file: 'C:/Users/blowb/Desktop/LS400toolbox/manuals/techinfo_RM144U_1990_LS400/RM144U_0444_Body_Dimensions_Body_Dimension_Drawings.pdf',
      page: 'B0-186 / PDF 1',
      image: 'C:/Users/blowb/Desktop/LS400toolbox/manuals/techinfo_RM144U_1990_LS400/page-images/RM144U_0444/page-0001.png',
      evidence: 'Factory 3-D centre-to-centre engine-compartment hardpoint network.'
    },
    intake: {
      file: 'C:/Users/blowb/Desktop/LS400toolbox/manuals/techinfo_RM144U_1990_LS400/RM144U_0039_Introduction_and_Preparation_Operation.pdf',
      page: 'FI-5 / PDF 3; FI-47; FI-50',
      evidence: 'Air cleaner → air-flow meter → throttle body → intake chamber; meter and throttle silhouette.'
    },
    cooling: {
      file: 'C:/Users/blowb/Desktop/LS400toolbox/manuals/techinfo_RM144U_1990_LS400/RM144U_0072_Components_Electric_Cooling_Fan.pdf',
      page: 'CO-15 / PDF 3', evidence: 'Separate paired caged fan/shroud assemblies in the support opening.'
    },
    wiring: {
      file: 'C:/Users/blowb/Desktop/LS400toolbox/manuals/1990_LS400_EWD070U_Electrical_Wiring_Diagram.pdf',
      page: '24-25 / component location', evidence: 'AFM passenger; brake-fluid switch driver-rear; fan motors front centre.'
    },
    parts: {
      file: 'C:/Users/blowb/Desktop/LS400toolbox/diagrams/epc_megazip_usdm/images/air-cleaner-17822646.png',
      page: '1990 UCF10 1UZ-FE air-cleaner plate', evidence: 'Air cleaner, AFM, connector pipe and clamp adjacency.'
    },
    photos: {
      primary: 'references/user-1990-ls400-inline1.jpg',
      corroborating: ['references/user-1990-ls400-hood-open.webp', 'references/user-1991-ls400-7-1.jpg'],
      evidence: 'Passenger-front airbox/MAF with rearward/inboard duct; driver-front battery/fuse; driver-rear booster; tower/support silhouette.'
    }
  },
  factoryHardpointsMm: {
    cowlTopOuterJj: { value: 1552, symbols: 'J-j', role: 'outer cowl-top-side pair' },
    cowlTopCc: { value: 1494, symbols: 'C-c', role: 'cowl-top-side pair' },
    radiatorUpperSupportAa: { value: 1509, symbols: 'A-a', role: 'radiator upper-support pair' },
    springSupportBb: { value: 1050, symbols: 'B-b', role: 'inner-front spring-support pair' }
  },
  structural: {
    ...MODEL_FOUNDATION_METRES.structural
  },
  anchors: MODEL_FOUNDATION_METRES.anchors,
  photoLandmarks: {
    image: 'user-1990-ls400-inline1.jpg', nativePixels: [800, 489],
    primaryPixels: {
      cowlCentre: [400, 50], towerPassenger: [62, 207], towerDriver: [733, 207],
      frontSupportCentre: [400, 478], engineBounds: [205, 94, 646, 471],
      plenumBounds: [348, 94, 510, 322], throttle: [298, 214], airboxCentre: [211, 416],
      maf: [120, 350], ductElbow: [260, 220], battery: [738, 455], fuseBox: [728, 366],
      coolantReservoir: [739, 265], brakeBooster: [681, 101]
    },
    targetChecks: ['bay corners and curved aprons', 'strut-tower centres', 'firewall/cowl edge', 'radiator-support edge', 'engine bounds and intake manifold', 'airbox/MAF and continuous duct', 'driver battery/fuse', 'brake booster'],
    tolerance: 'major projected landmarks within about 5 percent of native image width or height'
  },
  remainingLimits: 'Exact hose bends, clamp holes, hidden component dimensions and VIN-level options remain physical-capture items.'
};

export const SYSTEMS = {
  AIR_CONDITIONING: { label: 'A/C refrigerant', color: 0x42d9c1 },
  HVAC: { label: 'Cabin HVAC', color: 0x8b7cff },
  COOLING: { label: 'Engine cooling', color: 0x4aa4ff },
  ENGINE: { label: 'Engine / accessory drive', color: 0xb6bec8 },
  BODY: { label: 'Vehicle landmarks', color: 0xb86b54 },
  ELECTRICAL: { label: 'Electrical', color: 0xf0cd55 },
  INTAKE: { label: 'Intake air', color: 0x77c66e },
  BRAKES: { label: 'Brake / vacuum', color: 0xc49bff },
  POWER_STEERING: { label: 'Power steering', color: 0xff7f87 }
};

export const GEOMETRY_DATASET = {
  coordinateSystem: {
    id: 'UCF10_SERVICE_COORDINATES',
    units: 'metres',
    origin: VEHICLE.origin,
    axes: VEHICLE.coordinateContract,
    source: 'Project vehicle contract; RM144U B0-185/B0-186 factory body-dimension plate',
    confidence: 'high-coordinate-contract / factory-hardpoint-constrained'
  },
  documentsReviewed: [
    { id: 'CR19X', title: 'Collision Repair Manual', sections: 50, usefulFor: 'body marks, front structure, radiator support, front rails, cowl/firewall context, underbody and engine-compartment dimensions', status: 'reviewed; blank cached CR0049 was not used for numeric claims' },
    { id: 'EWD070U', title: 'Electrical Wiring Diagram', sections: 250, usefulFor: 'component locations, harness/relay context, electrical systems near service landmarks', status: 'reviewed; physical loom extraction incomplete' },
    { id: 'RM144U', title: 'Factory Repair Manual / body dimensions', usefulFor: 'B0-185/B0-186 factory hardpoints, intake, cooling, brake and service context', status: 'reviewed from exact-year local PDF and rendered pages; B0-186 anchors this reconstruction' },
    { id: 'CHARM_1990', title: '1990 Operation CHARM service archive', usefulFor: 'A/C/HVAC locator, cooling/heater, intake/vacuum/PCV/EGR/EVAP topology, component service views', status: 'reviewed from 1990 exact-model offline pages; diagrams are topology/locator evidence, not scale' },
    { id: 'EPC_UCF10L', title: 'UCF10L-AEPGKA factory-derived parts diagrams', usefulFor: 'engine, intake, cooling, A/C, brake booster, battery, wiring and mounting relationships', status: 'reviewed from 96 local exploded-view plates; installed centerlines remain approximate' },
    { id: 'EPC_AC', title: 'Factory parts diagrams and exploded views', usefulFor: 'A/C component identity, receiver/fan/condenser relationships, compressor ports, pipe-family topology', status: 'reviewed from local EPC images' },
    { id: 'REFERENCE_CORPUS', title: 'Curated factory/reference corpus and capture plan', usefulFor: 'source provenance, truth labels, missing-information limits, hard-point and photo capture protocol', status: 'reviewed; no calibrated subject-vehicle survey is present' },
    { id: 'PHOTOS_PRIVATE', title: 'Private hood-open LS400 references', usefulFor: 'visual alignment and spacing sanity checks only', status: 'reviewed; no publication rights' }
  ],
  dimensions: [
    { id: 'OVERALL_LENGTH', label: 'Overall length', value: 4.995, unit: 'm', source: 'published UCF10 envelope retained in project', confidence: 'high' },
    { id: 'OVERALL_WIDTH', label: 'Overall width', value: 1.820, unit: 'm', source: 'published UCF10 envelope retained in project', confidence: 'high' },
    { id: 'OVERALL_HEIGHT', label: 'Overall height', value: 1.400, unit: 'm', source: 'published UCF10 envelope retained in project', confidence: 'high' },
    { id: 'WHEELBASE', label: 'Wheelbase', value: 2.815, unit: 'm', source: 'published UCF10 envelope retained in project', confidence: 'high' },
    { id: 'B0_186_COWL_OUTER_JJ', label: 'Cowl-top-side J-j hardpoint span', value: 1.552, unit: 'm', source: 'RM144U B0-186 / PDF 1', confidence: 'factory-3d-centre-to-centre' },
    { id: 'B0_186_COWL_CC', label: 'Cowl-top-side C-c hardpoint span', value: 1.494, unit: 'm', source: 'RM144U B0-186 / PDF 1', confidence: 'factory-3d-centre-to-centre' },
    { id: 'B0_186_RADIATOR_AA', label: 'Radiator upper-support A-a hardpoint span', value: 1.509, unit: 'm', source: 'RM144U B0-186 / PDF 1', confidence: 'factory-3d-centre-to-centre' },
    { id: 'B0_186_SPRING_BB', label: 'Inner-front spring-support B-b hardpoint span', value: 1.050, unit: 'm', source: 'RM144U B0-186 / PDF 1', confidence: 'factory-3d-centre-to-centre' },
    { id: 'RECEIVER_JOINT_TORQUE', label: 'Receiver liquid-tube joint torque', value: 5.4, unit: 'N.m', source: 'RM144U AC-32 receiver installation', confidence: 'high-service-value' },
    { id: 'COOLING_UNIT_JOINT_TORQUE', label: 'Cooling-unit liquid/suction joint torque', value: 10, unit: 'N.m', source: 'RM144U torque table/AC procedure context', confidence: 'high-service-value' }
  ],
  datumPoints: [
    { id: 'DATUM_FRONT_AXLE_CENTER', label: 'Front axle center / scene origin', point: [0, 0, 0], source: 'Project coordinate contract', confidence: 'high' },
    { id: 'DATUM_VEHICLE_CENTERLINE_FRONT', label: 'Front centerline reference', point: [1.00, 0, 0.62], source: 'Collision Repair body-mark centerline concept; grille/radiator-support relationship', confidence: 'high-concept / approximate-coordinate' },
    { id: 'DATUM_RADIATOR_SUPPORT_CENTER', label: 'Radiator support center', point: [0.955, 0, 0.61], source: 'RM144U B0-186 A-a pair; CR radiator-support sections; native photo front-depth calibration', confidence: 'factory-span / photo-depth' },
    { id: 'DATUM_FIREWALL_PASSENGER_PASS', label: 'Passenger-side firewall A/C pass-through', point: [-1.00, -0.47, 0.72], source: 'CHARM A/C locator; EPC HVAC tube assemblies', confidence: 'high-area / hidden-detail-approximate' },
    { id: 'DATUM_ENGINE_BAY_REAR_COWL', label: 'Cowl rear engine-bay datum', point: [-1.11, 0, 0.92], source: 'RM144U B0-186 J-j/C-c pairs; cowl-top panel sections', confidence: 'factory-span / photo-depth' }
  ],
  componentAnchors: [
    { componentId: 'LANDMARK_RADIATOR_SUPPORT', anchor: [1.060, 0, 0.61], source: 'RM144U B0-186 A-a pair; CR radiator support sections; native photo edge calibration', page: 'B0-186 / PDF 1; CR19X_CR0014/CR0015', confidence: 'factory-span / photo-depth', toleranceMm: 120 },
    { componentId: 'AC_CONDENSER', anchor: [0.960, 0, 0.555], source: 'RM144U CO-15 paired-fan context; EPC condenser/fans', page: 'CO-15 / PDF 3', confidence: 'high-order / photo-depth', toleranceMm: 120 },
    { componentId: 'LANDMARK_RADIATOR', anchor: [0.785, 0, 0.570], source: 'RM144U CO-12; user hood-open photos', page: 'CO-12 / PDF 1', confidence: 'high-order / photo-depth', toleranceMm: 120 },
    { componentId: 'LANDMARK_COOLING_FANS', anchor: [0.870, 0, 0.575], source: 'RM144U CO-15 paired shrouds', page: 'CO-15 / PDF 3', confidence: 'high-location / simplified form', toleranceMm: 120 },
    { componentId: 'AC_RECEIVER_DRIER', anchor: [0.950, -0.690, 0.590], source: 'RM144U/EPC UCF10L crosswalk; 12/1989 receiver/condenser plate', page: 'EPC_121989_RECEIVER_FANS', confidence: 'high-location / photo-depth', toleranceMm: 115 },
    { componentId: 'AC_COMPRESSOR', anchor: [0.180, 0.270, 0.460], source: 'EPC compressor 17822848; CHARM locator; engine accessory-drive relationship', page: 'EPC_COMPRESSOR', confidence: 'high-location / photo-clearance-calibrated', toleranceMm: 120 },
    { componentId: 'ENGINE_1UZ_FE', anchor: [-0.220, 0, 0.540], source: 'B0-186 spring-support corridor; private 1990 engine-top photo', page: 'B0-186 / PDF 1; USER_ENGINE_TOP_1990', confidence: 'factory-corridor / reduced photo envelope', toleranceMm: 170 },
    { componentId: 'LANDMARK_BATTERY', anchor: [0.542, 0.675, 0.590], source: 'EWD070U component location; private 1990 engine-top photo; shared envelope-constrained foundation', page: 'EWD070U 24-25; USER_ENGINE_TOP_1990', confidence: 'high-area / physical-envelope-constrained', toleranceMm: 120 },
    { componentId: 'LANDMARK_AIRBOX', anchor: [0.411, -0.508, 0.570], source: 'RM144U FI-5/FI-47; EPC air-cleaner plate; private 1990 engine-top photo', page: 'FI-5 / PDF 3; FI-47', confidence: 'high-area / topology-locked', toleranceMm: 120 },
    { componentId: 'LANDMARK_BRAKE_BOOSTER', anchor: [-0.946, 0.690, 0.790], source: 'RM144U BR-14; EWD brake-fluid switch; private 1990 engine-top photo; shared envelope-constrained foundation', page: 'BR-14 / PDF 1; EWD070U 24-25', confidence: 'high-area / physical-envelope-constrained', toleranceMm: 120 },
    { componentId: 'LANDMARK_COOLANT_OVERFLOW_RESERVOIR', anchor: [0.025, 0.720, 0.770], source: 'private 1990 hood-open photo set; battery/fuse adjacency; shared envelope-constrained foundation', page: 'USER_ENGINE_TOP_1990', confidence: 'high-area / physical-envelope-constrained', toleranceMm: 110 },
    { componentId: 'LANDMARK_FRONT_STRUT_TOWERS', anchor: [-0.353, -0.009, 0.700], source: 'RM144U B0-186 B-b inner-front holes; private 1990 engine-top photo', page: 'B0-186 / PDF 1; USER_ENGINE_TOP_1990', confidence: 'factory-inner-hole / photo-centre; tower centres offset to outer aprons', toleranceMm: 125 },
    { componentId: 'AC_EXPANSION_VALVE', anchor: [-1.00, -0.47, 0.72], source: 'CHARM A/C locator; EPC HVAC tube assemblies', page: 'FACTORY_AC_LOCATOR; EPC_121989_HVAC_TUBES', confidence: 'high-area / hidden-detail-approximate', toleranceMm: 120 },
    { componentId: 'AC_EPR', anchor: [-1.00, -0.42, 0.67], source: 'RM144U/EPC crosswalk; CHARM locator', page: 'FACTORY_AC_LOCATOR', confidence: 'high-area / hidden-detail-approximate', toleranceMm: 120 },
    { componentId: 'HVAC_CASE', anchor: [-1.27, -0.28, 0.65], source: 'CHARM A/C locator', page: 'FACTORY_AC_LOCATOR', confidence: 'high-location / approximate-dimensions', toleranceMm: 140 }
  ],
  measurementReferences: [
    { id: 'CENTERLINE', label: 'Vehicle centerline', from: [1.05, 0, 0.04], to: [-1.55, 0, 0.04], source: 'Collision Repair standard body marks and coordinate contract', confidence: 'high-concept' },
    { id: 'FRONT_STACK_ORDER', label: 'Front stack: support to condenser to fans to radiator', from: [1.060, 0, 0.61], to: [0.785, 0, 0.570], source: 'RM144U CO-12/CO-15; B0-186 A-a support pair; native photo depth calibration', confidence: 'factory-order / photo-depth' },
    { id: 'PASSENGER_AC_ROUTE_BAND', label: 'Passenger-side A/C pipe band', from: [0.62, -0.72, 0.59], to: [-1.00, -0.47, 0.72], source: 'EPC cooler-piping schemas and CHARM locator', confidence: 'catalog-sequence / installed-bends-approximate' },
    { id: 'LOW_SIDE_RETURN_BAND', label: 'Low-side suction return band', from: [-1.00, -0.42, 0.67], to: [0.27, 0.42, 0.59], source: 'EPC suction B/C/E family; L-AC003-91; TSB0054L', confidence: 'factory silhouette / installed-bends-approximate' },
    { id: 'FIREWALL_TO_RADIATOR_SUPPORT', label: 'Firewall to radiator-support service depth', from: [-1.045, 0, 0.65], to: [1.060, 0, 0.61], source: 'RM144U B0-186 cowl/support network; CR front structure sections; native photo calibration', confidence: 'factory-span / photo-depth' }
  ],
  assumptions: [
    'The blank cached CR0049 render was not used; B0-186 factory hardpoint values are explicitly recorded above.',
    'A/C routes use documented topology and multiple supporting factory/reference sources, while bend radii and clamp holes remain provisional.',
    'Existing components are repositioned inside the documented vehicle coordinate contract; the body is not scaled around them.'
  ]
};

const commonAC = {
  system: 'AIR_CONDITIONING',
  fluidType: 'refrigerant / oil film',
  serviceRelevance: 'Recover refrigerant with approved equipment before opening any sealed connection.',
  tags: ['ac', 'engine-bay']
};

export const COMPONENTS = [
  {
    id: 'LANDMARK_BODY_SHELL', displayName: 'UCF10 body shell', aliases: ['first-generation LS400 body'], system: 'BODY',
    function: 'Establishes full-vehicle scale and the relationship between the engine bay, cabin and underbody.',
    connectsTo: ['LANDMARK_FRONT_BUMPER', 'LANDMARK_FRONT_FENDERS', 'LANDMARK_FIREWALL'], fluidType: 'none', pressureSide: 'NONE',
    confidence: 'approximate', source: 'licensed-ucf10-exterior.jpg; user hood-open photos; published overall dimensions',
    mountTo: 'vehicle datum', location: 'Complete vehicle envelope', geometryStatus: 'recognizable_simplified', important: true,
    serviceRelevance: 'Orientation landmark only.', notes: 'Overall dimensions are reference values; panel curvature is photo-estimated.', tags: ['landmark', 'body', 'full-vehicle']
  },
  {
    id: 'LANDMARK_FRONT_BUMPER', displayName: 'Front bumper and reinforcement', aliases: ['front bumper cover', 'bumper beam'], system: 'BODY',
    function: 'Defines the front access boundary below the condenser and radiator stack.', connectsTo: ['LANDMARK_BODY_SHELL', 'LANDMARK_RADIATOR_SUPPORT'],
    fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'user-1990-ls400-hood-open.webp; CHARM A/C component locator',
    mountTo: 'LANDMARK_FRONT_FRAME_RAILS', location: 'Ahead of the radiator stack', geometryStatus: 'recognizable_simplified', important: true,
    serviceRelevance: 'May obstruct lower/front access; removal procedure must be verified in the factory manual.', notes: 'Reinforcement location is estimated from cutaway and front photographs.', tags: ['landmark', 'body', 'front-end']
  },
  {
    id: 'LANDMARK_GRILLE', displayName: 'Upper grille', aliases: ['radiator grille'], system: 'BODY', function: 'Front viewing landmark and airflow opening.',
    connectsTo: ['LANDMARK_FRONT_BUMPER', 'LANDMARK_RADIATOR_SUPPORT'], fluidType: 'air', pressureSide: 'NONE', confidence: 'high',
    source: 'user-1990-ls400-hood-open.webp; CHARM A/C component locator', mountTo: 'LANDMARK_RADIATOR_SUPPORT', location: 'Vehicle centre between headlamps',
    geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Useful sightline toward the condenser and fan pair.', notes: 'Slat count is simplified.', tags: ['landmark', 'body', 'front-end']
  },
  {
    id: 'LANDMARK_PASSENGER_HEADLIGHT', displayName: 'Passenger-side headlight', aliases: ['right headlamp', 'RH headlamp'], system: 'BODY',
    function: 'Primary landmark for the receiver-drier and passenger-side refrigerant routing.', connectsTo: ['LANDMARK_RADIATOR_SUPPORT'], fluidType: 'electricity',
    pressureSide: 'NONE', confidence: 'high', source: 'user hood-open photos; CHARM A/C component locator', mountTo: 'LANDMARK_RADIATOR_SUPPORT',
    location: 'Front vehicle-right (passenger side)', geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Use to locate the receiver-drier behind/inboard of this lamp.',
    notes: 'Lens optics are simplified but the rectangular silhouette and placement are reference-matched.', tags: ['landmark', 'body', 'front-end', 'passenger-side']
  },
  {
    id: 'LANDMARK_DRIVER_HEADLIGHT', displayName: 'Driver-side headlight', aliases: ['left headlamp', 'LH headlamp'], system: 'BODY',
    function: 'Front driver-side orientation landmark.', connectsTo: ['LANDMARK_RADIATOR_SUPPORT'], fluidType: 'electricity', pressureSide: 'NONE',
    confidence: 'high', source: 'user hood-open photos; CHARM A/C component locator', mountTo: 'LANDMARK_RADIATOR_SUPPORT', location: 'Front vehicle-left (driver side)',
    geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Orientation landmark.', notes: 'Lens optics are simplified.', tags: ['landmark', 'body', 'front-end', 'driver-side']
  },
  {
    id: 'LANDMARK_HOOD', displayName: 'Articulated hood', aliases: ['bonnet'], system: 'BODY', function: 'Opens the engine-bay service envelope.',
    connectsTo: ['LANDMARK_HOOD_HINGES', 'LANDMARK_COWL'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate',
    source: 'user hood-open photos', mountTo: 'LANDMARK_HOOD_HINGES', location: 'Above engine bay, rear-hinged', geometryStatus: 'recognizable_simplified', important: true,
    serviceRelevance: 'Open, hide or make transparent without moving engine-bay geometry.', notes: 'Pivot position and 70 degree full-open angle are photographically estimated.', tags: ['landmark', 'body', 'hood']
  },
  {
    id: 'LANDMARK_HOOD_HINGES', displayName: 'Hood hinges and supports', aliases: ['hood hinge pair', 'hood struts'], system: 'BODY',
    function: 'Defines the hood pivot and supported open position.', connectsTo: ['LANDMARK_HOOD', 'LANDMARK_COWL'], fluidType: 'none', pressureSide: 'NONE',
    confidence: 'approximate', source: 'user-1991-ls400-7-1.jpg', mountTo: 'LANDMARK_BODY_SHELL', location: 'Rear corners of engine-bay opening',
    geometryStatus: 'service_detail_simplified', important: false, serviceRelevance: 'Keep clear when leaning over the fenders.', notes: 'Support style varies in photographs; this build uses a simplified paired support representation.', tags: ['hardware', 'body', 'hood']
  },
  {
    id: 'LANDMARK_FRONT_FENDERS', displayName: 'Front fenders', aliases: ['left and right front wings'], system: 'BODY', function: 'Defines realistic access from each side of the engine bay.',
    connectsTo: ['LANDMARK_BODY_SHELL', 'LANDMARK_PASSENGER_HEADLIGHT', 'LANDMARK_DRIVER_HEADLIGHT'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'user hood-open photos; exterior reference',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Both sides of engine bay', geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Physical access landmark.',
    notes: 'Wheel-arch and shoulder curvature are simplified.', tags: ['landmark', 'body', 'front-end']
  },
  {
    id: 'LANDMARK_WINDSHIELD', displayName: 'Windshield', aliases: ['windscreen'], system: 'BODY', function: 'Defines cabin scale and the rear edge of the cowl.',
    connectsTo: ['LANDMARK_COWL', 'LANDMARK_DASHBOARD'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'exterior and hood-open reference photos',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Behind cowl', geometryStatus: 'recognizable_simplified', important: false, serviceRelevance: 'Orientation landmark.', notes: 'Glass curvature is simplified.', tags: ['landmark', 'body', 'cabin']
  },
  {
    id: 'LANDMARK_COWL', displayName: 'Cowl and wiper plenum', aliases: ['lower cowl'], system: 'BODY', function: 'Separates the engine bay from the windshield and cabin air intake.',
    connectsTo: ['LANDMARK_FIREWALL', 'LANDMARK_WINDSHIELD'], fluidType: 'air / rainwater', pressureSide: 'NONE', confidence: 'high', source: 'user-1991-ls400-7-1.jpg',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Rear of engine bay', geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Firewall and HVAC orientation landmark.', notes: 'Wiper arms and intake grille are simplified.', tags: ['landmark', 'body', 'engine-bay']
  },
  {
    id: 'LANDMARK_FIREWALL', displayName: 'Firewall', aliases: ['dash panel'], system: 'BODY', function: 'Separates engine bay and passenger compartment and carries HVAC pass-throughs.',
    connectsTo: ['AC_EXPANSION_VALVE', 'AC_EPR', 'HVAC_CASE'], fluidType: 'none', pressureSide: 'NONE', confidence: 'high', source: 'CHARM A/C component locator; user hood-open photos',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Rear wall of engine bay', geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Can be hidden/cut away to expose cabin HVAC components.',
    notes: 'Stamped contours are simplified; pass-through region is emphasized.', tags: ['landmark', 'body', 'firewall']
  },
  {
    id: 'LANDMARK_DASHBOARD', displayName: 'Dashboard volume', aliases: ['instrument panel'], system: 'BODY', function: 'Cabin landmark around the HVAC case and passenger footwell.',
    connectsTo: ['HVAC_CASE', 'LANDMARK_PASSENGER_FOOTWELL'], fluidType: 'air / electricity', pressureSide: 'NONE', confidence: 'approximate', source: 'CHARM A/C component locator; sectioned vehicle reference',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Cabin side of firewall', geometryStatus: 'orientation_volume', important: false, serviceRelevance: 'Cut away for HVAC service views.', notes: 'Cosmetic dashboard detail intentionally omitted.', tags: ['landmark', 'body', 'cabin']
  },
  {
    id: 'LANDMARK_PASSENGER_FOOTWELL', displayName: 'Passenger footwell / glovebox volume', aliases: ['RH footwell'], system: 'BODY', function: 'Human-scale access reference for the HVAC case.',
    connectsTo: ['LANDMARK_DASHBOARD', 'HVAC_CASE'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'CHARM A/C component locator',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Cabin vehicle-right behind glovebox', geometryStatus: 'orientation_volume', important: false, serviceRelevance: 'Use passenger-footwell camera with dashboard cutaway.', notes: 'Volume only; trim is not modeled.', tags: ['landmark', 'body', 'cabin', 'passenger-side']
  },
  {
    id: 'LANDMARK_RADIATOR_SUPPORT', displayName: 'Radiator support', aliases: ['core support'], system: 'BODY', function: 'Mounts the condenser/radiator stack, headlights, receiver area and upper front trim.',
    connectsTo: ['AC_CONDENSER', 'LANDMARK_RADIATOR', 'AC_RECEIVER_DRIER', 'LANDMARK_PASSENGER_HEADLIGHT', 'LANDMARK_DRIVER_HEADLIGHT'], fluidType: 'none', pressureSide: 'NONE', confidence: 'high',
    source: 'user hood-open photos; EPC AC condenser plate', mountTo: 'LANDMARK_FRONT_FRAME_RAILS', location: 'Across front of engine bay', geometryStatus: 'service_identification', important: true,
    serviceRelevance: 'Major mounting and routing landmark.', notes: 'Bolt pattern is representative, not measured.', tags: ['landmark', 'body', 'front-end', 'mounting']
  },
  {
    id: 'LANDMARK_FRONT_FRAME_RAILS', displayName: 'Front frame rails', aliases: ['front side members'], system: 'BODY', function: 'Defines structural and underbody reference planes.',
    connectsTo: ['LANDMARK_RADIATOR_SUPPORT', 'LANDMARK_FRONT_BUMPER'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'sectioned LS400 reference',
    mountTo: 'LANDMARK_BODY_SHELL', location: 'Below engine bay on both sides', geometryStatus: 'orientation_geometry', important: true, serviceRelevance: 'Under-car access landmark.', notes: 'Cross-section and brackets are simplified.', tags: ['landmark', 'body', 'underbody']
  },
  {
    id: 'LANDMARK_SPLASH_SHIELDS', displayName: 'Front splash shields and undercovers', aliases: ['engine undercovers'], system: 'BODY', function: 'Represents panels that can block lower A/C access.',
    connectsTo: ['LANDMARK_FRONT_BUMPER', 'LANDMARK_FRONT_FRAME_RAILS'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'sectioned LS400 reference; service context',
    mountTo: 'LANDMARK_FRONT_FRAME_RAILS', location: 'Below engine and bumper', geometryStatus: 'orientation_geometry', important: false, serviceRelevance: 'Hide to inspect the compressor from below.', notes: 'Panel edges and fasteners are not measured.', tags: ['landmark', 'body', 'underbody']
  },
  {
    id: 'LANDMARK_RADIATOR', displayName: 'Engine radiator', aliases: ['radiator core'], system: 'COOLING', function: 'Engine coolant heat exchanger located directly behind the condenser.',
    connectsTo: ['COOLING_UPPER_HOSE', 'COOLING_LOWER_HOSE'], fluidType: 'engine coolant', pressureSide: 'NONE', confidence: 'high', source: 'user hood-open photos; EPC condenser plate',
    mountTo: 'LANDMARK_RADIATOR_SUPPORT', location: 'Behind A/C condenser', geometryStatus: 'service_identification', important: true, serviceRelevance: 'Hide to expose the rear face of the condenser.', notes: 'Fin pitch is representative.', tags: ['landmark', 'cooling', 'engine-bay']
  },
  {
    id: 'LANDMARK_COOLING_FANS', displayName: 'Electric cooling fan pair', aliases: ['condenser fans'], system: 'COOLING', function: 'Draws air through the condenser/radiator stack.',
    connectsTo: ['AC_CONDENSER', 'LANDMARK_RADIATOR'], fluidType: 'air / electricity', pressureSide: 'NONE', confidence: 'high', source: 'EPC AC condenser plate; CHARM A/C locator; user front photo',
    mountTo: 'LANDMARK_RADIATOR_SUPPORT', location: 'Ahead of condenser, visible through front opening', geometryStatus: 'service_identification', important: true, serviceRelevance: 'Electrical isolation required before fan-area work.', notes: 'Motor and shroud silhouettes are based on the EPC; blade detail is simplified.', tags: ['landmark', 'cooling', 'front-end']
  },
  {
    id: 'ENGINE_1UZ_FE', displayName: '1UZ-FE V8 engine', aliases: ['4.0L V8', '1UZ'], system: 'ENGINE', function: 'Primary engine-bay mass and mounting context for the compressor and accessory drive.',
    connectsTo: ['ENGINE_ACCESSORY_DRIVE', 'AC_COMPRESSOR', 'ENGINE_ALTERNATOR', 'ENGINE_POWER_STEERING_PUMP'], fluidType: 'oil / coolant / fuel / air / electricity', pressureSide: 'NONE',
    confidence: 'approximate', source: 'user engine-bay photos; licensed 1UZ cutaway photos', mountTo: 'LANDMARK_FRONT_FRAME_RAILS', location: 'Longitudinal centre of engine bay',
    geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Can be hidden for A/C routing inspection.', notes: 'Valve covers, intake plenum and front-drive silhouette are emphasized; castings are not dimensional CAD.', tags: ['landmark', 'engine', 'engine-bay']
  },
  {
    id: 'ENGINE_ACCESSORY_DRIVE', displayName: 'Accessory belt and pulleys', aliases: ['serpentine/front drive'], system: 'ENGINE', function: 'Drives the A/C compressor and other front accessories.',
    connectsTo: ['AC_COMPRESSOR_CLUTCH', 'ENGINE_ALTERNATOR', 'ENGINE_POWER_STEERING_PUMP'], fluidType: 'mechanical power', pressureSide: 'NONE', confidence: 'approximate', source: 'licensed 1UZ cutaway photos',
    mountTo: 'ENGINE_1UZ_FE', location: 'Front face of engine', geometryStatus: 'service_identification', important: true, serviceRelevance: 'Engine off and battery isolation required before belt-area inspection.', notes: 'Belt path is representative, not a replacement routing diagram.', tags: ['engine', 'engine-bay', 'accessory-drive']
  },
  {
    id: 'ENGINE_SPARK_PLUG_WIRING', displayName: 'Spark plugs and ignition wiring', aliases: ['plug wires', 'ignition leads'], system: 'ENGINE', function: 'Shows the eight V8 plug wells, boots and routed ignition leads on both cylinder banks.',
    connectsTo: ['ENGINE_1UZ_FE'], fluidType: 'ignition voltage', pressureSide: 'NONE', confidence: 'high-form / approximate-routing', source: '1UZ-FE service illustrations and user engine-bay photos', mountTo: 'ENGINE_1UZ_FE', location: 'Both valve-cover banks', geometryStatus: 'service_detail_simplified', important: true, tags: ['engine', 'electrical', 'ignition']
  },
  {
    id: 'ENGINE_THROTTLE_POSITION_SENSOR_WIRING', displayName: 'Throttle position sensor and wiring', aliases: ['TPS', 'throttle sensor'], system: 'ENGINE', function: 'Identifies the throttle shaft sensor and its short three-wire connector loom.',
    connectsTo: ['ENGINE_1UZ_FE'], fluidType: 'sensor signal', pressureSide: 'NONE', confidence: 'high-location / simplified-form', source: '1UZ-FE throttle-body service layout', mountTo: 'ENGINE_1UZ_FE', location: 'Throttle-body shaft at front of intake plenum', geometryStatus: 'service_detail_simplified', important: true, tags: ['engine', 'electrical', 'intake']
  },
  {
    id: 'ENGINE_ALTERNATOR', displayName: 'Alternator', aliases: ['generator'], system: 'ELECTRICAL', function: 'Charges the electrical system and provides an accessory-drive landmark.',
    connectsTo: ['ENGINE_ACCESSORY_DRIVE'], fluidType: 'electricity / mechanical power', pressureSide: 'NONE', confidence: 'approximate', source: 'licensed 1UZ cutaway photos',
    mountTo: 'ENGINE_1UZ_FE', location: 'Lower front accessory drive', geometryStatus: 'recognizable_simplified', important: false, serviceRelevance: 'Nearby access landmark.', notes: 'Mounting side is photo-estimated.', tags: ['landmark', 'electrical', 'engine-bay']
  },
  {
    id: 'ENGINE_POWER_STEERING_PUMP', displayName: 'Power-steering pump', aliases: ['P/S pump'], system: 'POWER_STEERING', function: 'Hydraulic pump and accessory-drive landmark.',
    connectsTo: ['ENGINE_ACCESSORY_DRIVE', 'POWER_STEERING_HIGH_PRESSURE', 'POWER_STEERING_RETURN'], fluidType: 'power-steering fluid', pressureSide: 'NONE', confidence: 'approximate', source: 'licensed 1UZ cutaway photos; user engine-bay photos',
    mountTo: 'ENGINE_1UZ_FE', location: 'Front accessory area', geometryStatus: 'recognizable_simplified', important: false, serviceRelevance: 'Do not confuse hydraulic hoses with refrigerant lines.', notes: 'Routing is contextual and approximate.', tags: ['landmark', 'power-steering', 'engine-bay']
  },
  {
    id: 'LANDMARK_BATTERY', displayName: 'Battery', aliases: ['12 V battery'], system: 'ELECTRICAL', function: 'High-visibility driver-side engine-bay landmark.', connectsTo: ['ENGINE_MAIN_HARNESS'],
    fluidType: 'electricity / electrolyte', pressureSide: 'NONE', confidence: 'high', source: 'user hood-open photos', mountTo: 'LANDMARK_BODY_SHELL', location: 'Front driver side',
    geometryStatus: 'service_identification', important: true, serviceRelevance: 'Disconnect/isolate only under the applicable procedure.', notes: 'Exact battery brand and terminal arrangement vary.', tags: ['landmark', 'electrical', 'engine-bay', 'driver-side']
  },
  {
    id: 'LANDMARK_AIRBOX', displayName: 'Air cleaner box', aliases: ['airbox'], system: 'INTAKE', function: 'Large passenger-side landmark feeding the engine intake.',
    connectsTo: ['LANDMARK_INTAKE_TUBE'], fluidType: 'intake air', pressureSide: 'NONE', confidence: 'high', source: 'user engine-bay photos', mountTo: 'LANDMARK_BODY_SHELL', location: 'Front passenger side',
    geometryStatus: 'service_identification', important: true, serviceRelevance: 'May obstruct access to passenger-side lines from above.', notes: 'Clips and internal filter are simplified.', tags: ['landmark', 'intake', 'engine-bay', 'passenger-side']
  },
  {
    id: 'LANDMARK_COOLANT_OVERFLOW_RESERVOIR', displayName: 'Coolant overflow reservoir', aliases: ['coolant expansion tank'], system: 'COOLING', function: 'Provides the high-visibility coolant-level landmark immediately inboard and behind the driver-side battery area.',
    connectsTo: ['LANDMARK_RADIATOR'], fluidType: 'engine coolant', pressureSide: 'NONE', confidence: 'high-area', source: 'user supplied 1990-1992 hood-open photo set', mountTo: 'LANDMARK_BODY_SHELL', location: 'Driver side, inboard/rearward of battery', geometryStatus: 'service_identification', important: true, notes: 'Tank outline is photo-proportioned; cap and molded seams are simplified.', tags: ['landmark','cooling','engine-bay','driver-side']
  },
  {
    id: 'LANDMARK_ENGINE_BAY_FUSE_BOX', displayName: 'Engine-bay fuse and relay box', aliases: ['underhood fuse box'], system: 'ELECTRICAL', function: 'Defines the driver-side service volume behind the battery.',
    connectsTo: ['LANDMARK_BATTERY'], fluidType: 'electricity', pressureSide: 'NONE', confidence: 'high-area', source: 'user supplied hood-open photos', mountTo: 'LANDMARK_BODY_SHELL', location: 'Driver-side rear of battery', geometryStatus: 'service_identification', important: true, tags: ['landmark','electrical','engine-bay','driver-side']
  },
  {
    id: 'LANDMARK_FRONT_STRUT_TOWERS', displayName: 'Front strut towers', aliases: ['shock towers'], system: 'BODY', function: 'Defines the paired suspension mounting domes and the open service corridors beside the engine.',
    connectsTo: ['LANDMARK_AIR_SUSPENSION_SERVICE_HOUSINGS'], fluidType: 'none', pressureSide: 'NONE', confidence: 'high-area', source: 'user supplied 1990-1992 hood-open photo set', mountTo: 'LANDMARK_FRONT_FENDERS', location: 'Paired inner-fender domes', geometryStatus: 'service_identification', important: true, tags: ['landmark','suspension','engine-bay']
  },
  {
    id: 'LANDMARK_AIR_SUSPENSION_SERVICE_HOUSINGS', displayName: 'Air-suspension service housings', aliases: ['suspension adjustment housings','rear engine-bay service boxes'], system: 'BODY', function: 'Preserves the paired boxed service zones at the rear of the strut towers on the air-suspension vehicle.',
    connectsTo: ['LANDMARK_FRONT_STRUT_TOWERS'], fluidType: 'air / electricity', pressureSide: 'NONE', confidence: 'medium-identification', source: 'user supplied hood-open photos; target air-suspension configuration', mountTo: 'LANDMARK_BODY_SHELL', location: 'Rear outer corners of engine bay', geometryStatus: 'recognizable_simplified', important: true, notes: 'Internal adjustment hardware remains configuration-dependent.', tags: ['landmark','suspension','engine-bay','air-suspension']
  },
  {
    id: 'ENGINE_THROTTLE_CABLE', displayName: 'Throttle cable and support clips', aliases: ['accelerator cable'], system: 'ENGINE', function: 'Provides the overhead routing landmark above the passenger-side low service fitting and into the throttle body.',
    connectsTo: ['ENGINE_1UZ_FE','LANDMARK_INTAKE_TUBE'], fluidType: 'mechanical control', pressureSide: 'NONE', confidence: 'high-area / route approximate', source: 'user supplied hood-open photos', mountTo: 'ENGINE_1UZ_FE', location: 'Across rear/top of engine to passenger-side throttle body', geometryStatus: 'continuous_context', important: true, tags: ['engine','intake','engine-bay','cable']
  },
  {
    id: 'LANDMARK_INTAKE_TUBE', displayName: 'Intake duct and airflow meter', aliases: ['intake hose', 'AFM duct'], system: 'INTAKE', function: 'Carries intake air from the airbox toward the throttle body.',
    connectsTo: ['LANDMARK_AIRBOX', 'ENGINE_1UZ_FE'], fluidType: 'intake air / electricity', pressureSide: 'NONE', confidence: 'high', source: 'user engine-bay photos', mountTo: 'LANDMARK_AIRBOX',
    location: 'Across passenger-side front of engine', geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Strong visual landmark above the compressor region.', notes: 'Corrugations and clamps are represented.', tags: ['landmark', 'intake', 'engine-bay']
  },
  {
    id: 'LANDMARK_BRAKE_BOOSTER', displayName: 'Brake booster and master cylinder', aliases: ['vacuum booster'], system: 'BRAKES', function: 'Driver-side firewall landmark.',
    connectsTo: ['BRAKE_VACUUM_HOSE'], fluidType: 'brake fluid / vacuum', pressureSide: 'NONE', confidence: 'high', source: 'user engine-bay photos', mountTo: 'LANDMARK_FIREWALL',
    location: 'Driver-side firewall', geometryStatus: 'recognizable_simplified', important: true, serviceRelevance: 'Safety-critical system; serves only as a location landmark here.', notes: 'Reservoir shape is simplified.', tags: ['landmark', 'brakes', 'engine-bay', 'driver-side']
  },
  {
    ...commonAC, id: 'AC_COMPRESSOR', legacyIds: ['AC-001'], displayName: 'A/C compressor', aliases: ['refrigerant compressor'],
    function: 'Compresses low-pressure refrigerant vapor and sends high-pressure vapor to the condenser.', connectsTo: ['AC_SUCTION_LINE', 'AC_DISCHARGE_LINE', 'AC_COMPRESSOR_CLUTCH'],
    pressureSide: 'BOTH', confidence: 'high-location / approximate-dimensions', source: 'EPC compressor 17822848; EPC piping 17822845; CHARM locator',
    mountTo: 'AC_COMPRESSOR_BRACKET', location: 'Low front vehicle-left (driver side) of the 1UZ-FE', geometryStatus: 'true_form_simplified', important: true,
    notes: 'Installed angle and cast housing proportions are estimated from factory exploded view and cutaway photos.'
  },
  {
    ...commonAC, id: 'AC_COMPRESSOR_CLUTCH', legacyIds: ['AC-002'], displayName: 'Compressor magnetic clutch and pulley', aliases: ['A/C clutch'],
    function: 'Couples the belt-driven pulley to the compressor shaft when commanded.', connectsTo: ['ENGINE_ACCESSORY_DRIVE', 'AC_COMPRESSOR', 'ELECTRICAL_AC_HARNESS'],
    fluidType: 'mechanical power / electricity', pressureSide: 'NONE', confidence: 'high', source: 'EPC compressor 17822848', mountTo: 'AC_COMPRESSOR',
    location: 'Forward face of compressor', geometryStatus: 'close_inspection', important: true, notes: 'Grooved pulley, clutch face, hub bolt and electrical lead are represented.', tags: ['ac', 'engine-bay', 'hardware']
  },
  {
    ...commonAC, id: 'AC_COMPRESSOR_CLUTCH_WIRING', displayName: 'Compressor clutch wiring', aliases: ['compressor electrical lead'], function: 'Supplies the electromagnetic clutch at the compressor pulley.',
    connectsTo: ['AC_COMPRESSOR_CLUTCH'], fluidType: '12 V clutch power', pressureSide: 'NONE', confidence: 'high-location / simplified-routing', source: 'A/C compressor service illustrations', mountTo: 'AC_COMPRESSOR_CLUTCH', location: 'Forward compressor clutch and nearby harness', geometryStatus: 'service_detail_simplified', important: false, tags: ['ac', 'engine-bay', 'electrical']
  },
  {
    ...commonAC, id: 'AC_COMPRESSOR_BRACKET', displayName: 'Compressor mounting bracket', aliases: ['A/C bracket'], function: 'Mounts the compressor to the lower front engine.',
    connectsTo: ['AC_COMPRESSOR', 'ENGINE_1UZ_FE'], fluidType: 'none', pressureSide: 'NONE', confidence: 'approximate', source: 'licensed 1UZ cutaway photos; EPC compressor',
    mountTo: 'ENGINE_1UZ_FE', location: 'Low front vehicle-left (driver-side) engine face', geometryStatus: 'service_detail_simplified', important: true,
    notes: 'Bracket silhouette and bolt locations are plausible but not measured.', tags: ['ac', 'engine-bay', 'hardware']
  },
  {
    ...commonAC, id: 'AC_DISCHARGE_PORT', displayName: 'Compressor discharge port', aliases: ['high-side compressor outlet'], function: 'Outlet for high-pressure refrigerant vapor.',
    connectsTo: ['AC_COMPRESSOR', 'AC_DISCHARGE_LINE'], pressureSide: 'HIGH', confidence: 'high', source: 'EPC compressor 17822848', mountTo: 'AC_COMPRESSOR',
    location: 'Upper compressor manifold', geometryStatus: 'close_inspection', important: true, notes: 'Distinct from the larger suction connection.', tags: ['ac', 'engine-bay', 'fitting']
  },
  {
    ...commonAC, id: 'AC_SUCTION_PORT', displayName: 'Compressor suction port', aliases: ['low-side compressor inlet'], function: 'Returns low-pressure vapor to the compressor.',
    connectsTo: ['AC_COMPRESSOR', 'AC_SUCTION_LINE'], pressureSide: 'LOW', confidence: 'high', source: 'EPC compressor 17822848', mountTo: 'AC_COMPRESSOR',
    location: 'Upper compressor manifold', geometryStatus: 'close_inspection', important: true, notes: 'Rendered larger than the discharge connection for recognition.', tags: ['ac', 'engine-bay', 'fitting']
  },
  {
    ...commonAC, id: 'AC_CONDENSER', legacyIds: ['AC-005'], displayName: 'A/C condenser', aliases: ['condenser core'], function: 'Rejects heat and condenses high-pressure refrigerant vapor into liquid.',
    connectsTo: ['AC_DISCHARGE_LINE', 'AC_LIQUID_LINE_CONDENSER_DRIER'], pressureSide: 'HIGH', confidence: 'high-location / approximate-dimensions',
    source: 'EPC condenser/fans 17822844; CHARM locator; user front photo', mountTo: 'LANDMARK_RADIATOR_SUPPORT', location: 'Ahead of radiator behind grille/front opening',
    geometryStatus: 'true_form_simplified', important: true, notes: 'Frame, fin field, end tanks, tabs and two distinct fittings are represented.', tags: ['ac', 'engine-bay', 'front-end']
  },
  {
    ...commonAC, id: 'AC_CONDENSER_INLET', displayName: 'Condenser inlet fitting', aliases: ['high-pressure vapor inlet'], function: 'Receives compressor discharge vapor.',
    connectsTo: ['AC_DISCHARGE_LINE', 'AC_CONDENSER'], pressureSide: 'HIGH', confidence: 'medium', source: 'EPC condenser/fans 17822844; EPC piping 17822845',
    mountTo: 'AC_CONDENSER', location: 'Condenser end tank; exact vertical landing approximate', geometryStatus: 'close_inspection', important: true,
    notes: 'Factory plates establish the connection but do not supply measured installed coordinates.', tags: ['ac', 'engine-bay', 'fitting']
  },
  {
    ...commonAC, id: 'AC_CONDENSER_OUTLET', displayName: 'Condenser liquid outlet fitting', aliases: ['condenser outlet'], function: 'Sends high-pressure liquid toward the receiver-drier.',
    connectsTo: ['AC_CONDENSER', 'AC_LIQUID_LINE_CONDENSER_DRIER'], pressureSide: 'HIGH', confidence: 'medium', source: 'EPC condenser/fans 17822844; EPC piping 17822845',
    mountTo: 'AC_CONDENSER', location: 'Condenser end tank; exact vertical landing approximate', geometryStatus: 'close_inspection', important: true,
    notes: 'Factory plates establish the connection but do not supply measured installed coordinates.', tags: ['ac', 'engine-bay', 'fitting']
  },
  {
    ...commonAC, id: 'AC_RECEIVER_DRIER', legacyIds: ['AC-006'], displayName: 'Receiver-drier', aliases: ['receiver', 'filter-drier'], function: 'Stores/filters high-pressure liquid refrigerant and removes moisture.',
    connectsTo: ['AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL', 'AC_SIGHT_GLASS'], pressureSide: 'HIGH', confidence: 'high-location / approximate-dimensions',
    source: 'RM144U/EPC UCF10L crosswalk; 12/1989 receiver/condenser plate', partNumber: '88470-50010 assembly; 88471-50010 receiver tank; 88471-16050 retrofit receiver', mountTo: 'AC_RECEIVER_DRIER_BRACKET', location: 'Front passenger side, behind/inboard of passenger headlight beside radiator support',
    geometryStatus: 'true_form_simplified', important: true, notes: 'Factory receiver assembly with top liquid-pipe block, pressure switch, cylinder, cap and clamp. Installed retrofit history controls the actual replacement part.', tags: ['ac', 'engine-bay', 'passenger-side']
  },
  {
    ...commonAC, id: 'AC_RECEIVER_DRIER_BRACKET', displayName: 'Receiver-drier clamp and bracket', aliases: ['receiver clamp'], function: 'Secures the receiver-drier to the front support structure.',
    connectsTo: ['AC_RECEIVER_DRIER', 'LANDMARK_RADIATOR_SUPPORT'], fluidType: 'none', pressureSide: 'NONE', confidence: 'high', source: 'EPC condenser/fans 17822844',
    mountTo: 'LANDMARK_RADIATOR_SUPPORT', location: 'Passenger-side front support', geometryStatus: 'close_inspection', important: true, notes: 'Clamp band and representative bolt are visible.', tags: ['ac', 'engine-bay', 'hardware']
  },
  {
    ...commonAC, id: 'AC_PRESSURE_SWITCH', legacyIds: ['AC-010'], displayName: 'A/C pressure switch', aliases: ['refrigerant pressure control'], function: 'Monitors high-side pressure for control/protection logic.',
    connectsTo: ['AC_LIQUID_LINE_DRIER_FIREWALL', 'ELECTRICAL_AC_HARNESS'], fluidType: 'refrigerant pressure / electricity', pressureSide: 'HIGH', confidence: 'high-location / approximate-clock-angle',
    source: '12/1989 Amayama EPC MEP439E; UCF10L-AEPGKV', partNumber: '88645-50010', mountTo: 'AC_LIQUID_LINE_DRIER_FIREWALL', location: 'Receiver top/liquid-pipe block behind the passenger headlight',
    geometryStatus: 'close_inspection_approximate', important: true, notes: 'The EPC fixes this switch to the early receiver/top pipe assembly; connector clocking remains unmeasured.', tags: ['ac', 'engine-bay', 'electrical', 'fitting']
  },
  {
    ...commonAC, id: 'AC_SIGHT_GLASS', legacyIds: ['AC-018'], displayName: 'Receiver sight glass', aliases: ['sight glass'], function: 'Original-system visual inspection feature associated with the receiver/high-side liquid area.',
    connectsTo: ['AC_RECEIVER_DRIER'], pressureSide: 'HIGH', confidence: 'high', source: 'CHARM locator; EPC condenser/fans 17822844', mountTo: 'AC_RECEIVER_DRIER',
    location: 'Receiver-drier top/adjacent liquid fitting', geometryStatus: 'close_inspection', important: false, notes: 'Not a reliable standalone charge-state decision tool, especially after conversion.', tags: ['ac', 'engine-bay', 'inspection']
  },
  {
    ...commonAC, id: 'AC_HIGH_SERVICE_PORT', legacyIds: ['AC-015 high'], displayName: 'High-side service port', aliases: ['high-pressure service fitting'], function: 'Professional recovery/evacuation/charging access on the high-pressure liquid route.',
    connectsTo: ['AC_LIQUID_LINE_DRIER_FIREWALL'], fluidType: 'refrigerant service access', pressureSide: 'HIGH', confidence: 'catalog-location / exact fitting uncertain', source: '12/1989 Amayama EPC MEP444E liquid pipe A; physical trace required',
    mountTo: 'AC_LIQUID_LINE_DRIER_FIREWALL', location: 'Passenger-front receiver-side liquid pipe A, behind/inboard of passenger headlight', geometryStatus: 'close_inspection_approximate', important: true,
    notes: 'Placed on the short receiver-side liquid pipe rather than the compressor discharge line. Exact Dec-1989 valve/cap configuration still requires vehicle verification.', tags: ['ac', 'engine-bay', 'service-port', 'uncertain']
  },
  {
    ...commonAC, id: 'AC_LOW_SERVICE_PORT', legacyIds: ['AC-015 low'], displayName: 'Low-side service port', aliases: ['suction service fitting'], function: 'Professional recovery/evacuation/charging access on the low-pressure suction route.',
    connectsTo: ['AC_SUCTION_LINE'], fluidType: 'refrigerant service access', pressureSide: 'LOW', confidence: 'high-area / exact fitting uncertain', source: 'newdocs low-port lead; 12/1989 Amayama EPC MEP444E suction C/E assembly; physical trace required',
    mountTo: 'AC_SUCTION_LINE', location: 'Passenger-side rear engine bay near the firewall, on the large suction assembly', geometryStatus: 'close_inspection_approximate', important: true,
    notes: 'Moved rearward and passenger-side to match the target vehicle and documented near-firewall location. Original R-12 fitting or conversion adapter must still be verified.', tags: ['ac', 'engine-bay', 'service-port', 'uncertain']
  },
  {
    ...commonAC, id: 'AC_EXPANSION_VALVE', legacyIds: ['AC-011'], displayName: 'Expansion valve area', aliases: ['metering valve'], function: 'Meters high-pressure liquid into the evaporator and creates the low-pressure side.',
    connectsTo: ['AC_LIQUID_LINE_DRIER_FIREWALL', 'AC_EVAPORATOR_FEED_INTERNAL'], pressureSide: 'BOUNDARY', confidence: 'high-location / hidden-detail-approximate', source: 'CHARM A/C locator; EPC piping',
    mountTo: 'HVAC_CASE', location: 'Passenger-side firewall/HVAC case connection area', geometryStatus: 'true_form_simplified', important: true,
    notes: 'Do not flush through the expansion valve. Exact fastener geometry requires glovebox/HVAC-case capture.', tags: ['ac', 'cabin', 'firewall', 'no-flush']
  },
  {
    ...commonAC, id: 'AC_EVAPORATOR', legacyIds: ['AC-012'], displayName: 'Evaporator core', aliases: ['evaporator'], function: 'Absorbs cabin heat as refrigerant boils inside the HVAC case.',
    connectsTo: ['AC_EVAPORATOR_FEED_INTERNAL', 'AC_EVAPORATOR_RETURN_INTERNAL'], pressureSide: 'LOW', confidence: 'high-location / approximate-dimensions', source: 'CHARM A/C locator',
    mountTo: 'HVAC_CASE', location: 'Passenger-side cabin behind glovebox', geometryStatus: 'true_form_simplified', important: true,
    notes: 'Fin field and two end connections are shown through HVAC cutaway. Do not solvent-flush through the installed valve/core assembly without the exact procedure.', tags: ['ac', 'cabin', 'hvac']
  },
  {
    ...commonAC, id: 'AC_EPR', legacyIds: ['AC-016'], displayName: 'Evaporator pressure regulator (EPR)', aliases: ['evaporator pressure regulator'], function: 'Regulates evaporator pressure in the original system arrangement.',
    connectsTo: ['AC_EVAPORATOR_RETURN_INTERNAL', 'AC_SUCTION_LINE', 'AC_EQUALIZER_TUBE'], pressureSide: 'LOW', confidence: 'high-location / approximate-dimensions', source: 'RM144U/EPC crosswalk; pre-08/1990 EPR 88503-50010, post-08/1990 88503-50011, replacement 88503-50021',
    mountTo: 'HVAC_CASE', location: 'Evaporator outlet/firewall region', geometryStatus: 'true_form_simplified', important: true,
    notes: 'December-1989 target uses the pre-August-1990 EPR family. Do not flush through the EPR; exterior dimensions remain unmeasured.', tags: ['ac', 'cabin', 'firewall', 'no-flush']
  },
  {
    ...commonAC, id: 'HVAC_CASE', displayName: 'HVAC case', aliases: ['cooling and blower unit', 'air-conditioning case'], system: 'HVAC', function: 'Houses the evaporator, blower and air doors behind the passenger side of the dashboard.',
    connectsTo: ['AC_EVAPORATOR', 'HVAC_BLOWER_HOUSING', 'HVAC_HEATER_CORE'], fluidType: 'air / condensate', pressureSide: 'NONE', confidence: 'high-location / approximate-dimensions',
    source: 'CHARM A/C locator', mountTo: 'LANDMARK_FIREWALL', location: 'Passenger cabin, behind glovebox', geometryStatus: 'recognizable_cutaway', important: true,
    serviceRelevance: 'Use case cutaway to inspect internal spatial relationships.', notes: 'Case shape is simplified from the factory locator.', tags: ['hvac', 'cabin']
  },
  {
    id: 'HVAC_BLOWER_HOUSING', displayName: 'Blower housing', aliases: ['cooling and blower unit'], system: 'HVAC', function: 'Encloses the blower wheel and directs cabin air through the HVAC case.',
    connectsTo: ['HVAC_BLOWER_MOTOR', 'HVAC_CASE'], fluidType: 'air / electricity', pressureSide: 'NONE', confidence: 'high-location / approximate-dimensions', source: 'CHARM A/C locator',
    mountTo: 'HVAC_CASE', location: 'Passenger-side end of HVAC case', geometryStatus: 'true_form_simplified', important: true, serviceRelevance: 'Accessible from passenger footwell after trim removal.',
    notes: 'Volute shape is simplified.', tags: ['hvac', 'cabin']
  },
  {
    id: 'HVAC_BLOWER_MOTOR', displayName: 'Blower motor and squirrel-cage fan', aliases: ['blower motor'], system: 'HVAC', function: 'Moves cabin air through the evaporator/heater case.',
    connectsTo: ['HVAC_BLOWER_HOUSING'], fluidType: 'air / electricity', pressureSide: 'NONE', confidence: 'high', source: 'CHARM A/C locator', mountTo: 'HVAC_BLOWER_HOUSING',
    location: 'Passenger footwell side of blower housing', geometryStatus: 'close_inspection', important: true, serviceRelevance: 'Cabin HVAC landmark; not part of the sealed refrigerant circuit.', notes: 'Fan vanes and motor cap are represented.', tags: ['hvac', 'cabin', 'electrical']
  },
  {
    id: 'HVAC_HEATER_CORE', displayName: 'Heater core', aliases: ['heater radiator'], system: 'HVAC', function: 'Transfers engine-coolant heat to cabin air.', connectsTo: ['HVAC_HEATER_HOSE_FEED', 'HVAC_HEATER_HOSE_RETURN'],
    fluidType: 'engine coolant', pressureSide: 'NONE', confidence: 'high-location / approximate-dimensions', source: 'CHARM A/C locator', mountTo: 'HVAC_CASE', location: 'Centre/driver side of HVAC case',
    geometryStatus: 'true_form_simplified', important: true, serviceRelevance: 'Do not confuse coolant connections with refrigerant connections.', notes: 'Shown as a separate finned core.', tags: ['hvac', 'cabin', 'cooling']
  },
  {
    id: 'HVAC_AIR_MIX_DOOR', displayName: 'Air-mix door', aliases: ['air mix damper'], system: 'HVAC', function: 'Directs airflow through or around the heater core.', connectsTo: ['HVAC_CASE'],
    fluidType: 'air', pressureSide: 'NONE', confidence: 'conceptual', source: 'CHARM A/C locator', mountTo: 'HVAC_CASE', location: 'Inside HVAC case', geometryStatus: 'orientation_only', important: false,
    serviceRelevance: 'Shown only where useful to understand case airflow.', notes: 'Pivot and door dimensions are conceptual.', tags: ['hvac', 'cabin', 'cutaway']
  },
  {
    id: 'HVAC_DRAIN_TUBE', displayName: 'Evaporator condensate drain tube', aliases: ['A/C drain'], system: 'HVAC', function: 'Drains water condensed on the evaporator to the underside of the vehicle.',
    connectsTo: ['HVAC_CASE'], fluidType: 'water', pressureSide: 'NONE', confidence: 'medium', source: 'factory HVAC relationship; exact installed capture needed', mountTo: 'HVAC_CASE',
    location: 'Bottom of evaporator case through lower firewall/floor area', geometryStatus: 'route_approximate', important: true, serviceRelevance: 'Not a refrigerant line.', notes: 'Exact exit location and grommet require physical capture.', tags: ['hvac', 'cabin', 'drain', 'uncertain']
  }
];

export const ROUTES = [
  {
    id: 'INTAKE_AIR_PATH', displayName: 'Air-cleaner to throttle-body intake path', aliases: ['intake hose', 'air intake duct', 'AFM duct'],
    system: 'INTAKE', pressureSide: 'NONE', fluidType: 'filtered intake air', from: 'LANDMARK_AIRBOX', to: 'ENGINE_1UZ_FE',
    direction: 'air cleaner toward throttle body', source: '1990 UCF10 EPC air-cleaner/EFI plates; CHARM intake/AFM service context; private hood-open references',
    confidence: 'factory topology / installed bend approximate', serviceRole: 'Engine-off inspection path; do not treat as a refrigerant or vacuum service route.',
    geometryStatus: 'continuous_photo_assembly_approximate',
    // FI-5 / EPC order is explicit here rather than a screen-relative arc:
    // low airbox outlet -> flanged rectangular AFM -> ribbed flex -> one
    // smooth elbow -> the physical silver crossbody/throttle casting.
    points: [[.401,-.630,.610],[.354,-.648,.620],[.286,-.724,.607],[.246,-.766,.603],[.204,-.810,.600],[.151,-.829,.610],[.107,-.790,.618],[.056,-.742,.641],[.006,-.686,.670],[-.029,-.626,.708],[-.066,-.566,.748],[-.137,-.506,.783],[-.220,-.474,.800],[-.270,-.515,.804],[-.285,-.585,.804],[-.285,-.565,.804],[-.285,-.278,.804],[-.182,-.321,.800]],
    sections: [{from:0,to:3,type:'rubber',radius:0.092},{from:3,to:5,type:'hard',radius:0.101},{from:5,to:9,type:'rubber',radius:0.106},{from:9,to:14,type:'rubber',radius:0.108},{from:14,to:17,type:'hard',radius:0.117}], crimps:[3,5], clamps:[3,5,9,15], flow:[0.12,0.38,0.64,0.88], tags:['intake','line','engine-bay','passenger-side','front-of-plenum','photo-layout']
  },
  {
    id: 'AC_DISCHARGE_LINE', legacyIds: ['AC-003', 'AC-004', 'AC-C001', 'AC-C002', 'AC-C003'], displayName: 'Compressor-to-condenser discharge line',
    aliases: ['high-pressure discharge hose and tube G'], system: 'AIR_CONDITIONING', pressureSide: 'HIGH', fluidType: 'high-pressure refrigerant vapor',
    from: 'AC_DISCHARGE_PORT', to: 'AC_CONDENSER_INLET', direction: 'compressor to condenser', source: 'EPC piping 17822845; EPC compressor 17822848',
    confidence: 'catalog route / installed bends approximate', serviceRole: 'Professional recovery boundary; approved flushable line only after removal/isolation under the exact procedure.',
    geometryStatus: 'continuous_true_form_approximate', points: [[0.18,0.27,0.57],[0.40,0.40,0.64],[0.66,0.55,0.67],[0.855,0.61,0.70]],
    sections: [{from:0,to:1,type:'flex',radius:0.022},{from:1,to:3,type:'hard',radius:0.013}], crimps:[1], clamps:[2], flow:[0.33,0.72], tags:['ac','line','engine-bay']
  },
  {
    id: 'AC_LIQUID_LINE_CONDENSER_DRIER', legacyIds: ['AC-C004'], displayName: 'Condenser-to-receiver liquid line', aliases: ['condenser outlet tube'],
    system: 'AIR_CONDITIONING', pressureSide: 'HIGH', fluidType: 'high-pressure liquid refrigerant', from: 'AC_CONDENSER_OUTLET', to: 'AC_RECEIVER_DRIER',
    direction: 'condenser to receiver-drier', source: '12/1989 Amayama EPC MEP439E/MEP444E', partNumbers: ['88716-50010'], confidence: 'catalog route / installed bends approximate',
    serviceRole: 'Do not flush through the receiver-drier.', geometryStatus: 'continuous_true_form_approximate', points: [[0.855,-0.62,0.48],[0.86,-0.69,0.50],[0.845,-0.69,0.58]],
    sections: [{from:0,to:2,type:'hard',radius:0.011}], crimps:[], clamps:[1], flow:[0.50], tags:['ac','line','engine-bay']
  },
  {
    id: 'AC_LIQUID_LINE_DRIER_FIREWALL', legacyIds: ['AC-007','AC-008','AC-009','AC-C005','AC-C006','AC-C007','AC-C008','AC-C009'], displayName: 'Receiver-to-firewall liquid-line group',
    aliases: ['liquid pipes A/B/C/D/E'], system: 'AIR_CONDITIONING', pressureSide: 'HIGH', fluidType: 'high-pressure liquid refrigerant', from: 'AC_RECEIVER_DRIER', to: 'AC_EXPANSION_VALVE',
    direction: 'receiver-drier toward expansion valve', source: '12/1989 Amayama EPC MEP444E/MEQ413D', partNumbers: ['88716-50010','88716-50030','88716-50050','88716-50020','88716-50070'], confidence: 'catalog sequence / installed routing approximate',
    serviceRole: 'Isolate receiver-drier and expansion valve before any approved line flushing.', geometryStatus: 'continuous_true_form_approximate',
    points: [[0.845,-0.69,0.59],[0.83,-0.70,0.79],[0.65,-0.75,0.78],[0.35,-0.78,0.81],[-0.02,-0.79,0.82],[-0.34,-0.78,0.84],[-0.62,-0.69,0.85],[-0.82,-0.58,0.80],[-0.98,-0.47,0.72]],
    sections: [{from:0,to:8,type:'hard',radius:0.010}], crimps:[], clamps:[2,4,6,7], flow:[0.16,0.42,0.70,0.90], tags:['ac','line','engine-bay','uncertain']
  },
  {
    id: 'AC_EVAPORATOR_FEED_INTERNAL', legacyIds: ['AC-C010'], displayName: 'Expansion-valve-to-evaporator feed', aliases: ['metered evaporator inlet'], system: 'AIR_CONDITIONING',
    pressureSide: 'LOW', fluidType: 'low-pressure refrigerant mixture', from: 'AC_EXPANSION_VALVE', to: 'AC_EVAPORATOR', direction: 'expansion valve to evaporator',
    source: 'CHARM A/C locator', confidence: 'hidden route approximate', serviceRole: 'Internal sealed connection; do not flush through the expansion valve.', geometryStatus: 'continuous_true_form_approximate',
    points: [[-1.00,-0.47,0.72],[-1.10,-0.45,0.70],[-1.19,-0.42,0.70]], sections: [{from:0,to:2,type:'hard',radius:0.009}], crimps:[], clamps:[], flow:[0.55], tags:['ac','line','cabin','no-flush']
  },
  {
    id: 'AC_EVAPORATOR_RETURN_INTERNAL', legacyIds: ['AC-C011'], displayName: 'Evaporator outlet to EPR', aliases: ['evaporator suction outlet'], system: 'AIR_CONDITIONING', pressureSide: 'LOW',
    fluidType: 'low-pressure refrigerant vapor', from: 'AC_EVAPORATOR', to: 'AC_EPR', direction: 'evaporator to EPR', source: 'CHARM A/C locator; CHARM evaporator service',
    confidence: 'hidden route approximate', serviceRole: 'Do not flush through the EPR.', geometryStatus: 'continuous_true_form_approximate', points: [[-1.20,-0.37,0.62],[-1.10,-0.38,0.64],[-1.01,-0.41,0.67]],
    sections: [{from:0,to:2,type:'hard',radius:0.018}], crimps:[], clamps:[], flow:[0.50], tags:['ac','line','cabin','no-flush']
  },
  {
    id: 'AC_SUCTION_LINE', legacyIds: ['AC-013','AC-014','AC-C012','AC-C013','AC-C017'], displayName: 'Firewall-to-compressor suction-line group', aliases: ['suction pipes and hoses A/B/C'],
    system: 'AIR_CONDITIONING', pressureSide: 'LOW', fluidType: 'low-pressure refrigerant vapor', from: 'AC_EPR', to: 'AC_SUCTION_PORT', direction: 'firewall/EPR to compressor',
    source: '12/1989 Amayama EPC MEP444E/MEQ413D; Lexus L-AC003-91 and TSB0054L pre-5/91 suction-pipe illustration', partNumbers: ['88717-50090','88712-50040','88717-50010','88717-50020','88712-50010'], confidence: 'factory silhouette and sequence / installed bends approximate', serviceRole: 'Professional recovery boundary. Isolate compressor and EPR before approved line flushing.',
    geometryStatus: 'continuous_true_form_approximate', points: [[-1.00,-0.42,0.67],[-0.76,-0.43,0.79],[-0.43,-0.34,0.88],[-0.30,-0.54,0.76],[-0.10,-0.65,0.61],[0.22,-0.67,0.47],[0.54,-0.55,0.37],[0.55,-0.10,0.34],[0.32,0.15,0.42],[0.15,0.29,0.58]],
    sections: [{from:0,to:3,type:'hard',radius:0.018},{from:3,to:5,type:'flex',radius:0.026},{from:5,to:8,type:'hard',radius:0.018},{from:8,to:9,type:'flex',radius:0.026}], crimps:[3,5,8], clamps:[1,4,6,7], flow:[0.14,0.38,0.65,0.86], notes:'Target predates the May-1991 oil-tank suction pipe 88717-50100; no oil reservoir is modeled.', tags:['ac','line','engine-bay','pre-5-91']
  },
  {
    id: 'AC_EQUALIZER_TUBE', legacyIds: ['AC-017','AC-C018','AC-C019'], displayName: 'EPR equalizer tube', aliases: ['pressure reference tube'], system: 'AIR_CONDITIONING', pressureSide: 'LOW',
    fluidType: 'refrigerant pressure reference', from: 'AC_EVAPORATOR', to: 'AC_EPR', direction: 'pressure reference', source: 'CHARM A/C locator; CHARM evaporator service',
    confidence: 'hidden route approximate', serviceRole: 'Restricted path; never include in a generic solvent-flush selection.', geometryStatus: 'continuous_true_form_approximate',
    points: [[-1.18,-0.35,0.75],[-1.10,-0.35,0.77],[-1.02,-0.40,0.72]], sections: [{from:0,to:2,type:'hard',radius:0.004}], crimps:[], clamps:[1], flow:[], tags:['ac','line','cabin','no-flush']
  },
  {
    id: 'HVAC_DRAIN_ROUTE', displayName: 'Evaporator drain tube', aliases: ['condensate drain'], system: 'HVAC', pressureSide: 'NONE', fluidType: 'water', from: 'HVAC_CASE', to: 'HVAC_DRAIN_TUBE',
    direction: 'gravity drain', source: 'HVAC relationship; physical capture required', confidence: 'approximate', serviceRole: 'Not a refrigerant line.', geometryStatus: 'continuous_approximate',
    points: [[-1.16,-0.42,0.46],[-1.12,-0.43,0.31],[-1.06,-0.43,0.20]], sections: [{from:0,to:2,type:'flex',radius:0.010}], crimps:[], clamps:[1], flow:[0.55], tags:['hvac','line','cabin','uncertain']
  },
  {
    id: 'COOLING_UPPER_HOSE', displayName: 'Upper radiator hose', system: 'COOLING', pressureSide: 'NONE', fluidType: 'engine coolant', from: 'ENGINE_1UZ_FE', to: 'LANDMARK_RADIATOR', direction: 'engine to radiator',
    source: 'RM144U CO-12; user engine-bay photos', confidence: 'photo-bend approximate', serviceRole: 'Cooling-system context only.', geometryStatus: 'continuous_context', points: [[-0.02,0.04,0.82],[0.27,0.08,0.79],[0.68,0.16,0.72]],
    sections: [{from:0,to:2,type:'flex',radius:0.028}], crimps:[], clamps:[0,2], flow:[], tags:['context-line','engine-bay']
  },
  {
    id: 'COOLING_LOWER_HOSE', displayName: 'Lower radiator hose', system: 'COOLING', pressureSide: 'NONE', fluidType: 'engine coolant', from: 'LANDMARK_RADIATOR', to: 'ENGINE_1UZ_FE', direction: 'radiator to water pump',
    source: 'RM144U CO-12; installed route approximate', confidence: 'photo-bend approximate', serviceRole: 'Cooling-system context only.', geometryStatus: 'continuous_context', points: [[0.68,-0.18,0.42],[0.30,-0.12,0.38],[0.05,-0.08,0.44]],
    sections: [{from:0,to:2,type:'flex',radius:0.030}], crimps:[], clamps:[0,2], flow:[], tags:['context-line','engine-bay']
  },
  {
    id: 'HVAC_HEATER_HOSE_FEED', displayName: 'Heater hose feed', system: 'COOLING', pressureSide: 'NONE', fluidType: 'engine coolant', from: 'ENGINE_1UZ_FE', to: 'HVAC_HEATER_CORE', direction: 'engine to heater core',
    source: 'coolant diagram; user photos', confidence: 'approximate', serviceRole: 'Do not confuse with refrigerant lines.', geometryStatus: 'continuous_context', points: [[-0.55,0.18,0.76],[-0.85,0.12,0.82],[-1.02,0.05,0.78]],
    sections: [{from:0,to:2,type:'flex',radius:0.016}], crimps:[], clamps:[1], flow:[], tags:['context-line','engine-bay']
  },
  {
    id: 'HVAC_HEATER_HOSE_RETURN', displayName: 'Heater hose return', system: 'COOLING', pressureSide: 'NONE', fluidType: 'engine coolant', from: 'HVAC_HEATER_CORE', to: 'ENGINE_1UZ_FE', direction: 'heater core to engine',
    source: 'coolant diagram; user photos', confidence: 'approximate', serviceRole: 'Do not confuse with refrigerant lines.', geometryStatus: 'continuous_context', points: [[-1.02,0.10,0.74],[-0.82,0.22,0.76],[-0.52,0.25,0.71]],
    sections: [{from:0,to:2,type:'flex',radius:0.016}], crimps:[], clamps:[1], flow:[], tags:['context-line','engine-bay']
  },
  {
    id: 'ELECTRICAL_AC_HARNESS', displayName: 'A/C electrical branch', system: 'ELECTRICAL', pressureSide: 'NONE', fluidType: 'electricity', from: 'LANDMARK_BODY_SHELL', to: 'AC_COMPRESSOR_CLUTCH', direction: 'controlled power/signal',
    source: 'EWD070U acquired; circuit extraction and physical loom routing remain', confidence: 'approximate', serviceRole: 'Battery isolation and factory procedure required.', geometryStatus: 'continuous_context', points: [[-0.95,0.58,0.82],[-0.45,0.68,0.74],[0.05,0.43,0.62],[0.18,0.27,0.51]],
    sections: [{from:0,to:3,type:'wire',radius:0.005}], crimps:[], clamps:[1,2], flow:[], tags:['context-line','engine-bay','electrical','uncertain']
  },
  {
    id: 'BRAKE_VACUUM_HOSE', displayName: 'Brake-booster vacuum hose', system: 'BRAKES', pressureSide: 'NONE', fluidType: 'vacuum', from: 'ENGINE_1UZ_FE', to: 'LANDMARK_BRAKE_BOOSTER', direction: 'engine vacuum to booster through check valve',
    source: 'RM144U BR-14; user photos', confidence: 'photo-bend approximate', serviceRole: 'Safety-critical brake context; never alter based on this model.', geometryStatus: 'continuous_context', points: [[-0.34,0.18,0.94],[-0.58,0.38,0.93],[-0.78,0.54,0.90],[-0.915,0.61,0.845]],
    sections: [{from:0,to:2,type:'flex',radius:0.014}], crimps:[], clamps:[1], flow:[], tags:['context-line','engine-bay','brakes']
  },
  {
    id: 'POWER_STEERING_HIGH_PRESSURE', displayName: 'Power-steering pressure hose', system: 'POWER_STEERING', pressureSide: 'NONE', fluidType: 'power-steering fluid', from: 'ENGINE_POWER_STEERING_PUMP', to: 'LANDMARK_FRONT_FRAME_RAILS', direction: 'pump to steering gear',
    source: 'catalog relationship; installed route approximate', confidence: 'approximate', serviceRole: 'Hydraulic context only.', geometryStatus: 'continuous_context', points: [[0.20,0.38,0.55],[-0.02,0.55,0.42],[-0.35,0.60,0.28]],
    sections: [{from:0,to:1,type:'flex',radius:0.012},{from:1,to:2,type:'hard',radius:0.009}], crimps:[1], clamps:[], flow:[], tags:['context-line','engine-bay','power-steering']
  },
  {
    id: 'POWER_STEERING_RETURN', displayName: 'Power-steering return hose', system: 'POWER_STEERING', pressureSide: 'NONE', fluidType: 'power-steering fluid', from: 'LANDMARK_FRONT_FRAME_RAILS', to: 'ENGINE_POWER_STEERING_PUMP', direction: 'steering gear to reservoir/pump',
    source: 'Lexus L-ST001-90 pre-4/90 No. 2/No. 3 return-tube illustration', confidence: 'factory location / bends approximate', serviceRole: 'Hydraulic context only.', geometryStatus: 'continuous_context', points: [[0.62,0.58,0.28],[0.48,0.48,0.30],[0.35,0.41,0.36],[0.20,0.32,0.52]],
    sections: [{from:0,to:3,type:'hard',radius:0.010}], crimps:[], clamps:[1,2], flow:[], notes:'Uses the tighter pre-April-1990 return-tube bend applicable to the December-1989 target.', tags:['context-line','engine-bay','power-steering','pre-4-90']
  }
];

export const CAMERA_PRESETS = {
  // High-angle native-photo viewpoint verified against visible bay corners,
  // cowl and the component landmark set.  The frame is 800 × 489.
  ENGINE_BAY_PHOTO_LAYOUT: { label: 'Engine bay — photo layout', ...MODEL_FOUNDATION_METRES.camera, hood: 1, hideHood: true, hideBumper: true, hideSplash: true },
  FULL_VEHICLE_HOOD_OPEN_VIEW: { label: 'Full vehicle — hood open', position: [3.25,0,1.68], target: [-0.05,0,1.15], fov: 55, hood: 1 },
  FRONT_STANDING: { label: 'Standing centered in front', position: [3.10,0,1.62], target: [0.00,0,0.70], fov: 46, hood: 1 },
  FRONT_PASSENGER_CORNER: { label: 'Front passenger-side corner', position: [2.55,-1.85,1.48], target: [0.00,-0.15,0.67], fov: 46, hood: 1 },
  FRONT_DRIVER_CORNER: { label: 'Front driver-side corner', position: [2.55,1.85,1.48], target: [0.00,0.15,0.67], fov: 46, hood: 1 },
  LEAN_PASSENGER_FENDER: { label: 'Leaning over passenger fender', position: [0.60,-1.16,1.38], target: [-0.18,-0.25,0.62], fov: 48, hood: 1 },
  LEAN_DRIVER_FENDER: { label: 'Leaning over driver fender', position: [0.60,1.16,1.38], target: [-0.18,0.25,0.62], fov: 48, hood: 1 },
  PASSENGER_HEADLIGHT: { label: 'Beside passenger headlight', position: [1.25,-1.08,1.15], target: [0.48,-0.60,0.62], fov: 44, hood: 1 },
  DRIVER_HEADLIGHT: { label: 'Beside driver headlight', position: [1.25,1.08,1.15], target: [0.48,0.60,0.62], fov: 44, hood: 1 },
  KNEELING_FRONT_BUMPER: { label: 'Kneeling at front bumper', position: [1.70,0,0.78], target: [0.55,0,0.52], fov: 46, hood: 1 },
  UNDER_FRONT_BUMPER: { label: 'Working below front bumper', position: [1.18,0,0.22], target: [0.32,0,0.42], fov: 54, hood: 1, hideSplash: true },
  UNDER_COMPRESSOR: { label: 'Looking upward below compressor', position: [0.52,0.67,0.17], target: [0.27,0.40,0.53], fov: 55, hood: 1, hideSplash: true },
  THROUGH_GRILLE: { label: 'Through grille toward condenser', position: [1.18,0,0.62], target: [0.58,0,0.58], fov: 48, hood: 1, hideBumper: true },
  PASSENGER_FIREWALL: { label: 'Passenger-side firewall', position: [-0.35,-1.05,1.25], target: [-0.98,-0.47,0.70], fov: 46, hood: 1 },
  DRIVER_FIREWALL: { label: 'Driver-side firewall', position: [-0.35,1.05,1.25], target: [-1.00,0.52,0.78], fov: 46, hood: 1 },
  PASSENGER_FOOTWELL: { label: 'Passenger footwell — glovebox removed', position: [-1.98,-0.84,0.88], target: [-1.15,-0.36,0.66], fov: 52, hood: 1, cutaway: true, allowInside: true },
  HVAC_CASE_CUTAWAY: { label: 'HVAC case cutaway', position: [-1.95,-1.35,1.15], target: [-1.18,-0.32,0.66], fov: 48, hood: 1, cutaway: true, allowInside: true },
  AC_COMPRESSOR_CLOSE: { label: 'Compressor and fittings close-up', position: [-0.30,1.20,1.05], target: [0.29,0.40,0.50], fov: 42, hood: 1, hideSplash: true },
  RECEIVER_DRIER_CLOSE: { label: 'Receiver-drier behind headlight', position: [1.48,-1.38,1.24], target: [0.59,-0.71,0.62], fov: 42, hood: 1 },
  CONDENSER_STACK: { label: 'Condenser / radiator relationship', position: [2.05,-1.00,1.28], target: [0.58,0,0.58], fov: 46, hood: 1, hideBumper: true },
  LEGACY_BAY_AUDIT_VIEW: { label: 'Before/after bay audit angle', position: [2.55,-1.95,1.75], target: [-0.10,0,0.62], fov: 45, hood: 1 }
};

export const REFERENCE_IMAGES = [
  { id: 'USER_FRONT_HOOD_OPEN', label: 'Private listing reference — front hood open', src: 'references/user-1990-ls400-hood-open.webp', pose: 'FULL_VEHICLE_HOOD_OPEN_VIEW', landmarks: 'headlights, bumper, radiator support, twin fans, engine-bay opening, hood', rights: 'Private working reference only; Bring a Trailer/Google provenance detected. Do not publish without permission.' },
  { id: 'USER_ENGINE_TOP_1990', label: 'Private unprovenanced reference — engine top', src: 'references/user-1990-ls400-inline1.jpg', pose: 'ENGINE_BAY_PHOTO_LAYOUT', landmarks: 'bay corners, strut towers, firewall/cowl, radiator support, 1UZ intake, passenger airbox/AFM/duct, driver battery/fuse, brake booster', rights: 'Private working reference only; source, model year and reuse permission are not documented.' },
  { id: 'USER_ENGINE_TOP_1991', label: 'Private unprovenanced reference — 1991/TRAC bay', src: 'references/user-1991-ls400-7-1.jpg', pose: 'FRONT_STANDING', landmarks: 'hood/cowl, battery, airbox, radiator cover, engine placement', rights: 'Private working reference only; source and reuse permission are not documented. TRAC-specific details must not define the neutral baseline.' },
  { id: 'FACTORY_AC_LOCATOR', label: 'Private factory-derived — 1990 CHARM A/C locator', src: 'references/charm-ac-locations.png', pose: 'FRONT_PASSENGER_CORNER', landmarks: 'receiver, condenser/fans, compressor, EPR, expansion valve, HVAC case', rights: 'Private research reference; unofficial-mirror/factory-derived image is not cleared for redistribution.' },
  { id: 'EPC_AC_PIPING', label: 'Private factory-derived — EPC cooler piping', src: 'references/epc-ac-piping.png', pose: 'PASSENGER_FIREWALL', landmarks: 'pipe groups, clamps, hose transitions, fittings', rights: 'Private research reference; OEM-derived catalog plate is not cleared for redistribution.' },
  { id: 'EPC_CONDENSER', label: 'Private factory-derived — EPC condenser/receiver/fans', src: 'references/epc-ac-condenser-fans.png', pose: 'CONDENSER_STACK', landmarks: 'condenser frame, receiver, brackets, fan shrouds', rights: 'Private research reference; OEM-derived catalog plate is not cleared for redistribution.' },
  { id: 'EPC_COMPRESSOR', label: 'Private factory-derived — EPC compressor/clutch', src: 'references/epc-ac-compressor.png', pose: 'AC_COMPRESSOR_CLOSE', landmarks: 'cast sections, pulley, clutch, manifold ports', rights: 'Private research reference; OEM-derived catalog plate is not cleared for redistribution.' },
  { id: 'EPC_121989_RECEIVER_FANS', label: 'Private OEM-catalog reference — 12/1989 receiver/condenser/fans', src: 'references/newdocs/epc-cooler-piping-schema1.png', pose: 'CONDENSER_STACK', landmarks: 'receiver top block, pressure switch, condenser brackets, paired fan assemblies', rights: 'Private research reference; OEM catalogue plate is not cleared for redistribution.' },
  { id: 'EPC_121989_ENGINE_PIPING', label: 'Private OEM-catalog reference — 12/1989 engine-bay piping', src: 'references/newdocs/epc-cooler-piping-schema2.png', pose: 'PASSENGER_FIREWALL', landmarks: 'liquid A/C/D/E, suction B/C/E, flex transitions, clamps and service fitting', rights: 'Private research reference; OEM catalogue plate is not cleared for redistribution.' },
  { id: 'EPC_121989_HVAC_TUBES', label: 'Private OEM-catalog reference — 12/1989 HVAC tube assemblies', src: 'references/newdocs/epc-cooler-piping-schema3.png', pose: 'HVAC_CASE_CUTAWAY', landmarks: 'tube assemblies C/D/E, firewall connections, clamp sequence', rights: 'Private research reference; OEM catalogue plate is not cleared for redistribution.' },
  { id: 'LICENSED_EXTERIOR', label: 'Public-domain UCF10R rear three-quarter', src: 'references/licensed-ucf10-exterior.jpg', pose: 'FRONT_DRIVER_CORNER', landmarks: 'body proportion, greenhouse, wheelbase, bumper height', rights: 'Public-domain exterior reference; Australian RHD UCF10R, not an exact U.S. 1990 underhood source.' }
];

export const UNCERTAINTIES = [
  'The working target is December 1989 U.S. UCF10L with CA emissions and air suspension; VIN-level confirmation is still not supplied.',
  'Installed refrigerant, oil, retrofit adapters and conversion workmanship cannot be determined from photographs.',
  'Exact A/C tube bend coordinates, clamp holes, fitting clocking and under-cover access need physical measurements or scan data.',
  'The high service access is placed on receiver-side liquid pipe A from the early EPC, but the exact Dec-1989 valve/cap configuration needs physical confirmation.',
  'The early EPC establishes the A/B/C/D/E and suction B/C/E sequence; installed centerlines and fitting clock angles remain provisional until measured.',
  'EPR and expansion-valve hidden dimensions are approximate because no measured HVAC-case scan is available.',
  'Full body, hood hinge, bumper reinforcement, dashboard and underbody shapes are recognizable service landmarks, not production CAD.'
];

export const ACCEPTANCE_STEPS = [
  'Isolate the complete A/C system.',
  'Select the compressor and identify suction and discharge connections.',
  'Trace compressor discharge to the condenser.',
  'Trace condenser liquid flow through the receiver-drier toward the firewall.',
  'Trace low-side suction flow from firewall/EPR to compressor.',
  'Show condenser relative to radiator and front bumper.',
  'Show receiver-drier relative to passenger headlight and radiator support.',
  'Show evaporator and expansion-valve area with cabin/firewall cutaway.',
  'Display high/low service ports and fitting locations with uncertainty labels.',
  'Compare a saved model pose against a real reference image.',
  'Run validation with zero unexplained disconnected A/C lines.',
  'Display every remaining uncertainty honestly.'
];

// Derived from the RM144U A/C removal sections, the 1990 UCF10 EPC crosswalk,
// and Lexus AC001-98.  These are locator and decision steps, never a substitute
// for recovery equipment, a refrigerant identifier, or the exact factory procedure.
export const AC_SERVICE_WALKTHROUGH = [
  {
    title: '1. Lock the car and refrigerant configuration',
    target: 'Read the under-hood labels, installed fitting adapters, receiver label and service history before selecting a procedure.',
    detail: 'The baseline is a 1990 UCF10L-AEPGKA with R-12 context, but VIN/build month and installed hardware control the exact parts. Unknown, mixed or contaminated refrigerant is a hard stop: identify it professionally before connecting recovery equipment.',
    primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_ENGINE_BAY',
    landmarks: 'Passenger headlight → radiator support → receiver/drier top block.',
    boundaries: 'Do not treat fittings or labels alone as proof of refrigerant or oil type.',
    source: 'RM144U service information; job_ac_service configuration profiles'
  },
  {
    title: '2. Choose the correct branch: original R-12 or verified Lexus R-134a retrofit',
    target: 'Use the verified configuration to select materials and charging data; do not mix the two oil specifications.',
    detail: 'Factory R-12 is 1,050 g / 2.3 lb with mineral oil context. The Lexus AC001-98 retrofit branch specifies R-134a, 1,000 g, ND-OIL 8 PAG, receiver 88471-16050, both service adapters, listed O-rings and retrofit labels. AC001-98 says flushing original mineral oil is not required for that approved retrofit.',
    primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_HIGH',
    landmarks: 'Receiver-side liquid pipe and service fitting at the passenger-front support.',
    boundaries: 'After retrofit, a cloudy sight glass is expected; charge by specified mass, never sight-glass clarity.',
    source: 'Lexus AC001-98; job_ac_service configuration profiles'
  },
  {
    title: '3. Recover, identify and verify zero pressure before any joint is considered',
    target: 'This is the safety gate that unlocks planning boundaries in the model.',
    detail: 'Recovery must occur before a repair expected to release refrigerant. Never vent R-12, R-134a or substitutes. Cap every opening once a qualified technician has recovered the verified refrigerant and independently confirmed zero retained pressure.',
    primaryId: 'AC_LOW_SERVICE_PORT', camera: 'PASSENGER_FIREWALL', isolation: 'AC_COMPLETE',
    landmarks: 'Low-side suction assembly in the passenger-side rear engine bay; high-side liquid/service fitting at the passenger-front receiver area.',
    boundaries: 'The service ports are equipment connections, not flush-injection points or proof that the system is empty.',
    source: 'EPA MVAC boundary; job_ac_service safety gate'
  },
  {
    title: '4. Expose and replace the receiver/drier — do not flush through it',
    target: 'Work from the passenger-front corner, behind the right/passenger headlamp, after recovery.',
    detail: 'The factory removal path calls for right-headlamp access, then both liquid tubes are disconnected and capped. The receiver/drier is a replace-not-flush component; the manual-derived torque data lists 5.4 N·m for the receiver liquid-tube joints. Keep installed part and retrofit history visible in the decision record.',
    primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_HIGH',
    landmarks: 'Passenger headlight → receiver clamp → upper liquid-pipe block → radiator support.',
    boundaries: 'Receiver inlet and outlet are the external line boundaries; the canister itself stays out of a solvent path.',
    routes: ['AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL'], requiresPlanningGate: true,
    source: 'RM144U receiver removal/installation; EPC front piping'
  },
  {
    title: '5. Isolate the compressor at both manifold ports — do not generic-flush it',
    target: 'Locate the low front driver-side accessory-drive compressor and identify its two different ports.',
    detail: 'The small discharge connection begins the high side; the larger suction connection returns low-pressure vapor. Factory engine work can remove the compressor without disconnecting hoses, which is a useful orientation clue, not permission to open a charged circuit. A replacement compressor’s oil accounting must follow the verified configuration and maker instructions.',
    primaryId: 'AC_COMPRESSOR', camera: 'AC_COMPRESSOR_CLOSE', isolation: 'AC_ENGINE_BAY',
    landmarks: 'Driver-side lower front of 1UZ-FE → bracket → clutch/pulley → large suction and smaller discharge connections.',
    boundaries: 'Use the suction and discharge joints only as isolation boundaries; never push generic flush solvent through the compressor.',
    routes: ['AC_DISCHARGE_LINE', 'AC_SUCTION_LINE'], requiresPlanningGate: true,
    source: 'RM144U engine/compressor removal; EPC compressor plate'
  },
  {
    title: '6. Find the condenser and its two front-end joints',
    target: 'View the condenser in the front heat-exchanger stack before tracing either line.',
    detail: 'The condenser is behind the bumper/grille and ahead of the radiator, with the paired electric condenser fans in the front stack. Factory removal references bumper, two fans, center brace/horns and recovered/capped liquid and discharge tubes. The documented condenser discharge and liquid tube torque is 10 N·m; actual replacement-core design decides whether it is flushable.',
    primaryId: 'AC_CONDENSER', camera: 'CONDENSER_STACK', isolation: 'AC_HIGH',
    landmarks: 'Grille/bumper → fan pair → condenser → radiator; do not confuse the stack with the receiver behind the passenger headlamp.',
    boundaries: 'A parallel-flow/multiflow replacement core, severe metal contamination or leak-stop contamination takes the replacement path, not a solvent-flush assumption.',
    routes: ['AC_DISCHARGE_LINE', 'AC_LIQUID_LINE_CONDENSER_DRIER'], requiresPlanningGate: true,
    source: 'RM144U condenser removal/installation; EPC condenser/fans'
  },
  {
    title: '7. Trace only bare external line sections, one end-to-end section at a time',
    target: 'Use route highlighting to distinguish the discharge, condenser-to-receiver, receiver-to-firewall and suction groups.',
    detail: 'The EPC establishes hose/tube group identity, but not every installed bend, clamp clocking or internal restriction. Keep each removed section labeled by both endpoints and nearby landmarks. Bare, verified-unrestricted lines may be evaluated under the selected vendor procedure; sections containing a muffler, filter or unknown internal restriction are replacement candidates.',
    primaryId: 'AC_LIQUID_LINE_DRIER_FIREWALL', camera: 'PASSENGER_FIREWALL', isolation: 'AC_LINES',
    landmarks: 'Compressor discharge → condenser → passenger-front receiver → passenger firewall; EPR/suction route returns to the compressor.',
    boundaries: 'The animated arrows show normal operating flow, never solvent direction or an approved flush path.',
    routes: ['AC_DISCHARGE_LINE', 'AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL', 'AC_SUCTION_LINE'], requiresPlanningGate: true,
    source: 'UCF10 EPC piping; job_ac_service graph'
  },
  {
    title: '8. Stop at the expansion valve and EPR; expose the cabin-side context',
    target: 'Follow the passenger-side firewall area into the HVAC case without pretending hidden routing is measured.',
    detail: 'The expansion valve is in the cooling-unit/evaporator case and the EPR sits at the evaporator outlet/firewall area. The manual separates the expansion valve from the evaporator during case work and explicitly disconnects the EPR equalizer tube. Treat both as controls to isolate or replace, not flush-through fittings.',
    primaryId: 'AC_EXPANSION_VALVE', camera: 'HVAC_CASE_CUTAWAY', isolation: 'AC_CABIN',
    landmarks: 'Passenger firewall pass-through → expansion valve/HVAC case → evaporator → EPR → suction return.',
    boundaries: 'The equalizer tube is a control branch, not a main-flow hose; its exact far endpoint remains a physical-trace item.',
    routes: ['AC_EVAPORATOR_FEED_INTERNAL', 'AC_EVAPORATOR_RETURN_INTERNAL', 'AC_EQUALIZER_TUBE', 'AC_SUCTION_LINE'], requiresPlanningGate: true,
    source: 'RM144U evaporator/case disassembly; EPC cooler unit'
  },
  {
    title: '9. Reassemble with configuration-matched parts, oil and sealing data',
    target: 'Use only the branch selected in Step 2 and the installed-car inspection record.',
    detail: 'For factory R-12 component replacement, oil additions are component-specific: receiver 20 cc; condenser or evaporator 40–50 cc; pipe over 3 ft 5 cc. Do not combine that schedule with the retrofit PAG quantity. Factory joint values represented here are 32 N·m for condenser suction tube, 10 N·m for condenser discharge/liquid, evaporator liquid/suction and EPR equalizer, and 5.4 N·m for receiver liquid tubes.',
    primaryId: 'AC_EPR', camera: 'PASSENGER_FIREWALL', isolation: 'AC_COMPLETE',
    landmarks: 'Verify each capped joint against its highlighted component and local landmark before reassembly.',
    boundaries: 'Torque applies to the named factory joint, not every visually similar fitting; confirm the exact procedure and installed part.',
    source: 'RM144U specifications; job_ac_service factory_service_specs'
  },
  {
    title: '10. Evacuate, leak-test and charge by verified specification',
    target: 'Close the loop only after every cap, fitting, O-ring and replaced component is documented.',
    detail: 'Evacuation, leak testing, charging and final performance verification belong to the qualified procedure and the verified refrigerant branch. Charge by specified mass, not by the R-134a retrofit sight glass. Preserve labels, record the refrigerant/oil used, and stop for an unexplained leak, restriction or contamination result.',
    primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'FRONT_PASSENGER_CORNER', isolation: 'AC_COMPLETE',
    landmarks: 'High-side receiver/front support area and low-side suction return are the service-equipment reference points.',
    boundaries: 'Never open a high-side manifold valve with the engine running or charge liquid refrigerant into a running system.',
    source: 'Lexus AC001-98; MVAC safety boundary'
  }
];

export const AC_RECEIVER_DRIER_REPLACEMENT_GUIDE = [
  { title: '1. Receiver-only scope: identify the two and only two receiver joints', target: 'This branch removes only the receiver/drier; it does not require opening the compressor, condenser, expansion valve, EPR or firewall joints.', detail: 'At the passenger-front corner, the receiver is behind/inboard of the vehicle-right headlamp on the radiator support. Its two top fittings are the only refrigerant joints opened for factory receiver removal.', primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_HIGH', landmarks: 'Vehicle-right/passenger headlamp → radiator support → receiver clamp → two liquid-tube bolts.', boundaries: 'Do not use the service ports, pressure switch, sight glass, compressor ports or firewall connections as receiver-removal disconnects.', source: 'RM144U AC-31 receiver removal; UCF10 EPC front-piping crosswalk' },
  { title: '2. Open right-headlamp access, then satisfy the recovery gate', target: 'Remove the vehicle-right/passenger headlamp for receiver access; recover the identified refrigerant and independently verify zero retained pressure before touching either line bolt.', detail: 'The factory sequence lists the right headlamp first, then refrigerant discharge/recovery. Cap supplies must be ready before either receiver fitting is opened.', primaryId: 'LANDMARK_PASSENGER_HEADLIGHT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_ENGINE_BAY', landmarks: 'Passenger headlamp directly ahead of the receiver; receiver is not a lower bumper or compressor access job.', boundaries: 'No refrigerant joint is authorized by visual inspection alone.', source: 'RM144U AC-31 steps 1–2; MVAC recovery gate' },
  { title: '3. Disconnect the upstream liquid tube: condenser outlet → receiver inlet', target: 'Remove one of the two receiver liquid-tube bolts and trace the capped tube forward to the condenser outlet/front heat-exchanger stack.', detail: 'This is the modeled AC_LIQUID_LINE_CONDENSER_DRIER group. It is high-side liquid pipework between the condenser and receiver; the EPC establishes the relationship, while exact installed bends remain vehicle-trace items.', primaryId: 'AC_LIQUID_LINE_CONDENSER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_HIGH', landmarks: 'Receiver top fitting → forward/front support area → condenser outlet behind grille/fans.', boundaries: 'Cap the tube and receiver fitting immediately. Do not disconnect it at the condenser merely to remove the receiver.', routes: ['AC_LIQUID_LINE_CONDENSER_DRIER'], requiresPlanningGate: true, source: 'RM144U AC-31 step 3; connections AC-C004' },
  { title: '4. Disconnect the downstream liquid tube: receiver outlet → firewall/expansion-valve family', target: 'Remove the second receiver liquid-tube bolt and trace this capped tube rearward along the passenger-side high-side route toward the firewall.', detail: 'This is the modeled AC_LIQUID_LINE_DRIER_FIREWALL group. It represents the receiver-to-firewall/expansion-valve pipe family; individual A/B/C/D/E segment order must be confirmed on the target car.', primaryId: 'AC_LIQUID_LINE_DRIER_FIREWALL', camera: 'PASSENGER_FIREWALL', isolation: 'AC_HIGH', landmarks: 'Other receiver top fitting → rearward passenger-side liquid route → firewall/HVAC case.', boundaries: 'Cap immediately. Leave the expansion-valve, EPR and firewall joints sealed for receiver-only replacement.', routes: ['AC_LIQUID_LINE_DRIER_FIREWALL'], requiresPlanningGate: true, source: 'RM144U AC-31 step 3; crosswalk rear_liquid_line_group; connections AC-C005' },
  { title: '5. Remove only the receiver from its holder', target: 'With both receiver fittings capped, remove the single receiver-holder bolt and lift out the receiver/drier.', detail: 'The factory procedure does not call for disconnecting the compressor, condenser or cabin-side components to replace the receiver. Keep both removed tubes identified as upstream condenser-side and downstream firewall-side.', primaryId: 'AC_RECEIVER_DRIER_BRACKET', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'HARDWARE', landmarks: 'Receiver cylinder → clamp/holder → support-mounted holder bolt.', boundaries: 'The receiver is replace-not-flush. Do not pour or push flush solvent through it.', requiresPlanningGate: true, source: 'RM144U AC-31 step 4' },
  { title: '6. Optional flush is a separate line-by-line decision, not part of receiver removal', target: 'If contamination diagnosis calls for flushing, first re-evaluate each removed bare line section and the installed condenser design.', detail: 'Receiver removal alone does not create a universal “flush the rest” path. Do not generic-flush the compressor, receiver, expansion valve or EPR. A parallel-flow/multiflow condenser, muffled/restricted hose, metal debris or leak-stop may require replacement instead. Any additional disconnect must follow its own component-specific procedure.', primaryId: 'AC_LIQUID_LINE_DRIER_FIREWALL', camera: 'PASSENGER_FIREWALL', isolation: 'AC_LINES', landmarks: 'The two receiver-separated line groups are visible; all other sealed components stay context-only unless a separate approved procedure is selected.', boundaries: 'Vacuum is performed only after the selected eligible sections are reassembled, capped connections are removed at assembly, and the system is closed.', routes: ['AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL'], requiresPlanningGate: true, source: 'job_ac_service flush classes; Denso/Four Seasons component exclusions' },
  { title: '7. Install the new receiver, reconnect both tubes, then evacuate/test/charge', target: 'Install receiver in holder, reconnect the same two labeled tubes, and keep caps on until each tube is connected.', detail: 'RM144U specifies 5.4 N·m for each receiver liquid-tube joint. For an original verified R-12 receiver replacement, the manual calls for 20 cc DENSOOIL 6/SUNISO 5GS-equivalent oil; do not mix that schedule with the Lexus R-134a retrofit oil profile. Evacuate, leak-test and charge only under the verified configuration procedure.', primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_HIGH', landmarks: 'Receiver holder bolt → forward condenser-side tube → rearward firewall-side tube → right headlamp reinstallation.', boundaries: 'Charge by the verified system specification; the retrofit sight glass is not a charge-setting tool.', routes: ['AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL'], requiresPlanningGate: true, source: 'RM144U AC-32 installation; Lexus AC001-98 retrofit boundary' }
];

export const AC_FLUSH_AND_EVACUATION_GUIDE = [
  { title: '1. Choose clean, flush, or replace before opening more joints', target: 'A receiver-only replacement is not automatically a system-flush job.', detail: 'Flush is considered for incorrect oil or unapproved additives when the circuit is otherwise clean and free of black/metal debris. Leak-stop, imitation/unknown refrigerant, severe contamination or visible metal calls for a conservative replacement plan rather than a generic flush.', primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'Use the full loop as a diagnostic map; record the actual failure mode and installed component construction.', boundaries: 'Unknown/mixed refrigerant is an identification stop, not a flush start.', source: 'Denso repair procedures 1–3; EPA MVAC requirements' },
  { title: '2. Recover first; then isolate each component before flushing', target: 'Use certified recovery equipment, identify refrigerant, confirm zero pressure, and cap every opened fitting.', detail: 'Connect approved service equipment only after confirming refrigerant type. The factory manifold setup starts with both hand valves closed; do not use service ports as a direct whole-loop flush path.', primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'High service fitting is in the receiver-side liquid area; low service fitting is on the suction side.', boundaries: 'Never intentionally vent refrigerant or open a charged joint.', source: 'RM144U AC-14/15; EPA MVAC servicing requirements' },
  { title: '3. Parts never generic-flushed: replace or isolate them', target: 'Keep these components outside every solvent path.', detail: 'Do not generic-flush the compressor, receiver/drier, expansion valve, EPR or equalizer tube. Replace the receiver/drier. Replace any hose containing a filter or muffler, and replace a restricted component. The compressor may only be cleaned under a procedure explicitly approved for the exact installed unit.', primaryId: 'AC_COMPRESSOR', camera: 'AC_COMPRESSOR_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'Compressor low front driver side; receiver passenger-front; TXV/EPR at passenger firewall/HVAC case.', boundaries: 'Do not route solvent through any of these controls, desiccant containers or restricted passages.', source: 'job_ac_service flush classes; Denso/Four Seasons exclusions' },
  { title: '4. Condenser: flush only after its installed core is proven eligible', target: 'Identify the actual condenser, not just the original part number.', detail: 'Tube-and-fin designs may be evaluated for flushing. Modern flat-tube multi-pass, flat-tube serpentine, parallel-flow/multiflow designs, cores with integral desiccant that cannot be removed, leak-stop contamination or severe debris are replace-not-flush cases.', primaryId: 'AC_CONDENSER', camera: 'CONDENSER_STACK', isolation: 'AC_HIGH', landmarks: 'Behind grille/bumper, ahead of radiator and fan pair; inlet is compressor-side, outlet goes toward receiver.', boundaries: 'For any eligible condenser flush, isolate it at its own inlet/outlet; receiver-only removal does not isolate the condenser.', routes: ['AC_DISCHARGE_LINE', 'AC_LIQUID_LINE_CONDENSER_DRIER'], requiresPlanningGate: true, source: 'Four Seasons flush instructions; Denso contamination guidance' },
  { title: '5. Evaporator: conditional core flush only after TXV/EPR isolation', target: 'Reach the evaporator through the passenger firewall/HVAC case; keep the expansion valve and EPR out of the solvent route.', detail: 'For catastrophic compressor failure, the evaporator is a contamination-retention area. Remove or positively isolate the expansion valve and EPR/control passages before evaluating the evaporator core. Replace if it cannot be cleaned and dried completely.', primaryId: 'AC_EVAPORATOR', camera: 'HVAC_CASE_CUTAWAY', isolation: 'AC_CABIN', landmarks: 'Passenger firewall pass-through → cooling unit → evaporator; EPR at outlet and expansion valve at feed.', boundaries: 'Do not treat the equalizer tube as a main refrigerant line or flush through it.', routes: ['AC_EVAPORATOR_FEED_INTERNAL', 'AC_EVAPORATOR_RETURN_INTERNAL'], requiresPlanningGate: true, source: 'RM144U HVAC-case disassembly; Four Seasons catastrophic-failure guidance' },
  { title: '6. Flush only eligible bare external lines, one disconnected section at a time', target: 'Trace each section by both endpoints before attaching the selected kit adapter.', detail: 'Evaluate the compressor-to-condenser discharge line, condenser-to-receiver liquid line, receiver-to-firewall liquid-line family and EPR-to-compressor suction group separately. Replace any line/hose that contains a muffler, filter or restriction; exact segment identity and routing remain target-vehicle trace items.', primaryId: 'AC_LIQUID_LINE_DRIER_FIREWALL', camera: 'PASSENGER_FIREWALL', isolation: 'AC_LINES', landmarks: 'Compressor → condenser → receiver → passenger firewall; low-side EPR/suction path returns to compressor.', boundaries: 'Additional end disconnects are required to isolate an individual line; follow the relevant factory component procedure, cap every other opening, and never create a solvent path through protected parts.', routes: ['AC_DISCHARGE_LINE', 'AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL', 'AC_SUCTION_LINE'], requiresPlanningGate: true, source: 'UCF10 EPC line groups; Four Seasons eligible-line exclusions' },
  { title: '7. Execute the selected kit procedure on one eligible isolated component', target: 'Use only dedicated flushing equipment, compatible solvent and a capture container; follow the kit and solvent instructions if they differ.', detail: 'The local Four Seasons 59172 instructions specify: attach capture, use regulated filtered shop air or dry nitrogen, 40 psi for initial solvent, ten-minute soak, then remainder of solvent; without interrupting flow, increase to 80 psi and air/nitrogen purge for 30 minutes. Set pressure to zero and close the shutoff before removing the adapter; repeat only if the component remains eligible.', primaryId: 'AC_DISCHARGE_LINE', camera: 'AC_COMPRESSOR_CLOSE', isolation: 'AC_LINES', landmarks: 'Run solvent only from a disconnected eligible section toward a capture container, never through the complete assembled loop.', boundaries: 'Those values are kit-specific, not Lexus factory settings; use the selected equipment/solvent documentation and local safety requirements.', routes: ['AC_DISCHARGE_LINE'], requiresPlanningGate: true, source: 'Four Seasons 59172 A/C Flush Instructions' },
  { title: '8. Reassemble the closed refrigerant circuit before vacuuming', target: 'Install the new receiver/drier and all approved replacements, reconnect every evaluated section, then remove caps only as joints are assembled.', detail: 'Use the correct O-rings, verified refrigerant/oil branch and factory torque for each named joint. Receiver liquid tubes are 5.4 N·m; condenser liquid/discharge and cooling-unit liquid/suction joints are 10 N·m. Vacuum is not a substitute for solvent purge: the component must first be dry under the chosen kit procedure.', primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'Confirm every highlighted line now has both endpoints connected and all protected components remain installed or correctly replaced.', boundaries: 'Do not mix factory R-12 mineral-oil additions with the R-134a retrofit PAG profile.', routes: ['AC_LIQUID_LINE_CONDENSER_DRIER', 'AC_LIQUID_LINE_DRIER_FIREWALL'], requiresPlanningGate: true, source: 'RM144U torque table/AC-32; job_ac_service oil rules' },
  { title: '9. Factory evacuation after reassembly: establish and hold vacuum', target: 'With engine off and the system fully closed, follow RM144U AC-15 using the verified refrigerant service equipment.', detail: 'Install the manifold gauge set with both hand valves closed; connect low and high hoses to their matching service valves, then center hose to vacuum-pump inlet. Open both high and low hand valves and run the pump. After at least 10 minutes, low side must show more than 600 mmHg / 23.62 inHg / 80 kPa vacuum; if not, close both valves, stop pump and repair leaks. Continue to 750 mmHg / 29.53 inHg / 99.99 kPa, close both valves, stop pump, then hold at least five minutes with no gauge change.', primaryId: 'AC_LOW_SERVICE_PORT', camera: 'PASSENGER_FIREWALL', isolation: 'AC_COMPLETE', landmarks: 'Low-side service valve is on suction side; high-side service valve is in receiver-side liquid area.', boundaries: 'Do not run the engine during evacuation. A passing vacuum hold does not erase a prior solvent-purge requirement or prove an uninspected component is clean.', source: 'RM144U AC-14 to AC-16 evacuation procedure' },
  { title: '10. Leak-test, then charge only by the verified configuration', target: 'After the vacuum hold, proceed only under the factory/retrofit profile for the installed system.', detail: 'For original verified R-12, RM144U lists 1,050 g / 2.3 lb. For the verified Lexus R-134a retrofit, AC001-98 specifies 1,000 g and its own oil/part profile. Leak-test the closed system, inspect A/C operation, and reinstall access components. Do not set an R-134a retrofit charge from sight-glass cloudiness.', primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'High-side receiver/front-support area and low-side suction return are service-equipment references only.', boundaries: 'Never charge unknown/mixed refrigerant or open the high-side manifold valve with the engine running.', source: 'RM144U AC-16/32; Lexus AC001-98' }
];

export const AC_R134A_RETROFIT_GUIDE = [
  { title: '1. Confirm the retrofit branch before opening the system', target: 'Use the verified Lexus R-134a LS400 profile only when the vehicle and installed parts match.', detail: 'AC001-98 identifies the early LS400 retrofit as compressor 10PA20, retrofit receiver 88471-16050, ND-OIL 8, and 1,000 g R-134a. Record the VIN/build configuration and refrigerant identity first. If refrigerant or oil is unknown or mixed, stop for professional identification and recovery planning.', primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'Passenger headlight → receiver/drier → radiator support; model configuration record.', boundaries: 'This locator does not authorize opening a charged system.', source: 'Lexus AC001-98, pages 1–2', referenceId: 'EPC_121989_RECEIVER_FANS' },
  { title: '2. Recover R-12 with approved equipment and verify zero pressure', target: 'Recover first; do not vent or use the service ports as a flush path.', detail: 'Use the approved R-12 recovery/recycling equipment and the applicable Lexus procedure. Confirm refrigerant identity and independently verify zero pressure before any fitting is opened. Keep both service valves and the equipment arrangement visible in the model.', primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'High port at receiver-side liquid route; low port on passenger-side suction route.', boundaries: 'No recovery, zero-pressure, or refrigerant identity evidence means no disconnect step.', source: 'Lexus AC001-98, page 3; RM144U AC-14/15', referenceId: 'FACTORY_AC_LOCATOR' },
  { title: '3. Disconnect and cap the service fittings and selected joints', target: 'Remove valve cores, install R-134a adapters, and cap every open connection.', detail: 'After recovery, clean the original service-fitting threads, install the correct high- and low-side R-134a adapters with the specified thread adhesive, and tighten to 13 ft-lb. For the discharge hose O-rings, disconnect only after caps and replacement seals are ready; prevent moisture and dust entry.', primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_LINES', landmarks: 'Receiver-side high port, suction-side low port, compressor discharge and condenser discharge connections.', boundaries: 'Never twist piping or leave an uncapped opening exposed.', source: 'Lexus AC001-98, page 3', referenceId: 'EPC_AC_PIPING' },
  { title: '4. Replace the receiver/drier under the passenger headlight', target: 'Remove the old receiver, add the retrofit oil portion, and install the new receiver with fresh O-rings.', detail: 'The receiver/drier is under/inboard of the passenger headlight. Remove and discard the original receiver, measure the retrofit oil, place one-half of the specified amount into the new receiver OUT side, lubricate the new O-rings with ND-OIL 8, and keep the ports plugged until installation. The sight glass is not a charge-setting tool after retrofit; block it out when the receiver type requires it.', primaryId: 'AC_RECEIVER_DRIER', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_HIGH', landmarks: 'Passenger headlight → receiver canister → clamp/holder → two liquid tubes.', boundaries: 'Receiver/drier is replace-not-flush; never pour or push solvent through it.', source: 'Lexus AC001-98, page 4; RM144U AC-31/32', referenceId: 'EPC_121989_RECEIVER_FANS' },
  { title: '5. Decide what is actually eligible for flushing', target: 'AC001-98 does not require routine mineral-oil flushing for the approved retrofit.', detail: 'For this approved Lexus retrofit, the bulletin says not to remove or flush the R-12 mineral oil; charge the specified ND-OIL 8 amount instead. If a separate contamination diagnosis demands flushing, isolate only a proven eligible bare line or condenser using the conditional flush guide. Never generic-flush the compressor, receiver/drier, expansion valve, EPR, equalizer tube, filtered/muffled hose, or restricted component.', primaryId: 'AC_COMPRESSOR', camera: 'AC_COMPRESSOR_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'Compressor/clutch low front; condenser ahead of radiator; receiver passenger-front; TXV/EPR at HVAC case.', boundaries: 'Normal retrofit is no-flush; any conditional flush requires its own planning and capture path.', source: 'Lexus AC001-98, page 2; conditional flush guide', referenceId: 'EPC_COMPRESSOR' },
  { title: '6. Reassemble the closed system before vacuuming', target: 'Reconnect approved hoses and lines with fresh lubricated O-rings and verified torque.', detail: 'Reconnect the discharge hose and condenser connection, install the new receiver, remove caps only as each joint is assembled, and verify that all evaluated sections are dry and closed. Do not mix the original R-12 oil-addition schedule with the ND-OIL 8 retrofit profile.', primaryId: 'AC_LIQUID_LINE_DRIER_FIREWALL', camera: 'PASSENGER_FIREWALL', isolation: 'AC_COMPLETE', landmarks: 'Compressor discharge → condenser → receiver → passenger firewall; suction returns from EPR to compressor.', boundaries: 'Vacuum is not a substitute for a required solvent purge or a missing O-ring.', source: 'Lexus AC001-98, pages 2–4; UCF10 EPC piping', referenceId: 'EPC_121989_ENGINE_PIPING' },
  { title: '7. Evacuate for 45 minutes and perform the vacuum check', target: 'Use R-134a recovery equipment with the engine off and the system fully closed.', detail: 'Connect the low and high service hoses to their matching adapters and follow the equipment procedure. AC001-98 specifies 45 minutes of evacuation, then a vacuum check. If the system cannot hold the required vacuum, stop and repair the leak before continuing. The model highlights both service ports and the complete closed-loop path.', primaryId: 'AC_LOW_SERVICE_PORT', camera: 'PASSENGER_FIREWALL', isolation: 'AC_COMPLETE', landmarks: 'Low-side suction port, high-side receiver-side port, closed lines and receiver.', boundaries: 'Do not run the engine during evacuation; a vacuum pump does not remove an open-system leak.', source: 'Lexus AC001-98, page 4; RM144U AC-14 to AC-16', referenceId: 'FACTORY_AC_LOCATOR' },
  { title: '8. Add the remaining oil, charge by mass, leak-test and label', target: 'Complete the verified retrofit profile only after the vacuum check passes.', detail: 'Add the remaining one-half of the retrofit oil amount through the recovery equipment, charge the closed system with 1,000 g of R-134a by mass, and perform a gas leak check and cooling-performance check. Do not use sight-glass clarity to set the retrofit charge. Install the ND-OIL 8 “USE ONLY” and retrofit caution labels in a prominent engine-bay location.', primaryId: 'AC_HIGH_SERVICE_PORT', camera: 'RECEIVER_DRIER_CLOSE', isolation: 'AC_COMPLETE', landmarks: 'High/low service adapters, receiver sight-glass area, radiator support label location.', boundaries: 'Never open the high-side valve with the engine running, charge liquid refrigerant with the engine running, overcharge, or charge unknown refrigerant.', source: 'Lexus AC001-98, pages 1, 3–4; L-AC002-93 oil precautions', referenceId: 'USER_FRONT_HOOD_OPEN' }
];
