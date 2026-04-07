/**
 * Smile Savers Dental — Service Worker
 * Strategy: Cache-first for assets, Network-first for pages
 * Offline: Serves /offline page if network fails
 */

const VERSION    = 'v2';
const CACHE_NAME = `smile-savers-${VERSION}`;

// Assets to pre-cache on install (shell)
const PRECACHE = [
  '/',
  '/offline',
  '/manifest.json',
  '/fonts/inter-variable.woff2',
  '/fonts/plus-jakarta-sans-variable.woff2',
  '/favicon.svg',
  '/logo.svg',
  '/images/hero-dental-office.jpg',
];

// Runtime cache strategies
const CACHE_FIRST  = [/\/fonts\//, /\/icons\//, /\/_astro\/.*\.(css|js)$/, /\.woff2?$/];
const NET_FIRST    = [/\/api\//, /\/appointments/, /\/contact/];
const STALE_WHILE  = [/\/images\//, /\/aff\d/];

// ── Install ─────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin + GET
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // API calls: network only (never cache)
  if (NET_FIRST.some(r => r.test(url.pathname))) {
    e.respondWith(fetch(request).catch(() => offlineFallback(request)));
    return;
  }

  // Static assets: cache first
  if (CACHE_FIRST.some(r => r.test(url.pathname))) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Images: stale-while-revalidate
  if (STALE_WHILE.some(r => r.test(url.pathname))) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Pages: network first, fall back to cache, then offline
  e.respondWith(networkFirst(request));
});

// ── Strategies ───────────────────────────────────────────────
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const response = await fetch(req);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, response.clone());
  }
  return response;
}

async function networkFirst(req) {
  try {
    const response = await fetch(req);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(req);
    return cached || offlineFallback(req);
  }
}

async function staleWhileRevalidate(req) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const fresh  = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
  return cached || fresh;
}

async function offlineFallback(req) {
  if (req.headers.get('accept')?.includes('text/html')) {
    return caches.match('/offline') || new Response('<h1>Offline</h1><p>Please check your connection.</p>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  return new Response('Offline', { status: 503 });
}
