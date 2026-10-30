import { prisma } from '@/config/database';
import { Prisma, type PluginMigrationOperation } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { INCOMPLETE_PLUGIN_OPERATION_PHASES } from '@/core/extensions/runtime/plugin-migration-gate';
import { pruneCoreProcesses, coreProcessSuspectMs } from '@/infra/core-process';
import { recoveryLimit, observeRecovery } from '@/infra/recovery-test-control';
import { createHash } from 'node:crypto';
import { AuditService } from '@/core/audit/service';
import { releasePluginOperationLeaseWith } from '@/core/storage/plugin-operation-lease';

export const RECOVERY_SWEEP_MS = 60_000;
export const RECOVERY_SWEEP_BATCH = 50;
export const TERMINAL_PLUGIN_OPERATION_PHASES = ['SUCCESS', 'FAILED', 'NEEDS_RECOVERY', 'RECOVERED'];
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function publicationProven(tx: Transaction, operation: PluginMigrationOperation): Promise<boolean> {
  if (operation.phase !== 'PUBLISHED' || !operation.result) return false;
  const installed = await tx.pluginInstall.findUnique({ where: { slug: operation.slug } });
  const namespace = await tx.pluginNamespace.findUnique({ where: { slug: operation.slug } });
  const result = operation.result as { slug?: string; version?: string; zipHash?: string };
  if (!installed || installed.deletedAt || installed.zipHash !== operation.packageHash || installed.version !== operation.packageVersion
    || !isDeepStrictEqual(installed.manifestJson, operation.manifest) || !namespace?.provisionedAt
    || result.slug !== operation.slug || result.version !== operation.packageVersion || result.zipHash !== operation.packageHash) return false;
  const ledger = await tx.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } });
  const declarations = operation.declarations as Array<{ id: string; order: number; path: string; sha256: string }>;
  if (ledger.length !== declarations.length || ledger.some((row, index) => row.migrationId !== declarations[index].id || row.order !== declarations[index].order || row.path !== declarations[index].path || row.sha256 !== declarations[index].sha256)) return false;
  const blob = await tx.pluginPackageBlob.findUnique({ where: { pluginSlug_zipHash: { pluginSlug: operation.slug, zipHash: operation.packageHash } } });
  return !!blob && blob.sizeBytes === blob.bytes.length && createHash('sha256').update(blob.bytes).digest('hex') === operation.packageHash;
}

/** Shared by status reads and every worker; never executes plugin code or SQL. */
export async function recoverPluginOperation(id: string): Promise<void> {
  const observed = await prisma.pluginMigrationOperation.findUnique({ where: { id }, select: { slug: true } });
  if (!observed) return;
  try {
    await prisma.$transaction(async tx => {
      const leases = await tx.$queryRaw<Array<{ token: string; valid: boolean }>>`SELECT token, "expiresAt" > clock_timestamp() AT TIME ZONE 'UTC' AS valid FROM public.plugin_operation_leases WHERE slug = ${observed.slug} FOR UPDATE NOWAIT`;
      await tx.$queryRaw`SELECT id FROM public.plugin_migration_operations WHERE id = ${id} FOR UPDATE NOWAIT`;
      const operation = await tx.pluginMigrationOperation.findUniqueOrThrow({ where: { id } });
      if (TERMINAL_PLUGIN_OPERATION_PHASES.includes(operation.phase) || !INCOMPLETE_PLUGIN_OPERATION_PHASES.includes(operation.phase)) return;
      if (leases[0]?.token === operation.leaseToken && leases[0].valid) return;
      const published = await publicationProven(tx, operation);
      const reason = !leases.length ? 'LEASE_MISSING' : leases[0].token !== operation.leaseToken ? 'LEASE_REPLACED' : 'LEASE_EXPIRED';
      const result = operation.result as Record<string, unknown> | null;
      const changed = await tx.pluginMigrationOperation.updateMany({ where: { id, phase: operation.phase, leaseToken: operation.leaseToken }, data: published
        ? { phase: 'SUCCESS', result: json({ ...result, warnings: [...new Set([...(Array.isArray(result?.warnings) ? result.warnings : []), 'PLUGIN_POST_COMMIT_WARNING'])] }), artifactBytes: null, recoveryState: 'PUBLICATION_CONFIRMED', errorCode: null, finishedAt: new Date() }
        : { phase: 'NEEDS_RECOVERY', recoveryState: reason, errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', finishedAt: new Date() } });
      if (!changed.count) return;
      const attempts = await tx.pluginMigrationAttempt.findMany({ where: { operationId: id, status: 'UNKNOWN' }, take: 100 });
      for (const attempt of attempts) {
        const ledger = attempt.order > 0 ? await tx.pluginMigrationSuccess.findUnique({ where: { namespaceId_order: { namespaceId: attempt.namespaceId, order: attempt.order } } }) : null;
        const schemaProof = attempt.order === 0 ? await tx.adminAuditEvent.findFirst({ where: { targetId: operation.slug, action: 'PLUGIN_NAMESPACE_PROVISIONED', summary: { path: ['operationId'], equals: id } } }) : null;
        if (schemaProof || ledger && ledger.operationId === id && ledger.migrationId === attempt.migrationId && ledger.path === attempt.path && ledger.sha256 === attempt.sha256) {
          await tx.pluginMigrationAttempt.updateMany({ where: { id: attempt.id, status: 'UNKNOWN' }, data: { status: 'SUCCESS', resolution: schemaProof ? 'NAMESPACE_CONFIRMED' : 'LEDGER_CONFIRMED', endedAt: new Date() } });
        }
      }
      await releasePluginOperationLeaseWith(tx, operation.slug, operation.leaseToken);
      await AuditService.write(tx, { actorId: 'system', action: published ? 'PLUGIN_PUBLICATION_RECOVERED' : 'PLUGIN_RECOVERY_REQUIRED', targetType: 'plugin', targetId: operation.slug, summary: { operationId: id, priorPhase: operation.phase, reason } });
      observeRecovery(published ? 'published-recovered' : 'needs-recovery', id);
    }, { maxWait: 1_000, timeout: 5_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' && (error.meta?.code === '55P03' || error.meta?.code === '40P01')) return;
    throw error;
  }
}

let cursor: string | undefined;
export async function sweepPluginRecovery(): Promise<{ inspected: number; pruned: number }> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT o.id FROM public.plugin_migration_operations o LEFT JOIN public.plugin_operation_leases l ON l.slug = o.slug WHERE o.phase IN ('QUEUED','VALIDATING','PAUSING','MIGRATING','PUBLISHING','PUBLISHED') AND (l.slug IS NULL OR l.token <> o."leaseToken" OR l."expiresAt" <= clock_timestamp() AT TIME ZONE 'UTC') AND (${cursor ?? null}::text IS NULL OR o.id > ${cursor ?? ''}) ORDER BY o.id LIMIT ${RECOVERY_SWEEP_BATCH}`;
  const deadline = performance.now() + 5_000;
  let inspected = 0;
  for (const row of rows) { if (performance.now() >= deadline) break; await recoverPluginOperation(row.id); cursor = row.id; inspected++; }
  if (inspected === rows.length && rows.length < RECOVERY_SWEEP_BATCH) cursor = undefined;
  await prisma.$executeRaw`DELETE FROM public.plugin_task_execution_slots WHERE id IN (SELECT id FROM public.plugin_task_execution_slots WHERE state = 'RELEASED' AND "releasedAt" < clock_timestamp() - interval '30 days' ORDER BY "releasedAt",id LIMIT ${RECOVERY_SWEEP_BATCH})`;
  const pruned = await pruneCoreProcesses(prisma, RECOVERY_SWEEP_BATCH);
  return { inspected, pruned };
}
export function startPluginRecoverySweeper() {
  let pending: Promise<unknown> | undefined;
  let stopped = false;
  const run = () => {
    if (stopped || pending) return pending;
    pending = sweepPluginRecovery().catch(error => console.error('Plugin recovery sweep failed', error instanceof Error ? error.name : 'UnknownError')).finally(() => { pending = undefined; });
    return pending;
  };
  const timer = setInterval(() => { void run(); }, recoveryLimit('sweepMs', RECOVERY_SWEEP_MS));
  return { run, isRunning: () => !stopped, stop: async () => { stopped = true; clearInterval(timer); await pending; } };
}
export async function listPluginRecovery() {
  const candidates = await prisma.pluginMigrationOperation.findMany({ where: { OR: [{ phase: { in: [...INCOMPLETE_PLUGIN_OPERATION_PHASES, 'FAILED'] } }, { phase: 'SUCCESS', recoveryState: 'PUBLICATION_CONFIRMED' }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: RECOVERY_SWEEP_BATCH, select: { id: true } });
  for (const row of candidates) await recoverPluginOperation(row.id);
  const operations = candidates.length ? await prisma.$queryRaw<Array<{ operationId: string; slug: string; version: string; phase: string; committedPrefix: number; retryAvailable: boolean; publicationWarning: boolean }>>`SELECT id AS "operationId", slug, "packageVersion" AS version, phase, "committedPrefix", ("artifactBytes" IS NOT NULL AND phase IN ('FAILED','NEEDS_RECOVERY')) AS "retryAvailable", ("recoveryState" = 'PUBLICATION_CONFIRMED') AS "publicationWarning" FROM public.plugin_migration_operations WHERE id IN (${Prisma.join(candidates.map(row => row.id))}) ORDER BY "createdAt" DESC, id DESC` : [];
  // The suspect window is the one of the core-process registry: the sweep
  // that reports a suspect marker and the sweep that reclaims the slots of a
  // crashed worker share one threshold.
  const suspectMs = coreProcessSuspectMs();
  const markers = await prisma.$queryRaw<Array<{ slug: string; markerCount: bigint; maintenanceRequired: boolean }>>`SELECT substring(l.operation FROM length('plugin-invocation:') + 1) AS slug, count(*) AS "markerCount", bool_or(p."bootNonce" IS NULL OR p.state = 'DEAD_CONFIRMED' OR p."heartbeatAt" < (clock_timestamp() AT TIME ZONE 'UTC') - ${suspectMs} * interval '1 millisecond') AS "maintenanceRequired" FROM public.plugin_operation_leases l LEFT JOIN public.core_processes p ON p."bootNonce" = l."ownerBootNonce" WHERE l.operation LIKE 'plugin-invocation:%' GROUP BY l.operation ORDER BY l.operation LIMIT ${RECOVERY_SWEEP_BATCH}`;
  // The dead cleanup rows of the plugin storage: a remote object the delete
  // sweep could never remove. They hold the storage quota of the plugin and
  // only an operator can resolve them. The installation join is a left join:
  // the cleanup table has no foreign key, so a row whose installation is gone
  // is orphaned, and an orphaned dead row is never claimed again and must
  // still reach the operator. The file join reports how much quota the row
  // still holds.
  const deadCleanups = await prisma.$queryRaw<Array<{ slug: string | null; objectKey: string; fileId: string | null; attempts: number; lastError: string | null; sizeBytes: bigint | null }>>`SELECT i."pluginSlug" AS slug, c."objectKey" AS "objectKey", c."fileId" AS "fileId", c.attempts AS attempts, c."lastError" AS "lastError", f."sizeBytes" AS "sizeBytes" FROM public.plugin_file_cleanup c LEFT JOIN public.plugin_installations i ON i.id = c."installationId" LEFT JOIN public.plugin_files f ON f.id = c."fileId" WHERE c.status = 'DEAD' ORDER BY c."objectKey" LIMIT ${RECOVERY_SWEEP_BATCH}`;
  const orphaned = deadCleanups.filter(row => row.slug === null);
  const owned = deadCleanups.filter(row => row.slug !== null);
  const slugs = [...new Set([...operations.map(row => row.slug), ...markers.filter(row => row.maintenanceRequired).map(row => row.slug), ...owned.map(row => row.slug as string)])];
  return { items: slugs.map(slug => {
    const marker = markers.find(row => row.slug === slug);
    // A dead cleanup row is a remote object the sweep could never delete.
    // It is never claimed again, so it needs an operator and it makes the
    // plugin an item of this listing.
    const dead = owned.filter(row => row.slug === slug);
    return { slug, markerCount: Number(marker?.markerCount ?? 0), maintenanceRequired: (marker?.maintenanceRequired ?? false) || dead.length > 0,
      deadCleanupCount: dead.length,
      deadCleanups: dead.map(row => ({ objectKey: row.objectKey, fileId: row.fileId, attempts: row.attempts, lastError: row.lastError, sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes) })),
      operations: operations.filter(row => row.slug === slug).map(row => ({ ...row, retryAvailable: row.retryAvailable && !marker?.maintenanceRequired })) };
  }),
  // An orphaned dead row has no plugin any more, so it cannot be an item of
  // the listing. It is reported on its own, with the quota it still holds.
  orphanedDeadCleanups: orphaned.map(row => ({ objectKey: row.objectKey, fileId: row.fileId, attempts: row.attempts, lastError: row.lastError, sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes) })) };
}
