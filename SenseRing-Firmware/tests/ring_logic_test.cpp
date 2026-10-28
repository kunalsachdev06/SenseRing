#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
#include "../SenseRing_Touch/RingLogic.h"
using namespace SenseRing;
struct Rig {
  uint32_t now;
  bool touch = false, button = false;
  std::vector<Event> events;
  std::vector<uint32_t> eventTimes;
  Controller controller;
  static void sink(Event event, void *ptr) { auto *rig=static_cast<Rig *>(ptr);rig->events.push_back(event);rig->eventTimes.push_back(rig->now); }
  Rig(Mode mode = Mode::Media, uint32_t start = 1000, bool initialTouch = false, bool initialButton = false)
      : now(start), touch(initialTouch), button(initialButton), controller(sink, this) {
    controller.begin(now, touch, button, mode);
    advance(RingConfig::TOUCH_REARM_MS + 5);
  }
  void advance(uint32_t ms) {
    for (uint32_t i = 0; i < ms; ++i) { ++now; controller.update(now, touch, button); }
  }
  void tap(bool physicalButton = false, uint32_t duration = 220, uint32_t gap = 160) {
    bool &input = physicalButton ? button : touch;
    input = true; advance(duration); input = false; advance(gap);
  }
  void settle() { advance(900); }
  void only(Event e) const { assert(events.size() == 1 && events[0] == e); }
};
int main() {
  unsigned tests = 0;
  { Rig r; r.tap(); assert(r.events.empty()); r.settle(); r.only(Event::PlayPause); ++tests; }
  { Rig r; r.tap(); r.tap(); r.settle(); r.only(Event::NextTrack); ++tests; }
  { Rig r; for(int i=0;i<3;++i)r.tap(); r.settle(); r.only(Event::PreviousTrack); ++tests; }
  { Rig r; for(int i=0;i<4;++i)r.tap(false,220,90); r.settle(); assert(r.events.empty()); ++tests; }
  { Rig r; r.touch=true; r.advance(RingConfig::TOUCH_HOLD_MS+100); r.only(Event::VolumeUp); r.touch=false; r.settle(); r.only(Event::VolumeUp); ++tests; }
  { Rig r; r.tap(); r.touch=true; r.advance(RingConfig::TOUCH_HOLD_MS+100); r.only(Event::VolumeDown); r.touch=false; r.settle(); r.only(Event::VolumeDown); ++tests; }
  { Rig r; r.touch=true; r.advance(RingConfig::TOUCH_HOLD_MS+2*RingConfig::MEDIA_REPEAT_MS+100); assert(r.events.size()==3); for(auto e:r.events)assert(e==Event::VolumeUp); ++tests; }
  { Rig r(Mode::Presentation); r.tap(); r.settle(); r.only(Event::SlideNext); ++tests; }
  { Rig r(Mode::Presentation); r.tap(); r.tap(); r.settle(); r.only(Event::SlidePrevious); ++tests; }
  { Rig r(Mode::Presentation); for(int i=0;i<3;++i)r.tap(); r.settle(); r.only(Event::Select); ++tests; }
  { Rig r(Mode::Presentation); r.touch=true; r.advance(2100); assert(r.events.size()==2); for(auto e:r.events)assert(e==Event::SlideNext); ++tests; }
  { Rig r(Mode::Presentation); r.tap(); r.touch=true; r.advance(1300); r.only(Event::SlidePrevious); ++tests; }
  { Rig r; r.tap(true); r.settle(); assert(r.events.empty()); ++tests; }
  { Rig r; r.tap(true); r.tap(true); r.settle(); r.only(Event::ModePresentation); assert(r.controller.mode()==Mode::Presentation); ++tests; }
  { Rig r(Mode::Presentation); r.tap(true); r.tap(true); r.settle(); r.only(Event::ModeMedia); ++tests; }
  { Rig r; for(int i=0;i<3;++i)r.tap(true); r.settle(); assert(r.events.empty()); ++tests; }
  { Rig r; r.button=true; r.advance(2100); r.only(Event::Sleep); assert(r.controller.sleepRequested()); r.controller.requestSleep(); r.only(Event::Sleep); r.button=false; r.advance(100); assert(!r.controller.buttonPressed()); ++tests; }
  { Rig r; r.now += RingConfig::IDLE_SLEEP_MS; r.controller.update(r.now,false,false); r.only(Event::Sleep); ++tests; }
  { Rig r; r.advance(100); r.controller.setMode(Mode::Presentation,r.now); r.advance(10); assert(!r.controller.sleepRequested()); r.only(Event::ModePresentation); assert(!r.controller.setMode(Mode::Presentation,r.now)); r.only(Event::ModePresentation); ++tests; }
  { Rig r; r.tap(); r.controller.setMode(Mode::Presentation,r.now); r.settle(); r.only(Event::ModePresentation); ++tests; }
  { Rig r; r.touch=true; r.advance(100); r.controller.cancelGestures(r.now); r.advance(1000); r.touch=false; r.settle(); assert(r.events.empty()); r.tap();r.settle();r.only(Event::PlayPause); ++tests; }
  { Rig r; for(int i=0;i<10;++i){r.touch=true;r.advance(8);r.touch=false;r.advance(8);}r.settle();assert(r.events.empty()); ++tests; }
  { Rig r; for(int i=0;i<10;++i){r.button=true;r.advance(15);r.button=false;r.advance(15);}r.settle();assert(r.events.empty()); ++tests; }
  { Rig r; r.tap(false,30);r.settle();assert(r.events.empty()); ++tests; }
  { Rig r(Mode::Media,1000,true,false);r.advance(1200);assert(r.events.empty());r.touch=false;r.advance(450);r.tap();r.settle();r.only(Event::PlayPause); ++tests; }
  { Rig r(Mode::Media,1000,false,true);r.advance(2500);assert(r.events.empty());r.button=false;r.advance(100);r.tap(true);r.tap(true);r.settle();r.only(Event::ModePresentation); ++tests; }
  { Rig r; r.touch=true;r.advance(11000);assert(r.controller.touchStuck());auto count=r.events.size();r.advance(5000);assert(r.events.size()==count);r.now+=RingConfig::IDLE_SLEEP_MS;r.controller.update(r.now,true,false);assert(r.events.back()==Event::Sleep); ++tests; }
  { Rig r(Mode::Media,UINT32_MAX-600);r.tap();r.tap();r.settle();r.only(Event::NextTrack); ++tests; }
  { Rig r(Mode::Media,UINT32_MAX-500);r.button=true;r.advance(2100);r.only(Event::Sleep); ++tests; }
  { Rig r; r.tap();r.tap();r.touch=true;r.advance(900);r.touch=false;r.settle();assert(r.events.empty()); ++tests; }
  { Rig r; r.tap();r.settle();r.tap();r.settle();assert(r.events.size()==2);for(auto e:r.events)assert(e==Event::PlayPause); ++tests; }
  { Rig r; r.touch=true;r.advance(9000);assert(r.events.size()==5);for(auto e:r.events)assert(e==Event::VolumeUp); ++tests; }
  { Rig r; r.tap();r.touch=true;r.advance(9000);assert(r.events.size()==5);for(auto e:r.events)assert(e==Event::VolumeDown); ++tests; }
  { Rig r; r.touch=true;r.advance(3000);assert(r.events.size()==5);r.touch=false;r.advance(450);r.touch=true;r.advance(RingConfig::TOUCH_HOLD_MS+100);assert(r.events.size()==6); ++tests; }
  { Rig r; r.touch=true;for(int i=0;i<300;++i){r.now+=5;r.controller.update(r.now,r.touch,r.button);}r.touch=false;for(int i=0;i<100;++i){r.now+=5;r.controller.update(r.now,r.touch,r.button);}assert(!r.events.empty());for(auto e:r.events)assert(e==Event::VolumeUp); ++tests; }

  // New rejection cases exercise actual raw durations, not delayed release timing.
  { Rig r;r.tap(false,70);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(false,120);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(false,680);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.touch=true;r.advance(RingConfig::TOUCH_HOLD_MS-1);assert(r.events.empty());r.advance(102);r.only(Event::VolumeUp);++tests; }
  { Rig r;r.touch=true;r.advance(220);r.touch=false;r.advance(40);r.touch=true;r.advance(220);r.touch=false;r.settle();r.only(Event::PlayPause);++tests; }
  { Rig r;r.touch=true;r.advance(220);for(int i=0;i<20;++i){r.touch=false;r.advance(40);r.touch=true;r.advance(40);}r.touch=false;r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(false,220,RingConfig::TOUCH_MULTITAP_GAP_MS+5);r.only(Event::PlayPause);r.tap();r.settle();r.only(Event::PlayPause);r.tap();r.settle();assert(r.events.size()==2);++tests; }
  { Rig r;r.tap(false,220,RingConfig::TOUCH_MULTITAP_GAP_MS-10);assert(r.events.empty());r.tap();r.settle();r.only(Event::NextTrack);++tests; }
  { Rig r;r.tap(false,180);r.settle();r.only(Event::PlayPause);++tests; }
  { Rig r;r.tap(false,650);r.settle();r.only(Event::PlayPause);++tests; }
  { Rig r;r.tap(false,651);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(false,139);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap();r.tap(false,69);r.settle();assert(r.events.empty());++tests; }
  { Rig r(Mode::Media,UINT32_MAX-600);r.touch=true;r.advance(RingConfig::TOUCH_HOLD_MS+100);r.only(Event::VolumeUp);++tests; }
  { Rig r;r.controller.cancelGestures(r.now);assert(!r.controller.touchReady());r.touch=true;r.advance(2000);assert(r.events.empty());r.touch=false;r.advance(450);assert(r.controller.touchReady());r.tap();r.settle();r.only(Event::PlayPause);++tests; }
  { Rig r;r.touch=true;r.advance(130);r.touch=false;r.advance(40);r.touch=true;r.advance(130);r.touch=false;r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(true,110,110);r.tap(true,110,110);r.settle();r.only(Event::ModePresentation);++tests; }
  {
    uint32_t seed = 0x2468ABCD;
    for (unsigned trial = 0; trial < 200; ++trial) {
      Rig r;
      for (unsigned pulse = 0; pulse < 20; ++pulse) {
        seed = seed * 1664525U + 1013904223U;
        r.touch = true; r.advance(1 + seed % 139);
        seed = seed * 1664525U + 1013904223U;
        r.touch = false; r.advance(1 + seed % 150);
      }
      r.settle(); assert(r.events.empty());
    }
    ++tests;
  }
  { Rig r;r.tap(false,220,90);r.tap(false,90,90);r.tap(false,90,90);r.settle();r.only(Event::PreviousTrack);++tests; }
  { Rig r;r.tap(false,180,65);r.tap(false,80,65);r.tap(false,80,65);r.settle();r.only(Event::PreviousTrack);++tests; }
  { Rig r;r.tap(false,90,90);r.tap(false,90,90);r.tap(false,90,90);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(false,220,90);r.tap(false,80,90);r.settle();r.only(Event::NextTrack);++tests; }
  { Rig r(Mode::Presentation);r.tap(false,220,90);r.tap(false,90,90);r.tap(false,90,90);r.settle();r.only(Event::Select);++tests; }
  { Rig r;r.tap(false,220,90);r.tap(false,90,90);r.tap(false,90,90);r.advance(RingConfig::TOUCH_TRIPLE_SETTLE_MS-90);assert(r.events.empty());r.advance(5);r.only(Event::PreviousTrack);++tests; }
  { Rig r;r.tap(false,220,90);for(int i=0;i<3;++i)r.tap(false,90,90);r.settle();assert(r.events.empty());++tests; }
  { Rig r;r.tap(false,220,0);const uint32_t released=r.now+1;r.advance(250);assert(r.events.empty());r.advance(1);r.only(Event::PlayPause);assert(elapsed(r.eventTimes.back(),released)==250);++tests; }
  { Rig r;r.tap(false,220,90);r.tap(false,90,0);const uint32_t released=r.now+1;r.advance(250);assert(r.events.empty());r.advance(1);r.only(Event::NextTrack);assert(elapsed(r.eventTimes.back(),released)==250);++tests; }
  { Rig r;r.tap(false,220,90);r.tap(false,90,90);r.tap(false,90,0);const uint32_t released=r.now+1;r.advance(120);assert(r.events.empty());r.advance(1);r.only(Event::PreviousTrack);assert(elapsed(r.eventTimes.back(),released)==120);++tests; }
  { Rig r;const uint32_t pressed=r.now+1;r.touch=true;r.advance(700);assert(r.events.empty());r.advance(1);r.only(Event::VolumeUp);assert(elapsed(r.eventTimes.back(),pressed)==700);++tests; }
  { Rig r;r.tap(false,140);r.settle();r.only(Event::PlayPause);++tests; }
  { Rig r;r.tap(false,160);r.settle();r.only(Event::PlayPause);++tests; }
  { Rig r;r.tap(false,140,90);r.tap(false,70,90);r.settle();r.only(Event::NextTrack);++tests; }
  { Rig r;r.tap(false,140,90);r.tap(false,70,90);r.tap(false,70,90);r.settle();r.only(Event::PreviousTrack);++tests; }
  std::cout << tests << " gesture/power logic scenarios passed\n";
}
