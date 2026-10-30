/**
 * The audit write of a money transaction must not roll back the money state.
 *
 * The audit row is a side effect of the transaction that moves the money. A
 * failing audit write - a locked audit table, a full disk, a timeout - must
 * not undo the payment state that the observation produced, because the
 * payment state and the provider have to agree. The missing audit row is the
 * accepted trade-off of that order, and the loss is recorded in the
 * structured log.
 *
 * The observation path is the case here: it writes the review audit row of a
 * fact that does not match the payment, and it moves the payment to a manual
 * review in the same transaction.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
import { writePaymentAudit } from '@/core/payment/service';
import { AuditService } from '@/core/audit/service';
import { checkoutPaymentFixtureSource, installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';

const slug = 'audit-failure-payment';
// The provider account the fixture plugin reports for every fact.
const fixtureAccount = { namespace: 'fixture', merchantAccount: 'fixture', environment: 'test' as const };

describe('the audit write of the payment observation path', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  let owner: Awaited<ReturnType<typeof createUserWithToken>>;
  // Two payments: one carries the successful observation, the other the
  // observation whose audit write fails.
  let observedPaymentId = '';
  let failingPaymentId = '';
  let statementPaymentId = '';
  // The row that makes the audit insert of the statement level case fail with
  // a duplicate key: the failure then happens inside the database.
  const probeId = 'audit-failure-statement-probe';

  async function createOwnerPayment(suffix: string): Promise<string> {
    const product = await createTestProduct({ name: `Audit failure product ${suffix}`, price: 20, stock: 5 });
    const order = await createTestOrder({ userId: owner.user.id, total: 20 });
    await createTestOrderItem({ orderId: order.id, productId: product.id, price: 20 });
    await prisma.order.update({ where: { id: order.id }, data: { paymentMethod: slug } });
    const session = await createPaymentSession({
      orderId: order.id, userId: owner.user.id, email: owner.user.email, pluginSlug: slug,
      idempotencyKey: `audit-failure:${suffix}:${order.id}`,
      returnUrl: 'http://localhost:3001/en/checkout/return', cancelUrl: 'http://localhost:3001/en/checkout/cancel',
    });
    return session.paymentId;
  }

  /** A fact of an amount the payment does not carry, so the observation needs a review. */
  async function mismatchedFact(paymentId: string, amountMinor: number): Promise<PaymentFact> {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return {
      account: fixtureAccount, requestKey: payment.idempotencyKey!, sessionId: payment.sessionId,
      amountMinor, currency: payment.currency, observedAt: new Date().toISOString(),
      status: 'pending', captures: [], canStillBeCharged: true, requestClosed: false,
    };
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    admin = await createAdminWithToken();
    owner = await createUserWithToken();
    await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug, 'payment', [{ name: 'payment', version: 2 }], checkoutPaymentFixtureSource);
    observedPaymentId = await createOwnerPayment('observed');
    failingPaymentId = await createOwnerPayment('failing');
    statementPaymentId = await createOwnerPayment('statement');
  });

  afterAll(async () => {
    await deleteAllTestOrders();
    await removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug);
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  it('writes the review audit row of a successful observation unchanged', async () => {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: observedPaymentId } });
    const before = await prisma.paymentObservation.count({ where: { paymentId: observedPaymentId } });

    await observePaymentFact(slug, await mismatchedFact(observedPaymentId, 1), 'query', undefined, observedPaymentId);

    const after = await prisma.payment.findUniqueOrThrow({ where: { id: observedPaymentId } });
    expect(after.status).toBe('REQUIRES_REVIEW');
    expect(after.failureReason).toBe('amount_mismatch');
    expect(await prisma.paymentObservation.count({ where: { paymentId: observedPaymentId } })).toBe(before + 1);
    const observation = await prisma.paymentObservation.findFirstOrThrow({ where: { paymentId: observedPaymentId, source: 'query' } });
    const audit = await prisma.adminAuditEvent.findUniqueOrThrow({ where: { id: `payment-observation:${observation.id}` } });
    expect(audit).toMatchObject({
      actorId: slug,
      action: 'PAYMENT_OBSERVATION_REVIEW_REQUIRED',
      targetType: 'payment',
      targetId: observedPaymentId,
      summary: { observationId: observation.id, reason: 'amount_mismatch' },
    });
  });

  it('keeps the payment state the observation produced when the audit write fails', async () => {
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: failingPaymentId } });
    const observations = await prisma.paymentObservation.count({ where: { paymentId: failingPaymentId } });
    const messages: string[] = [];
    const audit = vi.spyOn(AuditService, 'write').mockRejectedValue(new Error('the audit table is locked'));
    const logged = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      messages.push(args.map(value => String(value)).join(' '));
    });
    try {
      await observePaymentFact(slug, await mismatchedFact(failingPaymentId, 2), 'query', undefined, failingPaymentId);
    } finally {
      audit.mockRestore();
      logged.mockRestore();
    }

    // The money state survives the failing audit write: the observation was
    // applied and the payment carries the review the observation produced.
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: failingPaymentId } });
    expect(after.status).toBe('REQUIRES_REVIEW');
    expect(after.failureReason).toBe('amount_mismatch');
    expect(after.status).not.toBe(before.status);
    expect(await prisma.paymentObservation.count({ where: { paymentId: failingPaymentId } })).toBe(observations + 1);
    const observation = await prisma.paymentObservation.findFirstOrThrow({ where: { paymentId: failingPaymentId, source: 'query' } });
    // The audit row is missing, and the loss is recorded in the log.
    expect(await prisma.adminAuditEvent.findUnique({ where: { id: `payment-observation:${observation.id}` } })).toBeNull();
    const failure = messages
      .map(message => { try { return JSON.parse(message); } catch { return null; } })
      .find(value => value && value.event === 'payment-audit-write-failed');
    expect(failure).toMatchObject({
      event: 'payment-audit-write-failed',
      action: 'PAYMENT_OBSERVATION_REVIEW_REQUIRED',
      targetType: 'payment',
      targetId: failingPaymentId,
    });
    expect(String(failure.reason)).toContain('the audit table is locked');
  });

  it('keeps the payment state when the audit write fails inside the database', async () => {
    // A row that carries the id of the audit insert, so the insert of the
    // observation fails with a duplicate key inside the database. Such a
    // failure aborts the whole transaction there, so only the savepoint of
    // the audit write can save the money state of the transaction.
    await prisma.adminAuditEvent.create({ data: {
      id: probeId, actorId: 'audit-failure-probe', action: 'AUDIT_FAILURE_PROBE', targetType: 'payment', targetId: probeId,
      summary: { probe: true },
    } });
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: statementPaymentId } });
    const observations = await prisma.paymentObservation.count({ where: { paymentId: statementPaymentId } });
    const messages: string[] = [];
    const audit = vi.spyOn(AuditService, 'write').mockImplementation(async (tx, entry) => {
      await tx.adminAuditEvent.create({ data: {
        id: probeId, actorId: entry.actorId, action: entry.action, targetType: entry.targetType, targetId: entry.targetId,
        summary: entry.summary ?? { probe: true },
      } });
    });
    const logged = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      messages.push(args.map(value => String(value)).join(' '));
    });
    try {
      // The observation settles: the failed audit write is rolled back to its
      // savepoint, so the transaction stays usable and the money state of the
      // observation is committed.
      await observePaymentFact(slug, await mismatchedFact(statementPaymentId, 3), 'query', undefined, statementPaymentId);
    } finally {
      audit.mockRestore();
      logged.mockRestore();
      await prisma.adminAuditEvent.deleteMany({ where: { id: probeId } });
    }

    const after = await prisma.payment.findUniqueOrThrow({ where: { id: statementPaymentId } });
    expect(after.status).toBe('REQUIRES_REVIEW');
    expect(after.failureReason).toBe('amount_mismatch');
    expect(after.status).not.toBe(before.status);
    expect(await prisma.paymentObservation.count({ where: { paymentId: statementPaymentId } })).toBe(observations + 1);
    const observation = await prisma.paymentObservation.findFirstOrThrow({ where: { paymentId: statementPaymentId, source: 'query' } });
    expect(await prisma.adminAuditEvent.findUnique({ where: { id: `payment-observation:${observation.id}` } })).toBeNull();
    const failure = messages
      .map(message => { try { return JSON.parse(message); } catch { return null; } })
      .find(value => value && value.event === 'payment-audit-write-failed');
    expect(failure).toMatchObject({
      event: 'payment-audit-write-failed',
      action: 'PAYMENT_OBSERVATION_REVIEW_REQUIRED',
      targetType: 'payment',
      targetId: statementPaymentId,
    });
    expect(String(failure.reason)).toContain('Unique constraint');
  });

  it('records the loss of the savepoint protection when the client cannot carry one', async () => {
    // A client that is not a transaction client cannot carry a savepoint, so
    // the audit write runs without its protection. That degradation is never
    // silent: it is recorded with the action, the target and the reason, and
    // the write itself still happens.
    const written: unknown[] = [];
    const client = {
      adminAuditEvent: {
        create: async (args: unknown) => { written.push(args); return args; },
        upsert: async (args: unknown) => { written.push(args); return args; },
      },
    };
    const messages: string[] = [];
    const logged = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      messages.push(args.map(value => String(value)).join(' '));
    });
    try {
      await writePaymentAudit(client as never, {
        actorId: 'system', action: 'PAYMENT_AUDIT_PROBE', targetType: 'payment', targetId: 'probe-payment',
      });
    } finally {
      logged.mockRestore();
    }

    expect(written).toHaveLength(1);
    const degradation = messages
      .map(message => { try { return JSON.parse(message); } catch { return null; } })
      .find(value => value && value.event === 'payment-audit-savepoint-unavailable');
    expect(degradation).toMatchObject({
      event: 'payment-audit-savepoint-unavailable',
      action: 'PAYMENT_AUDIT_PROBE',
      targetType: 'payment',
      targetId: 'probe-payment',
    });
    expect(String(degradation.reason)).toContain('not a transaction client');
  });
});
