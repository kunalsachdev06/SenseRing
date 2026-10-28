# Firmware 2.2.5 verification

27 October 2026 temperature sampling interval update:

- `TEMPERATURE_SAMPLE_MS` is now `10UL * 60UL * 1000UL` (600,000 ms). A startup sample remains; subsequent attempts are scheduled from the preceding attempt using the existing unsigned elapsed-time comparison. Status reads reuse the cached result.
- Gesture logic, qualification thresholds, two-second status refresh, notification priority and power settings are unchanged from 2.2.4.
- Incremental XIAO ESP32-C3 build succeeded with Arduino-ESP32 3.3.12 and warnings enabled; no warnings emitted. Program storage: **629,515 / 1,310,720 bytes**. Static/global RAM: **18,548 / 327,680 bytes**.
- Uploaded on COM5 to the same ESP32-C3; esptool verified written data. Live Serial STATUS confirmed `2.2.5-touch`, awake, `touch_ready: true` and a valid startup temperature reading (`temp_ok: true`). A complete ten-minute physical sampling cycle was not observed; the configured interval and scheduling code were checked directly.
- The prior source package is preserved as `SenseRing-Touch-Firmware-2.2.4-backup.zip`. Current source mirrors and downloadable archives are synchronized.

## Earlier 2.2.4 build record

27 October 2026 on-board workload audit and cleanup:

- The touch/button controller uses fixed-size state, unsigned timestamp differences, integer counters and comparisons. There is no angle calculation, sensor fusion, floating-point gesture recognition, profile processing or operating-system action execution in the gesture path. Existing input/command budgets and the 5 ms scheduler yield are retained.
- Per-gesture Serial logging is disabled by default (`SERIAL_EVENT_LOGS = false`). The installed Arduino-ESP32 3.3.12 HWCDC implementation permits USB TX writes to wait on a full buffer; removing these writes from ordinary event callbacks avoids that dependency. This was identified by source inspection, not a reproduced physical USB stall. Explicit serial diagnostics and optional wiring-test logs remain.
- Routine BLE status refresh changed from 250 to 2,000 ms, and temperature sampling from 1,000 to 10,000 ms. Status formatting uses a fixed buffer instead of a returned heap-allocated String. Ordinary gesture notification is attempted before background status/temperature/Serial work. Actual mode and connection changes refresh cached status ahead of their notification so readback remains consistent.
- All **68 host gesture/power scenarios passed**, including the unchanged tap/hold boundaries and 200 deterministic noise sequences. `RingLogic.h` and all gesture qualification constants are unchanged from 2.2.3.
- Final XIAO ESP32-C3 build succeeded with Arduino-ESP32 3.3.12 and warnings enabled; no warnings emitted. Program storage: **629,505 / 1,310,720 bytes**. Static/global RAM: **18,548 / 327,680 bytes**. The fixed status buffer accounts for the small RAM increase; these sizes do not measure runtime CPU load.
- Uploaded on COM5 to ESP32-C3 MAC `80:f1:b2:60:5f:b0`; esptool verified written hashes. Live Serial STATUS confirmed `2.2.4-touch`, media mode, awake, `touch_ready: true`, 80 MHz and 0 dBm configuration readbacks. The USB port disappeared on the first upload attempt; the successful attempt followed the user's cable reconnection.
- The preceding source package is retained as `SenseRing-Touch-Firmware-2.2.3-backup.zip`. Current sources are mirrored into the website package. No operating-system keys or physical touch gestures were exercised by the upload/status checks. End-to-end latency remains for user retesting; this audit does not quantify a measured speedup on the assembled ring.

## Earlier 2.2.3 build record

27 October 2026 touch-acceptance adjustment:

- First-tap minimum: 180 → 140 ms. Follow-up minimum: 80 → 70 ms. Press confirmation: 100/40 → 80/35 ms. Release filtering stays at 60 ms; decision, hold, rearm, button and power settings are unchanged.
- **68 host scenarios passed**, including new 140 ms first-tap and 70 ms follow-up acceptance cases, 139/69 ms rejection boundaries, and 200 deterministic noise sequences whose individual HIGH pulses stay below the new first-tap threshold.
- Compiled for the XIAO ESP32-C3 using Arduino-ESP32 3.3.12 with warnings enabled; no warnings emitted. Flash/RAM usage remains 629,741 / 1,310,720 and 18,196 / 327,680 bytes.
- Uploaded on COM5 with written hashes verified. Live boot and STATUS reported `2.2.3-touch`, awake power and ready touch input. These checks do not measure finger-contact force or physical detection distance; actual comfort/mistouch balance needs the user's retest.
- The 2.2.2 source package is retained in `SenseRing-Touch-Firmware-2.2.2-backup.zip`.

## Earlier 2.2.2 build record

27 October 2026 latency update:

- Rebuilt successfully for `esp32:esp32:XIAO_ESP32C3:CDCOnBoot=default` with Arduino-ESP32 3.3.12 and warnings enabled. No warnings were emitted. Storage/RAM remain 629,741 / 1,310,720 and 18,196 / 327,680 bytes.
- **64 host scenarios passed**, including the existing 200 deterministic digital-noise sequences. New explicit boundary checks verify single/double resolution 250 ms after the final raw release, triple resolution at 120 ms and first hold at 700 ms. Tests also retain the unchanged 180/80 ms tap and 60 ms release requirements, mode/power behaviour and five-step volume cap.
- Uploaded to the identified ESP32-C3 on COM5. Esptool verified written hashes and reset the board. Subsequent Serial output reported `2.2.2-touch`, `power: awake`, `touch_ready: true`, 80 MHz CPU and 0 dBm power-setting readbacks. This verifies the uploaded version and reported settings; it is not an RF exposure or temperature-safety measurement.
- End-to-end physical touch-to-player latency still requires the user's live retest. The logic checks measure simulated digital input; they exclude the TTP223's own response, Bluetooth scheduling and the target app.

## Earlier 2.2.1 build record

Target build: `esp32:esp32:XIAO_ESP32C3:CDCOnBoot=default`.

- Arduino CLI 1.5.1; final rebuild with Espressif Arduino-ESP32 **3.3.12**, installed locally. Version 2.2.1 is verified with 3.3.12; earlier firmware revisions also compiled with 3.3.11.
- Final firmware compiled and linked successfully with warnings enabled; no warnings in the final build output.
- Program storage with 3.3.12: **629,741 / 1,310,720 bytes (48%)**.
- Static/global RAM: **18,196 / 327,680 bytes (5%)**. This does not include all runtime BLE/task heap use.
- Same `RingLogic.h` used by the sketch compiled as a host C++11 test executable with `-Wall -Wextra -pedantic`.
- **60 host checks passed:** existing gesture/power behaviours, first-touch boundaries (179/180 and 650/651 ms), follow-up boundaries (79/80 ms), release filtering, recovery cooldown, ambiguous-contact rejection, continuous-HIGH hold qualification, multi-taps near the timing-window boundary, startup/connection rearming and unchanged fast button double-press timing. Added checks cover fast media/presentation triples, the 220 ms triple decision, rejection of three weak first contacts and rejection of a fourth rapid tap before resolution. One check exercises **200 deterministic noise sequences of 20 short HIGH pulses each**, all below the first-touch minimum, with varied intervening LOW gaps; none emitted a gesture. These are simulated digital waveforms, not physical tests.
- Device name, service UUID, legacy characteristic UUID and all gesture tokens checked against the downloaded upstream client source.
- Source package integrity and SHA-256 manifest checked by `package_firmware.py`.

The Arduino compile required running the installed compiler outside the sandbox because Windows blocked executable startup inside it. No packages were installed and no microcontroller was flashed.

## Physical checks still required

These are compile and host-logic results. The test executable does not emulate the ESP32 BLE stack or physical GPIO/sensor electronics. Actual touch polarity and jumper configuration, button contact identification, on-device gesture timing, USB recovery, sustained-press wake, deep-sleep current, BLE notifications and end-to-end laptop/Android actions have not been tested on your ring.

The retained power-management and chip-temperature APIs were compile-checked against the installed core. Actual setting readbacks, discovery latency/range, internal-temperature accuracy, enclosure/skin-contact temperature and power reduction have not been measured. No medical, RF-compliance or surface-temperature safety conclusion follows from these tests. There is no automatic thermal safety cutoff.

The TTP223 supplies a digital signal. Software cannot distinguish a sustained hover from real contact if they produce the same waveform. Actual sensitivity distance and the rate of unwanted commands must be measured on the physical ring. See TOUCH_FILTERING.md; timing filters do not alter the sensor's hardware threshold.

Test with Serial Monitor before enclosing the parts. Then test BLE and the matching client. The archived client's slide/SELECT limitations are historical; the current website implements Page Down, Page Up and Enter correctly. Hardware references and the disconnected battery arrangement come from the existing v4 design; soldering/real fit remain physical work.
