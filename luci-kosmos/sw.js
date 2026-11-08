// Luci w kosmosie działa bez internetu: po pierwszej wizycie wszystko jest w pamięci telefonu.
// Strona gry jest najpierw pobierana z sieci (żeby nowa wersja była od razu), a bez internetu bierze się kopię z pamięci.
// Ikony i manifest idą z pamięci, a w tle się odświeżają.
const CACHE = 'luci-kosmos-v4';
const PLIKI = ['./', './index.html', './manifest.webmanifest', './ikona-192.png', './ikona-512.png', './ikona-maskowalna-512.png', './apple-touch-icon.png', './luci-spi.webp', './luci-nagroda.webp'];

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
  const strona = req.mode === 'navigate' || req.url.endsWith('/') || req.url.endsWith('.html');
  if (strona) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const kopia = res.clone(); caches.open(CACHE).then(c => c.put(req, kopia)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(k => k || caches.match('./index.html'))));
    return;
  }
  const cache = caches.open(CACHE);
  const kopia = cache.then(c => c.match(req, { ignoreSearch: true }));
  const siec = cache.then(c => fetch(req).then(res => {
    if (res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  }));
  e.waitUntil(siec.catch(() => {}));
  e.respondWith(kopia.then(k => k || siec).catch(() => kopia.then(k => k || Response.error())));
});
