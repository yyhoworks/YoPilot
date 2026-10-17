/* Scheme B: comparable metrics, not invented online/health judgements. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=(x,d=0)=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('zh-CN',{maximumFractionDigits:d}):'—';
  const P=window.YoPilotPresentation;
  const protocol=addr=>({https:'DoH',tls:'DoT',quic:'DoQ',h3:'DoH3',udp:'UDP',tcp:'TCP'})[String(addr).split('://')[0]]||'DNS';
  window.YoPilotOverview.quality=function(view){
    const rows=view.upstreams,total=rows.every(r=>r.calls!==null)?rows.reduce((s,r)=>s+r.calls,0):null;
    const maximum=Math.max(1,...rows.map(r=>r.average??0));
    return `<section class="card ob-panel ypo-quality"><div class="card-header"><div><h2>上游解析质量</h2><p class="gc-sub">本次进程累计 · 请求份额与耗时横向对比 · 点击解析组查看完整参数</p></div><button class="glass-btn small" data-route="upstreams">管理上游</button></div>${rows.length?`<div class="table-wrap"><table class="ypq-table"><thead><tr><th>解析组 / 具名 DNS 目标</th><th>上游请求与份额</th><th>节点响应平均</th><th>累计错误 / 超时</th></tr></thead><tbody>${rows.map(r=>{
      const p=r.p,nodes=Array.isArray(p.args?.upstreams)?p.args.upstreams:[],share=total>0&&r.calls!==null?r.calls/total:null;
      return `<tr><td><div class="ypq-top"><button class="ob-link" data-ob-plugin="${esc(p.tag)}">${esc(P.name(p))}</button><span class="badge">${esc(window.YoPilotPathModel.policy(p))}</span><code>${esc(p.tag)}</code></div><div class="ypq-nodes">${nodes.map((u,i)=>{const addr=typeof u==='string'?u:u.addr||'',title=P.upstream(u,i);return `<span class="ypq-node" title="${esc(addr)}"><b>${protocol(addr)}</b>${esc(title)}<span class="sr-only"> ${esc(addr)}</span></span>`;}).join('')||'<span class="ypq-note">未配置 DNS 目标</span>'}</div></td><td><div class="ypq-value"><strong>${n(r.calls)}</strong><small>${share===null?'暂无份额':n(share*100,1)+'%'}</small></div><div class="ypq-track"><span style="width:${share===null?0:share*100}%"></span></div><small>节点查询量 · 并发可能重复计数</small></td><td><div class="ypq-value"><strong>${r.average===null?'暂无样本':n(r.average,1)}</strong><small>${r.average===null?'':'ms'}</small></div><div class="ypq-track ypq-latency"><span style="width:${r.average===null?0:r.average/maximum*100}%"></span></div><small>${n(r.responses)} 次耗时样本 · 相对本表最大均值</small></td><td><div class="ypq-note">错误 <strong>${n(r.errors)}</strong> 次<br>超时 <strong>${n(r.timeouts)}</strong> 次</div><small>累计计数，不等同当前离线</small></td></tr>`;
    }).join('')}</tbody></table></div><p class="ypo-quality-note">份额分母是本表所有转发组的节点请求数，不是客户端请求数。并发会同时查询多个节点；错误与超时可能重叠，不相加计算失败率。无样本不标为正常或离线。</p>`:'<p class="ypo-quality-note">未配置 forward 转发组。</p>'}</section>`;
  };
})();
