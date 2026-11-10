/* TabNews: service worker. Páginas e dados: rede primeiro (sempre a versão nova), cache como reserva. */
const VERSION = 'tabnews-v14-fontes-locais';
const CORE = ['./', 'index.html', 'manifest.json', 'assets/css/main.css', 'assets/js/config.js', 'assets/js/api.js',
  'assets/js/favorites.js', 'assets/js/sync.js', 'assets/js/app.js', 'assets/js/pwa.js', 'assets/js/theme.js',
  'assets/fonts/dm-sans.woff', 'assets/fonts/newsreader.woff', 'assets/fonts/newsreader-italic.woff', 'icons/logo-tn.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
// Os arquivos são guardados sem "?v=": a busca offline ignora a parte da versão, então o pré-cache
// serve qualquer versão pedida pelo index.html e nunca fica desalinhado.

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
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
