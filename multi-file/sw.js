/* Offline cache for the multi-file portal (only registered when served over http/https). Data stays in localStorage — never cached or sent anywhere. */
const CACHE = 'milad-portal-v11';
const FILES = ['./', './index.html', './manifest.webmanifest',
  './assets/css/style.css', './assets/js/sound.js', './assets/js/sky.js', './assets/music-data.js', './assets/js/data.js', './assets/lib/chart.umd.js',
  './assets/js/finance-seed.js', './assets/js/finance.js', './assets/js/daily.js', './assets/js/agents.js', './assets/js/app.js', './assets/js/extras.js', './assets/js/offline.js', './assets/js/crew-orbit.js', './assets/css/crew-orbit.css',
  './assets/logo-milad-v2.png', './assets/logo-milad-v2-256.png', './assets/logo-milad-v2-128.png', './assets/logo-company.png', './assets/logo-company-flat.png',
  './assets/icons/icon-192.png', './assets/agents/nexo.webp', './assets/agents/argus.webp', './assets/agents/shaho.webp', './assets/agents/webo.webp', './assets/agents/novak.webp', './assets/agents/viera.webp', './assets/agents/jergeh.webp', './assets/agents/pixel.webp', './assets/agents/reflex.webp', './assets/agents/radar.webp', './assets/icons/icon-512.png',
  './assets/orbit/logo/milad-logo-512.webp', './assets/orbit/avatars/argus-256.png', './assets/orbit/avatars/shaho-256.png', './assets/orbit/avatars/webo-256.png', './assets/orbit/avatars/nexo-256.png', './assets/orbit/avatars/novak-256.png', './assets/orbit/avatars/viera-256.png', './assets/orbit/avatars/jergeh-256.png', './assets/orbit/avatars/reflex-256.png', './assets/orbit/avatars/radar-256.png', './assets/orbit/avatars/pixel-256.png',
  './assets/fonts/Vazirmatn.ttf', './assets/fonts/ArefRuqaa-Regular.ttf', './assets/fonts/ArefRuqaa-Bold.ttf', './assets/fonts/PlaypenSansArabic.ttf',
  './assets/fonts/Cinzel.ttf', './assets/fonts/Orbitron.ttf', './assets/fonts/GreatVibes-Regular.ttf', './assets/fonts/Lalezar.ttf', './assets/fonts/Estedad.ttf'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => null))))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => hit || caches.match('./index.html'));
    return hit || net;
  }));
});
