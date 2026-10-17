/* Display projection only. Purpose membership is not a query execution trace. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.YoPilotPathModel=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const definitions=[
    {id:'domestic',name:'国内并发解析',tone:'domestic',icon:'globe',rules:['cn_domains','cn_ip','custom_cn','force_cn'],strategies:['forward_cn']},
    {id:'overseas',name:'海外解析',tone:'overseas',icon:'branch',rules:['foreign_domains'],strategies:['forward_ecs','forward_foreign','fallback_foreign']},
    {id:'fake',name:'FakeIP 解析',tone:'fake',icon:'spark',rules:['force_fake','fake_ip','learned_fake'],strategies:['forward_fake']},
    {id:'network',name:'局域网解析',tone:'network',icon:'network',rules:['local_domains','allowed_devices','direct_ip'],strategies:['forward_local']},
    {id:'filter',name:'拦截与记录过滤',tone:'filter',icon:'shield',rules:['blocked','pcdn_domains','suppress_a','suppress_aaaa'],strategies:[]}
  ];
  const selections={fastest:'最快响应',balanced:'平衡裁决',prefer_positive:'优先正向答案',consensus:'负向共识'};
  function policy(p){
    if(!p)return '没有转发策略';
    if(p.type==='fallback')return '主备回退 · '+(p.args?.threshold??0)+' ms';
    const mode=p.args?.response_selection||'balanced';
    return '并发 '+(p.args?.concurrent??1)+' · '+(selections[mode]||mode);
  }
  function build(config,{catalog=[],fields={}}={}){
    const all=Array.isArray(config?.plugins)?config.plugins:[];
    const servers=all.filter(p=>catalog.some(d=>d.kind===p.type&&d.type==='server'));
    const caches=all.filter(p=>p.type==='cache');
    const providers=all.filter(p=>Object.hasOwn(fields,p.type));
    const strategies=all.filter(p=>['forward','fallback'].includes(p.type));
    const nodes=strategies.filter(p=>p.type==='forward').flatMap(p=>(Array.isArray(p.args?.upstreams)?p.args.upstreams:[]).map((u,i)=>({
      id:JSON.stringify([p.tag,i]),owner:p.tag,index:i,value:u,addr:typeof u==='string'?u:u?.addr||'',
      tag:typeof u==='string'?String(i+1):u?.tag||String(i+1),outbound:typeof u==='string'?'':u?.outbound||''
    })));
    const usedRules=new Set(),usedStrategies=new Set();
    const branches=definitions.map(d=>{
      const rules=providers.filter(p=>d.rules.includes(p.tag));
      const group=strategies.filter(p=>d.strategies.includes(p.tag));
      rules.forEach(p=>usedRules.add(p));group.forEach(p=>usedStrategies.add(p));
      return {...d,rules,strategies:group,nodes:nodes.filter(n=>group.some(p=>p.tag===n.owner))};
    }).filter(d=>d.rules.length||d.strategies.length);
    const extra={id:'additional',name:'补充规则与跨策略回退',tone:'additional',icon:'layers',
      rules:providers.filter(p=>!usedRules.has(p)),strategies:strategies.filter(p=>!usedStrategies.has(p))};
    extra.nodes=nodes.filter(n=>extra.strategies.some(p=>p.tag===n.owner));
    if(extra.rules.length||extra.strategies.length)branches.push(extra);
    return {all,servers,caches,providers,strategies,nodes,branches,
      total:servers.length+caches.length+providers.length+strategies.length+nodes.length};
  }
  return {build,policy,definitions};
});
