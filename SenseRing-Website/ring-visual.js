/* SenseRing enclosure viewer. Native WebGL depth buffering; no external 3D library. */
(function () {
  'use strict';
  const meshCache = new Map();
  const smooth = value => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  function storyPose(elapsed) {
    const time=((elapsed%10500)+10500)%10500;
    const open=smooth((time-2200)/1600),close=smooth((time-6800)/1600);
    return {step:time<2600?0:time<6000?1:2,progress:time/10500,
      yaw:Math.PI*2*smooth(time/2600)+.34*Math.sin(time/10500*Math.PI*2),exploded:open*(1-close)};
  }
  const VS = `
    precision highp float;
    attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
    uniform mat4 uModel; uniform mat4 uViewProjection;
    varying mediump vec3 vNormal; varying mediump vec3 vPosition; varying mediump vec3 vColor;
    void main(){vec4 world=uModel*vec4(aPosition,1.0);vPosition=world.xyz;
      vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uViewProjection*world;}`;
  const FS = `
    precision mediump float;
    varying mediump vec3 vNormal; varying mediump vec3 vPosition; varying mediump vec3 vColor;
    uniform vec3 uCamera; uniform vec3 uPulseColor; uniform float uPulse; uniform float uMetal; uniform float uAlpha;
    void main(){
      vec3 n=normalize(vNormal),view=normalize(uCamera-vPosition);
      vec3 key=normalize(vec3(-3.0,4.0,5.0)-vPosition),fill=normalize(vec3(4.0,1.0,2.0)-vPosition);
      float light=0.37+0.57*max(dot(n,key),0.0)+0.19*max(dot(n,fill),0.0);
      vec3 albedo=pow(vColor,vec3(2.2));
      float spec=pow(max(dot(n,normalize(key+view)),0.0),mix(28.0,85.0,uMetal));
      float fresnel=pow(1.0-max(dot(n,view),0.0),4.0);
      vec3 color=albedo*light+vec3(0.80,0.85,0.92)*spec*mix(0.07,0.46,uMetal);
      color+=vec3(0.018,0.023,0.032)*fresnel;
      color+=uPulseColor*uPulse*0.035;
      gl_FragColor=vec4(pow(max(color,vec3(0.0)),vec3(0.4545)),uAlpha);}`;
  function identity() { return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
  function multiply(a, b) {
    const result = new Float32Array(16);
    for (let col=0;col<4;col++) for(let row=0;row<4;row++)
      for(let k=0;k<4;k++) result[col*4+row]+=a[k*4+row]*b[col*4+k];
    return result;
  }
  function rotation(x,y,z) {
    const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    const rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
    const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
    const rz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
    return multiply(rz,multiply(rx,ry));
  }
  function perspective(aspect, distance) {
    const f=1/Math.tan(38*Math.PI/360),near=0.1,far=30,range=near-far;
    const projection=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/range,-1,0,0,2*far*near/range,0]);
    const view=identity();view[14]=-distance;return multiply(projection,view);
  }
  function rgb(color) {
    const match=/^#([0-9a-f]{6})$/i.exec(color || '');
    return match ? [0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)/255) : [0,0.953,1];
  }
  function geometry(data){
    if(!data||!Array.isArray(data.parts))throw new Error('Ring unavailable');
    const enclosure=data.parts.filter(part=>['ring_base','left_cover','right_cover'].includes(part.name));
    if(enclosure.length!==3)throw new Error('Incomplete ring');
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const part of enclosure)for(const v of part.vertices)for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}
    const center=min.map((v,i)=>(v+max[i])/2),unit=Math.max(...max.map((v,i)=>v-min[i]))/2;
    const batches=[];
    for(const part of data.parts){
      const color=part.color||[.4,.4,.4],points=part.vertices.map(v=>[(v[0]-center[0])/unit,(v[2]-center[2])/unit,-(v[1]-center[1])/unit]);
      const faces=[],adjacent=new Map(),key=p=>p.map(v=>v.toFixed(5)).join(',');
      for(const face of part.triangles){
        const a=points[face[0]],b=points[face[1]],c=points[face[2]];if(!a||!b||!c)throw new Error('Invalid ring');
        const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
        const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],weight=Math.hypot(...cross);
        if(weight<1e-10)continue;const item={face,normal:cross.map(v=>v/weight),weight};faces.push(item);
        for(const index of face){const k=key(points[index]);if(!adjacent.has(k))adjacent.set(k,[]);adjacent.get(k).push(item);}
      }
      const values=[];
      for(const item of faces)for(const index of item.face){
        const average=[0,0,0];
        for(const neighbor of adjacent.get(key(points[index]))){
          const dot=neighbor.normal.reduce((total,v,i)=>total+v*item.normal[i],0);
          if(dot>.77)for(let i=0;i<3;i++)average[i]+=neighbor.normal[i]*neighbor.weight;
        }
        const length=Math.hypot(...average)||1;values.push(...points[index],...average.map(v=>v/length),...color);
      }
      batches.push({data:new Float32Array(values),group:part.group||part.name,metal:part.metal||0});
    }
    return{batches};
  }
  function loadMesh(url){
    if(!meshCache.has(url))meshCache.set(url,fetch(url).then(response=>{
      if(!response.ok)throw new Error('The enclosure mesh could not be loaded.');return response.json();
    }).then(geometry).catch(error=>{meshCache.delete(url);throw error;}));
    return meshCache.get(url);
  }
  class SenseRingVisual {
    constructor(target,options){
      this.options=options||{};this.container=target;this.createdCanvas=target.tagName!=='CANVAS';
      this.canvas=this.createdCanvas?document.createElement('canvas'):target;
      if(this.createdCanvas){
        if(getComputedStyle(target).position==='static')target.style.position='relative';
        target.appendChild(this.canvas);
      }
      this.canvas.style.cssText+=';width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
      this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','SenseRing 3D model');
      this.container.dataset.loading='true';this.canvas.setAttribute('aria-busy','true');this.visible=true;this.inViewport=true;this.dead=false;this.contextLost=false;
      this.angle=-0.72;this.elevation=0.38;this.tilt=-0.14;this.exploded=0;this.explodedTarget=0;
      this.frame=null;this.lastFrame=0;this.spin=0;this.lastSpinTime=null;this.dirty=true;this.animating=false;this.pulseUntil=0;this.gestureUntil=0;
      this.pulseColor=rgb('#00f3ff');this.drag=null;this.buffers=[];
      this.motion=window.matchMedia('(prefers-reduced-motion: reduce)');this.reduced=this.motion.matches;
      this.pointerDown=e=>{this.drag=[e.clientX,e.clientY];this.canvas.setPointerCapture(e.pointerId);this.canvas.style.cursor='grabbing';};
      this.pointerMove=e=>{if(!this.drag)return;this.angle+=(e.clientX-this.drag[0])*0.008;this.elevation=Math.max(-1.15,Math.min(1.15,this.elevation+(e.clientY-this.drag[1])*0.007));this.drag=[e.clientX,e.clientY];this.dirty=true;this.schedule();};
      this.pointerUp=()=>{this.drag=null;this.canvas.style.cursor='grab';this.dirty=true;this.schedule();};
      this.keyDown=e=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
        if(e.key==='ArrowLeft')this.angle-=0.12;if(e.key==='ArrowRight')this.angle+=0.12;
        if(e.key==='ArrowUp')this.elevation=Math.max(-1.15,this.elevation-0.1);
        if(e.key==='ArrowDown')this.elevation=Math.min(1.15,this.elevation+0.1);
        this.dirty=true;this.schedule();
      };
      this.visibilityChange=()=>{if(document.hidden)this.cancel();else this.schedule();};
      this.motionChange=e=>{this.reduced=e.matches;this.dirty=true;this.schedule();};
      this.lost=e=>{e.preventDefault();this.contextLost=true;this.cancel();};
      this.restored=()=>{this.contextLost=false;try{this.setup();if(this.mesh)this.upload();this.dirty=true;this.schedule();}catch(error){this.fail(error);}};
      this.canvas.addEventListener('pointerdown',this.pointerDown);this.canvas.addEventListener('pointermove',this.pointerMove);
      this.canvas.addEventListener('pointerup',this.pointerUp);this.canvas.addEventListener('pointercancel',this.pointerUp);
      this.canvas.addEventListener('keydown',this.keyDown);this.canvas.addEventListener('webglcontextlost',this.lost);
      this.canvas.addEventListener('webglcontextrestored',this.restored);
      document.addEventListener('visibilitychange',this.visibilityChange);this.motion.addEventListener('change',this.motionChange);
      this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(target);
      this.intersection=new IntersectionObserver(entries=>{this.inViewport=entries[0].isIntersecting;if(this.inViewport)this.schedule();else this.cancel();});
      this.intersection.observe(target);
      try{this.setup();}catch(error){this.fail(error);return;}
      loadMesh(this.options.meshUrl||'assets/ring-assembly.json').then(mesh=>{
        if(this.dead)return;this.mesh=mesh;this.upload();this.container.dataset.loading='false';this.canvas.setAttribute('aria-busy','false');this.dirty=true;this.schedule();
        if(this.options.onReady)this.options.onReady();
      }).catch(error=>this.fail(error));
    }
    fail(error){
      if(this.dead)return;this.cancel();this.failed=true;this.container.dataset.loading='false';this.canvas.setAttribute('aria-busy','false');
      if(this.options.onError)this.options.onError(error);
      else if(this.createdCanvas){
        this.canvas.hidden=true;this.fallback=document.createElement('p');
        this.fallback.textContent='3D preview unavailable. Your ring controls still work.';
        this.fallback.style.cssText='padding:2rem;color:#a0a0b8;text-align:center;';
        this.container.appendChild(this.fallback);
      }
    }
    setup(){
      const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});
      if(!gl)throw new Error('WebGL is unavailable in this browser.');this.gl=gl;
      const shader=(type,source)=>{const item=gl.createShader(type);gl.shaderSource(item,source);gl.compileShader(item);
        if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(item);gl.deleteShader(item);throw new Error(message);}
        return item;
      };
      const vs=shader(gl.VERTEX_SHADER,VS),fs=shader(gl.FRAGMENT_SHADER,FS),program=gl.createProgram();
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      this.program=program;this.attributes={};
      for(const name of ['aPosition','aNormal','aColor'])this.attributes[name]=gl.getAttribLocation(program,name);
      this.uniforms={};
      for(const name of ['uModel','uViewProjection','uCamera','uPulseColor','uPulse','uMetal','uAlpha'])
        this.uniforms[name]=gl.getUniformLocation(program,name);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
      gl.clearColor(0,0,0,0);this.buffers=[];
    }
    upload(){
      const gl=this.gl;for(const item of this.buffers)gl.deleteBuffer(item.buffer);
      this.buffers=this.mesh.batches.map(batch=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,batch.data,gl.STATIC_DRAW);return{buffer,count:batch.data.length/9,group:batch.group,metal:batch.metal};});
    }
    setExploded(value){this.options.story=false;this.storyPose=null;this.spin=0;this.explodedTarget=value?1:0;if(this.reduced)this.exploded=this.explodedTarget;this.dirty=true;this.schedule();}
    playStory(){this.options.story=true;this.storyPose=null;this.storyTime=0;this.spin=0;this.lastSpinTime=null;this.dirty=true;this.schedule();}
    setPlayback(value){this.paused=!value;this.cancel();this.dirty=true;this.schedule();}
    replay(){this.storyTime=0;this.lastSpinTime=null;this.dirty=true;this.schedule();}
    resetView(){this.angle=-0.72;this.elevation=0.38;this.tilt=-0.14;this.spin=0;this.storyTime=0;this.storyPose=null;this.lastSpinTime=null;this.dirty=true;this.schedule();}
    resize(){this.dirty=true;this.schedule();}
    setVisible(value){this.visible=!!value;if(this.visible){this.dirty=true;this.schedule();}else this.cancel();}
    pulse(color){this.pulseColor=rgb(color||'#00f3ff');this.pulseUntil=performance.now()+800;this.dirty=true;this.schedule();}
    animateGesture(token,color){
      this.gesture=token;this.gestureUntil=performance.now()+650;this.pulse(color||'#a78bfa');
    }
    cancel(){if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.lastSpinTime=null;}
    schedule(){
      if(this.dead||this.failed||this.contextLost||!this.visible||!this.inViewport||document.hidden||this.frame!==null)return;
      this.frame=requestAnimationFrame(time=>{this.frame=null;this.tick(time);});
    }
    tick(time){
      if(this.dead||this.failed||this.contextLost||!this.visible||!this.inViewport||document.hidden)return;
      const spinDelta=this.lastSpinTime===null?0:Math.min(time-this.lastSpinTime,100);this.lastSpinTime=time;
      const spinning=this.options.hero&&!this.reduced&&!this.paused&&!this.drag;
      const storytelling=this.options.story&&!this.reduced&&!this.paused&&!this.drag;
      if(this.options.story){
        if(storytelling)this.storyTime=(this.storyTime||0)+spinDelta;
        this.storyPose=storyPose(this.reduced?4700:this.storyTime||0);
        this.exploded=this.storyPose.exploded;
      }
      const effect=!this.reduced&&(time<this.pulseUntil||time<this.gestureUntil);
      const moving=!this.options.story&&Math.abs(this.exploded-this.explodedTarget)>.001;
      if(spinning)this.spin=(this.spin+spinDelta*Math.PI*2/22000)%(Math.PI*2);
      // Dashboard controls take priority: draw on changes, and stop completely
      // when idle. Keep one final frame to clear a finished highlight.
      if(this.mesh&&(this.dirty||spinning||storytelling||effect||moving||this.animating)&&(this.dirty||time-this.lastFrame>=33)){
        if(!this.options.story){
          if(Math.abs(this.exploded-this.explodedTarget)>.001)this.exploded+=(this.explodedTarget-this.exploded)*.15;
          if(Math.abs(this.exploded-this.explodedTarget)<=.001)this.exploded=this.explodedTarget;
        }
        this.draw(time);this.lastFrame=time;this.dirty=false;
        if(this.options.onFrame&&this.storyPose)this.options.onFrame(this.storyPose);
        this.animating=!!(effect||(!this.options.story&&Math.abs(this.exploded-this.explodedTarget)>.001));
      }
      if(this.mesh&&(spinning||storytelling||effect||this.dirty||this.animating||moving))this.schedule();
      else this.lastSpinTime=null;
    }
    bind(item){
      const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);
      for(const [name,offset] of [['aPosition',0],['aNormal',12],['aColor',24]]){
        const location=this.attributes[name];gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,36,offset);
      }
    }
    draw(time){
      const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const gl=this.gl,dpr=Math.min(window.devicePixelRatio||1,1.75),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const elapsed=this.reduced||!this.options.hero?0:time,orbit=this.options.hero?this.spin:0;
      const gesture=this.reduced?0:Math.max(0,(this.gestureUntil-time)/650),shake=gesture*Math.sin(gesture*Math.PI*2)*.025;
      const base=rotation(this.elevation+Math.sin(elapsed/7000)*.012,this.angle+(this.storyPose?this.storyPose.yaw:orbit)+shake,this.tilt);
      base[13]=Math.sin(elapsed/3000)*.025;
      const aspect=w/h,distance=Math.max(this.options.story&&!this.options.hero?5.5:6.3,3.7/Math.max(.6,aspect))+this.exploded*.6;
      gl.uniformMatrix4fv(this.uniforms.uViewProjection,false,perspective(aspect,distance));
      gl.uniform3fv(this.uniforms.uCamera,[0,0,distance]);gl.uniform3fv(this.uniforms.uPulseColor,this.pulseColor);
      gl.uniform1f(this.uniforms.uPulse,this.reduced?0:Math.max(0,(this.pulseUntil-time)/800));
      gl.disable(gl.BLEND);gl.depthMask(true);
      for(const item of this.buffers){
        const local=identity();if(item.group==='left_cover')local[12]=-.56*this.exploded;if(item.group==='right_cover')local[12]=.56*this.exploded;
        const alpha=item.group==='ring_base'?1-.88*this.exploded:1;
        if(alpha<.999){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}
        gl.uniform1f(this.uniforms.uAlpha,alpha);gl.uniformMatrix4fv(this.uniforms.uModel,false,multiply(base,local));gl.uniform1f(this.uniforms.uMetal,item.metal);
        this.bind(item);gl.drawArrays(gl.TRIANGLES,0,item.count);
      }
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    destroy(){
      if(this.dead)return;this.dead=true;this.cancel();this.observer.disconnect();this.intersection.disconnect();
      this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);
      this.canvas.removeEventListener('pointerup',this.pointerUp);this.canvas.removeEventListener('pointercancel',this.pointerUp);
      this.canvas.removeEventListener('keydown',this.keyDown);this.canvas.removeEventListener('webglcontextlost',this.lost);
      this.canvas.removeEventListener('webglcontextrestored',this.restored);
      document.removeEventListener('visibilitychange',this.visibilityChange);this.motion.removeEventListener('change',this.motionChange);
      if(this.gl&&!this.contextLost){for(const item of this.buffers)this.gl.deleteBuffer(item.buffer);if(this.program)this.gl.deleteProgram(this.program);}
      if(this.createdCanvas)this.canvas.remove();if(this.fallback)this.fallback.remove();
    }
  }
  window.SenseRingVisual=SenseRingVisual;
  window.SenseRingStoryPose=storyPose;
})();
