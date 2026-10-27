import { prisma } from '@/config/database';

export const EVENT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** One sweep deletes at most this many rows per statement and per transaction. */
const CLEANUP_BATCH_SIZE = 1000;

/**
 * The retention sweep deletes in bounded batches. Every batch is its own
 * transaction that re-takes the advisory lock, so a slow batch never rolls
 * back the work of the batches before it and never holds its row locks for
 * the whole sweep.
 *
 * @returns the number of deleted rows, or null when the sweep lock is held.
 */
async function deleteDeliveriesBatch(): Promise<number | null> {
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(918203) AS locked`;
    if (!lock.locked) return null;
    return tx.$executeRaw`
      DELETE FROM event_deliveries WHERE id IN (
        SELECT id FROM event_deliveries WHERE status IN ('SUCCEEDED', 'SKIPPED', 'FAILED')
          AND "finishedAt" < statement_timestamp() - interval '30 days'
        ORDER BY "finishedAt", id LIMIT ${CLEANUP_BATCH_SIZE} FOR UPDATE SKIP LOCKED
      )
    `;
  }, { timeout: 60_000 });
}

/**
 * Deletes the event records whose deliveries are all gone. The safety check
 * stays inside the batch transaction, so a record survives while a delivery
 * still references it.
 *
 * @returns the number of deleted rows, or null when the sweep lock is held.
 */
async function deleteEventsBatch(): Promise<number | null> {
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(918203) AS locked`;
    if (!lock.locked) return null;
    return tx.$executeRaw`
      DELETE FROM event_records e WHERE e.id IN (
        SELECT r.id FROM event_records r WHERE r."occurredAt" < statement_timestamp() - interval '30 days'
          AND NOT EXISTS (SELECT 1 FROM event_deliveries d WHERE d."eventId" = r.id)
        ORDER BY r."occurredAt", r.id LIMIT ${CLEANUP_BATCH_SIZE} FOR UPDATE OF r SKIP LOCKED
      )
    `;
  }, { timeout: 60_000 });
}

export async function cleanupEvents(): Promise<{ deliveries: number; events: number }> {
  let deliveries = 0;
  for (;;) {
    const deleted = await deleteDeliveriesBatch();
    if (deleted === null) return { deliveries, events: 0 };
    deliveries += deleted;
    if (deleted < CLEANUP_BATCH_SIZE) break;
  }
  let events = 0;
  for (;;) {
    const deleted = await deleteEventsBatch();
    if (deleted === null) return { deliveries, events };
    events += deleted;
    if (deleted < CLEANUP_BATCH_SIZE) break;
  }
  return { deliveries, events };
}
