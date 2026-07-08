// HR Lanto Service Worker

const CACHE_NAME = 'hr-lanto-v5'; // เพิ่ม version เพื่อล้าง cache เก่า

// ไม่ cache file ล่วงหน้าเพื่อหลีกเลี่ยงปัญหา path
const urlsToCache = [];

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    self.skipWaiting(); // Activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Cache opened');
            return Promise.resolve(); // Don't pre-cache anything
        })
    );
});

// Fetch event - Network first, then cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Fix: Ignore unsupported schemes (like chrome-extension://)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Don't cache API requests
    if (url.pathname.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Network first strategy for all other requests
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Check if valid response
                if (response && response.status === 200 && response.type === 'basic') {
                    // Only cache static assets (CSS, JS, images)
                    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/)) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                }
                return response;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated');
            return self.clients.claim(); // Take control of all pages immediately
        })
    );
});

