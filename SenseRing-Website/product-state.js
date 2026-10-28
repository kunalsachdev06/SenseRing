/* Local settings only. No accounts, telemetry or external requests. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./sense-ring-core.js'));
  else root.SenseRingState=factory(root.SenseRingCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
  'use strict';
  const KEY='SenseRing.profiles.v1',FORMAT='sensering-profile';
  const clone=value=>JSON.parse(JSON.stringify(value));
  function nameOf(value){
    if(typeof value!=='string')throw new Error('Enter a profile name.');
    const name=value.trim();
    if(!name||name.length>32||/[<>\x00-\x1f]/.test(name))throw new Error('Use a name between 1 and 32 characters.');
    return name;
  }
  function mappingsOf(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('This profile has invalid controls.');
    if(Object.keys(value).some(key=>!['media','presentation'].includes(key)))throw new Error('This profile has unknown modes.');
    const result={};
    for(const mode of ['media','presentation']){
      const map=value[mode],inputs=Core.INPUTS[mode];
      if(!map||typeof map!=='object'||Array.isArray(map))throw new Error('This profile is missing a mode.');
      if(Object.keys(map).length!==inputs.length)throw new Error('This profile has missing or unknown gestures.');
      result[mode]={};
      for(const input of inputs){
        if(!Object.hasOwn(map,input.id)||typeof map[input.id]!=='string'||!Object.hasOwn(Core.ACTIONS,map[input.id]))throw new Error('This profile contains an unsupported action.');
        result[mode][input.id]=map[input.id];
      }
    }
    return result;
  }
  function parseImport(raw){
    if(typeof raw!=='string'||raw.length>65536)throw new Error('Choose a SenseRing profile smaller than 64 KB.');
    let value;try{value=JSON.parse(raw);}catch(_){throw new Error('This file is not a valid profile.');}
    if(!value||value.format!==FORMAT||value.version!==1)throw new Error('This profile version is not supported.');
    return{name:nameOf(value.name),mappings:mappingsOf(value.mappings)};
  }
  class ProfileStore{
    constructor(storage){
      this.storage=storage;this.lastSaveSucceeded=true;
      this.data={version:1,activeId:'default',profiles:[{id:'default',name:'Everyday',mappings:clone(Core.DEFAULT_MAPPINGS)}]};
      try{
        const raw=storage&&storage.getItem(KEY);
        if(raw){
          const saved=JSON.parse(raw);
          if(saved.version!==1||!Array.isArray(saved.profiles)||saved.profiles.length<1||saved.profiles.length>16)throw new Error('Invalid saved profiles');
          const ids=new Set(),names=new Set();
          const profiles=saved.profiles.map(profile=>{
            if(typeof profile.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(profile.id)||ids.has(profile.id))throw new Error('Invalid saved profile');
            const name=nameOf(profile.name),lower=name.toLowerCase();
            if(names.has(lower))throw new Error('Duplicate saved name');ids.add(profile.id);names.add(lower);
            return{id:profile.id,name,mappings:mappingsOf(profile.mappings)};
          });
          if(!ids.has('default'))throw new Error('Missing default profile');
          this.data={version:1,activeId:ids.has(saved.activeId)?saved.activeId:'default',profiles};
        }else if(storage){
          const legacy=storage.getItem('SenseRing.touch.mappings.v2');
          if(legacy){try{this.data.profiles[0].mappings=mappingsOf(JSON.parse(legacy));}catch(_){}}
        }
      }catch(_){/* Leave a corrupt stored document untouched until the user saves. */}
    }
    persist(){try{if(!this.storage)throw new Error('No storage');this.storage.setItem(KEY,JSON.stringify(this.data));this.lastSaveSucceeded=true;}catch(_){this.lastSaveSucceeded=false;}return this.lastSaveSucceeded;}
    list(){return clone(this.data.profiles);}
    active(){return clone(this.data.profiles.find(item=>item.id===this.data.activeId));}
    select(id){if(!this.data.profiles.some(item=>item.id===id))throw new Error('Profile not found.');this.data.activeId=id;this.persist();return this.active();}
    save(mappings){const valid=mappingsOf(mappings);this.data.profiles.find(item=>item.id===this.data.activeId).mappings=valid;this.persist();return this.active();}
    create(name,mappings){
      name=nameOf(name);if(this.data.profiles.length>=16)throw new Error('You can save up to 16 profiles.');
      if(this.data.profiles.some(item=>item.name.toLowerCase()===name.toLowerCase()))throw new Error('A profile with that name already exists.');
      const valid=mappingsOf(mappings),id='p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
      this.data.profiles.push({id,name,mappings:valid});this.data.activeId=id;this.persist();return this.active();
    }
    rename(id,name){name=nameOf(name);const profile=this.data.profiles.find(item=>item.id===id);if(!profile)throw new Error('Profile not found.');
      if(this.data.profiles.some(item=>item.id!==id&&item.name.toLowerCase()===name.toLowerCase()))throw new Error('A profile with that name already exists.');
      profile.name=name;this.persist();return this.active();}
    remove(id){if(id==='default')throw new Error('The Everyday profile cannot be deleted.');const index=this.data.profiles.findIndex(item=>item.id===id);if(index<0)throw new Error('Profile not found.');this.data.profiles.splice(index,1);if(this.data.activeId===id)this.data.activeId='default';this.persist();return this.active();}
    export(){const profile=this.active();return JSON.stringify({format:FORMAT,version:1,name:profile.name,mappings:profile.mappings},null,2);}
    import(raw){const profile=parseImport(raw);let name=profile.name,index=2;while(this.data.profiles.some(item=>item.name.toLowerCase()===name.toLowerCase())){const suffix=' '+index++;name=profile.name.slice(0,32-suffix.length)+suffix;}return this.create(name,profile.mappings);}
  }
  return Object.freeze({ProfileStore,parseImport,mappingsOf,KEY});
});
