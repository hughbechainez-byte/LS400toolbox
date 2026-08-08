# LS400 Geometry Pre-Implementation Report

Generated before implementation on 2026-08-08.

## Documents Reviewed

- `ls400toolbox/collision_repair_manual_extracted/manifest.json`: 50 Collision Repair Manual sections reviewed, including lift/support, standard body marks, radiator support, front crossmember, front apron/cowl side, front side member, cowl top side panel, fit standards, engine-compartment body dimensions, and underbody.
- `ls400toolbox/ewd070u_extracted/manifest.json`: 50 EWD sections reviewed, including relay locations, component locations, connector/ground/splice, charging, engine control, headlights, ABS/TRAC, PPS, and wiper/washer.
- `references/charm-ac-locations.png`: A/C and HVAC component locator, used for receiver, condenser/fan stack, compressor, EPR, expansion valve, evaporator, blower and heater relationships.
- `references/epc-ac-piping.png`, `references/epc-ac-condenser-fans.png`, `references/epc-ac-compressor.png`: EPC exploded views used for A/C routing topology, receiver/fan/condenser relationships, compressor shape, clutch and ports.
- `references/newdocs/epc-cooler-piping-schema1.png`, `schema2.png`, `schema3.png`: 12/1989 cooler-piping references used for early receiver, high/low line families, suction pipes and HVAC tube groups.
- `references/newdocs/RM144U_IN_Precautions_with_SRS.pdf`: RM safety context reviewed; no engine-bay geometry coordinates extracted.
- `references/user-1990-ls400-hood-open.webp`, `references/user-1990-ls400-inline1.jpg`, `references/user-1991-ls400-7-1.jpg`: private visual references used only for visual alignment checks, not public/shipping evidence.

## Dimensions Extracted

- Overall UCF10 envelope already documented in project: length 4.995 m, width 1.820 m, height 1.400 m, wheelbase 2.815 m.
- Project coordinate contract retained: +X vehicle forward, +Y driver side, -Y passenger side, +Z up; origin at front axle center projected to ground.
- Direct body numeric dimensions from cached Collision Repair body-dimension page were not extractable because `CR19X_CR0049` renders as a blank dark image in this local extraction. It remains reviewed but unusable until the original PDF/page is recaptured.
- Factory numerical service values retained in service metadata: receiver liquid-tube joints 5.4 N.m, condenser/cooling-unit liquid and suction joints 10 N.m, original R-12 charge 1,050 g / 2.3 lb, approved AC001-98 R-134a retrofit charge 1,000 g.

## Geometry Assumptions

- Coordinates are authoritative where based on the project vehicle envelope and repeated factory/reference positional relationships.
- A/C pipe centerlines remain approximate splines because the local documents establish topology and coarse landmarks but not measured bend radii, clamp-hole coordinates, or fitting clocking.
- Body-dimension datum points are shown as validation references, but missing local numeric extraction is explicitly marked unresolved.
- Private photos are used only to prevent visually implausible compression, not to invent measurements.

## Components Requiring Relocation

- Remove global model X scaling and use component positions directly in the vehicle coordinate system.
- Re-establish front stack spacing: condenser ahead of radiator, fan pair within the grille/radiator-support opening, receiver behind/inboard of passenger headlamp.
- Preserve engine-bay spacing between firewall, 1UZ-FE, radiator support, battery, airbox, brake booster, compressor, condenser and receiver.
- Move service-port validation to line-family anchors rather than unsupported exact tube claims.

## Confidence By Major Placement

- High: vehicle envelope, coordinate system, radiator support/front opening, passenger/driver headlight orientation, condenser/radiator order, receiver-drier region, compressor side/height, HVAC passenger-side case region.
- Medium: service-port regions, pressure switch/sight glass top-block area, front fan spacing, major accessory landmarks.
- Low/Provisional: individual pipe A/B/C/D/E centerlines, exact low-side fitting landing, clamp holes, fitting clocking, hidden EPR/expansion-valve dimensions, body datum coordinates from the blank local CR0049 capture.
