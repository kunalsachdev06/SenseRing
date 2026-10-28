/*
 * SenseRing touch firmware 2.2.5
 * Target: Seeed Studio XIAO ESP32-C3, Arduino-ESP32 3.x.
 * TTP223: 3V3, GND, OUT -> D2/GPIO4; momentary, active HIGH.
 * Tactile switch: verified switched contacts -> D1/GPIO3 and GND.
 * USB powered. No AS5600, battery wiring/measurement/charging code, or HID.
 * See ../README.md for gestures, upload instructions and compatibility limits.
 */
#include <Arduino.h>
#include <atomic>
#include <math.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#if defined(CONFIG_BLUEDROID_ENABLED)
#include <BLE2902.h>
#endif
#include <driver/gpio.h>
#include <driver/temperature_sensor.h>
#include <esp_sleep.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "RingConfig.h"
#include "RingLogic.h"

#if !CONFIG_IDF_TARGET_ESP32C3
#error Select the XIAO_ESP32C3 board. This sketch uses ESP32-C3 GPIO deep-sleep wake.
#endif
static_assert(RingConfig::BUTTON_GPIO == 3, "Recheck wake support before changing button pin");

using SenseRing::Event;
using SenseRing::Mode;
RTC_DATA_ATTR uint32_t retainedMagic = 0;
RTC_DATA_ATTR uint8_t retainedMode = 0;
constexpr uint32_t RETAINED_MAGIC = 0x534E5232;
BLECharacteristic *eventCharacteristic = nullptr;
BLECharacteristic *statusCharacteristic = nullptr;
BLEServer *server = nullptr;
std::atomic<bool> connected{false};
std::atomic<uint32_t> linkRevision{0};
struct Command { char text[32]; };
QueueHandle_t commands = nullptr;
char serialLine[32];
uint8_t serialLength = 0;
bool serialOverflow = false;
bool bleStarted = false;
bool statusDirty = true;
Event pendingEvents[24];
uint8_t eventHead = 0, eventTail = 0;
uint32_t lastNotify = 0;
temperature_sensor_handle_t temperatureSensor = nullptr;
float chipTemperatureC = NAN;
bool temperatureValid = false;
uint32_t lastTemperatureSampleMs = 0;
int defaultBleDbm = -128, advertisingBleDbm = -128;

void onEvent(Event event, void *);
SenseRing::Controller controller(onEvent);

bool buttonPressedRaw() { return digitalRead(RingConfig::BUTTON_GPIO) == LOW; }
bool touchPressedRaw() {
  return (digitalRead(RingConfig::TOUCH_GPIO) == HIGH) == RingConfig::TOUCH_ACTIVE_HIGH;
}
void logLine(const char *text) { if (Serial) Serial.println(text); }
void clearEvents() { eventHead = eventTail = 0; }
void queueEvent(Event event) {
  if (!connected.load()) return;
  const uint8_t next = (eventTail + 1) % 24;
  if (next == eventHead) { logLine("[BLE] Queue full; newest event dropped"); return; }
  pendingEvents[eventTail] = event; eventTail = next;
}
void onEvent(Event event, void *) {
  if (event == Event::ModeMedia || event == Event::ModePresentation) {
    retainedMagic = RETAINED_MAGIC; retainedMode = static_cast<uint8_t>(controller.mode());
    statusDirty = true;
  }
  // SLEEP is an internal power event, not a legacy media command.
  if (event != Event::Sleep) queueEvent(event);
  else statusDirty = true;
  // Opt-in wiring diagnostics: USB output can otherwise wait on a full TX
  // buffer. Normal action callbacks only queue the fixed command token.
  if (RingConfig::SERIAL_EVENT_LOGS && Serial) {
    Serial.print("[EVENT] "); Serial.println(SenseRing::token(event));
  }
}

const char *statusValue() {
  static char value[350];
  char temperatureText[16];
  if (temperatureValid) snprintf(temperatureText, sizeof(temperatureText), "%.1f", chipTemperatureC);
  else snprintf(temperatureText, sizeof(temperatureText), "null");
  snprintf(value, sizeof(value),
           "{\"fw\":\"%s\",\"mode\":\"%s\",\"power\":\"%s\",\"idle_ms\":%lu,\"touch_stuck\":%s,\"die_c\":%s,\"temp_ok\":%s,\"cpu_mhz\":%lu,\"ble_default_dbm\":%d,\"ble_adv_dbm\":%d,\"touch_raw\":%s,\"touch_ready\":%s}",
           RingConfig::FIRMWARE_VERSION,
           controller.mode() == Mode::Media ? "media" : "presentation",
           controller.sleepRequested() ? "sleep_pending" : "awake",
           static_cast<unsigned long>(controller.idleMs(millis())),
           controller.touchStuck() ? "true" : "false", temperatureText,
           temperatureValid ? "true" : "false", static_cast<unsigned long>(getCpuFrequencyMhz()),
           defaultBleDbm, advertisingBleDbm, controller.rawTouch() ? "true" : "false",
           controller.touchReady() ? "true" : "false");
  return value;
}
void refreshStatus() {
  if (!statusCharacteristic) return;
  const char *value = statusValue();
  statusCharacteristic->setValue(reinterpret_cast<const uint8_t *>(value), strlen(value));
  statusDirty = false;
}

// Diagnostic only: silicon temperature cannot establish skin/case/battery temperature.
// Use the IDF driver explicitly; Arduino temperatureRead() has a narrower default range.
void sampleChipTemperature() {
  lastTemperatureSampleMs = millis();
  temperatureValid = false;
  chipTemperatureC = NAN;
  if (!temperatureSensor || temperature_sensor_enable(temperatureSensor) != ESP_OK) return;
  float reading = NAN;
  const esp_err_t result = temperature_sensor_get_celsius(temperatureSensor, &reading);
  temperature_sensor_disable(temperatureSensor);
  if (result == ESP_OK && isfinite(reading) && reading >= -10 && reading <= 80) {
    chipTemperatureC = reading; temperatureValid = true;
  }
}
void initTemperatureDiagnostic() {
  temperature_sensor_config_t config = TEMPERATURE_SENSOR_CONFIG_DEFAULT(-10, 80);
  if (temperature_sensor_install(&config, &temperatureSensor) != ESP_OK) {
    temperatureSensor = nullptr;
    logLine("[DIAG] Chip temperature unavailable; no thermal protection is claimed");
    return;
  }
  sampleChipTemperature();
}

void enqueueCommand(const String &value) {
  if (!commands || value.length() >= sizeof(Command::text)) return;
  Command command{}; value.toCharArray(command.text, sizeof(command.text));
  xQueueSend(commands, &command, 0);
}
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { connected.store(true); ++linkRevision; }
  void onDisconnect(BLEServer *) override { connected.store(false); ++linkRevision; }
};
class EventCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    enqueueCommand(characteristic->getValue());
  }
};

void startBLE() {
  commands = xQueueCreate(8, sizeof(Command));
  if (!commands) { logLine("[ERROR] Cannot allocate command queue"); return; }
  BLEDevice::init(RingConfig::DEVICE_NAME);
  // Requested TX setting, not a measurement of emitted RF or absorbed exposure.
  BLEDevice::setPower(ESP_PWR_LVL_N0, ESP_BLE_PWR_TYPE_DEFAULT);
  BLEDevice::setPower(ESP_PWR_LVL_N0, ESP_BLE_PWR_TYPE_ADV);
  defaultBleDbm = BLEDevice::getPower(ESP_BLE_PWR_TYPE_DEFAULT);
  advertisingBleDbm = BLEDevice::getPower(ESP_BLE_PWR_TYPE_ADV);
  if (defaultBleDbm != 0 || advertisingBleDbm != 0)
    logLine("[WARN] Could not verify requested 0 dBm BLE settings; check STATUS");
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(RingConfig::SERVICE_UUID);
  eventCharacteristic = service->createCharacteristic(
      RingConfig::EVENT_UUID, BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  // NimBLE adds CCCD automatically; older Bluedroid builds need it explicitly.
#if defined(CONFIG_BLUEDROID_ENABLED)
  eventCharacteristic->addDescriptor(new BLE2902());
#endif
  eventCharacteristic->setCallbacks(new EventCallbacks());
  eventCharacteristic->setValue(controller.mode() == Mode::Media ? "MODE_DEFAULT" : "MODE_PRESENTATION");
  statusCharacteristic = service->createCharacteristic(RingConfig::STATUS_UUID, BLECharacteristic::PROPERTY_READ);
  refreshStatus();
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(RingConfig::SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinInterval(RingConfig::ADV_MIN_UNITS);
  advertising->setMaxInterval(RingConfig::ADV_MAX_UNITS);
  // Hints to the central: 30..50 ms. Actual connection timing is chosen by the peer.
  advertising->setMinPreferred(0x18);
  advertising->setMaxPreferred(0x28);
  BLEDevice::startAdvertising();
  bleStarted = true;
  logLine("[BLE] Advertising as SmartRing");
}

void enterSleep() {
  // Do not arm a LOW-level wake while the switch is still pressed.
  if (buttonPressedRaw()) return;
  retainedMagic = RETAINED_MAGIC; retainedMode = static_cast<uint8_t>(controller.mode());
  const esp_err_t result = esp_deep_sleep_enable_gpio_wakeup(
      1ULL << RingConfig::BUTTON_GPIO, ESP_GPIO_WAKEUP_GPIO_LOW);
  if (result != ESP_OK) { logLine("[ERROR] Cannot arm wake source; staying awake"); return; }
  gpio_pullup_en(static_cast<gpio_num_t>(RingConfig::BUTTON_GPIO));
  gpio_pulldown_dis(static_cast<gpio_num_t>(RingConfig::BUTTON_GPIO));
  logLine("[POWER] Deep sleep. Hold button about 2-3 seconds to wake.");
  delay(30);
  if (bleStarted) BLEDevice::deinit(false);
  esp_deep_sleep_start();
}

// A GPIO press wakes the CPU immediately. Require a sustained press before BLE starts.
bool acceptWakeHold() {
  if (esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_GPIO) return true;
  const uint32_t start = millis();
  while (SenseRing::elapsed(millis(), start) < RingConfig::POWER_HOLD_MS) {
    if (!buttonPressedRaw()) return false;
    delay(5);
  }
  logLine("[POWER] Wake hold accepted; release button");
  while (buttonPressedRaw()) delay(5);
  delay(RingConfig::BUTTON_DEBOUNCE_MS);
  return true;
}

void processCommand(String text) {
  text.trim(); text.toUpperCase();
  if (text == "MODE_DEFAULT" || text == "MODE_MEDIA") controller.setMode(Mode::Media, millis());
  else if (text == "MODE_PRESENTATION") controller.setMode(Mode::Presentation, millis());
  else if (text == "MODE_TOGGLE") controller.toggleMode(millis());
  else if (text == "GET_MODE") queueEvent(controller.mode() == Mode::Media ? Event::ModeMedia : Event::ModePresentation);
  else if (text == "SLEEP") controller.requestSleep();
  else if (text == "STATUS" || text == "PING") { if (Serial) Serial.println(statusValue()); }
  else if (text == "HELP") logLine("[HELP] MODE_DEFAULT, MODE_PRESENTATION, MODE_TOGGLE, GET_MODE, STATUS, SLEEP");
  else if (text.startsWith("REMAP:")) logLine("[INFO] Legacy remapping belongs to the client");
  else logLine("[WARN] Unknown command; type HELP");
}
void readSerial() {
  uint8_t budget = 64;
  while (Serial.available() && budget--) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n' || c == '\r') {
      if (serialLength && !serialOverflow) { serialLine[serialLength] = '\0'; processCommand(String(serialLine)); }
      serialLength = 0; serialOverflow = false;
    } else if (c >= 32 && c <= 126) {
      if (serialLength < sizeof(serialLine) - 1) serialLine[serialLength++] = c;
      else serialOverflow = true;
    }
  }
}

void setup() {
  pinMode(RingConfig::BUTTON_GPIO, INPUT_PULLUP);
  pinMode(RingConfig::TOUCH_GPIO, INPUT_PULLDOWN);
  Serial.begin(115200); // Never wait for Serial: phone-only BLE use must boot too.
  if (!setCpuFrequencyMhz(RingConfig::CPU_MHZ))
    logLine("[WARN] Could not set requested CPU clock; check STATUS");
  if (!acceptWakeHold()) {
    controller.begin(millis(), touchPressedRaw(), buttonPressedRaw());
    controller.requestSleep(); // Main loop waits for a debounced release before rearming wake.
    return;
  }
  const uint32_t started = millis();
  logLine("[BOOT] SenseRing touch 2.2.5; keep finger clear for startup and rearming");
  while (SenseRing::elapsed(millis(), started) < RingConfig::TOUCH_STARTUP_MS) delay(5);
  const Mode initial = retainedMagic == RETAINED_MAGIC && retainedMode == 1 ? Mode::Presentation : Mode::Media;
  controller.begin(millis(), touchPressedRaw(), buttonPressedRaw(), initial);
  initTemperatureDiagnostic();
  startBLE();
  logLine("[READY] Serial 115200, newline; HELP lists commands");
}

void loop() {
  uint32_t now = millis();
  static uint32_t seenLinkRevision = 0, advertisingDue = 0, lastStatus = 0;
  static bool restartAdvertising = false;
  const uint32_t revision = linkRevision.load();
  if (revision != seenLinkRevision) {
    seenLinkRevision = revision; controller.cancelGestures(now); clearEvents(); statusDirty = true;
    restartAdvertising = !connected.load(); advertisingDue = now;
    logLine(connected.load() ? "[BLE] Connected" : "[BLE] Disconnected");
  }
  if (restartAdvertising && !connected.load() && SenseRing::elapsed(now, advertisingDue) >= 250) {
    BLEDevice::startAdvertising(); restartAdvertising = false;
  }
  Command command{};
  uint8_t commandBudget = 8;
  while (commands && commandBudget-- && xQueueReceive(commands, &command, 0) == pdTRUE)
    processCommand(String(command.text));
  now = millis(); // Commands may have updated lastActivity; avoid comparing an older timestamp.
  controller.update(now, touchPressedRaw(), buttonPressedRaw());

  // A mode/connection change needs consistent readback before its notification.
  // Ordinary gesture events do not set this flag or build status JSON.
  if (statusCharacteristic && statusDirty) { refreshStatus(); lastStatus = now; }
  if (controller.sleepRequested()) {
    clearEvents();
    if (!controller.buttonPressed() && !buttonPressedRaw()) enterSleep();
    delay(5); return;
  }
  if (connected.load() && eventHead != eventTail &&
      SenseRing::elapsed(now, lastNotify) >= RingConfig::NOTIFY_GAP_MS) {
    const Event event = pendingEvents[eventHead]; eventHead = (eventHead + 1) % 24;
    eventCharacteristic->setValue(SenseRing::token(event));
    eventCharacteristic->notify(); lastNotify = now;
  }
  // Background diagnostics run only after input processing and ready command
  // notification. Mode/connection changes still refresh readback immediately.
  if (SenseRing::elapsed(now, lastTemperatureSampleMs) >= RingConfig::TEMPERATURE_SAMPLE_MS) {
    sampleChipTemperature();
  }
  if (statusCharacteristic && SenseRing::elapsed(now, lastStatus) >= RingConfig::STATUS_UPDATE_MS) {
    refreshStatus(); lastStatus = now;
  }
  readSerial();
  delay(RingConfig::LOOP_DELAY_MS);
}
