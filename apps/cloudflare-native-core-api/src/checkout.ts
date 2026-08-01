import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';
import { getNativePluginSecret } from './plugin-settings';

type CheckoutEnv = Pick<Cloudflare.Env,
  'DB' | 'JWT_SECRET' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'NATIVE_CHECKOUT_ENABLED'>;

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
  variants: ProductVariant[];
}

interface OrderItemInput {
  productId: string;
  variantId: string;
  quantity: number;
  expectedUnitPrice?: number;
  fulfillmentData?: Record<string, unknown> | null;
}

interface CreateOrderInput {
  items?: unknown;
  shippingAddress?: Record<string, unknown> | null;
  customerEmail?: string;
  idempotencyKey?: string;
}

interface OrderSnapshotRow {
  payload: string;
  total_amount: number;
  currency: string;
  payment_status: string;
}

interface PaymentSessionRow {
  id: string;
  order_id: string;
  session_url: string;
  expires_at: string;
  status: string;
  provider: string;
}

type ProductLoader = (productId: string) => Promise<ProductDetail | null>;

function success(data: unknown, status = 200, runtime = 'cloudflare-native-d1-checkout'): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': runtime } });
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-checkout' },
  });
}

function isOrderItem(value: unknown): value is OrderItemInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.productId === 'string' && typeof item.variantId === 'string'
    && typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity > 0
    && (item.expectedUnitPrice === undefined || (typeof item.expectedUnitPrice === 'number' && item.expectedUnitPrice >= 0));
}

function orderNumber(): string {
  return `ord_${Date.now().toString(36)}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function searchable(order: Record<string, unknown>): string {
  const items = Array.isArray(order.items) ? order.items : [];
  return [order.id, ...items.map((item) => typeof item === 'object' && item !== null && 'productName' in item
    ? String((item as { productName: unknown }).productName)
    : '')].join(' ').toLowerCase();
}

async function existingIdempotentOrder(env: CheckoutEnv, userId: string, key: string): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare(
    `SELECT snapshots.payload FROM native_order_metadata metadata
     JOIN native_order_snapshots snapshots ON snapshots.id = metadata.order_id
     WHERE metadata.user_id = ?1 AND metadata.idempotency_key = ?2`,
  ).bind(userId, key).first<{ payload: string }>();
  return row ? JSON.parse(row.payload) as Record<string, unknown> : null;
}

async function createOrder(
  request: Request,
  env: CheckoutEnv,
  user: NativeSessionUser,
  loadProduct: ProductLoader,
): Promise<Response> {
  const body = await request.json<CreateOrderInput>().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0 || !body.items.every(isOrderItem)) {
    return failure(400, 'VALIDATION_ERROR', 'At least one valid order item is required');
  }
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim().slice(0, 255)
    : null;
  if (idempotencyKey) {
    const existing = await existingIdempotentOrder(env, user.id, idempotencyKey);
    if (existing) return success(existing, 201);
  }

  const resolved = [];
  for (const input of body.items) {
    const product = await loadProduct(input.productId);
    const variant = product?.variants.find((candidate) => candidate.id === input.variantId);
    if (!product || !variant?.isActive) return failure(404, 'NOT_FOUND', 'Product or variant is not available');
    if (input.expectedUnitPrice !== undefined && Math.abs(input.expectedUnitPrice - variant.salePrice) > 0.000001) {
      return failure(409, 'PRICE_CHANGED', 'A product price changed before checkout');
    }
    if (product.productKind === 'goods' && variant.baseStock < input.quantity) {
      return failure(409, 'INSUFFICIENT_STOCK', 'A product no longer has enough stock');
    }
    resolved.push({ input, product, variant });
  }

  const now = new Date().toISOString();
  const orderId = orderNumber();
  const items = resolved.map(({ input, product, variant }) => ({
    id: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    productKind: product.productKind,
    variantId: variant.id,
    variantName: variant.name ?? null,
    variantAttributes: variant.attributes ?? null,
    quantity: input.quantity,
    unitPrice: variant.salePrice,
    totalPrice: variant.salePrice * input.quantity,
    fulfillmentStatus: 'pending',
    fulfillmentData: input.fulfillmentData ?? null,
    currency: 'USD',
  }));
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const shipping = await env.DB.prepare(
    'SELECT shipping_amount, method_name, plugin_slug FROM native_shipping_selections WHERE user_id = ?1',
  ).bind(user.id).first<{ shipping_amount: number; method_name: string; plugin_slug: string }>();
  const requiresShipping = items.some((item) => item.productKind === 'goods' || item.productKind === 'consumable');
  const shippingAmount = requiresShipping ? shipping?.shipping_amount ?? 0 : 0;
  const order: Record<string, unknown> = {
    id: orderId,
    userId: user.id,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    subtotalAmount: subtotal,
    totalAmount: subtotal + shippingAmount,
    discountAmount: 0,
    shippingAmount,
    shippingMethod: requiresShipping ? shipping?.method_name ?? null : null,
    shippingProvider: requiresShipping ? shipping?.plugin_slug ?? null : null,
    appliedDiscounts: [],
    currency: 'USD',
    shippingAddress: body.shippingAddress ?? null,
    customerEmail: user.email,
    items,
    createdAt: now,
    updatedAt: now,
    cancelReason: null,
    cancelledAt: null,
  };

  for (const { product, variant } of resolved) {
    await env.DB.prepare(
      `INSERT INTO native_inventory (product_id, variant_id, source_stock, refreshed_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(product_id, variant_id) DO UPDATE SET
         source_stock = excluded.source_stock,
         refreshed_at = excluded.refreshed_at`,
    ).bind(product.id, variant.id, product.productKind === 'goods' ? variant.baseStock : 2147483647, now).run();
  }

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO native_order_snapshots
       (id, user_id, status, searchable_text, payload, source_updated_at, imported_at)
       VALUES (?1, ?2, 'PENDING', ?3, ?4, ?5, ?5)`,
    ).bind(orderId, user.id, searchable(order), JSON.stringify(order), now),
    env.DB.prepare(
      `INSERT INTO native_order_metadata
       (order_id, user_id, idempotency_key, payment_status, currency, total_amount)
       VALUES (?1, ?2, ?3, 'PENDING', 'USD', ?4)`,
    ).bind(orderId, user.id, idempotencyKey, subtotal + shippingAmount),
  ];
  for (let index = 0; index < resolved.length; index += 1) {
    const { input, product, variant } = resolved[index]!;
    const item = items[index]!;
    const reservationId = crypto.randomUUID();
    statements.push(env.DB.prepare(
      `INSERT INTO native_inventory_reservations
       (id, order_id, product_id, variant_id, quantity, active, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, 1, ?6
       WHERE (SELECT source_stock FROM native_inventory WHERE product_id = ?3 AND variant_id = ?4)
         - COALESCE((SELECT SUM(quantity) FROM native_inventory_reservations
                     WHERE product_id = ?3 AND variant_id = ?4 AND active = 1), 0) >= ?5`,
    ).bind(reservationId, orderId, product.id, variant.id, input.quantity, now));
    statements.push(env.DB.prepare(
      `INSERT INTO native_order_items
       (id, order_id, reservation_id, product_id, variant_id, quantity, unit_price, payload)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(item.id, orderId, reservationId, product.id, variant.id, input.quantity, variant.salePrice, JSON.stringify(item)));
  }
  statements.push(env.DB.prepare(
    `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
     VALUES (?1, 'order.created', ?2, ?3, ?4)`,
  ).bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, userId: user.id }), now));
  try {
    await env.DB.batch(statements);
  } catch (error: unknown) {
    if (idempotencyKey) {
      const existing = await existingIdempotentOrder(env, user.id, idempotencyKey);
      if (existing) return success(existing, 201);
    }
    console.error(JSON.stringify({
      message: 'native order transaction failed',
      error: error instanceof Error ? error.message : String(error),
      orderId,
    }));
    return failure(409, 'INSUFFICIENT_STOCK', 'Stock changed before the order could be reserved');
  }
  const cart = await env.DB.prepare('SELECT id FROM native_carts WHERE user_id = ?1').bind(user.id).first<{ id: string }>();
  if (cart) await env.DB.prepare('DELETE FROM native_cart_items WHERE cart_id = ?1').bind(cart.id).run();
  return success(order, 201);
}

async function cancelOrder(request: Request, env: CheckoutEnv, user: NativeSessionUser, orderId: string): Promise<Response | null> {
  const row = await env.DB.prepare(
    `SELECT snapshots.payload, metadata.payment_status FROM native_order_snapshots snapshots
     JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1 AND snapshots.user_id = ?2`,
  ).bind(orderId, user.id).first<{ payload: string; payment_status: string }>();
  if (!row) return null;
  if (row.payment_status === 'PAID') return failure(409, 'ORDER_ALREADY_PAID', 'Paid orders cannot be cancelled here');
  const body = await request.json<{ cancelReason?: unknown }>().catch(() => null);
  if (!body || typeof body.cancelReason !== 'string' || !body.cancelReason.trim()) {
    return failure(400, 'VALIDATION_ERROR', 'Cancellation reason is required');
  }
  const now = new Date().toISOString();
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  Object.assign(order, { status: 'CANCELLED', cancelReason: body.cancelReason.trim(), cancelledAt: now, updatedAt: now });
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE native_order_snapshots SET status = 'CANCELLED', payload = ?1, source_updated_at = ?2 WHERE id = ?3`,
    ).bind(JSON.stringify(order), now, orderId),
    env.DB.prepare(
      `UPDATE native_order_metadata SET cancelled_at = ?1, cancel_reason = ?2 WHERE order_id = ?3`,
    ).bind(now, body.cancelReason.trim(), orderId),
    env.DB.prepare('UPDATE native_inventory_reservations SET active = 0 WHERE order_id = ?1').bind(orderId),
    env.DB.prepare(
      `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
       VALUES (?1, 'order.cancelled', ?2, ?3, ?4)`,
    ).bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, userId: user.id }), now),
  ]);
  return success(order);
}

function encodeStripeForm(order: Record<string, unknown>, successUrl: string, cancelUrl: string): URLSearchParams {
  const form = new URLSearchParams({ mode: 'payment', success_url: successUrl, cancel_url: cancelUrl });
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  items.forEach((item, index) => {
    form.set(`line_items[${index}][price_data][currency]`, String(order.currency ?? 'USD').toLowerCase());
    form.set(`line_items[${index}][price_data][product_data][name]`, String(item.productName ?? 'Jiffoo item'));
    form.set(`line_items[${index}][price_data][unit_amount]`, String(Math.round(Number(item.unitPrice) * 100)));
    form.set(`line_items[${index}][quantity]`, String(item.quantity));
  });
  form.set('metadata[orderId]', String(order.id));
  form.set('payment_intent_data[metadata][orderId]', String(order.id));
  return form;
}

async function createPaymentSession(request: Request, env: CheckoutEnv, user: NativeSessionUser): Promise<Response | null> {
  const body = await request.json<{ paymentMethod?: unknown; orderId?: unknown; successUrl?: unknown; cancelUrl?: unknown; idempotencyKey?: unknown }>().catch(() => null);
  if (!body || body.paymentMethod !== 'stripe' || typeof body.orderId !== 'string') return null;
  const row = await env.DB.prepare(
    `SELECT snapshots.payload, metadata.total_amount, metadata.currency, metadata.payment_status
     FROM native_order_snapshots snapshots JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1 AND snapshots.user_id = ?2`,
  ).bind(body.orderId, user.id).first<OrderSnapshotRow>();
  if (!row) return null;
  if (row.payment_status === 'PAID') return failure(409, 'ORDER_ALREADY_PAID', 'Order is already paid');
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : `order:${body.orderId}:stripe`;
  const existing = await env.DB.prepare(
    'SELECT * FROM native_payment_sessions WHERE idempotency_key = ?1',
  ).bind(idempotencyKey).first<PaymentSessionRow>();
  if (existing) return success({ sessionId: existing.id, url: existing.session_url, expiresAt: existing.expires_at }, 200);
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  const successUrl = typeof body.successUrl === 'string' ? body.successUrl : 'https://shop.jiffoo.com/payment/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl : 'https://shop.jiffoo.com/checkout';
  const secret = await getNativePluginSecret(env, 'stripe', 'secretKey', env.STRIPE_SECRET_KEY);
  const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': idempotencyKey,
    },
    body: encodeStripeForm(order, successUrl, cancelUrl),
  });
  const payload = await stripe.json<{ id?: string; url?: string; expires_at?: number; payment_intent?: string; error?: { message?: string } }>();
  if (!stripe.ok || !payload.id || !payload.url) {
    console.error(JSON.stringify({
      message: 'Stripe checkout session failed',
      status: stripe.status,
      error: payload.error?.message ?? 'invalid response',
      orderId: body.orderId,
    }));
    return failure(502, 'PAYMENT_PLUGIN_FAILED', 'Stripe could not create a checkout session');
  }
  const now = new Date().toISOString();
  const expiresAt = new Date((payload.expires_at ?? Math.floor(Date.now() / 1000) + 86400) * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO native_payment_sessions
     (id, order_id, user_id, provider, idempotency_key, session_url, payment_intent_id, status, expires_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'stripe', ?4, ?5, ?6, 'PENDING', ?7, ?8, ?8)`,
  ).bind(payload.id, body.orderId, user.id, idempotencyKey, payload.url, payload.payment_intent ?? null, expiresAt, now).run();
  return success({ sessionId: payload.id, url: payload.url, expiresAt }, 201);
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function equal(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

async function verifyStripeSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(',').map((part) => part.split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean) as string[];
  if (!timestamp || signatures.length === 0 || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`)));
  for (const candidate of signatures) {
    if (await equal(signature, candidate)) return true;
  }
  return false;
}

async function handleStripeWebhook(request: Request, env: CheckoutEnv): Promise<Response | null> {
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');
  const secret = await getNativePluginSecret(env, 'stripe', 'webhookSecret', env.STRIPE_WEBHOOK_SECRET);
  if (!signature || !await verifyStripeSignature(raw, signature, secret)) {
    return failure(400, 'INVALID_WEBHOOK_SIGNATURE', 'Stripe webhook signature is invalid');
  }
  const event = (() => {
    try {
      return JSON.parse(raw) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    } catch {
      return null;
    }
  })();
  if (!event) return failure(400, 'INVALID_WEBHOOK', 'Stripe webhook payload is invalid');
  if (!event.id || !event.type) return failure(400, 'INVALID_WEBHOOK', 'Stripe webhook payload is invalid');
  const object = event.data?.object ?? {};
  const metadata = object.metadata && typeof object.metadata === 'object' ? object.metadata as Record<string, unknown> : {};
  const orderId = typeof metadata.orderId === 'string' ? metadata.orderId : null;
  const sessionId = typeof object.id === 'string' ? object.id : null;
  if (!sessionId || !orderId) return null;
  const nativeSession = await env.DB.prepare(
    'SELECT id FROM native_payment_sessions WHERE id = ?1 AND order_id = ?2',
  ).bind(sessionId, orderId).first<{ id: string }>();
  if (!nativeSession) return null;
  const existing = await env.DB.prepare('SELECT provider_event_id FROM native_payment_events WHERE provider_event_id = ?1')
    .bind(event.id).first<{ provider_event_id: string }>();
  if (existing) return success({ received: true, handled: true, applied: false, duplicate: true, normalizedStatus: 'succeeded' });
  const paid = (event.type === 'checkout.session.completed' && object.payment_status === 'paid')
    || event.type === 'checkout.session.async_payment_succeeded';
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [env.DB.prepare(
    `INSERT INTO native_payment_events (provider_event_id, provider, event_type, received_at)
     VALUES (?1, 'stripe', ?2, ?3)`,
  ).bind(event.id, event.type, now)];
  if (paid) {
    const row = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1').bind(orderId).first<{ payload: string }>();
    if (row) {
      const order = JSON.parse(row.payload) as Record<string, unknown>;
      Object.assign(order, { status: 'PAID', paymentStatus: 'PAID', updatedAt: now });
      statements.push(
        env.DB.prepare("UPDATE native_payment_sessions SET status = 'SUCCEEDED', updated_at = ?1 WHERE id = ?2").bind(now, sessionId),
        env.DB.prepare("UPDATE native_order_metadata SET payment_status = 'PAID' WHERE order_id = ?1").bind(orderId),
        env.DB.prepare("UPDATE native_order_snapshots SET status = 'PAID', payload = ?1, source_updated_at = ?2 WHERE id = ?3").bind(JSON.stringify(order), now, orderId),
        env.DB.prepare(
          `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
           VALUES (?1, 'payment.succeeded', ?2, ?3, ?4)`,
        ).bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, sessionId }), now),
      );
    }
  }
  await env.DB.batch(statements);
  return success({ received: true, handled: true, applied: paid && Boolean(orderId), duplicate: false, normalizedStatus: paid ? 'succeeded' : 'ignored' });
}

async function verifyPaymentSession(env: CheckoutEnv, user: NativeSessionUser, sessionId: string): Promise<Response | null> {
  const payment = await env.DB.prepare('SELECT * FROM native_payment_sessions WHERE id = ?1 AND user_id = ?2')
    .bind(sessionId, user.id).first<PaymentSessionRow>();
  if (!payment) return null;
  return success({
    sessionId,
    orderId: payment.order_id,
    status: payment.status === 'SUCCEEDED' ? 'paid' : payment.status.toLowerCase(),
    paymentMethod: payment.provider,
  });
}

export async function tryNativeCheckout(
  request: Request,
  env: CheckoutEnv,
  loadProduct: ProductLoader,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/v1/payments/webhook/stripe' && request.method === 'POST') {
    return handleStripeWebhook(request.clone(), env);
  }
  const relevant = (url.pathname === '/api/v1/orders' && request.method === 'POST')
    || (/^\/api\/v1\/orders\/[^/]+\/cancel$/.test(url.pathname) && request.method === 'POST')
    || (url.pathname === '/api/v1/payments/sessions' && request.method === 'POST')
    || (/^\/api\/v1\/payments\/sessions\/[^/]+$/.test(url.pathname) && request.method === 'GET');
  if (!relevant) return null;
  if (String(env.NATIVE_CHECKOUT_ENABLED) !== 'true') return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return null;
  if (url.pathname === '/api/v1/orders' && request.method === 'POST') return createOrder(request, env, user, loadProduct);
  const cancel = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/cancel$/);
  if (cancel) return cancelOrder(request, env, user, cancel[1]);
  if (url.pathname === '/api/v1/payments/sessions') return createPaymentSession(request, env, user);
  const verify = url.pathname.match(/^\/api\/v1\/payments\/sessions\/([^/]+)$/);
  return verify ? verifyPaymentSession(env, user, verify[1]) : null;
}
