import { describe, expect, it } from 'vitest';

import { bossPackageToShopProduct, localizedItem } from './boss-upstream';
import { readSnapshotWithProductCopy } from './snapshot-read';

type Row = { payload: string; status_code: number; content_type: string };

const CN = bossPackageToShopProduct({
  odooId: 69,
  name: '中国大陆流量包 1GB/7天（中国大陆（国际漫游出口））',
  defaultCode: 'CN-1GB-7D',
  listPrice: 4.9,
  qtyAvailable: 9999,
  whetherActive: true,
})!;
const CARD = { id: 'odoo-product-6', name: 'Bokmoo Card V1', description: 'Bokmoo basic physical card.' };

function makeEnv(overrides: Record<string, string> = {}) {
  const stored = new Map<string, Row>();
  const put = (key: string, payload: unknown) =>
    stored.set(key, { payload: JSON.stringify(payload), status_code: 200, content_type: 'application/json' });
  // Canonical (queryless) snapshots — what catalog sync stores.
  put('core:snapshot:/api/v1/products/boss-CN-1GB-7D', { success: true, data: CN });
  put('core:snapshot:/api/v1/products/odoo-product-6', { success: true, data: { ...CARD, requiresShipping: true } });
  put('core:snapshot:/api/v1/products', { success: true, data: { items: [CARD, CN], total: 2 } });
  // A pre-warmed list variant for one locale (catalog sync writes these).
  put('core:snapshot:/api/v1/products?page=1&limit=12&locale=de&type=esim', {
    success: true,
    data: { items: [localizedItem(CN, 'de')], page: 1, limit: 12, total: 1 },
  });

  const prepare = (sql: string) => {
    const statement = (args: unknown[]) => ({
      sql,
      args,
      first: async () => (sql.includes('cache_key = ?1') ? stored.get(String(args[0])) ?? null : null),
      all: async () => ({
        results: sql.includes('native_product_copy_overrides')
          ? Object.entries(overrides).map(([product_id, description]) => ({ product_id, description }))
          : [],
      }),
      run: async () => ({}),
    });
    return { ...statement([]), bind: (...args: unknown[]) => statement(args) };
  };
  return { env: { DB: { prepare } } as unknown as Parameters<typeof readSnapshotWithProductCopy>[1], stored };
}

async function read(path: string, env: ReturnType<typeof makeEnv>['env']) {
  const snapshot = await readSnapshotWithProductCopy(new URL(`https://api.example${path}`), env);
  if (!snapshot) return { status: 503, body: { data: {} } };
  return {
    status: snapshot.status_code,
    body: JSON.parse(snapshot.payload) as { data: { description?: string; items?: Array<{ id: string; description?: string }> } },
  };
}

const describe_ = CN.description;

describe('product copy follows the storefront locale at read time', () => {
  it('keeps the seeded Chinese copy for the zh locales and for requests without a locale', async () => {
    const { env } = makeEnv();
    expect((await read('/api/v1/products/boss-CN-1GB-7D?locale=zh-Hans', env)).body.data.description).toBe(describe_);
    expect((await read('/api/v1/products/boss-CN-1GB-7D?locale=zh-Hant', env)).body.data.description).toBe(describe_);
    expect((await read('/api/v1/products/boss-CN-1GB-7D', env)).body.data.description).toBe(describe_);
  });

  it('translates the detail description for every non-Chinese locale', async () => {
    const { env } = makeEnv();
    const name = CN.name;
    const expected: Record<string, string> = {
      en: '. Delivered right after purchase — activates on first connection.',
      ja: '。ご注文後すぐに発行され、初めて接続したときに有効化されます。',
      ko: '. 결제 후 즉시 발급되며, 첫 연결 시 활성화돼요.',
      fr: '. Livré immédiatement après l’achat — s’active dès la première connexion.',
      de: '. Sofort nach dem Kauf zugestellt — wird bei der ersten Verbindung aktiviert.',
      'ja-JP': '。ご注文後すぐに発行され、初めて接続したときに有効化されます。',
    };
    for (const [locale, note] of Object.entries(expected)) {
      const { status, body } = await read(`/api/v1/products/boss-CN-1GB-7D?locale=${locale}`, env);
      expect(status).toBe(200);
      expect(body.data.description, locale).toBe(`${name}${note}`);
      expect(body.data.description).not.toMatch(/下单后/);
    }
  });

  it('translates list items too, whether or not the locale variant was pre-warmed', async () => {
    const { env } = makeEnv();
    // Pre-warmed exact snapshot: already localized, read-time follow is a no-op.
    const prewarmed = await read('/api/v1/products?page=1&limit=12&locale=de&type=esim', env);
    expect(prewarmed.body.data.items?.[0].description).toMatch(/Sofort nach dem Kauf/);
    // Un-prewarmed variant falls back to the bare list and is still localized.
    const fallback = await read('/api/v1/products?page=1&limit=12&locale=ko&type=esim&country=KR', env);
    const boss = fallback.body.data.items?.find((item) => item.id === 'boss-CN-1GB-7D');
    expect(boss?.description).toMatch(/결제 후 즉시 발급/);
  });

  it('never touches non-BOSS products', async () => {
    const { env } = makeEnv();
    expect((await read('/api/v1/products/odoo-product-6?locale=ja', env)).body.data.description).toBe(CARD.description);
    const list = await read('/api/v1/products?page=1&limit=12&locale=ja&type=esim', env);
    expect(list.body.data.items?.find((item) => item.id === 'odoo-product-6')?.description).toBe(CARD.description);
  });

  it('lets an admin-edited description win over locale follow', async () => {
    const { env } = makeEnv({ 'boss-CN-1GB-7D': '运营手写文案' });
    expect((await read('/api/v1/products/boss-CN-1GB-7D?locale=de', env)).body.data.description).toBe('运营手写文案');
  });

  it('leaves the stored snapshot untouched', async () => {
    const { env, stored } = makeEnv();
    await read('/api/v1/products/boss-CN-1GB-7D?locale=fr', env);
    expect(JSON.parse(stored.get('core:snapshot:/api/v1/products/boss-CN-1GB-7D')!.payload).data.description).toBe(describe_);
  });
});
