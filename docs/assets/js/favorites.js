/**
 * DS Intelligence — Favorites & History Manager
 * Armazena dados no localStorage com prefixo de versão.
 */
const Store = {
  _prefix: `ds_${CONFIG.CACHE_VERSION}_`,

  _key(name) { return this._prefix + name; },

  _get(name) {
    try { return JSON.parse(localStorage.getItem(this._key(name)) || '[]'); }
    catch { return []; }
  },

  _set(name, data) {
    try { localStorage.setItem(this._key(name), JSON.stringify(data)); }
    catch (e) { console.warn('[Store] localStorage write failed:', e); }
  },

  // Remove dados de versões antigas (IDs colidiam) para não ocupar espaço à toa.
  _cleanOldVersions() {
    try {
      Object.keys(localStorage)
        .filter(k => /^ds_v\d+_/.test(k) && !k.startsWith(this._prefix))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  },

  // ── Favorites ───────────────────────────────────────────────
  getFavorites() { return this._get('favorites'); },

  addFavorite(newsItem) {
    const favs = this.getFavorites();
    if (!favs.find(f => f.id === newsItem.id)) {
      favs.unshift({ ...newsItem, savedAt: new Date().toISOString() });
      if (favs.length > 300) favs.splice(300);
      this._set('favorites', favs);
    }
  },

  removeFavorite(id) {
    const favs = this.getFavorites().filter(f => f.id !== id);
    this._set('favorites', favs);
  },

  isFavorite(id) {
    return this.getFavorites().some(f => f.id === id);
  },

  toggleFavorite(newsItem) {
    if (this.isFavorite(newsItem.id)) {
      this.removeFavorite(newsItem.id);
      return false;
    } else {
      this.addFavorite(newsItem);
      return true;
    }
  },

  // ── History (read items) ────────────────────────────────────
  getHistory() { return this._get('history'); },

  markRead(newsItem) {
    const hist = this.getHistory();
    if (!hist.find(h => h.id === newsItem.id)) {
      hist.unshift({ ...newsItem, readAt: new Date().toISOString() });
      // Manter apenas os últimos 200 items
      if (hist.length > 200) hist.splice(200);
      this._set('history', hist);
    }
  },

  isRead(id) {
    return this.getHistory().some(h => h.id === id);
  },

  clearHistory() {
    this._set('history', []);
  },

  // ── Counts ──────────────────────────────────────────────────
  getFavoritesCount() { return this.getFavorites().length; },
  getHistoryCount()   { return this.getHistory().length; },
};

Store._cleanOldVersions();
