import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  paymentRecord: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  refundRecord: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
}));

const mockStripe = vi.hoisted(() => ({
  refunds: {
    create: vi.fn(),
  },
}));

vi.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../src/lib/stripe-client', () => ({
  getStripeClient: vi.fn(() => mockStripe),
}));

import { RefundService } from '../../src/services/refund.service';

const service = new RefundService();

function fakePaymentRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'pay_1',
    installationId: 'ins_1',
    orderId: 'order_1',
    stripePaymentIntentId: 'pi_abc123',
    amount: 5000,
    currency: 'usd',
    status: 'succeeded',
    customerEmail: 'buyer@example.com',
    metadata: {},
    errorMessage: null,
    paidAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function fakeRefundRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'ref_1',
    installationId: 'ins_1',
    paymentRecordId: 'pay_1',
    stripeRefundId: 're_abc123',
    amount: 5000,
    reason: null,
    status: 'succeeded',
    errorMessage: null,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  };
}

// ============================================================================
// createRefund
// ============================================================================

describe('RefundService.createRefund', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a full refund successfully', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(fakePaymentRecord());
    mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_full',
      status: 'succeeded',
    });
    mockPrisma.refundRecord.create.mockResolvedValue(
      fakeRefundRecord({ id: 'ref_full', stripeRefundId: 're_full' }),
    );
    mockPrisma.paymentRecord.update.mockResolvedValue(
      fakePaymentRecord({ status: 'refunded' }),
    );

    const result = await service.createRefund('ins_1', {
      paymentRecordId: 'pay_1',
    });

    expect(result.refundId).toBe('ref_full');
    expect(result.stripeRefundId).toBe('re_full');
    expect(result.amount).toBe(5000);
    expect(result.status).toBe('succeeded');
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_abc123',
        amount: 5000,
      }),
    );
    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'refunded' },
    });
  });

  it('creates a partial refund successfully', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(fakePaymentRecord());
    mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_partial',
      status: 'succeeded',
    });
    mockPrisma.refundRecord.create.mockResolvedValue(
      fakeRefundRecord({ id: 'ref_partial', stripeRefundId: 're_partial', amount: 2000 }),
    );
    mockPrisma.paymentRecord.update.mockResolvedValue(
      fakePaymentRecord({ status: 'partially_refunded' }),
    );

    const result = await service.createRefund('ins_1', {
      paymentRecordId: 'pay_1',
      amount: 2000,
      reason: 'requested_by_customer',
    });

    expect(result.amount).toBe(2000);
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
        reason: 'requested_by_customer',
      }),
    );
    // Should update to partially_refunded, not refunded
    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'partially_refunded' },
    });
  });

  it('throws when payment record not found', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(null);

    await expect(
      service.createRefund('ins_1', { paymentRecordId: 'pay_missing' }),
    ).rejects.toThrow('Payment record not found');
  });

  it('throws when payment has no stripe payment intent', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(
      fakePaymentRecord({ stripePaymentIntentId: null }),
    );

    await expect(
      service.createRefund('ins_1', { paymentRecordId: 'pay_1' }),
    ).rejects.toThrow('No Stripe payment intent associated');
  });

  it('throws when payment status is not succeeded or partially_refunded', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(
      fakePaymentRecord({ status: 'pending' }),
    );

    await expect(
      service.createRefund('ins_1', { paymentRecordId: 'pay_1' }),
    ).rejects.toThrow('Cannot refund payment with status: pending');
  });

  it('throws when refund amount exceeds refundable amount', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(
      fakePaymentRecord({ amount: 5000 }),
    );
    // Already refunded 3000
    mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amount: 3000 } });

    await expect(
      service.createRefund('ins_1', { paymentRecordId: 'pay_1', amount: 3000 }),
    ).rejects.toThrow('exceeds remaining refundable amount');
  });

  it('allows refund on partially_refunded payment', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(
      fakePaymentRecord({ status: 'partially_refunded', amount: 5000 }),
    );
    mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amount: 2000 } });
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_second',
      status: 'succeeded',
    });
    mockPrisma.refundRecord.create.mockResolvedValue(
      fakeRefundRecord({ amount: 3000 }),
    );
    mockPrisma.paymentRecord.update.mockResolvedValue(
      fakePaymentRecord({ status: 'refunded' }),
    );

    const result = await service.createRefund('ins_1', {
      paymentRecordId: 'pay_1',
      amount: 3000,
    });

    expect(result.amount).toBe(3000);
    // 2000 + 3000 = 5000 = payment amount, so status should be 'refunded'
    expect(mockPrisma.paymentRecord.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'refunded' },
    });
  });

  it('does not update payment status when Stripe refund is pending', async () => {
    mockPrisma.paymentRecord.findFirst.mockResolvedValue(fakePaymentRecord());
    mockPrisma.refundRecord.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_pending',
      status: 'pending',
    });
    mockPrisma.refundRecord.create.mockResolvedValue(
      fakeRefundRecord({ status: 'pending' }),
    );

    await service.createRefund('ins_1', { paymentRecordId: 'pay_1' });

    expect(mockPrisma.paymentRecord.update).not.toHaveBeenCalled();
  });
});

// ============================================================================
// getRefund
// ============================================================================

describe('RefundService.getRefund', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns refund when found', async () => {
    const refund = fakeRefundRecord({ payment: fakePaymentRecord() });
    mockPrisma.refundRecord.findFirst.mockResolvedValue(refund);

    const result = await service.getRefund('ins_1', 'ref_1');

    expect(result).toEqual(refund);
    expect(mockPrisma.refundRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'ref_1', installationId: 'ins_1' },
      include: { payment: true },
    });
  });

  it('returns null when refund not found', async () => {
    mockPrisma.refundRecord.findFirst.mockResolvedValue(null);

    const result = await service.getRefund('ins_1', 'ref_missing');

    expect(result).toBeNull();
  });
});

// ============================================================================
// listRefunds
// ============================================================================

describe('RefundService.listRefunds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated refunds', async () => {
    const refunds = [fakeRefundRecord()];
    mockPrisma.refundRecord.findMany.mockResolvedValue(refunds);
    mockPrisma.refundRecord.count.mockResolvedValue(1);

    const result = await service.listRefunds('ins_1', { page: 1, limit: 10 });

    expect(result.items).toEqual(refunds);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('filters by paymentRecordId', async () => {
    mockPrisma.refundRecord.findMany.mockResolvedValue([]);
    mockPrisma.refundRecord.count.mockResolvedValue(0);

    await service.listRefunds('ins_1', { paymentRecordId: 'pay_1' });

    expect(mockPrisma.refundRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { installationId: 'ins_1', paymentRecordId: 'pay_1' },
      }),
    );
  });

  it('returns empty results', async () => {
    mockPrisma.refundRecord.findMany.mockResolvedValue([]);
    mockPrisma.refundRecord.count.mockResolvedValue(0);

    const result = await service.listRefunds('ins_1', {});

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('caps limit at 100', async () => {
    mockPrisma.refundRecord.findMany.mockResolvedValue([]);
    mockPrisma.refundRecord.count.mockResolvedValue(0);

    const result = await service.listRefunds('ins_1', { limit: 200 });

    expect(result.limit).toBe(100);
  });
});

// ============================================================================
// updateRefundStatus
// ============================================================================

describe('RefundService.updateRefundStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates refund status', async () => {
    mockPrisma.refundRecord.update.mockResolvedValue(
      fakeRefundRecord({ status: 'succeeded' }),
    );

    const result = await service.updateRefundStatus('re_abc123', 'succeeded');

    expect(result.status).toBe('succeeded');
    expect(mockPrisma.refundRecord.update).toHaveBeenCalledWith({
      where: { stripeRefundId: 're_abc123' },
      data: { status: 'succeeded' },
    });
  });

  it('includes errorMessage when provided', async () => {
    mockPrisma.refundRecord.update.mockResolvedValue(
      fakeRefundRecord({ status: 'failed', errorMessage: 'Refund failed' }),
    );

    await service.updateRefundStatus('re_abc123', 'failed', 'Refund failed');

    expect(mockPrisma.refundRecord.update).toHaveBeenCalledWith({
      where: { stripeRefundId: 're_abc123' },
      data: { status: 'failed', errorMessage: 'Refund failed' },
    });
  });
});
