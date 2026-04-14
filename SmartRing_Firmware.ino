/*
 * Smart Gesture Control Ring Firmware
 * Hardware: Seeed Studio XIAO ESP32-C3
 * Sensor: AS5600 Magnetic Rotary Encoder (I2C)
 * Button: 6x6x2.5mm tactile push button
 *
 * Rotation: V1 logic — reads angle directly, no magnet-presence gating,
 * no EMA filter, no deadband. Accumulates raw angular delta and fires
 * when threshold crossed. Simple and reliable.
 *
 * BLE write handler: syncs MODE_DEFAULT / MODE_PRESENTATION from web app.
 */

#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ─── BLE UUIDs ──────────────────────────────────────────────────────────────
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID "abcd1234-ab12-ab12-ab12-abcdef123456"

// ─── Pin Definitions ────────────────────────────────────────────────────────
#define BUTTON_PIN     2
#define AS5600_SDA     4
#define AS5600_SCL     5
#define AS5600_ADDR    0x36

// ─── AS5600 Register Addresses ──────────────────────────────────────────────
#define AS5600_RAW_ANGLE_H  0x0C
#define AS5600_RAW_ANGLE_L  0x0D

// ─── Timing Constants ────────────────────────────────────────────────────────
#define DEBOUNCE_MS         50
#define LONG_PRESS_MS       700
#define DOUBLE_TAP_WINDOW   350
#define MAX_TAP_COUNT       3

// ─── V1 Rotation Constants ───────────────────────────────────────────────────
// ROTATION_THRESHOLD: total accumulated degrees before a command fires.
//   Raise this → need a bigger deliberate rotation to trigger anything.
//   Lower this → more sensitive, small movements trigger commands.
// ROTATION_SEND_DELAY: minimum ms between consecutive BLE rotation commands.
//   Raise this → slower repeat rate while holding a rotation.
//   Lower this → commands fire more rapidly while rotating.
#define ROTATION_THRESHOLD  25    // degrees — needs a solid quarter-turn gesture
#define ROTATION_SEND_DELAY 300   // ms — max ~3 commands/sec while rotating

// ─── Mode Definitions ────────────────────────────────────────────────────────
#define MODE_MEDIA         0
#define MODE_PRESENTATION  1

// ─── Globals ─────────────────────────────────────────────────────────────────
BLEServer*          pServer         = nullptr;
BLECharacteristic*  pCharacteristic = nullptr;
bool                deviceConnected    = false;
bool                oldDeviceConnected = false;

// Button state
unsigned long buttonDownTime        = 0;
unsigned long lastButtonReleaseTime = 0;
bool          lastButtonState       = HIGH;
bool          buttonState           = HIGH;
int           tapCount              = 0;
bool          longPressHandled      = false;
unsigned long lastDebounceTime      = 0;

// V1 rotation state — simple accumulator, no magnet gating
int16_t       lastAngle         = 0;
int16_t       currentAngle      = 0;
int16_t       accumulatedDelta  = 0;
unsigned long lastRotationSend  = 0;

// Mode
uint8_t currentMode = MODE_MEDIA;

// ─── BLE Server Callbacks ────────────────────────────────────────────────────
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] Client connected");
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected");
  }
};

// ─── BLE Write Callback ───────────────────────────────────────────────────────
// Handles commands FROM the web app so mode stays in sync
class MyCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String rx = pChar->getValue().c_str();
    rx.trim();
    Serial.print("[BLE] Received: ");
    Serial.println(rx);

    if (rx == "MODE_DEFAULT") {
      currentMode = MODE_MEDIA;
      Serial.println("[MODE] Set to Media (from web)");
    }
    else if (rx == "MODE_PRESENTATION") {
      currentMode = MODE_PRESENTATION;
      Serial.println("[MODE] Set to Presentation (from web)");
    }
    // REMAP: payloads are handled entirely on the web side
  }
};

// ─── AS5600 Read Raw Angle (0–4095) — V1: read directly, no status check ────
uint16_t readAS5600Raw() {
  Wire.beginTransmission(AS5600_ADDR);
  Wire.write(AS5600_RAW_ANGLE_H);
  Wire.endTransmission(false);
  Wire.requestFrom(AS5600_ADDR, 2);
  if (Wire.available() < 2) return 0;
  uint16_t high = Wire.read();
  uint16_t low  = Wire.read();
  return ((high & 0x0F) << 8) | low;
}

// ─── Convert Raw (0–4095) → Degrees (0–359) ──────────────────────────────────
int16_t rawToDegrees(uint16_t raw) {
  return (int16_t)((raw * 360L) / 4096);
}

// ─── Compute shortest angular delta (handles 0/360 wraparound) ───────────────
int16_t angularDelta(int16_t from, int16_t to) {
  int16_t delta = to - from;
  if (delta >  180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

// ─── Send BLE Message ─────────────────────────────────────────────────────────
void sendBLE(const char* msg) {
  if (!deviceConnected) return;
  pCharacteristic->setValue(msg);
  pCharacteristic->notify();
  Serial.print("[BLE] Sent: ");
  Serial.println(msg);
}

// ─── Handle Tap Count → Action ───────────────────────────────────────────────
void handleTaps(int count) {
  Serial.print("[BTN] Tap count: ");
  Serial.println(count);
  if (currentMode == MODE_MEDIA) {
    switch (count) {
      case 1: sendBLE("PLAY_PAUSE"); break;
      case 2: sendBLE("NEXT");       break;
      case 3: sendBLE("PREV");       break;
    }
  } else {
    switch (count) {
      case 1: sendBLE("SELECT");     break;
      case 2: sendBLE("NEXT");       break;
      case 3: sendBLE("PREV");       break;
    }
  }
}

// ─── Handle Rotation Action ───────────────────────────────────────────────────
void handleRotation(int16_t delta) {
  if (currentMode == MODE_MEDIA) {
    if (delta > 0) sendBLE("VOL_UP");
    else           sendBLE("VOL_DOWN");
  } else {
    if (delta > 0) sendBLE("SLIDE_NEXT");
    else           sendBLE("SLIDE_PREV");
  }
}

// ─── Toggle Mode ──────────────────────────────────────────────────────────────
void toggleMode() {
  currentMode = (currentMode == MODE_MEDIA) ? MODE_PRESENTATION : MODE_MEDIA;
  if (currentMode == MODE_MEDIA) {
    sendBLE("MODE_DEFAULT");
    Serial.println("[MODE] Switched → Media");
  } else {
    sendBLE("MODE_PRESENTATION");
    Serial.println("[MODE] Switched → Presentation");
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[BOOT] Smart Gesture Ring starting...");

  // I2C for AS5600
  Wire.begin(AS5600_SDA, AS5600_SCL);

  // Check AS5600 presence
  Wire.beginTransmission(AS5600_ADDR);
  uint8_t err = Wire.endTransmission();
  if (err == 0) {
    Serial.println("[I2C] AS5600 detected OK");
  } else {
    Serial.print("[I2C] AS5600 NOT found, error: ");
    Serial.println(err);
  }

  // Read initial angle — V1 style, straight read
  lastAngle = rawToDegrees(readAS5600Raw());
  currentAngle = lastAngle;

  // Button setup
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // BLE init
  BLEDevice::init("SmartRing");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ   |
    BLECharacteristic::PROPERTY_WRITE  |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());
  pCharacteristic->setValue("READY");

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising as 'SmartRing'");
  Serial.println("[BOOT] Ready. Waiting for connection...");
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // ── BLE reconnect ──────────────────────────────────────────────────────────
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising");
    oldDeviceConnected = false;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
  }

  // ── Rotation Detection — V1: read directly, accumulate, fire on threshold ──
  uint16_t raw = readAS5600Raw();
  currentAngle = rawToDegrees(raw);
  int16_t delta = angularDelta(lastAngle, currentAngle);

  // Accumulate small movements
  accumulatedDelta += delta;
  lastAngle = currentAngle;

  if (abs(accumulatedDelta) >= ROTATION_THRESHOLD) {
    if (now - lastRotationSend >= ROTATION_SEND_DELAY) {
      handleRotation(accumulatedDelta);
      accumulatedDelta = 0;
      lastRotationSend = now;
    }
  }

  // ── Button State Machine ──────────────────────────────────────────────────
  bool rawBtn = digitalRead(BUTTON_PIN);

  // Debounce
  if (rawBtn != lastButtonState) {
    lastDebounceTime = now;
  }
  lastButtonState = rawBtn;

  if ((now - lastDebounceTime) >= DEBOUNCE_MS) {
    if (rawBtn != buttonState) {
      buttonState = rawBtn;

      if (buttonState == LOW) {
        buttonDownTime   = now;
        longPressHandled = false;
      } else {
        if (!longPressHandled) {
          unsigned long pressDuration = now - buttonDownTime;
          if (pressDuration < LONG_PRESS_MS) {
            tapCount++;
            lastButtonReleaseTime = now;
          }
        }
      }
    }
  }

  // ── Long Press Detection ──────────────────────────────────────────────────
  if (buttonState == LOW && !longPressHandled) {
    if ((now - buttonDownTime) >= LONG_PRESS_MS) {
      longPressHandled = true;
      tapCount = 0;
      toggleMode();
    }
  }

  // ── Multi-tap Resolution ──────────────────────────────────────────────────
  if (tapCount > 0 && buttonState == HIGH) {
    if ((now - lastButtonReleaseTime) >= DOUBLE_TAP_WINDOW) {
      handleTaps(tapCount);
      tapCount = 0;
    }
  }

  // Keep loop tight
  delay(5);
}
