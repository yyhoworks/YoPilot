/* Pure draft transformation shared by the rule editor and preservation checks. */
(function(root){
  'use strict';
  const lines=text=>String(text).split(/\r?\n/).filter(line=>line.trim()!=='');
  const replaceLines=(args,key,text)=>{
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('规则参数必须是对象');
    const next=JSON.parse(JSON.stringify(args));
    next[key]=lines(text);
    return next;
  };
  const api={lines,replaceLines};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OxiRuleTools=api;
})(typeof window==='object'?window:globalThis);
