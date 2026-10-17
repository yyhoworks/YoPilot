const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../yopilot-workflow-model.js'),M=require('../oxidns-manage-model.js');
test('standard hosts convert to native domain-first syntax without invalid inline comments',()=>{
 const before=['regexp:^api\\.example$ 192.0.2.8','full:example.test 192.0.2.1'];const original=JSON.stringify(before);
 const r=W.hostsPreview(before,'192.0.2.2 example.test # imported\n2001:db8::1 nas.test alias.test');
 assert.deepEqual(r.errors,[]);assert.ok(r.entries.includes('full:example.test 192.0.2.1 192.0.2.2'));assert.ok(r.entries.includes(before[0]));assert.equal(r.changes[0].comment,'imported');assert.ok(r.entries.every(x=>!x.includes('#')));assert.equal(JSON.stringify(before),original);
 assert.equal(W.hostsPreview(before,'192.0.2.3 example.test','skip').entries.length,2);
 assert.ok(W.hostsPreview(before,'example.test 192.0.2.3','replace').entries.includes('full:example.test 192.0.2.3'));
});
test('hosts handles invalid inputs explicitly and preserves opaque advanced rules',()=>{
 assert.ok(W.parseHosts('300.1.1.1 test\n01.2.3.4 test\nnot an ip').errors.length===3);assert.equal(W.validIP('2001:db8::1'),true);assert.equal(W.validIP(':::1'),false);
 assert.deepEqual(W.hostsPreview(['keyword:cdn 192.0.2.1'],'192.0.2.2 new.test').entries,['keyword:cdn 192.0.2.1','full:new.test 192.0.2.2']);
});
test('attribution uses actual events, refuses stale-config forwarding inference, and never invents an expression or node duration',()=>{
 const config={plugins:[{tag:'forward',type:'forward'}]},record={steps:[{tag:'matched-tag',outcome:'matched'},{tag:'forward',kind:'executor',outcome:'next'}]};
 assert.deepEqual(W.attribution(record,config).matched,['matched-tag']);assert.equal(W.attribution(record,config).forward,'forward');assert.equal(W.attribution(record,config,false).forward,'');assert.equal(W.attribution({},config).available,false);
});
test('node latency matches both owner and exact upstream, distinguishes no samples from zero latency',()=>{
 const node={owner:'group',value:{tag:'google'},addr:'https://dns.google/dns-query'};
 const metrics=[{name:'forward_upstream_latency_count',labels:{plugin_tag:'group',upstream:'google'},value:2},{name:'forward_upstream_latency_sum_ms',labels:{plugin_tag:'group',upstream:'google'},value:0},{name:'forward_upstream_latency_sum_ms',labels:{plugin_tag:'other',upstream:'google'},value:100}];
 assert.equal(W.nodeMetric(metrics,node).average,0);assert.equal(W.nodeMetric([],node).average,null);assert.equal(W.nodeMetric([],node).calls,null);
});
test('source summaries do not present file-source count as total rules',()=>{
 const text=W.ruleSummary({rules:[{type:'domain_set',args:{files:['a','b'],exps:['full:x']}}]},M.fields,M.files);assert.match(text,/2 处文件来源/);assert.match(text,/1 个内联/);assert.doesNotMatch(text,/2 条规则/);
});
test('sequence warnings catch later unconditional terminators without reordering or false prefix matches',()=>{
 const steps=[{exec:'$cache'},{matches:' ',exec:'accept'},{exec:'$forward'}],before=JSON.stringify(steps);assert.match(W.sequenceWarning(steps),/第 2 步/);assert.equal(JSON.stringify(steps),before);assert.equal(W.sequenceWarning([{exec:'acceptance'},{exec:'$next'}]),'');assert.equal(W.sequenceWarning([{matches:'qtype A',exec:'accept'},{exec:'$next'}]),'');
});
test('upstream guards are non-mutating advisory checks and respect existing resolver/dial configuration',()=>{
 const p={type:'forward',args:{upstreams:[{addr:'https://dns.example/dns-query',outbound:'missing'}]}},cfg={plugins:[],network:{outbound:{profiles:{}}}},before=JSON.stringify(p);assert.equal(W.upstreamWarnings(p,cfg).length,2);assert.equal(JSON.stringify(p),before);
 assert.deepEqual(W.upstreamWarnings({type:'forward',args:{upstreams:[{addr:'https://dns.example/dns-query',dial_addr:'192.0.2.1:443'}]}},cfg),[]);
 assert.ok(W.upstreamWarnings({type:'fallback',args:{primary:'gone'}},cfg).some(x=>x.includes('引用不存在')));
});
