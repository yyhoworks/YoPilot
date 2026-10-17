/* Ordered policy editor. Save only to the existing draft/validate/apply pipeline. */
(() => {
  'use strict';
  const E=window.OxiEngine,manage=window.OxiManage;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>JSON.parse(JSON.stringify(v)),drafts=new Map();
  let ctx,tag='',drag=null;
  const install=manage.install,render=manage.render;
  manage.install=function(context){ctx=context;install.call(this,context);};
  manage.render=function(route){if(route==='strategies'){mount();return true;}return render.call(this,route);};
  window.addEventListener('beforeunload',ev=>{if([...drafts.values()].some(d=>d.dirty)){ev.preventDefault();ev.returnValue='';}});
  function mount(){
    const all=E.config().plugins,items=all.filter(p=>p.type==='sequence');
    if(!items.some(p=>p.tag===tag))tag=items[0]?.tag||'';
    const p=items.find(x=>x.tag===tag);
    const source=E.serviceSource?.(),draftKey=JSON.stringify([source?.base||'local',source?.version||'',tag]);
    let d=p&&drafts.get(draftKey);
    if(p&&(!d||!d.dirty&&d.base!==JSON.stringify(p.args))){d={base:JSON.stringify(p.args),steps:clone(p.args),dirty:false,jsonDrafts:new Map()};drafts.set(draftKey,d);}
    const root=document.querySelector('#page-content');
    root.innerHTML=ctx.subnav('strategies')+(window.OxiObserve?.draftNotice()||'')+`<section class="yp-seq"><div class="view-title-row"><div><h1>策略编排</h1><p class="gc-sub">按顺序执行条件和动作 · 拖动或用上移 / 下移调整 · 保存后仍是本地草稿</p></div><div class="oxi-actions"><button class="glass-btn" data-create="sequence">新建策略</button><button class="glass-btn" data-route="dependencies">完整依赖</button></div></div><label>当前策略<select id="yp-seq-select">${items.map(p=>`<option value="${esc(p.tag)}" ${p.tag===tag?'selected':''}>${esc(window.YoPilotPresentation.name(p))} · ${esc(p.tag)}</option>`).join('')}</select></label>${p?`<div class="yp-seq-tools"><button class="glass-btn" id="yp-seq-add">添加步骤</button><button class="glass-btn" id="yp-seq-raw">完整参数</button><button class="glass-btn" id="yp-seq-download">下载当前编排</button><button class="glass-btn" id="yp-seq-reset">还原未保存编排</button><button class="glass-btn primary" id="yp-seq-save">保存本地草稿</button></div><p role="status" id="yp-seq-status">${d.dirty?'编排尚未保存':'与本地草稿一致'} · 条件数组遵循 OxiDNS 原语义，不自动变换逻辑</p><div id="yp-seq-list" class="yp-seq-list"></div>`:'<p>尚无 sequence 策略，可新建或使用完整配置。</p>'}<h2>主备回退策略</h2><div class="workspace-panel">${all.filter(p=>p.type==='fallback').map(p=>`<div class="yp-admin-row"><div><strong>${esc(window.YoPilotPresentation.name(p))}</strong><small>${esc(p.tag)} · ${esc(window.YoPilotPathModel.policy(p))}</small></div><button class="glass-btn" data-edit="${esc(p.tag)}">编辑回退参数</button></div>`).join('')||'<p>未配置独立回退插件。</p>'}</div></section>`;
    root.querySelector('#yp-seq-select').onchange=ev=>{tag=ev.target.value;mount();};
    if(!p)return;
    if(!Array.isArray(d.steps)){root.querySelector('#yp-seq-status').textContent='此策略参数不是数组，请使用完整参数编辑。';root.querySelector('#yp-seq-raw').onclick=()=>E.edit(null,tag);return;}
    const status=message=>root.querySelector('#yp-seq-status').textContent=message;
    const W=window.YoPilotWorkflowModel;
    function explain(){
      let note=root.querySelector('#yp-seq-warning');if(!note){note=document.createElement('p');note.id='yp-seq-warning';note.className='ob-notice';note.setAttribute('role','status');root.querySelector('#yp-seq-list').before(note);}
      const warning=W.sequenceWarning(d.steps);note.hidden=!warning;note.textContent=warning;
      root.querySelectorAll('.yp-seq-step').forEach((article,i)=>{
        let summary=article.querySelector('.yp-seq-summary');if(!summary){summary=document.createElement('p');summary.className='yp-seq-summary';article.children[1].prepend(summary);}summary.textContent=W.stepSummary(d.steps[i],all);
        let source=article.querySelector('.yp-seq-sources');if(!source){source=document.createElement('details');source.className='yp-seq-sources';article.children[1].append(source);}
        const step={args:d.steps[i]},direct=window.OxiManageModel.refs(step,all),found=new Set(direct),queue=[...direct];
        while(queue.length){const tag=queue.shift(),p=all.find(x=>x.tag===tag);if(!p)continue;for(const next of window.OxiManageModel.refs(p,all))if(!found.has(next)){found.add(next);queue.push(next);}}
        const rules=all.filter(p=>found.has(p.tag)&&Object.hasOwn(window.OxiManageModel.fields,p.type));
        source.innerHTML='<summary>关联规则来源 · '+rules.length+'</summary><p class="gc-sub">依据当前草稿静态引用，不代表实际命中；最多预览每源 3 项。</p>'+rules.map(p=>'<div class="yp-source-preview"><strong>'+esc(window.YoPilotPresentation.name(p))+'</strong><code>'+esc(p.tag)+'</code><p>'+esc(window.OxiManageModel.files(p).join(' · ')||'内联规则')+'</p><pre>'+esc((p.args?.[window.OxiManageModel.fields[p.type]]||[]).slice(0,3).join('\n')||'无可预览的内联项')+'</pre><button class="glass-btn small" data-seq-source="'+esc(p.tag)+'">完整参数</button></div>').join('');
        source.querySelectorAll('[data-seq-source]').forEach(b=>b.onclick=()=>{ctx.openDrawer('规则来源预览',b.dataset.seqSource+' · 只读草稿', '<pre>'+esc(JSON.stringify(all.find(p=>p.tag===b.dataset.seqSource),null,2))+'</pre>');});
      });
    }
    const changed=()=>{d.dirty=true;status('编排尚未保存 · '+d.steps.length+' 个步骤；未影响服务');explain();};
    function move(from,to){if(d.jsonDrafts.size){status('请先确认未提交的步骤 JSON，再调整顺序');return;}if(to<0||to>=d.steps.length||from===to)return;const [item]=d.steps.splice(from,1);d.steps.splice(to,0,item);changed();draw(to);}
    function draw(focusIndex){
      const list=root.querySelector('#yp-seq-list');
      list.innerHTML=d.steps.map((s,i)=>{
        const simple=s&&typeof s==='object'&&!Array.isArray(s)&&(!Object.hasOwn(s,'matches')||typeof s.matches==='string'||Array.isArray(s.matches)&&s.matches.every(x=>typeof x==='string'))&&typeof s.exec==='string';
        return `<article class="yp-seq-step" data-index="${i}"><span class="yp-seq-order">${i+1}</span><div>${simple?`<div class="yp-seq-fields"><label>匹配条件（每行一条，空白表示无条件）<textarea data-field="matches" spellcheck="false">${esc(Array.isArray(s.matches)?s.matches.join('\n'):s.matches||'')}</textarea></label><label>执行动作 / 跳转表达式<input data-field="exec" value="${esc(s.exec)}" spellcheck="false" placeholder="$插件tag / jump 策略 / accept"></label></div>`:'<p class="gc-sub">扩展步骤原样保留，请在完整步骤 JSON 中编辑。</p>'}<details><summary>完整步骤 JSON · 包含未展示的扩展字段</summary><label>步骤 JSON<textarea data-field="json" spellcheck="false">${esc(JSON.stringify(s,null,2))}</textarea></label><button class="glass-btn" data-seq="json">确认本步骤 JSON</button></details><div class="yp-seq-tools"><button class="glass-btn" data-seq="drag" draggable="true" aria-label="拖动第 ${i+1} 步，或使用上移下移按钮">拖动排序</button><button class="glass-btn" data-seq="up" aria-label="上移第 ${i+1} 步" ${i===0?'disabled':''}>上移</button><button class="glass-btn" data-seq="down" aria-label="下移第 ${i+1} 步" ${i===d.steps.length-1?'disabled':''}>下移</button><button class="glass-btn" data-seq="copy">复制</button><button class="glass-btn" data-seq="remove">移除</button><span role="status" data-step-feedback></span></div></div></article>`;
      }).join('');
      list.querySelectorAll('.yp-seq-step').forEach(article=>{
        const i=Number(article.dataset.index),step=d.steps[i];
        article.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{
          if(input.dataset.field==='json'){input.dataset.dirty='true';d.jsonDrafts.set(step,input.value);d.dirty=true;article.querySelectorAll('[data-field]').forEach(x=>{if(x!==input)x.disabled=true;});status('完整步骤 JSON 尚未确认，文本保留；请点击“确认本步骤 JSON”');return;}
          if(input.dataset.field==='exec')step.exec=input.value;
          else {const lines=input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)delete step.matches;else step.matches=typeof step.matches==='string'&&lines.length===1?lines[0]:lines;}
          const json=article.querySelector('[data-field=json]');json.value=JSON.stringify(step,null,2);json.dataset.dirty='false';changed();
        });
        article.querySelectorAll('[data-seq]').forEach(b=>b.onclick=()=>{
          const action=b.dataset.seq;
          if(d.jsonDrafts.size&&['copy','remove'].includes(action)){status('请先确认未提交的步骤 JSON');return;}
          if(action==='up')move(i,i-1);if(action==='down')move(i,i+1);
          if(action==='copy'){d.steps.splice(i+1,0,clone(step));changed();draw(i+1);}
          if(action==='remove'){d.steps.splice(i,1);changed();draw(Math.max(0,i-1));}
          if(action==='json')try{const value=JSON.parse(article.querySelector('[data-field=json]').value);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('步骤必须是 JSON 对象');d.jsonDrafts.delete(step);d.steps[i]=value;changed();draw(i);}catch(err){article.querySelector('[data-step-feedback]').textContent='JSON 未确认：'+err.message;}
        });
        article.ondragover=ev=>{if(drag!==null)ev.preventDefault();};article.ondrop=ev=>{ev.preventDefault();if(drag!==null){move(drag,i);drag=null;}};
        const handle=article.querySelector('[data-seq=drag]');handle.ondragstart=ev=>{drag=i;ev.dataTransfer.setData('text/plain',String(i));ev.dataTransfer.effectAllowed='move';article.classList.add('is-dragging');};handle.ondragend=()=>{drag=null;article.classList.remove('is-dragging');};
        if(d.jsonDrafts.has(step)){article.querySelector('[data-field=json]').value=d.jsonDrafts.get(step);article.querySelector('[data-field=json]').dataset.dirty='true';article.querySelectorAll('[data-field]').forEach(x=>{if(x.dataset.field!=='json')x.disabled=true;});}
      });
      explain();
      if(focusIndex!==undefined)list.querySelector(`[data-index="${focusIndex}"] [data-seq=drag]`)?.focus({preventScroll:true});
    }
    const pendingJson=()=>d.jsonDrafts.size>0;
    root.querySelector('#yp-seq-add').onclick=()=>{if(pendingJson()){status('请先确认未提交的步骤 JSON');return;}d.steps.push({exec:'accept'});changed();draw(d.steps.length-1);};
    root.querySelector('#yp-seq-raw').onclick=()=>{if(d.dirty||pendingJson()){status('请先保存或还原当前编排，再切换完整参数，避免覆盖');return;}E.edit(null,tag);};
    root.querySelector('#yp-seq-download').onclick=()=>ctx.download('yopilot-sequence-'+tag+'.json',JSON.stringify(pendingJson()?{steps:d.steps,unconfirmed_step_json:[...d.jsonDrafts].map(([step,text])=>({index:d.steps.indexOf(step),text}))}:d.steps,null,2),'application/json');
    root.querySelector('#yp-seq-reset').onclick=()=>E.confirm('还原当前未保存编排？','不会修改已经保存的配置草稿，也不会影响 DNS 服务。',()=>{drafts.delete(draftKey);mount();},'还原编排');
    root.querySelector('#yp-seq-save').onclick=()=>{
      if(pendingJson()){status('请先确认未提交的步骤 JSON，未保存编排');return;}
      const config=E.config(),target=config.plugins.find(x=>x.tag===tag);
      const now=E.serviceSource?.();
      if(!root.isConnected||!target||JSON.stringify(target.args)!==d.base||draftKey!==JSON.stringify([now?.base||'local',now?.version||'',tag])){status('该策略或来源已在其他入口变化，未覆盖；请下载编排后还原并重新核对');return;}
      target.args=clone(d.steps);E.save(config);drafts.delete(draftKey);ctx.toast('策略已保存本地草稿，未应用到服务');mount();
    };draw();
  }
})();
