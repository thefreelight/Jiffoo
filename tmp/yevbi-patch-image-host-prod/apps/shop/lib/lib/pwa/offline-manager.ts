/**
 * Offline Manager Utility
 * Handles offline detection, network status monitoring, and cache management for PWA
 */

import { openDB, IDBPDatabase } from 'idb';

// Types
export interface NetworkStatus {
  isOnline: boolean;
  effectiveType?: string; // 'slow-2g', '2g', '3g', '4g'
  downlink?: number; // Mbps
  rtt?: number; // Round-trip time in ms
}

export interface CacheInfo {
  name: string;
  size: number; // Approximate size in bytes
  keys: number; // Number of cached items
}

export interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

export interface CartSyncItem {
  id: string;
  operation: 'add' | 'update' | 'remove' | 'clear';
  productId?: string;
  quantity?: number;
  variantId?: string;
  itemId?: string;
  timestamp: number;
  retries: number;
}

// Constants
const OFFLINE_QUEUE_KEY = 'pwa_offline_queue';
const CART_SYNC_QUEUE_KEY = 'pwa_cart_sync_queue';
const MAX_RETRIES = 3;
const BACKGROUND_SYNC_TAG = 'cart-sync';
const CACHE_NAMES = {
  STATIC: 'static-cache',
  DYNAMIC: 'dynamic-cache',
  IMAGES: 'image-cache',
  API: 'api-cache',
};

// IndexedDB Configuration (matches service worker configuration)
const DB_NAME = 'pwa-sync-db';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

// Get IndexedDB database instance
async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

/**
 * Check if browser is currently online
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

/**
 * Get detailed network status information
 */
export function getNetworkStatus(): NetworkStatus {
  const status: NetworkStatus = {
    isOnline: isOnline(),
  };

  // Check for Network Information API support
  if (typeof window !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
      };
    }).connection;

    if (connection) {
      status.effectiveType = connection.effectiveType;
      status.downlink = connection.downlink;
      status.rtt = connection.rtt;
    }
  }

  return status;
}

/**
 * Offline Manager Class
 * Manages offline detection, network listeners, and cache operations
 */
export class OfflineManager {
  private listeners: Set<(isOnline: boolean) => void> = new Set();
  private networkListeners: Set<(status: NetworkStatus) => void> = new Set();
  private offlineQueue: OfflineQueueItem[] = [];
  private cartSyncQueue: CartSyncItem[] = [];

  constructor() {
    this.loadOfflineQueue();
    // Load cart sync queue asynchronously (fire and forget)
    this.loadCartSyncQueue().catch(error => {
      console.error('Failed to initialize cart sync queue:', error);
    });
    this.setupEventListeners();
  }

  /**
   * Setup browser event listeners for network changes
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen to connection changes if supported
    if ('connection' in navigator) {
      const connection = (navigator as Navigator & {
        connection?: {
          addEventListener?: (event: string, handler: () => void) => void;
        };
      }).connection;

      if (connection?.addEventListener) {
        connection.addEventListener('change', () => this.handleNetworkChange());
      }
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.notifyListeners(true);
    this.processOfflineQueue();
    this.processCartSyncQueue();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.notifyListeners(false);
  }

  /**
   * Handle network status change
   */
  private handleNetworkChange(): void {
    const status = getNetworkStatus();
    this.notifyNetworkListeners(status);
  }

  /**
   * Notify all listeners of online/offline status change
   */
  private notifyListeners(online: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(online);
      } catch (error) {
        console.error('Error in online/offline listener:', error);
      }
    });
  }

  /**
   * Notify all network status listeners
   */
  private notifyNetworkListeners(status: NetworkStatus): void {
    this.networkListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  /**
   * Subscribe to online/offline status changes
   */
  public onStatusChange(callback: (isOnline: boolean) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to detailed network status changes
   */
  public onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
    this.networkListeners.add(callback);
    // Call immediately with current status
    callback(getNetworkStatus());
    // Return unsubscribe function
    return () => {
      this.networkListeners.delete(callback);
    };
  }

  /**
   * Get current online status
   */
  public isOnline(): boolean {
    return isOnline();
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): NetworkStatus {
    return getNetworkStatus();
  }

  /**
   * Add request to offline queue
   */
  public queueRequest(
    url: string,
    method: string = 'GET',
    body?: string,
    headers?: Record<string, string>
  ): string {
    const item: OfflineQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      method,
      body,
      headers,
      timestamp: Date.now(),
      retries: 0,
    };

    this.offlineQueue.push(item);
    this.saveOfflineQueue();

    return item.id;
  }

  /**
   * Process offline queue when back online
   */
  private async processOfflineQueue(): Promise<void> {
    if (!isOnline() || this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      try {
        await this.retryRequest(item);
      } catch (error) {
        // Re-queue if retries remaining
        if (item.retries < MAX_RETRIES) {
          item.retries += 1;
          this.offlineQueue.push(item);
        } else {
          console.error(`Failed to process offline request after ${MAX_RETRIES} retries:`, item.url);
        }
      }
    }

    this.saveOfflineQueue();
  }

  /**
   * Retry a queued request
   */
  private async retryRequest(item: OfflineQueueItem): Promise<void> {
    const options: RequestInit = {
      method: item.method,
      headers: item.headers,
      body: item.body,
    };

    const response = await fetch(item.url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Get offline queue items
   */
  public getOfflineQueue(): OfflineQueueItem[] {
    return [...this.offlineQueue];
  }

  /**
   * Clear offline queue
   */
  public clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Save offline queue to localStorage
   */
  private saveOfflineQueue(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Load cart sync queue from IndexedDB
   */
  private async loadCartSyncQueue(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await getDB();
      const queue = await db.get(STORE_NAME, 'queue');
      this.cartSyncQueue = queue || [];
    } catch (error) {
      console.error('Failed to load cart sync queue from IndexedDB:', error);
      this.cartSyncQueue = [];
    }
  }

  /**
   * Save cart sync queue to IndexedDB
   */
  private async saveCartSyncQueue(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const db = await getDB();
      if (this.cartSyncQueue.length === 0) {
        await db.delete(STORE_NAME, 'queue');
      } else {
        await db.put(STORE_NAME, this.cartSyncQueue, 'queue');
      }
    } catch (error) {
      console.error('Failed to save cart sync queue to IndexedDB:', error);
    }
  }

  /**
   * Queue a cart operation for background sync
   */
  public queueForSync(
    operation: 'add' | 'update' | 'remove' | 'clear',
    data?: {
      productId?: string;
      quantity?: number;
      variantId?: string;
      itemId?: string;
    }
  ): string {
    const item: CartSyncItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      productId: data?.productId,
      quantity: data?.quantity,
      variantId: data?.variantId,
      itemId: data?.itemId,
      timestamp: Date.now(),
      retries: 0,
    };

    this.cartSyncQueue.push(item);
    // Save asynchronously (fire and forget)
    this.saveCartSyncQueue().catch(error => {
      console.error('Failed to save cart sync queue:', error);
    });

    // Register background sync if supported
    this.registerBackgroundSync();

    return item.id;
  }

  /**
   * Register background sync for cart operations
   * Uses Background Sync API if available, falls back to online event listener
   */
  public async registerBackgroundSync(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Check if Background Sync API is supported
    if ('serviceWorker' in navigator && 'sync' in (self as unknown as { registration?: { sync?: unknown } }).registration!) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const syncRegistration = registration as unknown as { sync: { register: (tag: string) => Promise<void> } };
        await syncRegistration.sync.register(BACKGROUND_SYNC_TAG);
      } catch (error) {
        console.error('Failed to register background sync:', error);
        // Fallback: will process queue on online event
      }
    } else {
      // Fallback: process queue when online
      if (this.isOnline()) {
        await this.processCartSyncQueue();
      }
    }
  }

  /**
   * Process cart sync queue
   * Called by service worker or when back online
   */
  public async processCartSyncQueue(): Promise<void> {
    if (this.cartSyncQueue.length === 0) return;

    const queue = [...this.cartSyncQueue];
    this.cartSyncQueue = [];

    for (const item of queue) {
      try {
        await this.processSyncItem(item);
      } catch (error) {
        // Re-queue if retries remaining
        if (item.retries < MAX_RETRIES) {
          item.retries += 1;
          this.cartSyncQueue.push(item);
        } else {
          console.error(`Failed to process cart sync after ${MAX_RETRIES} retries:`, item.operation);
        }
      }
    }

    await this.saveCartSyncQueue();
  }

  /**
   * Process a single cart sync item
   */
  private async processSyncItem(item: CartSyncItem): Promise<void> {
    // This will be called by the service worker or when online
    // The actual API calls should be made by the cart store
    // This just ensures the queue is managed properly

    // For now, we'll store the intent and let the cart store handle it
    // In a real implementation, you would import cartApi and make the actual calls
    switch (item.operation) {
      case 'add':
        if (!item.productId || !item.quantity) {
          throw new Error('Invalid add operation: missing productId or quantity');
        }
        // Queue for cart API call
        break;
      case 'update':
        if (!item.itemId || !item.quantity) {
          throw new Error('Invalid update operation: missing itemId or quantity');
        }
        // Queue for cart API call
        break;
      case 'remove':
        if (!item.itemId) {
          throw new Error('Invalid remove operation: missing itemId');
        }
        // Queue for cart API call
        break;
      case 'clear':
        // Queue for cart API call
        break;
      default:
        throw new Error(`Unknown cart operation: ${item.operation}`);
    }
  }

  /**
   * Get cart sync queue items
   */
  public getCartSyncQueue(): CartSyncItem[] {
    return [...this.cartSyncQueue];
  }

  /**
   * Clear cart sync queue
   */
  public async clearCartSyncQueue(): Promise<void> {
    this.cartSyncQueue = [];
    await this.saveCartSyncQueue();
  }

  /**
   * Get all cache names
   */
  public async getCacheNames(): Promise<string[]> {
    if (typeof window === 'undefined' || !('caches' in window)) return [];

    try {
      return await caches.keys();
    } catch (error) {
      console.error('Failed to get cache names:', error);
      return [];
    }
  }

  /**
   * Get cache information
   */
  public async getCacheInfo(cacheName: string): Promise<CacheInfo | null> {
    if (typeof window === 'undefined' || !('caches' in window)) return null;

    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      // Approximate size calculation
      let totalSize = 0;
      for (const request of keys) {
        try {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        } catch (error) {
          // Skip this item if there's an error
          continue;
        }
      }

      return {
        name: cacheName,
        size: totalSize,
        keys: keys.length,
      };
    } catch (error) {
      console.error(`Failed to get cache info for ${cacheName}:`, error);
      return null;
    }
  }

  /**
   * Get total cache size across all caches
   */
  public async getTotalCacheSize(): Promise<number> {
    const cacheNames = await this.getCacheNames();
    let totalSize = 0;

    for (const name of cacheNames) {
      const info = await this.getCacheInfo(name);
      if (info) {
        totalSize += info.size;
      }
    }

    return totalSize;
  }

  /**
   * Clear a specific cache
   */
  public async clearCache(cacheName: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('caches' in window)) return false;

    try {
      return await caches.delete(cacheName);
    } catch (error) {
      console.error(`Failed to clear cache ${cacheName}:`, error);
      return false;
    }
  }

  /**
   * Clear all caches
   */
  public async clearAllCaches(): Promise<void> {
    const cacheNames = await this.getCacheNames();

    await Promise.all(
      cacheNames.map(name => this.clearCache(name))
    );
  }

  /**
   * Check if a URL is cached
   */
  public async isCached(url: string, cacheName?: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('caches' in window)) return false;

    try {
      if (cacheName) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(url);
        return !!response;
      } else {
        const response = await caches.match(url);
        return !!response;
      }
    } catch (error) {
      console.error(`Failed to check if ${url} is cached:`, error);
      return false;
    }
  }

  /**
   * Pre-cache a URL
   */
  public async precache(url: string, cacheName: string = CACHE_NAMES.DYNAMIC): Promise<boolean> {
    if (typeof window === 'undefined' || !('caches' in window)) return false;

    try {
      const cache = await caches.open(cacheName);
      await cache.add(url);
      return true;
    } catch (error) {
      console.error(`Failed to precache ${url}:`, error);
      return false;
    }
  }

  /**
   * Pre-cache multiple URLs
   */
  public async precacheAll(urls: string[], cacheName: string = CACHE_NAMES.DYNAMIC): Promise<number> {
    let successCount = 0;

    for (const url of urls) {
      const success = await this.precache(url, cacheName);
      if (success) successCount++;
    }

    return successCount;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.listeners.clear();
    this.networkListeners.clear();

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline());
      window.removeEventListener('offline', () => this.handleOffline());
    }
  }
}

// Export singleton instance
let instance: OfflineManager | null = null;

/**
 * Get singleton instance of OfflineManager
 */
export function getOfflineManager(): OfflineManager {
  if (!instance) {
    instance = new OfflineManager();
  }
  return instance;
}

// Export cache names for convenience
export { CACHE_NAMES };

// Default export
export default OfflineManager;
