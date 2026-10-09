import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { randomUUID } from 'node:crypto';
import type { Prisma, PluginMigrationOperation } from '@prisma/client';
import { fencePluginOperationLease } from '@/core/storage/plugin-operation-lease';
import { ensureCoreProcess } from '@/infra/core-process';
import { rememberCompletedPluginMarker } from '@/core/storage/completed-plugin-markers';

export const INCOMPLETE_PLUGIN_OPERATION_PHASES = ['QUEUED', 'VALIDATING', 'PAUSING', 'MIGRATING', 'PUBLISHING', 'PUBLISHED', 'NEEDS_RECOVERY'];
const pausedPhases = ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'];
export const PLUGIN_MIGRATION_LOCK_CLASS = 1_246_316_109;
export const RUNNING_PLUGIN_OPERATION_PHASES = INCOMPLETE_PLUGIN_OPERATION_PHASES.filter(phase => phase !== 'NEEDS_RECOVERY');
type OperationOwner = Pick<PluginMigrationOperation, 'id' | 'slug' | 'leaseToken'>;
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function fenceOwnedPluginMigrationOperation(tx: Transaction, operation: OperationOwner): Promise<void> {
  await fencePluginOperationLease(tx, operation.slug, operation.leaseToken);
  const owned = await tx.pluginMigrationOperation.findFirst({ where: { id: operation.id, slug: operation.slug, leaseToken: operation.leaseToken, phase: { in: RUNNING_PLUGIN_OPERATION_PHASES } }, select: { id: true } });
  if (!owned) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
}

export async function updateOwnedPluginMigrationOperation(operation: OperationOwner, data: Prisma.PluginMigrationOperationUpdateManyMutationInput, releaseLease = false): Promise<void> {
  await prisma.$transaction(async tx => {
    await fenceOwnedPluginMigrationOperation(tx, operation);
    const changed = await tx.pluginMigrationOperation.updateMany({ where: { id: operation.id, slug: operation.slug, leaseToken: operation.leaseToken, phase: { in: RUNNING_PLUGIN_OPERATION_PHASES } }, data });
    if (changed.count !== 1) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
    if (data.phase === 'SUCCESS') {
      // The successful holder owns supersession; stale runners cannot discard retained candidates.
      await tx.pluginMigrationOperation.updateMany({ where: { slug: operation.slug, id: { not: operation.id }, phase: { in: ['FAILED', 'NEEDS_RECOVERY'] } }, data: { phase: 'RECOVERED', artifactBytes: null, recoveryState: `RECOVERED_BY:${operation.id}` } });
    }
    if (releaseLease) {
      const released = await tx.pluginOperationLease.deleteMany({ where: { slug: operation.slug, token: operation.leaseToken } });
      if (released.count !== 1) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
    }
  });
}

export async function createOwnedPluginMigrationAttempt(operation: OperationOwner, data: Prisma.PluginMigrationAttemptUncheckedCreateInput) {
  return prisma.$transaction(async tx => {
    await fenceOwnedPluginMigrationOperation(tx, operation);
    return tx.pluginMigrationAttempt.create({ data });
  });
}

export async function updateOwnedPluginMigrationAttempt(operation: OperationOwner, where: Prisma.PluginMigrationAttemptWhereInput, data: Prisma.PluginMigrationAttemptUpdateManyMutationInput): Promise<void> {
  await prisma.$transaction(async tx => {
    await fenceOwnedPluginMigrationOperation(tx, operation);
    const changed = await tx.pluginMigrationAttempt.updateMany({ where, data });
    if (changed.count !== 1) throw new ApiError('PLUGIN_MIGRATION_OUTCOME_UNKNOWN');
  });
}

export async function assertPluginNotPaused(slug: string): Promise<void> {
  if (await prisma.pluginMigrationOperation.findFirst({ where: { slug, phase: { in: pausedPhases } }, select: { id: true } })) throw new ApiError('PLUGIN_MAINTENANCE');
}

export async function assertPluginOperationAvailable(slug: string): Promise<void> {
  const operation = await prisma.pluginMigrationOperation.findFirst({ where: { slug, phase: { in: INCOMPLETE_PLUGIN_OPERATION_PHASES } } });
  if (operation) throw new ApiError(operation.phase === 'NEEDS_RECOVERY' ? 'PLUGIN_MIGRATION_RECOVERY_REQUIRED' : 'PLUGIN_OPERATION_IN_PROGRESS');
}

/** Register before invoking and retain the durable marker until actual settlement, including after an outward timeout. */
export async function withPluginMigrationGate<T>(slug: string, invoke: () => Promise<T>): Promise<T> {
  const ownerBootNonce = await ensureCoreProcess();
  const token = randomUUID();
  const marker = `invocation:${slug}:${token}`;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM public.plugin_installs WHERE slug = ${slug} FOR KEY SHARE`;
    const paused = () => tx.pluginMigrationOperation.findFirst({ where: { slug, phase: { in: pausedPhases } }, select: { id: true } });
    if (await paused()) throw new ApiError('PLUGIN_MAINTENANCE');
    const namespace = await tx.pluginNamespace.findUnique({ where: { slug }, select: { id: true } });
    if (namespace) {
      const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock_shared(${PLUGIN_MIGRATION_LOCK_CLASS}::integer, ${namespace.id}::integer) AS acquired`;
      if (!lock[0]?.acquired) throw new ApiError('PLUGIN_MAINTENANCE');
    }
    if (await paused()) throw new ApiError('PLUGIN_MAINTENANCE');
    await tx.$executeRaw`INSERT INTO public.plugin_operation_leases (slug, token, operation, "acquiredAt", "expiresAt", "ownerBootNonce") VALUES (${marker}, ${token}, ${`plugin-invocation:${slug}`}, clock_timestamp() AT TIME ZONE 'UTC', (clock_timestamp() AT TIME ZONE 'UTC') + interval '15 minutes', ${ownerBootNonce}::uuid)`;
  }, { maxWait: 5_000, timeout: 5_000 });
  try { return await invoke(); }
  finally {
    try { await prisma.pluginOperationLease.deleteMany({ where: { slug: marker, token, ownerBootNonce } }); }
    catch (error) { rememberCompletedPluginMarker({ slug: marker, token, ownerBootNonce }); throw error; }
  }
}
