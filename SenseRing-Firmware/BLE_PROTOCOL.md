# SenseRing touch BLE contract

Firmware 2.2.5-touch; preserves upstream SmartRing event protocol. One central at a time is the intended configuration. Notifications are best-effort action events, not a persistent queue across disconnects. There is no pairing/authentication requirement in this prototype protocol.

| Item | Value |
|---|---|
| Advertised name | `SmartRing` |
| Service | `12345678-1234-1234-1234-123456789abc` |
| Legacy event/control characteristic | `abcd1234-ab12-ab12-ab12-abcdef123456` |
| Optional status characteristic | `abcd1234-ab12-ab12-ab12-abcdef123457` |

Legacy characteristic properties: read, write-with-response, notify; standard CCCD notification subscription. Each notification is a single UTF-8/ASCII token, without a newline. Maximum action/mode token length is 17 bytes and fits the default BLE notification payload. The current browser connects, enables notifications and adopts the ring's mode. It writes a desired mode only when the user changes it.

Firmware-to-client action tokens:

`PLAY_PAUSE`, `NEXT`, `PREV`, `VOL_UP`, `VOL_DOWN`, `SLIDE_NEXT`, `SLIDE_PREV`, `SELECT`.

Mode-change notifications:

`MODE_DEFAULT` (media) and `MODE_PRESENTATION`.

Client-to-firmware writes:

- `MODE_DEFAULT` or `MODE_MEDIA`: media mode.
- `MODE_PRESENTATION`: presentation mode.
- `MODE_TOGGLE`: toggle mode.
- `GET_MODE`: enqueue the current mode token for notification.
- `SLEEP`: enter deep sleep once the tactile button is released.

Leading/trailing whitespace and letter case are normalised. Limit command payloads to 31 bytes. Same-mode writes are idempotent: they generate no acknowledgement notification and do not reset inactivity. This prevents the existing website's mode-sync echo from producing an infinite notification/write loop. Writes are handed to a bounded FreeRTOS queue; the main loop owns controller state. Commands/notifications can be dropped during disconnect, sleep or queue overflow; clients should read status or request mode after reconnection rather than replay old actions.

The optional status characteristic is **read-only** and holds a main-loop snapshot refreshed approximately every two seconds, with additional refreshes after mode/connection changes. It is background diagnostics, separate from immediate action notifications. Temperature is sampled once at startup and then every ten minutes; status reads reuse the cached temperature:

```json
{"fw":"2.2.5-touch","mode":"media","power":"awake","idle_ms":1200,"touch_stuck":false,"die_c":35.5,"temp_ok":true,"cpu_mhz":80,"ble_default_dbm":0,"ble_adv_dbm":0,"touch_raw":false,"touch_ready":true}
```

Use a GATT characteristic read (including long-read handling provided by the platform), not a notification parser. Status JSON does not go through the legacy event characteristic. The old website can ignore this characteristic. `STATUS`/`PING` are serial diagnostic commands; over BLE they produce no legacy action response. There is no battery telemetry or simulated percentage.

`die_c` is an illustrative internal-chip reading in the example above, not a measured result. It becomes JSON null if the diagnostic is unavailable/out of range. `temp_ok` means a valid sensor read, not safe skin contact. BLE readbacks reflect controller configuration, not a calibrated RF measurement. See RISK_REDUCTION.md.

`touch_raw` is the latest logical active level from the TTP223 (polarity-normalised); `touch_ready` means the firmware is out of its clear-input rearming block and not entering sleep. These are diagnostics, not capacitance or physical-contact measurements. Version 2.2.0 requires fresh clear-input rearming after connection boundaries and actual mode changes, so a finger already nearby cannot immediately complete a partial gesture on a new connection.

## Current client interpretation

Website 3.5.2 uses touch-specific mapping groups. Its Windows companion maps SLIDE_NEXT to Page Down, SLIDE_PREV to Page Up and SELECT to Enter. Android 1.3.0 defaults to an upward swipe for next and a downward swipe for previous, and offers horizontal swipes, edge taps and supported arrow actions. Profiles are interpreted on the host; the firmware emits the same tokens.

Presentation single-tap/hold share a forward mapping; double-tap/tap-and-hold share a backward mapping. These are firmware token groups, not five separately identifiable presentation notifications. The clients adopt confirmed ring mode on connection and dispatch notifications without a recurring BLE diagnostic poll in the action path.

## Integration boundaries

The ESP32 does not control PowerPoint, music apps or Android globally by itself. It sends the tokens above. The website/bridge or Android app must interpret them and have the appropriate OS capabilities. A compatible Android app can reuse this service and subscribe/write contract. This delivery adds no HID service or extra hardware.

Reference sources:

- https://github.com/kunalsachdev06/SenseRing
- https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/
- https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/api-reference/system/sleep_modes.html
