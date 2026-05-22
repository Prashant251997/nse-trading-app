// Cache version - increment to force update
const CACHE_NAME = 'nse-scanner-v2-' + new Date().toISOString().split('T')[0];

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// Install: Cache all files
self.addEventListener('install', event => {
  console.log('SW installing new version:', CACHE_NAME);
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch: Network first for HTML/JSON, cache for assets
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // ALWAYS fetch signals.json fresh (no cache)
  if (url.includes('signals.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Network first for app.js (always get latest)
  if (url.includes('app.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Cache first for other assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});

// Activate: Clean old caches
self.addEventListener('activate', event => {
  console.log('SW activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('nse-scanner') && name !== CACHE_NAME)
          .map(name => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});
