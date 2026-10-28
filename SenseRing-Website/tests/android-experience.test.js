'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../android-experience.js'),'utf8');
function fixture(reduced=false){
  const listeners={},windowListeners={},instances=[];
  const element=()=>({dataset:{},style:{setProperty(){}},setAttribute(){},addEventListener(name,callback){this[name]=callback;}});
  const section=element(),stage=element(),toggle=element(),replay=element(),title=element(),detail=element(),index=element(),cinema=element();
  section.querySelector=selector=>selector==='.android-cinema'?cinema:index;
  const elements={'android':section,'android-ring-stage':stage,'android-motion-toggle':toggle,'android-motion-replay':replay,'android-story-title':title,'android-story-detail':detail};
  const document={hidden:false,getElementById:id=>elements[id],addEventListener:(name,cb)=>listeners[name]=cb,removeEventListener:name=>delete listeners[name]};
  const motion={matches:reduced,addEventListener(){},removeEventListener(){}};
  let observe,disconnected=false;
  class Observer{constructor(callback){observe=callback;}observe(){}disconnect(){disconnected=true;}}
  class Visual{constructor(){this.canvas={};instances.push(this);}setVisible(value){this.visible=value;}setPlayback(value){this.playing=value;}replay(){this.replayed=true;}destroy(){this.dead=true;}}
  const window={SenseRingVisual:Visual,addEventListener:(name,cb)=>windowListeners[name]=cb};
  vm.runInNewContext(source,{document,window,matchMedia:()=>motion,IntersectionObserver:Observer});
  return{section,toggle,replay,instances,document,window,enter:()=>observe([{isIntersecting:true}]),leave:()=>observe([{isIntersecting:false}]),visibility:()=>listeners.visibilitychange(),close:()=>windowListeners.pagehide(),isDisconnected:()=>disconnected};
}
test('the phone preview never constructs a second 3D ring',()=>{
  const f=fixture();assert.equal(f.instances.length,0);
  f.enter();assert.equal(f.instances.length,0);assert.equal(f.section.dataset.playing,'true');
  f.leave();assert.equal(f.section.dataset.playing,'false');
  f.enter();assert.equal(f.instances.length,0);
});
test('a hidden browser tab or dashboard stops the phone preview',()=>{
  const f=fixture();f.enter();f.document.hidden=true;f.visibility();assert.equal(f.section.dataset.playing,'false');
  f.document.hidden=false;f.visibility();assert.equal(f.section.dataset.playing,'true');
  f.window.SenseRingAndroidExperience.setVisible(false);assert.equal(f.section.dataset.playing,'false');
});
test('phone pause and reduced motion have explicit states',()=>{
  const f=fixture();f.enter();f.toggle.click();assert.equal(f.section.dataset.playing,'false');
  f.toggle.click();assert.equal(f.section.dataset.playing,'true');
  const reduced=fixture(true);reduced.enter();assert.equal(reduced.toggle.disabled,true);assert.equal(reduced.section.dataset.playing,'false');
});
test('leaving the page disconnects the observer and stops phone motion',()=>{
  const f=fixture();f.enter();f.close();assert.equal(f.isDisconnected(),true);assert.equal(f.section.dataset.playing,'false');
  f.enter();assert.equal(f.instances.length,0);assert.equal(f.section.dataset.playing,'false');
});
