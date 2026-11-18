/* DS Gestão V110 — Core Studio Engine */
/* ════════════════════════════════════════════
   DAGNER DESIGN v11 · Supabase + Auth + Dashboard
   Logo · Status · Contrato · Receita · Histórico
════════════════════════════════════════════ */

const DIAS  = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const DIAS_A= ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ── RESET / DATA DE INÍCIO ──
   Tudo que for de entregas/artes/concluídos ANTES desta data fica
   oculto em toda a aplicação (Hoje, Calendário, Dashboard, Produção),
   como se o histórico tivesse começado a partir daqui.
   Os dados antigos continuam guardados no Supabase (nada é apagado),
   só não aparecem mais — para mudar o ponto de corte, troque a data abaixo. */
const APP_START_DATE = '2026-07-01';
function isBlockedDs(ds){ return !!ds && ds < APP_START_DATE; }
function isBlockedDate(d){ return isBlockedDs(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); }

const CORES=[{c:'#E8EBF0',bg:'rgba(154,160,171,0.14)',bo:'rgba(154,160,171,0.3)',t:'#E8EBF0'}];
const cor = i => {
  const cl=(typeof clientes!=='undefined')?clientes[i]:null;
  if(cl&&cl.cor&&/^#[0-9a-fA-F]{6}$/.test(cl.cor)){
    const h=cl.cor, r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
    return {c:h,bg:`rgba(${r},${g},${b},0.14)`,bo:`rgba(${r},${g},${b},0.3)`,t:h};
  }
  return CORES[0];
};
/* extras da ficha do cliente (v59): vão para o Supabase quando as colunas existem; senão ficam neste aparelho */
const V59_EXTRA_KEY='ds_cli_extra_v59';
function v59ExtraAll(){ try{return JSON.parse(localStorage.getItem(V59_EXTRA_KEY)||'{}');}catch(e){return {};} }
function v59ExtraSave(id,x){ try{const all=v59ExtraAll(); all[id]=x; localStorage.setItem(V59_EXTRA_KEY,JSON.stringify(all));}catch(e){} }
function v59Missing(err){ return !!err && /column|schema cache|PGRST204|42703/i.test(String(err.message||'')+' '+String(err.code||'')); }
let v59Warned=false;
function v59Warn(){ if(v59Warned) return; v59Warned=true; try{toast('Cor e ícone do cliente ficaram salvos só neste aparelho (falta rodar o SQL v59 no Supabase).','err');}catch(e){} }
function v59X(r){
  if(r && ('cor' in r || 'icone' in r || 'capa_url' in r || 'logo_escuro_url' in r))
    return {cor:r.cor||'',icone:r.icone||'',capaUrl:r.capa_url||'',logoDarkUrl:r.logo_escuro_url||''};
  const e=v59ExtraAll()[r.id]||{};
  return {cor:e.cor||'',icone:e.icone||'',capaUrl:e.capaUrl||'',logoDarkUrl:e.logoDarkUrl||''};
}
/* V104: usuário vindo da sessão local (sem ida à rede a cada ação) */
async function authUser(){
  try{ const {data}=await sb.auth.getSession(); if(data&&data.session&&data.session.user) return {data:{user:data.session.user}}; }catch(e){}
  return sb.auth.getUser();
}
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmtBRL = v => 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

/* ─── STATE ─── */
let sb = null;
let clientes  = [];
let entregas  = []; // {id, cliente_id, data_entrega}
let pagamentos= []; // {id, clienteId, mesReferencia, valorPago, dataPagamento, formaPagamento, observacao}
let done      = new Set();
let tarefasHoje    = []; // tarefas do dia atual
let tarefasUseDb   = true; // fallback localStorage se tabela 'tarefas' não existir
let tarefasDia     = []; // tarefas do dia aberto no modal do calendário
let tarefasMesCache= {}; // {year, month, data:{ds:[...]}} — indicadores no calendário
let tarefasPendAll = []; // todas as tarefas pendentes (aba Tarefas)
let editId    = null;
let delId     = null;
let calYear, calMonth;
let dayModalDate = null;
let pendingLogoFile = null; // file object while editing
let pendingLogoUrl  = '';   // current logo url while editing
const now = () => new Date();
/* ─── UI STATE ─── */
let clientesFiltro = 'ativo';
let clientesOrdem  = 'nome';
let clientesBusca  = '';
let pcViewMode     = 'semana';
let pcMonthYear, pcMonthMonth;
let pcConfirmCallback = null;
let _lastHojePct  = -1;

/* ════════════════════════════════════
   SETUP / LOADING / INIT  (unchanged)
════════════════════════════════════ */
function saveSetup(){
  const url=document.getElementById('setup-url').value.trim();
  const key=document.getElementById('setup-key').value.trim();
  const err=document.getElementById('setup-err');
  err.style.display='none';
  if(!url.startsWith('https://')||!url.includes('.supabase.co')){
    err.textContent='URL inválida. Ex: https://xxxx.supabase.co';err.style.display='block';return;
  }
  if(!(key.startsWith('sb_publishable_')||key.startsWith('eyJ'))){
    err.textContent='Chave inválida. Use a "Publishable key" (sb_publishable_...).';err.style.display='block';return;
  }
  localStorage.setItem('ds_sb_url',url); localStorage.setItem('ds_sb_key',key);
  document.getElementById('setup-screen').style.display='none';
  initApp();
}
function showSetupError(msg){
  localStorage.removeItem('ds_sb_url'); localStorage.removeItem('ds_sb_key');
  hideLoading();
  document.getElementById('setup-screen').style.display='flex';
  const e=document.getElementById('setup-err'); e.textContent=''+msg; e.style.display='block';
}
function forceSetup(){
  hideLoading(); localStorage.removeItem('ds_sb_url'); localStorage.removeItem('ds_sb_key');
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('setup-screen').style.display='flex';
  document.getElementById('setup-err').style.display='none';
}
let _lt=null;
function showLoading(msg='Carregando...'){
  document.getElementById('loading-msg').textContent=msg;
  document.getElementById('loading-cancel').style.display='none';
  document.getElementById('loading-overlay').style.display='flex';
  clearTimeout(_lt);
  _lt=setTimeout(()=>{ document.getElementById('loading-cancel').style.display='inline-block'; document.getElementById('loading-msg').textContent=msg+' — demorando mais que o esperado'; },6000);
}
function hideLoading(){
  clearTimeout(_lt);
  document.getElementById('loading-overlay').style.display='none';
  document.getElementById('loading-cancel').style.display='none';
}
function showOfflineRetry(){
  showLoading('Sem conexão com o servidor — suas chaves foram mantidas. Tentando de novo...');
  setTimeout(()=>{ if(!_appUserId) initApp(); },8000);
}
async function initApp(){
  const url=localStorage.getItem('ds_sb_url'); const key=localStorage.getItem('ds_sb_key');
  if(!url||!key){ hideLoading(); document.getElementById('setup-screen').style.display='flex'; return; }
  try{ sb=window.supabase.createClient(url,key); }
  catch(e){ showSetupError('Chaves inválidas: '+e.message); return; }
  showLoading('Verificando sessão...');
  let timedOut=false;
  const timeout=setTimeout(()=>{ timedOut=true; showOfflineRetry(); },9000);
  try{
    const {data,error}=await sb.auth.getSession();
    if(timedOut) return; clearTimeout(timeout);
    if(error) throw error;
    if(data?.session) await enterApp(data.session.user);
    else { hideLoading(); document.getElementById('auth-screen').style.display='flex'; }
  }catch(e){ if(timedOut) return; clearTimeout(timeout); if(/fetch|network|failed|timeout|offline/i.test(String(e&&e.message))){ showOfflineRetry(); return; } showSetupError('Erro: '+(e.message||'verifique suas chaves.')); return; }
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_IN'&&session){ if(_appUserId===session.user.id) return; await enterApp(session.user); }
    else if(event==='SIGNED_OUT'){
      _appUserId=null; clientes=[]; done=new Set(); entregas=[]; pagamentos=[];
      document.getElementById('user-pill').style.display='none';
      document.getElementById('auth-screen').style.display='flex';
    }
  });
}
let authMode='login';
function showAuthTab(m){
  authMode=m;
  document.getElementById('tab-login').classList.toggle('active',m==='login');
  document.getElementById('tab-signup').classList.toggle('active',m==='signup');
  document.getElementById('signup-extra').style.display=m==='signup'?'block':'none';
  document.getElementById('auth-btn').textContent=m==='login'?'Entrar':'Criar conta';
  document.getElementById('auth-err').style.display='none';
  document.getElementById('auth-ok').style.display='none';
}
async function handleAuth(){
  const email=document.getElementById('auth-email').value.trim();
  const pass=document.getElementById('auth-password').value;
  const errEl=document.getElementById('auth-err'); const okEl=document.getElementById('auth-ok');
  errEl.style.display='none'; okEl.style.display='none';
  if(!email||!pass){errEl.textContent='Preencha e-mail e senha.';errEl.style.display='block';return;}
  const btn=document.getElementById('auth-btn'); btn.disabled=true; btn.textContent='Aguarde...';
  try{
    if(authMode==='signup'){
      const p2=document.getElementById('auth-pass2').value;
      if(pass!==p2) throw new Error('As senhas não coincidem.');
      if(pass.length<6) throw new Error('Senha deve ter ao menos 6 caracteres.');
      const {error}=await sb.auth.signUp({email,password:pass}); if(error) throw error;
      okEl.textContent='Conta criada! Verifique seu e-mail.'; okEl.style.display='block';
    } else {
      const {error}=await sb.auth.signInWithPassword({email,password:pass}); if(error) throw error;
    }
  }catch(e){
    const msgs={'Invalid login credentials':'E-mail ou senha incorretos.','Email not confirmed':'Confirme seu e-mail.','User already registered':'E-mail já cadastrado.'};
    errEl.textContent=msgs[e.message]||e.message; errEl.style.display='block';
  }finally{ btn.disabled=false; btn.textContent=authMode==='login'?'Entrar':'Criar conta'; }
}
async function handleLogout(){ await sb.auth.signOut(); document.getElementById('user-pill').style.display='none'; toast('Sessão encerrada.','inf'); }
let _appUserId=null;
function _cacheKey(){ return 'ds_cache_v56_'+_appUserId; }
function saveCache(){
  if(!_appUserId) return;
  try{ localStorage.setItem(_cacheKey(),JSON.stringify({clientes,entregas,pagamentos,t:Date.now()})); }catch(e){}
}
function loadCache(){
  try{
    const r=JSON.parse(localStorage.getItem(_cacheKey())||'null');
    if(r&&Array.isArray(r.clientes)){ clientes=r.clientes; entregas=r.entregas||[]; pagamentos=r.pagamentos||[]; return true; }
  }catch(e){}
  return false;
}
async function refreshData(silent){
  try{ await Promise.all([fetchClientes(), fetchEntregas(), loadTarefasHoje(), fetchPagamentos()]); }
  catch(e){ if(!silent) toast('Aviso: erro ao carregar — '+e.message,'err'); else console.warn('refresh:',e.message); return; }
  syncDoneFromEntregas();
  saveCache();
  render();
}
async function enterApp(user){
  window.dsGreetingName=String(user?.user_metadata?.first_name||user?.user_metadata?.full_name?.trim().split(/\s+/)[0]||'Dagner').slice(0,32);
  _appUserId=user.id;
  try{ var ru=user.user_metadata&&user.user_metadata.relat_url; if(ru&&!relatUrl()) localStorage.setItem('ds_relat_url',ru); }catch(e){}
  document.getElementById('auth-screen').style.display='none';
  const pill=document.getElementById('user-pill'); const lbl=document.getElementById('user-email-lbl');
  if(pill) pill.style.display='inline-flex'; if(lbl) lbl.textContent=user.email;
  setDoneUser(user.id); loadDone();
  loadBrandLogo();
  const cached=loadCache();
  if(!cached) showLoading('Carregando...');
  const t=now(); calYear=t.getFullYear(); calMonth=t.getMonth();
  if(cached){ render(); switchTab('hoje'); hideLoading(); }
  await refreshData(cached);
  if(!cached){ switchTab('hoje'); hideLoading(); }
  loadTarefasPendentes().catch(()=>{});
  renderSazonaisNoCalendario();
  loadTarefasMes(calYear,calMonth);
  requestNotifPermission();
  showTodayNotif();
  window.addEventListener('beforeunload',saveCache);
}
let _hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){ _hiddenAt=Date.now(); return; }
  // ao voltar para a aba: atualiza em segundo plano, sem tela de carregamento
  if(_appUserId && Date.now()-_hiddenAt>60000) refreshData(true);
});

/* ════════════════════════════════════
   SUPABASE CRUD (com paginação automática > 1.000 registros)
════════════════════════════════════ */
async function fetchAllSupabase(buildQuery, pageSize=1000){
  const all=[];
  for(let page=0; page<50; page++){
    const from=page*pageSize;
    const {data,error}=await buildQuery().range(from, from+pageSize-1);
    if(error) throw error;
    if(!data||!data.length) break;
    all.push(...data);
    if(data.length<pageSize) break;
  }
  return all;
}
async function fetchClientes(){
  const {data,error}=await sb.from('clientes').select('*').order('empresa',{ascending:true});
  if(error) throw error;
  clientes=(data||[]).map(r=>({
    id:r.id, empresa:r.empresa, responsavel:r.responsavel,
    telefone:r.telefone||'', qtdMidias:r.qtd_midias||0,
    dias:r.dias||[], observacoes:r.observacoes||'',
    logoUrl:r.logo_url||'', status:r.status||'ativo',
    instagram:r.instagram||'', valorMensal:r.valor_mensal||0,
    diaCobranca:r.dia_cobranca||0, criadoEm:r.criado_em||'', ...v59X(r)
  }));
}
async function fetchEntregas(){
  try{
    const data=await fetchAllSupabase(()=>
      sb.from('entregas').select('*')
        .gte('data_entrega', APP_START_DATE)
        .order('data_entrega',{ascending:false})
        .order('id',{ascending:false})
    );
    const seen=new Set();
    entregas=[];
    for(const r of data){
      if(!r||isBlockedDs(r.data_entrega)) continue;
      const k=`${r.cliente_id}_${r.data_entrega}`;
      if(seen.has(k)) continue;
      seen.add(k);
      entregas.push({id:r.id,clienteId:r.cliente_id,dataEntrega:r.data_entrega});
    }
  }catch(error){
    console.warn('entregas error:',error.message);
    entregas=[];
  }
}
async function fetchPagamentos(){
  try{
    const data=await fetchAllSupabase(()=>
      sb.from('pagamentos').select('*')
        .order('data_pagamento',{ascending:false})
        .order('id',{ascending:false})
    );
    pagamentos=(data||[]).map(r=>({
      id:r.id, clienteId:r.cliente_id, mesReferencia:r.mes_referencia,
      valorPago:r.valor_pago||0, dataPagamento:r.data_pagamento,
      formaPagamento:r.forma_pagamento||'pix', observacao:r.observacao||''
    }));
  }catch(error){
    console.warn('pagamentos error:',error.message);
    pagamentos=[];
  }
}

/* ── LEMBRETES (anotações por dia) ──
   Adicionados pelo Calendário (clicando num dia) e exibidos também
   na aba Hoje (somente leitura, lembrete do dia atual).
   Tenta usar a tabela 'lembretes' do Supabase; se ela ainda não tiver
   sido criada (SQL no chat), cai automaticamente para localStorage,
   sem quebrar o app. */






function todayDs(){ const t=now(); return dateStr(t.getFullYear(),t.getMonth()+1,t.getDate()); }

/* — Hoje: somente leitura (lembretes do calendário) — */



/* ════════════════════════════════════
   TAREFAS DO DIA
════════════════════════════════════ */
const TAREFAS_LOCAL_KEY='ds_tarefas_local_v1';
function tarefasLocalGetAll(){ try{ return JSON.parse(localStorage.getItem(TAREFAS_LOCAL_KEY)||'{}'); }catch{ return {}; } }
function tarefasLocalSetAll(obj){ localStorage.setItem(TAREFAS_LOCAL_KEY,JSON.stringify(obj)); }

/* Agendamento único: tarefas criadas em Hoje e em Tarefas usam o mesmo banco. */
function prepararDatasTarefas(){
  const hoje=todayDs();
  ['tarefa-date-input','tp-new-date'].forEach(id=>{
    const inp=document.getElementById(id);
    if(inp&&!inp.value) inp.value=hoje;
  });
}
function popularClientesTarefas(){
  const select=document.getElementById('tp-new-client');
  if(!select) return;
  const prev=select.value;
  select.innerHTML='<option value="">Sem cliente</option>';
  clientes.filter(c=>c.status==='ativo').forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id; opt.textContent=c.empresa; select.appendChild(opt);
  });
  select.value=prev;
}
function tarefaDataValida(ds){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(ds||'')) return false;
  const [y,m,d]=ds.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d;
}
async function sincronizarCalendarioTarefa(ds){
  const [y,m]=ds.split('-').map(Number);
  if(calYear===y&&calMonth===m-1){
    await loadTarefasMes(y,m-1);
  }
  const modal=document.getElementById('daymod-bg');
  if(dayModalDate===ds && modal?.classList.contains('open')){
    await loadTarefasDia(ds);
  }
}
async function criarTarefaAgendada(texto,ds,clienteId){
  texto=(texto||'').trim();
  if(!texto){toast('Informe a descrição da tarefa.','err');return null;}
  if(!tarefaDataValida(ds)){toast('Escolha uma data válida para a tarefa.','err');return null;}
  const nova={texto,clienteId:clienteId||null,concluida:false,dataTarefa:ds};
  let savedInDb=false;
  if(tarefasUseDb&&sb){
    try{
      const {data:{user}}=await authUser();
      if(!user?.id) throw new Error('Sessão não encontrada');
      const payload={user_id:user.id,data_tarefa:ds,texto,concluida:false};
      if(clienteId) payload.cliente_id=clienteId;
      const {data,error}=await sb.from('tarefas').insert(payload).select().single();
      if(error) throw error;
      nova.id=data.id;
      savedInDb=true;
    }catch(err){
      tarefasUseDb=false;
      console.warn('Tarefa salva localmente (Supabase indisponível):',err.message);
      toast('Sem sincronização: tarefa salva neste dispositivo.','inf');
    }
  }
  if(!savedInDb){
    nova.id='loc_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    const all=tarefasLocalGetAll();
    all[ds]=[...(all[ds]||[]),{id:nova.id,texto,clienteId:nova.clienteId,concluida:false}];
    tarefasLocalSetAll(all);
  }
  if(ds===todayDs()){
    tarefasHoje.push({...nova});
    renderTarefasHoje();
  }
  if(!tarefasPendAll.some(t=>t.id===nova.id)){
    tarefasPendAll.push({...nova});
    tarefasPendAll.sort((a,b)=>a.dataTarefa.localeCompare(b.dataTarefa));
  }
  _updateTpBadge();
  if(document.getElementById('sec-tarefas')?.classList.contains('active')) renderTarefasPendentes();
  try{await sincronizarCalendarioTarefa(ds);}catch(err){console.warn('Atualização do calendário:',err);}
  return nova;
}
async function addTarefaNova(){
  const inp=document.getElementById('tp-new-text');
  const date=document.getElementById('tp-new-date');
  const cliente=document.getElementById('tp-new-client');
  const btn=document.getElementById('tp-new-save');
  const texto=inp?.value.trim()||'';
  if(!texto){inp?.focus();toast('Descreva a tarefa antes de adicionar.','err');return;}
  if(!tarefaDataValida(date?.value)){date?.focus();toast('Selecione uma data válida.','err');return;}
  if(btn) btn.disabled=true;
  try{
    const nova=await criarTarefaAgendada(texto,date.value,cliente?.value||null);
    if(nova){
      inp.value='';
      toast('Tarefa cadastrada para '+new Date(date.value+'T12:00:00').toLocaleDateString('pt-BR')+'.','ok');
      inp.focus();
    }
  }finally{if(btn) btn.disabled=false;}
}

async function loadTarefasHoje(){
  const ds=todayDs();
  if(tarefasUseDb&&sb){
    try{
      const {data:{user}}=await authUser();
      const {data,error}=await sb.from('tarefas').select('*').eq('user_id',user.id).eq('data_tarefa',ds).order('criado_em',{ascending:true});
      if(error) throw error;
      tarefasHoje=(data||[]).map(r=>({id:r.id,texto:r.texto,clienteId:r.cliente_id||null,concluida:r.concluida||false}));
    }catch(err){
      tarefasUseDb=false;
      console.warn('Tabela "tarefas" indisponível, usando localStorage:',err.message);
      const all=tarefasLocalGetAll();
      tarefasHoje=(all[ds]||[]);
    }
  } else {
    const all=tarefasLocalGetAll();
    tarefasHoje=(all[ds]||[]);
  }
  popularSelectClientes();
  prepararDatasTarefas();
  renderTarefasHoje();
}

function popularSelectClientes(){
  const sel=document.getElementById('tarefa-cliente-select'); if(!sel) return;
  const val=sel.value;
  sel.innerHTML='<option value="">Sem cliente</option>';
  clientes.filter(c=>c.status==='ativo').forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id; opt.textContent=c.empresa;
    sel.appendChild(opt);
  });
  sel.value=val;
  popularClientesTarefas();
}

function renderTarefasHoje(){
  const list=document.getElementById('tarefas-list'); if(!list) return;
  if(!tarefasHoje.length){ list.innerHTML=esHtml('checkbox','Nenhuma tarefa para hoje','Você pode agendar para outra data acima e acompanhar na aba Tarefas.','','','sm'); return; }
  list.innerHTML=tarefasHoje.map(t=>{
    const cli=t.clienteId?clientes.find(c=>c.id===t.clienteId):null;
    const chipHtml=cli?`<div class="tarefa-cli-chip"><i class="ti ti-building"></i>${esc(cli.empresa)}</div>`:'';
    return `<div class="tarefa-row${t.concluida?' done':''}">
      <button class="tarefa-check-btn${t.concluida?' done-btn':''}" onclick="toggleTarefaHoje('${t.id}')" title="${t.concluida?'Reabrir':'Marcar como feita'}">
        ${t.concluida?'<i class="ti ti-check"></i>':''}
      </button>
      <div class="tarefa-body">
        <div class="tarefa-texto">${esc(t.texto)}</div>
        ${chipHtml}
      </div>
      <button class="tarefa-del-btn" onclick="delTarefaHoje('${t.id}')" title="Remover"><i class="ti ti-x"></i></button>
    </div>`;
  }).join('');
}

async function addTarefaHoje(){
  const input=document.getElementById('tarefa-input');
  const sel=document.getElementById('tarefa-cliente-select');
  const date=document.getElementById('tarefa-date-input');
  const texto=(input?.value||'').trim();
  if(!texto){ input?.focus(); toast('Descreva a tarefa antes de adicionar.','err');return; }
  const ds=date?.value||'';
  if(!tarefaDataValida(ds)){date?.focus();toast('Escolha a data da tarefa.','err');return;}
  const nova=await criarTarefaAgendada(texto,ds,sel?.value||null);
  if(!nova) return;
  input.value='';
  if(sel) sel.value='';
  toast(ds===todayDs()?'Tarefa adicionada para hoje.':'Tarefa agendada para '+new Date(ds+'T12:00:00').toLocaleDateString('pt-BR')+'.','ok');
}

async function toggleTarefaHoje(id){
  const t=tarefasHoje.find(x=>x.id===id); if(!t) return;
  const concluida=!t.concluida;
  if(tarefasUseDb&&sb&&!String(id).startsWith('loc_')){
    try{ await sb.from('tarefas').update({concluida}).eq('id',id); }
    catch(err){ toast('Erro ao atualizar tarefa: '+err.message,'err'); return; }
  } else {
    const ds=todayDs(); const all=tarefasLocalGetAll();
    const item=(all[ds]||[]).find(x=>x.id===id);
    if(item){ item.concluida=concluida; tarefasLocalSetAll(all); }
  }
  t.concluida=concluida;
  renderTarefasHoje();
  // Sincroniza aba Tarefas
  if(concluida) tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
  else { const ds2=todayDs(); if(!tarefasPendAll.some(x=>x.id===id)) tarefasPendAll.push({...t,dataTarefa:ds2}); }
  _updateTpBadge();
}

async function delTarefaHoje(id){
  if(tarefasUseDb&&sb&&!String(id).startsWith('loc_')){
    try{ const {error}=await sb.from('tarefas').delete().eq('id',id); if(error) throw error; }
    catch(err){ toast('Erro ao remover tarefa: '+err.message,'err'); return; }
  } else {
    const ds=todayDs(); const all=tarefasLocalGetAll();
    all[ds]=(all[ds]||[]).filter(x=>x.id!==id); tarefasLocalSetAll(all);
  }
  tarefasHoje=tarefasHoje.filter(x=>x.id!==id);
  tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
  _updateTpBadge();
  renderTarefasHoje();
}

/* ════════════════════════════════════
   TAREFAS PENDENTES — ABA GLOBAL
════════════════════════════════════ */
async function loadTarefasPendentes(){
  const listEl=document.getElementById('tp-list');
  const statsEl=document.getElementById('tp-stats-bar');
  if(!listEl) return;
  listEl.innerHTML='<div class="tp-loading"><i class="ti ti-loader-2"></i> Carregando tarefas...</div>';
  if(statsEl) statsEl.style.display='none';

  if(tarefasUseDb&&sb){
    try{
      const {data:{user}}=await authUser();
      const {data,error}=await sb.from('tarefas')
        .select('*').eq('user_id',user.id).eq('concluida',false)
        .order('data_tarefa',{ascending:true}).order('criado_em',{ascending:true});
      if(error) throw error;
      tarefasPendAll=(data||[]).map(r=>({
        id:r.id,texto:r.texto,clienteId:r.cliente_id||null,
        concluida:false,dataTarefa:r.data_tarefa
      }));
    }catch(err){
      tarefasUseDb=false;
      tarefasPendAll=_tpFromLocal();
    }
  } else {
    tarefasPendAll=_tpFromLocal();
  }
  _updateTpBadge();
  renderTarefasPendentes();
}

function _tpFromLocal(){
  const all=tarefasLocalGetAll();
  const result=[];
  Object.entries(all).forEach(([ds,arr])=>{
    (arr||[]).filter(t=>!t.concluida).forEach(t=>{
      result.push({...t,dataTarefa:ds});
    });
  });
  return result.sort((a,b)=>a.dataTarefa.localeCompare(b.dataTarefa));
}

function _tpDateInfo(ds){
  const today=todayDs();
  const t=now();
  const [y,m,d]=ds.split('-').map(Number);
  const date=new Date(y,m-1,d);
  const dow=DIAS[date.getDay()===0?6:date.getDay()-1];
  const mesNome=MESES[m-1];
  const dateLabel=`${dow}, ${d} de ${mesNome}`;
  if(ds===today) return{label:'Hoje',sub:dateLabel,type:'today',chipText:'HOJE'};
  const ydate=new Date(t); ydate.setDate(t.getDate()-1);
  const yds=dateStr(ydate.getFullYear(),ydate.getMonth()+1,ydate.getDate());
  if(ds===yds) return{label:'Ontem',sub:dateLabel,type:'late',chipText:'ONTEM'};
  const tmdate=new Date(t); tmdate.setDate(t.getDate()+1);
  const tmds=dateStr(tmdate.getFullYear(),tmdate.getMonth()+1,tmdate.getDate());
  if(ds===tmds) return{label:'Amanhã',sub:dateLabel,type:'future',chipText:'AMANHÃ'};
  if(ds<today) return{label:dateLabel,sub:'',type:'late',chipText:'ATRASADO'};
  return{label:dateLabel,sub:'',type:'future',chipText:''};
}

function _updateTpBadge(){
  const badge=document.getElementById('badge-tarefas');
  if(!badge) return;
  const n=tarefasPendAll.length;
  badge.textContent=n;
  badge.style.display=n>0?'inline-flex':'none';
}

function renderTarefasPendentes(){
  const listEl=document.getElementById('tp-list');
  const statsEl=document.getElementById('tp-stats-bar');
  if(!listEl) return;

  if(!tarefasPendAll.length){
    if(statsEl) statsEl.style.display='none';
    listEl.innerHTML=`<div class="tp-empty">
      <i class="ti ti-circle-check tp-empty-icon"></i>
      <div class="tp-empty-ttl">Tudo em dia!</div>
      <div class="tp-empty-sub">Nenhuma tarefa pendente por aqui.</div>
    </div>`;
    return;
  }

  // Agrupa por data
  const groups={};
  tarefasPendAll.forEach(t=>{
    if(!groups[t.dataTarefa]) groups[t.dataTarefa]=[];
    groups[t.dataTarefa].push(t);
  });

  // Stats bar
  const today=todayDs();
  const late=tarefasPendAll.filter(t=>t.dataTarefa<today).length;
  const todayCnt=tarefasPendAll.filter(t=>t.dataTarefa===today).length;
  const future=tarefasPendAll.filter(t=>t.dataTarefa>today).length;
  if(statsEl){
    statsEl.style.display='flex';
    statsEl.innerHTML=`
      <div class="tp-stat late"><strong>${late}</strong><span class="tp-stat-lbl">Atrasada${late!==1?'s':''}</span></div>
      <div class="tp-stat today"><strong>${todayCnt}</strong><span class="tp-stat-lbl">Para hoje</span></div>
      <div class="tp-stat future"><strong>${future}</strong><span class="tp-stat-lbl">Próxima${future!==1?'s':''}</span></div>
      <div class="tp-stat" style="margin-left:auto"><strong>${tarefasPendAll.length}</strong><span class="tp-stat-lbl">Total pendente${tarefasPendAll.length!==1?'s':''}</span></div>`;
  }

  // Renderiza grupos
  let html='';
  Object.entries(groups).forEach(([ds,tasks])=>{
    const info=_tpDateInfo(ds);
    const chipHtml=info.chipText?`<span class="tp-date-chip ${info.type}">${info.chipText}</span>`:'';
    const subHtml=info.sub?`<span class="tp-date-sub">${info.sub}</span>`:'';
    html+=`<div class="tp-group" data-group="${ds}">
      <div class="tp-group-hdr">
        <span class="tp-date-label">${esc(info.label)}</span>
        ${subHtml}
        ${chipHtml}
        <span class="tp-count">${tasks.length} tarefa${tasks.length!==1?'s':''}</span>
      </div>`;
    tasks.forEach(t=>{
      const cli=t.clienteId?clientes.find(c=>c.id===t.clienteId):null;
      const chipCli=cli?`<div class="tp-cli-chip"><i class="ti ti-building"></i>${esc(cli.empresa)}</div>`:'';
      html+=`<div class="tp-row tp-${info.type}" id="tp-row-${t.id}">
        <button class="tp-check-btn" onclick="toggleTarefaPend('${t.id}')" title="Marcar como feita">
          <i class="ti ti-check"></i>
        </button>
        <div class="tp-body">
          <div class="tp-texto">${esc(t.texto)}</div>
          ${chipCli}
        </div>
        <button class="tp-del-btn" type="button" onclick="delTarefaPend('${t.id}')" title="Excluir tarefa" aria-label="Excluir tarefa"><i class="ti ti-trash"></i><span>Excluir</span></button>
      </div>`;
    });
    html+='</div>';
  });
  listEl.innerHTML=html;
}

async function toggleTarefaPend(id){
  const t=tarefasPendAll.find(x=>x.id===id); if(!t) return;
  // Atualiza no Supabase
  if(tarefasUseDb&&sb&&!String(id).startsWith('loc_')){
    try{ const {error}=await sb.from('tarefas').update({concluida:true}).eq('id',id); if(error) throw error; }
    catch(err){ toast('Erro ao atualizar: '+err.message,'err'); return; }
  } else {
    const all=tarefasLocalGetAll();
    const item=(all[t.dataTarefa]||[]).find(x=>x.id===id);
    if(item){ item.concluida=true; tarefasLocalSetAll(all); }
  }
  // Recarrega os indicadores do calendário na data modificada.
  sincronizarCalendarioTarefa(t.dataTarefa).catch(console.warn);
  // Sincroniza com tarefasHoje se for hoje
  if(t.dataTarefa===todayDs()){
    const th=tarefasHoje.find(x=>x.id===id);
    if(th){ th.concluida=true; renderTarefasHoje(); }
  }
  // Animação de saída
  const row=document.getElementById('tp-row-'+id);
  if(row){
    row.classList.add('vanishing');
    setTimeout(()=>{
      tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
      _updateTpBadge();
      // Remove do grupo; se ficou vazio, remove o grupo
      const groupEl=row.closest('.tp-group');
      row.remove();
      if(groupEl&&!groupEl.querySelector('.tp-row')){
        groupEl.remove();
        // Se ficou sem grupos, mostra estado vazio
        const listEl=document.getElementById('tp-list');
        if(listEl&&!listEl.querySelector('.tp-group')) renderTarefasPendentes();
      }
      // Atualiza stats bar
      renderTarefasPendentesStats();
    },360);
  } else {
    tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
    _updateTpBadge();
    renderTarefasPendentes();
  }
}

function renderTarefasPendentesStats(){
  const statsEl=document.getElementById('tp-stats-bar');
  if(!statsEl||!tarefasPendAll.length){ if(statsEl) statsEl.style.display='none'; return; }
  const today=todayDs();
  const late=tarefasPendAll.filter(t=>t.dataTarefa<today).length;
  const todayCnt=tarefasPendAll.filter(t=>t.dataTarefa===today).length;
  const future=tarefasPendAll.filter(t=>t.dataTarefa>today).length;
  statsEl.style.display='flex';
  statsEl.innerHTML=`
    <div class="tp-stat late"><strong>${late}</strong><span class="tp-stat-lbl">Atrasada${late!==1?'s':''}</span></div>
    <div class="tp-stat today"><strong>${todayCnt}</strong><span class="tp-stat-lbl">Para hoje</span></div>
    <div class="tp-stat future"><strong>${future}</strong><span class="tp-stat-lbl">Próxima${future!==1?'s':''}</span></div>
    <div class="tp-stat" style="margin-left:auto"><strong>${tarefasPendAll.length}</strong><span class="tp-stat-lbl">Total pendente${tarefasPendAll.length!==1?'s':''}</span></div>`;
}

async function delTarefaPend(id){
  const t=tarefasPendAll.find(x=>x.id===id); if(!t) return;
  if(tarefasUseDb&&sb&&!String(id).startsWith('loc_')){
    try{ const {error}=await sb.from('tarefas').delete().eq('id',id); if(error) throw error; }
    catch(err){ toast('Erro ao excluir: '+err.message,'err'); return; }
  } else {
    const all=tarefasLocalGetAll();
    all[t.dataTarefa]=(all[t.dataTarefa]||[]).filter(x=>x.id!==id);
    tarefasLocalSetAll(all);
  }
  sincronizarCalendarioTarefa(t.dataTarefa).catch(console.warn);
  // Sincroniza com tarefasHoje se for hoje
  if(t.dataTarefa===todayDs()){
    tarefasHoje=tarefasHoje.filter(x=>x.id!==id);
    renderTarefasHoje();
  }
  const row=document.getElementById('tp-row-'+id);
  if(row){
    row.classList.add('vanishing');
    setTimeout(()=>{
      tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
      _updateTpBadge();
      const groupEl=row.closest('.tp-group');
      row.remove();
      if(groupEl&&!groupEl.querySelector('.tp-row')){
        groupEl.remove();
        const listEl=document.getElementById('tp-list');
        if(listEl&&!listEl.querySelector('.tp-group')) renderTarefasPendentes();
      }
      renderTarefasPendentesStats();
    },360);
  } else {
    tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
    _updateTpBadge();
    renderTarefasPendentes();
  }
  toast('Tarefa removida.','inf');
}

/* ════════════════════════════════════
   TAREFAS DO DIA — MODAL DO CALENDÁRIO
════════════════════════════════════ */
async function loadTarefasDia(ds){
  if(tarefasUseDb&&sb){
    try{
      const {data:{user}}=await authUser();
      const {data,error}=await sb.from('tarefas').select('*').eq('user_id',user.id).eq('data_tarefa',ds).order('criado_em',{ascending:true});
      if(error) throw error;
      tarefasDia=(data||[]).map(r=>({id:r.id,texto:r.texto,clienteId:r.cliente_id||null,concluida:r.concluida||false}));
    }catch(err){
      tarefasUseDb=false;
      const all=tarefasLocalGetAll(); tarefasDia=(all[ds]||[]);
    }
  } else { const all=tarefasLocalGetAll(); tarefasDia=(all[ds]||[]); }
  popularSelectClientesDia();
  renderTarefasDia();
}

function popularSelectClientesDia(){
  const sel=document.getElementById('daymod-tarefa-select'); if(!sel) return;
  const val=sel.value;
  sel.innerHTML='<option value="">Sem cliente</option>';
  clientes.filter(c=>c.status==='ativo').forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id; opt.textContent=c.empresa; sel.appendChild(opt);
  });
  sel.value=val;
}

function renderTarefasDia(){
  const list=document.getElementById('daymod-tarefas-list'); if(!list) return;
  if(!tarefasDia.length){ list.innerHTML=esHtml('checkbox','Nenhuma tarefa para este dia','','','','sm'); return; }
  list.innerHTML=tarefasDia.map(t=>{
    const cli=t.clienteId?clientes.find(c=>c.id===t.clienteId):null;
    const chipHtml=cli?`<div class="tarefa-cli-chip"><i class="ti ti-building"></i>${esc(cli.empresa)}</div>`:'';
    return `<div class="tarefa-row${t.concluida?' done':''}">
      <button class="tarefa-check-btn${t.concluida?' done-btn':''}" onclick="toggleTarefaDia('${t.id}')" title="${t.concluida?'Reabrir':'Marcar como feita'}">
        ${t.concluida?'<i class="ti ti-check"></i>':''}
      </button>
      <div class="tarefa-body">
        <div class="tarefa-texto">${esc(t.texto)}</div>
        ${chipHtml}
      </div>
      <button class="tarefa-del-btn" onclick="delTarefaDia('${t.id}')" title="Remover"><i class="ti ti-x"></i></button>
    </div>`;
  }).join('');
}

async function addTarefaDia(){
  const input=document.getElementById('daymod-tarefa-input');
  const sel=document.getElementById('daymod-tarefa-select');
  const texto=(input?.value||'').trim();
  if(!texto||!dayModalDate) return;
  const ds=dayModalDate;
  const clienteId=sel?.value||null;
  let nova={texto,clienteId,concluida:false};
  if(tarefasUseDb&&sb){
    try{
      const {data:{user}}=await authUser();
      const payload={user_id:user.id,data_tarefa:ds,texto,concluida:false};
      if(clienteId) payload.cliente_id=clienteId;
      const {data,error}=await sb.from('tarefas').insert(payload).select().single();
      if(error) throw error;
      nova.id=data.id;
    }catch(err){
      tarefasUseDb=false;
      nova.id='loc_'+Date.now();
      const all=tarefasLocalGetAll(); all[ds]=[...(all[ds]||[]),nova]; tarefasLocalSetAll(all);
    }
  } else {
    nova.id='loc_'+Date.now();
    const all=tarefasLocalGetAll(); all[ds]=[...(all[ds]||[]),nova]; tarefasLocalSetAll(all);
  }
  tarefasDia.push(nova);
  // Atualizar cache do mês e sincronizar Hoje se for o dia de hoje
  atualizarCacheDia(ds,tarefasDia);
  if(ds===todayDs()){ tarefasHoje=[...tarefasDia]; renderTarefasHoje(); }
  // Sincroniza aba Tarefas (nova tarefa pendente adicionada pelo calendário)
  if(!tarefasPendAll.some(x=>x.id===nova.id))
    tarefasPendAll.push({...nova,dataTarefa:ds});
  tarefasPendAll.sort((a,b)=>a.dataTarefa.localeCompare(b.dataTarefa));
  _updateTpBadge();
  if(input) input.value='';
  if(sel) sel.value='';
  renderTarefasDia();
  renderCalMensal();
}

async function toggleTarefaDia(id){
  const t=tarefasDia.find(x=>x.id===id); if(!t) return;
  const concluida=!t.concluida;
  if(tarefasUseDb&&sb&&!String(id).startsWith('loc_')){
    try{ await sb.from('tarefas').update({concluida}).eq('id',id); }
    catch(err){ toast('Erro ao atualizar tarefa: '+err.message,'err'); return; }
  } else {
    const ds=dayModalDate; const all=tarefasLocalGetAll();
    const item=(all[ds]||[]).find(x=>x.id===id);
    if(item){ item.concluida=concluida; tarefasLocalSetAll(all); }
  }
  t.concluida=concluida;
  atualizarCacheDia(dayModalDate,tarefasDia);
  if(dayModalDate===todayDs()){ const th=tarefasHoje.find(x=>x.id===id); if(th){ th.concluida=concluida; renderTarefasHoje(); } }
  // Sincroniza aba Tarefas
  if(concluida){
    tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
  } else {
    if(!tarefasPendAll.some(x=>x.id===id))
      tarefasPendAll.push({...t,dataTarefa:dayModalDate});
    tarefasPendAll.sort((a,b)=>a.dataTarefa.localeCompare(b.dataTarefa));
  }
  _updateTpBadge();
  renderTarefasDia();
  renderCalMensal();
}

async function delTarefaDia(id){
  if(tarefasUseDb&&sb&&!String(id).startsWith('loc_')){
    try{ const {error}=await sb.from('tarefas').delete().eq('id',id); if(error) throw error; }
    catch(err){ toast('Erro ao remover tarefa: '+err.message,'err'); return; }
  } else {
    const ds=dayModalDate; const all=tarefasLocalGetAll();
    all[ds]=(all[ds]||[]).filter(x=>x.id!==id); tarefasLocalSetAll(all);
  }
  tarefasDia=tarefasDia.filter(x=>x.id!==id);
  atualizarCacheDia(dayModalDate,tarefasDia);
  if(dayModalDate===todayDs()){ tarefasHoje=tarefasHoje.filter(x=>x.id!==id); renderTarefasHoje(); }
  // Sincroniza aba Tarefas
  tarefasPendAll=tarefasPendAll.filter(x=>x.id!==id);
  _updateTpBadge();
  renderTarefasDia();
  renderCalMensal();
}

/* ════════════════════════════════════
   CACHE DO MÊS — indicadores no calendário
════════════════════════════════════ */
function atualizarCacheDia(ds,arr){
  if(!tarefasMesCache.data) tarefasMesCache={year:-1,month:-1,data:{}};
  tarefasMesCache.data[ds]=[...arr];
}

async function loadTarefasMes(year,month){
  const from=dateStr(year,month+1,1);
  const to=dateStr(year,month+1,new Date(year,month+1,0).getDate());
  const newCache={year,month,data:{}};
  if(tarefasUseDb&&sb){
    try{
      const {data:{user}}=await authUser();
      const {data,error}=await sb.from('tarefas').select('*').eq('user_id',user.id).gte('data_tarefa',from).lte('data_tarefa',to);
      if(error) throw error;
      (data||[]).forEach(r=>{
        if(!newCache.data[r.data_tarefa]) newCache.data[r.data_tarefa]=[];
        newCache.data[r.data_tarefa].push({id:r.id,texto:r.texto,clienteId:r.cliente_id||null,concluida:r.concluida||false});
      });
    }catch(err){
      tarefasUseDb=false;
    }
  }
  if(!tarefasUseDb){
    const all=tarefasLocalGetAll();
    Object.entries(all).forEach(([ds,items])=>{
      if(ds>=from&&ds<=to){ newCache.data[ds]=(items||[]).map(i=>({...i})); }
    });
  }
  tarefasMesCache=newCache;
  renderCalMensal();
}

/* — Modal de dia (Calendário — lembretes legado, mantidos para compatibilidade) — */




async function dbInsert(p,logoFile,x){
  x=x||{};
  const {data:{user}}=await authUser();
  let logoUrl='';
  if(logoFile) logoUrl=await uploadLogo(logoFile,user.id);
  let capaUrl=p.capaUrl||'', logoDarkUrl=p.logoDarkUrl||'';
  if(x.capaFile) capaUrl=await uploadLogo(x.capaFile,user.id);
  if(x.logoDarkFile) logoDarkUrl=await uploadLogo(x.logoDarkFile,user.id);
  const base={
    user_id:user.id, empresa:p.empresa, responsavel:p.responsavel,
    telefone:p.telefone, qtd_midias:p.qtdMidias, dias:p.dias,
    observacoes:p.observacoes, logo_url:logoUrl,
    status:p.status, instagram:p.instagram||'',
    valor_mensal:p.valorMensal||0, dia_cobranca:p.diaCobranca||0
  };
  const ext={cor:p.cor||'',icone:p.icone||'',capa_url:capaUrl,logo_escuro_url:logoDarkUrl};
  let res=await sb.from('clientes').insert({...base,...ext}).select().single();
  let local=false;
  if(res.error && v59Missing(res.error)){ res=await sb.from('clientes').insert(base).select().single(); local=true; }
  if(res.error) throw res.error;
  if(local){ v59ExtraSave(res.data.id,{cor:p.cor||'',icone:p.icone||'',capaUrl,logoDarkUrl}); v59Warn(); }
  return rowToClient(res.data);
}
async function dbUpdate(id,p,logoFile,x){
  x=x||{};
  let logoUrl=p.logoUrl||'';
  const {data:{user}}=await authUser();
  if(logoFile) logoUrl=await uploadLogo(logoFile,user.id);
  let capaUrl=p.capaUrl||'', logoDarkUrl=p.logoDarkUrl||'';
  if(x.capaFile) capaUrl=await uploadLogo(x.capaFile,user.id);
  if(x.logoDarkFile) logoDarkUrl=await uploadLogo(x.logoDarkFile,user.id);
  const base={
    empresa:p.empresa, responsavel:p.responsavel, telefone:p.telefone,
    qtd_midias:p.qtdMidias, dias:p.dias, observacoes:p.observacoes,
    logo_url:logoUrl, status:p.status, instagram:p.instagram||'',
    valor_mensal:p.valorMensal||0, dia_cobranca:p.diaCobranca||0
  };
  const ext={cor:p.cor||'',icone:p.icone||'',capa_url:capaUrl,logo_escuro_url:logoDarkUrl};
  let res=await sb.from('clientes').update({...base,...ext}).eq('id',id);
  if(res.error && v59Missing(res.error)){
    res=await sb.from('clientes').update(base).eq('id',id);
    if(!res.error){ v59ExtraSave(id,{cor:p.cor||'',icone:p.icone||'',capaUrl,logoDarkUrl}); v59Warn(); }
  }
  if(res.error) throw res.error;
}
async function dbDelete(id){
  const {error}=await sb.from('clientes').delete().eq('id',id);
  if(error) throw error;
}
function rowToClient(r){
  return{id:r.id,empresa:r.empresa,responsavel:r.responsavel,
    telefone:r.telefone||'',qtdMidias:r.qtd_midias||0,dias:r.dias||[],
    observacoes:r.observacoes||'',logoUrl:r.logo_url||'',
    status:r.status||'ativo',instagram:r.instagram||'',
    valorMensal:r.valor_mensal||0,diaCobranca:r.dia_cobranca||0,criadoEm:r.criado_em||'', ...v59X(r)};
}

/* ── LOGO & IMAGE UPLOAD (com compressão WebP inteligente V109) ── */
async function uploadLogo(file,userId,opts){
  if(!file || !/^image\//i.test(file.type||'')) throw new Error('Selecione um arquivo de imagem válido.');
  if(file.size > 15*1024*1024) throw new Error('A imagem original excede 15 MB.');
  const optimized=(typeof window.dsCompressImage==='function')
    ? await window.dsCompressImage(file, opts||{maxDim:512,quality:0.88})
    : file;
  if(optimized.size > 5*1024*1024) throw new Error('A imagem excede o limite de 5 MB após otimização.');
  const rawName=optimized.name||file.name||'imagem.webp';
  const ext=(rawName.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'')||'webp';
  const rand=Math.random().toString(36).slice(2,8);
  const path=`${userId}/${Date.now()}-${rand}.${ext}`;
  const {error}=await sb.storage.from('logos').upload(path,optimized,{contentType:optimized.type||file.type});
  if(error) throw new Error('Erro ao fazer upload da imagem: '+error.message);
  const {data}=sb.storage.from('logos').getPublicUrl(path);
  return data.publicUrl;
}
function handleLogoUpload(e){
  const file=e.target.files[0]; if(!file) return;
  if(!/^image\//i.test(file.type||'')){ toast('Selecione uma imagem válida.','err'); e.target.value=''; return; }
  if(file.size > 15*1024*1024){ toast('A imagem deve ter no máximo 15 MB.','err'); e.target.value=''; return; }
  pendingLogoFile=file;
  const reader=new FileReader();
  reader.onload=ev=>setLogoPreview(ev.target.result);
  reader.readAsDataURL(file);
  e.target.value='';
}
function setLogoPreview(src){
  const prev=document.getElementById('logo-preview');
  prev.innerHTML=`<img loading="lazy" decoding="async" src="${esc(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
  document.getElementById('logo-remove-btn').style.display='inline-flex';
}
function removeLogo(){
  pendingLogoFile=null; pendingLogoUrl='';
  document.getElementById('logo-preview').innerHTML='<i class="ti ti-photo" style="font-size:20px;color:#3D4F6B"></i>';
  document.getElementById('logo-remove-btn').style.display='none';
}

/* ── ENTREGAS (marcar arte como feita salva no banco sem duplicar) ── */
const _togglingEntregas=new Set();
async function registrarEntrega(clienteId, dataStr){
  const key=taskKey(dataStr,clienteId);
  if(_togglingEntregas.has(key)) return;
  _togglingEntregas.add(key);
  try{
    const {data:{user}}=await authUser();
    if(done.has(key)){
      // Desmarcar: remove todas as ocorrências daquele cliente+data no banco (elimina eventuais duplicatas antigas)
      const {error:delErr}=await sb.from('entregas').delete()
        .eq('user_id',user.id).eq('cliente_id',clienteId).eq('data_entrega',dataStr);
      if(delErr) throw delErr;
      entregas=entregas.filter(e=>!(e.clienteId===clienteId&&e.dataEntrega===dataStr));
      done.delete(key);
    } else {
      const {data,error}=await sb.from('entregas').insert({
        user_id:user.id, cliente_id:clienteId, data_entrega:dataStr
      }).select().single();
      if(error){
        if(String(error.code)==='23505'||/duplicate|unique/i.test(error.message||'')){
          await fetchEntregas();
        } else {
          throw error;
        }
      } else if(data){
        entregas=entregas.filter(e=>!(e.clienteId===clienteId&&e.dataEntrega===dataStr));
        entregas.push({id:data.id,clienteId:data.cliente_id,dataEntrega:data.data_entrega});
      }
      done.add(key);
    }
    saveDone();
  }finally{
    _togglingEntregas.delete(key);
  }
}

/* ════════════════════════════════════
   DONE / CHECKLIST
════════════════════════════════════ */
let DONE_KEY='ds_done_v5';
function setDoneUser(uid){ DONE_KEY='ds_done_v5_'+uid; }
function loadDone(){
  /* Carrega apenas o cache local (localStorage).
     A sincronização com a tabela entregas do Supabase é feita
     separadamente em syncDoneFromEntregas(), após fetchEntregas()
     concluir — evitando o bug de iterar um array ainda vazio. */
  try{
    const r=JSON.parse(localStorage.getItem(DONE_KEY)||'{}');
    done=new Set((r.items||[]).filter(k=>!isBlockedDs(k.split('_')[0])));
  }catch{ done=new Set(); }
}
function syncDoneFromEntregas(){
  /* Popula o set done com todas as entregas vindas do Supabase.
     Deve ser chamada APÓS fetchEntregas() ter completado. */
  entregas.forEach(e=>done.add(taskKey(e.dataEntrega,e.clienteId)));
  saveDone();
}
function saveDone(){ localStorage.setItem(DONE_KEY,JSON.stringify({items:[...done]})); }
function taskKey(ds,cid){ return `${ds}_${cid}`; }
function isDone(ds,cid){ return done.has(taskKey(ds,cid)); }
async function toggleTask(ds,cid,skipRender){
  try{ await registrarEntrega(cid,ds); }
  catch(e){ toast('Erro ao registrar: '+e.message,'err'); return; }
  if(!skipRender) render();
}

/* ════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════ */
function requestNotifPermission(){
  // Desabilitado — Firefox não salva permissão em arquivo local
}
function showTodayNotif(){
  const today=now();
  const ds=dateStr(today.getFullYear(),today.getMonth()+1,today.getDate());
  const dodia=clientesNoDia(ds);
  const pendentes=dodia.filter(c=>!isDone(ds,c.id));
  const bar=document.getElementById('notif-bar');
  if(!bar) return;
  if(pendentes.length>0){
    document.getElementById('notif-title').textContent=`Você tem ${pendentes.length} arte${pendentes.length>1?'s':''} para entregar hoje`;
    document.getElementById('notif-sub').textContent=pendentes.map(c=>c.empresa).join(' · ');
    bar.style.display='flex';
    // Notificação browser desabilitada — usar banner interno do app
  } else { bar.style.display='none'; }
}

/* ════════════════════════════════════
   HELPERS
════════════════════════════════════ */
function dateStr(y,m,d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function jsToOurDay(jsDay){ return jsDay===0?6:jsDay-1; }
function clientesNoDia(ds){
  if(isBlockedDs(ds)) return []; // antes do reset (01/07) — não exibe nada
  const d=new Date(ds+'T12:00:00'); const ourDay=jsToOurDay(d.getDay());
  return clientes.filter(c=>c.status==='ativo'&&c.dias.includes(ourDay));
}
/* V107: artes da semana atual (SEG até ontem) que ficaram sem entrega */
function artesAtrasadasSemana(c, hojeDate){
  const out=[];
  const todayOur=jsToOurDay(hojeDate.getDay());
  for(let back=todayOur; back>=1; back--){
    const ourDay=todayOur-back;
    const d=new Date(hojeDate.getFullYear(),hojeDate.getMonth(),hojeDate.getDate()-back,12);
    const ds=dateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
    if(isBlockedDs(ds)) continue;
    if(!c.dias.includes(ourDay)) continue;
    if(isDone(ds,c.id)) continue;
    out.push({label:DIAS_A[ourDay], nome:DIAS[ourDay]});
  }
  return out;
}
function greetingFromHour(){ const h=now().getHours(); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'; }
function fmtDateLong(date){
  const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  return `${dias[date.getDay()]}, ${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`;
}

function statusBadge(s){
  const map={ativo:'s-ativo',pausado:'s-pausado',encerrado:'s-encerrado'};
  const lbl={ativo:'Ativo',pausado:'Pausado',encerrado:'Encerrado'};
  return `<span class="status-badge ${map[s]||'s-ativo'}">${lbl[s]||s}</span>`;
}

/* ════════════════════════════════════
   RENDER HOJE
════════════════════════════════════ */
function renderHoje(){
  const today=now();
  const ds=dateStr(today.getFullYear(),today.getMonth()+1,today.getDate());
  const dodia=clientesNoDia(ds);
  document.getElementById('hoje-greeting').textContent='Olá, '+(window.dsGreetingName||'Dagner');
  document.getElementById('hoje-date').textContent=today.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const pendentes=dodia.filter(c=>!isDone(ds,c.id)).length;
  const artsBadge=document.getElementById('ds-arts-count');
  if(artsBadge){
    artsBadge.textContent=!dodia.length?'Nenhuma arte':pendentes===0?'Tudo entregue':`${pendentes} pendente${pendentes===1?'':'s'}`;
    artsBadge.classList.toggle('complete',dodia.length>0&&pendentes===0);
  }
  const badge=document.getElementById('badge-hoje');
  badge.textContent=pendentes; badge.style.display=pendentes>0?'inline-flex':'none';
  const list=document.getElementById('tasks-list');
  const freeEl=document.getElementById('hoje-free');
  const doneAllEl=document.getElementById('hoje-done-all');
  const progRow=document.getElementById('hoje-progress-row');
  if(!dodia.length){
    freeEl.style.display='block'; doneAllEl.style.display='none';
    progRow.style.display='none';
    document.getElementById('hoje-ring-wrap')?.classList.remove('visible');
    list.innerHTML=''; return;
  }
  freeEl.style.display='none'; progRow.style.display='flex';
  const numDone=dodia.filter(c=>isDone(ds,c.id)).length;
  const pct=Math.round(numDone/dodia.length*100);
  document.getElementById('hoje-fill').style.width=pct+'%';
  document.getElementById('hoje-num').textContent=numDone;
  document.getElementById('hoje-total').textContent=dodia.length;
  doneAllEl.style.display=(numDone===dodia.length&&dodia.length>0)?'block':'none';
  // ── Progress ring ──
  const ringWrap=document.getElementById('hoje-ring-wrap');
  const ringFill=document.getElementById('hoje-ring-fill');
  const ringPctEl=document.getElementById('hoje-ring-pct');
  if(ringWrap&&ringFill&&ringPctEl){
    ringWrap.classList.add('visible');
    const circ=163.4;
    ringFill.style.strokeDashoffset=String(circ-((pct/100)*circ));
    ringFill.style.stroke=pct===100?'#10B981':pct>=50?'#E8EBF0':'#E8EBF0';
    ringPctEl.innerHTML=`${pct}%<span class="hoje-ring-lbl">feito</span>`;
  }
  list.innerHTML='';
  // ── Alerta de cobrança ──
  const todayDay=today.getDate();
  // (aviso de cobrança removido da tela inicial — v105)
  // ── Confetti quando tudo é concluído ──
  if(numDone===dodia.length&&dodia.length>0&&_lastHojePct<100) launchConfetti();
  _lastHojePct=numDone===dodia.length?100:Math.round(numDone/dodia.length*100);
  const sorted=[...dodia].sort((a,b)=>{const da=isDone(ds,a.id),db=isDone(ds,b.id);return da===db?0:da?1:-1;});
  sorted.forEach(c=>{
    const idx=clientes.indexOf(c); const k=cor(idx); const d=isDone(ds,c.id);
    const el=document.createElement('div');
    el.className=`task-item${d?' done':''}`;
    el.style.setProperty('--stripe',k.c);
    el.onclick=()=>toggleTask(ds,c.id);
    el.setAttribute('role','button');
    el.tabIndex=0;
    el.setAttribute('aria-label',`${c.empresa}: ${d?'entregue':'pendente'}. Pressione Enter para alterar o status`);
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};

    const logoHtml=c.logoUrl
      ?`<img loading="lazy" decoding="async" src="${esc(c.logoUrl)}" style="width:28px;height:28px;border-radius:7px;object-fit:cover;flex-shrink:0">`
      :`<div style="width:28px;height:28px;border-radius:7px;background:${k.c};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-weight:800;font-size:11px;color:#fff;flex-shrink:0">${esc(c.empresa.charAt(0))}</div>`;
    const todayChip=`<span class="task-day-chip" style="background:${k.bg};border-color:${k.bo};color:${k.t}">${DIAS_A[jsToOurDay(today.getDay())]}</span>`;
    const atrasadas=d?[]:artesAtrasadasSemana(c,today);
    const chipsDia=atrasadas.length
      ?`<span class="task-day-group">${atrasadas.map(x=>`<span class="task-day-chip late-chip" title="Arte atrasada: ${esc(x.nome)}">${x.label}</span>`).join('')}${todayChip}</span>`
      :todayChip;
    el.innerHTML=`
      <div class="task-check"><i class="ti ti-check"></i></div>
      ${logoHtml}
      <div class="task-info">
        <div class="task-empresa">${esc(c.empresa)}</div>
        <div class="task-resp">${esc(c.responsavel)}</div>
      </div>
      ${chipsDia}
      <span class="task-done-label">Concluída</span>`;
    list.appendChild(el);
  });
  szRenderTodayHoje();
}

/* ════════════════════════════════════
   RENDER CALENDÁRIO MENSAL
════════════════════════════════════ */
function renderCalMensal(){
  const grid=document.getElementById('cal-days-grid');
  const navTxt=document.getElementById('cal-nav-month');
  const today=now();
  const todayDs=dateStr(today.getFullYear(),today.getMonth()+1,today.getDate());
  navTxt.innerHTML=`${MESES[calMonth].toUpperCase()} <span>${calYear}</span>`;
  const firstJs=new Date(calYear,calMonth,1).getDay(); // 0 = DOM
  const firstDisplay=firstJs;
  const daysInM=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const totalCells=Math.ceil((firstDisplay+daysInM)/7)*7;
  let totalTasks=0,doneTasks=0;
  for(let d=1;d<=daysInM;d++){
    const ds=dateStr(calYear,calMonth+1,d); const cl=clientesNoDia(ds);
    totalTasks+=cl.length; cl.forEach(c=>{if(isDone(ds,c.id)) doneTasks++;});
  }
  const mPct=totalTasks>0?Math.round(doneTasks/totalTasks*100):0;
  document.getElementById('cal-done-count').textContent=doneTasks;
  document.getElementById('cal-total-count').textContent=totalTasks;
  document.getElementById('cal-month-fill').style.width=mPct+'%';
  document.getElementById('cal-month-pct').textContent=mPct+'%';
  const mPending=totalTasks-doneTasks;
  const pendStatEl=document.getElementById('cal-pending-stat');
  if(pendStatEl) pendStatEl.innerHTML=mPending>0?`<span style="color:var(--am)"><i class="ti ti-hourglass-high"></i> ${mPending} restante${mPending!==1?'s':''}</span>`:totalTasks>0?`<span style="color:var(--em)"><i class="ti ti-circle-check"></i> Mês concluído!</span>`:`<span style="color:var(--t3)">—</span>`;
  grid.innerHTML='';
  const mesData=(tarefasMesCache.year===calYear&&tarefasMesCache.month===calMonth)?tarefasMesCache.data:{};
  for(let i=0;i<totalCells;i++){
    const cell=document.createElement('div');
    let dayNum,ds,isOther=false,displayDay;
    if(i<firstDisplay){
      dayNum=daysInPrev-firstDisplay+i+1;
      const pm=calMonth===0?12:calMonth; const py=calMonth===0?calYear-1:calYear;
      ds=dateStr(py,pm,dayNum); isOther=true; displayDay=dayNum;
    } else {
      dayNum=i-firstDisplay+1;
      if(dayNum>daysInM){
        const nm=calMonth===11?1:calMonth+2; const ny=calMonth===11?calYear+1:calYear;
        ds=dateStr(ny,nm,dayNum-daysInM); isOther=true; displayDay=dayNum-daysInM;
      } else { ds=dateStr(calYear,calMonth+1,dayNum); displayDay=dayNum; }
    }
    const colIdx=i%7; const isWeekend=(colIdx===0||colIdx===6); const isToday=ds===todayDs;
    cell.className=`cal-cell${isOther?' other-month':''}${isWeekend?' weekend':''}${isToday?' today':''}`;
    if(!isOther){
      const dodia=clientesNoDia(ds);
      const tarefasDoDia=mesData[ds]||[];
      const szDoDia=szAllDates(calYear).filter(e=>e.m===calMonth+1&&e.d===displayDay);
      const dCnt=dodia.filter(c=>isDone(ds,c.id)).length;
      const numHtml=isToday?`<span class="cal-num-badge">${displayDay}</span>`:`<span class="cal-num-plain">${displayDay}</span>`;
      let flags='';
      if(tarefasDoDia.length>0) flags+=`<span class="cal-mini-flag is-task" title="${tarefasDoDia.length} tarefa${tarefasDoDia.length>1?'s':''}"><i class="ti ti-${tarefasDoDia.every(t=>t.concluida)?'checks':'checkbox'}"></i></span>`;
      if(szDoDia.length>0) flags+=`<span class="cal-mini-flag is-seasonal" title="${esc(szDoDia.map(e=>e.name).join(', '))}"><i class="ti ti-calendar-heart"></i></span>`;
      let body='';
      if(dodia.length>0){
        body+=`<div class="cal-artes-count">${dodia.length} arte${dodia.length!==1?'s':''}${dCnt>0?` <span class="done">· ${dCnt}✓</span>`:''}</div>`;
        body+='<div class="cal-avatar-stack">';
        dodia.slice(0,4).forEach(c=>{
          const k=cor(clientes.indexOf(c)); const done=isDone(ds,c.id);
          const ini=c.empresa.substring(0,1).toUpperCase();
          const inner=done?'✓':c.logoUrl?`<img loading="lazy" decoding="async" src="${esc(c.logoUrl)}">`:ini;
          body+=`<div class="cal-avatar" title="${esc(c.empresa)}" style="background:${done?'rgba(16,185,129,.18)':c.logoUrl?'#0f1012':k.bg};border:1px solid ${done?'rgba(16,185,129,.45)':k.bo};color:${done?'#34D399':k.t}">${inner}</div>`;
        });
        body+='</div>';
        if(dodia.length>4) body+=`<div class="cal-more-line">+${dodia.length-4} agendada${dodia.length-4!==1?'s':''}</div>`;
      }
      if(tarefasDoDia.length>0){
        const concl=tarefasDoDia.filter(t=>t.concluida).length;
        body+=`<div class="cal-chip-line"><span class="cal-mini-chip task"><i class="ti ti-${concl===tarefasDoDia.length?'checks':'checkbox'}"></i>${tarefasDoDia.length} tarefa${tarefasDoDia.length!==1?'s':''}</span></div>`;
      }
      if(szDoDia.length>0){
        const primeiro=szDoDia[0];
        const txt=`${primeiro.emoji} ${esc(primeiro.name)}`;
        body+=`<div class="cal-chip-line"><span class="cal-mini-chip seasonal" title="${esc(szDoDia.map(e=>e.name).join(', '))}">${txt}</span>${szDoDia.length>1?`<span class="cal-mini-chip">+${szDoDia.length-1}</span>`:''}</div>`;
      }
      if(!body) body='<div class="cal-cell-empty"></div>';
      cell.innerHTML=`<div class="cal-cell-head"><div class="cal-cell-num">${numHtml}</div><div class="cal-cell-icons">${flags}</div></div><div class="cal-cell-body">${body}</div>`;
      const capDs=ds; cell.addEventListener('click',()=>openDayModal(capDs));
    } else {
      cell.innerHTML=`<div class="cal-cell-head"><div class="cal-cell-num"><span class="cal-num-plain">${displayDay}</span></div></div><div class="cal-cell-body"><div class="cal-cell-empty"></div></div>`;
    }
    grid.appendChild(cell);
  }
}
function openDayModal(ds){
  dayModalDate=ds; const d=new Date(ds+'T12:00:00'); const dodia=clientesNoDia(ds);
  const diasPt=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  document.getElementById('daymod-date').textContent=`${diasPt[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  document.getElementById('daymod-sub').textContent=`${dodia.length} publicação${dodia.length!==1?'s':''} agendada${dodia.length!==1?'s':''}`;
  renderDayModalTasks(ds,dodia);
  // Datas sazonais do dia
  const szDia=szAllDates(d.getFullYear()).filter(e=>e.m===d.getMonth()+1&&e.d===d.getDate());
  let szSecHtml='';
  if(szDia.length>0){
    szSecHtml=`<div class="daymod-sz-sec">
      <div class="daymod-sz-hdr"><i class="ti ti-sparkles"></i>Datas comemorativas</div>
      ${szDia.map(e=>{const s=szCatStyle(e.cat);return `<div class="daymod-sz-item">
        <div class="daymod-sz-emoji">${e.emoji}</div>
        <div style="flex:1;min-width:0">
          <div class="daymod-sz-name">${esc(e.name)}</div>
          <div class="daymod-sz-cat" style="color:${s.color}">${s.label}</div>
        </div>
        <span class="sz-cat-badge" style="background:${s.bg};color:${s.color};border:1px solid ${s.color}44">${s.label}</span>
      </div>`;}).join('')}
    </div>`;
  }
  // Injeta a seção sazonal no daymod antes das tarefas
  const daymodBox=document.querySelector('.daymod-box');
  const existingSzSec=daymodBox.querySelector('.daymod-sz-sec');
  if(existingSzSec) existingSzSec.remove();
  if(szSecHtml){
    const tarefasSec=daymodBox.querySelector('.daymod-tarefas-sec');
    tarefasSec.insertAdjacentHTML('beforebegin',szSecHtml);
  }
  const tList=document.getElementById('daymod-tarefas-list');
  if(tList) tList.innerHTML='<div class="lembrete-empty">Carregando...</div>';
  loadTarefasDia(ds);
  document.getElementById('daymod-bg').classList.add('open');
}
function renderDayModalTasks(ds,dodia){
  const cont=document.getElementById('daymod-tasks'); cont.innerHTML='';
  if(!dodia.length){
    cont.innerHTML=esHtml('palm-tree','Nenhuma publicação neste dia','','','','sm');
    return;
  }
  dodia.forEach(c=>{
    const k=cor(clientes.indexOf(c)); const d=isDone(ds,c.id);
    const el=document.createElement('div');
    el.className=`daymod-task${d?' done':''}`;
    el.style.borderLeftColor=k.c;
    const logoHtml=c.logoUrl
      ?`<img loading="lazy" decoding="async" src="${esc(c.logoUrl)}" style="width:28px;height:28px;border-radius:7px;object-fit:cover;flex-shrink:0">`
      :`<div style="width:28px;height:28px;border-radius:7px;background:${k.c};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-weight:800;font-size:11px;color:#fff;flex-shrink:0">${esc(c.empresa.charAt(0))}</div>`;
    el.innerHTML=`<div class="daymod-chk"><i class="ti ti-check"></i></div>${logoHtml}<div><div class="daymod-task-name">${esc(c.empresa)}</div><div class="daymod-task-resp">${esc(c.responsavel)}</div></div>`;
    el.addEventListener('click',async()=>{
      await toggleTask(ds,c.id,true);
      renderDayModalTasks(ds,clientesNoDia(ds));
      renderCalMensal(); renderHoje();
    });
    cont.appendChild(el);
  });
}
function closeDayModal(){ document.getElementById('daymod-bg').classList.remove('open'); render(); }
function changeMonth(dir){ calMonth+=dir; if(calMonth>11){calMonth=0;calYear++;}if(calMonth<0){calMonth=11;calYear--;} renderCalMensal(); loadTarefasMes(calYear,calMonth); renderSazonaisNoCalendario(); }
function gotoToday(){ const t=now(); calYear=t.getFullYear(); calMonth=t.getMonth(); renderCalMensal(); loadTarefasMes(calYear,calMonth); renderSazonaisNoCalendario(); }

/* Painéis sazonais fundidos no Calendário */
function renderSazonaisNoCalendario(){
  szLoadCustom();
  szYear=calYear; szMonth=calMonth+1;
  const monthDates=szCatalogDates(szYear).filter(d=>d.m===szMonth);
  const countLbl=document.getElementById('sz-cal-count-lbl');
  if(countLbl) countLbl.textContent=`${MESES[szMonth-1]} ${szYear}`;
  const addMonthBtn=document.getElementById('sz-add-month-btn');
  if(addMonthBtn){
    const allAdded=monthDates.length>0&&monthDates.every(szIsInCalendar);
    addMonthBtn.disabled=monthDates.length===0 || allAdded;
    addMonthBtn.style.opacity=addMonthBtn.disabled?'.55':'1';
    addMonthBtn.innerHTML=allAdded?'<i class="ti ti-check"></i><span>Todas adicionadas</span>':'<i class="ti ti-plus"></i><span>Adicionar todas do mês</span>';
  }
  const listEl=document.getElementById('sz-month-events-list');
  if(listEl){
    if(monthDates.length===0){
      listEl.innerHTML='<div class="sz-lib-empty">Nenhuma data comemorativa cadastrada para este mês ainda. Me envie a nova lista e eu adiciono aqui.</div>';
    } else {
      listEl.innerHTML=monthDates.map((e,i)=>{
        const dow=new Date(szYear,szMonth-1,e.d).getDay();
        const dowName=['dom','seg','ter','qua','qui','sex','sáb'][dow];
        const s=szCatStyle(e.cat);
        const added=szIsInCalendar(e);
        return `<div class="sz-lib-row" id="sz-ev-${szMonth}-${e.d}-${i}">
          <div class="sz-lib-date">
            <div class="sz-lib-day">${e.d}</div>
            <div class="sz-lib-dow">${dowName}</div>
          </div>
          <div class="sz-lib-main">
            <div class="sz-lib-name">${esc(e.name)}</div>
            <div class="sz-lib-meta"><span class="sz-lib-dot" style="background:${s.color}"></span><span>${s.label}</span></div>
          </div>
          <button type="button" class="sz-lib-add ${added?'added':''}" onclick="szAddLibraryDateByIndex(${i})" aria-label="${added?'Data já adicionada':'Adicionar '+esc(e.name)+' ao calendário'}">${added?'<i class="ti ti-check"></i>Adicionado':'<i class="ti ti-plus"></i>Adicionar'}</button>
        </div>`;
      }).join('');
    }
  }
}


/* ════════════════════════════════════
   RENDER CLIENTES
════════════════════════════════════ */
function renderClientes(){
  const grid=document.getElementById('clients-grid');
  const count=document.getElementById('clients-count');
  const stats=document.getElementById('stats-bar');
  const ativos=clientes.filter(c=>c.status==='ativo');
  count.textContent=`${clientes.length} cliente${clientes.length!==1?'s':''} (${ativos.length} ativo${ativos.length!==1?'s':''})`;
  const totalMid=ativos.reduce((s,c)=>s+(parseInt(c.qtdMidias)||0),0);
  const diasAtivos=new Set(ativos.flatMap(c=>c.dias)).size;
  stats.innerHTML=clientes.length?`
    <div class="stat-pill"><i class="ti ti-users"></i><span class="stat-val">${clientes.length}</span><span class="stat-lbl">clientes</span></div>
    <div class="stat-pill"><i class="ti ti-photo"></i><span class="stat-val">${totalMid}</span><span class="stat-lbl">mídias/semana</span></div>
    <div class="stat-pill"><i class="ti ti-calendar"></i><span class="stat-val">${diasAtivos}</span><span class="stat-lbl">dias ativos</span></div>`:'';
  let lista=[...clientes];
  if(clientesFiltro!=='todos') lista=lista.filter(c=>c.status===clientesFiltro);
  if(clientesBusca.trim()){
    const q=clientesBusca.trim().toLowerCase();
    lista=lista.filter(c=>c.empresa.toLowerCase().includes(q)||c.responsavel.toLowerCase().includes(q));
  }
  if(clientesOrdem==='nome') lista.sort((a,b)=>a.empresa.localeCompare(b.empresa,'pt-BR'));
  else if(clientesOrdem==='valor') lista.sort((a,b)=>(b.valorMensal||0)-(a.valorMensal||0));
  else if(clientesOrdem==='midias') lista.sort((a,b)=>(b.qtdMidias||0)-(a.qtdMidias||0));
  if(!lista.length){
    const hasFilter=clientesBusca.trim()||clientesFiltro!=='todos';
    grid.innerHTML=esHtml(hasFilter?'search':'users',hasFilter?'Nenhum resultado':'Nenhum cliente cadastrado',hasFilter?'Tente outros filtros ou limpe a busca.':'Cadastre o primeiro cliente para organizar entregas e cobranças.',hasFilter?'':'Novo cliente','openModal()');
    return;
  }
  grid.innerHTML='';
  lista.forEach((c)=>{
    const idx=clientes.indexOf(c);
    const k=cor(idx);
    const diasHtml=DIAS_A.map((d,i)=>{
      const on=c.dias.includes(i);
      return `<span class="chip${on?' ds-client-day-on':''}" style="${on?`background:${k.bg};border-color:${k.bo};color:${k.t}`:'background:rgba(255,255,255,.04);color:#3D4F6B'}">${d}</span>`;
    }).join('');
    const obsHtml=c.observacoes?`<div class="card-obs"><div class="card-obs-hdr"><i class="ti ti-notes" style="font-size:12px"></i>Obs.</div>${esc(c.observacoes)}</div>`:'';
    const telHtml=c.telefone?`<div class="card-meta-row"><i class="ti ti-phone"></i><span>${esc(c.telefone)}</span></div>`:'';
    const valorHtml=c.valorMensal?`<div class="card-meta-row"><i class="ti ti-currency-dollar" style="color:#34D399"></i><span style="color:#34D399;font-weight:600">${fmtBRL(c.valorMensal)}/mês</span></div>`:'';
    const cobrancaHtml=c.diaCobranca?`<div class="card-meta-row"><i class="ti ti-calendar-due"></i><span>Cobrança: dia ${c.diaCobranca} de cada mês</span></div>`:'';
    const instaHtml=c.instagram?`<a href="${esc(c.instagram)}" target="_blank" rel="noopener" class="btn btn-insta" title="Abrir Instagram"><i class="ti ti-brand-instagram"></i> Instagram</a>`:'';
    const ccor=(c.cor&&/^#[0-9a-fA-F]{6}$/.test(c.cor))?c.cor:'#626B7A';
    const cico=esc(c.icone||'building-store');
    let imgsHtml='';
    if(c.logoUrl) imgsHtml=`<img loading="lazy" decoding="async" src="${esc(c.logoUrl)}" alt="">`;
    const avatarHtml=`<div class="cc-avatar${imgsHtml?' has-img':''}" style="--cc:${ccor}">${imgsHtml||`<i class="ti ti-${cico}"></i>`}</div>`;
    const el=document.createElement('div'); el.className='client-card compact-client';
    if(c.status!=='ativo') el.style.opacity='0.6';
    el.innerHTML=`
      <div class="card-body">
        <div class="client-actions-row">
          <div class="client-status-slot">${statusBadge(c.status)}</div>
          <div class="card-btns">
            <button class="btn btn-icon btn-recibo" onclick="openReciboModal('${c.id}')" data-tip="Emitir recibo"><i class="ti ti-receipt"></i></button>
            <button class="btn btn-icon btn-wpp-sm" onclick="wppCliente('${c.id}')" data-tip="Abrir WhatsApp"><i class="ti ti-brand-whatsapp"></i></button>
            <button class="btn btn-icon" onclick="openRelat('${c.id}')" data-tip="Relatório de posts"><i class="ti ti-chart-bar"></i></button>
            <button class="btn btn-icon" onclick="v61OpenBr('${c.id}')" data-tip="Briefing do cliente"><i class="ti ti-notes"></i></button>
            <button class="btn btn-icon btn-edit" onclick="openModal('${c.id}')" data-tip="Editar cliente"><i class="ti ti-pencil"></i></button>
            <button class="btn btn-icon btn-del" onclick="confirmDelete('${c.id}')" data-tip="Excluir cliente"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div class="card-head">
          <div class="client-head-main">
            ${avatarHtml}
            <div class="client-head-text">
              <div class="card-company">${esc(c.empresa)}</div>
              <div class="card-resp">${esc(c.responsavel)}</div>
            </div>
          </div>
        </div>
        <div class="card-meta">
          ${telHtml}
          <div class="card-meta-row"><i class="ti ti-photo"></i><span>${c.qtdMidias||0} mídia${c.qtdMidias!=1?'s':''}/semana</span></div>
          ${valorHtml}
          ${cobrancaHtml}
        </div>
        ${obsHtml}
        <div class="chips-row">${diasHtml}</div>
        ${instaHtml}
      </div>`;
    grid.appendChild(el);
  });
}

/* ════════════════════════════════════
   RENDER DASHBOARD
════════════════════════════════════ */


/* ════════════════════════════════════
   POR CLIENTE — Visão semanal e mensal produção
════════════════════════════════════ */
/* ════════════════════════════════════
   DASHBOARD — ocultar valores
════════════════════════════════════ */
let dashValuesHidden = true; // oculto por padrão





let pcWeekOffset = 0;

function getWeekDates(offset=0){
  const today=now(); const jsDay=today.getDay();
  const daysToMon=jsDay===0?-6:1-jsDay;
  const monday=new Date(today); monday.setDate(today.getDate()+daysToMon+offset*7); monday.setHours(0,0,0,0);
  const dates=[]; for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);dates.push(d);}
  return dates;
}
function getMonthWeeks(year,month){
  const firstDay=new Date(year,month,1); const lastDay=new Date(year,month+1,0);
  const fjs=firstDay.getDay(); const dToMon=fjs===0?-6:1-fjs;
  const firstMon=new Date(firstDay); firstMon.setDate(firstDay.getDate()+dToMon); firstMon.setHours(0,0,0,0);
  const weeks=[]; let cur=new Date(firstMon);
  while(cur<=lastDay){
    const week=[]; for(let i=0;i<7;i++){const d=new Date(cur);d.setDate(cur.getDate()+i);week.push(d);}
    weeks.push(week); cur.setDate(cur.getDate()+7);
  }
  return weeks;
}
function pcNav(dir){ if(pcViewMode==='semana') pcChangeWeek(dir); else pcChangeMonth(dir); }
function pcNavCenter(){ if(pcViewMode==='semana') pcGotoThisWeek(); else pcGotoThisMonth(); }
function pcChangeWeek(dir){ pcWeekOffset+=dir; renderPorCliente(); }
function pcGotoThisWeek(){ pcWeekOffset=0; renderPorCliente(); }
function pcChangeMonth(dir){
  pcMonthMonth+=dir;
  if(pcMonthMonth>11){pcMonthMonth=0;pcMonthYear++;} if(pcMonthMonth<0){pcMonthMonth=11;pcMonthYear--;}
  renderPorCliente();
}
function pcGotoThisMonth(){ const t=now();pcMonthYear=t.getFullYear();pcMonthMonth=t.getMonth();renderPorCliente(); }
function setPcViewMode(mode){
  pcViewMode=mode;
  if(mode==='mes'&&pcMonthYear===undefined){const t=now();pcMonthYear=t.getFullYear();pcMonthMonth=t.getMonth();}
  document.querySelectorAll('.pc-vtog').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  renderPorCliente();
}
async function pcToggleDay(cid,ds){
  try{ await toggleTask(ds,cid,true); render(); }catch(e){ toast('Erro: '+e.message,'err'); }
}
async function marcarTodasCliente(cid,dates,periodoLabel){
  const c=clientes.find(x=>x.id===cid); if(!c) return;
  const clientDates=dates.filter(d=>c.dias.includes(jsToOurDay(d.getDay()))&&!isBlockedDate(d));
  const pending=clientDates.filter(d=>!isDone(dateStr(d.getFullYear(),d.getMonth()+1,d.getDate()),cid));
  const allDone=pending.length===0;
  const n=allDone?clientDates.length:pending.length;
  const ttl=allDone?'Desmarcar todas as artes?':'Marcar todas as pendentes?';
  const txt=`${n} arte${n!==1?'s':''} de ${c.empresa} ${periodoLabel||'nesta semana'}`;
  openPcConfirm(ttl,txt,()=>_execMarcarTodas(cid,dates,allDone,pending,clientDates));
}
async function _execMarcarTodas(cid,dates,allDone,pending,clientDates){
  const btn=document.querySelector(`.pc-mark-btn[data-pc-btn="${cid}"]`);
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i> Aguarde...';}
  const ds2=d=>dateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
  try{
    const {data:{user}}=await authUser();
    if(allDone){
      // desmarca tudo em UMA chamada ao banco (incluindo eventuais duplicatas antigas)
      const alvo=clientDates.map(ds2).filter(ds=>isDone(ds,cid));
      if(alvo.length){
        const {error}=await sb.from('entregas').delete()
          .eq('user_id',user.id).eq('cliente_id',cid).in('data_entrega',alvo);
        if(error) throw error;
        const alvoSet=new Set(alvo);
        entregas=entregas.filter(e=>!(e.clienteId===cid&&alvoSet.has(e.dataEntrega)));
      }
      alvo.forEach(ds=>done.delete(taskKey(ds,cid)));
      saveDone();
      toast('Artes desmarcadas!','inf');
    } else {
      // marca tudo em UMA chamada ao banco (evitando duplicar datas já salvas)
      const jaSalvas=new Set(entregas.filter(e=>e.clienteId===cid).map(e=>e.dataEntrega));
      const alvo=Array.from(new Set(pending.map(ds2))).filter(ds=>!isDone(ds,cid)&&!jaSalvas.has(ds));
      if(alvo.length){
        const {data,error}=await sb.from('entregas')
          .insert(alvo.map(ds=>({user_id:user.id,cliente_id:cid,data_entrega:ds}))).select();
        if(error){
          if(String(error.code)==='23505'||/duplicate|unique/i.test(error.message||'')){
            await fetchEntregas();
          } else {
            throw error;
          }
        } else {
          (data||[]).forEach(r=>entregas.push({id:r.id,clienteId:r.cliente_id,dataEntrega:r.data_entrega}));
        }
        alvo.forEach(ds=>done.add(taskKey(ds,cid)));
        saveDone();
      }
      toast(`${alvo.length} arte${alvo.length!==1?'s':''} marcada${alvo.length!==1?'s':''}! `,'ok');
    }
  }catch(e){toast('Erro: '+e.message,'err');}
  render();
}
function renderPorCliente(){
  const isMes=pcViewMode==='mes';
  const t0=now();
  if(isMes&&pcMonthYear===undefined){pcMonthYear=t0.getFullYear();pcMonthMonth=t0.getMonth();}
  const dates=isMes?null:getWeekDates(pcWeekOffset);
  const mWeeks=isMes?getMonthWeeks(pcMonthYear,pcMonthMonth):null;
  const allDatesFlat=isMes?mWeeks.flat().filter(d=>d.getMonth()===pcMonthMonth):dates;
  const todayDs=dateStr(t0.getFullYear(),t0.getMonth()+1,t0.getDate());
  const lblEl=document.getElementById('pc-week-label');
  const rangeEl=document.getElementById('pc-week-range');
  const navCenterEl=document.getElementById('pc-nav-center');
  if(isMes){
    if(lblEl) lblEl.innerHTML=`${MESES[pcMonthMonth]} <span>${pcMonthYear}</span>`;
    if(rangeEl) rangeEl.textContent='Visão mensal · datas em sequência';
    if(navCenterEl) navCenterEl.innerHTML='<i class="ti ti-calendar-today"></i><span>Este mês</span>';
  } else {
    if(lblEl){
      if(pcWeekOffset===0)       lblEl.innerHTML='Semana <span>atual</span>';
      else if(pcWeekOffset===-1) lblEl.innerHTML='Semana <span>passada</span>';
      else if(pcWeekOffset===1)  lblEl.innerHTML='Próxima <span>semana</span>';
      else lblEl.innerHTML=`<span>${pcWeekOffset>0?'+':''}${pcWeekOffset} semanas</span>`;
    }
    const fmtD=d=>`${d.getDate()}/${d.getMonth()+1}`;
    if(rangeEl) rangeEl.textContent=`${fmtD(dates[0])} → ${fmtD(dates[6])} · ${MESES[dates[0].getMonth()]}/${dates[0].getFullYear()}`;
    if(navCenterEl) navCenterEl.innerHTML='<i class="ti ti-calendar-today"></i><span>Esta semana</span>';
  }
  const ativos=clientes.filter(c=>c.status==='ativo');
  let totalP=0,doneP=0;
  ativos.forEach(c=>{
    allDatesFlat.forEach(d=>{
      if(c.dias.includes(jsToOurDay(d.getDay()))&&!isBlockedDate(d)){
        totalP++;
        if(isDone(dateStr(d.getFullYear(),d.getMonth()+1,d.getDate()),c.id)) doneP++;
      }
    });
  });
  const pctP=totalP>0?Math.round(doneP/totalP*100):0;
  const lblStat=document.getElementById('pc-stat-label');
  if(lblStat) lblStat.textContent=isMes?`artes em ${MESES[pcMonthMonth]}`:'artes nesta semana';
  const el_=id=>document.getElementById(id);
  if(el_('pc-stat-done')) el_('pc-stat-done').textContent=doneP;
  if(el_('pc-stat-total')) el_('pc-stat-total').textContent=totalP;
  if(el_('pc-stat-bar')) el_('pc-stat-bar').style.width=pctP+'%';
  if(el_('pc-stat-pct')) el_('pc-stat-pct').textContent=pctP+'%';
  const pendP=totalP-doneP;
  const badgePC=document.getElementById('badge-pc');
  if(badgePC){badgePC.textContent=pendP;badgePC.style.display=pendP>0?'inline-flex':'none';}
  const cardsEl=document.getElementById('pc-cards'); if(!cardsEl) return;
  const comDias=ativos.filter(c=>c.dias.length>0);
  if(!comDias.length){
    cardsEl.innerHTML=esHtml('users','Nenhum cliente ativo','Cadastre clientes e defina os dias de publicação.','Novo cliente','openModal()');
    return;
  }
  cardsEl.innerHTML='';
  comDias.forEach(c=>{
    const idx=clientes.indexOf(c); const k=cor(idx);
    const clientDatesPeriod=allDatesFlat.filter(d=>c.dias.includes(jsToOurDay(d.getDay()))&&!isBlockedDate(d));
    const doneCount=clientDatesPeriod.filter(d=>isDone(dateStr(d.getFullYear(),d.getMonth()+1,d.getDate()),c.id)).length;
    const totalCount=clientDatesPeriod.length;
    const pendingCount=totalCount-doneCount;
    const allDonePeriod=totalCount>0&&pendingCount===0;
    const pctC=totalCount>0?Math.round(doneCount/totalCount*100):0;
    const logoHtml=c.logoUrl
      ?`<img loading="lazy" decoding="async" src="${esc(c.logoUrl)}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0">`
      :`<div style="width:44px;height:44px;border-radius:10px;background:${k.c};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-weight:800;font-size:17px;color:#fff;flex-shrink:0">${esc(c.empresa.charAt(0))}</div>`;
    const emDiaBadge=allDonePeriod&&totalCount>0?`<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);font-size:10px;font-weight:700;color:#34D399"><i class="ti ti-circle-check" style="font-size:11px"></i> EM DIA</span>`:'';
    const makeChip=(d,ds)=>{
      const isDoneDay=isDone(ds,c.id);
      const isToday=ds===todayDs;
      const todayMid=new Date(t0.getFullYear(),t0.getMonth(),t0.getDate());
      const dMid=new Date(d.getFullYear(),d.getMonth(),d.getDate());
      const isLate=!isDoneDay&&dMid<todayMid;
      let bg,bo,clr,ico;
      if(isDoneDay){
        bg='rgba(16,185,129,.14)';bo='rgba(16,185,129,.5)';clr='#34D399';
        ico=`<i class="ti ti-check" style="font-size:13px;color:#34D399"></i>`;
      } else if(isLate){
        bg='rgba(239,68,68,.14)';bo='rgba(239,68,68,.5)';clr='#F87171';
        ico=`<i class="ti ti-alert-triangle" style="font-size:11px;color:#F87171;opacity:.9"></i>`;
      } else {
        bg='rgba(59,130,246,.12)';bo='rgba(59,130,246,.4)';clr='#60A5FA';
        ico=`<i class="ti ti-clock" style="font-size:10px;color:#60A5FA;opacity:.7"></i>`;
      }
      const glowClr=isDoneDay?'rgba(16,185,129,.65)':isLate?'rgba(239,68,68,.65)':'rgba(59,130,246,.65)';
      const glow=isToday?`;box-shadow:0 0 0 2px ${glowClr}`:'';
      const stateClass=isDoneDay?'pc-state-done':isLate?'pc-state-late':'pc-state-pending';
      return `<div class="pc-day"><div class="pc-day-box ${stateClass}${isToday?' pc-is-today':''}" data-ds="${ds}" data-cid="${c.id}" style="background:${bg};border-color:${bo}${glow}">${isToday?`<div class="pc-today-dot" style="background:${clr}"></div>`:''}<div class="pc-day-lbl" style="color:${clr}">${DIAS_A[jsToOurDay(d.getDay())]}</div><div class="pc-day-num" style="color:${clr}">${d.getDate()}</div><div class="pc-day-ico">${ico}</div></div></div>`;
    };
    let bodyHtml='';
    if(isMes){
      // Datas do mês em sequência cronológica, sem separar por semanas.
      // Faixa com rolagem horizontal preserva o tamanho de cada quadrado.
      bodyHtml='<div class="pc-month-stream" role="group" aria-label="Dias de publicação em '+MESES[pcMonthMonth]+'">'+
        clientDatesPeriod.map(d=>makeChip(d,dateStr(d.getFullYear(),d.getMonth()+1,d.getDate()))).join('')+
        '</div>';
    } else {
      bodyHtml=`<div class="pc-days-row">${dates.map(d=>{
        const ourDay=jsToOurDay(d.getDay());
        if(!c.dias.includes(ourDay)||isBlockedDate(d)) return `<div class="pc-day"><div class="pc-day-box inactive" style="background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.05)"><div class="pc-day-lbl" style="color:var(--t3)">${DIAS_A[ourDay]}</div><div class="pc-day-num" style="color:var(--t3);font-size:12px">${d.getDate()}</div></div></div>`;
        return makeChip(d,dateStr(d.getFullYear(),d.getMonth()+1,d.getDate()));
      }).join('')}</div>`;
    }
    const periodoLabel=isMes?`em ${MESES[pcMonthMonth]}`:'nesta semana';
    let btnLabel,btnBg,btnBo,btnClr,btnDis='';
    if(totalCount===0){btnLabel=`<i class="ti ti-moon"></i> Sem artes`;btnBg='transparent';btnBo='var(--border)';btnClr='var(--t3)';btnDis='disabled';}
    else if(allDonePeriod){btnLabel=`<i class="ti ti-refresh"></i> Desmarcar todas`;btnBg='rgba(251,191,36,.08)';btnBo='rgba(251,191,36,.35)';btnClr='#fbbf24';}
    else{btnLabel=`<i class="ti ti-checks"></i> Marcar ${pendingCount} pendente${pendingCount!==1?'s':''}`;btnBg=k.bg;btnBo=k.bo;btnClr=k.t;}
    let statusTxt;
    if(totalCount===0) statusTxt=`<span style="color:var(--t3)">Sem artes ${periodoLabel}</span>`;
    else if(allDonePeriod) statusTxt=`<span style="color:#34D399"><i class="ti ti-circle-check"></i> Tudo entregue ${periodoLabel}!</span>`;
    else statusTxt=`<strong>${doneCount}</strong> de <strong>${totalCount}</strong> · <span style="color:${k.t}">${pendingCount} pendente${pendingCount!==1?'s':''}</span>`;
    const counterClr=allDonePeriod?'#34D399':totalCount===0?'var(--t3)':k.t;
    const card=document.createElement('div'); card.className='pc-card'; card.style.borderLeftColor='transparent';
    card.dataset.v100Pending=String(pendingCount);
    card.dataset.v100Done=String(allDonePeriod);
    card.dataset.v100Late=String(clientDatesPeriod.filter(d=>{const ds=dateStr(d.getFullYear(),d.getMonth()+1,d.getDate());return ds<todayDs&&!isDone(ds,c.id);}).length);
    card.innerHTML=`
      <div class="pc-card-hdr">
        <div class="pc-client-meta">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:2px">
            <div class="pc-card-name">${esc(c.empresa)}</div>${emDiaBadge}
          </div>
        </div>
        <div class="pc-card-count">
          <div class="pc-count-main">${doneCount}<span>/${totalCount}</span></div>
          <div class="pc-count-sub">${pctC}% feito</div>
        </div>
      </div>
      <div class="pc-layout">
        <div class="pc-body">${bodyHtml}</div>
        <div class="pc-card-footer">
          <button class="pc-mark-btn" data-pc-btn="${c.id}" ${btnDis}>${btnLabel}</button>
        </div>
      </div>`;
    card.querySelectorAll('.pc-day-box[data-ds]').forEach(box=>{
      box.addEventListener('click',async()=>await pcToggleDay(box.dataset.cid,box.dataset.ds));
    });
    const markBtn=card.querySelector('.pc-mark-btn');
    if(markBtn&&!markBtn.disabled){
      const capDates=[...allDatesFlat];
      markBtn.addEventListener('click',()=>marcarTodasCliente(c.id,capDates,periodoLabel));
    }
    cardsEl.appendChild(card);
  });
}

function render(){ if(_appUserId) setTimeout(saveCache,0);
  renderHoje(); renderCalMensal(); renderClientes();
  popularSelectClientes(); renderTarefasHoje();
  if(document.getElementById('sec-producao')?.classList.contains('active')) renderPorCliente();
  if(document.getElementById('sec-cobranca')?.classList.contains('active')) renderCobranca();
}

/* ════════════════════════════════════
   TABS / MODAL
════════════════════════════════════ */
function switchTab(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===`sec-${tab}`));
  if(tab==='cobranca') renderCobranca();
  if(tab==='producao') renderPorCliente();
  if(tab==='hoje') popularSelectClientes();
  if(tab==='tarefas'){
    prepararDatasTarefas();
    popularClientesTarefas();
    loadTarefasPendentes();
  }
  if(tab==='demandas') v61RenderDemandas();
  if(tab==='calendario') renderSazonaisNoCalendario();
}
function openModal(id=null){
  editId=id; pendingLogoFile=null; pendingLogoUrl='';
  apReset(id!==null?(clientes.find(x=>x.id===id)||null):null);
  document.querySelectorAll('.day-tog').forEach(b=>b.classList.remove('on'));
  document.getElementById('logo-preview').innerHTML='<i class="ti ti-photo" style="font-size:20px;color:#3D4F6B"></i>';
  document.getElementById('logo-remove-btn').style.display='none';
  if(id!==null){
    const c=clientes.find(x=>x.id===id); if(!c) return;
    document.getElementById('modal-title').textContent='Editar cliente';
    document.getElementById('f-empresa').value=c.empresa;
    document.getElementById('f-resp').value=c.responsavel;
    document.getElementById('f-tel').value=c.telefone||'';
    document.getElementById('f-mid').value=c.qtdMidias||'';
    document.getElementById('f-obs').value=c.observacoes||'';
    document.getElementById('f-status').value=c.status||'ativo';
    document.getElementById('f-valor').value=c.valorMensal||'';
    document.getElementById('f-cobranca').value=c.diaCobranca||'';
    document.getElementById('f-insta').value=c.instagram||'';
    document.querySelectorAll('.day-tog').forEach(b=>{if(c.dias.includes(parseInt(b.dataset.d))) b.classList.add('on');});
    if(c.logoUrl){
      pendingLogoUrl=c.logoUrl;
      setLogoPreview(c.logoUrl);
    }
  } else {
    document.getElementById('modal-title').textContent='Novo cliente';
    ['f-empresa','f-resp','f-tel','f-mid','f-obs','f-valor','f-insta','f-cobranca'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('f-status').value='ativo';
  }
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(()=>document.getElementById('f-empresa').focus(),80);
}
function closeModal(){ document.getElementById('modal-bg').classList.remove('open'); editId=null; pendingLogoFile=null; pendingCapaFile=null; pendingLogoDarkFile=null; }

let isSavingCliente=false;
async function saveCliente(){
  if(isSavingCliente) return; // evita disparo duplo (Enter + clique, ou duas vezes em sequência)
  const empresa=document.getElementById('f-empresa').value.trim();
  const responsavel=document.getElementById('f-resp').value.trim();
  const telefone=document.getElementById('f-tel').value.trim();
  const qtdMidias=parseInt(document.getElementById('f-mid').value)||0;
  const observacoes=document.getElementById('f-obs').value.trim();
  const status=document.getElementById('f-status').value;
  const valorMensal=parseFloat(document.getElementById('f-valor').value)||0;
  const diaCobranca=parseInt(document.getElementById('f-cobranca').value)||0;
  let instagram=document.getElementById('f-insta').value.trim();
  if(instagram && !/^https?:\/\//i.test(instagram)) instagram='https://instagram.com/'+instagram.replace(/^@/,'');
  const dias=[]; document.querySelectorAll('.day-tog.on').forEach(b=>dias.push(parseInt(b.dataset.d))); dias.sort((a,b)=>a-b);
  if(!empresa){document.getElementById('f-empresa').focus();toast('Informe o nome da empresa.','err');return;}
  if(!responsavel){document.getElementById('f-resp').focus();toast('Informe o responsável.','err');return;}
  isSavingCliente=true; setSyncStatus('saving');
  const btn=document.querySelector('#modal-box .btn-primary');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2"></i> Salvando...';}
  try{
    const p={empresa,responsavel,telefone,qtdMidias,observacoes,status,valorMensal,instagram,diaCobranca,logoUrl:pendingLogoUrl,dias,cor:apCor,icone:apIcone,capaUrl:'',logoDarkUrl:''};
    const xf={};
    if(editId!==null){
      await dbUpdate(editId,p,pendingLogoFile,xf);
      const i=clientes.findIndex(c=>c.id===editId);
      if(i!==-1) clientes[i]={...clientes[i],...p,logoUrl:pendingLogoFile?clientes[i].logoUrl:pendingLogoUrl};
      // Re-fetch to get updated logoUrl from storage
      await fetchClientes();
      toast('Cliente atualizado!','ok');
    } else {
      const novo=await dbInsert(p,pendingLogoFile,xf);
      clientes.push(novo);
      clientes.sort((a,b)=>a.empresa.localeCompare(b.empresa,'pt-BR'));
      toast('Cliente cadastrado!','ok');
    }
    closeModal(); render(); setSyncStatus('ok');
  }catch(e){setSyncStatus('error');toast('Erro ao salvar: '+e.message,'err');}
  finally{isSavingCliente=false; if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-check"></i> Salvar';}}
}

/* ── SYNC STATUS ── */
function setSyncStatus(status){
  const el=document.getElementById('sync-dot'); if(!el) return;
  el.className=''; // reset
  const map={ok:{lbl:'Sincronizado'},saving:{lbl:'Salvando...'},error:{lbl:'Erro de conexão'}};
  const s=map[status]||map.ok;
  el.querySelector('.sync-lbl').textContent=s.lbl;
  if(status!=='ok') el.classList.add(status);
}

/* ── DELETE ── */
function confirmDelete(id){
  delId=id; const c=clientes.find(x=>x.id===id);
  if(!c) return;
  const temPagamentos=pagamentos.some(p=>p.clienteId===id);
  document.getElementById('confirm-name').textContent=c.empresa;
  const warn=document.getElementById('confirm-warning');
  const encBtn=document.getElementById('confirm-enc-btn');
  const delBtn=document.getElementById('confirm-del-btn');
  const ttl=document.getElementById('confirm-ttl');
  if(temPagamentos){
    warn.style.display='block';
    encBtn.style.display='inline-flex';
    delBtn.textContent=''; delBtn.innerHTML='<i class="ti ti-trash"></i> Excluir mesmo assim';
    ttl.textContent='Atenção — cliente com histórico';
  } else {
    warn.style.display='none';
    encBtn.style.display='none';
    delBtn.innerHTML='<i class="ti ti-trash"></i> Excluir';
    ttl.textContent='Excluir cliente?';
  }
  document.getElementById('confirm-bg').classList.add('open');
}
function closeConfirm(){ document.getElementById('confirm-bg').classList.remove('open'); delId=null; }
async function doEncerrar(){
  if(!delId) return;
  try{
    setSyncStatus('saving');
    await dbUpdate(delId,{...clientes.find(c=>c.id===delId), status:'encerrado'},null);
    const i=clientes.findIndex(c=>c.id===delId);
    if(i!==-1) clientes[i].status='encerrado';
    closeConfirm(); render(); toast('Cliente encerrado. Histórico preservado.','ok');
    setSyncStatus('ok');
  }catch(e){setSyncStatus('error');toast('Erro: '+e.message,'err');}
}
async function doDelete(){
  if(!delId) return;
  try{
    setSyncStatus('saving');
    await dbDelete(delId); clientes=clientes.filter(c=>c.id!==delId);
    closeConfirm(); render(); toast('Cliente removido.','ok');
    setSyncStatus('ok');
  }catch(e){setSyncStatus('error');toast('Erro: '+e.message,'err');}
}

/* ── WHATSAPP ── */
/* ── integração com o RelatPost ── */
function relatUrl(){ try{ return localStorage.getItem('ds_relat_url')||''; }catch(e){ return ''; } }
function setRelatUrl(){
  var v=prompt('Endereço do RelatPost (ex.: https://meu-relatpost.netlify.app):', relatUrl());
  if(v===null) return false;
  var u=v.trim().replace(/\/+$/,'');
  if(u && !/^https?:\/\/.+\..+/i.test(u)){ toast('Endereço inválido','err'); return false; }
  try{ localStorage.setItem('ds_relat_url',u); }catch(e){}
  try{ if(sb) sb.auth.updateUser({data:{relat_url:u}}); }catch(e){}
  toast(u?'Endereço do RelatPost salvo':'Endereço removido');
  return true;
}
function openRelat(id){
  var u=relatUrl();
  if(!u){ setRelatUrl(); u=relatUrl(); if(!u) return; }
  window.open(u+(id?'#cliente='+encodeURIComponent(id):''),'_blank','noopener');
}
function wppCliente(id){
  const c=clientes.find(x=>x.id===id);if(!c) return;
  let msg=`🎨 *DAGNER DESIGN*\n\n*Empresa:* ${c.empresa}\n*Responsável:* ${c.responsavel}\n`;
  if(c.telefone) msg+=`*Tel:* ${c.telefone}\n`;
  msg+=`*Mídias:* ${c.qtdMidias||0}/semana\n*Dias:* ${c.dias.map(d=>DIAS[d]).join(', ')||'—'}\n`;
  if(c.observacoes) msg+=`\n*Obs:* ${c.observacoes}\n`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
}
function wppSemana(){
  const t=now();
  let msg=`📅 *DAGNER DESIGN — Agenda Semanal*\n_${fmtDateLong(t)}_\n\n`;
  let ok=false;
  DIAS.forEach((dia,i)=>{const d=clientes.filter(c=>c.status==='ativo'&&c.dias.includes(i));if(d.length){ok=true;msg+=`*${dia.toUpperCase()}*\n`;d.forEach(c=>msg+=`• ${c.empresa}\n`);msg+='\n';}});
  if(!ok) msg+='Nenhuma publicação agendada.';
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
}

/* ── PDF ── */
function exportPDF(){
  if(!window.jspdf){toast('jsPDF carregando.','err');return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297,M=14;
  const CW=W-M*2; // largura útil = 182mm
  const dbg=[255,255,255],cbg=[255,255,255],acc=[45,45,45],wh=[255,255,255],mu=[110,110,110],lt=[20,20,20];
  const grid=[205,205,205],zebra=[245,245,245],cinzaT=[225,225,225];

  // fundo + cabeçalho página 1
  doc.setFillColor(...dbg);doc.rect(0,0,W,H,'F');
  doc.setFillColor(...acc);doc.rect(0,0,W,22,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...wh);doc.text('DAGNER DESIGN',M,13);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...cinzaT);doc.text('RELATÓRIO DE CLIENTES',M,19);
  doc.setTextColor(...wh);doc.text(`${new Date().toLocaleDateString('pt-BR',{dateStyle:'full'})}`,W-M,13,{align:'right'});

  // ── Bloco de resumo financeiro (considera apenas clientes ativos) ──
  const ativos_=clientes.filter(c=>c.status==='ativo');
  const receitaT=ativos_.reduce((s,c)=>s+(parseFloat(c.valorMensal)||0),0);
  const hj=new Date(); const mesK=`${hj.getFullYear()}-${String(hj.getMonth()+1).padStart(2,'0')}`;
  const entMes=entregas.filter(e=>e.dataEntrega?.startsWith(mesK)).length;
  const totalMid=ativos_.reduce((s,c)=>s+(parseInt(c.qtdMidias)||0),0);
  const summaryItems=[
    {lbl:'Receita mensal',val:fmtBRL(receitaT)},
    {lbl:'Clientes ativos',val:String(ativos_.length)},
    {lbl:'Artes entregues (mês)',val:String(entMes)},
    {lbl:'Mídias / semana',val:String(totalMid)},
  ];
  const sW=(CW-6)/4; let sx=M;
  summaryItems.forEach(item=>{
    doc.setFillColor(...zebra); doc.rect(sx,26,sW,18,'F');
    doc.setDrawColor(...grid); doc.setLineWidth(.3); doc.rect(sx,26,sW,18,'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...lt);
    doc.text(item.val,sx+sW/2,34,{align:'center'});
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...mu);
    doc.text(item.lbl,sx+sW/2,40,{align:'center'});
    sx+=sW+2;
  });

  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...acc);doc.text('CLIENTES',M,52);

  // callback reutilizável: desenha fundo escuro ANTES do conteúdo nas páginas novas
  const bgNewPage = data => { if(data.pageNumber>1){ doc.setFillColor(...dbg); doc.rect(0,0,W,H,'F'); } };

  // ── Tabela clientes (colunas somam 182mm) ──
  doc.autoTable({
    startY:56, margin:{left:M,right:M}, tableWidth:CW,
    head:[['#','Empresa','Responsável','Tel','Mídias','Valor/mês','Status','Dias']],
    body:clientes.map((c,i)=>[
      i+1,c.empresa,c.responsavel,c.telefone||'—',
      c.qtdMidias||0,c.valorMensal?fmtBRL(c.valorMensal):'—',
      c.status,c.dias.map(d=>DIAS_A[d]).join(' ')
    ]),
    theme:'grid',
    styles:{fillColor:cbg,textColor:lt,lineColor:grid,lineWidth:.3,fontSize:7,cellPadding:2.2,overflow:'linebreak'},
    headStyles:{fillColor:acc,textColor:wh,fontStyle:'bold',fontSize:7.5},
    alternateRowStyles:{fillColor:zebra},
    columnStyles:{
      0:{cellWidth:6,halign:'center'},1:{cellWidth:34},2:{cellWidth:30},
      3:{cellWidth:23},4:{cellWidth:12,halign:'center'},5:{cellWidth:22},
      6:{cellWidth:17},7:{cellWidth:38}
    },
    willDrawPage: bgNewPage
  });

  let y=(doc.lastAutoTable?.finalY||40)+14;
  if(y>252){doc.addPage();doc.setFillColor(...dbg);doc.rect(0,0,W,H,'F');y=16;}

  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...acc);doc.text('CALENDÁRIO SEMANAL',M,y);

  // ── Tabela calendário (colunas somam 182mm) ──
  doc.autoTable({
    startY:y+5, margin:{left:M,right:M}, tableWidth:CW,
    head:[['Dia','Clientes Ativos','Total']],
    body:DIAS.map((dia,i)=>{
      const d=clientes.filter(c=>c.status==='ativo'&&c.dias.includes(i));
      return[dia,d.map(c=>c.empresa).join(', ')||'—',d.length||'—'];
    }),
    theme:'grid',
    styles:{fillColor:cbg,textColor:lt,lineColor:grid,lineWidth:.3,fontSize:8,cellPadding:3,overflow:'linebreak'},
    headStyles:{fillColor:acc,textColor:wh,fontStyle:'bold'},
    alternateRowStyles:{fillColor:zebra},
    columnStyles:{0:{cellWidth:26},1:{cellWidth:136},2:{cellWidth:20,halign:'center'}},
    willDrawPage: bgNewPage
  });

  // numeração de páginas (só texto, sem repintar fundo)
  const pages=doc.internal.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(...mu);
    doc.text(`DAGNER DESIGN · Pág. ${p}/${pages}`,W/2,H-6,{align:'center'});
  }
  doc.save(`ds-designer-${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF exportado!','ok');
}

/* ── BACKUP / RESTORE ── */
const BACKUP_TS_KEY='ds_last_backup_at_v1';

function backupRelativeLabel(date){
  const diff=Math.max(0,Date.now()-date.getTime());
  const mins=Math.floor(diff/60000);
  if(mins<1) return 'agora';
  if(mins<60) return `há ${mins} min`;
  const hrs=Math.floor(diff/3600000);
  if(hrs<24) return `há ${hrs}h`;
  const days=Math.floor(diff/86400000);
  if(days===1) return 'ontem';
  return `há ${days} dias`;
}

function updateBackupStatus(){
  const el=document.getElementById('backup-status');
  if(!el) return;
  const txt=el.querySelector('.backup-status-text');
  const raw=localStorage.getItem(BACKUP_TS_KEY);
  el.classList.remove('backup-never','backup-fresh','backup-warn','backup-stale');
  if(!raw){
    el.classList.add('backup-never');
    if(txt) txt.textContent='Backup: nunca';
    el.setAttribute('data-tip','Nenhum backup registrado neste navegador');
    return;
  }
  const d=new Date(raw);
  if(Number.isNaN(d.getTime())){
    localStorage.removeItem(BACKUP_TS_KEY);
    updateBackupStatus();
    return;
  }
  const ageDays=(Date.now()-d.getTime())/86400000;
  el.classList.add(ageDays<3?'backup-fresh':ageDays<7?'backup-warn':'backup-stale');
  if(txt) txt.textContent=`Backup: ${backupRelativeLabel(d)}`;
  const exact=`${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  el.setAttribute('data-tip',`Último backup: ${exact}`);
}

function markBackupDone(){
  localStorage.setItem(BACKUP_TS_KEY,new Date().toISOString());
  updateBackupStatus();
}

async function backupData(){
  const btn=document.querySelector('.btn-bkp');
  if(btn){btn.disabled=true;}
  try{
    const hoje=new Date().toISOString().slice(0,10);
    const {data:{user}}=await authUser();
    const uid=user?.id||null;

    // ── 1. Entregas completas (paginado sem corte de 1.000 linhas) ──
    let entregasBackup=[];
    try{
      const rows=await fetchAllSupabase(()=>sb.from('entregas').select('*').order('data_entrega',{ascending:true}).order('id',{ascending:true}));
      entregasBackup=(rows||[]).map(r=>({id:r.id,clienteId:r.cliente_id,dataEntrega:r.data_entrega}));
    }catch(e){ console.warn('Backup entregas warning:',e.message); entregasBackup=entregas.map(x=>({...x})); }

    // ── 2. Pagamentos completos (paginado) ──
    let pagamentosBackup=pagamentos.map(p=>({...p}));
    try{
      const rows=await fetchAllSupabase(()=>sb.from('pagamentos').select('*').order('data_pagamento',{ascending:false}).order('id',{ascending:false}));
      if(rows&&rows.length) pagamentosBackup=rows.map(r=>({
        id:r.id,clienteId:r.cliente_id,mesReferencia:r.mes_referencia,
        valorPago:r.valor_pago||0,dataPagamento:r.data_pagamento,
        formaPagamento:r.forma_pagamento||'pix',observacao:r.observacao||''
      }));
    }catch(e){}

    // ── 3. Tarefas (banco + fallback local) ──
    let tarefasBackup=[];
    try{
      if(tarefasUseDb&&sb&&uid){
        const rows=await fetchAllSupabase(()=>sb.from('tarefas').select('*').eq('user_id',uid).order('data_tarefa',{ascending:true}).order('id',{ascending:true}));
        tarefasBackup=(rows||[]).map(r=>({id:r.id,dataTarefa:r.data_tarefa,texto:r.texto,clienteId:r.cliente_id||null,concluida:!!r.concluida}));
      } else {
        for(const [ds,arr] of Object.entries(tarefasLocalGetAll()||{})){
          for(const t of (arr||[])) tarefasBackup.push({id:t.id,dataTarefa:ds,texto:t.texto,clienteId:t.clienteId||null,concluida:!!t.concluida});
        }
      }
    }catch(e){ console.warn('Backup tarefas warning:',e.message); }

    // ── 4. Demandas e Briefings (v61) ──
    let demandasBackup=[], briefingsBackup={};
    try{
      if(sb&&uid){
        const rd=await sb.from('demandas').select('*').eq('user_id',uid).order('criado_em',{ascending:true});
        if(!rd.error&&rd.data) demandasBackup=rd.data.map(r=>({id:r.id,titulo:r.titulo||'',clienteId:r.cliente_id||'',status:r.status||'briefing',entrega:r.data_entrega||'',formato:r.formato||'',legenda:r.legenda||''}));
        else demandasBackup=JSON.parse(localStorage.getItem('ds_demandas_v61')||'[]')||[];
        const rb=await sb.from('briefings').select('*').eq('user_id',uid);
        if(!rb.error&&rb.data) rb.data.forEach(x=>{ briefingsBackup[String(x.cliente_id)]=x.dados||{}; });
        else briefingsBackup=JSON.parse(localStorage.getItem('ds_briefings_v61')||'{}')||{};
      }
    }catch(e){}

    // ── 5. Despesas (v62 + fim de recorrência V110) ──
    let despesasBackup=[];
    const despEndsMap=(typeof window.dsDespEndsAll==='function')?window.dsDespEndsAll():(JSON.parse(localStorage.getItem('ds_desp_end_v110_'+(uid||'local'))||'{}')||{});
    try{
      if(sb&&uid){
        const rx=await sb.from('despesas').select('*').eq('user_id',uid).order('data',{ascending:false});
        if(!rx.error&&rx.data) despesasBackup=rx.data.map(r=>({id:r.id,descricao:r.descricao||'',valor:Number(r.valor)||0,data:String(r.data||'').slice(0,10),categoria:r.categoria||'Outros',recorrente:!!r.recorrente,fimRecorrencia:String(despEndsMap[String(r.id)]||'')}));
        else despesasBackup=(JSON.parse(localStorage.getItem('ds_despesas_v62')||'[]')||[]).map(r=>({...r,fimRecorrencia:String(despEndsMap[String(r.id)]||r.fimRecorrencia||'')}));
      }
    }catch(e){}

    // ── 6. Datas sazonais personalizadas e preferências ──
    let datasSazonais=[], preferencias={};
    try{ datasSazonais=JSON.parse(localStorage.getItem('sz_custom_dates_v80')||'[]')||[]; }catch(e){}
    try{
      const pKey='ds_v100_priorities_'+(uid||'local');
      const exKey='ds_extras_fin_v109_'+(uid||'local');
      const tmKey='ds_time_logs_v109_'+(uid||'local');
      preferencias={
        priorities:JSON.parse(localStorage.getItem(pKey)||'{}')||{},
        modelosLegenda:JSON.parse(localStorage.getItem('ds_modelos_leg')||'[]')||[],
        meuWhats:localStorage.getItem('ds_meu_whats')||'',
        relatUrl:localStorage.getItem('ds_relat_url')||'',
        pixConfig:JSON.parse(localStorage.getItem('ds_pix_cfg_v109')||'{}')||{},
        extrasFinanceiro:JSON.parse(localStorage.getItem(exKey)||'{}')||{},
        tempoClientes:JSON.parse(localStorage.getItem(tmKey)||'{}')||{},
        despesasFimRecorrencia:despEndsMap
      };
    }catch(e){}

    const payload={
      versao:'9.1',
      app:'DAGNER DESIGN',
      exportadoEm:new Date().toISOString(),
      clientes:clientes.map(c=>({...c})),
      done:[...done],
      entregas:entregasBackup,
      pagamentos:pagamentosBackup,
      tarefas:tarefasBackup,
      demandas:demandasBackup,
      briefings:briefingsBackup,
      despesas:despesasBackup,
      datasSazonais,
      preferencias
    };
    const jsonBlob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const jsonUrl=URL.createObjectURL(jsonBlob);
    const jsonLink=document.createElement('a');
    jsonLink.href=jsonUrl;
    jsonLink.download=`ds-backup-dados-${hoje}.json`;
    document.body.appendChild(jsonLink); jsonLink.click();
    document.body.removeChild(jsonLink); URL.revokeObjectURL(jsonUrl);

    markBackupDone();
    toast(`Backup V9.1 completo! (${clientes.length} clientes · ${entregasBackup.length} entregas · ${pagamentosBackup.length} pagamentos · ${tarefasBackup.length} tarefas)`,'ok');
  }catch(e){toast('Erro no backup: '+e.message,'err');}
  finally{if(btn){btn.disabled=false;}}
}

function restoreData(){ document.getElementById('restore-input').click(); }

async function handleRestore(e){
  const file=e.target.files[0];if(!file) return;
  const reader=new FileReader();
  reader.onload=async(ev)=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!data.clientes||!Array.isArray(data.clientes)) throw new Error('Formato inválido');
      setSyncStatus('saving');
      showLoading('Importando clientes...');
      const {data:{user}}=await authUser();

      let statsClientes=0, statsEntregas=0, statsPagamentos=0, statsTarefas=0, statsDemandas=0, statsDespesas=0, statsDuplicatas=0, statsErros=0;

      // 1. Restaurar clientes (ignora empresas que já existem e preserva cores/ícones)
      const _existentes=new Set(clientes.map(x=>String(x.empresa||'').trim().toLowerCase()));
      for(const c of data.clientes){
        if(_existentes.has(String(c.empresa||'').trim().toLowerCase())){ statsDuplicatas++; continue; }
        try{
          await dbInsert({
            empresa:c.empresa, responsavel:c.responsavel, telefone:c.telefone||'',
            qtdMidias:c.qtdMidias||0, dias:c.dias||[], observacoes:c.observacoes||'',
            status:c.status||'ativo', valorMensal:c.valorMensal||0,
            instagram:c.instagram||'', diaCobranca:c.diaCobranca||0,
            logoUrl:c.logoUrl||'', cor:c.cor||'', icone:c.icone||'',
            capaUrl:c.capaUrl||'', logoDarkUrl:c.logoDarkUrl||''
          }, null);
          statsClientes++;
        }catch(err){
          const msg=err.message?.toLowerCase()||'';
          if(msg.includes('duplicate')||msg.includes('unique')||msg.includes('already')) statsDuplicatas++;
          else statsErros++;
        }
      }

      // Mapa de ID antigo -> ID atual no banco (para relacionar entregas, pagamentos, tarefas, demandas e briefings)
      const {data:todosClientesDb}=await sb.from('clientes').select('id,empresa').eq('user_id',user.id);
      const mapaEmpresa={};
      (todosClientesDb||[]).forEach(nc=>{ mapaEmpresa[String(nc.empresa||'').trim().toLowerCase()]=nc.id; });
      const mapaId={};
      data.clientes.forEach(c=>{
        const nome=String(c.empresa||'').trim().toLowerCase();
        if(mapaEmpresa[nome]) mapaId[String(c.id)]=mapaEmpresa[nome];
      });

      // 2. Restaurar histórico de entregas (sem duplicar registros existentes)
      if(Array.isArray(data.entregas)&&data.entregas.length>0){
        showLoading(`Importando ${data.entregas.length} entregas...`);
        const entAtuais=await fetchAllSupabase(()=>sb.from('entregas').select('cliente_id,data_entrega').eq('user_id',user.id).order('id',{ascending:true})).catch(()=>[]);
        const entExistentes=new Set((entAtuais||[]).map(x=>`${x.cliente_id}_${x.data_entrega}`));
        const lote=[];
        for(const ent of data.entregas){
          const novoClienteId=mapaId[String(ent.clienteId)];
          if(!novoClienteId||!ent.dataEntrega){ statsErros++; continue; }
          const k=`${novoClienteId}_${ent.dataEntrega}`;
          if(entExistentes.has(k)){ statsDuplicatas++; continue; }
          entExistentes.add(k);
          lote.push({user_id:user.id,cliente_id:novoClienteId,data_entrega:ent.dataEntrega});
        }
        for(let i=0;i<lote.length;i+=250){
          const chunk=lote.slice(i,i+250);
          const {error}=await sb.from('entregas').insert(chunk);
          if(!error){ statsEntregas+=chunk.length; }
          else {
            for(const row of chunk){
              const r=await sb.from('entregas').insert(row);
              if(!r.error) statsEntregas++;
              else if(/duplicate|unique/i.test(r.error.message||'')) statsDuplicatas++;
              else statsErros++;
            }
          }
        }
      }

      if(data.done) done=new Set(data.done); saveDone();

      // 3. Restaurar pagamentos (v7.0+)
      if(Array.isArray(data.pagamentos)&&data.pagamentos.length>0){
        showLoading(`Importando ${data.pagamentos.length} pagamentos...`);
        const pgAtuais=await fetchAllSupabase(()=>sb.from('pagamentos').select('cliente_id,mes_referencia').eq('user_id',user.id).order('id',{ascending:true})).catch(()=>[]);
        const pgExistentes=new Set((pgAtuais||[]).map(x=>`${x.cliente_id}_${x.mes_referencia}`));
        for(const pg of data.pagamentos){
          const novoClienteId=mapaId[String(pg.clienteId)];
          if(!novoClienteId){ statsErros++; continue; }
          const k=`${novoClienteId}_${pg.mesReferencia}`;
          if(pgExistentes.has(k)){ statsDuplicatas++; continue; }
          pgExistentes.add(k);
          try{
            const {error}=await sb.from('pagamentos').insert({
              user_id:user.id, cliente_id:novoClienteId,
              mes_referencia:pg.mesReferencia, valor_pago:pg.valorPago||0,
              data_pagamento:pg.dataPagamento||new Date().toISOString(),
              forma_pagamento:pg.formaPagamento||'pix', observacao:pg.observacao||''
            });
            if(error) throw error;
            statsPagamentos++;
          }catch(err){
            const msg=err.message?.toLowerCase()||'';
            if(msg.includes('duplicate')||msg.includes('unique')) statsDuplicatas++;
            else statsErros++;
          }
        }
      }

      // 4. Restaurar tarefas (v8.0+)
      if(Array.isArray(data.tarefas)&&data.tarefas.length>0){
        showLoading(`Importando ${data.tarefas.length} tarefas...`);
        if(tarefasUseDb&&sb){
          const tarAtuais=await fetchAllSupabase(()=>sb.from('tarefas').select('data_tarefa,texto,cliente_id').eq('user_id',user.id).order('id',{ascending:true})).catch(()=>null);
          if(tarAtuais){
            const tarSet=new Set(tarAtuais.map(x=>`${x.data_tarefa}|${x.texto}|${x.cliente_id||''}`));
            for(const t of data.tarefas){
              const cid=t.clienteId?(mapaId[String(t.clienteId)]||null):null;
              const k=`${t.dataTarefa}|${t.texto}|${cid||''}`;
              if(tarSet.has(k)){ statsDuplicatas++; continue; }
              tarSet.add(k);
              const {error}=await sb.from('tarefas').insert({user_id:user.id,data_tarefa:t.dataTarefa,texto:t.texto,cliente_id:cid,concluida:!!t.concluida});
              if(!error) statsTarefas++; else statsErros++;
            }
          }
        } else {
          const all=tarefasLocalGetAll();
          for(const t of data.tarefas){
            const cid=t.clienteId?(mapaId[String(t.clienteId)]||null):null;
            all[t.dataTarefa]=all[t.dataTarefa]||[];
            if(!all[t.dataTarefa].some(x=>x.texto===t.texto)){
              all[t.dataTarefa].push({id:t.id||('loc_'+Date.now()+Math.random()),texto:t.texto,clienteId:cid,concluida:!!t.concluida});
              statsTarefas++;
            }
          }
          tarefasLocalSetAll(all);
        }
      }

      // 5. Restaurar demandas e briefings (v8.0+)
      if(Array.isArray(data.demandas)&&data.demandas.length>0){
        showLoading(`Importando ${data.demandas.length} demandas...`);
        const rd=await sb.from('demandas').select('titulo,cliente_id,data_entrega').eq('user_id',user.id);
        if(!rd.error){
          const demSet=new Set((rd.data||[]).map(x=>`${x.titulo}|${x.cliente_id||''}|${x.data_entrega||''}`));
          for(const d of data.demandas){
            const cid=d.clienteId?(mapaId[String(d.clienteId)]||null):null;
            const k=`${d.titulo}|${cid||''}|${d.entrega||''}`;
            if(demSet.has(k)) continue;
            demSet.add(k);
            const ins=await sb.from('demandas').insert({user_id:user.id,titulo:d.titulo,cliente_id:cid,status:d.status||'briefing',data_entrega:d.entrega||null,formato:d.formato||'',legenda:d.legenda||''});
            if(!ins.error) statsDemandas++;
          }
        } else {
          localStorage.setItem('ds_demandas_v61',JSON.stringify(data.demandas.map(d=>({...d,clienteId:d.clienteId?(mapaId[String(d.clienteId)]||d.clienteId):''}))));
          statsDemandas+=data.demandas.length;
        }
      }
      if(data.briefings&&typeof data.briefings==='object'){
        for(const [oldCid,dados] of Object.entries(data.briefings)){
          const cid=mapaId[String(oldCid)];
          if(!cid||!dados) continue;
          const up=await sb.from('briefings').upsert({cliente_id:cid,user_id:user.id,dados},{onConflict:'cliente_id'});
          if(up.error){
            const lb=JSON.parse(localStorage.getItem('ds_briefings_v61')||'{}')||{};
            lb[cid]=dados; localStorage.setItem('ds_briefings_v61',JSON.stringify(lb));
          }
        }
      }

      // 6. Restaurar despesas (v8.0+ e fimRecorrencia V110)
      if(Array.isArray(data.despesas)&&data.despesas.length>0){
        const endStorageKey='ds_desp_end_v110_'+user.id;
        const curEnds=JSON.parse(localStorage.getItem(endStorageKey)||'{}')||{};
        const bkpEnds=(data.preferencias&&data.preferencias.despesasFimRecorrencia)||{};
        const rx=await sb.from('despesas').select('id,descricao,data,valor').eq('user_id',user.id);
        if(!rx.error){
          const despMap={};
          (rx.data||[]).forEach(x=>{ despMap[`${x.descricao}|${String(x.data).slice(0,10)}|${Number(x.valor)}`]=x.id; });
          for(const d of data.despesas){
            const k=`${d.descricao}|${String(d.data).slice(0,10)}|${Number(d.valor)}`;
            const fimVal=d.fimRecorrencia||(bkpEnds&&typeof bkpEnds==='object'?bkpEnds[String(d.id)]:'')||'';
            if(despMap[k]){
              if(fimVal&&!curEnds[String(despMap[k])]) curEnds[String(despMap[k])]=fimVal;
              continue;
            }
            const ins=await sb.from('despesas').insert({user_id:user.id,descricao:d.descricao,valor:Number(d.valor)||0,data:d.data,categoria:d.categoria||'Outros',recorrente:!!d.recorrente}).select('id').single();
            if(!ins.error&&ins.data){
              despMap[k]=ins.data.id;
              if(fimVal) curEnds[String(ins.data.id)]=fimVal;
              statsDespesas++;
            }
          }
          localStorage.setItem(endStorageKey,JSON.stringify(curEnds));
        } else {
          localStorage.setItem('ds_despesas_v62',JSON.stringify(data.despesas));
          data.despesas.forEach(d=>{ if(d.id&&d.fimRecorrencia) curEnds[String(d.id)]=d.fimRecorrencia; });
          localStorage.setItem(endStorageKey,JSON.stringify(curEnds));
          statsDespesas+=data.despesas.length;
        }
      }

      // 7. Restaurar datas sazonais e preferências
      if(Array.isArray(data.datasSazonais)&&data.datasSazonais.length>0){
        try{
          const curSz=JSON.parse(localStorage.getItem('sz_custom_dates_v80')||'[]')||[];
          const keys=new Set(curSz.map(x=>`${x.m}-${x.d}-${x.name}`));
          data.datasSazonais.forEach(x=>{ if(!keys.has(`${x.m}-${x.d}-${x.name}`)) curSz.push(x); });
          localStorage.setItem('sz_custom_dates_v80',JSON.stringify(curSz));
          szLoadCustom(); _szCache={key:null,val:null};
        }catch(e){}
      }
      if(data.preferencias&&typeof data.preferencias==='object'){
        try{
          const p=data.preferencias;
          if(p.meuWhats&&!localStorage.getItem('ds_meu_whats')) localStorage.setItem('ds_meu_whats',p.meuWhats);
          if(p.relatUrl&&!localStorage.getItem('ds_relat_url')) localStorage.setItem('ds_relat_url',p.relatUrl);
          if(Array.isArray(p.modelosLegenda)&&p.modelosLegenda.length) localStorage.setItem('ds_modelos_leg',JSON.stringify(p.modelosLegenda));
          if(p.priorities&&typeof p.priorities==='object'){
            const pk='ds_v100_priorities_'+user.id;
            const curP=JSON.parse(localStorage.getItem(pk)||'{}')||{};
            localStorage.setItem(pk,JSON.stringify({...p.priorities,...curP}));
          }
          if(p.pixConfig&&typeof p.pixConfig==='object'&&p.pixConfig.chave){
            const curPix=JSON.parse(localStorage.getItem('ds_pix_cfg_v109')||'{}')||{};
            if(!curPix.chave) localStorage.setItem('ds_pix_cfg_v109',JSON.stringify(p.pixConfig));
          }
          if(p.extrasFinanceiro&&typeof p.extrasFinanceiro==='object'){
            const ek='ds_extras_fin_v109_'+user.id;
            const curEx=JSON.parse(localStorage.getItem(ek)||'{}')||{};
            for(const [rawK,arr] of Object.entries(p.extrasFinanceiro)){
              if(!Array.isArray(arr)||!arr.length) continue;
              const idx=rawK.indexOf('_');
              if(idx<0) continue;
              const mkPart=rawK.slice(0,idx), oldCid=rawK.slice(idx+1);
              const newCid=mapaId[String(oldCid)]||oldCid;
              const nk=`${mkPart}_${newCid}`;
              if(!Array.isArray(curEx[nk])||!curEx[nk].length) curEx[nk]=arr;
            }
            localStorage.setItem(ek,JSON.stringify(curEx));
          }
          if(p.tempoClientes&&typeof p.tempoClientes==='object'){
            const tk='ds_time_logs_v109_'+user.id;
            const curTm=JSON.parse(localStorage.getItem(tk)||'{}')||{};
            for(const [rawK,sec] of Object.entries(p.tempoClientes)){
              const nSec=Number(sec)||0;
              if(nSec<=0) continue;
              const idx=rawK.indexOf('_');
              if(idx<0) continue;
              const mkPart=rawK.slice(0,idx), oldCid=rawK.slice(idx+1);
              const newCid=mapaId[String(oldCid)]||oldCid;
              const nk=`${mkPart}_${newCid}`;
              if(!(Number(curTm[nk])>0)) curTm[nk]=nSec;
            }
            localStorage.setItem(tk,JSON.stringify(curTm));
          }
        }catch(e){}
      }

      await Promise.all([fetchClientes(),fetchEntregas(),fetchPagamentos(),loadTarefasHoje(),loadTarefasPendentes()]);
      syncDoneFromEntregas();
      saveCache();
      render(); hideLoading(); setSyncStatus('ok');

      const partes=[`${statsClientes} cliente${statsClientes!==1?'s':''} restaurado${statsClientes!==1?'s':''}`];
      if(statsEntregas>0)   partes.push(`${statsEntregas} entrega${statsEntregas!==1?'s':''}`);
      if(statsPagamentos>0) partes.push(`${statsPagamentos} pagamento${statsPagamentos!==1?'s':''}`);
      if(statsTarefas>0)    partes.push(`${statsTarefas} tarefa${statsTarefas!==1?'s':''}`);
      if(statsDemandas>0)   partes.push(`${statsDemandas} demanda${statsDemandas!==1?'s':''}`);
      if(statsDespesas>0)   partes.push(`${statsDespesas} despesa${statsDespesas!==1?'s':''}`);
      if(statsDuplicatas>0) partes.push(`${statsDuplicatas} duplicata${statsDuplicatas!==1?'s':''} ignorada${statsDuplicatas!==1?'s':''}`);
      if(statsErros>0)      partes.push(`${statsErros} erro${statsErros!==1?'s':''}`);
      toast(partes.join(' · ')+'!', statsErros>0?'err':'ok');
    }catch(err){hideLoading();setSyncStatus('error');toast('Erro: '+err.message,'err');}
  };
  reader.readAsText(file); e.target.value='';
}

/* ── BRAND LOGO ── */
const BRAND_LOGO_KEY='ds_brand_logo_url';
function loadBrandLogo(){
  try{
    // V99: a identidade nova substitui a versão da marca guardada no navegador, uma única vez.
    if(!localStorage.getItem('ds_brand_logo_dagner_v99')){
      localStorage.removeItem(BRAND_LOGO_KEY);
      localStorage.setItem('ds_brand_logo_dagner_v99','1');
    }
  }catch(e){}
  let url=null;
  try{ url=localStorage.getItem(BRAND_LOGO_KEY); }catch(e){}
  applyBrandLogo(url||'icons/logo.png?v=105');
}
function applyBrandLogo(url){
  const img=document.getElementById('brand-logo-img');
  const txt=document.getElementById('logo-mark-text');
  if(!img||!txt) return;
  img.src=url; img.style.display='block'; txt.style.display='none';
}
async function handleBrandLogoUpload(e){
  const file=e.target.files[0]; if(!file) return;
  if(!/^image\//i.test(file.type||'')){ toast('Selecione uma imagem válida.','err'); e.target.value=''; return; }
  if(file.size > 15*1024*1024){ toast('A imagem deve ter no máximo 15 MB.','err'); e.target.value=''; return; }
  if(!sb){ toast('Conecte ao Supabase primeiro.','err'); e.target.value=''; return; }
  toast('Enviando logo...','inf');
  try{
    const optimized=(typeof window.dsCompressImage==='function')
      ? await window.dsCompressImage(file,{maxDim:512,quality:0.90})
      : file;
    const rawName=optimized.name||file.name||'logo.webp';
    const ext=(rawName.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,'')||'webp';
    // Nome sempre único — evita upsert/UPDATE (que pode trombar com RLS em arquivos antigos)
    const path=`studio-logo-${Date.now()}.${ext}`;
    const {error}=await sb.storage.from('brand').upload(path,optimized,{contentType:optimized.type||file.type});
    if(error) throw error;
    const {data}=sb.storage.from('brand').getPublicUrl(path);
    const url=data.publicUrl;
    localStorage.setItem(BRAND_LOGO_KEY,url);
    applyBrandLogo(url);
    toast('Logo atualizada! ','ok');
  }catch(err){ toast('Erro no upload: '+err.message,'err'); }
  e.target.value='';
}

/* ── FILTRO CLIENTES ── */
function setCF(val,btn){
  clientesFiltro=val;
  document.querySelectorAll('.cfilter-btn').forEach(b=>b.classList.toggle('active',b===btn));
  renderClientes();
}

/* ── PC CONFIRM MODAL ── */
function openPcConfirm(ttl,txt,cb){
  pcConfirmCallback=cb;
  const box=document.getElementById('pc-confirm-bg');
  if(!box) return;
  document.getElementById('pc-confirm-ttl').textContent=ttl;
  document.getElementById('pc-confirm-txt').textContent=txt;
  const ico=document.querySelector('.pc-confirm-ico');
  if(ico) ico.className=`pc-confirm-ico ti ${ttl.includes('Desmarcar')?'ti-refresh':'ti-checks'}`;
  const okBtn=document.getElementById('pc-confirm-ok');
  if(okBtn){ okBtn.onclick=()=>{ closePcConfirm(); if(cb) cb(); }; }
  box.classList.add('open');
}
function closePcConfirm(){
  const box=document.getElementById('pc-confirm-bg');
  if(box) box.classList.remove('open');
  pcConfirmCallback=null;
}

/* ── CONFETTI ── */
function launchConfetti(){
  const colors=['#E8EBF0','#E8EBF0','#10B981','#F59E0B','#E8EBF0','#818CF8','#34D399','#67E8F9'];
  for(let i=0;i<70;i++){
    const el=document.createElement('div');
    el.className='confetti-c';
    const size=5+Math.random()*9;
    el.style.cssText=`left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${1.4+Math.random()*2}s;animation-delay:${Math.random()*.6}s;opacity:${.7+Math.random()*.3};transform:rotate(${Math.random()*360}deg);border-radius:${Math.random()>.5?'50%':'2px'}`;
    document.body.appendChild(el);
    el.addEventListener('animationend',()=>el.remove(),{once:true});
  }
}

/* ── TOAST ── */
function toast(msg,type='inf'){
  const wrap=document.getElementById('toast-wrap');
  const icons={ok:'ti-circle-check',err:'ti-alert-circle',inf:'ti-info-circle'};
  const cls={ok:'tok',err:'terr',inf:'tinf'};
  const div=document.createElement('div'); div.className=`toast ${cls[type]||'tinf'}`;
  div.innerHTML=`<i class="ti ${icons[type]}"></i><span>${esc(msg)}</span>`;
  wrap.appendChild(div);
  setTimeout(()=>{div.style.transition='opacity .3s';div.style.opacity='0';setTimeout(()=>div.remove(),320);},3500);
}

/* ── EVENTS ── */
document.getElementById('modal-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.getElementById('confirm-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeConfirm();});
document.getElementById('daymod-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDayModal();});
document.getElementById('pc-confirm-bg')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closePcConfirm();});
document.getElementById('modal-box').addEventListener('keydown',e=>{
  if(e.key==='Escape')closeModal();
  if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='SELECT'){e.preventDefault();saveCliente();}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeConfirm();closeDayModal();closePcConfirm();}
});
document.getElementById('auth-email').addEventListener('keydown',e=>{if(e.key==='Enter')handleAuth();});
document.getElementById('auth-password').addEventListener('keydown',e=>{if(e.key==='Enter')handleAuth();});

/* ════════════════════════════════════
   EMISSÃO DE RECIBO
════════════════════════════════════ */
let reciboClienteId = null;
let reciboSvcCount  = 0;

function openReciboModal(clienteId, pagamentoId=null) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;
  reciboClienteId = clienteId;

  // Preenche dados do cliente
  document.getElementById('rb-cliente').value  = c.empresa;
  document.getElementById('rb-contato').value  = c.telefone || '';

  // Tenta usar dados do pagamento se informado
  const pg = pagamentoId ? pagamentos.find(p=>p.id===pagamentoId) : null;
  const hoje = now();
  const mesRef = pg?.mesReferencia || (typeof cbYear!=='undefined'&&cbYear ? cbMesStr(cbYear,cbMonth) : cbMesStr(hoje.getFullYear(),hoje.getMonth()+1));
  const extrasMes = (typeof window.dsExtrasDoMes==='function') ? window.dsExtrasDoMes(clienteId, mesRef) : [];
  const somaExtras = extrasMes.reduce((s,x)=>s+(Number(x.valor)||0),0);

  // Data
  let dataFmt;
  if(pg && pg.dataPagamento){
    const d=new Date(pg.dataPagamento);
    dataFmt=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } else {
    dataFmt=`${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
  }
  document.getElementById('rb-data').value = dataFmt;

  // Limpa linhas
  reciboSvcCount = 0;
  document.getElementById('recibo-svc-list').innerHTML = '';
  document.getElementById('recibo-preview-doc').classList.remove('visible');
  document.getElementById('recibo-preview-doc').innerHTML = '';

  if(pg){
    const mesLabel = cbMesLabel ? cbMesLabel(pg.mesReferencia) : pg.mesReferencia;
    if(extrasMes.length > 0){
      const basePago = Math.max(0, (Number(pg.valorPago)||0) - somaExtras);
      if(basePago > 0 || (Number(c.valorMensal)||0) > 0){
        reciboAddSvc('Gerenciamento completo do perfil', `Mensalidade — ${mesLabel}`, String(Math.round(basePago * 100)));
      }
      extrasMes.forEach(ex=>{
        reciboAddSvc(ex.servico||'Criação de cards/artes para o perfil', ex.descricao||'Serviço avulso', String(Math.round((Number(ex.valor)||0)*100)));
      });
    } else {
      const valorRaw = pg.valorPago ? String(Math.round(pg.valorPago * 100)) : '';
      reciboAddSvc('Gerenciamento completo do perfil', `Mensalidade — ${mesLabel}`, valorRaw);
    }
    reciboAddSvc();
  } else {
    if(c.valorMensal > 0 || !extrasMes.length){
      const valorRaw = c.valorMensal ? String(Math.round(c.valorMensal * 100)) : '';
      reciboAddSvc(c.valorMensal ? 'Gerenciamento completo do perfil' : '', 'Serviço mensal', valorRaw);
    }
    extrasMes.forEach(ex=>{
      reciboAddSvc(ex.servico||'Criação de cards/artes para o perfil', ex.descricao||'Serviço avulso', String(Math.round((Number(ex.valor)||0)*100)));
    });
    reciboAddSvc();
  }

  reciboCalcTotal();
  document.getElementById('recibo-bg').classList.add('open');
}

function closeReciboModal() {
  document.getElementById('recibo-bg').classList.remove('open');
  reciboClienteId = null;
  // Revoga blob URL do preview para liberar memória
  const iframe = document.querySelector('#recibo-preview-doc iframe');
  if (iframe && iframe.dataset.blobUrl) URL.revokeObjectURL(iframe.dataset.blobUrl);
  const elPrev = document.getElementById('recibo-preview-doc');
  elPrev.classList.remove('visible');
  elPrev.innerHTML = '';
}

function reciboAddSvc(servico='', descricao='', valorRaw='') {
  reciboSvcCount++;
  const id = reciboSvcCount;
  const row = document.createElement('div');
  row.className = 'recibo-svc-row';
  row.id = `rb-svc-${id}`;

  const baseSvcList = [
    '',
    'Organização do perfil',
    'Criação de cards/artes para o perfil',
    'Gestão de tráfego pago e impulsionamento',
    'Gerenciamento completo do perfil',
    'Criação de identidade visual',
  ];
  if (servico && !baseSvcList.includes(servico)) baseSvcList.push(servico);
  const svcOpts = baseSvcList
    .map(o => `<option value="${esc(o)}" ${o===servico?'selected':''}>${esc(o||'— Selecione o serviço —')}</option>`).join('');

  // Formata valor inicial se veio como centavos (string de dígitos)
  let valorFormatado = '';
  if (valorRaw) {
    const digits = valorRaw.replace(/\D/g, '');
    if (digits) {
      valorFormatado = (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  row.innerHTML = `
    <select class="rb-svc-nome">${svcOpts}</select>
    <input type="text" list="rb-desc-opts" placeholder="Serviço mensal / avulso..." value="${esc(descricao)}" class="rb-svc-desc">
    <input type="text" inputmode="numeric" placeholder="0,00" value="${valorFormatado}" class="rb-svc-val" oninput="reciboMascaraValor(this)" onfocus="reciboFocusValor(this)" onblur="reciboBlurValor(this)">
    <button class="recibo-svc-del" onclick="reciboDelSvc(${id})" title="Remover linha"><i class="ti ti-trash"></i></button>
  `;
  document.getElementById('recibo-svc-list').appendChild(row);
}

function reciboDelSvc(id) {
  const el = document.getElementById(`rb-svc-${id}`);
  if (el) el.remove();
  reciboCalcTotal();
}

function reciboGetSvcs() {
  const rows = document.querySelectorAll('#recibo-svc-list .recibo-svc-row');
  return Array.from(rows).map(row => ({
    nome:  row.querySelector('.rb-svc-nome')?.value.trim() || '',
    desc:  row.querySelector('.rb-svc-desc')?.value.trim() || '',
    valor: row.querySelector('.rb-svc-val')?.value.trim() || ''
  }));
}

/* Máscara de valor — digita só números, exibe R$ formatado */
function reciboMascaraValor(input) {
  // Mantém só dígitos
  let raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; reciboCalcTotal(); return; }
  // Converte para centavos → reais
  const cents = parseInt(raw, 10);
  const reais = cents / 100;
  input.value = reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  reciboCalcTotal();
}

function reciboFocusValor(input) {
  // Remove formatação ao focar para facilitar digitação
  const raw = input.value.replace(/\D/g, '');
  input.value = raw || '';
  input.dataset.raw = raw;
}

function reciboBlurValor(input) {
  // Reformata ao sair do campo
  let raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; reciboCalcTotal(); return; }
  const reais = parseInt(raw, 10) / 100;
  input.value = reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  reciboCalcTotal();
}

function reciboParseValor(str) {
  if (!str) return 0;
  // Aceita "1.200,50" (pt-BR) ou dígitos crus
  const clean = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function reciboCalcTotal() {
  const svcs = reciboGetSvcs();
  const total = svcs.reduce((s, sv) => s + reciboParseValor(sv.valor), 0);
  document.getElementById('recibo-total-val').textContent =
    total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

/* Converte SVG path para PNG base64 via canvas — garante renderização no PDF */




/* ══════════════════════════════════════════════════════
   buildReciboDoc — monta o jsPDF doc e retorna ele.
   Usado tanto pelo preview (iframe) quanto pelo download,
   garantindo que preview e PDF final sejam idênticos.
══════════════════════════════════════════════════════ */
/* V107: recibo no padrão visual do sistema: fundo branco, cards pretos com detalhes amarelos */
function reciboLogoDataUrl() {
  return new Promise(resolve => {
    let src = 'icons/logo.png?v=105';
    try { src = localStorage.getItem('ds_brand_logo_url') || src; } catch (e) {}
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        c.getContext('2d').drawImage(img, 0, 0, 256, 256);
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function buildReciboDoc() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('Biblioteca jsPDF não carregou. Verifique sua conexão com a internet e recarregue a página.');
    }
    const cliente  = document.getElementById('rb-cliente').value || '';
    const contato  = document.getElementById('rb-contato').value || '';
    const data     = document.getElementById('rb-data').value || '';
    const todos    = reciboGetSvcs();
    const svcs     = todos.filter(sv => sv.nome || sv.desc || sv.valor);
    const total    = todos.reduce((s, sv) => s + reciboParseValor(sv.valor), 0);
    const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const logo     = await reciboLogoDataUrl();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const W = 210, H = 297, M = 14, CW = W - M * 2;
    const PAGINA = [255, 255, 255];
    const PRETO  = [17, 17, 17];
    const CARD   = [17, 18, 21];
    const BORDA  = [46, 50, 58];
    const LINHA  = [42, 46, 54];
    const BRANCO = [245, 245, 247];
    const CINZA  = [163, 168, 177];
    const CINZA_ROT = [130, 136, 146];
    const AMARELO= [240, 175, 50];
    const AMARELO_BG = [36, 29, 12];
    const fill  = c => doc.setFillColor(c[0], c[1], c[2]);
    const draw  = c => doc.setDrawColor(c[0], c[1], c[2]);
    const ink   = c => doc.setTextColor(c[0], c[1], c[2]);
    const space = v => { if (doc.setCharSpace) doc.setCharSpace(v); };
    const card  = (x, y, w, h, r, cor, borda) => {
      fill(cor); draw(borda); doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, r, r, 'FD');
    };
    const rotulo = (t, x, y, align, cor) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); ink(cor || CINZA_ROT); space(0.8);
      doc.text(t, x, y, align ? { align } : undefined); space(0);
    };

    // ── Fundo branco da página ──
    fill(PAGINA); doc.rect(0, 0, W, H, 'F');

    // ── Cabeçalho preto com logo dentro do quadrado amarelo ──
    card(M, M, CW, 36, 5, CARD, BORDA);
    const LOGO = 24;
    if (logo) {
      doc.addImage(logo, 'PNG', M + 6, M + 6, LOGO, LOGO);
    } else {
      fill(AMARELO); doc.roundedRect(M + 6, M + 6, LOGO, LOGO, 4, 4, 'F');
    }
    const tx = M + 6 + LOGO + 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); ink(BRANCO);
    doc.text('DAGNER DESIGN', tx, M + 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); ink(AMARELO); space(1.6);
    doc.text('SERVIÇOS DE WEB DESIGNER', tx, M + 22); space(0);
    const contatos = ['(83) 9.9961-5408', '@dagner.design', 'dagnerdesign@gmail.com'];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); ink(CINZA);
    contatos.forEach((t, i) => doc.text(t, W - M - 7, M + 13 + i * 6, { align: 'right' }));

    // ── Título e data em pílula amarela ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(28); ink(PRETO);
    doc.text('RECIBO', M, 66);
    const dataTxt = String(data || '-').toUpperCase();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const dataW = doc.getTextWidth(dataTxt) + 12;
    const dataX = W - M - dataW;
    fill(AMARELO); doc.roundedRect(dataX, 57, dataW, 9, 4.5, 4.5, 'F');
    ink(PRETO); doc.text(dataTxt, dataX + dataW / 2, 63.1, { align: 'center' });

    // ── Cliente e contato ──
    const infoTop = 74;
    card(M, infoTop, CW, 24, 5, CARD, BORDA);
    rotulo('CLIENTE', M + 7, infoTop + 8);
    rotulo('CONTATO', M + CW / 2 + 4, infoTop + 8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); ink(BRANCO);
    doc.text(String(cliente || '-').toUpperCase(), M + 7, infoTop + 16, { maxWidth: CW / 2 - 14 });
    doc.text(String(contato || '-').toUpperCase(), M + CW / 2 + 4, infoTop + 16, { maxWidth: CW / 2 - 14 });

    // ── Serviços em card preto com linhas separadoras ──
    const top = infoTop + 24 + 8;
    const linhas = svcs.length ? svcs : [{ nome: '', desc: '', valor: '' }];
    const rowH = 17;
    const cardH = 11 + linhas.length * rowH + 3;
    card(M, top, CW, cardH, 5, CARD, BORDA);

    const x0 = M + 7, innerW = CW - 14;
    const cX0 = x0, cX1 = x0 + innerW * 0.34, cX2 = x0 + innerW * 0.74, endX = x0 + innerW;
    rotulo('SERVIÇO', cX0, top + 8, null, AMARELO);
    rotulo('DESCRIÇÃO', cX1, top + 8, null, AMARELO);
    rotulo('VALOR', endX, top + 8, 'right', AMARELO);
    draw(LINHA); doc.setLineWidth(0.3);
    doc.line(M + 4, top + 11, W - M - 4, top + 11);

    linhas.forEach((sv, i) => {
      const rowTop = top + 11 + i * rowH;
      if (i > 0) doc.line(M + 4, rowTop, W - M - 4, rowTop);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(BRANCO);
      doc.text(String(sv.nome || '-').toUpperCase(), cX0, rowTop + 7, { maxWidth: cX1 - cX0 - 4 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); ink(CINZA);
      const desc = doc.splitTextToSize(String(sv.desc || '-'), cX2 - cX1 - 6);
      doc.text(desc, cX1, rowTop + 7);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); ink(BRANCO);
      doc.text(sv.valor ? 'R$ ' + sv.valor : '-', endX, rowTop + 7, { align: 'right' });
    });

    // ── Total em card preto com contorno amarelo ──
    const totTop = top + cardH + 8;
    card(M, totTop, CW, 22, 5, AMARELO_BG, AMARELO);
    rotulo('TOTAL', M + 7, totTop + 9, null, AMARELO);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); ink(AMARELO);
    doc.text(totalFmt, W - M - 7, totTop + 15, { align: 'right' });

    // ── Observação ──
    const obsY = totTop + 22 + 12;
    rotulo('OBSERVAÇÃO', M, obsY, null, [90, 95, 104]);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(PRETO);
    doc.text(doc.splitTextToSize('Este recibo serve como comprovante de pagamento realizado e recebido.', CW), M, obsY + 6);

    // ── Rodapé ──
    draw(LINHA); doc.setLineWidth(0.3);
    doc.line(M, H - 52, W - M, H - 52);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10.5); ink([90, 95, 104]);
    doc.text('Seja feita a tua vontade, assim na terra como no céu.', W / 2, H - 42, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); ink([130, 136, 146]); space(1);
    doc.text('MATEUS 6:10', W / 2, H - 36, { align: 'center' }); space(0);

    return doc;
}

async function reciboPreview() {
  try {
    toast('Gerando preview...', 'inf');
    const doc  = await buildReciboDoc();
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);

    const el = document.getElementById('recibo-preview-doc');
    // Revoga blob anterior se existir
    const old = el.querySelector('iframe');
    if (old && old.dataset.blobUrl) URL.revokeObjectURL(old.dataset.blobUrl);

    // Reseta estilos do container para o iframe não ter padding branco extra
    el.style.cssText = 'display:block;padding:0;background:transparent;box-shadow:none;border-radius:10px;overflow:hidden;margin:16px auto 0;max-width:100%';
    el.innerHTML = `<iframe src="${url}" data-blob-url="${url}"
      style="width:100%;height:520px;border:none;border-radius:10px;display:block"
      title="Preview do Recibo"></iframe>`;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast('Preview gerado ', 'ok');
  } catch(err) {
    console.error('Erro no preview:', err);
    toast('Erro ao gerar preview: ' + err.message, 'err');
  }
}

async function reciboGerarPDF() {
  toast('Gerando PDF...', 'inf');
  try {
    const doc     = await buildReciboDoc();
    const cliente = document.getElementById('rb-cliente').value;
    const data    = document.getElementById('rb-data').value;
    const nomeArq = `recibo_${cliente.replace(/\s+/g,'_')}_${data.replace(/\//g,'-')}.pdf`;
    doc.save(nomeArq);
    toast('PDF gerado com sucesso! ', 'ok');
  } catch(err) {
    console.error('Erro ao gerar PDF:', err);
    toast('Erro ao gerar PDF: ' + err.message, 'err');
  }
}

document.getElementById('recibo-bg').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeReciboModal();
});
document.getElementById('pgmto-bg')?.addEventListener('click',e=>{
  if(e.target===e.currentTarget) closePgmtoModal();
});

/* ═══════════════════════════════════════════
   CALENDÁRIO DE DATAS SAZONAIS
═══════════════════════════════════════════ */

/* ── BANCO DE DATAS FIXAS (dia/mês) ── */
const SZ_DATES_DEFAULT = [
  {"m":1,"d":1,"name":"Ano Novo","emoji":"🎉","cat":"nacional"},
  {"m":1,"d":6,"name":"Dia de Reis","emoji":"🎉","cat":"internacional"},
  {"m":1,"d":25,"name":"Aniversário de São Paulo","emoji":"🎉","cat":"nacional"},
  {"m":1,"d":30,"name":"Dia da Saudade","emoji":"🎉","cat":"comercial"},
  {"m":2,"d":2,"name":"Dia de Iemanjá","emoji":"📅","cat":"nacional"},
  {"m":2,"d":13,"name":"Dia Mundial do Rádio","emoji":"📅","cat":"internacional"},
  {"m":2,"d":14,"name":"Dia dos Namorados (internacional)","emoji":"📅","cat":"internacional"},
  {"m":2,"d":21,"name":"Dia Internacional da Língua Materna","emoji":"📅","cat":"internacional"},
  {"m":3,"d":8,"name":"Dia Internacional da Mulher","emoji":"🌿","cat":"internacional"},
  {"m":3,"d":15,"name":"Dia do Consumidor","emoji":"🌿","cat":"comercial"},
  {"m":3,"d":20,"name":"Dia Mundial da Felicidade","emoji":"🌿","cat":"internacional"},
  {"m":3,"d":21,"name":"Dia Internacional pela Eliminação da Discriminação Racial","emoji":"🌿","cat":"internacional"},
  {"m":3,"d":21,"name":"Dia Mundial da Poesia","emoji":"🌿","cat":"internacional"},
  {"m":3,"d":22,"name":"Dia Mundial da Água","emoji":"🌿","cat":"internacional"},
  {"m":3,"d":27,"name":"Dia Mundial do Teatro","emoji":"🌿","cat":"internacional"},
  {"m":4,"d":7,"name":"Dia Mundial da Saúde","emoji":"📚","cat":"internacional"},
  {"m":4,"d":18,"name":"Dia Nacional do Livro Infantil","emoji":"📚","cat":"nacional"},
  {"m":4,"d":19,"name":"Dia dos Povos Indígenas (Brasil)","emoji":"📚","cat":"nacional"},
  {"m":4,"d":21,"name":"Tiradentes","emoji":"📚","cat":"nacional"},
  {"m":4,"d":22,"name":"Descobrimento do Brasil","emoji":"📚","cat":"nacional"},
  {"m":4,"d":23,"name":"Dia Mundial do Livro","emoji":"📚","cat":"internacional"},
  {"m":4,"d":29,"name":"Dia Internacional da Dança","emoji":"📚","cat":"internacional"},
  {"m":5,"d":1,"name":"Dia do Trabalho","emoji":"🌷","cat":"nacional"},
  {"m":5,"d":3,"name":"Dia Mundial da Liberdade de Imprensa","emoji":"🌷","cat":"internacional"},
  {"m":5,"d":12,"name":"Dia do Enfermeiro","emoji":"🌷","cat":"comercial"},
  {"m":5,"d":13,"name":"Dia da Abolição da Escravidão","emoji":"🌷","cat":"nacional"},
  {"m":5,"d":15,"name":"Dia Internacional das Famílias","emoji":"🌷","cat":"internacional"},
  {"m":5,"d":18,"name":"Dia Nacional de Combate ao Abuso e Exploração de Crianças e Adolescentes","emoji":"🌷","cat":"nacional"},
  {"m":5,"d":25,"name":"Dia do Orgulho Nerd","emoji":"🌷","cat":"comercial"},
  {"m":5,"d":31,"name":"Dia Mundial Sem Tabaco","emoji":"🌷","cat":"internacional"},
  {"m":6,"d":5,"name":"Dia Mundial do Meio Ambiente","emoji":"🌎","cat":"internacional"},
  {"m":6,"d":8,"name":"Dia Mundial dos Oceanos","emoji":"🌎","cat":"internacional"},
  {"m":6,"d":12,"name":"Dia dos Namorados","emoji":"🌎","cat":"comercial"},
  {"m":6,"d":13,"name":"Dia de Santo Antônio","emoji":"🌎","cat":"nacional"},
  {"m":6,"d":19,"name":"Dia do Cinema Brasileiro","emoji":"🌎","cat":"nacional"},
  {"m":6,"d":21,"name":"Dia Mundial da Música","emoji":"🌎","cat":"internacional"},
  {"m":6,"d":24,"name":"São João (Festas Juninas)","emoji":"🌎","cat":"nacional"},
  {"m":7,"d":4,"name":"Independência dos Estados Unidos","emoji":"🎉","cat":"internacional"},
  {"m":7,"d":11,"name":"Dia Mundial da População","emoji":"🎉","cat":"internacional"},
  {"m":7,"d":13,"name":"Dia do Rock","emoji":"🎉","cat":"comercial"},
  {"m":7,"d":20,"name":"Dia do Amigo","emoji":"🎉","cat":"comercial"},
  {"m":7,"d":26,"name":"Dia dos Avós","emoji":"🎉","cat":"comercial"},
  {"m":7,"d":30,"name":"Dia Internacional da Amizade (ONU)","emoji":"🎉","cat":"internacional"},
  {"m":8,"d":9,"name":"Dia Internacional dos Povos Indígenas (ONU)","emoji":"📅","cat":"internacional"},
  {"m":8,"d":12,"name":"Dia Internacional da Juventude","emoji":"📅","cat":"internacional"},
  {"m":8,"d":19,"name":"Dia Mundial da Fotografia","emoji":"📅","cat":"internacional"},
  {"m":8,"d":25,"name":"Dia do Soldado","emoji":"📅","cat":"nacional"},
  {"m":9,"d":5,"name":"Dia da Amazônia","emoji":"🌎","cat":"nacional"},
  {"m":9,"d":7,"name":"Independência do Brasil","emoji":"🌎","cat":"nacional"},
  {"m":9,"d":8,"name":"Dia Internacional da Alfabetização","emoji":"🌎","cat":"internacional"},
  {"m":9,"d":15,"name":"Dia do Cliente","emoji":"🌎","cat":"comercial"},
  {"m":9,"d":21,"name":"Dia da Árvore / Início da Primavera","emoji":"🌎","cat":"nacional"},
  {"m":9,"d":22,"name":"Dia Mundial sem Carro","emoji":"🌎","cat":"internacional"},
  {"m":9,"d":27,"name":"Dia Mundial do Turismo","emoji":"🌎","cat":"internacional"},
  {"m":10,"d":1,"name":"Outubro Rosa (mês de conscientização)","emoji":"🎃","cat":"nacional"},
  {"m":10,"d":4,"name":"Dia Mundial dos Animais","emoji":"🎃","cat":"internacional"},
  {"m":10,"d":10,"name":"Dia Mundial da Saúde Mental","emoji":"🎃","cat":"internacional"},
  {"m":10,"d":12,"name":"Nossa Sra. Aparecida / Dia das Crianças","emoji":"🎃","cat":"nacional"},
  {"m":10,"d":15,"name":"Dia do Professor","emoji":"🎃","cat":"comercial"},
  {"m":10,"d":16,"name":"Dia Mundial da Alimentação","emoji":"🎃","cat":"internacional"},
  {"m":10,"d":24,"name":"Dia das Nações Unidas","emoji":"🎃","cat":"internacional"},
  {"m":10,"d":31,"name":"Halloween","emoji":"🎃","cat":"internacional"},
  {"m":11,"d":1,"name":"Novembro Azul (mês de conscientização)","emoji":"📅","cat":"nacional"},
  {"m":11,"d":2,"name":"Dia de Finados","emoji":"📅","cat":"nacional"},
  {"m":11,"d":11,"name":"Dia dos Solteiros (Singles Day)","emoji":"📅","cat":"comercial"},
  {"m":11,"d":15,"name":"Proclamação da República","emoji":"📅","cat":"nacional"},
  {"m":11,"d":19,"name":"Dia da Bandeira","emoji":"📅","cat":"nacional"},
  {"m":11,"d":20,"name":"Dia da Consciência Negra","emoji":"📅","cat":"nacional"},
  {"m":11,"d":25,"name":"Dia Internacional pela Eliminação da Violência contra a Mulher","emoji":"📅","cat":"internacional"},
  {"m":12,"d":1,"name":"Dia Mundial de Luta contra a Aids","emoji":"🎄","cat":"internacional"},
  {"m":12,"d":3,"name":"Dia Internacional da Pessoa com Deficiência","emoji":"🎄","cat":"internacional"},
  {"m":12,"d":10,"name":"Dia Internacional dos Direitos Humanos","emoji":"🎄","cat":"internacional"},
  {"m":12,"d":24,"name":"Véspera de Natal","emoji":"🎄","cat":"comercial"},
  {"m":12,"d":25,"name":"Natal","emoji":"🎄","cat":"nacional"},
  {"m":12,"d":31,"name":"Véspera de Ano Novo (Réveillon)","emoji":"🎄","cat":"comercial"},
];

const SZ_DATES_BASE = SZ_DATES_DEFAULT.filter(d => d.name && d.m && d.d);

/* ════════════════════════════════════════
   DATAS MÓVEIS — comerciais calculadas por ano
   (feriados móveis removidos)
════════════════════════════════════════ */
/* Retorna o N-ésimo weekday (0=Dom…6=Sáb) de um mês/ano */
function nthWeekdayOfMonth(year, month, weekday, n){
  const d=new Date(year, month-1, 1);
  let count=0;
  while(d.getMonth()===month-1){
    if(d.getDay()===weekday){ count++; if(count===n) return new Date(d); }
    d.setDate(d.getDate()+1);
  }
  return null;
}
/* Calcula as datas móveis comerciais para um determinado ano */
function szGetMobileDates(year){
  // Algoritmo gregoriano de computus para o domingo de Páscoa.
  function easterSunday(y){
    const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
    const l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*m+114)/31);
    const day=((h+l-7*m+114)%31)+1;
    return new Date(y,month-1,day,12);
  }
  const plus=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const asDate=(d,name,cat,emoji)=>({m:d.getMonth()+1,d:d.getDate(),name,cat,emoji,_mobile:true});
  const easter=easterSunday(year);
  const carnaval=plus(easter,-47);
  const sextaSanta=plus(easter,-2);
  const corpus=plus(easter,60);
  const mothers=nthWeekdayOfMonth(year,5,0,2);
  const fathers=nthWeekdayOfMonth(year,8,0,2);
  const thanks=nthWeekdayOfMonth(year,11,4,4);
  const black=plus(thanks,1);
  const cyber=plus(black,3);
  return [
    asDate(carnaval,'Carnaval','nacional','🎭'),
    asDate(sextaSanta,'Sexta-feira Santa','nacional','✝️'),
    asDate(easter,'Páscoa','internacional','🐰'),
    asDate(mothers,'Dia das Mães','nacional','🌷'),
    asDate(corpus,'Corpus Christi','nacional','📅'),
    asDate(fathers,'Dia dos Pais','nacional','👨‍👧'),
    asDate(thanks,'Ação de Graças (EUA)','internacional','🦃'),
    asDate(black,'Black Friday','comercial','🛍️'),
    asDate(cyber,'Cyber Monday','comercial','💻')
  ];
}

/* ── STATE ── */
const SZ_CUSTOM_STORAGE_KEY='sz_custom_dates_v80';
let szYear, szMonth;
let szCustomDates = []; // datas adicionadas ao calendário

function szLoadCustom(){
  try{ szCustomDates = JSON.parse(localStorage.getItem(SZ_CUSTOM_STORAGE_KEY)||'[]'); }
  catch(e){ szCustomDates=[]; }
}
function szSaveCustom(){ localStorage.setItem(SZ_CUSTOM_STORAGE_KEY, JSON.stringify(szCustomDates)); }

let _szCache={key:null,val:null};
function szAllDates(year){
  const y = year || szYear || new Date().getFullYear();
  const key = y+'|'+szCustomDates.length+'|'+szCustomDates.map(d=>d._id||d.name||'').join(',');
  if(_szCache.key===key) return _szCache.val;
  const val=[...szCustomDates.filter(e=>!e._calendarYear || e._calendarYear===y)]
    .sort((a,b)=> a.m!==b.m ? a.m-b.m : a.d-b.d);
  _szCache={key,val}; return val;
}
function szCatalogDates(year){
  const y = year || szYear || new Date().getFullYear();
  return [...SZ_DATES_BASE, ...szGetMobileDates(y)]
    .sort((a,b)=> a.m!==b.m ? a.m-b.m : a.d-b.d);
}
function szEventKey(evt){ return `${evt.m}-${evt.d}-${evt.name}`; }
function szIsInCalendar(evt){ return szCustomDates.some(d=>szEventKey(d)===szEventKey(evt) && (!evt._mobile || d._calendarYear===calYear)); }
function szAddLibraryDateByIndex(index){
  const items=szCatalogDates(calYear).filter(e=>e.m===calMonth+1);
  const evt=items[index];
  if(!evt) return;
  szAddLibraryDate(evt.m,evt.d,evt.name);
}
function szAddLibraryDate(m,d,name){
  const yr = calYear || new Date().getFullYear();
  const evt = szCatalogDates(yr).find(e=>e.m===m && e.d===d && e.name===name);
  if(!evt || szIsInCalendar(evt)) return;
  szCustomDates.push({...evt,_calendarYear:evt._mobile?yr:null,_id:'lib_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)});
  szSaveCustom(); _szCache={key:null,val:null};
  renderCalMensal(); renderSazonaisNoCalendario(); if(typeof szRenderTodayHoje==='function') szRenderTodayHoje();
}
function szAddMonthToCalendar(){
  const monthDates = szCatalogDates(calYear).filter(e=>e.m===calMonth+1);
  if(!monthDates.length) return;
  let changed=false;
  monthDates.forEach(evt=>{
    if(!szIsInCalendar(evt)){
      szCustomDates.push({...evt,_calendarYear:evt._mobile?calYear:null,_id:'lib_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)});
      changed=true;
    }
  });
  if(changed){
    szSaveCustom(); _szCache={key:null,val:null};
    renderCalMensal(); if(typeof szRenderTodayHoje==='function') szRenderTodayHoje();
  }
  renderSazonaisNoCalendario();
}
function toggleSzLibrary(force){
  const body=document.getElementById('sz-library-body');
  const toggle=document.getElementById('sz-library-toggle');
  const card=document.getElementById('sz-month-events');
  if(!body||!toggle||!card) return;
  const open = typeof force==='boolean' ? force : !body.classList.contains('open');
  body.classList.toggle('open', open);
  card.classList.toggle('is-collapsed', !open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/* ── HELPERS ── */
const MESES_SZ = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SZ  = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const DIAS_SZ_A= ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];

function szCatStyle(cat){
  const map = {
    nacional:   {bg:'rgba(52,211,153,.15)', color:'#34D399', label:'Nacional'},
    internacional:{bg:'rgba(96,165,250,.15)', color:'#93C5FD', label:'Internacional'},
    comercial:  {bg:'rgba(249,115,22,.18)',  color:'#FDBA74', label:'Comercial'},
    varejo:     {bg:'rgba(245,158,11,.18)',  color:'#FCD34D', label:'Varejo'},
    saude:      {bg:'rgba(16,185,129,.18)',  color:'#34D399', label:'Saúde'},
    cultural:   {bg:'rgba(232,235,240,0.18)',  color:'#E8EBF0', label:'Cultural'},
    alimentacao:{bg:'rgba(236,72,153,.18)',  color:'#F9A8D4', label:'Alimentação'},
    custom:     {bg:'rgba(96,165,250,.18)',  color:'#93C5FD', label:'Personalizada'},
  };
  return map[cat] || map.custom;
}



function szDaysInMonth(y,m){ return new Date(y,m,0).getDate(); }
function szFirstWeekday(y,m){
  // Returns 0=Mon...6=Sun
  const dow = new Date(y,m-1,1).getDay(); // 0=Sun
  return dow===0 ? 6 : dow-1;
}

/* ── RENDER ── */


function szRenderCalendar(){
  if(!document.getElementById('sz-cal-grid') || !document.getElementById('sz-cal-month-lbl')) return;
  const n=new Date();
  const todayD=n.getDate(), todayM=n.getMonth()+1, todayY=n.getFullYear();

  document.getElementById('sz-cal-month-lbl').innerHTML=`${MESES_SZ[szMonth-1].toUpperCase()} <span>${szYear}</span>`;

  const all=szAllDates(szYear);
  const monthDates=all.filter(d=>d.m===szMonth);
  document.getElementById('sz-cal-count-lbl').textContent=`${monthDates.length} data${monthDates.length!==1?'s':''} neste mês`;

  /* Render grid */
  const daysInM=szDaysInMonth(szYear,szMonth);
  const firstWd=szFirstWeekday(szYear,szMonth);
  const prevDays=szDaysInMonth(szYear,szMonth===1?12:szMonth-1);
  const grid=document.getElementById('sz-cal-grid');
  grid.innerHTML='';

  let cells=[];
  // Prev month cells
  for(let i=firstWd-1;i>=0;i--){
    cells.push({day:prevDays-i, curMonth:false});
  }
  // Current month
  for(let d=1;d<=daysInM;d++){
    cells.push({day:d, curMonth:true});
  }
  // Fill remaining to complete rows
  while(cells.length%7!==0) cells.push({day:cells.length-firstWd-daysInM+1, curMonth:false});

  cells.forEach(({day,curMonth},idx)=>{
    const col=(idx%7)+1; // 1-7
    const isWknd=col>=6;
    const isToday=curMonth&&day===todayD&&szMonth===todayM&&szYear===todayY;
    const evts=curMonth ? all.filter(e=>e.m===szMonth&&e.d===day) : [];

    const cell=document.createElement('div');
    cell.className='sz-cell'+(isWknd?' weekend':'')+(isToday?' today-cell':'')+(curMonth?'':' other-month');
    if(curMonth&&evts.length) cell.style.cursor='pointer';

    let inner=`<div class="sz-cell-num">${day}</div><div class="sz-cell-events">`;
    const maxShow=3;
    evts.slice(0,maxShow).forEach(e=>{
      const s=szCatStyle(e.cat);
      inner+=`<div class="sz-event-chip" style="background:${s.bg};color:${s.color}" title="${esc(e.name)}">${e.emoji} ${esc(e.name)}</div>`;
    });
    if(evts.length>maxShow) inner+=`<div class="sz-cell-more">+${evts.length-maxShow} mais</div>`;
    inner+='</div>';
    cell.innerHTML=inner;

    if(curMonth) cell.addEventListener('click',()=>szScrollToDate(day));
    grid.appendChild(cell);
  });

  /* Render month event list */
  const listEl=document.getElementById('sz-month-events-list');
  if(monthDates.length===0){
    listEl.innerHTML='<div class="sz-month-empty">Nenhuma data comemorativa neste mês</div>';
  } else {
    listEl.innerHTML=monthDates.map((e,i)=>{
      const dow=new Date(szYear,szMonth-1,e.d).getDay();
      const dowName=DIAS_SZ[dow===0?6:dow-1];
      const s=szCatStyle(e.cat);
      return `<div class="sz-month-event-row" id="sz-ev-${szMonth}-${e.d}-${i}">
        <div style="text-align:center;min-width:42px">
          <div class="sz-month-event-date">${e.d}</div>
          <div class="sz-month-event-weekday">${dowName.substring(0,3).toUpperCase()}</div>
        </div>
        <div class="sz-month-event-divider"></div>
        <div class="sz-month-event-emoji">${e.emoji}</div>
        <div class="sz-month-event-info">
          <div class="sz-month-event-name">${esc(e.name)}</div>
          ${e.desc?`<div class="sz-month-event-desc">${esc(e.desc)}</div>`:''}
        </div>
        <span class="sz-cat-badge" style="background:${s.bg};color:${s.color};border:1px solid ${s.color}44">${szCatStyle(e.cat).label}</span>
        ${e._custom?`<button class="btn btn-icon btn-del" onclick="szDeleteCustom('${e._id}')" title="Remover" style="flex-shrink:0"><i class="ti ti-trash"></i></button>`:''}
      </div>`;
    }).join('');
  }
}

function szScrollToDate(day){
  const all=szAllDates(szYear).filter(e=>e.m===szMonth&&e.d===day);
  if(!all.length) return;
  // Find first matching event row
  const idx=szAllDates(szYear).filter(e=>e.m===szMonth).findIndex(e=>e.d===day);
  const el=document.querySelector(`#sz-month-events-list .sz-month-event-row`);
  if(el) {
    // Find right row
    const rows=document.querySelectorAll('#sz-month-events-list .sz-month-event-row');
    const matchRow=[...rows].find(r=>{
      const dateEl=r.querySelector('.sz-month-event-date');
      return dateEl&&parseInt(dateEl.textContent)===day;
    });
    if(matchRow) matchRow.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function szRenderToday(){
  const dateEl=document.getElementById('sz-today-date-lbl');
  const el=document.getElementById('sz-today-events');
  if(!dateEl || !el) return;
  const n=new Date();
  const d=n.getDate(), m=n.getMonth()+1, y=n.getFullYear();
  const dow=DIAS_SZ[n.getDay()===0?6:n.getDay()-1];
  dateEl.textContent=`${dow}, ${d} de ${MESES_SZ[m-1]} de ${y}`;
  const todayEvts=szAllDates(y).filter(e=>e.m===m&&e.d===d);
  if(todayEvts.length===0){
    el.innerHTML='<div class="sz-today-empty">Nenhuma data comemorativa hoje </div>';
  } else {
    el.innerHTML='<div class="sz-today-list">'+todayEvts.map(e=>{
      const s=szCatStyle(e.cat);
      return `<div class="sz-today-item">
        <div class="sz-today-item-emoji">${e.emoji}</div>
        <div class="sz-today-item-info">
          <div class="sz-today-item-name">${esc(e.name)}</div>
          ${e.desc?`<div class="sz-today-item-cat">${esc(e.desc)}</div>`:''}
        </div>
        <span class="sz-cat-badge" style="background:${s.bg};color:${s.color}">${s.label}</span>
      </div>`;
    }).join('')+'</div>';
  }
}

function szRenderUpcoming(){
  const n=new Date();
  const todayTs=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime();
  const y=n.getFullYear();

  // Build date list for current year + next year wrap
  const allCurr=szAllDates(y);
  const allNext=szAllDates(y+1);
  let upcoming=[];
  allCurr.forEach(e=>{
    const ts=new Date(y,e.m-1,e.d).getTime();
    const diff=Math.round((ts-todayTs)/(1000*60*60*24));
    if(diff>0&&diff<=90) upcoming.push({...e,diff,ts});
  });
  // Also add next year's mobile dates if < 30 days (wrap-around)
  allNext.forEach(e=>{
    const ts=new Date(y+1,e.m-1,e.d).getTime();
    const diff=Math.round((ts-todayTs)/(1000*60*60*24));
    if(diff>0&&diff<=30) upcoming.push({...e,diff,ts});
  });

  upcoming.sort((a,b)=>a.ts-b.ts);

  const el=document.getElementById('sz-upcoming-list');
  if(upcoming.length===0){
    el.innerHTML='<div style="text-align:center;padding:30px;color:var(--t3);font-size:13px">Nenhuma data próxima nos próximos 90 dias</div>';
    return;
  }
  el.innerHTML=upcoming.slice(0,15).map(e=>{
    const s=szCatStyle(e.cat);
    const diffTxt=e.diff===1?'amanhã':`em ${e.diff} dias`;
    return `<div class="sz-upcoming-item">
      <div class="sz-upcoming-date-block">
        <div class="sz-upcoming-day">${e.d}</div>
        <span class="sz-upcoming-month-lbl">${MESES_SZ[e.m-1].substring(0,3)}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div class="sz-upcoming-name">${e.emoji} ${esc(e.name)}</div>
        <div class="sz-upcoming-cat" style="color:${s.color}">${s.label}</div>
      </div>
      <div class="sz-upcoming-countdown">${diffTxt}</div>
    </div>`;
  }).join('');
}




/* ── MODAL ADD ── */
let _szSelCat='comercial';
function openSzModal(){
  _szSelCat='comercial';
  document.querySelectorAll('.sz-cat-opt').forEach(b=>b.classList.toggle('sel',b.dataset.cat==='comercial'));
  ['sz-f-day','sz-f-name','sz-f-emoji','sz-f-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('sz-f-month').value=szMonth||new Date().getMonth()+1;
  document.getElementById('sz-modal-bg').classList.add('open');
}
function closeSzModal(){ document.getElementById('sz-modal-bg').classList.remove('open'); }
function szSelCat(btn){
  document.querySelectorAll('.sz-cat-opt').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  _szSelCat=btn.dataset.cat;
}
function saveSzDate(){
  const day=parseInt(document.getElementById('sz-f-day').value);
  const month=parseInt(document.getElementById('sz-f-month').value);
  const name=document.getElementById('sz-f-name').value.trim();
  const emoji=document.getElementById('sz-f-emoji').value.trim()||'📅';
  const desc=document.getElementById('sz-f-desc').value.trim();

  if(!day||day<1||day>31){toast('Informe um dia válido.','err');return;}
  if(!name){toast('Informe o nome da data.','err');return;}

  const entry={m:month,d:day,name,emoji,cat:_szSelCat,desc,_custom:true,_id:Date.now().toString()};
  szCustomDates.push(entry);
  szSaveCustom();
  _szCache={key:null,val:null};
  closeSzModal();
  renderCalMensal();
  renderSazonaisNoCalendario();
  szRenderTodayHoje();
  toast(`"${name}" adicionada!`,'ok');
}
function szDeleteCustom(id){
  szCustomDates=szCustomDates.filter(e=>e._id!==id);
  szSaveCustom();
  _szCache={key:null,val:null};
  renderCalMensal();
  renderSazonaisNoCalendario();
  szRenderTodayHoje();
  toast('Data removida.','inf');
}

document.getElementById('sz-modal-bg').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeSzModal();
});

/* ── Render datas de hoje no painel Hoje ── */
function szRenderTodayHoje(){
  szLoadCustom();
  const n=new Date();
  const d=n.getDate(), m=n.getMonth()+1, y=n.getFullYear();
  const dow=MESES_SZ ? MESES_SZ[m-1] : MESES[m-1];
  const dateLbl=document.getElementById('hoje-sz-date-lbl');
  const evtsEl=document.getElementById('hoje-sz-events');
  if(!dateLbl||!evtsEl) return;

  dateLbl.textContent=`${d} de ${dow} de ${y}`;

  const todayEvts=szAllDates(y).filter(e=>e.m===m&&e.d===d);
  if(todayEvts.length===0){
    evtsEl.innerHTML='<div class="hoje-sz-empty">Nenhuma data comemorativa hoje </div>';
  } else {
    evtsEl.innerHTML='<div class="hoje-sz-list">'+todayEvts.map(e=>{
      const s=szCatStyle(e.cat);
      return `<div class="hoje-sz-item">
        <div class="hoje-sz-emoji">${e.emoji}</div>
        <div class="hoje-sz-info">
          <div class="hoje-sz-name">${esc(e.name)}</div>
          <div class="hoje-sz-cat" style="color:${s.color}">${s.label}</div>
        </div>
      </div>`;
    }).join('')+'</div>';
  }
}



/* ════════════════════════════════════
   COBRANÇA — controle de mensalidades (Supabase)
════════════════════════════════════ */
let cbYear, cbMonth;
// Helpers de pagamentos
function getPagamento(clienteId, mesKey){
  return pagamentos.find(p=>p.clienteId===clienteId&&p.mesReferencia===mesKey)||null;
}

function cbMesStr(y,m){ return `${y}-${String(m).padStart(2,'0')}`; }
function cbMesLabel(mesKey){
  const [y,m]=mesKey.split('-');
  return `${MESES[parseInt(m)-1]} de ${y}`;
}
function fmtForma(f){
  const map={pix:'PIX',dinheiro:'Dinheiro',debito:'Cartão débito',credito:'Cartão crédito',transferencia:'Transferência',outro:'Outro'};
  return map[f]||f;
}

function cbChangeMonth(dir){
  cbMonth+=dir;
  if(cbMonth>12){cbMonth=1;cbYear++;}
  if(cbMonth<1){cbMonth=12;cbYear--;}
  renderCobranca();
}
function cbGoToday(){
  const t=now(); cbYear=t.getFullYear(); cbMonth=t.getMonth()+1;
  renderCobranca();
}

/* ── Modal de pagamento ── */
let _pgmtoClienteId=null, _pgmtoMesKey=null;
function closePgmtoModal(){ document.getElementById('pgmto-bg').classList.remove('open'); }

function openPagoModal(clienteId, mesKey){
  const c=clientes.find(x=>x.id===clienteId); if(!c) return;
  _pgmtoClienteId=clienteId; _pgmtoMesKey=mesKey;
  const hoje=now();
  const dd=String(hoje.getDate()).padStart(2,'0');
  const mm=String(hoje.getMonth()+1).padStart(2,'0');
  const yyyy=hoje.getFullYear();
  const extraVal=(typeof window.dsTotalExtrasDoMes==='function')?window.dsTotalExtrasDoMes(clienteId,mesKey):0;
  const totalPrevisto=(Number(c.valorMensal)||0)+extraVal;
  const valorFmt=totalPrevisto?totalPrevisto.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  const extraNote=extraVal>0?`<div class="pgmto-extra-note">Mensalidade ${fmtBRL(c.valorMensal||0)} + Avulsos ${fmtBRL(extraVal)}</div>`:'';
  document.getElementById('pgmto-content').innerHTML=`
    <div class="pgmto-body">
      <div class="pgmto-info">
        <div>
          <div class="pgmto-empresa">${esc(c.empresa)}</div>
          <div class="pgmto-mes">Referência: ${cbMesLabel(mesKey)}</div>
          ${extraNote}
        </div>
        <div class="pgmto-valor-badge">${totalPrevisto?fmtBRL(totalPrevisto):'—'}</div>
      </div>
      <div class="pgmto-row">
        <div class="pgmto-fgrp">
          <label>Valor recebido (R$)</label>
          <input type="text" id="pgmto-valor" inputmode="numeric" placeholder="0,00" value="${valorFmt}">
        </div>
        <div class="pgmto-fgrp">
          <label>Data do pagamento</label>
          <input type="date" id="pgmto-data" value="${yyyy}-${mm}-${dd}">
        </div>
      </div>
      <div class="pgmto-fgrp">
        <label>Forma de pagamento</label>
        <select id="pgmto-forma">
          <option value="pix">PIX</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="debito">Cartão débito</option>
          <option value="credito">Cartão crédito</option>
          <option value="transferencia">Transferência</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <div class="pgmto-fgrp">
        <label>Observação (opcional)</label>
        <textarea id="pgmto-obs" rows="2" placeholder="Ex: Pagou junto com o mês anterior..."></textarea>
      </div>
    </div>
    <div class="pgmto-foot">
      <button class="btn" onclick="closePgmtoModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="savePagamento()"><i class="ti ti-check"></i> Confirmar pagamento</button>
    </div>`;
  document.getElementById('pgmto-bg').classList.add('open');
  setTimeout(()=>document.getElementById('pgmto-valor')?.focus(),80);
}

async function savePagamento(){
  const valorTxt=document.getElementById('pgmto-valor').value.trim();
  const valorRaw=valorTxt.replace(/\./g,'').replace(',','.');
  const valor=parseFloat(valorRaw);
  const data=document.getElementById('pgmto-data').value;
  const forma=document.getElementById('pgmto-forma').value;
  const obs=document.getElementById('pgmto-obs').value.trim();
  /* V107: 0,00 é aceito (pagamento sem valor); só bloqueia campo vazio, texto inválido ou negativo */
  if(!valorTxt || isNaN(valor) || valor<0){ toast('Informe o valor recebido (use 0,00 se não houve valor).','err'); return; }
  if(!data){ toast('Informe a data do pagamento.','err'); return; }
  const btn=document.querySelector('#pgmto-content .btn-primary');
  setSyncStatus('saving');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i> Salvando...';}
  try{
    const {data:{user}}=await authUser();
    const {data:row,error}=await sb.from('pagamentos').insert({
      user_id:user.id, cliente_id:_pgmtoClienteId,
      mes_referencia:_pgmtoMesKey, valor_pago:valor,
      data_pagamento:new Date(data+'T12:00:00').toISOString(),
      forma_pagamento:forma, observacao:obs
    }).select().single();
    if(error) throw error;
    pagamentos.unshift({
      id:row.id, clienteId:row.cliente_id, mesReferencia:row.mes_referencia,
      valorPago:row.valor_pago, dataPagamento:row.data_pagamento,
      formaPagamento:row.forma_pagamento, observacao:row.observacao||''
    });
    // Mostrar estado de sucesso com opção de gerar recibo
    const c=clientes.find(x=>x.id===_pgmtoClienteId);
    const pgData=new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
    document.getElementById('pgmto-content').innerHTML=`
      <div class="pgmto-success">
        <i class="ti ti-circle-check pgmto-success-icon"></i>
        <div class="pgmto-success-ttl">Pagamento registrado!</div>
        <div class="pgmto-success-sub">
          <strong>${esc(c?.empresa||'')}</strong><br>
          ${cbMesLabel(_pgmtoMesKey)} · ${fmtBRL(valor)} · ${fmtForma(forma)}<br>
          ${pgData}
        </div>
        <div class="pgmto-success-btns">
          <button class="btn btn-primary" onclick="closePgmtoModal();openReciboModal('${row.cliente_id}','${row.id}')">
            <i class="ti ti-receipt"></i> Gerar recibo agora
          </button>
          <button class="btn" onclick="closePgmtoModal()">Fechar</button>
        </div>
      </div>`;
    renderCobranca(); setSyncStatus('ok');
  }catch(e){
    setSyncStatus('error');
    toast('Erro ao salvar: '+e.message,'err');
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-check"></i> Confirmar pagamento';}
  }
}

function confirmarDesfazer(clienteId, mesKey){
  const c=clientes.find(x=>x.id===clienteId);
  const pg=getPagamento(clienteId,mesKey);
  if(!pg) return;
  const empresa=c?c.empresa:'cliente';
  openPcConfirm(
    'Remover pagamento?',
    `Deseja remover o pagamento de ${cbMesLabel(mesKey)} de ${empresa}?`,
    ()=>desfazerPagamento(pg.id,clienteId,mesKey)
  );
}

async function desfazerPagamento(pgId, clienteId, mesKey){
  try{
    setSyncStatus('saving');
    const {error}=await sb.from('pagamentos').delete().eq('id',pgId);
    if(error) throw error;
    pagamentos=pagamentos.filter(p=>p.id!==pgId);
    toast('Pagamento removido.','inf');
    renderCobranca(); setSyncStatus('ok');
  }catch(e){ setSyncStatus('error'); toast('Erro: '+e.message,'err'); }
}

window.cbExpandedSections=window.cbExpandedSections||{};
window.cbCompactSearch=window.cbCompactSearch||'';
window.cbCompactSort=window.cbCompactSort||'vencimento';
function setCbCompactSearch(v){
  const cursor=document.activeElement && document.activeElement.selectionStart;
  window.cbCompactSearch=v||'';
  renderCobranca();
  const input=document.querySelector('#sec-cobranca .cb-compact-search input');
  if(input){input.focus(); if(Number.isInteger(cursor)) input.setSelectionRange(cursor,cursor);}
}
function setCbCompactSort(v){ window.cbCompactSort=v||'vencimento'; renderCobranca(); }
function toggleCbSection(key){
  window.cbExpandedSections[key]=!window.cbExpandedSections[key];
  renderCobranca();
}

function renderCobranca(){
  const t=now();
  if(!cbYear){cbYear=t.getFullYear();cbMonth=t.getMonth()+1;}
  const mesKey=cbMesStr(cbYear,cbMonth);
  const isCurrentMonth=cbYear===t.getFullYear()&&cbMonth===t.getMonth()+1;
  const isPastMonth=cbYear<t.getFullYear()||(cbYear===t.getFullYear()&&cbMonth<t.getMonth()+1);
  const todayDay=t.getDate();

  document.getElementById('cb-nav-lbl').innerHTML=`${MESES[cbMonth-1]} <span style="color:var(--vl)">${cbYear}</span>`;

  const extrasFn=(cid)=>(typeof window.dsTotalExtrasDoMes==='function')?window.dsTotalExtrasDoMes(cid,mesKey):0;
  const cobrarTotal=(c)=>(Number(c.valorMensal)||0)+extrasFn(c.id);
  const ativos=clientes.filter(c=>c.status==='ativo'&&(c.diaCobranca>0||extrasFn(c.id)>0));
  const pgsMes=pagamentos.filter(p=>p.mesReferencia===mesKey);

  if(!ativos.length&&!pgsMes.length){
    document.getElementById('cb-summary').innerHTML='';
    document.getElementById('cb-list').innerHTML=esHtml('calendar-off','Nenhuma cobrança por aqui','Preencha o valor mensal e o dia de cobrança nos clientes.','Ver clientes',"switchTab('clientes')");
    document.getElementById('badge-cb').style.display='none';
    return;
  }

  const groups={atrasado:[],hoje:[],avencer:[],pago:[],encerradoPago:[]};
  let totalMes=0;

  ativos.forEach(c=>{
    const pg=getPagamento(c.id,mesKey);
    const hasEx=extrasFn(c.id)>0;
    const criadoMes=(c.criadoEm&&/^\d{4}-\d{2}/.test(c.criadoEm))?c.criadoEm.slice(0,7):'';
    if(!pg&&!hasEx&&isPastMonth&&criadoMes&&criadoMes>=APP_START_DATE.slice(0,7)&&mesKey<criadoMes) return;
    totalMes+=cobrarTotal(c);
    if(pg){
      groups.pago.push({c,pg});
    } else if(c.diaCobranca<=0){
      groups.avencer.push(c);
    } else if(isPastMonth){
      groups.atrasado.push(c);
    } else if(isCurrentMonth){
      if(c.diaCobranca<todayDay) groups.atrasado.push(c);
      else if(c.diaCobranca===todayDay) groups.hoje.push(c);
      else groups.avencer.push(c);
    } else {
      groups.avencer.push(c);
    }
  });

  clientes.filter(c=>c.status!=='ativo'&&(c.diaCobranca>0||extrasFn(c.id)>0)).forEach(c=>{
    const pg=getPagamento(c.id,mesKey);
    if(pg){ groups.pago.push({c,pg}); totalMes+=cobrarTotal(c); }
  });

  const totalRecebido=pgsMes.reduce((s,p)=>s+p.valorPago,0);
  const totalFalta=Math.max(totalMes-totalRecebido,0);
  const despMes=(window.v62MonthExpense?window.v62MonthExpense(mesKey):0);
  const resultadoMes=totalRecebido-despMes;
  const pendentesAbertos=groups.atrasado.length+groups.hoje.length+groups.avencer.length;
  const pendentesUrgentes=groups.atrasado.length+groups.hoje.length;

  const badge=document.getElementById('badge-cb');
  if(badge){badge.textContent=pendentesUrgentes;badge.style.display=pendentesUrgentes>0?'inline-flex':'none';}

  document.getElementById('cb-summary').innerHTML=`
    <div class="cb-card is-balance">
      <div class="cb-card-icon"><i class="ti ti-hourglass-high"></i></div>
      <div class="cb-card-lbl">Falta receber</div>
      <div class="cb-card-val">${fmtBRL(totalFalta)}</div>
      <div class="cb-card-sub">${pendentesAbertos} cliente${pendentesAbertos!==1?'s':''} pendente${pendentesAbertos!==1?'s':''}</div>
    </div>
    <div class="cb-card is-income">
      <div class="cb-card-icon"><i class="ti ti-trending-up"></i></div>
      <div class="cb-card-lbl">Receitas do mês</div>
      <div class="cb-card-val">${fmtBRL(totalRecebido)}</div>
      <div class="cb-card-sub">${pgsMes.length?`${pgsMes.length} pagamento${pgsMes.length!==1?'s':''} recebido${pgsMes.length!==1?'s':''}`:'Nenhum pagamento registrado'}</div>
    </div>
    <div class="cb-card is-expense">
      <div class="cb-card-icon"><i class="ti ti-trending-down"></i></div>
      <div class="cb-card-lbl">Despesas do mês</div>
      <div class="cb-card-val">${fmtBRL(despMes)}</div>
      <div class="cb-card-sub">Gastos registrados no período</div>
    </div>
    <div class="cb-card is-result">
      <div class="cb-card-icon"><i class="ti ti-target-arrow"></i></div>
      <div class="cb-card-lbl">Resultado do mês</div>
      <div class="cb-card-val">${fmtBRL(resultadoMes)}</div>
      <div class="cb-card-sub">${resultadoMes===0?'No zero a zero':(resultadoMes>0?'Receitas menos despesas':'Despesas acima das receitas')}</div>
    </div>`;

  const rowMini=(c,status)=>{
    status=(status==='atrasado'||status==='hoje')?status:'avencer';
    const dayTxt=status==='hoje'?'Hoje':(c.diaCobranca>0?'Dia '+c.diaCobranca:'Avulso');
    const dayStyle=status==='atrasado'?' style="color:#F87171 !important"':status==='hoje'?' style="color:#34D399 !important"':'';
    const exVal=extrasFn(c.id);
    const exItems=(typeof window.dsExtrasDoMes==='function')?window.dsExtrasDoMes(c.id,mesKey):[];
    const exTip=exItems.length?`${exItems.length} avulso(s): +${fmtBRL(exVal)}`:'Adicionar serviço avulso / extra';
    const exPill=exItems.length?`<span class="cb-extra-pill" title="${esc(exTip)}">+${exItems.length}</span>`:'';
    return `<div class="cb-mini" title="${esc(c.empresa)}">
      <div class="cb-mini-name" title="${esc(c.empresa)}">${esc(c.empresa)}${exPill}</div>
      <div class="cb-mini-day"${dayStyle}>${dayTxt}</div>
      <div class="cb-mini-actions">
        <button type="button" class="btn btn-icon cb-mini-extra${exItems.length?' has-extras':''}" onclick="v109OpenExtrasModal('${c.id}','${mesKey}')" title="${esc(exTip)}" aria-label="Serviços avulsos de ${esc(c.empresa)}"><i class="ti ti-plus"></i></button>
        <button type="button" class="btn btn-icon cb-mini-whatsapp" onclick="v67Cobrar('${c.id}','${status}')" title="Cobrar no WhatsApp" aria-label="Cobrar ${esc(c.empresa)} no WhatsApp"><i class="ti ti-brand-whatsapp"></i></button>
        <button type="button" class="btn btn-icon cb-mini-recibo" onclick="openReciboModal('${c.id}')" title="Emitir recibo" aria-label="Emitir recibo de ${esc(c.empresa)}"><i class="ti ti-receipt"></i></button>
        <button type="button" class="btn btn-pago cb-mini-pago" onclick="openPagoModal('${c.id}','${mesKey}')">Pago <i class="ti ti-check" aria-hidden="true"></i></button>
      </div>
      <span class="cb-mini-val">${fmtBRL(cobrarTotal(c))}</span>
    </div>`;
  };

  const rowPago=({c,pg})=>{
    // A data vem do banco em AAAA-MM-DD; evita trocar o dia por causa do fuso horário.
    const rawDate=String(pg.dataPagamento||'');
    const matchDate=rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const pgDate=matchDate?`${matchDate[3]}/${matchDate[2]}/${matchDate[1]}`:(rawDate?new Date(rawDate).toLocaleDateString('pt-BR'):'');
    const pgForma=fmtForma(pg.formaPagamento)||'Pagamento';
    const paymentInfo=[pgForma,pgDate?`em ${pgDate}`:''].filter(Boolean).join(' · ');
    const exItems=(typeof window.dsExtrasDoMes==='function')?window.dsExtrasDoMes(c.id,mesKey):[];
    const exVal=extrasFn(c.id);
    const exTip=exItems.length?`${exItems.length} avulso(s): +${fmtBRL(exVal)}`:'Serviços avulsos do mês';
    return `<div class="cb-row pago cb-paid-mini" title="${esc(c.empresa)}">
      <div class="cb-paid-name" title="${esc(c.empresa)}">${esc(c.empresa)}</div>
      <span class="cb-paid-badge"><i class="ti ti-circle-check" aria-hidden="true"></i> Pago</span>
      <span class="cb-paid-details" title="${esc(paymentInfo)}">${esc(paymentInfo)}</span>
      <div class="cb-paid-actions">
        <button type="button" class="btn btn-icon cb-mini-extra${exItems.length?' has-extras':''}" onclick="v109OpenExtrasModal('${c.id}','${mesKey}')" title="${esc(exTip)}" aria-label="Serviços avulsos de ${esc(c.empresa)}"><i class="ti ti-plus"></i></button>
        <button type="button" class="btn btn-icon btn-recibo" onclick="openReciboModal('${c.id}','${pg.id}')" title="Emitir recibo de ${esc(c.empresa)}" aria-label="Emitir recibo de ${esc(c.empresa)}"><i class="ti ti-receipt"></i></button>
        <button type="button" class="btn btn-icon btn-desfazer" onclick="confirmarDesfazer('${c.id}','${mesKey}')" title="Desfazer pagamento" aria-label="Desfazer pagamento de ${esc(c.empresa)}"><i class="ti ti-refresh"></i></button>
      </div>
      <span class="cb-paid-value">${fmtBRL(pg.valorPago)}</span>
    </div>`;
  };

  function sectionHtml(title, icon, items, renderer, key, limit=6, listCls='cb-section-list'){
    if(!items.length) return '';
    const expanded=!!window.cbExpandedSections[key];
    const visible=expanded?items:items.slice(0,limit);
    const rows=visible.map(renderer).join('');
    const remaining=items.length-limit;
    const btn=(remaining>0)
      ?`<div class="cb-more-wrap"><button type="button" class="btn cb-more-btn" onclick="toggleCbSection('${key}')" aria-expanded="${expanded}">${expanded?'Mostrar menos':`Ver mais (${remaining})`} <i class="ti ti-chevron-${expanded?'up':'down'}"></i></button></div>`
      :'';
    return `<div class="cb-section"><div class="cb-section-title ${key}"><i class="ti ${icon}"></i> ${title} — ${items.length} cliente${items.length!==1?'s':''}</div><div class="${listCls}">${rows}</div>${btn}</div>`;
  }

  function compactAvencerSection(items){
    if(!items.length) return '';
    const q=(window.cbCompactSearch||'').trim().toLowerCase();
    const sort=window.cbCompactSort||'vencimento';
    let list=items.filter(c=>{
      if(!q) return true;
      return (c.empresa||'').toLowerCase().includes(q) || (c.responsavel||'').toLowerCase().includes(q);
    }).slice();
    list.sort((a,b)=>{
      if(sort==='nome') return (a.empresa||'').localeCompare(b.empresa||'','pt-BR');
      if(sort==='valor') return cobrarTotal(b)-cobrarTotal(a);
      return (a.diaCobranca||0)-(b.diaCobranca||0) || (a.empresa||'').localeCompare(b.empresa||'','pt-BR');
    });
    const total=list.reduce((s,c)=>s+cobrarTotal(c),0);
    const expanded=!!window.cbExpandedSections['cb-sec-avencer'];
    const visible=expanded?list:list.slice(0,6);
    const rows=list.length ? visible.map(rowMini).join('') : `<div class="cb-compact-empty">Nenhum cliente encontrado para essa busca.</div>`;
    const remaining=list.length-6;
    const moreButton=remaining>0
      ?`<div class="cb-more-wrap"><button type="button" class="btn cb-more-btn" onclick="toggleCbSection('cb-sec-avencer')" aria-expanded="${expanded}">${expanded?'Mostrar menos':`Ver mais (${remaining})`} <i class="ti ti-chevron-${expanded?'up':'down'}"></i></button></div>`
      :'';
    return `<div class="cb-compact-panel">
      <div class="cb-compact-head">
        <div>
          <div class="cb-compact-title"><i class="ti ti-calendar-time"></i> A vencer este mês</div>
          <div class="cb-compact-sub">${items.length} cliente${items.length!==1?'s':''} · Visão compacta</div>
        </div>
        <div class="cb-compact-chip">${fmtBRL(total)} a receber</div>
      </div>
      <div class="cb-compact-tools">
        <label class="cb-compact-search"><i class="ti ti-search"></i><input type="text" placeholder="Buscar cliente..." value="${esc(window.cbCompactSearch||'')}" oninput="setCbCompactSearch(this.value)"></label>
        <label class="cb-compact-sort"><select onchange="setCbCompactSort(this.value)">
          <option value="vencimento" ${sort==='vencimento'?'selected':''}>Vencimento</option>
          <option value="nome" ${sort==='nome'?'selected':''}>Nome</option>
          <option value="valor" ${sort==='valor'?'selected':''}>Valor</option>
        </select><i class="ti ti-chevron-down"></i></label>
      </div>
      <div class="cb-compact-grid">${rows}</div>
      ${moreButton}
    </div>`;
  }

  let html='';
  html+=sectionHtml('Atrasados','ti-alert-circle',groups.atrasado,c=>rowMini(c,'atrasado'),'cb-sec-atrasado',6,'cb-compact-grid');
  html+=sectionHtml('Vence Hoje','ti-calendar-check',groups.hoje,c=>rowMini(c,'hoje'),'cb-sec-hoje',6,'cb-compact-grid');
  html+=compactAvencerSection(groups.avencer);
  html+=sectionHtml('Recebidos','ti-circle-check',groups.pago,item=>rowPago(item),'cb-sec-pago',6);
  if(!html)
    html=esHtml('receipt-off','Nada para exibir neste mês','Troque o mês para ver outros períodos.','','','sm');

  document.getElementById('cb-list').innerHTML=html;
}
/* ── BOOT ── */
updateBackupStatus();
setInterval(updateBackupStatus,60000);
initApp();
