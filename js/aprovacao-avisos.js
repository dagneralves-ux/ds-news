/* DS Gestão V110 — Link Público de Aprovação de Artes e Central de Avisos (v63) */

/* v63/V110 — aprovação por link curto (&p=...) com trava de 24h + central de avisos */
(function(){
function el(i){ return document.getElementById(i); }
function lsGet(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function h(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function missing(err){ return !!err && /does not exist|schema cache|PGRST202|PGRST205|42P01|42883|relation|function/i.test(String(err.message||'')+' '+String(err.code||'')); }

var REDO_WINDOW_MS = 24 * 3600 * 1000;

function b64uEnc(str){
  try{
    var bytes=new TextEncoder().encode(str), bin='';
    for(var i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch(e){
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
}
function b64uDec(b64){
  var s=String(b64||'').replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4) s+='=';
  var bin=atob(s);
  try{
    var bytes=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }catch(e){
    return decodeURIComponent(escape(bin));
  }
}
function unpackLinkParams(q){
  var p=q.get('p')||'';
  if(p){
    try{
      var arr=JSON.parse(b64uDec(p));
      if(Array.isArray(arr) && arr.length>=2){
        var refOrUrl=String(arr[0]||'').trim();
        var fullUrl=/^https?:\/\//i.test(refOrUrl)?refOrUrl:(refOrUrl?('https://'+refOrUrl+'.supabase.co'):'');
        return {
          url: fullUrl,
          key: String(arr[1]||''),
          d: String(arr[2]||''),
          f: String(arr[3]||''),
          w: String(arr[4]||'')
        };
      }
    }catch(e){}
  }
  return {
    url: q.get('u')||'',
    key: q.get('k')||'',
    d: q.get('d')||'',
    f: q.get('f')||'',
    w: q.get('w')||''
  };
}
function getRespTs(d, token){
  if(d && d.respondido_em){
    var t=new Date(d.respondido_em).getTime();
    if(Number.isFinite(t) && t>0) return t;
  }
  var loc=lsGet('ds_apr_resp_'+token, null);
  if(loc){
    var tl=new Date(loc).getTime();
    if(Number.isFinite(tl) && tl>0) return tl;
  }
  return 0;
}

/* ═══════ PÁGINA PÚBLICA (o cliente abre o link) ═══════ */
function publicPage(){
  var m=/[#&]aprovar=([A-Za-z0-9_-]{10,64})/.exec(location.hash||''); if(!m) return false;
  var q=new URLSearchParams((location.hash||'').replace(/^#/,''));
  var parsed=unpackLinkParams(q);
  var token=m[1], url=parsed.url, key=parsed.key;
  var pd=(parsed.d||'').match(/^(\d{4})-(\d{2})-(\d{2})$/), pf=(parsed.f||'').slice(0,30), pw=(parsed.w||'').replace(/\D/g,'').slice(0,15);
  document.documentElement.setAttribute('data-aprovar','1');
  try{ document.title='Aprovação de arte · Dagner Design'; }catch(e){}
  var st=document.createElement('style');
  st.textContent='html[data-aprovar] body>*:not(#apr-page):not(#apr-lb){display:none!important}#apr-page{position:fixed;inset:0;z-index:2147483000;background:#f4f4f6;color:#1b1c1f;overflow:auto;font-family:Inter,system-ui,sans-serif;-webkit-text-size-adjust:100%}'
   +'#apr-page .w{max-width:560px;margin:0 auto;padding:18px 16px 56px}'
   +'#apr-page .hd{display:flex;align-items:center;gap:12px;margin-bottom:20px}#apr-page .hd img{width:auto;height:46px;max-width:150px;border-radius:0;margin:0;background:transparent;border:0}'
   +'#apr-page .hd b{display:block;font-size:15px}#apr-page .hd span{font-size:12.5px;color:#6a6f7a}'
   +'#apr-page h1{font-size:25px;line-height:1.2;margin:0 0 6px;letter-spacing:-.01em}#apr-page .em{font-size:14.5px;color:#5b5f68;margin-bottom:10px}'
   +'#apr-page .ch{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}#apr-page .ch i{font-style:normal;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;background:#fff;border:1px solid #dcdce1;color:#2b2d31}'
   +'#apr-page .im{position:relative;margin-bottom:14px}#apr-page .im img,#apr-page .car img{width:100%;display:block;border-radius:14px;background:#e8e8ec;cursor:zoom-in}'
   +'#apr-page .car{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}#apr-page .car::-webkit-scrollbar{display:none}'
   +'#apr-page .car img{flex:0 0 100%;scroll-snap-align:center}'
   +'#apr-page .cn{position:absolute;top:10px;right:10px;background:rgba(20,22,30,.78);color:#fff;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:999px;pointer-events:none}'
   +'#apr-page .dt{display:flex;justify-content:center;gap:6px;margin:10px 0 0}#apr-page .dt s{width:7px;height:7px;border-radius:50%;background:#c9c9d0;text-decoration:none}#apr-page .dt s.on{background:#1b1c1f}'
   +'#apr-page .hint{font-size:12.5px;color:#6a6f7a;text-align:center;margin:6px 0 0}'
   +'#apr-page .lg{white-space:pre-wrap;background:#fff;border-radius:14px;padding:14px 16px;font-size:15px;line-height:1.55;margin:6px 0 20px;border:1px solid #e4e4e8}'
   +'#apr-page .lb{font-size:12px;letter-spacing:.08em;font-weight:700;color:#6a6f7a;text-transform:uppercase;margin:6px 0 6px}'
   +'#apr-page textarea{width:100%;box-sizing:border-box;min-height:96px;border-radius:12px;border:1px solid #d6d6dc;padding:12px;font:inherit;font-size:16px;background:#fff;resize:vertical}'
   +'#apr-page .er{display:none;color:#c8323a;font-size:13.5px;font-weight:600;margin-top:6px}#apr-page .er.on{display:block}'
   +'#apr-page .nt{font-size:12.5px;color:#6a6f7a;margin-top:6px}'
   +'#apr-page .bt{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}#apr-page button{flex:1;min-width:150px;border:0;border-radius:12px;padding:15px 16px;font:inherit;font-size:16px;font-weight:700;cursor:pointer}'
   +'#apr-page .ok{background:#1b1c1f;color:#fff}#apr-page .aj{background:#fff;color:#1b1c1f;border:1px solid #c9c9d0}#apr-page button[disabled]{opacity:.5}'
   +'#apr-page .bx{background:#fff;border:1px solid #e4e4e8;border-radius:16px;padding:26px 18px;text-align:center;line-height:1.5}#apr-page .bx b{display:block;font-size:19px;margin:8px 0 4px}'
   +'#apr-page .ck{width:56px;height:56px;border-radius:50%;background:#1b1c1f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto}'
   +'#apr-page .ck.aj2{background:#fff;color:#1b1c1f;border:2px solid #1b1c1f}'
   +'#apr-page a.wa{display:block;margin-top:16px;background:#1b1c1f;color:#fff;text-decoration:none;border-radius:12px;padding:15px 16px;font-size:16px;font-weight:700}'
   +'#apr-page .cm{margin-top:12px;font-size:14px;color:#3a3d44;background:#f4f4f6;border-radius:10px;padding:10px 12px;text-align:left;white-space:pre-wrap}'
   +'#apr-page .ft{margin-top:34px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:#8a8e98}#apr-page .ft img{width:auto;height:22px;border-radius:0;margin:0;opacity:.75}'
   +'#apr-page .lk{background:none;color:#555;text-decoration:underline;font-weight:500;font-size:14px;flex:none;min-width:0;padding:12px 0}'
   +'#apr-lb{position:fixed;inset:0;z-index:2147483600;background:rgba(10,11,14,.94);display:none;align-items:center;justify-content:center;padding:12px}#apr-lb.on{display:flex}'
   +'#apr-lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}#apr-lb button{position:absolute;top:14px;right:14px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font-size:22px;cursor:pointer}';
  document.head.appendChild(st);
  var pg=document.createElement('div'); pg.id='apr-page'; document.body.appendChild(pg);
  var lb=document.createElement('div'); lb.id='apr-lb'; lb.innerHTML='<button type="button" aria-label="Fechar">×</button><img alt="">'; document.body.appendChild(lb);
  lb.onclick=function(){ lb.classList.remove('on'); };
  var LOGO='icons/logo.png?v=105';
  var HEAD='<div class="hd"><img src="'+LOGO+'" alt="Dagner Design"><div><b>Aprovação de arte</b><span>Confira e responda abaixo</span></div></div>';
  var FOOT='<div class="ft"><img src="'+LOGO+'" alt="">Dagner Design</div>';
  function box(t,s){ pg.innerHTML='<div class="w">'+HEAD+'<div class="bx"><b>'+h(t)+'</b>'+h(s||'')+'</div>'+FOOT+'</div>'; }
  box('Carregando…');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key){ box('Link inválido','Peça um novo link.'); return true; }
  var c=null, data=null;
  function boot(){
    if(!window.supabase){ setTimeout(boot,150); return; }
    c=window.supabase.createClient(url,key);
    c.rpc('aprovacao_get',{p_token:token}).then(function(r){
      if(r.error||!r.data){ box('Link não encontrado','Ele pode ter sido substituído. Peça um novo link.'); return; }
      data=r.data; draw();
    });
  }
  function draw(){
    var d=data, imgs=(d.imagens||[]), done=d.status==='aprovado'||d.status==='ajustes';
    var html='<div class="w">'+HEAD+'<h1>'+h(d.titulo)+'</h1>'+(d.empresa?'<div class="em">'+h(d.empresa)+'</div>':'');
    var chips=''; if(pd) chips+='<i>Postagem prevista: '+pd[3]+'/'+pd[2]+'/'+pd[1]+'</i>'; if(pf) chips+='<i>'+h(pf)+'</i>';
    if(chips) html+='<div class="ch">'+chips+'</div>';
    if(imgs.length>1){
      html+='<div class="im"><div class="car" id="ap-car">'+imgs.map(function(u){ return '<img src="'+h(u)+'" alt="">'; }).join('')+'</div><span class="cn" id="ap-cn">1/'+imgs.length+'</span></div>'
        +'<div class="dt" id="ap-dt">'+imgs.map(function(_,i){ return '<s'+(i?'':' class="on"')+'></s>'; }).join('')+'</div><div class="hint">Deslize para ver todas · toque para ampliar</div><div style="height:16px"></div>';
    } else if(imgs.length===1){
      html+='<div class="im"><img src="'+h(imgs[0])+'" alt=""></div><div class="hint" style="margin-bottom:14px">Toque na imagem para ampliar</div>';
    }
    if(d.legenda) html+='<div class="lb">Legenda</div><div class="lg">'+h(d.legenda)+'</div>';
    if(done && !pg._redo){
      var ap=d.status==='aprovado';
      var respTs=getRespTs(d,token);
      var expired=respTs>0 && (Date.now()-respTs>REDO_WINDOW_MS);
      html+='<div class="bx"><div class="ck'+(ap?'':' aj2')+'">'+(ap?'✓':'✎')+'</div><b>'+(ap?'Arte aprovada!':'Pedido de ajustes enviado')+'</b>'+(ap?'Obrigado! O designer já foi avisado e vai programar a postagem.':'Obrigado! O designer recebeu seu pedido e vai ajustar a arte.')
        +(d.comentario?'<div class="cm">'+h(d.comentario)+'</div>':'');
      if(pw){ var tx='Olá! Acabei de '+(ap?'aprovar':'pedir ajustes em')+' a arte "'+(d.titulo||'')+'".'; html+='<a class="wa" href="https://wa.me/'+pw+'?text='+encodeURIComponent(tx)+'" target="_blank" rel="noopener">Falar com o designer no WhatsApp</a>'; }
      html+='</div>';
      if(expired){
        html+='<div class="nt" style="text-align:center;margin-top:14px">Resposta finalizada (prazo de 24h para alteração encerrado). Caso precise falar sobre esta arte, chame o designer pelo WhatsApp.</div>';
      } else {
        html+='<div class="bt"><button class="lk" id="ap-redo">Mudar minha resposta (disponível por até 24h)</button></div>';
      }
    } else {
      html+='<div class="lb">Seu comentário</div><textarea id="ap-c" placeholder="Se quiser mudar algo, escreva aqui (ex.: trocar a foto, corrigir o preço)…"></textarea>'
        +'<div class="er" id="ap-er">Conte o que precisa mudar para pedir ajustes.</div><div class="nt">O comentário chega direto para o designer. Só é obrigatório ao pedir ajustes.</div>'
        +'<div class="bt"><button class="ok" id="ap-ok">Aprovar arte</button><button class="aj" id="ap-aj">Pedir ajustes</button></div>';
    }
    html+=FOOT+'</div>';
    pg.innerHTML=html; pg.scrollTop=0;
    var car=el('ap-car'); if(car){ car.addEventListener('scroll',function(){ var i=Math.round(car.scrollLeft/car.clientWidth); el('ap-cn').textContent=(i+1)+'/'+imgs.length; var s=el('ap-dt').children; for(var k=0;k<s.length;k++) s[k].className=k===i?'on':''; }); }
    [].forEach.call(pg.querySelectorAll('.im img'),function(im){ im.onclick=function(){ lb.querySelector('img').src=im.src; lb.classList.add('on'); }; });
    var rd=el('ap-redo'); if(rd) rd.onclick=function(){
      var ts=getRespTs(d,token);
      if(ts>0 && (Date.now()-ts>REDO_WINDOW_MS)){ draw(); return; }
      pg._redo=true; draw();
    };
    function send(s){
      var cm=(el('ap-c').value||'').trim();
      if(s==='ajustes'&&!cm){ el('ap-er').classList.add('on'); el('ap-c').style.borderColor='#c8323a'; el('ap-c').focus(); return; }
      el('ap-ok').disabled=el('ap-aj').disabled=true;
      c.rpc('aprovacao_responder',{p_token:token,p_status:s,p_comentario:cm}).then(function(r){
        if(r.error){ el('ap-ok').disabled=el('ap-aj').disabled=false; el('ap-er').textContent='Não foi possível enviar. Tente de novo.'; el('ap-er').classList.add('on'); return; }
        var nowIso=new Date().toISOString();
        data.status=s; data.comentario=cm; data.respondido_em=nowIso;
        lsSet('ds_apr_resp_'+token,nowIso);
        pg._redo=false; draw();
      });
    }
    if(el('ap-ok')){ el('ap-ok').onclick=function(){ send('aprovado'); }; el('ap-aj').onclick=function(){ send('ajustes'); };
      el('ap-c').addEventListener('input',function(){ el('ap-er').classList.remove('on'); el('ap-c').style.borderColor=''; }); }
  }
  boot(); return true;
}

function startPublic(){ try{ publicPage(); }catch(e){} }
if(/aprovar=/.test(location.hash||'')){
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startPublic); else startPublic();
  return; /* na visão do cliente não carrega nada do app */
}

/* ═══════ DO LADO DO DESIGNER ═══════ */
var apr={}, aprOk=true, imgs=[], curDem=null, uploading=0, K_SEEN='ds_avisos_vistos', K_APL='ds_apr_aplicadas';
function api(){ return window.v61Api; }
function ds(){ var t=new Date(),p=function(n){ return String(n).padStart(2,'0'); }; return t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate()); }
function tok(){ var a=new Uint8Array(18); crypto.getRandomValues(a); return btoa(String.fromCharCode.apply(null,a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function link(t){
  var base=location.href.split('#')[0].split('?')[0];
  var d=(el('dm-d')||{}).value||'', f=(el('dm-f')||{}).value||'', w='', sbUrl='', sbKey='';
  try{
    w=(localStorage.getItem('ds_meu_whats')||'').replace(/\D/g,'');
    sbUrl=localStorage.getItem('ds_sb_url')||'';
    sbKey=localStorage.getItem('ds_sb_key')||'';
  }catch(e){}
  var mRef=/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(sbUrl.trim());
  var shortHost=mRef?mRef[1]:sbUrl.trim();
  var packed=b64uEnc(JSON.stringify([shortHost,sbKey,d,f,w]));
  return base+'#aprovar='+t+'&p='+packed;
}
async function uidDb(){ var r=await authUser(); return r.data.user.id; }

async function sync(){
  if(typeof sb==='undefined'||!sb||!api()) return;
  try{ await api().load(); }catch(e){}
  if(aprOk){
    try{
      var u=await uidDb(), r=await sb.from('aprovacoes').select('*').eq('user_id',u);
      if(r.error) throw r.error;
      apr={}; (r.data||[]).forEach(function(a){ apr[String(a.demanda_id)]=a; });
      var applied=lsGet(K_APL,{}), dem=api().get(), changed=false;
      for(var i=0;i<(r.data||[]).length;i++){
        var a=r.data[i]; if(!a.respondido_em || applied[a.token]===a.respondido_em) continue;
        applied[a.token]=a.respondido_em; changed=true;
        var d=dem.find(function(x){ return String(x.id)===String(a.demanda_id); }); if(!d) continue;
        if(a.status==='aprovado'){ if(d.status!=='pronto') await api().setStatus(d.id,'pronto'); toast('Cliente aprovou: '+d.titulo,'ok'); }
        else if(a.status==='ajustes'){ if(d.status==='aprovacao') await api().setStatus(d.id,'producao'); toast('Cliente pediu ajustes: '+d.titulo,'inf'); }
      }
      if(changed) lsSet(K_APL,applied);
    }catch(e){ if(missing(e)) aprOk=false; }
  }
  api().render(); bell();
}
window.v63Chip=function(id){
  var a=apr[String(id)]; if(!a) return '';
  if(a.status==='aprovado') return '<span class="kb-chip kb-ok"><i class="ti ti-check"></i>Aprovado</span>';
  if(a.status==='ajustes') return '<span class="kb-chip kb-aj"><i class="ti ti-edit"></i>Ajustes</span>';
  return '<span class="kb-chip"><i class="ti ti-clock"></i>Aguardando cliente</span>';
};

/* painel dentro do modal da demanda */
function panel(){
  var box=el('dm-apr'); if(!box) return;
  if(!curDem){ box.innerHTML='<div class="apr-t"><i class="ti ti-link"></i>Aprovação do cliente</div><div class="apr-h">Salve a demanda para gerar o link de aprovação.</div>'; return; }
  var a=apr[String(curDem)], st=a?(a.status==='aprovado'?['Aprovado','ok']:a.status==='ajustes'?['Ajustes pedidos','aj']:['Aguardando','']):null;
  var th=imgs.map(function(u,i){ return '<div><img src="'+h(u)+'" alt=""><button type="button" onclick="v63RmImg('+i+')" aria-label="Remover">×</button></div>'; }).join('');
  var out='<div class="apr-t"><i class="ti ti-link"></i>Aprovação do cliente'+(st?'<span class="apr-st '+st[1]+'">'+st[0]+'</span>':'')+'</div>';
  if(!aprOk){ box.innerHTML=out+'<div class="apr-h">Falta rodar o SQL v63 no Supabase para gerar links de aprovação.</div>'; return; }
  out+='<div class="apr-th">'+th+'<label class="apr-add" title="Adicionar imagens">'+(uploading?'…':'+')+'<input type="file" accept="image/*" multiple hidden onchange="v63AddImgs(this)"></label></div>';
  out+='<div class="apr-row">'
    +(a?'<button class="btn" type="button" onclick="v63Copy()"><i class="ti ti-copy"></i> Copiar link</button><button class="btn" type="button" onclick="v63Wpp()"><i class="ti ti-brand-whatsapp"></i> WhatsApp</button><button class="btn btn-primary" type="button" onclick="v63Gerar()"><i class="ti ti-refresh"></i> Atualizar e reenviar</button>'
        :'<button class="btn btn-primary" type="button" onclick="v63Gerar()"><i class="ti ti-link"></i> Gerar link de aprovação</button>')+'</div>';
  if(a&&a.status==='ajustes'&&a.comentario) out+='<div class="apr-cm"><b>Pedido do cliente:</b> '+h(a.comentario)+'</div>';
  if(a&&a.status==='aprovado'&&a.comentario) out+='<div class="apr-cm"><b>Comentário:</b> '+h(a.comentario)+'</div>';
  box.innerHTML=out;
}
window.v63AddImgs=async function(inp){
  var fs=[].slice.call(inp.files||[]); inp.value='';
  if(!fs.length) return;
  if(imgs.length+fs.length>10){ toast('Máximo de 10 imagens.','err'); return; }
  uploading++; panel();
  try{ var u=await uidDb(); for(var i=0;i<fs.length;i++){ imgs.push(await uploadLogo(fs[i],u,{maxDim:1600,quality:0.86})); } }
  catch(e){ toast('Não consegui enviar a imagem.','err'); }
  uploading--; panel();
};
window.v63RmImg=function(i){ imgs.splice(i,1); panel(); };
window.v63Gerar=async function(){
  if(!curDem) return;
  var titulo=el('dm-t').value.trim(), legenda=el('dm-l').value, cid=el('dm-c').value, c=api().cli(cid);
  if(!titulo){ toast('Dê um título à demanda.','err'); return; }
  if(!imgs.length && !legenda.trim()){ toast('Adicione uma imagem ou escreva a legenda.','err'); return; }
  var a=apr[String(curDem)], row={titulo:titulo,legenda:legenda,imagens:imgs,empresa:c?c.empresa:'',status:'pendente',comentario:'',respondido_em:null};
  try{
    var r;
    if(a){ r=await sb.from('aprovacoes').update(row).eq('id',a.id).select().single(); }
    else{ row.user_id=await uidDb(); row.demanda_id=String(curDem); row.token=tok(); r=await sb.from('aprovacoes').insert(row).select().single(); }
    if(r.error) throw r.error;
    apr[String(curDem)]=r.data;
    el('dm-s').value='aprovacao';
    await api().setStatus(curDem,'aprovacao');
    panel(); navigator.clipboard&&navigator.clipboard.writeText(link(r.data.token)).then(function(){ toast('Link copiado. Envie ao cliente.','ok'); },function(){ toast('Link gerado.','ok'); });
    bell();
  }catch(e){ if(missing(e)){ aprOk=false; panel(); } else toast('Não consegui gerar o link.','err'); }
};
window.v63Copy=async function(){
  var a=apr[String(curDem)]; if(!a) return;
  try{ await navigator.clipboard.writeText(link(a.token)); toast('Link copiado.','ok'); }catch(e){ prompt('Copie o link:',link(a.token)); }
};
window.v63Wpp=function(){
  var a=apr[String(curDem)]; if(!a) return;
  var c=api().cli(el('dm-c').value), tel=((c&&c.telefone)||'').replace(/\D/g,'');
  if(tel && tel.length<=11) tel='55'+tel;
  var nome=c&&c.responsavel?(' '+c.responsavel.split(' ')[0]):'';
  var msg='Olá'+nome+'! Segue a arte "'+a.titulo+'" para sua aprovação:\n'+link(a.token);
  window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank');
};
var _open=window.v61OpenDem;
window.v61OpenDem=function(id){
  _open.apply(this,arguments);
  curDem=id||null;
  var a=id?apr[String(id)]:null; imgs=a&&a.imagens?a.imagens.slice():[];
  panel();
};

/* ═══════ CENTRAL DE AVISOS (só no app) ═══════ */
function avisos(){
  var out=[], hoje=ds(), dem=api()?api().get():[], seen=lsGet(K_SEEN,{});
  Object.keys(apr).forEach(function(id){
    var a=apr[id], d=dem.find(function(x){ return String(x.id)===id; }); if(!d||!a.respondido_em) return;
    var k=a.token+'|'+a.respondido_em; if(seen[k]) return;
    out.push({k:k,cls:'new',ic:a.status==='aprovado'?'circle-check':'edit',t:a.status==='aprovado'?'Cliente aprovou':'Cliente pediu ajustes',s:d.titulo+(a.comentario?' — '+a.comentario:''),dem:d.id,fresh:true});
  });
  dem.forEach(function(d){
    if(d.status==='pronto'||!d.entrega) return;
    var c=api().cli(d.clienteId), nm=d.titulo+(c?' · '+c.empresa:'');
    if(d.entrega<hoje) out.push({cls:'late',ic:'alert-triangle',t:'Entrega atrasada',s:nm,dem:d.id});
    else if(d.entrega===hoje) out.push({cls:'',ic:'calendar-due',t:'Entrega hoje',s:nm,dem:d.id});
  });
  Object.keys(apr).forEach(function(id){
    var a=apr[id]; if(a.status!=='pendente') return;
    var t0=a.criado_em?new Date(a.criado_em).getTime():NaN; if(isNaN(t0)) return; var n=Math.floor((Date.now()-t0)/86400000); if(n<2) return;
    out.push({cls:'',ic:'clock',t:'Cliente ainda não respondeu',s:a.titulo+' · há '+n+' dias',dem:id});
  });
  var b=el('badge-cb'), nc=(b&&b.style.display!=='none')?(parseInt(b.textContent,10)||0):0;
  if(nc>0) out.push({cls:'',ic:'cash',t:'Cobranças em aberto',s:nc+(nc>1?' clientes com cobrança vencida ou para hoje':' cliente com cobrança vencida ou para hoje'),tab:'cobranca'});
  return out;
}
var lastList=[];
function bell(keep){
  var btn=el('bell-btn'); if(!btn) return;
  var shown=lastList; lastList=avisos(); var n=lastList.length;
  btn.classList.toggle('has',n>0); btn.querySelector('.bell-n').textContent=n>99?'99+':n;
  if(keep){ lastList=shown; return; }
  if(el('bell-pop').classList.contains('open')) drawPop();
}
function drawPop(){
  var p=el('bell-pop');
  p.innerHTML='<div class="bell-h">Avisos</div>'+(lastList.length?lastList.map(function(a,i){
    return '<div class="bell-i '+a.cls+'" onclick="v63Go('+i+')"><i class="ti ti-'+a.ic+'"></i><div><div class="bell-t">'+h(a.t)+'</div><div class="bell-s">'+h(a.s)+'</div></div></div>';
  }).join(''):'<div class="bell-e">Tudo em dia por aqui.</div>');
}
window.v63Go=function(i){
  var a=lastList[i]; if(!a) return;
  el('bell-pop').classList.remove('open');
  if(a.tab){ switchTab(a.tab); return; }
  switchTab('demandas'); if(a.dem!=null) setTimeout(function(){ api().open(a.dem); },350);
};
window.v63Bell=async function(ev){
  if(ev) ev.stopPropagation();
  var p=el('bell-pop'); if(p.classList.contains('open')){ p.classList.remove('open'); return; }
  await sync(); drawPop(); p.classList.add('open');
  var seen=lsGet(K_SEEN,{}); lastList.forEach(function(a){ if(a.fresh) seen[a.k]=1; }); lsSet(K_SEEN,seen);
  setTimeout(function(){ var l=lastList; bell(true); lastList=l; el('bell-btn').classList.toggle('has',avisos().length>0); el('bell-btn').querySelector('.bell-n').textContent=avisos().length; },0);
};
document.addEventListener('click',function(e){ var p=el('bell-pop'); if(p&&p.classList.contains('open')&&!p.contains(e.target)) p.classList.remove('open'); });

/* troca de aba: sincroniza as respostas dos clientes */
var _sw=window.switchTab;
window.switchTab=function(tab){ var r=_sw.apply(this,arguments); if(tab==='demandas') setTimeout(sync,250); return r; };
/* checagem periódica, só enquanto o app está aberto */
setTimeout(function tick(){ if(!document.hidden && typeof sb!=='undefined' && sb && typeof _appUserId!=='undefined' && _appUserId) sync(); setTimeout(tick,60000); },5000);
})();
