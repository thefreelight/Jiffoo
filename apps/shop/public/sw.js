const DB_NAME = 'pwa-sync-db';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const defaultData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    data: {
      url: '/',
    },
  };

  let notificationData = defaultData;

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || defaultData.title,
        body: payload.body || defaultData.body,
        icon: payload.icon || defaultData.icon,
        badge: payload.badge || defaultData.badge,
        data: payload.data || defaultData.data,
      };
    } catch (error) {
      notificationData = {
        ...defaultData,
        body: event.data.text(),
      };
      console.error('[Service Worker] Failed to parse push payload:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: `notification-${Date.now()}`,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }

        return undefined;
      }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
      })
      .then((newSubscription) =>
        fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newSubscription.toJSON()),
        }),
      )
      .catch((error) => {
        console.error('[Service Worker] Push resubscription failed:', error);
      }),
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function getQueuedRequests() {
  return openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('queue');

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Failed to read sync queue'));
      }),
  );
}

function persistQueuedRequests(queue) {
  return openQueueDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        if (!queue || queue.length === 0) {
          store.delete('queue');
        } else {
          store.put(queue, 'queue');
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(transaction.error || new Error('Failed to persist sync queue'));
      }),
  );
}

async function handleBackgroundSync() {
  try {
    const queuedRequests = await getQueuedRequests();
    if (!queuedRequests.length) {
      return;
    }

    const successfulRequestIds = [];

    for (const request of queuedRequests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        successfulRequestIds.push(request.id);
      } catch (error) {
        console.error('[Service Worker] Background sync request failed:', error);
      }
    }

    const remainingQueue = queuedRequests.filter((request) => !successfulRequestIds.includes(request.id));
    await persistQueuedRequests(remainingQueue);

    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_COMPLETE',
        success: successfulRequestIds.length,
        failed: queuedRequests.length - successfulRequestIds.length,
      });
    });
  } catch (error) {
    console.error('[Service Worker] Background sync error:', error);
    throw error;
  }
}
