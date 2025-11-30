/**
 * Mall Context Cache
 * Simple in-memory LRU cache for mall context to reduce database queries
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttlSeconds = 60) {
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all cache entries matching a pattern
   * Useful for invalidating related cache entries
   */
  deletePattern(pattern: RegExp): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Create singleton cache instance
// TTL: 60 seconds (balance between freshness and performance)
export const mallContextCache = new LRUCache<any>(100, 60);

/**
 * Clear mall context cache for a specific tenant
 * Should be called whenever tenant theme or settings are updated
 * 
 * @param tenantId - Tenant ID to clear cache for
 */
export function clearMallContextCacheForTenant(tenantId: number): void {
  // Clear both tenant ID and domain-based cache entries
  mallContextCache.delete(`tenant:${tenantId}`);
  
  // Also clear any domain-based entries for this tenant
  // This is a best-effort approach since we don't track domain->tenant mapping in cache
  // The cache will naturally expire after TTL anyway
  mallContextCache.deletePattern(new RegExp(`^domain:`));
}
