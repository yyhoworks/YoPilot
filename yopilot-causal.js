/* Five visible stages: show actual policies and DNS nodes before disclosure. */
(() => {
  'use strict';
  const original=window.OxiPath.mount,openRules=new Set();
  const P=window.YoPilotPresentation,M=window.OxiManageModel,B=window.YoPilotPathModel,W=window.YoPilotWorkflowModel;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let locked='';
  window.OxiPath.mount=function(target,options={}){
    original(target,options);
    const grid=target.querySelector('.ypb-grid'),stage=target.querySelector('.ypb-stage');
    if(!grid||!stage)return;
    target._opResizeObserver?.disconnect();
    if(target._ypbFrame)cancelAnimationFrame(target._ypbFrame);
    const data=B.build(options.config||{},{catalog:window.OxiEngine.catalog,fields:M.fields});
    if(!data.branches.some(g=>g.id===locked))locked='';
    const oldColumn=grid.querySelector('.ypb-branches'),oldBranches=[...oldColumn.querySelectorAll('.ypb-branch')];
    const columns=['分流规则','上游策略组','上游 DNS 节点'].map((title,i)=>{
      const col=document.createElement('section');col.className='ypb-col ypc-column';
      col.innerHTML='<header><h3><span>0'+(i+3)+'</span>'+title+'</h3><p>'+['用途摘要 · 展开查看全部来源','真实组名 · 并发裁决与主备回退','具名节点 · 地址与累计平均耗时'][i]+'</p></header>';
      grid.append(col);return col;
    });
    data.branches.forEach((branch,index)=>{
      const source=oldBranches.find(x=>x.dataset.ypbGroup===branch.id);
      if(!source)return;
      const sections=[...source.querySelectorAll('.ypb-branch-detail>section')];
      const rules=document.createElement('details');rules.className='ypc-group ypc-rule-group ypb-tone-'+branch.tone;
      rules.dataset.ypcGroup=branch.id;rules.open=openRules.has(branch.id);
      rules.innerHTML='<summary><span class="ypc-purpose-icon">'+P.icon(branch.icon)+'</span><span class="ypc-summary-copy"><strong>'+esc(branch.name)+'</strong><small>'+esc(W.ruleSummary(branch,M.fields,M.files))+'</small></span><span class="ypc-disclose" aria-hidden="true">+</span></summary>';
      const members=document.createElement('div');members.className='ypc-members';
      [...sections[0].children].filter(x=>x.tagName!=='H4').forEach(x=>members.append(x));
      rules.append(members);columns[0].append(rules);
      const groupTools=document.createElement('div');groupTools.className='ypc-rule-tools';
      groupTools.innerHTML='<button type="button" class="ob-link" data-purpose-lock="'+branch.id+'" aria-pressed="'+(locked===branch.id)+'">锁定高亮</button><button type="button" class="ob-link" data-purpose-query="'+branch.id+'">相关查询</button>';
      members.append(groupTools);
      rules.addEventListener('toggle',()=>{if(!rules.isConnected)return;rules.open?openRules.add(branch.id):openRules.delete(branch.id);update();schedule();});
      for(let i=1;i<3;i++){
        [...sections[i].querySelectorAll('.ypb-node')].forEach((node,n)=>{
          node.classList.add('ypc-visible-node','ypb-tone-'+branch.tone);node.dataset.ypcMember=branch.id;
          const pluginTag=node.dataset.opPlugin;
          node.querySelectorAll('code').forEach(x=>x.remove());
          if(i===1){node.dataset.policyOwner=pluginTag;node.title=pluginTag;}
          else {
            const originalNode=branch.nodes[n],metric=originalNode&&W.nodeMetric(options.metrics,originalNode);
            node.dataset.nodeOwner=pluginTag;
            node.title=(originalNode?.addr||'')+' · '+pluginTag;
            if(metric){const line=document.createElement('small');line.className='ypc-node-metric';
              line.textContent=metric.average!==null?metric.average.toLocaleString('zh-CN',{maximumFractionDigits:1})+' ms · 累计平均':'暂无耗时样本';
              if(metric.calls!==null)line.textContent+=' · '+metric.calls.toLocaleString('zh-CN')+' 次';
              node.querySelectorAll('small').item(1)?.remove();node.append(line);}
          }
          columns[i].append(node);
        });
      }
      if(branch.id==='filter'&&!branch.strategies.length){const local=document.createElement('div');local.className='ypc-local-note ypb-tone-filter';local.dataset.ypcMember=branch.id;local.innerHTML='<strong>本地过滤与应答</strong><small>按策略条件执行，不经过固定上游</small>';columns[1].append(local);}
    });
    oldColumn.remove();target.classList.add('ypc-path','ypc-readable');
    const inventory=target.querySelector('.ypb-inventory');
    if(inventory){const next=inventory.cloneNode(false);while(inventory.firstChild)next.append(inventory.firstChild);inventory.replaceWith(next);next.addEventListener('toggle',schedule);}
    target.querySelector('.op-head p').textContent='客户端 → 缓存 → 分流规则 → 策略组 → DNS 节点；具体策略与上游默认可见。';
    target.querySelector('.ypb-legend small').textContent='实线：策略到所属 DNS；虚线：用途关联。不是逐请求执行轨迹。';
    grid.style.gridTemplateColumns='minmax(150px,.86fr) minmax(190px,1fr) minmax(220px,1.12fr) minmax(210px,1.1fr) minmax(225px,1.16fr)';
    stage.style.minWidth='1200px';
    const svg=target.querySelector('.ypb-links'),expand=target.querySelector('#op-expand');
    const lockNote=document.createElement('div');lockNote.className='ypc-lock-note';lockNote.hidden=!locked;lockNote.setAttribute('role','status');target.querySelector('.ypb-legend').after(lockNote);
    function highlight(id){
      const active=id||locked;target.classList.toggle('ypb-focusing',Boolean(active));
      target.querySelectorAll('.ypb-edge').forEach(e=>e.classList.toggle('is-related',e.dataset.ypbEdge===active||e.dataset.ypbEdge==='source'));
      target.querySelectorAll('[data-ypc-member],[data-ypc-group]').forEach(e=>e.classList.toggle('ypc-dim',Boolean(active)&&(e.dataset.ypcMember||e.dataset.ypcGroup)!==active));
    }
    function setLock(id){locked=locked===id?'':id;lockNote.hidden=!locked;lockNote.innerHTML=locked?esc(data.branches.find(g=>g.id===locked)?.name)+' · 已锁定配置关联 <button type="button" class="ob-link" data-clear-lock>清除锁定（Esc）</button>':'';target.querySelectorAll('[data-purpose-lock]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.purposeLock===locked)));highlight();}
    target.querySelectorAll('[data-purpose-lock]').forEach(b=>b.onclick=()=>setLock(b.dataset.purposeLock));
    target.querySelectorAll('[data-purpose-query]').forEach(b=>b.onclick=()=>options.onPurpose?.(data.branches.find(g=>g.id===b.dataset.purposeQuery))||(!options.onPurpose&&window.OxiShell?.navigate('queries')));
    lockNote.onclick=e=>{if(e.target.closest('[data-clear-lock]'))setLock(locked);};
    target.onpointerover=e=>highlight(e.target.closest('[data-ypc-member],[data-ypc-group]')?.dataset.ypcMember||e.target.closest('[data-ypc-group]')?.dataset.ypcGroup);
    target.onpointerleave=()=>highlight();
    target.onfocusin=e=>highlight(e.target.closest('[data-ypc-member]')?.dataset.ypcMember||e.target.closest('[data-ypc-group]')?.dataset.ypcGroup);
    target.onfocusout=()=>highlight();
    target.onkeydown=e=>{if(e.key==='Escape'&&locked){setLock(locked);e.preventDefault();}};
    function draw(){
      if(!target.isConnected)return;const box=stage.getBoundingClientRect(),width=stage.clientWidth,height=grid.offsetHeight;
      svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('width',width);svg.setAttribute('height',height);
      let html='',index=0;
      const edge=(a,b,tone,id,exact=false)=>{if(!a||!b)return;const r=a.getBoundingClientRect(),s=b.getBoundingClientRect(),x=r.right-box.left,y=r.top+r.height/2-box.top,tx=s.left-box.left,ty=s.top+s.height/2-box.top,d=Math.max(12,(tx-x)*.5),path='M'+x+' '+y+' C'+(x+d)+' '+y+','+(tx-d)+' '+ty+','+tx+' '+ty;
        html+='<g class="ypb-edge ypb-tone-'+tone+'" data-ypb-edge="'+id+'"><path class="ypb-band" d="'+path+'"/><path class="ypb-core" '+(exact?'':'stroke-dasharray="3 5"')+' d="'+path+'"/><path class="ypb-flow" pathLength="100" d="'+path+'" style="animation-delay:'+(-(index++%7)*.37)+'s"/></g>';};
      const hub=stage.querySelector('.ypb-hub');stage.querySelectorAll('[data-ypb-source]').forEach(n=>edge(n,hub,'network','source'));
      data.branches.forEach(g=>{const rule=[...columns[0].querySelectorAll('[data-ypc-group]')].find(x=>x.dataset.ypcGroup===g.id)?.querySelector('summary');
        edge(hub,rule,g.tone,g.id);
        const policies=[...columns[1].querySelectorAll('[data-ypc-member]')].filter(n=>n.dataset.ypcMember===g.id);
        policies.forEach(p=>edge(rule,p,g.tone,g.id));
        columns[2].querySelectorAll('[data-node-owner]').forEach(n=>{if(n.dataset.ypcMember!==g.id)return;const policy=policies.find(p=>p.dataset.policyOwner===n.dataset.nodeOwner);edge(policy,n,g.tone,g.id,true);});
      });svg.innerHTML=html;highlight();
    }
    function schedule(){if(target._ypbFrame)cancelAnimationFrame(target._ypbFrame);target._ypbFrame=requestAnimationFrame(draw);}
    function update(){const all=[...columns[0].querySelectorAll('details')].every(x=>x.open);expand.textContent=all?'收起规则来源':'展开规则来源';expand.setAttribute('aria-expanded',String(all));}
    expand.onclick=()=>{const next=![...columns[0].querySelectorAll('details')].every(x=>x.open);columns[0].querySelectorAll('details').forEach(x=>x.open=next);update();};
    if(window.ResizeObserver){target._opResizeObserver=new ResizeObserver(schedule);target._opResizeObserver.observe(grid);}
    target.querySelectorAll('.ypb-pool').forEach((row,i)=>{const stats=(options.pools||[]).find(s=>s.p?.tag===data.caches[i]?.tag);const track=document.createElement('div');track.className='ypc-pool-track';track.setAttribute('aria-hidden','true');track.innerHTML='<i style="width:'+Math.min(100,Math.max(0,(stats?.rate||0)*100))+'%"></i>';row.append(track);});
    const initialLock=locked;locked='';setLock(initialLock);schedule();update();
  };
})();
