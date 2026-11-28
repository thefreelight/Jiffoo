import { authenticateNativeUser, type NativeAuthEnv, type NativeSessionUser } from './auth';
import { resolveActivePromotion } from './bokmoo-promotions';
import { affiliateScopeAllows, affiliateScopeMode as affiliateScopeModeOf, affiliateScopeOf, priceOrderDiscounts, type AffiliateBuyerDiscount } from './order-discounts';
import { getNativePluginConfig, getNativePluginSecret, getNativeStripeSecret } from './plugin-settings';
import { stripeCustomerEmail } from './stripe-form';
import { settleNativeWalletCheckout } from './native-wallet';
import { allocateOrderNumber, type OrderNumberEnv } from './order-numbers';
import { applyModuleRefundNotice } from './admin-writes';
import { NativePaymentError, nativePaymentModule, type NativePaymentModule, type NativePaymentNotice } from './native-plugin-modules/payments';

type CheckoutEnv = Pick<Cloudflare.Env,
  'DB' | 'JWT_SECRET' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'NATIVE_CHECKOUT_ENABLED'> & OrderNumberEnv & {
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
  payment_intent_id?: string | null;
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

// Internal order id (primary/foreign key). The customer-facing number is the
// separate human-readable orderNumber issued by allocateOrderNumber.
function internalOrderId(): string {
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
  const orderId = internalOrderId();
  // A promotion lands on the covered items' unit price, keeping the Stripe
  // charge, the order record and the apps equal. Promo codes double as buyer
  // discounts and affiliate attribution, and stack on top of the promotion.
  const affiliateCodeRaw = typeof body.affiliateCode === 'string' ? body.affiliateCode.trim().toUpperCase() : '';
  const affiliatePartner = affiliateCodeRaw
    ? await env.DB.prepare(
      `SELECT id, discount_rate, discount_type, scope_mode FROM native_affiliate_partners
       WHERE code = ?1 AND status = 'active' AND discount_rate > 0`,
    ).bind(affiliateCodeRaw).first<AffiliateBuyerDiscount & { scope_mode?: string | null }>()
    : null;
  // A code the store limited to certain products takes nothing off the other items.
  const affiliateScopeMode = affiliateScopeModeOf(affiliatePartner?.scope_mode);
  const affiliateScope = affiliateScopeOf(affiliateScopeMode, affiliatePartner && affiliateScopeMode !== 'all'
    ? (await env.DB.prepare('SELECT product_id FROM native_affiliate_partner_scope WHERE partner_id = ?1').bind(affiliatePartner.id).all<{ product_id: string }>()).results.map((row) => row.product_id)
    : []);
  const catalogSubtotal = resolved.reduce(
    (sum, { input, variant }) => sum + variant.salePrice * input.quantity, 0,
  );
  const promotion = await resolveActivePromotion(
    env,
    resolved.map(({ product }) => product.id),
    new Map(resolved.map(({ input, product }) => [product.id, input.quantity])),
    // Keyed by product id, like the two maps above: the resolver looks the
    // price up by product id, and a variant-keyed map made every promotion
    // look like it discounted nothing.
    new Map(resolved.map(({ product, variant }) => [product.id, variant.salePrice])),
    user.id,
  );
  const pricing = priceOrderDiscounts({
    items: resolved.map(({ input, product, variant }) => ({
      productId: product.id, variantId: variant.id, salePrice: variant.salePrice, quantity: input.quantity,
      eligible: affiliateScopeAllows(affiliateScope, product.id),
    })),
    promotion: promotion && promotion.discountAmount > 0 ? promotion.row : null,
    affiliate: affiliatePartner,
    scope: affiliateScope,
  });
  const { promotionDiscount, affiliateDiscount } = pricing;
  const appliedPromotion = promotionDiscount > 0 ? promotion : null;
  // A code that takes nothing off this order (nothing in the cart is in its reach) is not the order's partner.
  const appliedAffiliate = affiliatePartner && affiliateDiscount > 0 ? affiliatePartner : null;
  const discountAmount = Math.round((promotionDiscount + affiliateDiscount) * 100) / 100;
  const discountedUnit = pricing.unitPrices;
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
  // Reserved after every validation, so a rejected checkout never consumes a
  // number. Null keeps checkout available; the order is numbered on its first
  // read instead.
  const orderNumber = await allocateOrderNumber(env, now);
  const order: Record<string, unknown> = {
    id: orderId,
    ...(orderNumber ? { orderNumber } : {}),
    userId: user.id,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    subtotalAmount: catalogSubtotal,
    totalAmount: Math.round((catalogSubtotal + shippingAmount - discountAmount) * 100) / 100,
    discountAmount,
    shippingAmount,
    shippingMethod: requiresShipping ? shipping?.method_name ?? null : null,
    shippingProvider: requiresShipping ? shipping?.plugin_slug ?? null : null,
    appliedDiscounts: [
      ...(appliedPromotion
        ? [{ kind: 'promotion', id: appliedPromotion.row.id, slug: appliedPromotion.row.slug, amount: promotionDiscount }]
        : []),
      ...(appliedAffiliate
        ? [{ kind: 'affiliate', id: appliedAffiliate.id, amount: affiliateDiscount }]
        : []),
    ],
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
       (id, user_id, status, searchable_text, payload, source_updated_at, imported_at, order_number)
       VALUES (?1, ?2, 'PENDING', ?3, ?4, ?5, ?5, ?6)`,
    ).bind(orderId, user.id, searchable(order), JSON.stringify(order), now, orderNumber),
    env.DB.prepare(
      `INSERT INTO native_order_metadata
       (order_id, user_id, idempotency_key, payment_status, currency, total_amount, affiliate_partner_id, promotion_id)
       VALUES (?1, ?2, ?3, 'PENDING', ?4, ?5, ?6, ?7)`,
    ).bind(orderId, user.id, idempotencyKey, orderCurrency, order.totalAmount, appliedAffiliate?.id ?? null, appliedPromotion?.row.id ?? null),
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

const minorUnits = (amount: unknown): number => {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};

export interface StripeChargeLine {
  name: string;
  /** In the currency's minor unit, the way Stripe takes it. */
  unitAmount: number;
  quantity: number;
}

/**
 * Splits an amount over weights in whole minor units: the floor of each
 * proportional share, then the leftover units one each to the largest
 * remainders. The shares always add up to the amount.
 */
function splitByWeight(amount: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (amount * weight) / totalWeight);
  const shares = exact.map((share) => Math.floor(share));
  let left = amount - shares.reduce((sum, share) => sum + share, 0);
  exact
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || weights[b.index] - weights[a.index])
    .forEach(({ index }) => {
      if (left <= 0) return;
      shares[index]! += 1;
      left -= 1;
    });
  return shares;
}

/**
 * What the hosted Stripe page collects for an order: its total.
 *
 * A promotion already sits on the item unit prices. A promo (affiliate) code
 * is an order-level discount and a shipping fee stands beside the items, so
 * neither is in those unit prices; both are brought in here. Where an
 * order-level amount has to be spread, each item is one line that carries its
 * share in exact minor units ("Name × 2" for several of one item), so the
 * lines add up to the total whatever the quantities. Returns null for an
 * order whose total cannot be collected.
 */
export function stripeChargeLines(order: Record<string, unknown>): StripeChargeLine[] | null {
  const items = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  const listed = items.map((item) => ({
    name: String(item.productName ?? 'Jiffoo item'),
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    unitAmount: Math.max(1, minorUnits(item.unitPrice)),
  }));
  const listedAmount = listed.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
  const shipping = Math.max(0, minorUnits(order.shippingAmount));
  const total = Number(order.totalAmount);
  // Orders recorded before a total was kept on the order are collected item by item, as they always were.
  const payableItems = Number.isFinite(total) ? Math.max(0, minorUnits(total) - shipping) : listedAmount;

  const lines: StripeChargeLine[] = [];
  if (payableItems === listedAmount) {
    listed.forEach(({ name, unitAmount, quantity }) => lines.push({ name, unitAmount, quantity }));
  } else if (payableItems > 0) {
    const shares = splitByWeight(payableItems, listed.map((line) => line.unitAmount * line.quantity));
    if (shares.some((share) => (share ?? 0) <= 0)) {
      // A total too small to give every item a unit is collected as one line.
      lines.push({ name: `Order ${String(order.orderNumber ?? order.id)}`, unitAmount: payableItems, quantity: 1 });
    } else {
      listed.forEach(({ name, quantity }, index) => {
        lines.push({ name: quantity > 1 ? `${name} × ${quantity}` : name, unitAmount: shares[index]!, quantity: 1 });
      });
    }
  }
  if (shipping > 0) {
    lines.push({ name: String(order.shippingMethod || 'Shipping'), unitAmount: shipping, quantity: 1 });
  }
  return lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0) > 0 ? lines : null;
}

function encodeStripeForm(order: Record<string, unknown>, successUrl: string, cancelUrl: string, customerEmail: unknown): URLSearchParams {
  const form = new URLSearchParams({ mode: 'payment', success_url: successUrl, cancel_url: cancelUrl });
  const currency = String(order.currency ?? 'USD').toLowerCase();
  (stripeChargeLines(order) ?? []).forEach((line, index) => {
    form.set(`line_items[${index}][price_data][currency]`, currency);
    form.set(`line_items[${index}][price_data][product_data][name]`, line.name);
    form.set(`line_items[${index}][price_data][unit_amount]`, String(line.unitAmount));
    form.set(`line_items[${index}][quantity]`, String(line.quantity));
  });
  form.set('metadata[orderId]', String(order.id));
  form.set('payment_intent_data[metadata][orderId]', String(order.id));
  // The shopper gave their email with the order and is signed in: hand it to the
  // hosted page, which asks every shopper for one when it is given none. It stays
  // editable there.
  for (const [key, value] of Object.entries(stripeCustomerEmail(customerEmail))) form.set(key, value);
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
  if (!body || typeof body.orderId !== 'string') return null;
  // A payment method a compiled-in module takes is handled the way Stripe's is: the module opens its own page.
  const module = nativePaymentModule(body.paymentMethod);
  if (module) {
    return createModulePaymentSession(request, env, user, module, { orderId: body.orderId, successUrl: body.successUrl, cancelUrl: body.cancelUrl, idempotencyKey: body.idempotencyKey });
  }
  if (body.paymentMethod !== 'stripe') return null;
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
  // The hosted page collects the order total, as the in-page intent and the
  // Alipay / WeChat channels do; a total of nothing has nothing to collect.
  if (!stripeChargeLines(order)) return failure(409, 'INVALID_ORDER_TOTAL', 'Order total is not chargeable');
  const storefront = storefrontOrigin(request);
  // The order id rides along on the default return URL so the payment-result
  // page can locate the order straight from the address bar, even if its
  // session verification call ever fails again.
  const successUrl = typeof body.successUrl === 'string'
    ? body.successUrl
    : `${storefront}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${encodeURIComponent(body.orderId)}`;
  const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl : `${storefront}/checkout`;
  const secret = (await getNativeStripeSecret(env, 'secretKey', env.STRIPE_SECRET_KEY)).value;
  const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': idempotencyKey,
    },
    // the account's address as it is now, else the one the order was placed with
    body: encodeStripeForm(order, successUrl, cancelUrl, user.email?.trim() ? user.email : order.customerEmail),
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

// ── Payments through compiled-in plugin modules ─────────────────────────────
// A module that takes payments opens its own checkout page. The core keeps the
// session by the order — the module's own id only exists once that page is
// open — and that key rides back on the return URL, so the payment-result page
// can ask about the order. Everything around the page (settling the order once,
// refunds and their bookkeeping) is the core's, the same for every module.

type ModulePaymentSessionBody = { orderId: string; successUrl?: unknown; cancelUrl?: unknown; idempotencyKey?: unknown };

/** The return address with the session placeholder filled in; null unless it is an absolute https address. */
export function modulePaymentReturnUrl(raw: string, sessionId: string): string | null {
  const filled = raw.replaceAll('{CHECKOUT_SESSION_ID}', sessionId).replaceAll('{SESSION_ID}', sessionId);
  try {
    return new URL(filled).protocol === 'https:' ? filled : null;
  } catch {
    return null;
  }
}

function modulePaymentFailure(module: NativePaymentModule, error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof NativePaymentError ? error.code : 'GATEWAY_REJECTED';
  console.error(JSON.stringify({ message: 'Payment module request failed', module: module.id, code, error: message }));
  // The shopper's answer says only that the method cannot be used; the gateway's own words stay in the log.
  if (code === 'CURRENCY_UNSUPPORTED') return failure(400, 'CURRENCY_NOT_SUPPORTED', 'This payment method cannot charge the order\'s currency');
  if (code === 'INVALID_ORDER_TOTAL') return failure(409, 'INVALID_ORDER_TOTAL', 'Order total is not chargeable');
  if (code === 'NOT_CONFIGURED') return failure(503, 'PAYMENT_METHOD_NOT_CONFIGURED', 'This payment method is not configured on this store');
  return failure(502, 'PAYMENT_PLUGIN_FAILED', 'This payment method could not open its checkout page');
}

async function createModulePaymentSession(
  request: Request,
  env: CheckoutEnv,
  user: NativeSessionUser,
  module: NativePaymentModule,
  body: ModulePaymentSessionBody,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT snapshots.payload, metadata.total_amount, metadata.currency, metadata.payment_status
     FROM native_order_snapshots snapshots JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1 AND snapshots.user_id = ?2`,
  ).bind(body.orderId, user.id).first<OrderSnapshotRow>();
  if (!row) return failure(404, 'NOT_FOUND', 'Order not found');
  if (row.payment_status === 'PAID') return failure(409, 'ORDER_ALREADY_PAID', 'Order is already paid');
  const plugin = await getNativePluginConfig(env, module.id);
  // The shopper's answer says only that the method is off; which setting is
  // missing is for the administrator's settings page, not the checkout.
  if (!plugin?.enabled) return failure(503, 'PAYMENT_METHOD_NOT_AVAILABLE', 'This payment method is not available on this store');
  // The storefront lists a method only while the module can use its settings; checkout refuses it the same way.
  if (module.paymentMethod && !(await module.paymentMethod(plugin.config))) {
    return failure(503, 'PAYMENT_METHOD_NOT_AVAILABLE', 'This payment method is not available on this store');
  }
  const sessionId = `${module.id}_${body.orderId}`;
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : `order:${body.orderId}:${module.id}`;
  const existing = await env.DB.prepare(
    'SELECT id, session_url, expires_at FROM native_payment_sessions WHERE idempotency_key = ?1',
  ).bind(idempotencyKey).first<{ id: string; session_url: string; expires_at: string }>();
  // A page that has not run out is handed back, so a checkout that was
  // abandoned and reopened continues the same payment.
  if (existing && Date.parse(existing.expires_at) > Date.now()) {
    return success({ sessionId: existing.id, url: existing.session_url, expiresAt: existing.expires_at });
  }
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  const amountMinor = Math.round(Number(row.total_amount) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return failure(409, 'INVALID_ORDER_TOTAL', 'Order total is not chargeable');
  const successUrl = modulePaymentReturnUrl(
    typeof body.successUrl === 'string' ? body.successUrl : '',
    sessionId,
  );
  // A module's page lives outside the store, so it needs a return address; the app scheme that closes the in-app browser is not one it can use.
  if (!successUrl) return failure(400, 'VALIDATION_ERROR', 'successUrl must be an absolute https address');
  const cancelUrl = typeof body.cancelUrl === 'string' && body.cancelUrl.trim() ? body.cancelUrl.trim() : `${storefrontOrigin(request)}/checkout`;
  let checkout;
  try {
    checkout = await module.payments.createCheckout(plugin.config, {
      orderId: body.orderId,
      amountMinor,
      currency: String(row.currency ?? order.currency ?? 'USD').toUpperCase(),
      successUrl,
      cancelUrl,
      // This store's own route for the module's deliveries, on the host the shopper's client called.
      notifyUrl: `${new URL(request.url).origin}/api/v1/payments/webhook/${module.id}`,
      buyerEmail: user.email?.trim()
        ? user.email
        : typeof order.customerEmail === 'string' && order.customerEmail.trim() ? order.customerEmail : null,
      // A page that ran out needs a new one; the same key would only return the old one.
      idempotencyKey: existing ? `${idempotencyKey}:${Date.now()}` : idempotencyKey,
    });
  } catch (error) {
    return modulePaymentFailure(module, error);
  }
  const now = new Date().toISOString();
  const expiresAt = checkout.expiresAt ?? new Date(Date.now() + 86400 * 1000).toISOString();
  await env.DB.batch([
    ...(existing ? [env.DB.prepare('DELETE FROM native_payment_sessions WHERE id = ?1').bind(existing.id)] : []),
    env.DB.prepare(
      `INSERT INTO native_payment_sessions
       (id, order_id, user_id, provider, idempotency_key, session_url, payment_intent_id, status, expires_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'PENDING', ?8, ?9, ?9)`,
    ).bind(sessionId, body.orderId, user.id, module.id, idempotencyKey, checkout.url, checkout.providerSessionId, expiresAt, now),
  ]);
  return success({ sessionId, url: checkout.url, expiresAt }, 201);
}

export type ModulePaymentSettlement = {
  provider: string;
  orderId: string;
  paymentId: string | null;
  amountMinor: number | null;
  currency: string | null;
};

/**
 * Marks an order paid through a module. The order settles once: the event row
 * is claimed in the same batch as everything it triggers, so a delivery and a
 * lookup that agree, or two deliveries of one event, change nothing the second
 * time.
 */
export async function settleModulePayment(
  env: Pick<CheckoutEnv, 'DB'>,
  payment: ModulePaymentSettlement,
): Promise<'settled' | 'duplicate' | 'unknown-order' | 'amount-mismatch'> {
  const row = await env.DB.prepare(
    `SELECT snapshots.payload, snapshots.user_id, metadata.total_amount, metadata.currency, metadata.payment_status
     FROM native_order_snapshots snapshots JOIN native_order_metadata metadata ON metadata.order_id = snapshots.id
     WHERE snapshots.id = ?1`,
  ).bind(payment.orderId).first<{ payload: string; user_id: string; total_amount: number; currency: string; payment_status: string }>();
  if (!row) return 'unknown-order';
  if (row.payment_status === 'PAID') return 'duplicate';
  // Anti-underpayment guard. It applies only to an amount the module reports in
  // the order's own currency: a shopper who paid in their local currency was
  // charged a converted amount this store has no rate to check against.
  const expectedMinor = Math.round(Number(row.total_amount) * 100);
  const sameCurrency = payment.currency === null || payment.currency.toUpperCase() === String(row.currency).toUpperCase();
  if (payment.amountMinor !== null && sameCurrency && Math.abs(payment.amountMinor - expectedMinor) > 0) {
    console.error(JSON.stringify({
      message: 'Module payment differs from the order total',
      provider: payment.provider, orderId: payment.orderId, chargedMinor: payment.amountMinor, expectedMinor,
    }));
    return 'amount-mismatch';
  }
  const order = JSON.parse(row.payload) as Record<string, unknown>;
  const now = new Date().toISOString();
  Object.assign(order, { status: 'PAID', paymentStatus: 'PAID', updatedAt: now });
  const sessionId = `${payment.provider}_${payment.orderId}`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO native_payment_events (provider_event_id, provider, event_type, received_at)
         VALUES (?1, ?2, 'payment.succeeded', ?3)`,
      ).bind(`${payment.provider}:paid:${payment.orderId}`, payment.provider, now),
      // The module's payment id is what a refund is asked against.
      env.DB.prepare(
        "UPDATE native_payment_sessions SET status = 'SUCCEEDED', payment_intent_id = COALESCE(?1, payment_intent_id), updated_at = ?2 WHERE order_id = ?3 AND provider = ?4",
      ).bind(payment.paymentId, now, payment.orderId, payment.provider),
      env.DB.prepare("UPDATE native_order_metadata SET payment_status = 'PAID' WHERE order_id = ?1").bind(payment.orderId),
      env.DB.prepare("UPDATE native_order_snapshots SET status = 'PAID', payload = ?1, source_updated_at = ?2 WHERE id = ?3")
        .bind(JSON.stringify(order), now, payment.orderId),
      env.DB.prepare(
        `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
         VALUES (?1, 'payment.succeeded', ?2, ?3, ?4)`,
      ).bind(crypto.randomUUID(), payment.orderId, JSON.stringify({ orderId: payment.orderId, sessionId, provider: payment.provider, paymentId: payment.paymentId }), now),
      // The buyer's pull channel in the apps (no APNs); the event claim above is what keeps it to one.
      env.DB.prepare(
        `INSERT INTO native_bokmoo_notifications (id, user_id, type, title, body, metadata_json, created_at)
         VALUES (?1, ?2, 'order', ?3, ?4, ?5, ?6)`,
      ).bind(
        crypto.randomUUID(),
        row.user_id,
        'Payment confirmed',
        `Order ${payment.orderId} has been paid. We are preparing it for delivery.`,
        JSON.stringify({ orderId: payment.orderId, sessionId, provider: payment.provider }),
        now,
      ),
    ]);
  } catch (error) {
    // Only the event claim can conflict, and it conflicts for a payment that was already settled.
    if (error instanceof Error && /UNIQUE constraint failed: .*native_payment_events/.test(error.message)) return 'duplicate';
    throw error;
  }
  return 'settled';
}

type ModulePaymentResult = { received: true; handled: boolean; applied: boolean; duplicate: boolean; normalizedStatus: string };

/** Answers a delivery the way the module's gateway reads an answer. */
function modulePaymentAck(module: NativePaymentModule, accepted: boolean, result?: ModulePaymentResult): Response {
  // Some gateways take anything but the bare word as a failed delivery and would send it again.
  if (module.payments.webhookAck === 'text') return new Response(accepted ? 'success' : 'fail', { status: accepted ? 200 : 400 });
  return accepted ? success(result) : failure(400, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook could not be verified');
}

async function handleModulePaymentWebhook(request: Request, env: CheckoutEnv, module: NativePaymentModule): Promise<Response> {
  const plugin = await getNativePluginConfig(env, module.id);
  const rawBody = await request.text();
  let notice: NativePaymentNotice;
  try {
    notice = await module.payments.readWebhook(plugin?.config ?? {}, {
      rawBody,
      headers: Object.fromEntries(request.headers.entries()),
    });
  } catch (error) {
    // Fail closed: without a verification key nothing a delivery says is trusted either.
    console.error(JSON.stringify({ message: 'Payment module webhook refused', module: module.id, error: error instanceof Error ? error.message : String(error) }));
    return modulePaymentAck(module, false);
  }
  const provider = module.id;
  const received = (result: Omit<ModulePaymentResult, 'received'>): Response => modulePaymentAck(module, true, { received: true, ...result });
  if (notice.kind === 'ignored') return received({ handled: false, applied: false, duplicate: false, normalizedStatus: 'ignored' });
  if (notice.kind === 'refund') {
    const outcome = await applyModuleRefundNotice(env, notice);
    return received({ handled: outcome !== 'unknown', applied: outcome === 'completed', duplicate: false, normalizedStatus: outcome === 'failed' ? 'failed' : 'succeeded' });
  }
  // A payment that did not go through leaves the order as it is; the shopper may pay again.
  if (notice.status !== 'succeeded') return received({ handled: false, applied: false, duplicate: false, normalizedStatus: 'failed' });
  let orderId = notice.orderId;
  if (!orderId && notice.providerSessionId) {
    // The module's own session id is the second way to the order.
    const session = await env.DB.prepare('SELECT order_id FROM native_payment_sessions WHERE payment_intent_id = ?1 AND provider = ?2')
      .bind(notice.providerSessionId, provider).first<{ order_id: string }>();
    orderId = session?.order_id ?? '';
  }
  if (!orderId) return received({ handled: false, applied: false, duplicate: false, normalizedStatus: 'ignored' });
  const outcome = await settleModulePayment(env, {
    provider, orderId, paymentId: notice.paymentId, amountMinor: notice.amountMinor, currency: notice.currency,
  });
  return received({
    handled: outcome === 'settled' || outcome === 'duplicate',
    applied: outcome === 'settled',
    duplicate: outcome === 'duplicate',
    normalizedStatus: outcome === 'amount-mismatch' || outcome === 'unknown-order' ? 'ignored' : 'succeeded',
  });
}

async function verifyPaymentSession(env: CheckoutEnv, user: NativeSessionUser, sessionId: string): Promise<Response | null> {
  const payment = await env.DB.prepare('SELECT * FROM native_payment_sessions WHERE id = ?1 AND user_id = ?2')
    .bind(sessionId, user.id).first<PaymentSessionRow>();
  if (!payment) return null;
  let status = payment.status;
  // A session a compiled-in module opened reports nothing back, and its webhook can trail the
  // shopper: ask the module before answering that the order is still unpaid.
  const module = nativePaymentModule(payment.provider);
  if (module && status === 'PENDING') status = await refreshModulePaymentSession(env, module, payment);
  return success({
    sessionId,
    orderId: payment.order_id,
    status: status === 'SUCCEEDED' ? 'paid' : status.toLowerCase(),
    paymentMethod: payment.provider,
  });
}

/** Asks the module about a session this store still shows as unpaid; the session's status afterwards. */
async function refreshModulePaymentSession(env: CheckoutEnv, module: NativePaymentModule, payment: PaymentSessionRow): Promise<string> {
  try {
    const plugin = await getNativePluginConfig(env, module.id);
    if (!plugin?.enabled) return payment.status;
    const fact = await module.payments.lookup(plugin.config, {
      orderId: payment.order_id,
      providerSessionId: payment.payment_intent_id ?? null,
    });
    if (fact?.status === 'succeeded') {
      await settleModulePayment(env, {
        provider: module.id, orderId: payment.order_id, paymentId: fact.paymentId, amountMinor: null, currency: null,
      });
    }
  } catch (error) {
    // The lookup only saves the shopper a moment; the webhook is what settles the order for good.
    console.warn(JSON.stringify({ message: 'Payment module lookup failed', module: module.id, orderId: payment.order_id, error: error instanceof Error ? error.message : String(error) }));
  }
  const current = await env.DB.prepare('SELECT status FROM native_payment_sessions WHERE id = ?1')
    .bind(payment.id).first<{ status: string }>();
  return current?.status ?? payment.status;
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
  const moduleWebhook = url.pathname.match(/^\/api\/v1\/payments\/webhook\/([a-z0-9][a-z0-9-]{0,63})$/);
  const module = moduleWebhook ? nativePaymentModule(moduleWebhook[1]) : null;
  if (module && request.method === 'POST') return handleModulePaymentWebhook(request, env, module);
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
    || (/^\/api\/v1\/payments\/sessions\/[^/]+$/.test(url.pathname) && request.method === 'GET')
    // The spelling the storefront's payment-result page actually calls.
    // Without it the request fell through to the legacy backend, which knows
    // nothing about the session and answers "pending / unknown" with no
    // orderId — leaving the success page unable to find the order.
    || (/^\/api\/v1\/payments\/verify\/[^/]+$/.test(url.pathname) && request.method === 'GET');
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
