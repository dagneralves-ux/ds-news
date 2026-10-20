/**
 * DS Intelligence (pessoal): aplicação principal (v4)
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
      <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      <span>Resumo por IA</span>
    </button>
    <div class="card-ai" id="ai-${id}">
      <div class="card-ai-content">${summary}${points}</div>
    </div>`;
}

function renderCard(item) {
  const cat = categoryOf(item.category);
  const id = escapeHtml(item.id);
  const link = safeUrl(item.link);
  const image = safeImage(item.image);
  const isFav = Store.isFavorite(item.id);
  const isRead = Store.isRead(item.id);

  const titleHtml = link
    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" data-action="read" data-id="${id}">${escapeHtml(item.title)}</a>`
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
        ${aiBlockHtml(item)}
      </div>
      <div class="item-side">
        ${image ? `<a class="item-thumb" href="${escapeHtml(link || '#')}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true" data-action="read" data-id="${id}"><img class="item-img" src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>` : ''}
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
    <div class="trends">
      <span class="trends-label">Em alta</span>
      ${trends.map(t => `<button type="button" class="trend-chip" data-action="trend" data-q="${escapeHtml(t.title)}">${escapeHtml(t.title)}<small>${escapeHtml(t.count)}</small></button>`).join('')}
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

  $('#filtersBar').hidden = view === 'favorites' || view === 'history';

  if (State.error && !(view === 'home' && State.home) && !(view === 'list' && State.list.items.length)) {
    content.innerHTML = emptyStateHtml(
      '', 'Não foi possível carregar as notícias', State.error,
      '<button type="button" class="retry-btn" data-action="retry">Tentar de novo</button>'
    );
    return;
  }

  if (view === 'favorites' || view === 'history') {
    const items = view === 'favorites' ? Store.getFavorites() : Store.getHistory();
    remember(items);
    if (!items.length) {
      content.innerHTML = view === 'favorites'
        ? emptyStateHtml('', 'Nenhum favorito ainda', 'Toque na estrela de uma notícia para guardá-la aqui.')
        : emptyStateHtml('', 'Histórico vazio', 'As notícias que você abrir aparecem aqui.');
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

function renderHome(content) {
  const h = State.home;
  if (!h) { content.innerHTML = renderSkeletons(6); return; }

  const parts = [];
  if (h.trends?.length) parts.push(renderTrends(h.trends));
  if (h.breaking?.length) {
    parts.push(sectionHtml('Urgente', '#d92d20', h.breaking.length, h.breaking.map(n => renderCard(n)).join('')));
  }
  for (const s of h.sections || []) {
    const cat = CATEGORIES[s.category];
    if (!cat) continue;
    parts.push(sectionHtml(cat.label, cat.color, s.total, s.items.map(n => renderCard(n)).join(''),
      s.total > s.items.length ? s.category : null, true));
  }

  content.innerHTML = parts.join('') || emptyStateHtml(
    '', 'Ainda não há notícias', 'O portal atualiza sozinho a cada 30 minutos. Tente novamente em instantes.');
}

function renderList(content) {
  const { items, hasMore, total } = State.list;
  const cat = categoryOf(State.category);

  if (!items.length) {
    content.innerHTML = emptyStateHtml('', 'Nenhuma notícia encontrada',
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
    <button type="button" class="nav-item" data-action="category" data-value="${key}">
      <span class="nav-icon" style="background:${escapeHtml(c.color)}"></span> ${escapeHtml(c.label)}
      <span class="nav-badge" id="badge-${key}">0</span>
    </button>`).join('');

  $('#categoryTabs').innerHTML =
    `<button type="button" class="tab active" role="tab" data-action="category" data-value="all">Todas</button>` +
    editorias.map(([key, c]) =>
      `<button type="button" class="tab" role="tab" data-action="category" data-value="${key}">${escapeHtml(c.label)}</button>`
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

  const label = { all: null, favorites: 'Favoritos', history: 'Histórico' }[State.category] ?? categoryOf(State.category).label;
  document.title = label ? `${label} | DS Intelligence` : 'DS Intelligence | Futebol, política, IA, design e marketing';
}

function applyMeta(data) {
  State.meta = {
    counts: data.counts || {},
    total: data.total ?? 0,
    todayCount: data.todayCount ?? 0,
    lastUpdated: data.lastUpdated || null,
  };
  updateChrome();
}

// ── Carregamento de dados ────────────────────────────────────
async function loadHome({ force = false, silent = false } = {}) {
  const req = ++State.reqId;
  if (!silent) { State.loading = true; State.error = null; render(); }
  $('#btnRefresh')?.classList.add('loading');

  try {
    if (force) API.clearCache();
    const data = await API.get('/api/home');
    if (req !== State.reqId) return;
    State.home = data;
    remember(data.breaking);
    (data.sections || []).forEach(s => remember(s.items));
    State.error = null;
    applyMeta(data);
    if (force) showToast('Notícias atualizadas', 'success');
  } catch (e) {
    if (req !== State.reqId) return;
    console.warn('[DS Intelligence]', e);
    if (silent) return;
    if (State.home) showToast('Não foi possível atualizar. Mostrando as últimas notícias carregadas.', 'error');
    else State.error = describeError(e);
  } finally {
    if (req === State.reqId) {
      State.loading = false;
      render();
      $('#btnRefresh')?.classList.remove('loading');
    }
  }
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
    console.warn('[DS Intelligence]', e);
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
    console.warn('[DS Intelligence] contadores indisponíveis', e);
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
  State.sidebarOpen = true;
  $('#sidebar').classList.add('mobile-open');
  $('#sidebarOverlay').classList.add('active');
  $('#btnMobileMenu').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  State.sidebarOpen = false;
  $('#sidebar').classList.remove('mobile-open');
  $('#sidebarOverlay').classList.remove('active');
  $('#btnMobileMenu')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// ── Ações nos cartões ────────────────────────────────────────
function markRead(id) {
  const item = findItem(id);
  if (!item) return;
  Store.markRead(item);
  document.getElementById(`card-${id}`)?.classList.add('read');
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
  if (label) label.textContent = open ? 'Ocultar resumo' : 'Resumo por IA';
}

// ── Tema (claro/escuro) ──────────────────────────────────────
function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('ds_theme', next); } catch { /* ignore */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0d0e11' : '#fbfbfc');
}

// ── Busca ────────────────────────────────────────────────────
function openSearch() {
  State.searchOpen = true;
  $('#searchOverlay').classList.add('open');
  renderSearchHint();
  setTimeout(() => $('#searchInput')?.focus(), 50);
}

function closeSearch() {
  State.searchOpen = false;
  $('#searchOverlay').classList.remove('open');
  const input = $('#searchInput');
  if (input) input.value = '';
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
      <a class="search-result-item" href="${escapeHtml(link || '#')}" ${link ? 'target="_blank" rel="noopener noreferrer"' : ''} data-action="read" data-id="${escapeHtml(n.id)}">
        <div class="search-result-icon"><span class="nav-icon" style="background:${escapeHtml(cat.color)}"></span></div>
        <div class="search-result-body">
          <div class="search-result-title">${escapeHtml(n.title)}</div>
          <div class="search-result-meta" style="color:${escapeHtml(cat.color)}">${escapeHtml(cat.label)} · ${escapeHtml(n.source)} · ${escapeHtml(formatRelativeDate(n.date))}</div>
        </div>
      </a>`;
  }).join('');
}

// ── Eventos (um único ouvinte) ───────────────────────────────
function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, value, id } = el.dataset;

  switch (action) {
    case 'category':      go(value); break;
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
    case 'theme':         toggleTheme(); break;
    case 'open-search':   openSearch(); break;
    case 'close-search':  closeSearch(); break;
    case 'open-sidebar':  openSidebar(); break;
    case 'close-sidebar': closeSidebar(); break;
    case 'clear-history':
      if (confirm('Limpar todo o histórico de leitura?')) {
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
  if (e.key === 'Escape') {
    if (State.searchOpen) closeSearch();
    if (State.sidebarOpen) closeSidebar();
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
  el.innerHTML = `<strong>${ok} de ${st.fontes.length}</strong> fontes respondendo` +
    (bad.length ? `<details class="sources-bad"><summary>Ver as que falharam (${bad.length})</summary><ul>${
      bad.map(f => `<li>${escapeHtml(f.name)} <small>${escapeHtml(f.erro || '')}</small></li>`).join('')}</ul></details>` : '');
}

// ── Início ───────────────────────────────────────────────────
async function init() {
  try { await API.load(); } catch (e) { State.error = describeError(e); }
  buildChrome();

  $('#heroGreeting').textContent = getGreeting();
  const small = window.matchMedia('(max-width: 600px)').matches;
  $('#heroDate').textContent = new Date().toLocaleDateString('pt-BR', small
    ? { weekday: 'short', day: '2-digit', month: 'short' }
    : { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  $('#searchShortcut').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

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
    }
  }, true);

  State.category = readHash();
  updateChrome();
  loadCurrent();
  loadSources();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
