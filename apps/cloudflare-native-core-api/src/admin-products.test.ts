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
          const payload = rows[`/api/v1/products/${boundArgs[0]}`];
          return payload ? { payload } : null;
        }
        return null;
      },
      all: async () => ({ results: [] }),
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
});
