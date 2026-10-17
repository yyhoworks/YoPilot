const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const B=require('../yopilot-path-model.js'),M=require('../oxidns-manage-model.js'),P=require('../yopilot-presentation.js');
function fixture(){
  const expand={textContent:'',setAttribute(k,v){this[k]=v;}};
  const groups=['domestic','network'].map(id=>({dataset:{ypbGroup:id},isConnected:true,open:false,events:{},addEventListener(k,fn){this.events[k]=fn;}}));
  const target={html:'',contains:()=>false,querySelector(s){if(s==='#op-expand')return expand;if(s==='.ypb-scroll')return {scrollLeft:0};if(s==='.ypb-stage'||s==='.ypb-links')return {};return null;},querySelectorAll(s){return s==='[data-ypb-group]'||s==='.ypb-branch'?groups:[];},set innerHTML(s){this.html=s;},get innerHTML(){return this.html;}};
  const document={hidden:false,activeElement:null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}};
  const window={OxiEngine:{catalog:[],label:t=>t},OxiManageModel:M,YoPilotPresentation:P,YoPilotPathModel:B};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../yopilot-path.js'),'utf8'),{window,document,matchMedia:()=>({matches:false,addEventListener:()=>{}}),localStorage:{getItem:()=>null,setItem:()=>{}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
  const config={plugins:[{tag:'forward_cn',type:'forward',args:{upstreams:[]}},{tag:'forward_local',type:'forward',args:{upstreams:[]}}]};
  return {mount:clients=>window.OxiPath.mount(target,{config,clients}),target,groups,expand};
}
test('renderer includes every supplied client, including sixth and safely escaped labels',()=>{
  const f=fixture();f.mount(Array.from({length:6},(_,i)=>({key:i===5?'sixth<client>':'client-'+i,count:i,share:.1})));
  assert.equal((f.target.html.match(/data-op-client=/g)||[]).length,6);
  assert.match(f.target.html,/sixth&lt;client&gt;/);assert.doesNotMatch(f.target.html,/sixth<client>/);
});
test('manual and bulk group changes keep expand-all text and accessible state synchronized',()=>{
  const f=fixture();f.mount([]);assert.equal(f.expand.textContent,'展开分组');
  f.expand.onclick();assert.equal(f.expand.textContent,'收起分组');assert.equal(f.expand['aria-expanded'],'true');
  f.groups[0].open=false;f.groups[0].events.toggle();
  assert.equal(f.expand.textContent,'展开分组');assert.equal(f.expand['aria-expanded'],'false');
  f.groups[0].open=true;f.groups[0].events.toggle();assert.equal(f.expand.textContent,'收起分组');
  f.expand.onclick();assert.ok(f.groups.every(g=>!g.open));assert.equal(f.expand.textContent,'展开分组');
});
