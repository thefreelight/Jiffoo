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

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
  await execute(settings, uid, 'res.users', 'read', [[uid]], { fields: ['id'], limit: 1 });
  return { database: settings.database, username: settings.username, uid };
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
