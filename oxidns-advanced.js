/* Advanced operations share the existing guarded transport. No background writes. */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M=window.OxiAdvancedModel,A=()=>window.OxiObserve,E=()=>window.OxiEngine;
  const btn=(label,id,primary=false)=>`<button type="button" class="glass-btn ${primary?'primary':''}" id="${id}">${label}</button>`;
  const path=(tag,suffix)=>'/api/plugins/'+encodeURIComponent(tag)+(suffix?'/'+suffix:'');
  let ctx,stopLive=null,streamTimer=null;
  function stopStream(){stopLive?.();stopLive=null;clearTimeout(streamTimer);}
  function notice(root,message,error=false){const el=$('[data-advanced-status]',root);if(el){el.textContent=message;el.classList.toggle('ob-error',error);}}
  function drawer(title,sub,html){stopStream();ctx.openDrawer(title,sub,`<div class="yp-advanced">${html}<p data-advanced-status role="status" aria-live="polite"></p></div>`);return $('.yp-advanced',$('#drawer-content'));}
  const validScope=s=>JSON.stringify(s)===JSON.stringify(A().scope(s.tag));
  const requireScope=s=>{if(!validScope(s))throw Error('连接或配置版本已变化，请关闭此面板重新打开');};
  async function work(root,button,fn){if(button.disabled||!root.isConnected||!$('#drawer').classList.contains('open'))return;button.disabled=true;notice(root,'正在处理…');try{await fn();}catch(err){notice(root,err.message,true);}finally{button.disabled=false;}}
  function downloadBlob(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function remember(file,status='observed',required=false){
    try{const key=M.historyKey(A().base(),file.path||A().info()?.file.path),rows=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify(M.remember(rows,file,status)));return true;}
    catch(err){if(required)throw Error('配置历史无法写入浏览器，已阻止服务端保存；请先导出备份并释放存储');return false;}
  }
  function cache(tag){
    if(!A().serviceConfig()?.plugins.some(p=>p.tag===tag&&p.type==='cache'))return ctx.toast('此缓存池不在已连接服务中');
    const scope=A().scope(tag),root=drawer('缓存管理',tag+' · 实时数据，不修改配置草稿',`<form id="ac-search" class="ob-filter"><label class="ob-search-label">域名包含<input id="ac-query" type="search" placeholder="搜索缓存域名"></label><button class="glass-btn" type="submit">查询</button></form><div class="oxi-actions">${btn('导出此池 dump','ac-export')}${btn('清空此池','ac-flush')}</div><details class="ob-data-details"><summary>从 dump 恢复缓存</summary><p class="gc-sub">兼容的 dump 会替换当前缓存池，不是合并。请先导出备份；过期条目和超容量数据可能被丢弃。导入 0 条不等于成功恢复。</p><label>dump 文件（最多 64 MB）<input id="ac-file" type="file" accept=".dump,application/octet-stream"></label><label>输入缓存池标识确认替换<input id="ac-confirm" autocomplete="off" placeholder="${e(tag)}"></label>${btn('导入并替换此池','ac-import')}</details><div id="ac-results"></div>`);
    let cursor=null,seq=0;
    const read=async(next=false)=>{const id=++seq;requireScope(scope);const query=new URLSearchParams({limit:'50',qname:$('#ac-query',root).value});if(next&&cursor)query.set('cursor',cursor);const r=await A().request(path(tag,'entries')+'?'+query,{connection:scope.connection});if(id!==seq||!root.isConnected)return;requireScope(scope);cursor=r.next_cursor;
      $('#ac-results',root).innerHTML=`<p class="gc-sub">匹配 ${e(r.total_entries)} 条 · 本页 ${r.entries.length} 条</p><div class="table-wrap ob-limited"><table><thead><tr><th>域名 / 类型</th><th>剩余 TTL</th><th>状态</th><th>操作</th></tr></thead><tbody>${r.entries.map((v,i)=>`<tr><td class="mono ob-break">${e(v.domain)}<small class="ob-answer">${e(v.record_type)} · ${e(v.dns_class)}</small></td><td>${e(v.remaining_ttl)} s</td><td>${v.stale?'陈旧缓存':v.fresh?'有效':'待过期'}</td><td>${btn('详情','ac-detail-'+i)}${btn('删除','ac-delete-'+i)}</td></tr>`).join('')||'<tr><td colspan="4">没有匹配缓存</td></tr>'}</tbody></table></div>${btn('返回第一页','ac-first')}${btn('下一页','ac-next')}<div id="ac-detail"></div>`;
      $('#ac-next',root).disabled=!cursor;$('#ac-next',root).onclick=ev=>work(root,ev.currentTarget,()=>read(true));$('#ac-first',root).onclick=ev=>work(root,ev.currentTarget,()=>read(false));
      r.entries.forEach((v,i)=>{ $('#ac-detail-'+i,root).onclick=()=>{$('#ac-detail',root).innerHTML=`<h3>条目详情</h3><pre tabindex="0">${e(JSON.stringify(v,null,2))}</pre>`;};$('#ac-delete-'+i,root).onclick=ev=>{const b=ev.currentTarget;E().confirm('删除这条缓存？',`${v.domain} / ${v.record_type}。按完整缓存键删除，其他 ECS / DO / CD 变体不受影响。`,()=>work(root,b,async()=>{requireScope(scope);await A().runAction('cache-delete',tag,{scope,id:v.id});await read();notice(root,'服务端已删除，列表已回读');}),'确认删除');};});
    };
    $('#ac-search',root).onsubmit=ev=>{ev.preventDefault();work(root,$('button',ev.currentTarget),()=>read());};
    $('#ac-export',root).onclick=ev=>work(root,ev.currentTarget,async()=>{requireScope(scope);const blob=await A().request(path(tag,'dump'),{binary:true,connection:scope.connection});requireScope(scope);downloadBlob(tag+'.dump',blob);notice(root,'已下载服务端二进制 dump');});
    $('#ac-import',root).onclick=ev=>{const b=ev.currentTarget,file=$('#ac-file',root).files[0];if(!file||file.size===0||file.size>64*1024*1024||$('#ac-confirm',root).value!==tag)return notice(root,'请选择有效文件（不超过 64 MB），并输入完整缓存池标识',true);
      E().confirm('替换缓存池 '+tag+'？','导入将覆盖该池的当前条目，不能自动撤销。请确认已经导出备份。',()=>work(root,b,async()=>{requireScope(scope);const data=await file.arrayBuffer();const result=await A().runAction('cache-load',tag,{scope,data,confirmTag:tag});await read();notice(root,`服务端报告载入 ${result.loaded_entries} 条；已回读列表，最终数量可能因容量或过期而减少。${result.loaded_entries===0?'请检查文件兼容性；不能据此认定恢复成功。':''}`); }),'确认替换');};
    $('#ac-flush',root).onclick=ev=>{const b=ev.currentTarget;E().confirm('清空 '+tag+'？','删除此池全部缓存，不能撤销；不会删除持久化文件。',()=>work(root,b,async()=>{requireScope(scope);await A().runAction('flush',tag);await read();notice(root,'缓存池已清空并回读');}),'确认清空');};
    read().catch(err=>notice(root,err.message,true));
  }
  async function deletePlugin(tag){
    const config=E().config(),revision=E().revision(),plugin=config.plugins.find(p=>p.tag===tag);if(!plugin)return;
    const scope=A().scope(tag),root=drawer('删除插件与处理引用',`${E().label(plugin.type)} · ${tag} · 仅修改草稿`,`<p>先校验当前草稿并读取真实依赖。删除不会立即改变 DNS，仍需在高级配置中应用。</p><div id="ad-impact">正在校验依赖…</div>`);
    try{
      const report=await A().validateConfig(config);requireScope(scope);if(!root.isConnected)return;
      const edges=report.dependency_graph?.edges;if(!Array.isArray(edges))throw Error('服务未返回依赖图，不能安全删除');
      const incoming=edges.filter(x=>x.target_tag===tag&&x.source_tag!==tag);
      $('#ad-impact',root).innerHTML=`<p>${incoming.length} 处引用${config.include?.length?' · 含外部 include，自动处理已禁用':''}</p><ul class="yp-reference-list">${incoming.map(x=>`<li><button class="ob-link" data-ref-edit="${e(x.source_tag)}">${e(x.source_tag)}</button><code>${e(x.field)}</code></li>`).join('')||'<li>未发现其他插件引用</li>'}</ul><label>关联处理<select id="ad-mode"><option value="">仅删除（有引用时阻止）</option><option value="replace">将引用替换为同类型插件</option><option value="remove">移除可安全移除的数组引用</option></select></label><label>替代插件<select id="ad-replacement"><option value="">请选择</option>${config.plugins.filter(p=>p.tag!==tag&&p.type===plugin.type).map(p=>`<option value="${e(p.tag)}">${e(p.tag)}</option>`).join('')}</select></label><p class="gc-sub">入口、执行动作和复杂表达式不会被静默删掉；不支持的关联请打开来源插件手动处理。</p>${btn('预览修改','ad-preview')}<pre id="ad-diff" tabindex="0"></pre>${btn('删除并保存草稿','ad-save')}`;
      let prepared=null;
      const prepare=()=>{requireScope(scope);if(E().revision()!==revision)throw Error('草稿已变化，请重新打开删除面板');const mode=$('#ad-mode',root).value;return M.mutatePlugin(config,edges,tag,{replacement:mode==='replace'?$('#ad-replacement',root).value:'',removeRefs:mode==='remove'});};
      $('#ad-preview',root).onclick=()=>{try{prepared=prepare();$('#ad-diff',root).textContent=JSON.stringify({delete:tag,changed:prepared.plugins.filter(p=>JSON.stringify(p)!==JSON.stringify(config.plugins.find(x=>x.tag===p.tag)))},null,2);notice(root,'预览已生成，尚未保存');}catch(err){notice(root,err.message,true);}};
      $$('[data-ref-edit]',root).forEach(b=>b.onclick=()=>E().edit(null,b.dataset.refEdit));
      $('#ad-save',root).onclick=ev=>{const b=ev.currentTarget;try{prepared=prepare();}catch(err){notice(root,err.message,true);return;}const snapshot=prepared;E().confirm('从草稿删除 '+tag+'？','将同步处理所选引用，再请求服务端校验。只保存浏览器草稿，不直接应用。',()=>work(root,b,async()=>{requireScope(scope);if(E().revision()!==revision)throw Error('草稿已变化，请重新预览');await A().validateConfig(snapshot);requireScope(scope);if(E().revision()!==revision)throw Error('校验期间草稿已变化');E().replaceConfig(snapshot);ctx.closeDrawer();ctx.refresh();ctx.toast('插件已从草稿删除；可撤销上次保存，尚未应用到服务');}),'确认保存草稿');};
    }catch(err){notice(root,err.message,true);}
  }
  function history(){
    const file=A().info()?.file;if(!file)return ctx.toast('请先连接服务');
    const scope=A().scope(''),key=M.historyKey(A().base(),file.path),root=drawer('配置历史','当前浏览器 · '+file.path,`<p class="gc-sub">最多保留 20 个版本，含配置原文和可能的敏感参数。不会上传为服务器备份；清理浏览器数据会丢失。恢复只载入草稿，仍需校验、确认并应用。</p>${btn('记录当前服务版本','ah-record')}${btn('清除此服务的本地历史','ah-clear')}<div id="ah-list"></div>`);
    function draw(){let rows;try{rows=JSON.parse(localStorage.getItem(key)||'[]');}catch{notice(root,'历史存储不可读',true);return;}
      $('#ah-list',root).innerHTML=rows.map((r,i)=>`<article class="yp-history-row"><div><strong>${e(r.version.slice(0,12))}</strong><p>${e(new Date(r.at).toLocaleString())} · ${r.version===A().info()?.control.reload?.running_version?'当前运行版本':({observed:'读取快照','before-save':'变更前备份',saved:'已保存文件',applied:'已验证热重载'})[r.status]||'历史快照'}</p></div><div class="oxi-actions">${btn('查看原文','ah-view-'+i)}${btn('下载','ah-download-'+i)}${btn('载入草稿','ah-restore-'+i)}</div></article>`).join('')||'<p>尚无历史快照。可记录当前版本。</p>';
      rows.forEach((r,i)=>{ $('#ah-view-'+i,root).onclick=()=>{let pre=$('#ah-preview',root);if(!pre){pre=document.createElement('pre');pre.id='ah-preview';root.append(pre);}pre.textContent=r.content;};$('#ah-download-'+i,root).onclick=()=>ctx.download('oxidns-'+r.version.slice(0,12)+'.'+r.format,r.content,'text/plain');$('#ah-restore-'+i,root).onclick=()=>E().confirm('载入历史版本到草稿？','覆盖当前浏览器草稿，但不写入服务；之后应用仍以当前服务版本进行冲突检查。',async()=>{try{requireScope(scope);const current=await A().request('/api/config');if(current.version!==file.version)throw Error('服务版本已变化，请重新连接后恢复');const config=r.format==='json'?JSON.parse(r.content):window.jsyaml.load(r.content);if(!Array.isArray(config.plugins))throw Error('历史配置未包含 plugins 数组');E().loadHistory(config,r.content,r.format,A().base(),current);ctx.closeDrawer();ctx.navigate('config');ctx.toast('历史原文已载入草稿，尚未应用');}catch(err){notice(root,err.message,true);}},'载入草稿');});
    }
    $('#ah-record',root).onclick=()=>{try{requireScope(scope);remember(file,'observed',true);draw();notice(root,'当前服务版本已记录');}catch(err){notice(root,err.message,true);}};
    $('#ah-clear',root).onclick=()=>E().confirm('清除本地历史？','只移除此浏览器中当前服务 / 配置路径的历史，不改变服务端文件。',()=>{localStorage.removeItem(key);draw();},'清除历史');draw();
  }
  function stream(kind){
    const query=kind==='queries',plugins=A().serviceConfig()?.plugins.filter(p=>p.type==='query_recorder')||[];
    const root=drawer(query?'实时 DNS 查询':'实时运行日志','SSE 实时流 · 历史筛选仍保留在原页面',`<div class="ob-filter">${query?`<label>记录器<select id="as-tag">${plugins.map(p=>`<option value="${e(p.tag)}">${e(p.tag)}</option>`).join('')}</select></label>`:`<label>最低级别<select id="as-level"><option value="">全部</option><option value="info">INFO</option><option value="warn">WARN</option><option value="error">ERROR</option></select></label>`}<label>搜索已接收内容<input id="as-search" type="search"></label></div><div class="oxi-actions">${btn('开始接收','as-start',true)}${btn('暂停接收','as-stop')}${btn('导出当前缓冲','as-export')}</div><p class="gc-sub">切换页面、关闭面板或隐藏窗口会停止接收。暂停 / 断流期间可能缺记录；后端不提供可靠续传，请回查历史。最多保留最新 300 条。</p><div id="as-output" class="yp-stream-output" tabindex="0"></div>`);
    let rows=[],dirty=false;
    function paint(){const q=$('#as-search',root).value.toLowerCase();$('#as-output',root).innerHTML=[...rows].reverse().filter(r=>JSON.stringify(r).toLowerCase().includes(q)).map(r=>`<details><summary>${query?`${e(new Date(r.created_at_ms).toLocaleTimeString())} · ${e((r.questions_json||[]).map(q=>q.name).join(', '))} · ${e(r.elapsed_ms)} ms`:`${e(r.timestamp)} · ${e(r.level)} · ${e(r.message)}`}</summary><pre>${e(JSON.stringify(r,null,2))}</pre></details>`).join('')||'<p>暂无匹配事件</p>';}
    function start(){stopStream();if(query&&!plugins.length)return notice(root,'服务没有配置 query_recorder',true);rows=[];paint();const url=query?path($('#as-tag',root).value,'stream')+'?tail=20':'/api/logs/stream?tail=20&level='+encodeURIComponent($('#as-level',root).value||'trace');
      stopLive=A().subscribe(url,{event:query?'record':'log',onEvent:r=>{if(!root.isConnected)return;rows.push(r);if(rows.length>300)rows.shift();dirty=true;},onState:msg=>notice(root,msg)});
      const tick=()=>{if(!root.isConnected||!$('#drawer').classList.contains('open')||document.hidden){stopStream();notice(root,'接收已停止；重新开始可能有间隔，请回查历史');return;}if(dirty){paint();dirty=false;}streamTimer=setTimeout(tick,350);};tick();
    }
    $('#as-start',root).onclick=start;$('#as-stop',root).onclick=()=>{stopStream();notice(root,'已暂停；缓冲保留，暂停期间的记录请回查历史');};$('#as-search',root).oninput=paint;
    $('#as-export',root).onclick=()=>ctx.download('oxidns-stream-buffer.json',JSON.stringify(rows,null,2),'application/json');
    for(const s of ['#as-tag','#as-level'])if($(s,root))$(s,root).onchange=()=>{stopStream();notice(root,'筛选已变更，点击开始接收');};start();
  }
  function upgrade(){
    const scope=A().scope(''),root=drawer('OxiDNS 升级','完整升级参数 · 检查与安装分开',`<p class="ob-notice">升级会替换程序并自动重启，也可能覆盖 YoPilot 页面。请先在服务器外备份配置、程序和整个 WebUI 目录。选择精简包可能导致已有插件不可用。</p><div class="yp-advanced-fields"><label>仓库<input name="repository" value="svenshi/oxidns"></label><label>目标版本 / release tag<input name="target" value="latest"></label><label>功能包<select name="bundle"><option value="auto">自动匹配当前包</option><option value="full">full · 完整</option><option value="standard">standard · 标准</option><option value="minimal">minimal · 精简</option></select></label><label>出口 profile<input name="outbound"></label><label>SOCKS5 地址<input name="socks5" autocomplete="off"></label><label>GitHub Token（仅本面板内存）<input name="github_token" type="password" autocomplete="off"></label></div><div class="yp-checks">${[['allow_prerelease','允许预发布'],['force','强制升级 / 降级'],['cleanup','升级后清理临时文件']].map(([k,t])=>`<label><input type="checkbox" name="${k}"> ${t}</label>`).join('')}</div><div class="oxi-actions">${btn('检查目标版本','au-check',true)}${btn('读取升级状态','au-status')}</div><pre id="au-result" tabindex="0"></pre><label class="yp-checks"><input id="au-backup" type="checkbox"> 我已在服务器外备份配置、程序及 WebUI</label><label>输入服务地址确认<input id="au-confirm" placeholder="${e(A().base())}" autocomplete="off"></label>${btn('安装并自动重启','au-apply')}`);
    let checked=null;
    const options=()=>{const v={};$$('[name]',root).forEach(el=>v[el.name]=el.type==='checkbox'?el.checked:el.value);return M.upgradeOptions(v);};
    const result=r=>$('#au-result',root).textContent=JSON.stringify(r,null,2);
    const status=async()=>{requireScope(scope);const r=await A().request('/api/upgrade/status');result(r);notice(root,({idle:'当前没有升级任务。重启后任务状态可能重置，请核对运行版本。',running:'正在安装，尚未完成',restarting:'正在重启；恢复后请重新连接并核对版本',completed:'服务端报告安装完成；请核对运行版本',failed:'升级失败：'+(r.error||'未提供原因'),skipped:'服务端跳过本次安装'})[r.state]||'未知状态，请查看原始结果',r.state==='failed');};
    $('#au-check',root).onclick=ev=>work(root,ev.currentTarget,async()=>{requireScope(scope);const o=options(),r=await A().runAction('upgrade-check','',o);checked=JSON.stringify(o);result(r);notice(root,'检查完成，尚未安装。当前 '+r.current_version+' → 目标 '+r.latest_version);});
    $('#au-status',root).onclick=ev=>work(root,ev.currentTarget,status);
    $('#au-apply',root).onclick=ev=>{const b=ev.currentTarget;let o;try{o=options();if(checked!==JSON.stringify(o))throw Error('参数已变更或尚未检查，请先检查目标版本');if(!$('#au-backup',root).checked||$('#au-confirm',root).value!==A().base())throw Error('请确认外部备份，并输入完整服务地址');}catch(err){notice(root,err.message,true);return;}
      E().confirm('安装 OxiDNS 并自动重启？',`目标 ${A().base()}，${o.repository} / ${o.target} / ${o.bundle}。DNS 将短暂中断，YoPilot 可能被原生页面覆盖。`,()=>work(root,b,async()=>{requireScope(scope);const r=await A().runAction('upgrade-apply','',{scope,options:o,backedUp:true,confirmTarget:scope.base});result(r);$('[name=github_token]',root).value='';checked=null;notice(root,'升级请求已受理，不代表已完成。请读取升级状态；重启后重新连接核对版本。');}),'确认安装');};
  }
  function queryTools(){
    const plugins=A().serviceConfig()?.plugins.filter(p=>p.type==='query_recorder')||[],root=drawer('查询统计与历史管理','按记录器查看统计 · 清理操作立即生效',`<label>记录器<select id="aq-tag">${plugins.map(p=>`<option value="${e(p.tag)}">${e(p.tag)}</option>`).join('')}</select></label><label>时间窗口<select id="aq-range"><option value="60">近 1 小时</option><option value="1440">近 24 小时</option></select></label><div class="oxi-actions">${btn('查询类型分布','aq-type')}${btn('插件执行统计','aq-plugins')}</div><pre id="aq-result" tabindex="0"></pre><details><summary>清空此记录器全部历史</summary><p class="gc-sub">不是只删除当前筛选结果；历史与统计会清除，不能恢复。</p><label>输入记录器标识<input id="aq-confirm"></label>${btn('清空全部历史','aq-clear')}</details>`);
    const initial=A().scope('');
    for(const [id,endpoint] of [['type','qtype'],['plugins','plugins']])$('#aq-'+id,root).onclick=ev=>work(root,ev.currentTarget,async()=>{requireScope(initial);const tag=$('#aq-tag',root).value;if(!tag)throw Error('未配置查询记录器');const until=Date.now(),since=until-Number($('#aq-range',root).value)*60000;const r=await A().request(path(tag,'stats/'+endpoint)+`?since_ms=${since}&until_ms=${until}`);$('#aq-result',root).textContent=JSON.stringify(r,null,2);notice(root,'统计已读取');});
    $('#aq-clear',root).onclick=ev=>{const b=ev.currentTarget,tag=$('#aq-tag',root).value,scope={...initial,tag};if(!tag||$('#aq-confirm',root).value!==tag)return notice(root,'请输入完整记录器标识',true);E().confirm('清空 '+tag+' 全部历史？','该操作不能撤销，且不局限于当前筛选或时间范围。',()=>work(root,b,async()=>{requireScope(scope);const r=await A().runAction('query-clear',tag,{scope,confirmTag:tag});$('#aq-result',root).textContent=JSON.stringify(r,null,2);notice(root,'服务端已清空历史，请刷新查询列表');}),'确认清空');};
  }
  function globalConfig(){
    const config=E().config(),revision=E().revision(),globals=Object.fromEntries(Object.entries(config).filter(([k])=>k!=='plugins'));
    const root=drawer('全局配置','runtime / api / log / network / include 与自定义顶层字段',`<p class="gc-sub">保留所有顶层字段和环境变量占位符。修改 API 监听、认证或 TLS 可能导致断连；include 只编辑路径，不编辑服务器上的引用文件。保存为草稿后，在高级配置选择「仅保存到服务」，再单独确认重启。</p><label>全局 YAML<textarea id="ag-yaml" spellcheck="false">${e(window.jsyaml.dump(globals,{lineWidth:100,noRefs:true}))}</textarea></label>${btn('校验并保存草稿','ag-save',true)}`);
    const scope=A().scope('');$('#ag-save',root).onclick=ev=>work(root,ev.currentTarget,async()=>{requireScope(scope);if(E().revision()!==revision)throw Error('草稿已变化，请重新打开');const v=window.jsyaml.load($('#ag-yaml',root).value);if(!v||Array.isArray(v)||typeof v!=='object'||'plugins'in v)throw Error('请输入不包含 plugins 的全局对象');const next={...v,plugins:config.plugins};await A().validateConfig(next);requireScope(scope);if(E().revision()!==revision)throw Error('校验期间草稿已变化');E().replaceConfig(next);ctx.closeDrawer();ctx.navigate('config');ctx.toast('全局配置已保存为草稿，尚未写入服务');});
  }
  function downloadItem(){
    const plugins=A().serviceConfig()?.plugins.filter(p=>p.type==='download')||[],scope=A().scope('');
    const root=drawer('规则文件单项下载','只执行选定项，不自动重载 Provider',`<label>下载任务<select id="at-plugin">${plugins.map(p=>`<option value="${e(p.tag)}">${e(p.tag)}</option>`).join('')}</select></label><label>文件<select id="at-item"></select></label>${btn('下载所选文件','at-run',true)}`);
    function items(){const p=plugins.find(p=>p.tag===$('#at-plugin',root).value);$('#at-item',root).innerHTML=(p?.args?.downloads||[]).map((v,i)=>`<option value="${i}">${i+1} · ${e(v.filename||v.url)}</option>`).join('');}
    $('#at-plugin',root).onchange=items;items();$('#at-run',root).onclick=ev=>{const b=ev.currentTarget,tag=$('#at-plugin',root).value,index=Number($('#at-item',root).value);if(!tag||!$('#at-item',root).value)return notice(root,'没有可下载项目',true);E().confirm('下载所选规则文件？','目标 '+tag+' 第 '+(index+1)+' 项；会覆盖配置中的目标文件。',()=>work(root,b,async()=>{requireScope(scope);await A().runAction('download',tag,{index});notice(root,'服务端报告单项下载完成；需要时再重载相关数据源');}),'确认下载');};
  }
  function reverseLookup(){
    const plugins=A().serviceConfig()?.plugins.filter(p=>p.type==='reverse_lookup')||[],scope=A().scope('');
    const root=drawer('反向解析映射查询','查询 reverse_lookup 已学习的 IP → 域名',`<label>插件<select id="ar-tag">${plugins.map(p=>`<option value="${e(p.tag)}">${e(p.tag)}</option>`).join('')}</select></label><label>IP 地址<input id="ar-ip" placeholder="192.0.2.1"></label>${btn('查询映射','ar-read',true)}<pre id="ar-result"></pre>`);
    if(!plugins.length)notice(root,'当前服务未配置 reverse_lookup；可在插件中心添加，不能生成示例映射');
    $('#ar-read',root).onclick=ev=>work(root,ev.currentTarget,async()=>{requireScope(scope);const tag=$('#ar-tag',root).value,ip=$('#ar-ip',root).value.trim();if(!tag||!ip)throw Error('请选择已运行插件，并填写 IP 地址');const r=await A().request(path(tag,'')+'?ip='+encodeURIComponent(ip));$('#ar-result',root).textContent=JSON.stringify(r,null,2);notice(root,'查询完成；空映射表示此插件尚未学习该地址');});
  }
  function render(route){
    if(route!=='metrics'||!A().isReady())return false;
    const host=$('#page-content'),scope=A().scope('');host.innerHTML=ctx.subnav(route)+`<div class="view-title-row"><div><h1>指标与 API</h1><span class="gc-sub">当前 OxiDNS 实例的 Prometheus 指标，不使用示例数值</span></div></div><section class="card yp-metrics"><div class="ob-filter"><label class="ob-search-label">搜索指标名称 / 标签<input id="am-search" type="search"></label>${btn('刷新指标','am-read')}${btn('下载完整指标','am-download')}</div><p id="am-status" role="status"></p><pre id="am-content" tabindex="0"></pre><p class="gc-sub">计数器从本次进程启动累计；这里只读，不提供后端不存在的“指标重置”操作。</p></section>`;
    let raw='';const paint=()=>{const q=$('#am-search').value.toLowerCase();$('#am-content').textContent=raw.split('\n').filter(l=>l.toLowerCase().includes(q)).join('\n');};
    const read=async()=>{const target=$('#am-content'),button=$('#am-read');button.disabled=true;try{requireScope(scope);const value=await A().request('/api/metrics',{text:true});if(target!==$('#am-content'))return;raw=value;paint();$('#am-status').textContent='已读取 '+new Date().toLocaleTimeString()+' · 搜索仅筛选当前结果';}catch(err){if(target===$('#am-content'))$('#am-status').textContent=err.message;}finally{button.disabled=false;}};
    $('#am-search').oninput=paint;$('#am-read').onclick=read;$('#am-download').onclick=()=>ctx.download('oxidns-metrics.txt',raw,'text/plain');read();return true;
  }
  function enhance(route){
    window.YoPilotWorkflow?.enhance(route);
    if(!A().isReady()||!ctx)return;
    const host=$('#page-content');if(!host||$('#yp-advanced-tools',host))return;
    const actions={queries:[['实时查询流',()=>stream('queries')],['类型 / 插件统计与清理',queryTools]],logs:[['实时日志流',()=>stream('logs')]],runtime:[['升级参数与安装',upgrade]],config:[['配置历史',history],['全局配置',globalConfig]],system:[['全局配置',globalConfig]],plugins:[['安全删除插件',chooseDelete]],connection:[['配置历史',history]],tasks:[['单项下载规则文件',downloadItem]],response:[['反向解析映射查询',reverseLookup]]}[route];
    if(!actions)return;const bar=document.createElement('div');bar.id='yp-advanced-tools';bar.className='oxi-actions yp-advanced-tools';bar.innerHTML=actions.map(([name],i)=>btn(name,'yp-advanced-'+i)).join('');const header=$('.view-title-row,.page-header',host);if(header)header.after(bar);else host.prepend(bar);actions.forEach(([,fn],i)=>$('#yp-advanced-'+i,bar).onclick=fn);
  }
  function chooseDelete(){const root=drawer('选择待删除插件','仅修改当前草稿，下一步检查关联引用',`<label>插件<select id="ad-select">${E().config().plugins.map(p=>`<option value="${e(p.tag)}">${e(window.YoPilotPresentation?.name(p)||p.tag)} · ${e(p.tag)} · ${e(p.type)}</option>`).join('')}</select></label>${btn('查看引用与删除选项','ad-go')}`);$('#ad-go',root).onclick=()=>deletePlugin($('#ad-select',root).value);}
  window.OxiAdvanced={cache,deletePlugin,history,queryTools,upgrade,render,enhance,remember,stopStream,install(context){ctx=context;document.addEventListener('visibilitychange',()=>{if(document.hidden){stopStream();const root=$('.yp-advanced');if(root&&$('#as-output',root))notice(root,'页面进入后台，已停止接收；返回后点击开始，间隔数据请回查历史');}});window.addEventListener('pagehide',stopStream);}};
})();
