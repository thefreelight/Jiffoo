import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { redisMock } = vi.hoisted(() => {
  const redisMock = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
    ping: vi.fn().mockResolvedValue('PONG'),
  };
  return { redisMock };
});

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => redisMock),
}));

import {
  getRedis,
  syncContentToRedis,
  removeContentFromRedis,
  syncUIToRedis,
  getUIFromRedis,
  syncLocalesToRedis,
  connectRedis,
} from '../../src/lib/redis';

describe('Redis helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // getRedis
  // ==========================================================================

  describe('getRedis', () => {
    it('returns a Redis instance', () => {
      const r = getRedis();
      expect(r).toBeDefined();
      expect(r).toBe(redisMock);
    });

    it('returns the same instance on repeated calls', () => {
      const a = getRedis();
      const b = getRedis();
      expect(a).toBe(b);
    });
  });

  // ==========================================================================
  // connectRedis
  // ==========================================================================

  describe('connectRedis', () => {
    it('pings Redis to verify connection', async () => {
      redisMock.ping.mockResolvedValue('PONG');
      await connectRedis();
      expect(redisMock.ping).toHaveBeenCalledTimes(1);
    });

    it('does not throw when Redis is unavailable', async () => {
      redisMock.ping.mockRejectedValue(new Error('Connection refused'));
      await expect(connectRedis()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // syncContentToRedis
  // ==========================================================================

  describe('syncContentToRedis', () => {
    it('sets a key with correct pattern and TTL', async () => {
      await syncContentToRedis('product', 'prod-1', 'zh-Hant', { name: 'Test' });

      expect(redisMock.set).toHaveBeenCalledWith(
        'i18n:c:product:prod-1:zh-Hant',
        JSON.stringify({ name: 'Test' }),
        'EX',
        86400
      );
    });

    it('deletes key when fields object is empty', async () => {
      await syncContentToRedis('product', 'prod-1', 'zh-Hant', {});

      expect(redisMock.del).toHaveBeenCalledWith('i18n:c:product:prod-1:zh-Hant');
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('does not throw when Redis fails (non-fatal)', async () => {
      redisMock.set.mockRejectedValue(new Error('Redis down'));
      await expect(
        syncContentToRedis('product', 'prod-1', 'en', { name: 'Hello' })
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // removeContentFromRedis
  // ==========================================================================

  describe('removeContentFromRedis', () => {
    it('deletes a specific locale key when locale is provided', async () => {
      await removeContentFromRedis('product', 'prod-1', 'zh-Hant');

      expect(redisMock.del).toHaveBeenCalledWith('i18n:c:product:prod-1:zh-Hant');
    });

    it('scans and deletes all locale keys when locale is omitted', async () => {
      redisMock.scan.mockResolvedValue([
        '0',
        ['i18n:c:product:prod-1:en', 'i18n:c:product:prod-1:zh-Hant'],
      ]);

      await removeContentFromRedis('product', 'prod-1');

      expect(redisMock.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'i18n:c:product:prod-1:*',
        'COUNT',
        200
      );
      expect(redisMock.del).toHaveBeenCalledWith(
        'i18n:c:product:prod-1:en',
        'i18n:c:product:prod-1:zh-Hant'
      );
    });

    it('does nothing when scan returns no keys', async () => {
      redisMock.scan.mockResolvedValue(['0', []]);

      await removeContentFromRedis('product', 'prod-1');

      expect(redisMock.del).not.toHaveBeenCalled();
    });

    it('does not throw on Redis error (non-fatal)', async () => {
      redisMock.del.mockRejectedValue(new Error('Redis down'));
      await expect(
        removeContentFromRedis('product', 'prod-1', 'en')
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // syncUIToRedis
  // ==========================================================================

  describe('syncUIToRedis', () => {
    it('sets a UI key with correct pattern and TTL', async () => {
      await syncUIToRedis('zh-Hant', 'common', { 'btn.save': 'Save' });

      expect(redisMock.set).toHaveBeenCalledWith(
        'i18n:ui:zh-Hant:common',
        JSON.stringify({ 'btn.save': 'Save' }),
        'EX',
        86400
      );
    });

    it('deletes key when messages object is empty', async () => {
      await syncUIToRedis('en', 'shop', {});

      expect(redisMock.del).toHaveBeenCalledWith('i18n:ui:en:shop');
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('does not throw on Redis error (non-fatal)', async () => {
      redisMock.set.mockRejectedValue(new Error('Redis down'));
      await expect(
        syncUIToRedis('en', 'common', { key: 'val' })
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // getUIFromRedis
  // ==========================================================================

  describe('getUIFromRedis', () => {
    it('returns parsed JSON when key exists', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ 'btn.save': 'Save' }));

      const result = await getUIFromRedis('en', 'common');

      expect(result).toEqual({ 'btn.save': 'Save' });
      expect(redisMock.get).toHaveBeenCalledWith('i18n:ui:en:common');
    });

    it('returns null when key does not exist', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await getUIFromRedis('en', 'common');

      expect(result).toBeNull();
    });

    it('returns null when stored value is not valid JSON', async () => {
      redisMock.get.mockResolvedValue('not-json');

      const result = await getUIFromRedis('en', 'common');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // syncLocalesToRedis
  // ==========================================================================

  describe('syncLocalesToRedis', () => {
    it('stores locale list as JSON array with TTL', async () => {
      await syncLocalesToRedis(['en', 'zh-Hant', 'fr']);

      expect(redisMock.set).toHaveBeenCalledWith(
        'i18n:locales',
        JSON.stringify(['en', 'zh-Hant', 'fr']),
        'EX',
        86400
      );
    });

    it('does not throw on Redis error (non-fatal)', async () => {
      redisMock.set.mockRejectedValue(new Error('Redis down'));
      await expect(
        syncLocalesToRedis(['en'])
      ).resolves.toBeUndefined();
    });
  });
});
