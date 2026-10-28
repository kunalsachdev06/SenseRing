# SenseRing for Android

Native Kotlin and Jetpack Compose companion for SenseRing Touch, Android 10+. Version 1.3.0 retains charcoal/ivory surfaces, copper accents and the compact rounded navigation capsule. A short native 3D launch sequence replaces the dashboard's ring preview. It needs no terminal helper, account or internet connection on the phone.

## Install or update

1. Download the APK from the website's Android section, or transfer the supplied release asset `SenseRing-Android-1.3.0.apk` to the phone and install it. It is signed with the same key as the previous releases and can update an existing installation without uninstalling it.
2. Open SenseRing, tap **Connect ring**, allow Nearby devices and notifications, and choose **SmartRing** in Android's picker.
3. Keep the ring USB-powered. Disconnect its Bluetooth connection in the laptop website before connecting the phone; the firmware accepts one central connection at a time.
4. Start music in a player that supports Android media controls. The ring can then control it while SenseRing is in the background or the screen is locked, subject to Android and the player's policies.

On Android 10/11, the system may require Location Services to be on for the initial search. SenseRing requests no location permission.

## Opening and dashboard

On a fresh Activity launch, the actual CAD ring makes a full turn, its covers separate to reveal the coloured components, and the SenseRing wordmark appears. The 3.4-second sequence has a Skip button. It pauses when the Activity is not resumed, respects Android's disabled-animation setting and does not replay when returning from another app or restoring a completed Activity.

The launch model uses OpenGL ES 2 on a dedicated worker, with at most one pending requested frame. There is no continuous rendering loop or WebView. Its EGL surface, buffers and worker are released when the sequence leaves the screen. If graphics cannot start, the app continues to the dashboard. Bluetooth/action handling does not wait for the sequence.

The dashboard contains connection and mode controls, the latest action, local previews and activity. It no longer mounts a 3D ring. The website keeps its landing-page ring and offers a separate, visibility-gated phone preview and Android download.

## Music and app controls

**Music** uses Android's active media-session route for play/pause and track changes. Volume adjusts media by default, the voice channel during calls/voice communication, and the ringer while the phone is in ringing mode. Android controls call, ringer, Do Not Disturb, fixed-volume and remote-output behaviour; SenseRing does not override those policies.

**Apps / slides** uses optional Accessibility access for taps, swipes, scrolling and available arrow actions in the app on screen. Open **Settings → App controls → Touch-control access**, read the explanation, and enable **SenseRing app controls** in Android Settings.

Choose **All apps** for general use, or **One chosen app** to restrict touch commands. New installations default to All apps. An upgrade from 1.0.0 preserves its previous single-app scope; expanding an already enabled service asks for an explicit in-app choice. The service checks the foreground app name without retrieving or storing screen text.

The screen must be awake and unlocked for touch commands. **Swipe up / down** is the default: Next swipes up and Previous swipes down. Choose **Swipe left / right**, **Tap screen edges**, or **Arrow keys** (Android 13+) when the target app needs them. The first 1.3 update changes the previous horizontal default to vertical; an explicit left/right selection made afterward stays saved. Existing edge-tap and arrow selections are retained. Scroll up/down mappings send vertical swipes, or available directional arrows in arrow mode. If Android does not expose a requested arrow action, the app falls back to a swipe. Different apps interpret these inputs differently; a player or app may ignore unsupported commands.

Android may initially block Accessibility for a sideloaded APK. If so, open **App info → menu → Allow restricted settings**, then return to enable the service. Music controls work without Accessibility.

## Gestures and profiles

| Ring gesture | Music default | Apps / slides default |
|---|---|---|
| Single tap | Play / pause | Next / swipe up |
| Double tap | Next track | Previous / swipe down |
| Triple tap | Previous track | Select / tap |
| Hold 0.7 seconds | Volume up | Next / swipe up |
| Tap, lift, then hold | Volume down | Previous / swipe down |

The tactile double press switches mode. Firmware groups single tap/hold and double tap/tap-and-hold in its presentation mode; those groups share a mapping. The app adopts the ring's confirmed mode on connection.

Profiles remain compatible with the website's version-1 JSON format. All existing action IDs, firmware commands, UUIDs and gesture grouping are unchanged. Save, rename, reset, delete, import and export profiles in Controls. Previews update the interface without sending phone commands.

## Phone states and recovery

| State | Behaviour |
|---|---|
| SenseRing open, or another app in front | Media uses the active Android player; touch works in the permitted foreground app while unlocked |
| Screen locked or off | Media/volume requests continue through the connected-device service; touch commands are withheld |
| Bluetooth turned off and back on | Commands wait; the service attempts to reconnect when Bluetooth returns |
| Device temporarily out of range | Bounded reconnect attempts; no stale commands are replayed |
| Phone restart, after first unlock | Attempts to restore the previously enabled connection when its saved device and Bluetooth permission remain available |
| App update | Attempts to restore a connection the user left enabled |
| User chose Disconnect or Sleep | Does not restart that connection after a reboot/update |
| User force-stopped the app | Open SenseRing again; the app does not bypass Android's stopped state |
| Ring is asleep or unpowered | Wake/power the ring before it can reconnect |

The foreground service has a quiet ongoing connection notification, including a Disconnect action. Closing the app screen or removing its recent-app card does not intentionally stop that service. Android/OxygenOS can still limit background operation. If needed, use **Settings → Open app settings** and allow SenseRing's background activity in the phone's battery settings. Exact labels depend on OxygenOS.

The firmware's existing 15-minute inactivity sleep still applies. Use the ring's button to wake it, then reconnect. There are no wake-lock loops, periodic status polling or external scripts.

## Data and prototype battery

No account, cloud, Internet, camera, microphone, contacts, phone-call-management, notification-listener or broad storage permissions are requested. Profiles/settings stay on the phone; the short activity list is held in memory. File imports/exports use Android's document picker. Boot permission is used only to restore a connection the user previously enabled.

The connected **2%** battery icon preserves the website prototype. It is a fixed display value, not measured telemetry. The current ring remains USB-powered; this release changes no hardware, firmware, battery wiring or charging controls.

## Source and builds

Open this directory in Android Studio. The project uses `minSdk 29`, `compileSdk/targetSdk 36`, AGP 8.13.2, Kotlin 2.2.21 and the checksum-pinned Gradle 8.14.3 wrapper. JDK 17–24 is supported by this setup. The supplied APK is a signed, shrunk release build. The private signing key is intentionally absent from this source checkout.

The workstation's private toolchain lives under `.toolchain/`. `scripts/bootstrap.py` downloads verified Gradle and Google's SDK manager on Windows; SDK agreements are reviewed separately. SDKs/caches are excluded from the source ZIP.

### Fresh checkout: debug build

Install Android Studio, use an installed JDK 17-24, and install SDK Platform 36 and Build Tools 36.0.0 through SDK Manager. Review/accept the SDK terms on your own machine. Open this folder in Android Studio so it writes your local SDK path; alternatively configure ANDROID_HOME. Do not commit local.properties. Internet access is needed for the initial Gradle/dependency download.

From this directory on Windows:

```powershell
.\gradlew.bat :core:test :app:assembleDebug :app:lintDebug
```

On Linux/macOS use `sh gradlew` with the same tasks. The debug APK is app/build/outputs/apk/debug/app-debug.apk. Debug signing is separate from the supplied release signature and cannot update the existing release installation. Keep user profiles exported before choosing to replace an installation with a differently signed build.

For core tests without an Android SDK:

```powershell
.\gradlew.bat -PcoreOnly :core:test
```

### Signed release build

Restore the original private .signing directory to make updates to the existing release identity. Keep it outside GitHub. The Windows helper uses JAVA_HOME, creates local SDK settings only for a prepared local toolchain, and builds/tests/lints the release:

```powershell
.\scripts\build.ps1
python scripts/package_release.py
```

For a separate new installation identity only, use `.\scripts\build.ps1 -NewSigningKey`. This creates private signing material locally and cannot update APKs signed with the original key. Never commit the generated files.

With SDK/signing configured, direct wrapper commands are `:core:test :app:assembleRelease :app:lintRelease`. Optional device tests are `:app:connectedDebugAndroidTest`, on an isolated emulator or dedicated test phone.

Device tests reset SenseRing's test settings and briefly adjust/restores media volume. Use a dedicated test environment. The editable source archive includes the native renderer, unchanged 26-part CAD assembly, build wrapper, tests, helper scripts and actual app screenshots.

Keep `.signing/` privately backed up to sign future updates. It is excluded from source archives/version control. A new checkout without the original key can use `scripts/build.ps1 -NewSigningKey` only for a separate installation identity; a different key cannot update the existing signed app.

See [RESEARCH.md](RESEARCH.md) for references and design choices, and [VALIDATION.md](VALIDATION.md) for measured checks and remaining physical-phone testing.

Project rights, external dependency notices and source provenance are described in RIGHTS_AND_NOTICES.md.
