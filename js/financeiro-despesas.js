/* DS Gestão V110 — Painel de Resultado e Despesas do Estúdio (v62) */

/* v62 — Financeiro do negócio: despesas + resultado do mês */
(function(){
var K='ds_despesas_v62', CATS=['Ferramentas e assinaturas','Impostos e taxas','Marketing e anúncios','Equipamento','Serviços de terceiros','Outros'];
var desp=[], useDb=true, warned=false, editId=null;
function el(i){ return document.getElementById(i); }
function lsGet(){ try{ return JSON.parse(localStorage.getItem(K)||'[]')||[]; }catch(e){ return []; } }
function lsSet(v){ try{ localStorage.setItem(K,JSON.stringify(v)); }catch(e){} }
function missing(err){ return !!err && /does not exist|schema cache|PGRST205|42P01|relation|column|PGRST204|42703/i.test(String(err.message||'')+' '+String(err.code||'')); }
function warn(){ if(warned) return; warned=true; try{ toast('Despesas ficaram salvas só neste aparelho (falta rodar o SQL v62 no Supabase).','err'); }catch(e){} }
function uid(){ return 'loc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function toRow(d){ return {descricao:d.descricao,valor:d.valor,data:d.data,categoria:d.categoria,recorrente:!!d.recorrente}; }
function fromRow(r){ return {id:r.id,descricao:r.descricao||'',valor:Number(r.valor)||0,data:String(r.data||'').slice(0,10),categoria:r.categoria||'Outros',recorrente:!!r.recorrente}; }
function brl(v){ return (typeof fmtBRL==='function')?fmtBRL(v):'R$ '+Number(v).toFixed(2).replace('.',','); }
function mk(y,m){ return y+'-'+String(m).padStart(2,'0'); }
function nextMk(key){
  var p=String(key||'').split('-'), y=parseInt(p[0],10)||2026, m=(parseInt(p[1],10)||1)+1;
  if(m>12){ m=1; y++; }
  return mk(y,m);
}
function prevMk(key){
  var p=String(key||'').split('-'), y=parseInt(p[0],10)||2026, m=(parseInt(p[1],10)||1)-1;
  if(m<1){ m=12; y--; }
  return mk(y,m);
}
function fmtMkShort(key){
  var p=String(key||'').split('-');
  return p.length===2 ? (p[1]+'/'+p[0]) : key;
}
function despEndStorageKey(){
  var u=(typeof _appUserId==='string'&&_appUserId)?_appUserId:'local';
  return 'ds_desp_end_v110_'+u;
}
window.dsDespEndsAll=function(){
  try{ var o=JSON.parse(localStorage.getItem(despEndStorageKey())||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
};
window.dsDespEndsSetAll=function(obj){
  try{ localStorage.setItem(despEndStorageKey(),JSON.stringify(obj||{})); }catch(e){}
};
window.dsGetDespEnd=function(id){
  if(!id) return '';
  return String(window.dsDespEndsAll()[String(id)]||'');
};
window.dsSetDespEnd=function(id,mesFim){
  if(!id) return;
  var all=window.dsDespEndsAll();
  /* Mantém '' em vez de delete para propagar reativação entre aparelhos no v69-js */
  all[String(id)]=mesFim?String(mesFim):'';
  window.dsDespEndsSetAll(all);
};
function doMes(key){
  return desp.filter(function(d){
    var k=d.data.slice(0,7);
    if(!d.recorrente) return k===key;
    if(k>key) return false;
    var fim=window.dsGetDespEnd(d.id);
    return !fim || key<fim;
  });
}
function soma(a){ return a.reduce(function(s,d){ return s+d.valor; },0); }
function recebidoMes(key){ return (typeof pagamentos!=='undefined'?pagamentos:[]).filter(function(p){ return p.mesReferencia===key; }).reduce(function(s,p){ return s+(p.valorPago||0); },0); }
window.v62MonthExpense=function(key){ return soma(doMes(key)); };

async function uidDb(){ var r=await authUser(); return r.data.user.id; }
async function load(){
  if(useDb && typeof sb!=='undefined' && sb){
    try{
      var u=await uidDb(), r=await sb.from('despesas').select('*').eq('user_id',u).order('data',{ascending:false});
      if(r.error) throw r.error;
      var loc=lsGet();
      if(loc.length){
        for(var i=0;i<loc.length;i++){ var row=toRow(loc[i]); row.user_id=u; var ins=await sb.from('despesas').insert(row); if(ins.error) throw ins.error; }
        lsSet([]);
        r=await sb.from('despesas').select('*').eq('user_id',u).order('data',{ascending:false}); if(r.error) throw r.error;
      }
      desp=(r.data||[]).map(fromRow); return;
    }catch(e){ if(missing(e)){ useDb=false; warn(); } else toast('Não consegui carregar as despesas.','err'); }
  }
  desp=lsGet();
}
async function save(d){
  if(useDb && sb && String(d.id||'').indexOf('loc_')!==0){
    try{
      var row=toRow(d), r;
      if(d.id){ r=await sb.from('despesas').update(row).eq('id',d.id); if(r.error) throw r.error; }
      else{ row.user_id=await uidDb(); r=await sb.from('despesas').insert(row).select().single(); if(r.error) throw r.error; d.id=r.data.id; }
      return d;
    }catch(e){ if(missing(e)){ useDb=false; warn(); } else throw e; }
  }
  if(!d.id) d.id=uid();
  var all=lsGet(), i=all.findIndex(function(x){ return x.id===d.id; });
  if(i>=0) all[i]=d; else all.push(d);
  lsSet(all); return d;
}
async function remove(id){
  if(useDb && sb && String(id).indexOf('loc_')!==0){ var r=await sb.from('despesas').delete().eq('id',id); if(r.error) throw r.error; return; }
  lsSet(lsGet().filter(function(x){ return x.id!==id; }));
}

function cur(){ var t=new Date(); if(typeof cbYear!=='undefined' && cbYear) return {y:cbYear,m:cbMonth}; return {y:t.getFullYear(),m:t.getMonth()+1}; }
function renderResumo(){
  var box=el('fn-resumo'); if(!box) return;
  var c=cur(), key=mk(c.y,c.m), rec=recebidoMes(key), dm=soma(doMes(key)), res=rec-dm;
  var t=new Date();
  var hh=t.getHours();
  var saud=hh<12?'Bom dia':(hh<18?'Boa tarde':'Boa noite');
  var nome='dagner';
  var dow=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'][t.getDay()];
  var dtLbl=`${dow}, ${t.getDate()} de ${MESES[t.getMonth()]}`;
  var titleEl=document.getElementById('finance-main-title'); if(titleEl) titleEl.textContent=`${saud}, ${nome}`;
  var dateEl=document.getElementById('finance-main-date'); if(dateEl) dateEl.textContent=dtLbl;
  var pillEl=document.getElementById('finance-main-pill'); if(pillEl) pillEl.textContent='Seja feita a tua vontade, assim na terra como no céu.';
  var ativos=(typeof clientes!=='undefined'?clientes:[]).filter(function(cli){ return cli.status==='ativo' && (cli.valorMensal||0)>0; });
  var extrasGeral=(typeof window.dsTotalExtrasGeralMes==='function')?window.dsTotalExtrasGeralMes(key):0;
  var previstoReceb=ativos.reduce(function(s,cli){ return s+(Number(cli.valorMensal)||0); },0)+extrasGeral;
  var faltaReceber=Math.max(previstoReceb-rec,0);
  var previstoDesp=dm;
  var faltaPagar=0;
  var fechamento=previstoReceb-previstoDesp;
  var saldoAtual=res;

  var bars=[], max=1, i, y=c.y, m=c.m;
  for(i=0;i<6;i++){ bars.unshift({y:y,m:m}); m--; if(m<1){ m=12; y--; } }
  bars=bars.map(function(b){ var k=mk(b.y,b.m); var r=recebidoMes(k), d=soma(doMes(k)); max=Math.max(max,r,d); return {k:k,m:b.m,r:r,d:d}; });
  var vazio=bars.every(function(b){ return !b.r&&!b.d; });
  var chartHtml=(vazio
    ?'<div class="finance-chart-empty">Nenhum lançamento nestes meses. O gráfico aparece quando houver receitas ou despesas.</div>'
    :'<div class="fn-chart"><div class="fn-chart-t">Comparativo com projeção<span class="fn-lg"><i style="background:var(--n-text)"></i>Receitas</span><span class="fn-lg"><i style="background:var(--n-faint)"></i>Despesas</span></div><div class="fn-bars">'+bars.map(function(b){ return '<div class="fn-bc"><div class="fn-bp"><div class="fn-b r" style="height:'+Math.round(b.r/max*100)+'%" title="Receitas '+brl(b.r)+'"></div><div class="fn-b d" style="height:'+Math.round(b.d/max*100)+'%" title="Despesas '+brl(b.d)+'"></div></div><div class="fn-bm'+(b.k===key?' cur':'')+'">'+MESES[b.m-1].slice(0,3)+'</div></div>'; }).join('')+'</div></div>'
  );

  box.innerHTML=''
    +'<div class="finance-lower-grid">'
      +'<div class="finance-panel">'
        +'<div class="finance-panel-head">Resultado previsto do mês</div>'
        +'<div class="finance-panel-total">'+brl(fechamento)+'</div>'
        +'<div class="finance-breakdown">'
          +'<div class="finance-subbox">'
            +'<h4 style="color:#69d394">Recebimentos</h4>'
            +'<div class="finance-line"><span>Recebido</span><strong>'+brl(rec)+'</strong></div>'
            +'<div class="finance-line"><span>Falta</span><strong>'+brl(faltaReceber)+'</strong></div>'
            +'<div class="finance-line"><span>Previsto</span><strong class="ok">'+brl(previstoReceb)+'</strong></div>'
          +'</div>'
          +'<div class="finance-subbox">'
            +'<h4 style="color:#ff7e71">Despesas</h4>'
            +'<div class="finance-line"><span>Pago</span><strong>'+brl(dm)+'</strong></div>'
            +'<div class="finance-line"><span>Falta</span><strong>'+brl(faltaPagar)+'</strong></div>'
            +'<div class="finance-line"><span>Previsto</span><strong class="bad">'+brl(previstoDesp)+'</strong></div>'
          +'</div>'
        +'</div>'
      +'</div>'
      +'<div class="finance-panel chart">'
        +'<div class="finance-panel-head">Comparativo com projeção</div>'
        +chartHtml
      +'</div>'
      +'<div class="finance-panel side">'
        +'<div class="finance-panel-head">Saldo e fechamento</div>'
        +'<div class="finance-side-lbl">Saldo atual</div>'
        +'<div class="finance-side-val">'+brl(saldoAtual)+'</div>'
        +'<div class="finance-side-box">'
          +'<div class="finance-side-lbl">Previsão de fechamento do mês</div>'
          +'<div class="finance-side-val">'+brl(fechamento)+'</div>'
          +'<div class="finance-side-desc">Saldo atual somado ao que ainda falta receber e pagar neste mês.</div>'
          +'<div class="finance-side-line"><span>Falta receber</span><strong class="ok">'+brl(faltaReceber)+'</strong></div>'
          +'<div class="finance-side-line"><span>Falta pagar</span><strong class="bad">'+brl(faltaPagar)+'</strong></div>'
        +'</div>'
      +'</div>'
    +'</div>';
}
function fmtData(ds){ var p=ds.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function renderLista(){
  var box=el('fn-desp'); if(!box) return;
  var c=cur(), key=mk(c.y,c.m), lista=doMes(key).slice().sort(function(a,b){ return b.data<a.data?-1:1; });
  var top='<div class="fn-top"><div class="fn-tot">Total em '+MESES[c.m-1]+': <b>'+brl(soma(lista))+'</b></div><button class="btn btn-primary" onclick="v62OpenDesp()"><i class="ti ti-plus"></i> Nova despesa</button></div>';
  if(!lista.length){ box.innerHTML=top+esHtml('receipt-off','Nenhuma despesa neste mês','Registre ferramentas, impostos e anúncios do seu negócio.','Nova despesa','v62OpenDesp()'); return; }
  box.innerHTML=top+lista.map(function(d){
    var fim=d.recorrente?window.dsGetDespEnd(d.id):'';
    var recTag=d.recorrente?(fim?'<span class="v110-rec-end-tag"><i class="ti ti-calendar-off"></i> até '+fmtMkShort(prevMk(fim))+'</span>':'<span><i class="ti ti-repeat"></i> todo mês</span>'):'';
    var stopBtn=(d.recorrente && !fim)?'<button class="btn btn-icon btn-stop-rec" onclick="v62StopRecRow(\''+esc(d.id)+'\')" data-tip="Encerrar recorrência a partir deste mês" aria-label="Encerrar recorrência a partir deste mês"><i class="ti ti-calendar-off"></i></button>':'';
    return '<div class="fn-row"><span class="fn-cat">'+esc(d.categoria)+'</span>'
      +'<div class="fn-info"><div class="fn-d">'+esc(d.descricao)+'</div><div class="fn-s"><span>'+fmtData(d.data)+'</span>'+recTag+'</div></div>'
      +'<span class="fn-val">'+brl(d.valor)+'</span>'
      +stopBtn
      +'<button class="btn btn-icon" onclick="v62OpenDesp(\''+esc(d.id)+'\')" data-tip="Editar"><i class="ti ti-pencil"></i></button>'
      +'<button class="btn btn-icon btn-del" onclick="v62DelDesp(\''+esc(d.id)+'\')" data-tip="Excluir"><i class="ti ti-trash"></i></button></div>';
  }).join('');
}
function renderAll(){ renderResumo(); renderLista(); if(typeof window.dsSchedulePostRender==='function') window.dsSchedulePostRender(); }

window.v62Seg=function(v){
  var s=el('sec-cobranca'); if(!s) return;
  s.setAttribute('data-fn',v);
  document.querySelectorAll('#fn-seg button').forEach(function(b){ b.classList.toggle('on',b.dataset.v===v); });
};
window.v62SyncRecUI=function(){
  var stBox=el('fx-rec-status'), btnStop=el('fx-stop-rec'), recChk=el('fx-rec');
  if(!stBox||!btnStop||!recChk) return;
  var d=editId?desp.find(function(x){ return String(x.id)===String(editId); }):null;
  if(!d || !recChk.checked){
    stBox.style.display='none';
    btnStop.style.display='none';
    return;
  }
  var fim=window.dsGetDespEnd(d.id);
  var c=cur(), curKey=mk(c.y,c.m), startKey=d.data.slice(0,7);
  btnStop.style.display='';
  if(fim){
    stBox.style.display='';
    stBox.textContent='Recorrência encerrada a partir de '+fmtMkShort(fim)+' (histórico dos meses anteriores preservado).';
    btnStop.innerHTML='<i class="ti ti-repeat"></i> Reativar recorrência';
  } else {
    stBox.style.display='none';
    var stopTarget=(curKey>startKey)?curKey:nextMk(startKey);
    btnStop.innerHTML='<i class="ti ti-calendar-off"></i> Encerrar em '+fmtMkShort(stopTarget);
  }
};
window.v62StopRecRow=function(id){
  var d=desp.find(function(x){ return String(x.id)===String(id); }); if(!d||!d.recorrente) return;
  var c=cur(), curKey=mk(c.y,c.m), startKey=d.data.slice(0,7);
  var prevFim=window.dsGetDespEnd(d.id);
  var targetFim=(curKey>startKey)?curKey:nextMk(startKey);
  window.dsSetDespEnd(d.id,targetFim);
  renderAll();
  var msg=(curKey>startKey)
    ?('Recorrência encerrada a partir de '+fmtMkShort(targetFim)+' (meses anteriores preservados).')
    :('Recorrência encerrada após '+fmtMkShort(startKey)+' (não repetirá nos próximos meses).');
  if(typeof toastUndo==='function'){
    toastUndo(msg,function(){ window.dsSetDespEnd(d.id,prevFim); renderAll(); },8000);
  } else {
    toast(msg,'ok');
  }
};
window.v62ToggleStopRecModal=function(){
  if(!editId) return;
  var d=desp.find(function(x){ return String(x.id)===String(editId); }); if(!d) return;
  var fim=window.dsGetDespEnd(d.id);
  if(fim){
    window.dsSetDespEnd(d.id,'');
    window.v62SyncRecUI();
    renderAll();
    toast('Recorrência reativada!','ok');
  } else {
    var id=d.id;
    v62CloseDesp();
    window.v62StopRecRow(id);
  }
};
window.v62OpenDesp=function(id){
  var d=id?desp.find(function(x){ return String(x.id)===String(id); }):null;
  editId=d?d.id:null;
  el('fx-title').textContent=d?'Editar despesa':'Nova despesa';
  el('fx-desc').value=d?d.descricao:'';
  el('fx-valor').value=d?String(d.valor).replace('.',','):'';
  var c=cur(), hoje=new Date(), pad=function(n){ return String(n).padStart(2,'0'); };
  el('fx-data').value=d?d.data:(c.y+'-'+pad(c.m)+'-'+pad(Math.min(hoje.getDate(),28)));
  el('fx-cat').value=d?d.categoria:CATS[0];
  el('fx-rec').checked=d?!!d.recorrente:false;
  el('fx-del').style.display=d?'':'none';
  window.v62SyncRecUI();
  el('fx-bg').classList.add('open');
  setTimeout(function(){ if(!d) el('fx-desc').focus(); },60);
};
window.v62CloseDesp=function(){ el('fx-bg').classList.remove('open'); editId=null; };
window.v62SaveDesp=async function(){
  var desc=el('fx-desc').value.trim(), valor=parseFloat(el('fx-valor').value.replace(/\./g,'').replace(',','.'))||0, data=el('fx-data').value;
  if(!desc){ toast('Descreva a despesa.','err'); return; }
  if(!(valor>0)){ toast('Informe o valor.','err'); return; }
  if(!data){ toast('Informe a data.','err'); return; }
  var old=editId?desp.find(function(x){ return String(x.id)===String(editId); }):null;
  var d={id:old?old.id:null,descricao:desc,valor:valor,data:data,categoria:el('fx-cat').value,recorrente:el('fx-rec').checked};
  try{
    await save(d);
    if(!d.recorrente && d.id) window.dsSetDespEnd(d.id,'');
    if(old) Object.assign(old,d); else desp.push(d);
    v62CloseDesp(); renderAll(); toast('Despesa salva.','ok');
  }
  catch(e){ toast('Não consegui salvar a despesa.','err'); }
};
window.v62DelDesp=function(id){
  var d=desp.find(function(x){ return String(x.id)===String(id); }); if(!d) return;
  openPcConfirm('Excluir despesa?','Deseja excluir "'+d.descricao+'"'+(d.recorrente?' permanentemente (apaga inclusive dos meses passados)? Para manter os meses anteriores, use o botão Encerrar recorrência.':'?'),async function(){
    try{ await remove(d.id); window.dsSetDespEnd(d.id,''); desp=desp.filter(function(x){ return x.id!==d.id; }); renderAll(); toast('Despesa excluída.','inf'); }
    catch(e){ toast('Não consegui excluir.','err'); }
  });
};
window.v62DelDespModal=function(){ var id=editId; v62CloseDesp(); if(id) v62DelDesp(id); };

/* encaixa no Cobrança: renderiza o resumo sempre que a tela atualiza */
var loaded=false, orig=window.renderCobranca;
window.renderCobranca=function(){
  var r=orig.apply(this,arguments);
  if(!loaded){ loaded=true; load().then(renderAll); } else renderAll();
  return r;
};
window.addEventListener('ds-cfg-pulled',function(e){
  if(e.detail && e.detail.key==='ds_desp_end_v110') renderAll();
});
document.addEventListener('keydown',function(e){ if(e.key==='Escape' && el('fx-bg')) v62CloseDesp(); });
document.addEventListener('click',function(e){ if(e.target&&e.target.id==='fx-bg') v62CloseDesp(); });
window.v62Cats=CATS;
})();
