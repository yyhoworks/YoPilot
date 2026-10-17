const test=require('node:test'),assert=require('node:assert/strict'),M=require('../oxidns-advanced-model');
const config={extra:{keep:true},plugins:[{tag:'cache',type:'cache',args:{unknown:true}},{tag:'cache2',type:'cache'},{tag:'main',type:'sequence',args:[{exec:'$cache'},{exec:'$cache2'}]},{tag:'dns',type:'udp_server',args:{entry:'main'}}]};
const edges=[{source_tag:'main',target_tag:'cache',field:'args[0].exec'}];
test('deletion refuses live references and unknown paths without mutating input',()=>{
 const before=structuredClone(config);assert.throws(()=>M.mutatePlugin(config,edges,'cache'),/引用/);assert.deepEqual(config,before);
 assert.throws(()=>M.mutatePlugin(config,[{...edges[0],field:'args.__proto__.x'}],'cache',{replacement:'cache2'}),/不安全/);
 assert.throws(()=>M.mutatePlugin({...config,include:['other.yaml']},[],'cache'),/include/);
});
test('replacement changes only referenced fields, preserves unknowns and tag prefixes',()=>{
 const next=M.mutatePlugin(config,edges,'cache',{replacement:'cache2'});assert.equal(next.plugins.length,3);assert.deepEqual(next.extra,{keep:true});assert.equal(next.plugins.find(p=>p.tag==='main').args[0].exec,'$cache2');
 assert.equal(M.substitute('qname $cache $cache2 !$cache','cache','new'),'qname $new $cache2 !$new');
 assert.equal(M.substitute('jump cache','cache','new'),'jump new');
});
test('rename updates self references and rejects invalid or existing tags',()=>{
 const next=M.mutatePlugin(config,edges,'cache',{rename:'new.cache'});assert.equal(next.plugins[0].tag,'new.cache');assert.equal(next.plugins[2].args[0].exec,'$new.cache');
 for(const rename of ['cache2','bad/tag','_bad','qs.exec.tag','a..b'])assert.throws(()=>M.mutatePlugin(config,edges,'cache',{rename}));
});
test('remove mode only permits safe array references, not entry or exec',()=>{
 assert.throws(()=>M.mutatePlugin(config,edges,'cache',{removeRefs:true}),/不能直接移除/);
 const c={plugins:[{tag:'a',type:'domain_set'},{tag:'b',type:'domain_set',args:{sets:['a','a','x']}}]};
 const es=[0,1].map(i=>({source_tag:'b',target_tag:'a',field:`args.sets[${i}]`}));assert.deepEqual(M.mutatePlugin(c,es,'a',{removeRefs:true}).plugins[0].args.sets,['x']);
});
test('history is service/path scoped, bounded, deduplicated and preserves original YAML',()=>{
 assert.notEqual(M.historyKey('http://host','a'),M.historyKey('http://host','b'));assert.notEqual(M.historyKey('http://host','a'),M.historyKey('http://other','a'));
 let rows=[];for(let i=0;i<25;i++)rows=M.remember(rows,{version:String(i),content:'# comment\nplugins: []'});assert.equal(rows.length,20);
 rows=M.remember(rows,{version:'24',content:'# comment\nplugins: []'},'applied');rows=M.remember(rows,{version:'24',content:'# comment\nplugins: []'});assert.equal(rows.length,20);assert.equal(rows[0].status,'applied');assert.match(rows[0].content,/# comment/);
});
test('upgrade accepts only API options, excludes backup flags and validates bundle/repository',()=>{
 const options=M.upgradeOptions({target:' v1.6.1 ',bundle:'full',repository:'svenshi/oxidns',github_token:'secret',force:true,skip_webui:true});assert.equal(options.target,'v1.6.1');assert.equal(options.skip_webui,undefined);
 assert.throws(()=>M.upgradeOptions({bundle:'all'}));assert.throws(()=>M.upgradeOptions({repository:'https://github.com/x'}));
});
test('SSE parser handles chunked CRLF, heartbeat, multiline and multiple frames',()=>{
 const events=[],parse=M.sseParser(e=>events.push(e));parse(': heartbeat\r\n\r');parse('\nevent: log\r\ndata: {"message":\r\ndata: "中文"}\r\n\r');parse('\nevent: record\ndata: {"id":1}\n\n');assert.equal(events.length,2);assert.equal(events[0].data.message,'中文');assert.equal(events[1].event,'record');
});
test('SSE malformed or oversized frames stop rather than growing memory forever',()=>{
 assert.throws(()=>M.sseParser(()=>{})('data: bad\n\n'));assert.throws(()=>M.sseParser(()=>{})('x'.repeat(2*1024*1024+1)),/过大/);
});
