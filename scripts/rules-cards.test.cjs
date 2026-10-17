const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../yopilot-rules-cards.js'),M=require('../oxidns-manage-model.js'),P=require('../yopilot-presentation.js');
const render=(rows,all=rows,extra={})=>R.render(rows,all,{model:M,presentation:P,label:t=>t,...extra});
const tags=P.definitions.flatMap(g=>g.tags).slice(0,21);

test('scheme C retains every source exactly once, including custom sources, without mutating configuration',()=>{
  const rows=[...tags,'custom_unknown'].map(tag=>({tag,type:'domain_set',args:{exps:['full:example.test'],future:{keep:true}}}));
  const before=JSON.stringify(rows),html=render(rows);
  assert.equal((html.match(/data-yrc-tag=/g)||[]).length,rows.length);
  for(const p of rows)assert.equal((html.match(new RegExp('data-yrc-tag="'+p.tag+'"','g'))||[]).length,1);
  assert.match(html,/data-yrc-group="other"/);assert.equal(JSON.stringify(rows),before);
  assert.doesNotMatch(html,/<table|<thead|已接入分流|固定上游/);
});
test('all six provider types keep their own count semantics and every existing detail path',()=>{
  const rows=Object.keys(M.fields).map(type=>({tag:'custom_'+type,type,args:{[M.fields[type]]:['one','two'],files:['/a.txt'],file:'/geo.dat',path:'/learned.txt'}}));
  const html=render(rows);
  assert.equal((html.match(/data-yrc-tag=/g)||[]).length,6);
  assert.match(html,/2 条初始化规则/);assert.match(html,/2 个分类选择器/);assert.match(html,/2 条内联规则/);
  for(const tab of ['source','refs','content','update','runtime'])assert.match(html,new RegExp('data-mg-tab="'+tab+'"'));
  assert.match(html,/已学习数量请查看运行列表/);assert.match(html,/编辑初始化/);
  assert.doesNotMatch(html,/2 条已学习|2 个域名|规则总数/);
});
test('file summaries stay compact and do not pretend to have read external content',()=>{
  const p={tag:'cn_ip',type:'ip_set',args:{ips:[],files:Array.from({length:9},(_,i)=>'/a/long/path/file-'+i+'.txt'),sets:['shared']}};
  const html=render([p]);
  assert.match(html,/<dd>9 个文件来源<\/dd>/);assert.match(html,/0 条内联规则 · 1 个集合引用/);assert.match(html,/file-0.txt 等 9 个文件/);
  assert.doesNotMatch(html,/file-8.txt/);assert.match(html,/外部文件内容未读取/);
  assert.match(html,/data-mg-tab="source"/);
});
test('static references distinguish unused from used, count all references and keep originals',()=>{
  const p={tag:'cn_domains',type:'domain_set',args:{}};
  assert.match(render([p]),/未引用/);assert.doesNotMatch(render([p]),/已引用 ·/);
  const all=[p,...Array.from({length:5},(_,i)=>({tag:'seq_'+i,type:'sequence',args:[{matches:'qname $cn_domains',exec:'accept'}]}))];
  const html=render([p],all);assert.match(html,/已引用 · 5 处/);assert.match(html,/另有 3 处/);assert.match(html,/查看引用/);
});
test('untrusted tags, paths, names and labels are escaped; dirty texts remain visible',()=>{
  const p={tag:'custom_<x>"',type:'domain_set',args:{files:['/a/<script>.txt']}};
  const html=render([p],[p],{label:()=>'<type>',dirty:()=>true});
  assert.doesNotMatch(html,/<script>|<type>|custom_<x>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;type&gt;/);assert.match(html,/custom_&lt;x&gt;&quot;/);assert.match(html,/有未保存文本/);
});
test('entrypoint and deployment isolate the card change and preserve existing editor callbacks',()=>{
  const source=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),html=source('oxidns-console-prototype.html');
  assert.ok(html.indexOf('yopilot-presentation.js')<html.indexOf('yopilot-rules-cards.js'));
  assert.ok(html.indexOf('yopilot-rules-cards.js')<html.indexOf('oxidns-manage.js'));
  assert.match(html,/yopilot-rules-cards\.css/);assert.match(source('scripts/deploy-ui.py'),/web-assets\.json/);
  assert.match(source('yopilot-rules-cards.css'),/repeat\(auto-fill,minmax\(min\(100%,320px\),1fr\)\)/);
  assert.match(source('oxidns-manage.js'),/openRule\(b\.dataset\.mgRule,b\.dataset\.mgTab\|\|'content'\)/);
  assert.match(source('oxidns-manage.js'),/state\.filters\[route\]/);assert.match(source('oxidns-manage.js'),/window\.OxiDynamic\.mount/);
  assert.doesNotMatch(source('yopilot-rules-cards.js'),/fetch\(|localStorage|\.save\(|PUT|DELETE/);
});
