# Touch rejection profile: firmware 2.2.5

This firmware rejects short, unstable or ambiguous digital detections while preserving the ring's gesture actions and button controls. It does not change the TTP223's capacitance threshold or prove physical skin contact. Pins, BLE event tokens, the 80 MHz CPU setting, 0 dBm requested transmit power, five-step volume limit and 15-minute inactivity sleep remain as before.

## Current settings

| Filter | Setting | Effect |
|---|---|---|
| Startup input-ignore period | 2 seconds | Time for the module to settle; not a software calibration of the TTP223 |
| Initial/recovery rearming | 180 ms continuously inactive | No new gesture until the finger has moved away and the output stays LOW |
| Press confirmation | First: 80 ms; following taps: 35 ms continuously active | Faster confirmation is enabled only inside an existing qualified tap sequence |
| Minimum qualified tap | First: 140 ms; following taps: 70 ms uninterrupted HIGH | Slightly shorter taps now qualify; the first touch still has the stricter check |
| Maximum tap duration | 650 ms from first accepted raw rising edge to final raw falling edge | Slow ambiguous contacts are discarded |
| Release confirmation | 60 ms continuously inactive | Allows quicker separate taps while still filtering shorter gaps |
| Hold threshold | 700 ms continuously active | A series of short activations cannot accumulate into a hold |
| Touch multi-tap gap | Under 250 ms from raw release to next raw press | A faster deliberate double/triple sequence |
| Triple-tap decision | 120 ms after the third raw release | Faster response; a fourth tap starting before this decision can still cancel the sequence |
| Recovery after completed gesture | 180 ms inactive after resolution | Suppresses immediate extra detections; does not interrupt taps inside the same sequence |

Touch timing describes the module's digital output, not a measured finger-contact duration. The module has its own detection latency. For a fast triple tap, make the first tap slightly deliberate (about 0.15-0.2 seconds), then two quicker taps (about 0.1 seconds each), lifting clearly between them (around 0.1 seconds). The following taps must each generate at least 70 ms uninterrupted HIGH and at least 60 ms LOW separation. After an action has fired, allow 180 ms clear before starting a separate gesture. On releasing a hold, allow about 240 ms before the next gesture (60 ms release confirmation plus 180 ms rearming).

Version 2.2.3 is a modest software responsiveness increase, not a change in physical sensing distance or touch force. It may accept sustained unintended activations that the previous 180 ms first-touch threshold rejected. The unchanged release/rearm checks still filter brief glitches and suppress immediate repeat triggers; verify the balance on the actual assembled ring.

Single and double taps wait for the 250 ms multi-tap window; a completed triple has a shorter 120 ms decision period. A fourth tap beginning after that decision cannot retroactively cancel an already emitted triple, and is ignored while the release/rearm block is active. The short window is necessary to distinguish the existing gestures: emitting the single-tap action immediately would also fire it at the start of a double/triple tap. These waits exclude the module's own sensing time, BLE transport and the target application's response.

Contacts between 650 ms and the 700 ms hold threshold are intentionally ignored. Release without a confirmed hold will not be reinterpreted as a tap. An invalid qualified contact cancels the unresolved multi-tap sequence, favouring no action over an unintended command. Extremely fast double/triple taps may be missed or merged by release filtering; use the deliberate cadence above.

Button debounce, its 400 ms multi-press gap, two-second sleep hold and deep-sleep wake procedure are unchanged. Touch mode still must be momentary active-HIGH, not toggle/latching.

## Upload and physical check

1. Extract the new firmware ZIP and keep all three sketch files together. Upload SenseRing_Touch.ino with XIAO_ESP32C3 and USB CDC On Boot enabled.
2. Unplug and reconnect USB to restart the touch module as well as the ESP32. Keep fingers well away from the touch face for about 2.5 seconds. Moving only the ESP32 through reset does not necessarily reset a continuously powered TTP223.
3. Open Serial Monitor at 115200 baud. Try brief finger approaches without contact, then deliberate single/double/triple taps and holds. Check the printed EVENT tokens before testing the website's remapping.
4. Enter STATUS with newline. `touch_raw` is the current logical active level from the module; `touch_ready` means firmware is out of its release/rearming block. Ready is an input-state indication, not proof that the next activation is intentional.
5. Check a sustained hover as well as brief approaches. If hover alone produces a steady `touch_raw: true`, a sufficiently long hover can still meet a tap or hold's timing. The ESP32 cannot distinguish it from an identical genuine-contact waveform.

The two-second ignore period and 180 ms clear-input period do not reprogram the TTP223 sensitivity. Do not touch the pad during the module's own startup calibration. Keep power/ground connections solid and keep conductive/metal objects away from the touch face during testing.

## If the sensor still detects a nearby finger

The next issue is the sensor's actual capacitive threshold. The module exposes a digital Q/OUT signal, not a raw capacitance/pressure value, and it has no sensitivity register accessible through this three-wire connection. Reading OUT with analogRead would not recover touch strength from this digital output.

The Tontek TTP223 family documentation describes physical sensitivity adjustments through electrode size, insulating panel thickness and sensitivity capacitance. The exact method and capacitor position depend on the chip/module variant. No hardware change has been made or assumed here. Inspect the actual module's front/back before considering such tuning. A/B mode jumpers should not be treated as a software sensitivity setting: polarity and toggle/momentary selection are different functions.

Until the physical threshold is corrected, software cannot guarantee rejection of a hover that looks electrically identical to a touch. An independent confirmation such as a separate button action would require an explicit change to the interaction design; this revision keeps the existing controls.

## Tuning without changing the circuit

All timing constants are in RingConfig.h. MIN_TOUCH_TAP_MS controls the stricter first tap; MIN_FOLLOWUP_TAP_MS controls taps two and three. Increase the first-tap value modestly if brief false activations remain, then test multi-taps again. Increasing a time requirement changes responsiveness, not sensing distance. Keep both minimum values below MAX_TOUCH_TAP_MS, and keep TOUCH_HOLD_MS above MAX_TOUCH_TAP_MS. The delivered profile is a starting point for real testing, not a measured sensitivity calibration.

Sources:

- Module output modes: https://www.sunrom.com/p/capacitive-touch-module-ttp223
- Tontek TTP223N datasheet, sensitivity adjustment and digital output: https://www.tontek.com.tw/uploads/product/47/TTP223N_V1.0_EN.pdf

The cited family datasheet explains the limitations; it does not identify the exact chip revision on your physical module.
