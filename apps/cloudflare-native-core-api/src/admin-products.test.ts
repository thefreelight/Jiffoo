import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();

vi.mock('./auth', () => ({
  authenticateNativeAdmin,
}));

const { tryNativeAdminProducts } = await import('./admin-products');

const CATALOG_SNAPSHOT = JSON.stringify({
  success: true,
  data: {
    items: [
      {
        id: 'odoo-product-6',
        name: '[BOKMOO-CARD-V1] Bokmoo Card V1',
        slug: 'bokmoo-card-v1',
        description: 'Bokmoo basic physical card.',
        productKind: 'goods',
        stock: 94,
        price: 20,
        isActive: true,
        sourceUpdatedAt: '2026-08-24 10:13:56',
        images: ['/media/odoo-product-6'],
        variants: [{ id: 'odoo-variant-6', name: 'Card V1', skuCode: 'BOKMOO-CARD-V1', salePrice: 20, baseStock: 94, isActive: true }],
      },
      {
        id: 'odoo-product-7',
        name: '[BOKMOO-CARD-V2] Bokmoo Card V2',
        slug: 'bokmoo-card-v2',
        productKind: 'goods',
        stock: 0,
        price: 30,
        isActive: false,
        sourceUpdatedAt: '2026-09-01 08:00:00',
        variants: [{ id: 'odoo-variant-7', name: 'Card V2', skuCode: 'BOKMOO-CARD-V2', salePrice: 30, baseStock: 0, isActive: true }],
      },
    ],
  },
});

const DETAIL_SNAPSHOT = JSON.stringify({
  success: true,
  data: {
    id: 'odoo-product-6',
    name: '[BOKMOO-CARD-V1] Bokmoo Card V1',
    description: 'Bokmoo basic physical card.',
    requiresShipping: true,
    stock: 94,
    price: 20,
    isActive: true,
    sourceUpdatedAt: '2026-08-24 10:13:56',
    images: ['/media/odoo-product-6'],
    variants: [{ id: 'odoo-variant-6', name: 'Card V1', skuCode: 'BOKMOO-CARD-V1', salePrice: 20, baseStock: 94, isActive: true }],
  },
});

function fakeEnv(rows: Record<string, string>) {
  const prepare = (sql: string) => {
    const statement = (boundArgs: unknown[]) => ({
      first: async () => {
        if (sql.includes("request_path = '/api/v1/products' LIMIT 1")) {
          return rows.catalog ? { payload: rows.catalog } : null;
        }
        if (sql.includes('request_path = ?1 LIMIT 1')) {
          const payload = rows[String(boundArgs[0])];
          return payload ? { payload } : null;
        }
        return null;
      },
      all: async () => ({
        results: sql.includes('native_product_copy_overrides') && rows.overridesJson
          ? JSON.parse(rows.overridesJson) as Array<{ product_id: string; description: string }>
          : [],
      }),
      run: async () => ({}),
    });
    return { ...statement([]), bind: (...args: unknown[]) => statement(args) };
  };
  return { DB: { prepare } } as unknown as Parameters<typeof tryNativeAdminProducts>[1];
}

function request(path: string, method = 'GET'): Request {
  return new Request(`https://api.bokmoo.test${path}`, { method, headers: { authorization: 'Bearer test-token' } });
}

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' });
});

describe('tryNativeAdminProducts', () => {
  it('projects the deployed catalog snapshot into the admin list DTO', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products?page=1&limit=10'), env);
    const body = await response.json() as { data: { items: Array<{ skuCode?: string; price?: number; stock?: number; status?: string; createdAt: string }>; total: number } };
    expect(body.data.total).toBe(2);
    expect(body.data.items[0]).toMatchObject({ id: 'odoo-product-6', skuCode: 'BOKMOO-CARD-V1', price: 20, stock: 94, status: 'ACTIVE' });
    expect(body.data.items[0].createdAt).toBe('2026-08-24T10:13:56Z');
    expect(body.data.items[1]).toMatchObject({ id: 'odoo-product-7', status: 'DRAFT', stock: 0 });
  });

  it('filters by search across name and sku', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products?search=bokmoo-card-v2'), env);
    const body = await response.json() as { data: { items: Array<{ id: string }>; total: number } };
    expect(body.data.total).toBe(1);
    expect(body.data.items[0].id).toBe('odoo-product-7');
  });

  it('computes stats from snapshot stock levels', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products/stats'), env);
    const body = await response.json() as { data: { metrics: { totalProducts: number; activeProducts: number; lowStockProducts: number; outOfStockProducts: number } } };
    expect(body.data.metrics).toMatchObject({ totalProducts: 2, activeProducts: 1, lowStockProducts: 0, outOfStockProducts: 1 });
  });

  it('serves product detail from the detail snapshot row', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT, '/api/v1/products/odoo-product-6': DETAIL_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products/odoo-product-6'), env);
    const body = await response.json() as { data: { id: string; skuCode?: string; variants: unknown[] } };
    expect(body.data.id).toBe('odoo-product-6');
    expect(body.data.skuCode).toBe('BOKMOO-CARD-V1');
  });

  it('404s unknown products on detail', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products/nope'), env);
    expect(response.status).toBe(404);
  });

  it('rejects mutations with an explicit read-only error instead of proxying', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products/odoo-product-6', 'PUT'), env);
    expect(response.status).toBe(501);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('NATIVE_CATALOG_READ_ONLY');
  });

  it('requires admin authentication', async () => {
    authenticateNativeAdmin.mockResolvedValue(null);
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products'), env);
    expect(response.status).toBe(401);
  });

  it('projects admin copy overrides into the list DTO', async () => {
    const env = fakeEnv({
      catalog: CATALOG_SNAPSHOT,
      overridesJson: JSON.stringify([{ product_id: 'odoo-product-6', description: '管理员改过的描述' }]),
    });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products'), env);
    const body = await response.json() as { data: { items: Array<{ id: string; description: string; odooDescription: string | null; descriptionOverridden: boolean }> } };
    expect(body.data.items[0]).toMatchObject({ id: 'odoo-product-6', description: '管理员改过的描述', odooDescription: 'Bokmoo basic physical card.', descriptionOverridden: true });
    expect(body.data.items[1]).toMatchObject({ id: 'odoo-product-7', description: null, descriptionOverridden: false });
  });

  it('projects admin copy overrides into the detail DTO', async () => {
    const env = fakeEnv({
      catalog: CATALOG_SNAPSHOT,
      '/api/v1/products/odoo-product-6': DETAIL_SNAPSHOT,
      overridesJson: JSON.stringify([{ product_id: 'odoo-product-6', description: '管理员改过的描述' }]),
    });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products/odoo-product-6'), env);
    const body = await response.json() as { data: { description: string; odooDescription: string | null; descriptionOverridden: boolean } };
    expect(body.data).toMatchObject({ description: '管理员改过的描述', odooDescription: 'Bokmoo basic physical card.', descriptionOverridden: true });
  });

  it('upserts a description override for a known product', async () => {
    const executed: Array<{ sql: string; args: unknown[] }> = [];
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT, '/api/v1/products/odoo-product-6': DETAIL_SNAPSHOT });
    const originalPrepare = (env as { DB: { prepare: (sql: string) => unknown } }).DB.prepare;
    (env as { DB: { prepare: (sql: string) => unknown } }).DB.prepare = (sql: string) => {
      const statement = originalPrepare(sql) as { bind: (...args: unknown[]) => unknown };
      return {
        ...statement,
        bind: (...args: unknown[]) => {
          executed.push({ sql, args });
          return statement.bind(...args);
        },
      };
    };
    const saveRequest = new Request('https://api.bokmoo.test/api/v1/admin/products/odoo-product-6/description', {
      method: 'PUT',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ description: '  实体卡，搭配 BOKMOO App 使用  ' }),
    });
    const response = await tryNativeAdminProducts(saveRequest, env);
    const body = await response.json() as { data: { description: string; descriptionOverridden: boolean } };
    expect(body.data).toMatchObject({ description: '实体卡，搭配 BOKMOO App 使用', descriptionOverridden: true });
    const insert = executed.find((call) => call.sql.includes('INSERT INTO native_product_copy_overrides'));
    expect(insert?.args[0]).toBe('odoo-product-6');
    expect(insert?.args[2]).toBe('admin-1');
  });

  it('deletes the override when the description is empty (reset to Odoo)', async () => {
    const executed: string[] = [];
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT, '/api/v1/products/odoo-product-6': DETAIL_SNAPSHOT });
    const originalPrepare = (env as { DB: { prepare: (sql: string) => unknown } }).DB.prepare;
    (env as { DB: { prepare: (sql: string) => unknown } }).DB.prepare = (sql: string) => {
      const statement = originalPrepare(sql) as { bind: (...args: unknown[]) => unknown };
      return {
        ...statement,
        bind: (...args: unknown[]) => {
          executed.push(sql);
          return statement.bind(...args);
        },
      };
    };
    const saveRequest = new Request('https://api.bokmoo.test/api/v1/admin/products/odoo-product-6/description', {
      method: 'PUT',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ description: '' }),
    });
    const response = await tryNativeAdminProducts(saveRequest, env);
    const body = await response.json() as { data: { descriptionOverridden: boolean; odooDescription: string | null } };
    expect(body.data).toMatchObject({ descriptionOverridden: false, odooDescription: 'Bokmoo basic physical card.' });
    expect(executed.some((sql) => sql.includes('DELETE FROM native_product_copy_overrides'))).toBe(true);
  });

  it('404s description saves for products outside the deployed catalog', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const saveRequest = new Request('https://api.bokmoo.test/api/v1/admin/products/odoo-product-999/description', {
      method: 'PUT',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    });
    const response = await tryNativeAdminProducts(saveRequest, env);
    expect(response.status).toBe(404);
  });

  it('still rejects unrelated mutations as read-only', async () => {
    const env = fakeEnv({ catalog: CATALOG_SNAPSHOT });
    const response = await tryNativeAdminProducts(request('/api/v1/admin/products/odoo-product-6', 'PUT'), env);
    expect(response.status).toBe(501);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe('NATIVE_CATALOG_READ_ONLY');
  });
});
