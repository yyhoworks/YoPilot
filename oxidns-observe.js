/* OxiDNS service adapter. Reads are used throughout the console; writes are explicit, confirmed, and version guarded. */
(() => {
  'use strict';
  const M = window.OxiObserveModel;
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const e = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prefsKey='oxidns-observe-v1';
  let prefs={}; try{prefs=JSON.parse(localStorage.getItem(prefsKey))||{};}catch{}
  // Native deployment uses its own origin; a separate preview can select an API manually.
  const defaultBase=['http:','https:'].includes(globalThis.location?.protocol)?globalThis.location.origin:'http://127.0.0.1:9199';
  const st={base:prefs.base||defaultBase,mode:prefs.mode==='demo'?'demo':'live',status:'idle',error:'',auth:'',core:null,graph:null,connectedAt:0,epoch:0,connection:0,paused:false,range:60,metric:'total',recorder:'',queries:[],next:null,cursors:[null],qpage:0,q:{qname:'',qtype:'',client_ip:'',rcode:'',status:'',matcher_tag:'',minutes:60},sort:'new',columns:{client:true,type:true,answers:true},logLevel:'',logSearch:'',graphTag:'',graphKind:'',overview:null};
  let ctx, timer, pending=false;
  const controllers=new Set();
  const savePrefs=()=>{try{localStorage.setItem(prefsKey,JSON.stringify({base:st.base,mode:st.mode}));}catch{ctx.toast('连接偏好未保存','浏览器存储不可用');}};
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d}):'—';
  const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'未提供';
  const clock=v=>new Date(v).toLocaleTimeString('zh-CN',{hour12:false});
  const short=v=>v?String(v).slice(0,12):'未提供';
  const chip=(text,tone='neutral')=>`<span class="badge ${tone==='neutral'?'':tone}">${e(text)}</span>`;
  const empty=(text,sub='')=>`<div class="ob-empty"><strong>${e(text)}</strong>${sub?`<p>${e(sub)}</p>`:''}</div>`;
  const errorBox=message=>`<div class="ob-error" role="alert"><strong>读取失败</strong><span>${e(message)}</span><button class="glass-btn small" data-ob-refresh>重试</button></div>`;
  const panel=(title,body,sub='',actions='')=>`<section class="card ob-panel"><div class="card-header"><div><h2>${title}</h2>${sub?`<p class="gc-sub">${sub}</p>`:''}</div>${actions}</div>${body}</section>`;
  const ppath=(tag,path)=>'/api/plugins/'+encodeURIComponent(tag)+'/'+path;
  const servicePlugins=()=>st.core?.config?.plugins||[];
  const recorderPlugins=()=>servicePlugins().filter(p=>p.type==='query_recorder');
  const observedRoutes=['overview','queries','logs','dependencies','tasks','connection'];
  const dataRoute=()=>observedRoutes.includes(ctx.route());
  const queryName=r=>(r.questions_json||[]).map(q=>q.name).join(', ')||'无问题记录';
  const queryType=r=>(r.questions_json||[]).map(q=>q.qtype).join(', ')||'—';
  const pluginButton=tag=>`<button class="ob-link" data-ob-plugin="${e(tag)}" title="${e(tag)}">${e(window.YoPilotPresentation?.name(tag)||tag)}</button>`;

  async function get(path,text=false) {
    M.readPath(path);
    const id=st.connection, base=M.baseURL(st.base), controller=new AbortController();
    controllers.add(controller);
    const timeout=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch(base+path,{method:'GET',cache:'no-store',credentials:'same-origin',headers:st.auth?{Authorization:st.auth}:{},signal:controller.signal});
      if(id!==st.connection)throw Error('连接已切换');
      st.networkError=false;
      if(!response.ok) {
        if(response.status===401)throw Error('服务要求身份验证，请在「服务连接」填写 API 账号');
        if(response.status===403)throw Error('服务拒绝访问，请检查 API 权限');
        throw Error(`HTTP ${response.status} · ${path.split('?')[0]}`);
      }
      if(text)return await response.text();
      const result=await response.json();
      if(result.ok===false)throw Error(result.message||'服务未完成请求');
      return result;
    } catch(err) {
      if((err.name==='AbortError'||err instanceof TypeError)&&id===st.connection){st.networkError=true;if(ctx)chrome();}
      if(err.name==='AbortError')throw Error('请求超时或连接已切换，请重试');
      if(err instanceof TypeError)throw Error('无法连接服务，请检查地址、网络与 API 的 CORS 设置');
      throw err;
    } finally {clearTimeout(timeout);controllers.delete(controller);}
  }
  let operationBusy=false;
  let pendingSaved=null;
  async function request(path,{method='GET',body=null,text=false,binary=false,rawBody=false,connection=st.connection}={}) {
    if(st.mode!=='live'||st.status!=='ready')throw Error('请先连接 OxiDNS 管理接口');
    if(connection!==st.connection)throw Error('连接已切换，请重新确认操作');
    const id=st.connection,base=M.baseURL(st.base),controller=new AbortController();
    controllers.add(controller);
    const timeout=setTimeout(()=>controller.abort(),20000);
    const headers={Accept:binary?'application/octet-stream':text?'text/plain':'application/json'};
    if(base===globalThis.location?.origin)Object.assign(headers,window.YoPilotAdmin?.headers()||{});
    if(st.auth)headers.Authorization=st.auth;
    if(body!==null){headers['Content-Type']=rawBody?'application/octet-stream':'application/json';}
    try {
      const response=await fetch(base+path,{method,cache:'no-store',credentials:'same-origin',headers,body:body===null?undefined:rawBody?body:JSON.stringify(body),signal:controller.signal});
      if(id!==st.connection)throw Error('连接已切换');
      if(binary&&response.ok){const blob=await response.blob();if(id!==st.connection)throw Error('连接已切换');return blob;}
      const raw=await response.text();
      let result=raw;
      if(!text&&raw){try{result=JSON.parse(raw);}catch{} }
      if(!response.ok){
        const detail=typeof result==='object'?(result.message||result.error||result.detail):String(result||'');
        if(response.status===401)throw Error('服务要求身份验证，请在「服务连接」填写 API 账号');
        if(response.status===403)throw Error('服务拒绝访问，请检查 API 权限');
        if(response.status===409)throw Error('版本或运行状态冲突：未覆盖新版本，请刷新状态并核对差异');
        throw Error(`HTTP ${response.status} · ${path.split('?')[0]}${detail?' · '+detail:''}`);
      }
      if(result&&typeof result==='object'&&result.ok===false&&path!=='/api/upgrade/status')throw Error(result.message||result.error||'服务未完成请求');
      if(!text&&(!result||typeof result!=='object'))throw Error('服务返回了非 JSON 响应，操作结果不能确认');
      if(id!==st.connection)throw Error('连接已切换，请回读原服务确认操作结果');
      return result;
    } catch(err) {
      if(err.name==='AbortError')throw Error('请求超时，结果未知；请先回读服务状态，不要重复提交');
      if(err instanceof TypeError)throw Error('无法连接服务，请检查地址、网络与 API 的 CORS 设置');
      throw err;
    } finally {clearTimeout(timeout);controllers.delete(controller);}
  }
  async function waitReload(version,connection,timeoutMs=30000) {
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      const status=await request('/api/reload/status',{connection});
      if(status.status==='failed')throw Error(status.last_error||'配置重载失败');
      if(status.running_version===version&&!status.pending&&!status.in_progress&&status.status==='ok')return status;
      await new Promise(resolve=>setTimeout(resolve,700));
    }
    throw Error('配置重载超时，请在服务连接页查看状态');
  }
  async function validateConfig(config) {
    const content=window.jsyaml.dump(config,{lineWidth:100,noRefs:true,sortKeys:false});
    return request('/api/config/validate',{method:'POST',body:{format:'yaml',content}});
  }
  async function applyConfig(config,{reload=true,allowGlobals=false,content:originalContent=null}={}) {
    if(operationBusy)throw Error('已有操作正在执行，请等待结果');
    operationBusy=true;
    let stage='preflight',saved;
    const connection=st.connection,base=st.base,source=window.OxiEngine.serviceSource?.();
    try {
      const file=await request('/api/config',{connection});
      if(allowGlobals&&reload)throw Error('全局配置只能先保存，再单独重启');
      const change=M.assertApplySource(source,base,file,config,{allowGlobals});
      const control=await request('/api/control',{connection});
      if(control.reload?.pending||control.reload?.in_progress)throw Error('服务正在应用配置，请等待完成');
      if(control.reload?.running_version!==file.version)throw Error('服务端文件尚未生效，请先在运行时管理核对并处理现有变更');
      if(M.same(source.config,config)&&(originalContent===null||originalContent===file.content))return {ok:true,unchanged:true};
      const content=originalContent??window.jsyaml.dump(config,{lineWidth:100,noRefs:true,sortKeys:false});
      if(!M.same(window.jsyaml.load(content),config))throw Error('配置原文与解析结果不一致');
      await request('/api/config/validate',{method:'POST',body:{format:'yaml',content},connection});
      // A recoverable copy precedes every write. Failure to persist it blocks the write.
      window.OxiEngine.backupService(source);
      window.OxiAdvanced?.remember(file,'before-save',true);
      stage='saving';
      saved=await request('/api/config',{method:'PUT',body:{format:'yaml',content,base_version:source.version,validate:true,reload:false},connection});
      stage='saved';
      if(!saved.version)throw Error('保存结果没有版本号，请回读文件后继续');
      const stored=await request('/api/config',{connection});
      if(stored.version!==saved.version)throw Error('保存后文件再次改变，未触发重载');
      window.OxiEngine.adoptService(base,stored,config,true);
      pendingSaved={base,version:saved.version,globals:change.globals.length>0};
      if(reload){stage='reloading';await request('/api/reload',{method:'POST',connection});await waitReload(saved.version,connection);pendingSaved=null;}
      window.OxiAdvanced?.remember(stored,reload?'applied':'saved');
      return saved;
    } catch(err) {
      const prefix=stage==='saving'?'保存结果未确认，请回读文件；':stage==='saved'||stage==='reloading'?'文件已保存，但运行结果未确认；':'未写入服务；';
      throw Error(prefix+err.message);
    } finally {
      operationBusy=false;
      if(stage!=='preflight'&&connection===st.connection)await connect();
    }
  }
  async function dynamicRules(tag,cursor=0) {
    if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('无效的分页位置');
    if(!window.OxiObserve.isReady())throw Error('请先连接 OxiDNS，再读取已学习规则');
    const plugin=servicePlugins().find(p=>p.tag===tag&&p.type==='dynamic_domain_set');
    if(!plugin)throw Error('此规则源未在已连接服务中运行；请先检查服务连接与配置');
    const scope={base:st.base,connection:st.connection,version:st.core.file.version,tag};
    const result=await get(ppath(tag,'rules')+'?limit=100&cursor='+cursor);
    if(scope.connection!==st.connection)throw Error('连接已切换，请重新读取');
    return {page:window.OxiDynamicModel.page(result,cursor),scope,path:plugin.args?.path||'未提供'};
  }
  async function runAction(action,tag='',extra={}) {
    if(operationBusy)throw Error('已有操作正在执行，请等待结果');
    operationBusy=true;
    const connection=st.connection;
    try {
      if(action.startsWith('dynamic-')||action.startsWith('cache-')||action==='query-clear'||action==='upgrade-apply'){
        const s=extra.scope;
        if(!s||s.base!==st.base||s.connection!==connection||s.version!==st.core?.file.version||s.tag!==tag)throw Error('运行规则页面的来源已变化，请刷新列表后重新确认');
      }
      if(action==='upgrade-check')return await request('/api/upgrade/check',{method:'POST',body:extra||{},connection});
      if(['restart','shutdown'].includes(action))return await request('/api/'+action,{method:'POST',connection});
      const control=await request('/api/control',{connection}),file=await request('/api/config',{connection});
      if(control.reload?.pending||control.reload?.in_progress)throw Error('配置正在应用，请稍后再执行');
      const knownPluginSave=action==='reload'&&pendingSaved?.base===st.base&&pendingSaved.version===file.version&&!pendingSaved.globals;
      if(file.version!==st.core.file.version||control.reload?.running_version!==file.version&&!knownPluginSave)throw Error('文件或运行版本已改变，请重新连接核对；全局配置需要确认重启，不能仅热重载');
      if(action==='reload'){
        await request('/api/reload',{method:'POST',connection});
        const result=await waitReload(file.version,connection);pendingSaved=null;return result;
      }
      if(action==='upgrade-apply'){
        if(extra.confirmTarget!==st.base||!extra.backedUp)throw Error('请确认目标地址与外部备份');
        return await request('/api/upgrade/apply',{method:'POST',body:window.OxiAdvancedModel.upgradeOptions(extra.options),connection});
      }
      const p=servicePlugins().find(p=>p.tag===tag),kind=window.OxiEngine.catalog.find(d=>d.kind===p?.type)?.type;
      if(!p)throw Error('该 tag 不是已载入的服务端插件，不能对草稿实例执行运行操作');
      if(action==='cache-delete'&&p.type==='cache'){
        if(!/^[A-Za-z0-9_-]+$/.test(extra.id||''))throw Error('缓存条目标识无效');
        const r=await request(ppath(tag,'entries/'+extra.id),{method:'DELETE',connection});if(r.deleted!==true)throw Error('未确认删除，请回读列表');return r;
      }
      if(action==='cache-load'&&p.type==='cache'){
        if(extra.confirmTag!==tag||!extra.data?.byteLength||extra.data.byteLength>64*1024*1024)throw Error('请输入缓存池标识，并选择不超过 64 MB 的 dump');
        return await request(ppath(tag,'load_dump'),{method:'POST',body:extra.data,rawBody:true,connection});
      }
      if(action==='query-clear'&&p.type==='query_recorder'&&extra.confirmTag===tag)return await request(ppath(tag,'records'),{method:'DELETE',connection});
      if(action.startsWith('dynamic-')&&p.type==='dynamic_domain_set'){
        const D=window.OxiDynamicModel;
        let result;
        if(action==='dynamic-add'||action==='dynamic-remove')result=await request(ppath(tag,'rules'),{method:action==='dynamic-add'?'POST':'DELETE',body:D.rules(extra.rules,extra.rule_kind),connection});
        else if(action==='dynamic-clear'&&extra.confirmTag===tag)result=await request(ppath(tag,'rules/clear'),{method:'POST',connection});
        else throw Error('清空需要输入完整规则源标识，或操作类型无效');
        return D.mutation(result);
      }
      if(action==='provider'&&kind==='provider')return await request(ppath(tag,'reload'),{method:'POST',connection});
      if(action==='flush'&&p.type==='cache')return await request(ppath(tag,'flush'),{connection});
      if(action==='download'&&p.type==='download')return await request(ppath(tag,'download'),{method:'POST',body:extra.index===undefined?{}:{index:extra.index},connection});
      if(action==='cron'&&p.type==='cron'&&extra.job)return await request(ppath(tag,'jobs/'+encodeURIComponent(extra.job)+'/run'),{method:'POST',connection});
      if(action==='matcher'&&kind==='matcher'&&['normal','always_true','always_false'].includes(extra.mode))return await request(ppath(tag,'mode'),{method:'POST',body:{mode:extra.mode},connection});
      throw Error('操作与运行插件类型不匹配，或需要在原生控制台完成');
    } finally {operationBusy=false;}
  }
  function subscribe(path,{event,onEvent,onState}) {
    if(!/^\/api\/(logs\/stream|plugins\/[^/]+\/stream)(\?|$)/.test(path))throw Error('不支持的实时流地址');
    const connection=st.connection,base=st.base,auth=st.auth;let stopped=false,manual=false,controller,reader,timer,watchdog,attempt=0;
    const active=()=>!stopped&&connection===st.connection&&st.status==='ready'&&st.mode==='live';
    const stop=()=>{manual=true;stopped=true;clearTimeout(timer);clearTimeout(watchdog);controller?.abort();reader?.cancel().catch(()=>{});};
    async function run(){
      if(!active())return;
      controller=new AbortController();controllers.add(controller);
      const alive=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>controller.abort(),45000);};
      try{
        onState(attempt?'正在重新连接 · 中断期间可能缺记录':'正在建立实时连接');alive();
        const response=await fetch(base+path,{headers:auth?{Authorization:auth}:{},cache:'no-store',credentials:'same-origin',signal:controller.signal});
        if(!response.ok){if([400,401,403,404].includes(response.status))stopped=true;throw Error('实时接口 HTTP '+response.status+'；检查连接、认证和插件能力');}
        if(!response.headers.get('content-type')?.includes('text/event-stream')||!response.body){stopped=true;throw Error('接口未返回 SSE 流');}
        onState('实时接收中 · 最多保留 300 条；可能丢帧，完整记录请回查历史');
        reader=response.body.getReader();const decoder=new TextDecoder(),parse=window.OxiAdvancedModel.sseParser(item=>{if(item.event==='error')throw Error(item.data.message||'事件错误');if(active()&&item.event===event)onEvent(item.data);});
        try{while(active()){const {done,value}=await reader.read();if(done)throw Error('实时连接已结束');alive();parse(decoder.decode(value,{stream:true}));}}finally{await reader.cancel().catch(()=>{});}
      }catch(err){if(active()){attempt++;const delay=Math.min(30000,1000*2**Math.min(attempt,5));onState('实时流中断：'+err.message+' · '+delay/1000+' 秒后重连；间隔数据请回查历史');timer=setTimeout(run,delay);}else if(stopped&&!manual)onState('已停止：'+err.message+'；修正后重新开始');}
      finally{clearTimeout(watchdog);controllers.delete(controller);}
    }
    run();return stop;
  }
  function abortReads(){window.OxiAdvanced?.stopStream();st.branch=null;st.connection++;controllers.forEach(c=>c.abort());controllers.clear();pending=false;}
  function chrome() {
    const live=st.mode==='live',connected=live&&st.status==='ready'&&!st.networkError;
    $('#sidebar-status strong').textContent=connected?'已连接 OxiDNS':live?(st.status==='loading'?'正在连接服务':st.networkError?'连接中断':'服务未连接'):'示例模式';
    $('#api-endpoint-label').textContent=live?st.base.replace(/^https?:\/\//,''):'配置仅保存本地';
    document.body.dataset.obConnected=String(connected);
    const top=$('#skin-status-label');if(top)top.textContent=connected?'实时数据 · 本地草稿独立':live?'等待服务连接':'示例数据 · 本地草稿';
    const brand=$('.brand-ver');if(brand)brand.textContent=connected?'v'+st.core.build.version:'原型';
  }
  function redraw(){chrome();if(dataRoute())ctx.refresh();}
  async function connect() {
    if(operationBusy){ctx.toast('操作执行中，请等待结果后再切换连接');return;}
    abortReads(); const id=st.connection;
    st.status='loading';st.error='';st.networkError=false;st.core=null;st.graph=null;st.overview=null;st.queries=[];st.next=null;st.cursors=[null];st.qpage=0;
    redraw();
    try {
      const [build,control,system,file]=await Promise.all([get('/api/build'),get('/api/control'),get('/api/system'),get('/api/config')]);
      const config=file.format==='json'?JSON.parse(file.content):window.jsyaml.load(file.content);
      if(!Array.isArray(config?.plugins))throw Error('服务配置未包含 plugins 数组');
      if(id!==st.connection)return;
      st.core={build:build.build,control,system,file,config};st.connectedAt=Date.now();st.status='ready';
      window.OxiAdvanced?.remember(file);
      window.OxiEngine.adoptService(st.base,file,config);
      if(!recorderPlugins().some(p=>p.tag===st.recorder))st.recorder=recorderPlugins()[0]?.tag||'';
    } catch(err){if(id!==st.connection)return;st.status='error';st.error=err.message;}
    redraw();
    if(!dataRoute()&&!window.OxiEngine.isDirty()&&!document.querySelector('dialog[open]'))ctx.refresh();
  }
  const refreshControls=()=>`<div class="oxi-actions"><span class="ob-updated" id="ob-updated">读取中…</span>${ctx.route()==='dependencies'?'':`<button class="glass-btn" data-ob-pause aria-pressed="${st.paused}">${st.paused?'恢复刷新':'暂停刷新'}</button>`}<button class="glass-btn" data-ob-refresh>刷新</button></div>`;
  const rangeSelect=(id='ob-range',val=st.range)=>`<label class="ob-select-label">时间范围<select id="${id}">${[[15,'近 15 分钟'],[60,'近 1 小时'],[360,'近 6 小时'],[1440,'近 24 小时']].map(([n,t])=>`<option value="${n}" ${Number(val)===n?'selected':''}>${t}</option>`).join('')}</select></label>`;
  function frame(route,title,sub,body,actions=refreshControls()) {
    $('#page-content').innerHTML=ctx.subnav(route)+`<div class="view-title-row"><div><h1>${title}</h1><span class="gc-sub">${sub}</span></div>${actions}</div>${body}`;
    bindCommon();
  }
  function readyOrEmpty(route) {
    if(st.status==='ready')return true;
    frame(route,window.OxiEngine.routeInfo[route][0],'服务观测',panel('服务连接',st.status==='loading'?empty('正在读取 OxiDNS…','正在读取版本、状态与配置；本地草稿保持独立。'):empty('尚未连接到 OxiDNS',st.error||'连接服务后查看实际运行数据。')),'<button class="glass-btn primary" data-route="connection">服务连接</button>');
    return false;
  }
  function render(route) {
    st.epoch++;
    chrome();
    if(window.YoPilotAdmin?.render(route))return true;
    if(route==='connection'){renderConnection();return true;}
    if(st.mode==='demo'&&!['dependencies','tasks'].includes(route))return false;
    if(!observedRoutes.includes(route))return false;
    if(st.mode==='demo') {
      frame(route,window.OxiEngine.routeInfo[route][0],'此视图使用真实服务数据',panel('连接服务',empty('当前为示例模式','切换到服务观测即可查看已配置的依赖与任务。')),'<button class="glass-btn primary" data-route="connection">服务连接</button>');return true;
    }
    if(!readyOrEmpty(route))return true;
    if(route==='overview')renderOverview();
    if(route==='queries')renderQueries();
    if(route==='logs')renderRuntimeLogs();
    if(route==='dependencies')renderDependencies();
    if(route==='tasks')renderTasks();
    window.OxiAdvanced?.enhance(route);
    return true;
  }
  function stamp(){const el=$('#ob-updated');const label=ctx.route()==='dependencies'?'更新于 · ':st.qpage>0&&ctx.route()==='queries'?'历史页 · ':st.paused?'已暂停 · ':'15 秒刷新 · ';if(el)el.textContent=label+clock(Date.now());const top=$('#status-time-label');if(top)top.textContent='更新于 '+clock(Date.now());chrome();}
  function bindCommon(root=$('#page-content')) {
    $$('[data-ob-refresh]',root).forEach(b=>b.onclick=()=>refresh());
    $$('[data-ob-pause]',root).forEach(b=>b.onclick=()=>{st.paused=!st.paused;b.textContent=st.paused?'恢复刷新':'暂停刷新';b.setAttribute('aria-pressed',String(st.paused));const el=$('#ob-updated');if(el)el.textContent=st.paused?'已暂停 · 保留当前结果':'15 秒自动刷新';if(!st.paused)refresh();});
    $$('[data-ob-plugin]',root).forEach(b=>b.onclick=()=>showPlugin(b.dataset.obPlugin));
    $$('[data-ob-query]',root).forEach(b=>b.onclick=()=>{st.branch=null;st.q={qname:b.dataset.obQuery,client_ip:'',minutes:st.range};st.qpage=0;st.cursors=[null];ctx.navigate('queries');});
    $$('[data-ob-client]',root).forEach(b=>b.onclick=()=>{st.branch=null;st.q={client_ip:b.dataset.obClient,qname:'',minutes:st.range};st.qpage=0;st.cursors=[null];ctx.navigate('queries');});
    $$('[data-ob-record]',root).forEach(b=>b.onclick=()=>showRecord(b.dataset.obRecord));
    $$('[data-ob-cache]',root).forEach(b=>b.onclick=()=>showCache(b.dataset.obCache));
  }
  async function refresh() {
    if(st.status!=='ready')return connect();
    const route=ctx.route();
    if(route==='overview')return loadOverview();
    if(route==='queries')return loadQueries();
    if(route==='logs')return loadRuntimeLogs();
    if(route==='tasks')return loadTasks();
    if(route==='dependencies'){st.graph=null;return loadDependencies();}
    if(route==='connection')return connect();
  }
  function renderOverview() {
    $('#page-content').innerHTML=`<div id="ob-overview" class="ob-grid">${panel('运行概览',empty('读取运行指标…'))}</div>`;
    loadOverview();
  }
  function serviceSummary() {
    return window.YoPilotOverview.service({core:st.core,base:st.base,controls:rangeSelect()+refreshControls()+'<button class="glass-btn" data-route="history">查询统计</button>'});
  }
  let overviewRequest=0;
  async function loadOverview() {
    const epoch=st.epoch,request=++overviewRequest,now=Date.now(),minutes=st.range;
    const params=new URLSearchParams({since_ms:String(now-minutes*60000),until_ms:String(now)});
    const tasks={system:()=>get('/api/system'),control:()=>get('/api/control'),metrics:()=>get('/api/metrics',true)};
    if(st.recorder) for(const key of ['latency','timeseries','top_qnames','top_clients','rcode'])tasks[key]=()=>get(ppath(st.recorder,'stats/'+key)+'?'+params+(key==='timeseries'?`&bucket=${minutes>360?'hour':'minute'}&buckets=${minutes>360?24:minutes}`:key.startsWith('top_')?'&limit=10000':key==='latency'?'&slow_limit=6':''));
    if(st.recorder)tasks.plugin_stats=()=>get(ppath(st.recorder,'stats/plugins')+'?'+params+'&kind=executor');
    const keys=Object.keys(tasks),results=await Promise.allSettled(keys.map(k=>tasks[k]()));
    if(epoch!==st.epoch||request!==overviewRequest)return;
    const data={},errors=[];
    results.forEach((r,i)=>{if(r.status==='fulfilled')data[keys[i]]=r.value;else errors.push(`${keys[i]}：${r.reason.message}`);});
    if(data.system)st.core.system=data.system;if(data.control)st.core.control=data.control;
    st.overview=data;
    const metrics=M.metrics(data.metrics||''),pools=servicePlugins().filter(p=>p.type==='cache').map(p=>({p,...M.cacheStats(metrics,p.tag)}));
    const hits=pools.reduce((a,p)=>a+p.hits,0),lookups=pools.reduce((a,p)=>a+p.lookups,0);
    const lat=data.latency,latency=M.latencySummary(lat),rcodes=data.rcode,fail=rcodes?.rows.filter(x=>M.rcode(x.key)==='SERVFAIL').reduce((a,x)=>a+x.count,0);
    const summary=data.control&&data.system?serviceSummary():`<section class="card ob-service yp-overview-summary"><div class="yp-overview-top"><div><h1>运行概览</h1><p>本次未能读取完整运行状态，请刷新重试。</p></div><div class="yp-overview-controls">${rangeSelect()}${refreshControls()}</div></div></section>`;
    const overviewView=window.YoPilotOverview.prepare({config:st.core.config,catalog:window.OxiEngine.catalog,metrics,pools,system:data.system,base:st.base,connection:st.connection,version:st.core.file.version,latency:lat,clients:data.top_clients,domains:data.top_qnames,pluginStats:data.plugin_stats,rcode:rcodes,range:minutes});
    const kpiHTML=window.YoPilotOverview.statistics(overviewView);
    const cacheHTML=`<div class="table-wrap"><table><thead><tr><th>缓存池</th><th>命中率</th><th>命中 / 查找</th><th>配置容量</th><th></th></tr></thead><tbody>${pools.map(x=>`<tr><td>${pluginButton(x.p.tag)}</td><td><div class="ob-meter"><span style="width:${x.rate===null?0:Math.min(100,x.rate*100)}%"></span></div>${x.rate===null?'—':num(x.rate*100,1)+'%'}</td><td class="mono">${x.available?num(x.hits)+' / '+num(x.lookups):'指标不可用'}</td><td class="mono">${x.p.args?.size!==undefined?num(x.p.args.size):'插件默认'}</td><td><button class="glass-btn small" data-ob-cache="${e(x.p.tag)}">查看条目</button></td></tr>`).join('')}</tbody></table></div>`;
    $('#ob-overview').innerHTML=summary+(errors.length?`<div class="ob-notice">部分数据未更新：${e(errors.join('；'))}</div>`:'')+(!st.recorder?`<div class="ob-notice">服务未配置 query_recorder，查询趋势与排行暂不可用。</div>`:'')+kpiHTML+window.YoPilotOverview.quality(overviewView)+panel('请求与耗时趋势','<div id="ob-trend"></div>',`记录器 ${e(st.recorder||'未配置')} · 所选时间范围`, `<div class="pill-group">${[['total','请求数'],['avg_ms','平均耗时'],['p95_ms','P95 耗时']].map(([k,t])=>`<button class="pill ${st.metric===k?'active':''}" data-ob-metric="${k}">${t}</button>`).join('')}</div>`)+`<div class="ob-two">${ranking('域名请求排行',data.top_qnames,'query')}${ranking('客户端请求排行',data.top_clients,'client')}</div>`+`<div class="ob-two">${panel('最慢查询',lat?`<div class="table-wrap"><table><thead><tr><th>域名</th><th>平均</th><th>最长</th></tr></thead><tbody>${lat.slow_top.map(r=>`<tr><td><button class="ob-link mono" data-ob-query="${e(r.qname)}">${e(r.qname)}</button></td><td class="mono">${num(r.avg_ms,1)} ms</td><td class="mono">${num(r.max_ms)} ms</td></tr>`).join('')||'<tr><td colspan="3">此时间范围没有查询记录</td></tr>'}</tbody></table></div>`:empty('耗时统计不可用'),'按域名平均耗时排序 · 点击查看对应查询')}${panel('多级缓存池',pools.length?cacheHTML:empty('未配置缓存插件'),'各池独立计数 · 清空操作需要确认')}</div>`+panel('DNS 解析关系',`<div class="ob-shortcuts"><p>从监听入口追踪策略、匹配条件和上游。单次实际执行顺序在查询详情中查看。</p><button class="glass-btn" data-route="dependencies">查看插件依赖</button><button class="glass-btn" data-route="queries">打开查询日志</button><button class="glass-btn" data-route="tasks">查看定时任务</button></div>`);
    if(window.OxiPath){
      const path=document.createElement('section');
      $('#ob-overview .ypo-statistics').after(path);
      try {
        window.OxiPath.mount(path,{
          config:st.core.config,clients:(data.top_clients?.rows||[]).slice(0,6),pools,metrics,live:true,
          aligned:st.core.file.version===st.core.control.reload?.running_version,
          onPlugin:showPlugin,
          onPurpose:group=>{st.q=window.YoPilotWorkflowModel.queryFilters({minutes:st.range});st.branch={name:group.name,tags:[...new Set([...(group.rules||[]),...(group.strategies||[])].map(p=>p.tag))]};st.evidence=true;st.qpage=0;st.cursors=[null];ctx.navigate('queries');},
          onClient:ip=>{st.branch=null;st.q={client_ip:ip,qname:'',minutes:st.range};st.qpage=0;st.cursors=[null];ctx.navigate('queries');},
          onCache:showCache
        });
      } catch (err) {
        // Keep a visible, actionable surface if a malformed service payload prevents the map from mounting.
        path.className='card op-path op-path-error';
        path.innerHTML=`<div class="op-head"><div><h2>DNS 解析路径</h2><p>当前配置无法生成结构图</p></div><button class="glass-btn small" data-route="connection">检查服务配置</button></div><p class="op-foot">路径视图读取配置失败：${e(err?.message||'未知错误')}。查询日志与 DNS 管理仍可正常使用。</p>`;
      }
    }
    $$('[data-ob-metric]').forEach(b=>b.onclick=()=>{st.metric=b.dataset.obMetric;$$('[data-ob-metric]').forEach(x=>x.classList.toggle('active',x===b));drawTrend();});
    $('#ob-range').onchange=ev=>{st.range=Number(ev.target.value);loadOverview();};
    window.YoPilotOverview.bind($('#ob-overview'),overviewView,{
      openDrawer:(...args)=>ctx.openDrawer(...args),plugin:showPlugin,
      client:ip=>{st.branch=null;st.q={client_ip:ip,qname:'',minutes};st.qpage=0;st.cursors=[null];ctx.closeDrawer();ctx.navigate('queries');},
      domain:qname=>{st.branch=null;st.q={qname,client_ip:'',minutes};st.qpage=0;st.cursors=[null];ctx.closeDrawer();ctx.navigate('queries');}
    });
    drawTrend();bindCommon();stamp();
  }
  function ranking(title,data,kind) {
    return panel(title,data?`<div class="ob-ranks">${data.rows.slice(0,6).map((r,i)=>`<button class="ob-rank" data-ob-${kind}="${e(r.key)}"><span class="ob-rank-index">${i+1}</span><span class="mono ob-rank-name">${e(r.key)}<span class="ob-meter"><span style="width:${Math.min(100,r.share*100)}%"></span></span></span><span class="mono">${num(r.count)}<small>${num(r.share*100,1)}%</small></span></button>`).join('')||empty('所选时间内暂无记录')}</div>`:empty('排行暂不可用'),'点击条目筛选对应查询');
  }
  function drawTrend() {
    const el=$('#ob-trend');if(!el)return;
    const series=st.overview?.timeseries,points=series?.points||[],key=st.metric;
    if(!points.length){el.innerHTML=empty('所选时间内暂无趋势数据');return;}
    const max=Math.max(1,...points.map(p=>p[key]||0)),w=900,h=164;
    const path=points.map((p,i)=>`${i?'L':'M'} ${32+i*(w-48)/Math.max(1,points.length-1)} ${h-12-(p[key]||0)/max*(h-35)}`).join(' ');
    el.innerHTML=`<div class="ob-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${key==='total'?'请求数量':'耗时'}趋势，从 ${e(clock(points[0].bucket_ms))} 到 ${e(clock(points.at(-1).bucket_ms))}"><path d="M32 23H884 M32 87H884 M32 152H884" class="ob-gridline"/><text x="2" y="28">${num(max,1)}</text><text x="9" y="152">0</text><path d="${path}" class="ob-chart-line"/>${points.length===1?`<circle cx="32" cy="${h-12-(points[0][key]||0)/max*(h-35)}" r="4" fill="var(--accent)"/>`:''}</svg><div class="ob-axis"><span>${clock(points[0].bucket_ms)}</span><span>每 ${series.bucket_ms/60000} 分钟 · ${key==='total'?'请求数':'毫秒'}</span><span>${clock(points.at(-1).bucket_ms)}</span></div></div><details class="ob-data-details"><summary>查看趋势数据</summary><div class="table-wrap ob-limited"><table><thead><tr><th>时间</th><th>请求</th><th>平均 ms</th><th>P95 ms</th><th>执行异常</th><th>无响应</th></tr></thead><tbody>${points.map(p=>`<tr><td>${clock(p.bucket_ms)}</td><td>${num(p.total)}</td><td>${num(p.avg_ms,1)}</td><td>${num(p.p95_ms)}</td><td>${num(p.error_count)}</td><td>${num(p.no_response_count)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function renderQueries() {
    const f=st.q;
    frame('queries','查询日志','查询来自服务端记录器 · 详情包含响应记录与实际执行顺序',panel('筛选查询',`<form id="ob-query-form" class="ob-filter"><label class="ob-search-label">域名包含<input name="qname" type="search" value="${e(f.qname)}" placeholder="搜索域名…"></label><label>记录器<select name="recorder">${recorderPlugins().map(p=>`<option ${st.recorder===p.tag?'selected':''}>${e(p.tag)}</option>`).join('')}</select></label><label>类型<select name="qtype"><option value="">全部类型</option>${['A','AAAA','HTTPS','SVCB','CNAME','PTR','TXT','MX','NS','SOA','SRV'].map(v=>`<option ${f.qtype===v?'selected':''}>${v}</option>`).join('')}</select></label>${rangeSelect('ob-query-range',f.minutes)}<button class="glass-btn primary" type="submit">查询</button><button class="glass-btn" type="button" id="ob-query-reset">重置</button><details class="ob-filter-more"><summary>更多筛选${[f.client_ip,f.rcode,f.status,f.matcher_tag].filter(Boolean).length?' · 已启用':''}</summary><div class="ob-filter"><label>客户端 IP<input name="client_ip" value="${e(f.client_ip)}" placeholder="精确 IP"></label><label>响应码<select name="rcode"><option value="">全部响应码</option>${[['No Error','NOERROR'],['Non-Existent Domain','NXDOMAIN'],['Server Failure','SERVFAIL'],['Query Refused','REFUSED'],['Format Error','FORMERR']].map(([v,t])=>`<option value="${v}" ${f.rcode===v?'selected':''}>${t}</option>`).join('')}</select></label><label>执行状态<select name="status">${[['','全部'],['error','执行异常'],['no_response','无响应'],['has_response','有响应']].map(([v,t])=>`<option value="${v}" ${f.status===v?'selected':''}>${t}</option>`).join('')}</select></label><label>匹配器 tag<input name="matcher_tag" value="${e(f.matcher_tag)}" placeholder="原始 tag"></label></div></details></form>`)+panel('DNS 请求记录',`<div class="ob-table-toolbar"><span id="ob-query-count" aria-live="polite">正在读取…</span><label>排序<select id="ob-sort"><option value="new">当前页 · 最新优先</option><option value="slow">当前页 · 耗时最高</option></select></label><details class="ob-columns"><summary>显示列</summary><div>${[['client','客户端'],['type','类型'],['answers','响应摘要']].map(([k,v])=>`<label><input type="checkbox" data-ob-column="${k}" ${st.columns[k]?'checked':''}> ${v}</label>`).join('')}</div></details><button class="glass-btn small" id="ob-query-export" disabled>导出当前页</button></div><div id="ob-query-results"></div>`));
    $('#ob-query-form').onsubmit=ev=>{ev.preventDefault();const form=new FormData(ev.currentTarget);for(const k of ['qname','qtype','client_ip','rcode','status','matcher_tag'])st.q[k]=String(form.get(k)||'').trim();st.q.minutes=Number($('#ob-query-range').value);st.recorder=String(form.get('recorder')||'');st.qpage=0;st.cursors=[null];loadQueries();};
    $('#ob-query-reset').onclick=()=>{st.q={qname:'',qtype:'',client_ip:'',rcode:'',status:'',matcher_tag:'',minutes:60};st.branch=null;st.qpage=0;st.cursors=[null];render('queries');};
    $('#ob-sort').value=st.sort;$('#ob-sort').onchange=ev=>{st.sort=ev.target.value;drawQueries();};
    $$('[data-ob-column]').forEach(b=>b.onchange=()=>{st.columns[b.dataset.obColumn]=b.checked;drawQueries();});
    $('#ob-query-export').onclick=()=>ctx.download('oxidns-queries-page.json',JSON.stringify(st.queries,null,2),'application/json');
    loadQueries();
  }
  let queryRequest=0;
  const queryToolsContext=()=>({render:()=>render('queries'),draw:drawQueries,confirm:window.OxiEngine.confirm,download:ctx.download,config:()=>st.core?.config,scope:()=>window.OxiObserve.scope(''),aligned:()=>st.core?.file.version===st.core?.control.reload?.running_version,detail:id=>get(ppath(st.recorder,'records/'+encodeURIComponent(id)))});
  async function loadQueries() {
    const epoch=st.epoch,request=++queryRequest;
    window.YoPilotQueryTools?.controls(st,queryToolsContext());
    if(!st.recorder){$('#ob-query-results').innerHTML=empty('未配置查询记录器','请在插件中心配置 query_recorder；本页不会生成示例记录。');$('#ob-query-count').textContent='采集不可用';return;}
    const b=$('#ob-query-form button[type=submit]');if(b)b.disabled=true;
    try {
      const records=await get(ppath(st.recorder,'records')+'?'+M.queryParams({...st.q,cursor:st.cursors[st.qpage]}));
      if(epoch!==st.epoch||request!==queryRequest)return;
      st.queries=records.records;st.next=records.next_cursor;drawQueries();stamp();
    }catch(err){if(epoch!==st.epoch||request!==queryRequest)return;$('#ob-query-results').innerHTML=errorBox(err.message);$('#ob-query-count').textContent='读取失败';$('#ob-query-export').disabled=true;bindCommon();}
    finally{if(epoch===st.epoch&&request===queryRequest&&b)b.disabled=false;}
  }
  function drawQueries() {
    const root=$('#ob-query-results');if(!root)return;
    const rows=[...st.queries];if(st.sort==='slow')rows.sort((a,b)=>b.elapsed_ms-a.elapsed_ms);
    $('#ob-query-count').textContent=`第 ${st.qpage+1} 页 · 本页 ${rows.length} 条${st.qpage?' · 翻页时保持当前结果':''}`;
    $('#ob-query-export').disabled=!rows.length;
    $('#ob-query-export').textContent='导出当前页';
    $('#ob-query-export').onclick=()=>ctx.download('oxidns-queries-page.json',JSON.stringify(st.queries,null,2),'application/json');
    root.innerHTML=(rows.length?`<div class="table-wrap"><table class="ob-query-table"><thead><tr><th>时间</th><th>域名${st.columns.answers?' / 响应':''}</th>${st.columns.type?'<th>类型</th>':''}${st.columns.client?'<th>客户端</th>':''}<th>耗时</th><th>结果</th><th>操作</th></tr></thead><tbody>${rows.map(r=>{const status=M.recordStatus(r);return `<tr><td class="mono">${clock(r.created_at_ms)}</td><td><button class="ob-link mono" data-ob-record="${r.id}">${e(queryName(r))}</button>${st.columns.answers?`<small class="ob-answer mono">${e((r.answers_json||[]).map(x=>x.payload_text).join(' · ')||status.text)}</small>`:''}</td>${st.columns.type?`<td class="mono">${e(queryType(r))}</td>`:''}${st.columns.client?`<td><button class="ob-link mono" data-ob-client="${e(r.client_ip)}">${e(r.client_ip)}</button></td>`:''}<td class="mono">${num(r.elapsed_ms)} ms</td><td>${chip(status.text,status.tone)}</td><td><button class="glass-btn small" data-ob-record="${r.id}" aria-label="查看 ${e(queryName(r))} 的查询详情">详情</button></td></tr>`;}).join('')}</tbody></table></div>`:empty('没有匹配的查询','调整时间范围或筛选条件后重试。'))+`<div class="ob-pagination"><button class="glass-btn small" id="ob-prev" ${st.qpage===0?'disabled':''}>上一页</button><span>第 ${st.qpage+1} 页 · 每页最多 50 条</span><button class="glass-btn small" id="ob-next" ${st.next?'':'disabled'}>下一页</button></div>`;
    $('#ob-prev').onclick=()=>{st.qpage--;loadQueries();};$('#ob-next').onclick=()=>{st.cursors[++st.qpage]=st.next;loadQueries();};bindCommon(root);
    window.YoPilotQueryTools?.evidence(root,st,queryToolsContext());
  }
  async function showRecord(id) {
    const recorder=st.recorder,connection=st.connection;
    ctx.openDrawer('查询详情',`记录 ${id} · ${recorder}`,empty('正在读取响应与执行顺序…'));
    const marker=String(id);$('#drawer').dataset.obRecord=marker;
    try {
      const {record:r}=await get(ppath(recorder,'records/'+encodeURIComponent(id)));
      if(connection!==st.connection||!$('#drawer').classList.contains('open')||$('#drawer').dataset.obRecord!==marker)return;
      const status=M.recordStatus(r);
      const records=(title,rows)=>`<h3 class="drawer-section-title">${title} · ${rows?.length||0}</h3>${rows?.length?`<div class="table-wrap"><table><thead><tr><th>名称 / 类型</th><th>TTL</th><th>响应值</th></tr></thead><tbody>${rows.map(x=>`<tr><td class="mono">${e(x.name)}<small class="ob-answer">${e(x.rr_type)} · ${e(x.class)}</small></td><td class="mono">${num(x.ttl)} s</td><td class="mono ob-break">${e(x.payload_text)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="gc-sub">无此类记录</p>'}`;
      const known=new Set(servicePlugins().map(p=>p.tag));
      $('#drawer-content').innerHTML=`<div class="ob-detail-title"><h2 class="mono">${e(queryName(r))}</h2>${chip(status.text,status.tone)}</div><dl class="ob-detail-grid"><div><dt>查询时间</dt><dd>${date(r.created_at_ms)}</dd></div><div><dt>总耗时</dt><dd>${num(r.elapsed_ms)} ms</dd></div><div><dt>客户端</dt><dd>${e(r.client_ip)}</dd></div><div><dt>查询类型</dt><dd>${e(queryType(r))}</dd></div><div><dt>响应标志</dt><dd>${['aa','tc','ra','ad','cd'].filter(k=>r['resp_'+k]).map(k=>k.toUpperCase()).join(' / ')||'无'}</dd></div><div><dt>问题数量</dt><dd>${r.questions_json?.length||0}</dd></div></dl>${r.error?`<div class="ob-error">${e(r.error)}</div>`:''}${records('Answer',r.answers_json)}${records('Authority',r.authorities_json)}${records('Additional',r.additionals_json)}<h3 class="drawer-section-title">实际执行顺序</h3><p class="gc-sub">记录器返回执行事件，不提供单个步骤耗时。序号按实际事件顺序排列。</p><ol class="ob-steps">${(r.steps||[]).map(s=>`<li><div>${known.has(s.tag)?pluginButton(s.tag):`<span class="mono ob-break">${e(s.tag||s.kind)}</span>`}${chip(({matched:'匹配',not_matched:'未匹配',executed:'已执行'})[s.outcome]||s.outcome)}</div><small>${e(s.kind)} · ${e(s.sequence_tag)} · 节点 ${s.node_index}</small></li>`).join('')||'<li>此记录未采集执行事件</li>'}</ol><details class="ob-data-details"><summary>完整记录 JSON</summary><pre>${e(JSON.stringify(r,null,2))}</pre></details>`;
      bindCommon($('#drawer-content'));
    }catch(err){if($('#drawer').classList.contains('open')&&$('#drawer').dataset.obRecord===marker)$('#drawer-content').innerHTML=empty('详情读取失败',err.message);}
  }
  function renderRuntimeLogs() {
    frame('logs','运行日志','服务端最近日志 · 与 DNS 查询记录分开查看',panel('服务日志',`<div class="ob-filter"><label>最低级别<select id="ob-log-level">${[['','全部级别'],['info','INFO 及以上'],['warn','WARN 及以上'],['error','ERROR']].map(([v,t])=>`<option value="${v}" ${st.logLevel===v?'selected':''}>${t}</option>`).join('')}</select></label><label class="ob-search-label">搜索当前结果<input id="ob-log-search" type="search" value="${e(st.logSearch)}" placeholder="模块、消息内容…"></label><button class="glass-btn" id="ob-log-export" disabled>导出当前结果</button></div><div id="ob-runtime-log"></div>`));
    $('#ob-log-level').onchange=ev=>{st.logLevel=ev.target.value;loadRuntimeLogs();};
    $('#ob-log-search').oninput=ev=>{st.logSearch=ev.target.value;drawRuntimeLogs();};
    $('#ob-log-export').onclick=()=>ctx.download('oxidns-runtime-logs.json',JSON.stringify(logRows(),null,2),'application/json');loadRuntimeLogs();
  }
  let runtimeEntries=[];
  const logRows=()=>runtimeEntries.filter(r=>(r.target+' '+r.message).toLowerCase().includes(st.logSearch.toLowerCase()));
  let logRequest=0;
  async function loadRuntimeLogs() {
    const epoch=st.epoch,request=++logRequest;
    try{const result=await get('/api/logs?limit=200'+(st.logLevel?'&level='+st.logLevel:''));if(epoch!==st.epoch||request!==logRequest)return;runtimeEntries=result.entries;drawRuntimeLogs();stamp();}
    catch(err){if(epoch===st.epoch&&request===logRequest){$('#ob-runtime-log').innerHTML=errorBox(err.message);$('#ob-log-export').disabled=true;bindCommon();}}
  }
  function drawRuntimeLogs() {
    const rows=logRows();$('#ob-log-export').disabled=!rows.length;
    $('#ob-runtime-log').innerHTML=`<p class="ob-log-count">${rows.length} 条匹配 · 本次读取 ${runtimeEntries.length} 条 · 最多 200 条，最新优先</p>`+(rows.length?`<div class="ob-log-lines">${[...rows].reverse().map(r=>`<article class="ob-log-line"><time>${e(r.timestamp)}</time>${chip(r.level,r.level==='ERROR'?'danger':r.level==='WARN'?'warn':'neutral')}<span class="mono ob-log-target">${e(r.target)}</span><p>${e(r.message)}</p></article>`).join('')}</div>`:empty('没有匹配日志','调整级别或搜索词后重试。'));
  }
  function renderDependencies() {
    frame('dependencies','插件依赖','服务端配置校验返回的静态引用 · 单次实际路径请查看查询详情',panel('查找插件',`<div class="ob-filter"><label class="ob-search-label">名称或类型<input id="ob-dep-search" type="search" placeholder="搜索 tag 或插件类型…" value="${e(st.graphFilter)}"></label><label>分类<select id="ob-dep-kind">${[['','全部分类'],['server','监听'],['executor','执行器'],['matcher','匹配器'],['provider','数据源']].map(([v,t])=>`<option value="${v}" ${st.graphKind===v?'selected':''}>${t}</option>`).join('')}</select></label></div><div id="ob-dependencies"></div>`));
    $('#ob-dep-search').oninput=ev=>{st.graphFilter=ev.target.value;drawDependencies();};$('#ob-dep-kind').onchange=ev=>{st.graphKind=ev.target.value;drawDependencies();};loadDependencies();
  }
  async function loadDependencies() {
    const epoch=st.epoch;
    try{const graph=st.graph||(await get('/api/config/check')).dependency_graph;if(epoch!==st.epoch)return;st.graph=graph;drawDependencies();stamp();}
    catch(err){if(epoch===st.epoch){$('#ob-dependencies').innerHTML=errorBox(err.message);bindCommon();}}
  }
  function drawDependencies() {
    const root=$('#ob-dependencies');if(!root||!st.graph)return;
    const {nodes,edges}=st.graph,filter=st.graphFilter.toLowerCase();
    const visible=nodes.filter(n=>(n.tag+' '+n.plugin_type).toLowerCase().includes(filter)&&(!st.graphKind||n.kind===st.graphKind));
    if(!st.graphTag)st.graphTag=nodes.find(n=>n.kind==='server')?.tag||nodes[0]?.tag;
    const selected=nodes.find(n=>n.tag===st.graphTag),out=edges.filter(x=>x.source_tag===st.graphTag),incoming=edges.filter(x=>x.target_tag===st.graphTag);
    const related=(list,inbound)=>list.map(x=>`<button class="ob-dep-edge" data-ob-dep="${e(inbound?x.source_tag:x.target_tag)}"><strong class="mono">${e(inbound?x.source_tag:x.target_tag)}</strong><small>${e(x.field)}</small></button>`).join('')||`<p class="gc-sub">${inbound?'没有入向引用':'没有插件依赖'}</p>`;
    root.innerHTML=`<div class="ob-dep-summary">${nodes.length} 个插件 · ${edges.length} 条引用 · 匹配 ${visible.length} 个</div><div class="ob-dep-layout"><div class="ob-dep-list" aria-label="插件列表">${visible.map(n=>`<button data-ob-dep="${e(n.tag)}" class="ob-dep-choice ${n.tag===st.graphTag?'active':''}" aria-pressed="${n.tag===st.graphTag}"><strong class="mono">${e(n.tag)}</strong><small>${e(window.OxiEngine.label(n.plugin_type))} · ${e(n.kind)}</small></button>`).join('')||empty('没有匹配插件')}</div><div class="ob-dep-main">${selected?`<div class="ob-dep-heading"><div><h2 class="mono">${e(selected.tag)}</h2><p class="gc-sub">${e(selected.plugin_type)} · ${e(selected.kind)}</p></div><button class="glass-btn small" data-ob-plugin="${e(selected.tag)}">查看完整参数</button></div><div class="ob-dep-flow"><section><h3>被谁引用 · ${incoming.length}</h3>${related(incoming,true)}</section><section><h3>依赖哪些插件 · ${out.length}</h3>${related(out,false)}</section></div><p class="gc-sub">点击关联插件继续追踪。这里显示配置关系，不代表某次查询经过了全部分支。</p>`:empty('没有可显示的插件')}</div></div>`;
    const list=$('.ob-dep-list',root),active=$('.ob-dep-choice.active',root);
    if(active){if(innerWidth<=900)list.scrollLeft=active.offsetLeft-list.offsetLeft-12;else list.scrollTop=active.offsetTop-list.offsetTop-12;}
    $$('[data-ob-dep]',root).forEach(b=>b.onclick=()=>{st.graphTag=b.dataset.obDep;drawDependencies();const title=$('.ob-dep-heading h2',root);if(title){title.tabIndex=-1;title.focus({preventScroll:true});}});bindCommon(root);
  }
  function showPlugin(tag) {
    const p=servicePlugins().find(p=>p.tag===tag);if(!p)return;
    $('#drawer').dataset.obRecord='';
    ctx.openDrawer(window.YoPilotPresentation?.name(p)||tag,`${tag} · ${window.OxiEngine.label(p.type)} · 服务端配置`, `<dl class="ob-detail-grid"><div><dt>原始标识</dt><dd class="mono">${e(tag)}</dd></div><div><dt>插件类型</dt><dd class="mono">${e(p.type)}</dd></div><div><dt>配置来源</dt><dd>服务端文件 · 只读</dd></div></dl><div class="oxi-actions"><button class="glass-btn" id="ob-open-dependencies">查看引用关系</button></div><h3 class="drawer-section-title">完整参数</h3><pre>${e(JSON.stringify(p.args??{},null,2))}</pre><p class="gc-sub">参数来自服务端配置文件。本地草稿独立保存，未自动导入这份配置。</p>`);
    $('#ob-open-dependencies').onclick=()=>{st.graphTag=tag;st.graphFilter='';st.graphKind='';ctx.closeDrawer();ctx.navigate('dependencies');};
    if(window.OxiEngine.catalog.find(d=>d.kind===p.type)?.type==='provider')$('#drawer-content').insertAdjacentHTML('beforeend',`<button class="glass-btn" data-task="provider" data-target="${e(tag)}">重载服务端规则数据</button>`);
  }
  async function showCache(tag) {
    if(window.OxiAdvanced)return window.OxiAdvanced.cache(tag);
    $('#drawer').dataset.obRecord='';
    ctx.openDrawer(tag,'实时缓存条目 · 可读 / 可清空',`<form id="ob-cache-form" class="ob-filter"><label class="ob-search-label">域名包含<input id="ob-cache-q" type="search" placeholder="搜索缓存域名…"></label><button class="glass-btn" type="submit">查询</button><button class="glass-btn" type="button" id="ob-cache-flush">清空此池</button></form><div id="ob-cache-results"></div>`);
    let cursor=null,request=0;
    const read=async append=>{
      const id=++request,target=$('#ob-cache-results');if(!target)return;
      target.setAttribute('aria-busy','true');
      try{const p=new URLSearchParams({limit:'50',qname:$('#ob-cache-q').value});if(append&&cursor)p.set('cursor',cursor);const result=await get(ppath(tag,'entries')+'?'+p);if(id!==request||target!==$('#ob-cache-results'))return;cursor=result.next_cursor;target.innerHTML=`<p class="gc-sub">池内共 ${num(result.total_entries)} 条 · 本页 ${result.entries.length} 条</p><div class="table-wrap"><table><thead><tr><th>域名</th><th>类型</th><th>状态</th><th>响应数</th></tr></thead><tbody>${result.entries.map(r=>`<tr><td class="mono ob-break">${e(r.domain)}</td><td>${e(r.record_type)}</td><td>${e(M.rcode(r.rcode))}</td><td>${r.answer_count}</td></tr>`).join('')||'<tr><td colspan="4">没有匹配缓存条目</td></tr>'}</tbody></table></div><button class="glass-btn" id="ob-cache-next" ${cursor?'':'disabled'}>下一页</button>`;$('#ob-cache-next').onclick=()=>read(true);}
      catch(err){if(target===$('#ob-cache-results'))target.innerHTML=empty('缓存读取失败',err.message);}finally{target.removeAttribute('aria-busy');}
    };
    $('#ob-cache-form').onsubmit=ev=>{ev.preventDefault();cursor=null;read(false);};
    $('#ob-cache-flush').onclick=()=>{if(!window.confirm('清空缓存池 '+tag+'？缓存条目会立即删除，无法恢复。'))return;runAction('flush',tag).then(()=>{ctx.toast('缓存已清空');cursor=null;read(false);}).catch(err=>ctx.toast('缓存清空失败：'+err.message));};
    read(false);
  }
  function renderTasks() {
    frame('tasks','任务中心','服务端作业与下载状态 · 手动执行前需确认',`<div id="ob-tasks" class="ob-grid">${panel('任务状态',empty('正在读取任务…'))}</div>`);loadTasks();
  }
  async function loadTasks() {
    const epoch=st.epoch,plugins=servicePlugins().filter(p=>['cron','download'].includes(p.type)).sort((a,b)=>a.type==='cron'&&b.type!=='cron'?-1:a.type!=='cron'&&b.type==='cron'?1:0);
    const results=await Promise.allSettled(plugins.map(p=>get(ppath(p.tag,p.type==='cron'?'jobs/status':'downloads'))));if(epoch!==st.epoch)return;
    $('#ob-tasks').innerHTML=plugins.map((p,i)=>{
      const r=results[i];if(r.status==='rejected')return panel(e(p.tag),errorBox(r.reason.message));
      if(p.type==='download')return panel('规则下载 · '+e(p.tag),`<div class="table-wrap"><table><thead><tr><th>文件路径</th><th>来源</th></tr></thead><tbody>${r.value.downloads.map(d=>`<tr><td class="mono ob-break">${e(d.path)}</td><td class="mono ob-break">${e(d.url)}</td></tr>`).join('')||'<tr><td colspan="2">没有下载项目</td></tr>'}</tbody></table></div>`,r.value.running?'正在下载':'当前空闲',`<button class="glass-btn small" data-ob-plugin="${e(p.tag)}">完整参数</button><button class="glass-btn small" data-ob-download="${e(p.tag)}" ${r.value.running?'disabled':''}>立即下载</button>`);
      const jobs=p.args?.jobs||[],jobConfig=name=>{const job=(Array.isArray(jobs)?jobs.find(j=>j.name===name):jobs[name])||{};return {...job,exec:(job.executors||[]).join(' → '),schedule:job.schedule||(job.interval?'每 '+job.interval:'未提供')};};
      return panel('定时作业 · '+e(p.tag),`<div class="table-wrap"><table><thead><tr><th>任务 / 执行对象</th><th>调度表达式</th><th>当前状态</th><th>最近手动执行</th><th></th></tr></thead><tbody>${Object.entries(r.value.jobs).map(([name,s])=>{const config=jobConfig(name)||{};return `<tr><td><strong>${e(name)}</strong><small class="ob-answer mono">${e(config.exec||config.executor||'查看完整参数')}</small></td><td class="mono">${e(config.cron||config.schedule||'未提供')}</td><td>${chip(s.current_run?'执行中':'空闲',s.current_run?'warn':'neutral')}</td><td>${s.last_manual_run?`<pre>${e(JSON.stringify(s.last_manual_run,null,2))}</pre>`:'暂无手动执行记录'}</td><td><button class="glass-btn small" data-ob-cron="${e(p.tag)}" data-ob-job="${e(name)}" ${s.current_run?'disabled':''}>立即运行</button></td></tr>`;}).join('')||'<tr><td colspan="5">没有配置作业</td></tr>'}</tbody></table></div>`, '接口仅返回当前执行和最近手动执行；不提供完整历史、下次运行时间。',`<button class="glass-btn small" data-ob-plugin="${e(p.tag)}">完整参数</button>`);
    }).join('')||panel('任务状态',empty('服务没有配置 cron 或 download 插件','现有插件仍可在插件中心编辑本地草稿。'));
    bindCommon();
    $$('[data-ob-download]').forEach(b=>b.onclick=()=>window.OxiEngine.confirm('下载规则文件？','目标 '+b.dataset.obDownload+'：会覆盖该插件已配置的文件，不自动重载规则数据源。',async()=>{b.disabled=true;try{await runAction('download',b.dataset.obDownload);ctx.toast('下载任务已完成：'+b.dataset.obDownload);if(ctx.route()==='tasks')await loadTasks();}catch(err){ctx.toast('下载失败：'+err.message);}finally{b.disabled=false;}},'确认下载'));
    $$('[data-ob-cron]').forEach(b=>b.onclick=()=>window.OxiEngine.confirm('立即运行定时作业？',b.dataset.obCron+' / '+b.dataset.obJob+'：会执行配置中的整条执行器链。受理不代表完成。',async()=>{b.disabled=true;try{await runAction('cron',b.dataset.obCron,{job:b.dataset.obJob});ctx.toast('定时作业已受理：'+b.dataset.obJob);setTimeout(()=>{if(ctx.route()==='tasks')loadTasks();},1200);}catch(err){ctx.toast('定时作业执行失败：'+err.message);}finally{b.disabled=false;}},'确认运行'));
    stamp();
  }
  function renderConnection() {
    const core=st.core,diff=core?M.compareConfigs(core.config,window.OxiEngine.config()):null;
    const versions=core?`<div class="ob-versions"><div><span>服务端配置文件</span><strong class="mono" title="${e(core.file.version)}">${short(core.file.version)}</strong><small>${e(core.file.path)}</small></div><div><span>当前运行配置</span><strong class="mono" title="${e(core.control.reload?.running_version)}">${short(core.control.reload?.running_version)}</strong><small>${core.file.version===core.control.reload?.running_version?'与服务端文件一致':'与文件不同，可能尚未重载'}</small></div><div><span>浏览器本地草稿</span><strong>修订 ${window.OxiEngine.revision()}</strong><small>${window.OxiEngine.config().plugins.length} 个实例 · 可校验后应用</small></div></div>`:'';
    frame('connection','服务连接与配置状态','运行观测、服务端写入和本地草稿分开管理',panel('OxiDNS 管理接口',`<form id="ob-connect-form" class="ob-connect-form"><div class="ob-filter"><label class="ob-search-label">服务地址<input id="ob-base" type="url" required value="${e(st.base)}" placeholder="http://127.0.0.1:9199"></label><button class="glass-btn primary" type="submit" ${st.status==='loading'?'disabled':''}>${st.status==='loading'?'连接中…':'连接并读取'}</button><button class="glass-btn" type="button" id="ob-demo">${st.mode==='demo'?'当前为示例模式':'切换示例模式'}</button></div><details class="ob-auth"><summary>API 需要身份验证</summary><div class="ob-filter"><label>API 用户名<input id="ob-user" autocomplete="off"></label><label>API 密码<input id="ob-password" type="password" autocomplete="off"></label></div><p class="gc-sub">仅用于本页 API 请求，不保存到浏览器存储。此处填写 API 账号，并非 SSH 账号。</p></details><p class="ob-connect-status" role="status">${st.status==='ready'?`已连接 OxiDNS ${e(core.build.version)} · 观测与受保护写入 · ${date(st.connectedAt)}`:st.status==='loading'?'正在读取服务配置与运行状态…':e(st.error||'填写服务地址后连接')}</p></form>`)+ (core?panel('配置应用状态',versions,'先服务端校验，再用版本号保存并可选热重载')+panel('服务端文件与本地草稿',`<div class="ob-notice">${diff.changed} 个插件存在差异${diff.globals.length?'；全局差异：'+e(diff.globals.join('、')):''}。导入会覆盖浏览器草稿；应用会使用服务端版本冲突保护。</div><details class="ob-data-details"><summary>查看插件差异 · ${diff.changed} 项</summary><div class="table-wrap ob-limited"><table><thead><tr><th>插件</th><th>类型</th><th>差异</th></tr></thead><tbody>${diff.rows.filter(r=>r.status!=='一致').map(r=>`<tr><td class="mono">${e(r.tag)}</td><td class="mono">${e(r.type)}</td><td>${chip(r.status)}</td></tr>`).join('')||'<tr><td colspan="3">全部插件参数一致</td></tr>'}</tbody></table></div></details><div class="ob-shortcuts"><button class="glass-btn" id="ob-import-draft">导入服务端配置到草稿</button><button class="glass-btn" data-route="config">打开配置并应用</button><button class="glass-btn" data-route="dependencies">查看服务端依赖</button><a class="glass-btn" href="/settings" target="_blank" rel="noopener">打开原生 OxiDNS 控制台</a></div>`):''),'<button class="glass-btn" data-route="overview">返回运行概览</button>');
    $('#ob-connect-form').onsubmit=ev=>{ev.preventDefault();if(operationBusy){ctx.toast('操作执行中，不能切换服务');return;}try{st.base=M.baseURL($('#ob-base').value.trim());}catch(err){$('.ob-connect-status').textContent=err.message;return;}const user=$('#ob-user').value,password=$('#ob-password').value;st.auth=user||password?'Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(user+':'+password))):'';st.mode='live';savePrefs();connect();};
    $('#ob-demo').onclick=()=>{if(operationBusy){ctx.toast('操作执行中，不能切换模式');return;}abortReads();st.mode='demo';st.status='idle';st.core=null;st.graph=null;st.auth='';savePrefs();ctx.navigate('overview');chrome();};
    $('#ob-import-draft')?.addEventListener('click',()=>{if(operationBusy)return;window.OxiEngine.confirm('导入服务端配置？','覆盖前会自动下载现有草稿；这次只载入编辑器，不写回服务。',()=>{ctx.download('yopilot-draft-before-import.yaml',window.jsyaml.dump(window.OxiEngine.config()),'application/yaml');window.OxiEngine.adoptService(st.base,core.file,core.config,true);ctx.toast('已载入 '+core.config.plugins.length+' 个服务端实例，可编辑后校验应用');ctx.navigate('config');},'备份草稿并载入');});
  }
  function draftNotice() {
    return `<div class="ob-draft-notice"><span>配置草稿 · 修订 ${window.OxiEngine.revision()} · 编辑后需校验应用</span><div class="oxi-actions"><button class="ob-link" data-route="config">校验与应用</button><button class="ob-link" data-route="connection">来源与版本</button><a class="ob-link" href="${e(st.base)}/plugins" target="_blank" rel="noopener">完整原生功能</a></div></div>`;
  }
  window.OxiObserve={render,draftNotice,refresh,chrome,request,validateConfig,applyConfig,runAction,dynamicRules,reconnect:connect,
    scope:tag=>({base:st.base,connection:st.connection,version:st.core?.file.version,tag}),
    subscribe,
    busy:()=>operationBusy,
    mode:()=>st.mode,
    base:()=>M.baseURL(st.base),
    info:()=>st.core,
    showCache,
    isReady:()=>st.mode==='live'&&st.status==='ready'&&!st.networkError,
    serviceConfig:()=>st.core?.config?JSON.parse(JSON.stringify(st.core.config)):null,
    install(context){
      ctx=context;
      window.YoPilotWorkflow?.install(context);
      if(window.YoPilotAdmin?.secure)st.base=location.origin;
      window.YoPilotAdmin?.install(context);
      window.OxiAdvanced?.install(context);
      Object.assign(window.OxiEngine.routeInfo,{connection:['服务连接','系统'],dependencies:['插件依赖','DNS 配置'],tasks:['任务中心','观测与运维']});
      const refreshButton=$('#refresh-button');if(refreshButton){refreshButton.addEventListener('click',ev=>{if(st.mode==='live'&&dataRoute()){ev.stopImmediatePropagation();refresh();}},true);}
      const box=$('#sidebar-status');box.tabIndex=0;box.setAttribute('role','button');box.title='查看服务连接与配置状态';box.onclick=()=>ctx.navigate('connection');box.onkeydown=ev=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();ev.stopPropagation();ctx.navigate('connection');}};
      timer=setInterval(async()=>{if(pending||document.hidden||st.paused||st.mode!=='live'||st.status!=='ready'||!['overview','queries','logs','tasks'].includes(ctx.route())||$('#drawer').classList.contains('open')||document.activeElement?.matches('input,select,textarea')||st.qpage>0&&ctx.route()==='queries')return;pending=true;try{await refresh();}finally{pending=false;}},15000);
      window.addEventListener('pagehide',()=>{clearInterval(timer);abortReads();});
      if(st.mode==='live'&&!window.YoPilotAdmin?.secure)queueMicrotask(()=>connect());else chrome();
    }
  };
})();
