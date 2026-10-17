const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../oxidns-observe-model.js');

test('latency distinguishes missing data, empty samples and measured zero',()=>{
  assert.deepEqual(M.latencySummary(null),{state:'unavailable',count:null,avg:null,p95:null});
  assert.deepEqual(M.latencySummary({sample_size:0,avg_ms:0,p95_ms:0}),{state:'empty',count:0,avg:null,p95:null});
  assert.deepEqual(M.latencySummary({sample_size:1,avg_ms:0,p95_ms:0}),{state:'ready',count:1,avg:0,p95:0});
  assert.deepEqual(M.latencySummary({sample_size:12,avg_ms:1.25,p95_ms:8}),{state:'ready',count:12,avg:1.25,p95:8});
  assert.equal(M.latencySummary({sample_size:3,avg_ms:NaN,p95_ms:-1}).avg,null);
  assert.equal(M.latencySummary({sample_size:-1}).state,'unavailable');
});

test('connection refuses embedded credentials and non-origin URLs',()=>{
  assert.equal(M.baseURL('http://127.0.0.1:9199/'),'http://127.0.0.1:9199');
  for(const url of ['javascript:alert(1)','http://user:secret@host','http://host/api','http://host/?token=secret'])assert.throws(()=>M.baseURL(url));
});
test('read-only allowlist rejects GET cache flush and control mutations',()=>{
  for(const path of ['/api/restart','/api/reload','/api/plugins/cache_main/flush','/api/plugins/maintenance/jobs/a/run','/api/plugins/rules_download/download'])assert.throws(()=>M.readPath(path));
  for(const path of ['/api/config/check','/api/plugins/query_log/records?limit=50','/api/plugins/cache_main/entries','/api/plugins/query_log/records/5'])assert.equal(M.readPath(path),path);
});
test('cache rate uses cache lookups, combines freshness, excludes resolver cache',()=>{
  const samples=M.metrics('cache_lookup_total{plugin_tag="a"} 10\ncache_hit_total{plugin_tag="a",kind="fresh"} 2\ncache_hit_total{kind="stale",plugin_tag="a"} 1\nnetwork_resolver_cache_hit_total{plugin_tag="a"} 900\ncache_hit_total{plugin_tag="b",kind="fresh"} 9');
  assert.deepEqual(M.cacheStats(samples,'a'),{available:true,lookups:10,hits:3,misses:0,rate:.3});
  assert.equal(M.cacheStats(samples,'unknown').rate,null);
});
test('NXDOMAIN is a DNS result, distinct from execution failure',()=>{
  assert.deepEqual(M.recordStatus({has_response:true,rcode:'Non-Existent Domain'}),{text:'NXDOMAIN',tone:'neutral'});
  assert.equal(M.recordStatus({has_response:true,rcode:'Server Failure'}).tone,'danger');
  assert.equal(M.recordStatus({has_response:true,rcode:'No Error',error:'timeout'}).text,'执行异常');
  assert.equal(M.recordStatus({has_response:false}).text,'无响应');
});
test('config comparison accounts for unknown fields, order and separate source ownership',()=>{
  const file={plugins:[{tag:'x',type:'forward',args:{unknown:{a:1,b:2}}},{tag:'serverOnly',type:'cache'}],other:{nested:'retain'}};
  const draft={other:{nested:'retain'},plugins:[{type:'forward',tag:'x',args:{unknown:{b:2,a:1}}},{tag:'localOnly',type:'hosts'}]};
  const before=JSON.stringify([file,draft]);
  assert.equal(M.compareConfigs(file,draft).rows.find(r=>r.tag==='x').status,'一致');
  assert.equal(M.compareConfigs(file,draft).changed,2);
  assert.equal(JSON.stringify([file,draft]),before);
  draft.plugins[0].args.unknown.a=9;
  assert.equal(M.compareConfigs(file,draft).changed,3);
});
test('query parameters safely encode domain, matchers, cursor and bounded time range',()=>{
  const p=M.queryParams({qname:'a&b.test',client_ip:'::1',matcher_tag:'test+tag',minutes:60,cursor:'123:5',unsupported:'skip'},3600001);
  assert.equal(p.get('since_ms'),'1');assert.equal(p.get('until_ms'),'3600001');
  assert.equal(p.get('qname'),'a&b.test');assert.equal(p.get('cursor'),'123:5');assert.equal(p.has('unsupported'),false);
});
