export const VEHICLE = {
  name: '1990 Lexus LS 400 (UCF10)',
  units: 'metres (1 scene unit = 1000 mm)',
  coordinateContract: '+X vehicle forward, +Y vehicle-left (driver side), +Z up',
  dimensions: { length: 4.995, width: 1.820, height: 1.400, wheelbase: 2.815 },
  origin: 'front axle centre projected to the ground plane',
  configuration: 'Target: December 1989 U.S. UCF10L-AEPGKA, CA emissions, air suspension, original R12 context; VIN and retrofit state remain unverified'
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
    source: '12/1989 Amayama EPC MEP439E; UCF10L-AEPGKV', partNumber: '88470-50020', mountTo: 'AC_RECEIVER_DRIER_BRACKET', location: 'Front passenger side, behind/inboard of passenger headlight beside radiator support',
    geometryStatus: 'true_form_simplified', important: true, notes: 'Early-production receiver assembly with top liquid-pipe block, pressure switch, cylinder, cap and clamp.', tags: ['ac', 'engine-bay', 'passenger-side']
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
    connectsTo: ['AC_EVAPORATOR_RETURN_INTERNAL', 'AC_SUCTION_LINE', 'AC_EQUALIZER_TUBE'], pressureSide: 'LOW', confidence: 'high-location / approximate-dimensions', source: 'CHARM A/C locator; Lexus L-AC002-91 (pre-8/90 EPR 88503-50010/50020)',
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
    id: 'AC_DISCHARGE_LINE', legacyIds: ['AC-003', 'AC-004', 'AC-C001', 'AC-C002', 'AC-C003'], displayName: 'Compressor-to-condenser discharge line',
    aliases: ['high-pressure discharge hose and tube G'], system: 'AIR_CONDITIONING', pressureSide: 'HIGH', fluidType: 'high-pressure refrigerant vapor',
    from: 'AC_DISCHARGE_PORT', to: 'AC_CONDENSER_INLET', direction: 'compressor to condenser', source: 'EPC piping 17822845; EPC compressor 17822848',
    confidence: 'catalog route / installed bends approximate', serviceRole: 'Professional recovery boundary; approved flushable line only after removal/isolation under the exact procedure.',
    geometryStatus: 'continuous_true_form_approximate', points: [[0.30,0.40,0.58],[0.39,0.48,0.64],[0.52,0.58,0.67],[0.64,0.61,0.70]],
    sections: [{from:0,to:1,type:'flex',radius:0.022},{from:1,to:3,type:'hard',radius:0.013}], crimps:[1], clamps:[2], flow:[0.33,0.72], tags:['ac','line','engine-bay']
  },
  {
    id: 'AC_LIQUID_LINE_CONDENSER_DRIER', legacyIds: ['AC-C004'], displayName: 'Condenser-to-receiver liquid line', aliases: ['condenser outlet tube'],
    system: 'AIR_CONDITIONING', pressureSide: 'HIGH', fluidType: 'high-pressure liquid refrigerant', from: 'AC_CONDENSER_OUTLET', to: 'AC_RECEIVER_DRIER',
    direction: 'condenser to receiver-drier', source: '12/1989 Amayama EPC MEP439E/MEP444E', partNumbers: ['88716-50010'], confidence: 'catalog route / installed bends approximate',
    serviceRole: 'Do not flush through the receiver-drier.', geometryStatus: 'continuous_true_form_approximate', points: [[0.64,-0.62,0.48],[0.65,-0.69,0.50],[0.60,-0.72,0.58]],
    sections: [{from:0,to:2,type:'hard',radius:0.011}], crimps:[], clamps:[1], flow:[0.50], tags:['ac','line','engine-bay']
  },
  {
    id: 'AC_LIQUID_LINE_DRIER_FIREWALL', legacyIds: ['AC-007','AC-008','AC-009','AC-C005','AC-C006','AC-C007','AC-C008','AC-C009'], displayName: 'Receiver-to-firewall liquid-line group',
    aliases: ['liquid pipes A/B/C/D/E'], system: 'AIR_CONDITIONING', pressureSide: 'HIGH', fluidType: 'high-pressure liquid refrigerant', from: 'AC_RECEIVER_DRIER', to: 'AC_EXPANSION_VALVE',
    direction: 'receiver-drier toward expansion valve', source: '12/1989 Amayama EPC MEP444E/MEQ413D', partNumbers: ['88716-50010','88716-50030','88716-50050','88716-50020','88716-50070'], confidence: 'catalog sequence / installed routing approximate',
    serviceRole: 'Isolate receiver-drier and expansion valve before any approved line flushing.', geometryStatus: 'continuous_true_form_approximate',
    points: [[0.60,-0.72,0.59],[0.58,-0.72,0.79],[0.48,-0.75,0.78],[0.28,-0.78,0.81],[-0.02,-0.79,0.82],[-0.34,-0.78,0.84],[-0.62,-0.69,0.85],[-0.82,-0.58,0.80],[-0.98,-0.47,0.72]],
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
    geometryStatus: 'continuous_true_form_approximate', points: [[-1.00,-0.42,0.67],[-0.88,-0.47,0.76],[-0.78,-0.47,0.84],[-0.52,-0.60,0.76],[-0.18,-0.66,0.61],[0.22,-0.67,0.47],[0.54,-0.55,0.37],[0.55,-0.10,0.34],[0.48,0.24,0.42],[0.27,0.42,0.59]],
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
    source: 'user engine-bay photos', confidence: 'approximate', serviceRole: 'Cooling-system context only.', geometryStatus: 'continuous_context', points: [[0.05,0.05,0.76],[0.31,0.12,0.76],[0.51,0.18,0.70]],
    sections: [{from:0,to:2,type:'flex',radius:0.028}], crimps:[], clamps:[0,2], flow:[], tags:['context-line','engine-bay']
  },
  {
    id: 'COOLING_LOWER_HOSE', displayName: 'Lower radiator hose', system: 'COOLING', pressureSide: 'NONE', fluidType: 'engine coolant', from: 'LANDMARK_RADIATOR', to: 'ENGINE_1UZ_FE', direction: 'radiator to water pump',
    source: 'coolant diagram; installed route approximate', confidence: 'approximate', serviceRole: 'Cooling-system context only.', geometryStatus: 'continuous_context', points: [[0.48,-0.18,0.36],[0.25,-0.12,0.34],[0.03,-0.08,0.42]],
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
    source: 'EWD070U acquired; circuit extraction and physical loom routing remain', confidence: 'approximate', serviceRole: 'Battery isolation and factory procedure required.', geometryStatus: 'continuous_context', points: [[-0.95,0.58,0.82],[-0.45,0.68,0.74],[0.12,0.50,0.62],[0.29,0.40,0.51]],
    sections: [{from:0,to:3,type:'wire',radius:0.005}], crimps:[], clamps:[1,2], flow:[], tags:['context-line','engine-bay','electrical','uncertain']
  },
  {
    id: 'BRAKE_VACUUM_HOSE', displayName: 'Brake-booster vacuum hose', system: 'BRAKES', pressureSide: 'NONE', fluidType: 'vacuum', from: 'ENGINE_1UZ_FE', to: 'LANDMARK_BRAKE_BOOSTER', direction: 'engine vacuum to booster through check valve',
    source: 'user photos; brake-vacuum catalog', confidence: 'approximate', serviceRole: 'Safety-critical brake context; never alter based on this model.', geometryStatus: 'continuous_context', points: [[-0.42,0.24,0.91],[-0.78,0.48,0.91],[-1.02,0.61,0.91]],
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
  { id: 'USER_ENGINE_TOP_1990', label: 'Private unprovenanced reference — engine top', src: 'references/user-1990-ls400-inline1.jpg', pose: 'LEAN_PASSENGER_FENDER', landmarks: '1UZ intake, valve covers, airbox, brake booster, firewall', rights: 'Private working reference only; source, model year and reuse permission are not documented.' },
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
