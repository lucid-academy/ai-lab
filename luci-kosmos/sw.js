// Luci w kosmosie działa bez internetu: po pierwszej wizycie wszystko jest w pamięci telefonu.
// Każde żądanie dostaje od razu kopię z pamięci, a w tle pobierana jest nowsza wersja na następne uruchomienie.
const CACHE = 'luci-kosmos-v1';
const PLIKI = ['./', './index.html', './manifest.webmanifest', './ikona-192.png', './ikona-512.png', './ikona-maskowalna-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PLIKI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('luci-kosmos-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  const cache = caches.open(CACHE);
  const kopia = cache.then(c => c.match(req, { ignoreSearch: true }));
  const siec = cache.then(c => fetch(req).then(res => {
    if (res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  }));
  e.waitUntil(siec.catch(() => {}));
  e.respondWith(kopia.then(k => k || siec).catch(() => kopia.then(k => k || Response.error())));
});
