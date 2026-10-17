
    (() => {
      'use strict';
      const $ = (s, r = document) => r.querySelector(s);
      const $$ = (s, r = document) => [...r.querySelectorAll(s)];
      const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
      const num = v => Number.isFinite(+v) ? (+v).toLocaleString('zh-CN') : '—';
      const compactNum = v => {
        const n = +v;
        if (!Number.isFinite(n)) return '—';
        if (Math.abs(n) < 10000) return n.toLocaleString('zh-CN');
        return new Intl.NumberFormat('zh-CN', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(n);
      };

      const icons = {
        overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/></svg>',
        logs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
        upstream: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
        rules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
        management: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
        refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/></svg>',
        theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        uptime: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2h6M12 10v4l2.5 2.5"/><circle cx="12" cy="13" r="8"/></svg>',
        cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
        memory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M12 10v4M17 10v4"/></svg>'
      };

      /* ── 演示状态与真实结构数据 (UI 2026.10.16.3 / 原型) ── */
      const state = {
        route: 'overview',
        particles: true,
        shortcutsOpen: true,
        clientMode: 'all',
        coreCache: true,
        lazyCache: true,
        adguardEnabled: true,
        chartMinutes: 30,
        rankTab: 'client',
        ruleTab: 'lists',
        ruleTag: 'whitelist',
        drafts: {},
        aliases: {
          '192.0.2.10': 'MacBook-Pro-Studio',
          '192.0.2.22': 'iPhone-16-Pro',
          '192.0.2.56': 'LivingRoom-AppleTV',
          '192.0.2.88': 'HomeLab-NAS'
        },
        clients: [
          { key: '192.0.2.10', count: 46820 },
          { key: '192.0.2.22', count: 31450 },
          { key: '192.0.2.56', count: 22190 },
          { key: '192.0.2.88', count: 16420 },
          { key: '192.0.2.105', count: 6840 },
          { key: '192.0.2.118', count: 4920 }
        ],
        domains: [
          { key: 'api.anthropic.com', count: 8420 },
          { key: 'claude.ai', count: 6390 },
          { key: 'gateway.icloud.com', count: 5180 },
          { key: 'wx.qlogo.cn', count: 4610 },
          { key: 'cdn.jsdelivr.net', count: 3890 },
          { key: 'github.com', count: 3420 },
          { key: 'bilibili.com', count: 2980 },
          { key: 'doubleclick.net', count: 2186 }
        ],
        slowest: [
          { query_name: 'registry-1.docker.io', types: ['A', 'AAAA', 'HTTPS'], client_ip: '192.0.2.88', duration_ms: 342.6 },
          { query_name: 'edge-chat.instagram.com', types: ['A', 'AAAA'], client_ip: '192.0.2.22', duration_ms: 128.4 },
          { query_name: 'api.github.com', types: ['A', 'HTTPS'], client_ip: '192.0.2.10', duration_ms: 64.2 },
          { query_name: 'play.googleapis.com', types: ['AAAA'], client_ip: '192.0.2.56', duration_ms: 48.9 }
        ],
        upstreams: [
          { group: 'domestic', tag: '阿里 DoH 主节点', protocol: 'https', addr: 'https://223.5.5.5/dns-query', latency: 8.4, q: 52410, win: 34820, err: 0, success: 100.0, enabled: true, reasons: [] },
          { group: 'domestic', tag: '腾讯 DNSPod', protocol: 'udp', addr: '119.29.29.29:53', latency: 11.2, q: 52410, win: 17590, err: 2, success: 99.96, enabled: true, reasons: [{ label: 'Timeout', value: 2 }], lastError: '19:42:18' },
          { group: 'foreign', tag: 'Cloudflare DoH', protocol: 'https', addr: 'https://1.1.1.1/dns-query', latency: 31.6, q: 26840, win: 19420, err: 1, success: 99.99, enabled: true, reasons: [{ label: 'EOF / Reset', value: 1 }], lastError: '18:15:04' },
          { group: 'foreign_ecs', tag: 'Google DoT (ECS)', protocol: 'tls', addr: 'tls://8.8.8.8:853', latency: 36.8, q: 11260, win: 9840, err: 3, success: 99.97, enabled: true, reasons: [{ label: 'TLS', value: 2 }, { label: 'Timeout', value: 1 }], lastError: '20:11:32' },
          { group: 'proxy', tag: 'Remote Sing-Box DNS', protocol: 'https', addr: 'https://dns.google/dns-query (SOCKS5)', latency: 44.2, q: 6490, win: 6490, err: 0, success: 100.0, enabled: true, reasons: [] },
          { group: 'domestic', tag: '运营商备用 DNS', protocol: 'udp', addr: '114.114.114.114:53', latency: 0, q: 0, win: 0, err: 0, success: 100.0, enabled: false, reasons: [] }
        ],
        logs: [
          { query_time: '2026-10-16 20:34:58', query_name: 'api.anthropic.com', query_type: 'HTTPS', domain_set: 'default_forward', duration_ms: 0.62, client_ip: '192.0.2.10', response_code: 'NOERROR', trace_id: 'tr-9841a', answers: [{ type: 'HTTPS', ttl: 240, data: 'alpn="h2,h3" ipv4hint=160.79.104.10' }] },
          { query_time: '2026-10-16 20:34:55', query_name: 'claude.ai', query_type: 'A', domain_set: 'fallback', duration_ms: 0.38, client_ip: '192.0.2.10', response_code: 'NOERROR', trace_id: 'tr-9840b', answers: [{ type: 'A', ttl: 60, data: '198.18.0.42 (FakeIP)' }] },
          { query_time: '2026-10-16 20:34:51', query_name: 'wx.qlogo.cn', query_type: 'A', domain_set: 'cn_domains', duration_ms: 8.40, client_ip: '192.0.2.22', response_code: 'NOERROR', trace_id: 'tr-9839c', answers: [{ type: 'A', ttl: 600, data: '113.96.232.108' }] },
          { query_time: '2026-10-16 20:34:47', query_name: 'telemetry.doubleclick.net', query_type: 'A', domain_set: 'adguard_block', duration_ms: 0.14, client_ip: '192.0.2.56', response_code: 'NXDOMAIN', trace_id: 'tr-9838d', answers: [] },
          { query_time: '2026-10-16 20:34:42', query_name: 'cdn.jsdelivr.net', query_type: 'AAAA', domain_set: 'whitelist', duration_ms: 0.51, client_ip: '192.0.2.88', response_code: 'NOERROR', trace_id: 'tr-9837e', answers: [{ type: 'AAAA', ttl: 300, data: '2606:4700::6810:5514' }] },
          { query_time: '2026-10-16 20:34:36', query_name: 'github.com', query_type: 'A', domain_set: 'default_forward', duration_ms: 31.50, client_ip: '192.0.2.10', response_code: 'NOERROR', trace_id: 'tr-9836f', answers: [{ type: 'A', ttl: 120, data: '20.205.243.166' }] }
        ],
        ruleTexts: {
          whitelist: '# OxiDNS 白名单规则 (一行一条，强制走国内直连解析)\napple.com\nicloud.com\ncdn.jsdelivr.net\nmicrosoft.com\nntp.aliyun.com',
          blocklist: '# OxiDNS 黑名单规则 (直接阻断返回 NXDOMAIN)\nad.toutiao.com\ntracking.miui.com\nlog.tbs.qq.com',
          greylist: '# 灰名单规则 (强制走代理解析组)\nanthropic.com\nclaude.ai\nopenai.com\ngithub.com',
          force_realip: '# 强制 RealIP 域名\nsteamcontent.com\nakamaized.net\npsn.net',
          ddns_domains: 'home.example.com\nnas.example.net',
          pcdn_domains: 'szbdyd.com\nxycdn.com\nmcdn.bilivideo.cn',
          pcdn_regex_v4: '^180\\.163\\..*',
          pcdn_regex_v6: '^240e:978:.*',
          client_ip: '192.0.2.10\n192.0.2.22',
          direct_ip: '223.5.5.5\n119.29.29.29',
          rewrite: 'router.lan 192.0.2.1\nnas.lan 192.0.2.88'
        },
        switches: {
          switch1: true, switch5: true, switch7: true, switch6: false,
          switch13: true, switch4: true, switch2: false, switch12: false
        }
      };

      function toast(message, detail = '') {
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = `<div><strong>${esc(message)}</strong>${detail ? `<div class="toast-info">${esc(detail)}</div>` : ''}</div>`;
        $('#toast-stack').appendChild(el);
        setTimeout(() => el.remove(), 3000);
      }
      window.toast = toast;

      /* ── 数字与单位分层 + 滚动动效 (100% 还原 2026.10.16.3 修复) ── */
      function formatDisplayNumerals(root = document) {
        $$('.console-kpi .sk-val, .tec-big, .ring-center, .service-value[data-display-number]', root).forEach(el => {
          if (el.querySelector('.display-number')) return;
          const value = el.textContent.trim();
          const match = value.match(/^([+\-]?\d[\d,.]*)(\s*(?:%|ms|s|KB|MB|GB|TB|万|亿))?$/);
          if (!match) return;
          const number = document.createElement('span');
          number.className = 'display-number';
          number.textContent = match[1];
          el.replaceChildren(number);
          if (match[2]) {
            const unit = document.createElement('span');
            unit.className = 'display-unit';
            unit.textContent = match[2].trim();
            el.append(unit);
          }
        });
      }

      function animateCountUps(root = document) {
        formatDisplayNumerals(root);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        $$('.console-kpi .sk-val', root).forEach(el => {
          const numEl = el.querySelector('.display-number');
          if (!numEl) return;
          const numText = numEl.textContent.trim();
          const target = parseFloat(numText.replace(/,/g, ''));
          if (!isFinite(target) || target <= 0) return;
          const decimals = (numText.split('.')[1] || '').length;
          const grouped = numText.includes(',');
          const fmt = v => {
            const n = decimals ? Number(v.toFixed(decimals)) : Math.round(v);
            return grouped ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals);
          };
          const t0 = performance.now(), dur = 480;
          const step = now => {
            if (!numEl.isConnected) return;
            const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
            numEl.textContent = fmt(target * e);
            if (k < 1) requestAnimationFrame(step);
            else numEl.textContent = numText;
          };
          requestAnimationFrame(step);
        });
      }

      /* ── 拓扑流光与居中曲线绘制 (UI 2026.10.16.1 五列几何 + .3 流光示意) ── */
      let flowDispose = null;
      function stopTopoFlow() {
        if (flowDispose) { flowDispose(); flowDispose = null; }
      }

      function getNodeIcon(type, color = 'currentColor') {
        const map = {
          monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
          server: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><circle cx="7" cy="7" r="1" fill="${color}"/><circle cx="7" cy="17" r="1" fill="${color}"/></svg>`,
          dots: `<svg viewBox="0 0 24 24" fill="${color}" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>`,
          globe: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
          check: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
          split: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7M6 8.5V12a6 6 0 0 0 6 6h3.5"/></svg>`,
          spark: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" aria-hidden="true"><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/></svg>`,
          shield: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V7l-8-4Z"/></svg>`,
          shieldRed: `<svg viewBox="0 0 24 24" fill="none" stroke="var(--crimson)" stroke-width="1.9" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V7l-8-4Z"/></svg>`,
          sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" aria-hidden="true"><path d="M4 8h9m4 0h3M13 6v4M4 16h3m4 0h9M7 14v4"/></svg>`
        };
        return map[type] || map.monitor;
      }

      function drawTopoCurves(edges) {
        const wrap = $('#topo-stage-wrap');
        const svg = $('#topo-svg');
        if (!wrap || !svg) return;
        stopTopoFlow();

        const wrapRect = wrap.getBoundingClientRect();
        if (!wrapRect.width || !wrapRect.height) return;
        svg.setAttribute('viewBox', `0 0 ${wrapRect.width} ${wrapRect.height}`);

        let pathsHtml = '', dotsHtml = '';
        const dotSet = new Set();
        const addDot = (x, y, color) => {
          const key = `${Math.round(x)},${Math.round(y)}`;
          if (dotSet.has(key)) return;
          dotSet.add(key);
          dotsHtml += `<circle class="topo-dot-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" /><circle class="topo-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" fill="${color}" />`;
        };

        edges.forEach((edge, i) => {
          const fromEl = wrap.querySelector(`[data-node-id="${edge.from}"]`);
          const toEl = wrap.querySelector(`[data-node-id="${edge.to}"]`);
          if (!fromEl || !toEl) return;
          const r1 = fromEl.getBoundingClientRect(), r2 = toEl.getBoundingClientRect();
          const x1 = r1.right - wrapRect.left, y1 = r1.top + r1.height / 2 - wrapRect.top;
          const x2 = r2.left - wrapRect.left, y2 = r2.top + r2.height / 2 - wrapRect.top;
          const dx = (x2 - x1) * 0.54;
          const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
          if (!edge.muted) {
            pathsHtml += `<path class="topo-halo" data-edge-idx="${i}" d="${d}" stroke="${edge.color}" />`;
            pathsHtml += `<path class="topo-glow" data-edge-idx="${i}" d="${d}" stroke="${edge.color}" />`;
          }
          pathsHtml += `<path class="topo-edge ${edge.muted ? 'is-muted' : ''}" data-edge-idx="${i}" d="${d}" stroke="${edge.color}" />`;
          addDot(x1, y1, edge.color);
          addDot(x2, y2, edge.color);
        });
        svg.innerHTML = pathsHtml + dotsHtml;

        const nodes = $$('.t-node', wrap);
        const applyTraceState = (startId = null) => {
          const activeNodes = new Set(startId ? [startId] : []);
          const activeEdges = new Set();
          for (const upstream of [true, false]) {
            const queue = startId ? [startId] : [];
            while (queue.length) {
              const cur = queue.shift();
              edges.forEach((edge, idx) => {
                if ((upstream ? edge.to : edge.from) !== cur) return;
                const next = upstream ? edge.from : edge.to;
                activeEdges.add(idx);
                if (!activeNodes.has(next)) { activeNodes.add(next); queue.push(next); }
              });
            }
          }
          wrap.classList.toggle('has-hover', Boolean(startId));
          nodes.forEach(n => n.classList.toggle('is-active', activeNodes.has(n.dataset.nodeId)));
          $$('[data-edge-idx]', svg).forEach(el => el.classList.toggle('is-active', activeEdges.has(+el.dataset.edgeIdx)));
        };

        nodes.forEach(node => {
          node.onmouseenter = () => applyTraceState(node.dataset.nodeId);
          node.onmouseleave = () => applyTraceState(null);
          node.onfocus = () => applyTraceState(node.dataset.nodeId);
          node.onblur = () => applyTraceState(null);
        });

        /* 启动路径流光粒子示意（仅在非虚线活跃路径上游走） */
        if (state.particles && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          startTopoFlow(wrap, svg, edges);
        }
      }

      function startTopoFlow(wrap, svg, edges) {
        const paths = new Map();
        const outgoing = new Map();
        edges.forEach((edge, idx) => {
          if (edge.muted) return;
          const path = svg.querySelector(`.topo-edge[data-edge-idx="${idx}"]`);
          if (!path) return;
          paths.set(idx, path);
          if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
          outgoing.get(edge.from).push({ ...edge, index: idx });
        });
        const starts = [...outgoing.keys()].filter(id => /^c\d+$/.test(id));
        if (!starts.length) return;
        const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        cursor.setAttribute('class', 'topo-cursor');
        cursor.setAttribute('r', '3.3');
        cursor.style.opacity = '0';
        svg.append(cursor);

        let frame = 0, disposed = false, hops = [], hopIdx = 0, started = null, restUntil = 0;
        const clear = () => {
          cursor.style.opacity = '0';
          $$('.is-flow', svg).forEach(el => el.classList.remove('is-flow'));
          $$('.is-pulse', wrap).forEach(el => el.classList.remove('is-pulse'));
          hops = []; hopIdx = 0; started = null; restUntil = 0;
        };
        const pickPath = () => {
          let node = starts[Math.floor(Math.random() * starts.length)];
          const res = [];
          for (let i = 0; i < 6; i++) {
            const choices = outgoing.get(node) || [];
            if (!choices.length) break;
            const edge = choices[Math.floor(Math.random() * choices.length)];
            res.push(edge);
            node = edge.to;
          }
          return res;
        };
        const pulse = id => {
          $$('.is-pulse', wrap).forEach(el => el.classList.remove('is-pulse'));
          wrap.querySelector(`[data-node-id="${id}"]`)?.classList.add('is-pulse');
        };
        const tick = now => {
          if (disposed || !wrap.isConnected) return;
          if (!state.particles || wrap.classList.contains('has-hover')) {
            clear();
            frame = requestAnimationFrame(tick);
            return;
          }
          if (restUntil) {
            if (now < restUntil) { frame = requestAnimationFrame(tick); return; }
            clear();
          }
          if (!hops.length) { hops = pickPath(); if (!hops.length) return; }
          const hop = hops[hopIdx], path = paths.get(hop.index);
          if (started === null) {
            started = now;
            pulse(hop.from);
            $$(`[data-edge-idx="${hop.index}"]`, svg).forEach(el => el.classList.add('is-flow'));
          }
          const progress = Math.min(1, (now - started) / 540);
          const pt = path.getPointAtLength(path.getTotalLength() * progress);
          cursor.setAttribute('cx', pt.x.toFixed(1));
          cursor.setAttribute('cy', pt.y.toFixed(1));
          cursor.style.opacity = '1';
          if (progress === 1) {
            started = null;
            hopIdx++;
            if (hopIdx === hops.length) {
              pulse(hop.to);
              cursor.style.opacity = '0';
              restUntil = now + 1100;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        flowDispose = () => { disposed = true; cancelAnimationFrame(frame); clear(); cursor.remove(); };
      }

      /* ── 页面 1：运行概览 (Overview) ── */
      function renderOverview() {
        const page = $('#page-content');
        const sparkPaths = [
          'M2,24 L18,21 L34,22 L50,15 L66,17 L82,10 L98,7',
          'M2,12 L18,10 L34,11 L50,9 L66,8 L82,9 L98,7',
          'M2,20 L18,20 L34,16 L50,16 L66,12 L82,12 L98,10',
          'M2,26 L18,24 L34,25 L50,19 L66,21 L82,16 L98,14',
          'M2,14 L18,18 L34,12 L50,15 L66,11 L82,13 L98,10',
          'M2,25 L18,22 L34,19 L50,17 L66,14 L82,11 L98,8'
        ];

        const topoClients = [
          { id: 'c1', ip: '192.0.2.10', muted: false, name: 'MacBook-Pro-Studio', sub: '192.0.2.10 · 4.7万 次', val: '61%', valColor: 'var(--accent)', icon: 'monitor' },
          { id: 'c2', ip: '192.0.2.22', muted: false, name: 'iPhone-16-Pro', sub: '192.0.2.22 · 3.1万 次', val: '26%', valColor: 'var(--text-1)', icon: 'monitor' },
          { id: 'c3', ip: '192.0.2.56', muted: false, name: 'LivingRoom-AppleTV', sub: '192.0.2.56 · 1.6万 次', val: '13%', valColor: 'var(--text-1)', icon: 'monitor' },
          { id: 'c4', ip: '192.0.2.88', muted: true,  name: 'HomeLab-NAS', sub: '192.0.2.88 · 0 次', val: '0%', valColor: 'var(--text-3)', icon: 'server' },
          { id: 'c5', ip: '',              muted: true,  name: '局域网其余终端', sub: 'LAN 子网监听中 (:53)', val: '就绪', valColor: 'var(--text-2)', icon: 'dots' }
        ];

        const draft=OxiEngine.config();
        const cachePlugins=draft.plugins.filter(p=>p.type==='cache');
        const providers=draft.plugins.filter(p=>OxiEngine.catalog.find(d=>d.kind===p.type)?.type==='provider');
        const forwards=draft.plugins.filter(p=>p.type==='forward');
        const topoRules=providers.map((p,i)=>({id:'r'+i,tab:'rules',name:p.tag,sub:OxiEngine.label(p.type)+' · '+p.type,val:'',color:'var(--sage)',icon:'split'}));
        const topoGroups=forwards.map((p,i)=>({id:'g'+i,code:'DNS',color:i?'var(--slate)':'var(--sage)',bg:i?'var(--slate-soft)':'var(--sage-soft)',name:p.tag,sub:'forward · '+(p.args?.upstreams?.length||0)+' 个上游'}));
        const topoServers=forwards.flatMap((p,i)=>(p.args?.upstreams||[]).map((u,j)=>({id:'s'+i+'_'+j,groupNode:'g'+i,name:typeof u==='string'?u:(u.tag||p.tag),sub:typeof u==='string'?u:u.addr,badge:'草稿',color:'var(--sage)',bg:'var(--sage-soft)',icon:'server'})));
        const topoEdges=[...topoClients.map(c=>[c.id,'e_core']),...topoRules.map(r=>['e_core',r.id]),...topoGroups.map(g=>['e_core',g.id]),...topoServers.map(s=>[s.groupNode,s.id])].map(([from,to])=>({from,to,color:'var(--accent)',muted:false}));

        const rankList = (state.rankTab === 'client' ? state.clients : state.domains).slice(0, 4);
        const rankMax = Math.max(1, ...rankList.map(x => x.count));
        const curSkin = document.documentElement.dataset.skin || 'claude';

        page.innerHTML = `
          <div class="view-title-row">
            <div>
              <h1>运行概览</h1>
              <span class="gc-sub">请求、解析路径与缓存运行概况 · 当前显示示例数据</span>
            </div>
          </div>

          <!-- 1. 服务健康与 6 大核心指标总览 (.console-service-summary) -->
          <section class="console-service-summary" aria-labelledby="service-summary-title">
            <div class="console-service-row">
              <div class="console-service-health">
                <span class="service-health-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8 5.5-5.5"/></svg>
                </span>
                <div class="service-health-copy">
                  <div class="service-health-title"><h2 id="service-summary-title">DNS 服务状态</h2><span class="service-connection">示例 · 未连接</span></div>
                  <p class="service-build mono">OxiDNS · 运行数据待接入</p>
                </div>
              </div>
              <div class="service-metric" data-service-metric="start">
                <div class="service-metric-label"><span>启动时间</span>${icons.clock}</div>
                <div class="service-value service-start-value">2026-10-16 08:14</div>
              </div>
              <div class="service-metric" data-service-metric="uptime">
                <div class="service-metric-label"><span>运行时长</span>${icons.uptime}</div>
                <div class="service-value service-uptime-value">
                  <span class="overview-duration-part"><span class="overview-duration-num">12</span><span class="overview-duration-unit">小时</span></span>
                  <span class="overview-duration-part"><span class="overview-duration-num">21</span><span class="overview-duration-unit">分钟</span></span>
                </div>
              </div>
              <div class="service-metric" data-service-metric="cpu">
                <div class="service-metric-label"><span>进程 CPU</span>${icons.cpu}</div>
                <div class="service-value" data-display-number>0.4%</div>
              </div>
              <div class="service-metric" data-service-metric="memory">
                <div class="service-metric-label"><span>内存占用</span>${icons.memory}</div>
                <div class="service-value" data-display-number>41.8 MB</div>
              </div>
            </div>

            <!-- 6 张微趋势指标卡 -->
            <div class="console-kpi">
              <div class="spark-kpi-card" data-route="queries">
                <div class="sk-top"><span class="sk-title">累计请求</span><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 3v14m0 0-4-4m4 4 4-4M4 21h16"/></svg></div>
                <div class="sk-bottom">
                  <div class="sk-val tabular">128,640</div>
                  <svg class="sk-chart" viewBox="0 0 100 32"><path d="${sparkPaths[0]}" fill="none" stroke="var(--accent)" stroke-width="1.8"/></svg>
                </div>
                <div class="sk-note">${state.coreCache ? '缓存命中占 86.42%' : '核心缓存已关闭'}</div>
              </div>
            </div>

            <div class="console-kpi">
              <div class="spark-kpi-card" data-route="response">
                <div class="sk-top"><span class="sk-title">缓存命中</span><svg viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="2"><path d="M12 21V7m0 0-4 4m4-4 4 4M4 3h16"/></svg></div>
                <div class="sk-bottom">
                  <div class="sk-val tabular">${state.coreCache ? '86.42%' : '已关闭'}</div>
                  <svg class="sk-chart" viewBox="0 0 100 32"><path d="${sparkPaths[1]}" fill="none" stroke="var(--sage)" stroke-width="1.8"/></svg>
                </div>
                <div class="sk-note">${cachePlugins.length} 个缓存实例</div>
              </div>
            </div>

            <div class="console-kpi">
              <div class="spark-kpi-card" id="kpi-card-clients">
                <div class="sk-top"><span class="sk-title">客户端数</span><svg viewBox="0 0 24 24" fill="none" stroke="var(--slate)" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M3 19c0-3 2.8-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/></svg></div>
                <div class="sk-bottom">
                  <div class="sk-val tabular">24</div>
                  <svg class="sk-chart" viewBox="0 0 100 32"><path d="${sparkPaths[2]}" fill="none" stroke="var(--slate)" stroke-width="1.8"/></svg>
                </div>
                <div class="sk-note">活跃来源 IP · 点击配别名</div>
              </div>
            </div>

            <div class="console-kpi">
              <div class="spark-kpi-card" data-route="rules">
                <div class="sk-top"><span class="sk-title">拦截请求</span><svg viewBox="0 0 24 24" fill="none" stroke="var(--crimson)" stroke-width="2"><path d="M12 3 4 7v5c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V7l-8-4Z"/></svg></div>
                <div class="sk-bottom">
                  <div class="sk-val tabular">2,186</div>
                  <svg class="sk-chart" viewBox="0 0 100 32"><path d="${sparkPaths[3]}" fill="none" stroke="var(--crimson)" stroke-width="1.8"/></svg>
                </div>
                <div class="sk-note">1.70% 的请求被拦截</div>
              </div>
            </div>

            <div class="console-kpi">
              <div class="spark-kpi-card" data-route="upstreams">
                <div class="sk-top"><span class="sk-title">平均响应</span><svg viewBox="0 0 24 24" fill="none" stroke="var(--ochre)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
                <div class="sk-bottom">
                  <div class="sk-val tabular" style="color:var(--ochre)">12.80 ms</div>
                  <svg class="sk-chart" viewBox="0 0 100 32"><path d="${sparkPaths[4]}" fill="none" stroke="var(--ochre)" stroke-width="1.8"/></svg>
                </div>
                <div class="sk-note">示例采样 · 未连接服务</div>
              </div>
            </div>

            <div class="console-kpi">
              <div class="spark-kpi-card" id="kpi-card-domains">
                <div class="sk-top"><span class="sk-title">域名统计</span><svg viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg></div>
                <div class="sk-bottom">
                  <div class="sk-val tabular">4,268</div>
                  <svg class="sk-chart" viewBox="0 0 100 32"><path d="${sparkPaths[5]}" fill="none" stroke="var(--sage)" stroke-width="1.8"/></svg>
                </div>
                <div class="sk-note">去重域名数 · 点击看排行</div>
              </div>
            </div>
          </section>

          <!-- 2. 快捷控制折叠面板 (.console-shortcuts) -->
          <details class="console-shortcuts" id="overview-shortcuts" ${state.shortcutsOpen ? 'open' : ''}>
            <summary><div><strong>快捷控制</strong><span>策略编排 / DNS 缓存 / 查询记录</span></div></summary>
            <div class="console-shortcut-grid">
              <div class="control-bar-card"><div class="cb-label">解析策略</div><div class="cb-right"><button class="glass-btn small" data-route="strategies">编辑策略</button><button class="glass-btn small" id="manage-alias">客户端别名</button></div></div>
              <div class="control-bar-card"><div class="cb-label">缓存与过期</div><div class="cb-right"><button class="glass-btn small" data-route="response">缓存配置</button><button class="glass-btn small" data-cache="${esc(cachePlugins[0]?.tag||'cache_main')}">查看条目</button></div></div>
              <div class="control-bar-card"><div class="cb-label">查询与运行</div><div class="cb-right"><button class="glass-btn small" data-route="queries">查询日志</button><button class="glass-btn small" data-route="logs">运行日志</button></div></div>
            </div>
          </details>

          <!-- 3. 查询吞吐趋势 (8列) + 分流结果占比 (4列) -->
          <div class="console-trend">
            <div class="glass-card" style="height:100%">
              <div class="gc-head">
                <div class="gc-title">查询吞吐趋势<span class="console-chart-sub">QPS · 示例采样 · 未连接服务</span></div>
                <div class="console-range">
                  <button type="button" data-chart-range="15" aria-pressed="${state.chartMinutes === 15}">15 分钟</button>
                  <button type="button" data-chart-range="30" aria-pressed="${state.chartMinutes === 30}">30 分钟</button>
                </div>
              </div>
              <div style="display:flex;gap:18px;font-size:12px;margin-bottom:8px;flex-wrap:wrap;color:var(--text-2)">
                <span style="display:flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:var(--accent)"></i>累计请求 <strong class="mono" style="color:var(--text-1)">128,640</strong></span>
                <span style="display:flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:var(--sage)"></i>缓存命中 <strong class="mono" style="color:var(--text-1)">111,170</strong></span>
                <span style="display:flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:var(--ochre)"></i>进程 CPU <strong class="mono" style="color:var(--text-1)">0.4%</strong></span>
                <span style="display:flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:var(--slate)"></i>常驻内存 <strong class="mono" style="color:var(--text-1)">41.8 MB</strong></span>
              </div>
              ${renderQpsChartSvg(state.chartMinutes)}
            </div>
          </div>

          <div class="console-donut">
            <div class="glass-card" style="height:100%">
              <div class="gc-head">
                <div class="gc-title">分流结果占比</div>
                <span class="gc-sub mono">按 domain_set 分类</span>
              </div>
              <div class="outbound-donut-body">
                <div class="ring-wrap">
                  <svg viewBox="0 0 42 42" width="124" height="124" aria-hidden="true">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--bg-subtle)" stroke-width="4.8"></circle>
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--sage)" stroke-width="4.8" stroke-dasharray="61 39" stroke-dashoffset="25"></circle>
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--accent)" stroke-width="4.8" stroke-dasharray="29 71" stroke-dashoffset="-36"></circle>
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--ochre)" stroke-width="4.8" stroke-dasharray="6 94" stroke-dashoffset="-65"></circle>
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--crimson)" stroke-width="4.8" stroke-dasharray="4 96" stroke-dashoffset="-71"></circle>
                  </svg>
                  <div class="ring-center">12.9万</div>
                </div>
                <div class="ring-legend">
                  <div class="rl-item"><span class="rl-name"><i class="rl-dot" style="background:var(--sage)"></i>cn_domains (国内)</span><span class="mono" style="color:var(--text-2)">7.8万</span><span class="mono" style="color:var(--text-3)">61%</span></div>
                  <div class="rl-item"><span class="rl-name"><i class="rl-dot" style="background:var(--accent)"></i>default_forward</span><span class="mono" style="color:var(--text-2)">3.8万</span><span class="mono" style="color:var(--text-3)">29%</span></div>
                  <div class="rl-item"><span class="rl-name"><i class="rl-dot" style="background:var(--ochre)"></i>回退解析</span><span class="mono" style="color:var(--text-2)">7,820</span><span class="mono" style="color:var(--text-3)">6%</span></div>
                  <div class="rl-item"><span class="rl-name"><i class="rl-dot" style="background:var(--crimson)"></i>黑名单与拦截</span><span class="mono" style="color:var(--text-2)">4,610</span><span class="mono" style="color:var(--text-3)">4%</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. UI 2026.10.16.1 / .3 五列 DNS 解析路径拓扑 (.console-topology) -->
          <div class="console-topology">
            <section class="glass-card topology-glass-card" aria-label="实时 DNS 解析与分流全链路拓扑" title="流光仅示意拓扑路径，不代表单条 DNS 查询记录">
              <div class="console-topology-heading">
                <h2>DNS 解析路径</h2>
                <span>选择节点查看详情 · 草稿实例结构示意 · 非真实执行轨迹</span>
              </div>
              <div class="topo-stage-wrap ${state.particles === false ? 'no-particles' : ''}" id="topo-stage-wrap">
                <svg class="topo-svg-overlay" id="topo-svg" aria-hidden="true"></svg>
                <div class="topo-grid">
                  <!-- 01 客户端来源 -->
                  <div class="topo-col" data-col="1">
                    <div class="topo-col-title"><span>01</span>客户端来源</div>
                    <div class="topo-col-body">
                      ${topoClients.map(c => `
                        <div class="t-node" tabindex="0" data-node-id="${c.id}" data-client-ip="${esc(c.ip)}">
                          <div class="tn-left">
                            <div class="tn-icon-box">${getNodeIcon(c.icon, 'var(--text-3)')}</div>
                            <div class="tn-meta">
                              <div class="tn-name">${esc(c.name)}</div>
                              <div class="tn-sub">${esc(c.sub)}</div>
                            </div>
                          </div>
                          <span class="tn-val" style="color:${c.valColor}">${esc(c.val)}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- 02 引擎与多级缓存 -->
                  <div class="topo-col" data-col="2">
                    <div class="topo-col-title"><span>02</span>引擎与多级缓存</div>
                    <div class="topo-col-body">
                      <div class="t-node t-engine-card" tabindex="0" data-node-id="e_core" data-route="response">
                        <div>
                          <div class="tec-top">
                            <span class="tec-big tabular">${state.coreCache ? '86.4%' : '—'}</span>
                            <span class="tec-badge">12.9万 请求</span>
                          </div>
                          <div class="tec-desc">多级内存缓存命中 · ${state.coreCache ? cachePlugins.length+' 个缓存实例' : '核心缓存已关闭'}</div>
                        </div>
                        <div class="tec-bars">
                          ${cachePlugins.map((p,i)=>`<div class="tec-bar-row"><span class="tec-bar-name">${esc(p.tag)}</span><div class="tec-bar-track"><div class="tec-bar-fill" style="width:86.4%"></div></div><span class="tec-bar-pct">示例</span></div>`).join('')||'<span class="gc-sub">草稿暂无缓存插件</span>'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 03 分流规则集 -->
                  <div class="topo-col" data-col="3">
                    <div class="topo-col-title"><span>03</span>分流规则集</div>
                    <div class="topo-col-body">
                      ${topoRules.map(r => `
                        <div class="t-node" tabindex="0" data-node-id="${r.id}" data-rule-jump="${r.tab}" title="${esc(r.name)} · ${esc(r.sub)}">
                          <div class="tn-left">
                            <div class="tn-icon-box">${getNodeIcon(r.icon, r.color)}</div>
                            <div class="tn-meta">
                              <div class="tn-name">${esc(r.name)}</div>
                              <div class="tn-sub">${esc(r.sub)}</div>
                            </div>
                          </div>
                          <span class="tn-val">${esc(r.val)}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- 04 上游策略组 -->
                  <div class="topo-col" data-col="4">
                    <div class="topo-col-title"><span>04</span>上游策略组</div>
                    <div class="topo-col-body">
                      ${topoGroups.map(g => `
                        <div class="t-node" tabindex="0" data-node-id="${g.id}" data-route="upstreams">
                          <div class="tn-left">
                            <div class="tn-icon-box" style="color:${g.color};background:${g.bg};border-color:${g.color}33">${esc(g.code)}</div>
                            <div class="tn-meta">
                              <div class="tn-name">${esc(g.name)}</div>
                              <div class="tn-sub">${esc(g.sub)}</div>
                            </div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- 05 上游 DNS 节点 -->
                  <div class="topo-col" data-col="5">
                    <div class="topo-col-title"><span>05</span>上游 DNS 节点</div>
                    <div class="topo-col-body">
                      ${topoServers.map(s => `
                        <div class="t-node" tabindex="0" data-node-id="${s.id}" data-route="upstreams">
                          <div class="tn-left">
                            <div class="tn-icon-box">${getNodeIcon(s.icon, 'var(--text-3)')}</div>
                            <div class="tn-meta">
                              <div class="tn-name">${esc(s.name)}</div>
                              <div class="tn-sub">${esc(s.sub)}</div>
                            </div>
                          </div>
                          <span class="tn-pill" style="color:${s.color};background:${s.bg}">${esc(s.badge)}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- 5. 底部三栏：请求排行 + 多级缓存池状态 + 最慢查询 -->
          <div class="console-lower">
            <div class="glass-card" style="height:100%">
              <div class="gc-head">
                <div>
                  <div class="gc-title">请求排行</div>
                  <p class="gc-sub">共 ${state.rankTab === 'client' ? state.clients.length : state.domains.length} 条 · 展示前 4</p>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <div class="seg-group">
                    <button type="button" class="seg-item ${state.rankTab === 'client' ? 'active' : ''}" data-rank-tab="client">客户端</button>
                    <button type="button" class="seg-item ${state.rankTab === 'domain' ? 'active' : ''}" data-rank-tab="domain">域名</button>
                  </div>
                  <button type="button" class="glass-btn button small" id="btn-rank-detail">详情</button>
                </div>
              </div>
              <div class="rank-col-hint"><span>${state.rankTab === 'client' ? '客户端' : '域名'}</span><span>请求数 · 占比</span></div>
              <div class="uniform-4rows">
                ${rankList.map(x => {
                  const label = state.rankTab === 'client' ? (state.aliases[x.key] ? `${x.key} (${state.aliases[x.key]})` : x.key) : x.key;
                  const w = Math.max(6, Math.round(x.count / rankMax * 100));
                  const pctShare = (x.count / 128640 * 100).toFixed(1);
                  return `<div class="u-row-bar">
                    <div class="urb-head">
                      <span class="mono" style="color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</span>
                      <span class="mono" style="color:var(--text-2)">${num(x.count)} · ${pctShare}%</span>
                    </div>
                    <div class="urb-track"><div class="urb-fill" style="width:${w}%"></div></div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="console-lower">
            <div class="glass-card" style="height:100%">
              <div class="gc-head">
                <div class="gc-title">多级缓存池状态</div>
                <span class="gc-sub" style="cursor:pointer;color:var(--accent);font-weight:500" data-route="response">缓存管理 ›</span>
              </div>
              <div class="rank-col-hint"><span>缓存池</span><span>命中率 · 条目数</span></div>
              <div class="uniform-4rows">
                ${cachePlugins.map(p=>[esc(p.tag),86.4,6720,'var(--accent)']).map(([name, hit, size, col]) => `
                  <div class="u-row-bar">
                    <div class="urb-head">
                      <span style="color:var(--text-1)">${name}</span>
                      <span class="mono" style="color:var(--text-2)">${hit.toFixed(1)}% · ${num(size)} 条</span>
                    </div>
                    <div class="urb-track"><div class="urb-fill" style="width:${hit}%;background:${col}"></div></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="console-lower">
            <div class="glass-card" style="height:100%">
              <div class="gc-head">
                <div class="gc-title">最慢查询与耗时监控</div>
                <button type="button" class="glass-btn button small" id="btn-slow-detail">详情</button>
              </div>
              <div class="uniform-4rows">
                ${state.slowest.map(g => {
                  const col = g.duration_ms > 300 ? 'var(--crimson)' : (g.duration_ms > 80 ? 'var(--ochre)' : 'var(--sage)');
                  return `<div class="u-row-pill">
                    <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                      <i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-right:8px"></i>
                      <strong class="mono">${esc(g.query_name)}</strong>
                    </span>
                    <span class="mono" style="color:${col};font-weight:600">${g.duration_ms.toFixed(1)} ms</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
        `;

        /* 绑定概览交互 */
        requestAnimationFrame(() => requestAnimationFrame(() => drawTopoCurves(topoEdges)));
        window.onresize = () => { if (state.route === 'overview') requestAnimationFrame(() => drawTopoCurves(topoEdges)); };

        $('#overview-shortcuts').ontoggle = e => { state.shortcutsOpen = e.target.open; };
        $$('[data-chart-range]', page).forEach(btn => btn.onclick = () => { state.chartMinutes = +btn.dataset.chartRange; renderRoute(); });
        $$('[data-rank-tab]', page).forEach(btn => btn.onclick = () => { state.rankTab = btn.dataset.rankTab; renderRoute(); });

        $$('[data-client-ip]', page).forEach(el => el.onclick = () => {queryFilters.client=el.dataset.clientIp;queryPage=1;navigate('queries');});
        $$('[data-rule-jump]', page).forEach(el => el.onclick = () => { state.ruleTab = el.dataset.ruleJump; navigate('rules'); });

        $('#manage-alias').onclick = openAliasModal;
        $('#kpi-card-clients').onclick = openAliasModal;
        $('#kpi-card-domains').onclick = openDomainRankModal;
        $('#btn-rank-detail').onclick = () => state.rankTab === 'client' ? openAliasModal() : openDomainRankModal();
        $('#btn-slow-detail').onclick = openSlowDetailModal;

        animateCountUps(page);
      }

      function renderQpsChartSvg(minutes) {
        const pts = minutes === 15
          ? [24, 28, 32, 30, 38, 42, 36, 45, 51, 48, 44, 54, 49, 46, 43]
          : [19, 22, 26, 25, 31, 35, 29, 38, 44, 41, 36, 48, 54, 47, 43, 39, 45, 50, 46, 42];
        const w = 660, h = 164, left = 36, right = 12, top = 12, bottom = 26;
        const max = 60, innerH = h - top - bottom;
        const coords = pts.map((v, i) => [
          left + (i / (pts.length - 1)) * (w - left - right),
          top + (1 - v / max) * innerH
        ]);
        const linePath = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
        const areaPath = `${linePath} L${coords.at(-1)[0].toFixed(1)} ${(h - bottom).toFixed(1)} L${left} ${(h - bottom).toFixed(1)} Z`;
        return `
          <svg class="console-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="QPS 查询吞吐趋势">
            <defs>
              <linearGradient id="claudeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
              </linearGradient>
            </defs>
            ${[0, 30, 60].map(v => {
              const y = top + (1 - v / max) * innerH;
              return `<line x1="${left}" x2="${w - right}" y1="${y}" y2="${y}" stroke="var(--border-glass)" stroke-dasharray="3 5"/>
                      <text x="${left - 8}" y="${y + 3}" text-anchor="end" fill="var(--text-3)" font-family="var(--font-mono)" font-size="10">${v}</text>`;
            }).join('')}
            <path d="${areaPath}" fill="url(#claudeAreaGrad)"/>
            <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>
            <text x="${left}" y="${h - 6}" fill="var(--text-3)" font-family="var(--font-mono)" font-size="10">${minutes === 15 ? '20:20' : '20:05'}</text>
            <text x="${(w + left) / 2}" y="${h - 6}" text-anchor="middle" fill="var(--text-3)" font-family="var(--font-mono)" font-size="10">${minutes === 15 ? '20:27' : '20:20'}</text>
            <text x="${w - right}" y="${h - 6}" text-anchor="end" fill="var(--text-3)" font-family="var(--font-mono)" font-size="10">20:35</text>
          </svg>`;
      }

      /* ── 页面 2：查询日志 (Logs) ── */
      function referenceOpenDrawer(title, subtitle, html) {
        $('#drawer-title').textContent = title;
        $('#drawer-subtitle').textContent = subtitle;
        $('#drawer-content').innerHTML = html;
        $('#drawer').classList.add('open');
        $('#drawer-backdrop').classList.add('open');
      }
      function referenceCloseDrawer() {
        $('#drawer').classList.remove('open');
        $('#drawer-backdrop').classList.remove('open');
      }
      function openModal(title, subtitle, html, showSave = true) {
        $('#modal-title').textContent = title;
        $('#modal-subtitle').textContent = subtitle;
        $('#modal-content').innerHTML = html;
        $('#modal-actions').innerHTML = showSave
          ? `<button type="button" class="glass-btn" id="m-cancel">取消</button><button type="button" class="glass-btn primary" id="m-save">保存</button>`
          : `<button type="button" class="glass-btn primary" id="m-cancel">关闭</button>`;
        $('#modal').showModal();
        $('#m-cancel').onclick = () => $('#modal').close();
        if ($('#m-save')) $('#m-save').onclick = () => { toast(`${title}已保存`); $('#modal').close(); };
      }

      function referenceOpenAliasModal() {
        openModal('客户端别名管理', '仅保存在当前浏览器，不改写 OxiDNS 配置', `
          <div class="stack">
            ${state.clients.slice(0, 4).map(c => `
              <div class="grid-2">
                <div class="field"><label>客户端 IP</label><input class="mono" value="${esc(c.key)}" disabled /></div>
                <div class="field"><label>设备别名</label><input value="${esc(state.aliases[c.key] || '')}" /></div>
              </div>
            `).join('')}
          </div>
        `);
      }
      function openDomainRankModal() {
        openModal('域名排行详情', '每页 20 条，整页翻页', `
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>域名</th><th>查询次数</th></tr></thead>
              <tbody>
                ${state.domains.map((d, i) => `<tr><td class="mono">${i + 1}</td><td class="mono">${esc(d.key)}</td><td class="mono">${num(d.count)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        `, false);
      }
      function openSlowDetailModal() {
        openModal('最慢查询详情', '按最大单次耗时排序', `
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>域名</th><th>类型</th><th>客户端</th><th>耗时</th></tr></thead>
              <tbody>
                ${state.slowest.map((g, i) => `<tr><td class="mono">${i + 1}</td><td class="mono">${esc(g.query_name)}</td><td class="mono">${esc(g.types.join(' · '))}</td><td>${esc(state.aliases[g.client_ip] || g.client_ip)}</td><td><span class="latency-chip ${g.duration_ms > 200 ? 'bad' : ''}">${g.duration_ms.toFixed(1)} ms</span></td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        `, false);
      }

      /* ── 导航与全局初始化 ── */
      const navDefs = [
        ['overview','overview','运行概览'], ['queries','logs','查询日志'],
        ['upstreams','upstream','DNS 管理'], ['rules','rules','规则管理'],
        ['plugins','overview','插件中心'], ['system','management','系统管理']
      ];

      /* 两套皮肤独立保存各自的配置状态，互不覆盖 */
      const skinPrefs = {
        claude: {
          theme: 'claude-light',
          preset: 'parchment',
          alpha: 94,
          blur: 10
        },
        glass: {
          theme: 'cosmos-glass',
          preset: 'cosmos',
          alpha: 48,
          blur: 14
        }
      };

      const claudePresetNames = {
        parchment: '经典羊皮纸',
        ivory: '温暖象牙白',
        oatmeal: '燕麦工作室',
        obsidian: '温暖黑曜石',
        midnight: '静谧深炭黑'
      };
      const glassPresetNames = {
        cosmos: '深空暖金',
        aurora: '极光深海',
        emerald: '暗夜翡翠',
        sunset: '日落琥珀',
        minimal: '纯净暗黑'
      };

      function updateBrandLogo(){
        const darkSurface = /dark|cosmos/i.test(document.documentElement.dataset.theme || '');
        const logo = darkSurface ? 'assets/yopilot-brand/yopilot-metal-dark.png' : 'assets/yopilot-brand/yopilot-metal-light.png';
        const icon = darkSurface ? 'assets/yopilot-brand/yopilot-metal-icon-dark.png' : 'assets/yopilot-brand/yopilot-metal-icon-light.png';
        $('#brand-mark').src = logo;
        $('#brand-mark').alt = 'YoPilot';
        $('#dynamic-favicon').href = icon;
      }

      function applySkin(skin, showToast = false) {
        const root = document.documentElement;
        const cfg = skinPrefs[skin];
        root.dataset.skin = skin;
        root.dataset.theme = cfg.theme;

        if (skin === 'claude') {
          root.dataset.paperPreset = cfg.preset;
          $('#swatches-claude').hidden = false;
          $('#swatches-glass').hidden = true;
          $('#row-slider-blur').hidden = true;
          $('#bcp-palette-group-title').textContent = '纸张与暗夜色彩基调 (Claude)';
          $('#bcp-preset-label').textContent = '预设纸张色';
          $('#label-slider-alpha').textContent = '卡片遮盖度（纸张不透明度）';
          $('#val-preset').textContent = claudePresetNames[cfg.preset] || '经典羊皮纸';
          $$('[data-claude-preset]').forEach(x => x.classList.toggle('active', x.dataset.claudePreset === cfg.preset));
        } else {
          root.dataset.bgPreset = cfg.preset;
          $('#swatches-claude').hidden = true;
          $('#swatches-glass').hidden = false;
          $('#row-slider-blur').hidden = false;
          $('#bcp-palette-group-title').textContent = '背景与光影预设 (流光毛玻璃)';
          $('#bcp-preset-label').textContent = '预设光影主题';
          $('#label-slider-alpha').textContent = '面板遮盖度（越低越通透）';
          $('#val-preset').textContent = glassPresetNames[cfg.preset] || '深空暖金';
          $$('[data-glass-preset]').forEach(x => x.classList.toggle('active', x.dataset.glassPreset === cfg.preset));
        }

        root.style.setProperty('--paper-opacity', (cfg.alpha / 100).toFixed(2));
        root.style.setProperty('--paper-blur', `${cfg.blur}px`);
        $('#slider-alpha').value = cfg.alpha;
        $('#val-alpha').textContent = `${cfg.alpha}%`;
        $('#slider-blur').value = cfg.blur;
        $('#val-blur').textContent = `${cfg.blur}px`;

        $$('[data-skin-switch]').forEach(btn => btn.classList.toggle('active', btn.dataset.skinSwitch === skin));
        $('#skin-status-label').textContent = skin === 'claude' ? '未连接 · 示例数据' : '未连接 · 示例数据';

        updateBrandLogo();
        persistAppearance();
        if (state.route === 'overview') renderRoute();
        window.OxiObserve?.chrome();
        if (showToast) {
          toast(
            skin === 'claude' ? '已切换至「人文羊皮纸 (Claude)」皮肤' : '已切换至「流光毛玻璃 (原版)」皮肤',
            skin === 'claude' ? `当前预设：${claudePresetNames[cfg.preset]} · 遮盖度 ${cfg.alpha}%` : `当前预设：${glassPresetNames[cfg.preset]} · 遮盖度 ${cfg.alpha}%`
          );
        }
      }

      function init() {
        $('#side-nav').innerHTML = `<div class="sidebar-section-label">控制台导航</div>` + navDefs.map(([r, ic, label]) => `
          <button type="button" class="nav-item ${r === 'overview' ? 'active' : ''}" data-route="${r}">
            ${icons[ic]}<span>${label}</span>
          </button>
        `).join('');

        $('#mobile-nav').innerHTML = navDefs.map(([r, ic, label]) => `
          <button type="button" class="${r === 'overview' ? 'active' : ''}" data-route="${r}">
            ${icons[ic]}<span>${label.replace('运行', '').replace('查询', '').replace('管理', '')}</span>
          </button>
        `).join('');

        $('#refresh-button').innerHTML = icons.refresh;
        $('#theme-toggle').innerHTML = icons.theme;

        document.addEventListener('click', e => {
          const skinBtn = e.target.closest('[data-skin-switch]');
          if (skinBtn) {
            applySkin(skinBtn.dataset.skinSwitch, true);
            return;
          }
          const rBtn = e.target.closest('[data-route]');
          if (rBtn) { navigate(rBtn.dataset.route); return; }
          const copyEl = e.target.closest('[data-copy]');
          if (copyEl) {
            const text = copyEl.dataset.copy;
            navigator.clipboard?.writeText(text).catch(() => {});
            copyEl.classList.add('is-copied');
            setTimeout(() => copyEl.classList.remove('is-copied'), 900);
            toast('已复制到剪贴板', text);
          }
        });

        /* 顶部按钮与外观面板 */
        const pop = $('#bg-customizer-popover');
        $('#btn-open-bg-customizer').onclick = e => {
          e.stopPropagation();
          pop.classList.toggle('open');
        };
        $('#btn-close-bg-popover').onclick = () => pop.classList.remove('open');
        document.addEventListener('click', e => {
          if (!pop.contains(e.target) && !e.target.closest('#btn-open-bg-customizer')) pop.classList.remove('open');
        });

        /* 皮肤 1 (Claude) 纸张预设切换 */
        $$('[data-claude-preset]').forEach(btn => btn.onclick = () => {
          skinPrefs.claude.preset = btn.dataset.claudePreset;
          skinPrefs.claude.theme = btn.dataset.mode;
          applySkin('claude', false);
          toast(`人文羊皮纸 · ${claudePresetNames[btn.dataset.claudePreset]}`);
        });

        /* 皮肤 2 (Glass) 光影预设切换 */
        $$('[data-glass-preset]').forEach(btn => btn.onclick = () => {
          skinPrefs.glass.preset = btn.dataset.glassPreset;
          skinPrefs.glass.theme = 'cosmos-glass';
          applySkin('glass', false);
          toast(`流光毛玻璃 · ${glassPresetNames[btn.dataset.glassPreset]}`);
        });

        /* 明暗模式按钮（自动根据当前所属皮肤切换浅色/深色） */
        $('#theme-toggle').onclick = () => {
          const skin = document.documentElement.dataset.skin || 'claude';
          if (skin === 'claude') {
            const next = skinPrefs.claude.theme === 'claude-dark' ? 'claude-light' : 'claude-dark';
            skinPrefs.claude.theme = next;
            skinPrefs.claude.preset = next === 'claude-dark' ? 'obsidian' : 'parchment';
            applySkin('claude', false);
            toast(next === 'claude-dark' ? '人文羊皮纸 · 已切换至温暖黑曜石 (深色)' : '人文羊皮纸 · 已切换至经典羊皮纸 (浅色)');
          } else {
            const next = skinPrefs.glass.theme === 'light-glass' ? 'cosmos-glass' : 'light-glass';
            skinPrefs.glass.theme = next;
            applySkin('glass', false);
            toast(next === 'light-glass' ? '流光毛玻璃 · 已切换至浅色磨砂玻璃' : '流光毛玻璃 · 已切换至深色流光毛玻璃');
          }
        };

        $('#btn-toggle-particles').onclick = () => {
          state.particles = !(window.OxiPath?.getMotion() ?? state.particles);
          $('#btn-toggle-particles').classList.toggle('active', state.particles);
          $('#btn-toggle-particles').setAttribute('aria-pressed', String(state.particles));
          window.OxiPath?.setMotion(state.particles);
        };

        $('#refresh-button').onclick = () => {
          $('#status-time-label').textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
          if(!OxiEngine.guard(state.route,()=>renderRoute()))return;
          renderRoute();
          toast('示例视图已刷新', '未请求真实 DNS 服务');
        };

        /* 外观滑块（分别写入当前皮肤的独立配置） */
        $('#slider-alpha').oninput = e => {
          const skin = document.documentElement.dataset.skin || 'claude';
          skinPrefs[skin].alpha = +e.target.value;
          document.documentElement.style.setProperty('--paper-opacity', (e.target.value / 100).toFixed(2));
          $('#val-alpha').textContent = `${e.target.value}%`;
        };
        $('#slider-blur').oninput = e => {
          const skin = document.documentElement.dataset.skin || 'claude';
          skinPrefs[skin].blur = +e.target.value;
          document.documentElement.style.setProperty('--paper-blur', `${e.target.value}px`);
          $('#val-blur').textContent = `${e.target.value}px`;
        };
        $('#slider-radius').oninput = e => {
          document.documentElement.style.setProperty('--radius-scale', (e.target.value / 100).toFixed(2));
          $('#val-radius').textContent = `${e.target.value}%`;
        };
        $('#select-brand-ver').onchange = e => {
          const mode = e.target.value;
          document.documentElement.dataset.brandVerMode = mode;
          $('#input-brand-ver').hidden = mode !== 'custom';
          if (mode === 'version') $('#brand-version-tag').textContent = 'OxiDNS';
        };
        $('#input-brand-ver').oninput = e => {
          $('#brand-version-tag').textContent = e.target.value.trim() || 'OxiDNS';
        };

        /* 字体组合切换 */
        const applyFonts = (heading, numeral, body) => {
          document.documentElement.style.setProperty('--font-heading-active', heading === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)');
          document.documentElement.style.setProperty('--font-numeral-active', numeral === 'serif' ? 'var(--font-numeral)' : (numeral === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)'));
          document.documentElement.style.setProperty('--font-body-active', body === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)');
        };
        $$('[data-font-preset]').forEach(btn => btn.onclick = () => {
          $$('[data-font-preset]').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
          const p = btn.dataset.fontPreset;
          if (p === 'editorial') { $('#font-heading').value = 'serif'; $('#font-numeral').value = 'serif'; $('#font-body').value = 'plex'; applyFonts('serif', 'serif', 'plex'); }
          if (p === 'clear')     { $('#font-heading').value = 'sans';  $('#font-numeral').value = 'sans';  $('#font-body').value = 'plex'; applyFonts('sans', 'sans', 'plex'); }
          if (p === 'technical') { $('#font-heading').value = 'serif'; $('#font-numeral').value = 'mono';  $('#font-body').value = 'plex'; applyFonts('serif', 'mono', 'plex'); }
        });
        $('#font-heading').onchange = () => applyFonts($('#font-heading').value, $('#font-numeral').value, $('#font-body').value);
        $('#font-numeral').onchange = () => applyFonts($('#font-heading').value, $('#font-numeral').value, $('#font-body').value);
        $('#font-body').onchange    = () => applyFonts($('#font-heading').value, $('#font-numeral').value, $('#font-body').value);

        /* 本地字体上传预览 */
        $('#input-font-upload').onchange = async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const buf = await file.arrayBuffer();
            const face = new FontFace('UploadedCustomFont', buf);
            await face.load();
            document.fonts.add(face);
            document.documentElement.style.setProperty('--font-heading-active', `'UploadedCustomFont', var(--font-serif)`);
            document.documentElement.style.setProperty('--font-numeral-active', `'UploadedCustomFont', var(--font-numeral)`);
            $('#val-font-upload').textContent = file.name.slice(0, 14);
            toast('自定义字体已加载并应用', file.name);
          } catch (err) {
            toast('字体加载失败', err.message);
          }
        };

        /* 本地壁纸预览 */
        $('#bg-file-input').onchange = e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          $('#wallpaper-layer').style.backgroundImage = `url("${url}")`;
          document.body.classList.add('has-custom-wallpaper');
          toast('已应用本地壁纸预览', file.name);
        };
        $('#btn-clear-custom-bg').onclick = () => {
          $('#wallpaper-layer').style.backgroundImage = '';
          document.body.classList.remove('has-custom-wallpaper');
          toast('已恢复 Claude 羊皮纸质感背景');
        };

        /* 全局快捷键与弹窗关闭 */
        $('#drawer-close').onclick = closeDrawer;
        $('#drawer-backdrop').onclick = closeDrawer;
        $('#modal-close').onclick = () => $('#modal').close();
        $('#modal').onclick = e => { if (e.target === $('#modal')) $('#modal').close(); };
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer();
          if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
            e.preventDefault();
            $('#global-search-input').focus();
          }
        });
        $('#global-search-input').onkeydown = e => {
          if (e.key === 'Enter') {
            const q = e.target.value.trim().toLowerCase();
            if (['概览', 'overview'].includes(q)) return navigate('overview');
            if (['上游', 'dns', 'upstreams'].includes(q)) return navigate('upstreams');
            if (['规则', 'rules'].includes(q)) return navigate('rules');
            if (['系统', '管理', 'management'].includes(q)) return navigate('system');
            navigate('queries');
          }
        };

        updateBrandLogo();
        installOxiShell();
      }

      // This file is inserted into the reference shell's closure by build-localdns-shell.cjs.
      const routeFamilies = {
        upstreams:['listeners','upstreams','hosts','response','strategies','dependencies'],
        rules:['rules','integrations','files'], system:['system','connection','tasks','runtime','metrics','config'],
        queries:['queries','logs','history']
      };
      const getFamily = route => Object.keys(routeFamilies).find(k=>routeFamilies[k].includes(route))||route;
      const prefKey='oxidns-localdns-shell-v1';
      const readPref=()=>{try{return JSON.parse(localStorage.getItem(prefKey))||{};}catch{return {};}};
      const uiPrefs=readPref();
      let queryPage=1, queryFilters={q:'',type:'',set:'',code:'',client:'',exact:false};
      let selectedRule='', ruleDraft=null, ruleBaseline='', ruleMode='lines', ruleLineText='', drawerReturn=null;
      const ruleDrafts=new Map();
      const ruleFields={domain_set:['exps','内联域名规则'],dynamic_domain_set:['bootstrap_rules','初始规则（仅在规则文件不存在时写入）'],adguard_rule:['rules','内联 AdGuard 规则'],ip_set:['ips','IP / CIDR'],geosite:['selectors','GeoSite 分类'],geoip:['selectors','GeoIP 分类']};
      function rememberRule(){if(selectedRule&&ruleDraft!==null)ruleDrafts.set(selectedRule,{raw:ruleDraft,baseline:ruleBaseline,mode:ruleMode,lineText:ruleLineText});}
      const writePref=()=>{try{localStorage.setItem(prefKey,JSON.stringify(uiPrefs));}catch{toast('外观设置无法保存','浏览器存储空间不可用');}};
      function persistAppearance(){
        uiPrefs.skin=document.documentElement.dataset.skin;
        uiPrefs.skins=skinPrefs;
        writePref();
      }
      function renderSubnav(route){
        const family=getFamily(route), items=routeFamilies[family];
        if(!items)return '';
        return `<nav class="oxi-subnav" aria-label="${esc(navDefs.find(n=>n[0]===family)?.[2]||'工作区')}分栏">${items.map(r=>`<button class="${route===r?'active':''}" type="button" data-route="${r}" ${route===r?'aria-current="page"':''}>${OxiEngine.routeInfo[r][0]}</button>`).join('')}</nav>`;
      }
      function guardRule(proceed){
        if(ruleDraft===null||ruleDraft===ruleBaseline)return true;
        openModal('保留尚未保存的规则？','切换会放弃当前规则文本，已保存的草稿不受影响。','',true);
        $('#m-save').textContent='放弃并继续';
        $('#m-save').onclick=()=>{ruleDrafts.delete(selectedRule);ruleDraft=null;$('#modal').close();proceed();};
        return false;
      }
      function navigate(route,skipGuard=false){
        if(route==='management')route='system';
        if(!OxiEngine.routeInfo[route])route='overview';
        if(!skipGuard){
          if(!OxiEngine.guard(route,()=>navigate(route,true)))return;
        }
        rememberRule();
        stopTopoFlow();
        state.route=route;
        OxiEngine.setCurrent(route);
        $('#global-results')?.setAttribute('hidden','');
        $$('[data-route]', $('#side-nav')).concat($$('[data-route]',$('#mobile-nav'))).forEach(el=>{
          const active=el.dataset.route===getFamily(route);
          el.classList.toggle('active',active);
          if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
        });
        document.title='YoPilot · '+OxiEngine.routeInfo[route][0];
        history.replaceState(null,'','#'+route);
        renderRoute();
        window.scrollTo({top:0,behavior:'instant'});
      }
      function renderRoute(){
        stopTopoFlow();
        window.OxiAdvanced?.stopStream();
        if(window.OxiAdvanced?.render(state.route))return;
        if(window.OxiObserve?.render(state.route))return;
        if(window.OxiManage?.render(state.route)){window.OxiAdvanced?.enhance(state.route);window.OxiObserve?.chrome();return;}
        if(state.route==='overview'){
          renderOverview();
          const old=$('.console-topology');
          if(old&&window.OxiPath){
            const path=document.createElement('section');old.replaceWith(path);
            const trend=$('.console-trend');if(trend)trend.before(path);
            window.OxiPath.mount(path,{config:OxiEngine.config(),onPlugin:tag=>OxiEngine.edit(null,tag)});
          }
        }
        else if(state.route==='queries')renderLogs();
        else if(state.route==='rules')renderRulesWorkspace();
        else {
          $('#page-content').innerHTML=renderSubnav(state.route)+`<section class="oxi-workspace" id="view-${state.route}"></section>`;
          OxiEngine.render(state.route);
        }
        window.OxiAdvanced?.enhance(state.route);
        if(!['overview','queries','logs'].includes(state.route))$('#page-content').insertAdjacentHTML('afterbegin',window.OxiObserve?.draftNotice()||'');
        window.OxiObserve?.chrome();
        // Reference topology and metric tiles are keyboard-operable too.
        $$('[data-route]:not(button),[data-client-ip],[data-rule-jump],#kpi-card-clients,#kpi-card-domains').forEach(el=>{
          el.tabIndex=0;el.setAttribute('role','button');
        });
      }
      function renderLogs(){
        const page=$('#page-content');
        const f=queryFilters;
        page.innerHTML=renderSubnav('queries')+`
          <div class="view-title-row"><div><h1>查询日志</h1><span class="gc-sub">示例查询记录 · 点击域名或客户端可复制，详情查看响应和耗时</span></div><div class="oxi-actions"><button class="glass-btn" id="query-recorder">记录配置</button><button class="glass-btn" id="query-alias">客户端别名</button></div></div>
          <section class="card col-12"><div class="card-header"><div class="card-title"><span class="icon">${icons.logs}</span><h2>查询与过滤日志</h2></div></div><div class="card-body">
            <form class="log-filter-bar" id="query-filter-form">
              <div class="lf-search">${icons.search}<input id="log-q" aria-label="搜索查询记录" type="search" value="${esc(f.q)}" placeholder="域名、IP、响应值…"></div>
              <select id="log-type" aria-label="查询类型"><option value="">全部类型</option>${['A','AAAA','HTTPS'].map(x=>`<option ${f.type===x?'selected':''}>${x}</option>`).join('')}</select>
              <select id="log-set" aria-label="分流结果"><option value="">全部分流</option>${[...new Set(state.logs.map(x=>x.domain_set))].map(x=>`<option ${f.set===x?'selected':''}>${x}</option>`).join('')}</select>
              <button class="glass-btn" id="btn-log-more" type="button" aria-expanded="false">更多筛选</button><button class="glass-btn primary" type="submit">查询</button><button class="glass-btn" id="query-reset" type="button">重置</button>
            </form>
            <div class="log-filter-more" id="log-filter-more" hidden>
              <div class="field"><label for="log-code">响应状态</label><select id="log-code"><option value="">全部</option>${['NOERROR','NXDOMAIN'].map(x=>`<option ${f.code===x?'selected':''}>${x}</option>`).join('')}</select></div>
              <div class="field"><label for="log-client">客户端过滤</label><input id="log-client" value="${esc(f.client)}" placeholder="IP 或设备别名"></div>
              <label class="switch"><input id="log-exact" type="checkbox" ${f.exact?'checked':''}><span class="switch-track"><span class="switch-thumb"></span></span><span>精确匹配</span></label>
            </div>
          </div></section>
          <section class="card col-12"><div class="card-header"><div class="card-title"><span class="icon">${icons.logs}</span><div><h2>DNS 请求记录</h2><p id="query-count"></p></div></div><button class="glass-btn" id="query-export">导出当前结果</button></div>
            <div class="table-wrap"><table><thead><tr><th>时间</th><th>域名 / 响应</th><th>类型</th><th>分流</th><th>耗时</th><th>客户端</th><th>状态</th><th>操作</th></tr></thead><tbody id="log-tbody"></tbody></table></div><div class="pagination" id="query-pagination"></div>
          </section>`;
        $('#query-filter-form').onsubmit=e=>{e.preventDefault();queryFilters={q:$('#log-q').value,type:$('#log-type').value,set:$('#log-set').value,code:$('#log-code').value,client:$('#log-client').value,exact:$('#log-exact').checked};queryPage=1;updateQueries();};
        $('#btn-log-more').onclick=e=>{const more=$('#log-filter-more');more.hidden=!more.hidden;e.currentTarget.setAttribute('aria-expanded',String(!more.hidden));};
        $('#query-reset').onclick=()=>{queryFilters={q:'',type:'',set:'',code:'',client:'',exact:false};queryPage=1;renderLogs();};
        $('#query-recorder').onclick=()=>{const p=OxiEngine.config().plugins.find(p=>p.type==='query_recorder');OxiEngine.edit('query_recorder',p?.tag);};
        $('#query-alias').onclick=openAliasModal;
        $('#query-export').onclick=()=>downloadLocal('oxidns-query-examples.json',JSON.stringify(filteredQueries(),null,2),'application/json');
        updateQueries();
      }
      function filteredQueries(){
        const f=queryFilters,q=f.q.trim().toLowerCase(),client=f.client.trim().toLowerCase();
        return state.logs.filter(x=>{
          const hay=[x.query_name,x.client_ip,state.aliases[x.client_ip]||'',...x.answers.map(a=>a.data)].map(x=>x.toLowerCase());
          return (!q||(f.exact?hay.includes(q):hay.some(x=>x.includes(q))))&&(!f.type||x.query_type===f.type)&&(!f.set||x.domain_set===f.set)&&(!f.code||x.response_code===f.code)&&(!client||(x.client_ip+' '+(state.aliases[x.client_ip]||'')).toLowerCase().includes(client));
        });
      }
      function updateQueries(){
        const rows=filteredQueries(),size=5,pages=Math.max(1,Math.ceil(rows.length/size));queryPage=Math.min(queryPage,pages);
        $('#query-count').textContent=`匹配 ${rows.length} 条示例 · 第 ${queryPage} / ${pages} 页`;
        $('#log-tbody').innerHTML=rows.slice((queryPage-1)*size,queryPage*size).map(x=>`<tr>
          <td class="mono">${esc(x.query_time.split(' ')[1])}</td><td><button class="copyable mono query-domain" data-copy="${esc(x.query_name)}">${esc(x.query_name)}</button><div class="query-answer mono">${esc(x.answers.map(a=>a.data).join(', ')||x.response_code)}</div></td><td class="mono">${x.query_type}</td><td><span class="badge">${esc(x.domain_set)}</span></td><td class="mono">${x.duration_ms.toFixed(2)} ms</td><td><button class="copyable value-chip" data-copy="${x.client_ip}">${esc(state.aliases[x.client_ip]||x.client_ip)}</button></td><td><span class="badge ${x.response_code==='NOERROR'?'success':'danger'}">${x.response_code}</span></td><td><button class="glass-btn small" data-query-detail="${x.trace_id}">详情</button></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty-state">没有匹配的查询记录，请调整筛选或重置。</div></td></tr>';
        $('#query-pagination').innerHTML=`<button ${queryPage===1?'disabled':''} data-query-page="${queryPage-1}" aria-label="上一页">‹</button>${Array.from({length:pages},(_,i)=>`<button class="${queryPage===i+1?'active':''}" data-query-page="${i+1}" aria-label="第 ${i+1} 页">${i+1}</button>`).join('')}<button ${queryPage===pages?'disabled':''} data-query-page="${queryPage+1}" aria-label="下一页">›</button>`;
        $$('[data-query-page]').forEach(b=>b.onclick=()=>{queryPage=+b.dataset.queryPage;updateQueries();});
        $$('[data-query-detail]').forEach(b=>b.onclick=()=>{
          const x=state.logs.find(x=>x.trace_id===b.dataset.queryDetail);
          openDrawer('查询详情',x.query_name+' · 示例记录',`<div class="kv-list">${[['查询时间',x.query_time],['客户端',x.client_ip],['查询类型',x.query_type+' / IN'],['分流结果',x.domain_set],['响应状态',x.response_code],['总耗时',x.duration_ms.toFixed(2)+' ms'],['Trace ID',x.trace_id]].map(([k,v])=>`<div class="kv-row"><span class="kv-key">${k}</span><span class="kv-value mono">${esc(v)}</span></div>`).join('')}</div><h3 class="drawer-section-title">响应内容</h3><pre>${esc(JSON.stringify(x.answers,null,2))}</pre><h3 class="drawer-section-title">执行路径</h3><p class="gc-sub">真实逐步耗时需要查询记录接口返回 trace；本示例不生成虚构的执行轨迹。</p>`);
        });
      }
      function renderRulesWorkspace(){
        const providers=OxiEngine.config().plugins.filter(p=>OxiEngine.catalog.find(d=>d.kind===p.type)?.type==='provider');
        const selected=providers.find(p=>p.tag===selectedRule)||providers[0];selectedRule=selected?.tag||'';
        const [field,fieldLabel]=ruleFields[selected?.type]||['exps','内联规则'];
        if(ruleDraft===null){const cached=ruleDrafts.get(selectedRule);ruleBaseline=JSON.stringify(selected?.args||{},null,2);ruleDraft=cached?.raw??ruleBaseline;ruleMode=cached?.mode||'lines';ruleLineText=cached?.lineText??(Array.isArray(selected?.args?.[field])?selected.args[field].join('\n'):'');}
        let args;try{args=JSON.parse(ruleDraft);}catch{ruleMode='json';}
        const canEditLines=args&&typeof args==='object'&&!Array.isArray(args)&&(args[field]===undefined||(Array.isArray(args[field])&&args[field].every(x=>typeof x==='string')));
        if(!canEditLines)ruleMode='json';
        $('#page-content').innerHTML=renderSubnav('rules')+`<div class="view-title-row"><div><h1>规则管理</h1><span class="gc-sub">规则集合与数据源 · 修改保存到本地草稿</span></div><button class="glass-btn primary" data-library="provider">添加规则数据源</button></div>
          <section class="card col-12 rule-layout oxi-rule-layout"><aside class="rule-menu oxi-rule-list"><div class="sidebar-section-label">已配置的数据源 · ${providers.length}</div>${providers.map(p=>`<button class="nav-item ${selectedRule===p.tag?'active':''}" data-rule-select="${esc(p.tag)}"><span><strong>${esc(p.tag)}</strong><small>${OxiEngine.label(p.type)}</small></span><span class="rule-dirty-dot" ${ruleDrafts.get(p.tag)?.raw!==undefined&&ruleDrafts.get(p.tag).raw!==ruleDrafts.get(p.tag).baseline?'':'hidden'} aria-label="有未保存修改"></span></button>`).join('')||'<p class="gc-sub">暂无规则数据源</p>'}</aside><div class="rule-editor oxi-rule-editor">
            ${selected?`<div class="gc-head"><div><h2>${esc(selected.tag)}</h2><p class="gc-sub">${OxiEngine.label(selected.type)} · <code>${selected.type}</code></p></div><button class="glass-btn" id="rule-form-edit">更多参数</button></div>
            <div class="seg-group rule-mode" role="group" aria-label="规则编辑方式"><button type="button" class="seg-item ${ruleMode==='lines'?'active':''}" data-rule-mode="lines" ${canEditLines?'':'disabled'}>逐行编辑</button><button type="button" class="seg-item ${ruleMode==='json'?'active':''}" data-rule-mode="json">完整参数 JSON</button></div>
            <label for="rule-source" class="gc-sub">${ruleMode==='lines'?fieldLabel+' · 一行一条':'完整参数 JSON · 保留所有字段'}</label><textarea class="rule-source rule-textarea mono" id="rule-source" spellcheck="false">${esc(ruleMode==='lines'?ruleLineText:ruleDraft)}</textarea><div class="rule-editor-footer"><span id="rule-feedback" role="status" class="console-rule-state ${ruleDraft!==ruleBaseline?'dirty':''}">${ruleDraft!==ruleBaseline?'未保存 · 切换规则集会保留':'与当前草稿一致'}</span><span id="rule-line-count">${ruleMode==='lines'?OxiRuleTools.lines(ruleLineText).length+' 条规则':'JSON 参数'}</span></div><p class="gc-sub">${selected.type==='dynamic_domain_set'?'这里只编辑初始化规则；运行中的动态规则列表尚未接入。':'只编辑当前参数；外部规则文件内容仍由 OxiDNS 服务读取。'}</p><div class="oxi-actions rule-actions"><button class="glass-btn" id="rule-download">下载规则</button><button class="glass-btn" id="rule-reset">还原文本</button><button class="glass-btn" data-task="provider" data-target="${esc(selected.tag)}">重载流程演示</button><button class="glass-btn primary" id="rule-save">保存草稿</button></div>`:'<div class="empty-state">添加域名集合、GeoSite、AdGuard、IP 集合或动态数据源。</div>'}
          </div></section><section class="card col-12"><div class="card-header"><h2>规则更新与学习</h2></div><div class="card-body oxi-actions">${['download','cron','reload_provider','learn_domain'].map(kind=>`<button class="glass-btn" data-create="${kind}">${OxiEngine.label(kind)}</button>`).join('')}</div></section>`;
        $$('[data-rule-select]').forEach(b=>b.onclick=()=>{rememberRule();selectedRule=b.dataset.ruleSelect;ruleDraft=null;renderRulesWorkspace();});
        if(!selected)return;
        $('#rule-source').oninput=e=>{if(ruleMode==='lines'){ruleLineText=e.target.value;ruleDraft=JSON.stringify(OxiRuleTools.replaceLines(JSON.parse(ruleDraft),field,ruleLineText),null,2);}else ruleDraft=e.target.value;rememberRule();$('#rule-feedback').textContent=ruleDraft!==ruleBaseline?'未保存 · 切换规则集会保留':'与当前草稿一致';$('#rule-feedback').classList.toggle('dirty',ruleDraft!==ruleBaseline);$('#rule-line-count').textContent=ruleMode==='lines'?OxiRuleTools.lines(ruleLineText).length+' 条规则':'JSON 参数';const active=$('.nav-item.active .rule-dirty-dot',$('.oxi-rule-list'));if(active)active.hidden=ruleDraft===ruleBaseline;};
        $$('[data-rule-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.ruleMode===ruleMode)return;try{const value=JSON.parse(ruleDraft);if(b.dataset.ruleMode==='lines'){if(value[field]!==undefined&&(!Array.isArray(value[field])||value[field].some(x=>typeof x!=='string')))throw Error('该字段含非文本结构，请使用完整 JSON 编辑');ruleLineText=(value[field]||[]).join('\n');}ruleMode=b.dataset.ruleMode;rememberRule();renderRulesWorkspace();}catch(err){$('#rule-feedback').textContent='请先修正 JSON：'+err.message;}});
        $('#rule-reset').onclick=()=>{ruleDrafts.delete(selectedRule);ruleDraft=null;renderRulesWorkspace();};
        $('#rule-download').onclick=()=>downloadLocal(selected.tag+(ruleMode==='lines'?'.txt':'.json'),ruleMode==='lines'?ruleLineText:ruleDraft,ruleMode==='lines'?'text/plain':'application/json');
        $('#rule-form-edit').onclick=()=>{const open=()=>{ruleDraft=null;OxiEngine.edit(null,selected.tag);};if(guardRule(open))open();};
        $('#rule-save').onclick=()=>{
          try{const args=JSON.parse(ruleDraft);if(!args||typeof args!=='object'||Array.isArray(args))throw Error('参数必须是 JSON 对象');const cfg=OxiEngine.config();cfg.plugins.find(p=>p.tag===selected.tag).args=args;OxiEngine.save(cfg);ruleBaseline=ruleDraft;ruleDrafts.delete(selectedRule);toast('规则参数已保存到本地草稿');renderRulesWorkspace();}
          catch(err){$('#rule-feedback').textContent='无法保存：'+err.message;$('#rule-feedback').className='field-error';}
        };
      }
      function downloadLocal(name,value,type){const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      function openAliasModal(){
        openModal('客户端别名管理','仅保存在当前浏览器，不改写 OxiDNS 配置',`<div class="stack">${state.clients.map(c=>`<div class="grid-2"><div class="field"><label>客户端 IP</label><input class="mono" value="${c.key}" disabled></div><div class="field"><label for="alias-${c.key}">设备别名</label><input id="alias-${c.key}" data-alias="${c.key}" value="${esc(state.aliases[c.key]||'')}"></div></div>`).join('')}</div>`);
        $('#m-save').onclick=()=>{$$('[data-alias]').forEach(i=>state.aliases[i.dataset.alias]=i.value.trim());uiPrefs.aliases=state.aliases;writePref();$('#modal').close();renderRoute();toast('客户端别名已保存到浏览器');};
      }
      function openDrawer(title,subtitle,html){
        // Nested detail views replace content but retain the original page trigger.
        if(!$('#drawer').classList.contains('open'))drawerReturn=document.activeElement;
        $('#drawer-title').textContent=title;$('#drawer-subtitle').textContent=subtitle;$('#drawer-content').innerHTML=html;
        $('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#drawer').setAttribute('aria-modal','true');$('#drawer-backdrop').classList.add('open');$('.master-container').inert=true;$('#drawer-close').focus();
      }
      function closeDrawer(){
        window.OxiAdvanced?.stopStream();
        $('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#drawer').removeAttribute('aria-modal');$('#drawer-backdrop').classList.remove('open');$('.master-container').inert=false;
        const target=drawerReturn?.isConnected&&drawerReturn!==document.body&&!$('#drawer').contains(drawerReturn)?drawerReturn:$('#page-content h1')||$('#global-search-input');
        drawerReturn=null;
        if(target){if(!target.matches('button,a,input,select,textarea,[tabindex]'))target.tabIndex=-1;target.focus({preventScroll:true});}
      }
      function setNavigation(mode){
        document.body.dataset.nav=['top','collapsed'].includes(mode)?mode:'left';uiPrefs.nav=document.body.dataset.nav;writePref();$('#nav-position').value=uiPrefs.nav;resetMagnification();
        window.dispatchEvent(new Event('resize'));
      }
      function resetMagnification(){ $$('#side-nav .nav-item').forEach(b=>{b.style.setProperty('--dock-scale',1);b.style.setProperty('--dock-shift','0px');}); }
      function magnifyNavigation(target){
        resetMagnification();
      }
      function installOxiShell(){
        window.OxiShell={navigate,refresh:()=>{const p=OxiEngine.config().plugins.find(p=>p.tag===selectedRule);const baseline=JSON.stringify(p?.args||{},null,2);if(ruleDraft===null||(ruleDraft===ruleBaseline&&baseline!==ruleBaseline)){ruleDrafts.delete(selectedRule);ruleDraft=null;}renderRoute();}};
        if(uiPrefs.aliases)state.aliases={...state.aliases,...uiPrefs.aliases};
        state.logs.forEach(x=>x.answers.forEach(a=>{a.data=a.data.replace('198.18.0.42 (FakeIP)','192.0.2.42');}));
        $('#sidebar-status strong').textContent='示例 · 未连接服务';
        $('#api-endpoint-label').textContent='配置仅保存本地';
        window.OxiObserve?.install({route:()=>state.route,navigate,refresh:renderRoute,subnav:renderSubnav,openDrawer,closeDrawer,toast,download:downloadLocal});
        window.OxiManage?.install({navigate,subnav:renderSubnav,openDrawer,closeDrawer,toast,download:downloadLocal});
        // Preserve reference controls and add the previously requested navigation placement.
        $('#bg-customizer-popover').insertAdjacentHTML('afterbegin',`<section class="oxi-nav-setting"><label for="nav-position">导航位置</label><select id="nav-position"><option value="left">左侧导航</option><option value="top">顶部居中 · 缩放动效</option></select></section>`);
        $('#nav-position').onchange=e=>setNavigation(e.target.value);
        $('#btn-open-bg-customizer').addEventListener('click',()=>$('#btn-open-bg-customizer').setAttribute('aria-expanded',String($('#bg-customizer-popover').classList.contains('open'))));
        $('#btn-close-bg-popover').addEventListener('click',()=>$('#btn-open-bg-customizer').setAttribute('aria-expanded','false'));
        $('#side-nav').addEventListener('pointermove',e=>{if(e.pointerType!=='touch')magnifyNavigation(e.target);});
        $('#side-nav').addEventListener('pointerover',e=>{if(e.pointerType!=='touch')magnifyNavigation(e.target);});
        $('#side-nav').addEventListener('pointerleave',resetMagnification);
        $('#side-nav').addEventListener('focusin',e=>magnifyNavigation(e.target));
        $('#side-nav').addEventListener('focusout',resetMagnification);
        $('#side-nav').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const items=$$('.nav-item',$('#side-nav')),i=items.indexOf(document.activeElement);if(i<0)return;e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+items.length)%items.length].focus();});
        $('.cmd-search-bar').insertAdjacentHTML('beforeend','<div id="global-results" class="global-results" role="region" aria-label="搜索结果" hidden></div>');
        const input=$('#global-search-input'),results=$('#global-results');
        const search=()=>{const q=input.value.trim().toLowerCase();if(!q){results.hidden=true;return;}const routes=Object.entries(OxiEngine.routeInfo).filter(([k,v])=>(k+v.join('')).toLowerCase().includes(q)).map(([key,v])=>`<button data-search-route="${key}"><span>${v[0]}</span><small>${v[1]}</small></button>`);const plugins=OxiEngine.catalog.filter(d=>(d.kind+OxiEngine.label(d.kind)+d.description).toLowerCase().includes(q)).slice(0,6).map(d=>`<button data-search-plugin="${d.kind}"><span>${esc(OxiEngine.label(d.kind))}</span><small>${d.kind}</small></button>`);results.innerHTML=[...routes,...plugins].join('')+`<button data-search-query><span>搜索查询记录</span><small>${esc(input.value)}</small></button>`;results.hidden=false;};
        input.oninput=search;input.onfocus=()=>{if(input.value)search();};
        const choose=b=>{if(b.dataset.searchRoute)navigate(b.dataset.searchRoute);else if(b.dataset.searchPlugin)OxiEngine.edit(b.dataset.searchPlugin);else{queryFilters.q=input.value;queryPage=1;navigate('queries');}results.hidden=true;input.value='';};
        results.onclick=e=>{const b=e.target.closest('button');if(b)choose(b);};
        input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(results.hidden)search();const b=$('button',results);if(b)choose(b);}if(e.key==='ArrowDown'&&!results.hidden){e.preventDefault();$('button',results)?.focus();}if(e.key==='Escape')results.hidden=true;};
        results.onkeydown=e=>{const all=$$('button',results),i=all.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length].focus();}if(e.key==='Escape'){results.hidden=true;input.focus();}};
        document.addEventListener('click',e=>{if(!e.target.closest('.cmd-search-bar'))results.hidden=true;});
        document.addEventListener('keydown',e=>{
          if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role="button"]:not(button)')){e.preventDefault();e.target.click();}
          if(e.key==='Tab'&&$('#drawer').classList.contains('open')){const focusable=$$('button,a,input,select,textarea,[tabindex="0"]',$('#drawer'));const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
          if(e.key==='Escape'){$('#bg-customizer-popover').classList.remove('open');results.hidden=true;}
        });
        // Persist both reference skins independently, including sliders and typography.
        if(uiPrefs.skins){for(const key of ['claude','glass'])if(uiPrefs.skins[key])Object.assign(skinPrefs[key],uiPrefs.skins[key]);}
        for(const id of ['slider-alpha','slider-blur'])$('#'+id).addEventListener('change',persistAppearance);
        $('#slider-radius').addEventListener('change',e=>{uiPrefs.radius=e.target.value;writePref();});
        for(const id of ['font-heading','font-numeral','font-body'])$('#'+id).addEventListener('change',()=>{uiPrefs.fonts=[$('#font-heading').value,$('#font-numeral').value,$('#font-body').value];writePref();});
        $$('[data-font-preset]').forEach(b=>b.addEventListener('click',()=>{uiPrefs.fonts=[$('#font-heading').value,$('#font-numeral').value,$('#font-body').value];writePref();}));
        if(uiPrefs.fonts){['font-heading','font-numeral','font-body'].forEach((id,i)=>$('#'+id).value=uiPrefs.fonts[i]);$('#font-body').dispatchEvent(new Event('change'));}
        if(uiPrefs.radius){$('#slider-radius').value=uiPrefs.radius;$('#slider-radius').dispatchEvent(new Event('input'));}
        setNavigation(uiPrefs.nav||'left');
        applySkin(uiPrefs.skin==='glass'?'glass':'claude');
        window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)||'overview'));
        window.addEventListener('beforeunload',e=>{if((ruleDraft!==null&&ruleDraft!==ruleBaseline)||[...ruleDrafts.values()].some(d=>d.raw!==d.baseline)||OxiEngine.isDirty()){e.preventDefault();e.returnValue='';}});
        navigate(location.hash.slice(1)||'overview');
      }

      init();
    })();
