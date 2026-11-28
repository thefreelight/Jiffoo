import { type NativeAuthEnv } from './auth';
import { ADMIN_PERMISSIONS } from './native-rbac';
import { requireAdminPermission } from './admin-access';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  loadCatalogItems,
  lowStockThresholdOf,
  primaryVariant,
  toIsoTimestamp,
  type SnapshotProduct,
} from './admin-products';

type InventoryEnv = NativeAuthEnv & { DB: D1Database };

// Native instances keep no inventory of their own: what is in stock is the catalog.
// These two reads are the inventory figures worked out from it. The rest of the
// inventory routes (forecasts, stored alerts, transfers) stay out of this handler.
const INVENTORY_READ = /^\/api\/v1\/admin\/inventory\/(stats|dashboard)\/?$/;
const READ_ONLY_MESSAGE = 'Native instances read their inventory from the catalog. Inventory cannot be changed from here.';

export type StockAlertType = 'STOCKOUT_RISK' | 'REORDER_POINT';
export type StockAlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

/** A product at or below the low-stock threshold. Worked out on each read; nothing is stored. */
export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string | null;
  alertType: StockAlertType;
  severity: StockAlertSeverity;
  status: 'ACTIVE';
  message: string;
  threshold: number;
  currentStock: number;
  recommendedOrder: null;
  resolvedAt: null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogInventory {
  products: number;
  units: number;
  value: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  lowStockThreshold: number;
  alerts: StockAlert[];
}

/** The units an item holds: its own figure, else what its on-sale variants hold. */
export function itemStock(item: SnapshotProduct): number {
  if (typeof item.stock === 'number') return item.stock;
  return (item.variants ?? [])
    .filter((variant) => variant.isActive !== false)
    .reduce((sum, variant) => sum + (variant.baseStock ?? 0), 0);
}

function itemPrice(item: SnapshotProduct): number {
  return primaryVariant(item)?.salePrice ?? item.price ?? 0;
}

function alertFor(item: SnapshotProduct, stock: number, threshold: number): StockAlert {
  const variant = primaryVariant(item);
  const outOfStock = stock <= 0;
  const at = toIsoTimestamp(item.sourceUpdatedAt);
  return {
    id: `stock:${item.id}`,
    productId: item.id,
    productName: item.name,
    variantId: variant?.id ?? item.id,
    variantName: variant?.name ?? null,
    alertType: outOfStock ? 'STOCKOUT_RISK' : 'REORDER_POINT',
    severity: outOfStock ? 'HIGH' : stock * 2 <= threshold ? 'MEDIUM' : 'LOW',
    status: 'ACTIVE',
    message: outOfStock
      ? `${item.name} is out of stock.`
      : `${item.name} has ${stock} in stock, at or below the threshold of ${threshold}.`,
    threshold,
    currentStock: stock,
    recommendedOrder: null,
    resolvedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * What the catalog holds: units, what they are worth, and the products at or below the
 * low-stock threshold. There is no order history on native instances to forecast from,
 * so there are no overstock or accuracy figures. Every product counts, on sale or not.
 */
export function catalogInventory(items: SnapshotProduct[], lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD): CatalogInventory {
  const threshold = lowStockThresholdOf(String(lowStockThreshold));
  const alerts: StockAlert[] = [];
  let units = 0;
  let value = 0;
  let low = 0;
  let out = 0;
  for (const item of items) {
    const stock = itemStock(item);
    units += stock;
    value += stock * itemPrice(item);
    if (stock <= 0) out += 1;
    else if (stock <= threshold) low += 1;
    if (stock <= threshold) alerts.push(alertFor(item, stock, threshold));
  }
  return {
    products: items.length,
    units,
    value: Math.round(value * 100) / 100,
    lowStockProducts: low,
    outOfStockProducts: out,
    lowStockThreshold: threshold,
    alerts,
  };
}

/** The dashboard's page: one-based, with a size between 1 and 100. */
export function alertPage(url: URL): { page: number; limit: number } {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 20)));
  return { page, limit };
}

/** The alerts one page of the dashboard asks for. Only active alerts exist: none are stored, so none are dismissed or resolved. */
export function alertPageOf(
  inventory: CatalogInventory,
  query: { page: number; limit: number; status?: string | null; productId?: string | null; variantId?: string | null },
): { alerts: { items: StockAlert[]; page: number; limit: number; total: number; totalPages: number }; context: { productId: string | null; variantId: string | null }; accuracy: null; latestForecast: null } {
  const status = query.status ?? 'ACTIVE';
  const productId = query.productId || null;
  const variantId = query.variantId || null;
  let list = status === 'ACTIVE' ? inventory.alerts : [];
  if (productId) list = list.filter((alert) => alert.productId === productId);
  if (variantId) list = list.filter((alert) => alert.variantId === variantId);
  const start = (query.page - 1) * query.limit;
  return {
    alerts: {
      items: list.slice(start, start + query.limit),
      page: query.page,
      limit: query.limit,
      total: list.length,
      totalPages: Math.ceil(list.length / query.limit),
    },
    // No forecasts on native instances, so no accuracy and no latest forecast.
    accuracy: null,
    latestForecast: null,
    context: { productId, variantId },
  };
}

function json(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-inventory' } });
}

export async function tryNativeAdminInventory(request: Request, env: InventoryEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(INVENTORY_READ);
  if (!match) return null;
  // Writes must not fall through to the fallback origin: there they would change another deployment's inventory.
  if (request.method !== 'GET') {
    return Response.json(
      { success: false, error: { code: 'NATIVE_INVENTORY_READ_ONLY', message: READ_ONLY_MESSAGE } },
      { status: 501, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-inventory' } },
    );
  }

  const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.INVENTORY_READ);
  if (!gate.ok) return gate.response;

  const inventory = catalogInventory(
    await loadCatalogItems(env),
    lowStockThresholdOf(url.searchParams.get('lowStockThreshold')),
  );
  if (match[1] === 'stats') {
    const { products, units, value, lowStockProducts, outOfStockProducts, lowStockThreshold } = inventory;
    return json({ stock: { products, units, value, lowStockProducts, outOfStockProducts, lowStockThreshold } });
  }
  return json(alertPageOf(inventory, {
    ...alertPage(url),
    status: url.searchParams.get('status'),
    productId: url.searchParams.get('productId'),
    variantId: url.searchParams.get('variantId'),
  }));
}
