# 1990 Lexus LS400 Service-Recognition 3D Prototype

This is a working browser-based 3D model of a U.S.-market 1990 Lexus LS400 (UCF10), built to help a person recognize the A/C system and its surrounding landmarks from above, through the grille, below the bumper, and from the passenger compartment.

The model is recognition-first, not factory CAD. It provides a continuous, selectable refrigerant circuit and honest confidence labels. Exact tube bends, clamp holes, fitting clocking, service-port placement, and build-specific variants still require measurement of the target car.

## Run the prototype

On Windows, double-click `Launch-LS400-Prototype.cmd`. It starts a minimized local server and opens the model.

Manual launch from this folder:

```powershell
python -m http.server 8123
```

Then open `http://127.0.0.1:8123/` in a modern browser. The pinned Three.js r166 runtime is vendored locally, so the prototype does not need internet access after the folder is copied.

## What is implemented

- A recognizable full UCF10-scale sedan shell with bumper, grille, rectangular headlights, fenders, windshield, cowl, four wheels, ground plane, engine-bay opening, and continuous cabin/underbody context.
- A real articulated hood with closed, partial-open, and fully-open states, rear hinge pivots, supports, underside ribs/insulation, transparency, and independent visibility.
- A simplified but recognizable 1UZ-FE engine, intake, airbox, battery, brake booster, radiator, condenser, twin fan stack, radiator support, frame rails, bumper reinforcement, splash shields, accessory drive, alternator, and power-steering pump.
- True-form simplified A/C compressor, clutch/pulley, cast body sections, mounting ears/bracket, manifold, suction and discharge ports.
- True-form simplified condenser, receiver-drier, receiver clamp/bracket, sight glass, pressure switch, high/low service ports, expansion valve area, evaporator, EPR, HVAC case, blower volute/motor/cage, heater core, air-mix door, and condensate drain.
- Seven selectable A/C routes plus nine contextual coolant, heater, vacuum, power-steering, electrical, and drain routes. Every route is continuous and has two named endpoints.
- Hard aluminum and flexible hose sections, transitions, crimps, clamps, fittings, fasteners, and animated direction arrows.
- Three display levels: orientation, service identification, and close inspection.
- Isolation for the complete A/C circuit, high side, low side, engine-bay A/C, cabin HVAC, lines, hardware, and surrounding landmarks.
- Body transparency; hood, bumper, radiator, engine, and splash-shield hiding; firewall and HVAC cutaways.
- Click/tap identification with stable ID, aliases, function, system, fluid/electricity type, pressure side, endpoints, mount, confidence, source, service relevance, and notes.
- Twenty real-world service cameras plus smooth orbit, pan, zoom, selected-part targeting, adjustable field of view, and approximate collision prevention.
- Reference-photo import, side-by-side and overlay modes, opacity control, manual alignment, discrepancy notes, and saved camera poses.
- A safety-gated R-12/R-134a service-planning overlay. It stays locked for unknown/contaminated state or until professional recovery and independent zero-pressure verification are confirmed; its arrows are explicitly normal operating flow, not flush authorization.
- In-app validation and a 12-step acceptance walkthrough.

## Vehicle coordinates and orientation

| Axis | Meaning |
|---|---|
| `+X` | Vehicle forward, toward the front bumper |
| `-X` | Vehicle rearward, toward the cabin/trunk |
| `+Y` | Vehicle-left, the driver side on this U.S. car |
| `-Y` | Vehicle-right, the passenger side |
| `+Z` | Up |
| Origin | Front-axle centerline projected to the ground |
| Scale | 1 scene unit = 1 metre = 1000 mm |

Published envelope values used for broad scale are 4.995 m long, 1.820 m wide, 1.400 m high, and 2.815 m wheelbase. They do not make the model dimensional CAD.

## Refrigerant connection map

The app labels pressure side in text as well as color. `HIGH` is orange; `LOW` is blue.

| Order | Stable route or component | From | To | State | Geometry confidence |
|---:|---|---|---|---|---|
| 1 | `AC_COMPRESSOR` | Suction port | Discharge port | Low vapor becomes high vapor | High location; approximate dimensions |
| 2 | `AC_DISCHARGE_LINE` | `AC_DISCHARGE_PORT` | `AC_CONDENSER_INLET` | High-pressure vapor | Catalog topology; installed bends approximate |
| 3 | `AC_CONDENSER` | Inlet | Outlet | High vapor becomes high liquid | High location; approximate dimensions |
| 4 | `AC_LIQUID_LINE_CONDENSER_DRIER` | `AC_CONDENSER_OUTLET` | `AC_RECEIVER_DRIER` | High-pressure liquid | Catalog topology; installed bends approximate |
| 5 | `AC_RECEIVER_DRIER` | Condenser-side fitting | Firewall-side fitting | High-pressure liquid | High location; replace/isolate boundary |
| 6 | `AC_LIQUID_LINE_DRIER_FIREWALL` | `AC_RECEIVER_DRIER` | `AC_EXPANSION_VALVE` | High-pressure liquid | Continuous group; A/B/C/D/E crosswalk provisional |
| 7 | `AC_EXPANSION_VALVE` | High-side liquid line | Evaporator feed | High-to-low metering boundary | High region; hidden fasteners approximate |
| 8 | `AC_EVAPORATOR_FEED_INTERNAL` | `AC_EXPANSION_VALVE` | `AC_EVAPORATOR` | Low-pressure mixture | Hidden route approximate |
| 9 | `AC_EVAPORATOR` | Feed | Return | Low-pressure mixture/vapor | High region; approximate dimensions |
| 10 | `AC_EVAPORATOR_RETURN_INTERNAL` | `AC_EVAPORATOR` | `AC_EPR` | Low-pressure vapor | Hidden route approximate |
| 11 | `AC_EPR` | Evaporator return | Suction route | Low-pressure vapor | High region; build-specific shape approximate |
| 12 | `AC_SUCTION_LINE` | `AC_EPR` | `AC_SUCTION_PORT` | Low-pressure vapor | Catalog topology; installed bends approximate |

`AC_EQUALIZER_TUBE` is a pressure-reference branch between the evaporator/EPR region. It is not part of the main animated flow loop.

## Retrofit and flush visualization boundary

The prototype identifies the fittings and route groups a qualified technician would evaluate; it does not authorize opening the system or replace the factory procedure.

- Compressor boundaries: `AC_DISCHARGE_PORT` and `AC_SUCTION_PORT`.
- Condenser boundaries: `AC_CONDENSER_INLET` and `AC_CONDENSER_OUTLET`.
- Receiver-drier boundaries: both top fittings between the condenser liquid line and firewall liquid line.
- Cabin boundaries: expansion-valve/firewall connection area and EPR/suction return area.
- Service access: `AC_HIGH_SERVICE_PORT` belongs to the high-pressure liquid-line group; `AC_LOW_SERVICE_PORT` belongs to the suction-line group. Their exact original-versus-retrofit landing positions are unresolved.

Never vent refrigerant, open a charged system, infer zero pressure from the model, or flush through the compressor, receiver-drier, expansion valve, or EPR. Recover with approved equipment, identify the installed refrigerant and oil, verify zero pressure independently, and follow the exact factory/job-specific procedure. The receiver-drier is represented as an isolate/replace component, not a flush-through component.

## Stable object naming map

### Body, structure, and service landmarks

`LANDMARK_BODY_SHELL`, `LANDMARK_FRONT_BUMPER`, `LANDMARK_GRILLE`, `LANDMARK_PASSENGER_HEADLIGHT`, `LANDMARK_DRIVER_HEADLIGHT`, `LANDMARK_HOOD`, `LANDMARK_HOOD_HINGES`, `LANDMARK_FRONT_FENDERS`, `LANDMARK_WINDSHIELD`, `LANDMARK_COWL`, `LANDMARK_FIREWALL`, `LANDMARK_DASHBOARD`, `LANDMARK_PASSENGER_FOOTWELL`, `LANDMARK_RADIATOR_SUPPORT`, `LANDMARK_FRONT_FRAME_RAILS`, `LANDMARK_SPLASH_SHIELDS`, `LANDMARK_RADIATOR`, `LANDMARK_COOLING_FANS`, `LANDMARK_BATTERY`, `LANDMARK_AIRBOX`, `LANDMARK_INTAKE_TUBE`, `LANDMARK_BRAKE_BOOSTER`

### Engine and accessory landmarks

`ENGINE_1UZ_FE`, `ENGINE_ACCESSORY_DRIVE`, `ENGINE_ALTERNATOR`, `ENGINE_POWER_STEERING_PUMP`

### A/C refrigerant components

`AC_COMPRESSOR`, `AC_COMPRESSOR_CLUTCH`, `AC_COMPRESSOR_BRACKET`, `AC_DISCHARGE_PORT`, `AC_SUCTION_PORT`, `AC_CONDENSER`, `AC_CONDENSER_INLET`, `AC_CONDENSER_OUTLET`, `AC_RECEIVER_DRIER`, `AC_RECEIVER_DRIER_BRACKET`, `AC_PRESSURE_SWITCH`, `AC_SIGHT_GLASS`, `AC_HIGH_SERVICE_PORT`, `AC_LOW_SERVICE_PORT`, `AC_EXPANSION_VALVE`, `AC_EVAPORATOR`, `AC_EPR`

### Cabin HVAC components

`HVAC_CASE`, `HVAC_BLOWER_HOUSING`, `HVAC_BLOWER_MOTOR`, `HVAC_HEATER_CORE`, `HVAC_AIR_MIX_DOOR`, `HVAC_DRAIN_TUBE`

### Selectable routes

`AC_DISCHARGE_LINE`, `AC_LIQUID_LINE_CONDENSER_DRIER`, `AC_LIQUID_LINE_DRIER_FIREWALL`, `AC_EVAPORATOR_FEED_INTERNAL`, `AC_EVAPORATOR_RETURN_INTERNAL`, `AC_SUCTION_LINE`, `AC_EQUALIZER_TUBE`, `HVAC_DRAIN_ROUTE`, `COOLING_UPPER_HOSE`, `COOLING_LOWER_HOSE`, `HVAC_HEATER_HOSE_FEED`, `HVAC_HEATER_HOSE_RETURN`, `ELECTRICAL_AC_HARNESS`, `BRAKE_VACUUM_HOSE`, `POWER_STEERING_HIGH_PRESSURE`, `POWER_STEERING_RETURN`

Every stable object includes metadata in `model-data.js`. Names such as `Cube.001`, `Cylinder.004`, and `Mesh12` are not used for service objects.

## Service cameras

The `previews/cameras` folder contains a screenshot from every preset:

- Full vehicle hood-open, standing centered, front passenger corner, front driver corner.
- Leaning over passenger fender, leaning over driver fender.
- Beside passenger headlight, beside driver headlight.
- Kneeling at bumper, beneath bumper, beneath compressor, through grille.
- Passenger firewall, driver firewall.
- Passenger footwell, HVAC case cutaway.
- Compressor close-up, receiver-drier close-up, condenser/radiator stack, and legacy bay-audit view.

## Sources used in this build

| Local project reference | Used for | Provenance and accuracy limit | Redistribution |
|---|---|---|---|
| `references/user-1990-ls400-hood-open.webp` | Full front alignment, hood opening, headlights, bumper, radiator support, twin fans | NTFS metadata records Google and a Bring a Trailer asset URL; a single view cannot establish hidden routing | **Private/no-ship** until permission is documented |
| `references/user-1990-ls400-inline1.jpg` | Engine-top landmarks, intake, airbox, engine placement | No source, ownership, permission, or independent model-year record is present | **Private/no-ship** until provenance and permission are documented |
| `references/user-1991-ls400-7-1.jpg` | Comparative hood/cowl and engine-bay relationship | No provenance record; visible TRAC equipment makes this configuration-specific | **Private/no-ship** and never a silent neutral-baseline substitute |
| `references/charm-ac-locations.png` | A/C/HVAC component identity and coarse regions | Exact hash match to toolbox CHARM image `117633972.png`, page `1029.html`; unofficial-mirror/factory-derived, not scaled geometry | **Private/no-ship**; rights not cleared |
| `references/epc-ac-piping.png` | U.S. UCF10 pipe/hose groups, fittings, clamps, and connectivity | Exact hash match to MegaZip U.S. EPC plate `17822845`; exploded plate does not provide installed bends | **Private/no-ship**; OEM-derived rights not cleared |
| `references/epc-ac-condenser-fans.png` | Condenser, receiver, bracket, fan, and shroud relationships | Exact hash match to MegaZip plate `17822844`; proves relationships, not scale or installed coordinates | **Private/no-ship**; OEM-derived rights not cleared |
| `references/epc-ac-compressor.png` | Compressor/clutch silhouette, ports, and bracket decomposition | Exact hash match to MegaZip plate `17822848`; exact installed pose and dimensions remain estimated | **Private/no-ship**; OEM-derived rights not cleared |
| `references/licensed-ucf10-exterior.jpg` | Broad body proportion and silhouette context | Public-domain Australian RHD UCF10R rear three-quarter; not an exact U.S. 1990 underhood view | **Ship OK** with provenance retained |

The larger evidence package is in `C:\Users\blowb\Desktop\LS400toolbox`, including the 1990 CHARM service material, 250-page EWD070U electrical manual, exact U.S. UCF10 EPC plates, registry data, diagrams, and licensed photos. Factory-derived and user-supplied images remain private working references unless their individual reuse rights are documented. The file labeled `OM50498U` was rejected for this model because its internal content is a 1998 LS400 owner manual, not a 1990 source.

## Validation result

- Status: `PASS_WITH_WARNINGS`
- Errors: 0
- Warnings: 4
- Checks: 19
- Important components with built geometry: 40
- Stable component/route IDs checked: 65
- Modeled routes with named endpoints: 16
- A/C routes aligned to endpoints: 7, using a 200 mm staging tolerance appropriate only for approximate geometry
- Unexplained disconnected A/C lines: 0
- Remaining important generic placeholders: 0
- Acceptance walkthrough: 12 of 12 demonstrated in the running app

The fourth warning is a reuse boundary: seven embedded comparison images are private/no-ship references and must not be published until their rights are cleared.

The machine-readable result is `validation-report.json`.

## Unresolved inputs required for production accuracy

1. VIN, production month, Federal/California emissions configuration, TRAC/air-suspension options, and target-car build state.
2. Installed refrigerant, oil, retrofit adapters, labels, and conversion workmanship.
3. Calibrated measurements or scan data for A/C line centerlines, diameters, bend radii, clamp holes, crimp positions, fitting clocking, and under-cover access.
4. Physical confirmation of the high and low service-port locations on the target car.
5. Installed-car or clearer-plate tracing for individual receiver-to-firewall A/B/C/D/E pipes.
6. Measured expansion-valve, EPR, HVAC-case, dash, firewall, hood-hinge, bumper-beam, and underbody geometry.
7. EWD070U circuit extraction and target-car capture for physical loom branches, clips, connectors, and grounds.

These uncertainties are exposed in component metadata, the Validate panel, and `validation-report.json`.

## Add and align a new reference photo

1. Open **Compare** and choose **Add a local reference photo**.
2. Choose side-by-side or transparent overlay and adjust opacity.
3. Match stable landmarks first: both headlights, bumper, radiator support, engine, battery/airbox, firewall, and hood opening.
4. Adjust camera orbit, pan, zoom, and field of view. Do not deform the 3D model to force a single photo match.
5. Record discrepancies in the notes box and save the corrected camera pose.
6. Correct geometry only after comparing multiple angles or adding measured coordinates to `model-data.js` and the corresponding builder in `app.js`.
7. Run Validate again and capture the same camera before and after the correction.

## Preview evidence

- Baseline placeholder: `previews/before-placeholder.png`
- Matched early/final camera pair: `previews/before-identical-full-vehicle.png` and `previews/after-identical-full-vehicle.png`
- Current full vehicle: `previews/after-identical-full-vehicle.png`
- Compressor close-up: `previews/service-compressor-final.png`
- Receiver and liquid route: `previews/service-receiver-liquid-route-final.png`
- Discharge trace: `previews/pass4-discharge-trace.png`
- Suction route: `previews/service-suction-route-final.png`
- Condenser/radiator stack: `previews/service-condenser-stack.png`
- HVAC cutaway: `previews/service-hvac-cutaway.png`
- Real-photo comparison: `previews/reference-comparison-user-front.png`
- Safety-gated service planning map: `previews/service-planning-gated-map.png`
- Final validation and acceptance: `previews/final-validation-12-of-12.png` and `previews/final-acceptance-12-of-12.png`
- Every service camera: `previews/cameras/*.png`

## File map

- `index.html` — application shell and nontechnical controls.
- `Launch-LS400-Prototype.cmd` — one-click local launcher for Windows.
- `styles.css` — responsive interface and comparison layout.
- `model-data.js` — vehicle contract, component inventory, route graph, metadata, cameras, references, uncertainties, and acceptance steps.
- `app.js` — procedural geometry, interaction, isolation, route tracing, camera behavior, comparison workflow, and validation.
- `vendor/` — pinned local Three.js r166 module, OrbitControls, and RoundedBoxGeometry.
- `references/` — the eight references embedded in the comparison workflow.
- `previews/` — before/after, route, validation, comparison, and 20 camera screenshots.
- `validation-report.json` — machine-readable final validation snapshot.

This prototype is an educational visualization aid and not a substitute for the factory service manual, refrigerant regulations, recovery equipment, leak testing, or hands-on verification of the physical vehicle.

### Third-party runtime notice

The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
