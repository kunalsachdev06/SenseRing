#pragma once
#include <stdint.h>

// XIAO pad D2 = GPIO4; pad D1 = GPIO3. GPIO numbers are intentional.
namespace RingConfig {
constexpr uint8_t TOUCH_GPIO = 4;
constexpr uint8_t BUTTON_GPIO = 3;
constexpr bool TOUCH_ACTIVE_HIGH = true;
constexpr uint32_t TOUCH_STARTUP_MS = 2000;
constexpr uint32_t TOUCH_PRESS_MS = 80;
constexpr uint32_t TOUCH_FAST_PRESS_MS = 35;
constexpr uint32_t TOUCH_RELEASE_MS = 60;
constexpr uint32_t MIN_TOUCH_TAP_MS = 140;
constexpr uint32_t MIN_FOLLOWUP_TAP_MS = 70;
constexpr uint32_t MAX_TOUCH_TAP_MS = 650;
constexpr uint32_t TOUCH_MULTITAP_GAP_MS = 250;
constexpr uint32_t TOUCH_TRIPLE_SETTLE_MS = 120;
constexpr uint32_t TOUCH_REARM_MS = 180;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 35;
constexpr uint32_t MIN_TAP_MS = 35;
constexpr uint32_t MULTITAP_GAP_MS = 400;
constexpr uint32_t TOUCH_HOLD_MS = 700;
constexpr uint32_t MEDIA_REPEAT_MS = 220;
constexpr uint8_t MAX_VOLUME_STEPS_PER_HOLD = 5;
constexpr uint32_t SLIDE_REPEAT_MS = 850;
constexpr uint32_t MAX_TOUCH_HOLD_MS = 10000;
constexpr uint32_t POWER_HOLD_MS = 2000;
constexpr uint32_t IDLE_SLEEP_MS = 15UL * 60UL * 1000UL;
constexpr uint32_t NOTIFY_GAP_MS = 35;
constexpr uint32_t CPU_MHZ = 80;
constexpr uint32_t LOOP_DELAY_MS = 5;
// BLE advertising units are 0.625 ms: 800..1600 = 500..1000 ms.
constexpr uint16_t ADV_MIN_UNITS = 800;
constexpr uint16_t ADV_MAX_UNITS = 1600;
// Diagnostics are background work, not part of gesture recognition.
constexpr uint32_t STATUS_UPDATE_MS = 2000;
constexpr uint32_t TEMPERATURE_SAMPLE_MS = 10UL * 60UL * 1000UL;
constexpr bool SERIAL_EVENT_LOGS = false;
constexpr char DEVICE_NAME[] = "SmartRing";
constexpr char SERVICE_UUID[] = "12345678-1234-1234-1234-123456789abc";
constexpr char EVENT_UUID[] = "abcd1234-ab12-ab12-ab12-abcdef123456";
constexpr char STATUS_UUID[] = "abcd1234-ab12-ab12-ab12-abcdef123457";
constexpr char FIRMWARE_VERSION[] = "2.2.5-touch";
}
