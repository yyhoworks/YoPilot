/* Configuration-only projections. No requests, mutations, or inferred runtime state. */
(function(root) {
  'use strict';
  const fields={domain_set:'exps',ip_set:'ips',geosite:'selectors',geoip:'selectors',adguard_rule:'rules',dynamic_domain_set:'bootstrap_rules'};
  const copy=v=>JSON.parse(JSON.stringify(v));
  const array=v=>Array.isArray(v)?v:[];
  const files=p=>[...array(p.args?.files),...(['geosite','geoip'].includes(p.type)?[p.args?.file]:[]),...(p.type==='dynamic_domain_set'?[p.args?.path]:[])].filter(x=>typeof x==='string'&&x);
  function refs(p,plugins) {
    const tags=new Set(plugins.map(x=>x.tag)),found=new Set();
    function walk(v,key='') {
      if(Array.isArray(v)){v.forEach(x=>walk(x,key));return;}
      if(v&&typeof v==='object'){Object.entries(v).forEach(([k,x])=>walk(x,k));return;}
      if(typeof v!=='string')return;
      // Expressions use $tag; direct references only in known reference fields.
      for(const m of v.matchAll(/\$([^\s,;()]+)/g))if(tags.has(m[1]))found.add(m[1]);
      if(key==='exec')for(const m of v.matchAll(/(?:^|\s)(?:jump|goto)\s+([^\s,;()]+)/g))if(tags.has(m[1]))found.add(m[1]);
      if(['entry','exec','executor','executors','primary','secondary','sets','provider','providers'].includes(key)&&tags.has(v))found.add(v);
    }
    walk(p.args);return [...found];
  }
  const users=(p,plugins)=>plugins.filter(x=>x.tag!==p.tag&&refs(x,plugins).includes(p.tag));
  function updates(p,plugins) {
    const paths=files(p);
    const downloads=plugins.filter(x=>x.type==='download'&&array(x.args?.downloads).some(d=>paths.includes(downloadPath(d))));
    const reloads=plugins.filter(x=>x.type==='reload_provider'&&refs(x,plugins).includes(p.tag));
    // Follow dependencies transitively so Cron -> sequence -> download is visible.
    const targets=new Set([...downloads,...reloads].map(x=>x.tag));
    let changed=true;while(changed){changed=false;for(const x of plugins)if(!targets.has(x.tag)&&refs(x,plugins).some(t=>targets.has(t))){targets.add(x.tag);changed=true;}}
    return {downloads,reloads,schedules:plugins.filter(x=>x.type==='cron'&&targets.has(x.tag))};
  }
  function downloadPath(d){let name=d.filename;try{if(!name)name=new URL(d.url).pathname.split('/').pop();}catch{}return d.path||(d.dir&&name?d.dir.replace(/\/$/,'')+'/'+name:'');}
  function source(p){const count=array(p.args?.[fields[p.type]]).length;return {count,label:[count?(fields[p.type]==='selectors'?'分类选择':p.type==='dynamic_domain_set'?'初始化':'内联'):'',files(p).length?'文件':'',array(p.args?.sets).length?'集合引用':''].filter(Boolean).join(' + ')||'未设置内容'};}
  function validate(type,args){
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('完整参数必须是 JSON 对象。');
    for(const key of [fields[type],'files','sets'].filter(Boolean))if(Object.hasOwn(args,key)&&(!Array.isArray(args[key])||args[key].some(v=>typeof v!=='string')))throw Error(key+' 必须是字符串数组。');
    const key=type==='dynamic_domain_set'?'path':['geosite','geoip'].includes(type)?'file':null;
    if(key&&(typeof args[key]!=='string'||!args[key].trim()))throw Error(key+' 需要填写文件路径。');
    if(type==='dynamic_domain_set')for(const name of ['queue_size','batch_size','flush_interval_ms'])if(Object.hasOwn(args,name)&&(!Number.isSafeInteger(args[name])||args[name]<=0))throw Error(name+' 必须是正整数。');
    return args;
  }
  function replaceLines(args,key,text){return {...copy(args),[key]:text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'))};}
  const api={fields,copy,array,files,refs,users,updates,source,validate,replaceLines,downloadPath};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.OxiManageModel=api;
})(typeof window==='object'?window:globalThis);
