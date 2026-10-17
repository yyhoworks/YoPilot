const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../oxidns-dynamic-model.js');
const tick=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function harness(options={}){
  const elements=new Map(),calls=[],confirms=[],downloads=[];
  const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,setAttribute(){}});return elements.get(id);};
  const check={dataset:{dynSelect:'0'},checked:false};
  const root={isConnected:true,innerHTML:'',querySelector:get,querySelectorAll:()=>get('#dyn-rows').innerHTML.includes('data-dyn-select')?[check]:[]};
  let fail=options.fail;
  const api={base:()=> 'http://fixture',isReady:()=>true,async dynamicRules(tag,cursor){calls.push(['read',tag,cursor]);if(fail)throw Error('fixture offline');return {scope:{tag,cursor},path:'/fixture/rules.txt',page:{ok:true,total:101,next_cursor:cursor===0?100:null,rules:cursor===0?['full:<unsafe>.test']:['domain:last.test']}};},async runAction(...args){calls.push(args);if(options.writeFail)throw Error('fixture disk failure');return {ok:true,added:1,removed:0,total:102};}};
  const window={OxiDynamicModel:D,OxiObserve:api,OxiEngine:{confirm(...args){confirms.push(args);}}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../oxidns-dynamic.js'),'utf8'),{window});
  window.OxiDynamic.mount(root,{tag:'learned'},{toast(){},download(...args){downloads.push(args);}});
  return {root,get,check,calls,confirms,downloads,recover(){fail=false;}};
}
test('runtime UI paginates actual list, escapes rules, clears selection on filter and exports only page',async()=>{
  const h=harness();await tick();
  assert.match(h.get('#dyn-rows').innerHTML,/&lt;unsafe&gt;/);assert.doesNotMatch(h.get('#dyn-rows').innerHTML,/<unsafe>/);
  h.check.checked=true;h.check.onchange();assert.equal(h.get('#dyn-remove').disabled,false);
  h.get('#dyn-filter').oninput({target:{value:'no-match'}});assert.equal(h.get('#dyn-remove').disabled,true);assert.match(h.get('#dyn-rows').innerHTML,/本页没有匹配/);
  h.get('#dyn-filter').oninput({target:{value:''}});
  await h.get('#dyn-next').onclick();assert.equal(h.calls.at(-1)[2],100);assert.equal(h.get('#dyn-next').disabled,true);
  h.get('#dyn-export').onclick();assert.equal(h.downloads[0][0],'learned-runtime-page-100.txt');assert.equal(h.downloads[0][1],'domain:last.test\n');
  await h.get('#dyn-prev').onclick();assert.equal(h.calls.at(-1)[2],0);
});
test('all runtime mutations require explicit confirmation; clear requires exact tag',async()=>{
  const h=harness();await tick();
  h.get('#dyn-input').oninput({target:{value:'example.test'}});h.get('#dyn-add').onclick();assert.equal(h.calls.filter(c=>c[0]!=='read').length,0);
  await h.confirms[0][2]();assert.equal(h.calls.find(c=>c[0]==='dynamic-add')[2].rules[0],'example.test');assert.equal(h.get('#dyn-input').value,'');
  h.check.checked=true;h.check.onchange();h.get('#dyn-remove').onclick();await h.confirms[1][2]();
  assert.equal(h.calls.find(c=>c[0]==='dynamic-remove')[2].rules[0],'full:<unsafe>.test');
  h.get('#dyn-clear-tag').value='wrong';h.get('#dyn-clear').onclick();assert.equal(h.confirms.length,2);
  h.get('#dyn-clear-tag').value='learned';h.get('#dyn-clear').onclick();await h.confirms[2][2]();assert.ok(h.calls.some(c=>c[0]==='dynamic-clear'));
});
test('read failure disables mutations and offers refresh; write failure keeps input without auto retry',async()=>{
  const h=harness({fail:true});await tick();assert.equal(h.get('#dyn-add').disabled,true);assert.match(h.get('#dyn-error').textContent,/读取失败/);
  h.recover();await h.get('#dyn-refresh').onclick();assert.match(h.get('#dyn-count').textContent,/101/);
  const w=harness({writeFail:true});await tick();w.get('#dyn-input').value='keep.test';w.get('#dyn-input').oninput({target:{value:'keep.test'}});w.get('#dyn-add').onclick();await w.confirms[0][2]();
  assert.equal(w.get('#dyn-input').value,'keep.test');assert.equal(w.get('#dyn-add').disabled,true);assert.match(w.get('#dyn-error').textContent,/disk failure/);assert.equal(w.calls.filter(c=>c[0]==='dynamic-add').length,1);
});
test('leaving detail before confirming prevents a stale-page write',async()=>{
  const h=harness();await tick();h.get('#dyn-input').oninput({target:{value:'example.test'}});h.get('#dyn-add').onclick();h.root.isConnected=false;await h.confirms[0][2]();assert.ok(h.calls.every(c=>c[0]==='read'));
});
