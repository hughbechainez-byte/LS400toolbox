# LS400 Toolbox

Offline service-orientation prototypes for the 1990 Lexus LS400 (UCF10), with emphasis on A/C component identification and high/low-side routing.

## v1.5.0 guided A/C locator

Windows now presents a 10-step RM144U/EPC/AC001-98 guided flush-and-retrofit locator: configuration, recovery gate, receiver/drier, compressor, condenser, each external line group, HVAC controls, reassembly and charge verification. Android has matching step navigation that moves to the relevant part/camera. It distinguishes original R-12 from the Lexus R-134a retrofit branch, corrects the factory receiver assembly to `88470-50010`, and keeps any flush-boundary overlay locked until refrigerant state, recovery and independent zero-pressure checks are confirmed.

## v1.6.0 component-specific flush and evacuation guide

Windows adds selectable complete, receiver-only, and conditional flush/evacuation guides. The flush branch identifies every modeled part as eligible only under stated conditions or as isolate/replace, gives the selected Four Seasons kit’s flush/purge values as kit-specific guidance, and then walks the RM144U post-reassembly vacuum threshold and five-minute hold test. Android now follows the same component-specific decision sequence.

## v1.9.0 geometry and photo-evidence update

Windows and Android now expose a named air-cleaner-to-throttle intake route that stays on the passenger-side/front-of-plenum service corridor around the full-width 1UZ engine mass. Windows Geometry Validation reports datums, anchors, source/page evidence, and deviations; Android adds the same marker mode and saves a camera-coordinate manifest with each photo capture/import.

## v2.0.0 photo-proportioned engine-bay update

Windows and Android use the new hood-open photo set to preserve the passenger-side airbox-to-throttle route, place the low-side service fitting below the throttle cable, separate the coolant reservoir and fuse box from the battery, and reserve clear service space around both strut towers and air-suspension housings. Both platforms open with a larger photo-style engine-bay view.

## v2.1.0 structural engine-bay reconstruction

Windows and Android now use the 1990 RM144U B0-186 cowl, spring-support and radiator-support hardpoints as authored vehicle coordinates: the tower domes sit at the outer aprons, the 1UZ envelope is reduced centrally, and the driver-front battery, fuse box and shallow rectangular overflow reservoir are separately anchored. The passenger-front airbox, AFM and corrugated duct are one continuous route to the throttle; Compare uses a fixed-aspect normal 50% overlay against the saved engine-bay camera.

## 2026-08-09 model-foundation phase

`shared/model-manifest.json` is the renderer-neutral millimetre source of truth: 189 evidence components, 209 connections, and 19/22 A/C records. Windows and Android consume generated contracts from the same digest; the private reference image is hash-provenanced but never bundled. The body-only camera fit is reproducible and retains its evidence residual (median 53.54 px, maximum 90.27 px) because no calibrated lens or subject-car survey is available.

## Downloads

Use the GitHub Releases page:

- `LS400Toolbox-Android-v1.4.0.apk` — adds factory-bulletin-based pre-May-1991 suction routing, pre-August-1990 EPR identification, and pre-April-1990 power-steering return-tube context. No WebView, browser, private server, internet permission, or network dependency.
- `LS400Toolbox-Android-v2.0.0.apk` — current native build with photo-proportioned engine-bay spacing, geometry validation, corrected intake route, and photo-coordinate manifests.
- `LS400Toolbox-Windows-v2.0.0.zip` — current complete Windows desktop package with matching photo-proportioned engine-bay geometry.
- `LS400Toolbox-Android-v2.1.0.apk` — current native build with structural UCF10 bay hardpoints, outer-apron towers, and corrected driver/passenger-front component sequence.
- `LS400Toolbox-Android-v2.4.0-model-foundation.apk` — shared 189/209 evidence manifest, generated native contract, and physically bounded shell foundation.
- `LS400Toolbox-Windows-v2.4.0-model-foundation.zip` — matching Windows package with the generated foundation contract and offline QA hook.
- The matching Windows v2.1.0 bundle is a local delivery only because it includes user-supplied working comparison images that are not cleared for public redistribution.
- `LS400Toolbox-Windows-v1.0.0.zip` — complete Windows desktop package. Extract the ZIP and run `LS400Toolbox.exe`.
- `LS400Toolbox.exe` — Windows launcher only; use the ZIP unless the adjacent runtime and model folders are already present.

## Android controls

Drag to orbit, pinch to zoom, double-tap to reset, and tap a modeled component to identify it. Use Full Car, A/C System, High Side, and Low Side to isolate service routes. The Windows and Android models now share the December-1989 EPC placement and route map; exact measured centerlines and fitting clocking remain target-vehicle capture items.

## Accuracy and safety

This is an educational visualization, not measured CAD or a substitute for the factory service manual. Passenger side appears screen-left when facing the vehicle. Exact service-port adapters and installed routing must be verified on the physical car. Never open a charged system, vent refrigerant, or flush through the compressor, receiver-drier, expansion valve, or EPR.

The public repository excludes private and factory-derived reference images that are not cleared for redistribution.
