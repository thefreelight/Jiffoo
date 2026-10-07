import { authenticateNativeUser, tryNativeAuth, type NativeSessionUser } from './auth';
import { md5Hex } from './shipping-providers';

/**
 * Postory store slice for the CF-native runtime.
 *
 * Replaces the contract-v1 subscription/stripe/yipay plugin chain that ran on
 * the K8s postory instance (workspace task POSTORY-003). Serves the exact
 * paths the postory website, extension and the live Stripe webhook endpoint
 * already call, so cutover needs no client changes:
 *
 * - /api/auth/*                                    -> native /api/v1/auth/*
 * - GET  .../plugin/subscription/api/store/plans
 * - POST .../plugin/subscription/api/store/subscriptions/checkout
 * - GET  .../plugin/subscription/api/store/entitlements/active
 * - POST .../plugin/stripe/api/api/payments/webhook
 * - GET  .../plugin/yipay/api/api/payments/webhook
 *
 * Gated on POSTORY_STORE_ENABLED=true so other native instances are unaffected.
 */

interface PostoryEnv {
  DB: D1Database;
  POSTORY_STORE_ENABLED?: string;
  JWT_SECRET?: unknown;
  JWT_SECRET_VALUE?: string;
  STRIPE_SECRET_KEY?: unknown;
  STRIPE_WEBHOOK_SECRET?: unknown;
  YIPAY_PID?: string;
  YIPAY_KEY?: string;
  YIPAY_GATEWAY?: string;
}

const PRODUCT = 'postory';
const PAID_DEVICE_LIMIT = 5;
const SUBSCRIPTION_DAYS = 365;

interface PostoryPlan {
  id: string;
  slug: string;
  name: string;
  amount: number;
  currency: 'usd' | 'cny';
  billingCycle: 'yearly';
  trialDays: number;
  isActive: true;
  entitlements: Record<string, boolean>;
}

const PLAN_ENTITLEMENTS: Record<string, boolean> = {
  history: true,
  localArchive: true,
  myPosts: true,
  export: true,
  cloudArchive: false,
};

const PLANS: PostoryPlan[] = [
  {
    id: 'postory_trial',
    slug: 'trial',
    name: 'Postory Trial',
    amount: 0,
    currency: 'usd',
    billingCycle: 'yearly',
    trialDays: 3,
    isActive: true,
    entitlements: PLAN_ENTITLEMENTS,
  },
  {
    id: 'postory_local_yearly',
    slug: 'local-yearly',
    name: 'Postory Local',
    amount: 29,
    currency: 'usd',
    billingCycle: 'yearly',
    trialDays: 3,
    isActive: true,
    entitlements: PLAN_ENTITLEMENTS,
  },
  {
    id: 'postory_local_founder',
    slug: 'founder-yearly',
    name: 'Postory Founder',
    amount: 98,
    currency: 'cny',
    billingCycle: 'yearly',
    trialDays: 0,
    isActive: true,
    entitlements: PLAN_ENTITLEMENTS,
  },
];

function json(data: unknown, status = 200): Response {
  return Response.json(
    status < 400 ? { success: true, data } : { success: false, error: data },
    { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-postory' } },
  );
}

function fail(status: number, code: string, message: string): Response {
  return json({ code, message }, status);
}

async function secretValue(value: unknown): Promise<string> {
  if (value && typeof value === 'object' && 'get' in (value as Record<string, unknown>)) {
    return await (value as { get(): Promise<string> }).get();
  }
  return typeof value === 'string' ? value : '';
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

class SubscriptionDeviceLimitError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super('SUBSCRIPTION_DEVICE_LIMIT');
    this.name = 'SubscriptionDeviceLimitError';
    this.limit = limit;
  }
}

async function assertPaidDeviceAllowed(env: PostoryEnv, userId: string, productKey: string, deviceKey: string): Promise<void> {
  const known = await env.DB.prepare(
    'SELECT device_key FROM postory_subscription_devices WHERE user_id = ?1 AND product_key = ?2 AND device_key = ?3 LIMIT 1',
  ).bind(userId, productKey, deviceKey).first<{ device_key: string }>();
  if (known) {
    await env.DB.prepare(
      "UPDATE postory_subscription_devices SET last_seen_at = datetime('now') WHERE user_id = ?1 AND product_key = ?2 AND device_key = ?3",
    ).bind(userId, productKey, deviceKey).run();
    return;
  }
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM postory_subscription_devices WHERE user_id = ?1 AND product_key = ?2',
  ).bind(userId, productKey).first<{ count: number }>();
  const used = Number(countRow?.count ?? 0);
  if (used >= PAID_DEVICE_LIMIT) throw new SubscriptionDeviceLimitError(PAID_DEVICE_LIMIT);
  await env.DB.prepare(
    'INSERT INTO postory_subscription_devices (device_key, user_id, product_key) VALUES (?1, ?2, ?3)',
  ).bind(deviceKey, userId, productKey).run();
}

interface PostoryOrderRow {
  id: string;
  user_id: string;
  plan_slug: string;
  provider: string;
  status: string;
}

/** Marks a PENDING order PAID and activates the yearly subscription (idempotent). */
async function activateOrder(env: PostoryEnv, orderId: string): Promise<boolean> {
  const order = await env.DB.prepare('SELECT id, user_id, plan_slug, provider, status FROM postory_orders WHERE id = ?1')
    .bind(orderId).first<PostoryOrderRow>();
  if (!order) return false;
  if (order.status !== 'PENDING') return order.status === 'PAID';
  const periodEnd = new Date(Date.now() + SUBSCRIPTION_DAYS * 86_400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE postory_orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?1 AND status = 'PENDING'",
    ).bind(orderId),
    env.DB.prepare(`INSERT INTO postory_subscriptions (user_id, plan_slug, status, current_period_end, provider, updated_at)
      VALUES (?1, ?2, 'active', ?3, ?4, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        plan_slug = excluded.plan_slug,
        status = 'active',
        current_period_end = CASE
          WHEN postory_subscriptions.current_period_end > datetime('now')
            THEN datetime(postory_subscriptions.current_period_end, '+${SUBSCRIPTION_DAYS} days')
          ELSE ?3 END,
        provider = excluded.provider,
        updated_at = datetime('now')`).bind(order.user_id, order.plan_slug, periodEnd, order.provider),
  ]);
  return true;
}

function planBySlug(slug: string | undefined): PostoryPlan | null {
  return PLANS.find((plan) => plan.slug === slug) ?? null;
}

async function handleCheckout(request: Request, env: PostoryEnv, user: NativeSessionUser): Promise<Response> {
  const body = await request.clone().json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const plan = planBySlug(typeof body.plan === 'string' ? body.plan : undefined);
  if (!plan || plan.slug === 'trial') {
    return fail(400, 'PLAN_INVALID', 'A purchasable plan is required (trial is granted in the extension)');
  }
  const paymentMethod = body.paymentMethod === 'yipay' ? 'yipay' : 'stripe';
  const orderId = `porder_${crypto.randomUUID().replaceAll('-', '')}`;
  const origin = new URL(request.url).origin;
  const cnCustomer = isCnLikelyCustomer(request);

  if (paymentMethod === 'stripe') {
    const secretKey = await secretValue(env.STRIPE_SECRET_KEY);
    if (!secretKey) return fail(503, 'PAYMENT_PLUGIN_FAILED', 'Stripe is not configured');
    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', plan.currency);
    form.set('line_items[0][price_data][product_data][name]', plan.name);
    form.set('line_items[0][price_data][unit_amount]', String(Math.round(plan.amount * 100)));
    form.set('line_items[0][price_data][recurring][interval]', 'year');
    form.set('metadata[orderId]', orderId);
    form.set('metadata[userId]', user.id);
    form.set('metadata[planSlug]', plan.slug);
    if (user.email) form.set('customer_email', user.email);
    form.set('success_url', `${typeof body.successUrl === 'string' ? body.successUrl : origin + '/?checkout=success'}?session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', typeof body.cancelUrl === 'string' ? body.cancelUrl : origin + '/?checkout=canceled');
    // Chinese-likely customers (CN ip OR Chinese browser locale) get the CN
    // rails explicitly — Stripe's automatic geo detection misses VPN/proxy
    // users whose exit is overseas, and Alipay/WeChat don't appear for them.
    if (cnCustomer) {
      form.set('payment_method_types[0]', 'card');
      form.set('payment_method_types[1]', 'alipay');
      form.set('payment_method_types[2]', 'wechat_pay');
      form.set('payment_method_options[wechat_pay][client]', 'web');
    }
    const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const payload = await stripe.json<{ id?: string; url?: string; error?: { message?: string } }>().catch(() => ({}) as { id?: string; url?: string; error?: { message?: string } });
    if (!stripe.ok || !payload.id || !payload.url) {
      return fail(502, 'PAYMENT_PLUGIN_FAILED', payload.error?.message || 'Stripe could not create a checkout session');
    }
    await env.DB.prepare(
      "INSERT INTO postory_orders (id, user_id, plan_slug, provider, provider_session_id, status, amount_cents, currency) VALUES (?1, ?2, ?3, 'stripe', ?4, 'PENDING', ?5, ?6)",
    ).bind(orderId, user.id, plan.slug, payload.id, Math.round(plan.amount * 100), plan.currency).run();
    return json({ orderId, session: { url: payload.url } });
  }

  // yipay (epay protocol): MD5 over ASCII-sorted k=v pairs with the merchant key appended.
  const gateway = (env.YIPAY_GATEWAY || 'https://yzf.chfastpay.com').replace(/\/+$/, '');
  const key = await secretValue(env.YIPAY_KEY);
  const pid = env.YIPAY_PID || '';
  if (!key || !pid) return fail(503, 'PAYMENT_PLUGIN_FAILED', 'yipay is not configured');
  const notifyUrl = `${origin}/api/extensions/plugin/yipay/api/api/payments/webhook`;
  const params: Record<string, string> = {
    pid,
    type: 'alipay',
    out_trade_no: orderId,
    notify_url: notifyUrl,
    return_url: typeof body.successUrl === 'string' ? body.successUrl : `${origin}/?checkout=success`,
    name: `${plan.name} (${plan.slug})`,
    money: plan.amount.toFixed(2),
  };
  const signPayload = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + key;
  const sign = md5Hex(signPayload);
  const query = new URLSearchParams({ ...params, sign, sign_type: 'MD5' });
  const url = `${gateway}/submit.php?${query.toString()}`;
  await env.DB.prepare(
    "INSERT INTO postory_orders (id, user_id, plan_slug, provider, provider_session_id, status, amount_cents, currency) VALUES (?1, ?2, ?3, 'yipay', ?4, 'PENDING', ?5, ?6)",
  ).bind(orderId, user.id, plan.slug, orderId, Math.round(plan.amount * 100), plan.currency).run();
  return json({ orderId, session: { url } });
}

async function stripeWebhook(request: Request, env: PostoryEnv): Promise<Response | null> {
  const raw = await request.text();
  const signatureHeader = request.headers.get('stripe-signature') || '';
  const secret = await secretValue(env.STRIPE_WEBHOOK_SECRET);
  const parts = Object.fromEntries(signatureHeader.split(',').map((piece) => piece.split('=')));
  const timestamp = parts['t'];
  const provided = parts['v1'];
  if (!timestamp || !provided || !secret) {
    return fail(400, 'STRIPE_WEBHOOK_RAW_BODY_AND_SIGNATURE_REQUIRED', 'Stripe webhook raw body and signature are required');
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${raw}`)));
  if (!timingSafeEqual(expected, provided)) {
    return fail(400, 'STRIPE_WEBHOOK_SIGNATURE_VERIFICATION_FAILED', 'Stripe webhook signature verification failed');
  }
  const event = JSON.parse(raw) as { type?: string; data?: { object?: { id?: string; metadata?: Record<string, string>; subscription?: string } } };
  const object = event.data?.object;
  const orderId = object?.metadata?.orderId;
  if (event.type === 'checkout.session.completed' && orderId) {
    await activateOrder(env, orderId);
  } else if (event.type === 'checkout.session.expired' && orderId) {
    await env.DB.prepare("UPDATE postory_orders SET status = 'FAILED', updated_at = datetime('now') WHERE id = ?1 AND status = 'PENDING'").bind(orderId).run();
  }
  return json({ received: true });
}

async function yipayNotify(request: Request, env: PostoryEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => { params[key] = value; });
  const providedSign = params.sign || '';
  const key = await secretValue(env.YIPAY_KEY);
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  if (!timingSafeEqual(md5Hex(sorted + key), providedSign)) {
    return new Response('fail', { status: 403, headers: { 'content-type': 'text/plain' } });
  }
  if (params.trade_status === 'TRA_SUCCESS' && params.out_trade_no) {
    await activateOrder(env, params.out_trade_no);
  }
  return new Response('success', { status: 200, headers: { 'content-type': 'text/plain' } });
}

export async function tryPostoryStore(request: Request, env: PostoryEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/api/extensions/plugin/stripe/api/api/payments/webhook' && request.method === 'POST') {
    return await stripeWebhook(request, env);
  }
  if (pathname === '/api/extensions/plugin/yipay/api/api/payments/webhook' && request.method === 'GET') {
    return await yipayNotify(request, env);
  }
  const storePrefix = '/api/extensions/plugin/subscription/api/store';
  if (!pathname.startsWith(storePrefix + '/')) return null;

  if (pathname === storePrefix + '/plans' && request.method === 'GET') {
    const product = url.searchParams.get('product');
    if (product !== PRODUCT) return fail(400, 'PRODUCT_REQUIRED', 'Unknown product');
    return json(PLANS);
  }

  const user = await authenticateNativeUser(request, env as never);
  if (!user) return fail(401, 'UNAUTHORIZED', 'Login required');

  if (pathname === storePrefix + '/entitlements/active' && request.method === 'GET') {
    const product = url.searchParams.get('product');
    if (product !== PRODUCT) return fail(400, 'PRODUCT_REQUIRED', 'Unknown product');
    const row = await env.DB.prepare(
      `SELECT plan_slug AS planSlug, status, current_period_end AS currentPeriodEnd
       FROM postory_subscriptions
       WHERE user_id = ?1 AND status = 'active' AND current_period_end > datetime('now')
       ORDER BY current_period_end DESC LIMIT 1`,
    ).bind(user.id).first<{ planSlug: string; status: string; currentPeriodEnd: string }>();
    if (!row) return json({ active: false, productKey: PRODUCT, planSlug: null, status: null, currentPeriodEnd: null });
    const deviceKey = url.searchParams.get('deviceKey')?.trim();
    if (deviceKey) {
      try {
        await assertPaidDeviceAllowed(env, user.id, PRODUCT, deviceKey);
      } catch (error) {
        if (error instanceof SubscriptionDeviceLimitError) {
          return fail(403, 'DEVICE_LIMIT', `Device limit reached (${error.limit} devices). Unbind a device via support@postory.cc.`);
        }
        return fail(500, 'DEVICE_ACCOUNTING_FAILED', error instanceof Error ? error.message : 'Device accounting failed');
      }
    }
    return json({ active: true, productKey: PRODUCT, planSlug: row.planSlug, status: row.status, currentPeriodEnd: row.currentPeriodEnd });
  }

  if (pathname === storePrefix + '/subscriptions/checkout' && request.method === 'POST') {
    return await handleCheckout(request, env, user);
  }

  return null;
}

/**
 * Postory compat entry: serves the store slice plus the /api/auth/* alias the
 * postory website uses (native handlers speak /api/v1/auth/*). Returns null
 * for anything else so the main router continues.
 *
 * Cross-origin: https://postory.cc calls this worker from the browser, so
 * responses carry CORS headers for the website origins and OPTIONS preflights
 * are answered here (the K8s ingress used to do this; the worker must too —
 * without it every browser sign-in dies as "Failed to fetch").
 */
const POSTORY_ALLOWED_ORIGINS = new Set(['https://postory.cc', 'https://www.postory.cc']);

function postoryCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
  if (POSTORY_ALLOWED_ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
  }
  return headers;
}

function withPostoryCors(request: Request, response: Response): Response {
  const headers = postoryCorsHeaders(request);
  if (Object.keys(headers).length === 0) return response;
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

export async function tryPostoryCompat(request: Request, env: PostoryEnv): Promise<Response | null> {
  if (env.POSTORY_STORE_ENABLED !== 'true') return null;
  const url = new URL(request.url);
  // normalizePublicApiRequest maps every /api/* path onto /api/v1/* before the
  // dispatch chain reaches this adapter — accept both spellings so direct
  // callers and the rewritten form hit the same handlers.
  const pathname = url.pathname.replace(/^\/api\/v1\//, '/api/');
  const inScope = pathname === '/api/auth' || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/extensions/plugin/');
  if (!inScope) return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: postoryCorsHeaders(request) });
  }

  const rewritten = new Request(`https://${url.host}${pathname}${url.search}`, request);

  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    const rewrittenPath = `/api/v1${pathname.slice('/api/auth'.length)}`;
    const authRequest = new Request(`https://${url.host}${rewrittenPath}${url.search}`, request);
    const authResponse = await tryNativeAuth(authRequest, env as never, async () => new Response(null, { status: 404 }));
    return authResponse ? withPostoryCors(request, authResponse) : null;
  }

  const storeResponse = await tryPostoryStore(rewritten, env);
  return storeResponse ? withPostoryCors(request, storeResponse) : null;
}

/**
 * Composite CN-customer signal: connecting-IP country (VPN exit — weak) OR
 * browser language (survives VPNs — strong). Either match unlocks the CN
 * payment rails (alipay/wechat_pay) at checkout.
 */
function isCnLikelyCustomer(request: Request): boolean {
  const cfCountry = (request as unknown as { cf?: { country?: string } }).cf?.country;
  if (cfCountry === 'CN') return true;
  const language = (request.headers.get('accept-language') || '').toLowerCase();
  return language.startsWith('zh');
}
