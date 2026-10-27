/**
 * Payment verification endpoint: authentication, ownership, provider bound and
 * the reconciliation attempt budget.
 *
 * The endpoint reconciles with the payment provider and reads the payment row,
 * so it must only answer the customer who owns the order behind the payment.
 * It queries the provider without a reconciliation claim, so it must also leave
 * the attempt budget of the background reconciler untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import type { PaymentFact } from '@jiffoo/shared';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { createTestOrder, createTestOrderItem, createTestProduct, deleteAllTestOrders, deleteAllTestProducts } from '../helpers/fixtures';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { prisma } from '@/config/database';
import { createPaymentSession } from '@/core/payment/session';
import { observePaymentFact } from '@/core/payment/observations';
import { PAYMENT_RECONCILIATION_MAX_ATTEMPTS } from '@/core/payment/reconciliation';
import { checkoutPaymentFixtureSource, installFixturePlugin, removeFixturePlugin, verifiedPaymentFixtureFact } from '../helpers/fixture-plugin';

const slug = 'verify-auth-payment';
// The provider account the fixture plugin reports for every fact.
const fixtureAccount = { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' as const };

describe('GET /api/v1/payments/verify/:paymentId', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  let owner: Awaited<ReturnType<typeof createUserWithToken>>;
  let stranger: Awaited<ReturnType<typeof createUserWithToken>>;
  let paymentId = '';
  let orderId = '';
  let orderNumber = '';
  // A second payment of the same customer, used by the budget cases.
  let budgetPaymentId = '';

  async function createOwnerPayment(suffix: string): Promise<{ paymentId: string; orderId: string; orderNumber: string }> {
    const product = await createTestProduct({ name: `Payment verify auth product ${suffix}`, price: 20, stock: 5 });
    const order = await createTestOrder({ userId: owner.user.id, total: 20 });
    await createTestOrderItem({ orderId: order.id, productId: product.id, variantId: product.variants[0].id, price: 20 });
    await prisma.order.update({ where: { id: order.id }, data: { paymentMethod: slug } });
    const session = await createPaymentSession({
      orderId: order.id, userId: owner.user.id, email: owner.user.email, pluginSlug: slug,
      idempotencyKey: `verify-auth:${suffix}:${order.id}`,
      returnUrl: 'http://localhost:3001/en/checkout/return', cancelUrl: 'http://localhost:3001/en/checkout/cancel',
    });
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    return { paymentId: session.paymentId, orderId: order.id, orderNumber: row.orderNumber };
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    admin = await createAdminWithToken();
    owner = await createUserWithToken();
    stranger = await createUserWithToken();
    await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug, 'payment', [{ name: 'payment', version: 2 }], checkoutPaymentFixtureSource);

    const first = await createOwnerPayment('first');
    paymentId = first.paymentId;
    orderId = first.orderId;
    orderNumber = first.orderNumber;
    // A budget the background reconciler has already partly spent. The value is
    // not zero, so an assertion on it can tell "the endpoint left the budget
    // alone" apart from "the endpoint reset the budget to zero".
    await prisma.payment.update({ where: { id: paymentId }, data: { attempts: 3 } });

    budgetPaymentId = (await createOwnerPayment('budget')).paymentId;
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug);
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('answers 401 without credentials and never reaches the provider', async () => {
    const observations = await prisma.paymentObservation.count({ where: { paymentId } });
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/payments/verify/${paymentId}` });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(await prisma.paymentObservation.count({ where: { paymentId } })).toBe(observations);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.attempts).toBe(before.attempts);
    expect(after.status).toBe(before.status);
  });

  it('hides a payment of another customer and never reaches the provider', async () => {
    const observations = await prisma.paymentObservation.count({ where: { paymentId } });
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/payments/verify/${paymentId}`, headers: stranger.authHeader });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    const body = JSON.stringify(response.json());
    expect(body).not.toContain(paymentId);
    expect(body).not.toContain(orderId);
    expect(body).not.toContain(orderNumber);
    expect(await prisma.paymentObservation.count({ where: { paymentId } })).toBe(observations);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.attempts).toBe(before.attempts);
    expect(after.status).toBe(before.status);
  });

  it('returns the payment state for the customer who owns the order', async () => {
    const observations = await prisma.paymentObservation.count({ where: { paymentId } });
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/payments/verify/${paymentId}`, headers: owner.authHeader });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ paymentId, orderId, orderNumber, paymentMethod: slug });
    expect(body.data.status).toBe('PENDING');
    expect(body.data.sessionId).toBeTruthy();
    expect(body.data.paidAt).toBeNull();
    // The provider was queried, and the spent reconciliation attempt budget of
    // the background reconciler is still the value it had before the call.
    expect(await prisma.paymentObservation.count({ where: { paymentId } })).toBe(observations + 1);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.attempts).toBe(before.attempts);
    expect(after.attempts).toBe(3);
    expect(after.status).not.toBe('REQUIRES_REVIEW');
    expect(after.failureReason).not.toBe('query_budget_exhausted');
  });

  it('still resolves a paid payment to SUCCEEDED without touching the budget', async () => {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await verifiedPaymentFixtureFact(slug, payment.sessionId!, `verify-auth:${paymentId}`);
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    const response = await app.inject({ method: 'GET', url: `/api/v1/payments/verify/${paymentId}`, headers: owner.authHeader });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('paid');
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status).toBe('SUCCEEDED');
    expect(after.attempts).toBe(before.attempts);
  });

  it('does not reset the reconciliation attempt budget the reconciler has spent', async () => {
    await prisma.payment.update({ where: { id: budgetPaymentId }, data: { attempts: 4 } });
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: budgetPaymentId } });
    expect(before.attempts).toBe(4);

    const response = await app.inject({ method: 'GET', url: `/api/v1/payments/verify/${budgetPaymentId}`, headers: owner.authHeader });

    expect(response.statusCode).toBe(200);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: budgetPaymentId } });
    // The endpoint neither spends nor resets the budget: the value before the
    // call survives it, instead of being reset to zero.
    expect(after.attempts).toBe(before.attempts);
    expect(after.attempts).toBe(4);
    expect(after.status).not.toBe('REQUIRES_REVIEW');
    expect(after.failureReason).not.toBe('query_budget_exhausted');
  });

  it('never escalates an exhausted payment to a review without a reconciliation claim', async () => {
    // A payment whose creation outcome is unknown and whose reconciliation
    // budget the background reconciler has already exhausted.
    await prisma.payment.update({ where: { id: budgetPaymentId }, data: {
      status: 'UNKNOWN', sessionId: null, failureReason: null, attempts: PAYMENT_RECONCILIATION_MAX_ATTEMPTS,
    } });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: budgetPaymentId } });
    const fact: PaymentFact = {
      account: fixtureAccount, requestKey: payment.idempotencyKey!, sessionId: null,
      amountMinor: 2000, currency: 'USD', observedAt: new Date().toISOString(),
      status: 'pending', captures: [], canStillBeCharged: true, requestClosed: false,
    };

    // The same call the endpoint makes: a query without a reconciliation claim.
    await observePaymentFact(slug, fact, 'query', undefined, budgetPaymentId);

    const after = await prisma.payment.findUniqueOrThrow({ where: { id: budgetPaymentId } });
    expect(after.status).not.toBe('REQUIRES_REVIEW');
    expect(after.failureReason).not.toBe('query_budget_exhausted');
    expect(after.attempts).toBe(PAYMENT_RECONCILIATION_MAX_ATTEMPTS);
  });
});
