/* Explicit runtime operations, mounted inside the existing rule detail surface. */
(() => {
  'use strict';
  const D=window.OxiDynamicModel;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inputs=new Map();
  function mount(root,plugin,ctx){
    const O=window.OxiObserve,E=window.OxiEngine,base=O.base(),tag=plugin.tag,key=base+'\n'+tag;
    const input=inputs.get(key)||{text:'',kind:'full'};inputs.set(key,input);
    let loaded=null,cursor=0,previous=[],query='',busy=false,selected=new Set(),serial=0;
    const $=s=>root.querySelector(s),current=()=>root.isConnected&&O.base()===base;
    root.innerHTML=`<div class="yp-runtime-heading"><div><h2>已学习规则</h2><p>来自服务端运行时，不是初始化规则或浏览器草稿。</p></div><button type="button" class="glass-btn" id="dyn-refresh">刷新列表</button></div>
      <div class="yp-rule-boundary"><p>新增、删除和清空会立即写入动态规则文件并更新匹配结果，不修改 YAML，也无需热重载。自动学习仍可能继续写入；分页是实时视图，不是固定快照。</p></div>
      <p class="yp-runtime-source">服务：<code>${esc(base)}</code> · 规则源：<code>${esc(tag)}</code><br>运行文件：<code id="dyn-path">读取中…</code></p>
      <p id="dyn-message" role="status" aria-live="polite"></p><p id="dyn-error" class="field-error" role="alert"></p>
      <div class="mg-toolbar"><label>筛选本页<input id="dyn-filter" type="search" placeholder="域名、关键词或表达式" aria-describedby="dyn-filter-note"></label><span id="dyn-count" role="status">正在读取…</span></div>
      <p id="dyn-filter-note" class="gc-sub">只筛选已读取的这一页，不搜索整个集合。每页最多 100 条。</p>
      <div id="dyn-rows" aria-busy="true"></div>
      <div class="yp-runtime-actions"><button type="button" class="glass-btn" id="dyn-prev">上一页</button><button type="button" class="glass-btn" id="dyn-next">下一页</button><button type="button" class="glass-btn" id="dyn-export">下载本页</button><button type="button" class="glass-btn" id="dyn-remove">删除所选</button></div>
      <details class="yp-runtime-editor"><summary>新增运行时规则</summary><p class="gc-sub" id="dyn-add-help">一行一条，最多 200 条。支持 full:、domain:、keyword:、regexp:；显式前缀优先。表达式由 OxiDNS 校验。</p>
      <label for="dyn-kind">无前缀域名的匹配范围</label><select id="dyn-kind"><option value="full">精确域名（不含子域名）</option><option value="domain">域名及其子域名</option></select>
      <label for="dyn-input">要新增的规则</label><textarea id="dyn-input" spellcheck="false" maxlength="65536" aria-describedby="dyn-add-help" placeholder="full:example.com&#10;domain:example.net">${esc(input.text)}</textarea>
      <button type="button" class="glass-btn primary" id="dyn-add">确认新增…</button></details>
      <details class="yp-runtime-danger"><summary>清空整个动态集合</summary><p>将清空整个运行时集合和对应文件，包括其他页面及刚学习的规则；无法撤销。自动学习可能随后重新产生规则，初始化参数不会被删除。</p><label for="dyn-clear-tag">输入 ${esc(tag)} 确认目标</label><input id="dyn-clear-tag" autocomplete="off" spellcheck="false"><button type="button" class="glass-btn" id="dyn-clear">清空整个集合…</button></details>`;
    $('#dyn-kind').value=input.kind;
    function controls(){
      const locked=busy||!loaded||!O.isReady();
      $('#dyn-refresh').disabled=busy;
      $('#dyn-prev').disabled=locked||!previous.length;
      $('#dyn-next').disabled=locked||loaded.page.next_cursor===null;
      $('#dyn-export').disabled=locked||!loaded.page.rules.length;
      $('#dyn-remove').disabled=locked||!selected.size;
      $('#dyn-remove').textContent='删除所选'+(selected.size?' · '+selected.size:'');
      $('#dyn-add').disabled=locked||!input.text.trim();
      $('#dyn-clear').disabled=locked||!loaded.page.total||$('#dyn-clear-tag').value!==tag;
      root.querySelectorAll('[data-dyn-select]').forEach(el=>el.disabled=locked);
      $('#dyn-rows').setAttribute('aria-busy',String(busy));
    }
    function rows(){
      if(!loaded){$('#dyn-rows').innerHTML='<p class="ob-empty">尚未读取运行时规则，请刷新列表。</p>';$('#dyn-count').textContent='暂无运行时数据';controls();return;}
      const list=loaded.page.rules.map((rule,index)=>({rule,index})).filter(x=>x.rule.toLowerCase().includes(query.toLowerCase()));
      $('#dyn-count').textContent=`服务端共 ${loaded.page.total.toLocaleString('zh-CN')} 条 · 第 ${previous.length+1} 页 · 本页 ${loaded.page.rules.length} 条 · 筛选 ${list.length} 条`;
      $('#dyn-rows').innerHTML=list.length?`<div class="table-wrap"><table class="mg-table yp-runtime-table"><thead><tr><th>选择</th><th>规则内容 / 原始表达式</th><th>匹配范围</th></tr></thead><tbody>${list.map(({rule,index})=>{const d=D.describe(rule);return `<tr><td><label class="yp-runtime-check"><input type="checkbox" data-dyn-select="${index}" aria-label="选择规则 ${esc(rule)}" ${selected.has(rule)?'checked':''}></label></td><td><code>${esc(d.value)}</code><small><code>${esc(rule)}</code></small></td><td>${esc(d.kind)}</td></tr>`;}).join('')}</tbody></table></div>`:`<p class="ob-empty">${loaded.page.total===0?'尚无已学习规则。自动学习或手动新增后可刷新查看。':'本页没有匹配项，请清除筛选或翻页查看。'}</p>`;
      root.querySelectorAll('[data-dyn-select]').forEach(el=>el.onchange=()=>{const rule=loaded.page.rules[Number(el.dataset.dynSelect)];if(el.checked)selected.add(rule);else selected.delete(rule);controls();});
      controls();
    }
    async function read(next=0,history=[]){
      if(busy)return;busy=true;loaded=null;selected.clear();const ticket=++serial;
      $('#dyn-error').textContent='';$('#dyn-count').textContent='正在读取运行时规则…';controls();
      try{
        const result=await O.dynamicRules(tag,next);
        if(!current()||ticket!==serial)return;
        loaded=result;cursor=next;previous=history;$('#dyn-path').textContent=result.path;
      }catch(err){if(current()){$('#dyn-error').textContent='读取失败：'+err.message;$('#dyn-path').textContent='未确认';}}
      finally{busy=false;if(current()&&ticket===serial)rows();}
    }
    function confirm(action,extra,description){
      if(busy||!loaded)return;
      const scope=loaded.scope;
      E.confirm(action==='dynamic-add'?'新增运行时规则？':action==='dynamic-remove'?'删除所选运行时规则？':'清空整个动态集合？',`${base} · ${tag}\n${description}\n直接写入运行文件并生效，不保存为配置草稿。`,async()=>{
        if(!current()||busy||!loaded||loaded.scope!==scope){ctx.toast('页面或数据已变化，请重新读取并确认');return;}
        busy=true;$('#dyn-error').textContent='';$('#dyn-message').textContent='正在提交，请勿重复操作…';controls();
        try{
          const result=await O.runAction(action,tag,{...extra,scope});
          if(action==='dynamic-add'&&input.text===extra.inputText){input.text='';if(current())$('#dyn-input').value='';}
          const message=`已完成：新增 ${result.added} 条，删除 ${result.removed} 条；操作完成时共 ${result.total} 条。`;
          ctx.toast(message);if(current()){$('#dyn-message').textContent=message;$('#dyn-clear-tag').value='';}
        }catch(err){if(current()){$('#dyn-message').textContent='未确认操作成功。请先刷新列表核对，再决定是否重试。';$('#dyn-error').textContent=err.message;}else ctx.toast('运行时操作未确认：'+err.message);loaded=null;}
        finally{busy=false;if(current()){if(loaded)await read();else rows();}}
      },action==='dynamic-add'?'新增并立即生效':action==='dynamic-remove'?'删除并立即生效':'确认清空整个集合');
    }
    $('#dyn-refresh').onclick=()=>read();
    $('#dyn-filter').oninput=ev=>{query=ev.target.value;selected.clear();rows();};
    $('#dyn-prev').onclick=()=>read(previous.at(-1),previous.slice(0,-1));
    $('#dyn-next').onclick=()=>read(loaded.page.next_cursor,[...previous,cursor]);
    $('#dyn-export').onclick=()=>ctx.download(tag+'-runtime-page-'+cursor+'.txt',loaded.page.rules.join('\n')+'\n','text/plain');
    $('#dyn-input').oninput=ev=>{input.text=ev.target.value;controls();};
    $('#dyn-kind').onchange=ev=>{input.kind=ev.target.value;};
    $('#dyn-clear-tag').oninput=controls;
    $('#dyn-add').onclick=()=>{try{const body=D.rules(input.text,input.kind);confirm('dynamic-add',{...body,inputText:input.text},`将提交 ${body.rules.length} 条规则。无前缀域名按${input.kind==='full'?'精确域名':'域名及子域名'}处理；重复项由服务端去重。\n${body.rules.join('\n')}`);}catch(err){$('#dyn-error').textContent=err.message;}};
    $('#dyn-remove').onclick=()=>{const rules=[...selected];confirm('dynamic-remove',{rules,rule_kind:'full'},`仅删除以下 ${rules.length} 条完整表达式，不按关键词批量删除；自动学习可能再次添加。\n${rules.join('\n')}`);};
    $('#dyn-clear').onclick=()=>{if($('#dyn-clear-tag').value===tag)confirm('dynamic-clear',{confirmTag:tag},'清空全部运行时规则和持久化文件，包括其他页面及刚学习的规则。无法撤销。');};
    read();
  }
  window.OxiDynamic={mount};
})();
