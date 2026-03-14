/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Service Worker event types
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

import { openDB } from 'idb';

// IndexedDB Configuration for Background Sync Queue
const DB_NAME = 'pwa-sync-db';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

// Get IndexedDB database instance
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

// Listen for push events from the server
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  // Default notification data
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

  // Try to parse the push event data
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
      console.error('[Service Worker] Error parsing push data:', error);
      // Use text data if JSON parsing fails
      notificationData.body = event.data.text();
    }
  }

  // Show the notification
  const notificationPromise = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: 'notification-' + Date.now(),
    }
  );

  event.waitUntil(notificationPromise);
});

// Listen for notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  // Get the URL to open from the notification data
  const urlToOpen = event.notification.data?.url || '/';

  // Open the URL or focus existing window
  const promiseChain = self.clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // Check if there's already a window open with this URL
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      // If no existing window, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});

// Listen for push subscription change events
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[Service Worker] Push subscription changed:', event);

  // Resubscribe to push notifications
  const subscriptionPromise = self.registration.pushManager
    .subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options.applicationServerKey,
    })
    .then((newSubscription) => {
      console.log('[Service Worker] New push subscription:', newSubscription);

      // Send the new subscription to the server
      return fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSubscription.toJSON()),
      });
    })
    .catch((error) => {
      console.error('[Service Worker] Push resubscription failed:', error);
    });

  event.waitUntil(subscriptionPromise);
});

// Listen for background sync events
self.addEventListener('sync', ((event: SyncEvent) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);

  if (event.tag === 'background-sync') {
    const syncPromise = handleBackgroundSync();
    event.waitUntil(syncPromise);
  }
}) as EventListener);

// Handle background sync operations
async function handleBackgroundSync(): Promise<void> {
  try {
    console.log('[Service Worker] Processing background sync queue');

    // Get queued requests from IndexedDB or localStorage
    const queuedRequests = await getQueuedRequests();

    if (!queuedRequests || queuedRequests.length === 0) {
      console.log('[Service Worker] No queued requests to sync');
      return;
    }

    // Process each queued request
    const results = await Promise.allSettled(
      queuedRequests.map(async (request) => {
        try {
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          });

          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }

          return { success: true, request };
        } catch (error) {
          return { success: false, request, error };
        }
      })
    );

    // Clear successfully synced requests
    const successfulRequests = results
      .filter((result) => result.status === 'fulfilled' && result.value.success)
      .map((result) => (result as PromiseFulfilledResult<any>).value.request);

    if (successfulRequests.length > 0) {
      await clearQueuedRequests(successfulRequests);
      console.log(`[Service Worker] Cleared ${successfulRequests.length} synced requests`);
    }

    // Notify client about sync results
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_COMPLETE',
        success: successfulRequests.length,
        failed: results.length - successfulRequests.length,
      });
    });
  } catch (error) {
    console.error('[Service Worker] Background sync error:', error);
    throw error;
  }
}

// Get queued requests from IndexedDB
async function getQueuedRequests(): Promise<any[]> {
  try {
    const db = await getDB();
    const queue = await db.get(STORE_NAME, 'queue');
    return queue || [];
  } catch (error) {
    console.error('[Service Worker] Failed to get queued requests from IndexedDB:', error);
    return [];
  }
}

// Clear successfully synced requests from IndexedDB
async function clearQueuedRequests(requests: any[]): Promise<void> {
  try {
    const db = await getDB();
    const queue = (await db.get(STORE_NAME, 'queue')) || [];

    const requestIds = new Set(requests.map((r) => r.id));
    const remainingQueue = queue.filter((r: any) => !requestIds.has(r.id));

    if (remainingQueue.length === 0) {
      await db.delete(STORE_NAME, 'queue');
    } else {
      await db.put(STORE_NAME, remainingQueue, 'queue');
    }
  } catch (error) {
    console.error('[Service Worker] Failed to clear queued requests from IndexedDB:', error);
    // Don't throw - silently handle to not interrupt sync process
  }
}

// Export empty object to make this a module
export {};
