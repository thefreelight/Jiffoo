/**
 * i18n plugin - LIVE end-to-end integration tests.
 *
 * Tests plugin HTTP routes against REAL PostgreSQL + REAL Redis.
 * Full journey: languages -> content translations -> UI translations -> import/export.
 *
 * Requirements:
 *   - I18N_DATABASE_URL (postgresql://...)
 *   - REDIS_URL         (redis://localhost:6399)
 *
 * Tests are automatically skipped when infrastructure is unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadLiveTestEnv } from '../../../../../tests/shared/live-test-env';

loadLiveTestEnv(__dirname);

const DB_URL = process.env.I18N_DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

async function canReachDb(): Promise<boolean> {
  if (!DB_URL) return false;
  try {
    const { PrismaClient } = require('../../node_modules/.prisma/i18n-client');
    const probe = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await probe.$connect();
    await probe.$disconnect();
    return true;
  } catch {
    return false;
  }
}

const DB_REACHABLE = !!DB_URL ? await canReachDb() : false;
const describeIf = (DB_REACHABLE && !!REDIS_URL) ? describe : describe.skip;

describeIf('[LIVE] i18n Plugin End-to-End', () => {
  let app: any;
  let prisma: any;

  beforeAll(async () => {
    const { PrismaClient } = require('../../node_modules/.prisma/i18n-client');
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await prisma.$connect();

    // Clean slate
    await prisma.translationJob.deleteMany();
    await prisma.uITranslation.deleteMany();
    await prisma.contentTranslation.deleteMany();
    await prisma.managedLanguage.deleteMany();

    const mod = await import('../../src/index');
    app = mod.createApp();
  });

  afterAll(async () => {
    await prisma.translationJob.deleteMany();
    await prisma.uITranslation.deleteMany();
    await prisma.contentTranslation.deleteMany();
    await prisma.managedLanguage.deleteMany();
    await prisma.$disconnect();
  });

  // -- Helpers ---------------------------------------------------------------

  function headers(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-platform-id': 'live-platform',
      'x-plugin-slug': 'i18n',
      'x-installation-id': 'live-e2e',
      'x-caller': 'admin',
      'x-locale': 'en',
      ...overrides,
    };
  }

  async function inject(method: string, url: string, opts: { body?: any; headers?: Record<string, string> } = {}) {
    const lmr = (await import('light-my-request')).default;
    const res = await lmr(app as any, {
      method: method as any,
      url,
      headers: headers(opts.headers || {}) as any,
      payload: opts.body ? JSON.stringify(opts.body) : undefined,
    } as any);
    let body: any;
    try { body = JSON.parse(res.payload); } catch { body = res.payload; }
    return { status: res.statusCode, body, rawHeaders: res.headers };
  }

  // ==========================================================================
  // Phase 1: Health & Config
  // ==========================================================================

  describe('Phase 1: Health', () => {
    it('GET /health returns healthy', async () => {
      const res = await inject('GET', '/health');
      expect(res.status).toBe(200);
      expect(res.body.plugin).toBe('i18n');
    });

    it('GET /manifest returns valid metadata', async () => {
      const res = await inject('GET', '/manifest');
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('i18n');
    });
  });

  // ==========================================================================
  // Phase 2: Language Management
  // ==========================================================================

  describe('Phase 2: Language Management', () => {
    it('POST /languages creates English language', async () => {
      const res = await inject('POST', '/languages', {
        body: {
          locale: 'en',
          name: 'English',
          nativeName: 'English',
          isDefault: true,
          isEnabled: true,
          direction: 'ltr',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /languages creates Chinese language', async () => {
      const res = await inject('POST', '/languages', {
        body: {
          locale: 'zh-CN',
          name: 'Chinese Simplified',
          nativeName: 'Simplified Chinese',
          isDefault: false,
          isEnabled: true,
          direction: 'ltr',
          fallbackTo: 'en',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /languages lists all languages', async () => {
      const res = await inject('GET', '/languages');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const locales = res.body.data.map((l: any) => l.locale);
      expect(locales).toContain('en');
      expect(locales).toContain('zh-CN');
    });

    it('languages are persisted in DB', async () => {
      const langs = await prisma.managedLanguage.findMany();
      expect(langs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Phase 3: Content Translation (product/category translations)
  // ==========================================================================

  describe('Phase 3: Content Translation', () => {
    it('PUT /content/product/prod-001/en sets English translation', async () => {
      const res = await inject('PUT', '/content/product/prod-001/en', {
        body: {
          fields: {
            name: 'Wireless Headphones',
            description: 'Premium wireless headphones with noise cancellation',
          },
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PUT /content/product/prod-001/zh-CN sets Chinese translation', async () => {
      const res = await inject('PUT', '/content/product/prod-001/zh-CN', {
        body: {
          fields: {
            name: 'Wireless Headphones CN',
            description: 'Premium wireless headphones CN',
          },
        },
      });

      expect(res.status).toBe(200);
    });

    it('GET /content/product/prod-001/en returns English fields', async () => {
      const res = await inject('GET', '/content/product/prod-001/en');
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Wireless Headphones');
      expect(res.body.data.description).toContain('noise cancellation');
    });

    it('GET /content/product/prod-001/zh-CN returns Chinese fields', async () => {
      const res = await inject('GET', '/content/product/prod-001/zh-CN');
      expect(res.status).toBe(200);
      expect(res.body.data.name).toContain('CN');
    });

    it('content translations are persisted in DB', async () => {
      const translations = await prisma.contentTranslation.findMany({
        where: { entityType: 'product', entityId: 'prod-001' },
      });
      // 2 fields x 2 locales = 4 records
      expect(translations.length).toBe(4);
    });

    it('GET /content/product/list/en lists translated entities', async () => {
      const res = await inject('GET', '/content/product/list/en');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /content/product/prod-001?locale=zh-CN removes Chinese only', async () => {
      const res = await inject('DELETE', '/content/product/prod-001?locale=zh-CN');
      expect(res.status).toBe(200);

      // English should still exist
      const enRes = await inject('GET', '/content/product/prod-001/en');
      expect(enRes.status).toBe(200);
      expect(enRes.body.data.name).toBe('Wireless Headphones');

      // Chinese should be gone
      const zhRes = await inject('GET', '/content/product/prod-001/zh-CN');
      expect(zhRes.status).toBe(200);
      expect(Object.keys(zhRes.body.data || {}).length).toBe(0);
    });
  });

  // ==========================================================================
  // Phase 4: UI Translation (theme/app strings)
  // ==========================================================================

  describe('Phase 4: UI Translation', () => {
    it('PUT /ui/en/common sets English UI strings', async () => {
      const res = await inject('PUT', '/ui/en/common', {
        body: {
          'btn.add_to_cart': 'Add to Cart',
          'btn.checkout': 'Checkout',
          'label.price': 'Price',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PUT /ui/zh-CN/common sets Chinese UI strings', async () => {
      const res = await inject('PUT', '/ui/zh-CN/common', {
        body: {
          'btn.add_to_cart': 'Add to Cart CN',
          'btn.checkout': 'Checkout CN',
          'label.price': 'Price CN',
        },
      });

      expect(res.status).toBe(200);
    });

    it('GET /ui/en/common returns English strings', async () => {
      const res = await inject('GET', '/ui/en/common');
      expect(res.status).toBe(200);
      expect(res.body.data['btn.add_to_cart']).toBe('Add to Cart');
      expect(res.body.data['btn.checkout']).toBe('Checkout');
    });

    it('GET /messages/en returns all UI translations merged', async () => {
      const res = await inject('GET', '/messages/en');
      expect(res.status).toBe(200);
      // Should contain common namespace keys
      expect(res.body.data.common).toBeDefined();
      expect(res.body.data.common['btn.add_to_cart']).toBe('Add to Cart');
    });

    it('UI translations are persisted in DB', async () => {
      const uiEntries = await prisma.uITranslation.findMany({
        where: { locale: 'en', namespace: 'common' },
      });
      expect(uiEntries.length).toBe(3);
    });
  });

  // ==========================================================================
  // Phase 5: Import/Export
  // ==========================================================================

  describe('Phase 5: Import/Export', () => {
    it('GET /export/content/json exports content translations', async () => {
      const res = await inject('GET', '/export/content/json?entityType=product&locale=en');
      expect(res.status).toBe(200);
      // Export returns raw JSON data, not wrapped in {success, data}
      expect(res.body).toBeDefined();
    });

    it('GET /export/ui/json exports UI translations', async () => {
      const res = await inject('GET', '/export/ui/json?locale=en&namespace=common');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ==========================================================================
  // Phase 6: Translation Stats
  // ==========================================================================

  describe('Phase 6: Stats', () => {
    it('GET /stats/product/en returns completeness stats', async () => {
      const res = await inject('GET', '/stats/product/en');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  // ==========================================================================
  // Phase 7: Admin UI
  // ==========================================================================

  describe('Phase 7: Admin UI', () => {
    it('GET /admin returns HTML', async () => {
      const lmr = (await import('light-my-request')).default;
      const res = await lmr(app as any, {
        method: 'GET',
        url: '/admin',
        headers: headers() as any,
      } as any);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });
  });

  // ==========================================================================
  // Phase 8: Language Deletion
  // ==========================================================================

  describe('Phase 8: Language Lifecycle', () => {
    it('DELETE /languages/zh-CN removes Chinese language', async () => {
      const res = await inject('DELETE', '/languages/zh-CN');
      expect(res.status).toBe(200);
    });

    it('cannot delete default language', async () => {
      const res = await inject('DELETE', '/languages/en');
      // Should reject - en is the default
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
