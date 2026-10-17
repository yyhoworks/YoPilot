/* Scheme A: refined telemetry table with a scoped upstream-share overview. */
(() => {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const n = (v, digits = 0) => finite(v)
    ? v.toLocaleString('zh-CN', { maximumFractionDigits: digits })
    : '—';
  const protocol = addr => ({
    https: 'DoH', tls: 'DoT', quic: 'DoQ', h3: 'DoH3', udp: 'UDP', tcp: 'TCP'
  }[String(addr).split('://')[0]] || 'DNS');
  const P = window.YoPilotPresentation;

  function hostLabel(addr) {
    const value = String(addr || '');
    try {
      const parsed = new URL(value);
      return parsed.host || value;
    } catch {
      return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0] || value;
    }
  }

  function toneFor(plugin) {
    const tag = String(plugin?.tag || '').toLowerCase();
    if (tag.includes('fake')) return 'fake';
    if (tag.includes('local')) return 'local';
    if (tag.includes('ecs')) return 'ecs';
    if (tag.includes('foreign') || tag.includes('overseas')) return 'foreign';
    if (tag.includes('cn') || tag.includes('domestic')) return 'cn';
    const definition = window.YoPilotPathModel?.definitions?.find(d => d.strategies?.includes(plugin?.tag));
    return definition?.tone === 'domestic' ? 'cn'
      : definition?.tone === 'overseas' ? 'foreign'
        : definition?.tone === 'fake' ? 'fake'
          : definition?.tone === 'network' ? 'local' : 'local';
  }

  function nodeMarkup(plugin) {
    const nodes = Array.isArray(plugin?.args?.upstreams) ? plugin.args.upstreams : [];
    if (!nodes.length) return '<span class="ypq-note">未配置 DNS 目标</span>';
    return nodes.map((node, index) => {
      const addr = typeof node === 'string' ? node : node?.addr || '';
      const title = P.upstream(node, index);
      return '<span class="ypq-node" title="' + esc(addr) + '"><b>' + protocol(addr) + '</b>' + esc(title) + ' <span class="ypq-node-host">' + esc(hostLabel(addr)) + '</span><span class="sr-only"> ' + esc(addr) + '</span></span>';
    }).join('');
  }

  function counterMarkup(label, value, stateClass) {
    const active = finite(value) && value > 0;
    return '<span class="ypq-counter-pill ' + (active ? stateClass : '') + '">' + label + ' <strong>' + n(value) + '</strong></span>';
  }

  function shareOverview(rows, total) {
    const available = finite(total);
    const segments = available && total > 0
      ? rows.filter(r => finite(r.calls) && r.calls > 0).map(r => {
        const share = r.calls / total;
        return '<span class="ypq-stacked-seg ypq-tone-' + toneFor(r.p) + '" style="width:' + (share * 100).toFixed(2) + '%" title="' + esc(P.name(r.p)) + '：' + n(r.calls) + ' (' + n(share * 100, 1) + '%)"></span>';
      }).join('')
      : '';
    const legend = rows.map(r => {
      const share = available && total > 0 && finite(r.calls) ? r.calls / total : null;
      return '<span class="ypq-legend-item ypq-tone-' + toneFor(r.p) + '"><i class="ypq-dot" aria-hidden="true"></i><span>' + esc(P.name(r.p)) + '</span><b>' + (share === null ? '—' : n(share * 100, 1) + '%') + '</b><small>(' + n(r.calls) + ')</small></span>';
    }).join('');
    return '<div class="ypq-share-overview"><div class="ypq-share-head"><span>转发组节点请求分布（本表累计 <strong>' + (available ? n(total) : '—') + '</strong> 次节点查询）</span><span>并发组会同时访问多个节点 · 无样本不标为正常或离线</span></div><div class="ypq-stacked-bar" aria-label="转发组节点请求份额">' + segments + '</div><div class="ypq-share-legend">' + legend + '</div></div>';
  }

  window.YoPilotOverview.quality = function(view) {
    const rows = Array.isArray(view?.upstreams) ? view.upstreams : [];
    const total = rows.length && rows.every(r => finite(r.calls))
      ? rows.reduce((sum, r) => sum + r.calls, 0) : null;
    const maximum = Math.max(1, ...rows.map(r => finite(r.average) ? r.average : 0));

    if (!rows.length) {
      return '<section class="card ob-panel ypo-quality"><div class="card-header"><div><h2>上游解析质量</h2><p class="gc-sub">本次进程累计 · 请求份额与耗时横向对比 · 点击解析组查看完整参数</p></div><button class="glass-btn small" data-route="upstreams">管理上游</button></div><p class="ypo-quality-note">未配置 forward 转发组。</p></section>';
    }

    const body = rows.map(r => {
      const p = r.p || {};
      const share = finite(total) && total > 0 && finite(r.calls) ? r.calls / total : null;
      const shareWidth = share === null ? 0 : Math.max(2, share * 100);
      const latencyWidth = finite(r.average) ? Math.max(2.5, (r.average / maximum) * 100) : 0;
      const tone = toneFor(p);
      return '<tr class="ypq-tone-' + tone + '"><td><div class="ypq-group-head"><button class="ob-link" data-ob-plugin="' + esc(p.tag) + '">' + esc(P.name(p)) + '</button><span class="badge">' + esc(window.YoPilotPathModel.policy(p)) + '</span><code>' + esc(p.tag) + '</code></div><div class="ypq-nodes">' + nodeMarkup(p) + '</div></td><td><div class="ypq-metric-line"><span class="ypq-metric-main"><strong>' + n(r.calls) + '</strong><span class="ypq-metric-unit">次</span></span><span class="ypq-metric-side">' + (share === null ? '暂无份额' : n(share * 100, 1) + '%') + '</span></div><div class="ypq-bar"><span style="width:' + shareWidth + '%"></span></div></td><td><div class="ypq-metric-line"><span class="ypq-metric-main ' + (finite(r.average) ? '' : 'is-empty') + '"><strong>' + (finite(r.average) ? n(r.average, 1) : '暂无样本') + '</strong>' + (finite(r.average) ? '<span class="ypq-metric-unit">ms</span>' : '') + '</span><span class="ypq-metric-side">' + n(r.responses) + ' 次样本</span></div><div class="ypq-bar is-latency"><span style="width:' + latencyWidth + '%"></span></div></td><td><div class="ypq-counter-pills">' + counterMarkup('错误', r.errors, 'has-error') + counterMarkup('超时', r.timeouts, 'has-timeout') + '</div></td></tr>';
    }).join('');

    return '<section class="card ob-panel ypo-quality"><div class="card-header"><div><h2>上游解析质量</h2><p class="gc-sub">本次进程累计 · 请求份额与耗时横向对比 · 点击解析组查看完整参数</p></div><button class="glass-btn small" data-route="upstreams">管理上游</button></div>' + shareOverview(rows, total) + '<div class="table-wrap"><table class="ypq-refined-table"><thead><tr><th>解析组 / 具名 DNS 目标</th><th>上游请求与份额 <small>节点查询量</small></th><th>节点响应平均 <small>相对本表最大均值</small></th><th>累计错误 / 超时</th></tr></thead><tbody>' + body + '</tbody></table></div><p class="ypo-quality-note">份额分母是本表所有转发组的节点请求数，不是客户端请求数。并发会同时查询多个节点；错误与超时可能重叠，不相加计算失败率。无样本不标为正常或离线。</p></section>';
  };
})();
