const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const W=require('../yopilot-workflow-model'),M=require('../oxidns-manage-model');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('native-only entrypoint and deployment keep extensions/binaries out of the release',()=>{
 const html=read('oxidns-console-prototype.html'),deploy=read('scripts/deploy-ui.py'),manifest=JSON.parse(read('web-assets.json'));
 for(const name of ['yopilot-native-pages.js','yopilot-query-tools.js','yopilot-workflow.js','yopilot-workflow-model.js','yopilot-workflow.css']){assert.ok(html.includes(name));assert.ok(manifest.files.includes(name));}
 assert.doesNotMatch(html,/src="yopilot-admin.js/);assert.doesNotMatch(read('yopilot-native-pages.js'),/9200|\/yopilot-api|method:\s*['"](?:POST|PUT|DELETE)/);
 assert.match(deploy,/pidof oxidns/);assert.doesNotMatch(deploy,/rc-service|systemctl|cargo build|yopilot_admin|sftp.put\([^\n]*oxidns\/oxidns/);
});
test('protocol and egress filtering match the same actual upstream and retain defaults',()=>{
 const cfg={network:{outbound:{default:'remote'}}},p={args:{upstreams:['1.1.1.1:53',{addr:'https://dns.example/dns-query',outbound:'direct'},{addr:'tls://dns.example',socks5:'socks5://127.0.0.1:1080'}]}};
 assert.deepEqual(W.upstreamTargets(p,cfg),[{protocol:'UDP',outbound:'remote'},{protocol:'DoH',outbound:'direct'},{protocol:'DoT',outbound:'独立 SOCKS5'}]);
 const rows=W.upstreamTargets(p,cfg);assert.equal(rows.some(r=>r.protocol==='DoH'&&r.outbound==='remote'),false);
});
test('Chinese sequence descriptions do not rewrite complex conditions or invent routing',()=>{
 assert.match(W.stepSummary({exec:'accept'},[]),/无条件.*结束/);assert.match(W.stepSummary({matches:['$cn'],exec:'jump foreign'},[]),/1 条.*跳转至 foreign/);
 assert.match(W.stepSummary({matches:{or:['x']},exec:'accept'},[]),/扩展匹配条件/);assert.equal(W.sequenceWarning([{matches:{or:['x']},exec:'accept'},{exec:'$next'}]),'');
});
test('saved filters discard unknown values, bound lengths and use supported range',()=>{
 const f=W.queryFilters({qname:'x'.repeat(3000),minutes:-1,client_ip:{bad:true},secret:'never'});assert.equal(f.qname.length,1024);assert.equal(f.minutes,60);assert.equal(f.client_ip,'');assert.equal('secret'in f,false);
});
test('config navigation respects top-level JSON structure, escaped strings and unchanged YAML blocks',()=>{
 const text='{"nested":{"api":1}, "api" : {"s":"comma, brace } and \\\"quote"}, "plugins":[]}';
 const blocks=W.configBlocks(text);assert.deepEqual(blocks.map(b=>b.key),['nested','api','plugins']);assert.match(text.slice(blocks[1].start,blocks[1].end),/^"api"\s*:/);assert.deepEqual(JSON.parse(blocks[1].text),{api:{s:'comma, brace } and "quote'}});
 const yaml='# header\napi:\n  http: :9199\nplugins:\n  - tag: x\n';const y=W.configBlocks(yaml);assert.equal(y[0].text,'api:\n  http: :9199\n');assert.equal(yaml.slice(y[1].start,y[1].end),y[1].text);assert.deepEqual(W.configBlocks('{broken'),[]);
});
function hostsHarness(){
 let config={plugins:[{tag:'h',type:'hosts',args:{entries:['full:a.test 192.0.2.1','regexp:^x 192.0.2.5'],files:['keep.txt'],unknown:{stay:true}}}]},revision=0,connection=1;const nodes=new Map(),confirms=[],saves=[];
 const root={isConnected:true,querySelector:s=>get(s)};const get=s=>{if(s==='#yp-host-import')return root;if(!nodes.has(s))nodes.set(s,{value:'',textContent:'',innerHTML:'',disabled:false});return nodes.get(s);};
 const engine={config:()=>structuredClone(config),revision:()=>revision,serviceSource:()=>({base:'fixture',version:'v'}),confirm:(...args)=>confirms.push(args),save:c=>{saves.push(c);config=c;revision++;}};
 const window={OxiEngine:engine,YoPilotWorkflowModel:W,OxiObserve:{scope:()=>({base:'fixture',connection,version:'v'})}};
 const document={addEventListener(){},querySelector:get};vm.runInNewContext(read('yopilot-workflow.js'),{window,document,console});window.YoPilotWorkflow.install({openDrawer(){},closeDrawer(){},refresh(){},toast(){},download(){}});window.YoPilotWorkflow.hosts('h');
 return {get,root,saves,confirms,changeRevision(){revision++;},changeConnection(){connection++;}};
}
test('Hosts import requires fresh preview and confirmation, saves only entries and preserves advanced fields',()=>{
 const h=hostsHarness();h.get('#yp-host-text').value='192.0.2.2 a.test # note';h.get('#yp-host-policy').value='merge';h.get('#yp-host-text').oninput();h.get('#yp-host-preview').onclick();assert.equal(h.get('#yp-host-save').disabled,false);h.get('#yp-host-save').onclick();assert.equal(h.saves.length,0);h.confirms[0][2]();
 const p=h.saves[0].plugins[0];assert.deepEqual(p.args.files,['keep.txt']);assert.deepEqual(p.args.unknown,{stay:true});assert.ok(p.args.entries.includes('regexp:^x 192.0.2.5'));assert.ok(p.args.entries.includes('full:a.test 192.0.2.1 192.0.2.2'));assert.ok(p.args.entries.every(x=>!x.includes('#')));
});
test('Hosts invalid lines, changed input, closed drawer, conflicting draft and switched connection never save stale previews',()=>{
 for(const kind of ['invalid','input','close','revision','connection']){const h=hostsHarness();h.get('#yp-host-text').value=kind==='invalid'?'300.1.1.1 a.test':'192.0.2.2 a.test';h.get('#yp-host-policy').value='replace';h.get('#yp-host-text').oninput();h.get('#yp-host-preview').onclick();if(kind==='input'){h.get('#yp-host-text').value='192.0.2.3 a.test';h.get('#yp-host-text').oninput();}h.get('#yp-host-save').onclick();if(h.confirms.length){if(kind==='close')h.root.isConnected=false;if(kind==='revision')h.changeRevision();if(kind==='connection')h.changeConnection();h.confirms[0][2]();}assert.equal(h.saves.length,0,kind);}
});
function nativeHarness(){
 const nodes=new Map(),calls=[];let resolve,connection=1;const root={isConnected:true,innerHTML:'',querySelector:s=>get(s)};
 const get=s=>{if(s==='#page-content')return root;if(!nodes.has(s))nodes.set(s,{value:s==='#yp-native-recorder'?'r':s==='#yp-native-range'?'60':'',isConnected:true,innerHTML:'',textContent:'',disabled:false});return nodes.get(s);};
 const api={scope:()=>({connection}),isReady:()=>true,serviceConfig:()=>({plugins:[{type:'query_recorder',tag:'r'}]}),request:async url=>{calls.push(url);if(url.includes('/latency?'))await new Promise(r=>resolve=r);return {sample_size:1,avg_ms:0,p95_ms:0,p99_ms:0,rows:[{key:'<unsafe>',count:1,share:1}]};},base:()=> 'fixture'};
 const window={OxiObserve:api,OxiEngine:{routeInfo:{}}},document={querySelector:get};vm.runInNewContext(read('yopilot-native-pages.js'),{window,document,URLSearchParams,Date,console});window.YoPilotAdmin.install({subnav:()=>'',download(){}});window.YoPilotAdmin.render('history');
 return {get,calls,release:()=>resolve(),switchConnection:()=>connection++};
}
test('native stats render true zero, escape API labels and expose sampling limit without sidecar writes',async()=>{
 const h=nativeHarness(),button=h.get('#yp-native-read'),pending=button.onclick({currentTarget:button});h.release();await pending;const html=h.get('#yp-native-result').innerHTML;assert.match(html,/&lt;unsafe&gt;/);assert.match(html,/10,000/);assert.match(html,/<strong>0<\/strong>/);assert.ok(h.calls.every(x=>x.startsWith('/api/plugins/r/stats/')));
});
test('changing range, connection or leaving stats prevents old results from overwriting current UI',async()=>{
 for(const kind of ['range','connection','leave']){const h=nativeHarness(),button=h.get('#yp-native-read'),pending=button.onclick({currentTarget:button});if(kind==='range')h.get('#yp-native-range').onchange();if(kind==='connection')h.switchConnection();if(kind==='leave')h.get('#yp-native-result').isConnected=false;h.release();await pending;assert.equal(h.get('#yp-native-result').innerHTML,'',kind);}
});
test('query details are bounded, source-scoped and cannot treat configuration groups as exact rule hits',()=>{
 const source=read('yopilot-query-tools.js');assert.match(source,/Math.min\(3,rows.length\)/);assert.match(source,/cache.size>400/);assert.match(source,/scope.connection===ctx.scope\(\).connection/);assert.match(source,/scope.version===ctx.scope\(\).version/);assert.match(source,/仅本页，不是全局结果/);assert.match(source,/不等于胜出节点/);assert.doesNotMatch(source,/localStorage.setItem[^\n]*password/);
});
test('mobile advanced tools span the workspace and branch exports contain only confirmed visible rows',()=>{
 assert.match(read('yopilot-workflow.css'),/\.yp-advanced-tools\{grid-column:1\/-1/);assert.match(read('yopilot-query-tools.js'),/rows.filter\(r=>!r.hidden\)/);assert.match(read('yopilot-query-tools.js'),/unavailable:failed/);assert.match(read('yopilot-query-tools.js'),/if\(s.branch\)row.hidden=true/);
});
