/**
 * TabNews (pessoal): "API" no próprio navegador.
 *
 * Não há servidor: um robô (GitHub Actions) grava data/news.json a cada ~30 minutos e o site
 * só lê esse arquivo. Esta camada responde às mesmas rotas que o app.js já usava
 * (/api/home, /api/news, /api/search, /api/dashboard) filtrando o arquivo na hora.
 */
const API = {
  _data: null,
  _loading: null,

  /** Baixa (ou revalida) data/news.json. */
  async load(force = false) {
    if (this._data && !force) return this._data;
    if (this._loading && !force) return this._loading;

    this._loading = (async () => {
      let res;
      try {
        res = await fetch('data/news.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
      } catch {
        const err = new Error('network'); err.code = 'network'; throw err;
      }
      if (!res.ok) { const err = new Error(`HTTP ${res.status}`); err.status = res.status; throw err; }

      let json;
      try { json = await res.json(); }
      catch { const err = new Error('invalid'); err.code = 'invalid'; throw err; }
      if (!json || !Array.isArray(json.itens)) { const err = new Error('invalid'); err.code = 'invalid'; throw err; }

      Object.entries(json.categorias || {}).forEach(([key, c]) => { CATEGORIES[key] = c; });
      json.itens.sort((a, b) => new Date(b.date) - new Date(a.date));
      json.itens = clusterItems(json.itens);
      this._data = json;
      return json;
    })();

    try { return await this._loading; }
    finally { this._loading = null; }
  },

  /** Estado das fontes (opcional: data/status.json). */
  async status() {
    try {
      const res = await fetch('data/status.json', { cache: 'no-cache' });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },

  clearCache() { this._data = null; },

  async get(endpoint) {
    const data = await this.load();
    const url = new URL(endpoint, 'http://local');
    const q = url.searchParams;
    const items = data.itens;
    const out = { ok: true };

    switch (url.pathname) {
      case '/api/home': return { ...out, ...this._home(items, data) };
      case '/api/dashboard': return { ...out, ...this._counts(items), lastUpdated: data.atualizadoEm };
      case '/api/news': {
        const category = q.get('category') || 'all';
        const filter = q.get('filter') || 'all';
        const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(q.get('limit'), 10) || 24));
        let list = category === 'all' ? items : items.filter(n => n.category === category);
        list = this._filter(list, filter);
        return { ...out, items: list.slice((page - 1) * limit, page * limit), total: list.length, page, limit, hasMore: page * limit < list.length };
      }
      case '/api/search': {
        const terms = this._norm(q.get('q') || '').split(' ').filter(t => t.length >= 2);
        if (!terms.length) return { ...out, items: [], total: 0 };
        const found = items.filter(n => {
          const hay = this._norm(`${n.title} ${n.summary || ''} ${n.source}`);
          return terms.every(t => hay.includes(t));
        });
        return { ...out, items: found.slice(0, 20), total: found.length };
      }
      default: {
        const err = new Error('HTTP 404'); err.status = 404; throw err;
      }
    }
  },

  _norm(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  },

  _startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },

  _filter(items, filter) {
    const now = Date.now(); const H = 3600000;
    switch (filter) {
      case 'today':  { const s = this._startOfToday(); return items.filter(n => new Date(n.date) >= s); }
      case '24h':    return items.filter(n => now - new Date(n.date) <= 24 * H);
      case 'urgent': return items.filter(n => n.importance === 'urgent');
      case 'high':   return items.filter(n => n.importance === 'high' || n.importance === 'urgent');
      default:       return items;
    }
  },

  _counts(items) {
    const counts = {};
    items.forEach(n => { counts[n.category] = (counts[n.category] || 0) + 1; });
    const s = this._startOfToday();
    return { total: items.length, todayCount: items.filter(n => new Date(n.date) >= s).length, counts };
  },

  _home(items, data) {
    const now = Date.now(); const H = 3600000;
    const { total, todayCount, counts } = this._counts(items);

    // Destaque do dia: urgentes e destaques recentes, com foto e várias fontes pesam mais; no máximo 2 por editoria.
    const recent = items.filter(n => now - new Date(n.date) < 36 * H);
    const pool = recent.length >= 4 ? recent : items;
    const score = n => (n.importance === 'urgent' ? 3 : n.importance === 'high' ? 2 : 0)
      + (n.image ? 1 : 0) + (n.aiSummary ? .5 : 0) + (n.also?.length || 0) * 1.5
      - (now - new Date(n.date)) / (24 * H);
    const perCat = {};
    const featured = [...pool].sort((a, b) => score(b) - score(a)).filter(n => {
      perCat[n.category] = (perCat[n.category] || 0) + 1;
      return perCat[n.category] <= 2;
    }).slice(0, 4);
    const featuredIds = new Set(featured.map(n => n.id));

    const sections = Object.keys(CATEGORIES).filter(k => k !== 'all').map(category => ({
      category,
      total: counts[category] || 0,
      items: items.filter(n => n.category === category && !featuredIds.has(n.id)).slice(0, 10),
    })).filter(s => s.items.length);
    return { featured, sections, trends: data.tendencias || [], total, todayCount, counts, lastUpdated: data.atualizadoEm };
  },
};

/** Mensagem amigável para cada tipo de falha. */
function describeError(err) {
  if (err?.status === 404) {
    return 'O arquivo de notícias ainda não foi gerado. No GitHub, abra Actions, escolha "Atualizar notícias" e clique em Run workflow.';
  }
  if (err?.code === 'network') return 'Sem conexão com a internet. Verifique e tente de novo.';
  if (err?.code === 'invalid') return 'O arquivo de notícias está inválido. Rode a atualização de novo no GitHub.';
  return 'Algo deu errado ao carregar as notícias. Tente de novo.';
}

/**
 * Junta a mesma notícia publicada por fontes diferentes num cartão só.
 * O cartão é o da fonte que publicou primeiro; as outras ficam em item.also.
 */
const _STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'para', 'por', 'com',
  'que', 'se', 'ao', 'aos', 'as', 'os', 'como', 'mais', 'sobre', 'apos', 'vai', 'sera', 'tem', 'foi', 'seu', 'sua', 'ele', 'ela']);

function _titleTokens(title) {
  const t = String(title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !_STOP.has(w));
  return new Set(t);
}

function _similar(a, b) {
  if (a.size < 3 || b.size < 3) return false;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return inter >= 3 && (inter / union >= 0.5 || inter / Math.min(a.size, b.size) >= 0.75);
}

function clusterItems(items) {
  const WINDOW = 36 * 3600000;
  const asc = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
  const heads = [];
  for (const n of asc) {
    const toks = _titleTokens(n.title);
    const head = heads.find(h => Math.abs(new Date(n.date) - new Date(h.item.date)) <= WINDOW
      && h.item.source !== n.source && !h.sources.has(n.source) && _similar(h.toks, toks));
    if (head) {
      head.sources.add(n.source);
      (head.item.also = head.item.also || []).push({ source: n.source, link: n.link, date: n.date, title: n.title });
      if (!head.item.image && n.image) head.item.image = n.image;
    } else {
      heads.push({ item: n, toks, sources: new Set([n.source]) });
    }
  }
  return heads.map(h => h.item).sort((a, b) => new Date(b.date) - new Date(a.date));
}
