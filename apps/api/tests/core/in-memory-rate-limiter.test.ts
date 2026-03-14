/**
 * In-Memory Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { InMemoryRateLimiter } from '@/core/auth/in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = InMemoryRateLimiter.getInstance();
    limiter.clear();
  });

  afterAll(() => {
    limiter.stopCleanup();
  });

  describe('increment', () => {
    it('should start at 1 for a new key', () => {
      const count = limiter.increment('test-key', 60000);
      expect(count).toBe(1);
    });

    it('should increment count for existing key within window', () => {
      limiter.increment('test-key', 60000);
      const count = limiter.increment('test-key', 60000);
      expect(count).toBe(2);
    });

    it('should reset count after window expires', async () => {
      limiter.increment('test-key', 100); // 100ms window
      await new Promise(resolve => setTimeout(resolve, 150));
      const count = limiter.increment('test-key', 60000);
      expect(count).toBe(1);
    });

    it('should handle multiple keys independently', () => {
      const count1 = limiter.increment('key1', 60000);
      const count2 = limiter.increment('key2', 60000);
      const count3 = limiter.increment('key1', 60000);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(2);
    });
  });

  describe('getCount', () => {
    it('should return 0 for non-existent key', () => {
      const count = limiter.getCount('non-existent');
      expect(count).toBe(0);
    });

    it('should return current count for existing key', () => {
      limiter.increment('test-key', 60000);
      limiter.increment('test-key', 60000);
      const count = limiter.getCount('test-key');
      expect(count).toBe(2);
    });

    it('should return 0 for expired key', async () => {
      limiter.increment('test-key', 100);
      await new Promise(resolve => setTimeout(resolve, 150));
      const count = limiter.getCount('test-key');
      expect(count).toBe(0);
    });
  });

  describe('reset', () => {
    it('should remove the key', () => {
      limiter.increment('test-key', 60000);
      limiter.reset('test-key');
      const count = limiter.getCount('test-key');
      expect(count).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      limiter.increment('key1', 100);
      limiter.increment('key2', 60000);

      await new Promise(resolve => setTimeout(resolve, 150));
      limiter.cleanup();

      expect(limiter.getCount('key1')).toBe(0);
      expect(limiter.getCount('key2')).toBe(1);
      expect(limiter.getSize()).toBe(1);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when max entries reached', () => {
      // Get instance with access to maxEntries (10000)
      const maxEntries = 10000;

      // Fill up to max
      for (let i = 0; i < maxEntries; i++) {
        limiter.increment(`key${i}`, 60000);
      }

      expect(limiter.getSize()).toBe(maxEntries);

      // Access key0 to make it recently used
      limiter.getCount('key0');

      // Add one more - should evict key1 (least recently used)
      limiter.increment('new-key', 60000);

      expect(limiter.getSize()).toBe(maxEntries);
      expect(limiter.getCount('key0')).toBe(1); // Still exists
      expect(limiter.getCount('key1')).toBe(0); // Evicted
      expect(limiter.getCount('new-key')).toBe(1); // New key exists
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = InMemoryRateLimiter.getInstance();
      const instance2 = InMemoryRateLimiter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('concurrent access', () => {
    it('should handle multiple increments correctly', () => {
      const key = 'concurrent-key';
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        limiter.increment(key, 60000);
      }

      expect(limiter.getCount(key)).toBe(iterations);
    });
  });
});
