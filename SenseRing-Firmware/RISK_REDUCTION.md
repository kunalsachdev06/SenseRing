# SenseRing: power reduction and practical risk controls

Firmware 2.2.5 retains the existing power-management settings and 140/70 ms tap qualification while sampling temperature every ten minutes. These changes do not establish medical safety, RF exposure compliance, safe skin-contact temperature, biocompatibility or battery protection. Earlier firmware ZIPs are preserved locally with versioned backup names. See TOUCH_FILTERING.md for the sensor's digital-output limitations.

## What code changes

| Measure | Implementation | Practical limit |
|---|---|---|
| Lower CPU operating frequency | Requests 80 MHz; reports actual frequency in STATUS | Expected to reduce CPU work/power; total case heat reduction must be measured |
| Reduced BLE transmit setting | Requests 0 dBm for default connections and advertising; reads back controller settings | Shorter range is possible; controller readback is not measured radiated power or body exposure |
| Less frequent discovery traffic | Advertising interval configured for 500-1000 ms | Discovery/reconnection can take longer |
| Connection interval preference | Advertises a 30-50 ms preference | The phone/laptop decides the actual connection interval |
| Reduced polling frequency | Main loop yields for 5 ms instead of 2 ms | Exact responsiveness needs a hardware check |
| Bound held-volume actions | Maximum 5 volume commands per uninterrupted hold, then release/re-touch required | Not a cap on OS volume, sound pressure or hearing exposure |
| Existing inactivity control | Deep sleep after 15 minutes without activity | The sensor and board supply circuitry remain powered |
| Unwanted-input control | Minimum continuous active time, release/rearm qualification, ambiguous-contact rejection, sustained wake hold, partial-gesture cancellation and 10-second stuck-touch timeout | The sensor cannot prove physical contact or human intent; sustained hover can still resemble a valid touch |
| Temperature diagnostic | Reads the ESP32-C3's internal sensor once at startup, then approximately every ten minutes, after ready gesture notifications | Chip temperature only; no case/skin/cell temperature measurement or automatic thermal safety cutoff |

Wi-Fi is not started by this firmware. BLE remains available for the companion website/app; radio use stops during ESP32 deep sleep. No battery connection/charging code or extra hardware was added.

## Temperature: use the number correctly

`die_c` in Serial STATUS and the optional BLE status read is an approximate temperature inside the ESP32 silicon. `temp_ok` indicates a successful in-range driver reading, not a safety assessment. Failed or out-of-range readings are reported as `die_c: null, temp_ok: false`; they are not replaced with a reassuring value.

The firmware uses the IDF driver with a configured -10 to 80 C diagnostic range. This is an instrument range, not a safe operating range for a wearable. The chip's built-in sensor is not a body-temperature sensor and cannot detect a warm regulator, USB fault, hot pouch cell, bad solder joint or skin irritation. No automatic skin-temperature shutdown threshold has been invented from this reading.

Before wearing the assembled prototype, run it off the finger under expected use until its temperature stabilizes. Check the actual finger-contact surface with an external temperature instrument if available. Compare chip readings with those surface measurements; do not assume a fixed difference or treat a chip reading as a skin-contact clearance. Stop a test and disconnect USB if the enclosure becomes uncomfortably warm or behaves abnormally.

To inspect diagnostics, open Serial Monitor at 115200 baud, enable newline, and enter `STATUS`. It reports die temperature, sensor-read validity, CPU MHz and BLE setting readbacks. Values of -128 for BLE readbacks mean the requested setting was not verified. RF range, power consumption and temperature improvements have not been measured on your physical ring.

## Physical controls code cannot supply

- Keep the existing battery electrically disconnected and both leads individually insulated. Prevent pressure, bending, puncture and shorts. Software cannot protect a disconnected cell from physical damage.
- Keep solder joints and loose conductors away from skin. Keep the exposed touch area as designed, with the remaining electronics enclosed.
- Keep the finger opening smooth, clean, dry and easy to remove. Stop wearing it if it causes pressure, irritation or discomfort. The material name PLA alone does not assess the particular filament, pigment, paint or adhesive against your skin.
- Finish and clean parts before fitting electronics. Leave access to unplug USB and remove the covers.

## RF perspective

Bluetooth uses non-ionizing RF. CDC describes wearable Bluetooth transmitters as low powered. Lowering transmit settings here is a power-engineering measure; this prototype has no measured RF exposure/SAR data, and no health-risk reduction percentage is claimed. Do not present these firmware settings as medical certification or evidence that the previous setting was harmful.

## Sources

- CDC, Facts About Wearable Technology: https://www.cdc.gov/radiation-health/data-research/facts-stats/wearable-technology.html
- Espressif, ESP32-C3 temperature-sensor limits: https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/api-reference/peripherals/temp_sensor.html
- Espressif, BLE controller/power APIs: https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/api-reference/bluetooth/controller_vhci.html
- Actual API definitions also checked against the installed Arduino-ESP32 3.3.11 core and BLE library.
