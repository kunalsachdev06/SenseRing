# D1 / D2 identification test

This is a temporary diagnostic sketch for XIAO ESP32-C3. It replaces the main application while it is uploaded.

1. Unplug USB and disconnect the touch sensor, external button and battery from the board. Keep battery leads insulated.
2. Locate D1, D2 and GND using the board labels and Seeed's pinout. Looking at the component side, with USB-C at the top: D1 is the second edge pad from the top on the left; D2 is the third. This orientation does not apply when looking at the underside.
3. Connect the board by USB. Open SenseRing_PinCheck.ino in Arduino IDE; select XIAO_ESP32C3, USB CDC On Boot enabled and the correct port. Upload.
4. Open Serial Monitor at 115200 baud. With neither pad connected, both should print HIGH.
5. Connect one end of an insulated test wire to confirmed GND. Briefly touch its other end to the known D1 pad: only D1 should show LOW. Remove it: D1 returns HIGH.
6. Repeat on D2: only D2 should show LOW, returning HIGH when released.
7. Unplug USB before changing the final wiring, then upload the main SenseRing_Touch sketch again for normal operation.

Only D1 and D2 are configured as pulled-up inputs in this test. Do not touch the wire to unknown pads; never bridge 3V3 or 5V to GND. Do not perform this grounding test with the touch module connected, as its output could be driven HIGH.

If the pads or orientation are unclear, use a clear photo of the board's component side and USB socket to identify them before testing.

Source: https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/#pin-map
