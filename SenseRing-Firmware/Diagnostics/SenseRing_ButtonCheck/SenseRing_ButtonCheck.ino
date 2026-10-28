/*
 * XIAO ESP32-C3 button test.
 * Connect the two verified switched contacts to D1/GPIO3 and GND.
 * No connection to 3V3 or 5V; internal pull-up is enabled.
 * Serial Monitor: 115200 baud, USB CDC On Boot enabled.
 * Upload the main SenseRing sketch again after testing.
 */
#include <Arduino.h>

constexpr uint8_t BUTTON_PIN = 3; // XIAO pad D1 = GPIO3

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("PRESSED  | D1 = LOW");
  } else {
    Serial.println("RELEASED | D1 = HIGH");
  }
  delay(200);
}
