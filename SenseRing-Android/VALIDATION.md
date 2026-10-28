# SenseRing Android 1.3.0 — validation

27 October 2026. Application ID `com.sensering.app`, version code 4, Android 10+ / API 29 minimum, target API 36. Signed APK: 2,782,687 bytes.

## Current checks

| Check | Result |
|---|---|
| Core protocol/profile/policy tests | 26 passed, 0 failures/errors |
| Android 10 isolated-emulator tests | 19 passed, 0 failures/errors |
| Release assembly and lint | Successful; 0 lint errors, 6 newer-dependency suggestions |
| Signing identity | Same verified public certificate as earlier releases |
| Update installation | Signed 1.2.0 installed, then updated to signed 1.3.0 successfully; version code 4 confirmed |
| Native compatibility | APK ZIP and all four native ELF architectures verified for 16 KB alignment |
| Captures | Nine current native app captures, including the vertical-default setting |

The five added Android cases verify the fresh vertical default, migration from the old horizontal default without losing profiles, retention of a later horizontal choice, retained edge/arrow choices, invalid-style recovery, both choices in Settings, actual Android StrokeDescription path endpoints and preserved horizontal/select/scroll directions. Next swipes up, Previous swipes down. Both use the existing 170 ms gesture duration. The action IDs, BLE protocol and profile JSON are unchanged; action labels are axis-independent.

The earlier 14 app/service/rendering/scope/launch checks also pass. Capture comparison now scans rows, avoiding full-resolution Java-array allocations in the test process, and the Skip test helper freezes its test clock to avoid racing launch completion. These are test-only changes.

Device tests use an isolated Android 10 emulator; the path tests construct actual Android gesture paths but do not establish that every third-party presentation app accepts them. No physical OnePlus 13, real ring radio or Android 17 success is claimed. The user's Android Accessibility approval is still required; this update does not bypass restricted settings or expand permissions.

## Current delivery identity

- APK SHA-256: `caccff24c101e9fc9030fb959f55fb717359bc1556f683bff652dcc8c9ad3406`
- Public signing-certificate SHA-256: `afcf38aa744d5260c0df8b0011b7cb5c77874aa7e4ceb91ea7a45b6da09343d8`
- Unchanged CAD SHA-256: `d222b03a1c2cef901e62abd39088af748ae2225956d44a61de6b8838275dfc4d`

The source package and APK are covered by `outputs/SHA256SUMS.txt`. Private keys, SDKs, caches and workstation configuration are excluded. Existing profiles, ring connection and app scope are retained. The previous horizontal default changes to vertical once; selecting horizontal in 1.3 persists that choice. Firmware, hardware and the fixed prototype battery display are unchanged.

## Earlier release validation

# SenseRing Android 1.2.0 — validation

27 October 2026. Application ID: `com.sensering.app`. Version code 3. Signed APK: 2,782,687 bytes (about 2.8 MB), minimum API 29 / Android 10, target API 36.

## Confirmed checks

| Check | Result |
|---|---|
| Core protocol/profile/phone-state tests | 26 passed; 0 failures/errors |
| Android 10 / API 29 tests | 14 passed; 0 failures/errors, isolated x86_64 emulator |
| Signed release assembly | Successful, including Kotlin and R8/resource shrinking |
| Release Android lint | 0 errors; 6 newer-dependency suggestions |
| Signature | Verified; same RSA signing identity as 1.0.0 and 1.1.0 |
| Signed update installation | Installed signed 1.1.0, then updated in place to signed 1.2.0 successfully |
| Installed metadata | Package manager confirmed version code 3, version 1.2.0, min API 29, target API 36 |
| APK ZIP and native ELF alignment | 16 KB verified for arm64-v8a, armeabi-v7a, x86 and x86_64 |
| CAD asset | All 26 parts, byte-for-byte unchanged |
| Launch rendering | Actual rotating and opened-ring captures differ; coloured touch module visible; wordmark frame inspected |
| Launch completion | Enters dashboard; launch graphics worker exits; Skip works; returning from background does not replay |
| Dashboard | No ring-model node; connection/mode, action, previews, profiles and compact navigation work |
| Captures | Eight actual app screenshots in `screenshots/` |

The app launch uses a short, request-driven OpenGL ES 2 sequence on a dedicated worker. At most one frame is pending; there is no animation polling loop. The TextureView/EGL surface and worker are released on removal. The dashboard does not mount a renderer. Reduced-motion/disabled-animation and graphics-failure paths allow entry without waiting for the model. The animation's clock advances only while resumed.

## Test coverage and evidence limits

The 26 core tests cover firmware token/mode interpretation, website-format profile interchange, validation/persistence, protected profiles, limits, current-session checks, pending mode/sleep, stale events, bounded reconnection and phone-state/scope policy. They are unchanged from 1.1 because the control path was not changed.

The 14 Android tests comprise six app/service checks, two rendering/dashboard checks, three scope/navigation checks and three launch-sequence checks. They cover native navigation and profile editing, Accessibility disclosure, local previews, media-key dispatch to an actual active Android MediaSession with an audio track, media-volume adjustment/cancellation, service survival after the Activity stops, saved-connection restoration intent, narrow-scope migration/explicit expansion, both themes, CAD geometry/colour, navigation touch targets, the three launch stages, Skip, renderer shutdown and return-from-background behaviour.

The launch capture test controls the Compose clock to inspect actual GPU frames. Android 10 emulator screenshots show rotation, separated covers and the wordmark. These checks establish rendering and lifecycle behaviour, not the frame rate or GPU performance of the user's physical phone. The release APK was separately signature/alignment checked and installed as an update; device instrumentation used the debug build.

Background/restore checks use an isolated test address, not a physical BLE ring. The restore handler was invoked in tests; no real phone reboot, real-radio reconnection, call/ringer routing or OxygenOS process-management result is claimed. “Sent” reports API dispatch, not a third-party app's acknowledgement. Existing 1.0 installations retain their chosen-app consent; broadening enabled access requires an explicit choice.

## Delivery identities

- Release APK SHA-256: `fda3c99e372468716b801cf4145bda7e5a3eff6ae2adbaf4350ac238bb344716`
- Public certificate SHA-256: `afcf38aa744d5260c0df8b0011b7cb5c77874aa7e4ceb91ea7a45b6da09343d8`
- CAD SHA-256: `d222b03a1c2cef901e62abd39088af748ae2225956d44a61de6b8838275dfc4d`

`outputs/SHA256SUMS.txt` covers the delivered APK and source archive. The source includes the native launch renderer, exact CAD, tests, wrapper, documentation and current screenshots. Private signing keys, workstation settings, SDKs/caches and generated builds are excluded. Website sync copies the signed APK and its hash, plus an actual current dashboard capture.

## Physical-phone checks still required

The OnePlus 13 and physical ring were not connected for these Android checks. Install the update and check launch/Skip, connect SmartRing after disconnecting the laptop, then test music controls in the background and while locked. For taps/swipes, choose All apps in App controls and grant optional Accessibility; use the phone awake/unlocked. Check Bluetooth loss/recovery, intentional Disconnect/Sleep, phone restart after unlock and OxygenOS background restrictions.

Apps must accept the public media/touch inputs. The app does not bypass device authentication, Do Not Disturb, force-stop or OEM background restrictions. No unrestricted control of every app/phone state or measured radio latency is claimed. The fixed 2% prototype indicator is unchanged; there is no battery wiring, charging implementation or firmware change.
