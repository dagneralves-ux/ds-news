/* DS Gestão V109 — Fase 2: Serviços Avulsos, Chave PIX, Compartilhamento PDF,
   Compressão WebP, Kanban -> Entregas e Cronômetro por Cliente. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const safe = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => typeof fmtBRL === 'function' ? fmtBRL(v) : 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function curUid() {
    return (typeof _appUserId === 'string' && _appUserId) ? _appUserId : 'local';
  }
  function extrasStorageKey() { return 'ds_extras_fin_v109_' + curUid(); }
  function timeStorageKey() { return 'ds_time_logs_v109_' + curUid(); }
  const PIX_KEY = 'ds_pix_cfg_v109';
  const SW_CLIENT_KEY = 'ds_stopwatch_client_v109';

  function readJson(k, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      return (v && typeof v === 'object') ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJson(k, val) {
    try { localStorage.setItem(k, JSON.stringify(val)); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════════════
     1. COMPRESSÃO AUTOMÁTICA DE IMAGENS (WebP nítido via Canvas)
     ══════════════════════════════════════════════════════════════════ */
  window.dsCompressImage = function (file, opts) {
    opts = opts || {};
    const maxDim = opts.maxDim || 512;
    const quality = opts.quality || 0.88;
    if (!file || !(file instanceof Blob)) return Promise.resolve(file);
    const type = String(file.type || '').toLowerCase();
    // SVG e GIF animado permanecem intactos
    if (!type.startsWith('image/') || type.includes('svg') || type.includes('gif')) {
      return Promise.resolve(file);
    }
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) { resolve(file); return; }
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => {
            if (!blob || (blob.size >= file.size && scale === 1)) {
              resolve(file);
              return;
            }
            const baseName = String(file.name || 'imagem').replace(/\.[^.]+$/, '');
            try {
              resolve(new File([blob], baseName + '.webp', { type: 'image/webp', lastModified: Date.now() }));
            } catch (e) {
              blob.name = baseName + '.webp';
              resolve(blob);
            }
          }, 'image/webp', quality);
        } catch (err) {
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  if (/aprovar=/.test(location.hash || '')) return;

  /* ══════════════════════════════════════════════════════════════════
     2. SERVIÇOS AVULSOS / EXTRAS NO FINANCEIRO
     ══════════════════════════════════════════════════════════════════ */
  function entryKey(clienteId, mesKey) {
    return String(mesKey || '') + '_' + String(clienteId || '');
  }
  window.dsExtrasAll = function () {
    return readJson(extrasStorageKey(), {});
  };
  window.dsExtrasSetAll = function (obj) {
    writeJson(extrasStorageKey(), obj || {});
  };
  window.dsExtrasDoMes = function (clienteId, mesKey) {
    if (!clienteId || !mesKey) return [];
    const all = window.dsExtrasAll();
    const list = all[entryKey(clienteId, mesKey)];
    return Array.isArray(list) ? list : [];
  };
  window.dsTotalExtrasDoMes = function (clienteId, mesKey) {
    return window.dsExtrasDoMes(clienteId, mesKey).reduce((s, x) => s + (Number(x.valor) || 0), 0);
  };
  window.dsTotalCobrarCliente = function (c, mesKey) {
    if (!c) return 0;
    return (Number(c.valorMensal) || 0) + window.dsTotalExtrasDoMes(c.id, mesKey);
  };
  window.dsTotalExtrasGeralMes = function (mesKey) {
    if (!mesKey) return 0;
    const prefix = String(mesKey) + '_';
    const all = window.dsExtrasAll();
    const activeIds = new Set((typeof clientes !== 'undefined' ? clientes : []).filter(c => c.status === 'ativo').map(c => String(c.id)));
    let sum = 0;
    for (const [k, arr] of Object.entries(all)) {
      if (!k.startsWith(prefix) || !Array.isArray(arr)) continue;
      const cid = k.slice(prefix.length);
      if (activeIds.size && !activeIds.has(cid)) continue;
      sum += arr.reduce((s, x) => s + (Number(x.valor) || 0), 0);
    }
    return sum;
  };

  let modalExtraState = { clienteId: null, mesKey: null };

  function parseCurrencyInput(str) {
    if (!str) return 0;
    const clean = String(str).trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(clean);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  window.v109MascaraMoeda = function (inp) {
    const raw = String(inp.value || '').replace(/\D/g, '');
    if (!raw) { inp.value = ''; return; }
    inp.value = (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function renderExtrasModalList() {
    const { clienteId, mesKey } = modalExtraState;
    const c = (typeof clientes !== 'undefined' ? clientes : []).find(x => String(x.id) === String(clienteId));
    const listEl = $('v109-extras-list');
    const sumEl = $('v109-extras-summary');
    if (!listEl || !sumEl || !c) return;

    const items = window.dsExtrasDoMes(clienteId, mesKey);
    if (!items.length) {
      listEl.innerHTML = '<div class="v109-extras-empty">Nenhum serviço avulso lançado neste mês para este cliente.</div>';
    } else {
      listEl.innerHTML = items.map(it => `
        <div class="v109-extra-row">
          <div class="v109-extra-info">
            <strong>${safe(it.descricao || it.servico || 'Serviço avulso')}</strong>
            <small>${safe(it.servico || 'Serviço avulso')}</small>
          </div>
          <span class="v109-extra-val">+ ${money(it.valor)}</span>
          <button type="button" class="v109-extra-del" data-del-extra="${safe(it.id)}" title="Remover item" aria-label="Remover item">
            <i class="ti ti-trash"></i>
          </button>
        </div>`).join('');
    }
    const base = Number(c.valorMensal) || 0;
    const ext = window.dsTotalExtrasDoMes(clienteId, mesKey);
    sumEl.innerHTML = `<span>Mensalidade: <b>${money(base)}</b> · Avulsos: <b>${money(ext)}</b></span><strong>Total: ${money(base + ext)}</strong>`;
  }

  window.v109OpenExtrasModal = function (clienteId, mesKey) {
    const t = typeof now === 'function' ? now() : new Date();
    const mk = mesKey || (typeof cbYear !== 'undefined' && cbYear ? cbMesStr(cbYear, cbMonth) : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
    const c = (typeof clientes !== 'undefined' ? clientes : []).find(x => String(x.id) === String(clienteId));
    if (!c) return;
    modalExtraState = { clienteId: String(clienteId), mesKey: mk };
    $('v109-extras-title').textContent = 'Serviços avulsos · ' + c.empresa;
    $('v109-extras-sub').textContent = 'Referência: ' + (typeof cbMesLabel === 'function' ? cbMesLabel(mk) : mk) + ' — soma na cobrança e no recibo PDF.';
    $('v109-extra-servico').value = 'Criação de cards/artes para o perfil';
    $('v109-extra-desc').value = '';
    $('v109-extra-valor').value = '';
    renderExtrasModalList();
    $('v109-extras-modal').hidden = false;
    setTimeout(() => $('v109-extra-desc')?.focus(), 60);
  };

  window.v109CloseExtrasModal = function () {
    const m = $('v109-extras-modal');
    if (m) m.hidden = true;
    modalExtraState = { clienteId: null, mesKey: null };
  };

  window.v109AddExtraItem = function () {
    const { clienteId, mesKey } = modalExtraState;
    if (!clienteId || !mesKey) return;
    const servico = ($('v109-extra-servico')?.value || '').trim() || 'Criação de cards/artes para o perfil';
    const descricao = ($('v109-extra-desc')?.value || '').trim() || 'Serviço avulso';
    const valor = parseCurrencyInput($('v109-extra-valor')?.value || '');
    if (!Number.isFinite(valor) || valor <= 0) {
      if (typeof toast === 'function') toast('Informe um valor maior que zero para o serviço avulso.', 'err');
      $('v109-extra-valor')?.focus();
      return;
    }
    const all = window.dsExtrasAll();
    const k = entryKey(clienteId, mesKey);
    const arr = Array.isArray(all[k]) ? all[k].slice() : [];
    arr.push({
      id: 'ex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      servico,
      descricao,
      valor: Math.round(valor * 100) / 100
    });
    all[k] = arr;
    window.dsExtrasSetAll(all);
    $('v109-extra-desc').value = '';
    $('v109-extra-valor').value = '';
    renderExtrasModalList();
    if (typeof renderCobranca === 'function' && $('sec-cobranca')?.classList.contains('active')) renderCobranca();
    if (typeof toast === 'function') toast('Serviço avulso adicionado ao mês!', 'ok');
    $('v109-extra-desc')?.focus();
  };

  $('v109-extras-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-del-extra]');
    if (!btn) return;
    const id = btn.dataset.delExtra;
    const { clienteId, mesKey } = modalExtraState;
    if (!clienteId || !mesKey) return;
    const all = window.dsExtrasAll();
    const k = entryKey(clienteId, mesKey);
    // Mantém array vazio [] em vez de delete para sincronizar exclusões entre dispositivos
    all[k] = (Array.isArray(all[k]) ? all[k] : []).filter(x => String(x.id) !== String(id));
    window.dsExtrasSetAll(all);
    renderExtrasModalList();
    if (typeof renderCobranca === 'function' && $('sec-cobranca')?.classList.contains('active')) renderCobranca();
  });

  /* ══════════════════════════════════════════════════════════════════
     3. CHAVE PIX CONFIGURÁVEL + COMPARTILHAMENTO DIRETO DO RECIBO PDF
     ══════════════════════════════════════════════════════════════════ */
  window.dsPixConfig = function () {
    const cfg = readJson(PIX_KEY, {});
    return {
      chave: String(cfg.chave || '').trim(),
      titular: String(cfg.titular || '').trim()
    };
  };

  window.v109OpenPixModal = function () {
    const cfg = window.dsPixConfig();
    $('v109-pix-chave').value = cfg.chave;
    $('v109-pix-titular').value = cfg.titular;
    $('v109-pix-modal').hidden = false;
    setTimeout(() => $('v109-pix-chave')?.focus(), 60);
  };

  window.v109ClosePixModal = function () {
    const m = $('v109-pix-modal');
    if (m) m.hidden = true;
  };

  window.v109SavePixModal = function () {
    const chave = ($('v109-pix-chave')?.value || '').trim();
    const titular = ($('v109-pix-titular')?.value || '').trim();
    writeJson(PIX_KEY, { chave, titular });
    window.v109ClosePixModal();
    if (typeof toast === 'function') {
      toast(chave ? 'Chave PIX salva! Já será incluída nas cobranças do WhatsApp.' : 'Chave PIX removida.', 'ok');
    }
  };

  window.reciboCompartilharPDF = async function () {
    const btn = $('rb-btn-share');
    if (btn) btn.disabled = true;
    try {
      if (typeof buildReciboDoc !== 'function') throw new Error('Gerador de recibo indisponível.');
      const doc = await buildReciboDoc();
      const blob = doc.output('blob');
      const clienteNome = ($('rb-cliente')?.value || 'cliente').trim();
      const dataStr = ($('rb-data')?.value || '').trim();
      const nomeArq = `recibo_${clienteNome.replace(/\s+/g, '_')}_${dataStr.replace(/\//g, '-') || 'hoje'}.pdf`;
      const pdfFile = new File([blob], nomeArq, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: 'Recibo — ' + clienteNome,
          text: `Recibo Dagner Design — ${clienteNome}`
        });
        if (typeof toast === 'function') toast('Recibo enviado!', 'ok');
        return;
      }

      // Fallback para navegadores desktop sem suporte a compartilhamento de arquivo:
      // baixa o PDF e abre a conversa do cliente no WhatsApp pronta para anexar.
      doc.save(nomeArq);
      const c = typeof reciboClienteId !== 'undefined' && reciboClienteId
        ? (typeof clientes !== 'undefined' ? clientes : []).find(x => String(x.id) === String(reciboClienteId))
        : null;
      let tel = String(c?.telefone || $('rb-contato')?.value || '').replace(/\D/g, '');
      if (tel.length === 10 || tel.length === 11) tel = '55' + tel;
      const resp = c?.responsavel ? (' ' + String(c.responsavel).trim().split(/\s+/)[0]) : '';
      const msg = `Olá${resp}! Segue em anexo o recibo referente aos serviços realizados (${clienteNome}). Muito obrigado!`;
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      if (typeof toast === 'function') toast('PDF baixado e WhatsApp aberto! Basta arrastar o arquivo na conversa.', 'ok');
    } catch (err) {
      if (err && err.name === 'AbortError') return; // usuário fechou a janela de compartilhamento
      if (typeof toast === 'function') toast('Não foi possível compartilhar: ' + (err?.message || 'erro'), 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     4. INTEGRAÇÃO AUTOMÁTICA KANBAN / APROVAÇÃO -> ENTREGA DO DIA
     ══════════════════════════════════════════════════════════════════ */
  function fmtDateBr(ds) {
    const p = String(ds || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ds;
  }

  async function autoMarcarEntregaDemanda(d) {
    try {
      if (!d || d.status !== 'pronto' || !d.clienteId) return;
      if (typeof registrarEntrega !== 'function' || typeof isDone !== 'function') return;
      const cid = String(d.clienteId);
      const c = (typeof clientes !== 'undefined' ? clientes : []).find(x => String(x.id) === cid);
      if (!c) return;
      let targetDs = String(d.entrega || '').trim();
      if (!targetDs && typeof todayDs === 'function') {
        const hj = todayDs();
        const doDia = typeof clientesNoDia === 'function' ? clientesNoDia(hj) : [];
        if (doDia.some(x => String(x.id) === cid)) targetDs = hj;
      }
      if (!targetDs || (typeof isBlockedDs === 'function' && isBlockedDs(targetDs))) return;
      if (isDone(targetDs, cid)) return;

      await registrarEntrega(cid, targetDs);
      if (typeof render === 'function') render();
      if (typeof toastUndo === 'function') {
        toastUndo(`Entrega de ${c.empresa} marcada em ${fmtDateBr(targetDs)}.`, () => {
          if (typeof toggleTask === 'function') toggleTask(targetDs, cid);
        }, 8000);
      }
    } catch (err) {
      console.warn('Auto-entrega Kanban:', err);
    }
  }

  function hookKanbanAutoDelivery() {
    const api = window.v61Api;
    if (api && !api._v109Hooked) {
      api._v109Hooked = true;
      const origSetStatus = api.setStatus;
      api.setStatus = async function (id, st) {
        const res = await origSetStatus.apply(this, arguments);
        if (st === 'pronto') {
          const item = (api.get() || []).find(x => String(x.id) === String(id));
          if (item) await autoMarcarEntregaDemanda(item);
        }
        return res;
      };
    }
    const origSaveDem = window.v61SaveDem;
    if (typeof origSaveDem === 'function' && !origSaveDem._v109Hooked) {
      const wrapped = async function () {
        const beforeIds = new Set((window.v61Api?.get() || []).map(x => String(x.id)));
        const stVal = $('dm-s')?.value;
        const cidVal = $('dm-c')?.value;
        const dtVal = $('dm-d')?.value;
        const r = await origSaveDem.apply(this, arguments);
        if (stVal === 'pronto' && cidVal) {
          const list = window.v61Api?.get() || [];
          const target = list.find(x => !beforeIds.has(String(x.id))) || { clienteId: cidVal, status: 'pronto', entrega: dtVal };
          await autoMarcarEntregaDemanda(target);
        }
        return r;
      };
      wrapped._v109Hooked = true;
      window.v61SaveDem = wrapped;
    }
  }
  hookKanbanAutoDelivery();

  /* ══════════════════════════════════════════════════════════════════
     5. CRONÔMETRO VINCULADO AO CLIENTE + TEMPO NO RELATÓRIO MENSAL
     ══════════════════════════════════════════════════════════════════ */
  window.dsTimeLogsAll = function () {
    return readJson(timeStorageKey(), {});
  };
  window.dsTimeLogsSetAll = function (obj) {
    writeJson(timeStorageKey(), obj || {});
  };
  window.dsClientMonthSeconds = function (clienteId, mesKey) {
    if (!clienteId || !mesKey) return 0;
    const all = window.dsTimeLogsAll();
    return Math.max(0, Number(all[entryKey(clienteId, mesKey)]) || 0);
  };
  window.dsFormatDuration = function (totalSeconds) {
    const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
    if (!sec) return '0 min';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m} min${s ? ' ' + s + 's' : ''}`;
    return `${s}s`;
  };

  function currentMonthKey() {
    const t = typeof now === 'function' ? now() : new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  }

  function getStopwatchElapsedMs() {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_stopwatch_v99') || 'null');
      if (!saved) return 0;
      const base = Number(saved.elapsed) || 0;
      const extra = saved.running && Number(saved.startedAt) > 0 ? Math.max(0, Date.now() - Number(saved.startedAt)) : 0;
      return Math.max(0, base + extra);
    } catch (e) {
      return 0;
    }
  }

  function populateStopwatchClients() {
    const sel = $('ds-stopwatch-client');
    if (!sel) return;
    const savedCid = localStorage.getItem(SW_CLIENT_KEY) || sel.value || '';
    const ativos = (typeof clientes !== 'undefined' ? clientes : []).filter(c => c.status === 'ativo');
    sel.innerHTML = '<option value="">Cliente (opcional)</option>' +
      ativos.map(c => `<option value="${safe(c.id)}">${safe(c.empresa)}</option>`).join('');
    if (savedCid && ativos.some(c => String(c.id) === String(savedCid))) {
      sel.value = savedCid;
    } else {
      sel.value = '';
    }
    updateStopwatchClientUI();
  }

  function updateStopwatchClientUI() {
    const sel = $('ds-stopwatch-client');
    const logBtn = $('ds-stopwatch-log-btn');
    const totalBox = $('ds-stopwatch-client-total');
    if (!sel || !logBtn || !totalBox) return;
    const cid = sel.value;
    const elapsedSec = Math.floor(getStopwatchElapsedMs() / 1000);
    logBtn.hidden = !(cid && elapsedSec >= 5);

    if (!cid) {
      totalBox.hidden = true;
      return;
    }
    const mk = currentMonthKey();
    const monthSec = window.dsClientMonthSeconds(cid, mk);
    totalBox.hidden = false;
    totalBox.innerHTML = `<span>No mês: <strong>${window.dsFormatDuration(monthSec)}</strong></span>` +
      (monthSec > 0 ? `<button type="button" class="ds-stopwatch-clear-time" id="ds-stopwatch-clear-time" title="Zerar horas acumuladas deste cliente no mês">zerar mês</button>` : '');
  }

  $('ds-stopwatch-client')?.addEventListener('change', e => {
    try { localStorage.setItem(SW_CLIENT_KEY, e.target.value || ''); } catch (err) {}
    updateStopwatchClientUI();
  });

  $('ds-stopwatch-client-total')?.addEventListener('click', e => {
    if (!e.target.closest('#ds-stopwatch-clear-time')) return;
    const cid = $('ds-stopwatch-client')?.value;
    if (!cid) return;
    const mk = currentMonthKey();
    const k = entryKey(cid, mk);
    const all = window.dsTimeLogsAll();
    const prev = Number(all[k]) || 0;
    if (!prev) return;
    all[k] = 0;
    window.dsTimeLogsSetAll(all);
    updateStopwatchClientUI();
    if (typeof toastUndo === 'function') {
      toastUndo('Tempo mensal do cliente zerado.', () => {
        const cur = window.dsTimeLogsAll();
        cur[k] = prev;
        window.dsTimeLogsSetAll(cur);
        updateStopwatchClientUI();
      });
    }
  });

  $('ds-stopwatch-log-btn')?.addEventListener('click', () => {
    const cid = $('ds-stopwatch-client')?.value;
    if (!cid) return;
    const addSec = Math.floor(getStopwatchElapsedMs() / 1000);
    if (addSec < 5) return;
    const c = (typeof clientes !== 'undefined' ? clientes : []).find(x => String(x.id) === String(cid));
    const mk = currentMonthKey();
    const k = entryKey(cid, mk);
    const all = window.dsTimeLogsAll();
    const prev = Number(all[k]) || 0;
    all[k] = prev + addSec;
    window.dsTimeLogsSetAll(all);

    // Zera o cronômetro reutilizando o botão oficial de reset
    $('ds-stopwatch-reset')?.click();
    updateStopwatchClientUI();

    if (typeof toastUndo === 'function') {
      toastUndo(`${window.dsFormatDuration(addSec)} registrados em ${c ? c.empresa : 'cliente'}!`, () => {
        const cur = window.dsTimeLogsAll();
        cur[k] = prev;
        window.dsTimeLogsSetAll(cur);
        updateStopwatchClientUI();
      }, 8000);
    } else if (typeof toast === 'function') {
      toast(`${window.dsFormatDuration(addSec)} registrados!`, 'ok');
    }
  });

  setInterval(() => {
    if ($('sec-hoje')?.classList.contains('active') && $('ds-stopwatch-client')?.value) {
      updateStopwatchClientUI();
    }
  }, 1000);

  // Atualiza seletor de clientes do cronômetro quando clientes carregam
  const origRenderClientes = window.renderClientes;
  if (typeof origRenderClientes === 'function') {
    window.renderClientes = function () {
      const r = origRenderClientes.apply(this, arguments);
      populateStopwatchClients();
      return r;
    };
  }

  // Adiciona atalhos da Fase 2 na busca rápida (Ctrl+K)
  const origExtra = window.v68Extra;
  window.v68Extra = function (nq, out) {
    if (typeof origExtra === 'function') origExtra(nq, out);
    const q = String(nq || '').toLowerCase();
    if (!q || 'minha chave pix configurar'.includes(q)) {
      out.push({ icon: 'ti-qrcode', label: 'Configurar minha chave PIX', sub: 'Financeiro', run: () => window.v109OpenPixModal() });
    }
  };

  // Fecha modais V109 com Escape
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('v109-extras-modal')?.hidden) window.v109CloseExtrasModal();
    if (!$('v109-pix-modal')?.hidden) window.v109ClosePixModal();
  });

  // Reage à sincronização entre dispositivos (v69-js)
  window.addEventListener('ds-cfg-pulled', e => {
    const k = e.detail?.key;
    if (k === 'ds_extras_fin_v109') {
      if ($('sec-cobranca')?.classList.contains('active') && typeof renderCobranca === 'function') renderCobranca();
      if (!$('v109-extras-modal')?.hidden) renderExtrasModalList();
    } else if (k === 'ds_time_logs_v109') {
      updateStopwatchClientUI();
    }
  });

  populateStopwatchClients();
})();
