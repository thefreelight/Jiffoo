import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { parseEventPayload, type EventKey, type EventPayload, type EventSubscription } from '@jiffoo/shared';
import { prisma } from '@/config/database';

export type EventTransaction = Prisma.TransactionClient | Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

export async function emitEvent<K extends EventKey>(
  transaction: EventTransaction, type: K, version: 1, aggregateId: string,
  data: EventPayload<K>, metadata: { traceId?: string; actorId?: string } = {},
) {
  const tx = transaction as Prisma.TransactionClient;
  const snapshot = parseEventPayload(type, version, data) as Prisma.InputJsonValue;
  const event = await tx.eventRecord.create({
    data: { id: randomUUID(), type, version, aggregateId, data: snapshot, ...metadata },
  });
  const installations = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT i.id FROM plugin_installations i
    JOIN plugin_installs p ON p.slug = i."pluginSlug"
    JOIN plugin_event_subscriptions s ON s."pluginSlug" = p.slug
    WHERE i.enabled AND i."deletedAt" IS NULL AND p."deletedAt" IS NULL
      AND s."eventType" = ${type} AND s.version = ${version}
  `;
  if (installations.length) await tx.eventDelivery.createMany({
    data: installations.map(({ id }) => ({ eventId: event.id, installationId: id })),
  });
  return event;
}

export async function syncEventSubscriptions(
  transaction: EventTransaction, pluginSlug: string, declarations: EventSubscription[] = [],
): Promise<void> {
  const tx = transaction as Prisma.TransactionClient;
  const removed = await tx.pluginEventSubscription.findMany({
    where: { pluginSlug, ...(declarations.length ? { NOT: { OR: declarations.map(({ type, version }) => ({ eventType: type, version })) } } : {}) },
  });
  for (const subscription of removed) {
    await tx.$executeRaw`
      UPDATE event_deliveries d SET status = 'SKIPPED', "skipReason" = 'subscription_removed',
        "finishedAt" = statement_timestamp()
      FROM event_records e, plugin_installations i
      WHERE d."eventId" = e.id AND d."installationId" = i.id AND i."pluginSlug" = ${pluginSlug}
        AND d.status = 'PENDING' AND e.type = ${subscription.eventType} AND e.version = ${subscription.version}
    `;
  }
  await tx.pluginEventSubscription.deleteMany({ where: { pluginSlug } });
  if (declarations.length) await tx.pluginEventSubscription.createMany({
    data: declarations.map(({ type, version }) => ({ pluginSlug, eventType: type, version })),
  });
}
