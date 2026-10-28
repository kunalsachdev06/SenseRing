/*
 * Temporary XIAO ESP32-C3 D1/D2 identification test.
 * Disconnect the sensor, external button and battery. Use USB power only.
 * Both named GPIOs are INPUT_PULLUP. Momentarily connect ONLY the confirmed
 * D1 or D2 pad to confirmed GND and watch its printed state change to LOW.
 * Never ground a power pad or probe unknown pads blindly.
 * Upload the main SenseRing firmware again after this test.
 */
#include <Arduino.h>

#if !CONFIG_IDF_TARGET_ESP32C3
#error Select XIAO_ESP32C3 as the board.
#endif
static_assert(D1 == 3 && D2 == 4, "Select the XIAO_ESP32C3 board variant");

void setup() {
  pinMode(D1, INPUT_PULLUP);
  pinMode(D2, INPUT_PULLUP);
  Serial.begin(115200);
}

void loop() {
  Serial.printf("D1 (GPIO3) = %s  |  D2 (GPIO4) = %s\n",
                digitalRead(D1) == HIGH ? "HIGH" : "LOW",
                digitalRead(D2) == HIGH ? "HIGH" : "LOW");
  delay(250);
}
