import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function conflict(code: 'PLUGIN_OPERATION_IN_PROGRESS' | 'PLUGIN_OPERATION_LEASE_LOST'): Error {
  return new ApiError(code);
}

export async function acquirePluginOperationLease(slug: string, operation: string): Promise<string> {
  const token = randomUUID();
  const rows = await prisma.$queryRaw<Array<{ token: string }>>(Prisma.sql`
    INSERT INTO "plugin_operation_leases" ("slug", "token", "operation", "acquiredAt", "expiresAt")
    VALUES (${slug}, ${token}, ${operation}, clock_timestamp() AT TIME ZONE 'UTC', (clock_timestamp() AT TIME ZONE 'UTC') + interval '15 minutes')
    ON CONFLICT ("slug") DO UPDATE SET
      "token" = EXCLUDED."token", "operation" = EXCLUDED."operation",
      "acquiredAt" = clock_timestamp() AT TIME ZONE 'UTC',
      "expiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + interval '15 minutes'
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
