const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../yopilot-presentation.js');
test('grouping retains every rule source exactly once without modifying tags or args',()=>{
  const sources=['cn_domains','custom_cn','foreign_domains','force_fake','blocked','allowed_devices','user_special'].map(tag=>({tag,type:'domain_set',args:{exps:['full:example.test'],extra:{keep:true}}}));
  const before=JSON.stringify(sources),result=P.groups(sources).flatMap(g=>g.items);
  assert.deepEqual(result.map(p=>p.tag).sort(),sources.map(p=>p.tag).sort());
  assert.equal(new Set(result).size,sources.length);assert.equal(JSON.stringify(sources),before);
  assert.equal(P.group(sources.at(-1)),'other');assert.equal(P.name('user_special'),'user_special');
});
test('names and categories stay distinct from runtime tag and geographic guesses',()=>{
  assert.equal(P.name('cn_domains'),'国内域名');assert.equal(P.name('cache_main'),'主缓存');
  assert.equal(P.group({tag:'anything_cn',type:'domain_set',args:{}}),'other');
  assert.equal(P.group({tag:'user_adguard',type:'adguard_rule'}),'filter');
  assert.equal(P.upstream({tag:'ali',addr:'udp://223.5.5.5:53'}),'阿里 DNS');
  assert.equal(P.upstream({tag:'custom',addr:'udp://1.2.3.4:53'}),'custom');
});
