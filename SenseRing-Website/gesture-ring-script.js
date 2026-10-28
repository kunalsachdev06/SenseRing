/* SenseRing interface. */
(function () {
'use strict';
function initialize() {
const $ = id => document.getElementById(id), Core = window.SenseRingCore, Companion = window.SenseRingCompanion;
if (!Core||!window.SenseRingState||!Companion) return;
const COMMAND_ICONS = {
    VOL_UP:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
    VOL_DOWN:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
    PLAY_PAUSE:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
    NEXT:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>',
    PREV:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>',
    SELECT:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    SLIDE_NEXT:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>',
    SLIDE_PREV:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>',
    MODE_DEFAULT:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="3"></circle></svg>',
    MODE_PRESENTATION:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
    SCROLL_UP:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="16 12 12 8 8 12"></polyline><line x1="12" y1="16" x2="12" y2="8"></line></svg>',
    SCROLL_DOWN:'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="8 12 12 16 16 12"></polyline><line x1="12" y1="8" x2="12" y2="16"></line></svg>'
};
let profileStorage=null;try{profileStorage=localStorage;}catch(_){}
const profiles=new window.SenseRingState.ProfileStore(profileStorage);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {section:'landing',view:'live',controlsEnabled:true,commandAborts:new Set(),mode:'media',modePending:false,connection:'disconnected',mappings:loadMappings(),activity:[],nextId:1,session:0,actionEpoch:0,sleepRequested:false,userDisconnect:false,commandDepth:0,bridge:{state:'checking',ready:false,token:'',health:null,epoch:0},bridgeChecking:false,bridgeAttempt:0,setupRetrying:false};
// Gesture notifications drive the live path. Read diagnostics on connect/mode
// confirmation, rather than continuously competing with notifications over BLE.
const ring = new Core.RingConnection({pollMs:0,onEvent:handleRingEvent}); ring.setMappings(state.mappings);
const local = ['localhost','127.0.0.1'].includes(location.hostname) && location.port === '3199';
const bridgeBase = local ? location.origin : 'http://127.0.0.1:3199';
let pageActive=true,heroVisual=null,heroPaused=false;
const heroMotion=matchMedia('(prefers-reduced-motion: reduce)');
const text=(id,value)=>{if($(id)) $(id).textContent=value;};
const on=(id,event,fn)=>{if($(id)) $(id).addEventListener(event,fn);};
const clone=value=>JSON.parse(JSON.stringify(value));
function loadMappings(){return profiles.active().mappings;}
function saveMappings(){invalidateActions();profiles.save(state.mappings);if(!profiles.lastSaveSucceeded)toast('Changes stay in this session.');ring.setMappings(state.mappings);renderProfiles();}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>{el.hidden=true;},4500);}
function humanError(error){
 if(error&&error.name==='NotFoundError')return 'No ring selected.';
 if(error&&['NotAllowedError','SecurityError'].includes(error.name))return 'Allow Bluetooth to connect.';
 if(error&&error.name==='NetworkError')return 'Connection lost. Try again.';
 return 'Couldn’t complete that action. Try again.';
}
function setPill(id,label,kind){const el=$(id);if(!el)return;el.textContent=label;['connected','connecting','disconnected','muted','error'].forEach(value=>el.classList.remove(value));if(kind)el.classList.add(kind);}
function updateVisualVisibility(){
 document.documentElement.classList.toggle('page-hidden',document.hidden);
 const landing=state.section==='landing';
 if(heroVisual)heroVisual.setVisible(landing&&!document.hidden);
 if(window.SenseRingAndroidExperience)window.SenseRingAndroidExperience.setVisible(landing&&!document.hidden);
}
function switchSection(section){
 clearTimeout(state.sectionTimer);closeDropdowns();
 const previous=$(state.section==='landing'?'landing-page':'main-interface');if(previous){previous.classList.remove('active');previous.inert=true;previous.setAttribute('aria-hidden','true');}
 state.section=section;updateVisualVisibility();
 state.sectionTimer=setTimeout(()=>{
  for(const id of ['landing-page','main-interface']){const el=$(id),active=id===(section==='landing'?'landing-page':'main-interface');if(el){el.hidden=!active;el.inert=!active;el.setAttribute('aria-hidden',String(!active));el.classList.toggle('active',active);if(active)el.scrollTop=0;}}
  updateVisualVisibility();updateNavMarker();const skip=document.querySelector('.skip-link');if(skip)skip.href=section==='main'?'#main-interface':'#main-content';
  const focusTarget=section==='main'?document.querySelector('.nav-tab.active'):document.querySelector('.hero-actions .button.primary');if(focusTarget)focusTarget.focus({preventScroll:true});
 },reduced?0:220);
}
function enterExperience(){switchSection('main');switchView('live');}
function backToLanding(){switchSection('landing');}
function switchView(view){
 if(!['live','mapping'].includes(view)||!$(view+'-view'))return;
 state.view=view;closeDropdowns();
 document.querySelectorAll('#main-interface .app-shell > .view').forEach(el=>{const active=el.id===view+'-view';el.classList.toggle('active',active);el.hidden=!active;el.inert=!active;el.setAttribute('aria-hidden',String(!active));});
 document.querySelectorAll('.nav-tab[data-view]').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;});
 if($('main-interface'))$('main-interface').scrollTop=0;updateVisualVisibility();updateNavMarker();shrinkNav();
}
document.querySelectorAll('.nav-tab[data-view]').forEach(el=>el.addEventListener('click',()=>switchView(el.dataset.view)));
const topNav=document.querySelector('.top-nav');
const navigation=document.querySelector('.nav-tabs');
if(navigation)navigation.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!event.target.matches('.nav-tab'))return;
 const tabs=Array.from(navigation.querySelectorAll('.nav-tab:not(:disabled)')),current=tabs.indexOf(event.target);
 if(current<0)return;
 event.preventDefault();
 const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 switchView(tabs[index].dataset.view);tabs[index].focus({preventScroll:true});
});
function updateNavMarker(){
 const active=navigation&&navigation.querySelector('.nav-tab.active');
 if(!active||!active.offsetWidth)return;
 navigation.style.setProperty('--nav-pill-x',active.offsetLeft+'px');
 navigation.style.setProperty('--nav-pill-width',active.offsetWidth+'px');
 navigation.style.setProperty('--nav-pill-y',active.offsetTop+'px');
 navigation.style.setProperty('--nav-pill-height',active.offsetHeight+'px');
 navigation.style.setProperty('--nav-pill-ready','1');
}
const navResize=navigation?new ResizeObserver(updateNavMarker):null;if(navResize)navResize.observe(navigation);
window.addEventListener('resize',updateNavMarker,{passive:true});
function shrinkNav(){
 if(!topNav)return;
 const position=$('main-interface')?$('main-interface').scrollTop:0,compact=topNav.classList.contains('shrink');
 if(position>64&&!compact)topNav.classList.add('shrink');else if(position<24&&compact)topNav.classList.remove('shrink');
}
if($('main-interface'))$('main-interface').addEventListener('scroll',shrinkNav,{passive:true});
function renderMode(){
 document.querySelectorAll('.live-mode-btn[data-context]').forEach(el=>{const active=el.dataset.context===state.mode;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));el.disabled=state.modePending||state.connection==='connecting';});
 text('current-mode',state.mode==='presentation'?'Presentation':'Music');
 text('mode-sync',state.modePending?'Switching…':state.connection==='connected'?'Connected':'Preview');
 renderOutputState();renderLiveMappings();renderTester();
}
async function switchContext(desired){
 if(!['media','presentation'].includes(desired)||state.modePending||state.connection==='connecting')return;
 if(state.connection!=='connected'){if(state.mode!==desired)invalidateActions();state.mode=desired;renderMode();return;}
 invalidateActions();state.modePending=true;renderMode();
 try{await ring.setMode(desired);state.mode=ring.mode;}catch(error){toast('Couldn’t change mode.');}finally{state.modePending=false;renderMode();}
}
document.querySelectorAll('.live-mode-btn[data-context]').forEach(el=>el.addEventListener('click',()=>switchContext(el.dataset.context)));
function closeDropdowns(except){
 document.querySelectorAll('.custom-dropdown').forEach(wrapper=>{if(wrapper===except)return;wrapper.classList.remove('open');const list=wrapper.querySelector('.custom-dropdown-options');if(list)list.classList.remove('show');const trigger=wrapper.querySelector('.custom-dropdown-value');if(trigger)trigger.setAttribute('aria-expanded','false');const row=wrapper.closest('.map-editor-row');if(row)row.style.zIndex='';});
}
document.addEventListener('click',event=>{if(!event.target.closest('.custom-dropdown'))closeDropdowns();});
function renderGestureMapEditor(){
 for(const mode of ['media','presentation']){
 const container=$('map-editor-'+mode);if(!container)continue;container.replaceChildren();
 for(const input of Core.INPUTS[mode]){
  const row=document.createElement('div');row.className='map-editor-row';
  const label=document.createElement('span');label.className='map-editor-label';label.textContent=input.label;label.id='map-label-'+mode+'-'+input.id;
  const wrapper=document.createElement('div');wrapper.className='custom-dropdown';
  wrapper.addEventListener('focusout',event=>{if(!wrapper.contains(event.relatedTarget))closeDropdowns();});
  const trigger=document.createElement('div');trigger.className='custom-dropdown-value';trigger.tabIndex=0;trigger.id='map-'+mode+'-'+input.id;trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-labelledby',label.id);
  const selected=document.createElement('span');selected.textContent=Core.ACTIONS[state.mappings[mode][input.id]].label;
  const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';trigger.append(selected,arrow);
  const list=document.createElement('div');list.className='custom-dropdown-options';list.id=trigger.id+'-options';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',label.id);trigger.setAttribute('aria-controls',list.id);
  const options=[];
  function choose(action){
   state.mappings[mode][input.id]=action;selected.textContent=Core.ACTIONS[action].label;
   options.forEach(option=>{const active=option.dataset.action===action;option.classList.toggle('selected',active);option.setAttribute('aria-selected',String(active));});
   closeDropdowns();saveMappings();renderLiveMappings();renderTester();trigger.focus();reportProfileChange(input.label+' → '+Core.ACTIONS[action].label);
  }
  function open(){closeDropdowns(wrapper);wrapper.classList.add('open');list.classList.add('show');trigger.setAttribute('aria-expanded','true');row.style.zIndex='1000';}
  for(const action of Core.ACTION_ORDER){
   const option=document.createElement('div');option.className='custom-dropdown-option';option.tabIndex=-1;option.dataset.action=action;option.textContent=Core.ACTIONS[action].label;option.setAttribute('role','option');
   const active=state.mappings[mode][input.id]===action;option.classList.toggle('selected',active);option.setAttribute('aria-selected',String(active));
   option.addEventListener('click',event=>{event.stopPropagation();choose(action);});
   option.addEventListener('keydown',event=>{
    if(['Enter',' '].includes(event.key)){event.preventDefault();choose(action);}
    if(event.key==='Escape'){closeDropdowns();trigger.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();let index=options.indexOf(option);index=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[index].focus();}
   });
   options.push(option);list.append(option);
  }
  trigger.addEventListener('click',event=>{event.stopPropagation();if(wrapper.classList.contains('open'))closeDropdowns();else open();});
  trigger.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();(options.find(option=>option.dataset.action===state.mappings[mode][input.id])||options[0]).focus();}else if(event.key==='Escape')closeDropdowns();});
  wrapper.append(trigger,list);row.append(label,wrapper);container.append(row);
 }
 }
}
function resetGestureMap(){state.mappings=clone(Core.DEFAULT_MAPPINGS);saveMappings();renderGestureMapEditor();renderLiveMappings();renderTester();reportProfileChange('Mappings reset.');}
function mappingBadge(input,mode){
 const badge=document.createElement('div');badge.className='live-badge';
 const inputLabel=document.createElement('span');inputLabel.className='live-badge-input';inputLabel.textContent=input.label;
 const arrow=document.createElement('span');arrow.className='live-badge-arrow';arrow.textContent='→';
 const action=document.createElement('span');action.className='live-badge-action';action.textContent=Core.ACTIONS[state.mappings[mode][input.id]].label;
 badge.append(inputLabel,arrow,action);return badge;
}
function renderLiveMappings(){
 const live=$('live-mapping-badges');if(live){live.replaceChildren();Core.INPUTS[state.mode].forEach(input=>live.append(mappingBadge(input,state.mode)));}
}
const handSvg='<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M14 11V4a2 2 0 0 0-4 0v9"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M10 13H8a3 3 0 0 0-3 3v2a8 8 0 0 0 16 0v-5a3 3 0 0 0-3-3h-4"/></svg><div class="sim-tip"></div>';
function renderTester(){
 const target=document.querySelector('.gesture-simulator .gesture-buttons');if(!target)return;target.replaceChildren();
 for(const input of Core.INPUTS[state.mode]){
  const button=document.createElement('button');button.className='gesture-btn';button.type='button';button.dataset.input=input.id;
  const animationClass=['touch-hold','tap-hold'].includes(input.id)?'long-press':input.id==='slide-forward'?'tap-single':input.id==='slide-back'?'tap-double':input.id==='select'?'tap-triple':input.id;
  const illustration=document.createElement('div');illustration.className='gesture-sim '+animationClass;illustration.setAttribute('aria-hidden','true');
  const hand=document.createElement('div');hand.className='sim-hand';hand.innerHTML=handSvg;illustration.append(hand);
  const label=document.createElement('span');label.textContent=input.label;
  button.append(illustration,label);button.addEventListener('click',()=>testGesture(input.id));target.append(button);
 }
}
function testGesture(inputId){const input=Core.INPUTS[state.mode].find(item=>item.id===inputId);if(input)handleAction({mode:state.mode,input:input.id,label:input.label,action:state.mappings[state.mode][input.id],token:input.token},'preview');}

function renderConnection(){
 const connected=state.connection==='connected',connecting=state.connection==='connecting';
 setPill('ble-connection-status',connected?'Connected':connecting?'Connecting…':'Disconnected',connected?'connected':connecting?'connecting':'disconnected');
 if($('ble-connection-status'))$('ble-connection-status').hidden=connected;
 if($('ring-battery-indicator'))$('ring-battery-indicator').hidden=!connected;
 const button=$('connect-ring-btn');if(button){let label=button.querySelector('.connection-button-label');if(!label){label=document.createElement('span');label.className='connection-button-label';button.replaceChildren(label);}label.textContent=connected?'Disconnect ring':connecting?'Connecting…':'Connect ring';button.disabled=connecting||!navigator.bluetooth||!window.isSecureContext;}
 if($('sleep-ring-btn'))$('sleep-ring-btn').disabled=!connected||state.sleepRequested;
 renderMode();
}
async function handleConnect(){
 if(state.connection==='connecting')return;
 if($('connection-error'))$('connection-error').hidden=true;state.sleepRequested=false;
 if(state.connection==='connected'){state.userDisconnect=true;ring.disconnect('user');return;}
 state.userDisconnect=false;
 try{await ring.connect();}catch(error){const message=humanError(error);text('connection-error',message);if($('connection-error'))$('connection-error').hidden=false;if(state.connection==='connecting'){state.connection='disconnected';renderConnection();}showCinematic('error',message);}
}
on('connect-ring-btn','click',function(event){
 if(!reduced){const ripple=document.createElement('span'),rect=this.getBoundingClientRect(),size=Math.max(rect.width,rect.height);ripple.className='ripple';ripple.style.width=ripple.style.height=size+'px';ripple.style.left=(event.clientX-rect.left-size/2)+'px';ripple.style.top=(event.clientY-rect.top-size/2)+'px';this.append(ripple);setTimeout(()=>ripple.remove(),600);}
 handleConnect();
});
on('sleep-ring-btn','click',async()=>{
 if(state.connection!=='connected'||state.sleepRequested)return;
 state.sleepRequested=true;invalidateActions();
 if($('sleep-ring-btn'))$('sleep-ring-btn').disabled=true;
 addActivity('Sleep','Requested','Ring','pending');
 try{await ring.sleep();}
 catch(error){state.sleepRequested=false;if($('sleep-ring-btn'))$('sleep-ring-btn').disabled=!ring.connected;toast('Couldn’t put ring to sleep.');}
});
function handleRingEvent(event){
 if(event.type==='connection'){
  state.connection=event.state;
  if(event.state==='connecting'){state.session++;invalidateActions();renderConnection();showCinematic('connecting');}
  else if(event.state==='connected'){state.mode=ring.mode||state.mode;renderConnection();addActivity('Ring connected','Connected','Ring','delivered');showCinematic('connected');text('announcer','Ring connected.');}
  else{
   state.session++;invalidateActions();state.modePending=false;
   renderConnection();addActivity('Ring disconnected','Disconnected','Ring','offline');showCinematic(event.reason==='failed'?'error':'disconnected');state.sleepRequested=false;
  }
 }else if(event.type==='mode'){
  const changed=state.mode!==event.mode;if(changed)invalidateActions();state.mode=event.mode;renderMode();
  if(changed){addActivity(event.mode==='media'?'Music mode':'Presentation mode','Mode changed','Ring','delivered');text('announcer',event.mode==='media'?'Music mode':'Presentation mode');}
 }else if(event.type==='action')handleAction(event,'ring');
 else if(event.type==='error'&&event.scope!=='status'&&event.operation!=='status')toast(humanError(event.error));
}
const activityRows=new Map(),activityTime=new Intl.DateTimeFormat([],{hour:'2-digit',minute:'2-digit'});
let activityEmpty=null;
function addActivity(title,detail,source,status,render=true){
 const time=new Date(),record={id:state.nextId++,title,detail,source,status,time,timeLabel:activityTime.format(time)};
 state.activity.unshift(record);if(state.activity.length>10)state.activity.length=10;if(render)renderActivity();return record;
}
function renderActivity(){
 const target=$('timeline-items');if(!target)return;
 if(!state.activity.length){
  if(!activityEmpty){activityRows.clear();activityEmpty=document.createElement('div');activityEmpty.className='timeline-item';activityEmpty.textContent='No activity yet.';target.replaceChildren(activityEmpty);}
  return;
 }
 if(activityEmpty){activityEmpty.remove();activityEmpty=null;}
 const retained=new Set(state.activity.map(record=>record.id));
 for(const [id,row] of activityRows)if(!retained.has(id)){row.item.remove();activityRows.delete(id);}
 for(const [index,record] of state.activity.entries()){
  let row=activityRows.get(record.id);
  if(!row){
   const item=document.createElement('div');item.className='timeline-item';item.dataset.activityId=String(record.id);
   const time=document.createElement('span');time.className='timeline-time';time.textContent=record.timeLabel;
   const content=document.createElement('span');content.className='timeline-content';item.append(time,content);
   row={item,content};activityRows.set(record.id,row);
  }
  const pieces=[record.title];if(record.source==='Preview')pieces.push('Preview');
  const short=record.detail.split(' · ')[0];if(short&&!pieces.includes(short)&&!record.title.toLowerCase().includes(short.toLowerCase()))pieces.push(short);
  const label=pieces.join(' · ');if(row.content.textContent!==label)row.content.textContent=label;
  if(target.children[index]!==row.item)target.insertBefore(row.item,target.children[index]||null);
 }
}
function handleAction(event,source){
 const actionId=typeof event.action==='string'?event.action:event.action&&event.action.id,action=Core.ACTIONS[actionId];if(!action)return;
 const mode=event.mode||state.mode,inputId=typeof event.input==='string'?event.input:event.input&&event.input.id;
 const input=Core.INPUTS[mode]&&Core.INPUTS[mode].find(item=>item.id===inputId),inputLabel=event.label||input&&input.label||'Ring input';
 const send=source==='ring'||!!($('tester-system-output')&&$('tester-system-output').checked);
 const stale=source==='ring'&&(state.modePending||mode!==state.mode);
 const canDeliver=send&&state.controlsEnabled&&!stale&&!state.sleepRequested&&(source!=='ring'||state.connection==='connected')&&state.bridge.ready;
 const detail=!state.controlsEnabled?'Controls paused':source==='preview'&&!send?'Preview':stale||state.sleepRequested?'Not sent':canDeliver?'Sending…':Companion.message(state.bridge.state).chip;
 const record=addActivity(inputLabel+' → '+action.label,detail+' · '+(mode==='media'?'Media':'Presentation'),source==='ring'?'Ring':'Preview',canDeliver?'pending':'preview',false);
 // Original command-first flow: dispatch the mapped action before any DOM or
 // model work. The companion owns execution ordering; HTTP replies don't gate
 // the next notification in the browser.
 if(canDeliver)deliver(action.bridgeCommand||actionId,record,source,action.label);
 text('current-gesture',inputLabel);text('current-action',action.label);
 const card=$('response-display');
 if(card){
  const icon=card.querySelector('.response-icon'),title=card.querySelector('.response-text');if(icon)icon.innerHTML=COMMAND_ICONS[actionId]||COMMAND_ICONS.SELECT;if(title)title.textContent=action.label;
  card.classList.add('active');if(!reduced){card.style.transform='translateY(-1px)';card.style.boxShadow='0 0 0 3px var(--accent-soft)';}
  clearTimeout(state.cardTimer);state.cardTimer=setTimeout(()=>{card.style.transform='';card.style.boxShadow='';card.classList.remove('active');},reduced?900:350);
 }
 text('action-detail',detail);
 renderActivity();
 clearTimeout(state.gestureTimer);state.gestureTimer=setTimeout(()=>{text('current-gesture','Idle');},3000);
}
function showCinematic(stage,detail){
 const overlay=$('connection-overlay');if(!overlay)return;clearTimeout(state.overlayTimer);overlay.setAttribute('aria-hidden','false');overlay.classList.remove('error','success','calibrating','disconnecting');overlay.classList.add('active');
 document.querySelectorAll('#sync-console p').forEach(el=>el.classList.add('hidden'));const core=overlay.querySelector('.sync-core');if(core)core.classList.remove('burst');
 function log(id,message){text(id,message);if($(id))$(id).classList.remove('hidden');}
 if(stage==='connecting'){text('sync-title','Connecting');log('sync-log-0','SenseRing');return;}
 if(stage==='connected'){text('sync-title','Connected');overlay.classList.add('success');if(core)core.classList.add('burst');log('sync-log-3','Ready');}
 else if(stage==='error'){text('sync-title','Couldn’t connect');overlay.classList.add('error');log('sync-log-error',detail||'Try again.');}
 else{text('sync-title','Disconnected');overlay.classList.add('disconnecting');log('sync-log-disconnect-3','Offline');}
 state.overlayTimer=setTimeout(()=>{overlay.classList.remove('active','error','success','disconnecting');overlay.setAttribute('aria-hidden','true');if(core)core.classList.remove('burst');},reduced?350:stage==='connected'?1200:1900);
}

async function timedFetch(url,options,timeoutMs){
 const abort=new AbortController(),upstream=options&&options.signal,onAbort=()=>abort.abort();
 if(upstream){if(upstream.aborted)abort.abort();else upstream.addEventListener('abort',onAbort,{once:true});}
 const timeout=setTimeout(()=>abort.abort(),timeoutMs);
 try{return await fetch(url,Object.assign({},options,{signal:abort.signal,cache:'no-store',targetAddressSpace:'loopback'}));}
 finally{clearTimeout(timeout);if(upstream)upstream.removeEventListener('abort',onAbort);}
}
function bridgeUnavailable(){
 if(state.bridge.ready)invalidateActions();
 state.bridge.state='missing';state.bridge.ready=false;state.bridge.token='';state.bridge.health=null;state.bridge.epoch++;clearTimeout(state.bridgeTimer);state.bridgeTimer=null;
 renderOutputState();
 if($('tester-system-output')){$('tester-system-output').checked=false;$('tester-system-output').disabled=true;}
}
function scheduleBridgeCheck(){
 clearTimeout(state.bridgeTimer);state.bridgeTimer=null;
 if(pageActive&&!document.hidden)state.bridgeTimer=setTimeout(checkBridge,state.bridge.state==='starting'?700:5000);
}
async function checkBridge(){
 if(!pageActive||state.bridgeChecking||document.hidden)return;
 clearTimeout(state.bridgeTimer);state.bridgeTimer=null;state.bridgeChecking=true;renderSetup();const attempt=++state.bridgeAttempt;
 try{
  const response=await timedFetch(bridgeBase+'/health',{},2400);if(!response.ok)throw new Error('No companion health response.');
  const connection=Companion.normalizeHealth(await response.json());
  if(!pageActive||attempt!==state.bridgeAttempt)return;
  if(state.bridge.token!==connection.token||state.bridge.state!==connection.state){state.bridge.epoch++;if(state.bridge.ready)invalidateActions();}
  Object.assign(state.bridge,connection);
  renderOutputState();
  if($('tester-system-output')){$('tester-system-output').disabled=!connection.ready;if(!connection.ready)$('tester-system-output').checked=false;}
 }catch(_){
  if(attempt===state.bridgeAttempt)bridgeUnavailable();
 }finally{state.bridgeChecking=false;renderSetup();scheduleBridgeCheck();}
}
function renderSetup(){
 const message=Companion.message(state.bridge.state);
 text('setup-status-title',message.title);text('setup-status-detail',state.bridge.ready&&state.connection==='connected'?'Your ring and laptop are connected. Keep this page open and focus the app you want to control.':message.detail);
 if($('setup-connection'))$('setup-connection').dataset.state=state.bridge.state;
 if($('setup-browser-note'))$('setup-browser-note').hidden=!!(window.isSecureContext&&navigator.bluetooth);
 const retry=$('setup-retry-btn');if(retry){retry.disabled=state.bridgeChecking||state.setupRetrying;retry.textContent=state.setupRetrying?'Retrying…':'Retry connection';}
}
function openSetup(){closeDropdowns();renderSetup();if($('setup-dialog')&&!$('setup-dialog').open)$('setup-dialog').showModal();}
document.querySelectorAll('[data-open-setup]').forEach(button=>button.addEventListener('click',openSetup));
on('setup-close-btn','click',()=>$('setup-dialog').close());
on('setup-dashboard-btn','click',()=>{$('setup-dialog').close();enterExperience();});
on('setup-retry-btn','click',async()=>{
 if(state.bridgeChecking||state.setupRetrying)return;
 state.setupRetrying=true;renderSetup();
 try{
  if(state.bridge.state==='unavailable'&&state.bridge.token){
   const response=await timedFetch(bridgeBase+'/prepare',{method:'POST',headers:{'Content-Type':'application/json','X-SenseRing-Token':state.bridge.token},body:'{}'},2400);
   if(!response.ok)toast(response.status===429?'Wait a moment, then retry connection.':'Couldn’t prepare controls. Reopen your companion and retry.');
  }
  await checkBridge();
 }catch(_){bridgeUnavailable();}
 finally{state.setupRetrying=false;renderSetup();}
});
on('tester-system-output','change',function(){toast(this.checked?'Laptop control on.':'Preview only.');});
async function deliver(command,record,source,label){
 if(state.commandDepth>=8){record.status='failed';record.detail='Not sent';renderActivity();return;}
 const epoch=state.bridge.epoch,session=state.session,actionEpoch=state.actionEpoch;state.commandDepth++;
 let requestAbort=null;
  try{
   if(!state.controlsEnabled||!state.bridge.ready||epoch!==state.bridge.epoch||actionEpoch!==state.actionEpoch||state.modePending||state.sleepRequested||source==='ring'&&(session!==state.session||!ring.connected))throw new Error('Connection or mode changed before delivery.');
   requestAbort=new AbortController();state.commandAborts.add(requestAbort);
   const response=await timedFetch(bridgeBase+'/command',{signal:requestAbort.signal,method:'POST',headers:{'Content-Type':'application/json','X-SenseRing-Token':state.bridge.token},body:JSON.stringify({command})},15000);
   const result=await response.json().catch(()=>({}));if(!response.ok||result.ok!==true)throw new Error(result.error||'The companion did not confirm delivery.');
   if(actionEpoch!==state.actionEpoch)throw new Error('Delivery unconfirmed');
   record.status='delivered';record.detail='Sent';if(state.activity[0]===record)text('action-detail',record.detail);
  }catch(error){record.status='failed';record.detail='Unconfirmed';if(state.activity[0]===record)text('action-detail','Unconfirmed');checkBridge();}
  finally{if(requestAbort)state.commandAborts.delete(requestAbort);state.commandDepth--;renderActivity();}
}
on('clear-activity-btn','click',()=>{state.activity=[];renderActivity();});
if(!window.isSecureContext||!navigator.bluetooth){
 if($('capability-notice'))$('capability-notice').hidden=false;
 text('capability-notice','Bluetooth unavailable in this browser.');
}
if(window.SenseRingVisual){
 function mountRing(id,hero){
  const container=$(id);if(!container)return null;
  return new window.SenseRingVisual(container,{hero,story:hero,meshUrl:'assets/ring-assembly.json',onError:()=>{
   const canvas=container.querySelector('canvas');if(canvas)canvas.hidden=true;
   if(!container.querySelector('.ring-fallback')){const note=document.createElement('div');note.className='ring-fallback';note.textContent='Ring preview unavailable.';note.setAttribute('role','status');container.append(note);}
  }});
 }
 heroVisual=mountRing('ring-container-3d',true);
}

function invalidateActions(){state.actionEpoch++;for(const request of state.commandAborts)request.abort();}
function renderOutputState(){
 const paused=!state.controlsEnabled,ready=ring.connected&&state.bridge.ready;
 const label=paused?'Paused':ready?'Controls on':Companion.message(state.bridge.state).chip;
 text('controls-state',label);
 if($('controls-state')){$('controls-state').classList.toggle('paused',paused);$('controls-state').setAttribute('aria-label',label+'. Open setup and connection help');}
 renderSetup();
}
function reportProfileChange(message){toast(profiles.lastSaveSucceeded?message:'Changes stay in this session.');}
function renderProfiles(){
 const select=$('profile-select');if(!select)return;
 const active=profiles.active();select.replaceChildren();
 for(const profile of profiles.list()){const option=document.createElement('option');option.value=profile.id;option.textContent=profile.name;select.append(option);}
 select.value=active.id;document.querySelectorAll('[data-profile-name]').forEach(el=>{el.textContent=active.name;});
 if($('profile-delete-btn'))$('profile-delete-btn').disabled=active.id==='default';
}
function applyProfile(profile){invalidateActions();state.mappings=profile.mappings;ring.setMappings(state.mappings);renderProfiles();renderGestureMapEditor();renderMode();if(!profiles.lastSaveSucceeded)toast('Changes stay in this session.');}
on('profile-select','change',function(){try{applyProfile(profiles.select(this.value));}catch(error){toast(error.message);}});
function openProfileDialog(kind){
 const active=profiles.active(),deleting=kind==='delete';state.profileDialogAction=kind;state.profileDialogId=active.id;
 text('profile-dialog-title',deleting?'Delete profile':kind==='rename'?'Rename profile':'Save a new profile');
 $('profile-name').value=kind==='rename'?active.name:'';$('profile-name').required=!deleting;$('profile-name').parentElement.hidden=deleting;
 $('profile-delete-message').hidden=!deleting;text('profile-delete-message','Delete “'+active.name+'”?');
 text('profile-submit-btn',deleting?'Delete profile':'Save profile');$('profile-submit-btn').classList.toggle('danger',deleting);
 $('profile-error').hidden=true;$('profile-dialog').showModal();if(deleting)$('profile-cancel-secondary').focus();else $('profile-name').focus();
}
on('profile-new-btn','click',()=>openProfileDialog('create'));on('profile-rename-btn','click',()=>openProfileDialog('rename'));
for(const id of ['profile-cancel-btn','profile-cancel-secondary'])on(id,'click',()=>$('profile-dialog').close());
on('profile-form','submit',event=>{event.preventDefault();try{
 const kind=state.profileDialogAction,name=$('profile-name').value;
 const profile=kind==='delete'?profiles.remove(state.profileDialogId):kind==='rename'?profiles.rename(state.profileDialogId,name):profiles.create(name,state.mappings);
 applyProfile(profile);$('profile-dialog').close();reportProfileChange(kind==='delete'?'Profile deleted.':'Profile saved.');
 }catch(error){text('profile-error',error.message);$('profile-error').hidden=false;}});
on('profile-delete-btn','click',()=>{if(profiles.active().id!=='default')openProfileDialog('delete');});
on('profile-export-btn','click',()=>{const file=new Blob([profiles.export()],{type:'application/json'}),url=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=url;anchor.download='SenseRing-'+profiles.active().name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,40)+'.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
on('profile-import-btn','click',()=>$('profile-import-file').click());
on('profile-import-file','change',async function(){const file=this.files&&this.files[0];if(!file)return;try{if(file.size>65536)throw new Error('Choose a profile smaller than 64 KB.');applyProfile(profiles.import(await file.text()));reportProfileChange('Profile imported.');}catch(error){toast(error.message||'Couldn’t import this profile.');}finally{this.value='';}});
const themeIcons={
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.6 8.6 0 1 0 9.7 9.7Z"/></svg>'
};
function renderAppearance(){const dark=window.SenseRingAppearance.get()==='dark';document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.setAttribute('aria-label',dark?'Use light appearance':'Use dark appearance');button.setAttribute('aria-pressed',String(dark));const icon=dark?'sun':'moon';if(button.dataset.themeIcon!==icon){button.innerHTML=themeIcons[icon];button.dataset.themeIcon=icon;}});}
document.addEventListener('senseringtheme',renderAppearance);
document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',event=>{window.SenseRingAppearance.toggle({origin:event.currentTarget});}));
document.querySelectorAll('[data-open-view]').forEach(button=>button.addEventListener('click',()=>{enterExperience();switchView(button.dataset.openView);}));
function setHeroView(view){
 if(!['auto','ring','inside'].includes(view))return;
 if(heroVisual){if(view==='auto')heroVisual.playStory();else heroVisual.setExploded(view==='inside');}
 document.querySelectorAll('[data-model="hero"][data-model-view]').forEach(button=>{
  const active=button.dataset.modelView===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
}
function renderHeroPlayback(){
 const button=$('hero-motion-toggle');if(!button)return;
 button.disabled=heroMotion.matches;
 button.setAttribute('aria-label',heroMotion.matches?'Animation reduced by your device setting':heroPaused?'Play ring animation':'Pause ring animation');
 button.setAttribute('aria-pressed',String(heroPaused));
 button.innerHTML=heroPaused?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
}
document.querySelectorAll('[data-model="hero"][data-model-view]').forEach(button=>button.addEventListener('click',()=>setHeroView(button.dataset.modelView)));
on('hero-motion-toggle','click',()=>{heroPaused=!heroPaused;if(heroVisual)heroVisual.setPlayback(!heroPaused);renderHeroPlayback();});
document.querySelectorAll('[data-reset-model="hero"]').forEach(button=>button.addEventListener('click',()=>{
 setHeroView('auto');heroPaused=false;if(heroVisual){heroVisual.resetView();heroVisual.setPlayback(true);}renderHeroPlayback();
}));
heroMotion.addEventListener('change',renderHeroPlayback);renderHeroPlayback();

document.addEventListener('visibilitychange',()=>{updateVisualVisibility();if(document.hidden){clearTimeout(state.bridgeTimer);state.bridgeTimer=null;}else checkBridge();});
renderProfiles();renderGestureMapEditor();renderMode();renderConnection();renderActivity();renderAppearance();
const landing=$('landing-page'),main=$('main-interface');
if(landing){landing.hidden=false;landing.inert=false;landing.setAttribute('aria-hidden','false');landing.classList.add('active');}
if(main){main.hidden=true;main.inert=true;main.setAttribute('aria-hidden','true');main.classList.remove('active');}
updateVisualVisibility();
checkBridge();
window.enterExperience=enterExperience;window.backToLanding=backToLanding;window.switchView=switchView;window.switchContext=switchContext;
window.cycleContextMode=()=>switchContext(state.mode==='media'?'presentation':'media');window.connectRing=handleConnect;window.testGesture=testGesture;window.resetGestureMap=resetGestureMap;
window.addEventListener('pagehide',()=>{
 pageActive=false;
 if(navResize)navResize.disconnect();window.removeEventListener('resize',updateNavMarker);if($('main-interface'))$('main-interface').removeEventListener('scroll',shrinkNav);heroMotion.removeEventListener('change',renderHeroPlayback);
  ring.disconnect('page-close');['bridgeTimer','overlayTimer','sectionTimer','toastTimer','gestureTimer','cardTimer'].forEach(key=>clearTimeout(state[key]));invalidateActions();
 if(heroVisual)heroVisual.destroy();
});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
