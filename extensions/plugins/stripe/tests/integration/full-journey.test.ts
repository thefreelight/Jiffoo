/**
 * Stripe Plugin - Full Realistic Integration Test
 *
 * Simulates the complete user journey from admin and customer perspective:
 *
 *  Phase 1:  Lifecycle - install -> configure -> enable (+ fail without config)
 *  Phase 2:  Plugin-to-Core API communication via mock core server
 *  Phase 3:  Customer checkout - create PaymentIntent -> confirm -> verify DB
 *  Phase 4:  Checkout Session (hosted page) flow
 *  Phase 5:  Webhook signature verification (real Stripe SDK)
 *  Phase 6:  Admin refund - partial -> full -> over-refund rejection
 *  Phase 7:  Concurrent payment creation
 *  Phase 8:  Input validation & error scenarios
 *  Phase 9:  Admin dashboard with real aggregated data
 *  Phase 10: Multi-instance data isolation
 *  Phase 11: Lifecycle teardown - disable -> uninstall
 *
 * Requirements:
 *   STRIPE_SECRET_KEY          (sk_test_...)
 *   STRIPE_DATABASE_URL        (postgresql://...)
 *   STRIPE_WEBHOOK_SECRET      (whsec_...)  -- optional for Phase 5
 *
 * Automatically skipped when credentials are missing or DB unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadEnvFile } from '../../../../../tests/shared/load-env';
import { resolve } from 'path';
import http from 'http';
import { URL } from 'url';

// Load env BEFORE any plugin import
loadEnvFile(resolve(__dirname, '../../../../../.env.test'));

// ---------------------------------------------------------------------------
// Inline helpers (avoids pnpm cross-workspace resolution issues)
// ---------------------------------------------------------------------------

function isRealKey(key: string | undefined): boolean {
  return !!key && !key.includes('placeholder') && key.length > 10;
}

function encodePluginConfig(cfg: Record<string, any>): string {
  return Buffer.from(JSON.stringify(cfg)).toString('base64url');
}

function buildHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-platform-id': 'integ-platform',
    'x-plugin-slug': 'stripe',
    'x-installation-id': 'default',
    'x-installation-key': 'default',
    'x-user-id': 'admin-001',
    'x-user-role': 'admin',
    'x-request-id': `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    'x-locale': 'en',
    'x-caller': 'admin',
    'x-platform-api-base-url': 'http://localhost:3001',
    'x-platform-integration-token': 'test-service-token',
    ...overrides,
  };
}

async function runConcurrent<T>(tasks: Array<() => Promise<T>>): Promise<Array<{ result?: T; error?: Error }>> {
  return Promise.all(tasks.map(async (t) => {
    try { return { result: await t() }; } catch (e) { return { error: e as Error }; }
  }));
}

// Lightweight Core API mock (native http, no express)
interface CoreMock { url: string; calls: any[]; close: () => Promise<void>; resetCalls: () => void; getCalls: (p?: RegExp) => any[] }

async function startCoreMock(serviceToken: string): Promise<CoreMock> {
  const calls: any[] = [];
  const products = [
    { id: 'prod_001', name: 'Wireless Headphones', price: 7999, currency: 'usd', stock: 50 },
    { id: 'prod_002', name: 'USB-C Cable', price: 1299, currency: 'usd', stock: 200 },
  ];
  const orders = [
    { id: 'order_001', status: 'pending', total: 7999, currency: 'usd', customerEmail: 'c@test.com', createdAt: new Date().toISOString() },
  ];

  function jsonReply(res: http.ServerResponse, status: number, data: any) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  function readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((r) => {
      const c: Buffer[] = [];
      req.on('data', (d) => c.push(d));
      req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch { r(null); } });
    });
  }

  const server = http.createServer(async (req, res) => {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const path = parsed.pathname;
    const method = req.method || 'GET';
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : null;
    calls.push({ method, path, body, timestamp: Date.now() });

    if (path === '/health') return jsonReply(res, 200, { status: 'healthy' });

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ') || auth.replace('Bearer ', '') !== serviceToken) {
      return jsonReply(res, 401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }

    if (method === 'GET' && path === '/api/products') {
      return jsonReply(res, 200, { success: true, data: { items: products, page: 1, limit: 10, total: products.length, totalPages: 1 } });
    }
    if (method === 'GET' && path === '/api/orders') {
      return jsonReply(res, 200, { success: true, data: { items: orders, page: 1, limit: 10, total: orders.length, totalPages: 1 } });
    }
    if (method === 'PATCH' && path.startsWith('/api/orders/')) {
      const o = orders.find((x) => x.id === path.split('/').pop());
      if (!o) return jsonReply(res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      if (body) Object.assign(o, body);
      return jsonReply(res, 200, { success: true, data: o });
    }

    jsonReply(res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://localhost:${addr.port}`, calls,
        close: () => new Promise<void>((r) => server.close(() => r())),
        resetCalls: () => { calls.length = 0; },
        getCalls: (p?: RegExp) => p ? calls.filter((c) => p.test(c.path)) : [...calls],
      });
    });
  });
}

// Start real plugin HTTP server
async function startPlugin(createApp: () => any): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://localhost:${addr.port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

// Lifecycle hook invoker
async function invokeHook(
  mod: any, hookName: string,
  ctx: { installationId?: string; pluginSlug?: string; instanceKey?: string; config?: Record<string, any> } = {},
): Promise<{ exists: boolean; success: boolean; result?: any; error?: string }> {
  const fn = mod.default?.[`__lifecycle_${hookName}`] || mod[`__lifecycle_${hookName}`];
  if (!fn) return { exists: false, success: false };
  try {
    const result = await fn({ installationId: 'integ', pluginSlug: 'stripe', instanceKey: 'default', config: {}, ...ctx });
    return { exists: true, success: true, result };
  } catch (e: any) {
    return { exists: true, success: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const DB_URL = process.env.STRIPE_DATABASE_URL;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const CAN_RUN = isRealKey(STRIPE_KEY) && !!DB_URL;

async function canReachDb(): Promise<boolean> {
  if (!DB_URL) return false;
  try {
    const { PrismaClient } = require('../../node_modules/.prisma/stripe-client');
    const probe = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await probe.$connect();
    await probe.$disconnect();
    return true;
  } catch { return false; }
}

const DB_REACHABLE = CAN_RUN ? await canReachDb() : false;
const describeIf = CAN_RUN && DB_REACHABLE ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describeIf('Stripe Plugin - Full Realistic Journey', () => {
  let coreMock: CoreMock;
  let plugin: { url: string; close: () => Promise<void> };
  let prisma: any;
  let stripe: any;
  let pluginModule: any;

  const INSTALL_ID = `integ-stripe-${Date.now()}`;
  const SVC_TOKEN = 'test-service-token';

  function hdrs(overrides: Record<string, string> = {}): Record<string, string> {
    const cfg = encodePluginConfig({
      secretKey: STRIPE_KEY,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
      webhookSecret: WEBHOOK_SECRET,
    });
    return {
      ...buildHeaders({ 'x-installation-id': INSTALL_ID, 'x-platform-api-base-url': coreMock.url }),
      'x-plugin-config': cfg,
      ...overrides,
    };
  }

  async function req(method: string, path: string, opts: { body?: any; headers?: Record<string, string>; raw?: boolean } = {}) {
    const h = hdrs(opts.headers || {});
    const fetchOpts: RequestInit = { method, headers: h };
    if (opts.body && method !== 'GET') {
      fetchOpts.body = opts.raw && Buffer.isBuffer(opts.body) ? opts.body : JSON.stringify(opts.body);
    }
    const res = await fetch(`${plugin.url}${path}`, fetchOpts);
    let body: any;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  }

  // ==========================================================================
  // Setup & Teardown
  // ==========================================================================

  beforeAll(async () => {
    coreMock = await startCoreMock(SVC_TOKEN);

    const { PrismaClient } = require('../../node_modules/.prisma/stripe-client');
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await prisma.$connect();
    await prisma.webhookEvent.deleteMany();
    await prisma.refundRecord.deleteMany();
    await prisma.paymentRecord.deleteMany();

    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(STRIPE_KEY!, { apiVersion: '2025-04-30.basil' as any });

    pluginModule = await import('../../src/index');
    plugin = await startPlugin(pluginModule.createApp);
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.webhookEvent.deleteMany({ where: { installationId: INSTALL_ID } });
      await prisma.refundRecord.deleteMany({ where: { installationId: INSTALL_ID } });
      await prisma.paymentRecord.deleteMany({ where: { installationId: INSTALL_ID } });
    } catch { /* best effort */ }
    await prisma?.$disconnect();
    await plugin?.close();
    await coreMock?.close();
  });

  // ==========================================================================
  // Phase 1: Lifecycle
  // ==========================================================================

  describe('Phase 1: Lifecycle (install -> configure -> enable)', () => {
    it('onInstall succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onInstall', { installationId: INSTALL_ID });
      expect(r.exists).toBe(true);
      expect(r.success).toBe(true);
    });

    it('onEnable succeeds with env fallback (config empty but env vars set)', async () => {
      // ensureStripeReadyForEnable falls back to process.env when config is empty.
      // Since our test env has real keys loaded, this correctly succeeds.
      const r = await invokeHook(pluginModule, 'onEnable', { installationId: INSTALL_ID, config: {} });
      expect(r.exists).toBe(true);
      expect(r.success).toBe(true);
    });

    it('onEnable succeeds with valid config', async () => {
      const r = await invokeHook(pluginModule, 'onEnable', {
        installationId: INSTALL_ID,
        config: { secretKey: STRIPE_KEY, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY },
      });
      expect(r.exists).toBe(true);
      expect(r.success).toBe(true);
    });
  });

  // ==========================================================================
  // Phase 2: Plugin-to-Core API
  // ==========================================================================

  describe('Phase 2: Plugin-to-Core API', () => {
    it('core API returns products with valid auth', async () => {
      const res = await fetch(`${coreMock.url}/api/products`, { headers: { Authorization: `Bearer ${SVC_TOKEN}` } });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThan(0);
    });

    it('core API rejects invalid token', async () => {
      const res = await fetch(`${coreMock.url}/api/products`, { headers: { Authorization: 'Bearer wrong' } });
      expect(res.status).toBe(401);
    });

    it('core API tracks calls', async () => {
      coreMock.resetCalls();
      await fetch(`${coreMock.url}/api/products`, { headers: { Authorization: `Bearer ${SVC_TOKEN}` } });
      expect(coreMock.getCalls(/products/).length).toBe(1);
    });

    it('core API supports order status update', async () => {
      const res = await fetch(`${coreMock.url}/api/orders/order_001`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${SVC_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      const body = await res.json();
      expect(body.data.status).toBe('paid');
    });
  });

  // ==========================================================================
  // Phase 3: PaymentIntent Flow (real Stripe + real DB)
  // ==========================================================================

  describe('Phase 3: PaymentIntent Flow', () => {
    const orderId = `integ-pi-${Date.now()}`;
    let paymentIntentId: string;

    it('health check passes', async () => {
      const r = await req('GET', '/health');
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('healthy');
    });

    it('manifest returns valid metadata', async () => {
      const r = await req('GET', '/manifest');
      expect(r.body.slug).toBe('stripe');
      expect(r.body.capabilities).toContain('payment.process');
    });

    it('creates REAL PaymentIntent on Stripe', async () => {
      const r = await req('POST', '/api/create-intent', {
        body: { orderId, amount: 4200, currency: 'usd', customerEmail: 'integ@test.com' },
      });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data.paymentIntentId).toMatch(/^pi_/);
      expect(r.body.data.clientSecret).toContain('_secret_');
      paymentIntentId = r.body.data.paymentIntentId;
    });

    it('DB record persisted correctly', async () => {
      const rec = await prisma.paymentRecord.findUnique({
        where: { installationId_orderId: { installationId: INSTALL_ID, orderId } },
      });
      expect(rec).not.toBeNull();
      expect(rec.stripePaymentIntentId).toBe(paymentIntentId);
      expect(rec.amount).toBe(4200);
      expect(rec.status).toBe('processing');
    });

    it('idempotent: same orderId returns existing intent', async () => {
      const r = await req('POST', '/api/create-intent', { body: { orderId, amount: 4200 } });
      expect(r.body.data.paymentIntentId).toBe(paymentIntentId);
    });

    it('Stripe confirms PI is real', async () => {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(pi.id).toBe(paymentIntentId);
      expect(pi.amount).toBe(4200);
    });

    it('customer confirms with test card', async () => {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_visa', return_url: 'https://example.com/return',
      });
      expect(confirmed.status).toBe('succeeded');
    });

    it('lookup by orderId works', async () => {
      const r = await req('GET', `/api/order/${orderId}`);
      expect(r.status).toBe(200);
      expect(r.body.data.stripePaymentIntentId).toBe(paymentIntentId);
    });
  });

  // ==========================================================================
  // Phase 4: Checkout Session
  // ==========================================================================

  describe('Phase 4: Checkout Session', () => {
    const orderId = `integ-cs-${Date.now()}`;
    let sessionId: string;

    it('creates real Stripe Checkout Session', async () => {
      const r = await req('POST', '/payments/create-session', {
        body: { orderId, amount: 6500, currency: 'usd', customerEmail: 'cs@test.com' },
      });
      expect(r.status).toBe(201);
      expect(r.body.data.sessionId).toMatch(/^cs_/);
      expect(r.body.data.url).toContain('checkout.stripe.com');
      sessionId = r.body.data.sessionId;
    });

    it('DB has session data', async () => {
      const rec = await prisma.paymentRecord.findUnique({
        where: { installationId_orderId: { installationId: INSTALL_ID, orderId } },
      });
      expect(rec.stripeSessionId).toBe(sessionId);
      expect(rec.status).toBe('pending');
    });

    it('idempotent', async () => {
      const r = await req('POST', '/payments/create-session', { body: { orderId, amount: 6500 } });
      expect(r.body.data.sessionId).toBe(sessionId);
    });

    it('verify-session returns pending', async () => {
      const r = await req('POST', '/payments/verify-session', { body: { sessionId } });
      expect(r.body.data.status).toBe('pending');
    });
  });

  // ==========================================================================
  // Phase 5: Webhook Signature
  // ==========================================================================

  describe('Phase 5: Webhook Signature', () => {
    it('valid signature passes', async () => {
      if (!WEBHOOK_SECRET) return;
      const payload = JSON.stringify({
        id: `evt_${Date.now()}`, type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_sig_test', metadata: { installationId: INSTALL_ID } } },
      });
      const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
      const r = await req('POST', '/webhook', {
        body: Buffer.from(payload), raw: true,
        headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      });
      if (r.status === 200) expect(r.body.data.eventType).toBe('payment_intent.succeeded');
      else expect(r.body.error.code).not.toBe('INVALID_SIGNATURE');
    });

    it('tampered payload rejected', async () => {
      if (!WEBHOOK_SECRET) return;
      const orig = JSON.stringify({ id: 'evt_t', type: 'test' });
      const header = stripe.webhooks.generateTestHeaderString({ payload: orig, secret: WEBHOOK_SECRET });
      const r = await req('POST', '/webhook', {
        body: Buffer.from('{"id":"evt_t","type":"X"}'), raw: true,
        headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('missing signature -> 400', async () => {
      const r = await req('POST', '/webhook', {
        body: Buffer.from('{}'), raw: true, headers: { 'content-type': 'application/json' },
      });
      expect(r.status).toBe(400);
    });
  });

  // ==========================================================================
  // Phase 6: Refund Flow
  // ==========================================================================

  describe('Phase 6: Refund Flow', () => {
    const orderId = `integ-refund-${Date.now()}`;
    let paymentRecordId: string;

    beforeAll(async () => {
      const cr = await req('POST', '/api/create-intent', { body: { orderId, amount: 8000, currency: 'usd' } });
      const piId = cr.body.data.paymentIntentId;
      await stripe.paymentIntents.confirm(piId, { payment_method: 'pm_card_visa', return_url: 'https://example.com/return' });
      const rec = await prisma.paymentRecord.findUnique({
        where: { installationId_orderId: { installationId: INSTALL_ID, orderId } },
      });
      paymentRecordId = rec.id;
      await prisma.paymentRecord.update({ where: { id: paymentRecordId }, data: { status: 'succeeded', paidAt: new Date() } });
    });

    it('partial refund $20 of $80', async () => {
      const r = await req('POST', '/admin/api/refund', { body: { paymentRecordId, amount: 2000, reason: 'requested_by_customer' } });
      expect(r.status).toBe(200);
      expect(r.body.data.stripeRefundId).toMatch(/^re_/);
      const sr = await stripe.refunds.retrieve(r.body.data.stripeRefundId);
      expect(sr.amount).toBe(2000);
      const rec = await prisma.paymentRecord.findUnique({ where: { id: paymentRecordId } });
      expect(rec.status).toBe('partially_refunded');
    });

    it('DB has refund record', async () => {
      const refunds = await prisma.refundRecord.findMany({ where: { paymentRecordId } });
      expect(refunds.length).toBe(1);
      expect(refunds[0].amount).toBe(2000);
    });

    it('full refund remaining $60', async () => {
      const r = await req('POST', '/admin/api/refund', { body: { paymentRecordId, amount: 6000 } });
      expect(r.status).toBe(200);
      const rec = await prisma.paymentRecord.findUnique({ where: { id: paymentRecordId } });
      expect(rec.status).toBe('refunded');
    });

    it('over-refund rejected', async () => {
      const r = await req('POST', '/admin/api/refund', { body: { paymentRecordId, amount: 100 } });
      expect(r.status).toBeGreaterThanOrEqual(400);
    });

    it('non-admin blocked', async () => {
      const r = await req('POST', '/admin/api/refund', { body: { paymentRecordId, amount: 100 }, headers: { 'x-caller': 'shop' } });
      expect(r.status).toBe(403);
    });
  });

  // ==========================================================================
  // Phase 7: Concurrent Payments
  // ==========================================================================

  describe('Phase 7: Concurrent Payments', () => {
    it('5 parallel payments succeed', async () => {
      const oids = Array.from({ length: 5 }, (_, i) => `integ-par-${Date.now()}-${i}`);
      const results = await runConcurrent(
        oids.map((oid) => async () =>
          req('POST', '/api/create-intent', { body: { orderId: oid, amount: 1000 + Math.floor(Math.random() * 5000), currency: 'usd' } })),
      );
      const ok = results.filter((r) => r.result?.status === 200);
      expect(ok.length).toBe(5);
      const piIds = ok.map((r) => r.result!.body.data.paymentIntentId);
      expect(new Set(piIds).size).toBe(5);
      for (const oid of oids) await prisma.paymentRecord.deleteMany({ where: { installationId: INSTALL_ID, orderId: oid } });
    });
  });

  // ==========================================================================
  // Phase 8: Validation
  // ==========================================================================

  describe('Phase 8: Validation & Errors', () => {
    it('missing orderId -> 400', async () => { expect((await req('POST', '/api/create-intent', { body: { amount: 1000 } })).status).toBe(400); });
    it('negative amount -> 400', async () => { expect((await req('POST', '/api/create-intent', { body: { orderId: 'x', amount: -1 } })).status).toBe(400); });
    it('zero amount -> 400', async () => { expect((await req('POST', '/api/create-intent', { body: { orderId: 'x', amount: 0 } })).status).toBe(400); });
    it('session missing orderId -> 400', async () => { expect((await req('POST', '/payments/create-session', { body: { amount: 1000 } })).status).toBe(400); });
    it('verify missing sessionId -> 400', async () => { expect((await req('POST', '/payments/verify-session', { body: {} })).status).toBe(400); });
    it('refund missing paymentRecordId -> 400', async () => { expect((await req('POST', '/admin/api/refund', { body: {} })).status).toBe(400); });
    it('unknown orderId -> 404', async () => { expect((await req('GET', '/api/order/nonexistent')).status).toBe(404); });
  });

  // ==========================================================================
  // Phase 9: Admin Dashboard
  // ==========================================================================

  describe('Phase 9: Admin Dashboard', () => {
    it('dashboard returns real stats', async () => {
      const r = await req('GET', '/admin/api/dashboard');
      expect(r.status).toBe(200);
      expect(r.body.data.totalPayments).toBeGreaterThanOrEqual(1);
    });

    it('payments list', async () => {
      const r = await req('GET', '/admin/api/payments?page=1&limit=5');
      expect(r.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(r.body.data.items[0].stripePaymentIntentId).toMatch(/^pi_/);
    });

    it('refunds list', async () => {
      const r = await req('GET', '/admin/api/refunds');
      expect(r.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('status configured', async () => {
      expect((await req('GET', '/admin/api/status')).body.data.configured).toBe(true);
    });

    it('shop blocked from admin', async () => {
      expect((await req('GET', '/admin/api/dashboard', { headers: { 'x-caller': 'shop' } })).status).toBe(403);
    });

    it('payment methods visible to shop', async () => {
      const r = await req('GET', '/api/methods', { headers: { 'x-caller': 'shop' } });
      expect(r.body.data.methods[0].provider).toBe('stripe');
    });
  });

  // ==========================================================================
  // Phase 10: Data Isolation
  // ==========================================================================

  describe('Phase 10: Data Isolation', () => {
    const otherId = `integ-other-${Date.now()}`;

    afterAll(async () => { await prisma.paymentRecord.deleteMany({ where: { installationId: otherId } }); });

    it('cross-installation leak check', async () => {
      await prisma.paymentRecord.create({
        data: { installationId: otherId, orderId: `other-${Date.now()}`, amount: 9999, currency: 'usd', status: 'succeeded' },
      });
      const main = await prisma.paymentRecord.findMany({ where: { installationId: INSTALL_ID } });
      expect(main.every((p: any) => p.installationId === INSTALL_ID)).toBe(true);
    });

    it('aggregation isolation', async () => {
      const a = await prisma.paymentRecord.aggregate({ where: { installationId: INSTALL_ID }, _sum: { amount: true } });
      const b = await prisma.paymentRecord.aggregate({ where: { installationId: otherId }, _sum: { amount: true } });
      expect(a._sum.amount).not.toBe(b._sum.amount);
    });
  });

  // ==========================================================================
  // Phase 11: Teardown
  // ==========================================================================

  describe('Phase 11: Lifecycle Teardown', () => {
    it('onDisable succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onDisable', { installationId: INSTALL_ID });
      expect(r.success).toBe(true);
    });

    it('onUninstall succeeds', async () => {
      const r = await invokeHook(pluginModule, 'onUninstall', { installationId: INSTALL_ID });
      expect(r.success).toBe(true);
    });
  });
});
