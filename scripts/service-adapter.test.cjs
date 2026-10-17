const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const M=require('../oxidns-observe-model.js');
const yaml=require('../vendor/js-yaml.min.js');
const base='http://127.0.0.1:9199';
const original={log:{level:'info'},plugins:[{tag:'dns',type:'udp_server',args:{listen:':53',entry:'main'}},{tag:'main',type:'sequence',args:[{exec:'accept'}]},{tag:'cache',type:'cache',args:{size:1000,unknown:{keep:true}}}]};
const changed=()=>{const c=structuredClone(original);c.plugins[2].args.size=2000;return c;};
async function harness(options={}){
  const calls=[];let source={base,version:'old',config:structuredClone(original),content:yaml.dump(original)},config=structuredClone(options.config||original),version=options.conflict?'external':'old',running=options.unapplied?'previous':version,backups=0,reloading=false;
  if(options.noSource)source=null;
  const el={textContent:'',dataset:{},classList:{contains:()=>false},setAttribute(){},addEventListener(){},matches:()=>false};
  const document={querySelector:s=>s==='dialog[open]'?null:el,querySelectorAll:()=>[],body:{dataset:{}},hidden:false};
  const engine={catalog:[{kind:'cache',type:'executor'}],revision:()=>0,isDirty:()=>false,config:()=>structuredClone(config),routeInfo:{},serviceSource:()=>source,
    backupService(){if(options.backupFail)throw Error('backup unavailable');backups++;},
    adoptService(b,file,c,force=false){if(force){source={base:b,version:file.version,config:structuredClone(c),content:file.content};config=structuredClone(c);}}
  };
  const context={window:{OxiObserveModel:M,OxiAdvancedModel:require('../oxidns-advanced-model.js'),OxiDynamicModel:require('../oxidns-dynamic-model.js'),OxiEngine:engine,jsyaml:yaml,addEventListener(){}},document,localStorage:{getItem:()=>null,setItem(){}},URL,URLSearchParams,AbortController,TextEncoder,TextDecoder,console,queueMicrotask,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},Date,
    fetch:async(url,init)=>{
      const p=new URL(url).pathname,method=init.method||'GET',body=init.body?(init.headers?.['Content-Type']==='application/octet-stream'?init.body:JSON.parse(init.body)):null;
      calls.push({p,method,body});let data;
      if(p==='/api/logs/stream'){
        if(options.streamDenied)return new Response('denied',{status:401});
        return new Response(new ReadableStream({start(controller){const bytes=new TextEncoder().encode('event: log\r\ndata: {"message":"中文流"}\r\n\r\n');controller.enqueue(bytes.slice(0,30));controller.enqueue(bytes.slice(30));},cancel(){options.cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}});
      }
      if(p==='/api/build')data={build:{version:'1.6.1',supported_plugins:{}}};
      else if(p==='/api/control')data={status:'running',reload:{running_version:running}};
      else if(p==='/api/system')data={version:'1.6.1'};
      else if(p==='/api/config'&&method==='GET')data={format:'yaml',content:yaml.dump(config),version,path:'/opt/oxidns/config.yaml'};
      else if(p==='/api/config/validate'){
        if(options.holdValidation)await options.holdValidation;
        if(options.invalid)return new Response(JSON.stringify({ok:false,message:'invalid configuration'}),{status:400});
        data={ok:true,plugin_count:3};
      }
      else if(p==='/api/config'&&method==='PUT'){
        if(options.writeConflict)return new Response(JSON.stringify({ok:false}),{status:409});
        assert.equal(body.base_version,'old');assert.equal(body.validate,true);assert.equal(body.reload,false);
        config=yaml.load(body.content);version='new';data={ok:true,version};
      }
      else if(p==='/api/reload'){reloading=true;data={ok:true};}
      else if(p==='/api/plugins/cache/dump')return new Response(new Uint8Array([0,255,1,2]),{headers:{'Content-Type':'application/octet-stream'}});
      else if(p==='/api/plugins/cache/load_dump'){assert.ok(body instanceof Uint8Array);data={ok:true,loaded_entries:2};}
      else if(p==='/api/plugins/cache/entries/abc')data={ok:true,deleted:true};
      else if(p==='/api/upgrade/check')data={ok:true,current_version:'1.6.1',latest_version:'1.6.2'};
      else if(p==='/api/upgrade/apply')data={ok:true,status:'accepted'};
      else if(p==='/api/upgrade/status')data={ok:false,state:'failed',error:'test failure'};
      else if(p==='/api/reload/status'){
        if(options.reloadFail)data={status:'failed',running_version:running,last_error:'plugin start failed'};
        else {if(reloading)running=version;data={status:'ok',running_version:running,pending:false,in_progress:false};}
      }
      else if(p==='/api/plugins/learned/rules'&&method==='GET')data={ok:true,total:1,next_cursor:null,rules:['full:example.test']};
      else if(p==='/api/plugins/learned/rules'||p==='/api/plugins/learned/rules/clear'){
        if(options.holdMutation)await options.holdMutation;
        if(options.mutationFail)return new Response(JSON.stringify({message:'disk failure'}),{status:500});
        data=options.badMutation?{}:{ok:true,added:method==='POST'&&!p.endsWith('/clear')?1:0,removed:method==='DELETE'||p.endsWith('/clear')?1:0,total:1};
      }
      else throw Error('Unexpected endpoint '+method+' '+p);
      return new Response(JSON.stringify(data),{status:200});
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../oxidns-observe.js'),'utf8'),context);
  const api=context.window.OxiObserve;
  api.install({route:()=> 'config',refresh(){},toast(){}});
  for(let i=0;i<30&&!api.isReady();i++)await new Promise(setImmediate);
  assert.ok(api.isReady(),'mock service connected');calls.length=0;
  return {api,calls,backupCount:()=>backups,getSource:()=>source,getConfig:()=>config};
}
test('unbound/sample drafts and cross-service writes are rejected',async()=>{
  const h=await harness({noSource:true});await assert.rejects(h.api.applyConfig(changed()),/示例|来源/);
  assert.ok(!h.calls.some(c=>c.method==='PUT'));
  assert.throws(()=>M.assertApplySource({base:'http://other',version:'old',config:original},base,{version:'old'},changed()),/其他服务/);
});
test('stale versions, unapplied files, global changes and empty plugins block application',async()=>{
  for(const options of [{conflict:true},{unapplied:true}]){const h=await harness(options);await assert.rejects(h.api.applyConfig(changed()));assert.ok(!h.calls.some(c=>c.method==='PUT'));}
  const h=await harness();const global=changed();global.log.level='debug';await assert.rejects(h.api.applyConfig(global),/全局配置/);
  await assert.rejects(h.api.applyConfig({plugins:[]}),/空配置/);
});
test('validation failure and unavailable backup never reach PUT or reload',async()=>{
  for(const options of [{invalid:true},{backupFail:true}]){const h=await harness(options);await assert.rejects(h.api.applyConfig(changed()));assert.ok(!h.calls.some(c=>c.method==='PUT'||c.p==='/api/reload'));}
});
test('no-op configuration does not rewrite YAML or reload',async()=>{
  const h=await harness();const result=await h.api.applyConfig(original);assert.equal(result.unchanged,true);assert.ok(!h.calls.some(c=>c.method!=='GET'));assert.equal(h.backupCount(),0);
});
test('confirmed pipeline validates, backs up, uses source version, preserves unknown fields and verifies running version',async()=>{
  const h=await harness();const result=await h.api.applyConfig(changed());assert.equal(result.version,'new');assert.equal(h.backupCount(),1);
  assert.equal(h.getConfig().plugins[2].args.unknown.keep,true);assert.equal(h.getSource().version,'new');
  const writes=h.calls.filter(c=>c.method!=='GET');assert.deepEqual(writes.map(c=>[c.method,c.p]),[['POST','/api/config/validate'],['PUT','/api/config'],['POST','/api/reload']]);
});
test('backend 409 does not trigger reload',async()=>{
  const h=await harness({writeConflict:true});await assert.rejects(h.api.applyConfig(changed()),/冲突/);assert.ok(!h.calls.some(c=>c.p==='/api/reload'));
});
test('reload failure is reported as saved-but-not-running, not as no write',async()=>{
  const h=await harness({reloadFail:true});await assert.rejects(h.api.applyConfig(changed()),/文件已保存.*运行结果未确认/);assert.equal(h.getSource().version,'new');assert.equal(h.backupCount(),1);
});
test('double application is blocked while first validation is pending',async()=>{
  let release;const holdValidation=new Promise(r=>release=r);const h=await harness({holdValidation});
  const first=h.api.applyConfig(changed());await assert.rejects(h.api.applyConfig(changed()),/已有操作/);release();await first;
  assert.equal(h.calls.filter(c=>c.method==='PUT').length,1);
});
test('sample-only plugin tag cannot trigger runtime operation',async()=>{
  const h=await harness();await assert.rejects(h.api.runAction('flush','sample_cache'),/不是已载入/);assert.ok(!h.calls.some(c=>c.p.endsWith('/flush')));
});
test('binary cache dump round-trips without JSON conversion and deletion uses exact key',async()=>{
 const h=await harness(),scope=h.api.scope('cache');
 const blob=await h.api.request('/api/plugins/cache/dump',{binary:true});assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[0,255,1,2]);
 const bytes=new Uint8Array([0,255,1,2]);await h.api.runAction('cache-load','cache',{scope,confirmTag:'cache',data:bytes});assert.equal(h.calls.find(c=>c.p.endsWith('/load_dump')).body,bytes);
 await h.api.runAction('cache-delete','cache',{scope,id:'abc'});assert.equal(h.calls.at(-1).method,'DELETE');
 await assert.rejects(h.api.runAction('cache-load','cache',{scope,confirmTag:'wrong',data:bytes}));
 await assert.rejects(h.api.runAction('cache-delete','cache',{scope:{...scope,connection:-1},id:'abc'}));
});
test('explicit global save preserves raw comments and never reloads',async()=>{
 const h=await harness(),config=changed();config.log.level='debug';const content='# preserve comment\n'+yaml.dump(config);
 await h.api.applyConfig(config,{allowGlobals:true,reload:false,content});assert.equal(h.calls.find(c=>c.method==='PUT').body.content,content);assert.ok(!h.calls.some(c=>c.p==='/api/reload'));
 const h2=await harness();await assert.rejects(h2.api.applyConfig(config,{allowGlobals:true,reload:true}),/不能|先保存/);assert.ok(!h2.calls.some(c=>c.method==='PUT'));
 await assert.rejects(h.api.runAction('reload'),/全局配置/);
});
test('plugin-only save can be hot-reloaded in a separate explicit operation',async()=>{
 const h=await harness();await h.api.applyConfig(changed(),{reload:false});assert.ok(!h.calls.some(c=>c.p==='/api/reload'));
 const result=await h.api.runAction('reload');assert.equal(result.running_version,'new');
});
test('upgrade apply needs scoped confirmation and failed status is displayable, not swallowed',async()=>{
 const h=await harness(),scope=h.api.scope('');await assert.rejects(h.api.runAction('upgrade-apply','',{scope,options:{bundle:'full'}}),/确认/);
 const result=await h.api.runAction('upgrade-apply','',{scope,options:{bundle:'full'},backedUp:true,confirmTarget:base});assert.equal(result.status,'accepted');
 const status=await h.api.request('/api/upgrade/status');assert.equal(status.state,'failed');assert.equal(status.error,'test failure');
});
test('SSE transport decodes chunked Unicode and cancellation releases the reader',async()=>{
 const options={},h=await harness(options),rows=[],states=[];
 const stop=h.api.subscribe('/api/logs/stream?tail=0',{event:'log',onEvent:r=>rows.push(r),onState:s=>states.push(s)});
 for(let i=0;i<10&&!rows.length;i++)await new Promise(setImmediate);
 assert.equal(rows[0].message,'中文流');stop();
 await new Promise(setImmediate);assert.equal(options.cancelled,true);
 assert.ok(states.some(s=>s.includes('实时接收')));
});
test('SSE authentication failure stops without an automatic retry loop',async()=>{
 const h=await harness({streamDenied:true}),states=[];
 const stop=h.api.subscribe('/api/logs/stream?tail=0',{event:'log',onEvent(){},onState:s=>states.push(s)});
 for(let i=0;i<10;i++)await new Promise(setImmediate);stop();assert.ok(states.some(s=>s.includes('401')));assert.equal(h.calls.filter(c=>c.p==='/api/logs/stream').length,1);
});
const dynamicConfig={plugins:[{tag:'learned',type:'dynamic_domain_set',args:{path:'qa.txt',bootstrap_rules:['full:bootstrap.test']}}]};
test('runtime list is separate from bootstrap; mutations use exact API methods and do not save config',async()=>{
  const h=await harness({config:dynamicConfig});const snapshot=await h.api.dynamicRules('learned');
  assert.deepEqual(snapshot.page.rules,['full:example.test']);assert.equal(snapshot.path,'qa.txt');
  await h.api.runAction('dynamic-add','learned',{scope:snapshot.scope,rules:['example.test'],rule_kind:'domain'});
  await h.api.runAction('dynamic-remove','learned',{scope:snapshot.scope,rules:['full:example.test']});
  await h.api.runAction('dynamic-clear','learned',{scope:snapshot.scope,confirmTag:'learned'});
  const writes=h.calls.filter(c=>c.method!=='GET');
  assert.deepEqual(writes.map(c=>[c.method,c.p]),[['POST','/api/plugins/learned/rules'],['DELETE','/api/plugins/learned/rules'],['POST','/api/plugins/learned/rules/clear']]);
  assert.equal(writes[0].body.rule_kind,'domain');assert.deepEqual(h.getConfig(),dynamicConfig);
});
test('runtime writes reject unbound, wrong-source, stale-view and unconfirmed clear operations',async()=>{
  const h=await harness({config:dynamicConfig});const {scope}=await h.api.dynamicRules('learned');
  for(const bad of [undefined,{...scope,base:'http://other'},{...scope,connection:-1},{...scope,version:'stale'},{...scope,tag:'other'}])await assert.rejects(h.api.runAction('dynamic-add','learned',{scope:bad,rules:['example.test']}),/来源已变化/);
  await assert.rejects(h.api.runAction('dynamic-clear','learned',{scope,confirmTag:'wrong'}),/清空需要/);
  await assert.rejects(h.api.dynamicRules('draft-only'),/未在已连接服务/);
  await assert.rejects(h.api.dynamicRules('learned',-1),/分页/);
  assert.equal(h.calls.filter(c=>c.method!=='GET').length,0);
});
test('runtime writes remain blocked on unapplied configuration and concurrent operations',async()=>{
  const stale=await harness({config:dynamicConfig,unapplied:true});const snapshot=await stale.api.dynamicRules('learned');
  await assert.rejects(stale.api.runAction('dynamic-add','learned',{scope:snapshot.scope,rules:['example.test']}),/文件或运行版本/);
  let release;const holdMutation=new Promise(r=>release=r);const h=await harness({config:dynamicConfig,holdMutation});const {scope}=await h.api.dynamicRules('learned');
  const first=h.api.runAction('dynamic-add','learned',{scope,rules:['example.test']});
  await assert.rejects(h.api.runAction('dynamic-add','learned',{scope,rules:['example.test']}),/已有操作/);release();await first;
  assert.equal(h.calls.filter(c=>c.method==='POST').length,1);
});
test('runtime failure or malformed success is not treated as success and never auto-retried',async()=>{
  for(const options of [{mutationFail:true},{badMutation:true}]){
    const h=await harness({config:dynamicConfig,...options});const {scope}=await h.api.dynamicRules('learned');
    await assert.rejects(h.api.runAction('dynamic-add','learned',{scope,rules:['example.test']}),/disk failure|无法确认/);
    assert.equal(h.calls.filter(c=>c.method==='POST').length,1);assert.equal(h.api.busy(),false);
  }
});
