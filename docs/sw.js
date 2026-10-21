/* DS Intelligence: service worker. Páginas e dados: rede primeiro (sempre a versão nova), cache como reserva. */
const VERSION = 'dsnews-v7';
const CORE = ['./', 'index.html', 'manifest.json', 'assets/css/main.css', 'assets/js/config.js', 'assets/js/api.js',
  'assets/js/favorites.js', 'assets/js/app.js', 'assets/js/pwa.js', 'assets/js/theme.js', 'icons/icon-192.png'];

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
