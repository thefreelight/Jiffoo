import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdminPermission = vi.fn();
vi.mock('./admin-access', () => ({ requireAdminPermission }));

const { tryNativeAdminInventory, catalogInventory, itemStock, alertPageOf, alertPage } = await import('./admin-inventory');
const { lowStockThresholdOf, DEFAULT_LOW_STOCK_THRESHOLD } = await import('./admin-products');
const { ADMIN_PERMISSIONS } = await import('./native-rbac');

afterEach(() => vi.clearAllMocks());

const at = '2026-11-28 06:34:13';
const item = (id: string, name: string, price: number, stock: number, extra: Record<string, unknown> = {}) => ({
  id, name, price, stock, isActive: true, sourceUpdatedAt: at, images: [], ...extra,
});

// Six products: one low on stock (3), one out of stock (0).
const CATALOG = [
  item('p1', 'Scented Candle', 49, 38),
  item('p2', 'Minimalist Vase', 65, 12),
  item('p3', 'Leather Cardholder', 89, 3),
  item('p4', 'Classic Blue Watch', 199, 0),
  item('p5', 'Wireless Headphones', 159, 24),
  item('p6', 'Linen Notebook', 18, 120),
];

/** A database that holds the catalog snapshot, or none at all. */
function catalogDb(items: unknown[] | null) {
  const prepare = (sql: string) => {
    if (!sql.includes("request_path = '/api/v1/products'")) throw new Error(`unhandled SQL: ${sql.slice(0, 80)}`);
    const payload = items === null ? null : JSON.stringify({ success: true, data: { items, total: items.length } });
    const statement = { first: async () => (payload === null ? null : { payload }), all: async () => ({ results: [] }), run: async () => ({}) };
    return { ...statement, bind: () => statement };
  };
  return { prepare };
}

const call = (pathAndQuery: string, items: unknown[] | null, method = 'GET') =>
  tryNativeAdminInventory(new Request(`https://api.example/api/v1/admin/inventory/${pathAndQuery}`, { method }), { DB: catalogDb(items) } as never);

const allowed = () => requireAdminPermission.mockResolvedValue({ ok: true, admin: { id: 'admin-1', role: 'ADMIN' } });

describe('inventory figures worked out from the catalog', () => {
  it('adds up the units and what they are worth, and finds the products at or below the threshold', () => {
    const inventory = catalogInventory(CATALOG);
    expect(inventory.products).toBe(6);
    expect(inventory.units).toBe(197);
    expect(inventory.value).toBe(8885);
    expect(inventory.lowStockProducts).toBe(1);
    expect(inventory.outOfStockProducts).toBe(1);
    expect(inventory.lowStockThreshold).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(inventory.alerts.map((alert) => [alert.productId, alert.alertType, alert.severity, alert.currentStock])).toEqual([
      ['p3', 'REORDER_POINT', 'LOW', 3],
      ['p4', 'STOCKOUT_RISK', 'HIGH', 0],
    ]);
  });

  it('describes each alert the way the dashboard lists them', () => {
    const [low, out] = catalogInventory(CATALOG).alerts;
    expect(low).toMatchObject({
      id: 'stock:p3', productId: 'p3', productName: 'Leather Cardholder', variantId: 'p3', variantName: null,
      alertType: 'REORDER_POINT', severity: 'LOW', status: 'ACTIVE', threshold: 5, currentStock: 3,
      recommendedOrder: null, resolvedAt: null, createdAt: '2026-11-28T06:34:13Z', updatedAt: '2026-11-28T06:34:13Z',
      message: 'Leather Cardholder has 3 in stock, at or below the threshold of 5.',
    });
    expect(out).toMatchObject({ alertType: 'STOCKOUT_RISK', severity: 'HIGH', message: 'Classic Blue Watch is out of stock.' });
  });

  it('a product far below the threshold is a medium alert', () => {
    const [alert] = catalogInventory([item('p1', 'Ribbon', 4, 2)]).alerts;
    expect(alert.severity).toBe('MEDIUM');
  });

  it('counts the units of a product that keeps them on its variants', () => {
    const variants = [
      { id: 'v1', name: 'Small', salePrice: 12.345, baseStock: 2, isActive: true },
      { id: 'v2', name: 'Large', salePrice: 20, baseStock: 5, isActive: false },
    ];
    const withoutOwnStock = { id: 'p9', name: 'Paper', sourceUpdatedAt: at, isActive: true, price: 99, variants };
    expect(itemStock(withoutOwnStock as never)).toBe(2);
    const inventory = catalogInventory([withoutOwnStock as never]);
    expect(inventory).toMatchObject({ units: 2, value: 24.69, lowStockProducts: 1, outOfStockProducts: 0 });
    expect(inventory.alerts[0]).toMatchObject({ variantId: 'v1', variantName: 'Small' });
  });

  it('counts every product, on sale or not', () => {
    const inventory = catalogInventory([item('p1', 'Old Line', 10, 0, { isActive: false })]);
    expect(inventory).toMatchObject({ products: 1, units: 0, value: 0, outOfStockProducts: 1 });
    expect(inventory.alerts).toHaveLength(1);
  });

  it('follows the threshold asked for, and falls back to the default for anything that is not a positive number', () => {
    expect(lowStockThresholdOf('10')).toBe(10);
    expect(lowStockThresholdOf('2.7')).toBe(2);
    expect(lowStockThresholdOf(null)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(lowStockThresholdOf('0')).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(lowStockThresholdOf('-3')).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(lowStockThresholdOf('many')).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    const inventory = catalogInventory(CATALOG, lowStockThresholdOf('12'));
    expect(inventory).toMatchObject({ lowStockThreshold: 12, lowStockProducts: 2 });
    expect(inventory.alerts.map((alert) => alert.productId)).toEqual(['p2', 'p3', 'p4']);
  });
});

describe('the two inventory reads', () => {
  it('leaves every other route alone', async () => {
    allowed();
    expect(await call('forecast', CATALOG, 'POST')).toBeNull();
    expect(await tryNativeAdminInventory(new Request('https://api.example/api/v1/admin/inventory/alerts'), { DB: catalogDb(CATALOG) } as never)).toBeNull();
    expect(await tryNativeAdminInventory(new Request('https://api.example/api/v1/admin/products'), { DB: catalogDb(CATALOG) } as never)).toBeNull();
    expect(requireAdminPermission).not.toHaveBeenCalled();
  });

  it('refuses to write: a write must not reach another deployment through the fallback origin', async () => {
    const response = await call('stats', CATALOG, 'POST');
    expect(response?.status).toBe(501);
    expect(await response?.json()).toMatchObject({ success: false, error: { code: 'NATIVE_INVENTORY_READ_ONLY' } });
    expect(requireAdminPermission).not.toHaveBeenCalled();
  });

  it('needs the inventory permission before it reads anything', async () => {
    const denied = Response.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
    requireAdminPermission.mockResolvedValue({ ok: false, response: denied });
    const response = await call('stats', CATALOG);
    expect(response).toBe(denied);
    expect(requireAdminPermission).toHaveBeenCalledWith(expect.any(Request), expect.anything(), ADMIN_PERMISSIONS.INVENTORY_READ);
  });

  it('reports what the catalog holds', async () => {
    allowed();
    const response = await call('stats', CATALOG);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-d1-admin-inventory');
    expect(await response?.json()).toEqual({
      success: true,
      data: { stock: { products: 6, units: 197, value: 8885, lowStockProducts: 1, outOfStockProducts: 1, lowStockThreshold: 5 } },
    });
  });

  it('answers an empty catalog with zeroes, not an error', async () => {
    allowed();
    const stats = await call('stats', null);
    if (!stats) throw new Error('the statistics read answered nothing');
    expect(await stats.json()).toMatchObject({ success: true, data: { stock: { products: 0, units: 0, value: 0, lowStockProducts: 0, outOfStockProducts: 0 } } });
    const response = await call('dashboard', null);
    if (!response) throw new Error('the dashboard read answered nothing');
    const dashboard = await response.json();
    expect(dashboard).toMatchObject({ success: true, data: { alerts: { items: [], total: 0, totalPages: 0 }, context: { productId: null, variantId: null } } });
  });

  it('lists the active alerts a page at a time', async () => {
    allowed();
    const read = async (pathAndQuery: string) => {
      const response = await call(`dashboard${pathAndQuery}`, CATALOG);
      if (!response) throw new Error(`the dashboard read ${pathAndQuery} answered nothing`);
      const body = await response.json();
      const ids = (page: { items: Array<{ productId: string }> }) => page.items.map((alert) => alert.productId);
      return { ...body.data, ids };
    };
    const first = await read('');
    expect(first.alerts).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(first.ids(first.alerts)).toEqual(['p3', 'p4']);
    expect(first).toMatchObject({ context: { productId: null, variantId: null }, accuracy: null, latestForecast: null });

    const second = await read('?page=2&limit=1');
    expect(second.alerts).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(second.ids(second.alerts)).toEqual(['p4']);

    // Alerts are worked out on each read: none are stored, so none are dismissed or resolved.
    expect((await read('?status=DISMISSED')).alerts).toMatchObject({ items: [], total: 0 });
    const oneProduct = await read('?productId=p3');
    expect(oneProduct.ids(oneProduct.alerts)).toEqual(['p3']);
    expect(oneProduct.context).toEqual({ productId: 'p3', variantId: null });
    expect((await read('?productId=p1')).alerts.total).toBe(0);
  });

  it('keeps the page and its size within bounds', () => {
    expect(alertPage(new URL('https://api.example/api/v1/admin/inventory/dashboard'))).toEqual({ page: 1, limit: 20 });
    expect(alertPage(new URL('https://api.example/api/v1/admin/inventory/dashboard?page=-2&limit=500'))).toEqual({ page: 1, limit: 100 });
    expect(alertPage(new URL('https://api.example/api/v1/admin/inventory/dashboard?page=3.9&limit=0'))).toEqual({ page: 3, limit: 20 });
  });

  it('narrows a page to a variant when one is named', () => {
    const variants = [{ id: 'v1', name: 'Small', salePrice: 5, baseStock: 1, isActive: true }];
    const inventory = catalogInventory([{ id: 'p1', name: 'Paper', price: 5, sourceUpdatedAt: at, isActive: true, variants } as never]);
    expect(alertPageOf(inventory, { page: 1, limit: 20, variantId: 'v1' }).alerts.total).toBe(1);
    expect(alertPageOf(inventory, { page: 1, limit: 20, variantId: 'v2' }).alerts.total).toBe(0);
  });
});
