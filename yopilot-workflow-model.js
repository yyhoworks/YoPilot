/* Pure projections: never infer a request outcome from static purpose groups. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YoPilotWorkflowModel=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const arr=x=>Array.isArray(x)?x:[];
  function nodeMetric(samples,node){
    const upstream=typeof node.value==='string'?node.addr:node.value?.tag||node.addr;
    const rows=arr(samples).filter(x=>x.labels?.plugin_tag===node.owner&&x.labels?.upstream===upstream);
    const value=name=>{const x=rows.filter(s=>s.name===name);return x.length?x.reduce((n,s)=>n+s.value,0):null;};
    const count=value('forward_upstream_latency_count'),sum=value('forward_upstream_latency_sum_ms');
    return {calls:value('forward_upstream_query_total'),average:count>0&&sum!==null?sum/count:null,errors:value('forward_upstream_error_total'),timeouts:value('forward_upstream_timeout_total')};
  }
  function ruleSummary(group,fields,files){
    const rules=arr(group.rules),paths=new Set(rules.flatMap(p=>files(p)));
    const count=rules.reduce((n,p)=>n+arr(p.args?.[fields[p.type]]).length,0);
    return `${rules.length} 个规则源${paths.size?' · '+paths.size+' 处文件来源':''}${count?' · '+count+' 个内联/分类/初始化项':''}`;
  }
  function attribution(record,config,aligned=true){
    const steps=arr(record?.steps),all=arr(config?.plugins),byTag=new Map(all.map(p=>[p.tag,p]));
    const matched=[...new Set(steps.filter(s=>s.outcome==='matched'&&s.tag).map(s=>s.tag))];
    const executed=steps.filter(s=>(s.kind==='executor'||s.outcome==='executed')&&s.tag),last=executed.at(-1)?.tag||'';
    const forward=aligned?[...executed].reverse().find(s=>byTag.get(s.tag)?.type==='forward')?.tag||'':'';
    return {matched,last,forward,available:steps.length>0,aligned};
  }
  function sequenceWarning(steps){
    for(let i=0;i<arr(steps).length-1;i++){const s=steps[i];if(!s||typeof s!=='object')continue;const unconditional=s.matches==null||Array.isArray(s.matches)&&!s.matches.length||typeof s.matches==='string'&&!s.matches.trim();if(unconditional&&/^(?:accept|return|reject)(?:\s|$)/.test(String(s.exec||'').trim()))return `第 ${i+1} 步是无条件终止动作；后续 ${steps.length-i-1} 步可能无法执行。请核对，不自动改序。`;}
    return '';
  }
  function validIP(ip){
    if(/^\d+(?:\.\d+){3}$/.test(ip))return ip.split('.').every(x=>/^\d{1,3}$/.test(x)&&Number(x)<=255&&String(Number(x))===x);
    if(!ip.includes(':')||ip.includes('%')||!/^[\da-f:.]+$/i.test(ip))return false;
    try{return new URL('http://['+ip+']/').hostname.startsWith('[');}catch{return false;}
  }
  function parseHosts(text){
    const rows=new Map(),errors=[];
    String(text).split(/\r?\n/).forEach((raw,i)=>{const [body,...notes]=raw.split('#'),parts=body.trim().split(/\s+/);if(!body.trim())return;
      const standard=validIP(parts[0]),ips=standard?[parts[0]]:parts.slice(1),domains=standard?parts.slice(1):[parts[0]];
      if(parts.length<2||!ips.length||ips.some(ip=>!validIP(ip))){errors.push(`第 ${i+1} 行：需要合法 IP 和域名；支持标准 hosts 或 OxiDNS 域名在前格式`);return;}
      for(const value of domains){const domain=value.toLowerCase().replace(/\.$/,'');if(!/^(?:full:|domain:)?[a-z\d_\-]+(?:\.[a-z\d_\-]+)*$/i.test(domain)||domain.length>253){errors.push(`第 ${i+1} 行：不支持或无效的域名 ${value}`);continue;}
        const key=/^(?:full:|domain:)/.test(domain)?domain:'full:'+domain;
        if(!rows.has(key))rows.set(key,{key,ips:[],comment:notes.join('#').trim()});const row=rows.get(key);row.ips=[...new Set([...row.ips,...ips])];
      }
    });return {rows:[...rows.values()],errors};
  }
  function hostsPreview(entries,text,policy='merge'){
    if(!['merge','replace','skip'].includes(policy))throw Error('未知冲突策略');
    const parsed=parseHosts(text),current=arr(entries).map(String),byKey=new Map(),opaque=[];
    current.forEach((line,i)=>{const parsedLine=parseHosts(line);if(parsedLine.errors.length||parsedLine.rows.length!==1){opaque.push(i);return;}const r=parsedLine.rows[0];if(!byKey.has(r.key))byKey.set(r.key,{...r,indexes:[]});const old=byKey.get(r.key);old.indexes.push(i);old.ips=[...new Set([...old.ips,...r.ips])];});
    const changes=parsed.rows.map(r=>{const old=byKey.get(r.key),ips=old&&policy==='merge'?[...new Set([...old.ips,...r.ips])]:old&&policy==='skip'?old.ips:r.ips;
      return {...r,comment:r.comment||old?.comment||'',old:old?.ips||[],indexes:old?.indexes||[],ips,status:old?(policy==='skip'?'跳过':JSON.stringify([...ips].sort())===JSON.stringify([...old.ips].sort())?'无变化':policy==='merge'?'合并':'替换'):'新增'};});
    const remove=new Set(changes.filter(r=>['合并','替换'].includes(r.status)).flatMap(r=>r.indexes)),result=current.filter((_,i)=>!remove.has(i));
    // Inline hosts entries do not accept comments. Keep notes in preview metadata,
    // never send '# note' as an IP token to the native parser.
    for(const r of changes.filter(r=>['合并','替换','新增'].includes(r.status)))result.push(`${r.key} ${r.ips.join(' ')}`);
    return {changes,errors:parsed.errors,entries:result,opaque:opaque.length};
  }
  function upstreamWarnings(plugin,config){
    const warnings=[],all=arr(config?.plugins),tags=new Set(all.map(p=>p.tag));
    if(plugin.type==='fallback')for(const key of ['primary','secondary'])if(plugin.args?.[key]&&!tags.has(plugin.args[key]))warnings.push(`${key==='primary'?'主':'备'}引用不存在：${plugin.args[key]}`);
    for(const u of arr(plugin.args?.upstreams)){if(!u||!['string','object'].includes(typeof u)){warnings.push('上游目标参数格式需检查');continue;}const addr=typeof u==='string'?u:u.addr||'';let parsed;try{parsed=new URL(addr.includes('://')?addr:'udp://'+addr);}catch{warnings.push('地址格式需检查：'+addr);continue;}
      if(['https:','doh:','tls:','tls+pipeline:','quic:','doq:','h3:'].includes(parsed.protocol)&&!validIP(parsed.hostname.replace(/^\[|\]$/g,''))){const hasDial=typeof u==='object'&&u.dial_addr,profile=typeof u==='object'?u.outbound:undefined;const profiles=config?.network?.outbound?.profiles||{},selected=profiles[profile||config?.network?.outbound?.default];
        if(!hasDial&&!u.bootstrap&&(!selected?.resolver||selected.resolver==='system'))warnings.push('域名上游 '+parsed.hostname+'：请核对出口解析器与 Bootstrap，系统 DNS 指向本机时可能环回；不是已确认故障');}
      if(typeof u==='object'&&u.outbound&&!Object.hasOwn(config?.network?.outbound?.profiles||{},u.outbound))warnings.push('出口 Profile 不存在：'+u.outbound);
    }return warnings;
  }
  function upstreamTargets(plugin,config){
    return arr(plugin.args?.upstreams).map(u=>{const v=typeof u==='string'?{addr:u}:u||{},addr=v.addr||'';
      const scheme=addr.includes('://')?addr.split('://')[0].toLowerCase():'udp';
      return {protocol:({https:'DoH',doh:'DoH',tls:'DoT','tls+pipeline':'DoT',quic:'DoQ',doq:'DoQ',h3:'DoH3',tcp:'TCP',udp:'UDP'})[scheme]||scheme,
        outbound:v.socks5?'独立 SOCKS5':v.outbound||config.network?.outbound?.default||'系统默认'};});
  }
  function stepSummary(step,plugins){
    if(!step||typeof step!=='object')return '扩展步骤，请查看完整 JSON';
    if(step.matches!=null&&typeof step.matches!=='string'&&(!Array.isArray(step.matches)||step.matches.some(v=>typeof v!=='string')))return '扩展匹配条件与动作，原样保留；请查看完整 JSON';
    const matches=arr(step.matches).length?step.matches:typeof step.matches==='string'&&step.matches.trim()?[step.matches]:[];
    const action=String(step.exec||''),labels={accept:'结束并返回响应',return:'返回上层策略',reject:'拒绝请求',drop:'丢弃请求'};
    const exact=action.match(/^\$([^\s]+)$/),jump=action.match(/^(jump|goto)\s+(\S+)$/);
    const tag=exact?.[1]||jump?.[2],p=arr(plugins).find(p=>p.tag===tag);
    return (matches.length?'满足 '+matches.length+' 条条件时，':'无条件，')+(labels[action]||(tag?(jump?'跳转至':'执行')+' '+(p?.tag||tag):'执行原始表达式：'+(action||'未填写')));
  }
  function queryFilters(value={}){
    const out={};for(const key of ['qname','qtype','client_ip','rcode','status','matcher_tag'])out[key]=typeof value[key]==='string'?value[key].slice(0,1024):'';
    out.minutes=[15,60,360,1440].includes(Number(value.minutes))?Number(value.minutes):60;return out;
  }
  function configBlocks(text){
    text=String(text);
    if(!text.trimStart().startsWith('{')){const found=[...text.matchAll(/^(?:[A-Za-z_][\w-]*|"[^"\r\n]+"|'[^'\r\n]+')\s*:/gm)];return found.map((m,i)=>({key:m[0].replace(/\s*:$/,''),start:m.index,end:found[i+1]?.index??text.length,text:text.slice(m.index,found[i+1]?.index??text.length),json:false}));}
    let value;try{value=JSON.parse(text);}catch{return [];}
    const result=[];let depth=0,quoted=false,escaped=false,start=-1,stringStart=-1,wantKey=false,key='';
    for(let i=0;i<text.length;i++){const c=text[i];
      if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"'){quoted=false;if(depth===1&&wantKey){key=JSON.parse(text.slice(stringStart,i+1));start=stringStart;wantKey=false;}}continue;}
      if(c==='"'){quoted=true;stringStart=i;continue;}
      if(c==='{'||c==='['){depth++;if(depth===1)wantKey=true;continue;}
      if(c==='}'||c===']'){if(depth===1&&start>=0){result.push({key,start,end:i,text:JSON.stringify({[key]:value[key]},null,2),json:true});start=-1;}depth--;continue;}
      if(c===','&&depth===1){if(start>=0)result.push({key,start,end:i,text:JSON.stringify({[key]:value[key]},null,2),json:true});start=-1;wantKey=true;}
    }return result;
  }
  return {nodeMetric,ruleSummary,attribution,sequenceWarning,validIP,parseHosts,hostsPreview,upstreamWarnings,upstreamTargets,stepSummary,queryFilters,configBlocks};
});
