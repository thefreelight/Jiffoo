import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { notificationReceiptRoutes } from '@/core/notifications/receipt-routes';
const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('@/core/extensions/runtime/plugin-runtime', () => ({ callContract: verify }));

describe('Notification receipt ingress', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = Fastify(); await app.register(notificationReceiptRoutes, { prefix: '/api/v1' }); await app.ready(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { verify.mockReset(); await prisma.notification.deleteMany(); });
  it('forwards exact raw bytes to the provider without requiring a customer token', async () => {
    verify.mockResolvedValue({ outcome: 'verified', events: [] });
    const payload = '{\n  "type" : "email.delivered"\n}';
    const result = await app.inject({ method: 'POST', url: '/api/v1/notifications/receipts/receipt-provider', headers: { 'content-type': 'application/json', 'test-signature': 'opaque-signature', authorization: 'Bearer local-private-token', cookie: 'session=local-private-cookie', 'x-user-id': 'untrusted-user' }, payload });
    expect(result.statusCode).toBe(200);
    expect(verify.mock.calls[0]?.slice(0, 4)).toEqual(['receipt-provider', 'notification', 3, 'verifyReceipt']);
    expect(verify.mock.calls[0]?.[4].rawBody).toBe(payload);
    expect(verify.mock.calls[0]?.[4].headers['test-signature']).toBe('opaque-signature');
    expect(verify.mock.calls[0]?.[4].headers.authorization).toBeUndefined();
    expect(verify.mock.calls[0]?.[4].headers.cookie).toBeUndefined();
    expect(verify.mock.calls[0]?.[4].headers['x-user-id']).toBeUndefined();
  });
  it('rejects unverified or unavailable callbacks without persisting them', async () => {
    for (const [outcome, status] of [['invalid', 400], ['unavailable', 503]] as const) {
      verify.mockResolvedValue({ outcome, code: 'RECEIPT_REJECTED' });
      const result = await app.inject({ method: 'POST', url: '/api/v1/notifications/receipts/receipt-provider', headers: { 'content-type': 'application/json' }, payload: '{}' });
      expect(result.statusCode).toBe(status);
    }
    expect(await prisma.notificationReceipt.count()).toBe(0);
  });
  it('records signed normalized events and rejects conflicting event identifiers', async () => {
    const row = await prisma.notification.create({ data: { type: 'order_confirmation', toAddress: 'buyer@example.test', locale: 'en', subject: 'Order', html: '', text: 'Order', status: 'SENT', providerSlug: 'receipt-provider' } });
    const event = { eventId: randomUUID(), notificationId: row.id, providerMessageId: 'message-1', recipient: row.toAddress, type: 'delivered', occurredAt: new Date().toISOString() };
    verify.mockResolvedValue({ outcome: 'verified', events: [event] });
    const request = { method: 'POST' as const, url: '/api/v1/notifications/receipts/receipt-provider', headers: { 'content-type': 'application/json' }, payload: '{}' };
    expect((await app.inject(request)).statusCode).toBe(200);
    expect((await app.inject(request)).statusCode).toBe(200);
    verify.mockResolvedValue({ outcome: 'verified', events: [{ ...event, type: 'bounced' }] });
    expect((await app.inject(request)).statusCode).toBe(409);
    expect(await prisma.notificationReceipt.count()).toBe(1);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).deliveryStatus).toBe('DELIVERED');
  });
  it('rejects oversized input before invoking a verifier', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/notifications/receipts/receipt-provider', headers: { 'content-type': 'application/json' }, payload: 'x'.repeat(65537) });
    expect(response.statusCode).toBe(413); expect(verify).not.toHaveBeenCalled();
  });
});
