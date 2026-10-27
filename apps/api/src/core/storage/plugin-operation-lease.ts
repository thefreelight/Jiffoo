import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { ensureCoreProcess } from '@/infra/core-process';
import { recoveryLimit } from '@/infra/recovery-test-control';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * The client surface the lease owner needs. A Prisma transaction client and
 * the Prisma client itself both satisfy it, so a caller can hand over the
 * transaction it already owns and keep the write inside that transaction.
 */
export type PluginOperationLeaseClient = {
  $executeRaw: Transaction['$executeRaw'];
  pluginOperationLease: Pick<Transaction['pluginOperationLease'], 'deleteMany'>;
};

function conflict(code: 'PLUGIN_OPERATION_IN_PROGRESS' | 'PLUGIN_OPERATION_LEASE_LOST'): Error {
  return new ApiError(code);
}

/**
 * Tell a transient row lock conflict apart from a real database failure.
 *
 * PostgreSQL never waits for the lock of a conflicting row in
 * `INSERT ... ON CONFLICT DO UPDATE`: the statement fails at once with
 * `lock_not_available` (SQLSTATE 55P03) while the other holder is still busy
 * with the same slug. Prisma reports a failed raw query as `P2010` and keeps
 * the SQLSTATE in the error meta and in the error message. Every other
 * failure keeps its own identity and is surfaced unchanged.
 */
function isLeaseContention(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const failure = error as { code?: unknown; message?: unknown; meta?: { code?: unknown; message?: unknown } };
  const sqlstate = '55P03';
  const texts = [failure.code, failure.meta?.code, failure.meta?.message, failure.message]
    .filter((value): value is string => typeof value === 'string');
  if (!texts.some(text => text.includes(sqlstate))) return false;
  // A failed raw query is reported as P2010; a driver error carries the SQLSTATE as its own code.
  return failure.code === 'P2010' || failure.code === sqlstate;
}

/**
 * The state of the lease of a slug. The read takes no lock, so it reports the
 * last committed state of the lease row.
 */
async function readPluginOperationLease(slug: string): Promise<Array<{ valid: boolean }>> {
  return prisma.$queryRaw<Array<{ valid: boolean }>>`SELECT "expiresAt" > clock_timestamp() AT TIME ZONE 'UTC' AS valid FROM plugin_operation_leases WHERE slug = ${slug}`;
}

/**
 * Take the operation lease of a slug.
 *
 * The lease is exclusive: only the holder of a live lease proceeds, and an
 * expired lease may be taken over. A contended lease row is a transient
 * condition, so the acquisition is retried a bounded number of times; the
 * exhausted retries answer the busy lease error, never a raw database error.
 */
export async function acquirePluginOperationLease(slug: string, operation: string): Promise<string> {
  const ownerBootNonce = await ensureCoreProcess();
  const leaseMs = recoveryLimit('leaseMs', 15 * 60_000);
  // The contention window: five attempts with a 100, 200, 400 and 800 ms
  // backoff, so the whole wait stays below 1.5 s before the busy lease error
  // is answered.
  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const existing = await readPluginOperationLease(slug);
      if (existing[0]?.valid) throw conflict('PLUGIN_OPERATION_IN_PROGRESS');
      const token = randomUUID();
      const rows = await prisma.$queryRaw<Array<{ token: string }>>(Prisma.sql`
        INSERT INTO "plugin_operation_leases" ("slug", "token", "operation", "acquiredAt", "expiresAt", "ownerBootNonce")
        VALUES (${slug}, ${token}, ${operation}, clock_timestamp() AT TIME ZONE 'UTC', (clock_timestamp() AT TIME ZONE 'UTC') + ${leaseMs} * interval '1 millisecond', ${ownerBootNonce}::uuid)
        ON CONFLICT ("slug") DO UPDATE SET
          "token" = EXCLUDED."token", "operation" = EXCLUDED."operation",
          "acquiredAt" = clock_timestamp() AT TIME ZONE 'UTC',
          "expiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + ${leaseMs} * interval '1 millisecond', "ownerBootNonce" = EXCLUDED."ownerBootNonce"
        WHERE "plugin_operation_leases"."expiresAt" <= (clock_timestamp() AT TIME ZONE 'UTC')
        RETURNING "token"
      `);
      if (rows.length === 0) throw conflict('PLUGIN_OPERATION_IN_PROGRESS');
      return token;
    } catch (error) {
      if (!isLeaseContention(error)) throw error;
      if (attempt === attempts) throw conflict('PLUGIN_OPERATION_IN_PROGRESS');
      // The holder may have finished in the meantime, so the lease state is
      // read again before the wait: a free lease is taken at once, and a
      // lease that the holder kept is answered as the busy lease it is.
      const state = await readPluginOperationLease(slug);
      if (state[0]?.valid) throw conflict('PLUGIN_OPERATION_IN_PROGRESS');
      await new Promise(resolve => setTimeout(resolve, 100 * 2 ** (attempt - 1)));
    }
  }
  throw conflict('PLUGIN_OPERATION_IN_PROGRESS');
}

export async function fencePluginOperationLease(tx: Transaction, slug: string, token: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ token: string; valid: boolean }>>(Prisma.sql`
    SELECT "token", "expiresAt" > (clock_timestamp() AT TIME ZONE 'UTC') AS valid
    FROM "plugin_operation_leases" WHERE "slug" = ${slug} FOR UPDATE
  `);
  if (rows.length !== 1 || rows[0].token !== token || !rows[0].valid)
    throw conflict('PLUGIN_OPERATION_LEASE_LOST');
}

export async function releasePluginOperationLease(slug: string, token: string): Promise<void> {
  await prisma.pluginOperationLease.deleteMany({ where: { slug, token } });
}

/**
 * Extend the lease of an operation the caller already owns. The write happens
 * on the client the caller passes, so it stays inside the caller's transaction.
 */
export async function renewPluginOperationLease(client: PluginOperationLeaseClient, slug: string, token: string, leaseMs: number): Promise<number> {
  return client.$executeRaw`UPDATE plugin_operation_leases SET "expiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + ${leaseMs} * interval '1 millisecond'
    WHERE slug = ${slug} AND token = ${token} AND "expiresAt" > clock_timestamp() AT TIME ZONE 'UTC'`;
}

/**
 * Register a marker lease for an operation that does not take the lease table
 * through `acquirePluginOperationLease`. The write happens on the client the
 * caller passes, so it stays inside the caller's transaction.
 */
export async function insertPluginOperationLease(client: PluginOperationLeaseClient, lease: { slug: string; token: string; operation: string; ownerBootNonce: string }): Promise<void> {
  await client.$executeRaw`INSERT INTO public.plugin_operation_leases (slug, token, operation, "acquiredAt", "expiresAt", "ownerBootNonce") VALUES (${lease.slug}, ${lease.token}, ${lease.operation}, clock_timestamp() AT TIME ZONE 'UTC', (clock_timestamp() AT TIME ZONE 'UTC') + interval '15 minutes', ${lease.ownerBootNonce}::uuid)`;
}

/**
 * Drop the lease rows of an operation the caller already owns. The write
 * happens on the client the caller passes, so it stays inside the caller's
 * transaction. The owner boot nonce narrows the release to the marker that
 * this process registered.
 */
export async function releasePluginOperationLeaseWith(client: PluginOperationLeaseClient, slug: string, token: string, ownerBootNonce?: string): Promise<number> {
  const released = await client.pluginOperationLease.deleteMany({ where: ownerBootNonce === undefined ? { slug, token } : { slug, token, ownerBootNonce } });
  return released.count;
}
