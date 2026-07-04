/**
 * i18n plugin - Real Redis integration tests
 *
 * Requires Redis running at localhost:6399.
 * Tests key patterns, TTL, delete operations, and SCAN-based pattern matching.
 */

import { loadEnvFile } from '../../../../../tests/shared/load-env';
import path from 'path';
loadEnvFile(path.resolve(__dirname, '../../../../../.env.test'));

import Redis from 'ioredis';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6399';

let redis: Redis;

async function cleanI18nKeys() {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'i18n:*', 'COUNT', 200);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

describe('i18n Redis Integration', () => {
  beforeAll(async () => {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();
    await cleanI18nKeys();
  });

  afterAll(async () => {
    await cleanI18nKeys();
    await redis.quit();
  });

  beforeEach(async () => {
    await cleanI18nKeys();
  });

  // ==========================================================================
  // Content translation key pattern
  // ==========================================================================

  describe('Content translation keys: i18n:c:{entityType}:{entityId}:{locale}', () => {
    it('should set and get a content translation', async () => {
      const key = 'i18n:c:product:prod_1:fr';
      const value = JSON.stringify({ name: 'Produit 1', description: 'Description FR' });

      await redis.set(key, value, 'EX', 86400);

      const result = await redis.get(key);
      expect(result).not.toBeNull();

      const parsed = JSON.parse(result!);
      expect(parsed.name).toBe('Produit 1');
      expect(parsed.description).toBe('Description FR');
    });

    it('should set TTL correctly (86400 seconds)', async () => {
      const key = 'i18n:c:product:prod_ttl:de';
      await redis.set(key, JSON.stringify({ name: 'Produkt' }), 'EX', 86400);

      const ttl = await redis.ttl(key);
      // TTL should be close to 86400 (allowing for a few seconds of execution time)
      expect(ttl).toBeGreaterThan(86390);
      expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('should delete a content translation key', async () => {
      const key = 'i18n:c:category:cat_1:ja';
      await redis.set(key, JSON.stringify({ name: 'Cat JA' }), 'EX', 86400);

      const deleted = await redis.del(key);
      expect(deleted).toBe(1);

      const result = await redis.get(key);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // UI translation key pattern
  // ==========================================================================

  describe('UI translation keys: i18n:ui:{locale}:{namespace}', () => {
    it('should set and get UI translations', async () => {
      const key = 'i18n:ui:fr:common';
      const value = JSON.stringify({
        'nav.home': 'Accueil',
        'nav.cart': 'Panier',
        'nav.search': 'Rechercher',
      });

      await redis.set(key, value, 'EX', 86400);

      const result = await redis.get(key);
      expect(result).not.toBeNull();

      const parsed = JSON.parse(result!);
      expect(parsed['nav.home']).toBe('Accueil');
      expect(parsed['nav.cart']).toBe('Panier');
    });

    it('should set TTL correctly for UI translations', async () => {
      const key = 'i18n:ui:de:shop';
      await redis.set(key, JSON.stringify({ 'cart.title': 'Warenkorb' }), 'EX', 86400);

      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(86390);
      expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('should overwrite existing UI translations', async () => {
      const key = 'i18n:ui:ja:merchant';
      await redis.set(key, JSON.stringify({ 'title': 'Old' }), 'EX', 86400);
      await redis.set(key, JSON.stringify({ 'title': 'New' }), 'EX', 86400);

      const result = JSON.parse((await redis.get(key))!);
      expect(result.title).toBe('New');
    });
  });

  // ==========================================================================
  // Locales key
  // ==========================================================================

  describe('Locales key: i18n:locales', () => {
    it('should set and get the locales list', async () => {
      const locales = ['en', 'fr', 'de', 'ja', 'zh-Hant'];
      await redis.set('i18n:locales', JSON.stringify(locales), 'EX', 86400);

      const result = await redis.get('i18n:locales');
      expect(result).not.toBeNull();

      const parsed = JSON.parse(result!);
      expect(parsed).toEqual(locales);
      expect(parsed).toHaveLength(5);
    });

    it('should set TTL on locales key', async () => {
      await redis.set('i18n:locales', JSON.stringify(['en']), 'EX', 86400);

      const ttl = await redis.ttl('i18n:locales');
      expect(ttl).toBeGreaterThan(86390);
    });
  });

  // ==========================================================================
  // SCAN-based pattern matching
  // ==========================================================================

  describe('SCAN-based pattern matching', () => {
    it('should find all content keys for a specific entity via SCAN', async () => {
      // Set multiple translations for the same product
      await redis.set('i18n:c:product:prod_scan:fr', JSON.stringify({ name: 'FR' }), 'EX', 86400);
      await redis.set('i18n:c:product:prod_scan:de', JSON.stringify({ name: 'DE' }), 'EX', 86400);
      await redis.set('i18n:c:product:prod_scan:ja', JSON.stringify({ name: 'JA' }), 'EX', 86400);
      // Unrelated key
      await redis.set('i18n:c:product:prod_other:fr', JSON.stringify({ name: 'Other' }), 'EX', 86400);

      // SCAN for prod_scan keys
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(
          cursor,
          'MATCH',
          'i18n:c:product:prod_scan:*',
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      expect(keys).toHaveLength(3);
      expect(keys.sort()).toEqual([
        'i18n:c:product:prod_scan:de',
        'i18n:c:product:prod_scan:fr',
        'i18n:c:product:prod_scan:ja',
      ]);
    });

    it('should delete all keys found via pattern SCAN', async () => {
      await redis.set('i18n:c:category:cat_scan:fr', 'data1', 'EX', 86400);
      await redis.set('i18n:c:category:cat_scan:de', 'data2', 'EX', 86400);

      // Find and delete
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(
          cursor,
          'MATCH',
          'i18n:c:category:cat_scan:*',
          'COUNT',
          100
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await redis.del(...keys);
      }

      // Verify all keys are deleted
      const fr = await redis.get('i18n:c:category:cat_scan:fr');
      const de = await redis.get('i18n:c:category:cat_scan:de');
      expect(fr).toBeNull();
      expect(de).toBeNull();
    });
  });

  // ==========================================================================
  // Delete operations
  // ==========================================================================

  describe('Delete operations', () => {
    it('should return 0 when deleting a non-existent key', async () => {
      const deleted = await redis.del('i18n:c:nonexistent:id:locale');
      expect(deleted).toBe(0);
    });

    it('should delete multiple keys at once', async () => {
      await redis.set('i18n:ui:fr:common', 'data1', 'EX', 86400);
      await redis.set('i18n:ui:fr:shop', 'data2', 'EX', 86400);
      await redis.set('i18n:ui:fr:merchant', 'data3', 'EX', 86400);

      const deleted = await redis.del(
        'i18n:ui:fr:common',
        'i18n:ui:fr:shop',
        'i18n:ui:fr:merchant'
      );
      expect(deleted).toBe(3);
    });
  });
});
