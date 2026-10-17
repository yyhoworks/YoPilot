const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tick=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function harness(options={}){
 const nodes=new Map(),calls=[],confirms=[],config={plugins:[{tag:'cache',type:'cache'}]};let connection=1;
 const root={isConnected:true,querySelector:s=>get(s),querySelectorAll:()=>[],append(){}};
 const get=s=>{if(s==='.yp-advanced')return root;if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',disabled:false,files:[],classList:{contains:()=>true,toggle(){}},setAttribute(){},querySelector:get});return nodes.get(s);};
 const api={base:()=> 'http://fixture',scope:tag=>({base:'http://fixture',connection,version:'v',tag}),isReady:()=>true,serviceConfig:()=>config,
  async request(path,opts){calls.push(['read',path,opts]);if(options.readFail)throw Error('read failed');return {ok:true,total_entries:2,next_cursor:'50',entries:[{id:'abc',domain:'<unsafe>.test',record_type:'A',dns_class:'IN',remaining_ttl:3,fresh:true}]};},
  async runAction(...args){calls.push(args);if(options.writeFail)throw Error('write failed');return {ok:true,deleted:true,loaded_entries:1};}
 };
 const engine={confirm(...a){confirms.push(a);}};
 const window={OxiAdvancedModel:require('../oxidns-advanced-model'),OxiObserve:api,OxiEngine:engine,addEventListener(){}};
 const document={querySelector:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({click(){}})};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../oxidns-advanced.js'),'utf8'),{window,document,URL,URLSearchParams,setTimeout,clearTimeout,Date,localStorage:{getItem:()=>null,setItem(){}},console});
 window.OxiAdvanced.install({openDrawer(){},toast(){}});window.OxiAdvanced.cache('cache');
 return {get,root,calls,confirms,switchConnection(){connection++;}};
}
test('cache UI escapes payloads and pagination uses server cursor',async()=>{
 const h=harness();await tick();assert.match(h.get('#ac-results').innerHTML,/&lt;unsafe&gt;/);assert.doesNotMatch(h.get('#ac-results').innerHTML,/<unsafe>/);
 await h.get('#ac-next').onclick({currentTarget:h.get('#ac-next')});assert.match(h.calls.at(-1)[1],/cursor=50/);
});
test('cache deletion waits for confirmation, exact key, and readback',async()=>{
 const h=harness();await tick();h.get('#ac-delete-0').onclick({currentTarget:h.get('#ac-delete-0')});assert.equal(h.calls.filter(c=>c[0]==='cache-delete').length,0);
 await h.confirms[0][2]();assert.equal(h.calls.find(c=>c[0]==='cache-delete')[2].id,'abc');assert.equal(h.calls.at(-1)[0],'read');
});
test('closed cache panel or changed connection cannot submit old confirmation',async()=>{
 for(const kind of ['close','connection']){const h=harness();await tick();h.get('#ac-delete-0').onclick({currentTarget:h.get('#ac-delete-0')});if(kind==='close')h.root.isConnected=false;else h.switchConnection();await h.confirms[0][2]();assert.equal(h.calls.filter(c=>c[0]==='cache-delete').length,0);}
});
test('cache import requires exact tag, keeps selected file on failure and never retries automatically',async()=>{
 const h=harness({writeFail:true});await tick();h.get('#ac-file').files=[{size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}];
 h.get('#ac-import').onclick({currentTarget:h.get('#ac-import')});assert.equal(h.confirms.length,0);h.get('#ac-confirm').value='cache';h.get('#ac-import').onclick({currentTarget:h.get('#ac-import')});await h.confirms[0][2]();assert.equal(h.get('#ac-file').files.length,1);assert.match(h.get('[data-advanced-status]').textContent,/write failed/);assert.equal(h.calls.filter(c=>c[0]==='cache-load').length,1);
});
