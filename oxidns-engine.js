/* Local draft engine. Service writes are delegated to the explicit OxiObserve adapter after confirmation. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const catalog = window.OxiCatalog.definitions;
  const globalDefinitions = {
    __network:{kind:'__network',name:'全局出口',description:'统一设置默认出口和出站 profile。保持完整 network.outbound 结构。',configSchema:[
      {key:'default',label:'默认出口',type:'text',example:'direct',description:'填写 profiles 中的名称；留空保持兼容行为。'},
      {key:'profiles',label:'出站 Profiles',type:'record',description:'每个 profile 包含 resolver 和 proxy。支持自定义 nameservers 和 SOCKS5；未覆盖字段原样保留。',example:'{"direct":{"resolver":"system","proxy":"none"}}'}
    ]},
    __api:{kind:'__api',name:'API 与安全',description:'API 监听、Basic Auth、TLS 与 WebUI 路径。',configSchema:[
      {key:'listen',label:'监听地址',type:'text',required:true,example:'0.0.0.0:9199'},
      {key:'auth',label:'API 认证',type:'object',fields:[{key:'type',label:'认证类型',type:'select',options:[{label:'Basic Auth',value:'basic'}]},{key:'username',label:'用户名',type:'text'},{key:'password',label:'密码',type:'password'}]},
      {key:'ssl',label:'TLS',type:'object',advanced:true,fields:[{key:'cert',label:'证书路径',type:'text'},{key:'key',label:'私钥路径',type:'text'},{key:'client_ca',label:'客户端 CA',type:'text'},{key:'require_client_cert',label:'要求双向 TLS',type:'switch'}]},
      {key:'cors',label:'CORS',type:'object',advanced:true,fields:[{key:'allowed_origins',label:'允许的 Origin',type:'array',item:{type:'text'}}]},
      {key:'webui',label:'WebUI',type:'object',advanced:true,fields:[{key:'root',label:'静态文件目录',type:'text'},{key:'index',label:'首页文件',type:'text'}]}
    ]}
  };
  const definition = kind => catalog.find(item => item.kind === kind)||globalDefinitions[kind];
  const kinds = {server:'服务端',executor:'执行器',matcher:'匹配器',provider:'数据源'};
  const names = {udp_server:'UDP 监听',tcp_server:'TCP / DoT 监听',http_server:'DoH 监听',quic_server:'DoQ 监听',sequence:'策略编排',fallback:'主备回退',forward:'上游转发',cache:'DNS 缓存',hosts:'本地地址记录',arbitrary:'自定义 DNS 记录',response:'响应构造',redirect:'域名重定向',client_ip_from_ecs:'ECS 客户端地址映射',ecs_handler:'ECS 处理',forward_edns0opt:'EDNS 选项转发',ttl:'TTL 改写',ip_selector:'IP 优选',prefer_ipv4:'优先 IPv4',prefer_ipv6:'优先 IPv6',black_hole:'拦截响应',drop_resp:'清空响应',reverse_lookup:'反向解析',query_summary:'查询摘要',query_recorder:'查询记录',metrics_collector:'指标采集',debug_print:'调试输出',sleep:'延迟执行',http_request:'HTTP Webhook',learn_domain:'域名自动学习',script:'外部脚本',ipset:'Linux ipset',nftset:'Linux nftset',ros_address_list:'RouterOS 地址列表',ros_route:'RouterOS 静态路由',upgrade:'版本升级',download:'规则文件下载',reload_provider:'定向重载数据源',reload:'配置热重载',cron:'定时任务',domain_set:'域名集合',dynamic_domain_set:'动态域名集合',geosite:'GeoSite',adguard_rule:'AdGuard 规则',ip_set:'IP / CIDR 集合',geoip:'GeoIP'};
  const label = kind => names[kind] || definition(kind)?.name || kind;
  const displayName = value => window.YoPilotPresentation?.name(value)||(typeof value==='string'?value:value?.tag)||'未命名';
  const storage = {
    get(key, fallback){try{return JSON.parse(localStorage.getItem('oxidns-v2-'+key)) ?? fallback;}catch{return fallback;}},
    set(key,value){try{localStorage.setItem('oxidns-v2-'+key,JSON.stringify(value));return true;}catch{showToast('浏览器存储不可用，请导出草稿以保留修改');return false;}}
  };
  const seed = {api:{http:{listen:'0.0.0.0:9199'}},plugins:[
    {tag:'dns_udp',type:'udp_server',args:{entry:'main',listen:':53'}},
    {tag:'dns_tcp',type:'tcp_server',args:{entry:'main',listen:':53',idle_timeout:10}},
    {tag:'dns_https',type:'http_server',args:{listen:':443',entries:[{path:'/dns-query',exec:'main'}],cert:'/etc/oxidns/server.crt',key:'/etc/oxidns/server.key',enable_http3:true}},
    {tag:'dns_quic',type:'quic_server',args:{entry:'main',listen:':853',cert:'/etc/oxidns/server.crt',key:'/etc/oxidns/server.key'}},
    {tag:'localdns',type:'forward',args:{upstreams:[{tag:'local',addr:'udp://192.0.2.6:53'}],concurrent:1}},
    {tag:'mihomo',type:'forward',args:{upstreams:[{tag:'proxy',addr:'udp://192.0.2.7:1053'}],response_selection:'balanced'}},
    {tag:'cache_main',type:'cache',args:{size:16384,lazy_cache_ttl:86400,cache_negative:true,dump_file:'./dns_cache.dump',dump_interval:600}},
    {tag:'cn_domains',type:'domain_set',args:{exps:['domain:cn','domain:example.cn']}},
    {tag:'learned_domains',type:'dynamic_domain_set',args:{path:'/etc/oxidns/learned.txt',bootstrap_rules:[]}},
    {tag:'match_cn',type:'qname',args:['$cn_domains']},
    {tag:'query_log',type:'query_recorder',args:{path:'./queries.db',retention_days:7}},
    {tag:'main',type:'sequence',args:[{exec:'$query_log'},{exec:'$cache_main'},{matches:['qname $cn_domains'],exec:'$localdns'},{matches:['!has_resp'],exec:'$mihomo'},{exec:'accept'}]}
  ]};
  let config = storage.get('config', seed);
  if(!config || !Array.isArray(config.plugins)) config=clone(seed);
  let previous = storage.get('previous',null), revision=storage.get('revision',0);
  let serviceSource=storage.get('service-source',null);
  const canSeedFromService=()=>!storage.get('config',null)&&revision===0;
  let current='overview', catalogMode='instances', catalogFilter='all', catalogQuery='', rawFormat='yaml', rawText=null;
  const runtimeHistory=[], matcherModes={};
  const responseKinds=['cache','ttl','ecs_handler','client_ip_from_ecs','forward_edns0opt','hosts','arbitrary','redirect','response','black_hole','prefer_ipv4','prefer_ipv6','ip_selector','reverse_lookup','drop_resp'];
  const integrationKinds=['ipset','nftset','ros_address_list','ros_route','http_request','script'];
  const routeInfo={
    overview:['运行概览','监控'],queries:['查询日志','观测与运维'],logs:['运行日志','观测与运维'],
    listeners:['监听与协议','DNS 配置'],upstreams:['上游与出口','DNS 配置'],response:['响应与缓存','DNS 配置'],strategies:['策略管理','DNS 配置'],
    rules:['规则数据','规则与联动'],integrations:['系统联动','规则与联动'],plugins:['插件中心','插件'],
    metrics:['指标与 API','观测与运维'],runtime:['运行时管理','观测与运维'],system:['系统与安全','系统'],config:['高级配置','系统']
  };
  const groups=[{name:'运行概览',direct:'overview'},{name:'DNS 配置',children:['listeners','upstreams','response','strategies']},{name:'规则与联动',children:['rules','integrations']},{name:'插件中心',direct:'plugins'},{name:'观测与运维',children:['queries','logs','metrics','runtime']},{name:'系统',children:['system','config']}];

  const showToast = message => window.toast?.(message);
  const showView = route => window.OxiShell?.navigate(route);
  const yaml = value => window.jsyaml.dump(value,{lineWidth:100,noRefs:true,sortKeys:false});
  const header=(key,description,actions='')=>`<div class="page-header"><div><h1 class="page-title">${routeInfo[key][0]}</h1><p class="page-subtitle">${description}</p></div><div class="page-actions">${actions}</div></div>`;
  const button=(text,attr='',primary=false)=>`<button type="button" class="button ${primary?'primary':''}" ${attr}>${text}</button>`;
  const intro=text=>`<div class="workspace-intro"><p>${text}</p><span class="draft-badge">本地草稿 · ${revision?'已修改 '+revision+' 次':'示例配置'}</span></div>`;
  const byKinds=types=>config.plugins.filter(p=>types.includes(p.type));
  const describe=p=>{
    const a=p.args||{};
    if(definition(p.type)?.type==='server')return `${a.listen||'未设置监听地址'} · ${a.entry||a.entries?.map(e=>e.path+' → '+e.exec).join(', ')||'未设置入口'}`;
    if(p.type==='forward')return (a.upstreams||[]).map(u=>typeof u==='string'?u:u.addr).join(' · ');
    if(p.type==='cache')return `${a.size??'默认'} 条容量 · ${a.cache_negative?'含负缓存':'普通缓存'}${a.dump_file?' · 已设置持久化':''}`;
    if(p.type==='sequence')return `${Array.isArray(a)?a.length:0} 个步骤 · 保留条件、跳转和快捷表达式`;
    return a.path||a.file||a.files?.join(', ')||definition(p.type)?.description||'自定义插件配置';
  };
  const rows=plugins=>plugins.map(p=>`<tr><td><button type="button" class="yp-instance-name" data-edit="${escape(p.tag)}">${escape(displayName(p))}</button><small>${escape(p.tag)} · ${escape(label(p.type))}</small></td><td><code>${escape(p.type)}</code></td><td>${escape(describe(p))}</td><td><span class="draft-badge">草稿</span></td><td>${button('配置',`data-edit="${escape(p.tag)}"`)} ${p.type==='cache'?button('查看条目',`data-cache="${escape(p.tag)}"`):''}${definition(p.type)?.type==='provider'?button('重载数据',`data-task="provider" data-target="${escape(p.tag)}"`):''}</td></tr>`).join('');
  const list=(plugins)=>`<section class="workspace-panel"><div class="table-scroll"><table class="workspace-table"><thead><tr><th>实例 / 名称</th><th>插件类型</th><th>配置摘要</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows(plugins)}</tbody></table></div>${plugins.length?'':'<div class="empty-state"><strong>还没有相关实例</strong>从下面选择能力，添加到配置草稿。</div>'}</section>`;
  const available=(types,title='添加能力')=>`<section class="workspace-section"><h2>${title}</h2><div class="capabilities-list">${types.map(kind=>{const d=definition(kind);return `<div class="capability-line"><span class="type-mark ${d?.type}">${(d?.type||'P')[0].toUpperCase()}</span><div><h3>${escape(label(kind))}</h3><p>${escape(d?.description||'')}</p><code>${kind}</code></div>${button('添加',`data-create="${kind}"`)}</div>`;}).join('')}</div></section>`;
  function renderPage(key){
    const root=$('#view-'+key); if(!root){window.OxiShell?.refresh();return;}
    if(key==='listeners')root.innerHTML=header(key,'把监听端口、协议、证书和入口策略放在同一处。',button('添加监听','data-library="server"',true))+intro('<strong>同一条策略，多种协议接入。</strong> DoT 使用 TCP 插件与 TLS 证书；DoH 的 HTTP/3 可独立开启。')+list(byKinds(catalog.filter(d=>d.type==='server').map(d=>d.kind)))+available(['udp_server','tcp_server','http_server','quic_server'],'支持的接入协议');
    if(key==='upstreams')root.innerHTML=header(key,'从上游地址进入，展开并发裁决、Bootstrap、连接参数与代理出口。',button('添加上游组','data-create="forward"',true))+intro('上游组通过 <code>forward</code> 被策略引用；出口可集中配置在 <code>network.outbound</code>。')+list(byKinds(['forward','fallback']))+`<section class="workspace-section"><h2>全局出口</h2><div class="workspace-intro"><p>统一管理出口 profile、解析器和 SOCKS5。已有的全局字段保留在完整配置中。<br>默认出口：<code>${escape(config.network?.outbound?.default||'未指定 · 系统默认')}</code></p>${button('配置全局出口','data-global="network"')}</div></section>`+available(['forward','fallback'],'转发与回退');
    if(key==='response')root.innerHTML=header(key,'按处理职责配置缓存、ECS、本地记录和最终响应。',button('查看缓存条目','data-cache="cache_main"'))+intro('<strong>缓存是策略链中的插件实例。</strong> 多级结构按实际配置排列；持久化文件不是独立的 L2 服务。')+list(byKinds(responseKinds))+available(responseKinds,'缓存与响应处理能力');
    if(key==='strategies')root.innerHTML=header(key,'按顺序查看条件与执行动作，保留 jump、goto、fallback 和内联表达式。',button('新建策略','data-create="sequence"',true))+intro('每条策略对应一个 <code>sequence</code>。表单和原始参数共享同一份草稿，未展示的字段会原样保留。')+list(byKinds(['sequence','fallback']))+available(['sequence','fallback','any_match','qname','client_ip','qtype'],'策略与常用匹配器');
    if(key==='rules')root.innerHTML=header(key,'区分规则文件、Geo 数据、过滤规则和动态学习集合。',button('添加数据源','data-library="provider"',true))+intro('Provider 提供规则数据；<code>download</code> 负责下载，<code>cron</code> 负责调度，<code>reload_provider</code> 定向刷新快照。')+list(config.plugins.filter(p=>definition(p.type)?.type==='provider'))+available(catalog.filter(d=>d.type==='provider').map(d=>d.kind),'六类规则数据')+available(['learn_domain','download','cron','reload_provider'],'更新与学习');
    if(key==='integrations')root.innerHTML=header(key,'把解析结果接到防火墙、路由系统或外部服务。')+intro('每个联动保留独立 tag、目标、超时与错误处理配置，并由策略显式引用。示例配置尚未启用联动。')+list(byKinds(integrationKinds))+available(integrationKinds,'系统联动');
    if(key==='plugins')renderPlugins(root);
    if(key==='config')renderConfig(root);
    if(key==='runtime')renderRuntime(root);
    if(key==='metrics')renderMetrics(root);
    if(key==='logs')renderLogs(root);
    if(key==='system')renderSystem(root);
    if(key==='system'){
      root.querySelector('.page-actions')?.insertAdjacentHTML('beforeend','<a class="glass-btn" href="/plugins" title="打开 OxiDNS 原生管理界面">原生 OxiDNS 控制台</a>');
    }
  }
  function renderPlugins(root){
    const typeCount=t=>catalog.filter(d=>d.type===t).length;
    root.innerHTML=header('plugins','实例按当前草稿生成；插件目录来自官方 WebUI 定义。',button('自定义插件','data-custom',false))+`<div class="coverage-strip"><span><strong>${config.plugins.length}</strong> 个草稿实例</span><span><strong>${catalog.length}</strong> 种目录类型</span><span>目录类型分布：</span>${Object.keys(kinds).map(t=>`<span>${kinds[t]} ${typeCount(t)}</span>`).join('')}</div><div class="work-tabs"><button type="button" data-catalog-mode="instances" class="${catalogMode==='instances'?'active':''}">配置中的实例</button><button type="button" data-catalog-mode="library" class="${catalogMode==='library'?'active':''}">全部插件类型 · ${catalog.length}</button></div><section class="workspace-panel"><div class="workspace-toolbar"><select class="select" id="catalogType" aria-label="插件类别"><option value="all">所有类别</option>${Object.entries(kinds).map(([k,v])=>`<option value="${k}" ${catalogFilter===k?'selected':''}>${v}</option>`).join('')}</select><input class="inline-search" id="catalogSearch" type="search" placeholder="搜索插件、用途或 tag" aria-label="搜索完整插件目录" value="${escape(catalogQuery)}"><span class="toolbar-spacer"></span><span class="time-note" id="catalogCount"></span></div><div class="table-scroll"><table class="workspace-table catalog-table"><thead><tr><th>${catalogMode==='instances'?'实例':'插件能力'}</th><th>类型</th><th>用途 / 配置摘要</th><th>操作</th></tr></thead><tbody id="catalogRows"></tbody></table></div><div class="empty-state" id="catalogEmpty" hidden>没有匹配结果，请调整关键词或类别。</div></section><p class="page-subtitle">目录版本 ${window.OxiCatalog.commit.slice(0,7)} · 实际支持类型以服务端 /api/build 为准。</p>`;
    updateCatalog();$('#catalogSearch').addEventListener('input',e=>{catalogQuery=e.target.value;updateCatalog();});$('#catalogType').addEventListener('change',e=>{catalogFilter=e.target.value;updateCatalog();});
  }
  function updateCatalog(){
    const q=catalogQuery.toLowerCase().trim();
    const items=(catalogMode==='instances'?config.plugins.map(p=>({d:definition(p.type),p})):catalog.map(d=>({d}))).filter(({d,p})=>(catalogFilter==='all'||d?.type===catalogFilter)&&[d?.kind,d?.description,label(d?.kind),p?.tag,p?displayName(p):''].join(' ').toLowerCase().includes(q));
    $('#catalogRows').innerHTML=items.map(({d,p})=>`<tr><td>${p?`<button type="button" class="yp-instance-name" data-edit="${escape(p.tag)}">${escape(displayName(p))}</button>`:escape(label(d.kind))}<small>${p?escape(p.tag)+' · ':''}${escape(p?.type||d.kind)}</small></td><td>${kinds[d?.type]||'自定义'}</td><td>${escape(p?describe(p):d.description)}</td><td>${button(p?'配置':'添加实例',p?`data-edit="${escape(p.tag)}"`:`data-create="${d.kind}"`)}</td></tr>`).join('');
    $('#catalogCount').textContent=items.length+' 项';$('#catalogEmpty').hidden=items.length!==0;
  }
  function saveConfig(next){previous=clone(config);config=next;revision++;storage.set('previous',previous);storage.set('config',config);storage.set('revision',revision);rawText=null;}
  function renderConfig(root){
    if(rawText===null)rawText=rawFormat==='yaml'?yaml(config):JSON.stringify(config,null,2);
    const live=window.OxiObserve?.isReady?.();
    root.innerHTML=header('config','完整配置与可视化表单使用同一份草稿。保留未知插件、字段和表达式。',button('检查结构','data-check-config')+button('保存草稿','data-save-config',true)+(live?button('校验服务端','id="validate-service"'):button('连接后校验','disabled'))+(live?button('应用并热重载','id="apply-service"',true):button('应用并热重载','disabled')))+`<div class="raw-workspace"><div><div class="work-tabs"><button data-raw-format="yaml" class="${rawFormat==='yaml'?'active':''}" type="button">YAML</button><button data-raw-format="json" class="${rawFormat==='json'?'active':''}" type="button">JSON</button></div><textarea id="fullConfig" spellcheck="false" aria-label="完整配置草稿">${escape(rawText)}</textarea><p id="configMessage" class="field-error" role="status"></p></div><aside class="raw-aside"><h3>草稿状态</h3><p><strong>${config.plugins.length} 个插件实例</strong><br>${revision?'已修改 '+revision+' 次':'来自示例配置'}<br>${live?'已连接 OxiDNS · 应用前会做服务端校验':'未连接 OxiDNS 管理 API'}</p><p>${live?'服务端应用会携带当前配置版本，发生并发修改时拒绝覆盖；成功后请求热重载并回读状态。':'先连接 OxiDNS 管理接口，再使用服务端校验与应用。原生控制台仍可处理全部高级运维操作。'}</p>${button('导出 YAML','data-export-config')}${button('撤销上次保存','data-undo '+(previous?'':'disabled'))}<a class="button" href="/settings" target="_blank" rel="noopener">打开原生 OxiDNS 控制台</a></aside></div>`;
    $('#fullConfig').addEventListener('input',e=>rawText=e.target.value);
    if($('#apply-service'))$('#apply-service').disabled=!live||!serviceSource||serviceSource.base!==window.OxiObserve?.base();
    $('.raw-aside',root).insertAdjacentHTML('beforeend',`<p>${serviceSource?'草稿来源版本：'+escape(serviceSource.version.slice(0,12)):'未绑定服务端版本，禁止应用。请先载入实际配置。'}</p>${button('载入服务端配置','data-route="connection"')}${storage.get('service-backup',null)?button('下载应用前备份','data-export-service-backup'):''}`);
    if(live){
      $('.raw-aside',root).insertAdjacentHTML('beforeend',`${button('仅保存到服务','id="save-service-only"')}<p>全局配置必须先保存、再单独重启；修改监听或认证后，请使用新地址 / 账号重新连接。完整文本直接保存会保留注释，可视化编辑会规范化 YAML。</p>`);
      $('#save-service-only').onclick=()=>{
        let next;const message=$('#configMessage');
        try{next=parseConfig();window.OxiObserveModel.assertApplySource(serviceSource,window.OxiObserve.base(),window.OxiObserve.info()?.file||{},next,{allowGlobals:true});}
        catch(err){message.textContent=err.message;return;}
        const content=rawText;
        ask('保存服务端文件，但暂不应用？','先校验、备份并检查版本。保存后运行配置保持不变；全局配置需在运行时管理单独重启，插件配置可热重载。',async()=>{
          const b=$('#save-service-only');b.disabled=true;message.textContent='正在校验、备份并保存…';
          try{await window.OxiObserve.applyConfig(next,{reload:false,allowGlobals:true,content});rawText=null;renderPage(current);showToast('配置文件已保存；尚未应用，请核对后单独重启');}
          catch(err){message.textContent=err.message;}finally{b.disabled=false;}
        },'确认仅保存');
      };
    }
    $('#validate-service')?.addEventListener('click',async ev=>{const message=$('#configMessage'),b=ev.currentTarget;b.disabled=true;try{const next=parseConfig();message.className='form-feedback';message.textContent='正在请求 OxiDNS 服务端校验…';await window.OxiObserve.validateConfig(next);message.textContent='服务端校验通过，尚未写入。';showToast('服务端校验通过');}catch(error){message.className='field-error';message.textContent='服务端校验失败：'+error.message;}finally{b.disabled=false;}});
    $('#apply-service')?.addEventListener('click',()=>{
      let next,diff;const message=$('#configMessage');
      try{next=parseConfig();diff=window.OxiObserveModel.assertApplySource(serviceSource,window.OxiObserve.base(),window.OxiObserve.info()?.file||{},next);}
      catch(error){message.className='field-error';message.textContent=error.message;return;}
      const removed=diff.rows.filter(p=>p.status==='仅服务端').map(p=>p.tag);
      ask('应用 '+next.plugins.length+' 个插件的配置？',`目标：${window.OxiObserve.base()}。${diff.changed} 个插件有差异，删除 ${removed.length} 个${removed.length?'（'+removed.join('、')+'）':''}。先备份、服务端校验和版本检查，再保存并热重载；DNS 可能短暂中断。`,async()=>{
        message.className='form-feedback';message.textContent='正在校验、备份、保存并核对运行版本…';
        root.querySelectorAll('button,textarea').forEach(el=>el.disabled=true);
        try{const result=await window.OxiObserve.applyConfig(next,{reload:true,content:rawText});rawText=null;renderPage(current);showToast(result.unchanged?'配置没有变化，未写入或重载':'配置已保存，运行版本核对通过');}
        catch(error){message.className='field-error';message.textContent=error.message;showToast(error.message);}
        finally{root.querySelectorAll('button,textarea').forEach(el=>el.disabled=false);}
      },'确认应用');
    });
  }
  function parseConfig(){
    const parsed=rawFormat==='yaml'?window.jsyaml.load(rawText):JSON.parse(rawText);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.plugins))throw Error('配置必须包含 plugins 数组。');
    const seen=new Set();for(const p of parsed.plugins){if(!p||typeof p.tag!=='string'||!p.tag.trim()||typeof p.type!=='string'||!p.type.trim())throw Error('每个插件需要非空 tag 和 type。');if(seen.has(p.tag))throw Error('重复的 tag：'+p.tag);seen.add(p.tag);}
    return parsed;
  }
  const taskNames={reload:'热重载配置',restart:'重启 OxiDNS',shutdown:'关闭 OxiDNS',upgrade:'检查升级',provider:'定向重载数据源',download:'下载规则文件',cron:'运行定时任务',flush:'清空缓存'};
  function renderSystem(root){
    const info=window.OxiObserve?.info(),base=window.OxiObserve?.base()||'http://127.0.0.1:9199';
    root.innerHTML=header('system','YoPilot 界面 · OxiDNS 引擎、配置和插件语义保持不变。',button('服务连接','data-route="connection"'))+`<section class="workspace-panel">
      <div class="runtime-row"><div><h3>当前服务</h3><p>${escape(base)} · ${info?'OxiDNS '+escape(info.build.version)+' / '+escape(info.build.bundle):'尚未连接'}</p></div>${button('刷新服务信息','data-route="connection"')}</div>
      <div class="runtime-row"><div><h3>配置与插件</h3><p>${info?info.config.plugins.length+' 个服务端实例':'实例数量待连接'} · ${catalog.length} 种插件定义。完整参数、未知字段与 YAML 保留。</p></div>${button('高级配置','data-route="config"')}</div>
      <div class="runtime-row"><div><h3>API、安全与网络</h3><p>全局参数保存在草稿中，服务端校验后可以仅保存文件；需要重启的变更另行确认。</p></div>${button('配置校验与保存','data-route="config"')}</div>
      <div class="runtime-row"><div><h3>原生管理入口</h3><p>查询统计使用原生采样接口；外部文件仅展示配置来源，不增加独立后台。原生升级可能覆盖 YoPilot 静态页面，请先备份。</p></div><div class="oxi-actions">${button('查询统计','data-route="history"')}${button('规则来源与文件','data-route="files"')}<a class="button" href="${escape(base)}/plugins" target="_blank" rel="noopener">原生插件管理</a><a class="button" href="${escape(base)}/logs" target="_blank" rel="noopener">原生日志</a><a class="button" href="${escape(base)}/native.html" target="_blank" rel="noopener">原生概览</a></div></div>
      </section>`;
  }
  function loadMatcherModes(root){
    if(!window.OxiObserve?.isReady())return;
    $$('[data-matcher-mode]',root).forEach(async sel=>{
      const tag=sel.dataset.matcherMode;
      try{const data=await window.OxiObserve.request('/api/plugins/'+encodeURIComponent(tag)+'/status');if(!sel.isConnected)return;matcherModes[tag]=data.mode;sel.value=data.mode;sel.disabled=false;}
      catch(err){if(sel.isConnected){sel.disabled=true;sel.insertAdjacentHTML('afterend','<small>'+escape(err.message)+'</small>');}}
    });
  }
  function renderRuntime(root){
    const live=window.OxiObserve?.isReady?.();
    root.innerHTML=header('runtime','把配置管理、服务控制和插件运行操作分开处理。')+(live?'已连接 OxiDNS：危险动作会二次确认并调用管理 API。':'尚未连接 OxiDNS：先连接服务后执行真实操作；未连接时只保留本地演示记录。')+`<section class="workspace-panel">${['reload','restart','shutdown','upgrade'].map(t=>`<div class="runtime-row"><div><h3>${taskNames[t]}</h3><p>${({reload:'重建插件并跟踪 pending → in_progress → ok / failed。',restart:'以原有启动参数重新启动服务，期间 DNS 可能短暂中断。',shutdown:'停止当前实例；需要服务管理器或终端重新启动。',upgrade:'检查 release、目标 bundle、下载校验和应用结果。'})[t]}</p></div>${button(t==='upgrade'?'检查升级':taskNames[t],`data-task="${t}"`)}</div>`).join('')}</section><section class="workspace-section"><h2>Matcher 运行模式</h2><div class="workspace-panel">${(live?window.OxiObserve.serviceConfig().plugins:config.plugins).filter(p=>definition(p.type)?.type==='matcher').map(p=>`<div class="runtime-row"><div><h3>${escape(p.tag)}</h3><p>固定的是基础匹配结果；引用处的 ! 取反仍生效。重载后恢复 normal。</p></div><select ${live?'disabled':''} data-matcher-mode="${escape(p.tag)}" aria-label="${escape(p.tag)} 运行模式">${[['normal','正常匹配'],['always_true','固定为真'],['always_false','固定为假']].map(([v,l])=>`<option value="${v}" ${(matcherModes[p.tag]||'normal')===v?'selected':''}>${l}</option>`).join('')}</select></div>`).join('')||'<div class="empty-state">没有独立的 matcher 实例</div>'}</div></section><section class="workspace-section"><h2>插件运行任务</h2>${available(['reload_provider','download','cron','upgrade'],'任务配置')}</section><section class="workspace-section"><h2>本地操作记录</h2><div class="workspace-panel" id="taskHistory">${historyHTML()}</div></section>`;
    loadMatcherModes(root);
  }
  const historyHTML=()=>runtimeHistory.length?runtimeHistory.map(t=>`<div class="runtime-row"><div><h3>${escape(t.name)}</h3><p>${escape(t.detail)}</p></div><span class="time-note">${t.time}</span></div>`).join(''):'<div class="empty-state">本页会话尚未执行操作</div>';
  function recordTask(name,detail){runtimeHistory.unshift({name,detail,time:new Date().toLocaleTimeString('zh-CN',{hour12:false})});if($('#taskHistory'))$('#taskHistory').innerHTML=historyHTML();}
  const metricsSample=[['query_total','查询总数','12,492'],['query_error_total','查询错误','8'],['query_inflight','处理中','2'],['cache_hit_total','缓存命中','10,394'],['forward_timeout_total','上游超时','3'],['server_inflight','监听器处理中','2']];
  const endpoints=[['GET','/api/health · /api/readyz','健康与就绪状态'],['GET','/api/build · /api/system','编译能力与进程资源'],['GET','/api/metrics','Prometheus 文本'],['GET','/api/config','完整 YAML 与内容版本'],['PUT','/api/config','校验并保存，base_version 冲突保护'],['POST','/api/config/validate','服务端校验 YAML'],['POST','/api/reload','提交配置重载'],['GET','/api/reload/status','检查应用结果'],['GET','/api/logs/stream','运行日志 SSE'],['GET','/api/plugins/<tag>/records','历史查询与过滤'],['GET','/api/plugins/<tag>/records/<id>','完整查询与执行路径'],['GET','/api/plugins/<tag>/stats/latency','慢查询与延时摘要'],['GET','/api/plugins/<tag>/stats/timeseries','查询趋势'],['GET','/api/plugins/<tag>/stream','查询记录 SSE'],['POST','/api/plugins/<tag>/reload','Provider 定向重载'],['GET','/api/plugins/<tag>/entries','缓存项分页'],['POST','/api/plugins/<tag>/mode','Matcher 运行模式'],['POST','/api/upgrade/check · /api/upgrade/apply','版本检查与升级']];
  async function renderLiveMetrics(root){
    root.innerHTML=header('metrics','当前 OxiDNS Prometheus 指标；不显示示例采样。',button('刷新指标','id="live-metrics-refresh"'))+'<section class="workspace-panel"><p id="live-metrics-status" role="status">读取中…</p><pre id="live-metrics" style="max-height:60vh;overflow:auto;padding:16px"></pre></section>';
    $('#live-metrics-refresh').onclick=()=>renderLiveMetrics(root);
    const target=$('#live-metrics'),status=$('#live-metrics-status');
    try{const metrics=await window.OxiObserve.request('/api/metrics',{text:true});if(!target.isConnected)return;target.textContent=metrics;status.textContent='服务端实时指标 · '+new Date().toLocaleTimeString('zh-CN');}
    catch(err){if(status.isConnected)status.textContent='无法读取：'+err.message;}
  }
  function renderMetrics(root){if(window.OxiObserve?.mode()==='live'){renderLiveMetrics(root);return;}root.innerHTML=header('metrics','把运行指标、健康检查与 API 接口状态放在同一工作区。',button('导出指标示例','data-export-metrics'))+intro('原型展示接口映射和示例采样。没有实际采集到的值在正式 UI 中显示“未启用”或“暂无数据”。')+`<section class="workspace-panel"><div class="table-scroll"><table class="workspace-table"><thead><tr><th>指标</th><th>含义</th><th>示例值</th></tr></thead><tbody>${metricsSample.map(m=>`<tr><td><code>${m[0]}</code></td><td>${m[1]}</td><td>${m[2]}</td></tr>`).join('')}</tbody></table></div></section><section class="workspace-section"><h2>上游探测与 IP 优选</h2><div class="workspace-intro"><p>探测方式、超时、并发、评分缓存和保留地址数由 <code>ip_selector</code> 管理。</p>${button('配置探测','data-create="ip_selector"')}</div></section><section class="workspace-section"><h2>管理接口</h2><section class="workspace-panel"><div class="table-scroll"><table class="workspace-table api-table"><thead><tr><th>方法</th><th>接口</th><th>用途</th></tr></thead><tbody>${endpoints.map(e=>`<tr><td><span class="protocol-pill">${e[0]}</span></td><td>${escape(e[1])}</td><td>${e[2]}</td></tr>`).join('')}</tbody></table></div></section></section>`;}
  const logSamples=[['12:41:08','INFO','query','www.example.com → localdns · 34 ms'],['12:40:58','WARN','forward','mihomo:1053 响应耗时 642 ms'],['12:40:44','DEBUG','cache','cache_main hit · qname=static.example.com'],['12:40:27','ERROR','provider','规则文件读取失败 · /etc/oxidns/learned.txt'],['12:39:56','INFO','runtime','插件初始化完成，DNS 服务就绪']];
  function renderLogs(root){root.innerHTML=header('logs','运行事件与查询明细独立查看，支持级别、关键词筛选和导出。',button('导出当前日志','data-export-logs'))+`<section class="log-workspace"><div class="workspace-toolbar"><select class="select" id="runtimeLogLevel" aria-label="运行日志级别"><option value="all">全部级别</option>${['DEBUG','INFO','WARN','ERROR'].map(l=>`<option>${l}</option>`).join('')}</select><input class="inline-search" id="runtimeLogSearch" aria-label="筛选运行日志" type="search" placeholder="搜索消息或插件"><span class="toolbar-spacer"></span><span class="time-note">示例日志 · 5 条</span></div><div class="log-list" id="runtimeLogs"></div></section>`;updateLogs();$('#runtimeLogLevel').addEventListener('change',updateLogs);$('#runtimeLogSearch').addEventListener('input',updateLogs);}
  function filteredLogs(){const level=$('#runtimeLogLevel')?.value||'all',q=($('#runtimeLogSearch')?.value||'').toLowerCase();return logSamples.filter(r=>(level==='all'||r[1]===level)&&r.join(' ').toLowerCase().includes(q));}
  function updateLogs(){const rows=filteredLogs();$('#runtimeLogs').innerHTML=rows.length?rows.map(r=>`<div class="log-row"><span class="log-time">${r[0]}</span><span class="log-level ${r[1].toLowerCase()}">${r[1]}</span><span class="log-scope">${r[2]}</span><span class="log-message">${escape(r[3])}</span></div>`).join(''):'<div class="empty-state">没有匹配的日志</div>';}
  const dialog=document.createElement('dialog');dialog.className='edit-dialog';dialog.setAttribute('aria-labelledby','editorTitle');document.body.append(dialog);
  const confirm=document.createElement('dialog');confirm.className='confirm-dialog';confirm.setAttribute('aria-labelledby','confirmTitle');document.body.append(confirm);
  let editor=null, confirmAction=null, returnFocus=null, confirmReturnFocus=null;
  function ask(title,description,action,actionLabel='确认演示'){confirmReturnFocus=document.activeElement;confirmAction=action;confirm.innerHTML=`<h2 id="confirmTitle">${escape(title)}</h2><p>${escape(description)}</p><div class="confirm-actions">${button('取消','data-cancel-confirm')}${button(actionLabel,'data-confirm',true)}</div>`;confirm.showModal();}
  function closeConfirm(){confirm.close();confirmReturnFocus?.focus();}
  confirm.addEventListener('click',e=>{if(e.target.closest('[data-cancel-confirm]'))closeConfirm();if(e.target.closest('[data-confirm]')){const action=confirmAction;closeConfirm();action?.();}});
  const initialArgs=d=>{if(!d)return {};if(d.configSchema.length===1&&d.configSchema[0].key==='args')return d.configSchema[0].initialValue??(d.configSchema[0].type==='array'?[]:'');return Object.fromEntries(d.configSchema.filter(f=>f.initialValue!==undefined).map(f=>[f.key,clone(f.initialValue)]));};
  function openEditor(kind,tag){
    const original=tag?config.plugins.find(p=>p.tag===tag):null,d=definition(original?.type||kind);
    let generated=(kind||'custom')+'_main',counter=2;while(config.plugins.some(p=>p.tag===generated))generated=kind+'_'+counter++;
    editor={originalTag:tag||null,value:clone(original||{tag:generated,type:kind||'custom',args:initialArgs(d)}),tab:d?'form':'raw',initial:null,raw:null,choices:{},dirty:false};
    editor.initial=JSON.stringify(editor.value);editor.raw=JSON.stringify(editor.value,null,2);returnFocus=document.activeElement;drawEditor();dialog.showModal();
  }
  function openGlobal(scope){
    const args=scope==='network'?config.network?.outbound||{profiles:{direct:{resolver:'system',proxy:'none'}}}:typeof config.api?.http==='string'?{listen:config.api.http}:config.api?.http||{listen:'0.0.0.0:9199'};
    const value={type:scope==='network'?'__network':'__api',args:clone(args)};
    editor={scope,originalTag:null,value,tab:'form',initial:JSON.stringify(value),raw:JSON.stringify(value.args,null,2),choices:{},dirty:false};
    returnFocus=document.activeElement;drawEditor();dialog.showModal();
  }
  function argsObject(){const d=definition(editor.value.type);return d?.configSchema.length===1&&d.configSchema[0].key==='args'?{args:editor.value.args}:editor.value.args;}
  function getPath(path){return path.reduce((v,k)=>v?.[k],argsObject());}
  function setPath(path,value,remove=false){
    let root=argsObject();if(!root||typeof root!=='object'||Array.isArray(root))root={};let ptr=root;
    path.slice(0,-1).forEach((key,i)=>{if(!ptr[key]||typeof ptr[key]!=='object')ptr[key]=typeof path[i+1]==='number'?[]:{};ptr=ptr[key];});
    const key=path.at(-1);if(remove)delete ptr[key];else ptr[key]=value;
    const d=definition(editor.value.type);editor.value.args=d?.configSchema.length===1&&d.configSchema[0].key==='args'?root.args:root;editor.dirty=true;
  }
  const encodePath=path=>escape(JSON.stringify(path));
  function fieldMarkup(field,path,contextName=''){
    const value=getPath(path),id='field-'+path.map(p=>String(p).replace(/[^a-z0-9_-]/gi,'_')).join('-');
    return `<div class="field-row"><div class="field-caption"><label for="${id}">${escape(field.label||field.key||'值')}${field.required?'<span class="required">*</span>':''}</label><code>${escape(field.key||'')}</code></div><div class="field-control">${controlMarkup(field,path,value,id,contextName?[contextName,field.label||field.key||'值'].join(' / '):field.label||field.key||'值')}${field.description?`<small>${escape(field.description)}</small>`:''}</div></div>`;
  }
  function controlMarkup(field,path,value,id,accessibleName=field.label||field.key||'值'){
    const common=`id="${id}" data-field="${encodePath(path)}" data-field-type="${field.type}" aria-label="${escape(accessibleName)}"`;
    if(field.type==='object')return `<fieldset class="field-object" aria-label="${escape(accessibleName)}">${(field.fields||[]).map(f=>fieldMarkup(f,[...path,f.key],accessibleName)).join('')}</fieldset>`;
    if(field.type==='array'){
      if(value!==undefined&&!Array.isArray(value))return `<textarea ${common} data-json="true">${escape(JSON.stringify(value,null,2))}</textarea><small>当前值为非数组形式，原样保留；可在原始参数中编辑。</small>`;
      const values=value||[];
      return `<div class="array-editor" role="group" aria-label="${escape(accessibleName)}">${values.map((v,i)=>{
        const itemPath=[...path,i],opts=field.itemOptions,choice=editor.choices[JSON.stringify(itemPath)]||opts?.find(o=>o.type===(typeof v==='object'&&v!==null?'object':'text'))?.optionKey||opts?.[0]?.optionKey;
        const spec=opts?.find(o=>o.optionKey===choice)||field.item||{type:'text'};
        return `<div class="array-item"><div class="array-item-top"><span>${i+1}. ${escape(spec.label||'条目')}</span>${opts?`<select data-item-choice="${encodePath(itemPath)}" aria-label="${escape(accessibleName)} 第 ${i+1} 项类型">${opts.map(o=>`<option value="${o.optionKey}" ${o.optionKey===choice?'selected':''}>${escape(o.label||o.type)}</option>`).join('')}</select>`:''}<div>${button('上移',`data-move="${encodePath(itemPath)}" aria-label="上移 ${escape(accessibleName)} 第 ${i+1} 项" ${i===0?'disabled':''}`)} ${button('移除',`data-remove="${encodePath(itemPath)}" aria-label="移除 ${escape(accessibleName)} 第 ${i+1} 项"`)}</div></div>${controlMarkup(spec,itemPath,v,id+'-'+i,accessibleName+' 第 '+(i+1)+' 项')}</div>`;
      }).join('')}${button('添加条目',`data-add="${encodePath(path)}" aria-label="添加 ${escape(accessibleName)} 条目"`)}</div>`;
    }
    if(field.type==='record'||field.type==='json')return `<textarea ${common} data-json="true" placeholder="${escape(field.example||'{}')}">${value===undefined?'':escape(JSON.stringify(value,null,2))}</textarea>`;
    if(field.type==='switch')return `<select ${common}><option value="" ${value===undefined?'selected':''}>默认${field.default===undefined?'':field.default?'（开启）':'（关闭）'}</option><option value="true" ${value===true?'selected':''}>开启</option><option value="false" ${value===false?'selected':''}>关闭</option></select>`;
    if(field.type==='select'){
      const opts=field.options||[];const values=opts.map(o=>o.value);const unknown=value!==undefined&&!values.includes(value);
      if(!opts.length)return `<input ${common} value="${escape(value)}" placeholder="${escape(field.example||'留空使用默认')}"/>`;
      return `<select ${common}><option value="">默认${field.default===undefined?'':'（'+escape(field.default)+'）'}</option>${unknown?`<option selected value="${escape(value)}">${escape(value)}（保留已有值）</option>`:''}${opts.map(o=>`<option value="${escape(o.value)}" ${o.value===value?'selected':''}>${escape(o.label)}</option>`).join('')}</select>`;
    }
    if(field.type==='textarea')return `<textarea ${common} placeholder="${escape(field.example||'')}">${escape(value)}</textarea>`;
    const type=field.type==='number'?'number':field.type==='password'?'password':field.type==='time'?'time':'text';
    const placeholder=field.default!==undefined?'默认：'+field.default:field.example||'留空使用默认';
    const refs=field.type==='reference'?config.plugins.filter(p=>(!field.referenceTypes||field.referenceTypes.includes(definition(p.type)?.type))&&(!field.referencePlugins||field.referencePlugins.includes(p.type))):[];
    return `<input ${common} type="${type}" ${type==='number'?'step="any"':''} value="${escape(value)}" placeholder="${escape(placeholder)}" ${refs.length?'list="'+id+'-refs"':''}>${refs.length?`<datalist id="${id}-refs">${refs.map(p=>`<option value="${escape((field.referencePrefix??'')+p.tag)}">${escape(label(p.type))}</option>`).join('')}</datalist>`:''}`;
  }
  function fieldAt(path){let fields=definition(editor.value.type)?.configSchema||[],field;for(let i=0;i<path.length;i++){const segment=path[i];if(typeof segment==='number'){field=field.itemOptions?.find(o=>o.optionKey===editor.choices[JSON.stringify(path.slice(0,i+1))])||field.item||field.itemOptions?.[0]||{type:'text'};fields=field.fields||[];}else{field=fields.find(f=>f.key===segment);fields=field?.fields||[];}}return field;}
  function validateFields(fields,object,prefix=''){
    for(const f of fields){const v=object?.[f.key],name=prefix+f.label;
      if(f.required&&(v===undefined||v===null||v===''||(Array.isArray(v)&&!v.length)))throw Error('请填写：'+name);
      if(v===undefined)continue;
      if(f.type==='object'&&v&&typeof v==='object')validateFields(f.fields||[],v,name+' / ');
      if(f.type==='array'&&Array.isArray(v))v.forEach((item,index)=>{const spec=f.item||f.itemOptions?.find(o=>o.type===(typeof item==='object'?'object':'text'));if(spec?.fields)validateFields(spec.fields,item,name+' / '+(index+1)+' / ');});
    }
  }
  function previewValue(){return editor.scope==='network'?{network:{outbound:editor.value.args}}:editor.scope==='api'?{api:{http:editor.value.args}}:editor.value;}
  function drawEditor(){
    const d=definition(editor.value.type),schema=d?.configSchema||[],normal=schema.filter(f=>!f.advanced),advanced=schema.filter(f=>f.advanced);
    const form=`${editor.scope?'':`<div class="form-identity"><label>实例标识 tag<input id="pluginTag" value="${escape(editor.value.tag)}" autocomplete="off" spellcheck="false"></label><label>插件类型<input value="${escape(editor.value.type)}" readonly aria-label="插件类型"></label></div>`}${normal.map(f=>fieldMarkup(f,[f.key])).join('')}${advanced.length?`<details class="advanced-fields"><summary>高级参数 · ${advanced.length} 项</summary>${advanced.map(f=>fieldMarkup(f,[f.key])).join('')}</details>`:''}${schema.length?'':'<p class="page-subtitle">此插件无需配置参数。未知字段仍保留在原始参数中。</p>'}`;
    dialog.innerHTML=`<div class="edit-head"><div><h2 id="editorTitle">${editor.scope?'配置':editor.originalTag?'配置':'添加'}${escape(label(editor.value.type))}</h2><p>${escape(d?.description||'保留自定义类型与参数，不限制新插件能力。')}</p></div>${button('关闭','data-close-editor aria-label="关闭参数编辑"')}</div><div class="work-tabs edit-tabs">${[['form','参数配置'],['raw','完整参数 JSON'],['preview','YAML 预览']].map(([v,t])=>`<button type="button" data-editor-tab="${v}" class="${editor.tab===v?'active':''}" ${v==='form'&&!d?'disabled':''}>${t}</button>`).join('')}</div><div class="edit-scroll">${editor.tab==='form'?form:editor.tab==='raw'?`<textarea class="raw-plugin" id="rawPlugin" aria-label="插件完整 JSON" spellcheck="false">${escape(editor.raw)}</textarea><p class="page-subtitle">编辑整个插件对象。自定义字段、对象、数组会保留。</p>`:`<pre class="code-preview">${escape(yaml(previewValue()))}</pre><p class="page-subtitle">保存后加入完整配置草稿，实际执行顺序仍由策略链控制。</p>`}<p id="editorError" class="field-error" role="alert"></p><div class="edit-links"><a href="https://oxidns.org/plugin-reference/overview" target="_blank" rel="noopener noreferrer">官方插件参考 ↗</a></div></div><div class="edit-foot"><span class="edit-summary">仅保存本地草稿</span>${button('取消','data-close-editor')}${button('保存草稿','data-save-plugin',true)}</div>`;
  }
  function syncRaw(){if(editor.tab==='raw'){const parsed=JSON.parse($('#rawPlugin').value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('插件必须是包含 tag、type、args 的对象。');if(editor.scope)editor.value.args=parsed;else editor.value=parsed;editor.raw=$('#rawPlugin').value;}}
  function closeEditor(){if(JSON.stringify(editor.value)!==editor.initial||(editor.tab==='raw'&&$('#rawPlugin')?.value!==editor.raw)){ask('放弃未保存的编辑？','只放弃这次编辑，已保存的草稿保持不变。',()=>{dialog.close();returnFocus?.focus();},'放弃修改');}else{dialog.close();returnFocus?.focus();}}
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
  dialog.addEventListener('input',e=>{
    if(e.target.id==='pluginTag'){editor.value.tag=e.target.value;return;}
    if(e.target.id==='rawPlugin')return;
    const input=e.target.closest('[data-field]');if(!input)return;
    const path=JSON.parse(input.dataset.field);let value=input.value;
    try{if(input.dataset.json==='true'&&value!=='')value=JSON.parse(value);else if(input.dataset.fieldType==='number'&&value!=='')value=Number(value);else if(input.dataset.fieldType==='switch'&&value!=='')value=value==='true';else if(input.dataset.fieldType==='select'&&value!==''){const spec=fieldAt(path);value=spec?.options?.find(o=>String(o.value)===value)?.value??value;}setPath(path,value,input.value==='');input.setCustomValidity('');$('#editorError').textContent='';}catch(error){input.setCustomValidity('请输入有效 JSON');$('#editorError').textContent='此字段 JSON 无效：'+error.message;}
  });
  dialog.addEventListener('change',e=>{const input=e.target.closest('[data-item-choice]');if(!input)return;const path=JSON.parse(input.dataset.itemChoice);editor.choices[JSON.stringify(path)]=input.value;drawEditor();});
  dialog.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    try{
      if(b.hasAttribute('data-close-editor')){closeEditor();return;}
      if(b.dataset.editorTab){syncRaw();const bad=$('input:invalid,textarea:invalid',dialog);if(bad)throw Error('请先修正无效字段。');editor.raw=JSON.stringify(editor.scope?editor.value.args:editor.value,null,2);editor.tab=b.dataset.editorTab;drawEditor();return;}
      if(b.dataset.add){const path=JSON.parse(b.dataset.add),f=fieldAt(path),arr=getPath(path)||[],item=f.item||f.itemOptions?.[0];setPath(path,[...arr,item?.type==='object'?{}:item?.type==='array'?[]:'']);drawEditor();return;}
      if(b.dataset.remove){const path=JSON.parse(b.dataset.remove),index=path.pop(),arr=[...getPath(path)];arr.splice(index,1);setPath(path,arr);drawEditor();return;}
      if(b.dataset.move){const path=JSON.parse(b.dataset.move),index=path.pop(),arr=[...getPath(path)];[arr[index-1],arr[index]]=[arr[index],arr[index-1]];setPath(path,arr);drawEditor();return;}
      if(b.hasAttribute('data-save-plugin')){
        syncRaw();const value=editor.value;const invalidField=$('input:invalid,textarea:invalid',dialog);if(invalidField)throw Error('请先修正无效字段。');
        if(editor.scope){
          if(!value.args||typeof value.args!=='object'||Array.isArray(value.args))throw Error('全局参数必须是对象。');
          validateFields(definition(value.type)?.configSchema||[],argsObject());
          const next=clone(config);if(editor.scope==='network'){if(value.args.default&&!value.args.profiles?.[value.args.default])throw Error('默认出口必须引用 profiles 中已有的名称。');next.network={...next.network,outbound:clone(value.args)};}else{const a=value.args;if(Boolean(a.ssl?.cert)!==Boolean(a.ssl?.key))throw Error('TLS 证书和私钥需要成对填写。');if(a.auth?.type==='basic'&&(!a.auth.username||!a.auth.password))throw Error('Basic Auth 需要用户名和密码。');next.api={...next.api,http:clone(a)};}
          saveConfig(next);dialog.close();renderPage(current);showToast('全局配置已保存为本地草稿');return;
        }
        if(typeof value.tag!=='string'||!value.tag.trim()||typeof value.type!=='string'||!value.type.trim())throw Error('请填写 tag 和 type。');
        if(config.plugins.some(p=>p.tag===value.tag&&p.tag!==editor.originalTag))throw Error('tag 已存在，请使用唯一标识。');
        const invalid=$('input:invalid,textarea:invalid',dialog);if(invalid){invalid.focus();throw Error(invalid.validationMessage);}
        validateFields(definition(value.type)?.configSchema||[],argsObject());
        let next=clone(config);
        if(editor.originalTag&&editor.originalTag!==value.tag){
          if(!window.OxiObserve?.isReady())throw Error('重命名需要连接服务进行引用检查');
          const savedRevision=revision,scope=window.OxiObserve.scope(''),snapshot=clone(value),oldTag=editor.originalTag;
          next.plugins[next.plugins.findIndex(p=>p.tag===oldTag)]={...snapshot,tag:oldTag};
          b.disabled=true;
          try{const graph=await window.OxiObserve.validateConfig(next);if(!Array.isArray(graph.dependency_graph?.edges))throw Error('依赖图不可用，未重命名');next=window.OxiAdvancedModel.mutatePlugin(next,graph.dependency_graph.edges,oldTag,{rename:snapshot.tag});const i=next.plugins.findIndex(p=>p.tag===snapshot.tag);next.plugins[i]={...snapshot,args:next.plugins[i].args};await window.OxiObserve.validateConfig(next);if(revision!==savedRevision||JSON.stringify(scope)!==JSON.stringify(window.OxiObserve.scope(''))||JSON.stringify(editor.value)!==JSON.stringify(snapshot))throw Error('校验期间配置或编辑内容已变化，请重新保存');}
          finally{b.disabled=false;}
        }else{const index=next.plugins.findIndex(p=>p.tag===editor.originalTag);if(index>=0)next.plugins[index]=clone(value);else next.plugins.push(clone(value));}
        saveConfig(next);dialog.close();renderPage(current);returnFocus?.focus();showToast('已保存本地草稿：'+value.tag);
      }
    }catch(error){$('#editorError').textContent=error.message;}
  });
  function exportFile(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function openCache(tag){
    if(window.OxiObserve?.mode()==='live'){
      if(window.OxiObserve.isReady()&&window.OxiObserve.serviceConfig()?.plugins.some(p=>p.tag===tag&&p.type==='cache'))window.OxiObserve.showCache(tag);
      else showToast('该缓存不在已连接服务中，请先载入实际配置');
      return;
    }
    const cacheRows=[['example.com','A','192.0.2.10',240],['static.example.com','AAAA','2001:db8::10',180]];
    confirmReturnFocus=document.activeElement;confirm.innerHTML=`<h2 id="confirmTitle">${escape(tag)} · 缓存条目</h2><p>以下是示例缓存内容；正式接入后按 qname 搜索并分页读取。</p><input class="form-input" id="cacheSearch" type="search" placeholder="搜索域名" aria-label="搜索缓存条目"><div id="cacheResults"></div><div class="confirm-actions">${button('关闭','data-cancel-confirm')}${button('清空演示缓存',`data-cache-flush="${escape(tag)}"`)}</div>`;const update=()=>{$('#cacheResults').innerHTML=cacheRows.filter(r=>r[0].includes($('#cacheSearch').value.toLowerCase())).map(r=>`<div class="runtime-row"><div><h3>${r[0]} · ${r[1]}</h3><p>${r[2]} · TTL ${r[3]} s</p></div></div>`).join('')||'<p>没有匹配的缓存项</p>';};update();$('#cacheSearch').addEventListener('input',update);confirm.showModal();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.create){openEditor(b.dataset.create);return;}
    if(b.dataset.edit){openEditor(null,b.dataset.edit);return;}
    if(b.hasAttribute('data-custom')){openEditor('custom');return;}
    if(b.dataset.library){catalogMode='library';catalogFilter=b.dataset.library;catalogQuery='';showView('plugins');return;}
    if(b.dataset.catalogMode){catalogMode=b.dataset.catalogMode;renderPage('plugins');return;}
    if(b.dataset.cache){openCache(b.dataset.cache);return;}
    if(b.dataset.cacheFlush){const tag=b.dataset.cacheFlush,live=window.OxiObserve?.isReady?.();closeConfirm();ask(live?'确认清空运行缓存？':'清空缓存演示',live?'该操作会清空 OxiDNS 当前缓存池，且无法恢复缓存条目。':'只清空本次演示结果，不访问运行中的 OxiDNS。',async()=>{if(!live){recordTask('清空缓存','演示完成 · 未请求服务端');showToast('流程演示完成；真实服务未受影响');return;}try{await window.OxiObserve.runAction('flush',tag);recordTask('清空缓存 · '+tag,'服务端已执行');showToast('缓存已清空：'+tag);}catch(err){showToast('缓存清空失败：'+err.message);}},live?'确认清空':'确认演示');return;}
    if(b.dataset.global){openGlobal(b.dataset.global);return;}
    if(b.dataset.task==='upgrade'&&window.OxiObserve?.isReady()&&window.OxiAdvanced){window.OxiAdvanced.upgrade();return;}
    if(b.dataset.task){const t=b.dataset.task,target=b.dataset.target||'',live=window.OxiObserve?.isReady?.();if(!live&&window.OxiObserve?.mode()==='live'){showToast('服务未连接，未执行任何操作');return;}closeConfirm();ask(live?taskNames[t]:taskNames[t]+' · 演示',live?(({shutdown:'将停止 DNS 服务，页面无法重新启动它。需要 SSH / 服务管理器恢复。',restart:'将重启服务，DNS 与控制台可能短暂中断。',reload:'将重建所有插件，运行时 Matcher 模式会复位。',provider:'刷新当前运行数据源，不应用本地草稿。',upgrade:'仅检查官方版本；实际升级会覆盖 YoPilot 静态页面，需先备份并通过原生控制台完成。'})[t]||'确认后将调用 OxiDNS 管理 API。')+(target?' 目标：'+target:''):'确认后只展示本地操作记录，不会发送真实请求。'+(target?' 目标：'+target:''),async()=>{if(!live){recordTask(taskNames[t]+(target?' · '+target:''),'演示完成 · 未连接服务端');showToast('流程演示完成；真实服务未受影响');return;}try{const action=t==='upgrade'?'upgrade-check':t;const result=await window.OxiObserve.runAction(action,target);recordTask(taskNames[t]+(target?' · '+target:''),(t==='upgrade'?JSON.stringify(result):['restart','shutdown','cron'].includes(t)?'请求已受理，请回读状态确认完成':'服务端返回成功'));showToast(t==='upgrade'?'检查完成，详情见本地操作记录':taskNames[t]+(['restart','shutdown','cron'].includes(t)?'请求已受理':'已完成'));}catch(err){showToast(taskNames[t]+'失败：'+err.message);}},live?'确认执行':'确认演示');return;}
    if(b.hasAttribute('data-export-config')){exportFile('oxidns-config-draft.yaml',yaml(config),'application/yaml');return;}
    if(b.hasAttribute('data-export-service-backup')){const backup=storage.get('service-backup',null);if(backup)exportFile('yopilot-config-backup-'+backup.version.slice(0,12)+'.yaml',backup.content,'application/yaml');return;}
    if(b.hasAttribute('data-export-metrics')){exportFile('oxidns-metrics-example.prom','# Example data only\n'+metricsSample.map(m=>m[0]+' '+m[2].replaceAll(',','')).join('\n'));return;}
    if(b.hasAttribute('data-export-logs')){exportFile('oxidns-example-logs.txt',filteredLogs().map(r=>r.join(' ')).join('\n'));return;}
    if(b.hasAttribute('data-undo')){if(previous){const restore=clone(previous);saveConfig(restore);renderPage('config');showToast('已撤销上一次保存');}return;}
    if(b.hasAttribute('data-check-config')||b.hasAttribute('data-save-config')||b.dataset.rawFormat){
      try{const next=parseConfig();if(b.dataset.rawFormat){rawFormat=b.dataset.rawFormat;rawText=rawFormat==='yaml'?yaml(next):JSON.stringify(next,null,2);renderPage('config');}
        else if(b.hasAttribute('data-save-config')){saveConfig(next);renderPage('config');showToast('配置草稿已保存；未应用到服务');}
        else{$('#configMessage').className='form-feedback';$('#configMessage').textContent='语法与基础结构检查通过；未执行服务端依赖校验。';}
      }catch(error){$('#configMessage').className='field-error';$('#configMessage').textContent=error.message;}return;
    }
  });
  document.addEventListener('change',e=>{const sel=e.target.closest('[data-matcher-mode]');if(!sel)return;const tag=sel.dataset.matcherMode,mode=sel.value,old=matcherModes[tag]||'normal',live=window.OxiObserve?.isReady?.();sel.value=old;if(mode===old)return;if(!live&&window.OxiObserve?.mode()==='live'){showToast('服务未连接，未更改 Matcher');return;}const apply=async()=>{try{if(live){await window.OxiObserve.runAction('matcher',tag,{mode});recordTask('Matcher '+tag,'服务端模式：'+mode+' · reload / restart 后恢复 normal');showToast('Matcher 运行模式已更新：'+mode);}else{recordTask('Matcher '+tag,'演示模式：'+mode+' · 重载后恢复正常');showToast('运行模式演示完成；真实服务未受影响');}matcherModes[tag]=mode;sel.value=mode;}catch(err){sel.value=old;showToast('Matcher 更新失败：'+err.message);}};if(mode==='normal')apply();else ask('固定 Matcher 的基础结果？',live?'这会立即改变当前运行时的 matcher 基础结果；不会写入 YAML，reload / restart 后恢复 normal。':'引用处的取反逻辑仍生效。此处仅演示，真实运行时状态不变。',apply,live?'确认执行':'确认演示');});

  window.OxiEngine={
    catalog,routeInfo,label,describe,
    config:()=>clone(config), revision:()=>revision,
    isDirty:()=>current==='config'&&rawText!==null&&rawText!==(rawFormat==='yaml'?yaml(config):JSON.stringify(config,null,2)),
    render(key){current=key;renderPage(key);},
    setCurrent(key){current=key;},
    edit:openEditor,global:openGlobal,cache:openCache,confirm:ask,
    save(next){saveConfig(clone(next));},
    replaceConfig(next){saveConfig(clone(next));rawText=null;},
    loadHistory(next,content,format,base,file){
      const current=file.format==='json'?JSON.parse(file.content):window.jsyaml.load(file.content);
      saveConfig(clone(next));serviceSource={base,version:file.version,config:current,content:file.content};storage.set('service-source',serviceSource);rawFormat=format==='json'?'json':'yaml';rawText=content;
    },
    backupService(source){if(!storage.set('service-backup',{...source,savedAt:Date.now()}))throw Error('浏览器无法保存变更前备份，请先释放空间或改用原生控制台');},
    serviceSource:()=>serviceSource?clone(serviceSource):null,
    adoptService(base,file,next,force=false){
      if(!force&&!canSeedFromService())return false;
      if(!force&&(dialog.open||current==='config'&&rawText!==null&&rawText!==(rawFormat==='yaml'?yaml(config):JSON.stringify(config,null,2))))return false;
      if(!file?.version||!Array.isArray(next?.plugins))throw Error('服务端配置缺少版本或插件列表');
      saveConfig(clone(next));serviceSource={base,version:file.version,config:clone(next),content:file.content};
      storage.set('service-source',serviceSource);rawText=null;return true;
    },
    guard(key,proceed){
      if(current==='config'&&rawText!==null&&rawText!==(rawFormat==='yaml'?yaml(config):JSON.stringify(config,null,2))){
        ask('放弃未保存的配置文本？','当前文本还没有保存为草稿。',()=>{rawText=null;proceed();},'放弃并继续');return false;
      }
      return true;
    }
  };
})();
