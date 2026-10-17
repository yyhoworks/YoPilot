/* Antigravity B visual language, merged purpose groups, real configuration data. */
(() => {
  'use strict';
  const E=window.OxiEngine,M=window.OxiManageModel,P=window.YoPilotPresentation,B=window.YoPilotPathModel;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:1});
  const openGroups=new Set();
  let motionEnabled=true;
  try{motionEnabled=localStorage.getItem('yopilot-path-motion')!=='off';}catch{}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function syncMotion(){
    const running=motionEnabled&&!reduced.matches&&!document.hidden;
    document.querySelectorAll('.op-path').forEach(el=>el.classList.toggle('op-motion',running));
    const button=document.querySelector('#btn-toggle-particles');
    if(button){button.classList.toggle('active',motionEnabled);button.setAttribute('aria-pressed',String(motionEnabled));button.title=reduced.matches?'系统已启用减少动态效果，保留静态连线':'解析路径流光开关 · 结构示意，不代表实时请求';}
  }
  function setMotion(enabled){motionEnabled=Boolean(enabled);try{localStorage.setItem('yopilot-path-motion',motionEnabled?'on':'off');}catch{}syncMotion();}
  document.addEventListener('visibilitychange',syncMotion);reduced.addEventListener('change',syncMotion);
  const bar=rate=>`<span class="ypb-track"><span style="width:${Math.min(1,Math.max(0,Number(rate)||0))*100}%"></span></span>`;
  const chevron='<svg class="ypb-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';
  function mount(target,{config={},clients=[],pools=[],live=false,aligned=true,onPlugin,onClient,onCache}={}){
    if(!target)return;
    const data=B.build(config,{catalog:E.catalog,fields:M.fields});
    const {servers,caches,providers,strategies,nodes,branches}=data;
    const oldScroll=target.querySelector('.ypb-scroll')?.scrollLeft||0;
    const focused=target.contains(document.activeElement)?document.activeElement:null;
    const focusKey=focused?.getAttribute('data-ypb-key');
    const button=(title,sub,attrs='',extra='')=>`<button type="button" class="ypb-node" ${attrs}><strong>${esc(title)}</strong><small>${esc(sub)}</small>${extra}</button>`;
    const plugin=(p,sub,extra='',key='plugin:'+p.tag)=>button(P.name(p),sub,`data-op-plugin="${esc(p.tag)}" data-ypb-key="${esc(key)}" title="${esc(P.name(p)+' · '+p.tag)}"`,extra);
    const targetName=n=>n.owner==='forward_local'&&P.upstream(n.value,n.index).startsWith('DNS 节点')?'局域网 DNS':P.upstream(n.value,n.index);
    const upstream=(n,key)=>button(targetName(n),n.addr||'未设置地址',`data-op-plugin="${esc(n.owner)}" data-ypb-key="${esc(key+':'+n.id)}"`,
      `<small>${esc(({direct:'直连出口',remote:'远程出口'})[n.outbound]||n.outbound||config.network?.outbound?.default||'默认出口')} · ${esc(n.owner)}</small>`);
    const rule=p=>plugin(p,E.label(p.type)+' · '+(M.files(p).length?M.files(p).length+' 处文件来源':M.source(p).count+' 个内联/初始化项'),`<code>${esc(p.tag)}</code>`,'rule:'+p.tag);
    const strategy=p=>plugin(p,B.policy(p),`<code>${esc(p.tag)}</code>${p.type==='fallback'?`<small>主：${esc(P.name(p.args?.primary)||'—')}<br>备：${esc(P.name(p.args?.secondary)||'—')}</small>`:''}`,'strategy:'+p.tag);
    const details=(id,title,body,cls='')=>`<details class="${cls}" data-ypb-group="${esc(id)}" ${openGroups.has(id)?'open':''}><summary data-ypb-key="summary:${esc(id)}">${title}${chevron}</summary>${body}</details>`;
    const measured=pools.filter(p=>p.available),lookups=measured.reduce((n,p)=>n+(p.lookups||0),0),hits=measured.reduce((n,p)=>n+(p.hits||0),0);
    const cacheBody=`<div class="ypb-hub" data-ypb-anchor="cache"><div class="ypb-cache-stat"><strong>${lookups?num(hits/lookups*100):'—'}${lookups?'<small>%</small>':''}</strong><span>${live?'累计查找命中率':'命中率待连接'}</span></div><p>${caches.length} 个缓存池${live?' · '+measured.length+' 个有指标':''}</p>${bar(lookups?hits/lookups:0)}<div class="ypb-cache-pools">${caches.map(p=>{
      const s=pools.find(x=>x.p?.tag===p.tag);
      return `<div class="ypb-pool"><button type="button" data-op-plugin="${esc(p.tag)}" data-ypb-key="pool:${esc(p.tag)}" title="${esc(p.tag)}">${esc(P.name(p))}</button><span>${s?.rate!=null?num(s.rate*100)+'%':s?.available?'暂无查找':live?'暂无指标':'待连接'}</span><small>容量 ${p.args?.size==null?'默认':num(p.args.size)}${p.args?.lazy_cache_ttl?' · 乐观过期 '+esc(p.args.lazy_cache_ttl)+'s':''}</small>${live&&onCache?`<button type="button" class="ypb-entries" data-op-cache="${esc(p.tag)}" data-ypb-key="cache:${esc(p.tag)}" aria-label="查看${esc(P.name(p))}条目">查看条目</button>`:''}</div>`;
    }).join('')||'<p class="ypb-empty">未配置独立缓存实例</p>'}</div><p class="ypb-cache-foot">各池独立统计，不是全部 DNS 请求的命中比例。</p></div>`;
    const branchHtml=g=>{
      const count=`${g.rules.length} 个规则源 · ${g.strategies.length} 个策略 · ${g.nodes.length} 个 DNS 目标`;
      const policies=g.strategies.filter(p=>p.type==='forward').map(p=>B.policy(p));
      const note=g.id==='filter'?'本地应答 / 记录过滤 · 不指定固定上游':g.id==='additional'?'按原配置执行 · 不强行归入国内或海外':policies.length?[...new Set(policies)].join('；'):'没有关联转发组';
      const targetNames=g.nodes.length?g.nodes.map(n=>targetName(n)).join(' / '):g.id==='filter'?'本地处理':'见规则与回退配置';
      const summary=`<span class="ypb-branch-icon">${P.icon(g.icon)}</span><span class="ypb-branch-copy"><strong>${esc(g.name)}</strong><small>${esc(note)}</small></span><span class="ypb-branch-dest"><strong>${esc(targetNames)}</strong><small>${count}</small></span>`;
      const body=`<div class="ypb-branch-detail"><section><h4>分流规则 <span>${g.rules.length}</span></h4>${g.rules.map(rule).join('')||'<p class="ypb-empty">此分组没有规则源</p>'}</section><section><h4>策略与回退 <span>${g.strategies.length}</span></h4>${g.strategies.map(strategy).join('')||'<p class="ypb-empty">由解析流程中的过滤 / 应答步骤处理</p>'}</section><section><h4>上游 DNS <span>${g.nodes.length}</span></h4>${g.nodes.map(n=>upstream(n,'branch:'+g.id)).join('')||'<p class="ypb-empty">没有固定 DNS 目标，不代表没有后续解析</p>'}</section></div>`;
      return details(g.id,summary,body,'ypb-branch ypb-tone-'+g.tone);
    };
    const inventory=details('inventory',`<strong>拓扑明细</strong><span>${servers.length} 入口 · ${caches.length} 缓存 · ${providers.length} 规则源 · ${strategies.length} 策略 · ${nodes.length} DNS 目标</span>`,
      `<p class="ypb-inventory-note">这 ${data.total} 项是本图涉及的配置，不是全部插件。其余执行步骤与插件可从“完整依赖 / 策略管理”查看。</p><div class="ypb-inventory-grid">${[
        ['监听入口',servers.map(p=>plugin(p,p.args?.listen||'未设置地址','','inventory:'+p.tag))],
        ['缓存池',caches.map(p=>plugin(p,p.tag,'','inventory:'+p.tag))],
        ['规则源',providers.map(p=>plugin(p,p.tag,'','inventory:'+p.tag))],
        ['策略组',strategies.map(p=>plugin(p,p.tag,'','inventory:'+p.tag))],
        ['DNS 目标',nodes.map(n=>upstream(n,'inventory'))]
      ].map(([name,items])=>`<section><h4>${name} <span>${items.length}</span></h4>${items.join('')||'<p>没有配置</p>'}</section>`).join('')}</div>`,'ypb-inventory');
    target._opResizeObserver?.disconnect();target._opIntersectionObserver?.disconnect();
    if(target._ypbFrame)cancelAnimationFrame(target._ypbFrame);
    target.className='card op-path ypb-path';
    target.innerHTML=`<div class="op-head"><div><h2>DNS 解析路径</h2><p>按解析用途合并规则、策略和上游 DNS，展开分组查看完整配置。</p></div><div class="oxi-actions"><button type="button" class="glass-btn small" data-route="queries">查询实际轨迹</button><button type="button" class="glass-btn small" data-route="${live?'dependencies':'strategies'}">${live?'完整依赖':'策略管理'}</button><button type="button" class="glass-btn small" id="op-expand" data-ypb-key="expand">${branches.every(g=>openGroups.has(g.id))?'收起分组':'展开分组'}</button></div></div>${!aligned?'<p class="ypb-version-warning">文件与运行版本不同，本图展示配置文件结构；请到服务连接核对版本。</p>':''}<div class="ypb-legend"><span class="ypb-tone-domestic">国内解析</span><span class="ypb-tone-overseas">海外解析</span><span class="ypb-tone-fake">FakeIP</span><span class="ypb-tone-network">局域网</span><span class="ypb-tone-filter">拦截过滤</span><small>彩色连线仅示意配置分组，不代表实时请求</small></div><p class="ypb-scroll-hint">可左右滑动查看完整拓扑；点击分组展开明细</p><div class="ypb-scroll" tabindex="0" role="region" aria-label="DNS 解析拓扑，可横向滚动"><div class="ypb-stage"><svg class="ypb-links" aria-hidden="true"></svg><div class="ypb-grid"><section class="ypb-col ypb-clients"><header><h3><span>01</span>客户端与监听入口 <small>${servers.length}</small></h3><p>${live?'所选时段客户端与配置入口':'配置中的监听入口'}</p></header><div class="ypb-source-list">${clients.map(c=>button(c.key,`${num(c.count)} 次 · ${num(c.share*100)}%`,`data-op-client="${esc(c.key)}" data-ypb-source data-ypb-key="client:${esc(c.key)}"`)).join('')}${servers.map(p=>`<div data-ypb-source>${plugin(p,p.args?.listen||'未设置地址',`<small>${esc(E.label(p.type))} · ${esc(P.name(p.args?.entry)||'见完整参数')}</small>`)}</div>`).join('')||(!clients.length?'<p class="ypb-empty">暂无监听配置或客户端统计</p>':'')}</div></section><section class="ypb-col ypb-cache"><header><h3><span>02</span>引擎与多级缓存 <small>${caches.length}</small></h3><p>查找命中后，可由缓存返回</p></header>${cacheBody}</section><section class="ypb-col ypb-branches"><header><h3><span>03</span>解析分组 <small>${branches.length}</small></h3><p>规则、策略与 DNS 目标集中在同一分支</p></header><div class="ypb-branch-list">${branches.map(branchHtml).join('')||'<p class="ypb-empty">暂无规则源与解析策略。请前往策略管理配置。</p>'}</div></section></div></div></div>${inventory}<p class="op-foot">${live?'服务端配置结构':'本地配置草稿'} · 用途分组不等同于逐条规则的实际去向。跨策略回退保留原配置；单次执行顺序请查看查询详情。</p>`;
    const scroll=target.querySelector('.ypb-scroll'),stage=target.querySelector('.ypb-stage'),svg=target.querySelector('.ypb-links');
    scroll.scrollLeft=oldScroll;
    function draw(){
      // Measure content, not the previous SVG extent: expanded paths must shrink again.
      const box=stage.getBoundingClientRect(),width=stage.clientWidth,height=stage.querySelector('.ypb-grid').offsetHeight;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width);svg.setAttribute('height',height);
      let markup='',index=0;
      function edge(from,to,tone,id){
        if(!from||!to)return;
        const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
        const x=a.right-box.left,y=a.top+a.height/2-box.top,tx=b.left-box.left,ty=b.top+b.height/2-box.top,dx=Math.max(20,(tx-x)*.5);
        const d=`M${x} ${y} C${x+dx} ${y},${tx-dx} ${ty},${tx} ${ty}`;
        markup+=`<g class="ypb-edge ypb-tone-${tone}" data-ypb-edge="${id}"><path class="ypb-band" d="${d}"/><path class="ypb-core" d="${d}"/><path class="ypb-flow" d="${d}" pathLength="100" style="animation-delay:${-(index++%7)*.37}s"/></g>`;
      }
      const hub=stage.querySelector('[data-ypb-anchor="cache"]');
      stage.querySelectorAll('[data-ypb-source]').forEach(n=>edge(n,hub,'network','source'));
      branches.forEach(g=>edge(hub,stage.querySelector(`[data-ypb-group="${g.id}"]>summary`),g.tone,g.id));
      svg.innerHTML=markup;
    }
    function schedule(){if(target._ypbFrame)cancelAnimationFrame(target._ypbFrame);target._ypbFrame=requestAnimationFrame(draw);}
    schedule();
    if(window.ResizeObserver){target._opResizeObserver=new ResizeObserver(schedule);target._opResizeObserver.observe(stage);}
    if(window.IntersectionObserver){target._opIntersectionObserver=new IntersectionObserver(items=>target.classList.toggle('op-offscreen',!items[0].isIntersecting));target._opIntersectionObserver.observe(target);}
    function syncExpand(){
      const expanded=[...target.querySelectorAll('.ypb-branch')].every(d=>d.open);
      const control=target.querySelector('#op-expand');
      control.textContent=expanded?'收起分组':'展开分组';
      control.setAttribute('aria-expanded',String(expanded));
    }
    target.querySelectorAll('[data-ypb-group]').forEach(d=>d.addEventListener('toggle',()=>{if(!d.isConnected)return;d.open?openGroups.add(d.dataset.ypbGroup):openGroups.delete(d.dataset.ypbGroup);syncExpand();schedule();}));
    target.querySelector('#op-expand').onclick=()=>{
      const next=!branches.every(g=>openGroups.has(g.id));
      target.querySelectorAll('.ypb-branch').forEach(d=>{d.open=next;next?openGroups.add(d.dataset.ypbGroup):openGroups.delete(d.dataset.ypbGroup);});
      syncExpand();
    };
    function highlight(id){
      target.classList.toggle('ypb-focusing',Boolean(id));
      target.querySelectorAll('.ypb-edge').forEach(el=>el.classList.toggle('is-related',el.dataset.ypbEdge===id||el.dataset.ypbEdge==='source'));
    }
    target.onpointerover=e=>highlight(e.target.closest('.ypb-branch')?.dataset.ypbGroup);
    target.onpointerleave=()=>highlight(target.querySelector('.ypb-branch:focus-within')?.dataset.ypbGroup);
    target.onfocusin=e=>highlight(e.target.closest('.ypb-branch')?.dataset.ypbGroup);
    target.onfocusout=e=>highlight(e.relatedTarget?.closest?.('.ypb-branch')?.dataset.ypbGroup);
    target.querySelectorAll('[data-op-plugin]').forEach(b=>{b.disabled=!onPlugin;b.onclick=()=>onPlugin?.(b.dataset.opPlugin);});
    target.querySelectorAll('[data-op-client]').forEach(b=>{b.disabled=!onClient;b.onclick=()=>onClient?.(b.dataset.opClient);});
    target.querySelectorAll('[data-op-cache]').forEach(b=>b.onclick=()=>onCache?.(b.dataset.opCache));
    if(focusKey)[...target.querySelectorAll('[data-ypb-key]')].find(b=>b.dataset.ypbKey===focusKey)?.focus({preventScroll:true});
    syncExpand();syncMotion();
  }
  window.OxiPath={mount,setMotion,getMotion:()=>motionEnabled};
})();
