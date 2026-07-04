import { prisma } from '../lib/prisma';
import { getStripeClient } from '../lib/stripe-client';

export interface CreateIntentInput {
  orderId: string;
  amount: number; // in cents
  currency?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface CreateIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
}

export class PaymentService {
  /**
   * Create (or retrieve) a Stripe PaymentIntent for the given order.
   * Idempotent: if a non-failed intent already exists for the order it is returned.
   */
  async createPaymentIntent(
    installationId: string,
    input: CreateIntentInput,
    secretKey?: string
  ): Promise<CreateIntentResult> {
    const stripe = getStripeClient(secretKey);
    const currency = input.currency || 'usd';

    // Check for existing payment for this order
    const existing = await prisma.paymentRecord.findUnique({
      where: {
        installationId_orderId: {
          installationId,
          orderId: input.orderId,
        },
      },
    });

    if (existing && existing.stripePaymentIntentId && existing.status !== 'failed') {
      // Retrieve existing intent
      const intent = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId);
      return {
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret!,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
      };
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amount,
      currency,
      metadata: {
        orderId: input.orderId,
        installationId,
        ...input.metadata,
      },
      receipt_email: input.customerEmail,
      automatic_payment_methods: { enabled: true },
    });

    // Upsert payment record
    await prisma.paymentRecord.upsert({
      where: {
        installationId_orderId: {
          installationId,
          orderId: input.orderId,
        },
      },
      update: {
        stripePaymentIntentId: paymentIntent.id,
        amount: input.amount,
        currency,
        status: 'processing',
        customerEmail: input.customerEmail,
        metadata: input.metadata || {},
        errorMessage: null,
      },
      create: {
        installationId,
        orderId: input.orderId,
        stripePaymentIntentId: paymentIntent.id,
        amount: input.amount,
        currency,
        status: 'processing',
        customerEmail: input.customerEmail,
        metadata: input.metadata || {},
      },
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }

  async getPayment(installationId: string, paymentId: string) {
    return prisma.paymentRecord.findFirst({
      where: { id: paymentId, installationId },
      include: { refunds: true },
    });
  }

  async getPaymentByOrderId(installationId: string, orderId: string) {
    return prisma.paymentRecord.findUnique({
      where: {
        installationId_orderId: { installationId, orderId },
      },
      include: { refunds: true },
    });
  }

  async listPayments(
    installationId: string,
    options: { page?: number; limit?: number; status?: string }
  ) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 10, 100);
    const skip = (page - 1) * limit;

    const where: any = { installationId };
    if (options.status) where.status = options.status;

    const [items, total] = await Promise.all([
      prisma.paymentRecord.findMany({
        where,
        include: { refunds: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.paymentRecord.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updatePaymentStatus(
    stripePaymentIntentId: string,
    status: string,
    extra?: { paidAt?: Date; errorMessage?: string }
  ) {
    return prisma.paymentRecord.update({
      where: { stripePaymentIntentId },
      data: {
        status,
        ...(extra?.paidAt && { paidAt: extra.paidAt }),
        ...(extra?.errorMessage && { errorMessage: extra.errorMessage }),
      },
    });
  }

  async getDashboardStats(installationId: string) {
    const [total, succeeded, failed, refunded] = await Promise.all([
      prisma.paymentRecord.count({ where: { installationId } }),
      prisma.paymentRecord.count({ where: { installationId, status: 'succeeded' } }),
      prisma.paymentRecord.count({ where: { installationId, status: 'failed' } }),
      prisma.paymentRecord.count({
        where: { installationId, status: { in: ['refunded', 'partially_refunded'] } },
      }),
    ]);

    const successRate = total > 0 ? ((succeeded / total) * 100).toFixed(1) : '0.0';

    // Sum revenue from succeeded payments
    const revenueResult = await prisma.paymentRecord.aggregate({
      where: { installationId, status: 'succeeded' },
      _sum: { amount: true },
    });

    const refundResult = await prisma.refundRecord.aggregate({
      where: { installationId, status: 'succeeded' },
      _sum: { amount: true },
    });

    return {
      totalPayments: total,
      succeeded,
      failed,
      refunded,
      successRate: parseFloat(successRate),
      totalRevenue: revenueResult._sum.amount || 0,
      totalRefunded: refundResult._sum.amount || 0,
    };
  }
}

export const paymentService = new PaymentService();
