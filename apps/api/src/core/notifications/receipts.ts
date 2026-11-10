import { createHash } from 'node:crypto';
import { prisma } from '@/config/database';
import { notificationReceiptSchema, type NotificationReceiptInput } from '@jiffoo/shared';

export class NotificationReceiptConflict extends Error {}
const priority = { UNKNOWN: 0, DELAYED: 1, DELIVERED: 2, FAILED: 3, BOUNCED: 3, COMPLAINED: 4 } as const;
export async function recordNotificationReceipt(providerSlug: string, input: NotificationReceiptInput): Promise<'recorded' | 'duplicate' | 'ignored'> {
  const event = notificationReceiptSchema.parse(input);
  if (/[\u0000-\u001f\u007f]/.test(event.notificationId)) return 'ignored';
  const recipient = event.recipient.trim().toLowerCase();
  const occurredAt = new Date(event.occurredAt);
  const payloadHash = createHash('sha256').update(JSON.stringify({ ...event, recipient })).digest('hex');
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${providerSlug + ':' + event.eventId}, 0))`;
    const existing = await tx.notificationReceipt.findUnique({ where: { providerSlug_eventId: { providerSlug, eventId: event.eventId } } });
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new NotificationReceiptConflict('RECEIPT_EVENT_CONFLICT');
      return 'duplicate';
    }
    await tx.$queryRaw`SELECT id FROM public.notifications WHERE id = ${event.notificationId} FOR UPDATE`;
    const notification = await tx.notification.findUnique({ where: { id: event.notificationId } });
    if (!notification || notification.providerSlug !== providerSlug || notification.toAddress.trim().toLowerCase() !== recipient) return 'ignored';
    if (notification.providerMessageId && notification.providerMessageId !== event.providerMessageId) throw new NotificationReceiptConflict('RECEIPT_MESSAGE_CONFLICT');
    await tx.notificationReceipt.create({ data: { providerSlug, eventId: event.eventId, providerMessageId: event.providerMessageId, notificationId: notification.id, recipient, type: event.type, occurredAt, payloadHash } });
    const status = event.type.toUpperCase() as Exclude<keyof typeof priority, 'UNKNOWN'>;
    const stronger = priority[status] > priority[notification.deliveryStatus];
    const newerSame = priority[status] === priority[notification.deliveryStatus] && (!notification.deliveryUpdatedAt || occurredAt > notification.deliveryUpdatedAt || (occurredAt.getTime() === notification.deliveryUpdatedAt.getTime() && status === 'BOUNCED' && notification.deliveryStatus === 'FAILED'));
    await tx.notification.update({ where: { id: notification.id }, data: {
      providerMessageId: event.providerMessageId,
      ...((stronger || newerSame) ? { deliveryStatus: status, deliveryUpdatedAt: occurredAt } : {}),
    } });
    return 'recorded';
  });
}
