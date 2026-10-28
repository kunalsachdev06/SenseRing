# SenseRing touch version: final wiring

Target: Seeed Studio XIAO ESP32-C3, one three-pin TTP223 touch module and one momentary tactile button. This replaces the AS5600 rotary-input arrangement. Power is supplied through the XIAO USB-C port.

| Component terminal | Connect to XIAO pad | ESP32-C3 GPIO | Purpose |
|---|---|---|---|
| TTP223 VCC / + | 3V3 | Power output | 3.3 V sensor power |
| TTP223 GND / - | GND | Ground | Common ground |
| TTP223 OUT / I/O / SIG | D2 | GPIO4 | Touch input |
| Button switched contact A | D1 | GPIO3 | Button input and deep-sleep wake |
| Button switched contact B | GND | Ground | Press connects D1 to ground |
| USB-C cable | XIAO USB-C socket | USB | USB power and firmware upload |

Follow the printed pad labels. Do not infer the three sensor terminals' order from their location or wire colour.

**Set the TTP223 to momentary, active-HIGH operation:** untouched = LOW; touched = HIGH only while your finger is present. On many small boards the configuration solder bridges are left open for this setting, but confirm the module's own legend. A toggle/latching setting will not support the intended tap/hold gestures. Power the module from 3V3 so its output is compatible with the XIAO GPIO.

The firmware enables the XIAO's internal pull-up on D1: no additional button resistor is needed for the planned short wiring. For a five-terminal button, use a multimeter with power removed to find a pair that is open when released and connected when pressed. Other terminals may be duplicates or a case terminal. Leave unneeded terminals unconnected. Do not connect D1 to 3V3 through the switch.

Keep the battery completely disconnected in this build. Individually insulate both battery lead ends and park them in their assigned routing space. Nothing connects to the XIAO battery pads, 5V pad, EN/reset or BOOT. The AS5600, its I2C wiring and magnet are not used. Other GPIO pads remain unused.

The board's supplied antenna attaches to its small U.FL antenna socket, not a GPIO. Check the existing antenna connection before BLE testing. Radio range and antenna placement inside the assembled case need real testing.

## Installation order

1. Unplug USB before soldering. Confirm all printed pin labels.
2. Connect sensor VCC, GND and OUT, then the two verified switched button contacts.
3. Inspect for solder bridges and verify no short between 3V3 and GND with a multimeter. Perform continuity checks only when unpowered.
4. Connect USB and upload the supplied sketch. Leave fingers clear of the touch area for about 2.5 seconds at startup, covering the firmware's startup ignore and clear-input rearming periods.
5. Test inputs outside the enclosure, then route thin flexible insulated wires through the base's end gutters and pad-edge channels. Keep joints low and wires off the central component block.
6. Test with covers fitted before applying final retention adhesive. Keep the cell flat and free from pressure.

## Sources

- XIAO pad-to-GPIO mapping and D1 wake example: https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/
- TTP223 module voltage and configurable output modes: https://www.sunrom.com/p/capacitive-touch-module-ttp223
- ESP32-C3 deep-sleep wake behaviour: https://docs.espressif.com/projects/esp-idf/en/stable/esp32c3/api-reference/system/sleep_modes.html
