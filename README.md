# LS400 Toolbox

Offline service-orientation prototypes for the 1990 Lexus LS400 (UCF10), with emphasis on A/C component identification and high/low-side routing.

## v1.5.0 guided A/C locator

Windows now presents a 10-step RM144U/EPC/AC001-98 guided flush-and-retrofit locator: configuration, recovery gate, receiver/drier, compressor, condenser, each external line group, HVAC controls, reassembly and charge verification. Android has matching step navigation that moves to the relevant part/camera. It distinguishes original R-12 from the Lexus R-134a retrofit branch, corrects the factory receiver assembly to `88470-50010`, and keeps any flush-boundary overlay locked until refrigerant state, recovery and independent zero-pressure checks are confirmed.

## Downloads

Use the GitHub Releases page:

- `LS400Toolbox-Android-v1.4.0.apk` — adds factory-bulletin-based pre-May-1991 suction routing, pre-August-1990 EPR identification, and pre-April-1990 power-steering return-tube context. No WebView, browser, private server, internet permission, or network dependency.
- `LS400Toolbox-Windows-v1.0.0.zip` — complete Windows desktop package. Extract the ZIP and run `LS400Toolbox.exe`.
- `LS400Toolbox.exe` — Windows launcher only; use the ZIP unless the adjacent runtime and model folders are already present.

## Android controls

Drag to orbit, pinch to zoom, double-tap to reset, and tap a modeled component to identify it. Use Full Car, A/C System, High Side, and Low Side to isolate service routes. The Windows and Android models now share the December-1989 EPC placement and route map; exact measured centerlines and fitting clocking remain target-vehicle capture items.

## Accuracy and safety

This is an educational visualization, not measured CAD or a substitute for the factory service manual. Passenger side appears screen-left when facing the vehicle. Exact service-port adapters and installed routing must be verified on the physical car. Never open a charged system, vent refrigerant, or flush through the compressor, receiver-drier, expansion valve, or EPR.

The public repository excludes private and factory-derived reference images that are not cleared for redistribution.
