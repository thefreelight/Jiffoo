import { prisma } from '@/config/database';

export const EVENT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function cleanupEvents(): Promise<{ deliveries: number; events: number }> {
  return prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(918203) AS locked`;
    if (!lock.locked) return { deliveries: 0, events: 0 };
    let deliveries = 0;
    let deleted: number;
    do {
      deleted = await tx.$executeRaw`
      DELETE FROM event_deliveries WHERE id IN (
        SELECT id FROM event_deliveries WHERE status IN ('SUCCEEDED', 'SKIPPED', 'FAILED')
          AND "finishedAt" < statement_timestamp() - interval '30 days'
        ORDER BY "finishedAt", id LIMIT 1000 FOR UPDATE SKIP LOCKED
      )
      `;
      deliveries += deleted;
    } while (deleted === 1000);
    let events = 0;
    do {
      deleted = await tx.$executeRaw`
      DELETE FROM event_records e WHERE e.id IN (
        SELECT r.id FROM event_records r WHERE r."occurredAt" < statement_timestamp() - interval '30 days'
          AND NOT EXISTS (SELECT 1 FROM event_deliveries d WHERE d."eventId" = r.id)
        ORDER BY r."occurredAt", r.id LIMIT 1000 FOR UPDATE OF r SKIP LOCKED
      )
      `;
      events += deleted;
    } while (deleted === 1000);
    return { deliveries, events };
  }, { timeout: 60_000 });
}
