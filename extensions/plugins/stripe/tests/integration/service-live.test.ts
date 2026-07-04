/**
 * Stripe plugin - LIVE end-to-end integration tests.
 *
 * Tests the plugin's HTTP routes against REAL Stripe APIs + REAL PostgreSQL.
 * This exercises the full stack: route -> service -> Stripe SDK -> DB.
 *
 * Requirements:
 *   - STRIPE_SECRET_KEY       (sk_test_...)
 *   - STRIPE_DATABASE_URL     (postgresql://...)
 *   - STRIPE_WEBHOOK_SECRET   (whsec_...)
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...)
 *
 * No real money is charged - Stripe test mode only.
 * Tests are automatically skipped when credentials are missing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadLiveTestEnv } from '../../../../../tests/shared/live-test-env';

// Load .env.test BEFORE any plugin module is imported
loadLiveTestEnv(__dirname);

function isRealKey(key: string | undefined): boolean {
  return !!key && !key.includes('placeholder') && key.length > 10;
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const DB_URL = process.env.STRIPE_DATABASE_URL;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const CAN_RUN = isRealKey(STRIPE_KEY) && !!DB_URL;

// Pre-check DB reachability so the entire suite skips cleanly when DB is down.
async function canReachDb(): Promise<boolean> {
  if (!DB_URL) return false;
  try {
    const { PrismaClient } = require('../../node_modules/.prisma/stripe-client');
    const probe = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await probe.$connect();
    await probe.$disconnect();
    return true;
  } catch {
    return false;
  }
}

// Resolve before describe so we can skip immediately
const DB_REACHABLE = CAN_RUN ? await canReachDb() : false;
const describeIf = (CAN_RUN && DB_REACHABLE) ? describe : describe.skip;

describeIf('[LIVE] Stripe Plugin End-to-End', () => {
  let app: any;
  let stripe: any;
  let prisma: any;
  const INSTALLATION_ID = `live-e2e-${Date.now()}`;

  beforeAll(async () => {
    const { PrismaClient } = require('../../node_modules/.prisma/stripe-client');
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await prisma.$connect();

    // Clean slate: wipe all tables before this suite runs
    await prisma.webhookEvent.deleteMany();
    await prisma.refundRecord.deleteMany();
    await prisma.paymentRecord.deleteMany();

    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(STRIPE_KEY!, { apiVersion: '2025-04-30.basil' as any });

    // Create the plugin Express app (uses its own internal prisma/stripe)
    const mod = await import('../../src/index');
    app = mod.createApp();
  });

  afterAll(async () => {
    try {
      await prisma.webhookEvent.deleteMany({ where: { installationId: INSTALLATION_ID } });
      await prisma.refundRecord.deleteMany({ where: { installationId: INSTALLATION_ID } });
      await prisma.paymentRecord.deleteMany({ where: { installationId: INSTALLATION_ID } });
    } catch { /* cleanup best-effort */ }
    await prisma.$disconnect();
  });

  // -- Helpers ---------------------------------------------------------------

  function headers(overrides: Record<string, string> = {}): Record<string, string> {
    const cfg = Buffer.from(JSON.stringify({
      secretKey: STRIPE_KEY,
      webhookSecret: WEBHOOK_SECRET,
    })).toString('base64url');

    return {
      'content-type': 'application/json',
      'x-platform-id': 'live-platform',
      'x-plugin-slug': 'stripe',
      'x-installation-id': INSTALLATION_ID,
      'x-caller': 'admin',
      'x-plugin-config': cfg,
      ...overrides,
    };
  }

  async function inject(method: string, url: string, opts: { body?: any; headers?: Record<string, string> } = {}) {
    const lmr = (await import('light-my-request')).default;
    const res = await lmr(app as any, {
      method: method as any,
      url,
      headers: headers(opts.headers || {}) as any,
      payload: opts.body ? (Buffer.isBuffer(opts.body) ? opts.body : JSON.stringify(opts.body)) : undefined,
    } as any);
    let body: any;
    try { body = JSON.parse(res.payload); } catch { body = res.payload; }
    return { status: res.statusCode, body };
  }

  // ==========================================================================
  // Phase 1: Health & Configuration
  // ==========================================================================

  describe('Phase 1: Health & Config', () => {
    it('GET /health returns healthy', async () => {
      const res = await inject('GET', '/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.plugin).toBe('stripe');
    });

    it('GET /manifest returns valid metadata', async () => {
      const res = await inject('GET', '/manifest');
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('stripe');
      expect(res.body.capabilities).toContain('payment.process');
    });

    it('GET /admin/api/status shows configured=true with real keys', async () => {
      const res = await inject('GET', '/admin/api/status');
      expect(res.status).toBe(200);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.apiReady).toBe(true);
    });

    it('GET /api/methods returns card payment method', async () => {
      const res = await inject('GET', '/api/methods', { headers: { 'x-caller': 'shop' } });
      expect(res.status).toBe(200);
      expect(res.body.data.methods[0].type).toBe('card');
      expect(res.body.data.methods[0].provider).toBe('stripe');
    });
  });

  // ==========================================================================
  // Phase 2: PaymentIntent Flow (create -> DB check -> idempotent)
  // ==========================================================================

  describe('Phase 2: PaymentIntent Flow', () => {
    const orderId = `live-pi-${Date.now()}`;
    let paymentIntentId: string;

    it('POST /api/create-intent creates a real Stripe PaymentIntent', async () => {
      const res = await inject('POST', '/api/create-intent', {
        body: { orderId, amount: 2500, currency: 'usd', customerEmail: 'live@test.com' },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentIntentId).toMatch(/^pi_/);
      expect(res.body.data.clientSecret).toContain('_secret_');
      expect(res.body.data.amount).toBe(2500);
      expect(res.body.data.currency).toBe('usd');

      paymentIntentId = res.body.data.paymentIntentId;
    });

    it('DB record is persisted', async () => {
      const rec = await prisma.paymentRecord.findUnique({
        where: { installationId_orderId: { installationId: INSTALLATION_ID, orderId } },
      });
      expect(rec).not.toBeNull();
      expect(rec.stripePaymentIntentId).toBe(paymentIntentId);
      expect(rec.amount).toBe(2500);
      expect(rec.status).toBe('processing');
    });

    it('same order returns existing intent (idempotent)', async () => {
      const res = await inject('POST', '/api/create-intent', {
        body: { orderId, amount: 2500 },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.paymentIntentId).toBe(paymentIntentId);
    });

    it('Stripe confirms the PaymentIntent is real', async () => {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      expect(pi.id).toBe(paymentIntentId);
      expect(pi.amount).toBe(2500);
      expect(pi.metadata.orderId).toBe(orderId);
    });
  });

  // ==========================================================================
  // Phase 3: Checkout Session Flow
  // ==========================================================================

  describe('Phase 3: Checkout Session Flow', () => {
    const orderId = `live-cs-${Date.now()}`;
    let sessionId: string;

    it('POST /payments/create-session creates a real Checkout Session', async () => {
      const res = await inject('POST', '/payments/create-session', {
        body: { orderId, amount: 3500, currency: 'usd', customerEmail: 'session@test.com' },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toMatch(/^cs_/);
      expect(res.body.data.url).toContain('checkout.stripe.com');
      expect(res.body.data.expiresAt).toBeDefined();

      sessionId = res.body.data.sessionId;
    });

    it('DB record is persisted with session data', async () => {
      const rec = await prisma.paymentRecord.findUnique({
        where: { installationId_orderId: { installationId: INSTALLATION_ID, orderId } },
      });
      expect(rec).not.toBeNull();
      expect(rec.stripeSessionId).toBe(sessionId);
      expect(rec.stripeSessionUrl).toContain('checkout.stripe.com');
      expect(rec.status).toBe('pending');
    });

    it('same order returns existing session (idempotent)', async () => {
      const res = await inject('POST', '/payments/create-session', {
        body: { orderId, amount: 3500 },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.sessionId).toBe(sessionId);
    });

    it('POST /payments/verify-session returns pending (not yet paid)', async () => {
      const res = await inject('POST', '/payments/verify-session', {
        body: { sessionId },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });
  });

  // ==========================================================================
  // Phase 4: Full pay + refund cycle
  // ==========================================================================

  describe('Phase 4: Pay -> Refund Cycle', () => {
    const orderId = `live-refund-${Date.now()}`;
    let paymentIntentId: string;
    let paymentRecordId: string;

    it('creates and confirms a payment (simulates full checkout)', async () => {
      // Step 1: Plugin creates intent
      const createRes = await inject('POST', '/api/create-intent', {
        body: { orderId, amount: 5000, currency: 'usd' },
      });
      paymentIntentId = createRes.body.data.paymentIntentId;

      // Step 2: Customer confirms via Stripe (simulates frontend Stripe.js)
      const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_visa',
        return_url: 'https://example.com/return',
      });
      expect(confirmed.status).toBe('succeeded');

      // Step 3: Lookup the DB record
      const rec = await prisma.paymentRecord.findUnique({
        where: { installationId_orderId: { installationId: INSTALLATION_ID, orderId } },
      });
      paymentRecordId = rec.id;

      // Manually update status (in real flow, webhook would do this)
      await prisma.paymentRecord.update({
        where: { id: paymentRecordId },
        data: { status: 'succeeded', paidAt: new Date() },
      });
    });

    it('admin creates a partial refund via plugin API', async () => {
      const res = await inject('POST', '/admin/api/refund', {
        body: { paymentRecordId, amount: 2000, reason: 'requested_by_customer' },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stripeRefundId).toMatch(/^re_/);
      expect(res.body.data.amount).toBe(2000);
      expect(res.body.data.status).toBe('succeeded');

      // DB record should be partially_refunded
      const rec = await prisma.paymentRecord.findUnique({ where: { id: paymentRecordId } });
      expect(rec.status).toBe('partially_refunded');
    });

    it('admin refunds the remaining amount', async () => {
      const res = await inject('POST', '/admin/api/refund', {
        body: { paymentRecordId, amount: 3000 },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.stripeRefundId).toMatch(/^re_/);

      // DB record should be fully refunded
      const rec = await prisma.paymentRecord.findUnique({ where: { id: paymentRecordId } });
      expect(rec.status).toBe('refunded');
    });

    it('over-refund is rejected', async () => {
      const res = await inject('POST', '/admin/api/refund', {
        body: { paymentRecordId, amount: 100 },
      });

      // Should be 400 (cannot refund) or 404 (status check)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ==========================================================================
  // Phase 5: Webhook Signature Verification (real Stripe SDK)
  // ==========================================================================

  describe('Phase 5: Webhook Signature', () => {
    it('valid signature passes verification', async () => {
      if (!WEBHOOK_SECRET) return;

      const payload = JSON.stringify({
        id: `evt_live_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_fake_sig_test', metadata: { installationId: INSTALLATION_ID } } },
      });

      const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

      const res = await inject('POST', '/webhook', {
        body: Buffer.from(payload),
        headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      });

      // The event will be verified, but DB update for pi_fake_sig_test may fail.
      // Key assertion: signature verification passed (not 400 INVALID_SIGNATURE).
      if (res.status === 200) {
        expect(res.body.data.eventType).toBe('payment_intent.succeeded');
      } else {
        // 500 = handler failed (DB), but signature was OK
        expect(res.body.error.code).not.toBe('INVALID_SIGNATURE');
      }
    });

    it('tampered payload is rejected', async () => {
      if (!WEBHOOK_SECRET) return;

      const original = JSON.stringify({ id: 'evt_tamper', type: 'test' });
      const header = stripe.webhooks.generateTestHeaderString({ payload: original, secret: WEBHOOK_SECRET });

      const res = await inject('POST', '/webhook', {
        body: Buffer.from('{"id":"evt_tamper","type":"HACKED"}'),
        headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('missing signature header returns 400', async () => {
      const res = await inject('POST', '/webhook', {
        body: Buffer.from('{}'),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // Phase 6: Admin Dashboard (real data)
  // ==========================================================================

  describe('Phase 6: Admin Dashboard', () => {
    it('GET /admin/api/dashboard returns real aggregated stats', async () => {
      const res = await inject('GET', '/admin/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.totalPayments).toBe('number');
      expect(res.body.data.totalPayments).toBeGreaterThanOrEqual(1);
    });

    it('GET /admin/api/payments lists real payment records', async () => {
      const res = await inject('GET', '/admin/api/payments');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].stripePaymentIntentId).toMatch(/^pi_/);
    });

    it('GET /admin/api/refunds lists real refund records', async () => {
      const res = await inject('GET', '/admin/api/refunds');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].stripeRefundId).toMatch(/^re_/);
    });

    it('non-admin is blocked', async () => {
      const res = await inject('GET', '/admin/api/dashboard', {
        headers: { 'x-caller': 'shop' },
      });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // Phase 7: Input Validation (real server, real error handling)
  // ==========================================================================

  describe('Phase 7: Input Validation', () => {
    it('create-intent rejects missing orderId', async () => {
      const res = await inject('POST', '/api/create-intent', { body: { amount: 1000 } });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('create-intent rejects negative amount', async () => {
      const res = await inject('POST', '/api/create-intent', { body: { orderId: 'x', amount: -1 } });
      expect(res.status).toBe(400);
    });

    it('create-session rejects missing orderId', async () => {
      const res = await inject('POST', '/payments/create-session', { body: { amount: 1000 } });
      expect(res.status).toBe(400);
    });

    it('verify-session rejects missing sessionId', async () => {
      const res = await inject('POST', '/payments/verify-session', { body: {} });
      expect(res.status).toBe(400);
    });

    it('refund rejects missing paymentRecordId', async () => {
      const res = await inject('POST', '/admin/api/refund', { body: {} });
      expect(res.status).toBe(400);
    });
  });
});
