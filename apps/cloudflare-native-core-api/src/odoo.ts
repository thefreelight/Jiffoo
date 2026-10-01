import { getNativePluginConfig } from './plugin-settings';

interface OdooEnv extends Pick<Cloudflare.Env, 'DB' | 'JWT_SECRET'> {}

interface OdooConfig {
  baseUrl: string;
  database: string;
  username: string;
  apiKey: string;
}

interface OdooOrderInput {
  externalOrderRef: string;
  productCode: string;
  quantity: number;
  shippingAddress?: unknown;
  customerEmail?: unknown;
}

export type OdooProductRecord = {
  id: number;
  product_tmpl_id?: [number, string] | number | false;
  display_name?: string;
  default_code?: string | false;
  list_price?: number | false;
  qty_available?: number | false;
  virtual_available?: number | false;
  active?: boolean;
  sale_ok?: boolean;
  detailed_type?: string;
  type?: string;
  is_storable?: boolean;
  description_sale?: string | false;
  write_date?: string | false;
};

export type NativeOdooCatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productKind: 'goods' | 'consumable' | 'service';
  requiresShipping: boolean;
  stock: number;
  price: number;
  isActive: boolean;
  sourceUpdatedAt: string | null;
  images: string[];
  typeData: { provider: 'odoo'; odooTemplateId: number };
  variants: Array<{
    id: string;
    name: string;
    skuCode: string;
    salePrice: number;
    baseStock: number;
    isActive: boolean;
    attributes: {
      provider: 'odoo';
      odooProductId: number;
      virtualAvailable: number;
      installationId?: string;
      externalVariantCode?: string;
    };
  }>;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stableSlug(value: string, fallback: string): string {
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized ? normalized.slice(0, 80) : fallback;
}

function templateId(record: OdooProductRecord): number {
  return Array.isArray(record.product_tmpl_id) ? record.product_tmpl_id[0] : number(record.product_tmpl_id);
}

function templateName(record: OdooProductRecord): string {
  return Array.isArray(record.product_tmpl_id) ? text(record.product_tmpl_id[1]) : text(record.display_name);
}

function productKind(value: string, isStorable = false): 'goods' | 'consumable' | 'service' {
  if (value === 'service') return 'service';
  if (value === 'consu') return isStorable ? 'goods' : 'consumable';
  return 'goods';
}

async function catalogTypeFields(settings: OdooConfig, uid: number): Promise<string[]> {
  const definitions = await execute<Record<string, unknown>>(
    settings,
    uid,
    'product.product',
    'fields_get',
    [],
    { attributes: ['type'] },
  );
  if ('detailed_type' in definitions) return ['detailed_type'];
  return ['type', ...('is_storable' in definitions ? ['is_storable'] : [])];
}

async function config(env: OdooEnv): Promise<OdooConfig | null> {
  const stored = await getNativePluginConfig(env, 'odoo');
  if (!stored?.enabled) return null;
  const value = stored.config;
  const result = {
    baseUrl: text(value.baseUrl).replace(/\/+$/, ''),
    database: text(value.database),
    username: text(value.username),
    apiKey: text(value.apiKey),
  };
  return Object.values(result).every(Boolean) ? result : null;
}

export async function isNativeOdooCatalogConfigured(env: OdooEnv): Promise<boolean> {
  return Boolean(await config(env));
}

export async function nativeOdooMediaUrl(env: OdooEnv, templateId: string): Promise<string | null> {
  const settings = await config(env);
  return settings ? `${settings.baseUrl}/web/image/product.template/${templateId}/image_1920` : null;
}

async function rpc<T>(settings: OdooConfig, service: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${settings.baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: crypto.randomUUID() }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json<{ result?: T; error?: { data?: { message?: string }; message?: string } }>()
    .catch(() => ({} as { result?: T; error?: { data?: { message?: string }; message?: string } }));
  if (!response.ok || payload.error || payload.result === undefined) {
    const upstreamMessage = payload.error?.message;
    throw new Error(upstreamMessage && !/traceback|postgres|\.svc\.cluster\.local/i.test(upstreamMessage)
      ? upstreamMessage
      : `Odoo request failed (HTTP ${response.status})`);
  }
  return payload.result;
}

async function authenticate(settings: OdooConfig): Promise<number> {
  const uid = await rpc<number | false>(settings, 'common', 'authenticate', [
    settings.database, settings.username, settings.apiKey, {},
  ]);
  if (!uid) throw new Error('Odoo authentication failed');
  return uid;
}

async function execute<T>(settings: OdooConfig, uid: number, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
  return rpc<T>(settings, 'object', 'execute_kw', [
    settings.database, uid, settings.apiKey, model, method, args, kwargs,
  ]);
}

export async function testNativeOdooConnection(env: OdooEnv): Promise<{ database: string; username: string; uid: number }> {
  const settings = await config(env);
  if (!settings) throw new Error('Odoo plugin is not enabled or fully configured');
  const uid = await authenticate(settings);
  await execute(settings, uid, 'res.users', 'read', [[uid]], { fields: ['id'] });
  return { database: settings.database, username: settings.username, uid };
}

export async function readNativeOdooCatalog(env: OdooEnv): Promise<NativeOdooCatalogProduct[]> {
  const settings = await config(env);
  if (!settings) throw new Error('Odoo plugin is not enabled or fully configured');
  const uid = await authenticate(settings);
  const typeFields = await catalogTypeFields(settings, uid);
  const records = await execute<OdooProductRecord[]>(settings, uid, 'product.product', 'search_read', [
    [['sale_ok', '=', true]],
  ], {
    fields: [
      'id', 'product_tmpl_id', 'display_name', 'default_code', 'list_price',
      'qty_available', 'virtual_available', 'active', 'sale_ok', ...typeFields,
      'description_sale', 'write_date',
    ],
    order: 'product_tmpl_id,id',
    limit: 2_000,
  });
  return mapNativeOdooCatalog(records, settings.baseUrl);
}

export function mapNativeOdooCatalog(records: OdooProductRecord[], imageBaseUrl = ''): NativeOdooCatalogProduct[] {
  const products = new Map<number, NativeOdooCatalogProduct>();
  for (const record of records) {
    const sourceTemplateId = templateId(record);
    if (!sourceTemplateId || record.sale_ok === false) continue;
    const kind = productKind(text(record.detailed_type) || text(record.type), record.is_storable === true);
    // Sell only stock that is both physically present and forecast available.
    // Odoo's virtual_available includes outgoing reservations after a sale is
    // confirmed, while qty_available alone would keep reserved units sellable.
    const virtualAvailable = Math.max(0, Math.floor(number(record.virtual_available)));
    const available = Math.max(0, Math.floor(Math.min(number(record.qty_available), virtualAvailable)));
    const name = templateName(record) || `Odoo product ${sourceTemplateId}`;
    const id = `odoo-product-${sourceTemplateId}`;
    const variantId = `odoo-variant-${record.id}`;
    const price = Math.max(0, number(record.list_price));
    const existing = products.get(sourceTemplateId);
    const variant = {
      id: variantId,
      name: text(record.display_name) || name,
      skuCode: text(record.default_code) || `odoo-${record.id}`,
      salePrice: price,
      baseStock: available,
      isActive: record.active !== false,
      attributes: { provider: 'odoo' as const, odooProductId: record.id, virtualAvailable },
    };
    if (existing) {
      existing.variants.push(variant);
      existing.stock += available;
      existing.price = Math.min(existing.price, price);
      existing.isActive = existing.isActive || variant.isActive;
      continue;
    }
    products.set(sourceTemplateId, {
      id,
      name,
      slug: stableSlug(text(record.default_code) || name, id),
      description: text(record.description_sale) || null,
      productKind: kind,
      requiresShipping: kind === 'goods',
      stock: available,
      price,
      isActive: record.active !== false,
      sourceUpdatedAt: text(record.write_date) || null,
      // The Odoo image endpoint is public and gives every storefront the same
      // canonical asset instead of embedding large base64 blobs in D1 snapshots.
      images: imageBaseUrl ? [`/media/odoo-product-${sourceTemplateId}?v=${encodeURIComponent(text(record.write_date) || 'initial')}`] : [],
      typeData: { provider: 'odoo', odooTemplateId: sourceTemplateId },
      variants: [variant],
    });
  }
  return [...products.values()];
}

async function partnerId(settings: OdooConfig, uid: number, input: OdooOrderInput): Promise<number> {
  const email = text(input.customerEmail);
  if (email) {
    const existing = await execute<Array<{ id: number }>>(settings, uid, 'res.partner', 'search_read', [[['email', '=', email]]], { fields: ['id'], limit: 1 });
    if (existing[0]?.id) return existing[0].id;
  }
  const address = input.shippingAddress && typeof input.shippingAddress === 'object' && !Array.isArray(input.shippingAddress)
    ? input.shippingAddress as Record<string, unknown> : {};
  const name = text(address.name) || text(address.fullName) || email || `Bokmoo ${input.externalOrderRef}`;
  return execute<number>(settings, uid, 'res.partner', 'create', [{
    name,
    ...(email ? { email } : {}),
    ...(text(address.phone) ? { phone: text(address.phone) } : {}),
    ...(text(address.address1) ? { street: text(address.address1) } : {}),
    ...(text(address.address2) ? { street2: text(address.address2) } : {}),
    ...(text(address.city) ? { city: text(address.city) } : {}),
    ...(text(address.postalCode) ? { zip: text(address.postalCode) } : {}),
  }]);
}

export async function createNativeOdooOrder(
  env: OdooEnv,
  input: OdooOrderInput,
): Promise<{ orderId: number; orderName: string; externalStatus: string } | null> {
  const settings = await config(env);
  if (!settings) return null;
  const uid = await authenticate(settings);
  const existing = await execute<Array<{ id: number; name: string; state: string }>>(
    settings, uid, 'sale.order', 'search_read', [[['client_order_ref', '=', input.externalOrderRef]]],
    { fields: ['id', 'name', 'state'], limit: 1 },
  );
  if (existing[0]) return { orderId: existing[0].id, orderName: existing[0].name, externalStatus: existing[0].state };
  const products = await execute<Array<{ id: number; name: string }>>(
    settings, uid, 'product.product', 'search_read', [[['default_code', '=', input.productCode]]],
    { fields: ['id', 'name'], limit: 1 },
  );
  const product = products[0];
  if (!product) throw new Error(`Odoo product not found for default_code ${input.productCode}`);
  const customer = await partnerId(settings, uid, input);
  const orderId = await execute<number>(settings, uid, 'sale.order', 'create', [{
    partner_id: customer,
    partner_shipping_id: customer,
    client_order_ref: input.externalOrderRef,
    origin: 'Bokmoo',
    order_line: [[0, 0, { product_id: product.id, product_uom_qty: input.quantity }]],
  }]);
  await execute(settings, uid, 'sale.order', 'action_confirm', [[orderId]]);
  const created = await execute<Array<{ id: number; name: string; state: string }>>(
    settings, uid, 'sale.order', 'read', [[orderId]], { fields: ['id', 'name', 'state'] },
  );
  const order = created[0];
  if (!order) throw new Error('Odoo order was created but could not be read back');
  return { orderId: order.id, orderName: order.name, externalStatus: order.state };
}

export type NativeOdooShipment = {
  externalOrderRef: string;
  shipmentId: string;
  carrierName: string | null;
  trackingNumber: string | null;
  shipmentStatus: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'EXCEPTION';
  shippedAt: string | null;
  lastCheckedAt: string | null;
};

/** Read confirmed Odoo pickings for orders already submitted by Bokmoo. */
export async function readNativeOdooShipments(env: OdooEnv): Promise<NativeOdooShipment[]> {
  const settings = await config(env);
  if (!settings) return [];
  const uid = await authenticate(settings);
  const pickings = await execute<Array<Record<string, unknown>>>(settings, uid, 'stock.picking', 'search_read', [
    [['sale_id', '!=', false], ['state', 'in', ['assigned', 'done']]],
  ], { fields: ['id', 'name', 'sale_id', 'state', 'carrier_tracking_ref', 'carrier_id', 'date_done', 'write_date'], order: 'write_date desc', limit: 200 });
  const result: NativeOdooShipment[] = [];
  for (const picking of pickings) {
    const sale = Array.isArray(picking.sale_id) ? picking.sale_id[0] : null;
    if (typeof sale !== 'number') continue;
    const orders = await execute<Array<{ client_order_ref?: string }>>(settings, uid, 'sale.order', 'read', [[sale]], { fields: ['client_order_ref'] });
    const externalOrderRef = text(orders[0]?.client_order_ref);
    if (!externalOrderRef) continue;
    const linked = await env.DB.prepare(
      `SELECT 1 FROM native_external_order_links WHERE provider = 'odoo' AND external_order_ref = ?1 LIMIT 1`,
    ).bind(externalOrderRef).first();
    if (!linked) continue;
    const carrier = Array.isArray(picking.carrier_id) ? text(picking.carrier_id[1]) : null;
    const state = text(picking.state).toLowerCase();
    result.push({
      externalOrderRef,
      shipmentId: text(picking.name) || `odoo-picking-${picking.id}`,
      carrierName: carrier,
      trackingNumber: text(picking.carrier_tracking_ref) || null,
      shipmentStatus: state === 'done' ? 'SHIPPED' : 'PROCESSING',
      shippedAt: text(picking.date_done) || null,
      lastCheckedAt: text(picking.write_date) || new Date().toISOString(),
    });
  }
  return result;
}
