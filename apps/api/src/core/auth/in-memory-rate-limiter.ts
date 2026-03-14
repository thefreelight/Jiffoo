/**
 * In-Memory Rate Limiter
 *
 * Provides a fallback rate limiting mechanism when Redis is unavailable.
 * Uses LRU (Least Recently Used) eviction to prevent memory leaks.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
  lastAccessed: number;
}

export class InMemoryRateLimiter {
  private static instance: InMemoryRateLimiter;
  private records: Map<string, RateLimitRecord>;
  private readonly maxEntries: number = 10000;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private readonly cleanupIntervalMs: number = 60000; // 1 minute

  private constructor() {
    this.records = new Map();
    this.startCleanup();
  }

  public static getInstance(): InMemoryRateLimiter {
    if (!InMemoryRateLimiter.instance) {
      InMemoryRateLimiter.instance = new InMemoryRateLimiter();
    }
    return InMemoryRateLimiter.instance;
  }

  /**
   * Increment the counter for a given key
   * @param key The rate limit key (e.g., "rate_limit:127.0.0.1")
   * @param windowMs The time window in milliseconds
   * @returns The current count after incrementing, or null if eviction occurred
   */
  public increment(key: string, windowMs: number): number {
    const now = Date.now();
    const record = this.records.get(key);

    // If record exists and hasn't expired, increment it
    if (record && record.resetTime > now) {
      record.count++;
      record.lastAccessed = now;
      return record.count;
    }

    // Create new record or reset expired one
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + windowMs,
      lastAccessed: now,
    };

    // Check if we need to evict entries
    if (this.records.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.records.set(key, newRecord);
    return 1;
  }

  /**
   * Get the current count for a key
   * @param key The rate limit key
   * @returns The current count or 0 if not found/expired
   */
  public getCount(key: string): number {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record || record.resetTime <= now) {
      return 0;
    }

    record.lastAccessed = now;
    return record.count;
  }

  /**
   * Reset the counter for a given key
   * @param key The rate limit key
   */
  public reset(key: string): void {
    this.records.delete(key);
  }

  /**
   * Clean up expired entries
   */
  public cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, record] of this.records.entries()) {
      if (record.resetTime <= now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.records.delete(key);
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime: number = Infinity;

    for (const [key, record] of this.records.entries()) {
      if (record.lastAccessed < oldestTime) {
        oldestTime = record.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.records.delete(oldestKey);
    }
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupIntervalId) {
      return;
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Prevent the interval from keeping the process alive
    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Stop automatic cleanup (useful for testing)
   */
  public stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Get the current number of entries (useful for testing)
   */
  public getSize(): number {
    return this.records.size;
  }

  /**
   * Clear all entries (useful for testing)
   */
  public clear(): void {
    this.records.clear();
  }
}

// Export singleton instance
export const inMemoryRateLimiter = InMemoryRateLimiter.getInstance();
