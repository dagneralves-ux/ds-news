/* DS Gestão V100. Camada de UX aditiva: preserva funções, dados e esquema do Supabase. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const safe=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const tday=()=>typeof todayDs==='function'?todayDs():new Date().toISOString().slice(0,10);
const pad=n=>String(n).padStart(2,'0');
const dsFmt=d=>{const a=String(d||'').split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:String(d||'');};
const getClients=()=>typeof clientes==='undefined'?[]:clientes||[];
const getTasks=()=>typeof tarefasPendAll==='undefined'?[]:tarefasPendAll||[];
const getPayments=()=>typeof pagamentos==='undefined'?[]:pagamentos||[];
const state={taskFilter:'todas',pcFilter:'todos',pcSearch:'',calView:'mes',finFilter:'todos',doneTasks:[],editingId:null,restoreFocus:null,undoTask:null,toastTimer:null};
try{state.calView=localStorage.getItem('ds_v100_cal_view')==='agenda'?'agenda':'mes';}catch(e){}
function callTab(tab){ if(typeof switchTab==='function')switchTab(tab); }
function priorityKey(){const u=typeof _appUserId==='string'&&_appUserId?_appUserId:'local';return 'ds_v100_priorities_'+u;}
function priorities(){try{return JSON.parse(localStorage.getItem(priorityKey())||'{}')||{};}catch(e){return {};}}
function priorityOf(id){return priorities()[String(id)]||'normal';}
function setPriority(id,priority){try{const p=priorities();p[String(id)]=['normal','alta','baixa'].includes(priority)?priority:'normal';localStorage.setItem(priorityKey(),JSON.stringify(p));}catch(e){}}
function priorityHtml(id){const p=priorityOf(id);const labels={alta:'Alta',normal:'Normal',baixa:'Baixa'};return `<span class="v100-priority-tag" data-level="${p}">${labels[p]||'Normal'}</span>`;}
function notify(text,undoTask=null){
  const bar=$('v100-snackbar');if(!bar)return;
  clearTimeout(state.toastTimer);state.undoTask=undoTask;
  $('v100-snackbar-msg').textContent=text;
  $('v100-snackbar-undo').hidden=!undoTask;
  bar.hidden=false;
  state.toastTimer=setTimeout(()=>v100HideSnackbar(),8500);
}
window.v100HideSnackbar=function(){const b=$('v100-snackbar');if(b)b.hidden=true;state.undoTask=null;clearTimeout(state.toastTimer);};
window.v100UndoTask=async function(){const t=state.undoTask;if(!t)return;state.undoTask=null;window.v100HideSnackbar();await v100ReopenTask(t.id,t);};
/* 2. Menu acessível, nomes e navegação por teclado. */
function syncNavigation(){
  document.querySelectorAll('header nav.tabs button.tab[data-tab]').forEach(b=>{
    const name=(b.querySelector('span:not(.tab-badge)')?.textContent||b.dataset.tab).trim();
    b.title=name;b.setAttribute('aria-label','Abrir '+name);
    if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
}
const nav=document.querySelector('header nav.tabs');
if(nav){nav.setAttribute('aria-label','Navegação principal');nav.addEventListener('keydown',e=>{
    if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
    const a=Array.from(nav.querySelectorAll('button.tab:not([disabled])'));
    const ix=a.indexOf(document.activeElement);if(ix<0)return;
    e.preventDefault();let ni=ix;
    if(e.key==='Home')ni=0;else if(e.key==='End')ni=a.length-1;
    else ni=(ix+((e.key==='ArrowDown'||e.key==='ArrowRight')?1:-1)+a.length)%a.length;
    a[ni]?.focus();
  });
}
syncNavigation();
/* 1. Prioridades: dependem exclusivamente de informações já disponíveis. */
function focusData(){
  const today=tday();const clients=getClients();
  let arts=0,invoices=0;
  try{arts=clientesNoDia(today).filter(c=>!isDone(today,c.id)).length;}catch(e){}
  try{const current=new Date(today+'T12:00:00');const mm=cbMesStr(current.getFullYear(),current.getMonth()+1);
    invoices=clients.filter(c=>c.status==='ativo'&&Number(c.diaCobranca)>0&&Number(c.diaCobranca)<=current.getDate()&&!getPagamento(c.id,mm)).length;
  }catch(e){}
  const overdue=getTasks().filter(t=>String(t.dataTarefa)<today).length;
  return {arts,invoices,overdue};
}
function renderFocus(){
  const host=$('v100-focus-grid');if(!host)return;
  const d=focusData();const tiles=[
    {id:'tasks',label:'Tarefas atrasadas',value:d.overdue,icon:'ti-alert-triangle',sub:d.overdue?'Organizar prioridades':'Nenhuma atrasada',to:'tarefas',urgent:d.overdue>0},
    {id:'finance',label:'Cobranças vencidas ou de hoje',value:d.invoices,icon:'ti-receipt',sub:d.invoices?'Conferir pagamentos':'Cobranças em dia',to:'cobranca',urgent:d.invoices>0}
  ];
  host.innerHTML=tiles.map(x=>`<button type="button" class="v100-focus-tile" data-focus="${x.id}" data-tone="${x.urgent?'urgent':'normal'}"><span class="v100-focus-label"><i class="ti ${x.icon}"></i>${x.label}</span><strong>${x.value}</strong><small>${x.sub}</small></button>`).join('');
}
$('v100-focus-grid')?.addEventListener('click',e=>{
  const id=e.target.closest('[data-focus]')?.dataset.focus;
  if(id==='arts')callTab('hoje');
  if(id==='tasks'){callTab('tarefas');v100SetTaskFilter('atrasadas');}
  if(id==='finance'){callTab('cobranca');v100SetFinanceFilter('todos');}
});
window.v100OpenFocusTab=()=>{
  const d=focusData();if(d.overdue){callTab('tarefas');v100SetTaskFilter('atrasadas');}
  else if(d.invoices){callTab('cobranca');v100SetFinanceFilter('todos');}
  else if(d.arts)callTab('hoje');else callTab('tarefas');
};
/* 4. Visão de agenda que reutiliza os dados e o modal do calendário. */
window.v100SetCalView=function(mode){
  state.calView=mode==='agenda'?'agenda':'mes';
  try{localStorage.setItem('ds_v100_cal_view',state.calView);}catch(e){}
  $('v100-calendar-grid').hidden=state.calView==='agenda';
  $('v100-calendar-agenda').hidden=state.calView!=='agenda';
  document.querySelectorAll('#v100-cal-segment button').forEach(b=>{const on=b.dataset.calendarView===state.calView;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  if(state.calView==='agenda'){
    renderAgenda();
    const cacheCurrent=typeof tarefasMesCache!=='undefined'&&tarefasMesCache.year===calYear&&tarefasMesCache.month===calMonth;
    if(!cacheCurrent&&typeof loadTarefasMes==='function'&&typeof calYear!=='undefined'&&typeof calMonth!=='undefined'){
      Promise.resolve(loadTarefasMes(calYear,calMonth)).then(renderAgenda).catch(e=>console.warn('Agenda: tarefas não carregadas',e));
    }
  }
};
function renderAgenda(){
  const host=$('v100-calendar-agenda');if(!host)return;
  if(typeof calYear==='undefined'||typeof calMonth==='undefined')return;
  const m=calMonth,y=calYear,days=new Date(y,m+1,0).getDate();
  const cache=typeof tarefasMesCache!=='undefined'&&tarefasMesCache.year===y&&tarefasMesCache.month===m?tarefasMesCache.data||{}:{};
  let holidays=[];try{holidays=szAllDates(y).filter(h=>h.m===m+1)}catch(e){}
  const dayNames=['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  let parts=[];
  for(let n=1;n<=days;n++){
    const ds=dateStr(y,m+1,n);let clients=[];
    try{clients=clientesNoDia(ds)}catch(e){}
    const tasks=cache[ds]||[];const h=holidays.filter(x=>x.d===n);
    if(!clients.length&&!tasks.length&&!h.length)continue;
    const done=clients.filter(c=>isDone(ds,c.id)).length;
    const chips=[
      clients.length?`<span class="v100-agenda-chip accent">${clients.length} arte${clients.length===1?'':'s'} · ${done} feita${done===1?'':'s'}</span>`:'',
      tasks.length?`<span class="v100-agenda-chip">${tasks.length} tarefa${tasks.length===1?'':'s'}</span>`:'',
      h.length?`<span class="v100-agenda-chip">${h.length} data${h.length===1?'':'s'} comemorativa${h.length===1?'':'s'}</span>`:''
    ].filter(Boolean).join('');
    const text=clients.length?clients.slice(0,2).map(c=>c.empresa).join(' · '):tasks.length?tasks.slice(0,2).map(x=>x.texto).join(' · '):h.map(x=>x.name).slice(0,2).join(' · ');
    parts.push(`<button type="button" class="v100-agenda-row" data-agenda-date="${ds}" aria-label="Ver detalhes de ${dsFmt(ds)}"><span class="v100-agenda-date"><strong>${n}</strong><span>${dayNames[new Date(y,m,n).getDay()]}</span></span><span><span class="v100-agenda-label">${safe(text)}</span><span class="v100-agenda-meta">${chips}</span></span><i class="ti ti-chevron-right" style="color:#73737b"></i></button>`);
  }
  host.innerHTML=parts.length?parts.join(''):'<div class="v100-agenda-empty"><i class="ti ti-calendar-off"></i> Nenhuma arte, tarefa ou data comemorativa registrada neste mês. Use os dias do calendário para programar atividades.</div>';
}
$('v100-calendar-agenda')?.addEventListener('click',e=>{const ds=e.target.closest('[data-agenda-date]')?.dataset.agendaDate;if(ds&&typeof openDayModal==='function')openDayModal(ds);});
const originalCal=window.renderCalMensal;
if(typeof originalCal==='function')window.renderCalMensal=function(){const r=originalCal.apply(this,arguments);if(state.calView==='agenda')renderAgenda();return r;};
const originalLoadMonth=window.loadTarefasMes;
if(typeof originalLoadMonth==='function')window.loadTarefasMes=async function(){const r=await originalLoadMonth.apply(this,arguments);if(state.calView==='agenda')renderAgenda();return r;};
window.v100SetCalView(state.calView);
/* 5. Produção: filtros visuais sem interferir nas entregas ou contadores. */
function applyProduction(){
  const cards=[...document.querySelectorAll('#pc-cards > .pc-card')];let visible=0;
  for(const c of cards){
    const pend=Number(c.dataset.v100Pending||0),late=Number(c.dataset.v100Late||0),done=c.dataset.v100Done==='true';
    const matches=state.pcFilter==='todos'||(state.pcFilter==='pendentes'&&pend>0)||(state.pcFilter==='atrasados'&&late>0)||(state.pcFilter==='concluidos'&&done);
    const name=norm(c.querySelector('.pc-card-name')?.textContent||'');
    c.hidden=!(matches&&name.includes(norm(state.pcSearch)));
    if(!c.hidden)visible++;
  }
  const hint=$('v100-production-hint');
  if(hint)hint.textContent=cards.length?`${visible} de ${cards.length} clientes exibidos · filtros aplicados ao período selecionado`:'Sem clientes com produção neste período.';
  const list=$('pc-cards');let empty=$('v100-pc-empty');
  if(!visible&&cards.length){if(!empty){empty=document.createElement('div');empty.id='v100-pc-empty';empty.className='v100-filter-empty';list?.appendChild(empty);}empty.textContent='Nenhum cliente encontrado com este filtro.';}
  else empty?.remove();
}
window.v100SetProductionFilter=function(type){state.pcFilter=['todos','pendentes','atrasados','concluidos'].includes(type)?type:'todos';document.querySelectorAll('[data-pc-filter]').forEach(b=>{const on=b.dataset.pcFilter===state.pcFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});applyProduction();};
window.v100ProductionSearch=function(v){state.pcSearch=v||'';applyProduction();};
const originalProduction=window.renderPorCliente;
if(typeof originalProduction==='function')window.renderPorCliente=function(){const r=originalProduction.apply(this,arguments);applyProduction();return r;};
/* 6. Filtro por situação no financeiro, sem alterar cálculos nem resultados. */
function applyFinancial(){
  const list=$('cb-list'),bar=$('v100-finance-filter');if(!list||!bar)return;
  const hasGroups=list.querySelector('.cb-section,.cb-compact-panel');bar.hidden=!hasGroups;
  const groups=Array.from(list.children);
  for(const item of groups){
    const hdr=item.querySelector('.cb-section-title');let status='';
    if(item.classList.contains('cb-compact-panel'))status='avencer';
    else if(hdr?.classList.contains('cb-sec-atrasado'))status='atrasados';
    else if(hdr?.classList.contains('cb-sec-hoje'))status='hoje';
    else if(hdr?.classList.contains('cb-sec-pago'))status='recebidos';
    else if(hdr?.classList.contains('cb-sec-avencer'))status='avencer';
    item.hidden=(state.finFilter!=='todos'&&status!==state.finFilter);
  }
  document.querySelectorAll('[data-fin-filter]').forEach(b=>{const on=b.dataset.finFilter===state.finFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
}
window.v100SetFinanceFilter=function(v){state.finFilter=['todos','atrasados','hoje','avencer','recebidos'].includes(v)?v:'todos';applyFinancial();};
const originalFinance=window.renderCobranca;
if(typeof originalFinance==='function')window.renderCobranca=function(){const r=originalFinance.apply(this,arguments);applyFinancial();return r;};
const originalSwitch=window.switchTab;
if(typeof originalSwitch==='function')window.switchTab=function(tab){const r=originalSwitch.apply(this,arguments);syncNavigation();if(tab==='hoje')renderFocus();if(tab==='calendario'&&state.calView==='agenda')renderAgenda();if(tab==='producao')applyProduction();if(tab==='cobranca')applyFinancial();return r;};
/* 3. Filtros, prioridade local e edição rápida de tarefas. */
function taskMatch(t){const d=tday(),ds=String(t.dataTarefa||'');
  if(state.taskFilter==='hoje')return ds===d;
  if(state.taskFilter==='atrasadas')return ds<d;
  if(state.taskFilter==='proximas')return ds>d;
  return true;
}
function enhancePendingRows(){
  const list=$('tp-list');if(!list)return;
  const tasks=getTasks(),byId=new Map(tasks.map(t=>[String(t.id),t]));
  list.querySelectorAll('.tp-row').forEach(row=>{
    const id=String(row.id||'').replace(/^tp-row-/,'');const t=byId.get(id);if(!t)return;
    if(!row.querySelector('.v100-task-extras')){
      const ex=document.createElement('div');ex.className='v100-task-extras';
      ex.innerHTML=priorityHtml(id)+`<button type="button" class="v100-edit" data-v100-edit="${safe(id)}" aria-label="Editar tarefa"><i class="ti ti-pencil"></i> Editar</button>`;
      row.insertBefore(ex,row.querySelector('.tp-del-btn')||null);
    }
  });
  const counter=$('v100-tp-all-count');if(counter)counter.textContent=`${tasks.length}`;
}
function applyTaskFilter(){
  const list=$('tp-list'),done=$('v100-done-list'),stats=$('tp-stats-bar');if(!list||!done)return;
  document.querySelectorAll('[data-tp-filter]').forEach(b=>{const on=b.dataset.tpFilter===state.taskFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  if(state.taskFilter==='concluidas'){
    list.hidden=true;done.hidden=false;if(stats)stats.hidden=true;
    renderCompleted();return;
  }
  list.hidden=false;done.hidden=true;if(stats)stats.hidden=false;
  const byId=new Map(getTasks().map(t=>[String(t.id),t]));let visible=0;
  list.querySelectorAll('.tp-group').forEach(g=>{
    let groupVisible=0;
    g.querySelectorAll('.tp-row').forEach(r=>{
      const id=String(r.id||'').replace(/^tp-row-/,'');const t=byId.get(id);
      const show=t&&taskMatch(t);r.hidden=!show;
      if(show){groupVisible++;visible++;}
    });
    g.hidden=groupVisible===0;
  });
  list.querySelector('#v100-filter-empty')?.remove();
  const nativeEmpty=list.querySelector('.tp-empty');
  if(nativeEmpty)nativeEmpty.hidden=state.taskFilter!=='todas';
  if(visible===0&&state.taskFilter!=='todas'){
    const blank=document.createElement('div');blank.className='v100-filter-empty';blank.id='v100-filter-empty';
    blank.innerHTML='<i class="ti ti-circle-check"></i>Nenhuma tarefa encontrada neste filtro.';list.appendChild(blank);
  }
}
function renderCompleted(){
  const target=$('v100-done-list');if(!target||state.taskFilter!=='concluidas')return;
  if(!state.doneTasks.length){target.innerHTML='<div class="v100-filter-empty"><i class="ti ti-circle-check"></i>Nenhuma tarefa concluída registrada.</div>';return;}
  target.innerHTML=state.doneTasks.map(t=>{
    const client=getClients().find(c=>String(c.id)===String(t.clienteId));
    return `<div class="v100-completed-row"><i class="ti ti-circle-check v100-done-icon"></i><div class="v100-completed-text">${safe(t.texto)}<small>${dsFmt(t.dataTarefa)}${client?' · '+safe(client.empresa):''}</small></div>${priorityHtml(t.id)}<button class="v100-edit" type="button" data-v100-edit="${safe(t.id)}"><i class="ti ti-pencil"></i> Editar</button><button class="v100-ghost" type="button" data-v100-reopen="${safe(t.id)}"><i class="ti ti-rotate"></i> Reabrir</button></div>`;
  }).join('');
}
async function loadCompleted(){
  if(typeof tarefasUseDb!=='undefined'&&tarefasUseDb&&typeof sb!=='undefined'&&sb){
    try{
      const {data:{user}}=await authUser();if(!user)throw new Error('Sessão não encontrada');
      const {data,error}=await sb.from('tarefas').select('*').eq('user_id',user.id).eq('concluida',true).order('data_tarefa',{ascending:false}).limit(100);
      if(error)throw error;
      state.doneTasks=(data||[]).map(r=>({id:r.id,texto:r.texto,clienteId:r.cliente_id||null,concluida:true,dataTarefa:r.data_tarefa}));
      renderCompleted();return;
    }catch(e){console.warn('Concluídas: consulta não disponível',e);}
  }
  const result=[];if(typeof tarefasLocalGetAll==='function'){
    for(const [ds,arr] of Object.entries(tarefasLocalGetAll()||{}))for(const t of arr||[])if(t.concluida)result.push({...t,dataTarefa:ds});
  }
  state.doneTasks=result.sort((a,b)=>String(b.dataTarefa).localeCompare(String(a.dataTarefa))).slice(0,100);
  renderCompleted();
}
window.v100SetTaskFilter=async function(mode){
  state.taskFilter=['todas','hoje','atrasadas','proximas','concluidas'].includes(mode)?mode:'todas';
  if(state.taskFilter==='concluidas'){
    const d=$('v100-done-list');if(d)d.innerHTML='<div class="v100-filter-empty">Carregando tarefas concluídas...</div>';
    applyTaskFilter();await loadCompleted();
  }else applyTaskFilter();
};
$('tp-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-v100-edit]');if(b)v100OpenTaskModal(b.dataset.v100Edit);});
$('v100-done-list')?.addEventListener('click',e=>{
  const edit=e.target.closest('[data-v100-edit]');if(edit){v100OpenTaskModal(edit.dataset.v100Edit);return;}
  const reopen=e.target.closest('[data-v100-reopen]');if(reopen)v100ReopenTask(reopen.dataset.v100Reopen);
});
const originalTaskRender=window.renderTarefasPendentes;
if(typeof originalTaskRender==='function')window.renderTarefasPendentes=function(){
  const result=originalTaskRender.apply(this,arguments);enhancePendingRows();applyTaskFilter();renderFocus();return result;
};
const originalTaskLoad=window.loadTarefasPendentes;
if(typeof originalTaskLoad==='function')window.loadTarefasPendentes=async function(){
  const result=await originalTaskLoad.apply(this,arguments);
  renderFocus();return result;
};
function getTask(id){return getTasks().find(t=>String(t.id)===String(id))||state.doneTasks.find(t=>String(t.id)===String(id));}
window.v100OpenTaskModal=function(id){
  const t=getTask(id);if(!t){notify('Tarefa não encontrada. Atualize a lista.');return;}
  state.editingId=String(id);state.restoreFocus=document.activeElement;
  $('v100-edit-text').value=t.texto||'';
  $('v100-edit-date').value=t.dataTarefa||tday();
  $('v100-edit-priority').value=priorityOf(id);
  const sel=$('v100-edit-client');sel.innerHTML='<option value="">Sem cliente</option>';
  getClients().filter(c=>c.status==='ativo'||String(c.id)===String(t.clienteId)).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.empresa;sel.add(o);});
  sel.value=t.clienteId||'';
  $('v100-task-modal').hidden=false;
  $('v100-edit-text').focus();
};
window.v100CloseTaskModal=function(){
  $('v100-task-modal').hidden=true;state.editingId=null;
  if(state.restoreFocus&&typeof state.restoreFocus.focus==='function'&&document.contains(state.restoreFocus))state.restoreFocus.focus();
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('v100-task-modal')?.hidden){v100CloseTaskModal();}});
window.v100SaveTaskEdit=async function(){
  const id=state.editingId,t=getTask(id);if(!id||!t)return;
  const text=$('v100-edit-text').value.trim(),ds=$('v100-edit-date').value,clientId=$('v100-edit-client').value||null,prio=$('v100-edit-priority').value;
  if(!text||!tarefaDataValida(ds)){notify('Preencha descrição e data válida.');return;}
  const oldDate=t.dataTarefa;
  const saveBtn=$('v100-save-task');saveBtn.disabled=true;
  try{
    if(typeof tarefasUseDb!=='undefined'&&tarefasUseDb&&typeof sb!=='undefined'&&sb&&!id.startsWith('loc_')){
      const {error}=await sb.from('tarefas').update({texto:text,data_tarefa:ds,cliente_id:clientId}).eq('id',id);
      if(error)throw error;
    }else{
      const all=tarefasLocalGetAll();let item=null;
      for(const [date,arr]of Object.entries(all)){
        const idx=(arr||[]).findIndex(x=>String(x.id)===id);
        if(idx!==-1){item=arr.splice(idx,1)[0];if(!arr.length)delete all[date];break;}
      }
      if(!item)throw new Error('Tarefa não localizada no armazenamento local.');
      all[ds]=all[ds]||[];all[ds].push({...item,texto:text,clienteId:clientId});
      tarefasLocalSetAll(all);
    }
    t.texto=text;t.dataTarefa=ds;t.clienteId=clientId;
    setPriority(id,prio);
    v100CloseTaskModal();
    renderTarefasPendentes();
    await Promise.allSettled([sincronizarCalendarioTarefa(oldDate),oldDate!==ds?sincronizarCalendarioTarefa(ds):Promise.resolve()]);
    if(typeof loadTarefasHoje==='function')await loadTarefasHoje();
    if(state.taskFilter==='concluidas')await loadCompleted();
    renderFocus();notify('Tarefa atualizada com sucesso.');
  }catch(err){notify('Não foi possível salvar: '+(err?.message||'erro de conexão'));}
  finally{saveBtn.disabled=false;}
};
window.v100ReopenTask=async function(id,snapshot){
  id=String(id);const t=getTask(id)||snapshot;if(!t)return;
  try{
    if(typeof tarefasUseDb!=='undefined'&&tarefasUseDb&&typeof sb!=='undefined'&&sb&&!id.startsWith('loc_')){
      const {error}=await sb.from('tarefas').update({concluida:false}).eq('id',id);if(error)throw error;
    }else{
      const all=tarefasLocalGetAll();const item=(all[t.dataTarefa]||[]).find(x=>String(x.id)===id);
      if(!item)throw new Error('Tarefa não encontrada no armazenamento local');
      item.concluida=false;tarefasLocalSetAll(all);
    }
    await Promise.allSettled([sincronizarCalendarioTarefa(t.dataTarefa),typeof loadTarefasHoje==='function'?loadTarefasHoje():Promise.resolve()]);
    if(typeof loadTarefasPendentes==='function')await loadTarefasPendentes();
    if(state.taskFilter==='concluidas')await loadCompleted();
    notify('Tarefa reaberta.');
  }catch(err){notify('Erro ao reabrir: '+(err?.message||'não foi possível sincronizar'));}
};
const origAddTask=window.addTarefaNova;
if(typeof origAddTask==='function')window.addTarefaNova=async function(){
  const before=new Set(getTasks().map(x=>String(x.id))),priority=$('v100-new-priority')?.value||'normal';
  const r=await origAddTask.apply(this,arguments);
  const newer=getTasks().filter(x=>!before.has(String(x.id)));
  newer.forEach(t=>setPriority(t.id,priority));
  if(newer.length){$('v100-new-priority').value='normal';renderTarefasPendentes();}
  return r;
};
const origAddHome=window.addTarefaHoje;
if(typeof origAddHome==='function')window.addTarefaHoje=async function(){
  const before=new Set(getTasks().map(x=>String(x.id))),priority=$('v100-home-priority')?.value||'normal';
  const r=await origAddHome.apply(this,arguments);
  const newer=getTasks().filter(x=>!before.has(String(x.id)));
  newer.forEach(t=>setPriority(t.id,priority));
  if(newer.length){$('v100-home-priority').value='normal';if($('sec-tarefas')?.classList.contains('active'))renderTarefasPendentes();}
  return r;
};
const origDonePending=window.toggleTarefaPend;
if(typeof origDonePending==='function')window.toggleTarefaPend=async function(id){
  const t=getTasks().find(x=>String(x.id)===String(id));
  const copy=t?{...t}:null;
  const r=await origDonePending.apply(this,arguments);
  if(copy)setTimeout(()=>{
    if(!getTasks().some(x=>String(x.id)===String(id))){notify('Tarefa concluída.',copy);renderFocus();}
  },440);
  return r;
};
const origDoneToday=window.toggleTarefaHoje;
if(typeof origDoneToday==='function')window.toggleTarefaHoje=async function(id){
  const t=typeof tarefasHoje!=='undefined'?tarefasHoje.find(x=>String(x.id)===String(id)):null;
  const wasDone=!!t?.concluida;const copy=t?{...t,dataTarefa:tday()}:null;
  const r=await origDoneToday.apply(this,arguments);
  if(copy&&!wasDone&&t?.concluida){notify('Tarefa concluída.',copy);renderFocus();}
  return r;
};
for(const name of ['delTarefaPend','delTarefaHoje','delTarefaDia']){
  const fn=window[name];if(typeof fn!=='function')continue;
  window[name]=async function(id){
    if(!window.confirm('Excluir esta tarefa permanentemente?'))return;
    const r=await fn.apply(this,arguments);
    renderFocus();return r;
  };
}
/* Reage a mudanças de dados com segurança. */
const origRefresh=window.refreshData;
if(typeof origRefresh==='function')window.refreshData=async function(){const r=await origRefresh.apply(this,arguments);renderFocus();return r;};
const origRenderToday=window.renderHoje;
if(typeof origRenderToday==='function')window.renderHoje=function(){const r=origRenderToday.apply(this,arguments);renderFocus();return r;};
/* V104: prioridade mudou em outro aparelho (chega pela sincronização) */
window.addEventListener('ds-cfg-pulled',function(e){
  if(!e.detail||e.detail.key!=='ds_v100_priorities')return;
  try{if(document.getElementById('sec-tarefas')?.classList.contains('active')&&typeof window.renderTarefasPendentes==='function')window.renderTarefasPendentes();}catch(err){}
  try{renderFocus();}catch(err){}
});
renderFocus();syncNavigation();
})();
