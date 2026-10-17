const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('all appearance controls have one home without removing skin, theme or motion features',()=>{
  const html=read('oxidns-console-prototype.html');
  const top=html.slice(html.indexOf('<div class="top-actions-dock">'),html.indexOf('<div class="bg-customizer-popover"'));
  assert.doesNotMatch(top,/skin-quick-pill|data-skin-switch|id="theme-toggle"|id="btn-toggle-particles"/);
  assert.match(top,/id="btn-open-bg-customizer"/);
  assert.match(top,/id="refresh-button"/);
  const panel=html.slice(html.indexOf('<div class="bg-customizer-popover"'),html.indexOf('<!-- 主导航与内容区 -->'));
  for(const id of ['theme-toggle','btn-toggle-particles'])assert.equal((panel.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
  assert.match(panel,/data-skin-switch="claude"/);
  assert.match(panel,/data-skin-switch="glass"/);
});

test('layout picker offers only vertical and horizontal while the sidebar keeps its collapse action',()=>{
  const source=read('yopilot-navigation.js');
  assert.match(source,/\[\['left','垂直'\],\['top','水平'\]\]/);
  assert.doesNotMatch(source,/\['collapsed','折叠'\]/);
  assert.match(source,/mode==='collapsed'\?'left':mode/);
  assert.match(source,/chooseLayout\(document\.body\.dataset\.nav==='collapsed'\?'left':'collapsed'\)/);
});

test('compact sidebar selects a real icon for both materials and restores the complete wordmark',()=>{
  const source=read('yopilot-navigation.js');
  const fn=source.slice(source.indexOf('  function syncBrand(){'),source.indexOf('  new MutationObserver(syncBrand)'));
  for(const tone of ['light','dark']){
    const mark={src:`http://fixture/assets/yopilot-brand/yopilot-metal-${tone}.png`},image={};
    const body={dataset:{nav:'collapsed'}};
    const context={document:{body,querySelector:()=>mark},brandImage:image};
    vm.runInNewContext(fn+';syncBrand();',context);
    assert.equal(image.src,`http://fixture/assets/yopilot-brand/yopilot-metal-icon-${tone}.png`);
    for(const nav of ['left','top']){body.dataset.nav=nav;vm.runInNewContext('syncBrand()',context);assert.equal(image.src,mark.src);}
  }
  assert.match(read('yopilot-completion.css'),/body\[data-nav=collapsed\] \.yp-sidebar-brand img\{[^}]*object-fit:contain/);
  assert.match(read('yopilot-completion.css'),/@media\(min-width:901px\)\{body\[data-nav=left\] \.top-header-grid \.brand-box/);
});

test('metrics span the complete workspace and preserve long Prometheus lines in a local scroller',()=>{
  const css=read('yopilot-refinements.css');
  assert.match(css,/\.yp-metrics\{grid-column:1\/-1;width:100%;/);
  assert.match(css,/\.yp-metrics pre\{[^}]*max-width:100%[^}]*overflow:auto;white-space:pre;overflow-wrap:normal/);
  assert.match(css,/\.yp-metrics \.ob-filter \.ob-search-label\{flex-basis:100%\}/);
});
