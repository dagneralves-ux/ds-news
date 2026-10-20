/**
 * DS Intelligence (pessoal): "API" no próprio navegador.
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
    const now = Date.now();
    const { total, todayCount, counts } = this._counts(items);
    const breaking = items.filter(n => n.importance === 'urgent' && now - new Date(n.date) < 24 * 3600000).slice(0, 6);
    const breakingIds = new Set(breaking.map(n => n.id));
    const sections = Object.keys(CATEGORIES).filter(k => k !== 'all').map(category => ({
      category,
      total: counts[category] || 0,
      items: items.filter(n => n.category === category && !breakingIds.has(n.id)).slice(0, 6),
    })).filter(s => s.items.length);
    return { breaking, sections, trends: data.tendencias || [], total, todayCount, counts, lastUpdated: data.atualizadoEm };
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
