/* Agente - $$ — service worker: tiene sul dispositivo il "guscio" dell'app (HTML, CSS, JS, icone)
 * così si apre subito anche con rete lenta. I dati NON passano da qui: le chiamate al server
 * (script.google.com) vanno sempre in rete. Per pubblicare una nuova versione basta cambiare VERSIONE. */
const VERSIONE = 'agente-b28f89dd71';
const GUSCIO = ['./', 'index.html', 'stile.css', 'motore.js', 'api.js', 'app.js', 'viste.js', 'manifest.webmanifest',
  'icone/icona-192.png', 'icone/icona-512.png', 'icone/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(GUSCIO.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIONE && k !== VERSIONE + '-font').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // guscio: dalla memoria del dispositivo; la pagina in sé con "ignoreSearch" (link con parametri)
    e.respondWith(caches.match(req, { ignoreSearch: req.mode === 'navigate' })
      .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : null))
      .then(r => r || fetch(req)));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // caratteri: prima la memoria, poi la rete (e si salvano per la volta dopo)
    e.respondWith(caches.open(VERSIONE + '-font').then(c => c.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
