import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearJobsAdminCapabilityCache,
  isJobsAdminUnavailable,
  probeJobsAdminCapability,
  readCachedJobsAdminCapability,
  shouldShowJobSourcesNavigation,
} from '../../lib/jobs-admin-capability';

const STORAGE_KEY = 'jiffoo_admin_jobs_capability_v2';

interface Store {
  [key: string]: string;
}

function installLocalStorageStub(store: Store = {}) {
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  };
  return store;
}

describe('Jobs admin capability detection', () => {
  beforeEach(() => {
    installLocalStorageStub();
    clearJobsAdminCapabilityCache();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    vi.restoreAllMocks();
  });

  it('recognizes the JOBS_PLUGIN_UNAVAILABLE envelope as unconfigured', () => {
    expect(
      isJobsAdminUnavailable({ success: false, error: { code: 'JOBS_PLUGIN_UNAVAILABLE' } }),
    ).toBe(true);
  });

  it('treats other failures (auth, token, upstream) as configured', () => {
    expect(isJobsAdminUnavailable({ success: false, error: { code: 'JOBS_ADMIN_UNAVAILABLE' } })).toBe(false);
    expect(isJobsAdminUnavailable({ success: false, error: { code: 'UNAUTHORIZED' } })).toBe(false);
    expect(isJobsAdminUnavailable({ success: true })).toBe(false);
    expect(isJobsAdminUnavailable({ success: false, error: 'boom' })).toBe(false);
  });

  it('probe marks capability false and caches the unavailable result', async () => {
    const available = await probeJobsAdminCapability(async () => ({
      success: false,
      error: { code: 'JOBS_PLUGIN_UNAVAILABLE' },
    }));
    expect(available).toBe(false);
    expect(readCachedJobsAdminCapability()).toBe(false);
  });

  it('probe marks capability true for any other response shape', async () => {
    const available = await probeJobsAdminCapability(async () => ({ success: true }));
    expect(available).toBe(true);
    expect(readCachedJobsAdminCapability()).toBe(true);
  });

  it('probe assumes available when the request itself fails', async () => {
    const available = await probeJobsAdminCapability(async () => {
      throw new Error('network down');
    });
    expect(available).toBe(true);
    expect(readCachedJobsAdminCapability()).toBeNull();
  });

  it('drops cached entries older than the TTL', () => {
    const store = installLocalStorageStub();
    store[STORAGE_KEY] = JSON.stringify({ timestamp: Date.now() - 6 * 60 * 1000, available: false });
    expect(readCachedJobsAdminCapability()).toBeNull();
    store[STORAGE_KEY] = JSON.stringify({ timestamp: Date.now(), available: false });
    expect(readCachedJobsAdminCapability()).toBe(false);
  });

  it('sidebar visibility requires both capability and plugins access', () => {
    expect(shouldShowJobSourcesNavigation(true, true)).toBe(true);
    expect(shouldShowJobSourcesNavigation(false, true)).toBe(false);
    expect(shouldShowJobSourcesNavigation(true, false)).toBe(false);
  });
});
