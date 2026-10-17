/* UI-only query helpers. Branch matching is limited to this fetched page's recorded events. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const W=window.YoPilotWorkflowModel,cache=new Map();let generation=0;
  const keyFor=s=>'yopilot-query-views:'+s.base;
  function saved(s){try{const r=JSON.parse(localStorage.getItem(keyFor(s))||'[]');return Array.isArray(r)?r.filter(v=>v&&typeof v.name==='string'&&v.q).slice(0,12):[];}catch{return [];}}
  function controls(s,ctx){
    const form=document.querySelector('#ob-query-form');if(!form)return;
    document.querySelector('#yp-query-tools')?.remove();
    const box=document.createElement('div');box.id='yp-query-tools';box.className='yp-query-tools';form.after(box);
    const labels={qname:'域名',qtype:'类型',client_ip:'客户端',rcode:'响应码',status:'执行状态',matcher_tag:'匹配器'};
    box.innerHTML=`<div class="yp-filter-chips" aria-label="当前查询筛选">${Object.entries(labels).filter(([k])=>s.q[k]).map(([k,label])=>`<button class="glass-btn small" data-yp-remove="${k}" aria-label="移除${label}筛选">${label}：${esc(s.q[k])} ×</button>`).join('')}${s.branch?`<button class="glass-btn small" data-yp-remove="branch">本页执行关联：${esc(s.branch.name)} ×</button>`:''}</div><details class="yp-saved-views"><summary>常用筛选 · 本浏览器</summary><div class="ob-filter"><label>保存名称<input id="yp-view-name" maxlength="40" placeholder="例如：异常 AAAA"></label><button type="button" class="glass-btn" id="yp-view-save">保存当前筛选</button><label>已保存筛选<select id="yp-view-list"><option value="">选择已保存筛选</option>${saved(s).map((v,i)=>`<option value="${i}">${esc(v.name)}</option>`).join('')}</select></label><button class="glass-btn" type="button" id="yp-view-load">载入筛选</button><button class="glass-btn" type="button" id="yp-view-delete">删除所选筛选</button></div></details><label class="yp-checks"><input type="checkbox" id="yp-query-evidence" ${s.evidence?'checked':''}> 显示实际执行插件</label><p class="gc-sub" id="yp-evidence-note">执行信息按需读取本页至多 50 条详情，最多 3 个并发。分组关联只筛选本页实际记录到的 tag，不代表命中某条规则或最终胜出的 DNS 节点。</p><p id="yp-query-feedback" role="status"></p>`;
    const message=t=>box.querySelector('#yp-query-feedback').textContent=t;
    box.querySelectorAll('[data-yp-remove]').forEach(b=>b.onclick=()=>{if(b.dataset.ypRemove==='branch')s.branch=null;else s.q[b.dataset.ypRemove]='';s.qpage=0;s.cursors=[null];ctx.render();});
    box.querySelector('#yp-query-evidence').onchange=ev=>{s.evidence=ev.target.checked;if(!s.evidence)s.branch=null;controls(s,ctx);ctx.draw();};
    box.querySelector('#yp-view-save').onclick=()=>{const name=box.querySelector('#yp-view-name').value.trim();if(!name)return message('填写保存名称；只保存在当前浏览器。');try{const rows=saved(s).filter(v=>v.name!==name);rows.unshift({name,q:W.queryFilters(s.q),recorder:s.recorder});localStorage.setItem(keyFor(s),JSON.stringify(rows.slice(0,12)));controls(s,ctx);document.querySelector('#yp-query-feedback').textContent='筛选已保存到此浏览器；本页执行关联不保存为全局筛选。';}catch{message('浏览器存储不可用，未保存筛选。');}};
    box.querySelector('#yp-view-load').onclick=()=>{const v=box.querySelector('#yp-view-list').value;if(v==='')return message('先选择一项常用筛选。');const view=saved(s)[Number(v)];if(!view)return;const tags=(ctx.config()?.plugins||[]).filter(p=>p.type==='query_recorder').map(p=>p.tag);if(!tags.includes(view.recorder))return message('保存的记录器在当前服务中不存在，请重新选择。');s.q=W.queryFilters(view.q);s.recorder=view.recorder;s.branch=null;s.qpage=0;s.cursors=[null];ctx.render();};
    box.querySelector('#yp-view-delete').onclick=()=>{const v=box.querySelector('#yp-view-list').value;if(v==='')return message('先选择要删除的本地筛选。');const rows=saved(s),item=rows[Number(v)];ctx.confirm('删除本浏览器筛选？',item?.name||'所选筛选',()=>{try{rows.splice(Number(v),1);localStorage.setItem(keyFor(s),JSON.stringify(rows));controls(s,ctx);}catch{message('浏览器存储不可用，未删除。');}},'删除本地筛选');};
  }
  async function evidence(root,s,ctx){
    const id=++generation;if(!s.evidence)return;const body=root.querySelector('tbody'),head=root.querySelector('thead tr');if(!body||!head)return;
    const th=document.createElement('th');th.textContent='记录到的执行插件 / 匹配器';head.insertBefore(th,head.lastElementChild);
    const rows=[...body.rows],scope=ctx.scope(),recorder=s.recorder,config=ctx.config(),aligned=ctx.aligned();
    const exportButton=document.querySelector('#ob-query-export');if(s.branch&&exportButton){exportButton.disabled=true;exportButton.textContent='正在核对本页关联…';}
    const current=()=>id===generation&&root.isConnected&&scope.connection===ctx.scope().connection&&scope.version===ctx.scope().version&&recorder===s.recorder;
    rows.forEach(row=>{if(s.branch)row.hidden=true;const cell=row.insertCell(row.cells.length-1);cell.className='yp-query-evidence';cell.textContent='读取详情…';});
    let cursor=0,done=0,failed=0,matched=0;
    async function worker(){while(cursor<rows.length&&current()){
      const row=rows[cursor++],recordId=row.querySelector('[data-ob-record]')?.dataset.obRecord,cell=row.querySelector('.yp-query-evidence');if(!recordId)continue;
      const key=[scope.base,scope.connection,scope.version,recorder,recordId].join('\n');
      try{let detail=cache.get(key);if(!detail){detail=await ctx.detail(recordId);if(!current())return;cache.set(key,detail);if(cache.size>400)cache.delete(cache.keys().next().value);}
        if(!current())return;const record=detail.record||{},a=W.attribution(record,config,aligned),steps=Array.isArray(record.steps)?record.steps:[],tags=[...new Set(steps.map(x=>x.tag).filter(Boolean))];
        const name=tag=>aligned?window.YoPilotPresentation.name(config.plugins.find(p=>p.tag===tag)||tag):tag;
        cell.innerHTML=!a.available?'未采集执行事件':`${a.forward?'<strong>转发器：'+esc(name(a.forward))+'</strong>':'<span>未记录可识别转发器</span>'}<small>末次执行：${esc(name(a.last)||'未记录')}</small><details><summary>匹配事件 ${a.matched.length} 项 · 展开全部 tag</summary><p>实际记录的匹配器：${esc(a.matched.join('、')||'未记录')}</p><p>记录到的插件：${esc(tags.join(' → ')||'未记录')}</p></details>`;
        cell.title=tags.join(' → ');if(s.branch){row.hidden=!tags.some(t=>s.branch.tags.includes(t));if(!row.hidden)matched++;}
      }catch{if(!current())return;cell.textContent='详情不可用，可点击重试';failed++;if(s.branch)row.hidden=true;cell.onclick=()=>ctx.draw();}
      done++;const note=document.querySelector('#yp-evidence-note');if(note&&current())note.textContent=`本页 ${done}/${rows.length} 条已检查${failed?'，'+failed+' 条不可用':''}${s.branch?'；执行 tag 关联 '+matched+' 条（仅本页，不是全局结果）':''}。记录到转发器不等于胜出节点；无事件不推断规则命中。`;
    }}await Promise.all(Array.from({length:Math.min(3,rows.length)},worker));
    if(current()&&s.branch){
      if(exportButton){exportButton.textContent='导出本页已确认关联';exportButton.disabled=!matched;exportButton.onclick=()=>{const ids=new Set(rows.filter(r=>!r.hidden).map(r=>r.querySelector('[data-ob-record]')?.dataset.obRecord));ctx.download('yopilot-associated-query-page.json',JSON.stringify({source:scope.base,recorder,association:s.branch,scope:'recorded tags on this fetched page only',unavailable:failed,records:s.queries.filter(r=>ids.has(String(r.id)))},null,2),'application/json');};}
      if(matched===0){const tr=body.insertRow();const td=tr.insertCell();td.colSpan=head.cells.length;td.textContent=failed?'本页没有可确认的关联结果，部分详情不可用；可重试或翻页。':'本页未发现记录到的关联事件，可移除关联条件或继续翻页。';}
    }
  }
  window.YoPilotQueryTools={controls,evidence};
})();
