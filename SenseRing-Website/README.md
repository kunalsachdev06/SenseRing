# SenseRing website 3.5.2

Product website, Web Bluetooth dashboard and Windows companion for SenseRing touch firmware **2.2.5-touch**, with the Android **1.3.0** download. No npm dependencies are required.

## Quick start for development

Install Node.js **22 or later**. From this folder:

```text
npm run check
npm test
npm start
```

Open http://127.0.0.1:3199/ in Chrome or Edge. On Windows the local companion prepares its keyboard helper without sending a key. Connect SmartRing, then focus the intended music player or presentation. For interface-only development, set `SENSERING_DRY_RUN=1` before starting; real command delivery is disabled in that mode. Stop a foreground server with Ctrl+C.

## Use without a terminal

Extract `downloads/SenseRing-Laptop-Companion.zip` into a permanent folder and double-click **Start-SenseRing.cmd**. The full portable download includes its verified Windows x64 Node.js 24.22.1 runtime. The source checkout does not include the uncompressed runtime; its launcher can use installed Node.js 22+.

Use **Stop-SenseRing.cmd** to stop the matching companion. The optional scripts/Install-Startup.cmd and Remove-Startup.cmd add/remove a current-user sign-in shortcut. Nothing installs or connects automatically just by opening the page. See [BRIDGE_SETUP.md](BRIDGE_SETUP.md) for setup, readiness, origins, logs and the HTTP contract.

## Website and control flow

- Landing ring rotates and opens its curved covers to reveal the coloured CAD components. Auto, Ring, Inside, Pause and Reset are available; animation pauses offscreen/hidden and respects reduced motion.
- Dashboard has connection/mode, latest action, local gesture previews and activity, without a second ring model.
- Floating top bar contains connection, the connected battery icon, Sleep, navigation, Help and appearance.
- Light/dark themes, circular theme transition with fallback, decorative tech background and responsive layouts are included.
- Controls supports per-mode mappings and local profiles with validated JSON import/export. Profile format is compatible with the Android app.
- The Android section has the signed 1.3.0 APK, checksum, installation information and a visibility-gated phone preview.

Ready ring notifications are interpreted and sent before decorative interface work. The browser does not wait for earlier command acknowledgements before sending the next valid request; the Windows companion bounds and serializes key delivery. Expired or disconnected actions are not replayed. Preview clicks send no system key unless their separate delivery checkbox is enabled. Ring actions use the ready companion automatically.

## Ring wiring and gestures

| Connection | XIAO pad |
|---|---|
| TTP223 VCC / GND | 3V3 / GND |
| TTP223 OUT, momentary active HIGH | D2 / GPIO4 |
| Tactile switched contacts | D1 / GPIO3 and GND |
| Power/upload | USB-C |

See [Firmware/PIN_CONNECTIONS.md](Firmware/PIN_CONNECTIONS.md) and [Firmware/BLE_PROTOCOL.md](Firmware/BLE_PROTOCOL.md). Music defaults: single play/pause, double next, triple previous, hold volume up, tap-and-hold volume down. Presentation defaults: single/hold next, double/tap-and-hold previous, triple Enter. Button double press changes mode; hold two seconds and release requests sleep. Fifteen minutes of inactivity also sleeps the firmware. USB power-up starts advertising without a button press.

One BLE host is intended at a time: disconnect the website before connecting Android. Bluetooth requires a supported browser, a user-approved picker and HTTPS or localhost. A static website cannot launch a local Windows process by itself. For hosted-to-local restrictions, use the localhost dashboard.

## Build and deploy

```text
npm run build
```

Deploy **dist/**, not this source directory. The included vercel.json sets the correct build command and output. In a combined repository choose **Website** as the Vercel root; in a separate website repository use the repository root. Included download artifacts keep the current links usable. See [DEPLOYMENT.md](DEPLOYMENT.md).

The keyboard companion stays on the user's Windows PC. Companion 2.3.2 allows https://kunalsachdev06.github.io (including the SenseRing GitHub Pages site), https://sense-ring.vercel.app and documented localhost origins. Allow the browser's local-network request when prompted. Update an older companion by stopping it, downloading/extracting the current ZIP and starting that copy. Set SENSERING_ALLOWED_ORIGINS to exact trusted origins for another host before starting the companion. No public keyboard-control server is required.

## Rebuild downloadable releases

```text
python scripts/prepare-runtime.py
python scripts/package-release.py
```

Python 3 is only needed for these packaging helpers. Runtime preparation verifies a pinned Node.js binary; packaging includes its license. The APK and firmware ZIP already supplied in downloads are the matching releases. After changing Android, build/package Android, then run `python scripts/sync-android-release.py` before packaging the website. The optional sync helper finds a sibling named SenseRing-Android in this repository, or Android in the original combined layout. Otherwise, copy the released APK/screenshot and update download metadata explicitly.

## Source map

| Files | Responsibility |
|---|---|
| index.html, gesture-ring-style.css, gesture-ring-script.js | Interface and interactions |
| sense-ring-core.js | BLE and gesture interpretation |
| product-state.js, companion-state.js, theme.js | Profiles, readiness and appearance |
| ring-visual.js, assets/ | Ring model, icon and phone screenshot |
| android-experience.js, android-section.css | Visibility-controlled phone preview |
| local-media-bridge.js, scripts/bridge-server.js | Loopback Windows command server |
| scripts/, Start-SenseRing.cmd, Stop-SenseRing.cmd | Packaging and optional background launch |
| Firmware/ | Matching firmware snapshot and wiring/protocol documentation |
| tests/ | Node tests using fake Bluetooth/key executors |
| downloads/ | Current user-facing release files |
| legacy/ | Historical AS5600 sketch, excluded from the current hardware setup |

## Data and current limits

Profiles remain in browser storage; no account is required. The current connected **2%** battery display is a fixed UI value, not a sensor reading. Current firmware has no battery telemetry or charging control, and the housed cell remains disconnected. This package changes no hardware or application behaviour.

Automated tests cover software behaviour, not calibrated touch-to-action latency, RF range, battery runtime or universal target-app support. See [VALIDATION.md](VALIDATION.md) for recorded checks and [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md) for design references. Rights and third-party notices are in RIGHTS_AND_NOTICES.md.
