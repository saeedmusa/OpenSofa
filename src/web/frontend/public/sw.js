const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `opensofa-${BUILD_VERSION}`;
const OFFLINE_URL = '/offline.html';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon.svg',
];

const SYNC_TAG = 'message-sync';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('opensofa-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  
  // Skip interception for ANY external domain (Google Speech API, etc)
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
    return;
  }

  // Skip interception for speech recognition APIs (Chrome/Google)
  if (url.hostname.includes('google') || url.protocol === 'chrome-extension:') {
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncMessages());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUEUE_MESSAGE') {
    event.waitUntil(queueMessage(event.data.payload));
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function syncMessages() {
  const db = await openQueueDB();
  const pending = await getAllPending(db);
  
  for (const msg of pending) {
    try {
      const response = await fetch(`/api/sessions/${msg.sessionName}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg.content }),
      });
      
      if (response.ok) {
        await removePending(db, msg.id);
        console.log('[SW] Synced message:', msg.id);
      }
    } catch (err) {
      console.error('[SW] Sync failed for:', msg.id, err);
    }
  }
  
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

async function queueMessage(payload) {
  const db = await openQueueDB();
  const msg = {
    id: crypto.randomUUID(),
    ...payload,
    timestamp: Date.now(),
  };
  
  await addPending(db, msg);
  
  if ('sync' in self.registration) {
    await self.registration.sync.register(SYNC_TAG);
  }
  
  return msg.id;
}

const DB_NAME = 'opensofa-message-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function addPending(db, msg) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(msg);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

console.log('[SW] Service worker loaded, version:', BUILD_VERSION);

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const payload = event.data.json();
    const title = payload.title || 'OpenSofa Notification';
    const options = {
      body: payload.body || 'You have a new message.',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: {
        url: payload.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[SW] Error parsing push payload', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
