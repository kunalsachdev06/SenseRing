# Website 3.5.2 — Android download refresh

27 October 2026. The download now serves signed Android 1.3.0, including the vertical presentation default and retained horizontal option. The copied APK is verified against its actual SHA-256 by the sync helper. The website layout, firmware and control path are unchanged from 3.5.1. Android validation records 45 passing core/device checks and a signed 1.2 to 1.3 update.

## Earlier website validation

# Website 3.5.1 — verified 27 October 2026

- Removed both Music and Presentations feature cards and their obsolete navigation target.
- Moved the revolve/open/close sequence to the main landing ring. Auto, Ring, Inside, Pause and Reset work; manual views stop the automatic opening sequence. The loop joins at a matching orientation.
- Android download now contains only a centred phone preview. It creates no second WebGL scene, and its motion pauses offscreen, in a hidden tab or on the dashboard.
- 93 website tests: 92 passed, 1 skipped, 0 failures/errors. The existing skip is Windows-account symlink creation. Updated checks cover manual/auto override, pause, loop continuity and the absence of a second ring renderer.
- Browser verification found one canvas in the complete page, zero in the Android section and zero removed feature-card elements. Manual Inside and Auto reset were inspected, and the phone layout was checked at 390 × 844 with no horizontal overflow. The viewport was restored afterward.
- Current captures are `artifacts/Landing-ring-3.5.1.png` and `artifacts/Phone-preview-3.5.1-mobile.png`.
- Syntax, unique HTML IDs, in-page links and the signed APK hash were checked. The APK remains Android 1.2.0; this revision changes no app, firmware or command delivery.

These checks apply to the local website and rebuilt source/companion/static packages. They do not confirm a public deployment.

## Earlier validation records

# Website 3.5.0 and Android download — verified 27 October 2026

- JavaScript syntax checks passed for the interface, model/story, bridge and build scripts.
- 91 website tests: 90 passed, 1 skipped, 0 failures/errors. The skip is the existing Windows-account symlink-creation check.
- New checks cover lazy scene creation, view/tab/dashboard visibility, pause/replay, observer cleanup, reduced motion, animation clock continuity and APK MIME delivery without keyboard actions.
- Dashboard markup has unique IDs and no ring-model mount. A real browser preview confirmed zero dashboard canvases, stopped Android-story playback and immediate local gesture feedback with laptop delivery unchecked.
- Inspected the Android story at normal browser width and a 390 × 844 phone viewport. Refined the mobile composition so the ring and phone do not overlap. No horizontal overflow was observed. Temporary viewport and reduced-motion overrides were reset.
- Light/dark story captures, a mobile capture and the adjusted web dashboard are saved in `artifacts/`. Browser error log was empty during the appearance check.
- Reduced-motion browser check confirmed a static scene, disabled pause control and no phone animation. Dashboard entry sets story playback false.
- The actual website Download for Android link saved `SenseRing-Android-1.2.0.apk` to Downloads. Its complete SHA-256 matches the signed Android delivery, release JSON and checksum file.
- The local APK route returns HTTP 200, the Android package MIME type and the correct 2,782,687-byte length. Android validation separately records 40 passing core/device checks, release signing/alignment and a successful signed 1.1 → 1.2 update.

The new story uses the unchanged CAD assembly and an actual current Android dashboard capture. The original landing-page ring remains. Both dashboards omit the duplicate ring. Gesture dispatch, firmware and battery behaviour are unchanged.

The APK supports Android 10+. Physical ring, OnePlus 13/Android 17, target-app behaviour and end-to-end radio latency remain unmeasured. These results verify the local checkout and generated packages; they do not establish that the existing public deployment has been updated.

## Earlier website validation record

# SenseRing product website validation

## Pause-button removal — 27 October 2026

Website 3.4.1 removes the top-bar Pause controls button and its click/render bindings. Connection, Sleep, navigation, Help and appearance controls remain. JavaScript syntax checking passed. The refreshed local Edge dashboard confirmed the button is absent and both ring connection and Sleep controls remain inside the top bar. Evidence: `artifacts/toolbar-without-pause.png`. No firmware change, physical ring action or operating-system key was sent for this UI edit.

## Floating toolbar update — 27 October 2026

Website 3.4.0; firmware 2.2.5-touch and companion 2.3.0 are unchanged.

- Moved the existing ring connection group, status/battery indicator, Connect/Disconnect, Sleep and connection error into the top bar, retaining their IDs and action handlers. The separate content-area connection strip is absent. Help, appearance and Pause controls remain in the same floating bar.
- Restored compact-on-scroll behaviour using a sticky rounded surface, with 64/24 px enter/exit thresholds. Existing sliding tab indicator and reduced-motion rules remain. Added tab/panel relationships, selected tab stops and Left/Right/Home/End keyboard navigation.
- Actual local Edge checks passed: Dashboard/Controls mouse and keyboard navigation, End/Left navigation, Help open/close and final dashboard display. Separate browser checks exercised Right/Home, scrolling to a compact header with the connection control still visible, and 390 px responsive layout. Browser warning/error log was empty.
- A separate source-level UI fixture exercised Disconnected → Connecting → Connected and Sleep → Disconnected without a real Bluetooth adapter or keyboard executor. At 320 px, battery/Disconnect/Sleep fit: main scroll/client width 305/305 px, header 287/287 px and connection group 262/262 px. The fixed red 2% indicator appeared only while connected; Sleep was enabled only in that state. Light and dark layouts were inspected. This fixture does not establish a fresh physical ring connection test.
- JavaScript syntax check passed, all 70 HTML IDs were unique and all ARIA references resolved. The **five targeted dispatch/cancellation tests passed**. The broader earlier 81-pass/one-skip suite was not rerun for this bounded UI change.
- Evidence: `artifacts/toolbar-desktop.png`, `artifacts/toolbar-mobile-connected.png`, and `artifacts/toolbar-ui-fixture.cjs`. The temporary fixture server was stopped, its tab closed and its viewport override cleared. The normal Edge dashboard was refreshed and left open; no real ring sleep or OS key action was sent.

## Ten-minute temperature sampling package — 27 October 2026

Website 3.3.2 packages firmware 2.2.5-touch. Temperature is sampled at startup and then every 600,000 ms from the previous attempt; status reads use the cached reading. Browser/companion behaviour and gesture timings are unchanged.

The XIAO build completed without warnings, upload verification passed on COM5, and live Serial STATUS reported `2.2.5-touch`, awake, touch ready and a valid startup temperature. The ten-minute interval was checked in the compiled configuration and scheduling source; a full ten-minute physical cycle was not observed. Earlier automated regression results below describe the unchanged gesture/browser/companion logic.

## Firmware workload package update — 27 October 2026

Website 3.3.1 packages firmware 2.2.4-touch. Browser behaviour and companion 2.3.0 are unchanged from the preceding dashboard update.

- The firmware retains its 2.2.3 touch/button logic and timings, with **68 host scenarios passing**. It disables per-action USB logging by default, formats status into a fixed buffer, refreshes routine BLE status every two seconds and samples chip temperature every ten seconds. Ordinary notifications precede background diagnostics; mode/connection changes still refresh cached readback promptly.
- The final XIAO build succeeded without warnings. Upload hashes verified on the identified COM5 ring, and live Serial STATUS reported `2.2.4-touch`, awake and touch ready, 80 MHz and the existing 0 dBm settings.
- These are code/build/upload/status checks, not a physical touch-to-target-app latency measurement. The earlier 81 software passes and one platform skip remain the current browser/companion regression record; no functional browser/companion code changed for this firmware packaging update.

## Dashboard responsiveness update — 27 October 2026

Website 3.3.0. Companion 2.3.0 and firmware 2.2.3-touch are unchanged.

- User feedback identified lag even in manual preview buttons, which bypass touch recognition and Bluetooth. This update targets browser work rather than further reducing gesture qualification.
- The dashboard's WebGL loop now stops completely when idle. Dragging, resize, gestures and Ring/Inside transitions request updates, with a final frame clearing finished highlights. Dirty input frames no longer wait for the renderer's 33 ms animation throttle. The landing ring retains its continuous 22-second turn and reduced-motion handling.
- Activity records reuse their DOM rows, update only changed text and format each timestamp once. A delivery acknowledgement no longer rebuilds all ten entries. Each command triggers one model highlight instead of two. Preview buttons have immediate press feedback and touch-action manipulation; no command waits for an animation.
- Full automated result: **81 passed, 0 failed, 1 Windows symlink fixture skipped** across 82 tests. Added checks cover idle rendering, immediate dirty-frame rendering, hero rotation/dragging, effect cleanup, exact inside-view settling, reduced motion, hidden models, activity-node reuse, bounded history and stable empty states. Existing command-first dispatch, cancellation, eligibility and Bluetooth tests pass.
- Real Edge browser inspection: all five Music previews updated their expected action; the Inside view rendered correctly; the browser warning/error log was empty. The preview-to-laptop checkbox remained unchecked and these checks sent no operating-system keys. The updated page was refreshed and left on the local dashboard for reconnection.
- Native browser performance samples showed 2.17 seconds of renderer task time over 21.29 seconds before, and 0.474 seconds over 19.40 seconds after (about 10.2% versus 2.4% of sampled time). Script time was 0.501 versus 0.055 seconds. These are indicative local workload samples, **not a controlled input-to-paint or physical end-to-end latency benchmark**: the selected mode, activity count and preview disclosure state differed. Raw metrics are `artifacts/dashboard-render-before.json` and `artifacts/dashboard-render-after.json`.
- The previous no-key Windows helper benchmark already measured warmed HTTP round trips around 1–4 ms. Its execution path is unchanged here. Real sensor/Bluetooth/foreground-app response still requires a physical retest; the existing multi-tap decision window remains necessary to distinguish gestures.

The following sections are earlier stage records.

## Modest touch-acceptance update — 27 October 2026

Website 3.2.1 / firmware 2.2.3-touch. The companion remains 2.3.0.

- Website timing metadata matches the new 140 ms first tap and 70 ms follow-up tap requirements. Gesture mappings and the command-first delivery path are unchanged.
- The relevant Bluetooth/client core suite passed all **17 tests**, and its source passed syntax checking. The broader software suite's earlier 71 passes/one platform skip remain the preceding-stage record; unrelated suites were not rerun for this timing-metadata-only edit.
- Firmware passed **68 host scenarios**, compiled and uploaded successfully. Live Serial status confirmed 2.2.3 running awake with touch input ready.
- This is relaxed digital pulse acceptance, not a hardware sensitivity or detection-distance adjustment. Physical tap comfort and unintended activations still require a user retest.

The records below describe earlier stages.

## Command latency update — 27 October 2026

Website 3.2.0 / companion 2.3.0 / firmware 2.2.2-touch.

- Restored the original command-first path: fixed token → active remapping → immediate companion request, followed by UI/3D work. Removed the browser's acknowledgement-gated command chain. Server-side ordering, bounds, readiness checks, actual acknowledgements and cancellation remain; all outstanding requests are aborted on pause/mode/session changes.
- Live BLE operation is notification-driven. Initial status and explicit mode-confirmation reads remain; recurring 1.5-second diagnostic reads are disabled in the page.
- Full software suite: **71 passed, 0 failed, 1 platform-specific symlink skip**. New checks cover immediate concurrent dispatch without earlier replies, all-request cancellation, eligibility gates, bounded in-flight requests, command-before-render order and notification-only status behaviour.
- Firmware has **64 passing host scenarios** and compiled/uploaded successfully. Live Serial status confirmed 2.2.2-touch running awake on the ring. Its decision waits changed from 500 to 250 ms for single/double taps, 220 to 120 ms for triples, 1,200 to 700 ms for holds and 300 to 180 ms for rearming. First/follow-up tap and release qualification are unchanged.
- No-key Windows benchmark: the actual warmed PowerShell input/acknowledgement loop was used with its key-injection call replaced by a no-op. Before/after warmed HTTP median was 1.42/1.90 ms and P95 was 3.63/3.53 ms; five-command browser bursts were 8.98/8.08 ms. This shows the companion was already fast; the deliberate firmware waits were the principal identified delay before display. These numbers exclude physical sensor/BLE/UI/target-app latency and are not a measured human response-time improvement.
- Benchmark source and raw observations: `artifacts/benchmark-command-latency.cjs`, `artifacts/latency-before.json`, `artifacts/latency-after.json`. User physical retesting remains necessary after refreshing the website and reconnecting the ring.

The earlier validation sections below are historical stage records.

## Setup and helper-readiness update — 27 October 2026

Website 3.1.0 / companion 2.3.0; firmware remains 2.2.1-touch.

- Full automated suite: **65 passed, 0 failed, 1 Windows symlink fixture skipped** (66 total). Added five browser readiness-policy tests and four companion lifecycle/recovery tests. These use fake executors; no OS keys are injected.
- Nine JavaScript application/server/build entries passed syntax checks. The updated launcher passed PowerShell parsing.
- Browser verification: Help opens from landing/dashboard; setup contains the working download route, three steps, recovery details and retry. Native Escape closes the dialog and restores focus. Open dashboard works from setup. Light/dark layouts and the 390 px layout were checked without horizontal document/main/dialog overflow.
- A temporary injected-helper server reproduced Unavailable → Starting → Ready through the real Retry button. The fixture recorded **two preparation attempts, zero keyboard writes**. With the companion stopped, the same UI showed the first-use download/start guidance. The actual local companion was then restored and reported Ready.
- Portable ZIP extraction into a folder containing spaces was tested with no Node executable available on the test process's PATH. Its WSH → PowerShell launcher used the included official runtime, started a separate port 3198 companion and reached Ready. That temporary instance was shut down. No startup entry was installed and no keyboard action was sent.
- Node.js 24.22.1 Windows x64 was downloaded from the official distribution and verified against its pinned SHA-256 (`d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5`); the full license is included. The runtime differs from this development environment's modified Node executable, which was not redistributed.
- Output is gated on the helper's actual READY handshake. Starting/unavailable helpers return 503 for commands without queueing them for replay. Health only observes state; authenticated `/prepare` performs user-triggered recovery. Disabled and older companions remain blocked from delivery in the browser.
- Evidence: `artifacts/setup-unavailable.png`, `artifacts/setup-mobile-light.png`, `artifacts/setup-ready-dark.png`; fake UI fixture in `artifacts/readiness-ui-fixture.cjs`. The current portable package includes its runtime; its size is approximately 35 MB. Package integrity and public build freshness are checked after generation.

Physical ring operation and the hosted HTTPS-to-loopback browser permission flow remain untested in this update. The original review records below describe previous stages; they are retained as history.

Target hardware/protocol: **XIAO ESP32-C3, red TTP223, tactile button, firmware 2.2.1-touch, USB power**.

Record date: **27 October 2026**. The product refresh is a local source update. No public deployment, physical Bluetooth pairing, real key injection or startup installation is established by these records.

## Verification status for this refresh

| Area | Evidence available | Release status |
|---|---|---|
| Bluetooth core | 16 fake-GATT tests passed, including mode authority, serialization and late-session cleanup | Passed |
| Windows companion | 24 tests passed; one symlink fixture skipped because this Windows account cannot create symlinks | Passed with one platform skip |
| Local product state | 9 tests passed: migration, persistence, import/export, invalid actions/groups/versions, non-string action rejection, protected default and storage failure | Passed |
| Appearance lifecycle | 7 tests passed: saved startup, reduced motion, native reveal, rapid requests, crossfade interruption, snapshot failure and preference changes | Passed |
| Browser scripts | Eight JavaScript files parsed; 57 unique HTML IDs, 31 literal script ID references and all local HTML references checked | Passed |
| Desktop/mobile UI | Landing, Dashboard and Controls inspected; light/dark choice, profiles, preview/pause and mode controls exercised | Passed in local browser |
| Coloured 3D assembly | 150 parts, 26 batches; assembled/inside views rendered with no console errors, reset and reduced-motion preference checked | Passed visually |
| Tech background | Both themes and 390 px layout inspected; moving signal offsets observed, reduced motion disables both animations, hidden landing pauses pulses, decorative layer cannot receive clicks | Passed visually and through DOM styles |
| Public static output | Exactly 12 public files; output matched the explicit HTML/CSS/JS/assets/downloads allowlist | Passed |
| Release archives | Companion: 41 entries; source: 46 entries. Integrity, exact source bytes, safe paths, local documentation links and private-file exclusions checked | Passed |
| Windows launcher | Corrected timeout handling across PowerShell versions; normal background launch returned a healthy Windows companion with output enabled | Health/startup passed; no real keys tested |

The final combined automated result is **56 passed, 0 failed, 1 skipped** across 57 tests. Test devices and key executors were fake. The server's real-path containment check remains enabled despite the symlink-fixture skip. The initial connection-restricted test attempt could not reach its local fixtures; the final run with local connections available passed.

## Browser checks completed

- Desktop inspection used 1440 × 1000; phone inspection used 390 × 844. Landing and the remaining Dashboard/Controls views fit the 390 px width without horizontal page overflow. The decorative oval and standalone landing model label have since been removed.
- Both appearances render correctly and persist after reload. Selected normal-text contrast pairs exceed 4.5:1: light supporting/page 4.70, light supporting/surface 5.21, light connected/page 5.06, primary button 5.53, dark supporting/surface 6.83 and dark accent/surface 7.80. This is a targeted contrast check, not a full accessibility certification.
- Ring/Inside toggles, reset, translucent base and coloured components were visually inspected. The renderer responds to reduced-motion preference. The phone/desktop and reduced-motion emulation overrides were cleared after testing.
- Created a test profile, changed a mapping, exported and reimported it, renamed it, verified persistence after reload, and removed only the test profiles. The default profile's Delete control is disabled. Delete uses a cancellable in-page dialog.
- Pause/Resume and a manual preview were exercised with system output disabled. Previews start with laptop output unchecked. Cancellation and expiry are also covered by the fake-executor tests.
- Browser warning/error log was empty during final inspection. No ring pairing or real operating-system key output occurred.

Current screenshots are saved under `artifacts/`: `product-landing-desktop.png`, `product-landing-mobile.png`, `product-dashboard-dark.png` and `product-inside.png`. These images are review evidence and are excluded from the static public build.

The subsequent connection-bar cleanup removes the Laptop status, Connect laptop button and companion download link from the shared application header. Companion discovery and retries run automatically in the background on local and hosted pages. Local browser inspection confirmed the section is absent and the preview-output checkbox becomes available through automatic companion discovery; it remained unchecked. Updated evidence is `artifacts/laptop-section-removed.png`.

Landing animation cleanup: the hero ring now rotates continuously through 360 degrees, with a nominal 22-second revolution. Two browser captures show different ring poses; two equal-size ring captures with reduced motion enabled are pixel-identical. Oval/label elements are absent, the renderer parses successfully, and the browser warning/error log is empty. The temporary motion/viewport overrides were cleared. Evidence is `artifacts/landing-revolving.png` and the corresponding motion-check frames. Dashboard movement and the physical geometry are unchanged.

Session removal: navigation now contains Dashboard and Controls only. Removed the Session page, timer/focus controls, timer callbacks, clock class and their styles. Browser inspection confirmed both remaining views work and Music/Slides still render their expected five gestures/three groups. The ring was disconnected during this UI check; no keys or physical mode writes were sent. The console warning/error log was empty. Latest navigation evidence is `artifacts/session-removed.png`.

Background refresh: visually reviewed the current official Nothing homepage and teenage engineering OP-1 field page, with findings in `PRODUCT_RESEARCH.md`. Added original decorative CSS/SVG grid, angular paths, short travelling light segments and a soft ambient glow. The dashboard background is quieter and static. No external assets, libraries or animation loop were added.

In browser checks, the first signal's computed dash offset changed from 73.9577 px to 24.5933 px. Reduced-motion emulation changed both signal and glow animation names to `none`. The landing signal's play state became `paused` after entering the dashboard. The mapping dropdown opened and closed normally. Landing, Dashboard and Controls each fit the 390 px viewport; the app's own scroll width was also 390 px. The console warning/error log was empty. Original dark appearance was restored and all temporary viewport/media overrides were cleared.

Current background screenshots: `artifacts/tech-background-dark.png`, `artifacts/tech-background-light.png`, `artifacts/tech-background-mobile.png` and `artifacts/tech-background-dashboard.png`. The earlier oval, model label, laptop connection section and Session UI remain absent.

After browser testing, the dry-run server was stopped and the normal local companion was started in the background. Only its health was read; this did not pair the ring, send a key or install a sign-in entry.

Engineering details, setup/reference panels and hardware diagnostics should not reappear in the user interface. The connected battery indicator is the specifically requested fixed 2% placeholder, not telemetry.

## Model accuracy and scope

The existing enclosure geometry and uniform proportions are retained. Controller, sensor, battery and tactile parts use the established CAD placements and measured/assumed envelopes. Colours follow the confirmed red touch module, official board reference and supplied battery image. Fine PCB printing/passive placement is illustrative, not a manufacturing reconstruction.

The website-only assembly builder must not overwrite or add component solids to the print-team enclosure files. Improved shading and camera framing do not reduce the physical enclosure's dimensions.

## Interface motion checks

Compared Motion UI, Motion, Magic UI and Aceternity using official documentation. Browser inspection confirmed native `reveal` switches in both directions and via keyboard. The sun/moon icons and accessible labels match the selected theme; no temporary transition flag or fallback class remained after completion. Seven automated appearance tests cover lifecycle failures and cancellation independently of a physical ring.

The navigation marker moved from x=4 px toward the Controls target at x=105 px, with an intermediate transform observed. Panel, dropdown and profile-dialog animation names were verified. The profile dialog was cancelled, and the dropdown was closed with Escape without changing mappings. Card pointer coordinates updated and the hover glow/lift progressed. Browser native double-click delivery can be coalesced during snapshot capture; programmatic latest-request handling is covered by the automated tests.

Reduced-motion emulation selected the instant theme path, hid pointer glows and disabled background animation. At 390 px, Landing, Dashboard and Controls stayed within the viewport; the Controls navigation pill and selected button both measured 171 px wide. The console warning/error log was empty. No physical ring pairing or Windows key delivery was performed.

For visual review, a local capture briefly used a slower reveal; the release duration was restored to 620 ms and the browser reloaded the release source. Screenshot tooling can resize the emulated viewport while capturing a transition, so intermediate review images are not pixel-alignment evidence. Stable appearance and component screenshots are `artifacts/theme-transition.png`, `artifacts/motion-dialog.png`, `artifacts/motion-card-hover.png`, `artifacts/motion-mobile.png` and `artifacts/motion-finished.png`. Final normal-speed switches used the native reveal and left no temporary flags or classes. The original dark appearance and normal viewport/media settings were restored before handoff.

## Physical integration still required

1. Upload/retain the current firmware and confirm USB power and the verified touch/button wiring.
2. Connect SmartRing in a supported browser and confirm the website reads the ring's actual mode.
3. Test each gesture and both grouped presentation inputs with the intended profile.
4. Switch mode with the tactile button and the website; confirm actual acknowledgement.
5. With the normal companion enabled, focus the intended app and verify media keys, Page Down, Page Up and Enter.
6. Exercise Pause/Resume while using the real ring, then sleep, wake and reconnect. A command already issued to Windows cannot be undone.
7. Test unexpected disconnection separately from deliberate sleep.

A simulated ring cannot establish radio reliability. A fake executor cannot establish foreground application behaviour. Launcher syntax and a successful local health response do not establish real key delivery.

## Platform and telemetry boundaries

The battery is physically installed but disconnected. There is no measurement or charging code. The connected-state display shows a fixed 2% with a red battery line. The visible extra label has been removed at the user's request; the accessible description retains the fixed-preview qualifier. Status reads remain available internally for mode synchronization. This display must not be treated as a battery measurement.

The actual `renderConnection` function was exercised with controlled disconnected, connecting, connected and disconnected states. The battery placeholder is visible only while connected, and normal status text returns afterward. Browser inspection verified the disconnected state hides the battery and the fill computes to red. After label cleanup, source checks verify the indicator contains only the icon and 2% text. The console warning/error log was empty. Physical Bluetooth connection was not performed for this change; the isolated local-file preview was blocked by browser policy and was not used as visual validation. Evidence for the normal disconnected state is `artifacts/battery-disconnected-check.png`.

The Windows companion handles laptop output. The browser dashboard is not the native Android companion needed for unrelated phone-app control. Public production deployment and physical end-to-end verification remain separate release steps.
