const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function quality(){const window={YoPilotOverview:{},YoPilotPathModel:require('../yopilot-path-model.js'),YoPilotPresentation:require('../yopilot-presentation.js')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../yopilot-quality.js'),'utf8'),{window});return window.YoPilotOverview.quality;}
test('upstream quality retains policy, names, protocols and zero-sample distinctions',()=>{
 const rows=[{p:{tag:'forward_cn',args:{upstreams:[{addr:'udp://223.5.5.5:53'}],concurrent:3,response_selection:'consensus'}},calls:100,responses:10,average:20,errors:0,timeouts:0},{p:{tag:'unknown<bad>',args:{upstreams:[]}},calls:0,responses:0,average:null,errors:null,timeouts:0}];
 const before=JSON.stringify(rows),html=quality()({upstreams:rows});assert.equal(JSON.stringify(rows),before);for(const pattern of [/负向共识/,/阿里 DNS/,/UDP/,/暂无样本/,/100%/,/unknown&lt;bad&gt;/])assert.match(html,pattern);
});
test('unavailable request counters do not become fabricated zero shares',()=>{
 const html=quality()({upstreams:[{p:{tag:'dns',args:{}},calls:null,responses:null,average:null,errors:null,timeouts:null}]});assert.match(html,/暂无份额/);assert.match(html,/未配置 DNS 目标/);assert.doesNotMatch(html,/NaN|Infinity/);
});
