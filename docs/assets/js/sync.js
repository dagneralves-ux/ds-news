/**
 * TabNews: favoritos e lidas compartilhados (Supabase, opcional).
 * Sem url/key em config.js, nada disso roda e tudo fica só neste navegador.
 * O que muda em um aparelho aparece nos outros em até 1 minuto.
 */
const Sync = {
  on: !!(CONFIG.SYNC && CONFIG.SYNC.url && CONFIG.SYNC.key),
  _pending: 0,
  _lastSig: '',

  _url(qs = '') { return CONFIG.SYNC.url.replace(/\/$/, '') + '/rest/v1/tabnews_state' + qs; },
  _group() { return encodeURIComponent(CONFIG.SYNC.group || 'tabnews'); },

  async _req(method, qs, body, prefer) {
    const headers = { apikey: CONFIG.SYNC.key, Authorization: 'Bearer ' + CONFIG.SYNC.key, 'Content-Type': 'application/json' };
    if (prefer) headers.Prefer = prefer;
    this._pending++;
    try {
      const res = await fetch(this._url(qs), { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) return null;
      return method === 'GET' ? await res.json() : true;
    } catch { return null; }
    finally { this._pending--; }
  },

  _row(kind, item) {
    return { group_id: CONFIG.SYNC.group || 'tabnews', kind, item_id: item.id, payload: item, updated_at: new Date().toISOString() };
  },

  push(kind, item) {
    return this._req('POST', '?on_conflict=group_id,kind,item_id', [this._row(kind, item)], 'resolution=merge-duplicates,return=minimal');
  },
  remove(kind, id) {
    return this._req('DELETE', `?group_id=eq.${this._group()}&kind=eq.${kind}&item_id=eq.${encodeURIComponent(id)}`);
  },
  clear(kind) {
    return this._req('DELETE', `?group_id=eq.${this._group()}&kind=eq.${kind}`);
  },

  async refresh(onChange) {
    if (!this.on || this._pending > 0) return;
    const rows = await this._req('GET', `?group_id=eq.${this._group()}&select=kind,item_id,payload,updated_at&order=updated_at.desc&limit=1000`);
    if (!Array.isArray(rows) || this._pending > 0) return;
    const pick = (kind, stamp, max) => rows.filter(r => r.kind === kind)
      .map(r => ({ ...r.payload, [stamp]: r.updated_at })).slice(0, max);
    const favs = pick('fav', 'savedAt', 300);
    const hist = pick('read', 'readAt', 200);
    const sig = favs.map(f => f.id).join(',') + '|' + hist.map(h => h.id).join(',');
    if (sig === this._lastSig) return;
    this._lastSig = sig;
    Store._set('favorites', favs);
    Store._set('history', hist);
    try { onChange && onChange(); } catch { /* ignore */ }
  },

  async start(onChange) {
    if (!this.on) return;
    let done = false;
    try { done = !!localStorage.getItem('tn_sync_done'); } catch { /* ignore */ }
    if (!done) {   // primeira vez: sobe o que já existia neste aparelho
      const rows = [...Store.getFavorites().map(i => this._row('fav', i)), ...Store.getHistory().map(i => this._row('read', i))];
      if (rows.length) await this._req('POST', '?on_conflict=group_id,kind,item_id', rows, 'resolution=merge-duplicates,return=minimal');
      try { localStorage.setItem('tn_sync_done', '1'); } catch { /* ignore */ }
    }
    await this.refresh(onChange);
    setInterval(() => { if (!document.hidden) this.refresh(onChange); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(onChange); });
  },
};
