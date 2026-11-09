/* TabNews: service worker. Páginas e dados: rede primeiro (sempre a versão nova), cache como reserva. */
const VERSION = 'tabnews-v9';
const CORE = ['./', 'index.html', 'manifest.json', 'assets/css/main.css?v=11', 'assets/js/config.js?v=5', 'assets/js/api.js?v=5',
  'assets/js/favorites.js?v=5', 'assets/js/sync.js?v=1', 'assets/js/app.js?v=11', 'assets/js/pwa.js?v=2', 'assets/js/theme.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // imagens e fontes externas: direto da rede
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
