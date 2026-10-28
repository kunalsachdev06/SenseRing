'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../theme.js'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function fixture(options={}){
 const classes=new Set(),timers=new Map(),events=[],transitions=[],animations=[],windowListeners=new Map(),mediaListeners=new Map();
 const store=new Map(options.saved?[['SenseRing.appearance',options.saved]]:[]);let timerId=0;
 const media={matches:!!options.reduced,addEventListener:(type,fn)=>mediaListeners.set(type,fn)};
 const root={dataset:{},clientWidth:1000,clientHeight:800,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})};
 const document={documentElement:root,hidden:false,dispatchEvent:event=>events.push(event)};
 if(options.native){
  document.startViewTransition=update=>{
   const done=deferred();
   const transition={ready:Promise.resolve().then(()=>{if(options.rejectReady)throw new Error('Snapshot unavailable');update();}),finished:done.promise,skipTransition:()=>done.resolve(),done};
   transitions.push(transition);return transition;
  };
  root.animate=(frames,settings)=>{
   const done=deferred(),transition=transitions.at(-1);
   const animation={frames,settings,finished:done.promise,cancel:()=>done.reject(new Error('Cancelled')),finish:()=>done.resolve()};
   animations.push(animation);done.promise.then(()=>transition.done.resolve(),()=>transition.done.resolve());
   if(!options.holdAnimation)done.resolve();return animation;
  };
 }
 const window={innerWidth:1000,innerHeight:800,matchMedia:()=>media,addEventListener:(type,fn)=>windowListeners.set(type,fn)};
 const context={document,window,localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>{if(options.storageFails)throw new Error('Storage unavailable');store.set(key,value);}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context);
 return{api:window.SenseRingAppearance,root,classes,events,transitions,animations,store,media,
  timers:()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());},
  reduce:()=>{media.matches=true;mediaListeners.get('change')({matches:true});}};
}
test('saved appearance is applied before rendering without an initial animation',async()=>{
 const h=fixture({saved:'dark',native:true});assert.equal(h.api.get(),'dark');assert.equal(h.transitions.length,0);
 assert.equal(await h.api.set('unsupported'),false);assert.equal(h.api.get(),'dark');assert.equal(h.events.length,0);
});
test('reduced motion switches immediately even when browser storage is unavailable',async()=>{
 const h=fixture({native:true,reduced:true,storageFails:true});assert.equal(await h.api.toggle(),true);
 assert.equal(h.api.get(),'dark');assert.equal(h.transitions.length,0);assert.equal(h.root.dataset.themeTransition,undefined);
 assert.equal(h.events.at(-1).detail,'dark');
});
test('native reveal changes and persists the theme, then releases transition state',async()=>{
 const h=fixture({native:true});const origin={getBoundingClientRect:()=>({left:930,top:20,width:40,height:40})};
 assert.equal(await h.api.set('dark',{origin}),true);assert.equal(h.api.get(),'dark');
 assert.equal(h.store.get('SenseRing.appearance'),'dark');assert.equal(h.animations.length,1);
 assert.equal(h.animations[0].settings.pseudoElement,'::view-transition-new(root)');
 assert.match(h.animations[0].frames.clipPath[0],/950px 40px/);
 assert.equal(h.root.dataset.themeTransition,undefined);assert.equal(h.classes.size,0);
});
test('rapid toggles before snapshot capture retain the latest requested appearance',async()=>{
 const h=fixture({native:true});const first=h.api.toggle(),second=h.api.toggle();
 await Promise.all([first,second]);assert.equal(h.api.get(),'light');assert.equal(h.root.dataset.themeTransition,undefined);
 assert.equal(h.classes.size,0);
});
test('fallback crossfade can be interrupted without a dangling promise or CSS class',async()=>{
 const h=fixture();const first=h.api.toggle(),second=h.api.toggle();h.timers();
 assert.deepEqual(await Promise.all([first,second]),[false,true]);assert.equal(h.api.get(),'light');
 assert.equal(h.classes.size,0);assert.equal(h.root.dataset.themeTransition,undefined);
});
test('a rejected snapshot still commits the requested theme and removes temporary state',async()=>{
 const h=fixture({native:true,rejectReady:true});assert.equal(await h.api.toggle(),true);
 assert.equal(h.api.get(),'dark');assert.equal(h.root.dataset.themeTransition,undefined);assert.equal(h.classes.size,0);
});
test('enabling reduced motion interrupts an active reveal without losing the selected theme',async()=>{
 const h=fixture({native:true,holdAnimation:true});const pending=h.api.toggle();await flush();
 assert.equal(h.animations.length,1);h.reduce();await pending;
 assert.equal(h.api.get(),'dark');assert.equal(h.root.dataset.themeTransition,undefined);assert.equal(h.classes.size,0);
});
