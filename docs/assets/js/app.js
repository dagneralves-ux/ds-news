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
  return u.startsWith('https://') || u.startsWith('data/escudos/') ? u : '';
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
  jogos: null,              // conteúdo de data/jogos.json
  topic: 'all',             // assunto escolhido dentro da editoria (Adobe, GitHub...)
  topics: [],               // assuntos da editoria atual, com contagem
  jogosLeague: 'all',
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
  if (State.category === 'jogos') return 'jogos';
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
      ${trends.map(t => `<button type="button" class="trend-chip" data-action="trend" data-q="${escapeHtml(t.title)}">${escapeHtml(t.title)}<small>${escapeHtml(t.count)} notícias</small></button>`).join('')}
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
      <div class="empty-state-icon" aria-hidden="true">${escapeHtml(icon || '🗞️')}</div>
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
  $('#toolbar').hidden = view !== 'list';
  if (view !== 'home') heroStop();

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

  if (view === 'jogos') return renderJogos(content);
  if (view === 'home') return renderHome(content);
  return renderList(content);
}

// ── Página inicial (layout de portal) ────────────────────────
/** Imagem da notícia ou, sem foto, um bloco colorido com o ícone da editoria. */
function mediaBox(item, extra = '') {
  const cat = categoryOf(item.category);
  const image = safeImage(item.image);
  const icon = escapeHtml(cat.icon || '📰');
  return `<span class="media ${extra}${image ? '' : ' no-img'}" data-icon="${icon}" style="--c:${escapeHtml(cat.color)}">${
    image
      ? `<img class="item-img" src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="feat-media-mark">${icon}</span>`}</span>`;
}

function tagHtml(item, small = false) {
  const cat = categoryOf(item.category);
  return `<span class="tag${small ? ' tag-sm' : ''}" style="--c:${escapeHtml(cat.color)}">${escapeHtml(cat.label)}</span>`;
}

function linkAttrs(item) {
  return `href="${escapeHtml(safeUrl(item.link) || '#')}" data-action="open-panel" data-id="${escapeHtml(item.id)}"`;
}

function latestHtml(list) {
  if (!list?.length) return '';
  return `
    <section class="latest" aria-label="Últimas notícias">
      ${list.map(n => `
        <a class="latest-item" ${linkAttrs(n)}>
          ${mediaBox(n, 'latest-media')}
          <span class="latest-text">
            <strong>${escapeHtml(n.title)}</strong>
            <small>${escapeHtml(categoryOf(n.category).label)} <i>•</i> ${escapeHtml(formatRelativeDate(n.date))}</small>
          </span>
        </a>`).join('')}
    </section>`;
}

function heroHtml(featured, counts = {}, todayCounts = {}, jogos = null) {
  if (!featured?.length) return '';
  const slides = featured.map((n, i) => {
    const id = escapeHtml(n.id);
    const isFav = Store.isFavorite(n.id);
    const sources = n.also?.length ? ` <i>•</i> ${n.also.length + 1} fontes` : '';
    return `
      <article class="hero-slide${i === 0 ? ' active' : ''}" id="card-${id}" aria-hidden="${i === 0 ? 'false' : 'true'}">
        ${mediaBox(n, 'hero-media')}
        <span class="hero-shade"></span>
        <div class="hero-top">${tagHtml(n)}${badgeHtml(n.importance)}</div>
        <div class="hero-body">
          <div class="hero-eyebrow">${escapeHtml(n.source)} <i>•</i> ${escapeHtml(formatRelativeDate(n.date))}${sources}</div>
          <h2 class="hero-title"><a ${linkAttrs(n)}>${escapeHtml(n.title)}</a></h2>
          ${n.summary ? `<p class="hero-summary">${escapeHtml(n.summary)}</p>` : ''}
          <div class="hero-actions">
            <button type="button" class="btn-light" data-action="open-panel" data-id="${id}">Ler resumo
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
            <button type="button" class="icon-btn on-dark ${isFav ? 'active' : ''}" id="fav-${id}" data-action="favorite" data-id="${id}" aria-pressed="${isFav}" aria-label="Favoritar" title="Favoritar">
              <svg width="17" height="17" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            </button>
          </div>
        </div>
      </article>`;
  }).join('');

  const dots = featured.length > 1
    ? `<div class="hero-dots" role="group" aria-label="Escolher destaque">${featured.map((_, i) =>
        `<button type="button" class="hero-dot${i === 0 ? ' active' : ''}" data-action="hero-go" data-value="${i}" aria-label="Destaque ${i + 1}"></button>`).join('')}</div>`
    : '';

  const rows = Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([key, c]) => {
    const today = todayCounts[key] || 0;
    return `
      <button type="button" class="score-row" data-action="category" data-value="${escapeHtml(key)}" style="--c:${escapeHtml(c.color)}">
        <span class="score-meta">${today ? `${today} ${today === 1 ? 'nova' : 'novas'} hoje` : 'Sem novidades hoje'}</span>
        <span class="score-main">
          <span class="score-ico" aria-hidden="true">${escapeHtml(c.icon || '•')}</span>
          <span class="score-name">${escapeHtml(c.label)}</span>
          <span class="score-num">${Number(counts[key] || 0)}</span>
        </span>
      </button>`;
  }).join('');

  return `
    <section class="hero-grid" aria-label="Destaques">
      <div class="hero" id="hero">${slides}${dots}</div>
      ${jogos ? gamesPanelHtml(jogos) : `<aside class="hero-panel" aria-label="Painel do dia">
        <div class="hero-panel-head"><h3>Painel do dia</h3><button type="button" data-action="category" data-value="all">Ver todas</button></div>
        <div class="score-list">${rows}</div>
      </aside>`}
    </section>`;
}

function mosaicHtml(list, top) {
  if (!list?.length && !top?.length) return '';
  const tiles = (list || []).map(n => `
    <a class="tile" ${linkAttrs(n)} style="--c:${escapeHtml(categoryOf(n.category).color)}">
      ${mediaBox(n, 'tile-media')}
      <span class="tile-shade"></span>
      ${tagHtml(n, true)}
      <span class="tile-body"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(formatRelativeDate(n.date))}</small></span>
    </a>`).join('');

  const ranked = (top || []).map((n, i) => `
    <li>
      <a class="top-row" ${linkAttrs(n)}>
        <span class="top-num" aria-hidden="true">${i + 1}</span>
        <span class="top-text">${badgeHtml(n.importance) ? `<span class="top-badge">${badgeHtml(n.importance)}</span>` : ''}<strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(formatRelativeDate(n.date))} <i>•</i> ${escapeHtml(n.source)}</small></span>
        ${mediaBox(n, 'top-thumb')}
      </a>
    </li>`).join('');

  return `
    <div class="split">
      ${tiles ? `
      <section class="block" aria-label="Não perca">
        <div class="block-head"><h3 class="block-title">Não perca</h3></div>
        <div class="mosaic mosaic-${Math.min(list.length, 5)}">${tiles}</div>
      </section>` : '<div></div>'}
      ${ranked ? `
      <aside class="block top-stories" aria-label="Principais notícias">
        <div class="block-head"><h3 class="block-title">Principais notícias</h3>
          <button type="button" class="section-more" data-action="category" data-value="all">Ver todas</button></div>
        <ol>${ranked}</ol>
      </aside>` : ''}
    </div>`;
}

function categoryBlockHtml(cat, section) {
  const [first, ...rest] = section.items;
  const big = `
    <a class="feature-big" ${linkAttrs(first)} style="--c:${escapeHtml(cat.color)}">
      ${mediaBox(first, 'feature-media')}
      <span class="tile-shade"></span>
      ${badgeHtml(first.importance) ? `<span class="feature-badge">${badgeHtml(first.importance)}</span>` : ''}
      <span class="tile-body">
        <strong>${escapeHtml(first.title)}</strong>
        <small>${escapeHtml(first.source)} <i>•</i> ${escapeHtml(formatRelativeDate(first.date))}</small>
      </span>
    </a>`;
  const side = rest.map(n => `
    <a class="feature-row" ${linkAttrs(n)}>
      ${mediaBox(n, 'feature-thumb')}
      <span class="feature-text"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.source)} <i>•</i> ${escapeHtml(formatRelativeDate(n.date))}</small></span>
    </a>`).join('');

  return `
    <section class="block cat-block${rest.length ? '' : ' solo'}" style="--c:${escapeHtml(cat.color)}">
      <div class="block-head">
        <h3 class="block-title">${escapeHtml(cat.label)} <span class="section-count">${Number(section.total)}</span></h3>
        <button type="button" class="section-more" data-action="category" data-value="${escapeHtml(section.category)}">Ver todas</button>
      </div>
      <div class="feature-grid">${big}${side ? `<div class="feature-side">${side}</div>` : ''}</div>
    </section>`;
}

// ── Jogos de hoje ────────────────────────────────────────────
/** Jogos válidos para hoje (o arquivo pode ser de ontem se a coleta ainda não rodou). */
function jogosDeHoje() {
  const j = State.jogos;
  if (!j?.jogos?.length) return null;
  return j.data === new Date().toLocaleDateString('sv-SE') ? j : null;
}

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const JOGO_OUTRO = { PST: 'Adiado', CANC: 'Cancelado', SUSP: 'Suspenso', ABD: 'Abandonado', AWD: 'Decidido', WO: 'W.O.' };

function jogoEstado(g) {
  if (g.status === 'ao_vivo') return { cls: 'live', txt: g.statusTxt === 'HT' ? 'Intervalo' : 'Em andamento' };
  if (g.status === 'encerrado') return { cls: 'done', txt: g.statusTxt === 'AET' ? 'Encerrado (prorrog.)' : g.statusTxt === 'PEN' ? 'Encerrado (pênaltis)' : 'Encerrado' };
  if (g.status === 'agendado') return { cls: 'next', txt: formatHora(g.inicio) };
  return { cls: 'other', txt: JOGO_OUTRO[g.statusTxt] || 'Sem data' };
}

function teamInitials(t) {
  const n = String(t.nome || '?').replace(/[-–].*$/, '').trim().split(/\s+/);
  return (n.length > 1 ? n[0][0] + n[1][0] : n[0].slice(0, 2)).toUpperCase();
}

function teamLogo(t) {
  const src = safeImage(t.logo);
  const ini = escapeHtml(teamInitials(t));
  if (!src) return `<span class="team-logo team-logo-empty" aria-hidden="true">${ini}</span>`;
  // se o escudo não carregar, vira uma bolinha com as iniciais (ver listener 'error' em init)
  return `<img class="team-logo" src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-ini="${ini}">`;
}

// escudo que falhou ao carregar -> iniciais do time
document.addEventListener('error', e => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && el.classList.contains('team-logo')) {
    const span = document.createElement('span');
    span.className = 'team-logo team-logo-empty';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = el.dataset.ini || '';
    el.replaceWith(span);
  }
}, true);

function gameHtml(g, { showLeague = true } = {}) {
  const st = jogoEstado(g);
  const hasScore = g.golsCasa !== null && g.golsFora !== null && g.status !== 'agendado';
  const pen = g.penaltis ? ` <small>(${Number(g.penaltis[0])}–${Number(g.penaltis[1])})</small>` : '';
  const center = hasScore
    ? `<span class="game-score">${Number(g.golsCasa)}<i>×</i>${Number(g.golsFora)}${pen}</span>`
    : `<span class="game-score game-vs">×</span>`;
  const fin = g.status === 'encerrado' && hasScore;
  const wc = fin && g.golsCasa > g.golsFora ? ' game-win' : fin && g.golsCasa < g.golsFora ? ' game-lose' : '';
  const wf = fin && g.golsFora > g.golsCasa ? ' game-win' : fin && g.golsFora < g.golsCasa ? ' game-lose' : '';
  return `
    <div class="game game-${st.cls}">
      <div class="game-meta">
        ${showLeague ? `<span class="game-liga">${escapeHtml(g.liga)}</span>` : ''}
        <span class="game-state">${g.status === 'ao_vivo' ? '<b class="live-dot" aria-hidden="true"></b>' : ''}${escapeHtml(st.txt)}</span>
      </div>
      <div class="game-main">
        <span class="game-team game-home${wc}"><span class="game-name">${escapeHtml(g.casa.nome)}</span>${teamLogo(g.casa)}</span>
        ${center}
        <span class="game-team game-away${wf}">${teamLogo(g.fora)}<span class="game-name">${escapeHtml(g.fora.nome)}</span></span>
      </div>
    </div>`;
}

// ── Destaque grande: jogos ao vivo ou o próximo jogo ─────────
function contagemRegressiva(iso) {
  const m = Math.round((new Date(iso) - Date.now()) / 60000);
  if (m <= 1) return 'começa agora';
  if (m < 60) return `começa em ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return `começa em ${h}h${r ? ` ${r}min` : ''}`;
}

function bigGameHtml(g, kind) {
  const hasScore = g.golsCasa !== null && g.golsFora !== null;
  const minuto = g.statusTxt === 'HT' ? 'Intervalo' : g.minuto ? `${Number(g.minuto)}'` : 'Em andamento';
  const pill = kind === 'live'
    ? `<span class="big-pill big-pill-live"><b class="live-dot" aria-hidden="true"></b>AO VIVO · ${escapeHtml(minuto)}</span>`
    : `<span class="big-pill">${escapeHtml(contagemRegressiva(g.inicio))} · ${escapeHtml(formatHora(g.inicio))}</span>`;
  const placar = kind === 'live' && hasScore
    ? `<span class="big-score">${Number(g.golsCasa)}<i>×</i>${Number(g.golsFora)}</span>`
    : '<span class="big-score big-vs">×</span>';
  return `
    <article class="big-game${kind === 'live' ? ' is-live' : ''}">
      <div class="big-head"><span class="big-liga">${escapeHtml(g.liga)}${g.rodada ? ` · ${escapeHtml(g.rodada)}` : ''}</span>${pill}</div>
      <div class="big-main">
        <div class="big-team">${teamLogo(g.casa)}<strong>${escapeHtml(g.casa.nome)}</strong></div>
        ${placar}
        <div class="big-team">${teamLogo(g.fora)}<strong>${escapeHtml(g.fora.nome)}</strong></div>
      </div>
    </article>`;
}

function featuredGamesHtml(jogos) {
  const live = jogos.filter(g => g.status === 'ao_vivo');
  if (live.length) {
    return `<section class="big-games" aria-label="Jogos ao vivo agora">
      <h3 class="big-title"><b class="live-dot" aria-hidden="true"></b>Ao vivo agora</h3>
      <div class="big-grid">${live.slice(0, 4).map(g => bigGameHtml(g, 'live')).join('')}</div></section>`;
  }
  const next = jogos.filter(g => g.status === 'agendado' && new Date(g.inicio) > Date.now() - 5 * 60000)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];
  return next
    ? `<section class="big-games" aria-label="Próximo jogo"><h3 class="big-title">Próximo jogo</h3><div class="big-grid">${bigGameHtml(next, 'next')}</div></section>`
    : '';
}

function gamesPanelHtml(j) {
  const rank = g => (g.status === 'ao_vivo' ? 0 : g.status === 'agendado' ? 1 : g.status === 'encerrado' ? 2 : 3);
  const top = [...j.jogos].sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? new Date(b.inicio) - new Date(a.inicio) : new Date(a.inicio) - new Date(b.inicio))).slice(0, 5);
  return `
    <aside class="hero-panel games-panel" aria-label="Jogos de hoje">
      <div class="hero-panel-head"><h3>Jogos de hoje</h3><button type="button" data-action="category" data-value="jogos">Ver todos (${j.jogos.length})</button></div>
      <div class="score-list">${top.map(g => gameHtml(g)).join('')}</div>
      <div class="games-foot">Atualizado às ${escapeHtml(formatHora(j.atualizadoEm))}</div>
    </aside>`;
}

function renderJogos(content) {
  const j = State.jogos;
  if (!j) {
    content.innerHTML = emptyStateHtml('⚽', 'Jogos ainda não configurados',
      'Para mostrar os jogos de hoje, crie a chave grátis da API-Football e salve no GitHub como API_FOOTBALL_KEY (veja o LEIA-ME).');
    return;
  }
  if (j.erro) {
    content.innerHTML = emptyStateHtml('⚠️', 'Não foi possível buscar os jogos',
      `A API respondeu: ${j.erro}. Confira a chave API_FOOTBALL_KEY no GitHub e rode a atualização de novo.`);
    return;
  }
  const hoje = jogosDeHoje();
  if (!hoje) {
    content.innerHTML = emptyStateHtml('⚽', 'Sem jogos dos seus campeonatos hoje',
      j.data === new Date().toLocaleDateString('sv-SE')
        ? 'Nenhum jogo de Brasileirão, Copa do Brasil, Libertadores ou Europa na data de hoje.'
        : 'Os jogos de hoje aparecem na próxima atualização do robô (a cada ~30 minutos).');
    return;
  }
  const ligas = [];
  hoje.jogos.forEach(g => { if (!ligas.find(l => l.id === g.ligaId)) ligas.push({ id: g.ligaId, nome: g.liga }); });
  if (State.jogosLeague !== 'all' && !ligas.find(l => String(l.id) === State.jogosLeague)) State.jogosLeague = 'all';
  const chips = [{ id: 'all', nome: 'Todos', n: hoje.jogos.length }, ...ligas.map(l => ({ ...l, n: hoje.jogos.filter(g => g.ligaId === l.id).length }))]
    .map(l => `<button type="button" class="filter-btn${String(l.id) === State.jogosLeague ? ' active' : ''}" data-action="jogos-liga" data-value="${escapeHtml(l.id)}">${escapeHtml(l.nome)} <small>${l.n}</small></button>`).join('');

  const groups = ligas.filter(l => State.jogosLeague === 'all' || String(l.id) === State.jogosLeague).map(l => `
    <section class="block games-block">
      <div class="block-head"><h3 class="block-title">${escapeHtml(l.nome)}</h3></div>
      <div class="games-grid">${hoje.jogos.filter(g => g.ligaId === l.id).map(g => gameHtml(g, { showLeague: false })).join('')}</div>
    </section>`).join('');

  const dia = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  content.innerHTML = `
    <div class="section-header">
      <h3 class="section-title">Jogos de hoje <span class="section-count">${hoje.jogos.length}</span></h3>
    </div>
    <p class="games-note">${escapeHtml(dia)} · atualizado às ${escapeHtml(formatHora(hoje.atualizadoEm))}. Os placares são atualizados pelo robô a cada ~30 minutos, então podem ter pequeno atraso.</p>
    ${featuredGamesHtml(hoje.jogos.filter(g => State.jogosLeague === 'all' || String(g.ligaId) === State.jogosLeague))}
    <div class="filters-bar games-filters" aria-label="Filtrar por campeonato">${chips}</div>
    ${groups}`;
}

async function loadJogos() {
  State.jogos = await API.jogos();
  markLive();
  const view = currentView();
  if (view === 'home' || view === 'jogos') render();
}

function updateTopTrend(trends) {
  const wrap = $('#topTrendWrap');
  const btn = $('#topTrend');
  if (!wrap || !btn) return;
  const t = trends?.[0];
  wrap.hidden = !t;
  if (t) { btn.textContent = t.title; btn.dataset.q = t.title; }
}

// Pontinho vermelho em "Jogos" quando há partida em andamento
function markLive() {
  const live = !!State.jogos?.jogos?.some(g => g.status === 'ao_vivo');
  $$('[data-value="jogos"]').forEach(el => el.classList.toggle('has-live', live));
}

// Botão "voltar ao topo"
function initToTop() {
  const btn = $('#toTop');
  if (!btn) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { btn.classList.toggle('show', window.scrollY > 900); ticking = false; });
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Deslizar o dedo no destaque troca de notícia
function initHeroSwipe() {
  let x0 = null, y0 = 0;
  document.addEventListener('touchstart', e => {
    const hero = e.target.closest && e.target.closest('#hero');
    if (!hero) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { heroGo(heroIndex + (dx < 0 ? 1 : -1)); heroStart(); }
  }, { passive: true });
}

// ── Carrossel do destaque ────────────────────────────────────
let heroIndex = 0;
let heroTimer = null;

function heroGo(i) {
  const slides = $$('.hero-slide');
  if (!slides.length) return;
  heroIndex = (i + slides.length) % slides.length;
  slides.forEach((s, k) => {
    s.classList.toggle('active', k === heroIndex);
    s.setAttribute('aria-hidden', String(k !== heroIndex));
  });
  $$('.hero-dot').forEach((d, k) => {
    d.classList.toggle('active', k === heroIndex);
    if (k === heroIndex) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
  });
}

function heroStop() { clearInterval(heroTimer); heroTimer = null; }

function heroStart() {
  heroStop();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ($$('.hero-slide').length < 2) return;
  heroTimer = setInterval(() => {
    const hero = $('#hero');
    if (!hero || document.hidden || hero.matches(':hover, :focus-within')) return;
    heroGo(heroIndex + 1);
  }, 7000);
}

function renderHome(content) {
  const h = State.home;
  if (!h) { content.innerHTML = renderSkeletons(6); return; }

  updateTopTrend(h.trends);
  const parts = [
    latestHtml(h.latest),
    heroHtml(h.featured, h.counts, h.todayCounts, jogosDeHoje()),
  ];
  if (h.trends?.length) parts.push(renderTrends(h.trends));
  parts.push(mosaicHtml(h.dontMiss, h.top));
  for (const s of h.sections || []) {
    const cat = CATEGORIES[s.category];
    if (!cat) continue;
    parts.push(categoryBlockHtml(cat, s));
  }

  const html = parts.join('');
  content.innerHTML = html.trim() ? html : emptyStateHtml(
    '🗞️', 'Ainda não há notícias', 'A coleta é atualizada automaticamente. Tente novamente em instantes.');
  heroGo(Math.min(heroIndex, Math.max(0, $$('.hero-slide').length - 1)));
  heroStart();
}

function topicBarHtml() {
  if (!State.topics.length) return '';
  const chip = (id, label, n) => `<button type="button" class="filter-btn${State.topic === id ? ' active' : ''}" data-action="topic" data-value="${escapeHtml(id)}">${escapeHtml(label)}${n != null ? ` <small>${n}</small>` : ''}</button>`;
  return `<div class="filters-bar topic-bar" aria-label="Assuntos da editoria"><span class="topic-label">Assuntos</span>${chip('all', 'Todos')}${State.topics.map(t => chip(t.id, t.label, t.n)).join('')}</div>`;
}

function renderList(content) {
  const { items, hasMore, total } = State.list;
  const cat = categoryOf(State.category);

  if (!items.length) {
    content.innerHTML = topicBarHtml() + emptyStateHtml('⌕', 'Nenhuma notícia encontrada',
      'Tente outro filtro ou volte mais tarde.');
    return;
  }

  const filterLabel = { today: 'hoje', '24h': 'últimas 24h', urgent: 'urgentes', high: 'destaques' }[State.filter];
  const topicLabel = State.topic !== 'all' ? State.topics.find(t => t.id === State.topic)?.label : '';
  const title = State.category === 'all' ? 'Todas as notícias' : cat.label;
  content.innerHTML = `
    <div class="section-header">
      <h3 class="section-title"><span class="sec-dot" style="background:${escapeHtml(cat.color)}"></span>${escapeHtml(title)}${topicLabel ? ` · ${escapeHtml(topicLabel)}` : ''}${filterLabel ? ` (${escapeHtml(filterLabel)})` : ''}
        <span class="section-count">${total}</span></h3>
    </div>
    ${topicBarHtml()}
    <div class="news-grid${State.category !== 'all' ? ' hide-cat' : ''}">${items.map(n => renderCard(n)).join('')}</div>
    ${hasMore ? loadMoreHtml : ''}`;
}

// ── Cabeçalho, menu e contadores ─────────────────────────────
function buildChrome() {
  const editorias = Object.entries(CATEGORIES).filter(([key]) => key !== 'all');

  $('#categoryNav').innerHTML = editorias.map(([key, c]) => `
    <button type="button" class="nav-item" data-action="category" data-value="${escapeHtml(key)}">
      <span class="nav-emoji" aria-hidden="true">${escapeHtml(c.icon || '•')}</span>
      <span class="nav-text">${escapeHtml(c.label)}</span>
      <span class="nav-badge" id="badge-${escapeHtml(key)}">0</span>
    </button>`).join('');

  $('#footerCats').innerHTML = '<h4>Editorias</h4>' + editorias.map(([key, c]) =>
    `<a href="#${escapeHtml(key)}" data-action="category" data-value="${escapeHtml(key)}">${escapeHtml(c.label)}</a>`).join('');

  $('#categoryTabs').innerHTML =
    `<button type="button" class="tab active" role="tab" aria-selected="true" data-action="category" data-value="all">Todas</button>` +
    editorias.map(([key, c]) =>
      `<button type="button" class="tab" role="tab" aria-selected="false" data-action="category" data-value="${escapeHtml(key)}">${escapeHtml(c.label)}</button>`
    ).join('');
}

function updateChrome() {
  $$('[data-action="category"]').forEach(el => {
    const active = el.dataset.value === State.category
      && !(el.dataset.value === 'all' && el.classList.contains('tab') && State.filter !== 'all');
    if (el.classList.contains('nav-item') || el.classList.contains('tab')) {
      el.classList.toggle('active', active);
      if (el.classList.contains('tab')) el.setAttribute('aria-selected', String(active));
    }
  });
  $$('.mobile-nav-item').forEach(el => {
    const active = el.dataset.navGroup === 'categories'
      ? !['all', 'favorites', 'history', 'jogos'].includes(State.category)
      : el.dataset.value === State.category;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  markLive();
  $$('.filter-btn').forEach(el => el.classList.toggle('active', el.dataset.value === State.filter));
  $$('[data-action="go-filter"]').forEach(el =>
    el.classList.toggle('active', State.category === 'all' && State.filter === el.dataset.value));

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
  const topUpdated = $('#lastUpdatedTop');
  if (topUpdated) topUpdated.textContent = lastUpdated ? `Atualizado ${formatDateTime(lastUpdated)}` : 'Buscar atualizações';

  const label = { all: null, favorites: 'Favoritos', history: 'Histórico', jogos: 'Jogos de hoje' }[State.category] ?? categoryOf(State.category).label;
  document.title = label ? `${label} | Tem News` : 'Tem News | Economia, futebol, política e IA';
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
  put('#statCats', Object.keys(CATEGORIES).filter(k => k !== 'all').length);
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
    (data.sections || []).forEach(s => remember(s.items));
    remember(data.featured); remember(data.latest); remember(data.dontMiss); remember(data.top);
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
    if (State.topic !== 'all') params.set('topic', State.topic);

    const res = await API.get(`/api/news?${params}`);
    if (reset) {
      State.topics = State.category === 'all' || State.category === 'favorites' || State.category === 'history'
        ? [] : (await API.get(`/api/topics?category=${encodeURIComponent(State.category)}`)).topics || [];
      if (State.topic !== 'all' && !State.topics.some(t => t.id === State.topic)) State.topic = 'all';
    }
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
  State.reqId++;                           // favoritos, histórico e jogos são locais
  State.loading = false;
  State.error = null;
  if (!State.home) loadMeta();
  if (view === 'jogos' && force) { loadJogos(); }
  render();
}

// ── Navegação ────────────────────────────────────────────────
const HASH_TO_CAT = { todas: 'all', favoritos: 'favorites', historico: 'history', jogos: 'jogos' };
const CAT_TO_HASH = { all: 'todas', favorites: 'favoritos', history: 'historico', jogos: 'jogos' };

function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (HASH_TO_CAT[h]) return HASH_TO_CAT[h];
  return CATEGORIES[h] && h !== 'all' ? h : 'all';
}

function go(category, { filter } = {}) {
  if (State.category !== category) State.topic = 'all';
  State.category = category;
  if (filter !== undefined) State.filter = filter;
  else if (category === 'favorites' || category === 'history' || category === 'jogos') State.filter = 'all';

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
    <div class="panel-media${image ? '' : ' no-img'}" data-icon="${escapeHtml(cat.icon || '')}" style="--c:${escapeHtml(cat.color)}">
      ${image ? `<img class="item-img" src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer">` : `<span class="feat-media-mark">${escapeHtml(cat.icon || '')}</span>`}
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
        <button type="button" class="btn-ghost" data-action="open-reader" data-id="${id}">Modo leitura</button>
        <button type="button" class="btn-ghost ${isFav ? 'active' : ''}" id="panel-fav" data-action="favorite" data-id="${id}" aria-pressed="${isFav}">${isFav ? 'Salvo nos favoritos' : 'Salvar nos favoritos'}</button>
        <button type="button" class="btn-ghost" data-action="share" data-id="${id}">Compartilhar</button>
      </div>
      <p class="panel-note">O resumo usa só o título e o trecho publicados pela fonte. Confira a matéria original.</p>
    </div>`;
}

function openPanel(id) {
  const item = findItem(id);
  if (!item) return;
  const trigger = document.activeElement;
  if (State.searchOpen) { saveRecent(State.lastQuery); closeSearch(); }
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

// ── Modo de leitura (tela limpa, letra grande) ───────────────
const READER_SIZES = [17, 19, 21, 24];

function readerSize() {
  let n = 1;
  try { n = Number(localStorage.getItem('tn_reader_size') ?? 1); } catch { /* ignore */ }
  return Math.min(READER_SIZES.length - 1, Math.max(0, Number.isFinite(n) ? n : 1));
}

function readerIds() {
  const ids = [];
  $$('#mainContent [data-action="open-panel"][data-id]').forEach(el => { if (!ids.includes(el.dataset.id)) ids.push(el.dataset.id); });
  return ids;
}

function readerHtml(item) {
  const cat = categoryOf(item.category);
  const link = safeUrl(item.link);
  const ai = item.aiSummary;
  const points = Array.isArray(ai?.points) && ai.points.length
    ? '<ul class="reader-points">' + ai.points.map(p => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>' : '';
  const image = safeImage(item.image);
  return `
    <div class="reader-meta"><span class="reader-cat">${escapeHtml(cat.label)}</span><span>${escapeHtml(item.source)}</span><time>${escapeHtml(formatDateTime(item.date))}</time></div>
    <h1 class="reader-title">${escapeHtml(item.title)}</h1>
    ${image ? `<img class="reader-img" src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer">` : ''}
    ${item.summary ? `<p class="reader-text">${escapeHtml(item.summary)}</p>` : ''}
    ${ai && (ai.summary || points) ? `<div class="reader-ai"><div class="reader-ai-label">Resumo por IA</div>${ai.summary ? `<p>${escapeHtml(ai.summary)}</p>` : ''}${points}</div>` : ''}
    ${item.also?.length ? `<p class="reader-also">Também publicado em: ${item.also.map(a => escapeHtml(a.source)).join(', ')}</p>` : ''}
    <div class="reader-actions">
      ${link ? `<a class="btn-primary btn-lg" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" data-action="read" data-id="${escapeHtml(item.id)}">Ler matéria original</a>` : ''}
      <button type="button" class="btn-ghost" data-action="share" data-id="${escapeHtml(item.id)}">Compartilhar</button>
    </div>
    <p class="reader-note">O resumo usa só o título e o trecho publicados pela fonte. Confira a matéria original.</p>`;
}

function renderReader() {
  const item = findItem(State.readerId);
  if (!item) return closeReader();
  const box = $('#reader');
  box.style.setProperty('--reader-size', READER_SIZES[readerSize()] + 'px');
  $('#readerBody').innerHTML = readerHtml(item);
  const ids = readerIds(), pos = ids.indexOf(State.readerId);
  $('#readerPos').textContent = pos >= 0 ? `${pos + 1} de ${ids.length}` : '';
  $('[data-action="reader-prev"]').disabled = pos <= 0;
  $('[data-action="reader-next"]').disabled = pos < 0 || pos >= ids.length - 1;
  box.scrollTop = 0;
  box.style.setProperty('--p', '0%');
}

function openReader(id) {
  if (!findItem(id)) return;
  const trigger = State.panelTrigger || document.activeElement;
  closePanel();
  State.readerTrigger = trigger;
  State.readerId = id;
  markRead(id);
  const box = $('#reader');
  box.classList.add('open');
  box.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('no-scroll');
  renderReader();
  $('[data-action="close-reader"]').focus({ preventScroll: true });
}

function closeReader() {
  if (!State.readerId) return;
  State.readerId = null;
  const box = $('#reader');
  box.classList.remove('open');
  box.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('no-scroll');
  const t = State.readerTrigger;
  State.readerTrigger = null;
  if (t?.isConnected) t.focus({ preventScroll: true });
}

function readerNav(dir) {
  const ids = readerIds(), pos = ids.indexOf(State.readerId);
  const next = ids[pos + dir];
  if (pos < 0 || !next) return;
  State.readerId = next;
  markRead(next);
  renderReader();
}

function readerFont(delta) {
  const n = Math.min(READER_SIZES.length - 1, Math.max(0, readerSize() + delta));
  try { localStorage.setItem('tn_reader_size', String(n)); } catch { /* ignore */ }
  if (State.readerId) $('#reader').style.setProperty('--reader-size', READER_SIZES[n] + 'px');
}

function initReader() {
  const box = $('#reader');
  if (!box) return;
  box.addEventListener('scroll', () => {
    const max = box.scrollHeight - box.clientHeight;
    box.style.setProperty('--p', max > 0 ? Math.min(100, (box.scrollTop / max) * 100).toFixed(1) + '%' : '0%');
  }, { passive: true });
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

// ── Busca: realce, recentes, atalhos e jogos ─────────────────
const RECENT_KEY = 'tn_recent_q';
function recentQueries() {
  try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r.slice(0, 5) : []; } catch { return []; }
}
function saveRecent(q) {
  q = String(q || '').trim();
  if (q.length < 2) return;
  const list = [q, ...recentQueries().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function clearRecent() { try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } }

function normChar(c) {
  const n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return /^[a-z0-9]$/.test(n) ? n : ' ';
}

/** Escapa o texto e marca os termos buscados (sem diferenciar acento nem maiúscula). */
function highlight(text, terms) {
  const str = String(text ?? '');
  const norm = [...str].map(normChar).join('');
  if ([...str].length !== norm.length) return escapeHtml(str);
  const mark = new Array(norm.length).fill(false);
  for (const t of terms) {
    if (t.length < 2) continue;
    let at = norm.indexOf(t);
    while (at !== -1) { for (let k = at; k < at + t.length; k++) mark[k] = true; at = norm.indexOf(t, at + t.length); }
  }
  let out = '', open = false;
  [...str].forEach((ch, i) => {
    if (mark[i] && !open) { out += '<mark>'; open = true; }
    if (!mark[i] && open) { out += '</mark>'; open = false; }
    out += escapeHtml(ch);
  });
  return out + (open ? '</mark>' : '');
}

function searchTerms(q) {
  return [...q].map(normChar).join('').split(' ').filter(t => t.length >= 2);
}

function gameMatches(q) {
  const terms = searchTerms(q);
  const j = jogosDeHoje();
  if (!terms.length || !j) return [];
  return j.jogos.filter(g => {
    const hay = [...`${g.casa.nome} ${g.fora.nome}`].map(normChar).join('');
    return terms.every(t => hay.includes(t));
  }).slice(0, 3);
}

function searchGamesHtml(list, terms) {
  if (!list.length) return '';
  return `<div class="search-group-label">Jogos de hoje</div>` + list.map(g => {
    const st = jogoEstado(g);
    const placar = g.golsCasa !== null && g.status !== 'agendado' ? ` ${Number(g.golsCasa)} × ${Number(g.golsFora)}` : '';
    return `<button type="button" class="search-result-item search-game" data-action="search-jogos">
      <div class="search-result-icon">⚽</div>
      <div class="search-result-body">
        <div class="search-result-title">${highlight(g.casa.nome, terms)}${placar || ' ×'} ${highlight(g.fora.nome, terms)}</div>
        <div class="search-result-meta">${escapeHtml(g.liga)} · ${escapeHtml(st.txt)}</div>
      </div></button>`;
  }).join('') + '<div class="search-group-label">Notícias</div>';
}

function renderSearchHint() {
  const rec = recentQueries();
  const trends = (State.home?.trends || []).slice(0, 5);
  const chip = (q, cls = '') => `<button type="button" class="search-chip ${cls}" data-action="search-q" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`;
  let html = '';
  if (rec.length) html += `<div class="search-group-label">Buscas recentes <button type="button" class="search-clear" data-action="search-clear">Limpar</button></div><div class="search-chips">${rec.map(q => chip(q)).join('')}</div>`;
  if (trends.length) html += `<div class="search-group-label">Em alta agora</div><div class="search-chips">${trends.map(t => chip(t.title, 'hot')).join('')}</div>`;
  $('#searchResults').innerHTML = html || '<div class="search-empty">Digite para buscar em todas as editorias</div>';
}

let searchTimer;
let searchReq = 0;

function handleSearchInput(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { searchReq++; renderSearchHint(); return; }
  searchTimer = setTimeout(() => performSearch(q), 80);
}

async function performSearch(q) {
  const el = $('#searchResults');
  const req = ++searchReq;
  State.lastQuery = q;
  const terms = searchTerms(q);

  let results;
  try {
    results = (await API.get(`/api/search?q=${encodeURIComponent(q)}`)).items || [];
  } catch (e) {
    if (req !== searchReq) return;
    el.innerHTML = `<div class="search-empty">${escapeHtml(describeError(e))}</div>`;
    return;
  }
  if (req !== searchReq) return;

  const gamesList = gameMatches(q);
  if (!results.length && !gamesList.length) {
    el.innerHTML = `<div class="search-empty">Nenhum resultado para "${escapeHtml(q)}"</div>`;
    return;
  }
  remember(results);
  el.innerHTML = searchGamesHtml(gamesList, terms) + results.slice(0, 10).map(n => {
    const cat = categoryOf(n.category);
    const link = safeUrl(n.link);
    return `
      <a class="search-result-item" href="${escapeHtml(link || '#')}" ${link ? 'target="_blank" rel="noopener noreferrer"' : ''} data-action="open-panel" data-id="${escapeHtml(n.id)}">
        <div class="search-result-icon"><span class="nav-icon" style="background:${escapeHtml(cat.color)}"></span></div>
        <div class="search-result-body">
          <div class="search-result-title">${highlight(n.title, terms)}</div>
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
    case 'jogos-liga':    State.jogosLeague = String(value); render(); break;
    case 'hero-go':       heroGo(Number(value)); heroStart(); break;
    case 'go-filter':     closePanel(); go('all', { filter: State.category === 'all' && State.filter === value ? 'all' : value }); break;
    case 'category':      closePanel(); go(value); break;
    case 'today':         go('all', { filter: 'today' }); break;
    case 'filter':        setFilter(value); break;
    case 'topic':         State.topic = State.topic === value ? 'all' : value; loadList(); break;
    case 'refresh':       loadCurrent({ force: true }); break;
    case 'retry':         loadCurrent({ force: true }); break;
    case 'load-more':     loadList({ reset: false }); break;
    case 'favorite':      toggleFavorite(id); break;
    case 'share':         shareItem(id); break;
    case 'toggle-ai':     toggleAI(el, id); break;
    case 'read':          markRead(id); if (State.searchOpen) closeSearch(); return;   // deixa o link abrir
    case 'trend':         openSearch(); $('#searchInput').value = el.dataset.q; performSearch(el.dataset.q); break;
    case 'view':          setView(value); break;
    case 'search-q':      { const inp = $('#searchInput'); inp.value = el.dataset.q; performSearch(el.dataset.q); inp.focus(); break; }
    case 'search-clear':  clearRecent(); renderSearchHint(); break;
    case 'search-jogos':  saveRecent(State.lastQuery); closeSearch(); go('jogos'); break;
    case 'open-reader':   openReader(id); break;
    case 'close-reader':  closeReader(); break;
    case 'reader-prev':   readerNav(-1); break;
    case 'reader-next':   readerNav(1); break;
    case 'reader-font':   readerFont(Number(value)); break;
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
  if (e.key === 'Escape') {
    if (State.searchOpen) closeSearch();
    else if (State.readerId) closeReader();
    else if (State.panelId) closePanel();
    if (State.sidebarOpen) closeSidebar();
  }

  // Leitura: setas trocam de notícia
  if (State.readerId && !State.searchOpen && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    readerNav(e.key === 'ArrowRight' ? 1 : -1);
  }

  // Busca: setas percorrem os resultados e Enter abre o primeiro
  if (State.searchOpen) {
    const items = $$('#searchResults .search-result-item');
    const at = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[Math.min(items.length - 1, at + 1)].focus(); }
    else if (e.key === 'ArrowUp' && at >= 0) { e.preventDefault(); (at === 0 ? $('#searchInput') : items[at - 1]).focus(); }
    else if (e.key === 'Enter' && e.target?.id === 'searchInput' && items.length) { e.preventDefault(); items[0].click(); }
  }

  // Keep keyboard focus inside the active dialog until it is dismissed.
  if (e.key === 'Tab' && (State.searchOpen || State.panelId || State.readerId)) {
    const dialog = State.searchOpen ? $('#searchOverlay') : State.readerId ? $('#reader') : $('#newsPanel');
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
  loadJogos();
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

  let savedView = 'list';
  try { savedView = localStorage.getItem('tn_view') || 'list'; } catch { /* ignore */ }
  setView(savedView);
  const small = window.matchMedia('(max-width: 600px)').matches;
  const topDate = $('#topDate');
  if (topDate) {
    const date = new Date().toLocaleDateString('pt-BR', small
      ? { weekday: 'short', day: '2-digit', month: 'short' }
      : { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    topDate.textContent = small ? date : `${getGreeting()}, Dagner · ${date}`;
  }
  $('#searchShortcut').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  initToTop();
  initReader();
  initHeroSwipe();
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  $('#searchInput').addEventListener('input', handleSearchInput);
  window.addEventListener('popstate', () => { State.category = readHash(); updateChrome(); loadCurrent(); });
  document.addEventListener('visibilitychange', autoRefresh);
  setInterval(autoRefresh, CONFIG.AUTO_REFRESH);

  // Imagem quebrada: mostra o ícone da editoria no lugar.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.classList.contains('team-logo')) { img.style.visibility = 'hidden'; return; }
    if (img.tagName === 'IMG' && img.classList.contains('item-img')) {
      img.closest('.item-thumb')?.remove();
      const media = img.closest('.media, .panel-media');
      if (media) {
        const icon = media.dataset.icon || '';
        img.remove();
        media.classList.add('no-img');
        if (!media.querySelector('.feat-media-mark')) media.insertAdjacentHTML('afterbegin', `<span class="feat-media-mark">${escapeHtml(icon)}</span>`);
      }
    }
  }, true);

  State.category = readHash();
  updateChrome();
  loadCurrent();
  loadSources();
  loadJogos();

  if (Sync.on) {
    const note = $('#syncNote');
    if (note) note.textContent = 'Favoritos e lidas compartilhados com o grupo';
    Sync.start(() => { updateChrome(); if (currentView() === 'favorites' || currentView() === 'history') render(); });
  }
  hideSplash();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
