import { prisma } from '../lib/prisma';
import { getStripeClient } from '../lib/stripe-client';

export interface RefundInput {
  paymentRecordId: string;
  amount?: number; // partial refund in cents; if omitted, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface RefundResult {
  refundId: string;
  stripeRefundId: string;
  amount: number;
  status: string;
}

export class RefundService {
  async createRefund(
    installationId: string,
    input: RefundInput,
    secretKey?: string
  ): Promise<RefundResult> {
    const stripe = getStripeClient(secretKey);

    const payment = await prisma.paymentRecord.findFirst({
      where: { id: input.paymentRecordId, installationId },
    });

    if (!payment) {
      throw new Error('Payment record not found');
    }

    if (!payment.stripePaymentIntentId) {
      throw new Error('No Stripe payment intent associated with this payment');
    }

    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
      throw new Error(`Cannot refund payment with status: ${payment.status}`);
    }

    const refundAmount = input.amount || payment.amount;

    // Check total refunded does not exceed payment amount
    const existingRefunds = await prisma.refundRecord.aggregate({
      where: {
        paymentRecordId: payment.id,
        status: 'succeeded',
      },
      _sum: { amount: true },
    });

    const alreadyRefunded = existingRefunds._sum.amount || 0;
    if (alreadyRefunded + refundAmount > payment.amount) {
      throw new Error(
        `Refund amount (${refundAmount}) exceeds remaining refundable amount (${payment.amount - alreadyRefunded})`
      );
    }

    // Create Stripe refund
    const stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: refundAmount,
      reason: input.reason,
      metadata: {
        installationId,
        paymentRecordId: payment.id,
      },
    });

    // Create refund record
    const refundRecord = await prisma.refundRecord.create({
      data: {
        installationId,
        paymentRecordId: payment.id,
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
        reason: input.reason,
        status: stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending',
      },
    });

    // Update payment status
    const totalRefunded =
      alreadyRefunded + (stripeRefund.status === 'succeeded' ? refundAmount : 0);
    const newStatus = totalRefunded >= payment.amount ? 'refunded' : 'partially_refunded';

    if (stripeRefund.status === 'succeeded') {
      await prisma.paymentRecord.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
    }

    return {
      refundId: refundRecord.id,
      stripeRefundId: stripeRefund.id,
      amount: refundAmount,
      status: stripeRefund.status || 'pending',
    };
  }

  async getRefund(installationId: string, refundId: string) {
    return prisma.refundRecord.findFirst({
      where: { id: refundId, installationId },
      include: { payment: true },
    });
  }

  async listRefunds(
    installationId: string,
    options: { page?: number; limit?: number; paymentRecordId?: string }
  ) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 10, 100);
    const skip = (page - 1) * limit;

    const where: any = { installationId };
    if (options.paymentRecordId) where.paymentRecordId = options.paymentRecordId;

    const [items, total] = await Promise.all([
      prisma.refundRecord.findMany({
        where,
        include: { payment: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.refundRecord.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async updateRefundStatus(stripeRefundId: string, status: string, errorMessage?: string) {
    return prisma.refundRecord.update({
      where: { stripeRefundId },
      data: { status, ...(errorMessage && { errorMessage }) },
    });
  }
}

export const refundService = new RefundService();
