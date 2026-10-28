# SenseRing Android 1.3 design and compatibility research

Reviewed 27 October 2026. Official developer/publisher pages and screenshots were used as references; their graphics and branding are not bundled in SenseRing.

## Product UI references

| App category | Primary reference | What informed this revision |
|---|---|---|
| Headphones | [Nothing X, official publisher listing](https://play.google.com/store/apps/details?id=com.nothing.smartcenter) | Mostly neutral surfaces, direct device controls and restrained accent use |
| Headphones | [Sony Sound Connect, official publisher listing](https://play.google.com/store/apps/details?id=com.sony.songpal.mdr) | Device image as the focus; clear control groups rather than decorative backgrounds |
| Smartwatch | [Galaxy Wearable](https://play.google.com/store/apps/details?id=com.samsung.android.app.watchmanager), [Samsung's current app guide](https://www.samsung.com/ca/support/mobile-devices/learn-more-about-galaxy-wearable-app/) | Product-first layout, compact entry points and settings that match device capabilities |
| Smart ring | [Oura, official publisher listing](https://play.google.com/store/apps/details?id=com.ouraring.oura), [Oura's three-tab design](https://ouraring.com/blog/new-oura-app-experience/) | Clear hierarchy and a small number of top-level destinations |

The chosen palette is our design inference from these references and the user's request to remove lavender. It is not a claim that any vendor uses these exact colours.

## Visual contract

| Role | Dark | Light |
|---|---|---|
| Page | Charcoal `#171715` | Warm ivory `#F4F2EC` |
| Panels | `#242420` | `#FFFEFA` |
| Main text | `#F2F0E9` | `#24241F` |
| Secondary text | `#B6B4AA` | `#706E64` |
| Accent | Warm copper `#E3A076` | Burnt orange `#A84D2B` |

All currently used Material containers, dialogs and selected-chip colours use the same neutral palette. There is no purple aurora. Panels use a faint glass sheen with thin borders. The bottom navigation is a 252 × 58 dp capsule: three accessible tabs, with a label shown for the selected tab. Each tab keeps a 48 dp minimum touch height. The page reserves space above the capsule so content remains reachable.

The accurate 26-part coloured CAD model remains native Kotlin. Cached geometry is rendered off the interface thread only when its view changes. A depth buffer preserves solid enclosure walls. This release adds no browser engine or constantly running animation.

## Cross-app and phone-state behaviour

- [AudioManager](https://developer.android.com/reference/android/media/AudioManager) provides standard media-key delivery and explicit media/call/ringer stream adjustment. These are requests to Android's active media/audio route; third-party apps and output devices can reject unsupported requests.
- [AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService) supports the optional tap/swipe route. All apps is available while the phone is awake and unlocked; the selected-app alternative remains. Screen content retrieval stays disabled. Existing installations keep their old scope until the user expands it.
- [Connected-device foreground services](https://developer.android.com/develop/background-work/services/fgs/service-types#connected-device) and [companion-device presence](https://developer.android.com/develop/connectivity/bluetooth/ble/background) support the ongoing ring connection. The service starts with the required Bluetooth access and a connection notification.
- [Foreground service start exemptions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) include appropriate restart/update events and companion-device cases. The connected-device service restores only a saved connection left enabled; intentional Disconnect/Sleep remains respected.
- [Android 17 background audio rules](https://developer.android.com/about/versions/17/changes/bg-audio) remain relevant to the OnePlus test. This APK targets API 36, starts an ordinary connected-device foreground service and requires physical Android 17 validation.
- [Android's stopped-state rules](https://developer.android.com/about/versions/15/behavior-changes-all#stopped-state) require user interaction before an explicitly force-stopped app resumes. The app does not try to defeat that state, device authentication, Do Not Disturb or target-app restrictions.

“All apps and phone states” cannot mean unrestricted execution or guaranteed support for every app-specific function. This implementation broadens the input target and recovery paths within Android's public APIs. Locked/off-screen media, awake/unlocked touch, saved-connection recovery, permission loss, Bluetooth loss and intentional disconnection have separate handling.

The firmware protocol, hardware, website-compatible profile JSON and battery prototype remain unchanged. No new ring-side calculations are introduced.

## Launch sequence and website handoff

The opening sequence reuses the exact local CAD asset, with a full rotation, separated covers, visible coloured electronics and the SenseRing wordmark. [Compose animation guidance](https://developer.android.com/develop/ui/compose/animation/quick-guide) informs the short opacity/transform reveal. The native GPU surface exists only during launch and the dashboard contains no model. Skip and disabled-animation handling keep the app usable without watching the sequence.

Website 3.5.1 places the WebGL revolve/open sequence only in its landing hero; the Android download section contains a centred phone preview and direct signed download. [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API), page visibility and reduced motion keep offscreen work stopped.

## Presentation direction in 1.3

The presentation gesture style now offers vertical and horizontal swipes. Vertical is first and the default: Next moves the touch point from 80% to 20% of screen height; Previous moves from 20% to 80%. The same native Android gesture dispatcher, 170 ms duration, scope checks and awake/unlocked policy apply. Explicit Scroll up/down actions retain their previous direction, and Select remains a central tap.

The previous horizontal default migrates once to vertical. Later horizontal choices persist; saved edge-tap and arrow styles are retained. Action IDs, firmware tokens, profile JSON and required permissions do not change. Action labels say Next/Previous so they remain accurate for either axis. Accessibility approval remains a user-controlled Android requirement.
