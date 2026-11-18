/* DS Gestão V110 — Acessibilidade, Busca Rápida (Ctrl+K), Service Worker e Menu Lateral */

/* Fila leve de pós-renderização (substitui MutationObservers pesados em document.body) */
window._dsPostRenderFns = window._dsPostRenderFns || [];
(function(){
  var rafId = 0;
  window.dsSchedulePostRender = function(){
    if(rafId) return;
    rafId = requestAnimationFrame(function(){
      rafId = 0;
      var list = window._dsPostRenderFns || [];
      for(var i=0;i<list.length;i++){
        try{ list[i](); }catch(e){}
      }
    });
  };
  ['render','renderHoje','renderClientes','renderCobranca','renderProducao','renderCalendario','renderTarefasPendentes','switchTab','openModal','openDayModal'].forEach(function(fnName){
    var orig = window[fnName];
    if(typeof orig === 'function'){
      window[fnName] = function(){
        var r = orig.apply(this, arguments);
        window.dsSchedulePostRender();
        return r;
      };
    }
  });
})();

(function(){
  const SKIP={BUTTON:1,A:1,INPUT:1,SELECT:1,TEXTAREA:1,LABEL:1,SUMMARY:1};
  function fix(root){
    (root.querySelectorAll?root.querySelectorAll('[onclick]'):[]).forEach(el=>{
      if(SKIP[el.tagName]||el.hasAttribute('data-a11y')) return;
      el.setAttribute('data-a11y','1');
      if(!el.hasAttribute('role')) el.setAttribute('role','button');
      if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0');
    });
  }
  document.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ') && e.target.getAttribute && e.target.getAttribute('data-a11y')==='1'){
      e.preventDefault(); e.target.click();
    }
  });
  window._dsPostRenderFns.push(function(){ fix(document); });
  fix(document);
})();

(function(){
  const $$ = id => document.getElementById(id);
  const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const pad = n => String(n).padStart(2,'0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  /* ---- Indicadores e gráfico do painel Hoje ---- */
  let lastBarsHtml = '';
  function v34Dashboard(){
    if(!$$('kpi-semana')) return;
    const t = now(), y = t.getFullYear(), m = t.getMonth()+1, d = t.getDate();
    const today = new Date(y, m-1, d);
    const dow = (today.getDay()+6)%7;               // segunda = 0
    const monday = new Date(y, m-1, d-dow);
    const weekStart = isoOf(monday), weekEnd = isoOf(today);
    const mesPrefix = `${y}-${pad(m)}`;
    const ativos = (clientes||[]).filter(c => c.status==='ativo');

    const semana = (entregas||[]).filter(e => e.dataEntrega>=weekStart && e.dataEntrega<=weekEnd).length;
    $$('kpi-semana').textContent = semana;
    $$('kpi-semana-sub').textContent = `${weekStart.slice(8)}/${weekStart.slice(5,7)} a ${weekEnd.slice(8)}/${weekEnd.slice(5,7)}`;

    $$('kpi-ativos').textContent = ativos.length;
    $$('kpi-ativos-sub').textContent = `${(clientes||[]).length - ativos.length} inativos`;

    const mes = (entregas||[]).filter(e => (e.dataEntrega||'').startsWith(mesPrefix)).length;
    $$('kpi-mes').textContent = mes;
    $$('kpi-mes-sub').textContent = `publicações registradas em ${pad(m)}/${y}`;


    // gráfico: últimos 14 dias
    const days = [];
    for(let i=13;i>=0;i--){ const dt = new Date(y,m-1,d-i); days.push({iso:isoOf(dt), dd:pad(dt.getDate())}); }
    const counts = days.map(x => (entregas||[]).filter(e=>e.dataEntrega===x.iso).length);
    const max = Math.max(1, ...counts);
    const barsHtml = days.map((x,i)=>{
      const pct = counts[i] ? Math.max(8, Math.round(counts[i]/max*100)) : 0;
      return `<div class="bcol" title="${x.dd}: ${counts[i]} entrega(s)">
        <div class="btrack"><div class="bar ${counts[i]?'':'zero'}" style="height:${pct}%"></div></div>
        <span class="blbl">${x.dd}</span><b>${counts[i]||''}</b></div>`;
    }).join('');
    if(barsHtml !== lastBarsHtml){ lastBarsHtml = barsHtml; $$('prod-bars').innerHTML = barsHtml; }
    const total14 = counts.reduce((a,b)=>a+b,0);
    $$('chart-total').textContent = `${total14} entrega(s) no período`;
    if(!total14 && lastBarsHtml !== 'empty'){ lastBarsHtml = 'empty'; $$('prod-bars').innerHTML = '<div class="chart-empty">Nenhuma entrega registrada nos últimos 14 dias.</div>'; }
  }
  const _renderHojeMain = renderHoje;
  renderHoje = function(){ _renderHojeMain(); v34Dashboard(); };
  const _switchTab = switchTab;
  switchTab = function(tab){ _switchTab(tab); if(tab==='hoje') v34Dashboard(); };
  // Os dados chegam de forma assíncrona: atualiza enquanto a aba Hoje estiver aberta
  v34Dashboard();

  /* ---- Paleta de comandos (Ctrl+K) e atalhos 1..7 na ordem exata do menu ---- */
  const TABS = [
    {id:'hoje', label:'Hoje', kw:'inicio artes', icon:'ti-sun'},
    {id:'calendario', label:'Calendário', kw:'agenda datas comemorativas', icon:'ti-calendar-month'},
    {id:'clientes', label:'Clientes', kw:'empresas cadastro', icon:'ti-users'},
    {id:'cobranca', label:'Financeiro', kw:'cobranca pagamentos despesas recibo', icon:'ti-cash'},
    {id:'producao', label:'Produção', kw:'semana mes lote', icon:'ti-user-check'},
    {id:'demandas', label:'Demandas', kw:'kanban briefing aprovacao', icon:'ti-layout-kanban'},
    {id:'tarefas', label:'Tarefas', kw:'pendentes checklist', icon:'ti-checkbox'},
  ];
  let cmdItems = [], cmdIdx = 0;

  function cmdBuild(q){
    const nq = norm(q.trim());
    const out = [];
    TABS.forEach(t => { if(!nq || norm(t.label+' '+(t.kw||'')).includes(nq)) out.push({icon:t.icon, label:`Ir para ${t.label}`, sub:'Seção', run:()=>switchTab(t.id)}); });
    (clientes||[]).filter(c => !nq || norm(c.empresa||'').includes(nq)).slice(0,30).forEach(c => {
      out.push({icon:'ti-building-store', label:c.empresa, sub:c.status==='ativo'?'Cliente':'Inativo', run:()=>{ switchTab('clientes'); openModal(c.id); }});
    });
    try{ if(window.v68Extra) window.v68Extra(nq,out); }catch(e){}
    return out;
  }
  function cmdRender(){
    const list = $$('cmdk-list');
    cmdItems = cmdBuild($$('cmdk-input').value);
    if(cmdIdx >= cmdItems.length) cmdIdx = 0;
    list.innerHTML = cmdItems.length ? cmdItems.map((it,i)=>`
      <div class="cmdk-item ${i===cmdIdx?'on':''}" role="option" data-i="${i}">
        <i class="ti ${it.icon}"></i><span>${esc(it.label)}</span><small>${esc(it.sub)}</small>
      </div>`).join('') : '<div class="cmdk-empty">Nada encontrado.</div>';
    const on = list.querySelector('.cmdk-item.on'); if(on) on.scrollIntoView({block:'nearest'});
  }
  window.v34OpenCmdk = function(){
    const bg = $$('cmdk-bg'); bg.style.display = 'flex';
    const inp = $$('cmdk-input'); inp.value=''; cmdIdx=0; cmdRender(); inp.focus();
  };
  function cmdClose(){ $$('cmdk-bg').style.display = 'none'; }
  function cmdRun(i){
    const it = cmdItems[i]; if(!it) return;
    cmdClose(); it.run();
  }
  $$('cmdk-input').addEventListener('input', ()=>{ cmdIdx=0; cmdRender(); });
  $$('cmdk-input').addEventListener('keydown', e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); cmdIdx=Math.min(cmdIdx+1,cmdItems.length-1); cmdRender(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); cmdIdx=Math.max(cmdIdx-1,0); cmdRender(); }
    else if(e.key==='Enter'){ e.preventDefault(); cmdRun(cmdIdx); }
  });
  $$('cmdk-list').addEventListener('click', e=>{ const el=e.target.closest('.cmdk-item'); if(el) cmdRun(+el.dataset.i); });
  $$('cmdk-bg').addEventListener('click', e=>{ if(e.target===e.currentTarget) cmdClose(); });

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---- Atalhos de teclado ---- */
  const overlayOpen = () => document.querySelector('.modal-bg.open, .sz-modal-bg.open, .confirm-bg.open, .recibo-bg.open, .v100-modal:not([hidden]), #cmdk-bg[style*="flex"]');
  document.addEventListener('keydown', e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
      e.preventDefault();
      if($$('cmdk-bg').style.display==='flex') cmdClose(); else v34OpenCmdk();
      return;
    }
    if(e.key==='Escape' && $$('cmdk-bg').style.display==='flex'){ cmdClose(); return; }
    const tag = (document.activeElement||{}).tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(document.activeElement||{}).isContentEditable) return;
    if(overlayOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if(n>=1 && n<=TABS.length){ switchTab(TABS[n-1].id); }
  });
})();

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ═══ v59 — tema, menu flutuante, ficha do cliente ═══ */
(function(){
  /* ── tema ── */
  window.setTheme=function(){
    document.documentElement.setAttribute('data-theme','dark');
    try{localStorage.setItem('ds-theme','dark');}catch(e){}
    var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content','#0F1114');
  };
  window.toggleTheme=function(){ window.setTheme(); };
  window.setTheme();

  /* ── menu flutuante: dicas, "mais ações" ── */
  document.querySelectorAll('nav.tabs .tab').forEach(function(t){
    var s=t.querySelector('span:not(.tab-badge)'); var lbl=s?s.textContent.trim():'';
    if(lbl){t.setAttribute('data-tip',lbl); t.setAttribute('aria-label',lbl);}
  });
  var search=document.querySelector('.v34-search');
  if(search){search.setAttribute('data-tip','Buscar (Ctrl+K)'); search.setAttribute('aria-label','Buscar');}
  var act=document.querySelector('.hdr-actions');
  if(act){
    var logout=act.querySelector('button[onclick="handleLogout()"]');
    var more=document.createElement('div'); more.className='hdr-more'; more.id='hdr-more';
    var tg=document.createElement('button'); tg.type='button'; tg.className='btn';
    tg.setAttribute('data-tip','Mais ações'); tg.setAttribute('aria-label','Mais ações'); tg.innerHTML='<i class="ti ti-dots"></i>';
    var pop=document.createElement('div'); pop.className='hdr-more-pop';
    var bs=document.getElementById('backup-status'); if(bs) pop.appendChild(bs);
    ['.btn-wpp','.btn-pdf','.btn-rel','.btn-rel-cfg','.btn-pix-cfg','.btn-bkp','.btn-rst'].forEach(function(sel){
      var b=act.querySelector(sel); if(b){b.removeAttribute('data-tip'); pop.appendChild(b);}
    });
    more.appendChild(tg); more.appendChild(pop);
    act.insertBefore(more,logout||null);
    tg.addEventListener('click',function(e){e.stopPropagation(); more.classList.toggle('open');});
    document.addEventListener('click',function(e){ if(!more.contains(e.target)) more.classList.remove('open'); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') more.classList.remove('open'); });
    pop.addEventListener('click',function(){ more.classList.remove('open'); });
  }
})();

/* ── ficha do cliente: cor, ícone, capa, foto escura ── */
var CLI_COLORS=['#626B7A','#E8742F','#D14B4B','#C93C9A','#8A4FE0','#5B5BD6','#4F8FE0','#2FA39B','#3FA564','#8CBF1F','#E0B21F','#E58B1B'];
var CLI_ICONS=['building-store','shopping-bag','tools-kitchen-2','burger','heartbeat','dental','barbell','scissors','home','car','school','camera','diamond','glasses','shirt','paw','palette','device-mobile','rocket','truck'];
var apCor='', apIcone='';
var pendingCapaFile=null, pendingCapaUrl='', pendingLogoDarkFile=null, pendingLogoDarkUrl='';

function apBuild(){
  var sw=document.getElementById('ap-sw'), ic=document.getElementById('ap-ic');
  if(sw && !sw.children.length){
    sw.innerHTML=CLI_COLORS.map(function(h){return '<button type="button" data-c="'+h+'" style="background:'+h+'" aria-label="Cor '+h+'" onclick="apSetCor(\''+h+'\')"></button>';}).join('');
  }
  if(ic && !ic.children.length){
    ic.innerHTML=CLI_ICONS.map(function(n){return '<button type="button" data-i="'+n+'" aria-label="'+n+'" onclick="apSetIcone(\''+n+'\')"><i class="ti ti-'+n+'"></i></button>';}).join('');
  }
}
function apMark(){
  document.querySelectorAll('#ap-sw button').forEach(function(b){b.classList.toggle('on',b.dataset.c===apCor);});
  document.querySelectorAll('#ap-ic button').forEach(function(b){b.classList.toggle('on',b.dataset.i===apIcone);});
}
function apSetCor(h){apCor=(apCor===h?'':h); apMark();}
function apSetIcone(n){apIcone=(apIcone===n?'':n); apMark();}
function apThumb(id,src,fallbackIcon){
  var el=document.getElementById(id); if(!el) return;
  el.innerHTML=src?'<img src="'+esc(src)+'" alt="">':'<i class="ti ti-'+esc(fallbackIcon)+'"></i>';
}
function apCapa(src){
  var el=document.getElementById('capa-preview'); if(!el) return;
  if(src){el.style.backgroundImage="url('"+String(src).replace(/'/g,'%27')+"')"; el.classList.add('has-img');}
  else{el.style.backgroundImage=''; el.classList.remove('has-img');}
  var r=document.getElementById('capa-remove'); if(r) r.style.display=src?'inline':'none';
}
function apReset(c){
  apBuild();
  apCor=(c&&c.cor)||''; apIcone=(c&&c.icone)||'';
  pendingCapaFile=null; pendingCapaUrl='';
  pendingLogoDarkFile=null; pendingLogoDarkUrl='';
  var rd=document.getElementById('logo-dark-remove-btn'); if(rd) rd.style.display='none';
  apMark();
}
function handleLogoDarkUpload(e){
  var f=e.target.files[0]; if(!f) return;
  pendingLogoDarkFile=f;
  var r=new FileReader();
  r.onload=function(ev){apThumb('logo-dark-preview',ev.target.result,'moon'); var b=document.getElementById('logo-dark-remove-btn'); if(b) b.style.display='inline-flex';};
  r.readAsDataURL(f); e.target.value='';
}
function removeLogoDark(){
  pendingLogoDarkFile=null; pendingLogoDarkUrl='';
  apThumb('logo-dark-preview','','moon');
  var b=document.getElementById('logo-dark-remove-btn'); if(b) b.style.display='none';
}
function handleCapaUpload(e){
  var f=e.target.files[0]; if(!f) return;
  pendingCapaFile=f;
  var r=new FileReader();
  r.onload=function(ev){apCapa(ev.target.result);};
  r.readAsDataURL(f); e.target.value='';
}
function removeCapa(){ pendingCapaFile=null; pendingCapaUrl=''; apCapa(''); }
