import { randomUUID } from 'node:crypto';
import { Prisma, type EventDelivery } from '@prisma/client';
import { prisma } from '@/config/database';
import { parseEventPayload, type EventKey, type PluginEvent } from '@jiffoo/shared';
import { deliverInstallationEvent } from '@/core/admin/extension-installer/plugin-runtime';
import type { EventTransaction } from './emit';
import { redactPluginFailure } from '@/core/admin/extension-installer/plugin-failure';
import { observeWorkerShutdownForTest } from '../worker-shutdown';

export const EVENT_HANDLER_TIMEOUT_MS = 30_000;
export const EVENT_LEASE_SECONDS = 60;
export const EVENT_POLL_INTERVAL_MS = 1_000;
export const EVENT_BATCH_SIZE = 16;
export const EVENT_RETRY_SECONDS = [60, 300, 900, 3600, 10800, 21600, 43200] as const;
export const EVENT_MAX_ATTEMPTS = 8;
let testHandlerTimeoutMs: number | undefined;
export function setEventDeliveryTimeoutForTest(enabled: boolean, value?: number): void {
  if (process.env.NODE_ENV !== 'test' || !enabled) throw new Error('Event timeout controls require an explicit test switch');
  if (value !== undefined && (!Number.isInteger(value) || value <= 0 || value >= EVENT_LEASE_SECONDS * 1000)) throw new Error('Invalid event test timeout');
  testHandlerTimeoutMs = value;
}
// Limit planner tuning to the claim transaction; its ordered index needs no sort.
export const EVENT_CLAIM_PLANNER_SQL = 'SET LOCAL enable_sort = off';

export const CLAIM_EVENT_DELIVERIES_SQL = `
WITH RECURSIVE installations AS (
  (SELECT "installationId" FROM event_deliveries
   WHERE status = 'PENDING' AND "nextAttemptAt" <= statement_timestamp() AND attempts < 8
   ORDER BY "installationId" LIMIT 1)
  UNION ALL
  SELECT next."installationId" FROM installations previous
  CROSS JOIN LATERAL (
    SELECT "installationId" FROM event_deliveries
    WHERE status = 'PENDING' AND "installationId" > previous."installationId"
      AND "nextAttemptAt" <= statement_timestamp() AND attempts < 8
    ORDER BY "installationId" LIMIT 1
  ) next
), picked AS MATERIALIZED (
  SELECT candidate.ctid FROM installations i
  CROSS JOIN LATERAL (
    SELECT d.ctid FROM event_deliveries d
    WHERE d.status = 'PENDING' AND d."installationId" = i."installationId"
      AND d."nextAttemptAt" <= statement_timestamp() AND d.attempts < 8
      AND NOT (i."installationId" = ANY($1::text[]))
    ORDER BY d."nextAttemptAt", d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED
  ) candidate LIMIT $2
)
UPDATE event_deliveries d SET status = 'RUNNING', attempts = d.attempts + 1,
  "claimedBy" = $3, "claimToken" = $4,
  "leaseUntil" = statement_timestamp() + interval '60 seconds'
WHERE d.ctid = ANY(ARRAY(SELECT ctid FROM picked)) AND d.status = 'PENDING' RETURNING d.*`;

export async function claimEventDeliveries(
  workerId: string, excluded: string[] = [], limit = EVENT_BATCH_SIZE,
): Promise<EventDelivery[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(EVENT_CLAIM_PLANNER_SQL);
    return tx.$queryRawUnsafe<EventDelivery[]>(
      CLAIM_EVENT_DELIVERIES_SQL, excluded, Math.min(EVENT_BATCH_SIZE, Math.max(0, limit)), workerId, randomUUID(),
    );
  });
}

async function finishFailure(transaction: EventTransaction, delivery: EventDelivery, error: string): Promise<void> {
  error = await redactPluginFailure('', error, delivery.installationId);
  const tx = transaction as Prisma.TransactionClient;
  const final = delivery.attempts >= EVENT_MAX_ATTEMPTS;
  const delay = final ? 0 : EVENT_RETRY_SECONDS[delivery.attempts - 1];
  const changed = await tx.$executeRaw`
    UPDATE event_deliveries SET status = ${final ? 'FAILED' : 'PENDING'}::"EventDeliveryStatus",
      "lastError" = ${error}, "nextAttemptAt" = statement_timestamp() + ${delay} * interval '1 second',
      "finishedAt" = CASE WHEN ${final} THEN statement_timestamp() ELSE NULL END,
      "leaseUntil" = NULL, "claimToken" = NULL, "claimedBy" = NULL
    WHERE id = ${delivery.id} AND status = 'RUNNING' AND "claimToken" = ${delivery.claimToken}
  `;
  if (final && changed) await tx.$executeRaw`
    UPDATE plugin_installations SET "lastFailureAt" = (
      SELECT "finishedAt" AT TIME ZONE 'UTC' FROM event_deliveries WHERE id = ${delivery.id}
    ), "lastFailureMessage" = ${error}
    WHERE id = ${delivery.installationId}
  `;
}

export async function recoverEventLeases(): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<EventDelivery[]>`
      SELECT * FROM event_deliveries WHERE status = 'RUNNING' AND "leaseUntil" <= statement_timestamp()
      ORDER BY "leaseUntil", id LIMIT 100 FOR UPDATE SKIP LOCKED
    `;
    for (const delivery of expired) await finishFailure(tx, delivery, 'Event delivery lease expired');
    return expired.length;
  });
}

export class EventDeliveryEngine {
  readonly timeoutMs: number;
  private readonly installations = new Set<string>();
  private readonly pending = new Set<Promise<void>>();
  private readonly invocations = new Map<string, { installationId: string; promise: Promise<unknown> }>();
  private timer: NodeJS.Timeout | null = null;
  private claiming = false;
  private claimOperation: Promise<number> | null = null;
  private stopped = false;

  constructor(readonly workerId: string, options: { timeoutMs?: number } = {}) {
    if (testHandlerTimeoutMs !== undefined && process.env.NODE_ENV !== 'test') throw new Error('Event timeout controls are not permitted outside tests');
    this.timeoutMs = options.timeoutMs ?? testHandlerTimeoutMs ?? EVENT_HANDLER_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs >= EVENT_LEASE_SECONDS * 1000) {
      throw new Error('Event handler timeout must be positive and shorter than the lease');
    }
  }

  isRunning(): boolean { return this.timer !== null; }
  inFlightInstallations(): number { return this.installations.size; }
  unsettled() {
    return [
      ...(this.claimOperation ? [{ kind: 'event-claim', id: this.workerId }] : []),
      ...[...this.invocations].map(([id, item]) => ({ kind: 'event-delivery', id, installationId: item.installationId })),
    ];
  }

  runOnce(): Promise<number> {
    if (this.claiming || this.stopped) return Promise.resolve(0);
    const operation = this.claimAndDispatch();
    this.claimOperation = operation;
    void operation.finally(() => {
      if (this.claimOperation === operation) this.claimOperation = null;
    }).catch(() => undefined);
    return operation;
  }

  private async claimAndDispatch(): Promise<number> {
    this.claiming = true;
    try {
      await recoverEventLeases();
      if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_EVENT_CLAIM_OBSERVE === '1' && process.send) {
        process.send({ kind: 'event-claim-start' });
      }
      const deliveries = await claimEventDeliveries(this.workerId, [...this.installations], EVENT_BATCH_SIZE - this.installations.size);
      for (const delivery of deliveries) {
        this.installations.add(delivery.installationId);
        const operation = this.deliver(delivery);
        this.pending.add(operation);
        void operation.finally(() => this.pending.delete(operation)).catch(() => undefined);
      }
      return deliveries.length;
    } finally { this.claiming = false; }
  }

  private async deliver(delivery: EventDelivery): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    const invoke = async () => {
      const record = await prisma.eventRecord.findUniqueOrThrow({ where: { id: delivery.eventId } });
      const event: PluginEvent = {
        id: record.id, type: record.type as EventKey, version: 1, aggregateId: record.aggregateId,
        occurredAt: record.occurredAt.toISOString(), attempt: delivery.attempts,
        data: parseEventPayload(record.type as EventKey, record.version, record.data),
      };
      return deliverInstallationEvent(delivery.installationId, Object.freeze(event), databaseAbort.signal);
    };
    const databaseAbort = new AbortController();
    const invocation = invoke();
    this.invocations.set(delivery.id, { installationId: delivery.installationId, promise: invocation });
    void invocation.finally(() => this.invocations.delete(delivery.id)).catch(() => undefined);
    // A timeout cannot cancel plugin code. Retain its local slot until it actually settles.
    void invocation.finally(() => this.installations.delete(delivery.installationId)).catch(() => undefined);
    try {
      const skipped = await Promise.race([
        invocation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            databaseAbort.abort();
            observeWorkerShutdownForTest('event-timeout', { id: delivery.id, installationId: delivery.installationId });
            reject(new Error(`Event handler timed out after ${this.timeoutMs}ms`));
          }, this.timeoutMs);
        }),
      ]);
      await prisma.$executeRaw`
        UPDATE event_deliveries SET status = ${skipped ? 'SKIPPED' : 'SUCCEEDED'}::"EventDeliveryStatus",
          "skipReason" = ${skipped}, "finishedAt" = statement_timestamp(), "lastError" = NULL,
          "leaseUntil" = NULL, "claimToken" = NULL, "claimedBy" = NULL
        WHERE id = ${delivery.id} AND status = 'RUNNING' AND "claimToken" = ${delivery.claimToken}
      `;
    } catch (error) {
      await prisma.$transaction((tx) => finishFailure(tx, delivery, error instanceof Error ? error.message : String(error)));
    } finally {
      if (timeout) clearTimeout(timeout);
      observeWorkerShutdownForTest('event-wrapper-settled', { id: delivery.id, installationId: delivery.installationId });
    }
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.stopped = false;
    await this.runOnce();
    this.timer = setInterval(() => void this.runOnce().catch((error) => console.error('Event delivery poll failed', error)), EVENT_POLL_INTERVAL_MS);
  }

  async drain(): Promise<void> {
    try {
      await this.claimOperation;
      await Promise.all([...this.pending]);
    } finally {
      while (this.invocations.size) await Promise.allSettled([...this.invocations.values()].map(item => item.promise));
    }
  }
  async stop(): Promise<void> {
    this.stopClaiming();
    await this.drain();
  }
  stopClaiming(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
