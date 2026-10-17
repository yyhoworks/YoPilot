/* Read-only, explicit statistical scopes for the service overview. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YoPilotOverviewModel=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const RECORD_LIMIT=10000;
  const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  function aggregate(samples,name,tags){
    const rows=samples.filter(s=>s.name===name&&(!tags||tags.has(s.labels.plugin_tag)));
    return rows.length&&rows.every(s=>finite(s.value))?rows.reduce((n,s)=>n+s.value,0):null;
  }
  function inbound(samples,config,catalog){
    const tags=new Set((config.plugins||[]).filter(p=>catalog.some(d=>d.kind===p.type&&d.type==='server')).map(p=>p.tag));
    const covered=new Set(samples.filter(s=>s.name==='server_request_total'&&finite(s.value)&&tags.has(s.labels.plugin_tag)).map(s=>s.labels.plugin_tag));
    const gauges=new Set(samples.filter(s=>s.name==='server_inflight'&&finite(s.value)&&tags.has(s.labels.plugin_tag)).map(s=>s.labels.plugin_tag));
    const total=aggregate(samples,'server_request_total',tags),inflight=aggregate(samples,'server_inflight',tags);
    return {total:covered.size===tags.size&&tags.size?total:null,inflight:gauges.size===tags.size&&tags.size?inflight:null,listeners:tags.size,covered:covered.size};
  }
  function createRateTracker(){
    let previous=null;
    return point=>{
      const old=previous;
      previous=finite(point.total)&&finite(point.uptime)?{...point}:null;
      if(!old||!previous||point.scope!==old.scope||point.version!==old.version)return {value:null,seconds:null};
      const elapsed=point.uptime-old.uptime;
      if(elapsed<1000||elapsed>120000||point.total<old.total)return {value:null,seconds:null};
      return {value:(point.total-old.total)*1000/elapsed,seconds:elapsed/1000};
    };
  }
  function topSummary(payload,kind){
    if(!payload||!finite(payload.sample_size)||!Array.isArray(payload.rows)||payload.rows.some(r=>typeof r.key!=='string'||!finite(r.count)))return {available:false,count:null,rows:[],samples:null,lowerBound:false};
    const normalize=key=>kind==='domains'?(key==='.'?'.':key.toLowerCase().replace(/\.+$/,'')):key;
    const combined=new Map();
    for(const row of payload.rows){const key=normalize(row.key);if(!key)continue;const old=combined.get(key);if(old)old.count+=row.count;else combined.set(key,{key,count:row.count});}
    const rows=[...combined.values()].sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key));
    return {available:true,count:rows.length,rows,samples:payload.sample_size,lowerBound:payload.rows.length>=RECORD_LIMIT};
  }
  function blockScope(config){
    const p=(config.plugins||[]).find(p=>p.tag==='blocked_response'&&p.type==='response'&&p.args?.short_circuit===true);
    if(!p)return null;
    let calls=0,ambiguous=false;
    for(const plugin of config.plugins||[]){
      if(plugin.tag===p.tag)continue;
      if(!JSON.stringify(plugin.args??{}).includes('blocked_response'))continue;
      if(plugin.type!=='sequence'||!Array.isArray(plugin.args)){ambiguous=true;continue;}
      for(const step of plugin.args){
        if(!JSON.stringify(step).includes('blocked_response'))continue;
        const conditions=Array.isArray(step.matches)?step.matches:[step.matches];
        if(step.exec==='$blocked_response'&&conditions.includes('qname $blocked'))calls++;else ambiguous=true;
      }
    }
    return calls&&!ambiguous?{tag:p.tag,provider:'blocked'}:null;
  }
  function blocked(config,payload){
    const scope=blockScope(config);
    if(!scope)return {available:false,count:null,rate:null,samples:null,reason:'未识别专用黑名单应答流程'};
    if(!payload||!finite(payload.query_total)||!Array.isArray(payload.stats))return {...scope,available:false,count:null,rate:null,samples:null,reason:'执行轨迹统计不可用'};
    if(payload.query_total>0&&!payload.stats.some(p=>p.kind==='executor'))return {...scope,available:false,count:null,rate:null,samples:payload.query_total,reason:'样本未采集执行器轨迹'};
    const row=payload.stats.find(p=>p.kind==='executor'&&p.tag===scope.tag);
    const count=row?.query_total??0;
    if(!finite(count)||count>payload.query_total)return {...scope,available:false,count:null,rate:null,samples:null,reason:'拦截统计响应无效'};
    return {...scope,available:true,count,rate:payload.query_total?count/payload.query_total:null,samples:payload.query_total};
  }
  function upstreams(samples,config){
    return (config.plugins||[]).filter(p=>p.type==='forward').map(p=>{
      const tags=new Set([p.tag]),calls=aggregate(samples,'forward_upstream_query_total',tags),success=aggregate(samples,'forward_upstream_latency_count',tags),sum=aggregate(samples,'forward_upstream_latency_sum_ms',tags);
      return {p,calls,average:success>0&&sum!==null?sum/success:null,responses:success,errors:aggregate(samples,'forward_upstream_error_total',tags),timeouts:aggregate(samples,'forward_upstream_timeout_total',tags)};
    });
  }
  function duration(ms){if(!finite(ms))return '—';const minutes=Math.floor(ms/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60);return (days?days+' 天 ':'')+hours+' 小时 '+minutes%60+' 分钟';}
  return {RECORD_LIMIT,aggregate,inbound,createRateTracker,topSummary,blockScope,blocked,upstreams,duration};
});
