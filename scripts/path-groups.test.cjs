const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const B=require('../yopilot-path-model.js');
const M=require('../oxidns-manage-model.js');
const catalog=[{kind:'udp_server',type:'server'}];
const context={catalog,fields:M.fields};
function config(){
  const rules=[...B.definitions.flatMap(d=>d.rules),'pt_sites','pt_trackers','force_real','ddns_domains','cdn_domains','learned_real'];
  return {plugins:[...rules.map(tag=>({tag,type:'domain_set',args:{exps:[]}})),
    ...Array.from({length:4},(_,i)=>({tag:'listen'+i,type:'udp_server'})),
    ...Array.from({length:6},(_,i)=>({tag:'cache'+i,type:'cache'})),
    {tag:'forward_cn',type:'forward',args:{concurrent:3,response_selection:'consensus',upstreams:['udp://223.5.5.5:53','udp://119.29.29.29:53','udp://211.139.5.29:53']}},
    {tag:'forward_foreign',type:'forward',args:{upstreams:[{tag:'google',addr:'https://dns.google/dns-query'},{tag:'cloudflare',addr:'https://cloudflare-dns.com/dns-query'}]}},
    {tag:'forward_ecs',type:'forward',args:{upstreams:[{tag:'google-ecs',addr:'https://dns.google/dns-query'}]}},
    ...['forward_fake','forward_local'].map(tag=>({tag,type:'forward',args:{upstreams:['udp://192.0.2.3:53']}})),
    ...['fallback_foreign','fallback_real','fallback_cn_proxy','fallback_unknown'].map(tag=>({tag,type:'fallback',args:{threshold:250}}))]};
}
test('all topology members survive purpose grouping, once each',()=>{
  const c=config(),before=JSON.stringify(c),d=B.build(c,context);
  assert.deepEqual([d.servers.length,d.caches.length,d.providers.length,d.strategies.length,d.nodes.length,d.total],[4,6,21,9,8,48]);
  for(const field of ['rules','strategies','nodes']){
    const actual=d.branches.flatMap(g=>g[field]);
    const expected=field==='rules'?d.providers:d[field];
    assert.equal(actual.length,expected.length);assert.equal(new Set(actual).size,expected.length);
    assert.ok(expected.every(x=>actual.includes(x)));
  }
  assert.equal(JSON.stringify(c),before);
});
test('domestic mode stays consensus, duplicated Google address keeps separate ECS owner',()=>{
  const d=B.build(config(),context),cn=d.branches.find(g=>g.id==='domestic');
  assert.equal(B.policy(cn.strategies[0]),'并发 3 · 负向共识');
  assert.equal(cn.rules.length,4);assert.equal(cn.nodes.length,3);
  const google=d.nodes.filter(n=>n.addr==='https://dns.google/dns-query');
  assert.equal(google.length,2);assert.notEqual(google[0].id,google[1].id);assert.notEqual(google[0].owner,google[1].owner);
});
test('cross-purpose fallbacks and arbitrary custom tags never disappear or guess a route',()=>{
  const c=config();c.plugins.push({tag:'custom-overseas-looking-name',type:'domain_set',args:{}},{tag:'my-cn-fastest',type:'forward',args:{upstreams:['tls://example.invalid']}});
  const extra=B.build(c,context).branches.find(g=>g.id==='additional');
  assert.equal(extra.rules.length,7);assert.equal(extra.strategies.length,4);assert.equal(extra.nodes.length,1);
  assert.ok(extra.strategies.some(p=>p.tag==='fallback_real'));
  assert.ok(extra.rules.some(p=>p.tag==='custom-overseas-looking-name'));
});
test('empty/malformed optional arrays and unknown policy remain readable',()=>{
  assert.equal(B.build({},context).total,0);
  assert.equal(B.build({plugins:null},context).branches.length,0);
  assert.equal(B.policy({type:'forward',args:{response_selection:'future_mode',concurrent:5}}),'并发 5 · future_mode');
  assert.equal(B.build({plugins:[{tag:'custom',type:'forward',args:{upstreams:'invalid'}}]},context).nodes.length,0);
});
test('entrypoint loads model before renderer, scoped CSS included, production API unchanged',()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../oxidns-console-prototype.html'),'utf8');
  assert.ok(html.indexOf('yopilot-path-model.js')<html.indexOf('yopilot-path.js'));
  assert.match(html,/yopilot-path-b\.css\?v=20261017-9/);
  const source=fs.readFileSync(require('node:path').join(__dirname,'../yopilot-path.js'),'utf8');
  for(const s of ['onPlugin','onClient','onCache','yopilot-path-motion','ResizeObserver','IntersectionObserver'])assert.ok(source.includes(s));
  new vm.Script(source);
});
