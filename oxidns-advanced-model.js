/* Pure contracts for destructive operations, scoped history and SSE framing. */
(function(root){
  'use strict';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const safeTag=v=>typeof v==='string'&&v.length<=64&&/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?)*$/.test(v)&&!/^qs\.(exec|match|cron)\./.test(v);
  function path(field){
    const s=String(field).split(' -> ')[0],parts=[];let rest=s;
    while(rest){const m=/^(?:\.?(\w+)|\[(\d+)\])/.exec(rest);if(!m)throw Error('引用路径无法安全编辑：'+field);const k=m[1]??Number(m[2]);if(['__proto__','prototype','constructor'].includes(k))throw Error('不安全的引用路径');parts.push(k);rest=rest.slice(m[0].length);}
    if(parts[0]!=='args')throw Error('引用不在插件参数内：'+field);return parts;
  }
  function substitute(value,oldTag,newTag){
    if(typeof value!=='string')throw Error('引用不是字符串，请在完整参数中处理');
    if(value===oldTag)return newTag;
    const jump=/^(jump|goto)\s+(\S+)$/.exec(value.trim());if(jump?.[2]===oldTag)return jump[1]+' '+newTag;
    const escaped=oldTag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return value.replace(new RegExp('(^|[^A-Za-z0-9_.-])\\$'+escaped+'(?=$|[^A-Za-z0-9_.-])','g'),(_,prefix)=>prefix+'$'+newTag);
  }
  function mutatePlugin(config,edges,tag,{replacement='',removeRefs=false,rename=''}={}){
    const next=copy(config),plugin=next.plugins.find(p=>p.tag===tag);
    if(!plugin)throw Error('插件已不存在，请刷新草稿');
    if(config.include?.length)throw Error('配置含 include 文件，引用可能位于外部文件；请先在原生配置中核对关联文件');
    const incoming=edges.filter(e=>e.target_tag===tag&&(rename||e.source_tag!==tag));
    if(rename&&(!safeTag(rename)||next.plugins.some(p=>p.tag===rename)))throw Error('新标识无效或已存在');
    const candidate=next.plugins.find(p=>p.tag===replacement);
    if(replacement&&(!candidate||candidate.tag===tag||candidate.type!==plugin.type))throw Error('请选择同类型的其他插件作为替代');
    if(incoming.length&&!replacement&&!rename&&!removeRefs)throw Error('插件仍被引用；请先替换或处理引用');
    const removals=[];
    for(const edge of incoming){
      const owner=next.plugins.find(p=>p.tag===edge.source_tag);if(!owner)throw Error('引用来自 include 或未知插件，无法安全修改');
      const parts=path(edge.field);let parent=owner;for(const k of parts.slice(0,-1)){parent=parent?.[k];if(!parent)throw Error('引用路径与当前草稿不一致');}
      const key=parts.at(-1);
      if(removeRefs){
        if(edge.field.includes(' -> ')||!Array.isArray(parent)||!['domain_set_tags','executors','ip_set_tags','matchers','provider_tags','sets'].includes(parts.at(-2)))throw Error('入口 / 执行动作不能直接移除，请替换引用或手动编辑');
        removals.push({parent,key});
      }else{const before=parent[key],after=substitute(before,tag,rename||replacement);if(before===after&&!String(before).includes(rename||replacement))throw Error('引用无法自动替换：'+edge.field);parent[key]=after;}
    }
    removals.sort((a,b)=>b.key-a.key).forEach(({parent,key})=>parent.splice(key,1));
    if(rename)plugin.tag=rename;else next.plugins=next.plugins.filter(p=>p.tag!==tag);
    return next;
  }
  function historyKey(base,path){return 'yopilot-config-history:'+new URL(base).origin+':'+String(path||'');}
  function remember(rows,file,status='observed'){
    if(!file?.version||typeof file.content!=='string')throw Error('配置快照缺少版本或原文');
    const old=rows.find(r=>r.version===file.version);
    return [{...old,version:file.version,content:file.content,format:file.format||'yaml',at:old?.at||Date.now(),status:status==='observed'?old?.status||status:status},...rows.filter(r=>r.version!==file.version)].slice(0,20);
  }
  function upgradeOptions(v){
    const o={};for(const k of ['repository','bundle','outbound','socks5','target','github_token'])if(v[k]?.trim())o[k]=v[k].trim();
    for(const k of ['allow_prerelease','force','cleanup'])o[k]=!!v[k];
    if(o.bundle&&!['auto','full','standard','minimal'].includes(o.bundle))throw Error('无效的升级包类型');
    if(o.repository&&!/^[\w.-]+\/[\w.-]+$/.test(o.repository))throw Error('仓库格式应为 owner/repository');
    return o;
  }
  function sseParser(onEvent){
    let buffer='';
    return chunk=>{
      buffer+=chunk;if(buffer.length>2*1024*1024)throw Error('单条事件过大，已停止实时流；请使用历史查询');
      let match;while((match=/\r?\n\r?\n/.exec(buffer))){const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);let event='message';const data=[];
        for(const line of frame.split(/\r?\n/)){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));}
        if(data.length)onEvent({event,data:JSON.parse(data.join('\n'))});
      }
    };
  }
  const api={safeTag,path,substitute,mutatePlugin,historyKey,remember,upgradeOptions,sseParser};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.OxiAdvancedModel=api;
})(typeof window==='object'?window:globalThis);
