/* Draft editing; runtime rule operations are isolated in OxiDynamic. */
(() => {
  'use strict';
  const M=window.OxiManageModel,E=window.OxiEngine,P=window.YoPilotPresentation,$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const btn=(text,attrs='',primary=false)=>`<button type="button" class="glass-btn ${primary?'primary':''}" ${attrs}>${text}</button>`;
  const code=v=>`<code>${esc(v)}</code>`;
  const empty=(title,note='')=>`<div class="mg-empty"><strong>${esc(title)}</strong>${esc(note)}</div>`;
  const table=(heads,rows)=>`<div class="table-wrap"><table class="mg-table"><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const row=(title,desc,action='')=>`<div class="mg-info-row"><div><strong>${esc(title)}</strong><small>${esc(desc)}</small></div>${action}</div>`;
  const state={tag:null,tab:'content',filters:{},drafts:new Map()};let ctx;
  const responseGroups=[['cache','缓存与 TTL',['cache','ttl']],['edns','ECS / EDNS',['ecs_handler','client_ip_from_ecs','forward_edns0opt']],['ip','双栈与 IP 优选',['prefer_ipv4','prefer_ipv6','ip_selector','reverse_lookup']],['answer','本地应答与过滤',['hosts','arbitrary','redirect','response','black_hole','drop_resp']]];
  const plugins=()=>E.config().plugins;
  function shell(route,title,sub,body,actions='') {
    $('#page-content').innerHTML=ctx.subnav(route)+(window.OxiObserve?.draftNotice()||'')+`<section class="mg-section"><div class="view-title-row"><div><h1>${title}</h1><span class="gc-sub">${sub}</span></div><div class="oxi-actions">${actions}</div></div>${body}</section>`;
  }
  const summary=items=>`<div class="mg-summary">${items.map(([n,t])=>`<span><strong>${n}</strong>${t}</span>`).join('')}</div>`;
  function filterBar(route,options,placeholder) {
    const f=state.filters[route]||={q:'',type:'',ref:''};
    const categories=route==='response'?`<div class="mg-categories" role="group" aria-label="响应与缓存功能分组">${[['','全部',options],...responseGroups].map(([id,label,types])=>`<button type="button" data-mg-category="${id}" aria-pressed="${(f.category||'')===id}">${label}<span>${plugins().filter(p=>types.includes(p.type)).length}</span></button>`).join('')}</div>`:'';
    const purpose=route==='rules'?`<div class="mg-categories" role="group" aria-label="按规则用途筛选">${[{id:'',name:'全部规则',items:plugins().filter(p=>Object.hasOwn(M.fields,p.type))},...P.groups(plugins().filter(p=>Object.hasOwn(M.fields,p.type)))].map(g=>`<button type="button" data-mg-category="${g.id}" aria-pressed="${(f.category||'')===g.id}">${g.name}<span>${g.items.length}</span></button>`).join('')}</div>`:'';
    return categories+purpose+`<div class="mg-toolbar"><label>搜索<input id="mg-search" type="search" placeholder="${placeholder}" value="${esc(f.q)}"></label><label>类型<select id="mg-type"><option value="">全部类型</option>${options.map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${esc(E.label(t))}</option>`).join('')}</select></label><label>引用<select id="mg-ref" aria-label="按引用状态筛选"><option value="">全部状态</option><option value="used" ${f.ref==='used'?'selected':''}>已引用</option><option value="unused" ${f.ref==='unused'?'selected':''}>未引用</option></select></label><span class="mg-count" id="mg-count" role="status"></span>${btn('重置','id="mg-reset"')}</div>`;
  }
  function bindFilter(route,rows,draw){
    const f=state.filters[route],W=window.YoPilotWorkflowModel;
    if(route==='upstreams'){
      const targets=rows.flatMap(p=>W.upstreamTargets(p,E.config())),bar=document.createElement('div');bar.className='mg-toolbar yp-upstream-filters';
      bar.innerHTML=[['protocol','上游协议',[...new Set(targets.map(t=>t.protocol))]],['outbound','出口',[...new Set(targets.map(t=>t.outbound))]]].map(([key,label,values])=>`<label>${label}<select data-upstream-filter="${key}"><option value="">全部${label}</option>${values.map(v=>`<option value="${esc(v)}" ${f[key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`).join('')+'<span class="gc-sub">筛选组内存在符合条件的同一节点；主备回退仅在未筛选节点时保留。</span>';
      $('#mg-results').before(bar);
    }
    const update=()=>{
      const category=route==='response'&&responseGroups.find(g=>g[0]===f.category);
      const visible=rows.filter(p=>{const used=M.users(p,plugins()).length>0,targets=route==='upstreams'?W.upstreamTargets(p,E.config()):[];
        return (!category||category[2].includes(p.type))&&(route!=='rules'||!f.category||P.group(p)===f.category)&&(!f.type||p.type===f.type)&&(!f.ref||(f.ref==='used'?used:!used))&&(!f.protocol&&!f.outbound||targets.some(t=>(!f.protocol||t.protocol===f.protocol)&&(!f.outbound||t.outbound===f.outbound)))&&(P.name(p)+' '+JSON.stringify(p)).toLowerCase().includes(f.q.toLowerCase());});
      $('#mg-results').innerHTML=draw(visible);$('#mg-count').textContent=visible.length+' / '+rows.length;$$('[data-mg-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mgCategory===(f.category||''))));bind();
    };
    $('#mg-search').oninput=e=>{f.q=e.target.value;update();};$('#mg-type').onchange=e=>{f.type=e.target.value;update();};$('#mg-ref').onchange=e=>{f.ref=e.target.value;update();};
    $$('[data-upstream-filter]').forEach(el=>el.onchange=()=>{f[el.dataset.upstreamFilter]=el.value;update();});
    $$('[data-mg-category]').forEach(b=>b.onclick=()=>{f.category=b.dataset.mgCategory;f.type='';$('#mg-type').value='';update();});
    $('#mg-reset').onclick=()=>{Object.assign(f,{q:'',type:'',ref:'',category:'',protocol:'',outbound:''});$('#mg-search').value='';$('#mg-type').value='';$('#mg-ref').value='';$$('[data-upstream-filter]').forEach(el=>el.value='');update();};update();
  }
  const openRule=(tag,tab='content')=>{state.tag=tag;state.tab=tab;renderRules();};
  function renderRules(){
    const all=plugins(),sources=all.filter(p=>Object.hasOwn(M.fields,p.type));
    const p=sources.find(p=>p.tag===state.tag);
    if(p)return ruleDetail(p,all);
    state.tag=null;
    shell('rules','规则管理','按用途分组查看规则源，来源、引用与编辑操作集中展示。',summary([[sources.length,'个规则源'],[sources.filter(p=>M.files(p).length).length,'个含文件来源'],[sources.filter(p=>p.type==='dynamic_domain_set').length,'个动态集合'],[sources.filter(p=>M.users(p,all).length).length,'个被引用']])+`<section class="card yrc-filters">${filterBar('rules',Object.keys(M.fields),'名称、tag、文件路径…')}</section><div id="mg-results"></div><p class="mg-hint">列表使用本地配置草稿；数量仅统计内联规则、分类选择器或初始化项，不包含外部文件内容及已学习规则。静态引用不代表实际命中或固定分流去向。</p>`,btn('添加规则源','data-library="provider"',true));
    bindFilter('rules',sources,rows=>rows.length?window.YoPilotRuleCards.render(rows,all,{model:M,presentation:P,label:E.label,dirty:tag=>state.drafts.get(tag)?.dirty}):empty('没有匹配的规则源','调整筛选，或添加规则源。'));
  }
  function draft(p){let d=state.drafts.get(p.tag);const base=JSON.stringify(p.args||{},null,2);if(!d||!d.dirty&&d.base!==base){d={base,raw:base,mode:'lines',dirty:false};state.drafts.set(p.tag,d);}return d;}
  function ruleDetail(p,all){
    const d=draft(p),key=M.fields[p.type];let content='';
    if(state.tab==='runtime'&&p.type==='dynamic_domain_set'){
      content='<div id="mg-runtime"></div>';
    }else if(state.tab==='content'||state.tab==='advanced'){
      const json=state.tab==='advanced';let args;try{args=JSON.parse(d.raw);}catch{}
      const canLines=args&&!Array.isArray(args)&&typeof args==='object'&&(args[key]===undefined||Array.isArray(args[key])&&args[key].every(v=>typeof v==='string'));
      if(!json&&!canLines){state.tab='advanced';return ruleDetail(p,all);}
      const text=json?d.raw:M.array(args[key]).join('\n');
      const contentLabel=p.type==='dynamic_domain_set'?'初始化规则':key==='selectors'?'分类选择器':'内联补充规则';
      const fileCount=M.files({...p,args}).length,setCount=M.array(args?.sets).length;
      const boundary=p.type==='dynamic_domain_set'?'仅编辑初始化规则，不是当前已学习的域名列表。':key==='selectors'?'仅编辑 Geo 分类选择器，不是分类中的域名或 IP 明细。':'仅编辑当前参数中的内联规则，不是此规则源的全部有效内容。';
      const sourceNote=`<div class="yp-rule-boundary" id="mg-source-boundary"><p>${boundary}${fileCount?` 另有 ${fileCount} 个${p.type==='dynamic_domain_set'?'动态文件路径':'文件来源'}，本页未读取文件内容。`:''}${setCount?` 另引用 ${setCount} 个规则集合。`:''}</p>${p.type==='dynamic_domain_set'?btn('查看已学习规则','data-mg-tab-only="runtime"'):''}${fileCount||setCount?btn('查看来源与文件','data-mg-tab-only="source"'):''}</div>`;
      content=`<h2>${json?'完整参数 JSON':contentLabel}</h2><p>${json?'编辑完整 args，未知字段原样保留。':p.type==='dynamic_domain_set'?'bootstrap_rules 仅在动态文件不存在时初始化；此处不是已学习域名列表。':key==='selectors'?'一行一个分类，不直接修改 Geo 数据文件。':'一行一条，保存时只替换当前规则数组，其余字段保留。'}</p>${json?'':sourceNote}<label for="mg-editor" class="gc-sub">${json?'完整参数 JSON':contentLabel+'（'+esc(key)+'）'}</label><textarea id="mg-editor" ${json?'':'aria-describedby="mg-source-boundary"'} spellcheck="false">${esc(text)}</textarea><div class="mg-feedback"><span id="mg-feedback" role="status">${d.dirty?'未保存 · 切换分栏和列表会保留':'与本地草稿一致'}</span><span id="mg-item-count">${json?'JSON 参数':M.array(args[key]).length+' 项'}</span></div><div class="oxi-actions">${btn('下载当前内容','id="mg-download"')}${btn('还原文本','id="mg-reset-editor"')}${btn('保存本地草稿','id="mg-save"',true)}</div>`;
    } else if(state.tab==='source'){
      content=`<h2>来源与文件</h2><p>路径来自配置草稿；原生接口不提供任意外部文件在线读写。内联规则可编辑，动态学习文件仍通过运行列表管理。</p>${M.files(p).map(f=>row(f,'OxiDNS 服务端文件路径')).join('')||row('内联内容','规则保存在当前插件参数中')}${M.array(p.args?.sets).map(t=>row(t,'引用其他规则集合',btn('查看规则源',`data-mg-rule="${esc(t)}"`))).join('')}<div class="oxi-actions">${btn('规则来源与文件','data-route="files"')}${btn('编辑来源参数','data-mg-tab-only="advanced"')}</div>`;
    } else if(state.tab==='refs'){
      const refs=M.users(p,all);content=`<h2>引用关系</h2><p>从本地草稿的 tag 与表达式静态识别；不代表实际命中次数。</p>${refs.map(r=>row(r.tag,E.label(r.type),btn('查看参数',`data-mg-inspect="${esc(r.tag)}"`))).join('')||empty('未找到静态引用','仍可在高级配置中检查自定义表达式。')}`;
    } else {
      const u=M.updates(p,all);content=`<h2>更新与学习</h2><p>下载、调度与重载分开配置。这里不触发服务端操作。</p>${p.type==='dynamic_domain_set'?row('动态学习','已有文件内容由 learn_domain 等运行逻辑维护，不等同于订阅下载。'):''}${u.downloads.map(x=>row(x.tag,M.array(x.args.downloads).map(d=>d.url+' → '+M.downloadPath(d)).join('；'),btn('配置下载',`data-edit="${esc(x.tag)}"`))).join('')}${u.schedules.map(x=>row(x.tag,M.array(x.args.jobs).map(j=>(j.name||'作业')+'：'+(j.schedule||j.interval||'未设置')).join('；'),btn('配置调度',`data-edit="${esc(x.tag)}"`))).join('')}${u.reloads.map(x=>row(x.tag,'定向重载当前规则源',btn('配置重载',`data-edit="${esc(x.tag)}"`))).join('')}${!u.downloads.length&&!u.schedules.length&&!u.reloads.length?empty('未发现关联更新任务','内联规则可直接编辑；外部文件可配置下载与定时任务。'):''}<div class="mg-capabilities">${['download','cron','reload_provider','learn_domain'].map(k=>btn('添加'+E.label(k),`data-create="${k}"`)).join('')}${btn('查看真实任务状态','data-route="tasks"')}</div>`;
    }
    const tabs=[...(p.type==='dynamic_domain_set'?[['runtime','已学习规则']]:[]),['content',p.type==='dynamic_domain_set'?'初始化规则':'规则内容'],['source','来源与文件'],['refs','引用关系'],['update','更新设置'],['advanced','高级参数']];
    shell('rules','规则管理','详情按内容、来源、引用与更新组织，原始参数始终可达。',`${btn('返回规则列表','id="mg-back"')}<section class="card mg-back" style="margin-top:16px"><div class="card-header"><div><h2>${esc(P.name(p))}</h2><p class="gc-sub"><code>${esc(p.tag)}</code> · ${esc(E.label(p.type))} · ${esc(p.type)}</p></div>${btn('完整表单','id="mg-form"')}</div><nav class="mg-tabs" aria-label="规则源详情">${tabs.map(([k,t])=>`<button type="button" data-mg-tab-only="${k}" aria-pressed="${state.tab===k}">${t}</button>`).join('')}</nav><div class="mg-detail">${content}</div></section>`);
    if(state.tab==='runtime'&&p.type==='dynamic_domain_set')window.OxiDynamic.mount($('#mg-runtime'),p,ctx);
    $('#mg-back').onclick=()=>{state.tag=null;renderRules();};
    $('#mg-form').onclick=()=>{if(d.dirty){$('#mg-feedback')?.replaceChildren(document.createTextNode('请先保存或还原文本，再打开完整表单。'));ctx.toast('当前规则有未保存修改，请先保存或还原');return;}state.drafts.delete(p.tag);E.edit(null,p.tag);};
    const editor=$('#mg-editor');if(editor){
      editor.oninput=()=>{try{d.raw=state.tab==='advanced'?editor.value:JSON.stringify(M.replaceLines(JSON.parse(d.raw),key,editor.value),null,2);d.dirty=d.raw!==d.base;$('#mg-feedback').textContent=d.dirty?'未保存 · 切换分栏和列表会保留':'与本地草稿一致';if(state.tab!=='advanced')$('#mg-item-count').textContent=M.array(JSON.parse(d.raw)[key]).length+' 项';}catch(err){$('#mg-feedback').textContent=err.message;}};
      $('#mg-download').onclick=()=>ctx.download(p.tag+(state.tab==='advanced'?'.json':'.txt'),editor.value,'text/plain');
      $('#mg-reset-editor').onclick=()=>{state.drafts.delete(p.tag);ruleDetail(p,all);};
      $('#mg-save').onclick=()=>{try{const args=M.validate(p.type,JSON.parse(d.raw)),cfg=E.config(),target=cfg.plugins.find(x=>x.tag===p.tag);if(!target)throw Error('该规则源已不存在，请返回列表。');if(JSON.stringify(target.args||{},null,2)!==d.base)throw Error('参数已在其他入口修改，请下载当前内容并还原后重新编辑。');target.args=args;E.save(cfg);state.drafts.delete(p.tag);ctx.toast('已保存本地草稿，未应用到服务');renderRules();}catch(err){$('#mg-feedback').textContent='无法保存：'+err.message;}};
    }bind();
  }
  function inspect(tag){const all=plugins(),p=all.find(x=>x.tag===tag);if(!p)return;ctx.openDrawer(P.name(p),p.tag+' · '+E.label(p.type)+' · 本地草稿',`<h3>被引用的位置</h3>${M.users(p,all).map(x=>row(P.name(x),x.tag+' · '+E.label(x.type))).join('')||'<p class="gc-sub">未找到静态引用</p>'}<h3 class="drawer-section-title">完整参数</h3><pre>${esc(JSON.stringify(p.args,null,2))}</pre>`);}
  function bind(){
    $$('[data-mg-rule]').forEach(b=>b.onclick=()=>openRule(b.dataset.mgRule,b.dataset.mgTab||'content'));
    $$('[data-mg-tab-only]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.mgTabOnly;renderRules();});
    $$('[data-mg-inspect]').forEach(b=>b.onclick=()=>inspect(b.dataset.mgInspect));
    $$('[data-mg-export]').forEach(b=>b.onclick=()=>{
      const cfg=E.config();
      ctx.download('oxidns-dns-draft.json',JSON.stringify(cfg,null,2),'application/json');
      ctx.toast('已导出当前浏览器配置草稿');
    });
  }
  const stat=(label,value,note,kind='')=>`<div class="mg-stat-card ${kind?'is-'+kind:''}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;
  function dnsSummary(route,rows,all,cfg){
    const refs=rows.filter(p=>M.users(p,all).length).length;
    if(route==='listeners'){
      const tls=rows.filter(p=>p.args?.cert&&p.args?.key).length;
      const entries=rows.reduce((n,p)=>n+M.array(p.args?.entries).length,0);
      return `<div class="mg-stat-grid">${stat('监听实例',rows.length,'当前配置中的入口','accent')}${stat('协议类型',new Set(rows.map(p=>p.type)).size,'UDP / TCP / DoH / DoQ')}${stat('TLS 入口',tls,tls?'已配置证书与私钥':'尚未配置 TLS')}${stat('路径映射',entries,entries?'DoH 路径到执行器':'无 HTTP 路径')}</div>`;
    }
    if(route==='upstreams'){
      const targets=rows.filter(p=>p.type==='forward').reduce((n,p)=>n+M.array(p.args?.upstreams).length,0);
      const profiles=Object.keys(cfg.network?.outbound?.profiles||{}).length;
      return `<div class="mg-stat-grid">${stat('转发组',rows.filter(p=>p.type==='forward').length,'按并发裁决查询','accent')}${stat('上游目标',targets,'地址 / DoH / DoT 保留原样')}${stat('主备回退',rows.filter(p=>p.type==='fallback').length,'失败或超时后的备用路径')}${stat('出口 Profile',profiles,profiles?'可复用的出口配置':'使用系统默认出口')}</div>`;
    }
    if(route==='hosts'){
      const inline=rows.reduce((n,p)=>n+M.array(p.args?.entries||p.args?.rules).length,0);
      const files=rows.reduce((n,p)=>n+M.files(p).length,0);
      return `<div class="mg-stat-grid">${stat('本地应答实例',rows.length,'hosts / arbitrary / redirect','accent')}${stat('内联记录',inline,'只统计当前 args，不读取远端文件')}${stat('规则文件',files,files?'路径已保留':'未配置文件来源')}${stat('被引用实例',refs,'由本地配置静态引用计算')}</div>`;
    }
    const caches=rows.filter(p=>p.type==='cache').length,edns=rows.filter(p=>['ecs_handler','client_ip_from_ecs','forward_edns0opt'].includes(p.type)).length;
    return `<div class="mg-stat-grid">${stat('响应能力',rows.length,'当前配置中的响应 / 缓存插件','accent')}${stat('缓存池',caches,'命中率与条目在运行概览查看')}${stat('ECS / EDNS',edns,'客户端地址与选项处理')}${stat('策略引用',refs,'由本地配置静态引用计算')}</div>`;
  }
  function renderDNS(route){
    const cfg=E.config(),all=cfg.plugins;
    const response=['cache','ttl','ecs_handler','client_ip_from_ecs','forward_edns0opt','hosts','arbitrary','redirect','response','black_hole','prefer_ipv4','prefer_ipv6','ip_selector','reverse_lookup','drop_resp'];
    const types=route==='upstreams'?['forward','fallback']:route==='listeners'?E.catalog.filter(d=>d.type==='server').map(d=>d.kind):route==='hosts'?['hosts','arbitrary','redirect']:response;
    const rows=all.filter(p=>types.includes(p.type));
    const title=route==='hosts'?'主机记录':E.routeInfo[route][0];
    const sub={upstreams:'地址、组成员、结果裁决与出口放在同一张表中。',listeners:'协议、监听地址、证书与入口策略集中管理。',hosts:'本地地址、静态 DNS 记录与重定向，保留 OxiDNS 原始语法。',response:'缓存、TTL、ECS 与响应处理各自独立，由策略决定执行位置。'}[route];
    const additions=types.map(k=>btn('添加'+E.label(k),`data-create="${k}"`)).join('');
    shell(route,title,sub+`<span class="mg-source-note">本地配置草稿 · 不自动应用服务</span>`,dnsSummary(route,rows,all,cfg)+`<section class="card mg-data-card"><div class="mg-data-card-head"><div><strong>${route==='listeners'?'监听入口列表':route==='upstreams'?'上游与出口列表':route==='hosts'?'主机记录列表':'响应与缓存能力'}</strong><small>${route==='hosts'?'按 OxiDNS 原始语法保留 entries、rules、files 与引用。':'搜索、筛选后仍可直接进入完整参数编辑。'}</small></div><div class="oxi-actions">${btn('导出草稿','data-mg-export')}${btn('查看解析路径','data-route="overview"')}${btn(route==='upstreams'?'添加上游组':route==='listeners'?'添加监听':route==='hosts'?'添加主机记录':'添加缓存',route==='listeners'?'data-library="server"':`data-create="${route==='upstreams'?'forward':route==='hosts'?'hosts':'cache'}"`,true)}</div></div>${filterBar(route,types,'中文名称、tag、地址或参数…')}<div id="mg-results"></div></section>${route==='upstreams'?`<section class="card" style="margin-top:16px"><div class="mg-settings-row"><div><strong>全局出口与 Bootstrap</strong><p>默认 profile：${esc(cfg.network?.outbound?.default||'未指定')}。单个上游的 dial_addr、bootstrap、socks5 在组配置内保留。</p></div>${btn('配置全局出口','data-global="network"')}</div></section>`:''}<details class="card" style="margin-top:16px"><summary class="mg-hint">添加相关能力 · ${types.length} 种</summary><div class="mg-capabilities">${additions}</div></details><p class="mg-hint">本地草稿不等同于服务运行配置。${route==='response'?'缓存命中率和条目请在运行概览查看；未将 MR 的 FakeIP 池或全局 TTL 字段套用到 OxiDNS。':route==='hosts'?'记录是否生效取决于对应插件在策略中的位置，不添加虚构的逐条启停开关。':'服务端状态与实际执行顺序请在运行概览、查询日志中查看。'}</p>`,btn('完整配置','data-route="config"'));
    bindFilter(route,rows,list=>list.length?table(route==='upstreams'?['上游 / 类型','地址 / 主备成员','裁决 / 出口','引用','操作']:route==='listeners'?['监听 / 协议','监听地址','入口 / TLS','引用','操作']:['实例 / 类型','内容 / 参数摘要','行为','引用','操作'],list.map(p=>{
      const a=p.args||{},users=M.users(p,all);let target='',behavior='';
      if(route==='upstreams'){
        target=p.type==='forward'?M.array(a.upstreams).map(u=>typeof u==='string'?code(u):`${code(u.addr||'未设置地址')}<small>${esc(u.tag||'未命名目标')} · ${u.socks5?'独立 SOCKS5':esc(u.outbound||cfg.network?.outbound?.default||'默认出口')}</small>`).join('<br>'):`主：${code(a.primary||'未设置')}<br>备：${code(a.secondary||'未设置')}`;
        behavior=p.type==='forward'?`并发 ${esc(a.concurrent??1)}<small>${esc(({fastest:'最快响应',balanced:'平衡',prefer_positive:'优先正向答案',consensus:'负向共识'})[a.response_selection||'balanced']||a.response_selection)}</small>`:`接管 ${esc(a.threshold??0)} ms<small>${a.always_standby?'备用并行待命':'按需回退'}</small>`;
      }else if(route==='listeners'){target=code(a.listen||'未设置');behavior=`${esc(a.entry||M.array(a.entries).map(x=>x.path+' → '+x.exec).join('；')||'未设置入口')}<small>${a.cert&&a.key?'已配置证书':p.type==='quic_server'?'需检查 TLS 证书':'未配置证书'}${a.enable_http3?' · HTTP/3':''}</small>`;
      }else{const values=a.entries||a.rules;target=values?M.array(values).slice(0,3).map(code).join('<br>')+`<small>${M.array(values).length} 条内联 · ${M.array(a.files).length} 个文件</small>`:esc(E.describe(p));behavior=p.type==='cache'?`容量 ${esc(a.size??'默认')}<small>${a.lazy_cache_ttl?'乐观过期 '+esc(a.lazy_cache_ttl)+'s':'未设置乐观过期'}${a.dump_file?' · 持久化':''}</small>`:a.short_circuit?'命中后停止后续执行':'按策略顺序执行';}
      if(route==='upstreams'){const warnings=window.YoPilotWorkflowModel.upstreamWarnings(p,cfg);behavior+=warnings.map(w=>'<small class="yp-upstream-warning">'+esc(w)+'</small>').join('');}
      const refState=users.length?`<span class="mg-ref-state is-used">已引用 · ${users.length} 处</span>`:`<span class="mg-ref-state is-unused">未引用</span>`;
      return `<tr><td><button type="button" class="mg-name yp-instance-name" data-edit="${esc(p.tag)}">${esc(P.name(p))}</button><small><code>${esc(p.tag)}</code> · ${esc(E.label(p.type))}</small></td><td>${target||'未配置内联内容'}</td><td>${behavior}</td><td>${refState}<small>${users.slice(0,2).map(x=>esc(P.name(x))).join('、')||'暂无静态引用'}</small></td><td><div class="oxi-actions">${btn('配置',`data-edit="${esc(p.tag)}"`)}${btn('引用',`data-mg-inspect="${esc(p.tag)}"`)}${p.type==='hosts'?btn('导入与差异预览',`data-host-import="${esc(p.tag)}"`):''}</div></td></tr>`;
    }).join('')):empty('暂无匹配的配置','可以重置筛选，或添加对应能力。'));
  }
  window.OxiManage={openRule,install(context){ctx=context;E.routeInfo.hosts=['主机记录','DNS 配置'];window.addEventListener('beforeunload',ev=>{if([...state.drafts.values()].some(d=>d.dirty)){ev.preventDefault();ev.returnValue='';}});},render(route){if(route==='rules'){renderRules();return true;}if(['upstreams','listeners','hosts','response'].includes(route)){renderDNS(route);return true;}return false;}};
})();
