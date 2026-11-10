import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { recordNotificationReceipt } from '@/core/notifications/receipts';
import path from 'node:path';

describe('Signed receipt through the real notification runtime', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  const slug = 'receipt-runtime-' + randomUUID().slice(0, 8);
  const key = 'local-only-receipt-fixture-key';
  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const admin = await createAdminWithToken(); adminToken = admin.token; adminUserId = admin.user.id;
    const source = `const crypto = require('node:crypto'); module.exports = { register(ctx) {
      ctx.contracts.implement('notification', 3, {
        send: () => ({ outcome: 'accepted', providerMessageId: 'fixture-message' }),
        verifyReceipt(input) {
          const expected = crypto.createHmac('sha256', ctx.config.verificationKey).update(input.rawBody).digest('hex');
          if (input.headers['test-signature'] !== expected) return { outcome: 'invalid', code: 'SIGNATURE_INVALID' };
          return { outcome: 'verified', events: [JSON.parse(input.rawBody)] };
        }
      });
    } };`;
    await installFixturePlugin({ app, adminToken, adminUserId }, slug, 'notification', [{ name: 'notification', version: 3 }], source, {
      config: { verificationKey: key }, configSchema: { type: 'object', properties: { verificationKey: { type: 'string', sensitive: true } } },
    });
  });
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { providerSlug: slug } });
    if (app) {
      const consoleEmail = await prisma.pluginInstallation.findUnique({ where: { pluginSlug_instanceKey: { pluginSlug: 'console-email', instanceKey: 'default' } } });
      if (consoleEmail) await app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/console-email/instances/${consoleEmail.id}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { enabled: true } });
      await removeFixturePlugin({ app, adminToken, adminUserId }, slug); await app.close();
    }
    await deleteAllTestUsers();
  });
  it('reads the installed provider configuration and verifies original raw bytes before persistence', async () => {
    const row = await prisma.notification.create({ data: { type: 'order_confirmation', toAddress: 'buyer@example.test', locale: 'en', subject: 'Order', html: '', text: 'Order', status: 'FAILED', lastError: 'UNKNOWN: timeout', providerSlug: slug } });
    const event = { eventId: randomUUID(), notificationId: row.id, providerMessageId: 'fixture-message', recipient: row.toAddress, type: 'delivered', occurredAt: new Date().toISOString() };
    const payload = JSON.stringify(event, null, 2);
    const signature = createHmac('sha256', key).update(payload).digest('hex');
    const url = '/api/v1/notifications/receipts/' + slug;
    const valid = await app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json', 'test-signature': signature }, payload });
    expect(valid.statusCode, valid.payload).toBe(200);
    const current = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('FAILED'); expect(current.deliveryStatus).toBe('DELIVERED');
    const tampered = await app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json', 'test-signature': signature }, payload: JSON.stringify(event) });
    expect(tampered.statusCode).toBe(400);
    expect(await prisma.notificationReceipt.count({ where: { notificationId: row.id } })).toBe(1);
  });
  it('filters and counts delivery status before pagination and exposes the bounded detail timeline', async () => {
    const address = randomUUID() + '@example.test';
    const rows = await Promise.all(Array.from({ length: 3 }, () => prisma.notification.create({ data: { type: 'order_confirmation', toAddress: address, locale: 'en', subject: 'Order', html: '', text: 'Order', status: 'SENT', providerSlug: slug } })));
    for (const row of rows.slice(0, 2)) await recordNotificationReceipt(slug, { eventId: randomUUID(), notificationId: row.id, providerMessageId: 'message-' + row.id, recipient: address, type: 'delivered', occurredAt: new Date().toISOString() });
    const response = await app.inject({ method: 'GET', url: `/api/v1/admin/notifications?search=${encodeURIComponent(address)}&deliveryStatus=DELIVERED&limit=1&page=1`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(response.statusCode, response.payload).toBe(200);
    const data = response.json().data;
    expect(data.total).toBe(2); expect(data.totalPages).toBe(2); expect(data.items).toHaveLength(1); expect(data.counts.all).toBe(2); expect(data.counts.SENT).toBe(2);
    expect(data.items[0].deliveryStatus).toBe('DELIVERED'); expect(data.items[0].receiptTimeline).toBeUndefined();
    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/notifications/${data.items[0].id}`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(detail.statusCode).toBe(200); expect(detail.json().data.receiptTimeline).toHaveLength(1); expect(detail.json().data.receiptTimeline[0].type).toBe('delivered');
  });
});
