import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { recordNotificationReceipt } from '@/core/notifications/receipts';
import { completeNotification, failNotification, type NotificationLeaseClient } from '@/core/notifications/lease';

const provider = 'test-receipt-provider';
async function notification(status: 'SENT' | 'SENDING' | 'FAILED' = 'SENT') {
  return prisma.notification.create({ data: { type: 'order_confirmation', toAddress: 'buyer@example.test', locale: 'en', subject: 'Order', html: '<p>Order</p>', text: 'Order', status, providerSlug: provider, ...(status === 'SENDING' ? { claimToken: randomUUID(), claimedBy: 'receipt-test-worker', leaseUntil: new Date(Date.now() + 60000) } : {}), lastError: status === 'FAILED' ? 'UNKNOWN: timeout' : null } });
}
function receipt(id: string, type: 'delivered' | 'delayed' | 'bounced' | 'complained' | 'failed' = 'delivered') {
  return { eventId: randomUUID(), notificationId: id, providerMessageId: 'message-1', recipient: 'buyer@example.test', type, occurredAt: new Date().toISOString() };
}
describe('Core notification receipts', () => {
  beforeEach(async () => { await prisma.notification.deleteMany(); });
  it('stores delivery independently of sending state and never creates a resend', async () => {
    const row = await notification('FAILED');
    expect(await recordNotificationReceipt(provider, receipt(row.id))).toBe('recorded');
    const current = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('FAILED');
    expect(current.deliveryStatus).toBe('DELIVERED');
    expect(current.lastError).toBe('UNKNOWN: timeout');
    expect(await prisma.notification.count()).toBe(1);
  });
  it('deduplicates concurrent events and rejects reuse with changed content', async () => {
    const row = await notification(); const event = receipt(row.id);
    const results = await Promise.all(Array.from({ length: 8 }, () => recordNotificationReceipt(provider, event)));
    expect(results.filter(value => value === 'recorded')).toHaveLength(1);
    expect(await prisma.notificationReceipt.count()).toBe(1);
    await expect(recordNotificationReceipt(provider, { ...event, type: 'bounced' })).rejects.toThrow('RECEIPT_EVENT_CONFLICT');
    const other = await notification();
    await expect(recordNotificationReceipt(provider, { ...event, notificationId: other.id })).rejects.toThrow('RECEIPT_EVENT_CONFLICT');
    expect((await prisma.notificationReceipt.findFirstOrThrow()).notificationId).toBe(row.id);
  });
  it('rejects provider, recipient and message mismatches', async () => {
    const row = await notification();
    expect(await recordNotificationReceipt('other-provider', receipt(row.id))).toBe('ignored');
    expect(await recordNotificationReceipt(provider, { ...receipt(row.id), recipient: 'other@example.test' })).toBe('ignored');
    expect(await prisma.notificationReceipt.count()).toBe(0);
    await recordNotificationReceipt(provider, receipt(row.id));
    await expect(recordNotificationReceipt(provider, { ...receipt(row.id), providerMessageId: 'different-message' })).rejects.toThrow('RECEIPT_MESSAGE_CONFLICT');
  });
  it('never downgrades terminal states when callbacks arrive out of order', async () => {
    const row = await notification();
    await recordNotificationReceipt(provider, receipt(row.id, 'complained'));
    await recordNotificationReceipt(provider, { ...receipt(row.id, 'delayed'), occurredAt: new Date(Date.now() + 1000).toISOString() });
    await recordNotificationReceipt(provider, receipt(row.id, 'delivered'));
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).deliveryStatus).toBe('COMPLAINED');
    expect(await prisma.notificationReceipt.count()).toBe(3);
    const delivered = await notification();
    await recordNotificationReceipt(provider, receipt(delivered.id, 'delivered'));
    await recordNotificationReceipt(provider, { ...receipt(delivered.id, 'delayed'), occurredAt: new Date(Date.now() - 1000).toISOString() });
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: delivered.id } })).deliveryStatus).toBe('DELIVERED');
  });
  it('links an early callback and serializes concurrent send completion', async () => {
    const row = await notification('SENDING');
    const client: NotificationLeaseClient = { query: async (text, values = []) => ({ rows: await prisma.$queryRawUnsafe<Record<string, unknown>[]>(text, ...values) }) };
    await Promise.all([recordNotificationReceipt(provider, receipt(row.id)), completeNotification(client, row, provider, 'message-1')]);
    const current = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(current.status).toBe('SENT'); expect(current.deliveryStatus).toBe('DELIVERED');
    expect(current.providerMessageId).toBe('message-1');
  });
  it('ignores unknown notification identifiers without storing orphan receipts', async () => {
    expect(await recordNotificationReceipt(provider, receipt('unknown-notification'))).toBe('ignored');
    expect(await prisma.notificationReceipt.count()).toBe(0);
  });
  it('preserves the original provider binding when a different selected provider fails', async () => {
    const row = await notification('SENDING');
    const client: NotificationLeaseClient = { query: async (text, values = []) => ({ rows: await prisma.$queryRawUnsafe<Record<string, unknown>[]>(text, ...values) }) };
    await failNotification(client, row, 'NOTIFICATION_PROVIDER_BINDING_FAILED', 'other-provider', { deterministic: true });
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).providerSlug).toBe(provider);
    expect(await recordNotificationReceipt(provider, receipt(row.id))).toBe('recorded');
  });
});
