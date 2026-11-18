/* Service worker — DS Gestão V110 (Arquitetura Modular). Dados ficam no Supabase (nunca em cache aqui). */
const VERSION = 'ds-v110-20261118';
const CORE = [
  './',
  'index.html',
  'manifest.json',
  'css/base.css',
  'css/modules.css',
  'css/theme-dark-gold.css',
  'css/v100.css',
  'css/v102.css',
  'css/v109.css',
  'js/core.js',
  'js/ui-atalhos.js',
  'js/kanban-briefing.js',
  'js/financeiro-despesas.js',
  'js/aprovacao-avisos.js',
  'js/sync-produtividade.js',
  'js/v100.js',
  'js/v109.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/logo.png',
  'icons/logo.svg',
  'icons/logo-branco.svg',
  'icons/favicon-32.png',
  'icons/favicon-64.png',
  'icons/apple-touch-icon.png',
  'icons/maskable-512.png'
];

/* Bibliotecas e fontes locais (inclui woff2 dos ícones Tabler para funcionamento 100% offline) */
const LIBS = [
  'libs/supabase.min.js',
  'libs/jspdf.umd.min.js',
  'libs/jspdf.plugin.autotable.min.js',
  'libs/tabler/tabler-icons.min.css',
  'libs/tabler/fonts/tabler-icons.woff2',
  'libs/fonts/inter-400.woff',
  'libs/fonts/inter-500.woff',
  'libs/fonts/inter-600.woff',
  'libs/fonts/inter-700.woff',
  'libs/fonts/inter-800.woff'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE).then(() => Promise.all(LIBS.map(u => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return; // dados: sempre rede
  const sameOrigin = url.origin === self.location.origin;
  const cdn = /(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (sameOrigin) {
    // rede primeiro (pega versão nova), cache como reserva (ignorando ?v=...)
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
    );
  } else if (cdn) {
    // bibliotecas e fontes externas: abre do cache e atualiza por trás
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
