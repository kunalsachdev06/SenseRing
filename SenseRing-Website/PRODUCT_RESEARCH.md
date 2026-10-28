# SenseRing product direction

Research and design decision record — **27 October 2026**. This document belongs with the project sources; it is not product-interface copy.

## Floating workspace bar

Reviewed the current official [Radix Toolbar](https://www.radix-ui.com/primitives/docs/components/toolbar), [shadcn/ui Navigation Menu](https://ui.shadcn.com/docs/components/base/navigation-menu) and [Motion layout animation](https://motion.dev/docs/react-layout-animations) references. Radix groups related controls and documents roving keyboard focus; shadcn presents a composed navigation structure; Motion describes shared-position indicators and transform-based layout motion. These are design references, not dependencies installed in SenseRing.

The local original SenseRing source also contained a floating sticky bar that shrank after scrolling. Version 3.4.0 adapts that behaviour: a rounded surface contains navigation, the ring connection group and utility actions. It compacts vertically, retaining usable room for all controls. The current CSS sliding indicator is retained. Dashboard/Controls use tab/panel relationships, a single selected tab stop, Left/Right and Home/End navigation. The compact state uses separate enter/exit scroll thresholds to avoid jitter near the boundary. Narrow screens wrap the controls inside the same sticky surface. No extra library, animation loop or Bluetooth traffic is introduced.

## Reference review

The reference sites were used to study visual hierarchy and useful software patterns. Their photography, branding, marketing statistics and product claims are not reused.

| Primary source | Observation | SenseRing decision |
|---|---|---|
| [Oura](https://ouraring.com/) | Warm neutral staging, restrained navigation, a clear benefit and prominent product/lifestyle imagery | Give the product room, simplify the hierarchy and use a warm-white default |
| [Ultrahuman Ring PRO](https://www.ultrahuman.com/us/ring-pro/) | A white product hero, a dominant ring image and a small set of primary actions | Use a focused ring composition with one dashboard action rather than many competing effects |
| [ArcX app](https://arcx.fit/pages/app) | A relevant ring-controller example: custom button mapping and profiles | Prioritize personal control profiles and reliable music/presentation workflows |
| [Seeed XIAO ESP32C3 documentation](https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/) | Official board reference, connector orientation and component appearance | Use the actual controller type and recognizable colours in the website assembly |

Oura and Ultrahuman are health-oriented products. Their sensing and battery claims do not transfer to SenseRing. ArcX is closer to SenseRing's remote-control purpose. The design choice below is our inference from these patterns, not a measured finding that one colour scheme universally performs best.

## Final colour and type direction

| Use | Light appearance | Dark appearance |
|---|---|---|
| Page | Warm white `#f4f2ed` | Graphite `#101217` |
| Surface | Porcelain `#fffefa` | Dark slate `#191c23` |
| Primary text | Ink `#22242c` | Soft white `#eeeee9` |
| Signature action/accent | Indigo `#5b59d1` | Light indigo `#aaa6ff` |
| Supporting text | `#686c76` | `#a0a4ae` |
| Connected state | Muted green `#2c735b` | Mint `#7ac9a7` |

Indigo preserves SenseRing's identity. Neutral surfaces and restrained shadows reduce competition with the ring and the actual controls. Green communicates a real connected state; it is not a decorative claim of live data.

The interface uses the local system sans-serif stack. Headings have open spacing and modest weight, with a smaller type scale in the dashboard. Fonts and rendering libraries do not require an external CDN. Hover, focus and reduced-motion states are included.

## Background direction

A further visual review compared [Nothing's current homepage](https://nothing.tech/) and [teenage engineering's OP-1 field page](https://teenage.engineering/products/op-1). Nothing stages its product and motion against a sparse dot field; teenage engineering combines neutral backgrounds, fine geometric linework and prominent product imagery. These are visual observations, not evidence that a particular pattern universally improves usability.

SenseRing uses an original etched grid, small intersection dots and angular signal paths. A few short light pulses travel along the paths while a soft indigo/green glow shifts slowly behind the product. The pattern fades around the copy and toward the footer. The dashboard uses a quieter static version behind its opaque cards. The existing warm-white/graphite palette and indigo identity are retained.

The backgrounds use CSS and inline SVG, with no additional rendering library, images, external requests or JavaScript animation loop. They cannot receive pointer input or keyboard focus. Decorative paths do not represent physical wiring, connection state or sensor readings. Landing animation pauses when its section or browser tab is hidden; reduced-motion preference disables the pulses and drift. The removed oval, standalone model label and Session UI remain absent.

## Interface motion review

The effects below were compared using their official documentation. The implementation adapts these patterns to SenseRing's existing HTML/CSS/JavaScript; it does not install the providers' React or Sass components.

| Reference | Pattern reviewed | SenseRing implementation |
|---|---|---|
| [Magic UI Theme Toggler](https://magicui.design/docs/components/animated-theme-toggler) | Button-origin theme reveals using View Transitions | 620 ms circular colour reveal from the selected theme button, with a sun/moon icon |
| [Aceternity Card Spotlight](https://ui.aceternity.com/components/card-spotlight) | A pointer-positioned radial highlight | Soft spotlight on the two landing experience cards, with a small hover lift |
| [Motion animate](https://motion.dev/docs/animate) | Easing, transforms and responsive interaction feedback | Sliding navigation pill and short press/release feedback |
| [Motion UI](https://get.foundation/sites/docs/motion-ui.html) | Fade/slide transitions and sequenced entrances | Brief staggered panel entries, dropdown/dialog entrances and toast feedback |
| [MDN View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using) | Native transition lifecycle and clip-path customization | Feature detection, cancellation, temporary-state cleanup and a colour-fade fallback |

The choice is a design judgement for this interface. Large card rotations, continuous border effects and extra text animations were left out to keep the existing content readable. The site remains free of third-party runtime dependencies. Native reveals respect reduced motion, do not reconnect Bluetooth, and do not reset profiles or application state. A rejected snapshot still applies the requested appearance. Automated tests cover fast requests, missing browser APIs, storage failure and motion-preference changes.

## Ring visualization

The perceived weight is reduced through composition and rendering: a wider camera frame, smoother normals across curved surfaces, neutral lighting and smaller dashboard staging. The landing model makes a slow full rotation; the dashboard retains its restrained movement. Rotation pauses while dragging, freezes offscreen or in a hidden page, and respects reduced-motion preference. The oval outline and standalone label below the landing ring have been removed. The CAD proportions are preserved; the model is not flattened to imitate a different physical product.

**Ring** shows the assembled enclosure. **Inside** separates the two covers and makes the base translucent while the installed parts retain their assigned positions. The component asset follows the existing v4 CAD datums:

- Controller: black PCB, gold pads, silver shield and socket; no external antenna model.
- Touch: user-confirmed red TTP223 module, approximately 15 × 11 mm, on the right.
- Battery: silver 160 mAh pouch with yellow insulation, on the left; electrically disconnected.
- Tactile switch: the existing 6 × 6 × 2.5 mm envelope at the upper-left shoulder.

The asset contains 150 geometric parts batched into 26 rendering groups. Fine PCB printing and passive layout are illustrative. The model does not establish exact physical assembly, wiring or manufactured fit. The original printable enclosure assets remain separate and unchanged.

## Software delivered in this refresh

| Feature | User benefit | Hardware effect |
|---|---|---|
| Saved profiles | Keep different mappings for different routines | None; applied by the website |
| Profile import/export | Transfer or back up supported mappings | None |
| Validated local storage | Reject unsupported actions and recover from corrupt saved data | None |
| Pause controls | Suspend new output and cancel pending requests where possible | None |
| Light/dark appearance | Choose a comfortable interface | None |
| Assembled/inside model | Inspect the ring and installed component layout | Visualization only |

Profiles remain local to the browser. No account, cloud telemetry or third-party analytics is introduced. Existing ring-mode authority, grouped presentation inputs, serialized Bluetooth operations, companion request authentication and command expiry remain part of the control path.

The product interface avoids firmware names, wiring notes, development diagnostics and long technical guidance. The requested connected-state battery placeholder displays **2%** with a red low-battery line. Its accessible description identifies it as a fixed preview value. It does not read actual battery level. Engineering information remains in the source documentation.

## Useful next software steps

These are proposals, **not features claimed as implemented**.

1. **A native Android companion.** Highest priority for phone-wide music/presentation integration. It requires platform-specific Bluetooth, background execution and control permissions; a browser dashboard alone cannot provide the complete cross-app experience.
2. **A packaged Windows installer.** Bundle an appropriate runtime and the existing companion so users do not separately install Node.js. Preserve the one-click launch and optional sign-in behaviour.
3. **App-specific shortcut profiles.** Extend the local companion with explicit, allowlisted shortcuts for selected applications. Keep clear foreground-app behaviour and avoid arbitrary shell commands.
4. **Optional profile synchronization.** Add only if moving between devices becomes important. This requires a backend, an account/privacy design and opt-in synchronization; the current release is local.
5. **A firmware-update workflow.** Possible as a separate software/firmware project using the current board, after update transport, flash layout, recovery and interruption handling are designed and tested. No updater is included here.

Battery percentage cannot be made real without measurement support. Health metrics, touch pressure, haptics and wear detection cannot be added as honest software features when the current hardware does not supply them.
