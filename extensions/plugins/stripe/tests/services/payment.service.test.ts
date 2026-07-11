import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  paymentRecord: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  refundRecord: {
    aggregate: vi.fn(),
  },
}));

const mockStripe = vi.hoisted(() => ({
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => mockStripe),
}));

import { PaymentService } from '../../src/services/payment.service';

const service = new PaymentService();

function fakePaymentRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'pay_1',
    installationId: 'ins_1',
    orderId: 'order_1',
    stripePaymentIntentId: 'pi_abc123',
    amount: 5000,
    currency: 'usd',
    status: 'processing',
    customerEmail: 'buyer@example.com',
    metadata: {},
    errorMessage: null,
    paidAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    refunds: [],
    ...overrides,
  };
}

// ============================================================================
// createPaymentIntent
// ============================================================================

describe('PaymentService.createPaymentIntent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new payment intent for a new order', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_new',
      client_secret: 'cs_new',
      status: 'requires_payment_method',
      amount: 5000,
      currency: 'usd',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue(fakePaymentRecord());

    const result = await service.createPaymentIntent('ins_1', {
      orderId: 'order_1',
      amount: 5000,
      currency: 'usd',
      customerEmail: 'buyer@example.com',
    });

    expect(result.paymentIntentId).toBe('pi_new');
    expect(result.clientSecret).toBe('cs_new');
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('usd');
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'usd',
        receipt_email: 'buyer@example.com',
        automatic_payment_methods: { enabled: true },
      }),
    );
    expect(mockPrisma.paymentRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          installationId_orderId: {
            installationId: 'ins_1',
            orderId: 'order_1',
          },
        },
      }),
    );
  });

  it('returns existing intent when a non-failed payment already exists (idempotent)', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(
      fakePaymentRecord({ status: 'processing', stripePaymentIntentId: 'pi_existing' }),
    );
    mockStripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_existing',
      client_secret: 'cs_existing',
      status: 'requires_payment_method',
      amount: 5000,
      currency: 'usd',
    });

    const result = await service.createPaymentIntent('ins_1', {
      orderId: 'order_1',
      amount: 5000,
    });

    expect(result.paymentIntentId).toBe('pi_existing');
    expect(result.clientSecret).toBe('cs_existing');
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_existing');
  });

  it('creates a new intent when previous payment is failed (retry)', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(
      fakePaymentRecord({ status: 'failed', stripePaymentIntentId: 'pi_old_failed' }),
    );
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_retry',
      client_secret: 'cs_retry',
      status: 'requires_payment_method',
      amount: 5000,
      currency: 'usd',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue(fakePaymentRecord());

    const result = await service.createPaymentIntent('ins_1', {
      orderId: 'order_1',
      amount: 5000,
    });

    expect(result.paymentIntentId).toBe('pi_retry');
    expect(mockStripe.paymentIntents.create).toHaveBeenCalled();
    expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('uses default currency usd when none provided', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_default_cur',
      client_secret: 'cs_default',
      status: 'requires_payment_method',
      amount: 1000,
      currency: 'usd',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue(fakePaymentRecord());

    await service.createPaymentIntent('ins_1', { orderId: 'order_2', amount: 1000 });

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd' }),
    );
  });

  it('passes secretKey to getStripeClient', async () => {
    const { getStripeClient } = await import('../../src/lib/stripe-client');
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_sk',
      client_secret: 'cs_sk',
      status: 'requires_payment_method',
      amount: 1000,
      currency: 'usd',
    });
    mockPrisma.paymentRecord.upsert.mockResolvedValue(fakePaymentRecord());

    await service.createPaymentIntent('ins_1', { orderId: 'order_sk', amount: 1000 }, 'sk_custom');

    expect(getStripeClient).toHaveBeenCalledWith('sk_custom');
  });
});

// ============================================================================
// getPayment
// ============================================================================

describe('PaymentService.getPayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns payment when found', async () => {
    const payment = fakePaymentRecord();
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(payment);

    const result = await service.getPayment('ins_1', 'pay_1');

    expect(result).toEqual(payment);
    expect(mockPrisma.paymentRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'pay_1', installationId: 'ins_1' },
      include: { refunds: true },
    });
  });

  it('returns null when payment not found', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(null);

    const result = await service.getPayment('ins_1', 'pay_missing');

    expect(result).toBeNull();
  });
});

// ============================================================================
// getPaymentByOrderId
// ============================================================================

describe('PaymentService.getPaymentByOrderId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns payment when found by orderId', async () => {
    const payment = fakePaymentRecord();
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(payment);

    const result = await service.getPaymentByOrderId('ins_1', 'order_1');

    expect(result).toEqual(payment);
    expect(mockPrisma.paymentRecord.findUnique).toHaveBeenCalledWith({
      where: {
        installationId_orderId: { installationId: 'ins_1', orderId: 'order_1' },
      },
      include: { refunds: true },
    });
  });

  it('returns null when no payment exists for orderId', async () => {
    mockPrisma.paymentRecord.findUnique.mockResolvedValue(null);

    const result = await service.getPaymentByOrderId('ins_1', 'order_missing');

    expect(result).toBeNull();
  });
});

// ============================================================================
// listPayments
// ============================================================================

describe('PaymentService.listPayments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated payments', async () => {
    const payments = [fakePaymentRecord(), fakePaymentRecord({ id: 'pay_2' })];
    mockPrisma.paymentRecord.findMany.mockResolvedValue(payments);
    mockPrisma.paymentRecord.count.mockResolvedValue(15);

    const result = await service.listPayments('ins_1', { page: 2, limit: 5 });

    expect(result.items).toEqual(payments);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.total).toBe(15);
    expect(result.totalPages).toBe(3);
    expect(mockPrisma.paymentRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { installationId: 'ins_1' },
        skip: 5,
        take: 5,
      }),
    );
  });

  it('filters by status', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([]);
    mockPrisma.paymentRecord.count.mockResolvedValue(0);

    await service.listPayments('ins_1', { status: 'succeeded' });

    expect(mockPrisma.paymentRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { installationId: 'ins_1', status: 'succeeded' },
      }),
    );
  });

  it('returns empty results when no payments exist', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([]);
    mockPrisma.paymentRecord.count.mockResolvedValue(0);

    const result = await service.listPayments('ins_1', {});

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('defaults page=1 and limit=10', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([]);
    mockPrisma.paymentRecord.count.mockResolvedValue(0);

    const result = await service.listPayments('ins_1', {});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(mockPrisma.paymentRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('caps limit at 100', async () => {
    mockPrisma.paymentRecord.findMany.mockResolvedValue([]);
    mockPrisma.paymentRecord.count.mockResolvedValue(0);

    const result = await service.listPayments('ins_1', { limit: 500 });

    expect(result.limit).toBe(100);
  });
});

// ============================================================================
// updatePaymentStatus
// ============================================================================

describe('PaymentService.updatePaymentStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates payment status', async () => {
    const updated = fakePaymentRecord({ status: 'succeeded' });
    mockPrisma.paymentRecord.update.mockResolvedValue(updated);

    const result = await service.updatePaymentStatus('pi_abc123', 'succeeded');

    expect(result.status).toBe('succeeded');
    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_abc123' },
      data: { status: 'succeeded' },
    });
  });

  it('includes paidAt when provided', async () => {
    const paidAt = new Date('2026-03-01');
    mockPrisma.paymentRecord.update.mockResolvedValue(
      fakePaymentRecord({ status: 'succeeded', paidAt }),
    );

    await service.updatePaymentStatus('pi_abc123', 'succeeded', { paidAt });

    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_abc123' },
      data: { status: 'succeeded', paidAt },
    });
  });

  it('includes errorMessage when provided', async () => {
    mockPrisma.paymentRecord.update.mockResolvedValue(
      fakePaymentRecord({ status: 'failed', errorMessage: 'Card declined' }),
    );

    await service.updatePaymentStatus('pi_abc123', 'failed', {
      errorMessage: 'Card declined',
    });

    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_abc123' },
      data: { status: 'failed', errorMessage: 'Card declined' },
    });
  });
});

// ============================================================================
// getDashboardStats
// ============================================================================

describe('PaymentService.getDashboardStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns aggregated dashboard stats', async () => {
    mockPrisma.paymentRecord.count
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(80)   // succeeded
      .mockResolvedValueOnce(10)   // failed
      .mockResolvedValueOnce(5);   // refunded

    mockPrisma.paymentRecord.aggregate.mockResolvedValue({
      _sum: { amount: 400000 },
    });
    mockPrisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { amount: 25000 },
    });

    const result = await service.getDashboardStats('ins_1');

    expect(result).toEqual({
      totalPayments: 100,
      succeeded: 80,
      failed: 10,
      refunded: 5,
      successRate: 80.0,
      totalRevenue: 400000,
      totalRefunded: 25000,
    });
  });

  it('returns zero stats when no data', async () => {
    mockPrisma.paymentRecord.count.mockResolvedValue(0);
    mockPrisma.paymentRecord.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    mockPrisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getDashboardStats('ins_empty');

    expect(result).toEqual({
      totalPayments: 0,
      succeeded: 0,
      failed: 0,
      refunded: 0,
      successRate: 0.0,
      totalRevenue: 0,
      totalRefunded: 0,
    });
  });
});
