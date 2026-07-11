import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  webhookEvent: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  paymentRecord: {
    update: vi.fn(),
  },
}));

const mockStripeWebhooks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
}));

const mockStripe = vi.hoisted(() => ({
  webhooks: mockStripeWebhooks,
}));

const mockPaymentService = vi.hoisted(() => ({
  updatePaymentStatus: vi.fn(),
}));

const mockRefundService = vi.hoisted(() => ({
  updateRefundStatus: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => mockStripe),
}));
vi.mock('../../src/services/payment.service', () => ({
  paymentService: mockPaymentService,
}));
vi.mock('../../src/services/refund.service', () => ({
  refundService: mockRefundService,
}));

import { WebhookService } from '../../src/services/webhook.service';

const service = new WebhookService();

const RAW_BODY = Buffer.from('{}');
const SIGNATURE = 'sig_test_abc';
const WEBHOOK_SECRET = 'whsec_test_123';

function fakeStripeEvent(type: string, data: any, id = 'evt_test_1') {
  return {
    id,
    type,
    data: {
      object: data,
    },
  };
}

// ============================================================================
// payment_intent.succeeded
// ============================================================================

describe('WebhookService.verifyAndHandle - payment_intent.succeeded', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles payment_intent.succeeded event', async () => {
    const event = fakeStripeEvent('payment_intent.succeeded', {
      id: 'pi_succ',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result).toMatchObject({
      received: true,
      eventType: 'payment_intent.succeeded',
      handled: true,
      normalizedStatus: 'ignored',
      providerEventId: 'evt_test_1',
      sessionId: null,
    });
    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_succ',
      'succeeded',
      { paidAt: expect.any(Date) },
    );
    expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_test_1' },
      data: { processed: true },
    });
  });
});

// ============================================================================
// payment_intent.payment_failed
// ============================================================================

describe('WebhookService.verifyAndHandle - payment_intent.payment_failed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles payment_intent.payment_failed event', async () => {
    const event = fakeStripeEvent('payment_intent.payment_failed', {
      id: 'pi_failed',
      metadata: { installationId: 'ins_1' },
      last_payment_error: { message: 'Card was declined' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(result.eventType).toBe('payment_intent.payment_failed');
    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_failed',
      'failed',
      { errorMessage: 'Card was declined' },
    );
  });

  it('uses default error message when last_payment_error is missing', async () => {
    const event = fakeStripeEvent('payment_intent.payment_failed', {
      id: 'pi_failed_no_msg',
      metadata: { installationId: 'ins_1' },
      last_payment_error: null,
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_failed_no_msg',
      'failed',
      { errorMessage: 'Payment failed' },
    );
  });
});

// ============================================================================
// payment_intent.canceled
// ============================================================================

describe('WebhookService.verifyAndHandle - payment_intent.canceled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles payment_intent.canceled event', async () => {
    const event = fakeStripeEvent('payment_intent.canceled', {
      id: 'pi_canceled',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_canceled',
      'canceled',
    );
  });
});

// ============================================================================
// charge.refunded
// ============================================================================

describe('WebhookService.verifyAndHandle - charge.refunded', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles full refund (charge.refunded = true)', async () => {
    const event = fakeStripeEvent('charge.refunded', {
      payment_intent: 'pi_refunded',
      refunded: true,
      amount_refunded: 5000,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_refunded',
      'refunded',
    );
  });

  it('handles partial refund (amount_refunded > 0 but not fully refunded)', async () => {
    const event = fakeStripeEvent('charge.refunded', {
      payment_intent: 'pi_partial',
      refunded: false,
      amount_refunded: 2000,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_partial',
      'partially_refunded',
    );
  });

  it('handles payment_intent as object instead of string', async () => {
    const event = fakeStripeEvent('charge.refunded', {
      payment_intent: { id: 'pi_obj' },
      refunded: true,
      amount_refunded: 5000,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pi_obj',
      'refunded',
    );
  });

  it('does nothing when charge has no payment_intent', async () => {
    const event = fakeStripeEvent('charge.refunded', {
      payment_intent: null,
      refunded: true,
      amount_refunded: 5000,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockPaymentService.updatePaymentStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// charge.refund.updated
// ============================================================================

describe('WebhookService.verifyAndHandle - charge.refund.updated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates refund status to succeeded', async () => {
    const event = fakeStripeEvent('charge.refund.updated', {
      id: 're_updated',
      status: 'succeeded',
      failure_reason: null,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockRefundService.updateRefundStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockRefundService.updateRefundStatus).toHaveBeenCalledWith(
      're_updated',
      'succeeded',
      undefined,
    );
  });

  it('updates refund status to failed with failure_reason', async () => {
    const event = fakeStripeEvent('charge.refund.updated', {
      id: 're_failed',
      status: 'failed',
      failure_reason: 'expired_or_canceled_card',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockRefundService.updateRefundStatus.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockRefundService.updateRefundStatus).toHaveBeenCalledWith(
      're_failed',
      'failed',
      'expired_or_canceled_card',
    );
  });

  it('maps unknown refund status to pending', async () => {
    const event = fakeStripeEvent('charge.refund.updated', {
      id: 're_pending',
      status: 'requires_action',
      failure_reason: null,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockRefundService.updateRefundStatus.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockRefundService.updateRefundStatus).toHaveBeenCalledWith(
      're_pending',
      'pending',
      undefined,
    );
  });
});

// ============================================================================
// Unknown event type
// ============================================================================

describe('WebhookService.verifyAndHandle - unknown event', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns handled=false for unknown event type', async () => {
    const event = fakeStripeEvent('some.unknown.event', {
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result).toMatchObject({
      received: true,
      eventType: 'some.unknown.event',
      handled: false,
      normalizedStatus: 'ignored',
      providerEventId: 'evt_test_1',
      sessionId: null,
    });
  });
});

// ============================================================================
// Idempotency
// ============================================================================

describe('WebhookService.verifyAndHandle - idempotency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips already processed events', async () => {
    const event = fakeStripeEvent('payment_intent.succeeded', {
      id: 'pi_dup',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      stripeEventId: 'evt_test_1',
      processed: true,
    });

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result).toMatchObject({
      received: true,
      eventType: 'payment_intent.succeeded',
      handled: false,
      normalizedStatus: 'ignored',
      providerEventId: 'evt_test_1',
      sessionId: null,
    });
    expect(mockPrisma.webhookEvent.upsert).not.toHaveBeenCalled();
    expect(mockPaymentService.updatePaymentStatus).not.toHaveBeenCalled();
  });

  it('processes event when found but not yet processed', async () => {
    const event = fakeStripeEvent('payment_intent.succeeded', {
      id: 'pi_retry',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      stripeEventId: 'evt_test_1',
      processed: false,
    });
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockPaymentService.updatePaymentStatus).toHaveBeenCalled();
  });
});

// ============================================================================
// checkout.session.completed
// ============================================================================

describe('WebhookService.verifyAndHandle - checkout.session.completed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates payment record to succeeded when session is completed', async () => {
    const event = fakeStripeEvent('checkout.session.completed', {
      payment_intent: 'pi_session_done',
      metadata: { orderId: 'order_cs_1', installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(result.eventType).toBe('checkout.session.completed');
    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: {
        installationId_orderId: {
          installationId: 'ins_1',
          orderId: 'order_cs_1',
        },
      },
      data: expect.objectContaining({
        status: 'succeeded',
        stripePaymentIntentId: 'pi_session_done',
        paidAt: expect.any(Date),
      }),
    });
  });

  it('handles payment_intent as object in session', async () => {
    const event = fakeStripeEvent('checkout.session.completed', {
      payment_intent: { id: 'pi_session_obj' },
      metadata: { orderId: 'order_cs_obj', installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripePaymentIntentId: 'pi_session_obj',
        }),
      }),
    );
  });

  it('skips update when orderId is missing from metadata', async () => {
    const event = fakeStripeEvent('checkout.session.completed', {
      payment_intent: 'pi_no_order',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockPrisma.paymentRecord.update).not.toHaveBeenCalled();
  });

  it('does not throw when DB update fails (non-critical)', async () => {
    const event = fakeStripeEvent('checkout.session.completed', {
      payment_intent: 'pi_db_err',
      metadata: { orderId: 'order_cs_err', installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.paymentRecord.update.mockRejectedValue(new Error('Record not found'));

    // Should NOT throw - DB failure is caught silently
    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
  });

  it('defaults installationId to "default" when missing', async () => {
    const event = fakeStripeEvent('checkout.session.completed', {
      payment_intent: 'pi_default_inst',
      metadata: { orderId: 'order_default' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          installationId_orderId: {
            installationId: 'default',
            orderId: 'order_default',
          },
        },
      }),
    );
  });
});

// ============================================================================
// checkout.session.expired
// ============================================================================

describe('WebhookService.verifyAndHandle - checkout.session.expired', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks payment as failed when session expires', async () => {
    const event = fakeStripeEvent('checkout.session.expired', {
      metadata: { orderId: 'order_exp', installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.paymentRecord.update.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(result.eventType).toBe('checkout.session.expired');
    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: {
        installationId_orderId: {
          installationId: 'ins_1',
          orderId: 'order_exp',
        },
      },
      data: {
        status: 'failed',
        errorMessage: 'Checkout session expired',
      },
    });
  });

  it('skips update when orderId is missing from metadata', async () => {
    const event = fakeStripeEvent('checkout.session.expired', {
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockPrisma.paymentRecord.update).not.toHaveBeenCalled();
  });

  it('does not throw when DB update fails (non-critical)', async () => {
    const event = fakeStripeEvent('checkout.session.expired', {
      metadata: { orderId: 'order_exp_err', installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.paymentRecord.update.mockRejectedValue(new Error('DB error'));

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
  });
});

// ============================================================================
// charge.refund.updated - edge case: missing refund.id
// ============================================================================

describe('WebhookService.verifyAndHandle - charge.refund.updated edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when refund has no id', async () => {
    const event = fakeStripeEvent('charge.refund.updated', {
      id: null,
      status: 'succeeded',
      failure_reason: null,
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET);

    expect(result.handled).toBe(true);
    expect(mockRefundService.updateRefundStatus).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Invalid signature
// ============================================================================

describe('WebhookService.verifyAndHandle - invalid signature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when constructEvent fails due to invalid signature', async () => {
    const error = new Error('Invalid signature');
    (error as any).type = 'StripeSignatureVerificationError';
    mockStripeWebhooks.constructEvent.mockImplementation(() => {
      throw error;
    });

    await expect(
      service.verifyAndHandle(RAW_BODY, 'bad_sig', WEBHOOK_SECRET),
    ).rejects.toThrow('Invalid signature');
  });
});

// ============================================================================
// Handler error stores errorMessage
// ============================================================================

describe('WebhookService.verifyAndHandle - handler error', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores errorMessage in webhookEvent when handler throws', async () => {
    const event = fakeStripeEvent('payment_intent.succeeded', {
      id: 'pi_error',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockRejectedValue(
      new Error('DB connection lost'),
    );

    await expect(
      service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET),
    ).rejects.toThrow('DB connection lost');

    expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_test_1' },
      data: { errorMessage: 'DB connection lost' },
    });
  });

  it('stores "Unknown error" for non-Error exceptions', async () => {
    const event = fakeStripeEvent('payment_intent.succeeded', {
      id: 'pi_unknown_err',
      metadata: { installationId: 'ins_1' },
    });
    mockStripeWebhooks.constructEvent.mockReturnValue(event);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPaymentService.updatePaymentStatus.mockRejectedValue('string error');

    await expect(
      service.verifyAndHandle(RAW_BODY, SIGNATURE, WEBHOOK_SECRET),
    ).rejects.toBe('string error');

    expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_test_1' },
      data: { errorMessage: 'Unknown error' },
    });
  });
});
