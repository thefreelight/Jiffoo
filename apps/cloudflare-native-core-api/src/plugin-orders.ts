/**
 * Native plugin-order checkout contract adapter.
 *
 * Mirrors the Node Core contract introduced by
 * `apps/api/src/core/order/plugin-orders.ts` (PR #142) on the D1/Worker
 * line: strict service-JWT authentication, stable idempotent order IDs,
 * persistent plugin order/payment rows, and a Stripe checkout session.
 */

import { getNativePluginSecret } from './plugin-settings';

type PluginOrdersEnv = Pick<Cloudflare.Env, 'DB' | 'STRIPE_SECRET_KEY' | 'JWT_SECRET'> & {
  SERVICE_JWT_SECRET?: string;
  SERVICE_JWT_ISSUER?: string;
};

interface PluginOrderInput {
  userId: string;
  sourcePlugin: string;
  entitlementType: string;
  externalReferenceId: string;
  name: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

interface PluginOrderRow {
  id: string;
  user_id: string;
  source_plugin: string;
  entitlement_type: string;
  external_reference_id: string;
  name: string;
  amount_cents: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  metadata_json: string | null;
  created_at: string;
}

interface PluginPaymentRow {
  id: string;
  order_id: string;
  user_id: string;
  provider: string;
  idempotency_key: string;
  session_url: string | null;
  payment_intent_id: string | null;
  status: string;
  created_at: string;
}

function success(data: unknown, status = 200, runtime = 'cloudflare-native-d1-plugin-orders'): Response {
  return Response.json({ success: true, data }, { status, headers: { 'x-jiffoo-runtime': runtime } });
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-plugin-orders' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBody(value: unknown): PluginOrderInput | null {
  if (!isRecord(value)) return null;
  const amount = typeof value.amount === 'number' ? value.amount : Number(value.amount);
  return {
    userId: String(value.userId ?? ''),
    sourcePlugin: String(value.sourcePlugin ?? ''),
    entitlementType: String(value.entitlementType ?? ''),
    externalReferenceId: String(value.externalReferenceId ?? ''),
    name: String(value.name ?? ''),
    amount,
    currency: String(value.currency ?? ''),
    paymentMethod: String(value.paymentMethod ?? ''),
    successUrl: typeof value.successUrl === 'string' ? value.successUrl : undefined,
    cancelUrl: typeof value.cancelUrl === 'string' ? value.cancelUrl : undefined,
    idempotencyKey: typeof value.idempotencyKey === 'string' && value.idempotencyKey.trim()
      ? value.idempotencyKey.trim() : undefined,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

function validate(input: PluginOrderInput): string | null {
  if (!input.userId || !input.userId.trim()) return 'userId is required';
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(input.sourcePlugin)) return 'sourcePlugin must match /^[a-z][a-z0-9-]{1,31}$/';
  if (!input.entitlementType || input.entitlementType.length > 64) return 'entitlementType must be 1-64 chars';
  if (!input.externalReferenceId || input.externalReferenceId.length > 160) return 'externalReferenceId must be 1-160 chars';
  if (!input.name || input.name.length > 200) return 'name must be 1-200 chars';
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'amount must be positive';
  if (!/^[A-Za-z]{3}$/.test(input.currency)) return 'currency must be 3 letters';
  if (!input.paymentMethod || input.paymentMethod.length > 64) return 'paymentMethod must be 1-64 chars';
  return null;
}

async function stableId(prefix: string, value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex.slice(0, 24)}`;
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function constantTimeEqual(left: Uint8Array, right: Uint8Array): Promise<boolean> {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

/**
 * Verifies an HS256 service JWT (issuer `jiffoo-platform`) and returns the
 * `sub` claim (e.g. `plugin:stripe`). Mirrors the Node Core
 * `requireServiceAuthMiddleware` semantics on the D1/Worker line.
 */
async function verifyServiceJwt(request: Request, env: PluginOrdersEnv): Promise<string | null> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const secretValue = await getNativePluginSecret(env, 'service-jwt', 'secret', env.SERVICE_JWT_SECRET);
  if (!secretValue) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart))) as { alg?: string };
    if (header.alg !== 'HS256') return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secretValue),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expectedSignature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerPart}.${payloadPart}`)));
    const providedSignature = base64UrlDecode(signaturePart);
    if (!await constantTimeEqual(expectedSignature, providedSignature)) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as { sub?: string; iss?: string; exp?: number };
    if (payload.iss !== (env.SERVICE_JWT_ISSUER || 'jiffoo-platform')) return null;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

async function existingPluginOrder(env: PluginOrdersEnv, sourcePlugin: string, externalReferenceId: string): Promise<PluginOrderRow | null> {
  return env.DB.prepare(
    `SELECT id, user_id, source_plugin, entitlement_type, external_reference_id, name,
            amount_cents, currency, payment_method, payment_status, metadata_json, created_at
     FROM native_plugin_orders
     WHERE source_plugin = ?1 AND external_reference_id = ?2`,
  ).bind(sourcePlugin, externalReferenceId).first<PluginOrderRow>();
}

export async function tryNativePluginOrders(request: Request, env: PluginOrdersEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!(url.pathname === '/api/v1/internal/plugin-orders/checkout' || url.pathname === '/api/internal/plugin-orders/checkout')) return null;
  if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');

  const subject = await verifyServiceJwt(request, env);
  if (!subject) return failure(401, 'UNAUTHORIZED', 'Valid service token required');
  const body = await request.json().catch(() => null);
  const input = parseBody(body);
  if (!input) return failure(400, 'INVALID_PLUGIN_ORDER', 'Malformed plugin order body');
  if (subject !== `plugin:${input.sourcePlugin}`) return failure(403, 'PLUGIN_IDENTITY_MISMATCH', 'Service token does not match source plugin');
  const invalid = validate(input);
  if (invalid) return failure(400, 'INVALID_PLUGIN_ORDER', invalid);
  if (input.paymentMethod !== 'stripe') return failure(400, 'UNSUPPORTED_PAYMENT_METHOD', `Unsupported payment method: ${input.paymentMethod}`);

  const existing = await existingPluginOrder(env, input.sourcePlugin, input.externalReferenceId);
  const orderId = existing?.id ?? await stableId('plugin_order', `${input.sourcePlugin}:${input.externalReferenceId}`);
  const amountCents = Math.round(input.amount * 100);
  const currency = input.currency.toUpperCase();
  const now = new Date().toISOString();
  const idempotencyKey = input.idempotencyKey
    ?? `plugin-order:${input.sourcePlugin}:${input.externalReferenceId}:stripe`;

  if (!existing) {
    const productId = await stableId('plugin_product', input.sourcePlugin);
    const metadata = JSON.stringify({ productId, name: input.name, sourcePlugin: input.sourcePlugin, entitlementType: input.entitlementType, externalReferenceId: input.externalReferenceId, userId: input.userId });
    await env.DB.prepare(
      `INSERT INTO native_plugin_orders
       (id, user_id, source_plugin, entitlement_type, external_reference_id, name,
        amount_cents, currency, payment_method, payment_status, metadata_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'PENDING', ?10, ?11, ?11)`,
    ).bind(orderId, input.userId, input.sourcePlugin, input.entitlementType, input.externalReferenceId,
      input.name, amountCents, currency, input.paymentMethod, metadata, now).run();
  }

  const existingPayment = await env.DB.prepare(
    'SELECT id, order_id, user_id, provider, idempotency_key, session_url, payment_intent_id, status, created_at FROM native_plugin_payments WHERE idempotency_key = ?1',
  ).bind(idempotencyKey).first<PluginPaymentRow>();
  if (existingPayment && existingPayment.session_url) {
    return success({ orderId, checkoutUrl: existingPayment.session_url, status: existingPayment.status }, 200);
  }

  const secret = await getNativePluginSecret(env, 'stripe', 'secretKey', env.STRIPE_SECRET_KEY);
  const successUrl = input.successUrl ?? 'https://tianquan.jiffoo.com/payment/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = input.cancelUrl ?? 'https://tianquan.jiffoo.com/payment/cancel';
  const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': idempotencyKey,
    },
    body: new URLSearchParams({
      mode: 'payment',
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][price_data][product_data][name]': input.name,
      'line_items[0][quantity]': '1',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'metadata[orderId]': orderId,
      'metadata[sourcePlugin]': input.sourcePlugin,
      'metadata[externalReferenceId]': input.externalReferenceId,
    }).toString(),
  });
  const payload = await stripe.json<{ id?: string; url?: string; payment_intent?: string; error?: { message?: string } }>();
  if (!stripe.ok || !payload.id || !payload.url) {
    console.error(JSON.stringify({ message: 'Stripe plugin order session failed', status: stripe.status, error: payload.error?.message ?? 'invalid response' }));
    return failure(502, 'PAYMENT_PLUGIN_FAILED', 'Stripe could not create a checkout session');
  }
  const paymentId = payload.id;
  await env.DB.prepare(
    `INSERT INTO native_plugin_payments
     (id, order_id, user_id, provider, idempotency_key, session_url, payment_intent_id, status, created_at, updated_at)
     VALUES (?1, ?2, ?3, 'stripe', ?4, ?5, ?6, 'PENDING', ?7, ?7)`,
  ).bind(paymentId, orderId, input.userId, idempotencyKey, payload.url, payload.payment_intent ?? null, now).run();
  return success({ orderId, checkoutUrl: payload.url, status: 'PENDING' }, 201);
}