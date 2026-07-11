import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  paymentRecord: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
}));

const mockCheckoutSessions = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
}));

const mockStripe = vi.hoisted(() => ({
  checkout: { sessions: mockCheckoutSessions },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => mockStripe),
}));

import { SessionService } from '../../src/services/session.service';

const service = new SessionService();

const INSTALLATION_ID = 'ins_1';

function fakeExistingPayment(overrides: Record<string, any> = {}) {
  return {
    id: 'pay_1',
    installationId: INSTALLATION_ID,
    orderId: 'order_1',
    stripeSessionId: 'cs_existing',
    stripeSessionUrl: 'https://checkout.stripe.com/existing',
    stripePaymentIntentId: 'pi_existing',
    status: 'pending',
    sessionExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
    amount: 5000,
    currency: 'usd',
    ...overrides,
  };
}

// ============================================================================
// createSession
// ============================================================================

describe('SessionService.createSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new Stripe Checkout Session for a new order', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_new',
      url: 'https://checkout.stripe.com/new',
      payment_intent: 'pi_new',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    const result = await service.createSession(INSTALLATION_ID, {
      orderId: 'order_new',
      amount: 9999,
      currency: 'eur',
      customerEmail: 'buyer@test.com',
    });

    expect(result.sessionId).toBe('cs_new');
    expect(result.url).toBe('https://checkout.stripe.com/new');
    expect(result.paymentIntentId).toBe('pi_new');
    expect(result.expiresAt).toBeDefined();

    expect(mockCheckoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'eur',
              unit_amount: 9999,
            }),
            quantity: 1,
          }),
        ],
        customer_email: 'buyer@test.com',
        metadata: expect.objectContaining({
          orderId: 'order_new',
          installationId: INSTALLATION_ID,
        }),
      }),
    );

    expect(mockPrisma.paymentRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          installationId_orderId: {
            installationId: INSTALLATION_ID,
            orderId: 'order_new',
          },
        },
      }),
    );
  });

  it('returns existing session when a non-expired pending session exists (idempotent)', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(fakeExistingPayment());

    const result = await service.createSession(INSTALLATION_ID, {
      orderId: 'order_1',
      amount: 5000,
    });

    expect(result.sessionId).toBe('cs_existing');
    expect(result.url).toBe('https://checkout.stripe.com/existing');
    expect(result.paymentIntentId).toBe('pi_existing');
    expect(mockCheckoutSessions.create).not.toHaveBeenCalled();
    expect(mockPrisma.paymentRecord.upsert).not.toHaveBeenCalled();
  });

  it('creates new session when existing session has expired', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(
      fakeExistingPayment({
        sessionExpiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      }),
    );
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_renewed',
      url: 'https://checkout.stripe.com/renewed',
      payment_intent: 'pi_renewed',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    const result = await service.createSession(INSTALLATION_ID, {
      orderId: 'order_1',
      amount: 5000,
    });

    expect(result.sessionId).toBe('cs_renewed');
    expect(mockCheckoutSessions.create).toHaveBeenCalled();
  });

  it('creates new session when existing payment is not pending', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(
      fakeExistingPayment({ status: 'succeeded' }),
    );
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_retry',
      url: 'https://checkout.stripe.com/retry',
      payment_intent: 'pi_retry',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    const result = await service.createSession(INSTALLATION_ID, {
      orderId: 'order_1',
      amount: 5000,
    });

    expect(result.sessionId).toBe('cs_retry');
    expect(mockCheckoutSessions.create).toHaveBeenCalled();
  });

  it('defaults currency to usd when not provided', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_usd',
      url: 'https://checkout.stripe.com/usd',
      payment_intent: 'pi_usd',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    await service.createSession(INSTALLATION_ID, {
      orderId: 'order_usd',
      amount: 1000,
    });

    expect(mockCheckoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ currency: 'usd' }),
          }),
        ],
      }),
    );
  });

  it('handles payment_intent as object in Stripe response', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_obj',
      url: 'https://checkout.stripe.com/obj',
      payment_intent: { id: 'pi_obj_value' },
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    const result = await service.createSession(INSTALLATION_ID, {
      orderId: 'order_obj',
      amount: 2000,
    });

    expect(result.paymentIntentId).toBe('pi_obj_value');
  });

  it('handles null payment_intent in Stripe response', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_null_pi',
      url: 'https://checkout.stripe.com/null',
      payment_intent: null,
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    const result = await service.createSession(INSTALLATION_ID, {
      orderId: 'order_null',
      amount: 3000,
    });

    expect(result.paymentIntentId).toBeNull();
  });

  it('includes idempotencyKey in metadata when provided', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_idem',
      url: 'https://checkout.stripe.com/idem',
      payment_intent: 'pi_idem',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    await service.createSession(INSTALLATION_ID, {
      orderId: 'order_idem',
      amount: 1000,
      idempotencyKey: 'idem_key_123',
    });

    expect(mockCheckoutSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          idempotencyKey: 'idem_key_123',
        }),
      }),
    );
  });

  it('passes secretKey to getStripeClient', async () => {
    const { getStripeClient } = await import('../../src/lib/stripe-client');
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockCheckoutSessions.create.mockResolvedValue({
      id: 'cs_sk',
      url: 'https://checkout.stripe.com/sk',
      payment_intent: 'pi_sk',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue({});

    await service.createSession(INSTALLATION_ID, {
      orderId: 'order_sk',
      amount: 1000,
    }, 'sk_custom_key');

    expect(getStripeClient).toHaveBeenCalledWith('sk_custom_key');
  });
});

// ============================================================================
// verifySession
// ============================================================================

describe('SessionService.verifySession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paid status when payment_status is paid', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_paid',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_paid',
      metadata: { orderId: 'order_v1', installationId: INSTALLATION_ID },
    });
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    const result = await service.verifySession('cs_paid');

    expect(result.status).toBe('paid');
    expect(result.paymentIntentId).toBe('pi_paid');
    expect(result.eventId).toBe('session:cs_paid:paid');
  });

  it('updates local payment record when session is paid', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_update',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_update',
      metadata: { orderId: 'order_update', installationId: INSTALLATION_ID },
    });
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    await service.verifySession('cs_update');

    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: {
        installationId_orderId: {
          installationId: INSTALLATION_ID,
          orderId: 'order_update',
        },
      },
      data: expect.objectContaining({
        status: 'succeeded',
        stripePaymentIntentId: 'pi_update',
        paidAt: expect.any(Date),
      }),
    });
  });

  it('returns expired status when session.status is expired', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_expired',
      status: 'expired',
      payment_status: 'unpaid',
      payment_intent: 'pi_expired',
      metadata: {},
    });

    const result = await service.verifySession('cs_expired');

    expect(result.status).toBe('expired');
    expect(mockPrisma.paymentRecord.update).not.toHaveBeenCalled();
  });

  it('returns pending status when complete but unpaid', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_pending',
      status: 'complete',
      payment_status: 'unpaid',
      payment_intent: 'pi_pending',
      metadata: {},
    });

    const result = await service.verifySession('cs_pending');

    expect(result.status).toBe('pending');
  });

  it('returns pending status for open session', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_open',
      status: 'open',
      payment_status: 'unpaid',
      payment_intent: null,
      metadata: {},
    });

    const result = await service.verifySession('cs_open');

    expect(result.status).toBe('pending');
    expect(result.paymentIntentId).toBeNull();
  });

  it('handles payment_intent as object', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_obj',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: { id: 'pi_obj_verify' },
      metadata: { orderId: 'order_obj', installationId: INSTALLATION_ID },
    });
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    const result = await service.verifySession('cs_obj');

    expect(result.paymentIntentId).toBe('pi_obj_verify');
  });

  it('gracefully handles DB update failure on paid session', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_db_fail',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_db_fail',
      metadata: { orderId: 'order_db_fail', installationId: INSTALLATION_ID },
    });
    mockPrisma.paymentRecord.update.mockRejectedValue(
      new Error('Record not found'),
    );

    // Should NOT throw - DB failure is non-critical
    const result = await service.verifySession('cs_db_fail');

    expect(result.status).toBe('paid');
    expect(result.paymentIntentId).toBe('pi_db_fail');
  });

  it('uses default installationId when metadata is missing', async () => {
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_no_meta',
      status: 'complete',
      payment_status: 'paid',
      payment_intent: 'pi_no_meta',
      metadata: { orderId: 'order_no_meta' },
    });
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    await service.verifySession('cs_no_meta');

    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          installationId_orderId: {
            installationId: 'default',
            orderId: 'order_no_meta',
          },
        },
      }),
    );
  });

  it('passes secretKey to getStripeClient', async () => {
    const { getStripeClient } = await import('../../src/lib/stripe-client');
    mockCheckoutSessions.retrieve.mockResolvedValue({
      id: 'cs_sk',
      status: 'open',
      payment_status: 'unpaid',
      payment_intent: null,
      metadata: {},
    });

    await service.verifySession('cs_sk', 'sk_verify_key');

    expect(getStripeClient).toHaveBeenCalledWith('sk_verify_key');
  });
});
