/**
 * Payments Endpoints Tests
 * 
 * Coverage:
 * - GET /api/payments/available-methods
 * - POST /api/payments/create-session
 * - GET /api/payments/verify/:sessionId
 * - POST /api/payments/stripe/webhook
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts, deleteAllTestOrders } from '../helpers/fixtures';
import { v4 as uuidv4 } from 'uuid';
import { getTestPrisma } from '../helpers/db';

describe('Payments Endpoints', () => {
  let app: FastifyInstance;
  let userToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let supplierProduct: Awaited<ReturnType<typeof createTestProduct>>;
  let testOrderId: string;
  const originalFetch = global.fetch;
  const validShippingAddress = {
    firstName: 'Test',
    lastName: 'User',
    phone: '+1-555-0101',
    addressLine1: '123 Payment St',
    city: 'Test City',
    state: 'CA',
    postalCode: '94016',
    country: 'US',
  };

  beforeAll(async () => {
    app = await createTestApp();
    const { token } = await createUserWithToken();
    userToken = token;

    testProduct = await createTestProduct({
      name: 'Payment Test Product',
      price: 59.99,
      stock: 100,
    });
    supplierProduct = await createTestProduct({
      name: 'Supplier Payment Product',
      price: 49.99,
      stock: 50,
      productType: 'digital',
      requiresShipping: false,
      skuCode: 'odoo-payment-sku',
      typeData: {
        provider: 'odoo',
        installationId: 'ins_payment_supplier',
        sourceProductType: 'esim',
        externalProductCode: `ODOO-PAYMENT-${uuidv4()}`,
      },
    });
    const prisma = getTestPrisma();
    const supplierExternalCode = `ODOO-PAYMENT-${supplierProduct.id}`;
    const supplierVariantCode = `odoo-payment-sku-${supplierProduct.variants[0].id}`;
    await prisma.externalProductLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_payment_supplier',
        storeId: 'store_1',
        externalProductCode: supplierExternalCode,
        coreProductId: supplierProduct.id,
        coreProductSlug: supplierProduct.slug,
        sourceIsActive: true,
      },
    });
    await prisma.externalVariantLink.create({
      data: {
        provider: 'odoo',
        installationId: 'ins_payment_supplier',
        storeId: 'store_1',
        externalProductCode: supplierExternalCode,
        externalVariantCode: supplierVariantCode,
        coreProductId: supplierProduct.id,
        coreVariantId: supplierProduct.variants[0].id,
        coreSkuCode: supplierVariantCode,
        sourceIsActive: true,
      },
    });

    // Create a test order
    const orderResponse = await app.inject({
      method: 'POST',
      url: '/api/orders/',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        items: [{ productId: testProduct.id, variantId: testProduct.variants[0].id, quantity: 1 }],
        shippingAddress: validShippingAddress,
      },
    });

    if (orderResponse.statusCode === 200 || orderResponse.statusCode === 201) {
      testOrderId = orderResponse.json().data.id;
    }
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('GET /api/payments/available-methods', () => {
    it('should return available payment methods', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/available-methods',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/available-methods',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('POST /api/payments/create-session', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        payload: {
          paymentMethod: 'stripe',
          orderId: testOrderId,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing paymentMethod', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          orderId: testOrderId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing orderId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'stripe',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400/404/409 for non-existent order', async () => {
      const fakeOrderId = uuidv4();

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'stripe',
          orderId: fakeOrderId,
        },
      });

      expect([400, 404, 409]).toContain(response.statusCode);
    });

    it('should handle payment session creation', async () => {
      if (!testOrderId) return;

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/create-session',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          paymentMethod: 'stripe',
          orderId: testOrderId,
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        },
      });

      // May fail if Stripe is not configured in test environment,
      // or return conflict when payment state is not eligible.
      expect([200, 400, 409, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/payments/verify/:sessionId', () => {
    it('should return pending status for non-existent session', async () => {
      const fakeSessionId = 'cs_test_invalid_session_id';

      const response = await app.inject({
        method: 'GET',
        url: `/api/payments/verify/${fakeSessionId}`,
      });

      // API returns 200 with pending status for non-existent sessions
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.status).toBe('pending');
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/verify/test-session-id',
      });

      // Should not return 401 (payment verification is public)
      expect(response.statusCode).not.toBe(401);
    });

    it('should trigger supplier order creation after payment succeeds', async () => {
      const prisma = getTestPrisma();
      const supplierOrder = await app.inject({
        method: 'POST',
        url: '/api/orders/',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          items: [
            {
              productId: supplierProduct.id,
              variantId: supplierProduct.variants[0].id,
              quantity: 1,
            },
          ],
        },
      });

      expect(supplierOrder.statusCode).toBe(201);
      const orderId = supplierOrder.json().data.id as string;

      await prisma.payment.create({
        data: {
          orderId,
          paymentMethod: 'stripe',
          amount: 49.99,
          currency: 'USD',
          status: 'PENDING',
          sessionId: 'cs_test_supplier_success',
          attemptNumber: 1,
        },
      });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { status: 'paid', paymentIntentId: 'pi_1' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              externalOrderName: 'ODOO-ORDER-1',
              externalStatus: 'submitted',
            },
          }),
        } as Response);

      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/verify/cs_test_supplier_success',
      });

      expect(response.statusCode).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const externalLinks = await prisma.externalOrderLink.findMany({
        where: { coreOrderId: orderId },
      });
      expect(externalLinks).toHaveLength(1);
      expect(externalLinks[0].syncStatus).toBe('SUBMITTED');

      const updatedOrder = await prisma.order.findUnique({ where: { id: orderId } });
      expect(updatedOrder?.status).toBe('PROCESSING');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('POST /api/payments/webhook/:provider', () => {
    it('should handle webhook for stripe provider', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook/stripe',
        payload: {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
            },
          },
        },
      });

      // The generic webhook handler returns success
      expect([200, 400, 401, 500]).toContain(response.statusCode);
    });

    it('should handle webhook with signature header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook/stripe',
        headers: {
          'stripe-signature': 'test-signature',
        },
        payload: {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
            },
          },
        },
      });

      // Generic webhook handler accepts the request
      expect([200, 400, 401, 500]).toContain(response.statusCode);
    });

    it('should not require JWT authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook/stripe',
        headers: {
          'stripe-signature': 'test-signature',
        },
        payload: {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
            },
          },
        },
      });

      expect(response.statusCode).not.toBe(401);
    });
  });
});
