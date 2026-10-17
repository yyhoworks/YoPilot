/* Display names and purpose groups. Never changes configuration tags or ordering. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.YoPilotPresentation=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const names={
    cn_domains:'国内域名',foreign_domains:'海外域名',custom_cn:'自定义国内域名',
    pt_sites:'自定义海外站点',pt_trackers:'PT 追踪服务器',force_cn:'国内直连白名单',
    force_fake:'强制 FakeIP 域名',force_real:'强制真实 IP 域名',blocked:'域名黑名单',
    pcdn_domains:'PCDN 域名过滤',suppress_a:'IPv4 记录过滤',suppress_aaaa:'IPv6 记录过滤',
    ddns_domains:'动态域名（DDNS）',cn_ip:'国内 IP 地址',direct_ip:'直连 IP 地址',
    fake_ip:'FakeIP 地址范围',allowed_devices:'允许接入的设备',match_allowed:'设备准入匹配',
    local_domains:'局域网域名',cdn_domains:'CDN 下载域名',cdn_selector:'CDN 地址优选',
    learned_real:'已学习的真实 IP 域名',learned_fake:'已学习的 FakeIP 域名',
    learn_real:'记录真实 IP 域名',learn_fake:'记录 FakeIP 域名',
    cache_main:'主缓存',cache_real_entry:'真实 IP 入口缓存',cache_unlisted:'未分类域名缓存',
    cache_cn:'国内缓存',cache_foreign:'海外缓存',cache_ecs:'ECS 缓存',
    forward_cn:'国内解析组',forward_foreign:'海外解析组',forward_ecs:'海外 ECS 解析组',
    forward_fake:'FakeIP 解析组',forward_local:'局域网解析组',ecs_preset:'ECS 子网处理',
    fallback_foreign:'海外解析主备回退',fallback_real:'真实 IP 主备回退',
    fallback_cn_proxy:'国内与代理主备回退',fallback_unknown:'未分类域名主备回退',
    nodata:'空记录应答',blocked_response:'本地拦截应答',
    seq_cn_raw:'国内原始解析流程',seq_foreign_raw:'海外原始解析流程',seq_ecs_raw:'ECS 原始解析流程',
    seq_cn_positive:'国内正向结果校验',seq_cn_ip_positive:'国内 IP 结果校验',seq_ecs_positive:'ECS 正向结果校验',
    seq_foreign_verified:'海外结果校验流程',seq_force_real:'强制真实 IP 流程',seq_foreign_real:'海外真实 IP 流程',
    seq_fake:'FakeIP 应答流程',seq_real_mark:'真实 IP 标记流程',seq_confirm_proxy:'代理解析确认流程',
    seq_confirm_proxy_hint:'代理解析提示流程',seq_cn_proxy_primary:'国内优先解析流程',seq_cn_unknown_primary:'未分类国内优先流程',
    seq_cn_proxy:'国内代理分流流程',seq_unknown:'未分类域名分流流程',seq_proxy_policy:'代理解析策略',
    seq_cached_proxy:'代理缓存解析流程',seq_real_policy:'真实 IP 解析策略',
    seq_main:'主解析流程',seq_real_entry:'真实 IP 入口流程',seq_unlisted:'未分类域名流程',
    seq_local:'局域网解析流程',query_log:'DNS 查询记录',rules_download:'规则文件下载',
    rules_reload:'规则数据重载',rules_refresh:'规则更新流程',maintenance:'定时维护',
    udp_lan:'局域网 UDP 入口',tcp_lan:'局域网 TCP 入口',
    udp_real:'真实 IP UDP 入口',tcp_real:'真实 IP TCP 入口'
  };
  const definitions=[
    {id:'domestic',name:'国内域名与地址',note:'国内域名、国内 IP 与地理分类',tone:'sage',icon:'globe',tags:['cn_domains','cn_ip']},
    {id:'custom',name:'白名单与自定义',note:'直连白名单、真实 IP、站点与下载规则',tone:'accent',icon:'check',tags:['custom_cn','pt_sites','pt_trackers','force_cn','force_real','ddns_domains','cdn_domains','learned_real']},
    {id:'overseas',name:'海外域名',note:'海外域名与非国内地理分类',tone:'slate',icon:'branch',tags:['foreign_domains']},
    {id:'fake',name:'FakeIP 与学习名单',note:'强制 FakeIP、地址范围与动态学习',tone:'ochre',icon:'spark',tags:['force_fake','fake_ip','learned_fake']},
    {id:'filter',name:'拦截与记录类型过滤',note:'域名黑名单、PCDN 与 IPv4 / IPv6 过滤',tone:'crimson',icon:'shield',tags:['blocked','pcdn_domains','suppress_a','suppress_aaaa']},
    {id:'network',name:'本地网络与设备',note:'局域网域名、接入设备与直连地址',tone:'slate',icon:'network',tags:['local_domains','allowed_devices','direct_ip']},
    {id:'other',name:'其他规则源',note:'未设置用途的集合，保留原始名称',tone:'slate',icon:'layers',tags:[]}
  ];
  function name(value){const tag=typeof value==='string'?value:value?.tag;return names[tag]||tag||'未命名';}
  function group(p){
    const exact=definitions.find(g=>g.tags.includes(p.tag));if(exact)return exact.id;
    // Only use explicit type / file evidence; arbitrary user tags remain uncategorized.
    if(p.type==='adguard_rule')return 'filter';
    const files=[...(Array.isArray(p.args?.files)?p.args.files:[]),p.args?.file].filter(v=>typeof v==='string');
    if(files.some(f=>/(?:^|\/)(?:geosite_cn|geoip_cn)\.[^/]+$/.test(f)))return 'domestic';
    if(files.some(f=>/(?:^|\/)geosite_non_cn\.[^/]+$/.test(f)))return 'overseas';
    return 'other';
  }
  function groups(plugins){return definitions.map(g=>({...g,items:plugins.filter(p=>group(p)===g.id)})).filter(g=>g.items.length);}
  function upstream(u,index=0){
    if(typeof u==='string')return addressName(u)||'DNS 节点 '+(index+1);
    const known={ali:'阿里 DNS',tencent:'腾讯 DNS',gzmobile:'贵州移动 DNS',google:'Google DNS',cloudflare:'Cloudflare DNS','google-ecs':'Google ECS DNS','mihomo-fake':'Mihomo FakeIP'};
    return known[u?.tag]||u?.tag||addressName(u?.addr)||'DNS 节点 '+(index+1);
  }
  function addressName(addr){if(!addr)return '';if(addr.includes('223.5.5.5'))return '阿里 DNS';if(addr.includes('119.29.29.29'))return '腾讯 DNS';if(addr.includes('dns.google'))return 'Google DNS';if(addr.includes('cloudflare-dns.com'))return 'Cloudflare DNS';return '';}
  const iconPaths={
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    check:'<path d="m5 12 4 4L19 6"/>',branch:'<circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="m9 11 7-5M9 13l7 5"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>',
    network:'<rect x="8" y="3" width="8" height="6" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><path d="M12 9v4H6v3m6-3h6v3"/>',
    layers:'<path d="m3 7 9-4 9 4-9 4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>'
  };
  function icon(key){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[key]||iconPaths.layers)+'</svg>';}
  return {name,group,groups,upstream,icon,definitions};
});
