const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const P=require('../yopilot-presentation.js');
const M=require('../oxidns-manage-model.js');
const yaml=require('../vendor/js-yaml.min.js');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

function engine(config){
  const elements=new Map(),dialogs=[];
  const get=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',value:'',hidden:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},querySelector:get,querySelectorAll:()=>[]});return elements.get(selector);};
  const document={querySelector:get,querySelectorAll:()=>[],addEventListener(){},activeElement:get('active'),createElement:()=>{const el=get('dialog'+dialogs.length);dialogs.push(el);return el;},body:{append(){}}};
  const window={YoPilotPresentation:P,jsyaml:yaml};
  const data=new Map([['oxidns-v2-config',JSON.stringify(config)]]);
  const ctx={window,document,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},console};
  vm.runInNewContext(source('oxidns-plugin-catalog.js'),ctx);
  vm.runInNewContext(source('oxidns-engine.js'),ctx);
  return {api:window.OxiEngine,get,dialogs};
}

test('array fields and actions identify their group and index without changing configuration',()=>{
  const config={plugins:[{tag:'cn_domains',type:'domain_set',args:{files:['a','b','c','d'],extra:{keep:true}}}]};
  const h=engine(config);h.api.edit(null,'cn_domains');
  for(let i=1;i<=4;i++){
    assert.ok(h.dialogs[0].innerHTML.includes(`aria-label="域名规则文件 第 ${i} 项"`));
    assert.ok(h.dialogs[0].innerHTML.includes(`aria-label="移除 域名规则文件 第 ${i} 项"`));
  }
  assert.equal(JSON.stringify(h.api.config()),JSON.stringify(config));
});

test('plugin catalog shows searchable Chinese names while preserving tags and unknown kinds',()=>{
  const config={plugins:[{tag:'forward_cn',type:'forward',args:{}},{tag:'user_custom',type:'future_plugin',args:{}}]};
  const h=engine(config);h.api.render('plugins');
  const rows=()=>h.get('#catalogRows').innerHTML;
  assert.match(rows(),/国内解析组/);assert.match(rows(),/forward_cn/);assert.match(rows(),/user_custom/);
  h.get('#catalogSearch').value='国内解析组';
  h.get('#catalogSearch').listeners.input({target:h.get('#catalogSearch')});
  assert.match(rows(),/forward_cn/);assert.doesNotMatch(rows(),/user_custom/);
  h.get('#catalogSearch').value='user_custom';
  h.get('#catalogSearch').listeners.input({target:h.get('#catalogSearch')});
  assert.match(rows(),/user_custom/);assert.doesNotMatch(rows(),/forward_cn/);
  assert.match(h.get('#view-plugins').innerHTML,/目录类型分布/);
  assert.equal(JSON.stringify(h.api.config()),JSON.stringify(config));
});

function manage(plugin){
  const el=new Map(),rule={dataset:{mgRule:plugin.tag}},get=s=>{if(!el.has(s))el.set(s,{innerHTML:'',value:'',textContent:'',setAttribute(){}});return el.get(s);};
  const E={config:()=>({plugins:[structuredClone(plugin)]}),catalog:[],routeInfo:{},label:t=>t};
  const window={OxiManageModel:M,OxiEngine:E,YoPilotPresentation:P,YoPilotRuleCards:require('../yopilot-rules-cards.js'),addEventListener(){}};
  const document={querySelector:get,querySelectorAll:s=>s==='[data-mg-rule]'?[rule]:[]};
  vm.runInNewContext(source('oxidns-manage.js'),{window,document,console});
  window.OxiManage.install({subnav:()=>'',toast(){}});window.OxiManage.render('rules');rule.onclick();
  return get('#page-content').innerHTML;
}

test('inline rule editor keeps file and referenced-set boundaries beside the editable content',()=>{
  const html=manage({tag:'cn_domains',type:'domain_set',args:{exps:[],files:['a','b','c','d'],sets:['shared']}});
  assert.match(html,/内联补充规则（exps）/);assert.match(html,/另有 4 个文件来源/);assert.match(html,/另引用 1 个规则集合/);
  assert.match(html,/aria-describedby="mg-source-boundary"/);assert.match(html,/查看来源与文件/);
});

test('dynamic and Geo rules keep distinct source semantics',()=>{
  assert.match(manage({tag:'learned_real',type:'dynamic_domain_set',args:{path:'learned.txt',bootstrap_rules:[]}}),/不是当前已学习的域名列表/);
  assert.match(manage({tag:'geo',type:'geosite',args:{file:'geo.dat',selectors:['cn']}}),/不是分类中的域名或 IP 明细/);
});
