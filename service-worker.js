const CACHE_NAMES = {
  pages: 'pages-cache-v1',
  assets: 'assets-cache-v1',
  offline: 'offline-cache-v1'
}

// Detect base path from service worker script URL
const swUrl = new URL(self.location.href)
const BASE_PATH = swUrl.pathname.replace('/service-worker.js', '')

const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './site.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './apple-touch-icon.png',
  './favicon-16x16.png',
  './favicon-32x32.png'
]

// Install: Pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAMES.offline)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !Object.values(CACHE_NAMES).includes(name))
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch with Network-First + ETag support
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Handle static assets (Cache-First)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Handle navigation requests
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request))
  }
})

function isStaticAsset (pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|ttf|otf)$/.test(pathname)
}

// Cache-First for static assets
async function cacheFirst (request) {
  const cache = await caches.open(CACHE_NAMES.assets)
  const cached = await cache.match(request)

  if (cached) {
    // Update in background
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response)
    }).catch(() => {})
    return cached
  }

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

// Network-First for pages
async function networkFirst (request) {
  const cache = await caches.open(CACHE_NAMES.pages)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
  } catch (error) {
    // Network failed
  }

  // Return cached or offline page
  const cached = await cache.match(request)
  if (cached) return cached

  const offlineCache = await caches.open(CACHE_NAMES.offline)
  return offlineCache.match('./offline.html') || new Response('Offline', { status: 503 })
}
