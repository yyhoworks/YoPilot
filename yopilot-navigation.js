/* Layout previews, grouped navigation, and interruptible motion. */
(() => {
  'use strict';
  const nav=document.querySelector('#side-nav'),sidebar=document.querySelector('#sidebar'),header=document.querySelector('.top-header-grid'),shell=document.querySelector('.shell-grid');
  if(!nav||!sidebar)return;
  const P=window.YoPilotPresentation;
  const routeGroups={queries:['queries','logs','history'],upstreams:['listeners','upstreams','hosts','response','strategies','dependencies'],rules:['rules','integrations','files'],system:['system','connection','tasks','runtime','metrics','config']};
  const arrow='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>';
  const collapse='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m5-10-2 2 2 2"/></svg>';
  const entries=[...nav.querySelectorAll('.nav-item')];
  const menuEntries=[];let openItem=null,closeTimer;
  nav.replaceChildren();
  const indicator=document.createElement('span');indicator.className='yp-nav-indicator';indicator.setAttribute('aria-hidden','true');nav.append(indicator);
  const sections=[['观测',['overview','queries']],['DNS 配置',['upstreams','rules']],['系统',['plugins','system']]];
  for(const [label,routes] of sections){
    const section=document.createElement('div');section.className='yp-nav-section';
    const title=document.createElement('div');title.className='sidebar-section-label';title.textContent=label;section.append(title);
    for(const route of routes){
      const main=entries.find(b=>b.dataset.route===route);if(!main)continue;
      main.title=main.textContent.trim();
      const entry=document.createElement('div');entry.className='yp-nav-entry';entry.append(main);
      const children=routeGroups[route];
      if(children){
        const toggle=document.createElement('button');toggle.type='button';toggle.className='yp-nav-expand';toggle.innerHTML=arrow;toggle.setAttribute('aria-label','展开'+main.textContent.trim()+'菜单');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','yp-nav-'+route);
        const menu=document.createElement('div');menu.className='yp-nav-submenu';menu.id='yp-nav-'+route;menu.setAttribute('aria-label',main.textContent.trim()+'子菜单');
        children.forEach(r=>{const b=document.createElement('button');b.type='button';b.dataset.route=r;b.textContent=window.OxiEngine.routeInfo[r][0];menu.append(b);});
        const label=document.createElement('div');label.className='yp-nav-menu-label';label.textContent=main.textContent.trim();menu.prepend(label);
        const record={entry,main,toggle,menu};menuEntries.push(record);
        toggle.onclick=event=>{event.stopPropagation();openItem===record?closeMenus():openMenu(record);};
        main.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(openItem===record)closeMenus();else openMenu(record);});
        main.addEventListener('keydown',event=>{if(floating()&&event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();openMenu(record);menu.querySelector('button')?.focus();}});
        toggle.addEventListener('keydown',event=>{if(floating()&&event.key==='Tab'&&!event.shiftKey&&openItem===record){event.preventDefault();menu.querySelector('button')?.focus();}});
        entry.addEventListener('pointerenter',event=>{if(floating()&&event.pointerType!=='touch')openMenu(record);});
        entry.addEventListener('pointerleave',()=>{if(floating())scheduleClose();});
        entry.addEventListener('focusout',event=>{if(!entry.contains(event.relatedTarget)&&!menu.contains(event.relatedTarget))scheduleClose();});
        menu.addEventListener('pointerenter',()=>clearTimeout(closeTimer));menu.addEventListener('pointerleave',scheduleClose);
        menu.addEventListener('focusout',event=>{if(!menu.contains(event.relatedTarget)&&!entry.contains(event.relatedTarget))scheduleClose();});
        menu.onkeydown=event=>{const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(event.key==='Escape'){event.stopPropagation();closeMenus();main.focus();}};
        menu.addEventListener('keydown',event=>{if(event.key!=='Tab'||!floating())return;const buttons=[...menu.querySelectorAll('button')];if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();closeMenus();main.focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();closeMenus();const next=entries[entries.indexOf(main)+1];(next||document.querySelector('#global-search-input')).focus();}});
        entry.append(toggle,menu);
      }
      section.append(entry);
    }
    nav.append(section);
  }
  function floating(){return innerWidth>900&&['top','collapsed'].includes(document.body.dataset.nav);}
  function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(closeMenus,160);}
  function closeMenus(){clearTimeout(closeTimer);menuEntries.forEach(r=>{r.entry.classList.remove('is-open');r.menu.classList.remove('is-open');r.menu.inert=true;r.toggle.setAttribute('aria-expanded','false');r.main.setAttribute('aria-expanded','false');});openItem=null;}
  function positionMenu(r){
    const box=r.main.getBoundingClientRect(),horizontal=document.body.dataset.nav==='top';
    const width=Math.min(264,innerWidth-24);r.menu.style.width=width+'px';
    r.menu.style.maxHeight=Math.min(480,innerHeight-24)+'px';
    let left=horizontal?box.left:box.right+12,top=horizontal?box.bottom+10:box.top-6;
    if(left+width>innerWidth-12)left=horizontal?innerWidth-width-12:Math.max(12,box.left-width-12);
    r.menu.style.left=Math.max(12,left)+'px';r.menu.style.top=Math.max(12,Math.min(top,innerHeight-r.menu.offsetHeight-12))+'px';
  }
  function openMenu(r){
    clearTimeout(closeTimer);if(openItem===r)return;closeMenus();openItem=r;
    if(floating())positionMenu(r);
    r.menu.inert=false;r.menu.classList.add('is-open');r.entry.classList.add('is-open');
    r.toggle.setAttribute('aria-expanded','true');r.main.setAttribute('aria-expanded','true');
  }
  const tools=document.createElement('div');tools.className='yp-sidebar-tools';tools.innerHTML='<span>控制台</span><button type="button" aria-label="折叠左侧导航" title="折叠左侧导航">'+collapse+'</button>';sidebar.prepend(tools);
  const brand=document.createElement('div');brand.className='yp-sidebar-brand';
  const brandImage=document.querySelector('#brand-mark').cloneNode();brandImage.removeAttribute('id');brandImage.removeAttribute('width');brandImage.removeAttribute('height');brand.append(brandImage);sidebar.prepend(brand);
  function syncBrand(){
    const source=document.querySelector('#brand-mark').src;
    // A compact rail uses the dedicated icon asset, never a crop of the wordmark.
    brandImage.src=document.body.dataset.nav==='collapsed'?source.replace(/yopilot-metal-(light|dark)\.png/,'yopilot-metal-icon-$1.png'):source;
  }
  new MutationObserver(syncBrand).observe(document.querySelector('#brand-mark'),{attributes:true,attributeFilter:['src']});
  tools.querySelector('button').onclick=()=>chooseLayout(document.body.dataset.nav==='collapsed'?'left':'collapsed');
  const panel=document.querySelector('#bg-customizer-popover'),setting=panel.querySelector('.oxi-nav-setting'),select=setting.querySelector('select');
  select.className='yp-legacy-nav-select';select.setAttribute('aria-hidden','true');select.tabIndex=-1;select.insertAdjacentHTML('beforeend','<option value="collapsed">折叠导航</option>');
  const picker=document.createElement('section');picker.className='yp-layout-picker';
  picker.innerHTML='<h3>布局</h3><div class="yp-layout-options" role="group" aria-label="导航布局">'+[['left','垂直'],['top','水平']].map(([id,label])=>`<button type="button" data-yp-layout="${id}" aria-pressed="false"><span class="yp-layout-preview yp-preview-${id}" aria-hidden="true"><i></i><b></b><em></em></span><strong>${label}</strong></button>`).join('')+'</div><p>垂直布局可用侧栏按钮收起；水平布局使用居中顶部导航。设置自动保存。</p>';
  setting.querySelector('label').remove();setting.append(picker);panel.querySelector('.bcp-title').after(setting);
  picker.querySelectorAll('[data-yp-layout]').forEach(b=>b.onclick=()=>chooseLayout(b.dataset.ypLayout));
  let layoutMotion;
  function chooseLayout(mode){
    if(mode===document.body.dataset.nav)return;
    const page=document.querySelector('#page-content'),before=page.getBoundingClientRect();
    const change=()=>{closeMenus();select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}));syncLayout();};
    change();
    // Animate the content, keeping the theme controls immediately clickable.
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      layoutMotion?.cancel();const after=page.getBoundingClientRect();
      layoutMotion=page.animate([{opacity:.75,transform:`translateX(${before.left-after.left}px)`},{opacity:1,transform:'translateX(0)'}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  }
  function syncLayout(){
    const mode=document.body.dataset.nav;
    closeMenus();
    const bar=header.querySelector('.navbar-content');
    if(mode==='top'){if(sidebar.parentNode!==bar)bar.insertBefore(sidebar,bar.querySelector('.top-main-bar'));}else if(sidebar.parentNode!==shell)shell.prepend(sidebar);
    menuEntries.forEach(r=>{const portal=floating();r.menu.classList.toggle('yp-nav-flyout',portal);if(portal){document.body.append(r.menu);r.main.setAttribute('aria-controls',r.menu.id);}else{r.entry.append(r.menu);r.menu.style.removeProperty('width');r.menu.style.removeProperty('max-height');r.main.removeAttribute('aria-controls');}});
    picker.querySelectorAll('[data-yp-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ypLayout===(mode==='collapsed'?'left':mode))));
    syncBrand();
    tools.querySelector('button').setAttribute('aria-expanded',String(mode!=='collapsed'));
    tools.querySelector('button').setAttribute('aria-label',mode==='collapsed'?'展开左侧导航':'折叠左侧导航');
    tools.querySelector('button').title=mode==='collapsed'?'展开左侧导航':'折叠左侧导航';
    requestAnimationFrame(syncSelection);
    syncHeader();
  }
  function syncSelection(){
    const active=nav.querySelector('.nav-item.active');if(!active)return;
    const n=nav.getBoundingClientRect(),entry=active.parentElement.getBoundingClientRect();
    indicator.style.width=active.offsetWidth+'px';indicator.style.height=active.offsetHeight+'px';
    indicator.style.transform=`translate(${entry.left-n.left+active.offsetLeft}px,${entry.top-n.top+active.offsetTop}px)`;
    indicator.style.opacity='1';
    menuEntries.flatMap(r=>[...r.menu.querySelectorAll('[data-route]')]).forEach(b=>{const current=b.dataset.route===location.hash.slice(1);b.classList.toggle('active',current);if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(!floating()){const record=menuEntries.find(r=>[...r.menu.querySelectorAll('[data-route]')].some(b=>b.dataset.route===location.hash.slice(1)));if(record&&openItem!==record)openMenu(record);}
  }
  new MutationObserver(syncLayout).observe(document.body,{attributes:true,attributeFilter:['data-nav']});
  // The reference expands the whole bar on scroll, not just its submenu.
  // Hysteresis avoids flicker around the top boundary. Text is never scaled.
  let headerWide=false,scrollFrame=0;
  function syncHeader(){
    const horizontal=document.body.dataset.nav==='top'&&innerWidth>900;
    headerWide=horizontal&&(scrollY>64||(headerWide&&scrollY>16));
    header.classList.toggle('yp-header-wide',headerWide);
  }
  window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;syncHeader();});},{passive:true});
  header.addEventListener('transitionend',event=>{if(event.target===header){syncSelection();if(openItem&&floating())positionMenu(openItem);}});
  // Observe only the six primary choices, avoiding refresh-driven page animation.
  entries.forEach(b=>new MutationObserver(syncSelection).observe(b,{attributes:true,attributeFilter:['class']}));
  window.addEventListener('resize',()=>{closeMenus();syncLayout();syncSelection();});new ResizeObserver(syncSelection).observe(nav);
  window.addEventListener('scroll',event=>{if(openItem&&floating()&&!openItem.menu.contains(event.target))closeMenus();},true);
  document.addEventListener('click',event=>{if(!nav.contains(event.target)&&!menuEntries.some(r=>r.menu.contains(event.target)))closeMenus();});
  let pageMotion;
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-route]');if(!target)return;
    const before=location.hash;
    requestAnimationFrame(()=>{
      if(before===location.hash)return;closeMenus();syncSelection();
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){pageMotion?.cancel();pageMotion=document.querySelector('#page-content').animate([{opacity:.72,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.16,1,.3,1)'});}
    });
  },true);
  const shade=document.createElement('div');shade.className='yp-appearance-shade';shade.setAttribute('aria-hidden','true');document.body.append(shade,panel);
  const appearanceButton=document.querySelector('#btn-open-bg-customizer');
  let panelWasOpen=false;
  const syncPanel=()=>{
    const open=panel.classList.contains('open');shade.classList.toggle('open',open);appearanceButton.setAttribute('aria-expanded',String(open));panel.inert=!open;
    if(open!==panelWasOpen){
      document.querySelector('.master-container').inert=open;
      if(open){closeMenus();panel.setAttribute('aria-modal','true');panel.querySelector('#btn-close-bg-popover').focus({preventScroll:true});}
      else{panel.removeAttribute('aria-modal');appearanceButton.focus({preventScroll:true});}
    }
    panelWasOpen=open;
  };
  new MutationObserver(syncPanel).observe(panel,{attributes:true,attributeFilter:['class']});
  shade.onclick=()=>{panel.classList.remove('open');appearanceButton.focus();};
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenus();});
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){panel.classList.remove('open');event.preventDefault();return;}
    if(event.key!=='Tab')return;
    const controls=[...panel.querySelectorAll('button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
    if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
  });
  syncLayout();syncPanel();
})();
