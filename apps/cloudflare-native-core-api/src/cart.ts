import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';

interface NativeCartEnv extends NativeAuthEnv {
  DB: D1Database;
}

interface ProductVariant {
  id: string;
  name?: string | null;
  salePrice: number;
  baseStock: number;
  isActive: boolean;
  attributes?: Record<string, unknown> | null;
}

interface ProductDetail {
  id: string;
  name: string;
  productKind: 'goods' | 'consumable' | 'service';
  images?: string[];
  stock: number;
  variants: ProductVariant[];
}

interface CartRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CartItemRow {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  product_kind: 'goods' | 'consumable' | 'service';
  variant_id: string;
  variant_name: string | null;
  variant_attributes: string | null;
  price: number;
  quantity: number;
  max_quantity: number;
  fulfillment_data: string | null;
}

type ProxyRequest = (request: Request) => Promise<Response>;
type ProductLoader = (productId: string) => Promise<ProductDetail | null>;

function jsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

function response(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-cart' },
  });
}

function error(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-cart' },
  });
}

async function renderCart(env: NativeCartEnv, cart: CartRow): Promise<Record<string, unknown>> {
  const result = await env.DB.prepare(
    'SELECT * FROM native_cart_items WHERE cart_id = ?1 ORDER BY created_at, id',
  ).bind(cart.id).all<CartItemRow>();
  const items = result.results.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    productImage: item.product_image,
    price: item.price,
    quantity: item.quantity,
    variantId: item.variant_id,
    variantName: item.variant_name,
    variantAttributes: jsonRecord(item.variant_attributes),
    productKind: item.product_kind,
    requiresShipping: item.product_kind !== 'service',
    maxQuantity: item.max_quantity,
    subtotal: item.price * item.quantity,
    fulfillmentData: jsonRecord(item.fulfillment_data),
  }));
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return {
    id: cart.id,
    userId: cart.user_id,
    items,
    total: subtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    tax: 0,
    shipping: 0,
    discount: 0,
    discountAmount: 0,
    appliedDiscounts: [],
    status: cart.status,
    createdAt: cart.created_at,
    updatedAt: cart.updated_at,
  };
}

async function createCart(env: NativeCartEnv, user: NativeSessionUser): Promise<CartRow> {
  const now = new Date().toISOString();
  const cart: CartRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO native_carts (id, user_id, status, source_imported_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, NULL, ?4, ?5)
     ON CONFLICT(user_id) DO NOTHING`,
  ).bind(cart.id, cart.user_id, cart.status, cart.created_at, cart.updated_at).run();
  const persisted = await env.DB.prepare('SELECT * FROM native_carts WHERE user_id = ?1')
    .bind(user.id).first<CartRow>();
  if (!persisted) throw new Error('NATIVE_CART_CREATE_FAILED');
  return persisted;
}

async function getOrCreateCart(env: NativeCartEnv, user: NativeSessionUser): Promise<CartRow> {
  const existing = await env.DB.prepare('SELECT * FROM native_carts WHERE user_id = ?1')
    .bind(user.id).first<CartRow>();
  if (existing) return existing;
  return createCart(env, user);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function recordBody(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function tryNativeCart(
  request: Request,
  env: NativeCartEnv,
  _proxyRequest: ProxyRequest,
  loadProduct: ProductLoader,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!/^\/api\/v1\/cart(?:\/|$)/.test(url.pathname)) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return error(401, 'UNAUTHORIZED', 'Authentication is required');
  const cart = await getOrCreateCart(env, user);

  if (url.pathname === '/api/v1/cart/discount' && request.method === 'POST') {
    const body = recordBody(await request.json().catch(() => null));
    if (typeof body.code !== 'string' || body.code.trim().length === 0) {
      return error(400, 'VALIDATION_ERROR', 'A discount code is required');
    }
    return error(
      503,
      'NATIVE_DISCOUNT_UNAVAILABLE',
      'No Cloudflare-native discount driver is configured for this store',
    );
  }

  if (url.pathname === '/api/v1/cart/discount' && request.method === 'DELETE') {
    return response(await renderCart(env, cart));
  }

  if (url.pathname === '/api/v1/cart' && request.method === 'GET') {
    return response(await renderCart(env, cart));
  }

  if (url.pathname === '/api/v1/cart' && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM native_cart_items WHERE cart_id = ?1').bind(cart.id).run();
    await env.DB.prepare('UPDATE native_carts SET updated_at = ?1 WHERE id = ?2')
      .bind(new Date().toISOString(), cart.id).run();
    return response(await renderCart(env, { ...cart, updated_at: new Date().toISOString() }));
  }

  if (url.pathname === '/api/v1/cart/items' && request.method === 'POST') {
    const body = recordBody(await request.json().catch(() => null));
    const requestedQuantity = body.quantity === undefined ? 1 : body.quantity;
    if (typeof body.productId !== 'string' || !isPositiveInteger(requestedQuantity)) {
      return error(400, 'VALIDATION_ERROR', 'A product ID and positive integer quantity are required');
    }
    if (body.variantId !== undefined && typeof body.variantId !== 'string') {
      return error(400, 'VALIDATION_ERROR', 'Variant ID must be a string');
    }
    const product = await loadProduct(body.productId);
    if (!product) return error(404, 'NOT_FOUND', 'Product not found');
    const variant = typeof body.variantId === 'string'
      ? product.variants.find((candidate) => candidate.id === body.variantId)
      : product.variants[0];
    if (!variant?.isActive) return error(400, 'BAD_REQUEST', 'Product or variant is not available');
    const quantity = requestedQuantity;
    const existing = await env.DB.prepare(
      'SELECT id, quantity FROM native_cart_items WHERE cart_id = ?1 AND product_id = ?2 AND variant_id = ?3',
    ).bind(cart.id, product.id, variant.id).first<{ id: string; quantity: number }>();
    const maxQuantity = product.productKind === 'goods' ? Math.max(0, variant.baseStock) : 999999;
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > maxQuantity) return error(400, 'BAD_REQUEST', 'Requested quantity exceeds available stock');
    const now = new Date().toISOString();
    if (existing) {
      await env.DB.prepare('UPDATE native_cart_items SET quantity = ?1, updated_at = ?2 WHERE id = ?3')
        .bind(nextQuantity, now, existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO native_cart_items
         (id, cart_id, product_id, product_name, product_image, product_kind, variant_id, variant_name,
          variant_attributes, price, quantity, max_quantity, fulfillment_data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
      ).bind(
        crypto.randomUUID(), cart.id, product.id, product.name, product.images?.[0] ?? '', product.productKind,
        variant.id, variant.name ?? null, variant.attributes ? JSON.stringify(variant.attributes) : null,
        variant.salePrice, quantity, maxQuantity,
        body.fulfillmentData && typeof body.fulfillmentData === 'object' ? JSON.stringify(body.fulfillmentData) : null,
        now, now,
      ).run();
    }
    await env.DB.prepare('UPDATE native_carts SET updated_at = ?1 WHERE id = ?2').bind(now, cart.id).run();
    return response(await renderCart(env, { ...cart, updated_at: now }), 201);
  }

  const itemMatch = url.pathname.match(/^\/api\/v1\/cart\/items\/([^/]+)$/);
  if (itemMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
    const itemId = itemMatch[1];
    const owned = await env.DB.prepare('SELECT id FROM native_cart_items WHERE id = ?1 AND cart_id = ?2')
      .bind(itemId, cart.id).first<{ id: string }>();
    if (!owned) return error(404, 'NOT_FOUND', 'Cart item not found');
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM native_cart_items WHERE id = ?1').bind(itemId).run();
    } else {
      const body = recordBody(await request.json().catch(() => null));
      if (!isPositiveInteger(body.quantity)) return error(400, 'VALIDATION_ERROR', 'Quantity must be a positive integer');
      const stock = await env.DB.prepare('SELECT max_quantity FROM native_cart_items WHERE id = ?1')
        .bind(itemId).first<{ max_quantity: number }>();
      if (stock && body.quantity > stock.max_quantity) return error(400, 'BAD_REQUEST', 'Requested quantity exceeds available stock');
      await env.DB.prepare('UPDATE native_cart_items SET quantity = ?1, updated_at = ?2 WHERE id = ?3')
        .bind(body.quantity, new Date().toISOString(), itemId).run();
    }
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE native_carts SET updated_at = ?1 WHERE id = ?2').bind(now, cart.id).run();
    return response(await renderCart(env, { ...cart, updated_at: now }));
  }

  return error(405, 'METHOD_NOT_ALLOWED', 'The requested cart operation is not supported');
}
