const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(saved){
  const flags=new Map(),attrs=new Map(),events={},mediaEvents={},storage=new Map([['yopilot-path-motion',saved]]);
  const path={classList:{toggle:(name,on)=>flags.set(name,on)}};
  const button={classList:{toggle:(name,on)=>flags.set('button-'+name,on)},setAttribute:(name,v)=>attrs.set(name,v)};
  const document={hidden:false,querySelectorAll:()=>[path],querySelector:()=>button,addEventListener:(name,cb)=>events[name]=cb};
  const media={matches:false,addEventListener:(name,cb)=>mediaEvents[name]=cb};
  const window={};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../yopilot-path.js'),'utf8'),{window,document,matchMedia:()=>media,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
  return {api:window.OxiPath,flags,attrs,storage,document,events,media,mediaEvents};
}
test('flow switch controls existing paths and persists its state',()=>{
  const f=fixture('off');assert.equal(f.api.getMotion(),false);
  f.api.setMotion(true);assert.equal(f.flags.get('op-motion'),true);assert.equal(f.attrs.get('aria-pressed'),'true');assert.equal(f.storage.get('yopilot-path-motion'),'on');
  f.api.setMotion(false);assert.equal(f.flags.get('op-motion'),false);assert.equal(f.attrs.get('aria-pressed'),'false');
});
test('reduced motion and hidden tab pause flow without discarding preference',()=>{
  const f=fixture('on');f.api.setMotion(true);
  f.media.matches=true;f.mediaEvents.change();assert.equal(f.flags.get('op-motion'),false);assert.equal(f.api.getMotion(),true);
  f.media.matches=false;f.mediaEvents.change();assert.equal(f.flags.get('op-motion'),true);
  f.document.hidden=true;f.events.visibilitychange();assert.equal(f.flags.get('op-motion'),false);
  f.document.hidden=false;f.events.visibilitychange();assert.equal(f.flags.get('op-motion'),true);
});
