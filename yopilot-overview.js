/* Overview presentation only: no service writes, no fabricated health states. */
(() => {
  'use strict';
  const M=window.YoPilotOverviewModel;
  const rateTracker=M.createRateTracker();
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:d}):'—';
  const ms=v=>typeof v==='number'&&Number.isFinite(v)?v>0&&v<.1?'<0.1':n(v,1):'—';
  const name=p=>window.YoPilotPresentation?.name(p)||p?.tag||p||'未命名';
  function prepare({config,catalog,metrics,pools,system,base,connection,version,latency,clients,domains,pluginStats,rcode,range}){
    const traffic=M.inbound(metrics,config,catalog);
    const rate=rateTracker({total:traffic.total,uptime:system?.uptime_ms,scope:base+'|'+connection,version});
    const validLatency=latency&&Number.isFinite(latency.sample_size)&&latency.sample_size>=0;
    const sample=validLatency?latency.sample_size:null;
    const cachePools=pools.filter(p=>p.available),lookups=cachePools.reduce((s,p)=>s+p.lookups,0),hits=cachePools.reduce((s,p)=>s+p.hits,0);
    const fail=rcode&&Array.isArray(rcode.rows)?rcode.rows.filter(r=>window.OxiObserveModel.rcode(r.key)==='SERVFAIL').reduce((s,r)=>s+r.count,0):null;
    return {traffic,rate,cache:{rate:lookups?hits/lookups:null,pools:cachePools.length,total:pools.length},clients:M.topSummary(clients,'clients'),domains:M.topSummary(domains,'domains'),blocked:M.blocked(config,pluginStats),latency:sample>0?latency:null,sample,range,
      failure:{count:fail,rate:rcode?.sample_size>0&&fail!==null?fail/rcode.sample_size:null,samples:rcode?.sample_size??null},upstreams:M.upstreams(metrics,config)};
  }
  function service({core,base,controls}){
    const {system,control,file}=core,reload=control.reload||{},running=control.status==='running',aligned=reload.running_version&&file.version===reload.running_version,busy=reload.pending||reload.in_progress;
    const started=Number.isFinite(system.uptime_ms)&&system.uptime_ms>=0?new Date(Date.now()-system.uptime_ms).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
    const facts=[['启动时间（估算）',started,'北京时间 · 由运行时长推算'],['运行时长',M.duration(system.uptime_ms),'当前 OxiDNS 进程'],['进程 CPU',n(system.process_cpu_percent,2)+'%','进程采样'],['进程内存',n(system.process_memory_mb)+' MB',system.process_memory_kind||'统计类型未提供']];
    return `<section class="card ob-service yp-overview-summary ypo-service"><div class="ypo-service-top"><div class="ypo-identity"><h1>运行概览</h1><span class="yp-service-health ${running?'is-running':'is-warning'}"><i aria-hidden="true"></i>DNS 服务${running?'运行中':'状态：'+e(control.status||'未知')}</span><p>${e(base)}<span class="ypo-inline-divider"> · </span><br>OxiDNS ${e(core.build.version)} · ${e(system.os)} / ${e(system.arch)}</p></div><dl class="ypo-process-facts">${facts.map(([label,value,note])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd><small>${e(note)}</small></div>`).join('')}</dl></div><div class="ypo-service-footer"><div class="ypo-controls">${controls}</div><div class="ypo-config-status"><span>${(core.config.plugins||[]).length} 个插件实例</span><span class="badge ${busy||!aligned?'warn':'success'}">${busy?'配置应用中':aligned?'配置已生效':'文件与运行版本不同'}</span><button class="glass-btn small" data-route="connection">查看配置状态</button></div></div>${reload.last_error?`<p class="ob-error">${e(reload.last_error)}</p>`:''}</section>`;
  }
  function statistics(v){
    const sampleNote=count=>count===null?'统计不可用':count===0?'所选时段没有样本':'样本 '+n(count)+' 条';
    const dedup=x=>x.available?(x.lowerBound?'≥ ':'')+n(x.count):'—';
    const cards=[
      ['total','累计请求',n(v.traffic.total),'次','监听入口 · 本次进程累计','时段采样 '+n(v.sample)+' 条'],
      ['qps','每秒请求 QPS',n(v.rate.value,2),'次/秒',v.rate.seconds?'近 '+n(v.rate.seconds)+' 秒均值':'等待第二次有效采样','当前并发 '+n(v.traffic.inflight)+' 条'],
      ['cache','缓存命中率',v.cache.rate===null?'—':n(v.cache.rate*100,1),'%','缓存查找 · 本次进程累计',v.cache.pools+' / '+v.cache.total+' 个缓存池有指标'],
      ['clients','活跃客户端',dedup(v.clients),'个','采样中的去重来源 IP',sampleNote(v.clients.samples),'clients'],
      ['blocked','拦截请求',n(v.blocked.count),'次',v.blocked.available?(v.blocked.rate===null?'暂无查询样本':n(v.blocked.rate*100,2)+'% · 专用黑名单应答'):v.blocked.reason,sampleNote(v.blocked.samples),'blocked'],
      ['latency','平均响应',ms(v.latency?.avg_ms),'ms','P95 '+ms(v.latency?.p95_ms)+' ms · P99 '+ms(v.latency?.p99_ms)+' ms',sampleNote(v.sample),'latency'],
      ['domains','查询域名数',dedup(v.domains),'个','采样中的去重域名',sampleNote(v.domains.samples),'domains'],
      ['failure','失败响应',v.failure.rate===null?'—':n(v.failure.rate*100,2),'%','SERVFAIL '+n(v.failure.count)+' 次',sampleNote(v.failure.samples)]
    ];
    return `<section class="ypo-statistics" aria-label="运行统计"><div class="ypo-scope-note"><span>查询统计：近 ${v.range<60?v.range+' 分钟':v.range/60+' 小时'}内最近最多 ${n(M.RECORD_LIMIT)} 条已保留记录</span><span>累计请求、QPS、并发及缓存查找使用独立进程指标</span></div><div class="ob-kpis ypo-kpis">${cards.map(([id,label,value,unit,note,detail,action])=>`<${action?'button type="button"':'div'} class="ob-kpi ypo-kpi" data-ypo-stat="${id}" ${action?`data-ypo-action="${action}"`:''}><span class="ypo-kpi-label">${label}${action?'<span class="ypo-detail-label">查看明细</span>':''}</span><strong>${e(value)}<span>${unit}</span></strong><small>${e(note)}</small><small>${e(detail)}</small></${action?'button':'div'}>`).join('')}</div></section>`;
  }
  function quality(v){
    const rows=v.upstreams;
    return `<section class="card ob-panel ypo-quality"><div class="card-header"><div><h2>上游解析质量</h2><p class="gc-sub">本次进程累计 · 按转发组汇总节点指标；没有请求不等于离线</p></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>解析组 / DNS 目标</th><th>上游请求</th><th>节点响应平均</th><th>错误次数</th><th>超时次数</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="ob-link" data-ob-plugin="${e(r.p.tag)}">${e(name(r.p))}</button><small class="ypo-target-summary">${(Array.isArray(r.p.args?.upstreams)?r.p.args.upstreams:[]).map(u=>e(typeof u==='string'?u:u.addr||u.tag||'未设置地址')).join('<br>')||'未配置 DNS 目标'}</small></td><td>${n(r.calls)}</td><td>${r.average===null?'暂无样本':ms(r.average)+' ms'}<small class="ypo-target-summary">${n(r.responses)} 次耗时样本</small></td><td>${n(r.errors)}</td><td>${n(r.timeouts)}</td></tr>`).join('')}</tbody></table></div><p class="ypo-quality-note">国内并发会同时访问多个节点，因此上游请求数可能高于客户端请求数；错误与超时不相加计算失败率。</p>`:'<p class="ypo-quality-note">未配置 forward 转发组。</p>'}</section>`;
  }
  function bind(root,v,{openDrawer,plugin,client,domain}){
    const actions={
      clients:()=>showList('clients',v.clients,client),domains:()=>showList('domains',v.domains,domain),
      blocked:()=>{
        openDrawer('拦截请求统计','专用黑名单应答 · 不是所有 NXDOMAIN',`<dl class="ob-detail-grid"><div><dt>进入拦截应答的查询</dt><dd>${n(v.blocked.count)} 次</dd></div><div><dt>查询样本</dt><dd>${n(v.blocked.samples)} 条</dd></div><div><dt>统计执行器</dt><dd>blocked_response</dd></div><div><dt>匹配来源</dt><dd>blocked 黑名单</dd></div></dl><p class="ypo-explanation">${e(v.blocked.reason||'按每个查询是否进入专用黑名单应答统计，同一查询只计一次。')} 仅包含当前已识别的黑名单应答流程；不把 PCDN 分流、A / AAAA / HTTPS 记录过滤、自然 NXDOMAIN 或无响应自动当作拦截。此计数受查询记录的时间范围和最多 10,000 条采样限制。</p>${v.blocked.tag?'<button type="button" class="glass-btn" id="ypo-block-plugin">查看专用应答参数</button>':''}`);
        document.querySelector('#ypo-block-plugin')?.addEventListener('click',()=>plugin(v.blocked.tag));
      },
      latency:()=>openDrawer('响应耗时统计','当前时间范围 · 记录器查询总耗时',`<dl class="ob-detail-grid">${[['样本数',n(v.sample)+' 条'],['平均',ms(v.latency?.avg_ms)+' ms'],['P50',ms(v.latency?.p50_ms)+' ms'],['P95',ms(v.latency?.p95_ms)+' ms'],['P99',ms(v.latency?.p99_ms)+' ms'],['最大',ms(v.latency?.max_ms)+' ms']].map(([k,val])=>`<div><dt>${k}</dt><dd>${e(val)}</dd></div>`).join('')}</dl><p class="ypo-explanation">无样本或指标不可用时显示“—”，实际测得的 0 ms 保留为 0。这些是查询总耗时，不是各插件步骤耗时。</p>`)
    };
    root.querySelectorAll('[data-ypo-action]').forEach(b=>b.addEventListener('click',()=>actions[b.dataset.ypoAction]?.()));
    function showList(kind,data,onSelect){
      const title=kind==='clients'?'活跃客户端':'查询域名',label=kind==='clients'?'来源 IP':'域名';
      let page=0,query='';
      openDrawer(title+'明细',`所选时段采样去重 · ${n(data.samples)} 条查询记录`,`<p class="ypo-explanation">${data.available?(data.lowerBound?'列表达到接口请求上限，数量为至少值。':'当前样本中共 '+n(data.count)+' 个'+label+'。'):'统计暂不可用。'} 查询记录最多取所选时段内最近 10,000 条；此列表不是整个局域网设备清单，也不是规则库。点击条目查看对应查询。</p><label class="ypo-list-label">搜索全部已载入${label}<input id="ypo-list-search" type="search" maxlength="200" autocomplete="off"></label><div id="ypo-list-body"></div>`);
      const host=document.querySelector('#ypo-list-body'),input=document.querySelector('#ypo-list-search');
      function render(){
        const filtered=data.rows.filter(r=>r.key.toLowerCase().includes(query.toLowerCase())),pages=Math.max(1,Math.ceil(filtered.length/100));page=Math.min(page,pages-1);
        const rows=filtered.slice(page*100,page*100+100);
        host.innerHTML=`<p class="ypo-explanation">匹配 ${n(filtered.length)} 项 · 第 ${page+1} / ${pages} 页</p><div class="table-wrap"><table><thead><tr><th>${label}</th><th>查询次数</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td><button type="button" class="ob-link ypo-list-item" data-ypo-index="${i}">${e(r.key)}</button></td><td>${n(r.count)}</td></tr>`).join('')||'<tr><td colspan="2">没有匹配的条目</td></tr>'}</tbody></table></div><div class="ypo-list-pagination"><button class="glass-btn" id="ypo-list-prev" ${page===0?'disabled':''}>上一页</button><button class="glass-btn" id="ypo-list-next" ${page>=pages-1?'disabled':''}>下一页</button></div>`;
        host.querySelectorAll('[data-ypo-index]').forEach(b=>b.onclick=()=>onSelect(rows[Number(b.dataset.ypoIndex)].key));
        host.querySelector('#ypo-list-prev').onclick=()=>{page--;render();};host.querySelector('#ypo-list-next').onclick=()=>{page++;render();};
      }
      input.oninput=()=>{query=input.value;page=0;render();};render();
    }
  }
  window.YoPilotOverview={prepare,service,statistics,quality,bind};
})();
