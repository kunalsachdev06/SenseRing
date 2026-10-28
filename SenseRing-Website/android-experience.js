/* Phone preview motion is visibility-gated; this section mounts no 3D model. */
(function () {
  'use strict';
  const section=document.getElementById('android');
  if(!section)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const toggle=document.getElementById('android-motion-toggle');
  let visible=false,enabled=true,paused=false,dead=false;
  function sync(){
    if(dead)return;
    const active=visible&&enabled&&!document.hidden;
    const playing=active&&!paused&&!motion.matches;
    section.dataset.playing=String(playing);
    toggle.disabled=motion.matches;
    toggle.setAttribute('aria-label',motion.matches?'Animation reduced by your device setting':paused?'Play phone preview':'Pause phone preview');
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.innerHTML=paused?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
  }
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.12});
  observer.observe(section.querySelector('.android-cinema'));
  toggle.addEventListener('click',()=>{paused=!paused;sync();});
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',sync);
  window.SenseRingAndroidExperience={setVisible(value){enabled=!!value;sync();}};
  window.addEventListener('pagehide',()=>{
    dead=true;section.dataset.playing='false';observer.disconnect();
    document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);
  },{once:true});
})();
