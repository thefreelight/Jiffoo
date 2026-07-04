import { createHash } from 'crypto';
import { Prisma, OrderPaymentStatus as PrismaOrderPaymentStatus, OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { prisma } from '@/config/database';
import { StripeService } from '@/services/stripe.service';
import { OrderStatus, PaymentStatus } from '@/core/order/types';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { emitOrderPaidEvent } from '@/core/payment/order-paid-event';

export type NativePayProvider = 'apple-pay' | 'google-pay';

export class NativePaymentConfirmationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type NativePaymentConfirmInput = {
  orderId?: string;
  paymentMethodId?: string;
  providerPaymentMethodId?: string;
  stripePaymentMethodId?: string;
  paymentIntentId?: string;
  providerPaymentIntentId?: string;
  stripePaymentIntentId?: string;
  expectedTotal?: number;
  currency?: string;
  idempotencyKey?: string;
  token?: unknown;
  metadata?: Record<string, unknown>;
  provider?: string;
};

type VerifiedProviderPayment = {
  provider: 'stripe';
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  paymentMethodId?: string;
};

function parseToken(token: unknown): Record<string, unknown> {
  if (!token) return {};
  if (typeof token === 'string') {
    try {
      const parsed = JSON.parse(token);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return token && typeof token === 'object' && !Array.isArray(token) ? token as Record<string, unknown> : {};
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function toCents(amount: unknown): number {
  return Math.round(Number(amount || 0) * 100);
}

function assertAmountMatches(orderTotal: unknown, expectedTotal?: number) {
  if (expectedTotal === undefined || expectedTotal === null) return;
  const diff = Math.abs(Number(orderTotal) - Number(expectedTotal));
  if (diff > 0.01) {
    throw new NativePaymentConfirmationError(
      409,
      'EXPECTED_TOTAL_MISMATCH',
      'Client expectedTotal does not match the order total',
      {
        orderTotal: Number(orderTotal),
        expectedTotal,
      },
    );
  }
}

function tokenFingerprint(token: unknown): string | undefined {
  if (!token) return undefined;
  return createHash('sha256').update(typeof token === 'string' ? token : JSON.stringify(token)).digest('hex').slice(0, 24);
}

function extractProviderEvidence(input: NativePaymentConfirmInput) {
  const token = parseToken(input.token);
  const nestedPaymentMethod = parseToken(token.paymentMethod);
  const nestedPaymentIntent = parseToken(token.paymentIntent);
  const tokenId = readString(token.id);

  const paymentMethodId = readString(
    input.stripePaymentMethodId,
    input.providerPaymentMethodId,
    input.paymentMethodId?.startsWith('pm_') ? input.paymentMethodId : undefined,
    token.stripePaymentMethodId,
    token.providerPaymentMethodId,
    token.paymentMethodId,
    nestedPaymentMethod.id,
    tokenId?.startsWith('pm_') ? tokenId : undefined,
  );

  const paymentIntentId = readString(
    input.stripePaymentIntentId,
    input.providerPaymentIntentId,
    input.paymentIntentId,
    token.stripePaymentIntentId,
    token.providerPaymentIntentId,
    token.paymentIntentId,
    nestedPaymentIntent.id,
    tokenId?.startsWith('pi_') ? tokenId : undefined,
  );

  return {
    paymentMethodId,
    paymentIntentId,
    token,
    tokenFingerprint: tokenFingerprint(input.token),
  };
}

async function verifyWithStripe(
  nativeProvider: NativePayProvider,
  order: {
    id: string;
    totalAmount: Prisma.Decimal;
    currency: string;
  },
  input: NativePaymentConfirmInput,
): Promise<VerifiedProviderPayment> {
  const evidence = extractProviderEvidence(input);
  const provider = readString(input.provider, evidence.token.provider, evidence.token.gateway, evidence.token.paymentGateway) || 'stripe';
  if (provider.toLowerCase() !== 'stripe') {
    throw new NativePaymentConfirmationError(
      501,
      'PAYMENT_PROVIDER_UNSUPPORTED',
      `Native payment provider "${provider}" is not supported yet`,
    );
  }

  if (!evidence.paymentMethodId && !evidence.paymentIntentId) {
    throw new NativePaymentConfirmationError(
      400,
      'PAYMENT_PROVIDER_TOKEN_UNSUPPORTED',
      'Native payment confirmation requires a Stripe paymentMethodId or paymentIntentId. Raw Apple Pay / Google Pay tokens are not accepted directly.',
      {
        acceptedFields: ['stripePaymentMethodId', 'providerPaymentMethodId', 'paymentMethodId(pm_*)', 'stripePaymentIntentId', 'providerPaymentIntentId', 'paymentIntentId'],
        nativeProvider,
      },
    );
  }

  let intent: Awaited<ReturnType<typeof StripeService.confirmNativePayment>>;
  try {
    intent = await StripeService.confirmNativePayment({
      orderId: order.id,
      amount: toCents(order.totalAmount),
      currency: order.currency.toLowerCase(),
      paymentMethodId: evidence.paymentMethodId,
      paymentIntentId: evidence.paymentIntentId,
      provider: nativeProvider,
      metadata: {
        nativeProvider,
        ...(input.metadata ? Object.fromEntries(Object.entries(input.metadata).map(([key, value]) => [key, String(value)])) : {}),
      },
    });
  } catch (error: any) {
    const message = error?.message || 'Stripe native payment confirmation failed';
    const code = message.includes('not configured') ? 'PAYMENT_PROVIDER_NOT_CONFIGURED' : 'PAYMENT_CONFIRM_FAILED';
    throw new NativePaymentConfirmationError(
      code === 'PAYMENT_PROVIDER_NOT_CONFIGURED' ? 503 : 402,
      code,
      message,
    );
  }

  if (intent.amount !== toCents(order.totalAmount)) {
    throw new NativePaymentConfirmationError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Provider payment amount does not match order total', {
      providerAmount: intent.amount,
      orderAmount: toCents(order.totalAmount),
    });
  }

  if (intent.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new NativePaymentConfirmationError(409, 'PAYMENT_CURRENCY_MISMATCH', 'Provider payment currency does not match order currency', {
      providerCurrency: intent.currency,
      orderCurrency: order.currency,
    });
  }

  if (intent.metadata.orderId && intent.metadata.orderId !== order.id) {
    throw new NativePaymentConfirmationError(409, 'PAYMENT_ORDER_MISMATCH', 'Provider payment intent belongs to a different order', {
      providerOrderId: intent.metadata.orderId,
      orderId: order.id,
    });
  }

  return {
    provider: 'stripe',
    paymentIntentId: intent.id,
    status: intent.status,
    amount: intent.amount,
    currency: intent.currency.toUpperCase(),
    metadata: intent.metadata,
    paymentMethodId: evidence.paymentMethodId,
  };
}

function mapProviderStatus(status: string): 'paid' | 'pending' | 'failed' {
  if (status === 'succeeded') return 'paid';
  if (status === 'processing' || status === 'requires_capture') return 'pending';
  return 'failed';
}

export class NativePaymentConfirmationService {
  static async confirm(provider: NativePayProvider, userId: string, input: NativePaymentConfirmInput) {
    if (!input.orderId) {
      throw new NativePaymentConfirmationError(400, 'ORDER_ID_REQUIRED', 'orderId is required');
    }

    const order = await prisma.order.findFirst({
      where: {
        id: input.orderId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        currency: true,
        paymentAttempts: true,
      },
    });

    if (!order) {
      throw new NativePaymentConfirmationError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      const existing = await prisma.payment.findFirst({
        where: { orderId: order.id, status: 'SUCCEEDED' },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        orderId: order.id,
        provider,
        status: 'paid',
        paymentId: existing?.id,
        providerPaymentIntentId: existing?.paymentIntentId,
        amount: Number(order.totalAmount),
        currency: order.currency,
        alreadyPaid: true,
      };
    }

    assertAmountMatches(order.totalAmount, input.expectedTotal);
    if (input.currency && input.currency.toUpperCase() !== order.currency.toUpperCase()) {
      throw new NativePaymentConfirmationError(409, 'PAYMENT_CURRENCY_MISMATCH', 'Client currency does not match order currency', {
        orderCurrency: order.currency,
        currency: input.currency,
      });
    }

    const verified = await verifyWithStripe(provider, order, input);
    const paymentState = mapProviderStatus(verified.status);
    if (paymentState === 'failed') {
      throw new NativePaymentConfirmationError(402, 'PAYMENT_NOT_CONFIRMED', `Provider payment status is ${verified.status}`, {
        providerStatus: verified.status,
      });
    }

    const idempotencyKey = input.idempotencyKey || `native:${provider}:${order.id}:${verified.paymentIntentId}`;
    const ledgerIdempotencyKey = `${idempotencyKey}:${paymentState}`;
    const providerEventId = `native:${provider}:${verified.paymentIntentId}:${paymentState}`;
    const metadata = {
      nativeProvider: provider,
      provider: verified.provider,
      providerStatus: verified.status,
      providerMetadata: verified.metadata,
      tokenFingerprint: tokenFingerprint(input.token),
      paymentMethodId: verified.paymentMethodId,
      ...(input.metadata || {}),
    };

    const payment = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: {
          OR: [
            { idempotencyKey },
            { paymentIntentId: verified.paymentIntentId },
          ],
        },
      });

      let paymentRecord;
      if (existing) {
        paymentRecord = await tx.payment.update({
          where: { id: existing.id },
          data: {
            status: paymentState === 'paid' ? 'SUCCEEDED' : 'PENDING',
            providerEventId: existing.providerEventId || providerEventId,
            metadata: metadata as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });
      } else {
        const latestPayment = await tx.payment.findFirst({
          where: { orderId: order.id },
          orderBy: { attemptNumber: 'desc' },
          select: { attemptNumber: true },
        });
        const attemptNumber = (latestPayment?.attemptNumber || 0) + 1;
        paymentRecord = await tx.payment.create({
          data: {
            orderId: order.id,
            attemptNumber,
            paymentMethod: provider,
            paymentIntentId: verified.paymentIntentId,
            amount: Number(order.totalAmount),
            currency: order.currency,
            status: paymentState === 'paid' ? 'SUCCEEDED' : 'PENDING',
            idempotencyKey,
            providerEventId,
            metadata: metadata as Prisma.InputJsonValue,
          },
        });
      }

      const existingLedger = await tx.paymentLedger.findFirst({
        where: {
          OR: [
            { idempotencyKey: ledgerIdempotencyKey },
            { providerEventId },
          ],
        },
      });
      if (!existingLedger) {
        await tx.paymentLedger.create({
          data: {
            paymentId: paymentRecord.id,
            orderId: order.id,
            eventType: paymentState === 'paid' ? 'SUCCEEDED' : 'CREATED',
            amount: Number(order.totalAmount),
            currency: order.currency,
            provider,
            providerEventId,
            idempotencyKey: ledgerIdempotencyKey,
            metadata: metadata as Prisma.InputJsonValue,
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          ...(paymentState === 'paid'
            ? { status: OrderStatus.PROCESSING, paymentStatus: PaymentStatus.PAID }
            : {}),
          paymentAttempts: Math.max(order.paymentAttempts || 0, paymentRecord.attemptNumber),
          lastPaymentAttemptAt: new Date(),
          lastPaymentMethod: provider,
          updatedAt: new Date(),
        },
      });

      if (paymentState === 'paid' && order.paymentStatus !== PaymentStatus.PAID) {
        await emitOrderPaidEvent(tx, order.id, {
          paymentId: paymentRecord.id,
          paymentMethod: provider,
          paymentIntentId: verified.paymentIntentId,
          providerEventId,
          metadata,
          actorId: userId,
        });

        await recordOrderStatusHistory(tx, {
          orderId: updatedOrder.id,
          fromStatus: order.status as PrismaOrderStatus,
          toStatus: updatedOrder.status as PrismaOrderStatus,
          fromPaymentStatus: order.paymentStatus as PrismaOrderPaymentStatus,
          toPaymentStatus: updatedOrder.paymentStatus as PrismaOrderPaymentStatus,
          reason: `native_${provider}_confirmed`,
          actorType: 'user',
          actorId: userId,
          metadata,
        });
      }

      return paymentRecord;
    });

    return {
      orderId: order.id,
      provider,
      status: paymentState,
      paymentId: payment.id,
      providerPaymentIntentId: verified.paymentIntentId,
      providerStatus: verified.status,
      amount: Number(order.totalAmount),
      currency: order.currency,
      paidAt: paymentState === 'paid' ? new Date().toISOString() : undefined,
    };
  }
}
