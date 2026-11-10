/**
 * TabNews (pessoal): aplicação principal (v5 — Editorial Intelligence)
 *
 * - Os dados vêm de data/news.json (ver api.js, que responde às rotas /api/* no navegador)
 * - Todo conteúdo dinâmico passa por escapeHtml (o HTML nunca recebe texto cru)
 * - Sem onclick inline: um único ouvinte de cliques (data-action)
 */

// ── Segurança ────────────────────────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const u = String(url || '').trim();
  return u.startsWith('https://') || u.startsWith('http://') ? u : '';
}

function safeImage(url) {
  const u = String(url || '').trim();
  return u.startsWith('https://') ? u : '';
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── Estado ───────────────────────────────────────────────────
const State = {
  category: 'all',          // all | favorites | history | <editoria>
  filter: 'all',            // all | today | 24h | urgent | high
  home: null,               // resposta de /api/home
  list: { items: [], page: 1, hasMore: false, total: 0 },
  meta: { counts: {}, total: 0, todayCount: 0, lastUpdated: null },
  loading: false,
  error: null,
  reqId: 0,                 // descarta respostas atrasadas quando o usuário troca de tela
  searchOpen: false,
  sidebarOpen: false,
  searchTrigger: null,
  panelTrigger: null,
  sidebarTrigger: null,
  index: new Map(),         // id -> notícia (para favoritar, compartilhar, marcar como lida)
};

function currentView() {
  if (State.category === 'favorites') return 'favorites';
  if (State.category === 'history') return 'history';
  if (State.category === 'all' && State.filter === 'all') return 'home';
  return 'list';
}

function remember(items) {
  (items || []).forEach(n => State.index.set(n.id, n));
}

function findItem(id) {
  return State.index.get(id)
    || Store.getFavorites().find(n => n.id === id)
    || Store.getHistory().find(n => n.id === id);
}

// ── Formatação ───────────────────────────────────────────────
function formatRelativeDate(iso) {
  const date = new Date(iso);
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d atrás`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ── Ícones de linha por editoria (substituem os emojis) ──────
const CAT_SVG = {
  futebol: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.4 4.4H9.6l-1.4-4.4z"/><path d="M12 7.5V3M15.8 10.3l4.2-1.4M14.4 14.7l2.6 3.5M9.6 14.7l-2.6 3.5M8.2 10.3L4 8.9"/>',
  politica: '<path d="M3 20h18M5 20V10M9.5 20V10M14.5 20V10M19 20V10"/><path d="M12 3L3 9h18z"/>',
  ia: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/><circle cx="12" cy="12" r="1.8"/>',
  design: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.6-1.2-2.7 0-.9.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.3" r="1"/><circle cx="15" cy="7.8" r="1"/>',
  marketing: '<path d="M3 12v3a1 1 0 0 0 1 1h2l8 4V4L6 8H4a1 1 0 0 0-1 1z" transform="translate(0 0)"/><path d="M18 9a4.5 4.5 0 0 1 0 6"/><path d="M6.5 16l1 4.5"/>',
  all: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/>',
};
function catSvg(key, cls = 'cat-svg') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_SVG[key] || CAT_SVG.all}</svg>`;
}

function categoryOf(key) {
  return CATEGORIES[key] || { label: key, icon: '📰', color: '#7c84f0' };
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'default') {
  const wrap = $('#toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out .25s ease-in forwards';
    setTimeout(() => el.remove(), 250);
  }, 3000);
}

// ── Peças de HTML ────────────────────────────────────────────
function renderSkeletons(count = 6) {
  return `<div class="news-grid">${Array(count).fill(`
    <div class="item item-skeleton">
      <div class="skeleton sk-meta"></div>
      <div class="skeleton sk-title"></div>
      <div class="skeleton sk-title sk-short"></div>
      <div class="skeleton sk-text"></div>
    </div>`).join('')}</div>`;
}

function badgeHtml(importance) {
  const info = IMPORTANCE[importance];
  if (!info) return '';
  return `<span class="badge ${info.cls}">${escapeHtml(info.label)}</span>`;
}

function aiBlockHtml(item) {
  const ai = item.aiSummary;
  if (!ai || (!ai.summary && !(ai.points || []).length)) return '';

  const summary = ai.summary ? `<p>${escapeHtml(ai.summary)}</p>` : '';
  const points = Array.isArray(ai.points) && ai.points.length
    ? '<ul class="card-ai-points">' + ai.points.map(p => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>'
    : '';
  const id = escapeHtml(item.id);

  return `
    <button type="button" class="card-expand-btn" data-action="toggle-ai" data-id="${id}" aria-expanded="false" aria-controls="ai-${id}">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>
      <span>Ver resumo da IA</span>
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="card-ai" id="ai-${id}">
      <div class="card-ai-content">${summary}${points}</div>
    </div>`;
}

function gapLabel(fromIso, toIso) {
  const m = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
  if (m < 1) return 'ao mesmo tempo';
  if (m < 60) return `+${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `+${h} h` : `+${Math.round(h / 24)} d`;
}

/** Outras fontes que publicaram a mesma notícia (o cartão é o de quem deu primeiro). */
function alsoHtml(item) {
  if (!item.also?.length) return '';
  const chips = item.also.map(a => {
    const link = safeUrl(a.link);
    const label = `${escapeHtml(a.source)} <small>${escapeHtml(gapLabel(item.date, a.date))}</small>`;
    return link
      ? `<a class="also-chip" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : `<span class="also-chip">${label}</span>`;
  }).join('');
  return `<div class="item-also"><span class="also-first">${escapeHtml(item.source)} deu primeiro</span><span class="also-label">Também em</span>${chips}</div>`;
}

function renderCard(item) {
  const cat = categoryOf(item.category);
  const id = escapeHtml(item.id);
  const link = safeUrl(item.link);
  const image = safeImage(item.image);
  const isFav = Store.isFavorite(item.id);
  const isRead = Store.isRead(item.id);

  const titleHtml = link
    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" data-action="open-panel" data-id="${id}">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);

  return `
    <article class="item${isRead ? ' read' : ''}" id="card-${id}" style="--c:${escapeHtml(cat.color)}">
      <div class="item-body">
        <div class="item-meta">
          <span class="item-cat">${escapeHtml(cat.label)}</span>
          <span class="item-src">${escapeHtml(item.source)}</span>
          <time class="item-date" datetime="${escapeHtml(item.date)}">${escapeHtml(formatRelativeDate(item.date))}</time>
          ${badgeHtml(item.importance)}
        </div>
        <h2 class="item-title">${titleHtml}</h2>
        ${item.summary ? `<p class="item-summary">${escapeHtml(item.summary)}</p>` : ''}
        ${alsoHtml(item)}
        ${aiBlockHtml(item)}
      </div>
      <div class="item-side">
        ${image ? `<a class="item-thumb" href="${escapeHtml(link || '#')}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true" data-action="open-panel" data-id="${id}"><img class="item-img" src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>` : ''}
        <div class="item-actions">
          <button type="button" class="icon-btn ${isFav ? 'active' : ''}" id="fav-${id}" data-action="favorite" data-id="${id}"
                  aria-pressed="${isFav}" aria-label="${isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}" title="${isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}">
            <svg width="15" height="15" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          </button>
          <button type="button" class="icon-btn" data-action="share" data-id="${id}" aria-label="Compartilhar" title="Compartilhar">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function renderTrends(trends) {
  return `
    <div class="trends" aria-label="Assuntos em alta">
      <span class="trends-label">Assuntos em alta</span>
      ${trends.map(t => `<button type="button" class="trend-chip" data-action="trend" data-q="${escapeHtml(t.title)}">${escapeHtml(t.title)}<small title="${escapeHtml(t.count)} notícias nas últimas 24h">${escapeHtml(t.count)}</small></button>`).join('')}
    </div>`;
}

function sectionHtml(title, color, count, bodyHtml, moreCategory = null, hideCat = false) {
  return `
    <section class="news-section">
      <div class="section-header">
        <h3 class="section-title"><span class="sec-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(title)} <span class="section-count">${count}</span></h3>
        ${moreCategory ? `<button type="button" class="section-more" data-action="category" data-value="${escapeHtml(moreCategory)}">Ver todas</button>` : ''}
      </div>
      <div class="news-grid${hideCat ? ' hide-cat' : ''}">${bodyHtml}</div>
    </section>`;
}

function emptyStateHtml(icon, title, sub, actionHtml = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${catSvg('all', 'empty-svg')}</div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <div class="empty-state-sub">${escapeHtml(sub)}</div>
      ${actionHtml}
    </div>`;
}

const loadMoreHtml = `
  <div class="load-more-wrap">
    <button type="button" class="load-more-btn" data-action="load-more">Carregar mais</button>
  </div>`;

// ── Render principal ─────────────────────────────────────────
function render() {
  const content = $('#mainContent');
  const view = currentView();

  content.setAttribute('aria-busy', String(State.loading));
  $('#filtersBar').hidden = view === 'favorites' || view === 'history';

  if (State.error && !(view === 'home' && State.home) && !(view === 'list' && State.list.items.length)) {
    content.innerHTML = emptyStateHtml(
      '↻', 'Não foi possível carregar as notícias', State.error,
      '<button type="button" class="retry-btn" data-action="retry">Tentar de novo</button>'
    );
    return;
  }

  if (view === 'favorites' || view === 'history') {
    const items = view === 'favorites' ? Store.getFavorites() : Store.getHistory();
    remember(items);
    if (!items.length) {
      content.innerHTML = view === 'favorites'
        ? emptyStateHtml('☆', 'Nenhum favorito ainda', 'Use a estrela em uma notícia para montar sua lista de leitura.')
        : emptyStateHtml('◷', 'Histórico vazio', 'As notícias que você abrir aparecerão nesta lista.');
      return;
    }
    const clearBtn = view === 'history'
      ? '<button type="button" class="section-more" data-action="clear-history">Limpar histórico</button>' : '';
    content.innerHTML = `
      <div class="section-header">
        <h3 class="section-title">${view === 'favorites' ? 'Favoritos' : 'Histórico'} <span class="section-count">${items.length}</span></h3>${clearBtn}
      </div>
      <div class="news-grid">${items.map(n => renderCard(n)).join('')}</div>`;
    return;
  }

  if (State.loading && ((view === 'home' && !State.home) || (view === 'list' && !State.list.items.length))) {
    content.innerHTML = renderSkeletons(6);
    return;
  }

  if (view === 'home') return renderHome(content);
  return renderList(content);
}

/** Capa tipográfica para notícias sem foto: grade, brilho da editoria, ícone grande e a fonte. */
function coverHtml(item, cat) {
  return `<div class="cover" aria-hidden="true">
    <span class="cover-grid"></span><span class="cover-glow"></span>
    ${catSvg(item.category, 'cover-ico')}
    <span class="cover-label">${escapeHtml(cat.label)}</span>
    <span class="cover-src">${escapeHtml(item.source || '')}</span>
  </div>`;
}

/** Radar das últimas 24h: barras por editoria + novidades desde a última visita. */
function briefingHtml() {
  const items = API._data?.itens || [];
  if (!items.length) return '';
  const now = Date.now();
  const day = items.filter(n => now - new Date(n.date) <= 24 * 3600000);
  const base = day.length >= 3 ? day : items;
  const counts = {};
  base.forEach(n => { counts[n.category] = (counts[n.category] || 0) + 1; });
  const rows = Object.entries(CATEGORIES).filter(([k]) => k !== 'all' && counts[k])
    .sort((a, b) => counts[b[0]] - counts[a[0]]);
  if (!rows.length) return '';
  const max = counts[rows[0][0]];
  const lead = rows[0][1];
  const prev = State.prevVisit;
  const fresh = prev ? items.filter(n => new Date(n.date).getTime() > prev).length : 0;
  const period = base === day ? 'nas últimas 24h' : 'no período';
  return `
    <section class="briefing" aria-label="Resumo do dia">
      <div class="briefing-head">
        <span class="briefing-kicker"><span class="status-pulse"></span> Resumo do dia</span>
        <p class="briefing-text"><strong>${base.length.toLocaleString('pt-BR')} notícias</strong> ${period}. <span style="--c:${escapeHtml(lead.color)}" class="briefing-lead">${escapeHtml(lead.label)}</span> lidera o ciclo.</p>
        ${fresh > 0 ? `<button type="button" class="fresh-chip" data-action="filter" data-value="24h">${fresh.toLocaleString('pt-BR')} novas desde sua última visita</button>` : ''}
      </div>
      <div class="briefing-bars">
        ${rows.map(([k, c]) => `
          <button type="button" class="bar-row" data-action="category" data-value="${escapeHtml(k)}" style="--c:${escapeHtml(c.color)}">
            <span class="bar-ico">${catSvg(k)}</span>
            <span class="bar-name">${escapeHtml(c.label)}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${Math.max(6, Math.round(counts[k] / max * 100))}%"></span></span>
            <span class="bar-num">${counts[k]}</span>
          </button>`).join('')}
      </div>
    </section>`;
}

function featuredHtml(list) {
  if (!list?.length) return '';
  const [main, ...rest] = list;
  const cat = categoryOf(main.category);
  const image = safeImage(main.image);
  const id = escapeHtml(main.id);
  const isFav = Store.isFavorite(main.id);
  const side = rest.map(n => {
    const c = categoryOf(n.category);
    return `
      <button type="button" class="feat-row" data-action="open-panel" data-id="${escapeHtml(n.id)}" style="--c:${escapeHtml(c.color)}">
        <span class="feat-row-cat"><span class="sec-dot" style="background:${escapeHtml(c.color)}"></span>${escapeHtml(c.label)}</span>
        <span class="feat-row-title">${escapeHtml(n.title)}</span>
        ${n.summary ? `<span class="feat-row-sum">${escapeHtml(n.summary)}</span>` : ''}
        <span class="feat-row-meta">${escapeHtml(n.source)} · ${escapeHtml(formatRelativeDate(n.date))}${n.also?.length ? ` · ${n.also.length + 1} fontes` : ''}</span>
      </button>`;
  }).join('');
  return `
    <section class="featured" aria-label="Notícia em destaque">
      <article class="feat-main" id="card-${id}" style="--c:${escapeHtml(cat.color)}">
        <div class="feat-media${image ? '' : ' no-img'}" data-cat="${escapeHtml(main.category)}" data-src="${escapeHtml(main.source || '')}">
          ${image ? `<img class="item-img" src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : coverHtml(main, cat)}
          <span class="feat-tag">Em destaque</span>
        </div>
        <div class="feat-body">
          <div class="item-meta">
            <span class="item-cat">${escapeHtml(cat.label)}</span>
            <span class="item-src">${escapeHtml(main.source)}</span>
            <time class="item-date" datetime="${escapeHtml(main.date)}">${escapeHtml(formatRelativeDate(main.date))}</time>
            ${badgeHtml(main.importance)}
          </div>
          <h2 class="feat-title"><a href="${escapeHtml(safeUrl(main.link) || '#')}" data-action="open-panel" data-id="${id}">${escapeHtml(main.title)}</a></h2>
          ${main.summary ? `<p class="feat-summary">${escapeHtml(main.summary)}</p>` : ''}
          ${alsoHtml(main)}
          <div class="feat-actions">
            <button type="button" class="btn-primary" data-action="open-panel" data-id="${id}">Ler resumo</button>
            <button type="button" class="icon-btn ${isFav ? 'active' : ''}" id="fav-${id}" data-action="favorite" data-id="${id}" aria-pressed="${isFav}" aria-label="Favoritar" title="Favoritar">
              <svg width="17" height="17" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            </button>
          </div>
        </div>
      </article>
      <div class="feat-side">${side}</div>
    </section>`;
}

function stripHtml(title, color, count, items, category) {
  const key = escapeHtml(category);
  return `
    <section class="news-section strip-section">
      <div class="section-header">
        <h3 class="section-title"><span class="sec-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(title)} <span class="section-count">${count}</span></h3>
        <div class="strip-nav">
          <button type="button" class="strip-btn" data-action="strip" data-value="-1" data-id="${key}" aria-label="Anteriores">‹</button>
          <button type="button" class="strip-btn" data-action="strip" data-value="1" data-id="${key}" aria-label="Próximas">›</button>
        </div>
        <button type="button" class="section-more" data-action="category" data-value="${key}">Ver todas</button>
      </div>
      <div class="strip hide-cat" id="strip-${key}">${items.map(n => renderCard(n)).join('')}</div>
    </section>`;
}

function renderHome(content) {
  const h = State.home;
  if (!h) { content.innerHTML = renderSkeletons(6); return; }

  const parts = [];
  if (h.trends?.length) parts.push(renderTrends(h.trends));
  parts.push(briefingHtml());
  parts.push(featuredHtml(h.featured));
  for (const s of h.sections || []) {
    const cat = CATEGORIES[s.category];
    if (!cat) continue;
    parts.push(stripHtml(cat.label, cat.color, s.total, s.items, s.category));
  }

  content.innerHTML = parts.join('') || (h.lastUpdated
    ? emptyStateHtml('🗞️', 'Ainda não há notícias', 'A coleta é atualizada automaticamente. Tente novamente em instantes.')
    : emptyStateHtml('🗞️', 'O arquivo de notícias ainda está vazio', 'No GitHub, abra Actions, escolha "Atualizar notícias" e clique em Run workflow. Em cerca de 1 minuto as notícias aparecem aqui.'));
}

function renderList(content) {
  const { items, hasMore, total } = State.list;
  const cat = categoryOf(State.category);

  if (!items.length) {
    content.innerHTML = emptyStateHtml('⌕', 'Nenhuma notícia encontrada',
      'Tente outro filtro ou volte mais tarde.');
    return;
  }

  const filterLabel = { today: 'hoje', '24h': 'últimas 24h', urgent: 'urgentes', high: 'destaques' }[State.filter];
  const title = State.category === 'all' ? 'Todas as notícias' : cat.label;
  content.innerHTML = `
    <div class="section-header">
      <h3 class="section-title"><span class="sec-dot" style="background:${escapeHtml(cat.color)}"></span>${escapeHtml(title)}${filterLabel ? ` (${escapeHtml(filterLabel)})` : ''}
        <span class="section-count">${total}</span></h3>
    </div>
    <div class="news-grid${State.category !== 'all' ? ' hide-cat' : ''}">${items.map(n => renderCard(n)).join('')}</div>
    ${hasMore ? loadMoreHtml : ''}`;
}

// ── Cabeçalho, menu e contadores ─────────────────────────────
function buildChrome() {
  const editorias = Object.entries(CATEGORIES).filter(([key]) => key !== 'all');

  $('#categoryNav').innerHTML = editorias.map(([key, c]) => `
    <button type="button" class="nav-item" data-action="category" data-value="${escapeHtml(key)}">
      <span class="nav-emoji" style="--c:${escapeHtml(c.color)}">${catSvg(key)}</span>
      <span class="nav-text">${escapeHtml(c.label)}</span>
      <span class="nav-badge" id="badge-${escapeHtml(key)}">0</span>
    </button>`).join('');

  $('#categoryTabs').innerHTML =
    `<button type="button" class="tab active" role="tab" aria-selected="true" data-action="category" data-value="all">Todas</button>` +
    editorias.map(([key, c]) =>
      `<button type="button" class="tab" role="tab" aria-selected="false" data-action="category" data-value="${escapeHtml(key)}">${escapeHtml(c.label)}</button>`
    ).join('');
}

function updateChrome() {
  $$('[data-action="category"]').forEach(el => {
    const active = el.dataset.value === State.category;
    if (el.classList.contains('nav-item') || el.classList.contains('tab')) {
      el.classList.toggle('active', active);
      if (el.classList.contains('tab')) el.setAttribute('aria-selected', String(active));
    }
  });
  $$('.mobile-nav-item').forEach(el => {
    const active = el.dataset.navGroup === 'categories'
      ? !['all', 'favorites', 'history'].includes(State.category)
      : el.dataset.value === State.category;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  $$('.filter-btn').forEach(el => el.classList.toggle('active', el.dataset.value === State.filter));

  const { counts, total, todayCount, lastUpdated } = State.meta;
  $('#badge-all').textContent = total;
  $('#badge-favorites').textContent = Store.getFavoritesCount();
  $('#badge-history').textContent = Store.getHistoryCount();
  Object.keys(CATEGORIES).forEach(key => {
    if (key === 'all') return;
    const badge = $(`#badge-${key}`);
    if (badge) badge.textContent = counts[key] || 0;
    const chip = $(`#chip-${key}`);
    if (chip) chip.textContent = counts[key] || 0;
  });
  const today = $('#todayCount');
  if (today) today.textContent = todayCount;
  $('#lastUpdated').textContent = lastUpdated ? formatDateTime(lastUpdated) : '—';
  updateUnread();

  const label = { all: null, favorites: 'Favoritos', history: 'Histórico' }[State.category] ?? categoryOf(State.category).label;
  document.title = label ? `${label} | TabNews` : 'TabNews | Futebol, política, IA, design e marketing';
}

/** Quantas notícias carregadas ainda não foram abertas (usa o histórico deste navegador/grupo). */
function updateUnread() {
  const el = $('#statUnread');
  if (!el) return;
  const read = new Set(Store.getHistory().map(h => h.id));
  const items = API._data?.itens || [];
  el.textContent = items.filter(n => !read.has(n.id)).length.toLocaleString('pt-BR');
}

function applyMeta(data) {
  State.meta = {
    counts: data.counts || {},
    total: data.total ?? 0,
    todayCount: data.todayCount ?? 0,
    lastUpdated: data.lastUpdated || null,
  };
  updateChrome();
  const put = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  put('#statTotal', State.meta.total.toLocaleString('pt-BR'));
  put('#statToday', State.meta.todayCount.toLocaleString('pt-BR'));
  updateUnread();
}

// ── Carregamento de dados ────────────────────────────────────
async function loadHome({ force = false, silent = false } = {}) {
  const req = ++State.reqId;
  let skipRender = false;
  if (!silent) { State.loading = true; State.error = null; render(); }
  $('#btnRefresh')?.classList.add('loading');

  try {
    if (force) API.clearCache();
    const data = await API.get('/api/home');
    if (req !== State.reqId) return;
    // Revalidação automática sem notícia nova: não redesenha (preserva rolagem das faixas e resumos abertos).
    if (silent && State.home && State.home.lastUpdated && State.home.lastUpdated === data.lastUpdated) {
      skipRender = true;
      refreshRelativeTimes();
      return;
    }
    State.home = data;
    (data.sections || []).forEach(s => remember(s.items));
    remember(data.featured);
    State.error = null;
    applyMeta(data);
    if (force) showToast('Notícias atualizadas', 'success');
  } catch (e) {
    if (req !== State.reqId) return;
    console.warn('[TabNews]', e);
    if (silent) return;
    if (State.home) showToast('Não foi possível atualizar. Mostrando as últimas notícias carregadas.', 'error');
    else State.error = describeError(e);
  } finally {
    if (req === State.reqId) {
      State.loading = false;
      if (!skipRender) render();
      $('#btnRefresh')?.classList.remove('loading');
    }
  }
}

/** Atualiza só os "há X min" na tela, sem refazer a lista. */
function refreshRelativeTimes() {
  $$('time.item-date[datetime]').forEach(el => {
    const text = formatRelativeDate(el.getAttribute('datetime'));
    if (el.textContent !== text) el.textContent = text;
  });
}

async function loadList({ reset = true, force = false } = {}) {
  const req = ++State.reqId;
  if (reset) {
    State.list = { items: [], page: 1, hasMore: false, total: 0 };
    State.loading = true;
    State.error = null;
    render();
  }
  const page = reset ? 1 : State.list.page + 1;
  $('#btnRefresh')?.classList.add('loading');

  try {
    if (force) API.clearCache();
    const params = new URLSearchParams({ limit: CONFIG.PAGE_SIZE, page });
    if (State.category !== 'all') params.set('category', State.category);
    if (State.filter !== 'all') params.set('filter', State.filter);

    const res = await API.get(`/api/news?${params}`);
    if (req !== State.reqId) return;
    remember(res.items);
    State.list = {
      items: reset ? res.items : [...State.list.items, ...res.items],
      page, hasMore: res.hasMore, total: res.total,
    };
    if (force) showToast('Notícias atualizadas', 'success');
  } catch (e) {
    if (req !== State.reqId) return;
    console.warn('[TabNews]', e);
    if (reset) State.error = describeError(e);
    else showToast('Não foi possível carregar mais notícias', 'error');
  } finally {
    if (req === State.reqId) {
      State.loading = false;
      render();
      $('#btnRefresh')?.classList.remove('loading');
    }
  }
}

async function loadMeta() {
  try {
    applyMeta(await API.get('/api/dashboard'));
  } catch (e) {
    console.warn('[TabNews] contadores indisponíveis', e);
  }
}

function loadCurrent({ force = false } = {}) {
  const view = currentView();
  if (force) API.clearCache();
  if (view === 'home') return loadHome({ force });
  if (view === 'list') {
    if (!State.home || force) loadMeta();   // deep link ou atualização manual: refaz os contadores
    return loadList({ reset: true, force });
  }
  State.reqId++;                           // favoritos/histórico são locais
  State.loading = false;
  State.error = null;
  if (!State.home) loadMeta();
  render();
}

// ── Navegação ────────────────────────────────────────────────
const HASH_TO_CAT = { todas: 'all', favoritos: 'favorites', historico: 'history' };
const CAT_TO_HASH = { all: 'todas', favorites: 'favoritos', history: 'historico' };

function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (HASH_TO_CAT[h]) return HASH_TO_CAT[h];
  return CATEGORIES[h] && h !== 'all' ? h : 'all';
}

function go(category, { filter } = {}) {
  State.category = category;
  if (filter !== undefined) State.filter = filter;
  else if (category === 'favorites' || category === 'history') State.filter = 'all';

  const hash = '#' + (CAT_TO_HASH[category] || category);
  if (location.hash !== hash) history.pushState(null, '', hash);

  updateChrome();
  closeSidebar();
  loadCurrent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setFilter(filter) {
  State.filter = State.filter === filter && filter !== 'all' ? 'all' : filter;
  updateChrome();
  loadCurrent();
}

// ── Menu lateral (mobile) ────────────────────────────────────
function openSidebar() {
  if (State.sidebarOpen) return;
  State.sidebarTrigger = document.activeElement;
  State.sidebarOpen = true;
  $('#sidebar').classList.add('mobile-open');
  $('#sidebarOverlay').classList.add('active');
  $('#sidebarOverlay').setAttribute('aria-hidden', 'false');
  $('#btnMobileMenu').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  $('#mainNav .nav-item')?.focus({ preventScroll: true });
}

function closeSidebar() {
  if (!State.sidebarOpen) return;
  State.sidebarOpen = false;
  $('#sidebar').classList.remove('mobile-open');
  $('#sidebarOverlay').classList.remove('active');
  $('#sidebarOverlay').setAttribute('aria-hidden', 'true');
  $('#btnMobileMenu')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  const trigger = State.sidebarTrigger;
  State.sidebarTrigger = null;
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
}

// ── Ações nos cartões ────────────────────────────────────────
function markRead(id) {
  const item = findItem(id);
  if (!item) return;
  Store.markRead(item);
  document.getElementById(`card-${id}`)?.classList.add('read');
  updateUnread();
  $('#badge-history').textContent = Store.getHistoryCount();
}

function toggleFavorite(id) {
  const item = findItem(id);
  if (!item) return;
  const added = Store.toggleFavorite(item);

  if (currentView() === 'favorites') {
    render();
  } else {
    const btn = document.getElementById(`fav-${id}`);
    if (btn) {
      btn.classList.toggle('active', added);
      btn.setAttribute('aria-pressed', String(added));
      btn.setAttribute('aria-label', added ? 'Remover dos favoritos' : 'Salvar nos favoritos');
      btn.querySelector('svg')?.setAttribute('fill', added ? 'currentColor' : 'none');
    }
  }
  $('#badge-favorites').textContent = Store.getFavoritesCount();
  refreshPanelFav();
  showToast(added ? 'Adicionado aos favoritos' : 'Removido dos favoritos', added ? 'success' : 'default');
}

function shareItem(id) {
  const item = findItem(id);
  const link = safeUrl(item?.link);
  if (!item || !link) return;
  if (navigator.share) {
    navigator.share({ title: item.title, url: link }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(link)
      .then(() => showToast('Link copiado', 'success'))
      .catch(() => showToast('Não foi possível copiar o link', 'error'));
  }
}

function toggleAI(btn, id) {
  const panel = document.getElementById(`ai-${id}`);
  if (!panel) return;
  const open = panel.classList.toggle('visible');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
  const label = btn.querySelector('span');
  if (label) label.textContent = open ? 'Ocultar resumo' : 'Ver resumo da IA';
}

// ── Painel lateral da notícia ────────────────────────────────
State.panelId = null;

function panelHtml(item) {
  const cat = categoryOf(item.category);
  const id = escapeHtml(item.id);
  const link = safeUrl(item.link);
  const image = safeImage(item.image);
  const isFav = Store.isFavorite(item.id);
  const ai = item.aiSummary;
  const points = Array.isArray(ai?.points) && ai.points.length
    ? '<ul class="panel-points">' + ai.points.map(p => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>' : '';
  const aiBlock = ai && (ai.summary || points)
    ? `<div class="panel-ai"><div class="panel-ai-label">Resumo por IA</div>${ai.summary ? `<p>${escapeHtml(ai.summary)}</p>` : ''}${points}</div>` : '';
  const also = item.also?.length
    ? `<div class="panel-also"><div class="panel-label">Também publicado em</div>${item.also.map(a => {
        const l = safeUrl(a.link);
        return `<a class="panel-also-row" ${l ? `href="${escapeHtml(l)}" target="_blank" rel="noopener noreferrer"` : ''}><span>${escapeHtml(a.source)}</span><small>${escapeHtml(gapLabel(item.date, a.date))} depois</small></a>`;
      }).join('')}</div>` : '';

  return `
    <div class="panel-media${image ? '' : ' no-img'}" data-cat="${escapeHtml(item.category)}" data-src="${escapeHtml(item.source || '')}" style="--c:${escapeHtml(cat.color)}">
      ${image ? `<img class="item-img" src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer">` : coverHtml(item, cat)}
    </div>
    <div class="panel-body">
      <div class="item-meta">
        <span class="item-cat" style="--c:${escapeHtml(cat.color)}">${escapeHtml(cat.label)}</span>
        <span class="item-src">${escapeHtml(item.source)}</span>
        <time class="item-date">${escapeHtml(formatDateTime(item.date))}</time>
        ${badgeHtml(item.importance)}
      </div>
      <h2 class="panel-title">${escapeHtml(item.title)}</h2>
      ${item.also?.length ? `<div class="item-also"><span class="also-first">${escapeHtml(item.source)} deu primeiro</span></div>` : ''}
      ${item.summary ? `<p class="panel-summary">${escapeHtml(item.summary)}</p>` : ''}
      ${aiBlock}
      ${also}
      <div class="panel-actions">
        ${link ? `<a class="btn-primary" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" data-action="read" data-id="${id}">Ler matéria original</a>` : ''}
        <button type="button" class="btn-ghost ${isFav ? 'active' : ''}" id="panel-fav" data-action="favorite" data-id="${id}" aria-pressed="${isFav}">${isFav ? 'Salvo nos favoritos' : 'Salvar nos favoritos'}</button>
        <button type="button" class="btn-ghost" data-action="share" data-id="${id}">Compartilhar</button>
      </div>
      <p class="panel-note">O resumo usa só o título e o trecho publicados pela fonte. Confira a matéria original.</p>
    </div>`;
}

function openPanel(id) {
  const item = findItem(id);
  if (!item) return;
  const trigger = State.panelId ? State.panelTrigger : document.activeElement;   // navegando dentro do painel mantém o gatilho original
  if (State.searchOpen) closeSearch();
  State.panelTrigger = trigger;
  State.panelId = id;
  markRead(id);
  $('#panelContent').innerHTML = panelHtml(item);
  $('#newsPanel').classList.add('open');
  $('#panelBackdrop').classList.add('open');
  $('#newsPanel').setAttribute('aria-hidden', 'false');
  $('#panelContent').scrollTop = 0;
  $('#panelClose').focus({ preventScroll: true });
}

/** Ids das notícias visíveis na tela, na ordem em que aparecem (base do "anterior / próxima"). */
function visibleNewsIds() {
  const seen = new Set();
  return $$('#mainContent [data-action="open-panel"][data-id]')
    .filter(el => el.getClientRects().length > 0)
    .map(el => el.dataset.id)
    .filter(id => !seen.has(id) && seen.add(id));
}

function navigatePanel(dir) {
  if (!State.panelId) return;
  const ids = visibleNewsIds();
  const next = ids[ids.indexOf(State.panelId) + dir];
  if (next) openPanel(next);
  else showToast(dir > 0 ? 'Fim da lista' : 'Início da lista');
}

function closePanel() {
  if (!State.panelId) return;
  State.panelId = null;
  $('#newsPanel').classList.remove('open');
  $('#panelBackdrop').classList.remove('open');
  $('#newsPanel').setAttribute('aria-hidden', 'true');
  const trigger = State.panelTrigger;
  State.panelTrigger = null;
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
}

function refreshPanelFav() {
  const btn = $('#panel-fav');
  if (!btn || !State.panelId) return;
  const on = Store.isFavorite(State.panelId);
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'Salvo nos favoritos' : 'Salvar nos favoritos';
}

// ── Busca ────────────────────────────────────────────────────
function openSearch() {
  if (State.searchOpen) return;
  if (State.sidebarOpen) closeSidebar();
  State.searchTrigger = document.activeElement;
  State.searchOpen = true;
  $('#searchOverlay').classList.add('open');
  $('#searchOverlay').setAttribute('aria-hidden', 'false');
  renderSearchHint();
  setTimeout(() => $('#searchInput')?.focus(), 50);
}

function closeSearch() {
  if (!State.searchOpen) return;
  State.searchOpen = false;
  $('#searchOverlay').classList.remove('open');
  $('#searchOverlay').setAttribute('aria-hidden', 'true');
  const input = $('#searchInput');
  if (input) input.value = '';
  const trigger = State.searchTrigger;
  State.searchTrigger = null;
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
}

function renderSearchHint() {
  $('#searchResults').innerHTML = `
    <div class="search-empty">Digite para buscar em todas as editorias</div>`;
}

let searchTimer;
let searchReq = 0;

function handleSearchInput(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { searchReq++; renderSearchHint(); return; }
  searchTimer = setTimeout(() => performSearch(q), 300);
}

async function performSearch(q) {
  const el = $('#searchResults');
  const req = ++searchReq;
  el.innerHTML = '<div class="search-empty">Buscando…</div>';

  let results;
  try {
    results = (await API.get(`/api/search?q=${encodeURIComponent(q)}`)).items || [];
  } catch (e) {
    if (req !== searchReq) return;
    el.innerHTML = `<div class="search-empty">${escapeHtml(describeError(e))}</div>`;
    return;
  }
  if (req !== searchReq) return;

  if (!results.length) {
    el.innerHTML = `<div class="search-empty">Nenhum resultado para "${escapeHtml(q)}"</div>`;
    return;
  }
  remember(results);
  el.innerHTML = results.slice(0, 10).map(n => {
    const cat = categoryOf(n.category);
    const link = safeUrl(n.link);
    return `
      <a class="search-result-item" href="${escapeHtml(link || '#')}" ${link ? 'target="_blank" rel="noopener noreferrer"' : ''} data-action="open-panel" data-id="${escapeHtml(n.id)}">
        <div class="search-result-icon"><span class="nav-icon" style="background:${escapeHtml(cat.color)}"></span></div>
        <div class="search-result-body">
          <div class="search-result-title">${escapeHtml(n.title)}</div>
          <div class="search-result-meta" style="color:${escapeHtml(cat.color)}">${escapeHtml(cat.label)} · ${escapeHtml(n.source)} · ${escapeHtml(formatRelativeDate(n.date))}</div>
        </div>
      </a>`;
  }).join('');
}

// ── Eventos (um único ouvinte) ───────────────────────────────
// ── Modo de exibição: lista ou cards (lembrado neste navegador) ──
function setView(v) {
  const mode = v === 'cards' ? 'cards' : 'list';
  document.documentElement.dataset.view = mode;
  document.querySelectorAll('.view-btn').forEach(b => {
    const active = b.dataset.value === mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  try { localStorage.setItem('tn_view', mode); } catch { /* ignore */ }
}

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, value, id } = el.dataset;

  // Ctrl/⌘/Shift/botão do meio no título: deixa abrir a matéria normalmente numa aba
  if (action === 'open-panel' && el.tagName === 'A' && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) { markRead(id); return; }
  if (action === 'open-panel' || (action === 'category' && el.tagName === 'A')) e.preventDefault();

  switch (action) {
    case 'open-panel':    openPanel(id); break;
    case 'close-panel':   closePanel(); break;
    case 'panel-prev':    navigatePanel(-1); break;
    case 'panel-next':    navigatePanel(1); break;
    case 'strip': {
      const strip = document.getElementById(`strip-${id}`);
      strip?.scrollBy({ left: Number(value) * Math.max(280, strip.clientWidth * 0.85), behavior: 'smooth' });
      break;
    }
    case 'category':      closePanel(); go(value); break;
    case 'today':         go('all', { filter: 'today' }); break;
    case 'filter':        setFilter(value); break;
    case 'refresh':       loadCurrent({ force: true }); break;
    case 'retry':         loadCurrent({ force: true }); break;
    case 'load-more':     loadList({ reset: false }); break;
    case 'favorite':      toggleFavorite(id); break;
    case 'share':         shareItem(id); break;
    case 'toggle-ai':     toggleAI(el, id); break;
    case 'read':          markRead(id); if (State.searchOpen) closeSearch(); return;   // deixa o link abrir
    case 'trend':         openSearch(); $('#searchInput').value = el.dataset.q; performSearch(el.dataset.q); break;
    case 'view':          setView(value); break;
    case 'open-search':   openSearch(); break;
    case 'close-search':  closeSearch(); break;
    case 'open-sidebar':  openSidebar(); break;
    case 'close-sidebar': closeSidebar(); break;
    case 'clear-history':
      if (confirm(Sync.on ? 'Limpar o histórico de leitura de todo o grupo?' : 'Limpar todo o histórico de leitura?')) {
        Store.clearHistory();
        updateChrome();
        render();
      }
      break;
    default: return;
  }
}

function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if (e.target?.id === 'headerSearchInput' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openSearch();
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (State.panelId && !State.searchOpen && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); navigatePanel(1); }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); navigatePanel(-1); }
  }
  if (e.key === 'Escape') {
    if (State.searchOpen) closeSearch();
    else if (State.panelId) closePanel();
    if (State.sidebarOpen) closeSidebar();
  }

  // Keep keyboard focus inside the active dialog until it is dismissed.
  if (e.key === 'Tab' && (State.searchOpen || State.panelId)) {
    const dialog = State.searchOpen ? $('#searchOverlay') : $('#newsPanel');
    const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

// ── Atualização automática (só página inicial, só com a aba visível) ─
let lastAutoRefresh = Date.now();

function autoRefresh() {
  if (document.hidden || currentView() !== 'home') return;
  if (Date.now() - lastAutoRefresh < CONFIG.AUTO_REFRESH - 1000) return;
  lastAutoRefresh = Date.now();
  API.clearCache();
  loadHome({ silent: true });
}

// ── Estado das fontes (data/status.json) ────────────────────
async function loadSources() {
  const el = $('#sourcesStatus');
  if (!el) return;
  const st = await API.status();
  if (!st?.fontes?.length) { el.textContent = 'Ainda sem verificação de fontes.'; return; }
  const ok = st.fontes.filter(f => f.ok).length;
  const bad = st.fontes.filter(f => !f.ok);
  const quiet = st.fontes.filter(f => f.ok && f.count === 0);
  const detail = f => {
    if (!f.ok) return escapeHtml(f.erro || 'Falha ao consultar');
    if (f.count === 0) return `Feed acessível · ${Number(f.filtradas || 0)} entradas ignoradas por data ou filtro`;
    const origin = f.modo === 'html-fallback' ? ' · captura pela página do site' : '';
    return `${Number(f.count)} notícias válidas${origin} · ${Number(f.ms || 0)} ms`;
  };
  el.innerHTML = `<strong>${ok} de ${st.fontes.length}</strong> feeds acessíveis` +
    (quiet.length ? `<details class="sources-bad"><summary>Sem notícias válidas agora (${quiet.length})</summary><ul>${
      quiet.map(f => `<li>${escapeHtml(f.name)} <small>${detail(f)}</small></li>`).join('')}</ul></details>` : '') +
    (bad.length ? `<details class="sources-bad"><summary>Falhas de conexão (${bad.length})</summary><ul>${
      bad.map(f => `<li>${escapeHtml(f.name)} <small>${detail(f)}</small></li>`).join('')}</ul></details>` : '');
}

function hideSplash() {
  const el = $('#splash');
  if (!el) return;
  const wait = Math.max(0, 700 - (performance.now() | 0));
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 450); }, wait);
}

// ── Início ───────────────────────────────────────────────────
async function init() {
  try { await API.load(); } catch (e) { State.error = describeError(e); }
  buildChrome();

  try {
    State.prevVisit = Number(localStorage.getItem('tn_lastvisit')) || 0;
    const stamp = () => { try { localStorage.setItem('tn_lastvisit', String(Date.now())); } catch { /* ignore */ } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) stamp(); });
    window.addEventListener('pagehide', stamp);
  } catch { /* ignore */ }

  let savedView = 'list';
  try { savedView = localStorage.getItem('tn_view') || 'list'; } catch { /* ignore */ }
  setView(savedView);
  $('#heroGreeting').innerHTML = `${getGreeting()}, <em>Dagner.</em>`;
  const small = window.matchMedia('(max-width: 600px)').matches;
  const heroDateText = new Date().toLocaleDateString('pt-BR', small
    ? { weekday: 'short', day: '2-digit', month: 'short' }
    : { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  $('#heroDate').textContent = heroDateText.charAt(0).toUpperCase() + heroDateText.slice(1);
  $('#searchShortcut').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
  try { localStorage.removeItem('ds_theme'); } catch { /* ignore */ }

  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  $('#searchInput').addEventListener('input', handleSearchInput);
  window.addEventListener('popstate', () => { State.category = readHash(); updateChrome(); loadCurrent(); });
  document.addEventListener('visibilitychange', autoRefresh);
  setInterval(autoRefresh, CONFIG.AUTO_REFRESH);

  // Imagem quebrada: mostra o ícone da editoria no lugar.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.classList.contains('item-img')) {
      img.closest('.item-thumb')?.remove();
      const media = img.closest('.feat-media, .panel-media');
      if (media) {
        img.remove();
        media.classList.add('no-img');
        if (!media.querySelector('.cover')) {
          media.style.setProperty('--c', categoryOf(media.dataset.cat).color);
          media.insertAdjacentHTML('afterbegin', coverHtml({ category: media.dataset.cat, source: media.dataset.src }, categoryOf(media.dataset.cat)));
        }
      }
    }
  }, true);

  State.category = readHash();
  updateChrome();
  loadCurrent();
  loadSources();

  if (Sync.on) {
    const note = $('#syncNote');
    if (note) note.textContent = Sync.weakGroup
      ? 'Atenção: nome do grupo curto. Troque por um nome longo e secreto em config.js.'
      : 'Favoritos e lidas compartilhados com o grupo';
    Sync.start(() => { updateChrome(); if (currentView() === 'favorites' || currentView() === 'history') render(); });
  }
  hideSplash();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
