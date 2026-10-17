/* Runtime rules are separate from bootstrap configuration and local drafts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OxiDynamicModel=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function rules(value,kind='full'){
    if(!['full','domain'].includes(kind))throw Error('请选择精确域名或域名及子域名');
    const rows=Array.isArray(value)?value:typeof value==='string'?value.split(/\r?\n/):[];
    if(rows.some(v=>typeof v!=='string'))throw Error('每条规则必须是文本');
    const result=[...new Set(rows.map(v=>v.trim()).filter(Boolean))];
    if(!result.length)throw Error('请至少输入一条规则');
    if(result.length>200||result.join('\n').length>65536)throw Error('每次最多提交 200 条、64KB 规则，请分批操作');
    // Do not emulate Rust regex validation with JavaScript: the server is authoritative.
    return {rules:result,rule_kind:kind};
  }
  function page(value,cursor=0){
    if(!value||value.ok!==true||!Number.isSafeInteger(value.total)||value.total<0||!Array.isArray(value.rules)||value.rules.some(x=>typeof x!=='string'))throw Error('运行时规则响应格式不正确，请重试或打开原生页面');
    if(value.next_cursor!==null&&(!Number.isSafeInteger(value.next_cursor)||value.next_cursor<=cursor))throw Error('运行时分页游标无效，请刷新列表');
    return value;
  }
  function mutation(value){
    if(!value||value.ok!==true||['added','removed','total'].some(k=>!Number.isSafeInteger(value[k])||value[k]<0))throw Error('写入结果格式无法确认，请刷新列表核对，不要重复提交');
    return value;
  }
  function describe(rule){
    const m=rule.match(/^(full|domain|keyword|regexp):(.*)$/s);
    return m?{kind:({full:'精确域名',domain:'域名及子域名',keyword:'关键词',regexp:'正则表达式'})[m[1]],value:m[2]}:{kind:'原始规则',value:rule};
  }
  return {rules,page,mutation,describe};
});
