import { prisma } from '@/config/database';

const MANUAL_PAYMENT_METHOD = 'manual';

type PaymentDriverCreateSessionInput = Record<string, unknown>;

function buildManualPaymentUrl(shopOrigin: string, locale: string, orderId: string): string {
  const url = new URL(`/${locale}/payment/manual`, shopOrigin);
  url.searchParams.set('order_id', orderId);
  return url.toString();
}

export const builtinManualPaymentDriver = {
  async createSession(input: PaymentDriverCreateSessionInput) {
    const orderId = String(input.orderId || '');
    const amountMinor = Number(input.amountMinor || 0);
    const currency = String(input.currency || 'USD');
    const idempotencyKey = String(input.idempotencyKey || '');
    const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata as Record<string, unknown>
      : {};
    if (!orderId || !idempotencyKey || !Number.isFinite(amountMinor) || amountMinor < 0) {
      throw new Error('Invalid manual payment session input');
    }

    const attemptNumber = Number(metadata.attemptNumber || 1);
    const shopOrigin = String(metadata.shopOrigin || 'http://localhost:3000');
    const locale = String(metadata.locale || 'en');
    const sessionId = `manual_${orderId}_${attemptNumber}`;
    const url = buildManualPaymentUrl(shopOrigin, locale, orderId);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId,
          paymentMethod: MANUAL_PAYMENT_METHOD,
          amount: amountMinor / 100,
          currency,
          status: 'PENDING',
          sessionId,
          sessionUrl: url,
          attemptNumber,
          idempotencyKey,
        },
      });

      await tx.paymentLedger.create({
        data: {
          paymentId: created.id,
          orderId,
          eventType: 'CREATED',
          amount: amountMinor / 100,
          currency,
          provider: MANUAL_PAYMENT_METHOD,
          idempotencyKey,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentAttempts: attemptNumber,
          lastPaymentAttemptAt: new Date(),
          lastPaymentMethod: MANUAL_PAYMENT_METHOD,
        },
      });

      return created;
    });

    return {
      sessionId: payment.sessionId!,
      url: payment.sessionUrl!,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  },

  async verifySession(sessionId: string) {
    const payment = await prisma.payment.findFirst({ where: { sessionId } });
    return {
      sessionId,
      orderId: payment?.orderId,
      status: payment?.status || 'PENDING',
      paymentMethod: payment?.paymentMethod || MANUAL_PAYMENT_METHOD,
    };
  },
};

export { MANUAL_PAYMENT_METHOD };
