/* DS Gestão V110 — Sincronização em Nuvem, Produtividade, Seleção em Massa e Cronômetro */

/* v66 — Pacote A (font-size mínimo já aplicado no CSS estático da V110) */
(function(){
  if(/aprovar=/.test(location.hash)) return;
  var $=function(i){return document.getElementById(i)};

  /* 1 · menu recolhível */
  function rail(){
    var acts=document.querySelector('.hdr-actions'); if(!acts||$('rail-toggle')) return;
    try{ if(localStorage.getItem('ds_rail')==='open') document.documentElement.setAttribute('data-rail','open'); }catch(e){}
    var b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='rail-toggle';
    b.setAttribute('aria-label','Mostrar nomes do menu'); b.setAttribute('data-tip','Mostrar nomes');
    b.innerHTML='<i class="ti ti-layout-sidebar-left-expand"></i><span class="btn-txt">Recolher menu</span>';
    b.onclick=function(){
      var h=document.documentElement, open=h.getAttribute('data-rail')==='open';
      if(open) h.removeAttribute('data-rail'); else h.setAttribute('data-rail','open');
      try{ localStorage.setItem('ds_rail',open?'closed':'open'); }catch(e){}
      b.querySelector('i').className='ti '+(open?'ti-layout-sidebar-left-expand':'ti-layout-sidebar-left-collapse');
      b.querySelector('.btn-txt').textContent=open?'Mostrar nomes':'Recolher menu';
    };
    acts.insertBefore(b,acts.firstChild);
    var bell=$('bell-btn'); if(bell&&!bell.querySelector('.btn-txt')){ var t=document.createElement('span'); t.className='btn-txt'; t.textContent='Avisos'; bell.insertBefore(t,bell.querySelector('.bell-n')); }
    var mb=document.querySelector('#hdr-more>.btn'); if(mb&&!mb.querySelector('.btn-txt')){ var t2=document.createElement('span'); t2.className='btn-txt'; t2.textContent='Mais ações'; mb.appendChild(t2); }
    var o=document.documentElement.getAttribute('data-rail')==='open';
    b.querySelector('i').className='ti '+(o?'ti-layout-sidebar-left-collapse':'ti-layout-sidebar-left-expand');
    b.querySelector('.btn-txt').textContent=o?'Recolher menu':'Mostrar nomes';
  }

  /* 4 · gráfico vazio */
  function chart(){
    var card=document.querySelector('.chart-card'), tot=$('chart-total'); if(!card||!tot) return;
    if(!card.querySelector('.v66-empty-cta')){
      var d=document.createElement('div'); d.className='v66-empty-cta';
      d.innerHTML='<span>Nenhuma entrega registrada ainda. Marque a primeira para ver o gráfico.</span><button type="button">Ir para Produção</button>';
      d.querySelector('button').onclick=function(){ if(window.switchTab) switchTab('producao'); };
      card.appendChild(d);
    }
    var empty=/^\s*0\b/.test(tot.textContent||'') || !(tot.textContent||'').trim();
    card.classList.toggle('v66-empty',empty);
  }

  /* 5 · aprovação recolhível no modal da demanda */
  function aprBox(){
    var box=$('dm-apr'); if(!box) return;
    box.addEventListener('click',function(e){
      var t=e.target.closest&&e.target.closest('.apr-t'); if(!t||!box.contains(t)) return;
      box.classList.toggle('v66-c');
    });
    var bg=$('dm-bg');
    if(bg) new MutationObserver(function(){
      if(bg.classList.contains('open')){
        /* abre recolhida quando ainda não há link gerado; aberta quando já existe */
        setTimeout(function(){ var has=box.querySelector('.apr-st'); box.classList.toggle('v66-c',!has); },30);
      }
    }).observe(bg,{attributes:true,attributeFilter:['class']});
  }

  /* 6 · aviso de briefing */
  function hint(){
    var h=$('dm-hint'); if(!h) return;
    function fix(){
      var t=h.textContent||'';
      if(/ainda não tem briefing/i.test(t) && !h.querySelector('.dm-hint-go')){
        var a=h.querySelector('a'); var onc=a?a.getAttribute('onclick'):'';
        h.classList.add('dm-hint-warn');
        h.innerHTML='<i class="ti ti-alert-circle" style="font-size:18px"></i><span>Este cliente ainda não tem briefing. Preencha para manter o tom e as hashtags.</span><button type="button" class="dm-hint-go">Preencher agora</button>';
        var btn=h.querySelector('.dm-hint-go');
        btn.onclick=function(){ try{ (new Function(onc.replace(/;?return false;?/,'')))(); }catch(e){} };
      }else if(!/ainda não tem briefing/i.test(t)){ h.classList.remove('dm-hint-warn'); }
    }
    new MutationObserver(fix).observe(h,{childList:true,characterData:true,subtree:true});
    fix();
  }

  function init(){
    rail(); chart(); aprBox(); hint();
    var tot=$('chart-total'); if(tot) new MutationObserver(chart).observe(tot,{childList:true,characterData:true,subtree:true});
    setTimeout(chart,600); setTimeout(chart,1800);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(init,0); });
  else setTimeout(init,0);
})();

/* v67 — Pacote B (lado do designer) */
(function(){
  if(/aprovar=/.test(location.hash)) return;
  var $=function(i){return document.getElementById(i)};
  function E(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function tel(c){ var d=String((c&&c.telefone)||'').replace(/\D/g,''); if(d.length===10||d.length===11) d='55'+d; return d; }
  function wa(c,msg){ var n=tel(c); window.open('https://wa.me/'+(n?n:'')+'?text='+encodeURIComponent(msg),'_blank'); }
  function cli(id){ try{ return clientes.find(function(x){return String(x.id)===String(id);}); }catch(e){ return null; } }
  var MES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function money(v){ try{ return fmtBRL(v); }catch(e){ return 'R$ '+Number(v||0).toFixed(2).replace('.',','); } }
  function pri(c){ return String((c&&c.responsavel)||'').trim().split(/\s+/)[0]; }

  /* 13 · cobrar no WhatsApp (com avulsos do mês e chave PIX configurável) */
  window.v67Cobrar=function(id,status){
    var c=cli(id); if(!c) return;
    var y=(typeof cbYear!=='undefined'&&cbYear)||new Date().getFullYear(), m=(typeof cbMonth!=='undefined'&&cbMonth)||new Date().getMonth()+1;
    var mk=y+'-'+String(m).padStart(2,'0');
    var extras=(typeof window.dsExtrasDoMes==='function')?window.dsExtrasDoMes(id,mk):[];
    var extTot=extras.reduce(function(s,x){ return s+(Number(x.valor)||0); },0);
    var baseVal=Number(c.valorMensal)||0;
    var totalCobrar=baseVal+extTot;
    var mes=MES[m-1]+'/'+y, val=totalCobrar?(' ('+money(totalCobrar)+')'):'', nome=pri(c);
    var refTxt=extTot>0&&baseVal>0?'da mensalidade + serviços avulsos de '+mes+val:(extTot>0?'dos serviços avulsos de '+mes+val:'da mensalidade de '+mes+val);
    var refNom=extTot>0&&baseVal>0?'a mensalidade + serviços avulsos de '+mes+val:(extTot>0?'os serviços avulsos de '+mes+val:'a mensalidade de '+mes+val);
    var diaTxt=c.diaCobranca>0?(' no dia '+c.diaCobranca):'';
    var msg='Olá'+(nome?', '+nome:'')+'! Tudo bem? Aqui é o Dagner, da Dagner Design.\n\n';
    if(status==='atrasado') msg+='Passando para lembrar '+refTxt+(diaTxt?', com vencimento'+diaTxt+',':'')+' que ainda consta em aberto. Consegue me confirmar o pagamento?\n\n';
    else if(status==='hoje') msg+='Só um lembrete: '+refNom+' vence hoje.\n\n';
    else msg+='Um aviso antecipado: '+refNom+(diaTxt?' vence'+diaTxt+'.':' está disponível para fechamento.')+'\n\n';
    if(extras.length){
      msg+='📋 *Detalhamento:*\n';
      if(baseVal>0) msg+='• Mensalidade: '+money(baseVal)+'\n';
      extras.forEach(function(ex){ msg+='• '+(ex.descricao||ex.servico||'Serviço avulso')+': '+money(ex.valor)+'\n'; });
      msg+='\n';
    }
    var pix=(typeof window.dsPixConfig==='function')?window.dsPixConfig():{chave:'',titular:''};
    if(pix.chave){
      msg+='💳 *Chave PIX:* '+pix.chave+'\n';
      if(pix.titular) msg+='👤 *Favorecido:* '+pix.titular+'\n';
      msg+='\n';
    }
    msg+='Qualquer dúvida, é só me chamar. Obrigado!';
    wa(c,msg);
  };
  /* 29 · relatório mensal do cliente */
  var rpId=null, rpY=0, rpM=0;
  function entregasDo(id,y,m){
    var key=y+'-'+String(m).padStart(2,'0'), seen={}, out=[];
    try{ entregas.forEach(function(e){ if(String(e.clienteId)===String(id)&&String(e.dataEntrega||'').slice(0,7)===key){ var d=String(e.dataEntrega).slice(0,10); if(!seen[d]){ seen[d]=1; out.push(d); } } }); }catch(e){}
    return out.sort();
  }
  function rpText(){
    var c=cli(rpId); if(!c) return '';
    var ds=entregasDo(rpId,rpY,rpM), nome=pri(c);
    var t='📊 *Relatório de '+MES[rpM-1]+' de '+rpY+'*\n*'+c.empresa+'*\n\nOlá'+(nome?', '+nome:'')+'! Segue o resumo das artes do mês:\n\n';
    t+='• Artes entregues: *'+ds.length+'*\n';
    if(ds.length) t+='• Datas: '+ds.map(function(d){ return d.slice(8,10)+'/'+d.slice(5,7); }).join(', ')+'\n';
    t+='\nQualquer ajuste, é só me falar!\n_Dagner Design_';
    return t;
  }
  function rpDraw(){
    var c=cli(rpId); if(!c) return;
    var ds=entregasDo(rpId,rpY,rpM);
    var mk=rpY+'-'+String(rpM).padStart(2,'0');
    $('rp-t').textContent='Relatório · '+c.empresa;
    $('rp-mes').textContent=MES[rpM-1]+' '+rpY;
    $('rp-n').textContent=ds.length;
    if($('rp-tempo')){
      var sec=(typeof window.dsClientMonthSeconds==='function')?window.dsClientMonthSeconds(rpId,mk):0;
      $('rp-tempo').textContent=(typeof window.dsFormatDuration==='function')?window.dsFormatDuration(sec):'0 min';
      var totMes=(typeof window.dsTotalCobrarCliente==='function')?window.dsTotalCobrarCliente(c,mk):(Number(c.valorMensal)||0);
      if($('rp-hora')){
        $('rp-hora').textContent=(sec>=600 && totMes>0)?('≈ '+money(totMes/(sec/3600))+'/h efetiva'):'';
      }
    }
    $('rp-txt').value=rpText();
  }
  function rpOpen(id){
    rpId=id; var t=new Date(); rpY=t.getFullYear(); rpM=t.getMonth()+1;
    if(!$('rp-bg')){
      var bg=document.createElement('div'); bg.className='modal-bg'; bg.id='rp-bg'; bg.setAttribute('role','dialog'); bg.setAttribute('aria-modal','true');
      bg.innerHTML='<div class="modal-box v67-rp"><div class="modal-hdr"><span class="modal-title" id="rp-t">Relatório</span><button class="modal-x" type="button" onclick="v67RpClose()"><i class="ti ti-x"></i></button></div>'
        +'<div class="rp-nav"><button class="btn btn-icon" type="button" onclick="v67RpMes(-1)" aria-label="Mês anterior"><i class="ti ti-chevron-left"></i></button><strong id="rp-mes"></strong><button class="btn btn-icon" type="button" onclick="v67RpMes(1)" aria-label="Próximo mês"><i class="ti ti-chevron-right"></i></button></div>'
        +'<div class="rp-kpi"><div><b id="rp-n">0</b><span>artes entregues no mês</span></div><div><b id="rp-tempo">0 min</b><span>tempo dedicado (interno)</span><small class="rp-kpi-sub" id="rp-hora"></small></div></div>'
        +'<div class="rp-h">Mensagem (pode editar)</div><textarea class="finput" id="rp-txt"></textarea>'
        +'<div class="v61-foot"><div class="l"><button class="btn" type="button" onclick="v67RpCopy()"><i class="ti ti-copy"></i> Copiar</button></div><div class="l"><button class="btn" type="button" onclick="v67RpClose()">Fechar</button><button class="btn btn-primary" type="button" onclick="v67RpWpp()"><i class="ti ti-brand-whatsapp"></i> Enviar no WhatsApp</button></div></div></div>';
      document.body.appendChild(bg);
      bg.addEventListener('click',function(e){ if(e.target===bg) v67RpClose(); });
    }
    rpDraw(); $('rp-bg').classList.add('open');
  }
  window.v67RpClose=function(){ var b=$('rp-bg'); if(b) b.classList.remove('open'); };
  window.v67RpMes=function(d){ rpM+=d; if(rpM<1){rpM=12;rpY--;} if(rpM>12){rpM=1;rpY++;} rpDraw(); };
  window.v67RpCopy=function(){ var t=$('rp-txt').value; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){ toast('Relatório copiado.','ok'); },function(){ $('rp-txt').select(); document.execCommand('copy'); toast('Relatório copiado.','ok'); }); };
  window.v67RpWpp=function(){ var c=cli(rpId); if(c) wa(c,$('rp-txt').value); };
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&$('rp-bg')&&$('rp-bg').classList.contains('open')) v67RpClose(); });
  function cardBtns(){
    var g=$('clients-grid'); if(!g) return;
    [].forEach.call(g.querySelectorAll('.card-btns'),function(box){
      if(box.querySelector('.v67-rp-b')) return;
      var w=box.querySelector('.btn-wpp-sm'); var mm=w&&/wppCliente\('([^']+)'/.exec(w.getAttribute('onclick')||''); if(!mm) return;
      var b=document.createElement('button'); b.type='button'; b.className='btn btn-icon v67-rp-b';
      b.setAttribute('data-tip','Relatório do mês'); b.setAttribute('aria-label','Relatório do mês');
      b.innerHTML='<i class="ti ti-report"></i>'; b.onclick=function(){ rpOpen(mm[1]); };
      box.insertBefore(b,w.nextSibling);
    });
  }

  /* 14 · WhatsApp do designer (aparece na tela de obrigado do cliente) */
  function wppField(){
    var box=$('dm-apr'); if(!box||box.querySelector('.apr-w')||!box.querySelector('.apr-row')) return;
    var cur=''; try{ cur=localStorage.getItem('ds_meu_whats')||''; }catch(e){}
    var d=document.createElement('div'); d.className='apr-w';
    d.innerHTML=cur?('Seu WhatsApp na tela do cliente: <b>'+E(cur)+'</b> · <button type="button">alterar</button>'):'<button type="button">Adicionar meu WhatsApp na tela do cliente</button>';
    d.querySelector('button').onclick=function(){
      d.innerHTML='<div class="apr-wf"><input class="finput" type="tel" inputmode="tel" placeholder="DDD + número" value="'+E(cur)+'"><button type="button" class="btn btn-primary" style="text-decoration:none;color:var(--n-accent-ink)">Salvar</button></div>';
      var inp=d.querySelector('input'); inp.focus();
      d.querySelector('button').onclick=function(){
        var v=inp.value.replace(/\D/g,''); if(v&&(v.length===10||v.length===11)) v='55'+v;
        try{ localStorage.setItem('ds_meu_whats',v); }catch(e){}
        toast(v?'WhatsApp salvo. Vale para os próximos links.':'WhatsApp removido.','ok');
        d.remove(); wppField();
      };
    };
    box.appendChild(d);
  }

  function init(){
    var o2=window.renderClientes; if(typeof o2==='function'){ window.renderClientes=function(){ var r=o2.apply(this,arguments); cardBtns(); return r; }; }
    [['clients-grid',cardBtns],['dm-apr',wppField]].forEach(function(p){
      var t=$(p[0]); if(t) new MutationObserver(function(){ p[1](); }).observe(t,{childList:true,subtree:true});
    });
    cardBtns(); wppField();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(init,0); }); else setTimeout(init,0);
})();

/* v69/V110 — preferências sincronizadas entre aparelhos (prioridade, cronômetro, avulsos, PIX, horas por cliente e fim de recorrências) */
(function(){
  if(/aprovar=/.test(location.hash)) return;
  var KEYS=['ds_meu_whats','ds_modelos_leg','ds_rail','ds_stopwatch_v99','ds_v100_priorities','ds_pix_cfg_v109','ds_extras_fin_v109','ds_time_logs_v109','ds_desp_end_v110'], TS='ds_cfg_ts_', ok=true, warned=false, ready=false, uid=null, timers={};
  var PER_USER=['ds_v100_priorities','ds_extras_fin_v109','ds_time_logs_v109','ds_desp_end_v110'];
  var rawSet=Storage.prototype.setItem, rawGet=Storage.prototype.getItem, rawRem=Storage.prototype.removeItem;
  function isPerUser(k){ return PER_USER.indexOf(k)>=0; }
  /* nome da chave local de cada preferência (dicionários por usuário usam sufixo _uid) */
  function lname(k){ return isPerUser(k) ? k+'_'+(uid||'local') : k; }
  /* nome da chave na nuvem a partir de uma gravação local */
  function cname(k){
    if(KEYS.indexOf(k)>=0 && !isPerUser(k)) return k;
    if(uid){ for(var i=0;i<PER_USER.length;i++){ if(k===PER_USER[i]+'_'+uid) return PER_USER[i]; } }
    return null;
  }
  function missing(e){ return !!e && /does not exist|schema cache|PGRST205|42P01|relation/i.test(String(e.message||'')+' '+String(e.code||'')); }
  function warn(){ if(warned) return; warned=true; try{ toast('Preferências ficaram só neste aparelho (falta rodar o SQL v69 no Supabase).','err'); }catch(e){} }
  function db(){ return (typeof sb!=='undefined'&&sb)?sb:null; }
  function parse(v){ try{ var o=JSON.parse(v||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
  function notify(k){ try{ window.dispatchEvent(new CustomEvent('ds-cfg-pulled',{detail:{key:k}})); }catch(e){} }

  function push(k){
    if(!ok||!ready||!uid||!db()) return;
    clearTimeout(timers[k]);
    timers[k]=setTimeout(function(){
      var v=rawGet.call(localStorage,lname(k)), ts=new Date(parseInt(rawGet.call(localStorage,TS+k)||Date.now(),10)).toISOString();
      db().from('configuracoes').upsert({user_id:uid,chave:k,valor:v,atualizado_em:ts},{onConflict:'user_id,chave'}).then(function(r){
        if(r&&r.error){ if(missing(r.error)){ ok=false; warn(); } }
      },function(){});
    },600);
  }
  /* toda gravação local de uma chave monitorada vai para a nuvem */
  Storage.prototype.setItem=function(k,v){
    var r=rawSet.apply(this,arguments);
    var c=(this===localStorage)?cname(k):null;
    if(c){ rawSet.call(localStorage,TS+c,String(Date.now())); push(c); }
    return r;
  };
  Storage.prototype.removeItem=function(k){
    var r=rawRem.apply(this,arguments);
    var c=(this===localStorage)?cname(k):null;
    if(c){ rawSet.call(localStorage,TS+c,String(Date.now())); push(c); }
    return r;
  };

  function applyRail(){
    var v=rawGet.call(localStorage,'ds_rail'), h=document.documentElement;
    if(v==='open') h.setAttribute('data-rail','open'); else h.removeAttribute('data-rail');
    var b=document.getElementById('rail-toggle'); if(b){ var o=v==='open'; var i=b.querySelector('i'), t=b.querySelector('.btn-txt'); if(i) i.className='ti '+(o?'ti-layout-sidebar-left-collapse':'ti-layout-sidebar-left-expand'); if(t) t.textContent=o?'Recolher menu':'Mostrar nomes'; }
  }
  function pull(){
    if(!ok||!uid||!db()) return Promise.resolve();
    return db().from('configuracoes').select('*').eq('user_id',uid).then(function(r){
      if(r.error){ if(missing(r.error)){ ok=false; warn(); } return; }
      var rows={}; (r.data||[]).forEach(function(x){ rows[x.chave]=x; });
      KEYS.forEach(function(k){
        var ln=lname(k), row=rows[k], localV=rawGet.call(localStorage,ln), localTs=parseInt(rawGet.call(localStorage,TS+k)||'0',10);
        if(row){
          var cloudTs=new Date(row.atualizado_em).getTime();
          if(isPerUser(k)){
            /* dicionários por usuário (prioridades, avulsos, tempo por cliente): mescla preservando o lado mais recente */
            var cl=parse(row.valor), lo=parse(localV);
            var merged=cloudTs>=localTs?Object.assign({},lo,cl):Object.assign({},cl,lo);
            var mv=JSON.stringify(merged);
            if(mv!==localV){ rawSet.call(localStorage,ln,mv); notify(k); }
            if(mv!==row.valor){ rawSet.call(localStorage,TS+k,String(Date.now())); push(k); }
            else rawSet.call(localStorage,TS+k,String(cloudTs));
            return;
          }
          if(cloudTs>=localTs || localV==null){
            var changed=false;
            if(row.valor==null){ if(localV!=null){ rawRem.call(localStorage,ln); changed=true; } }
            else if(localV!==row.valor){ rawSet.call(localStorage,ln,String(row.valor)); changed=true; }
            rawSet.call(localStorage,TS+k,String(cloudTs));
            if(k==='ds_rail') applyRail();
            if(changed) notify(k);
          } else { push(k); }
        } else if(localV!=null){ if(!localTs) rawSet.call(localStorage,TS+k,String(Date.now())); push(k); }
      });
    },function(){});
  }
  function start(){
    var s=db(); if(!s||!s.auth) return false;
    (typeof authUser==='function'?authUser():s.auth.getUser()).then(function(r){
      var u=r&&r.data&&r.data.user; if(!u) return;
      if(uid===u.id) return; uid=u.id; ready=true;
      pull();
      setInterval(pull,30000);
      document.addEventListener('visibilitychange',function(){ if(!document.hidden) pull(); });
      window.addEventListener('focus',pull);
    },function(){});
    return true;
  }
  setTimeout(start,300);
  var n=0, t=setInterval(function(){ n++; if(uid||n>90){ clearInterval(t); return; } start(); },2000);
})();

/* v68 — Pacote C: produtividade, desfazer, atalhos, modelos, avisos agrupados, offline */
(function(){
  if(/aprovar=/.test(location.hash)) return;
  var $=function(i){return document.getElementById(i)};
  function E(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function nz(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function api(){ return window.v61Api||null; }
  function lsGet(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?d:v; }catch(e){ return d; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  function two(n){ return String(n).padStart(2,'0'); }
  function ds(d){ return d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate()); }
  var DIAS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  /* 11 · aviso com "Desfazer" */
  window.toastUndo=function(msg,fn,ms){
    var wrap=$('toast-wrap'); if(!wrap) return;
    var d=document.createElement('div'); d.className='toast tok';
    d.innerHTML='<i class="ti ti-circle-check"></i><span>'+E(msg)+'</span><button type="button" class="v68-undo">Desfazer</button>';
    wrap.appendChild(d);
    var t=setTimeout(go,ms||7000);
    function go(){ d.style.transition='opacity .3s'; d.style.opacity='0'; setTimeout(function(){ d.remove(); },320); }
    d.querySelector('button').onclick=function(){ clearTimeout(t); go(); try{ fn(); }catch(e){} };
  };
  window.v68MoveUndo=function(id,to){
    var A=api(); if(!A) return;
    var d=A.get().find(function(x){ return String(x.id)===String(id); }); if(!d||d.status===to) return;
    var prev=d.status, nm=(A.cols.find(function(c){ return c.id===to; })||{}).nome||'';
    A.setStatus(id,to).then(function(){ toastUndo('Movida para "'+nm+'".',function(){ A.setStatus(id,prev); }); });
  };

  /* 7 + 8 · clientes: contadores, pendências e resumo no cartão */
  var pend=null;
  function cid(card){ var w=card.querySelector('.btn-wpp-sm'); var m=w&&/wppCliente\('([^']+)'/.exec(w.getAttribute('onclick')||''); return m?m[1]:null; }
  function cl(id){ try{ return clientes.find(function(x){ return String(x.id)===String(id); }); }catch(e){ return null; } }
  function weekStart(){ var t=new Date(); var i=(t.getDay()+6)%7; t.setDate(t.getDate()-i); return ds(t); }
  function entSemana(id){ var ws=weekStart(), seen={}; try{ entregas.forEach(function(e){ if(String(e.clienteId)===String(id)&&String(e.dataEntrega).slice(0,10)>=ws){ seen[String(e.dataEntrega).slice(0,10)]=1; } }); }catch(x){} return Object.keys(seen).length; }
  function mesKey(){ var t=new Date(); return t.getFullYear()+'-'+two(t.getMonth()+1); }
  function pagoMes(id){ try{ return !!getPagamento(id,mesKey()); }catch(e){ return false; } }
  function atrasado(c){ return c.status==='ativo' && c.diaCobranca>0 && !pagoMes(c.id) && c.diaCobranca<new Date().getDate(); }
  function semBriefing(c){ var A=api(); if(!A) return false; var b=A.brief(c.id); return !(b&&(b.tom||b.evitar||b.hashtags||b.objetivo)); }
  function semEntrega(c){ return c.status==='ativo' && (parseInt(c.qtdMidias)||0)>0 && entSemana(c.id)===0; }
  var PEND={
    cob:{lbl:'Cobrança em aberto',ic:'cash',fn:atrasado},
    brief:{lbl:'Sem briefing',ic:'notes',fn:function(c){ return c.status==='ativo'&&semBriefing(c); }},
    ent:{lbl:'Sem entrega na semana',ic:'calendar-off',fn:semEntrega}
  };
  function proxima(c){
    var days=(c.dias||[]).slice().sort(); if(!days.length) return '';
    var t=new Date(), i0=(t.getDay()+6)%7;
    for(var k=0;k<7;k++){ var idx=(i0+k)%7; if(days.indexOf(idx)>=0){ var d=new Date(t); d.setDate(t.getDate()+k); return (k===0?'Hoje':k===1?'Amanhã':DIAS[idx]+' '+two(d.getDate())+'/'+two(d.getMonth()+1)); } }
    return '';
  }
  function health(card,c){
    if(card.querySelector('.v68-h')||c.status!=='ativo') return;
    var h='', q=parseInt(c.qtdMidias)||0;
    if(q>0){ var n=entSemana(c.id); h+='<span class="v68-st '+(n>=q?'ok':'')+'"><i class="ti ti-'+(n>=q?'circle-check':'photo')+'"></i>'+n+'/'+q+' artes na semana</span>'; }
    var p=proxima(c); if(p) h+='<span class="v68-st"><i class="ti ti-calendar-event"></i>Próxima: '+E(p)+'</span>';
    if(c.diaCobranca>0 && c.valorMensal){
      if(pagoMes(c.id)) h+='<span class="v68-st ok"><i class="ti ti-circle-check"></i>Pago</span>';
      else if(atrasado(c)) h+='<span class="v68-st late"><i class="ti ti-alert-triangle"></i>Atrasado</span>';
      else h+='<span class="v68-st"><i class="ti ti-clock"></i>Vence dia '+c.diaCobranca+'</span>';
    }
    if(!h) return;
    var row=document.createElement('div'); row.className='v68-h'; row.innerHTML=h;
    var body=card.querySelector('.card-body'); if(body) body.appendChild(row);
  }
  function clientesPost(){
    var grid=$('clients-grid'); if(!grid||typeof clientes==='undefined') return;
    /* contadores nos filtros */
    [].forEach.call(document.querySelectorAll('.cfilter-btn'),function(b){
      var m=/setCF\('([^']+)'/.exec(b.getAttribute('onclick')||''); if(!m) return;
      var k=m[1], base=b.getAttribute('data-l')||b.textContent.replace(/\s*\d+$/,'').trim(); b.setAttribute('data-l',base);
      var n=k==='todos'?clientes.length:clientes.filter(function(c){ return c.status===k; }).length;
      b.innerHTML=E(base)+' <span class="v68-n">'+n+'</span>';
    });
    /* linha de pendências */
    var bar=document.querySelector('.client-filter-bar');
    if(bar&&!$('v68-pend')){ var r=document.createElement('div'); r.id='v68-pend'; r.className='v68-pend'; bar.parentNode.insertBefore(r,bar.nextSibling); }
    var row=$('v68-pend');
    if(row){
      var ativos=clientes.filter(function(c){ return c.status==='ativo'; });
      row.innerHTML='<span class="v68-pl">Pendências:</span>'+Object.keys(PEND).map(function(k){
        var n=ativos.filter(PEND[k].fn).length;
        return '<button type="button" class="v68-chip'+(pend===k?' on':'')+'" data-k="'+k+'"><i class="ti ti-'+PEND[k].ic+'"></i>'+PEND[k].lbl+' <b>'+n+'</b></button>';
      }).join('')+(pend?'<button type="button" class="v68-chip v68-x" data-k="">Limpar</button>':'');
      [].forEach.call(row.querySelectorAll('button'),function(b){ b.onclick=function(){ var k=b.getAttribute('data-k'); pend=(k&&pend!==k)?k:null; clientesPost(); }; });
    }
    /* resumo + filtro por pendência */
    var shown=0, cards=grid.querySelectorAll('.client-card');
    [].forEach.call(cards,function(card){
      var id=cid(card), c=id&&cl(id); if(!c) return;
      health(card,c);
      var ok=!pend||(PEND[pend].fn(c));
      card.style.display=ok?'':'none'; if(ok) shown++;
    });
    var em=$('v68-pend-empty');
    if(pend&&cards.length&&!shown){ if(!em){ em=document.createElement('div'); em.id='v68-pend-empty'; em.className='v68-pend-empty'; grid.parentNode.insertBefore(em,grid.nextSibling); } em.textContent='Nenhum cliente nessa condição. Tudo certo por aqui.'; em.style.display=''; }
    else if(em) em.style.display='none';
  }

  /* 9 · produção: some a barra vazia */
  function prod(){
    var t=$('pc-stat-total'), box=document.querySelector('.pc-week-progress'); if(!t||!box) return;
    box.classList.toggle('v68-hide',(t.textContent||'').trim()==='0');
  }

  /* 12 · busca global (demandas + ações rápidas) */
  window.v68Extra=function(nq,out){
    var A=api();
    var acts=[
      {t:'Nova demanda',ic:'ti-layout-kanban',run:function(){ switchTab('demandas'); setTimeout(function(){ v61OpenDem(); },200); }},
      {t:'Novo cliente',ic:'ti-user-plus',run:function(){ switchTab('clientes'); openModal(); }},
      {t:'Nova tarefa',ic:'ti-checkbox',run:function(){ switchTab('hoje'); setTimeout(function(){ var i=$('tarefa-input'); if(i) i.focus(); },250); }},
      {t:'Nova despesa',ic:'ti-receipt',run:function(){ switchTab('cobranca'); setTimeout(function(){ if(window.v62OpenDesp) v62OpenDesp(); },250); }}
    ];
    acts.slice().reverse().forEach(function(a){ if(!nq||nz(a.t).indexOf(nq)>=0) out.unshift({icon:a.ic,label:a.t,sub:'Criar',run:a.run}); });
    if(A&&nq){
      var nm={briefing:'Briefing',producao:'Em produção',aprovacao:'Aprovação',pronto:'Pronto'};
      A.get().filter(function(d){ var c=A.cli(d.clienteId); return nz(d.titulo).indexOf(nq)>=0||(c&&nz(c.empresa).indexOf(nq)>=0); }).slice(0,12).forEach(function(d){
        var c=A.cli(d.clienteId);
        out.push({icon:'ti-layout-kanban',label:d.titulo,sub:'Demanda · '+(nm[d.status]||'')+(c?' · '+c.empresa:''),run:function(){ switchTab('demandas'); setTimeout(function(){ A.open(d.id); },350); }});
      });
    }
  };

  /* 25 · botão "+" */
  function fab(){
    if($('v68-fab')) return;
    var w=document.createElement('div'); w.id='v68-fab';
    w.innerHTML='<div class="v68-fm" id="v68-fm"><button type="button" data-a="dem"><i class="ti ti-layout-kanban"></i>Nova demanda</button><button type="button" data-a="cli"><i class="ti ti-user-plus"></i>Novo cliente</button><button type="button" data-a="tar"><i class="ti ti-checkbox"></i>Nova tarefa</button><button type="button" data-a="desp"><i class="ti ti-receipt"></i>Nova despesa</button></div><button type="button" class="v68-fb" id="v68-fb" aria-label="Criar novo" aria-expanded="false"><i class="ti ti-plus"></i></button>';
    document.body.appendChild(w);
    var fb=$('v68-fb');
    function close(){ w.classList.remove('open'); fb.setAttribute('aria-expanded','false'); }
    fb.onclick=function(e){ e.stopPropagation(); var o=w.classList.toggle('open'); fb.setAttribute('aria-expanded',o?'true':'false'); };
    document.addEventListener('click',function(e){ if(!w.contains(e.target)) close(); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
    w.querySelector('#v68-fm').onclick=function(e){
      var b=e.target.closest('button'); if(!b) return; close();
      var a=b.getAttribute('data-a');
      if(a==='dem'){ switchTab('demandas'); setTimeout(function(){ v61OpenDem(); },200); }
      else if(a==='cli'){ switchTab('clientes'); openModal(); }
      else if(a==='tar'){ switchTab('hoje'); setTimeout(function(){ var i=$('tarefa-input'); if(i) i.focus(); },250); }
      else if(a==='desp'){ switchTab('cobranca'); setTimeout(function(){ if(window.v62OpenDesp) v62OpenDesp(); },250); }
    };
  }

  /* 26 · duplicar demanda */
  function dup(){
    var bg=$('dm-bg'), foot=bg&&bg.querySelector('.v61-foot .l'); if(!foot||$('dm-dup')) return;
    var b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='dm-dup'; b.style.display='none';
    b.innerHTML='<i class="ti ti-copy"></i> Duplicar';
    b.onclick=function(){
      var A=api(); if(!A) return;
      var d={id:null,titulo:($('dm-t').value.trim()||'Demanda')+' (cópia)',clienteId:$('dm-c').value,status:'briefing',entrega:'',formato:$('dm-f').value,legenda:$('dm-l').value};
      A.save(d).then(function(r){ A.add(r||d); A.render(); v61CloseDem(); toast('Demanda duplicada.','ok'); },function(){ toast('Não consegui duplicar.','err'); });
    };
    foot.appendChild(b);
    new MutationObserver(function(){ b.style.display=/Editar/.test(($('dm-title')||{}).textContent||'')?'':'none'; }).observe(bg,{attributes:true,attributeFilter:['class']});
  }

  /* 27 · modelos de legenda e de briefing */
  var LEG=[
    ['Promoção','🔥 {c} com condição especial!\n\n[Descreva a oferta]\n\n📍 [Endereço ou link]\n⏰ Válido até [data]\n\nChame no direct ou no WhatsApp e garanta o seu.'],
    ['Lançamento','✨ Chegou novidade na {c}!\n\n[O que é e por que vale a pena]\n\nSalve este post e compartilhe com quem precisa conhecer.'],
    ['Data comemorativa','{c} deseja um ótimo [data comemorativa]! 💛\n\n[Mensagem curta e sincera]'],
    ['Dica de conteúdo','💡 Dica rápida:\n\n[Dica em uma ou duas frases]\n\nSalve para consultar depois e envie para quem vai gostar.'],
    ['Depoimento','⭐ Quem usa, recomenda!\n\n“[Depoimento do cliente]”\n— [Nome]\n\nObrigado pela confiança. Foi um prazer atender você!']
  ];
  function legMenu(){
    var cap=document.querySelector('#dm-bg .dm-capbar span:last-child'); if(!cap||$('dm-mod')) return;
    var b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='dm-mod'; b.innerHTML='<i class="ti ti-template"></i> Modelos';
    var pop=document.createElement('div'); pop.className='v68-pop'; pop.id='dm-mod-pop'; cap.style.position='relative'; cap.insertBefore(b,cap.firstChild); cap.appendChild(pop);
    function draw(){
      var mine=lsGet('ds_modelos_leg',[]);
      pop.innerHTML=LEG.concat(mine).map(function(m,i){ return '<button type="button" data-i="'+i+'">'+E(m[0])+'</button>'; }).join('')
        +'<div class="v68-sv"><input class="finput" id="dm-mod-n" placeholder="Nome para salvar a legenda atual"><button type="button" id="dm-mod-s">Salvar como modelo</button></div>';
      [].forEach.call(pop.querySelectorAll('[data-i]'),function(x){ x.onclick=function(){
        var m=LEG.concat(lsGet('ds_modelos_leg',[]))[+x.getAttribute('data-i')]; var sel=$('dm-c'); var nm=sel&&sel.selectedIndex>0?sel.options[sel.selectedIndex].text:'nossa loja';
        var t=m[1].replace(/\{c\}/g,nm), ta=$('dm-l'); ta.value=ta.value.trim()?ta.value.replace(/\s+$/,'')+'\n\n'+t:t; if(window.v61CapInfo) v61CapInfo(); pop.classList.remove('open'); ta.focus();
      }; });
      $('dm-mod-s').onclick=function(){ var n=($('dm-mod-n').value||'').trim(), t=$('dm-l').value.trim(); if(!n||!t){ toast('Dê um nome e escreva a legenda antes de salvar.','err'); return; } var a=lsGet('ds_modelos_leg',[]); a.push([n,t]); lsSet('ds_modelos_leg',a); toast('Modelo salvo.','ok'); draw(); };
    }
    b.onclick=function(e){ e.stopPropagation(); draw(); pop.classList.toggle('open'); };
    document.addEventListener('click',function(e){ if(!pop.contains(e.target)&&e.target!==b) pop.classList.remove('open'); });
  }
  var BR={
    'Restaurante / Lanchonete':{objetivo:'Aumentar pedidos e movimento nos horários de pico.',publico:'Moradores e trabalhadores da região, famílias, jovens.',tom:'Gostoso, próximo e descontraído.',evitar:'Textos longos, linguagem técnica, imagens escuras.',hashtags:'#delivery #comidaboa #hamburguer #promocao'},
    'Loja / Varejo':{objetivo:'Divulgar ofertas e novidades e levar o cliente à loja.',publico:'Clientes da cidade e região, de todas as idades.',tom:'Direto, animado e confiável.',evitar:'Promessas sem prazo, excesso de emojis.',hashtags:'#oferta #novidade #loja #promocao'},
    'Clínica / Saúde':{objetivo:'Passar confiança e educar o paciente.',publico:'Pacientes e familiares da região.',tom:'Acolhedor, claro e profissional.',evitar:'Promessas de resultado, antes e depois sem autorização, termos técnicos.',hashtags:'#saude #cuidado #bemestar #prevencao'},
    'Academia / Esporte':{objetivo:'Atrair novos alunos e manter os atuais engajados.',publico:'Pessoas de 18 a 45 anos que buscam saúde e resultado.',tom:'Motivador, energético e direto.',evitar:'Padrão de corpo irreal, comparações.',hashtags:'#treino #academia #saude #foco'},
    'Serviços / Profissional':{objetivo:'Gerar contatos e reforçar autoridade.',publico:'Clientes locais que precisam do serviço.',tom:'Profissional, simples e confiável.',evitar:'Jargões, preço sem contexto.',hashtags:'#servicos #qualidade #atendimento'}
  };
  function brMenu(){
    var bg=$('br-bg'), hdr=bg&&bg.querySelector('.modal-hdr'); if(!hdr||$('br-mod')) return;
    var s=document.createElement('select'); s.className='finput'; s.id='br-mod'; s.style.marginBottom='12px';
    s.innerHTML='<option value="">Começar de um modelo (opcional)…</option>'+Object.keys(BR).map(function(k){ return '<option>'+E(k)+'</option>'; }).join('');
    s.onchange=function(){
      var m=BR[s.value]; if(!m) return;
      Object.keys(m).forEach(function(k){ var f=$('br-'+k); if(f&&!f.value.trim()) f.value=m[k]; });
      toast('Modelo aplicado só nos campos vazios.','ok'); s.value='';
    };
    hdr.parentNode.insertBefore(s,hdr.nextSibling);
  }

  /* 28 · avisos agrupados */
  var GR=[['Respostas dos clientes',/Cliente aprovou|Cliente pediu/],['Entregas',/Entrega (atrasada|hoje)/],['Aguardando clientes',/ainda não respondeu/],['Financeiro',/Cobranças/]];
  function group(){
    var p=$('bell-pop'); if(!p||p.getAttribute('data-g')==='1') return;
    var items=[].slice.call(p.querySelectorAll('.bell-i')); if(!items.length) return;
    p.setAttribute('data-g','1');
    var h=p.querySelector('.bell-h'); var frag=document.createDocumentFragment();
    GR.forEach(function(g){
      var its=items.filter(function(i){ var t=(i.querySelector('.bell-t')||{}).textContent||''; return g[1].test(t); });
      if(!its.length) return;
      var hd=document.createElement('div'); hd.className='bell-g'; hd.innerHTML=E(g[0])+' <b>'+its.length+'</b>'; frag.appendChild(hd);
      its.forEach(function(i){ frag.appendChild(i); });
    });
    items.forEach(function(i){ if(!i.parentNode||i.parentNode===p){ if(![].some.call(frag.childNodes,function(n){ return n===i; })) frag.appendChild(i); } });
    p.innerHTML=''; if(h) p.appendChild(h); p.appendChild(frag);
  }
  function bellWatch(){
    var p=$('bell-pop'); if(!p) return;
    new MutationObserver(function(){ if(p.getAttribute('data-g')!=='1') group(); }).observe(p,{childList:true});
    var _ = new MutationObserver(function(){ if(!p.classList.contains('open')) p.removeAttribute('data-g'); }); _.observe(p,{attributes:true,attributeFilter:['class']});
  }

  /* 30 · Esc fecha o modal aberto */
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape') return;
    var m=document.querySelector('.modal-bg.open'); if(!m) return;
    var x=m.querySelector('.modal-x'); if(x) x.click();
  });

  /* 33 · sem internet */
  function net(){
    var b=$('v68-off'); if(!b){ b=document.createElement('div'); b.id='v68-off'; b.setAttribute('role','status'); b.innerHTML='<i class="ti ti-wifi-off"></i><span>Sem internet. O que você alterar agora pode não ser salvo.</span>'; document.body.appendChild(b); }
    function up(){ b.classList.toggle('on',!navigator.onLine); }
    window.addEventListener('offline',up); window.addEventListener('online',function(){ up(); try{ toast('Conexão restabelecida.','ok'); }catch(e){} });
    up();
  }

  /* 24 · ponto verde com explicação */
  function sync(){
    var d=$('sync-dot'), l=d&&d.querySelector('.sync-lbl'); if(!d||!l) return;
    function up(){ var t=(l.textContent||'').trim(); d.setAttribute('data-tip',t==='Sincronizado'?'Tudo salvo na nuvem':t); d.setAttribute('aria-label',t); d.setAttribute('role','status'); }
    new MutationObserver(up).observe(l,{childList:true,characterData:true,subtree:true}); up();
  }

  function init(){
    var o=window.renderClientes; if(typeof o==='function') window.renderClientes=function(){ var r=o.apply(this,arguments); clientesPost(); return r; };
    var g=$('clients-grid'); if(g) new MutationObserver(function(){ clientesPost(); }).observe(g,{childList:true});
    var t=$('pc-stat-total'); if(t) new MutationObserver(prod).observe(t,{childList:true,characterData:true,subtree:true});
    fab(); dup(); legMenu(); brMenu(); bellWatch(); net(); sync(); clientesPost(); prod();
    setTimeout(function(){ clientesPost(); prod(); },900);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(init,0); }); else setTimeout(init,0);
})();

(function(){
  var img=document.getElementById('brand-logo-img'); if(!img) return;
  try{ if(localStorage.getItem('ds_brand_logo_url')) return; }catch(e){}
  var s='icons/logo.png?v=105'; if(img.getAttribute('src')!==s) img.setAttribute('src',s);
})();

/* v72 — edição em massa das demandas + padrão único de status */
(function(){
  if(/aprovar=/.test(location.hash)) return;
  var $=function(i){return document.getElementById(i)};
  function A(){ return window.v61Api||null; }
  var mode=false, sel={};
  function ids(){ return Object.keys(sel).filter(function(k){ return sel[k]; }); }

  /* ───── 26 · seleção em massa ───── */
  function sync(){
    var kb=$('kb'); if(!kb) return;
    [].forEach.call(kb.querySelectorAll('.kb-card'),function(c){
      var id=c.getAttribute('data-id'); c.classList.toggle('v72-on',!!sel[id]);
      var ck=c.querySelector('.v72-ck'); if(mode&&!ck){ ck=document.createElement('span'); ck.className='v72-ck'; ck.innerHTML='<i class="ti ti-check"></i>'; c.insertBefore(ck,c.firstChild); }
      if(!mode&&ck) ck.remove();
    });
    var n=ids().length, bar=$('v72-bar');
    if(bar){ bar.classList.toggle('on',mode); $('v72-n').textContent=n+(n===1?' selecionada':' selecionadas'); [].forEach.call(bar.querySelectorAll('[data-need]'),function(b){ b.disabled=!n; }); }
    var btn=$('v72-selbtn'); if(btn){ btn.classList.toggle('on',mode); btn.querySelector('span').textContent=mode?'Sair da seleção':'Selecionar'; }
    var sec=$('sec-demandas'); if(sec) sec.classList.toggle('v72-selmode',mode);
  }
  function setMode(v){ mode=!!v; if(!mode) sel={}; sync(); }
  function build(){
    var bar=document.querySelector('#sec-demandas .kb-bar'); if(!bar||$('v72-selbtn')) return;
    var b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='v72-selbtn'; b.innerHTML='<i class="ti ti-checks"></i><span>Selecionar</span>';
    b.onclick=function(){ setMode(!mode); }; bar.appendChild(b);
    var cols=(A()&&A().cols)||[];
    var d=document.createElement('div'); d.id='v72-bar'; d.setAttribute('role','toolbar');
    d.innerHTML='<strong id="v72-n">0 selecionadas</strong><select class="finput" id="v72-to" aria-label="Mover para"><option value="">Mover para…</option>'+cols.map(function(c){ return '<option value="'+c.id+'">'+c.nome+'</option>'; }).join('')+'</select>'
      +'<button type="button" class="btn btn-primary" data-need="1" id="v72-mv">Mover</button><button type="button" class="btn v72-del" data-need="1" id="v72-rm"><i class="ti ti-trash"></i> Excluir</button><button type="button" class="btn" id="v72-cx">Cancelar</button>';
    document.body.appendChild(d);
    $('v72-cx').onclick=function(){ setMode(false); };
    $('v72-mv').onclick=async function(){
      var to=$('v72-to').value, a=A(); if(!to){ toast('Escolha a etapa de destino.','err'); return; }
      var list=ids().map(function(id){ return a.get().find(function(x){ return String(x.id)===String(id); }); }).filter(function(x){ return x&&x.status!==to; });
      if(!list.length){ setMode(false); return; }
      var prev=list.map(function(x){ return [x.id,x.status]; });
      for(var i=0;i<list.length;i++){ await a.setStatus(list[i].id,to); }
      setMode(false);
      toastUndo(list.length+(list.length===1?' demanda movida.':' demandas movidas.'),async function(){ for(var i=0;i<prev.length;i++){ await a.setStatus(prev[i][0],prev[i][1]); } });
    };
    $('v72-rm').onclick=async function(){
      var a=A(), gone=ids().map(function(id){ return a.get().find(function(x){ return String(x.id)===String(id); }); }).filter(Boolean);
      if(!gone.length) return;
      for(var i=0;i<gone.length;i++){ try{ await a.remove(gone[i].id); }catch(e){} }
      a.render(); setMode(false);
      toastUndo(gone.length+(gone.length===1?' demanda excluída.':' demandas excluídas.'),async function(){
        for(var i=0;i<gone.length;i++){ var c=Object.assign({},gone[i],{id:null}); try{ var r=await a.save(c); a.add(r||c); }catch(e){} }
        a.render(); toast('Demandas restauradas.','ok');
      },9000);
    };
  }
  document.addEventListener('click',function(e){
    if(!mode) return;
    var kb=$('kb'); if(!kb||!kb.contains(e.target)) return;
    var card=e.target.closest('.kb-card'), hd=e.target.closest('.kb-hd');
    if(card){ e.preventDefault(); e.stopPropagation(); var id=card.getAttribute('data-id'); sel[id]=!sel[id]; sync(); }
    else if(hd){ e.preventDefault(); e.stopPropagation(); var col=hd.parentNode, cs=col.querySelectorAll('.kb-card'), all=[].every.call(cs,function(c){ return sel[c.getAttribute('data-id')]; });
      [].forEach.call(cs,function(c){ sel[c.getAttribute('data-id')]=!all; }); sync(); }
  },true);
  document.addEventListener('dragstart',function(e){ if(mode) e.preventDefault(); },true);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&mode&&!document.querySelector('.modal-bg.open')) setMode(false); });

  /* ───── 10 · padrão único de status (ícone + texto + cor) ───── */
  var ST={
    ativo:['ok','circle-check'],pausado:['idle','player-pause'],encerrado:['idle','circle-off']
  };
  function chip(v,ic,txt){ return '<span class="v72-st '+v+'" data-v72="1"><i class="ti ti-'+ic+'"></i>'+txt+'</span>'; }
  function decorate(){
    [].forEach.call(document.querySelectorAll('.status-badge:not([data-v72])'),function(b){
      var m=/s-(ativo|pausado|encerrado)/.exec(b.className); if(!m) return; var s=ST[m[1]];
      b.setAttribute('data-v72','1'); b.classList.add('v72-st',s[0]); b.insertAdjacentHTML('afterbegin','<i class="ti ti-'+s[1]+'"></i>');
    });
    [].forEach.call(document.querySelectorAll('.task-done-label:not([data-v72])'),function(b){
      b.setAttribute('data-v72','1'); b.classList.add('v72-st','ok'); b.insertAdjacentHTML('afterbegin','<i class="ti ti-circle-check"></i>');
    });
    [].forEach.call(document.querySelectorAll('.cb-row .cb-meta'),function(meta){
      if(meta.getAttribute('data-v72')) return;
      var row=meta.closest('.cb-row'), st=row.classList.contains('atrasado')?'atrasado':row.classList.contains('hoje')?'hoje':row.classList.contains('avencer')?'avencer':row.classList.contains('pago')?'pago':'';
      if(!st) return;
      var sp=meta.querySelector('span'); if(!sp) return;
      var n=(sp.textContent.match(/\d+/)||[''])[0];
      var h=st==='atrasado'?chip('late','alert-triangle','Venceu dia '+n):st==='hoje'?chip('today','calendar-due','Vence hoje'):st==='avencer'?chip('idle','clock','Vence dia '+n):chip('ok','circle-check','Pago');
      sp.outerHTML=h; meta.setAttribute('data-v72','1');
    });
  }
  var raf=0;
  function schedule(){ if(raf) return; raf=requestAnimationFrame(function(){ raf=0; try{ decorate(); if($('kb')) sync(); }catch(e){} }); }

  function init(){
    build(); decorate();
    var a=A();
    if(a && typeof a.render==='function' && !a._v72Hooked){
      a._v72Hooked=true;
      var origKbRender=a.render;
      a.render=function(){
        var r=origKbRender.apply(this,arguments);
        build(); schedule();
        if(typeof window.dsSchedulePostRender==='function') window.dsSchedulePostRender();
        return r;
      };
    }
    if(window._dsPostRenderFns) window._dsPostRenderFns.push(function(){ build(); decorate(); if($('kb')) sync(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(init,0); }); else setTimeout(init,0);
})();

/* v73 — alternância cartões/lista em Clientes (sem MutationObserver em document.body) */
(function(){
  if(/aprovar=/.test(location.hash)) return;
  var K='ds_cli_view';
  function get(){ try{ return localStorage.getItem(K)==='lista'?'lista':'cards'; }catch(e){ return 'cards'; } }
  function apply(v){
    var g=document.getElementById('clients-grid'); if(g) g.classList.toggle('v73-list',v==='lista');
    var w=document.getElementById('v73-vw'); if(w) [].forEach.call(w.querySelectorAll('button'),function(b){ var on=b.getAttribute('data-v')===v; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); });
  }
  function init(){
    var bar=document.querySelector('.client-filter-bar'); if(!bar||document.getElementById('v73-vw')) return;
    var w=document.createElement('div'); w.id='v73-vw'; w.className='v73-vw'; w.setAttribute('role','group'); w.setAttribute('aria-label','Modo de exibição');
    w.innerHTML='<button type="button" data-v="cards" aria-label="Cartões" title="Cartões"><i class="ti ti-layout-grid"></i></button><button type="button" data-v="lista" aria-label="Lista" title="Lista"><i class="ti ti-list"></i></button>';
    w.onclick=function(e){ var b=e.target.closest('button'); if(!b) return; var v=b.getAttribute('data-v'); try{ localStorage.setItem(K,v); }catch(x){} apply(v); };
    bar.appendChild(w); apply(get());
  }
  function syncView(){
    init();
    var g=document.getElementById('clients-grid');
    if(g&&g.classList.contains('v73-list')!==(get()==='lista')) apply(get());
  }
  function boot(){
    syncView();
    if(window._dsPostRenderFns) window._dsPostRenderFns.push(syncView);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ setTimeout(boot,0); }); else setTimeout(boot,0);
})();

(function(){
  'use strict';
  if (!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  var selectors=[
    '.dash-card','.kpi','.pc-card','.cb-card','.client-card','.stat-pill',
    '.client-filter-bar','.hoje-sz-card','.hoje-notes-card',
    '.sz-month-events','.sz-today-banner','.sz-upcoming-card','.tp-empty',
    '.tp-stats-bar','.cal-month-progress','.cal-grid-outer','.pc-week-progress',
    '.pc-empty-state','.dash-client-table','#notif-bar','.daymod-task',
    '.task-item','.tarefa-row','.tp-row','.sz-upcoming-item','.sz-today-item',
    '.hoje-sz-item','.lembrete-item','.chart-card','.fn-card','.kb-card',
    '.card','.dashboard-card','.info-card'
  ].join(',');
  var glow=null, active=null, lastX=0, lastY=0;
  function ensure(){
    if(glow) return;
    glow=document.createElement('div');
    glow.id='ds-silver-follow-border';
    glow.setAttribute('aria-hidden','true');
    glow.style.cssText='position:fixed;pointer-events:none;opacity:0;display:block;';
    document.body.appendChild(glow);
  }
  function stop(){
    if (active) active.classList.remove('ds-silver-border-target');
    active=null;
    if (glow) glow.style.opacity='0';
  }
  function hit(t){return t instanceof Element?t.closest(selectors):null;}
  function render(){
    if(!active || !active.isConnected || !glow) {stop();return;}
    var r=active.getBoundingClientRect();
    if (!r.width||!r.height) {stop();return;}
    var st=getComputedStyle(active);
    glow.style.left=r.left+'px';
    glow.style.top=r.top+'px';
    glow.style.width=r.width+'px';
    glow.style.height=r.height+'px';
    glow.style.setProperty('--ds-radius',st.borderRadius);
    glow.style.setProperty('--ds-x',Math.max(0,Math.min(100,(lastX-r.left)/r.width*100))+'%');
    glow.style.setProperty('--ds-y',Math.max(0,Math.min(100,(lastY-r.top)/r.height*100))+'%');
    glow.style.opacity='1';
  }
  function onmove(e){
    if(e.pointerType!=='mouse') return;
    var card=hit(e.target);
    if(card!==active){
      if(active) active.classList.remove('ds-silver-border-target');
      active=card;
      if(active){ensure();active.classList.add('ds-silver-border-target');}
    }
    lastX=e.clientX;lastY=e.clientY;
    if(card) render();else if(glow) glow.style.opacity='0';
  }
  document.addEventListener('pointermove',onmove,{passive:true});
  document.addEventListener('pointerover',onmove,{passive:true});
  document.addEventListener('pointerout',function(e){
    if(e.pointerType!=='mouse') return;
    if(active && !(e.relatedTarget instanceof Node && active.contains(e.relatedTarget))) {
      var next=hit(e.relatedTarget);
      if(next!==active)stop();
    }
  },{passive:true});
  window.addEventListener('scroll',function(){if(active)render();},true);
  window.addEventListener('resize',function(){if(active)render();});
  window.addEventListener('blur',stop);
})();

(function(){
  function upcoming(){
    const host=document.getElementById('hoje-next-list');
    if(!host || typeof clientesNoDia!=='function' || typeof dateStr!=='function') return;
    const today=(typeof now==='function'?now():new Date());
    let groups=[];
    for(let i=1;i<=14;i++){
      const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+i);
      const iso=dateStr(d.getFullYear(),d.getMonth()+1,d.getDate());
      const found=clientesNoDia(iso)||[];
      if(found.length)groups.push({d,iso,found});
      if(groups.length>=4)break;
    }
    if(!groups.length){host.innerHTML='<div class="hoje-next-empty">Nenhuma entrega programada nos próximos 14 dias.</div>';return;}
    host.replaceChildren();
    for(const g of groups){
      const row=document.createElement('div'); row.className='hoje-next-row';row.tabIndex=0;row.setAttribute('role','button');
      row.setAttribute('aria-label','Abrir calendário para '+g.d.toLocaleDateString('pt-BR'));
      const day=document.createElement('div');day.className='hoje-next-day';day.textContent=String(g.d.getDate()).padStart(2,'0');
      const month=document.createElement('small');month.textContent=g.d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();day.appendChild(month);
      const info=document.createElement('div');info.className='hoje-next-info';
      const name=document.createElement('strong');name.textContent=g.found.slice(0,2).map(c=>c.empresa).join(' · ')+(g.found.length>2?' +'+(g.found.length-2):'');
      const detail=document.createElement('small'); detail.textContent=g.d.toLocaleDateString('pt-BR',{weekday:'long'})+' · '+g.found.length+' arte'+(g.found.length>1?'s':'');
      info.append(name,detail);
      const count=document.createElement('span');count.className='hoje-next-count'; count.textContent=g.found.length+' prevista'+(g.found.length>1?'s':'');
      row.append(day,info,count);
      row.addEventListener('click',()=>{if(typeof switchTab==='function')switchTab('calendario');});
      row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click();}});
      host.appendChild(row);
    }
  }
  // Render inside the existing render pipeline; preserves all original actions and data updates.
  if(typeof renderHoje==='function'){
    const original=renderHoje;
    renderHoje=function(){const value=original.apply(this,arguments);upcoming();return value;};
  }
  document.addEventListener('DOMContentLoaded',()=>{if(typeof clientes!=='undefined' && Array.isArray(clientes)) upcoming();});
})();

(function(){
  const baseRenderHoje = renderHoje;
  renderHoje = function(){
    baseRenderHoje();
    try{
      const list = document.querySelectorAll('#sec-hoje .tasks-list .task-item');
      const total = list.length;
      const done = document.querySelectorAll('#sec-hoje .tasks-list .task-item.done').length;
      const el = document.getElementById('kpi-hoje');
      const sub = document.getElementById('kpi-hoje-sub');
      if(el) el.textContent = total;
      if(sub) sub.textContent = total ? `${Math.max(total-done,0)} pendente${(Math.max(total-done,0)===1?'':'s')} para hoje` : 'nenhuma arte programada';
    }catch(e){}
  };
})();

(function(){
  'use strict';
  const root=document.getElementById('ds-stopwatch');
  if(!root) return;
  const KEY='ds_stopwatch_v99';
  const clock=document.getElementById('ds-stopwatch-clock');
  const tenths=document.getElementById('ds-stopwatch-tenths');
  const status=document.getElementById('ds-stopwatch-status-text');
  const start=document.getElementById('ds-stopwatch-start');
  const pause=document.getElementById('ds-stopwatch-pause');
  const reset=document.getElementById('ds-stopwatch-reset');
  function fresh(){return {elapsed:0,running:false,startedAt:0};}
  let state=fresh();
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved && Number.isFinite(saved.elapsed) && saved.elapsed>=0 && typeof saved.running==='boolean' && Number.isFinite(saved.startedAt)){
      state={elapsed:saved.elapsed,running:saved.running,startedAt:saved.startedAt};
    }
  }catch(e){}
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){} }
  function elapsed(){return Math.max(0,state.elapsed+(state.running?Math.max(0,Date.now()-state.startedAt):0));}
  function render(){
    const ms=elapsed();
    const sec=Math.floor(ms/1000);
    const hr=Math.floor(sec/3600), min=Math.floor(sec%3600/60), secs=sec%60;
    const pad=n=>String(n).padStart(2,'0');
    clock.textContent=pad(hr)+':'+pad(min)+':'+pad(secs);
    tenths.textContent='.'+Math.floor(ms%1000/100);
    root.classList.toggle('running',state.running);
    status.textContent=state.running?'Contando':ms>0?'Pausado':'Pronto';
    start.disabled=state.running;
    pause.disabled=!state.running;
    reset.disabled=!state.running && ms===0;
    start.querySelector('span').textContent=ms>0?'Retomar':'Iniciar';
  }
  start.addEventListener('click',function(){
    if(state.running)return;
    state.startedAt=Date.now();state.running=true;save();render();
  });
  pause.addEventListener('click',function(){
    if(!state.running)return;
    state.elapsed=elapsed();state.running=false;state.startedAt=0;save();render();
  });
  reset.addEventListener('click',function(){state=fresh();save();render();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)render();});
  window.addEventListener('pageshow',render);
  /* V104: outro aparelho mexeu no cronômetro (chega pela sincronização) */
  window.addEventListener('ds-cfg-pulled',function(e){
    if(!e.detail||e.detail.key!==KEY)return;
    try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v && Number.isFinite(v.elapsed) && v.elapsed>=0 && typeof v.running==='boolean' && Number.isFinite(v.startedAt))state={elapsed:v.elapsed,running:v.running,startedAt:v.startedAt};else state=fresh();}catch(err){state=fresh();}
    render();
  });
  window.addEventListener('storage',function(e){
    if(e.key!==KEY)return;
    try{const v=JSON.parse(e.newValue||'null');if(v && Number.isFinite(v.elapsed) && typeof v.running==='boolean')state=v;else state=fresh();}catch(err){state=fresh();}
    render();
  });
  render();setInterval(function(){if(state.running)render();},100);
})();
