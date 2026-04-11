# Gesture Ring — Touchless Control (BLE + Media Bridge)

> A production-grade HCI demo that connects to a BLE smart ring, maps gestures per mode, and controls both UI feedback and system media keys via a local bridge.

![Project Type](https://img.shields.io/badge/Type-HCI%20Project-blue)
![Status](https://img.shields.io/badge/Status-Complete-success)
![Tech](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Three.js-orange)

---

## Overview

Gesture Ring is a touchless interaction system for controlling media and presentations using a BLE smart ring. It focuses on:
- Real-time gesture feedback with confidence display
- Remappable gesture-to-action mapping for each mode
- Live BLE integration (SmartRing device)
- OS-level media control through a local Node bridge

This repo contains a complete UI, 3D ring visualization, BLE event pipeline, and a local media bridge for system playback controls.

---

## Quick Start

### 1) Run the UI (Live Server)
Web Bluetooth requires HTTPS or a local dev server.

```
1. Open the HCI folder in VS Code
2. Right-click index.html
3. Open with Live Server
```

### 2) Start the Local Media Bridge
The bridge is required for system-level play/pause, next, volume, and scroll keys.

```
node local-media-bridge.js
```

By default, it listens on http://localhost:3199/command.

### 3) Connect the Ring
1. Open the web app
2. Click Connect Ring
3. Select SmartRing in the device picker
4. Status changes to Connected

---

## Features

### Landing Page
- Particle background
- 3D ring hero animation (Three.js)
- Smooth intro motion and CTA

### Live View
- Real-time 3D ring feedback
- Gesture confidence visualization
- Response card showing action and mode
- Feedback timeline (last 10 events)
- Connection status + connect button
- Ring tester (manual triggers for all ring inputs)
- Live mapping badges for active mode

### Gesture Mapping View
- Two mode editors (Media + Presentation)
- Dropdown remapping per input
- Reset to defaults
- Visual reference cards for rotate/tap inputs

### Context Modes View
- Media Mode and Presentation Mode
- Inline mapping overview per mode
- Mode toggles sync with BLE

---

## Ring Inputs (Mapped)

| Input | Motion | Default Actions | Visual Feedback |
|------|--------|------------------|-----------------|
| Rotate CW | Clockwise turn | Volume Up / Slide Next | Ring tilts right |
| Rotate CCW | Counter-clockwise | Volume Down / Slide Prev | Ring tilts left |
| Single Tap | Single press | Play/Pause / Select | Ring pulses and jumps |
| Double Tap | Two taps | Next Track / Next | Ring swipes right |
| Triple Tap | Three taps | Previous Track / Previous | Ring swipes left |
| Long Press | Hold | Switch Mode | Ring spins |

---

## Context Behavior

### Media Mode
```
Rotate CW    → Volume Up
Rotate CCW   → Volume Down
Single Tap   → Play/Pause
Double Tap   → Next Track
Triple Tap   → Previous Track
Long Press   → Switch to Presentation
```

### Presentation Mode
```
Rotate CW    → Scroll Up (Next)
Rotate CCW   → Scroll Down (Prev)
Single Tap   → Select
Double Tap   → Next (mapped)
Triple Tap   → Previous (mapped)
Long Press   → Switch to Media
```

---

## BLE Pipeline (How It Works)

1. **BLE Notification** from ring
2. `onBLEData()` decodes command token
3. Token resolves to **gesture input key** (ex: rotate-cw)
4. Input key maps to **current action** via gesture map
5. Action drives:
   - UI feedback (response card, timeline)
   - 3D animation (ring motion)
   - System command via local bridge (if mapped)

The mapping is fully editable in the Mapping view and updates instantly.

---

## Local Media Bridge

The bridge listens locally and sends OS media/scroll keys.

Supported commands:
- Media: PLAY_PAUSE, NEXT, PREV, VOL_UP, VOL_DOWN
- Presentation: SCROLL_UP, SCROLL_DOWN

You can override the port:
```
set BRIDGE_PORT=3200
node local-media-bridge.js
```

---

## Project Structure

```
HCI/
├── index.html                 # Main UI
├── gesture-ring-style.css     # Styles
├── gesture-ring-script.js     # Main logic (BLE + UI + mapping)
├── local-media-bridge.js      # Local OS media bridge
├── README.md
├── GESTURE-RING-README.md
├── QUICK-START.md
├── PROJECT-SUMMARY.md
├── FILES-OVERVIEW.txt
└── INDEX.md
```

---

## Troubleshooting

### BLE not connecting
- Use Live Server (not file://)
- Use Edge or Chrome
- Make sure ring advertises SmartRing

### No system media control
- Ensure local-media-bridge.js is running
- Confirm the bridge endpoint is reachable

### Bridge port in use
```
set BRIDGE_PORT=3200
node local-media-bridge.js
```

### No 3D ring
- Check network access to Three.js CDN

---

## Demo Flow (5 minutes)

1. Landing page — show 3D hero
2. Enter Live — show ring feedback + response card
3. Trigger Ring Tester buttons
4. Mapping view — change a dropdown and retest
5. Context modes — switch Media/Presentation

---

## Quick Facts

- Inputs: 6 (Rotate CW/CCW, Tap 1/2/3, Long Press)
- Modes: 2 (Media, Presentation)
- Views: 4 (Landing + Live + Mapping + Contexts)
- Stack: HTML, CSS, JS, Three.js

---

## Credits

Built for HCI evaluation and live hardware demonstration.
