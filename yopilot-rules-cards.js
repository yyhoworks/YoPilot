/* Scheme C is a configuration-only projection; all actions reuse the rule editor. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.YoPilotRuleCards=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(rows,all,{model:M,presentation:P,label,dirty=()=>false}){
    const action=(p,text,tab,extra='')=>`<button type="button" class="glass-btn yrc-action ${extra}" data-mg-rule="${esc(p.tag)}" data-mg-tab="${tab}" aria-label="${esc(text+'：'+P.name(p))}">${text}</button>`;
    function card(p){
      const s=M.source(p),files=M.files(p),sets=M.array(p.args?.sets),users=M.users(p,all);
      const dynamic=p.type==='dynamic_domain_set',geo=M.fields[p.type]==='selectors';
      const unit=dynamic?'条初始化规则':geo?'个分类选择器':'条内联规则';
      const filePrimary=files.length&&!dynamic&&!geo;
      const scope=dynamic?'已学习数量请查看运行列表':files.length?'外部文件内容未读取':'不含引用集合中的内容';
      const filename=files[0]?.split(/[\\/]/).pop();
      return `<article class="yrc-card" data-yrc-tag="${esc(p.tag)}">
        <div class="yrc-card-top"><div class="yrc-name"><h3><button type="button" data-mg-rule="${esc(p.tag)}" aria-label="${esc('查看规则源：'+P.name(p))}">${esc(P.name(p))}</button></h3><code>${esc(p.tag)}</code>${dirty(p.tag)?'<small class="yrc-dirty">有未保存文本</small>':''}</div><span class="yrc-type">${esc(label(p.type))}</span></div>
        <dl class="yrc-facts"><div><dt>来源与规模</dt><dd>${filePrimary?files.length+' 个文件来源':s.count+' '+unit}</dd><small>${esc(s.label)}</small><small>${filePrimary?s.count+' '+unit:files.length?`${files.length} 个${dynamic?'运行文件':'文件来源'}`:'无外部文件'}${sets.length?' · '+sets.length+' 个集合引用':''}</small>${filename?`<small class="yrc-file" title="${esc(files[0])}">${esc(filename)}${files.length>1?' 等 '+files.length+' 个文件':''}</small>`:''}</div><div><dt>配置引用</dt><dd class="${users.length?'is-used':'is-unused'}">${users.length?'已引用 · '+users.length+' 处':'未引用'}</dd><small>${esc(users.slice(0,2).map(p=>P.name(p)).join('、')||'暂无静态引用')}</small>${users.length>2?`<small>另有 ${users.length-2} 处，查看完整引用</small>`:''}</div></dl>
        <div class="yrc-links">${action(p,'来源与文件','source')}${action(p,'查看引用','refs')}</div>
        <footer class="yrc-card-foot"><p>${scope}</p><div class="yrc-actions">${dynamic?action(p,'已学习规则','runtime','yrc-runtime'):''}${action(p,dynamic?'编辑初始化':'编辑内容','content')}${action(p,'更新设置','update')}</div></footer>
      </article>`;
    }
    return `<div class="yrc-zones">${P.groups(rows).map(g=>`<section class="yrc-zone tone-${g.tone}" data-yrc-group="${g.id}" aria-labelledby="yrc-group-${g.id}"><header class="yrc-zone-head"><span class="yrc-icon">${P.icon(g.icon)}</span><div><div class="yrc-title-row"><h2 id="yrc-group-${g.id}">${esc(g.name)}</h2><span class="yrc-count">${g.items.length} 个规则源</span></div><p>${esc(g.note)}</p></div></header><div class="yrc-grid">${g.items.map(card).join('')}</div></section>`).join('')}</div>`;
  }
  return {render};
});
