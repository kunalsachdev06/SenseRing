(function(){
  'use strict';
  const root=document.documentElement;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let initial='light';
  try{const saved=localStorage.getItem('SenseRing.appearance');if(saved==='dark'||saved==='light')initial=saved;}catch(_){}
  root.dataset.theme=initial;
  let requested=initial,sequence=0,activeTransition=null,activeAnimation=null,fallbackTimer=null,fallbackResolve=null;
  function commit(value){
    root.dataset.theme=value;
    try{localStorage.setItem('SenseRing.appearance',value);}catch(_){}
    document.dispatchEvent(new CustomEvent('senseringtheme',{detail:value}));
  }
  function clearActive(){
    const animation=activeAnimation,transition=activeTransition,resolve=fallbackResolve;
    activeAnimation=null;activeTransition=null;fallbackResolve=null;
    clearTimeout(fallbackTimer);fallbackTimer=null;
    try{if(animation)animation.cancel();}catch(_){}
    try{if(transition)transition.skipTransition();}catch(_){}
    if(resolve)resolve();
    root.classList.remove('theme-crossfade');delete root.dataset.themeTransition;
  }
  function revealCircle(origin){
    const width=Math.max(1,window.innerWidth||root.clientWidth||1),height=Math.max(1,window.innerHeight||root.clientHeight||1);
    const rect=origin&&typeof origin.getBoundingClientRect==='function'?origin.getBoundingClientRect():null;
    let x=rect?rect.left+rect.width/2:width/2,y=rect?rect.top+rect.height/2:height/2;
    x=Number.isFinite(x)?Math.max(0,Math.min(width,x)):width/2;
    y=Number.isFinite(y)?Math.max(0,Math.min(height,y)):height/2;
    return{x,y,radius:Math.hypot(Math.max(x,width-x),Math.max(y,height-y))+2};
  }
  async function set(value,options={}){
    if(!['light','dark'].includes(value))return false;
    const run=++sequence;requested=value;clearActive();
    if(root.dataset.theme===value)return true;
    if(options.animate===false||motion.matches||document.hidden){root.dataset.themeEffect='instant';commit(value);return true;}
    if(typeof document.startViewTransition!=='function'||typeof root.animate!=='function'){
      root.dataset.themeEffect='crossfade';root.classList.add('theme-crossfade');root.getBoundingClientRect();commit(value);
      await new Promise(resolve=>{fallbackResolve=resolve;fallbackTimer=setTimeout(resolve,360);});
      if(run===sequence){fallbackResolve=null;fallbackTimer=null;root.classList.remove('theme-crossfade');}
      return run===sequence;
    }
    let transition=null;
    try{
      root.dataset.themeTransition='reveal';
      root.dataset.themeEffect='reveal';
      transition=document.startViewTransition(()=>{if(run===sequence)commit(value);});
      activeTransition=transition;
      const finished=transition.finished.catch(()=>{});
      await transition.ready;
      if(run!==sequence){transition.skipTransition();return false;}
      const {x,y,radius}=revealCircle(options.origin);
      const animation=root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
        {duration:620,easing:'cubic-bezier(.65,0,.35,1)',pseudoElement:'::view-transition-new(root)'});
      activeAnimation=animation;
      await animation.finished;
      await finished;
    }catch(_){
      try{if(transition)transition.skipTransition();}catch(_){}
      if(run===sequence){root.dataset.themeEffect='instant';if(root.dataset.theme!==value)commit(value);}
    }finally{
      if(run===sequence){activeAnimation=null;activeTransition=null;delete root.dataset.themeTransition;}
    }
    return run===sequence;
  }
  function stopMotion(){++sequence;clearActive();if(root.dataset.theme!==requested)commit(requested);}
  motion.addEventListener('change',event=>{if(event.matches)stopMotion();});
  window.addEventListener('pagehide',stopMotion);
  window.SenseRingAppearance={get:()=>root.dataset.theme,set,toggle:options=>set(requested==='dark'?'light':'dark',options)};
})();
