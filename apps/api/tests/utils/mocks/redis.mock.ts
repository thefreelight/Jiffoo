/**
 * Redis Mock Service
 * 
 * Mock implementation of Redis/ioredis for testing.
 */

import { vi } from 'vitest';

// ============================================
// Types
// ============================================

export interface MockRedisOptions {
  initialData?: Record<string, string>;
}

// ============================================
// In-Memory Store
// ============================================

class MockRedisStore {
  private store: Map<string, string> = new Map();
  private expiries: Map<string, number> = new Map();
  
  constructor(initialData?: Record<string, string>) {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        this.store.set(key, value);
      });
    }
  }
  
  get(key: string): string | null {
    const expiry = this.expiries.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.expiries.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }
  
  set(key: string, value: string, _mode?: string, _duration?: number): string {
    this.store.set(key, value);
    return 'OK';
  }
  
  setex(key: string, seconds: number, value: string): string {
    this.store.set(key, value);
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }
  
  del(key: string | string[]): number {
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    keys.forEach(k => {
      if (this.store.delete(k)) count++;
      this.expiries.delete(k);
    });
    return count;
  }
  
  expire(key: string, seconds: number): number {
    if (!this.store.has(key)) return 0;
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 1;
  }
  
  ttl(key: string): number {
    const expiry = this.expiries.get(key);
    if (!expiry) return -1;
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
  
  exists(key: string): number {
    return this.store.has(key) ? 1 : 0;
  }
  
  keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }
  
  clear(): void {
    this.store.clear();
    this.expiries.clear();
  }
  
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    this.store.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

// ============================================
// Mock Redis Client
// ============================================

let mockStore: MockRedisStore;

export function createMockRedis(options: MockRedisOptions = {}) {
  mockStore = new MockRedisStore(options.initialData);
  
  return {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(mockStore.get(key))),
    set: vi.fn().mockImplementation((key: string, value: string) => 
      Promise.resolve(mockStore.set(key, value))
    ),
    setex: vi.fn().mockImplementation((key: string, seconds: number, value: string) => 
      Promise.resolve(mockStore.setex(key, seconds, value))
    ),
    del: vi.fn().mockImplementation((key: string | string[]) => 
      Promise.resolve(mockStore.del(key))
    ),
    expire: vi.fn().mockImplementation((key: string, seconds: number) => 
      Promise.resolve(mockStore.expire(key, seconds))
    ),
    ttl: vi.fn().mockImplementation((key: string) => Promise.resolve(mockStore.ttl(key))),
    exists: vi.fn().mockImplementation((key: string) => Promise.resolve(mockStore.exists(key))),
    keys: vi.fn().mockImplementation((pattern: string) => Promise.resolve(mockStore.keys(pattern))),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Get the mock store for direct manipulation in tests
 */
export function getMockStore(): MockRedisStore {
  return mockStore;
}

/**
 * Reset the mock Redis
 */
export function resetRedisMock() {
  if (mockStore) {
    mockStore.clear();
  }
  vi.clearAllMocks();
}

// Default mock instance
export const mockRedis = createMockRedis();

export default mockRedis;

