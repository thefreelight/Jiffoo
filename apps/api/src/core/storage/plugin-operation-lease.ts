import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { ensureCoreProcess } from '@/infra/core-process';
import { recoveryLimit } from '@/core/admin/extension-installer/plugin-recovery-test-control';

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

export async function acquirePluginOperationLease(slug: string, operation: string): Promise<string> {
  const ownerBootNonce = await ensureCoreProcess();
  const leaseMs = recoveryLimit('leaseMs', 15 * 60_000);
  const existing = await prisma.$queryRaw<Array<{ valid: boolean }>>`SELECT "expiresAt" > clock_timestamp() AT TIME ZONE 'UTC' AS valid FROM plugin_operation_leases WHERE slug = ${slug}`;
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
