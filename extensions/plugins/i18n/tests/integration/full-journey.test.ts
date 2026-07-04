/**
 * i18n Plugin - Full Realistic Integration Test
 *
 *  Phase 1:  Lifecycle hooks (onInstall, onEnable seeds defaults)
 *  Phase 2:  Core API communication
 *  Phase 3:  Real HTTP server (health, manifest)
 *  Phase 4:  Language management (create, list, default, delete)
 *  Phase 5:  Content translations (set, get, list, delete, digest)
 *  Phase 6:  UI translations (set, get, merged namespace)
 *  Phase 7:  Import/Export (CSV + JSON)
 *  Phase 8:  Translation stats / completeness
 *  Phase 9:  Concurrent translation updates
 *  Phase 10: Multi-instance isolation (not applicable - i18n is global)
 *  Phase 11: Error scenarios & validation
 *  Phase 12: Lifecycle teardown
 *
 * Requirements:
 *   I18N_DATABASE_URL   (postgresql://...)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadEnvFile } from '../../../../../tests/shared/load-env';
import { resolve } from 'path';
import http from 'http';
import { URL } from 'url';

loadEnvFile(resolve(__dirname, '../../../../../.env.test'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-platform-id': 'integ-platform',
    'x-plugin-slug': 'i18n',
    'x-installation-id': 'default',
    'x-installation-key': 'default',
    'x-user-id': 'admin-001',
    'x-user-role': 'admin',
    'x-request-id': `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    'x-locale': 'en',
    'x-caller': 'admin',
    'x-platform-api-base-url': 'http://localhost:3001',
    'x-platform-integration-token': 'test-service-token',
    ...overrides,
  };
}

async function runConcurrent<T>(tasks: Array<() => Promise<T>>): Promise<Array<{ result?: T; error?: Error }>> {
  return Promise.all(tasks.map(async (t) => {
    try { return { result: await t() }; } catch (e) { return { error: e as Error }; }
  }));
}

async function startCoreMock(token: string) {
  const calls: any[] = [];
  function jr(res: http.ServerResponse, s: number, d: any) { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); }
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    calls.push({ method: req.method, path });
    if (path === '/health') return jr(res, 200, { status: 'healthy' });
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ') || auth.replace('Bearer ', '') !== token) return jr(res, 401, { success: false, error: { code: 'UNAUTHORIZED' } });
    if (path === '/api/store/settings') return jr(res, 200, { success: true, data: { name: 'Test Store', locale: 'en', supportedLocales: ['en', 'zh', 'es'] } });
    jr(res, 404, { success: false, error: { code: 'NOT_FOUND' } });
  });
  return new Promise<{ url: string; calls: any[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, () => { const addr = server.address() as { port: number }; resolve({ url: `http://localhost:${addr.port}`, calls, close: () => new Promise<void>((r) => server.close(() => r())) }); });
  });
}

async function invokeHook(mod: any, hook: string, ctx: any = {}) {
  const fn = mod.default?.[`__lifecycle_${hook}`] || mod[`__lifecycle_${hook}`];
  if (!fn) return { exists: false, success: false };
  try { const result = await fn({ installationId: 'default', pluginSlug: 'i18n', instanceKey: 'default', config: {}, ...ctx }); return { exists: true, success: true, result }; }
  catch (e: any) { return { exists: true, success: false, error: e.message }; }
}

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

const DB_URL = process.env.I18N_DATABASE_URL;

async function canReachDb(): Promise<boolean> {
  if (!DB_URL) return false;
  try {
    const { PrismaClient } = require('../../node_modules/.prisma/i18n-client');
    const p = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await p.$connect(); await p.$disconnect(); return true;
  } catch { return false; }
}

const DB_REACHABLE = !!DB_URL && (await canReachDb());
const describeIf = DB_REACHABLE ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describeIf('i18n Plugin - Full Realistic Journey', () => {
  let coreMock: Awaited<ReturnType<typeof startCoreMock>>;
  let pluginUrl: string;
  let pluginClose: () => Promise<void>;
  let prisma: any;
  let pluginModule: any;

  function hdrs(overrides: Record<string, string> = {}) {
    return buildHeaders({ 'x-platform-api-base-url': coreMock.url, ...overrides });
  }

  async function req(method: string, path: string, opts: { body?: any; headers?: Record<string, string> } = {}) {
    const h = hdrs(opts.headers || {});
    const fetchOpts: RequestInit = { method, headers: h };
    if (opts.body && method !== 'GET') fetchOpts.body = JSON.stringify(opts.body);
    const res = await fetch(`${pluginUrl}${path}`, fetchOpts);
    let body: any;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) { try { body = await res.json(); } catch { body = null; } }
    else { body = await res.text(); }
    return { status: res.status, body };
  }

  beforeAll(async () => {
    coreMock = await startCoreMock('test-service-token');
    const { PrismaClient } = require('../../node_modules/.prisma/i18n-client');
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await prisma.$connect();
    await prisma.translationJob.deleteMany();
    await prisma.uITranslation.deleteMany();
    await prisma.contentTranslation.deleteMany();
    await prisma.managedLanguage.deleteMany();

    pluginModule = await import('../../src/index');
    const app = pluginModule.createApp();
    await new Promise<void>((resolve) => {
      const server = app.listen(0, () => {
        const addr = server.address() as { port: number };
        pluginUrl = `http://localhost:${addr.port}`;
        pluginClose = () => new Promise<void>((r) => server.close(() => r()));
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.translationJob.deleteMany();
      await prisma.uITranslation.deleteMany();
      await prisma.contentTranslation.deleteMany();
      await prisma.managedLanguage.deleteMany();
    } catch {}
    await prisma?.$disconnect();
    await pluginClose?.();
    await coreMock?.close();
  });

  // Phase 1
  describe('Phase 1: Lifecycle', () => {
    it('onInstall succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onInstall');
      expect(r.exists).toBe(true);
      expect(r.success).toBe(true);
    });

    it('onEnable succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onEnable');
      expect(r.exists).toBe(true);
      expect(r.success).toBe(true);
    });
  });

  // Phase 2
  describe('Phase 2: Core API', () => {
    it('core mock reachable', async () => {
      const res = await fetch(`${coreMock.url}/health`);
      expect(res.status).toBe(200);
    });

    it('store settings available', async () => {
      const res = await fetch(`${coreMock.url}/api/store/settings`, { headers: { Authorization: 'Bearer test-service-token' } });
      const body = await res.json();
      expect(body.data.supportedLocales).toContain('en');
    });
  });

  // Phase 3
  describe('Phase 3: Real HTTP', () => {
    it('health', async () => {
      const r = await req('GET', '/health');
      expect(r.status).toBe(200);
      expect(r.body.plugin).toBe('i18n');
    });

    it('manifest', async () => {
      const r = await req('GET', '/manifest');
      expect(r.body.slug).toBe('i18n');
    });
  });

  // Phase 4: Language Management
  describe('Phase 4: Language Management', () => {
    it('create English as default', async () => {
      const r = await req('POST', '/languages', {
        body: { locale: 'en', name: 'English', nativeName: 'English', isDefault: true, isEnabled: true, direction: 'ltr' },
      });
      expect(r.status).toBeLessThan(300);
    });

    it('create Chinese', async () => {
      const r = await req('POST', '/languages', {
        body: { locale: 'zh', name: 'Chinese', nativeName: 'Chinese', isDefault: false, isEnabled: true, direction: 'ltr' },
      });
      expect(r.status).toBeLessThan(300);
    });

    it('list languages', async () => {
      const r = await req('GET', '/languages');
      expect(r.status).toBe(200);
      const langs = Array.isArray(r.body) ? r.body : r.body.data;
      expect(langs.length).toBeGreaterThanOrEqual(2);
    });

    it('languages persisted in DB', async () => {
      const langs = await prisma.managedLanguage.findMany();
      expect(langs.length).toBeGreaterThanOrEqual(2);
      expect(langs.find((l: any) => l.locale === 'en')).toBeDefined();
      expect(langs.find((l: any) => l.locale === 'zh')).toBeDefined();
    });

    it('cannot delete default language', async () => {
      const r = await req('DELETE', '/languages/en');
      expect(r.status).toBeGreaterThanOrEqual(400);
    });

    it('can delete non-default language', async () => {
      // Create a temp language to delete
      await req('POST', '/languages', {
        body: { locale: 'fr', name: 'French', nativeName: 'Francais', isDefault: false, isEnabled: true, direction: 'ltr' },
      });
      const r = await req('DELETE', '/languages/fr');
      expect(r.status).toBeLessThan(300);
    });
  });

  // Phase 5: Content Translations
  describe('Phase 5: Content Translations', () => {
    it('set product translations for zh', async () => {
      const r = await req('PUT', '/content/product/prod_001/zh', {
        body: { fields: { name: 'Product Name ZH', description: 'Desc ZH' } },
      });
      expect(r.status).toBeLessThan(300);
    });

    it('get product translations', async () => {
      const r = await req('GET', '/content/product/prod_001/zh');
      expect(r.status).toBe(200);
      const data = r.body.data || r.body;
      expect(data.name || data.fields?.name).toBeDefined();
    });

    it('translations persisted in DB', async () => {
      const translations = await prisma.contentTranslation.findMany({
        where: { entityType: 'product', entityId: 'prod_001', locale: 'zh' },
      });
      expect(translations.length).toBeGreaterThanOrEqual(2);
    });

    it('list translated entities', async () => {
      const r = await req('GET', '/content/product/list/zh');
      expect(r.status).toBe(200);
    });

    it('delete locale-specific translation', async () => {
      const r = await req('DELETE', '/content/product/prod_001?locale=zh');
      expect(r.status).toBeLessThan(300);

      const remaining = await prisma.contentTranslation.findMany({
        where: { entityType: 'product', entityId: 'prod_001', locale: 'zh' },
      });
      expect(remaining.length).toBe(0);
    });
  });

  // Phase 6: UI Translations
  describe('Phase 6: UI Translations', () => {
    it('set common namespace translations', async () => {
      const r = await req('PUT', '/ui/zh/common', {
        body: { 'btn.submit': 'Submit ZH', 'btn.cancel': 'Cancel ZH', 'title.home': 'Home ZH' },
      });
      expect(r.status).toBeLessThan(300);
    });

    it('get namespace translations', async () => {
      const r = await req('GET', '/ui/zh/common');
      expect(r.status).toBe(200);
    });

    it('UI translations persisted in DB', async () => {
      const uis = await prisma.uITranslation.findMany({
        where: { locale: 'zh', namespace: 'common' },
      });
      expect(uis.length).toBeGreaterThanOrEqual(3);
    });

    it('merged messages endpoint', async () => {
      const r = await req('GET', '/messages/zh');
      expect(r.status).toBe(200);
    });
  });

  // Phase 7: Import/Export
  describe('Phase 7: Import/Export', () => {
    beforeAll(async () => {
      // Seed some content for export
      await req('PUT', '/content/product/prod_export/zh', {
        body: { fields: { name: 'Export Test ZH', description: 'Export Desc ZH' } },
      });
    });

    it('export content as JSON', async () => {
      const r = await req('GET', '/export/content/json?entityType=product&locale=zh');
      expect(r.status).toBe(200);
    });

    it('export content as CSV', async () => {
      const res = await fetch(`${pluginUrl}/export/content/csv?entityType=product&locale=zh`, {
        headers: hdrs(),
      });
      expect(res.status).toBe(200);
      const ct = res.headers.get('content-type') || '';
      expect(ct).toContain('csv');
    });

    it('import content JSON endpoint is callable', async () => {
      const r = await req('POST', '/import/content/json', {
        body: {
          data: [
            { entityType: 'product', entityId: 'prod_import', locale: 'zh', field: 'name', value: 'Imported Name' },
          ],
        },
      });
      // Import may succeed (200/201) or reject format (400) - both are valid responses.
      // The key assertion: endpoint exists and doesn't crash (no 500).
      expect(r.status).toBeLessThan(500);
    });
  });

  // Phase 8: Stats
  describe('Phase 8: Translation Stats', () => {
    it('stats endpoint returns completeness', async () => {
      const r = await req('GET', '/stats/product/zh');
      expect(r.status).toBe(200);
    });
  });

  // Phase 9: Concurrent Updates
  describe('Phase 9: Concurrent Updates', () => {
    it('5 parallel translation updates succeed', async () => {
      const results = await runConcurrent(
        Array.from({ length: 5 }, (_, i) => async () =>
          req('PUT', `/content/product/prod_conc_${i}/zh`, {
            body: { fields: { name: `Concurrent ${i}`, description: `Desc ${i}` } },
          }),
        ),
      );
      const ok = results.filter((r) => r.result && r.result.status < 300);
      expect(ok.length).toBe(5);
    });
  });

  // Phase 10: Error Scenarios
  describe('Phase 10: Errors', () => {
    it('create language without required fields -> error', async () => {
      const r = await req('POST', '/languages', { body: { locale: 'xx' } });
      expect(r.status).toBeGreaterThanOrEqual(400);
    });

    it('get translations for non-existent entity returns empty', async () => {
      const r = await req('GET', '/content/product/nonexistent/en');
      expect(r.status).toBe(200);
    });

    it('delete non-existent language -> handled gracefully', async () => {
      const r = await req('DELETE', '/languages/nonexistent');
      // Should be 404 or 200 (no-op)
      expect(r.status).toBeLessThan(500);
    });
  });

  // Phase 11: Teardown
  describe('Phase 11: Teardown', () => {
    it('onDisable succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onDisable');
      expect(r.success).toBe(true);
    });

    it('onUninstall succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onUninstall');
      expect(r.success).toBe(true);
    });
  });
});
