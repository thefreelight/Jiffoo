import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';
import { resolveActivePromotion } from './bokmoo-promotions';
import { getNativePluginConfig, getNativePluginSecret, getNativeStripeSecret } from './plugin-settings';
import { settleNativeWalletCheckout } from './native-wallet';

type CheckoutEnv = Pick<Cloudflare.Env,
  'DB' | 'JWT_SECRET' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'NATIVE_CHECKOUT_ENABLED'> & {
  // chfastpay easy-pay channel (owner-provided aggregate Alipay/WeChat gateway).
  // Configured as plain vars/secret on the deployed instance, not present in
  // the generated worker types.
  EPAY_GATEWAY?: string;
  EPAY_PID?: string;
  EPAY_KEY?: string;
  // Easy-pay gateways charge in CNY while the storefront prices in USD.
  // The conversion rate is Owner-controlled (wrangler var), never fetched
  // live, so session and notify amounts are computed identically.
  EPAY_USD_CNY_RATE?: string;
};

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
  /** Billing currency (ISO 4217) — BOSS eSIM plans are CNY. */
  currency?: string;
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
  locale?: string;
  affiliateCode?: string;
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

export function success(data: unknown, status = 200, runtime = 'cloudflare-native-d1-checkout'): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': runtime } });
}

export function failure(status: number, code: string, message: string): Response {
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

const SHIPPING_ADDRESS_REQUIRED_FIELDS = ['name', 'phone', 'line1', 'city', 'country'] as const;
const SHIPPING_ADDRESS_OPTIONAL_FIELDS = ['state', 'postalCode', 'line2'] as const;
const SHIPPING_ADDRESS_FIELDS = [...SHIPPING_ADDRESS_REQUIRED_FIELDS, ...SHIPPING_ADDRESS_OPTIONAL_FIELDS] as const;

export type NormalizedShippingAddress = Record<(typeof SHIPPING_ADDRESS_FIELDS)[number], string>;

/** Accepts the client address payload; returns a trimmed address or null when
 *  a required field is missing/blank (null = caller must reject the order for
 *  physical goods). State/province and postal code are optional — many real
 *  addresses (and Chinese checkout habits) leave them blank or merged into
 *  the street line. */
export function normalizeShippingAddress(raw: unknown): NormalizedShippingAddress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  // The web checkout sends firstName/lastName/addressLine1; the address book
  // and the app send name/line1. Accept both shapes for every alias field.
  const read = (field: string): string => {
    const value = typeof source[field] === 'string' ? (source[field] as string).trim() : '';
    if (value) return value;
    if (field === 'name') {
      const firstName = typeof source.firstName === 'string' ? (source.firstName as string).trim() : '';
      const lastName = typeof source.lastName === 'string' ? (source.lastName as string).trim() : '';
      return `${firstName} ${lastName}`.trim();
    }
    if (field === 'line1') {
      return typeof source.addressLine1 === 'string' ? (source.addressLine1 as string).trim() : '';
    }
    return '';
  };
  const address: Record<string, string> = {};
  for (const field of SHIPPING_ADDRESS_REQUIRED_FIELDS) {
    const value = read(field);
    if (!value) return null;
    address[field] = value;
  }
  for (const field of SHIPPING_ADDRESS_OPTIONAL_FIELDS) {
    const value = typeof source[field] === 'string' ? (source[field] as string).trim() : '';
    if (value) address[field] = value;
  }
  if (address.country.length !== 2 || address.country !== address.country.toUpperCase()) {
    address.country = address.country.toUpperCase();
  }
  return address as NormalizedShippingAddress;
}

export function checkoutLocale(request: Request, explicitLocale?: string): 'zh-CN' | 'en' {
  const candidate = explicitLocale?.trim() || request.headers.get('accept-language') || '';
  return candidate.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
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
  // Campaign promotion: the single best active promotion replaces the
  // affiliate discount (no stacking) and lands on the covered items' unit
  // price, keeping the Stripe charge, the order record and the apps equal.
  // Promo codes double as buyer discounts and affiliate attribution.
  const affiliateCodeRaw = typeof body.affiliateCode === 'string' ? body.affiliateCode.trim().toUpperCase() : '';
  const affiliatePartner = affiliateCodeRaw
    ? await env.DB.prepare(
      `SELECT id, discount_rate FROM native_affiliate_partners
       WHERE code = ?1 AND status = 'active' AND discount_rate > 0`,
    ).bind(affiliateCodeRaw).first<{ id: string; discount_rate: number }>()
    : null;
  const catalogSubtotal = resolved.reduce(
    (sum, { input, variant }) => sum + variant.salePrice * input.quantity, 0,
  );
  const promotion = await resolveActivePromotion(
    env,
    resolved.map(({ product }) => product.id),
    new Map(resolved.map(({ input, product }) => [product.id, input.quantity])),
    new Map(resolved.map(({ variant }) => [variant.id, variant.salePrice])),
    user.id,
  );
  const affiliateDiscount = affiliatePartner
    ? Math.min(catalogSubtotal, Math.round(catalogSubtotal * affiliatePartner.discount_rate) / 100)
    : 0;
  const appliedPromotion = promotion && promotion.discountAmount > 0 && promotion.discountAmount >= affiliateDiscount
    ? promotion : null;
  const discountAmount = appliedPromotion
    ? Math.min(appliedPromotion.discountAmount, catalogSubtotal)
    : affiliateDiscount;
  const discountedUnit = new Map<string, number>();
  if (appliedPromotion) {
    for (const { product, variant } of resolved) {
      const covered = !appliedPromotion.row.product_ids_json
        || (() => { try { return (JSON.parse(appliedPromotion.row.product_ids_json!) as string[]).includes(product.id); } catch { return false; } })();
      if (!covered) continue;
      const perUnit = appliedPromotion.row.discount_type === 'percent'
        ? Math.round(variant.salePrice * appliedPromotion.row.discount_value) / 100
        : Math.min(appliedPromotion.row.discount_value, Math.max(variant.salePrice - 0.01, 0));
      discountedUnit.set(variant.id, Math.max(variant.salePrice - Math.min(perUnit, variant.salePrice), 0.01));
    }
  }
  // eSIM reuse: an authenticated buyer may pin the order to an already
  // provisioned eSIM (ICCID) so the BOSS hook tops up that profile instead
  // of paying a fresh provisioning fee. Validated loosely; the BOSS hook
  // re-checks ownership semantics upstream.
  const bodyRecord = body as { esimIccid?: unknown };
  const esimIccidRaw = typeof bodyRecord?.esimIccid === 'string' ? bodyRecord.esimIccid.trim() : '';
  // BOSS v4 asset ids may be short numeric ids (doc example 76010150).
  const esimIccid = /^\d{6,22}$/.test(esimIccidRaw) ? esimIccidRaw : '';

  const items = resolved.map(({ input, product, variant }) => {
    const unitPrice = discountedUnit.get(variant.id) ?? variant.salePrice;
    return {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      productKind: product.productKind,
      variantId: variant.id,
      variantName: variant.name ?? null,
      variantAttributes: variant.attributes ?? null,
      quantity: input.quantity,
      unitPrice,
      totalPrice: unitPrice * input.quantity,
      fulfillmentStatus: 'pending',
      fulfillmentData: esimIccid
        ? { ...(input.fulfillmentData ?? {}), esimIccid }
        : input.fulfillmentData ?? null,
      // legacy catalog rows without a currency settle in USD.
      currency: product.currency || 'USD',
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const shipping = await env.DB.prepare(
    'SELECT shipping_amount, method_name, plugin_slug FROM native_shipping_selections WHERE user_id = ?1',
  ).bind(user.id).first<{ shipping_amount: number; method_name: string; plugin_slug: string }>();
  const requiresShipping = items.some((item) => item.productKind === 'goods' || item.productKind === 'consumable');
  const shippingAmount = requiresShipping ? shipping?.shipping_amount ?? 0 : 0;
  // A single order settles in one currency: multi-currency carts (e.g. a
  // CNY eSIM plan plus a USD physical card) must be checked out separately.
  const itemCurrencies = [...new Set(items.map((item) => item.currency))];
  if (itemCurrencies.length > 1) {
    return failure(400, 'MIXED_CURRENCY_CART', 'This cart contains items in different currencies. Please check out in one currency at a time.');
  }
  const orderCurrency = itemCurrencies[0] ?? 'USD';

  // Physical goods are shipped after payment: a complete delivery address is
  // mandatory, otherwise the customer can never receive the product.
  const shippingAddress = normalizeShippingAddress(body.shippingAddress);
  if (requiresShipping && !shippingAddress) {
    return failure(400, 'SHIPPING_ADDRESS_REQUIRED', 'A complete shipping address is required for physical products');
  }
  const order: Record<string, unknown> = {
    id: orderId,
    userId: user.id,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    subtotalAmount: catalogSubtotal,
    totalAmount: catalogSubtotal + shippingAmount - discountAmount,
    discountAmount,
    shippingAmount,
    shippingMethod: requiresShipping ? shipping?.method_name ?? null : null,
    shippingProvider: requiresShipping ? shipping?.plugin_slug ?? null : null,
    appliedDiscounts: appliedPromotion
      ? [{ kind: 'promotion', id: appliedPromotion.row.id, slug: appliedPromotion.row.slug, amount: discountAmount }]
      : (affiliatePartner ? [{ kind: 'affiliate', id: affiliatePartner.id, amount: discountAmount }] : []),
    currency: orderCurrency,
    shippingAddress: shippingAddress ?? body.shippingAddress ?? null,
    customerEmail: user.email,
    locale: checkoutLocale(request, body.locale),
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
       (order_id, user_id, idempotency_key, payment_status, currency, total_amount, affiliate_partner_id, promotion_id)
       VALUES (?1, ?2, ?3, 'PENDING', ?4, ?5, ?6, ?7)`,
    ).bind(orderId, user.id, idempotencyKey, orderCurrency, catalogSubtotal + shippingAmount - discountAmount, affiliatePartner?.id ?? null, appliedPromotion?.row.id ?? null),
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
    ).bind(item.id, orderId, reservationId, product.id, variant.id, input.quantity, item.unitPrice, JSON.stringify(item)));
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
  // The order already carries the delivery address (required for physical
  // goods at order creation), so bind it to the PaymentIntent instead of
  // making the shopper re-enter it on the hosted page. Digital orders have
  // no address and need none.
  const address = (order.shippingAddress && typeof order.shippingAddress === 'object'
    && !Array.isArray(order.shippingAddress)) ? order.shippingAddress as Record<string, unknown> : null;
  const field = (key: string) => (typeof address?.[key] === 'string' ? (address[key] as string).trim() : '');
  if (address && field('name') && field('line1') && field('country')) {
    form.set('payment_intent_data[shipping][name]', field('name'));
    if (field('phone')) form.set('payment_intent_data[shipping][phone]', field('phone'));
    form.set('payment_intent_data[shipping][address][line1]', field('line1'));
    if (field('line2')) form.set('payment_intent_data[shipping][address][line2]', field('line2'));
    form.set('payment_intent_data[shipping][address][city]', field('city'));
    if (field('state')) form.set('payment_intent_data[shipping][address][state]', field('state'));
    if (field('postalCode')) form.set('payment_intent_data[shipping][address][postal_code]', field('postalCode'));
    form.set('payment_intent_data[shipping][address][country]', field('country').toUpperCase());
  }
  return form;
}

/**
 * Payment result URLs must return the shopper to the storefront that started
 * the checkout. Explicit body URLs win; otherwise the request Origin is the
 * storefront itself. Only headless callers with no browser origin fall back to
 * the shared default shop host.
 */
export function storefrontOrigin(request: Request): string {
  const origin = request.headers.get('origin')?.trim();
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return url.origin;
      }
    } catch { /* malformed Origin header */ }
  }
  return 'https://shop.jiffoo.com';
}

const STALE_RESERVATION_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Release inventory reservations held by orders that were created but never
 * paid or cancelled. Every checkout reserves one unit per item; without this,
 * abandoned checkouts silently exhaust stock for goods products and all
 * later orders fail with INSUFFICIENT_STOCK. Runs on the worker cron; if a
 * stale order somehow pays after release, the paid-order handler still
 * settles it (it no longer decrements stock for that unit).
 */
export async function releaseStaleInventoryReservations(
  env: Pick<CheckoutEnv, 'DB'>,
  now: number = Date.now(),
): Promise<{ released: number }> {
  const cutoff = new Date(now - STALE_RESERVATION_AFTER_MS).toISOString();
  const result = await env.DB.prepare(
    `UPDATE native_inventory_reservations SET active = 0
     WHERE active = 1
       AND created_at < ?1
       AND order_id IN (
         SELECT r.order_id FROM native_inventory_reservations r
         JOIN native_order_metadata metadata ON metadata.order_id = r.order_id
         WHERE r.active = 1 AND metadata.payment_status = 'PENDING'
       )`,
  ).bind(cutoff).run();
  return { released: result.meta.changes ?? 0 };
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
  const storefront = storefrontOrigin(request);
  const successUrl = typeof body.successUrl === 'string'
    ? body.successUrl
    : `${storefront}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl : `${storefront}/checkout`;
  const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
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

/**
 * Native-app PaymentSheet support: create a Stripe PaymentIntent for an order
 * so the mobile clients can confirm in-app (client_secret) instead of opening
 * the hosted checkout page. The intent carries metadata[orderId] so the
 * existing stripe webhook settles the order through payment_intent.succeeded.
 */
async function createPaymentIntent(request: Request, env: CheckoutEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ orderId?: unknown; idempotencyKey?: unknown }>().catch(() => null);
  if (!body || typeof body.orderId !== 'string' || !body.orderId.trim()) {
    return failure(400, 'VALIDATION_ERROR', 'orderId is required');
  }
  const row = await env.DB.prepare(
    `SELECT snapshots.payload, metadata.total_amount, metadata.currency, metadata.payment_status
     FROM native_order_snapshots snapshots JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1 AND snapshots.user_id = ?2`,
  ).bind(body.orderId, user.id).first<OrderSnapshotRow>();
  if (!row) return failure(404, 'NOT_FOUND', 'Order not found');
  if (row.payment_status === 'PAID') return failure(409, 'ORDER_ALREADY_PAID', 'Order is already paid');
  // Mainland-China / Chinese-language shoppers used to be gated to hosted
  // Checkout here (WeChat Pay/Alipay are redirect wallets that only render on
  // the hosted page, plus CNY adaptive pricing). Owner decision 2026-11-13:
  // the browser hop makes card payment unusable on mainland phones — every
  // shopper gets the native PaymentSheet (cards + Apple Pay/Google Pay wake
  // in-app); wallet-scan shoppers use the chfastpay easy-pay channel instead.
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? `intent:${body.idempotencyKey.trim()}`
    : `order:${body.orderId}:stripe-intent`;
  const amount = Math.round(Number(row.total_amount) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    return failure(409, 'INVALID_ORDER_TOTAL', 'Order total is not chargeable');
  }
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  const orderCurrency = String(order.currency ?? 'USD').toUpperCase();
  // The bokmoo Stripe account cannot present CNY; CNY orders settle on the
  // Alipay/WeChat (epay) rails instead. Fail loudly so the storefront can
  // route the customer to the CNY payment methods.
  if (orderCurrency !== 'USD') {
    return failure(400, 'CURRENCY_NOT_SUPPORTED', `Stripe checkout is unavailable for ${orderCurrency} orders. Please pay with Alipay or WeChat Pay.`);
  }
  const shippingAddress = normalizeShippingAddress(order.shippingAddress);
  const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
  const form = new URLSearchParams({
    amount: String(amount),
    currency: String(row.currency ?? order.currency ?? 'USD').toLowerCase(),
    'automatic_payment_methods[enabled]': 'true',
    'metadata[orderId]': String(order.id),
  });
  if (shippingAddress) {
    form.set('shipping[name]', shippingAddress.name);
    form.set('shipping[phone]', shippingAddress.phone);
    form.set('shipping[address][line1]', shippingAddress.line1);
    if (shippingAddress.line2) form.set('shipping[address][line2]', shippingAddress.line2);
    form.set('shipping[address][city]', shippingAddress.city);
    form.set('shipping[address][state]', shippingAddress.state);
    form.set('shipping[address][postal_code]', shippingAddress.postalCode);
    form.set('shipping[address][country]', shippingAddress.country);
  }
  const stripe = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': idempotencyKey,
    },
    body: form,
  });
  const payload = await stripe.json<{ id?: string; client_secret?: string; error?: { message?: string } }>();
  if (!stripe.ok || !payload.id || !payload.client_secret) {
    console.error(JSON.stringify({
      message: 'Stripe payment intent failed',
      status: stripe.status,
      error: payload.error?.message ?? 'invalid response',
      orderId: body.orderId,
    }));
    return failure(502, 'PAYMENT_PLUGIN_FAILED', 'Stripe could not create a payment intent');
  }
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO native_payment_sessions
     (id, order_id, user_id, provider, idempotency_key, session_url, payment_intent_id, status, expires_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'stripe', ?4, 'paymentsheet://stripe', ?5, 'PENDING', ?6, ?7, ?7)
     ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
  ).bind(payload.id, body.orderId, user.id, idempotencyKey, payload.id, expiresAt, now).run();
  // PaymentSheet on mobile initializes from the account publishable key.
  const stripeConfig = await getNativePluginConfig(env, 'stripe');
  const stripeMode = stripeConfig?.config.mode === 'live' ? 'live' : 'test';
  const modeKey = stripeConfig?.config[`${stripeMode}PublishableKey`];
  const publishableKey = typeof modeKey === 'string' && modeKey
    ? modeKey
    : (typeof stripeConfig?.config.publishableKey === 'string' ? stripeConfig.config.publishableKey as string : '');
  return success({
    intentId: payload.id,
    clientSecret: payload.client_secret,
    publishableKey,
    status: payload.client_secret ? 'requires_payment_method' : null,
  }, 201);
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
  const secretConfig = await getNativeStripeSecret(env, 'webhookSecret', env.STRIPE_WEBHOOK_SECRET);
  const secret = secretConfig.value;
  if (!signature || !await verifyStripeSignature(raw, signature, secret)) {
    return failure(400, 'INVALID_WEBHOOK_SIGNATURE', 'Stripe webhook signature is invalid');
  }
  const event = (() => {
    try {
      return JSON.parse(raw) as { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
    } catch {
      return null;
    }
  })();
  if (!event) return failure(400, 'INVALID_WEBHOOK', 'Stripe webhook payload is invalid');
  if (!event.id || !event.type) return failure(400, 'INVALID_WEBHOOK', 'Stripe webhook payload is invalid');
  if (typeof event.livemode === 'boolean' && event.livemode !== (secretConfig.mode === 'live')) return failure(400, 'INVALID_WEBHOOK_MODE', 'Stripe webhook mode does not match active mode');
  const object = event.data?.object ?? {};
  const metadata = object.metadata && typeof object.metadata === 'object' ? object.metadata as Record<string, unknown> : {};
  const orderId = typeof metadata.orderId === 'string' ? metadata.orderId : null;
  const sessionId = typeof object.id === 'string' ? object.id : null;
  const paid = (event.type === 'checkout.session.completed' && object.payment_status === 'paid')
    || event.type === 'checkout.session.async_payment_succeeded'
    // Native PaymentSheet confirmations settle through the intent lifecycle.
    || (event.type === 'payment_intent.succeeded' && object.status === 'succeeded');
  if (sessionId && !orderId && paid && typeof metadata.walletCheckoutId === 'string') {
    const settled = await settleNativeWalletCheckout(env, metadata, sessionId);
    return success({ received: true, handled: Boolean(settled), applied: Boolean(settled), duplicate: false, normalizedStatus: settled ? 'succeeded' : 'ignored' });
  }
  if (!sessionId || !orderId) return null;
  const nativeSession = await env.DB.prepare(
    'SELECT id FROM native_payment_sessions WHERE id = ?1 AND order_id = ?2',
  ).bind(sessionId, orderId).first<{ id: string }>();
  if (!nativeSession) return null;
  const existing = await env.DB.prepare('SELECT provider_event_id FROM native_payment_events WHERE provider_event_id = ?1')
    .bind(event.id).first<{ provider_event_id: string }>();
  if (existing) return success({ received: true, handled: true, applied: false, duplicate: true, normalizedStatus: 'succeeded' });
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [env.DB.prepare(
    `INSERT INTO native_payment_events (provider_event_id, provider, event_type, received_at)
     VALUES (?1, 'stripe', ?2, ?3)`,
  ).bind(event.id, event.type, now)];
  if (paid) {
    const row = await env.DB.prepare('SELECT payload, user_id FROM native_order_snapshots WHERE id = ?1').bind(orderId).first<{ payload: string; user_id: string }>();
    if (row) {
      const order = JSON.parse(row.payload) as Record<string, unknown>;
      // Hosted-checkout sync: when the buyer entered the delivery address on
      // the Stripe page (or left it to Stripe's collector), write it back
      // into the order so fulfillment and the App can see it.
      if (!order.shippingAddress) {
        const shipping = (object.shipping ?? null) as Record<string, unknown> | null;
        const stripeAddress = (shipping?.address ?? null) as Record<string, unknown> | null;
        if (stripeAddress && typeof shipping?.name === 'string' && shipping.name.trim()) {
          order.shippingAddress = {
            name: shipping.name.trim(),
            phone: typeof shipping.phone === 'string' ? shipping.phone.trim() : '',
            line1: String(stripeAddress.line1 ?? '').trim(),
            line2: String(stripeAddress.line2 ?? '').trim(),
            city: String(stripeAddress.city ?? '').trim(),
            state: String(stripeAddress.state ?? '').trim(),
            postalCode: String(stripeAddress.postal_code ?? '').trim(),
            country: String(stripeAddress.country ?? 'CN').trim().toUpperCase(),
          };
          Object.assign(order, { updatedAt: now });
          statements.push(
            env.DB.prepare('UPDATE native_order_snapshots SET payload = ?1, source_updated_at = ?2 WHERE id = ?3')
              .bind(JSON.stringify(order), now, orderId),
          );
        }
      }
      Object.assign(order, { status: 'PAID', paymentStatus: 'PAID', updatedAt: now });
      statements.push(
        env.DB.prepare("UPDATE native_payment_sessions SET status = 'SUCCEEDED', updated_at = ?1 WHERE id = ?2").bind(now, sessionId),
        env.DB.prepare("UPDATE native_order_metadata SET payment_status = 'PAID' WHERE order_id = ?1").bind(orderId),
        env.DB.prepare("UPDATE native_order_snapshots SET status = 'PAID', payload = ?1, source_updated_at = ?2 WHERE id = ?3").bind(JSON.stringify(order), now, orderId),
        env.DB.prepare(
          `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
           VALUES (?1, 'payment.succeeded', ?2, ?3, ?4)`,
        ).bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, sessionId, providerEventId: event.id }), now),
        // In-app receipt notification: the apps' notifications page is the
        // buyer's pull channel (no APNs); dedup rides the webhook event-id
        // guard above, so one settled event yields exactly one notification.
        env.DB.prepare(
          `INSERT INTO native_bokmoo_notifications (id, user_id, type, title, body, metadata_json, created_at)
           VALUES (?1, ?2, 'order', ?3, ?4, ?5, ?6)`,
        ).bind(
          crypto.randomUUID(),
          row.user_id,
          'Payment confirmed',
          `Order ${orderId} has been paid. We are preparing it for delivery.`,
          JSON.stringify({ orderId, sessionId, providerEventId: event.id }),
          now,
        ),
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

// ── chfastpay easy-pay channel (aggregated Alipay/WeChat for mainland
// shoppers) ── Rainbow easy-pay protocol: redirect the shopper to the gateway
// submit.php with md5-signed params; the gateway calls notify_url (GET) with
// the same signature scheme and expects a literal "success" body.

function epayConfigured(env: CheckoutEnv): boolean {
  return Boolean(env.EPAY_GATEWAY && env.EPAY_PID && env.EPAY_KEY);
}

const EPAY_DEFAULT_USD_CNY_RATE = 7.2;

/**
 * Easy-pay cashiers charge CNY. Convert the order total deterministically:
 * USD orders multiply by the configured rate, CNY orders pass through, and
 * any other currency is unsupported (the gateway cannot settle it).
 */
function epayCnyAmount(totalAmount: number, currency: string, env: CheckoutEnv): string | null {
  if (currency === 'CNY') return totalAmount.toFixed(2);
  if (currency !== 'USD') return null;
  const rate = Number(env.EPAY_USD_CNY_RATE ?? '') || EPAY_DEFAULT_USD_CNY_RATE;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return (Math.round(totalAmount * rate * 100) / 100).toFixed(2);
}

async function md5Hex(input: string): Promise<string> {
  // Cloudflare Workers' subtle.digest supports MD5 for legacy gateway signing.
  const digest = await crypto.subtle.digest('MD5', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Rainbow easy-pay signature: sorted `k=v&…` + key, md5 hex. */
async function epaySign(params: Record<string, string>, key: string): Promise<string> {
  const filtered = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
    .sort();
  const plain = `${filtered.map((k) => `${k}=${params[k]}`).join('&')}${key}`;
  return md5Hex(plain);
}

async function createEpaySession(request: Request, env: CheckoutEnv, user: NativeSessionUser): Promise<Response | null> {
  try {
    return await createEpaySessionInner(request, env, user);
  } catch (error) {
    // Never crash the worker (1101): surface gateway/DB failures as JSON.
    return failure(500, 'EPAY_SESSION_ERROR', error instanceof Error ? error.message : String(error));
  }
}

async function createEpaySessionInner(request: Request, env: CheckoutEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.json<{ orderId?: unknown; payType?: unknown }>().catch(() => null);
  if (!body || typeof body.orderId !== 'string' || !body.orderId.trim()) {
    return failure(400, 'VALIDATION_ERROR', 'orderId is required');
  }
  const payType = typeof body.payType === 'string' && ['alipay', 'wxpay', 'qqpay'].includes(body.payType)
    ? body.payType
    : 'alipay';
  if (!epayConfigured(env)) {
    return failure(503, 'EPAY_NOT_CONFIGURED', 'Easy-pay channel is not configured');
  }
  const row = await env.DB.prepare(
    `SELECT snapshots.payload, metadata.total_amount, metadata.currency, metadata.payment_status
     FROM native_order_snapshots snapshots JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1 AND snapshots.user_id = ?2`,
  ).bind(body.orderId, user.id).first<OrderSnapshotRow>();
  if (!row) return failure(404, 'NOT_FOUND', 'Order not found');
  if (row.payment_status === 'PAID') return failure(409, 'ORDER_ALREADY_PAID', 'Order is already paid');
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  const productName = String(items[0]?.productName ?? `BOKMOO order ${body.orderId}`).slice(0, 120);
  const gateway = String(env.EPAY_GATEWAY).replace(/\/+$/, '');
  // The gateway server calls this URL from outside — it must be the public
  // API host, not the storefront origin (which is the buyer-facing site).
  const notifyUrl = 'https://api.bokmoo.com/api/v1/payments/webhook/epay';
  const orderCurrency = String(row.currency ?? 'USD').toUpperCase();
  const money = epayCnyAmount(Number(row.total_amount ?? 0), orderCurrency, env);
  if (!money) {
    return failure(503, 'EPAY_CURRENCY_UNSUPPORTED', `Easy-pay cannot settle ${orderCurrency} orders`);
  }
  const params: Record<string, string> = {
    pid: String(env.EPAY_PID),
    type: payType,
    out_trade_no: String(body.orderId),
    notify_url: notifyUrl,
    return_url: `${storefrontOrigin(request)}/payment/success?orderId=${encodeURIComponent(String(body.orderId))}`,
    name: productName,
    // The gateway charges CNY; USD totals convert at the configured rate.
    money,
    // mapi.php requires the shopper IP; submit.php is 404 on this gateway.
    clientip: request.headers.get('cf-connecting-ip') ?? '127.0.0.1',
  };
  params.sign = await epaySign(params, String(env.EPAY_KEY));
  let gatewayResponse: Response;
  try {
    gatewayResponse = await fetch(`${gateway}/mapi.php`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, sign_type: 'MD5' }).toString(),
    });
  } catch (gatewayError) {
    // Surface the transport failure instead of crashing the worker (1101).
    return failure(502, 'EPAY_GATEWAY_ERROR', `Easy-pay gateway unreachable: ${gatewayError instanceof Error ? gatewayError.message : String(gatewayError)}`);
  }
  if (!gatewayResponse.ok) {
    return failure(502, 'EPAY_GATEWAY_ERROR', `Easy-pay gateway returned ${gatewayResponse.status}`);
  }
  const result = await gatewayResponse.json<{ code?: number; msg?: string; payurl?: string; qrcode?: string; urlscheme?: string }>().catch(() => null);
  if (!result || result.code !== 1) {
    return failure(502, 'EPAY_GATEWAY_ERROR', result?.msg ?? 'Easy-pay gateway rejected the request');
  }
  const payUrl = result.payurl ?? result.qrcode ?? result.urlscheme ?? '';
  if (!payUrl) {
    return failure(502, 'EPAY_GATEWAY_ERROR', 'Easy-pay gateway returned no payment URL');
  }
  const now = new Date().toISOString();
  // Gateway casher pages stay valid for a day, same default as Stripe sessions.
  const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO native_payment_sessions (id, order_id, user_id, provider, idempotency_key, session_url, payment_intent_id, status, expires_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'epay', ?4, ?5, NULL, 'PENDING', ?6, ?7, ?7)
     ON CONFLICT(idempotency_key) DO NOTHING`,
  ).bind(
    `epay_${body.orderId}_${payType}`,
    body.orderId,
    user.id,
    `order:${body.orderId}:epay:${payType}`,
    payUrl,
    expiresAt,
    now,
  ).run();
  return success({ route: 'epay', payUrl, orderId: body.orderId, payType, amount: money, currency: 'CNY' });
}

async function handleEpayNotify(request: Request, env: CheckoutEnv): Promise<Response> {
  if (!epayConfigured(env)) return new Response('fail: not configured', { status: 503 });
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => { params[key] = value; });
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    form?.forEach((value, key) => { if (!params[key]) params[key] = String(value); });
  }
  const sign = params.sign ?? '';
  const expected = await epaySign(params, String(env.EPAY_KEY));
  if (!sign || sign.toLowerCase() !== expected.toLowerCase()) {
    return new Response('fail: bad sign', { status: 400 });
  }
  const orderId = params.out_trade_no ?? '';
  const tradeNo = params.trade_no ?? '';
  const paid = (params.trade_status ?? '').toUpperCase() === 'TRADE_SUCCESS';
  if (!orderId || !paid) return new Response('success');
  const duplicate = await env.DB.prepare(
    'SELECT provider_event_id FROM native_payment_events WHERE provider_event_id = ?1',
  ).bind(`epay:${tradeNo}:${orderId}`).first<{ provider_event_id: string }>();
  if (duplicate) return new Response('success');
  const row = await env.DB.prepare('SELECT payload, user_id FROM native_order_snapshots WHERE id = ?1').bind(orderId).first<{ payload: string; user_id: string }>();
  if (!row) return new Response('success');
  const now = new Date().toISOString();
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  // Anti-underpayment guard: the gateway charges CNY, so recompute what the
  // session should have charged and refuse to settle mismatches (a tampered
  // or drifted notify must never mark a $20 order PAID for ¥20).
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  const orderTotalUsd = Number(order.totalAmount ?? items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0));
  const expectedCny = epayCnyAmount(orderTotalUsd, String(order.currency ?? 'USD').toUpperCase(), env);
  const paidMoney = Number(params.money ?? NaN);
  if (expectedCny === null || !Number.isFinite(paidMoney) || Math.abs(paidMoney - Number(expectedCny)) > 0.05) {
    return new Response('fail: amount mismatch', { status: 400 });
  }
  Object.assign(order, { status: 'PAID', paymentStatus: 'PAID', updatedAt: now });
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO native_payment_events (provider_event_id, provider, event_type, received_at)
       VALUES (?1, 'epay', 'trade_success', ?2)`,
    ).bind(`epay:${tradeNo}:${orderId}`, now),
    env.DB.prepare("UPDATE native_order_metadata SET payment_status = 'PAID' WHERE order_id = ?1").bind(orderId),
    env.DB.prepare("UPDATE native_order_snapshots SET status = 'PAID', payload = ?1, source_updated_at = ?2 WHERE id = ?3").bind(JSON.stringify(order), now, orderId),
    env.DB.prepare(
      `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
       VALUES (?1, 'payment.succeeded', ?2, ?3, ?4)`,
    ).bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId, tradeNo, provider: 'epay' }), now),
    env.DB.prepare(
      `INSERT INTO native_bokmoo_notifications (id, user_id, type, title, body, metadata_json, created_at)
       VALUES (?1, ?2, 'order', ?3, ?4, ?5, ?6)`,
    ).bind(
      crypto.randomUUID(),
      row.user_id,
      'Payment confirmed',
      `Order ${orderId} has been paid. We are preparing it for delivery.`,
      JSON.stringify({ orderId, tradeNo, provider: 'epay' }),
      now,
    ),
  ]);
  return new Response('success');
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
  if (url.pathname === '/api/v1/payments/webhook/epay' && (request.method === 'GET' || request.method === 'POST')) {
    return handleEpayNotify(request, env);
  }
  if (url.pathname === '/api/v1/payments/epay/session' && request.method === 'POST') {
    if (String(env.NATIVE_CHECKOUT_ENABLED) !== 'true') return null;
    const user = await authenticateNativeUser(request, env);
    if (!user) return null;
    return createEpaySession(request, env, user);
  }
  const relevant = (url.pathname === '/api/v1/orders' && request.method === 'POST')
    || (/^\/api\/v1\/orders\/[^/]+\/cancel$/.test(url.pathname) && request.method === 'POST')
    || ((url.pathname === '/api/v1/payments/sessions' || url.pathname === '/api/v1/payments/create-session') && request.method === 'POST')
    || (url.pathname === '/api/v1/payments/intents' && request.method === 'POST')
    || (/^\/api\/v1\/payments\/sessions\/[^/]+$/.test(url.pathname) && request.method === 'GET');
  if (!relevant) return null;
  if (String(env.NATIVE_CHECKOUT_ENABLED) !== 'true') return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return null;
  if (url.pathname === '/api/v1/orders' && request.method === 'POST') return createOrder(request, env, user, loadProduct);
  const cancel = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/cancel$/);
  if (cancel) return cancelOrder(request, env, user, cancel[1]);
  if (url.pathname === '/api/v1/payments/sessions' || url.pathname === '/api/v1/payments/create-session') {
    // '/create-session' is the storefront contract spelling
    // (shared API_ENDPOINTS.CART/checkout + remoteradar workspace modal);
    // '/sessions' is the original native spelling. Same handler, one contract.
    return createPaymentSession(request, env, user);
  }
  if (url.pathname === '/api/v1/payments/intents') return createPaymentIntent(request, env, user);
  const verify = url.pathname.match(/^\/api\/v1\/payments\/sessions\/([^/]+)$/);
  if (verify) return verifyPaymentSession(env, user, verify[1]);
  // Legacy shop-client path: /payments/verify/:sessionId
  const legacyVerify = url.pathname.match(/^\/api\/v1\/payments\/verify\/([^/]+)$/);
  if (legacyVerify) return verifyPaymentSession(env, user, legacyVerify[1]);
  return null;
}
