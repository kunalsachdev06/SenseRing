#pragma once
#include <stdint.h>
#include "RingConfig.h"

namespace SenseRing {
inline uint32_t elapsed(uint32_t now, uint32_t then) { return now - then; }
enum class Mode : uint8_t { Media = 0, Presentation = 1 };
enum class Event : uint8_t {
  PlayPause, NextTrack, PreviousTrack, VolumeUp, VolumeDown,
  SlideNext, SlidePrevious, Select, ModeMedia, ModePresentation, Sleep
};
using EventSink = void (*)(Event, void *);

inline const char *token(Event event) {
  switch (event) {
    case Event::PlayPause: return "PLAY_PAUSE";
    case Event::NextTrack: return "NEXT";
    case Event::PreviousTrack: return "PREV";
    case Event::VolumeUp: return "VOL_UP";
    case Event::VolumeDown: return "VOL_DOWN";
    case Event::SlideNext: return "SLIDE_NEXT";
    case Event::SlidePrevious: return "SLIDE_PREV";
    case Event::Select: return "SELECT";
    case Event::ModeMedia: return "MODE_DEFAULT";
    case Event::ModePresentation: return "MODE_PRESENTATION";
    case Event::Sleep: return "SLEEP";
  }
  return "";
}

// Inputs are logical pressed/released, independent of electrical polarity.
class DebouncedInput {
 public:
  void begin(bool initial, uint32_t now, uint32_t pressInterval, uint32_t releaseInterval = 0) {
    raw_ = stable_ = initial; changed_ = now; pressInterval_ = pressInterval;
    releaseInterval_ = releaseInterval ? releaseInterval : pressInterval;
  }
  bool update(bool raw, uint32_t now) {
    if (raw != raw_) { raw_ = raw; changed_ = now; }
    if (raw_ != stable_ && elapsed(now, changed_) >= (raw_ ? pressInterval_ : releaseInterval_)) {
      stable_ = raw_; return true;
    }
    return false;
  }
  bool pressed() const { return stable_; }
  void setPressInterval(uint32_t interval) { pressInterval_ = interval; }
 private:
  bool raw_ = false, stable_ = false;
  uint32_t changed_ = 0, pressInterval_ = 0, releaseInterval_ = 0;
};

class Controller {
 public:
  Controller(EventSink sink, void *context = nullptr) : sink_(sink), context_(context) {}
  void begin(uint32_t now, bool touch, bool button, Mode initial = Mode::Media) {
    mode_ = initial; lastActivity_ = now;
    touch_.begin(touch, now, RingConfig::TOUCH_PRESS_MS, RingConfig::TOUCH_RELEASE_MS);
    button_.begin(button, now, RingConfig::BUTTON_DEBOUNCE_MS);
    touchRaw_ = touch; touchRawChanged_ = now; touchQuietSince_ = now;
    buttonBlocked_ = button;
    blockTouch(now); buttonTaps_ = 0; sleepRequested_ = false; touchStuck_ = false;
  }
  Mode mode() const { return mode_; }
  bool buttonPressed() const { return button_.pressed(); }
  bool sleepRequested() const { return sleepRequested_; }
  bool touchStuck() const { return touchStuck_; }
  bool rawTouch() const { return touchRaw_; }
  bool touchReady() const { return !touchBlocked_ && !sleepRequested_; }
  uint32_t idleMs(uint32_t now) const { return elapsed(now, lastActivity_); }

  // Used on connection boundaries: never replay partial gestures on a new client.
  void cancelGestures(uint32_t now) {
    blockTouch(now);
    buttonTaps_ = 0; buttonBlocked_ = button_.pressed();
  }
  bool setMode(Mode value, uint32_t now) {
    if (sleepRequested_ || mode_ == value) return false;
    mode_ = value; lastActivity_ = now; cancelGestures(now);
    emit(value == Mode::Media ? Event::ModeMedia : Event::ModePresentation);
    return true;
  }
  void toggleMode(uint32_t now) {
    setMode(mode_ == Mode::Media ? Mode::Presentation : Mode::Media, now);
  }
  void requestSleep() {
    if (sleepRequested_) return;
    sleepRequested_ = true; clearTouch(); buttonTaps_ = 0; emit(Event::Sleep);
  }

  void update(uint32_t now, bool touchRaw, bool buttonRaw) {
    // Include the last HIGH sample's full duration on a falling edge. Separate
    // short HIGH bursts must never add up to a qualified intentional contact.
    if (!touchBlocked_ && touch_.pressed() && touchRaw_ &&
        elapsed(now, touchRawChanged_) >= minimumTouchTap())
      touchQualified_ = true;
    if (touchRaw != touchRaw_) {
      touchRaw_ = touchRaw; touchRawChanged_ = now;
      if (!touchRaw) touchQuietSince_ = now;
    }
    // A deliberate first tap opens a short window for faster follow-up taps.
    touch_.setPressInterval(touchTaps_ ? RingConfig::TOUCH_FAST_PRESS_MS : RingConfig::TOUCH_PRESS_MS);
    const bool touchEdge = touch_.update(touchRaw, now);
    const bool buttonEdge = button_.update(buttonRaw, now);
    if (sleepRequested_) return; // Continue debouncing so sleep can await release.

    if (buttonBlocked_) {
      if (!button_.pressed()) buttonBlocked_ = false;
    } else {
      if (buttonEdge) {
        lastActivity_ = now;
        if (button_.pressed()) {
          if (buttonTaps_ && elapsed(now, buttonReleased_) >= RingConfig::MULTITAP_GAP_MS)
            buttonTaps_ = 0;
          buttonStarted_ = now;
        } else if (elapsed(now, buttonStarted_) >= RingConfig::MIN_TAP_MS) {
          if (buttonTaps_ < 3) ++buttonTaps_;
          buttonReleased_ = now;
        }
      }
      if (button_.pressed() && elapsed(now, buttonStarted_) >= RingConfig::POWER_HOLD_MS) {
        requestSleep(); return;
      }
      if (!button_.pressed() && buttonTaps_ &&
          elapsed(now, buttonReleased_) >= RingConfig::MULTITAP_GAP_MS) {
        const uint8_t count = buttonTaps_; buttonTaps_ = 0;
        if (count == 2) toggleMode(now);
      }
    }

    if (touchBlocked_) {
      if (touchRaw) touchQuietSince_ = now;
      else if (!touch_.pressed() && elapsed(now, touchQuietSince_) >= RingConfig::TOUCH_REARM_MS) {
        touchBlocked_ = false; touchStuck_ = false;
      }
    } else {
      if (touchEdge) {
        if (touch_.pressed()) {
          if (touchTaps_ && elapsed(touchRawChanged_, touchReleased_) >= RingConfig::TOUCH_MULTITAP_GAP_MS) {
            finishTouchTaps(now);
          } else {
            touchStarted_ = touchRawChanged_; holdHandled_ = false;
            touchQualified_ = elapsed(now, touchRawChanged_) >= minimumTouchTap();
          }
        } else if (holdHandled_) {
          blockTouch(now);
        } else {
          const uint32_t duration = elapsed(touchRawChanged_, touchStarted_);
          if (touchQualified_ && duration >= minimumTouchTap() && duration <= RingConfig::MAX_TOUCH_TAP_MS) {
            if (touchTaps_ < 4) ++touchTaps_;
            touchReleased_ = touchRawChanged_; lastActivity_ = now;
          } else {
            // Ambiguous short/slow contacts cancel the whole unresolved sequence.
            blockTouch(now);
          }
        }
      }
      if (!touchBlocked_ && touch_.pressed()) {
        const uint32_t duration = elapsed(now, touchStarted_);
        if (duration >= RingConfig::MAX_TOUCH_HOLD_MS) {
          blockTouch(now); touchStuck_ = true;
        } else if (!holdHandled_ && touchRaw && elapsed(now, touchRawChanged_) >= RingConfig::TOUCH_HOLD_MS) {
          // Hold -> up/forward; one tap followed by hold -> down/back.
          holdDirection_ = touchTaps_ == 0 ? 1 : touchTaps_ == 1 ? -1 : 0;
          touchTaps_ = 0; holdHandled_ = true; holdRepeated_ = now; holdSteps_ = 0;
          if (holdDirection_) { emitHold(); lastActivity_ = now; }
        } else if (holdHandled_ && holdDirection_ && touchRaw &&
                   elapsed(now, touchRawChanged_) >= RingConfig::TOUCH_HOLD_MS &&
                   (mode_ != Mode::Media || holdSteps_ < RingConfig::MAX_VOLUME_STEPS_PER_HOLD) &&
                   elapsed(now, holdRepeated_) >= repeatInterval()) {
          emitHold(); holdRepeated_ = now; lastActivity_ = now;
        }
      } else if (!touchBlocked_ && !touch_.pressed() && !touchRaw && touchTaps_ &&
                 elapsed(now, touchReleased_) >=
                   (touchTaps_ == 3 ? RingConfig::TOUCH_TRIPLE_SETTLE_MS : RingConfig::TOUCH_MULTITAP_GAP_MS)) {
        finishTouchTaps(now);
      }
    }
    if (idleMs(now) >= RingConfig::IDLE_SLEEP_MS) requestSleep();
  }

 private:
  void emit(Event value) { if (sink_) sink_(value, context_); }
  void clearTouch() {
    touchTaps_ = 0; holdHandled_ = false; holdDirection_ = 0; holdSteps_ = 0; touchQualified_ = false;
  }
  void blockTouch(uint32_t now) {
    clearTouch(); touchBlocked_ = true; touchQuietSince_ = now;
  }
  uint32_t minimumTouchTap() const {
    return touchTaps_ ? RingConfig::MIN_FOLLOWUP_TAP_MS : RingConfig::MIN_TOUCH_TAP_MS;
  }
  uint32_t repeatInterval() const {
    return mode_ == Mode::Media ? RingConfig::MEDIA_REPEAT_MS : RingConfig::SLIDE_REPEAT_MS;
  }
  void emitHold() {
    if (mode_ == Mode::Media) {
      if (holdSteps_ >= RingConfig::MAX_VOLUME_STEPS_PER_HOLD) return;
      ++holdSteps_;
      emit(holdDirection_ > 0 ? Event::VolumeUp : Event::VolumeDown);
    }
    else emit(holdDirection_ > 0 ? Event::SlideNext : Event::SlidePrevious);
  }
  void finishTouchTaps(uint32_t now) {
    const uint8_t count = touchTaps_; touchTaps_ = 0;
    if (mode_ == Mode::Media) {
      if (count == 1) emit(Event::PlayPause);
      else if (count == 2) emit(Event::NextTrack);
      else if (count == 3) emit(Event::PreviousTrack);
    } else {
      if (count == 1) emit(Event::SlideNext);
      else if (count == 2) emit(Event::SlidePrevious);
      else if (count == 3) emit(Event::Select);
    }
    blockTouch(now);
  }
  EventSink sink_; void *context_;
  DebouncedInput touch_, button_;
  Mode mode_ = Mode::Media;
  uint32_t lastActivity_ = 0, touchStarted_ = 0, touchReleased_ = 0,
           holdRepeated_ = 0, buttonStarted_ = 0, buttonReleased_ = 0,
           touchRawChanged_ = 0, touchQuietSince_ = 0;
  uint8_t touchTaps_ = 0, buttonTaps_ = 0, holdSteps_ = 0;
  int8_t holdDirection_ = 0;
  bool touchQualified_ = false, touchRaw_ = false, touchBlocked_ = false, buttonBlocked_ = false, holdHandled_ = false,
       sleepRequested_ = false, touchStuck_ = false;
};
}
