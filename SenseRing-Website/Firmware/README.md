# SenseRing touch firmware 2.2.5

Complete board-side firmware for the current USB-powered XIAO ESP32-C3 ring with a TTP223 touch module and one tactile button. Source is in `SenseRing_Touch/`. The folder contains the main Arduino sketch and two required headers; keep all three files together.

Version 2.2.5 samples chip temperature once at startup and then every ten minutes (600,000 ms), replacing the ten-second period in 2.2.4. The interval runs from the preceding sample attempt. It retains the background-work cleanup: per-action Serial logs are off by default, status formatting uses a fixed buffer, and cached BLE status refreshes every two seconds or after a mode/connection change. Input processing and ready BLE notifications run before diagnostics. Gesture recognition uses integer counters and timestamp comparisons; profiles, remapping and operating-system commands remain in the client/companion.

The 2.2.3 touch profile is retained: first taps need 140 ms, follow-up taps 70 ms, press confirmation is 80/35 ms and release filtering is 60 ms. The 250 ms single/double decision, 120 ms triple settling, 700 ms hold and 180 ms rearming are unchanged. Lower-power CPU/BLE settings, the five-command volume cap, pins and the 15-minute inactivity timeout are also unchanged. Read **TOUCH_FILTERING.md** for digital-sensor limitations and **RISK_REDUCTION.md** for power measures. There is no automatic skin-temperature cutoff.

Read **PIN_CONNECTIONS.md** before wiring. No additional electronic parts or external firmware libraries are required beyond the ESP32 Arduino board package. This version contains no battery voltage/charging implementation or fabricated battery percentage.

## Upload in Arduino IDE

1. Install or select **esp32 by Espressif Systems** in Boards Manager. The final build was checked with the installed **3.3.12** package (and previously 3.3.11); see `VALIDATION.md` for actual results.
2. Open `SenseRing_Touch/SenseRing_Touch.ino`. Keep `RingConfig.h` and `RingLogic.h` in that same sketch folder.
3. Select **XIAO_ESP32C3** and its serial port. Enable **USB CDC On Boot**. Default 4 MB partition settings are sufficient if the build size reported in validation fits them.
4. Connect using a USB data cable and upload. No board will be flashed automatically by this package.
5. Open Serial Monitor at **115200 baud**, with newline enabled. Keep your fingers clear during the two-second startup input-ignore period and subsequent 180 ms clear-input rearming period. The TTP223 performs its own hardware calibration.
6. Look for `[READY]` and `[BLE] Advertising as SmartRing`. On the existing website, connect to **SmartRing** using its current Bluetooth flow.

If the ring is asleep, hold the tactile button about 2-3 seconds and release it. Deep sleep can make the USB port disappear. If upload recovery is needed, use the board's own BOOT/reset procedure documented by Seeed; this is separate from the external tactile button.

## Gestures

| Input | Media mode | Presentation mode |
|---|---|---|
| Touch once | Play/pause (`PLAY_PAUSE`) | Next slide (`SLIDE_NEXT`) |
| Touch twice | Next track (`NEXT`) | Previous slide (`SLIDE_PREV`) |
| Touch three times | Previous track (`PREV`) | Select (`SELECT`) |
| Hold touch for at least 0.7 seconds | Volume up, repeats | Next slide, repeats |
| Tap once, then touch and hold | Volume down, repeats | Previous slide, repeats |
| Tactile button twice | Switch to presentation | Switch to media |
| Tactile button hold for 2 seconds, then release | Sleep | Sleep |
| No input or actual mode change for 15 minutes | Sleep | Sleep |

For a triple tap, make the first touch slightly deliberate (about 0.15-0.2 seconds), followed by two quicker touches (about 0.1 seconds each), with clear lifts around 0.1 seconds between them. Firmware requires 140 ms HIGH for the first tap, 70 ms HIGH for following taps, and 60 ms LOW separation. Release-to-next-press gaps must remain below 250 ms. Tap-and-hold means: one qualified tap, release, then begin holding within that window. Single/double taps wait for the 250 ms window; triple taps have a shorter 120 ms decision period after the third release. There is a 180 ms recovery pause after a resolved gesture. Four taps inside an unresolved sequence are discarded; a fourth beginning after the triple decision is ignored during rearming. A single/triple tactile-button press has no action. The tactile button's multi-press gap remains 400 ms. See TOUCH_FILTERING.md for sensor-output timing versus physical touch timing.

Volume repeat interval is 220 ms, with a maximum of five volume steps per uninterrupted hold; release and hold again for additional steps. This is a command count, not a volume-percentage or hearing-safety limit. Slide repeat interval is 850 ms. A touch held continuously for 10 seconds is treated as stuck and stops issuing actions until released. These conservative timings are editable in `RingConfig.h`; actual gesture performance must be checked on the assembled module.

## Power behaviour

USB plug-in, reset or a fresh power-up starts the ring awake. After deliberate sleep, a GPIO press initially wakes the processor; firmware requires the button to stay pressed for two seconds after startup, then be released, before enabling BLE. A short accidental press returns it to sleep. This can feel like a 2-3 second hold depending on startup time.

Sleep is ESP32 deep sleep, not an electrical power disconnect. The touch module and board power circuitry still receive USB power. BLE disconnects during sleep; the website/app must reconnect after waking. The current mode survives deep sleep in RTC memory, but defaults to media after full power loss. The current website adopts the ring's mode on connection rather than overwriting it with its preview selection.

The website does not receive a dedicated sleep notification: it observes the BLE disconnection. The current client reads status on connection and when confirming a mode change; the live gesture path uses notifications without recurring diagnostic reads. No battery capacity, charging status or runtime is measured.

## Bluetooth compatibility and client work

Device name, service UUID and original event/write characteristic are preserved from upstream commit `cffa2ab72e7c150a6b1adc7844dfe3e0ae3c9afd`. Thus the current website can discover the ring and receive its existing command vocabulary. See **BLE_PROTOCOL.md** for the exact contract and existing client limitations.

The matching website 3.5.2 and Android 1.3.0 implement touch-specific mappings and adopt the ring's confirmed mode on connection. Windows next/previous slide actions use Page Down/Page Up, and SELECT uses Enter. Android defaults to up/down presentation swipes, with horizontal and other target-app styles selectable in Settings.

The ring emits BLE events; the Windows companion or Android foreground service handles operating-system actions. Read BLE_PROTOCOL.md for the complete interface. A browser cannot start the Windows helper by itself; the companion launchers or optional sign-in shortcut handle startup.

## Compile and host tests

The actual board build was checked with Arduino-ESP32 3.3.12. After configuring that board package in Arduino IDE, the optional CLI build is:

```text
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32C3:CDCOnBoot=default --warnings all SenseRing_Touch
```

To run the pure C++ controller tests without hardware, use an installed C++11 compiler from this folder:

```text
g++ -std=c++11 -Wall -Wextra -pedantic tests/ring_logic_test.cpp -o tests/ring_logic_test
```

Run `tests/ring_logic_test` on Linux/macOS or `tests\ring_logic_test.exe` on Windows. These tests use simulated digital waveforms and send no OS keys. The diagnostics sketches are wiring checks only; they replace the final sketch and do not advertise the normal ring service. Re-upload SenseRing_Touch after using them.

To create a source ZIP and SHA-256 manifest, run `python package_firmware.py`. This helper is self-contained and needs no reference checkout. Application source licensing is described in RIGHTS_AND_NOTICES.md.

## Diagnostics

Per-action Serial logging is disabled in normal use so USB backpressure cannot delay a gesture callback. For wiring tests, set `SERIAL_EVENT_LOGS = true` in `RingConfig.h` and rebuild; this restores `[EVENT] TOKEN` output even without a BLE client. Turn it off again for normal operation. Explicit Serial commands and boot/connection messages remain available.

Serial Monitor commands (newline terminated):

- `STATUS`: firmware version, mode, power state, idle time, raw touch/rearming status, stuck-touch flag, approximate chip temperature, CPU frequency and BLE power-setting readbacks.
- `MODE_DEFAULT` / `MODE_PRESENTATION`: set mode.
- `MODE_TOGGLE`: change mode.
- `GET_MODE`: notify a connected BLE client of the mode.
- `SLEEP`: sleep after the button is released.
- `HELP`: command list.

If there are no touch events, check VCC/GND/OUT labels, momentary mode and the output level when touched. If your module is active-LOW, either set it active-HIGH or change `TOUCH_ACTIVE_HIGH` to `false` and recompile. The physical pad order is not assumed. If the button has no effect, test the selected contact pair for switched continuity. If the chip never boots normally, recheck that you used D1/GPIO3 and D2/GPIO4, rather than the old firmware's GPIO2 button wiring.

All firmware constants and pins are in `RingConfig.h`. Host tests in `tests/ring_logic_test.cpp` cover the same controller used by the Arduino sketch. Build validation does not establish actual wiring, RF, wake timing or end-to-end OS action performance.
