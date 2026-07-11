import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { prismaMock, stripeServiceMock } = vi.hoisted(() => ({
  prismaMock: {
    order: {
      findFirst: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  stripeServiceMock: {
    confirmNativePayment: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  prisma: prismaMock,
}));

vi.mock('@/services/stripe.service', () => ({
  StripeService: stripeServiceMock,
}));

import {
  NativePaymentConfirmationError,
  NativePaymentConfirmationService,
} from '@/core/payment/native-confirmation';

function buildTx() {
  return {
    payment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentLedger: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    outboxEvent: {
      create: vi.fn(),
    },
  };
}

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord_1',
    userId: 'user_1',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    totalAmount: new Prisma.Decimal(5.9),
    currency: 'USD',
    paymentAttempts: 0,
    ...overrides,
  };
}

describe('NativePaymentConfirmationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects raw native wallet tokens without provider-verifiable ids', async () => {
    prismaMock.order.findFirst.mockResolvedValue(mockOrder());

    await expect(NativePaymentConfirmationService.confirm('apple-pay', 'user_1', {
      orderId: 'ord_1',
      token: { paymentData: 'raw-wallet-token' },
      expectedTotal: 5.9,
      currency: 'USD',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'PAYMENT_PROVIDER_TOKEN_UNSUPPORTED',
    });
    expect(stripeServiceMock.confirmNativePayment).not.toHaveBeenCalled();
  });

  it('marks order paid when Stripe confirms a native payment method', async () => {
    prismaMock.order.findFirst.mockResolvedValue(mockOrder());
    stripeServiceMock.confirmNativePayment.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
      amount: 590,
      currency: 'usd',
      metadata: { orderId: 'ord_1' },
    });

    const tx = buildTx();
    tx.payment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    tx.payment.create.mockResolvedValue({
      id: 'pay_1',
      orderId: 'ord_1',
      attemptNumber: 1,
    });
    tx.paymentLedger.findFirst.mockResolvedValue(null);
    tx.paymentLedger.create.mockResolvedValue({});
    tx.order.update.mockResolvedValue({
      id: 'ord_1',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
    });
    tx.order.findUnique.mockResolvedValue({
      id: 'ord_1',
      userId: 'user_1',
      customerEmail: 'user@bokmoo.com',
      totalAmount: new Prisma.Decimal(5.9),
      currency: 'USD',
      items: [
        {
          id: 'item_1',
          productId: 'prod_japan_5gb',
          variantId: 'var_japan_5gb_30d',
          quantity: 1,
          unitPrice: new Prisma.Decimal(5.9),
          fulfillmentData: null,
          product: {
            id: 'prod_japan_5gb',
            name: 'Japan 5GB',
            typeData: { type: 'esim', esim: { country: 'Japan' } },
          },
          variant: {
            id: 'var_japan_5gb_30d',
            name: '30 days',
            skuCode: 'JP-5GB-30D',
          },
        },
      ],
    });
    tx.orderStatusHistory.create.mockResolvedValue({});
    tx.outboxEvent.create.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation((run: any) => run(tx));

    const result = await NativePaymentConfirmationService.confirm('google-pay', 'user_1', {
      orderId: 'ord_1',
      stripePaymentMethodId: 'pm_123',
      expectedTotal: 5.9,
      currency: 'USD',
    });

    expect(stripeServiceMock.confirmNativePayment).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'ord_1',
      amount: 590,
      currency: 'usd',
      paymentMethodId: 'pm_123',
      provider: 'google-pay',
    }));
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        paymentMethod: 'google-pay',
        paymentIntentId: 'pi_123',
        status: 'SUCCEEDED',
      }),
    }));
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'PROCESSING',
        paymentStatus: 'PAID',
      }),
    }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'order.paid',
        aggregateId: 'ord_1',
        payload: expect.objectContaining({
          type: 'order.paid',
          aggregateId: 'ord_1',
          data: expect.objectContaining({
            event: 'order.paid',
            orderId: 'ord_1',
            userId: 'user_1',
            order: expect.objectContaining({
              id: 'ord_1',
              userId: 'user_1',
              items: [
                expect.objectContaining({
                  id: 'item_1',
                  productId: 'prod_japan_5gb',
                  variantId: 'var_japan_5gb_30d',
                }),
              ],
            }),
          }),
        }),
      }),
    }));
    expect(result).toMatchObject({
      orderId: 'ord_1',
      provider: 'google-pay',
      status: 'paid',
      paymentId: 'pay_1',
      providerPaymentIntentId: 'pi_123',
    });
  });
});
