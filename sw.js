// BizCard service worker: çevrimdışı çalışma için tüm dosyaları önbelleğe alır.
// Dosyaları güncellediğinizde VERSION değerini artırın.
const VERSION = 'bizcard-v1';
const ASSETS = [
  './',
  'index.html',
  'en.html',
  'logo.svg',
  'logo.png',
  'apple-touch-icon.png',
  'volkan-gozen.vcf',
  'volkan-gozen-en.vcf',
  'manifest.webmanifest',
  'manifest-en.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Sayfalar: önce ağ (güncel içerik), çevrimdışıysa önbellek.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
    );
    return;
  }

  // Diğer dosyalar: önce önbellek, arka planda güncelle.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
