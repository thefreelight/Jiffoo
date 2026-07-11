/**
 * i18n Plugin API Integration Test
 *
 * Starts the plugin in standalone mode and runs through all API endpoints.
 * Usage: I18N_DATABASE_URL="..." REDIS_URL="..." node scripts/test-api.js
 */

const http = require('http');

const BASE = 'http://localhost:4213';
let passed = 0;
let failed = 0;

// ============================================================================
// Helpers
// ============================================================================

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(name, condition) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${name}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================================
// Tests
// ============================================================================

async function run() {
  console.log('\n=== i18n Plugin API Tests ===\n');

  // -- Health --
  console.log('1. Health Check');
  const health = await request('GET', '/health');
  assert('status 200', health.status === 200);
  assert('plugin=i18n', health.data.plugin === 'i18n');
  assert('status=healthy', health.data.status === 'healthy');

  // -- Manifest --
  console.log('\n2. Manifest');
  const manifest = await request('GET', '/manifest');
  assert('slug=i18n', manifest.data.slug === 'i18n');
  assert('runtimeType=internal-fastify', manifest.data.runtimeType === 'internal-fastify');

  // -- Languages CRUD --
  console.log('\n3. Languages');

  const addEn = await request('POST', '/api/languages', {
    locale: 'en', name: 'English', nativeName: 'English', isDefault: true,
  });
  assert('add English', addEn.data.success === true);

  const addZh = await request('POST', '/api/languages', {
    locale: 'zh-Hant', name: 'Traditional Chinese', nativeName: '\u7E41\u9AD4\u4E2D\u6587',
    fallbackTo: 'en',
  });
  assert('add zh-Hant', addZh.data.success === true);

  const addFr = await request('POST', '/api/languages', {
    locale: 'fr', name: 'French', nativeName: 'Fran\u00e7ais', fallbackTo: 'en',
  });
  assert('add French', addFr.data.success === true);

  const langs = await request('GET', '/api/languages');
  assert('list returns 3', Array.isArray(langs.data.data) && langs.data.data.length === 3);
  assert('en is default', langs.data.data.some((l) => l.locale === 'en' && l.isDefault));

  const delFr = await request('DELETE', '/api/languages/fr');
  assert('delete French', delFr.data.success === true);

  const langsAfter = await request('GET', '/api/languages');
  assert('now 2 languages', langsAfter.data.data.length === 2);

  // Cannot delete default
  const delEn = await request('DELETE', '/api/languages/en');
  assert('cannot delete default (400)', delEn.status === 400);

  // -- Validation --
  console.log('\n4. Input Validation');

  const badLang = await request('POST', '/api/languages', { locale: 'xx' });
  assert('missing name returns 400', badLang.status === 400);

  // -- Content Translation CRUD --
  console.log('\n5. Content Translations');

  const putContent = await request('PUT', '/api/content/product/prod-001/zh-Hant', {
    fields: { name: '\u7121\u7DDA\u85CD\u7259\u8033\u6A5F', description: '\u9AD8\u7AEF\u964D\u566A' },
  });
  assert('set product translation', putContent.data.success === true);

  const getContent = await request('GET', '/api/content/product/prod-001/zh-Hant');
  assert('get returns name', getContent.data.data.name === '\u7121\u7DDA\u85CD\u7259\u8033\u6A5F');
  assert('get returns description', getContent.data.data.description === '\u9AD8\u7AEF\u964D\u566A');

  // Add a second product
  await request('PUT', '/api/content/product/prod-002/zh-Hant', {
    fields: { name: '\u667A\u80FD\u624B\u9336' },
  });

  // List translated entities (the bug we fixed - route ordering)
  const listContent = await request('GET', '/api/content/product/list/zh-Hant');
  assert('list returns items array', Array.isArray(listContent.data.data.items));
  assert('list contains 2 products', listContent.data.data.items.length === 2);
  assert('list contains prod-001', listContent.data.data.items.includes('prod-001'));
  assert('list total=2', listContent.data.data.total === 2);

  // Delete
  const delContent = await request('DELETE', '/api/content/product/prod-002?locale=zh-Hant');
  assert('delete returns count', delContent.data.data.deleted >= 1);

  const listAfterDel = await request('GET', '/api/content/product/list/zh-Hant');
  assert('list now 1 product', listAfterDel.data.data.items.length === 1);

  // -- Content validation --
  const badContent = await request('PUT', '/api/content/product/prod-001/zh-Hant', {});
  assert('missing fields returns 400', badContent.status === 400);

  // -- Redis Sync Verification --
  console.log('\n6. Redis Sync');
  try {
    const Redis = require('ioredis');
    const r = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const val = await r.get('i18n:c:product:prod-001:zh-Hant');
    assert('Redis has content key', val !== null);
    if (val) {
      const parsed = JSON.parse(val);
      assert('Redis name correct', parsed.name === '\u7121\u7DDA\u85CD\u7259\u8033\u6A5F');
    }
    // prod-002 should be deleted from Redis
    const val2 = await r.get('i18n:c:product:prod-002:zh-Hant');
    assert('Redis cleared after delete', val2 === null);
    await r.disconnect();
  } catch (e) {
    console.log('  [SKIP] Redis not available:', e.message);
  }

  // -- UI Translations CRUD --
  console.log('\n7. UI Translations');

  const putUI = await request('PUT', '/api/ui/zh-Hant/shop', {
    'nav.home': '\u9996\u9801',
    'nav.products': '\u5546\u54C1',
    'product.addToCart': '\u52A0\u5165\u8CFC\u7269\u8ECA',
  });
  assert('set UI translations', putUI.data.success === true);

  const getUI = await request('GET', '/api/ui/zh-Hant/shop');
  assert('get UI returns 3 keys', Object.keys(getUI.data.data).length === 3);
  assert('nav.home correct', getUI.data.data['nav.home'] === '\u9996\u9801');

  // Messages endpoint (aggregated)
  const msgs = await request('GET', '/api/messages/zh-Hant');
  assert('messages has shop namespace', msgs.data.data.shop !== undefined);
  assert('messages shop has nav.home', msgs.data.data.shop['nav.home'] === '\u9996\u9801');

  // -- Stats --
  console.log('\n8. Stats');
  const stats = await request('GET', '/api/stats/product/zh-Hant');
  assert('stats returns entityType', stats.data.data.entityType === 'product');
  assert('stats returns locale', stats.data.data.locale === 'zh-Hant');
  assert('stats translatedEntities=1', stats.data.data.translatedEntities === 1);

  // -- Admin HTML --
  console.log('\n9. Admin UI');
  const admin = await request('GET', '/admin');
  assert('admin returns HTML', admin.status === 200);
  assert('admin has tabs', typeof admin.data === 'string' && admin.data.includes('data-tab'));

  // -- CSV Export/Import --
  console.log('\n10. CSV Export/Import');

  // Export content CSV
  const csvExport = await request('GET', '/api/export/content/csv?entityType=product&locale=zh-Hant');
  assert('CSV export returns data', csvExport.status === 200);
  const csvStr = typeof csvExport.data === 'string' ? csvExport.data : '';
  assert('CSV has header row', csvStr.includes('entityType'));
  assert('CSV has data', csvStr.includes('prod-001'));

  // Export UI CSV
  const uiCsvExport = await request('GET', '/api/export/ui/csv?locale=zh-Hant');
  assert('UI CSV export returns data', uiCsvExport.status === 200);

  // Import content CSV
  const csvImport = await request('POST', '/api/import/content/csv', {
    csv: 'entityType,entityId,locale,field,value\nproduct,prod-csv-test,zh-Hant,name,CSV\u5C0E\u5165\u6E2C\u8A66',
    overwrite: true,
  });
  assert('CSV import success', csvImport.data.success === true);
  assert('CSV imported 1', csvImport.data.data.imported === 1);

  // Verify imported
  const csvVerify = await request('GET', '/api/content/product/prod-csv-test/zh-Hant');
  assert('CSV imported data readable', csvVerify.data.data.name === 'CSV\u5C0E\u5165\u6E2C\u8A66');

  // -- JSON Export/Import --
  console.log('\n11. JSON Export/Import');

  const jsonExport = await request('GET', '/api/export/content/json?entityType=product');
  assert('JSON export returns data', jsonExport.status === 200);

  const jsonImport = await request('POST', '/api/import/ui/json', {
    data: { 'zh-Hant:shop': { 'test.import': '\u6E2C\u8A66\u5C0E\u5165' } },
    overwrite: true,
  });
  assert('JSON import success', jsonImport.data.success === true);
  assert('JSON imported 1', jsonImport.data.data.imported === 1);

  // -- Auto-Translate --
  console.log('\n12. Auto-Translate');

  const providers = await request('GET', '/api/auto-translate/providers');
  assert('providers returns array', Array.isArray(providers.data.data));

  const jobs = await request('GET', '/api/auto-translate/jobs');
  assert('jobs list returns items', Array.isArray(jobs.data.data.items));

  // Triggering auto-translate without API key should fail gracefully
  const autoFail = await request('POST', '/api/auto-translate', {
    targetLocale: 'zh-Hant', provider: 'deepl', scope: 'content', entityType: 'product',
  });
  assert('auto-translate without key returns 400', autoFail.status === 400);

  // -- Cleanup --
  console.log('\n13. Cleanup');
  await request('DELETE', '/api/content/product/prod-001?locale=zh-Hant');
  await request('DELETE', '/api/content/product/prod-csv-test?locale=zh-Hant');
  const empty = await request('GET', '/api/content/product/list/zh-Hant');
  assert('all content cleaned', empty.data.data.items.length === 0);

  // -- Summary --
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Wait for server to be ready, then run
async function waitForServer() {
  for (let i = 0; i < 20; i++) {
    try {
      await request('GET', '/health');
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

(async () => {
  const ready = await waitForServer();
  if (!ready) {
    console.error('Server not ready at', BASE);
    process.exit(1);
  }
  await run();
})();
