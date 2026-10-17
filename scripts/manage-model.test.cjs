const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../oxidns-manage-model.js');
test('editing lines preserves files, sets and unrecognized nested fields',()=>{
  const args={exps:['old'],files:['/a'],sets:['shared'],future:{x:[1,2]}};
  const result=M.replaceLines(args,'exps','domain:cn\n# comment\nfull:test.cn');
  assert.deepEqual(result,{...args,exps:['domain:cn','full:test.cn']});assert.deepEqual(args.exps,['old']);
});
test('reference matching distinguishes tag prefixes and literal strings',()=>{
  const p={tag:'main',args:[{exec:'$cn_more'},{matches:['qname $cn'],exec:'$forward'}]};
  const all=[p,...['cn','cn_more','forward'].map(tag=>({tag}))];
  assert.deepEqual(M.refs(p,all),['cn_more','cn','forward']);
  assert.deepEqual(M.refs({args:{path:'cn',note:'cn'}},all),[]);
});
test('updates follows download path, reload args and indirect cron sequence',()=>{
  const p={tag:'cn',type:'domain_set',args:{files:['/etc/oxidns/cn.txt']}};
  const all=[p,{tag:'dl',type:'download',args:{downloads:[{dir:'/etc/oxidns',filename:'cn.txt',url:'https://example.com/cn.txt'}]}},{tag:'reload',type:'reload_provider',args:['$cn']},{tag:'refresh',type:'sequence',args:[{exec:'$dl'},{exec:'$reload'}]},{tag:'timer',type:'cron',args:{jobs:[{executors:['$refresh'],interval:'5m'}]}}];
  const u=M.updates(p,all);assert.equal(u.downloads[0].tag,'dl');assert.equal(u.reloads[0].tag,'reload');assert.equal(u.schedules[0].tag,'timer');
});
test('all six provider types preserve native content semantics',()=>{
  assert.equal(Object.keys(M.fields).length,6);
  assert.equal(M.fields.dynamic_domain_set,'bootstrap_rules');
  assert.equal(M.fields.geosite,'selectors');
  assert.throws(()=>M.validate('domain_set',{exps:{bad:true}}));
  assert.throws(()=>M.validate('geoip',{}));
  assert.throws(()=>M.validate('domain_set',null));
  assert.deepEqual(M.validate('domain_set',{exps:[],future:true}),{exps:[],future:true});
});
test('jump and goto dependencies participate in references and scheduled updates',()=>{
  const all=[{tag:'cn',type:'domain_set',args:{files:['/cn.txt']}},{tag:'dl',type:'download',args:{downloads:[{path:'/cn.txt'}]}},{tag:'wrapper',type:'sequence',args:[{exec:'jump dl'}]},{tag:'scheduled',type:'sequence',args:[{exec:'goto wrapper'}]},{tag:'timer',type:'cron',args:{jobs:[{executors:['$scheduled']}]}}];
  assert.deepEqual(M.refs(all[2],all),['dl']);
  assert.deepEqual(M.refs({args:{note:'jump dl'}},all),[]);
  assert.equal(M.updates(all[0],all).schedules[0].tag,'timer');
});
test('dynamic collection queue parameters reject invalid integers without removing unknown fields',()=>{
  for(const value of [0,-1,1.2,'12',null])assert.throws(()=>M.validate('dynamic_domain_set',{path:'/learned.txt',queue_size:value}));
  assert.equal(M.validate('dynamic_domain_set',{path:'/learned.txt',queue_size:12,future:123}).future,123);
});
