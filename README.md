<div align="center">

# SenseRing

**Touchless control for your device — powered by a wearable ring.**

Rotate your finger to adjust volume. Tap to play or pause. Switch slides without touching your keyboard. SenseRing turns natural hand movements into real system controls, wirelessly.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-sense--ring.vercel.app-6366f1?style=for-the-badge)](https://sense-ring.vercel.app)
![Platform](https://img.shields.io/badge/Platform-Windows-0078d7?style=for-the-badge)
![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge-4285F4?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-Required-339933?style=for-the-badge)

</div>

---

## What is SenseRing?

SenseRing is a wearable smart ring that connects to your computer over Bluetooth. Once connected, it lets you control media playback and presentations using physical gestures — rotating the ring, tapping a button on it, or holding it down.

The web app gives you a live view of what the ring is doing, lets you remap every gesture to any action you want, and switches between two control modes depending on what you're doing.

No drivers. No installs beyond a small background script. Works with Spotify, YouTube, VLC, PowerPoint, Google Slides, and anything else that responds to keyboard media keys.

---

## Before You Start

You'll need:

- **Google Chrome or Microsoft Edge** — other browsers don't support Bluetooth connections from web pages
- **Node.js** installed on your computer — [download here](https://nodejs.org) if you don't have it
- **The SenseRing hardware** — the physical ring device
- **The project files** cloned or downloaded from this repo

To check if Node.js is installed, open a terminal and type `node -v`. If you see a version number, you're good.

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

## Getting Started

### Step 1 — Start the media bridge

The media bridge is a small background script that translates ring commands into real keyboard actions on your computer (volume, play/pause, scroll, etc.). It needs to be running whenever you use the ring.

Open a terminal in the project folder and run:

```bash
node local-media-bridge.js
```

You should see:

```
Local media bridge running at http://localhost:3199
```

Leave this terminal open. You can minimise it.

> **Port already in use?** Run it on a different port:
> ```bash
> set BRIDGE_PORT=3200 && node local-media-bridge.js
> ```

### Step 2 — Open the web app

Open `index.html` using a local development server — **not** by double-clicking the file directly. Bluetooth requires a proper local server to work.

The easiest way is the **Live Server** extension in VS Code:

1. Open the project folder in VS Code
2. Right-click `index.html` in the file explorer
3. Select **Open with Live Server**

Your browser will open the SenseRing app automatically.

> **No VS Code?** Any local server works — Python's `python -m http.server 5500`, or any other you prefer.

### Step 3 — Connect the ring

1. Make sure the ring is powered on
2. Click **Connect Ring** in the web app
3. A Bluetooth device picker appears — select **SmartRing**
4. The status indicator changes to **Connected ✅**

The ring is now live. Any gesture you make will appear on screen immediately.

---

## Using the Ring

The ring has one button and a rotary dial built into the band. There are six inputs in total:

| What you do | How to do it |
|---|---|
| **Rotate clockwise** | Turn the ring forward on your finger |
| **Rotate counter-clockwise** | Turn the ring backward |
| **Single tap** | Press the button once |
| **Double tap** | Press twice quickly (within ~350ms) |
| **Triple tap** | Press three times quickly |
| **Long press** | Hold the button for about a second |

---

## Two Modes

SenseRing has two modes. You switch between them by **long pressing** the ring button, or by clicking the mode toggle in the web app.

### Media Mode

Use this when listening to music, watching videos, or anything audio/video related.

| Gesture | Action |
|---|---|
| Rotate clockwise | Volume up |
| Rotate counter-clockwise | Volume down |
| Single tap | Play / Pause |
| Double tap | Next track |
| Triple tap | Previous track |
| Long press | Switch to Presentation mode |

### Presentation Mode

Use this when presenting slides or scrolling through documents.

| Gesture | Action |
|---|---|
| Rotate clockwise | Scroll up / Next |
| Rotate counter-clockwise | Scroll down / Previous |
| Single tap | Select / Confirm |
| Double tap | Next |
| Triple tap | Previous |
| Long press | Switch to Media mode |

---

## The Web App

The web app has three main sections, reachable from the navigation bar at the top.

### Live

This is the main dashboard. It shows:

- A 3D ring that animates with every gesture you make
- The current gesture detected and a confidence indicator
- A response card showing what action just fired and in which mode
- A timeline of the last ten gestures
- The active gesture mapping for your current mode
- A **Ring Tester** — six buttons that fire each ring input manually, so you can test everything without physically using the ring

The mode toggle (Media / Presentation) sits at the top of the mapping panel. Switching it here instantly updates the ring too.

### Gesture Mapping

This is where you customise what each gesture does.

Both modes have their own mapping table. Each row shows a gesture on the left and a dropdown on the right. Change the dropdown to reassign that gesture to a different action — the change takes effect immediately, no save button needed.

You can also hit **Reset to defaults** to go back to the original mappings.

### Context Modes

An overview of both modes — what each gesture does in each context, and a description of when each mode is designed to be used. Clicking a mode here also switches the ring to that mode.

---

## Troubleshooting

**The Connect Ring button does nothing or shows an error**
- Make sure you're using Chrome or Edge — Firefox and Safari don't support Web Bluetooth
- Make sure the page is served from a local server, not opened directly as a file (`file://` won't work)
- Make sure the ring is powered on and nearby

**Connected but gestures don't control anything on my computer**
- Check that `node local-media-bridge.js` is still running in your terminal
- If you changed the port, make sure the app is set to use the same one

**The 3D ring doesn't appear**
- Check your internet connection — the 3D animation loads a small rendering library from a CDN

**Volume/media controls work but scroll doesn't**
- Make sure you're in Presentation mode, not Media mode
- The scroll key only fires for rotation gestures in Presentation mode

**Gestures are too sensitive / fire too easily**
- Small accidental movements can trigger rotation. Try making more deliberate, slower turns. The rotation requires about a quarter-turn to fire one command.

---

## Files in this Repo

```
SenseRing/
├── index.html               Main web app
├── gesture-ring-style.css   Styling
├── gesture-ring-script.js   App logic — BLE, gesture mapping, UI
├── local-media-bridge.js    Background script for OS media/scroll keys
├── SmartRing_Firmware.ino   Firmware source (for the ring hardware)
└── README.md                This file
```

---

## Requirements Summary

| Requirement | Details |
|---|---|
| Browser | Chrome or Edge (latest) |
| OS | Windows (for media bridge) |
| Node.js | Any recent version |
| Connection | Bluetooth LE |
| Internet | Only needed for the 3D ring animation |

---

<div align="center">

Made with care for a smooth, touchless experience.

</div>
