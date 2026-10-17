const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const G=require('../yopilot-overview-model.js');
const catalog=[{kind:'udp_server',type:'server'},{kind:'tcp_server',type:'server'}];
const metric=(name,tag,value)=>({name,labels:{plugin_tag:tag},value});
const config={plugins:[{tag:'udp',type:'udp_server'},{tag:'tcp',type:'tcp_server'}]};
function blockConfig(){return {plugins:[{tag:'blocked_response',type:'response',args:{rcode:'NOERROR',short_circuit:true}},{tag:'seq_main',type:'sequence',args:[{exec:'$blocked_response',matches:'qname $blocked'}]}]};}
test('inbound totals never double-count executors or partial listener coverage',()=>{
 const s=[metric('server_request_total','udp',12),metric('server_request_total','tcp',3),metric('query_total','seq_main',50),metric('server_inflight','udp',1),metric('server_inflight','tcp',2)];
 assert.deepEqual(G.inbound(s,config,catalog),{total:15,inflight:3,listeners:2,covered:2});
 assert.equal(G.inbound(s.filter(x=>x.labels.plugin_tag!=='tcp'),config,catalog).total,null);
 assert.equal(G.inbound(s.filter(x=>x.name!=='server_inflight'),config,catalog).inflight,null);
 assert.equal(G.inbound([],{},catalog).total,null);
});
test('rate needs two comparable points, accepts measured zero, resets across restarts/scopes/gaps',()=>{
 const sample=G.createRateTracker(),p=(total,uptime,scope='a',version='v')=>({total,uptime,scope,version});
 assert.equal(sample(p(10,10000)).value,null);assert.equal(sample(p(40,25000)).value,2);
 assert.equal(sample(p(40,40000)).value,0);assert.equal(sample(p(2,1000)).value,null);
 assert.equal(sample(p(6,16000,'b')).value,null);assert.equal(sample(p(10,31000,'b','v2')).value,null);
 assert.equal(sample(p(20,300000,'b','v2')).value,null);assert.equal(sample(p(null,310000,'b','v2')).value,null);
 assert.equal(sample(p(30,325000,'b','v2')).value,null);
});
test('dedup counts all returned members, normalizes domain case/trailing dots, preserves IPs',()=>{
 const d=G.topSummary({sample_size:4,rows:[{key:'EXAMPLE.org.',count:2},{key:'example.org',count:1},{key:'other.test.',count:1}]},'domains');
 assert.equal(d.count,2);assert.equal(d.rows.find(r=>r.key==='example.org').count,3);assert.equal(d.samples,4);
 assert.equal(G.topSummary({sample_size:0,rows:[]},'clients').count,0);
 assert.equal(G.topSummary({sample_size:1,rows:[{key:'.',count:1}]},'domains').rows[0].key,'.');
 assert.equal(G.topSummary({sample_size:7,rows:Array.from({length:7},(_,i)=>({key:'10.0.0.'+i,count:1}))},'clients').count,7);
 assert.equal(G.topSummary(undefined,'domains').available,false);
 assert.equal(G.topSummary({sample_size:1,rows:[{key:'x',count:-1}]},'domains').available,false);
});
test('top-list request limit produces an explicit lower bound, not a fabricated exact total',()=>{
 const x=G.topSummary({sample_size:10000,rows:Array.from({length:10000},(_,i)=>({key:'domain-'+i,count:1}))},'domains');
 assert.equal(x.count,10000);assert.equal(x.lowerBound,true);
});
test('blacklist count uses distinct query hits, not execution count, NODATA, NXDOMAIN or all failures',()=>{
 const payload={query_total:100,stats:[{kind:'executor',tag:'blocked_response',query_total:3,executed:6},{kind:'executor',tag:'nodata',query_total:70,executed:70}]};
 const before=JSON.stringify(payload),s=G.blocked(blockConfig(),payload);
 assert.equal(s.count,3);assert.equal(s.rate,.03);assert.equal(JSON.stringify(payload),before);
 assert.equal(G.blocked(blockConfig(),{query_total:20,stats:[{kind:'executor',tag:'forward',query_total:20}]}).count,0);
 assert.equal(G.blocked(blockConfig(),{query_total:0,stats:[]}).count,0);
 assert.equal(G.blocked(blockConfig(),{query_total:20,stats:[]}).available,false);
 assert.equal(G.blocked(blockConfig(),undefined).count,null);
});
test('ambiguous reused blacklist action is withheld, including bare fallback references',()=>{
 const c=blockConfig();c.plugins.push({tag:'fallback_other',type:'fallback',args:{primary:'blocked_response'}});
 assert.equal(G.blockScope(c),null);
 const unguarded=blockConfig();unguarded.plugins[1].args.push({exec:'$blocked_response'});assert.equal(G.blockScope(unguarded),null);
 assert.equal(G.blocked({plugins:[]},{query_total:100,stats:[]}).available,false);
});
test('upstream mean is weighted by response samples, missing/zero-sample metrics stay unavailable',()=>{
 const c={plugins:[{tag:'forward',type:'forward'},{tag:'no-data',type:'forward'}]},s=[metric('forward_upstream_latency_count','forward',2),metric('forward_upstream_latency_count','forward',1),metric('forward_upstream_latency_sum_ms','forward',100),metric('forward_upstream_latency_sum_ms','forward',200),metric('forward_upstream_query_total','forward',7),metric('forward_upstream_error_total','forward',1),metric('forward_upstream_timeout_total','forward',1)];
 const rows=G.upstreams(s,c);assert.equal(rows[0].average,100);assert.equal(rows[0].calls,7);assert.equal(rows[1].average,null);assert.equal(rows[1].calls,null);
});
test('duration does not invent uptime when absent',()=>{
 assert.equal(G.duration(undefined),'—');assert.equal(G.duration(0),'0 小时 0 分钟');assert.equal(G.duration(90060000),'1 天 1 小时 1 分钟');
});
function ui(){
 const ctx={window:{YoPilotOverviewModel:G,OxiObserveModel:require('../oxidns-observe-model.js')},document:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../yopilot-overview.js'),'utf8'),ctx);return ctx.window.YoPilotOverview;
}
test('rendered overview has exactly eight cards, unmeasured values stay dashes, actual zero survives',()=>{
 const api=ui(),inputs={config:{plugins:[]},catalog:[],metrics:[],pools:[],system:{},base:'http://fixture',connection:1,version:'v',range:60};
 const unavailable=api.prepare(inputs),html=api.statistics(unavailable);
 assert.equal((html.match(/data-ypo-stat=/g)||[]).length,8);assert.match(html,/最近最多 10,000 条已保留记录/);assert.doesNotMatch(html,/>0(?:\.0+)?<span>ms/);
 const zero=api.statistics(api.prepare({...inputs,latency:{sample_size:1,avg_ms:0,p95_ms:0,p99_ms:0}}));assert.match(zero,/>0<span>ms/);
 const empty=api.statistics(api.prepare({...inputs,latency:{sample_size:0,avg_ms:0,p95_ms:0}}));assert.doesNotMatch(empty,/>0<span>ms/);
});
test('service summary labels estimated startup and keeps process facts compact and escaped',()=>{
 const html=ui().service({core:{system:{uptime_ms:60000,os:'<os>',arch:'x',process_cpu_percent:0,process_memory_mb:5},control:{status:'running',reload:{running_version:'v'}},file:{version:'v'},config:{plugins:[]},build:{version:'1.6.1'}},base:'http://fixture',controls:'<button>刷新</button>'});
 assert.match(html,/启动时间（估算）/);assert.match(html,/北京时间/);assert.match(html,/&lt;os&gt;/);assert.equal((html.match(/<dt>/g)||[]).length,4);
});
test('entrypoint orders new models before service adapter, requests complete top lists but ranks stay six',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../oxidns-console-prototype.html'),'utf8'),code=fs.readFileSync(path.join(__dirname,'../oxidns-observe.js'),'utf8');
 assert.ok(html.indexOf('yopilot-overview-model.js')<html.indexOf('yopilot-overview.js'));assert.ok(html.indexOf('yopilot-overview.js')<html.indexOf('oxidns-observe.js'));
 assert.match(code,/limit=10000/);assert.match(code,/data\.rows\.slice\(0,6\)/);assert.match(html,/yopilot-overview\.css/);
});
