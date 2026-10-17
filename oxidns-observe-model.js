/* Pure adapters for OxiDNS 1.6.x management responses. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OxiObserveModel = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  'use strict';
  function baseURL(value) {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname)) throw Error('请输入不含账号、路径或参数的 HTTP / HTTPS 服务地址');
    return u.origin;
  }
  function readPath(value) {
    const p = String(value).split('?')[0];
    if (/^\/api\/(build|control|system|config|config\/check|logs|metrics)$/.test(p)) return value;
    if (/^\/api\/plugins\/[^/]+\/(records(?:\/\d+)?|stats\/(?:latency|timeseries|top_clients|top_qnames|rcode|qtype|plugins)|jobs\/status|downloads|entries|rules)$/.test(p)) return value;
    throw Error('此连接仅开放已核实的只读接口');
  }
  function metrics(text) {
    return String(text).split('\n').flatMap(line => {
      const m = line.match(/^([a-zA-Z_:][\w:]*)(?:\{(.*)\})?\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?:\s|$)/i);
      if (!m) return [];
      const labels = {};
      for (const x of (m[2] || '').matchAll(/(\w+)="((?:\\.|[^"\\])*)"/g)) {
        try { labels[x[1]] = JSON.parse('"' + x[2] + '"'); } catch { labels[x[1]] = x[2]; }
      }
      return [{ name:m[1], labels, value:Number(m[3]) }];
    });
  }
  function cacheStats(samples, tag) {
    const matching = samples.filter(x => x.labels.plugin_tag === tag);
    const sum = name => matching.filter(x => x.name === name).reduce((a,x) => a + x.value, 0);
    const lookups = sum('cache_lookup_total');
    const available = matching.some(x => x.name === 'cache_lookup_total');
    return { available, lookups, hits:sum('cache_hit_total'), misses:sum('cache_miss_total'), rate:available && lookups > 0 ? sum('cache_hit_total') / lookups : null };
  }
  function latencySummary(value) {
    if(!value||!Number.isFinite(value.sample_size)||value.sample_size<0)return {state:'unavailable',count:null,avg:null,p95:null};
    if(value.sample_size===0)return {state:'empty',count:0,avg:null,p95:null};
    const metric=n=>Number.isFinite(n)&&n>=0?n:null;
    return {state:'ready',count:value.sample_size,avg:metric(value.avg_ms),p95:metric(value.p95_ms)};
  }
  function rcode(value) {
    const key = String(value || '').replace(/[\s_-]/g,'').toLowerCase();
    return ({noerror:'NOERROR',nonexistentdomain:'NXDOMAIN',nxdomain:'NXDOMAIN',serverfailure:'SERVFAIL',servfail:'SERVFAIL',refused:'REFUSED',queryrefused:'REFUSED',formaterror:'FORMERR',notimplemented:'NOTIMP'})[key] || value || '无响应码';
  }
  function recordStatus(record) {
    if (record.error) return {text:'执行异常',tone:'danger'};
    if (!record.has_response) return {text:'无响应',tone:'warn'};
    const code = rcode(record.rcode);
    return {text:code,tone:code==='NOERROR'?'success':code==='SERVFAIL'?'danger':code==='NXDOMAIN'?'neutral':'warn'};
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
    return value;
  }
  const same = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  function compareConfigs(file, draft) {
    const before = new Map((file.plugins || []).map(p=>[p.tag,p]));
    const after = new Map((draft.plugins || []).map(p=>[p.tag,p]));
    const rows = [...new Set([...before.keys(),...after.keys()])].map(tag => ({tag,type:(after.get(tag)||before.get(tag)).type,status:!before.has(tag)?'仅本地':!after.has(tag)?'仅服务端':same(before.get(tag),after.get(tag))?'一致':'参数不同'}));
    const globals = [...new Set([...Object.keys(file),...Object.keys(draft)])].filter(k=>k!=='plugins'&&!same(file[k],draft[k]));
    return {rows,globals,changed:rows.filter(x=>x.status!=='一致').length};
  }
  function queryParams(filters, now=Date.now()) {
    const p = new URLSearchParams({limit:'50'});
    for (const key of ['qname','qtype','client_ip','rcode','status','matcher_tag','cursor']) if(filters[key]) p.set(key,filters[key]);
    if(filters.minutes) {p.set('since_ms',String(now-Number(filters.minutes)*60000));p.set('until_ms',String(now));}
    return p;
  }
  function assertApplySource(source,base,file,draft,{allowGlobals=false}={}) {
    if(!source?.version||!source?.config)throw Error('请先从服务端载入配置；示例或来源未知的草稿不能应用');
    if(baseURL(source.base)!==baseURL(base))throw Error('草稿属于其他服务，禁止跨服务覆盖');
    if(source.version!==file.version)throw Error('服务端配置已变化。请导出草稿，再重新载入服务端版本并合并修改');
    if(!Array.isArray(draft?.plugins)||!draft.plugins.length)throw Error('配置需要至少一个插件；禁止应用空配置');
    const tags=new Set();
    for(const p of draft.plugins){if(!p||typeof p.tag!=='string'||!p.tag.trim()||typeof p.type!=='string'||!p.type.trim()||tags.has(p.tag))throw Error('插件 tag / type 无效或 tag 重复');tags.add(p.tag);}
    const diff=compareConfigs(source.config,draft);
    if(diff.globals.length&&!allowGlobals)throw Error('全局配置变化（'+diff.globals.join('、')+'）需要显式选择「仅保存到服务」，核对后单独重启；不能热重载');
    return diff;
  }
  return {baseURL,readPath,metrics,cacheStats,latencySummary,rcode,recordStatus,compareConfigs,queryParams,same,assertApplySource};
});
