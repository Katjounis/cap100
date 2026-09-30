/* Cap 100 — service worker : fonctionnement hors connexion.
   Il ne met en cache que les fichiers de l'application. Tes données restent dans IndexedDB
   et ne transitent jamais par le réseau. */
const VERSION = 'cap100-v1.5.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/util.js', './js/db.js', './js/domain.js', './js/charts.js', './js/ui.js', './js/forms.js', './js/workout.js', './js/dashboard.js',
  './js/calendar.js', './js/nutrition.js', './js/training.js', './js/body.js', './js/habits.js', './js/goal.js', './js/stats.js', './js/settings.js',
  './js/recipes-data.js', './js/recipes-more.js', './js/kitchen.js', './js/ciqual.js', './js/foods-db.js', './js/prices.js', './js/coach.js', './js/demo.js', './js/cloud-config.js', './js/cloud.js', './js/account.js',
  './js/app.js',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-700-normal.woff2',
  './fonts/figtree-latin-400-normal.woff2', './fonts/figtree-latin-500-normal.woff2', './fonts/figtree-latin-600-normal.woff2', './fonts/figtree-latin-700-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Réseau d'abord (mises à jour immédiates), cache si hors connexion */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
