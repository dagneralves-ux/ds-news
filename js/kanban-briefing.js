/* DS Gestão V110 — Quadro Kanban de Demandas e Briefings de Clientes (v61) */

/* v61 — Demandas (kanban) + briefing do cliente + legenda */
(function(){
var COLS=[
  {id:'briefing',nome:'Briefing',ic:'notes'},
  {id:'producao',nome:'Em produção',ic:'palette'},
  {id:'aprovacao',nome:'Aprovação',ic:'eye-check'},
  {id:'pronto',nome:'Pronto / postado',ic:'circle-check'}
];
var FORMATOS=['Feed','Reels','Stories','Carrossel'];
var K_DEM='ds_demandas_v61', K_BR='ds_briefings_v61';
var dem=[], brf={}, useDb={demandas:true,briefings:true}, warned=false, filtro='', dragId=null;

function lsGet(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function tableMissing(err){ return !!err && /does not exist|schema cache|PGRST205|42P01|relation|column|PGRST204|42703/i.test(String(err.message||'')+' '+String(err.code||'')); }
function warn(){ if(warned) return; warned=true; try{ toast('Demandas e briefing ficaram salvos só neste aparelho (falta rodar o SQL v61 no Supabase).','err'); }catch(e){} }
function uid(){ return 'loc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function el(id){ return document.getElementById(id); }
function cli(id){ return (typeof clientes!=='undefined'?clientes:[]).find(function(c){ return String(c.id)===String(id); })||null; }
function fmtData(ds){ if(!ds) return ''; var p=ds.split('-'); return p[2]+'/'+p[1]; }
function hoje(){ return (typeof todayDs==='function')?todayDs():new Date().toISOString().slice(0,10); }
function rowToDem(r){ return {id:r.id,titulo:r.titulo||'',clienteId:r.cliente_id||'',status:r.status||'briefing',entrega:r.data_entrega||'',formato:r.formato||'',legenda:r.legenda||''}; }
function demToRow(d){ return {titulo:d.titulo,cliente_id:d.clienteId||null,status:d.status,data_entrega:d.entrega||null,formato:d.formato||'',legenda:d.legenda||''}; }

/* ── dados: Supabase quando a tabela existe; senão neste aparelho ── */
async function userId(){ var r=await authUser(); return r.data.user.id; }
async function loadDem(){
  if(useDb.demandas && typeof sb!=='undefined' && sb){
    try{
      var u=await userId();
      var r=await sb.from('demandas').select('*').eq('user_id',u).order('criado_em',{ascending:true});
      if(r.error) throw r.error;
      var loc=lsGet(K_DEM,[]);
      if(loc.length){ /* sobe o que ficou só neste aparelho */
        for(var i=0;i<loc.length;i++){ var row=demToRow(loc[i]); row.user_id=u; var ins=await sb.from('demandas').insert(row); if(ins.error) throw ins.error; }
        lsSet(K_DEM,[]);
        r=await sb.from('demandas').select('*').eq('user_id',u).order('criado_em',{ascending:true}); if(r.error) throw r.error;
      }
      dem=(r.data||[]).map(rowToDem); return;
    }catch(e){ if(tableMissing(e)){ useDb.demandas=false; warn(); } else { toast('Não consegui carregar as demandas.','err'); } }
  }
  dem=lsGet(K_DEM,[]);
}
async function saveDem(d){
  if(useDb.demandas && sb && String(d.id||'').indexOf('loc_')!==0){
    try{
      var u=await userId(), row=demToRow(d), r;
      if(d.id){ r=await sb.from('demandas').update(row).eq('id',d.id); if(r.error) throw r.error; }
      else{ row.user_id=u; r=await sb.from('demandas').insert(row).select().single(); if(r.error) throw r.error; d.id=r.data.id; }
      return d;
    }catch(e){ if(tableMissing(e)){ useDb.demandas=false; warn(); } else throw e; }
  }
  if(!d.id) d.id=uid();
  var all=lsGet(K_DEM,[]), i=all.findIndex(function(x){ return x.id===d.id; });
  if(i>=0) all[i]=d; else all.push(d);
  lsSet(K_DEM,all); return d;
}
async function delDemDb(id){
  if(useDb.demandas && sb && String(id).indexOf('loc_')!==0){
    var r=await sb.from('demandas').delete().eq('id',id); if(r.error) throw r.error; return;
  }
  lsSet(K_DEM,lsGet(K_DEM,[]).filter(function(x){ return x.id!==id; }));
}

/* ── render do kanban ── */
function renderSel(){
  var s=el('kb-filtro'); if(!s) return;
  var cs=(typeof clientes!=='undefined'?clientes:[]).filter(function(c){ return c.status==='ativo'; });
  s.innerHTML='<option value="">Todos os clientes</option>'+cs.map(function(c){ return '<option value="'+esc(c.id)+'"'+(String(c.id)===filtro?' selected':'')+'>'+esc(c.empresa)+'</option>'; }).join('');
}
function cardHtml(d,ci){
  var c=cli(d.clienteId), cc=(c&&/^#[0-9a-fA-F]{6}$/.test(c.cor||''))?c.cor:'',
      late=d.entrega && d.status!=='pronto' && d.entrega<hoje();
  var meta='';
  if(c) meta+='<span class="kb-chip" style="'+(cc?'--cc:'+cc:'')+'"><span class="kb-dot"></span>'+esc(c.empresa)+'</span>';
  if(d.entrega) meta+='<span class="kb-chip'+(late?' kb-late':'')+'"><i class="ti ti-calendar"></i>'+fmtData(d.entrega)+'</span>';
  if(d.formato) meta+='<span class="kb-chip">'+esc(d.formato)+'</span>';
  if(d.legenda) meta+='<span class="kb-chip" title="Tem legenda"><i class="ti ti-align-left"></i></span>';
  if(window.v63Chip) meta+=window.v63Chip(d.id);
  return '<div class="kb-card" draggable="true" data-id="'+esc(d.id)+'" onclick="v61OpenDem(\''+esc(d.id)+'\')">'
    +'<div class="kb-t">'+esc(d.titulo)+'</div><div class="kb-meta">'+meta+'</div>'
    +'<div class="kb-act"><button class="kb-mv" '+(ci===0?'disabled':'')+' onclick="event.stopPropagation();v61Move(\''+esc(d.id)+'\',-1)" aria-label="Voltar"><i class="ti ti-chevron-left"></i></button>'
    +'<button class="kb-mv" '+(ci===COLS.length-1?'disabled':'')+' onclick="event.stopPropagation();v61Move(\''+esc(d.id)+'\',1)" aria-label="Avançar"><i class="ti ti-chevron-right"></i></button></div></div>';
}
function render(){
  var b=el('kb'); if(!b) return;
  renderSel();
  var lista=dem.filter(function(d){ return !filtro || String(d.clienteId)===filtro; });
  if(!dem.length){
    b.style.display='block';
    b.innerHTML=esHtml('layout-kanban','Nenhuma demanda ainda','Crie a primeira e acompanhe da ideia até a postagem.','Nova demanda','v61OpenDem()');
    return;
  }
  b.style.display='';
  b.innerHTML=COLS.map(function(col,ci){
    var ds=lista.filter(function(d){ return d.status===col.id; });
    return '<div class="kb-col" data-col="'+col.id+'"><div class="kb-hd"><i class="ti ti-'+col.ic+'"></i>'+col.nome+'<span class="kb-n">'+ds.length+'</span></div>'
      +(ds.length?ds.map(function(d){ return cardHtml(d,ci); }).join(''):'<div class="kb-empty">Vazio</div>')+'</div>';
  }).join('');
  bindDrag();
}
function bindDrag(){
  var b=el('kb');
  b.querySelectorAll('.kb-card').forEach(function(c){
    c.addEventListener('dragstart',function(e){ dragId=c.dataset.id; c.classList.add('drag'); try{ e.dataTransfer.setData('text/plain',dragId); e.dataTransfer.effectAllowed='move'; }catch(x){} });
    c.addEventListener('dragend',function(){ c.classList.remove('drag'); b.querySelectorAll('.kb-col').forEach(function(k){ k.classList.remove('over'); }); });
  });
  b.querySelectorAll('.kb-col').forEach(function(k){
    k.addEventListener('dragover',function(e){ e.preventDefault(); k.classList.add('over'); });
    k.addEventListener('dragleave',function(){ k.classList.remove('over'); });
    k.addEventListener('drop',function(e){ e.preventDefault(); k.classList.remove('over'); if(dragId) v68MoveUndo(dragId,k.dataset.col); dragId=null; });
  });
}
async function setStatus(id,st){
  var d=dem.find(function(x){ return String(x.id)===String(id); }); if(!d||d.status===st) return;
  var old=d.status; d.status=st; render();
  try{ await saveDem(d); }catch(e){ d.status=old; render(); toast('Não consegui mover a demanda.','err'); }
}
window.v61Move=function(id,dir){
  var d=dem.find(function(x){ return String(x.id)===String(id); }); if(!d) return;
  var i=COLS.findIndex(function(c){ return c.id===d.status; })+dir;
  if(i>=0&&i<COLS.length) v68MoveUndo(id,COLS[i].id);
};
window.v61Filtro=function(v){ filtro=v; render(); };
window.v61RenderDemandas=async function(){ await Promise.all([loadDem(),loadBr()]); render(); };
window.v61Api={get:function(){ return dem; },load:function(){ return Promise.all([loadDem(),loadBr()]); },setStatus:setStatus,render:render,open:function(id){ window.v61OpenDem(id); },cli:cli,save:saveDem,add:function(d){ dem.push(d); },brief:function(id){ return brf[String(id)]||null; },cols:COLS,remove:async function(id){ await delDemDb(id); dem=dem.filter(function(x){ return String(x.id)!==String(id); }); }};

/* ── modal da demanda ── */
var editDem=null;
function fillClienteSel(sel,val,onlyAtivos){
  var cs=(typeof clientes!=='undefined'?clientes:[]).filter(function(c){ return !onlyAtivos || c.status==='ativo' || String(c.id)===String(val); });
  sel.innerHTML='<option value="">— sem cliente —</option>'+cs.map(function(c){ return '<option value="'+esc(c.id)+'"'+(String(c.id)===String(val)?' selected':'')+'>'+esc(c.empresa)+'</option>'; }).join('');
}
window.v61OpenDem=function(id){
  var d=id?dem.find(function(x){ return String(x.id)===String(id); }):null;
  editDem=d?d.id:null;
  el('dm-title').textContent=d?'Editar demanda':'Nova demanda';
  el('dm-t').value=d?d.titulo:'';
  fillClienteSel(el('dm-c'),d?d.clienteId:filtro,true);
  el('dm-s').value=d?d.status:'briefing';
  el('dm-d').value=d?d.entrega:'';
  el('dm-f').value=d?d.formato:'';
  el('dm-l').value=d?d.legenda:'';
  el('dm-del').style.display=d?'':'none';
  capInfo(); hint();
  el('dm-bg').classList.add('open');
  setTimeout(function(){ if(!d) el('dm-t').focus(); },60);
};
window.v61CloseDem=function(){ el('dm-bg').classList.remove('open'); editDem=null; };
function capInfo(){ var n=el('dm-l').value.length; el('dm-n').textContent=n+' caracteres'+(n>2200?' — passou do limite do Instagram (2.200)':''); }
window.v61CapInfo=capInfo;
function briefOf(cid){ return brf[String(cid)]||null; }
function hint(){
  var h=el('dm-hint'), cid=el('dm-c').value, b=briefOf(cid);
  if(!cid){ h.style.display='none'; return; }
  h.style.display='';
  if(!b || !(b.tom||b.evitar||b.hashtags)){ h.innerHTML='Este cliente ainda não tem briefing. <a href="#" onclick="v61OpenBr(\''+esc(cid)+'\');return false" style="color:var(--n-text);text-decoration:underline">Preencher agora</a>'; return; }
  var t='';
  if(b.tom) t+='<div><b>Tom de voz:</b> '+esc(b.tom)+'</div>';
  if(b.evitar) t+='<div><b>Evitar:</b> '+esc(b.evitar)+'</div>';
  if(b.hashtags) t+='<div><b>Hashtags:</b> '+esc(b.hashtags)+'</div>';
  h.innerHTML=t;
}
window.v61Hint=hint;
window.v61AddTags=function(){
  var b=briefOf(el('dm-c').value);
  if(!b||!b.hashtags){ toast('Este cliente não tem hashtags no briefing.','inf'); return; }
  var ta=el('dm-l'); if(ta.value.indexOf(b.hashtags)>=0) return;
  ta.value=(ta.value.replace(/\s+$/,'')+(ta.value?'\n\n':'')+b.hashtags); capInfo();
};
window.v61CopyCap=async function(){
  var v=el('dm-l').value; if(!v){ toast('A legenda está vazia.','inf'); return; }
  try{ await navigator.clipboard.writeText(v); }
  catch(e){ var ta=el('dm-l'); ta.select(); document.execCommand('copy'); }
  toast('Legenda copiada.','ok');
};
window.v61SaveDem=async function(){
  var t=el('dm-t').value.trim();
  if(!t){ toast('Dê um título à demanda.','err'); return; }
  var old=editDem?dem.find(function(x){ return String(x.id)===String(editDem); }):null;
  var d={id:old?old.id:null,titulo:t,clienteId:el('dm-c').value,status:el('dm-s').value,entrega:el('dm-d').value,formato:el('dm-f').value,legenda:el('dm-l').value};
  try{
    await saveDem(d);
    if(old) Object.assign(old,d); else dem.push(d);
    v61CloseDem(); render(); toast('Demanda salva.','ok');
  }catch(e){ toast('Não consegui salvar a demanda.','err'); }
};
window.v61DelDem=async function(){
  if(!editDem) return;
  var gone=dem.find(function(x){ return String(x.id)===String(editDem); });
  try{ await delDemDb(editDem); dem=dem.filter(function(x){ return String(x.id)!==String(editDem); }); v61CloseDem(); render();
    toastUndo('Demanda excluída.',function(){ if(!gone) return; var c=Object.assign({},gone,{id:null}); saveDem(c).then(function(r){ dem.push(r||c); render(); toast('Demanda restaurada.','ok'); }); },8000); }
  catch(e){ toast('Não consegui excluir.','err'); }
};

/* ── briefing do cliente ── */
var BR_F=['objetivo','publico','tom','referencias','evitar','hashtags','material'];
var brCli=null;
async function loadBr(){
  var loc=lsGet(K_BR,{});
  if(useDb.briefings && typeof sb!=='undefined' && sb){
    try{
      var u=await userId();
      var r=await sb.from('briefings').select('*').eq('user_id',u);
      if(r.error) throw r.error;
      var lb=lsGet(K_BR,{}), ks=Object.keys(lb);
      if(ks.length){
        for(var i=0;i<ks.length;i++){ var up=await sb.from('briefings').upsert({cliente_id:ks[i],user_id:u,dados:lb[ks[i]]},{onConflict:'cliente_id'}); if(up.error) throw up.error; }
        lsSet(K_BR,{});
        r=await sb.from('briefings').select('*').eq('user_id',u); if(r.error) throw r.error;
      }
      brf={}; (r.data||[]).forEach(function(x){ brf[String(x.cliente_id)]=x.dados||{}; });
      return;
    }catch(e){ if(tableMissing(e)){ useDb.briefings=false; warn(); } }
  }
  brf=loc;
}
window.v61OpenBr=async function(cid){
  var c=cli(cid); if(!c) return;
  if(!Object.keys(brf).length) await loadBr();
  brCli=String(cid);
  var b=brf[brCli]||{};
  el('br-title').textContent='Briefing — '+c.empresa;
  BR_F.forEach(function(k){ el('br-'+k).value=b[k]||''; });
  el('br-bg').classList.add('open');
};
window.v61CloseBr=function(){ el('br-bg').classList.remove('open'); brCli=null; };
window.v61SaveBr=async function(){
  if(!brCli) return;
  var b={}; BR_F.forEach(function(k){ b[k]=el('br-'+k).value.trim(); });
  try{
    if(useDb.briefings && sb){
      try{
        var u=await userId();
        var r=await sb.from('briefings').upsert({cliente_id:brCli,user_id:u,dados:b},{onConflict:'cliente_id'});
        if(r.error) throw r.error;
      }catch(e){ if(tableMissing(e)){ useDb.briefings=false; warn(); } else throw e; }
    }
    brf[brCli]=b;
    if(!useDb.briefings){ var all=lsGet(K_BR,{}); all[brCli]=b; lsSet(K_BR,all); }
    v61CloseBr(); toast('Briefing salvo.','ok');
  }catch(e){ toast('Não consegui salvar o briefing.','err'); }
};

/* ── fecha com Esc / clique fora ── */
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ if(el('dm-bg')) v61CloseDem(); if(el('br-bg')) v61CloseBr(); } });
['dm-bg','br-bg'].forEach(function(id){ document.addEventListener('click',function(e){ if(e.target&&e.target.id===id){ id==='dm-bg'?v61CloseDem():v61CloseBr(); } }); });
})();
