# SenseRing

A touch-controlled wearable ring for music and presentations, with a web dashboard, Windows companion and native Android app.

**[Open the website](https://kunalsachdev06.github.io/SenseRing/)** · **[Download the Android APK](https://kunalsachdev06.github.io/SenseRing/SenseRing-Website/downloads/SenseRing-Android-1.3.0.apk)** · **[Download the Windows companion](https://kunalsachdev06.github.io/SenseRing/SenseRing-Website/downloads/SenseRing-Laptop-Companion.zip)**

## Project folders

| Project | Version | Documentation |
|---|---|---|
| Ring firmware | 2.2.5-touch | [Firmware setup](SenseRing-Firmware/README.md) · [Pin connections](SenseRing-Firmware/PIN_CONNECTIONS.md) · [BLE protocol](SenseRing-Firmware/BLE_PROTOCOL.md) |
| Website | 3.5.2 | [Website setup](SenseRing-Website/README.md) · [Deployment](SenseRing-Website/DEPLOYMENT.md) |
| Windows companion | 2.3.1 | [Companion setup](SenseRing-Website/BRIDGE_SETUP.md) |
| Android app | 1.3.0, Android 10+ | [App setup and builds](SenseRing-Android/README.md) · [Design references](SenseRing-Android/RESEARCH.md) |

## Get started

1. Follow the [wiring guide](SenseRing-Firmware/PIN_CONNECTIONS.md) and upload `SenseRing-Firmware/SenseRing_Touch/SenseRing_Touch.ino` with both headers in the same sketch folder. On USB startup, the ring advertises as **SmartRing**.
2. **Windows:** extract the companion ZIP and open `Start-SenseRing.cmd`. Alternatively, install Node.js 22+, run `npm start` inside `SenseRing-Website`, and open `http://127.0.0.1:3199/` in Chrome or Edge. The companion delivers music and presentation actions to the laptop.
3. **Android:** install the signed APK, open SenseRing and grant the requested Bluetooth access. Enable optional Accessibility control for presentation gestures, following the app README. Android controls remain subject to the target app and phone state.
4. Connect the ring to one host at a time. Disconnect it from the laptop before connecting the Android app, and vice versa.

## Development

- Website: run `npm test`, `npm run check` and `npm run build` from `SenseRing-Website`.
- Android: follow the [SDK and Gradle instructions](SenseRing-Android/README.md). Private release signing keys are excluded.
- Firmware: the [firmware README](SenseRing-Firmware/README.md) covers Arduino setup, controller tests and diagnostic sketches.
- Hosting: GitHub Pages serves the site from `SenseRing-Website`; the repository's root page forwards visitors there. For Vercel, select **SenseRing-Website** as the project root.
- Android download updates: build/package the app, then run `python scripts/sync-android-release.py` from `SenseRing-Website`.

Read each project's `VALIDATION.md` for recorded checks and remaining device testing, and `RIGHTS_AND_NOTICES.md` for source rights and third-party notices.
