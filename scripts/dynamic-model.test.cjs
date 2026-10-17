const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../oxidns-dynamic-model.js'),M=require('../oxidns-observe-model.js');
test('rules retain explicit expressions, collapse exact duplicates and default bare domains to full',()=>{
  assert.deepEqual(D.rules(' Example.COM\nregexp:^(a|b)\\.test$\nExample.COM\n'),{rules:['Example.COM','regexp:^(a|b)\\.test$'],rule_kind:'full'});
  assert.equal(D.rules(['domain:example.test'],'full').rules[0],'domain:example.test');
  for(const x of ['',[],[1],Array.from({length:201},(_,i)=>'full:'+i+'.test'),'a'.repeat(65537)])assert.throws(()=>D.rules(x));
  assert.throws(()=>D.rules('a','regexp'));
});
test('runtime response validates empty and multi-page lists without accepting invalid cursors',()=>{
  assert.equal(D.page({ok:true,total:0,rules:[],next_cursor:null}).total,0);
  assert.equal(D.page({ok:true,total:200,rules:['full:a.test'],next_cursor:100}).next_cursor,100);
  for(const value of [{},{ok:true,total:0,rules:[],next_cursor:0},{ok:true,total:1,rules:[null],next_cursor:null}])assert.throws(()=>D.page(value));
  assert.throws(()=>D.page({ok:true,total:200,rules:[],next_cursor:100},100));
});
test('runtime types are human-readable without altering the original expression',()=>{
  assert.deepEqual(D.describe('domain:example.test'),{kind:'域名及子域名',value:'example.test'});
  assert.equal(D.describe('regexp:^<test>$').value,'^<test>$');assert.equal(D.describe('future:rule').kind,'原始规则');
});
test('read-only allowlist permits list but never permits clear through GET',()=>{
  assert.equal(M.readPath('/api/plugins/learned/rules?limit=100'),'/api/plugins/learned/rules?limit=100');
  assert.throws(()=>M.readPath('/api/plugins/learned/rules/clear'));
  assert.throws(()=>D.mutation({ok:true,total:0}));
});
