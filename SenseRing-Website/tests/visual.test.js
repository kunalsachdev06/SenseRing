'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const document = { hidden: false }, window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ring-visual.js'), 'utf8'), { document, window });
const tick = window.SenseRingVisual.prototype.tick;

function fixture(extra = {}) {
  const draws = [], scheduled = [];
  const visual = { visible: true, inViewport: true, options: {}, mesh: {}, reduced: false, drag: null,
    dirty: false, animating: false, lastFrame: 0, lastSpinTime: null, spin: 0, exploded: 0, explodedTarget: 0,
    pulseUntil: 0, gestureUntil: 0, draw: time => draws.push(time), schedule: () => scheduled.push(true), ...extra };
  return { visual, draws, scheduled, tick: time => tick.call(visual, time) };
}

test('idle dashboard does not render or request another animation frame', () => {
  const f = fixture(); f.tick(1000); f.tick(2000);
  assert.equal(f.draws.length, 0); assert.equal(f.scheduled.length, 0);
  assert.equal(f.visual.lastSpinTime, null);
});
test('a dashboard input draws on its next frame without a 33 ms throttle wait', () => {
  const f = fixture({ dirty: true, lastFrame: 995 }); f.tick(1000);
  assert.deepEqual(f.draws, [1000]); assert.equal(f.scheduled.length, 0);
  assert.equal(f.visual.dirty, false);
});
test('landing ring keeps rotating while idle, pauses for dragging, and resumes', () => {
  const f = fixture({ options: { hero: true } }); f.tick(1000); f.tick(1100);
  assert(f.visual.spin > 0); assert.equal(f.draws.length, 2); assert.equal(f.scheduled.length, 2);
  const spin = f.visual.spin; f.visual.drag = [1, 2]; f.tick(1200);
  assert.equal(f.visual.spin, spin); assert.equal(f.scheduled.length, 2);
  f.visual.drag = null; f.visual.dirty = true; f.tick(1300); f.tick(1400);
  assert(f.visual.spin > spin); assert.equal(f.draws.length, 4);
});
test('gesture highlight ends with a clearing frame and then stops', () => {
  const f = fixture({ dirty: true, pulseUntil: 1800, gestureUntil: 1650 });
  f.tick(1000); f.tick(1790); f.tick(1805);
  assert.equal(f.visual.animating, true, 'clear waits for the next eligible animation frame');
  f.tick(1830); assert.equal(f.visual.animating, false);
  const count = f.draws.length, scheduled = f.scheduled.length; f.tick(1900);
  assert.equal(f.draws.length, count); assert.equal(f.scheduled.length, scheduled);
});
test('inside-view transition reaches the exact target and releases its render loop', () => {
  const f = fixture({ dirty: true, explodedTarget: 1 });
  for (let time = 1000; time < 5000; time += 34) f.tick(time);
  assert.equal(f.visual.exploded, 1); assert.equal(f.visual.animating, false);
  const count = f.draws.length; f.tick(6000); assert.equal(f.draws.length, count);
  assert(count > 1 && count < 60);
});
test('reduced motion shows a requested update without starting decorative loops', () => {
  const f = fixture({ options: { hero: true }, reduced: true, dirty: true, pulseUntil: 1800 });
  f.tick(1000); assert.equal(f.draws.length, 1); assert.equal(f.scheduled.length, 0); assert.equal(f.visual.spin, 0);
});
test('hidden, offscreen and lost-context models do no rendering work', () => {
  for (const extra of [{ visible: false }, { inViewport: false }, { contextLost: true }, { dead: true }]) {
    const f = fixture({ dirty: true, ...extra }); f.tick(1000);
    assert.equal(f.draws.length, 0); assert.equal(f.scheduled.length, 0);
  }
});

test('hero story rotates, opens the covers and loops seamlessly', () => {
  const pose=window.SenseRingStoryPose;
  assert.equal(pose(0).exploded,0);
  assert(pose(2700).yaw>Math.PI*1.9);
  assert.equal(pose(4700).exploded,1);
  assert.equal(pose(9000).exploded,0);
  assert.deepEqual(pose(10500),pose(0));
  assert.equal(pose(4700).step,1);assert.equal(pose(7500).step,2);
  assert(Math.abs(pose(10499).yaw-Math.PI*2)<.001);
});

test('hero story pauses both rotation and opening without jumping on resume', () => {
  const f=fixture({options:{hero:true,story:true}});f.tick(1000);f.tick(1100);
  assert.equal(f.visual.storyTime,100);assert.equal(f.scheduled.length,2);
  f.visual.paused=true;f.tick(1200);
  assert.equal(f.visual.storyTime,100);assert.equal(f.scheduled.length,2);
  f.visual.paused=false;f.tick(10000);f.tick(10100);
  assert.equal(f.visual.storyTime,200);
});

test('hero story does no work offscreen or with its page hidden', () => {
  for(const extra of [{visible:false},{inViewport:false}]){
    const f=fixture({options:{story:true},...extra});f.tick(1000);
    assert.equal(f.draws.length,0);assert.equal(f.scheduled.length,0);assert.equal(f.visual.storyTime,undefined);
  }
  document.hidden=true;
  try {const f=fixture({options:{story:true}});f.tick(1000);assert.equal(f.draws.length,0);assert.equal(f.scheduled.length,0);}
  finally {document.hidden=false;}
});

test('reduced-motion hero story is a single static inside view', () => {
  const f=fixture({options:{story:true},reduced:true,dirty:true});f.tick(1000);
  assert.equal(f.draws.length,1);assert.equal(f.scheduled.length,0);assert.equal(f.visual.exploded,1);
});

test('manual Ring or Inside overrides the automatic hero sequence',()=>{
  const f=fixture({options:{hero:true,story:true},storyTime:4700,storyPose:{yaw:2,exploded:1},exploded:1,paused:true});
  window.SenseRingVisual.prototype.setExploded.call(f.visual,false);
  assert.equal(f.visual.options.story,false);assert.equal(f.visual.storyPose,null);
  for(let time=1000;time<4000;time+=34)f.tick(time);
  assert.equal(f.visual.exploded,0);
  window.SenseRingVisual.prototype.setExploded.call(f.visual,true);
  for(let time=4000;time<7000;time+=34)f.tick(time);
  assert.equal(f.visual.exploded,1);assert.equal(f.visual.options.story,false);
});

test('Auto restarts the hero sequence after a manual view',()=>{
  const f=fixture({options:{hero:true,story:false},exploded:1,spin:3,storyTime:4700});
  window.SenseRingVisual.prototype.playStory.call(f.visual);
  assert.equal(f.visual.options.story,true);assert.equal(f.visual.storyTime,0);assert.equal(f.visual.spin,0);
  f.tick(1000);assert.equal(f.visual.exploded,0);
  for(let time=1034;time<5900;time+=34)f.tick(time);
  assert.equal(f.visual.exploded,1);
});
