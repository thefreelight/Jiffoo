import { authenticateNativeAdmin, authenticateNativeUser, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';
import { applyNativeSubscriptionRedemption } from './native-subscription';

type CouponEnv = NativeAuthEnv & { DB: D1Database };

// Checkout resolves catalog products through a D1-authoritative loader
// (index.ts loadProduct); redemption uses the same source so a code can only
// grant products the storefront can actually sell.
export interface RedemptionProduct {
  id: string;
  name: string;
  productKind?: string;
  variants?: Array<{
    id: string;
    name?: string | null;
    isActive?: boolean;
    salePrice?: number;
    baseStock?: number;
    attributes?: Record<string, unknown> | null;
  }>;
}

export type RedemptionProductLoader = (productId: string) => Promise<RedemptionProduct | null>;

function reply(data: unknown, status = 200): Response {
  return Response.json(status < 400 ? { success: true, data } : { success: false, error: data }, { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-coupon' } });
}

interface RedemptionCodeRow {
  id: string;
  code: string;
  plan_slug: string;
  plan_name: string;
  duration_days: number;
}

interface ProductRedemptionCodeRow {
  id: string;
  code: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
}

interface ProductRedemptionClaimRow {
  code_id: string;
  user_id: string;
  order_id: string | null;
  applied_at: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

async function createRedemptionCode(request: Request, env: CouponEnv): Promise<Response> {
  if (!(await authenticateNativeAdmin(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Administrator authentication is required' }, 401);
  const body = await request.json<{ code?: string; planSlug?: string; planName?: string; durationDays?: number; expiresAt?: string }>().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const planSlug = typeof body?.planSlug === 'string' ? body.planSlug.trim().toLowerCase() : '';
  const planName = typeof body?.planName === 'string' ? body.planName.trim() : '';
  const durationDays = Number(body?.durationDays);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code) || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(planSlug) || !planName || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return reply({ code: 'VALIDATION_ERROR', message: 'Valid code, planSlug, planName, and durationDays are required' }, 400);
  }
  await env.DB.prepare(`INSERT INTO native_subscription_redemption_codes
    (id, code, plan_slug, plan_name, duration_days, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(crypto.randomUUID(), code, planSlug, planName, durationDays, body?.expiresAt ?? null, new Date().toISOString()).run();
  return reply({ code, planSlug, planName, durationDays, expiresAt: body?.expiresAt ?? null });
}

async function createProductRedemptionCode(request: Request, env: CouponEnv): Promise<Response> {
  if (!(await authenticateNativeAdmin(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Administrator authentication is required' }, 401);
  const body = await request.json<{ code?: string; productId?: string; variantId?: string; quantity?: number; expiresAt?: string }>().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
  const variantId = typeof body?.variantId === 'string' && body.variantId.trim() ? body.variantId.trim() : null;
  const rawQuantity = body?.quantity === undefined ? 1 : Number(body.quantity);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code) || !productId || productId.length > 160) {
    return reply({ code: 'VALIDATION_ERROR', message: 'Valid code and productId are required' }, 400);
  }
  if (!Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 999) {
    return reply({ code: 'VALIDATION_ERROR', message: 'quantity must be an integer between 1 and 999' }, 400);
  }
  try {
    await env.DB.prepare(`INSERT INTO native_product_redemption_codes
      (id, code, product_id, variant_id, quantity, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(crypto.randomUUID(), code, productId, variantId, rawQuantity, body?.expiresAt ?? null, new Date().toISOString()).run();
  } catch (error) {
    if (isUniqueViolation(error)) return reply({ code: 'CODE_ALREADY_EXISTS', message: 'A redemption code with this identifier already exists' }, 409);
    throw error;
  }
  return reply({ code, productId, variantId, quantity: rawQuantity, expiresAt: body?.expiresAt ?? null }, 201);
}

async function listProductRedemptionCodes(request: Request, env: CouponEnv): Promise<Response> {
  if (!(await authenticateNativeAdmin(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Administrator authentication is required' }, 401);
  const rows = await env.DB.prepare(`SELECT codes.id, codes.code, codes.product_id AS productId, codes.variant_id AS variantId,
      codes.quantity, codes.active, codes.expires_at AS expiresAt, codes.created_at AS createdAt,
      claims.user_id AS claimedByUserId, claims.claimed_at AS claimedAt, claims.order_id AS orderId
    FROM native_product_redemption_codes codes
    LEFT JOIN native_product_redemption_claims claims ON claims.code_id = codes.id
    ORDER BY codes.created_at DESC, codes.id DESC LIMIT 200`).all<Record<string, unknown>>();
  return reply({ items: rows.results, total: rows.results.length });
}

async function redeemSubscription(env: CouponEnv, user: NonNullable<Awaited<ReturnType<typeof authenticateNativeUser>>>, code: string): Promise<Response> {
  if (!(await isNativePluginEnabled(env, 'subscription'))) return reply({ code: 'PLUGIN_NOT_ENABLED', message: 'Subscription plugin is not installed and enabled' }, 404);
  const redemption = await env.DB.prepare(`SELECT id, code, plan_slug, plan_name, duration_days
    FROM native_subscription_redemption_codes
    WHERE code = ?1 AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`)
    .bind(code).first<RedemptionCodeRow>();
  if (!redemption) return reply({ code: 'REDEMPTION_CODE_INVALID', message: 'Redemption code is invalid or expired' }, 400);

  const claim = await applyNativeSubscriptionRedemption(env, user.id, {
    id: redemption.id,
    code: redemption.code,
    planSlug: redemption.plan_slug,
    planName: redemption.plan_name,
    durationDays: redemption.duration_days,
  });
  if (claim?.userId !== user.id) return reply({ code: 'REDEMPTION_CODE_ALREADY_CLAIMED', message: 'Redemption code has already been claimed' }, 409);
  if (!claim.appliedAt || !claim.subscriptionPeriodEnd) return reply({ code: 'REDEMPTION_FAILED', message: 'Subscription benefit could not be applied' }, 500);
  return reply({ code: redemption.code, planSlug: redemption.plan_slug, planName: redemption.plan_name, currentPeriodEnd: claim.subscriptionPeriodEnd, active: true });
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

// Redeems a product code by creating a fully discounted, zero-total paid
// order through the standard order tables, then enqueues the same
// payment.succeeded outbox event a Stripe-paid order emits. The whole
// existing fulfillment chain (inventory, receipt email, webhooks, affiliate,
// Odoo, and product-specific granters such as the eSIM connector) therefore
// runs unchanged — redemption never ships anything itself.
async function redeemProductCode(
  env: CouponEnv,
  user: NonNullable<Awaited<ReturnType<typeof authenticateNativeUser>>>,
  code: string,
  loadProduct: RedemptionProductLoader,
): Promise<Response> {
  const codeRow = await env.DB.prepare(`SELECT id, code, product_id, variant_id, quantity
    FROM native_product_redemption_codes
    WHERE code = ?1 AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`)
    .bind(code).first<ProductRedemptionCodeRow>();
  if (!codeRow) return reply({ code: 'REDEMPTION_CODE_INVALID', message: 'Redemption code is invalid or expired' }, 400);

  const prior = await env.DB.prepare('SELECT code_id, user_id, order_id, applied_at FROM native_product_redemption_claims WHERE code_id = ?1')
    .bind(codeRow.id).first<ProductRedemptionClaimRow>();
  if (prior && prior.user_id !== user.id) return reply({ code: 'REDEMPTION_CODE_ALREADY_CLAIMED', message: 'Redemption code has already been claimed' }, 409);
  if (prior?.order_id && prior.applied_at) {
    return reply({ code: codeRow.code, grantKind: 'product', orderId: prior.order_id, redeemed: true, duplicate: true });
  }

  const product = await loadProduct(codeRow.product_id);
  if (!product) return reply({ code: 'REDEMPTION_PRODUCT_NOT_FOUND', message: 'The redeemed product is not available' }, 400);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variant = codeRow.variant_id
    ? variants.find((candidate) => candidate.id === codeRow.variant_id)
    : variants.find((candidate) => candidate.isActive !== false);
  if (!variant || typeof variant.salePrice !== 'number' || !Number.isFinite(variant.salePrice)) {
    return reply({ code: 'REDEMPTION_PRODUCT_NOT_FOUND', message: 'The redeemed product variant is not available' }, 400);
  }

  const quantity = Number(codeRow.quantity);
  const unitPrice = variant.salePrice;
  const subtotal = Math.round(unitPrice * quantity * 100) / 100;
  const item = {
    id: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    productKind: product.productKind ?? 'consumable',
    variantId: variant.id,
    variantName: variant.name ?? null,
    variantAttributes: variant.attributes ?? null,
    quantity,
    unitPrice,
    totalPrice: subtotal,
    fulfillmentStatus: 'pending',
    fulfillmentData: { redemptionCode: codeRow.code, sourcePlugin: 'coupon' },
    currency: 'USD',
  };
  const now = new Date().toISOString();
  const orderId = orderNumber();
  const order: Record<string, unknown> = {
    id: orderId,
    userId: user.id,
    status: 'PAID',
    paymentStatus: 'PAID',
    subtotalAmount: subtotal,
    totalAmount: 0,
    discountAmount: subtotal,
    shippingAmount: 0,
    shippingMethod: null,
    shippingProvider: null,
    appliedDiscounts: [{ kind: 'redemption', id: codeRow.id, code: codeRow.code, amount: subtotal }],
    currency: 'USD',
    shippingAddress: null,
    customerEmail: user.email,
    locale: 'en',
    items: [item],
    createdAt: now,
    updatedAt: now,
    cancelReason: null,
    cancelledAt: null,
  };
  const idempotencyKey = `coupon_redeem:${codeRow.id}`;

  if (!prior) {
    // The claims PK is the cross-user guard: only one user can ever hold a
    // claim on a code. A same-user retry falls through and rebuilds the
    // order idempotently (metadata idempotency_key is UNIQUE per user).
    try {
      await env.DB.prepare('INSERT INTO native_product_redemption_claims (code_id, user_id, claimed_at) VALUES (?1, ?2, ?3)')
        .bind(codeRow.id, user.id, now).run();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await env.DB.prepare('SELECT code_id, user_id, order_id, applied_at FROM native_product_redemption_claims WHERE code_id = ?1')
        .bind(codeRow.id).first<ProductRedemptionClaimRow>();
      if (raced && raced.user_id !== user.id) return reply({ code: 'REDEMPTION_CODE_ALREADY_CLAIMED', message: 'Redemption code has already been claimed' }, 409);
    }
  }

  // Mirror the checkout pipeline: inventory snapshot, guarded stock
  // reservation, order item, order metadata, and the paid snapshot — plus
  // the payment.succeeded outbox event that drives fulfillment. Digital
  // products get an unbounded stock row exactly like checkout does.
  const sourceStock = item.productKind === 'goods' ? Math.max(0, Math.trunc(Number(variant.baseStock ?? 0))) : 2147483647;
  const reservationId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO native_inventory (product_id, variant_id, source_stock, refreshed_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(product_id, variant_id) DO UPDATE SET
           source_stock = excluded.source_stock,
           refreshed_at = excluded.refreshed_at`,
      ).bind(product.id, variant.id, sourceStock, now),
      env.DB.prepare(
        `INSERT INTO native_inventory_reservations
         (id, order_id, product_id, variant_id, quantity, active, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, 1, ?6
         WHERE (SELECT source_stock FROM native_inventory WHERE product_id = ?3 AND variant_id = ?4)
           - COALESCE((SELECT SUM(quantity) FROM native_inventory_reservations
                       WHERE product_id = ?3 AND variant_id = ?4 AND active = 1), 0) >= ?5`,
      ).bind(reservationId, orderId, product.id, variant.id, quantity, now),
      env.DB.prepare(
        `INSERT INTO native_order_snapshots
         (id, user_id, status, searchable_text, payload, source_updated_at, imported_at)
         VALUES (?1, ?2, 'PAID', ?3, ?4, ?5, ?5)`,
      ).bind(orderId, user.id, searchable(order), JSON.stringify(order), now),
      env.DB.prepare(
        `INSERT INTO native_order_metadata
         (order_id, user_id, idempotency_key, payment_status, currency, total_amount, affiliate_partner_id, promotion_id)
         VALUES (?1, ?2, ?3, 'PAID', 'USD', 0, NULL, NULL)`,
      ).bind(orderId, user.id, idempotencyKey),
      env.DB.prepare(
        `INSERT INTO native_order_items
         (id, order_id, reservation_id, product_id, variant_id, quantity, unit_price, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(item.id, orderId, reservationId, product.id, variant.id, quantity, unitPrice, JSON.stringify(item)),
      env.DB.prepare(
        `INSERT INTO native_checkout_outbox (id, event_type, aggregate_id, payload, created_at)
         VALUES (?1, 'payment.succeeded', ?2, ?3, ?4)`,
      ).bind(crypto.randomUUID(), orderId, JSON.stringify({ orderId }), now),
      env.DB.prepare('UPDATE native_product_redemption_claims SET order_id = ?1, applied_at = ?2 WHERE code_id = ?3 AND user_id = ?4')
        .bind(orderId, now, codeRow.id, user.id),
    ]);
  } catch (error) {
    // Concurrent same-user retries collide on the metadata idempotency key;
    // return the winning order instead of surfacing an error.
    if (isUniqueViolation(error)) {
      const existing = await env.DB.prepare(
        'SELECT order_id FROM native_order_metadata WHERE user_id = ?1 AND idempotency_key = ?2',
      ).bind(user.id, idempotencyKey).first<{ order_id: string }>();
      if (existing) return reply({ code: codeRow.code, grantKind: 'product', orderId: existing.order_id, redeemed: true, duplicate: true });
    }
    console.error(JSON.stringify({ message: 'native product redemption failed', error: error instanceof Error ? error.message : String(error), codeId: codeRow.id }));
    return reply({ code: 'REDEMPTION_FAILED', message: 'The redeemed order could not be created' }, 500);
  }
  return reply({ code: codeRow.code, grantKind: 'product', orderId, productId: product.id, productName: product.name, quantity, status: 'PAID' }, 201);
}

async function redeem(request: Request, env: CouponEnv, loadProduct: RedemptionProductLoader): Promise<Response> {
  const user = await authenticateNativeUser(request, env);
  if (!user) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const body = await request.json<{ code?: string }>().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!code) return reply({ code: 'VALIDATION_ERROR', message: 'A redemption code is required' }, 400);
  const subscriptionCode = await env.DB.prepare(
    'SELECT id FROM native_subscription_redemption_codes WHERE code = ?1 AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
  ).bind(code).first<{ id: string }>();
  if (subscriptionCode) return redeemSubscription(env, user, code);
  return redeemProductCode(env, user, code, loadProduct);
}

export async function tryNativeCoupon(request: Request, env: CouponEnv, loadProduct: RedemptionProductLoader): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/v1/plugins/coupon/')) return null;
  if (!(await isNativePluginEnabled(env, 'coupon'))) return reply({ code: 'PLUGIN_NOT_ENABLED', message: 'Coupon plugin is not installed and enabled' }, 404);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/admin/redemption-codes') return createRedemptionCode(request, env);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/admin/product-redemption-codes') return createProductRedemptionCode(request, env);
  if (request.method === 'GET' && url.pathname === '/api/v1/plugins/coupon/admin/product-redemption-codes') return listProductRedemptionCodes(request, env);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/api/redeem') return redeem(request, env, loadProduct);
  if (request.method === 'POST' && url.pathname === '/api/v1/plugins/coupon/admin/codes') {
    if (!(await authenticateNativeAdmin(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Administrator authentication is required' }, 401);
    const body = await request.json<{ code?: string; discountType?: string; discountValue?: number; usageLimit?: number; expiresAt?: string }>().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const value = Number(body?.discountValue);
    const type = body?.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage';
    if (!/^[A-Z0-9_-]{3,64}$/.test(code) || !Number.isFinite(value) || value <= 0 || (type === 'percentage' && value > 100)) return reply({ code: 'VALIDATION_ERROR', message: 'Valid code and discountValue are required' }, 400);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO native_coupon_codes (id, code, discount_type, discount_value, usage_limit, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(crypto.randomUUID(), code, type, value, body?.usageLimit ?? null, body?.expiresAt ?? null, now).run();
    return reply({ code, discountType: type, discountValue: value });
  }
  if (request.method !== 'POST' || url.pathname !== '/api/v1/plugins/coupon/api/validate') return null;
  if (!(await authenticateNativeUser(request, env))) return reply({ code: 'UNAUTHORIZED', message: 'Login required' }, 401);
  const body = await request.json<{ codes?: string[]; subtotal?: number }>().catch(() => null);
  const code = body?.codes?.[0]?.trim().toUpperCase();
  if (!code) return reply({ code: 'VALIDATION_ERROR', message: 'At least one discount code is required' }, 400);
  const row = await env.DB.prepare(`SELECT * FROM native_coupon_codes WHERE code = ?1 AND active = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) AND (usage_limit IS NULL OR usage_count < usage_limit)`).bind(code).first<{ code: string; discount_type: string; discount_value: number }>();
  if (!row) return reply({ code: 'COUPON_INVALID', message: 'Coupon code is invalid or expired' }, 400);
  const subtotal = Math.max(0, Number(body?.subtotal) || 0);
  const discountAmount = Number((row.discount_type === 'percentage' ? subtotal * row.discount_value / 100 : Math.min(subtotal, row.discount_value)).toFixed(2));
  return reply({ discountAmount, appliedDiscounts: [{ code: row.code, type: row.discount_type, value: row.discount_value, amount: discountAmount }], subtotal, finalTotal: Number((subtotal - discountAmount).toFixed(2)) });
}
