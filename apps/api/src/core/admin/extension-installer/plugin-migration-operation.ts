import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Prisma, type PluginMigrationOperation } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { prisma } from '@/config/database';
import { ApiError, mapApiError } from '@/utils/api-errors';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { acquirePluginOperationLease, fencePluginOperationLease, releasePluginOperationLease } from '@/core/storage/plugin-operation-lease';
import { decryptPluginConfig } from '@/core/admin/plugin-management/config-crypto';
import type { PluginMigrationDeclaration } from '@jiffoo/shared';
import { assertUploadPreview, inspectPluginUpload, uploadSnapshot, uploadOperation, writePluginInstallAudit, assertPluginPackageHistory } from './plugin-upload';
import { compareVersions } from './version-utils';
import { checkPluginApiCompatibility } from './plugin-compatibility';
import { extractZipToTemp, cleanupTemp, resolveExtractedPackageRoot } from './utils';
import { loadPluginEntryModule } from './plugin-module-loader';
import { isContractV1Runtime } from './contract-v1-runtime';
import { claimPluginNamespace, executePluginMigrationFiles, migrationPlan, renewPluginMigrationLease, namespaceProvisioningConfirmed, PLUGIN_MIGRATION_DEADLINE_MS } from './plugin-migration-executor';
import { INCOMPLETE_PLUGIN_OPERATION_PHASES, updateOwnedPluginMigrationOperation, updateOwnedPluginMigrationAttempt } from './plugin-migration-gate';
import type { InstalledPlugin, PluginInstallOptions } from './types';
import { PluginDatabaseQueue } from './plugin-database-queue';
import { pluginDatabaseBeforeMigrationRun, pluginDatabaseLimit } from './plugin-database-test-control';
import { ensureCoreProcess } from '@/infra/core-process';
import { databaseNowMs } from '@/infra/database-clock';
import { recoverPluginOperation, TERMINAL_PLUGIN_OPERATION_PHASES } from './plugin-recovery';
import { recoveryLimit, recoveryTestBarrier } from './plugin-recovery-test-control';
import { processApplicationName } from '@/infra/core-process-identity';

const terminal = new Set(['SUCCESS', 'FAILED', 'NEEDS_RECOVERY', 'RECOVERED']);
const running = new Map<string, Promise<void>>();
const migrationSlots = new PluginDatabaseQueue(2, 2, Number.POSITIVE_INFINITY);
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function drainPluginInstallOperations(): Promise<void> { await Promise.all([...running.values()]); }

export async function startPluginInstallOperation(bytes: Buffer, options: PluginInstallOptions, recoveryOf?: string): Promise<{ operationId: string }> {
  const inspection = await inspectPluginUpload(bytes);
  const current = await prisma.pluginInstall.findUnique({ where: { slug: inspection.manifest.slug } });
  const snapshot = uploadSnapshot(current);
  if (!options.actorUserId) throw new ApiError('PLUGIN_PREVIEW_REQUIRED');
  if (!recoveryOf) assertUploadPreview(options.previewToken, options.actorUserId, inspection, current);
  const action = uploadOperation(inspection, current);
  await assertPluginPackageHistory(inspection);
  if (!checkPluginApiCompatibility(inspection.manifest).compatible) throw new ApiError('INCOMPATIBLE_API_VERSION');
  if (!inspection.publisher && (!options.confirmUnsigned || options.confirmationSlug !== inspection.manifest.slug)) throw new ApiError('UNSIGNED_CONFIRMATION_REQUIRED');
  if (options.source === 'marketplace') {
    if (!inspection.publisher) throw new ApiError('MARKETPLACE_SIGNATURE_REQUIRED');
    if (!options.expectedMarketplaceIdentity || inspection.manifest.version !== options.expectedMarketplaceIdentity.version
      || inspection.publisher.publisherId !== options.expectedMarketplaceIdentity.publisherId) throw new ApiError('MARKETPLACE_IDENTITY_MISMATCH');
  }
  const plan = await migrationPlan(inspection.manifest.slug, inspection.manifest.database, inspection.files, inspection.publisher);
  if (plan.changesDatabase && !options.confirmMigrations) throw new ApiError('PLUGIN_MIGRATION_CONFIRMATION_REQUIRED');
  // Expired operations require explicit recovery, never a blind replacement of their execution state.
  for (const row of await prisma.pluginMigrationOperation.findMany({ where: { slug: inspection.manifest.slug, phase: { in: INCOMPLETE_PLUGIN_OPERATION_PHASES } } })) {
    const state = await getPluginInstallOperation(row.id);
    if (state.phase !== 'NEEDS_RECOVERY') throw new ApiError('PLUGIN_OPERATION_IN_PROGRESS');
  }
  const token = options.lease?.token ?? await acquirePluginOperationLease(inspection.manifest.slug, 'migration-install');
  const id = randomUUID();
  const ownerBootNonce = await ensureCoreProcess();
  try {
    await prisma.$transaction(async tx => {
      await fencePluginOperationLease(tx, inspection.manifest.slug, token);
      if (!isDeepStrictEqual(snapshot, uploadSnapshot(await tx.pluginInstall.findUnique({ where: { slug: inspection.manifest.slug } })))) throw new ApiError('PLUGIN_PREVIEW_REQUIRED');
      const incomplete = await tx.pluginMigrationOperation.findMany({ where: { slug: inspection.manifest.slug, phase: { in: [...INCOMPLETE_PLUGIN_OPERATION_PHASES, 'PUBLISHED'] } } });
      if (incomplete.some(row => row.phase !== 'NEEDS_RECOVERY')) throw new ApiError('PLUGIN_OPERATION_IN_PROGRESS');
      const recovery = recoveryOf ? await tx.pluginMigrationOperation.findUnique({ where: { id: recoveryOf } }) : undefined;
      if (recoveryOf && (!recovery || recovery.slug !== inspection.manifest.slug || !['NEEDS_RECOVERY', 'FAILED'].includes(recovery.phase)
        || recovery.packageHash !== inspection.hash)) throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
      for (const row of incomplete) {
        if (inspection.hash !== row.packageHash && compareVersions(inspection.manifest.version, row.packageVersion) <= 0) throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
      }
      await tx.pluginMigrationOperation.create({ data: {
        id, slug: inspection.manifest.slug, actorId: options.actorUserId!, packageHash: inspection.hash, packageVersion: inspection.manifest.version,
        manifestDigest: inspection.manifestDigest, manifest: json(inspection.manifest), declarations: json(inspection.manifest.database?.migrations ?? []),
        expectedInstall: snapshot ? json(snapshot) : Prisma.JsonNull,
        installOptions: json({ source: options.source ?? 'local-zip', actorUserId: options.actorUserId, confirmUnsigned: options.confirmUnsigned === true, confirmationSlug: options.confirmationSlug, confirmMigrations: options.confirmMigrations === true, expectedMarketplaceIdentity: options.expectedMarketplaceIdentity, uploadMetadata: { filename: options.uploadMetadata?.filename ?? `${inspection.manifest.slug}.zip`, mimetype: options.uploadMetadata?.mimetype ?? 'application/zip', size: bytes.length } }),
        artifactBytes: new Uint8Array(bytes), leaseToken: token, ownerBootNonce,
        confirmed: options.confirmMigrations === true, committedPrefix: plan.applied.length, recoveryState: incomplete.length ? 'FORWARD_RECOVERY' : 'NONE', createdAt: new Date(),
      } });
      if (!inspection.publisher) await writePluginInstallAudit(tx, options.actorUserId!, 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED', inspection, action, current?.version ?? null, options.source ?? 'local-zip');
      if (plan.changesDatabase) await tx.adminAuditEvent.create({ data: { actorId: options.actorUserId!, action: 'PLUGIN_MIGRATIONS_CONFIRMED', targetType: 'plugin', targetId: inspection.manifest.slug, summary: json({ operationId: id, plan }) } });
    });
  } catch (error) { await releasePluginOperationLease(inspection.manifest.slug, token); throw error; }
  const work = runPluginInstallOperation(id).finally(() => running.delete(id));
  running.set(id, work);
  void work.catch(() => undefined);
  return { operationId: id };
}

async function runPluginInstallOperation(id: string): Promise<void> {
  const operation = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } });
  let temporary: string | undefined;
  let candidate: Awaited<ReturnType<typeof pluginPackageStore.put>> | undefined;
  let renewal: Promise<void> | undefined;
  let leaseError: unknown;
  let initialPrefix = 0;
  let initiallyProvisioned = false;
  let finish: Prisma.PluginMigrationOperationUpdateManyMutationInput | undefined;
  let releaseSlot: (() => void) | undefined;
  const queuedAbort = new AbortController();
  const deadline = operation.createdAt.getTime() + pluginDatabaseLimit('migrationMs', PLUGIN_MIGRATION_DEADLINE_MS);
  const assertDeadline = async () => { if (await databaseNowMs() >= deadline) throw new ApiError('PLUGIN_MIGRATION_FAILED'); };
  const heartbeat = setInterval(() => {
    if (renewal) return;
    renewal = renewPluginMigrationLease(operation.slug, operation.leaseToken).catch(error => { leaseError = error; queuedAbort.abort(); }).finally(() => { renewal = undefined; });
  }, recoveryLimit('renewalMs', 60_000));
  try {
    const priorNamespace = await prisma.pluginNamespace.findUnique({ where: { slug: operation.slug } });
    initiallyProvisioned = Boolean(priorNamespace?.provisionedAt);
    initialPrefix = priorNamespace ? await prisma.pluginMigrationSuccess.count({ where: { namespaceId: priorNamespace.id } }) : 0;
    // Waiting holds and renews the lease, remains QUEUED, and consumes the same deadline.
    try { releaseSlot = await migrationSlots.acquire('migration-runs', queuedAbort.signal, Math.max(1, deadline - await databaseNowMs())); }
    catch { throw new ApiError('PLUGIN_MIGRATION_FAILED'); }
    if (leaseError) throw leaseError;
    await assertDeadline();
    await updateOwnedPluginMigrationOperation(operation, { phase: 'VALIDATING', startedAt: new Date() });
    await pluginDatabaseBeforeMigrationRun();
    await assertDeadline();
    if (!operation.artifactBytes) throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
    const bytes = Buffer.from(operation.artifactBytes);
    const inspection = await inspectPluginUpload(bytes);
    if (inspection.hash !== operation.packageHash || inspection.manifestDigest !== operation.manifestDigest || inspection.manifest.slug !== operation.slug || inspection.manifest.version !== operation.packageVersion) throw new ApiError('PLUGIN_PACKAGE_CORRUPT');
    // Revalidate the retained verified archive, never the mutable unpacked installation directory.
    const plan = await migrationPlan(operation.slug, inspection.manifest.database, inspection.files, inspection.publisher);
    initialPrefix = plan.applied.length;
    initiallyProvisioned = !plan.provisionNamespace;
    temporary = await extractZipToTemp(Readable.from(bytes), 'plugin');
    const { rootDir } = await resolveExtractedPackageRoot(temporary, 'plugin');
    const loaded = await loadPluginEntryModule(path.join(rootDir, inspection.manifest.entryModule!));
    if (!isContractV1Runtime(loaded?.default || loaded)) throw new ApiError('PLUGIN_LOAD_FAILED');
    candidate = await pluginPackageStore.put(operation.slug, operation.packageHash, rootDir);
    const { validateCandidateRuntime } = await import('./plugin-runtime');
    for (const instance of await prisma.pluginInstallation.findMany({ where: { pluginSlug: operation.slug, enabled: true, deletedAt: null } })) {
      const config = instance.configJson && typeof instance.configJson === 'object' && !Array.isArray(instance.configJson) ? instance.configJson as Record<string, unknown> : {};
      await validateCandidateRuntime(operation.slug, operation.packageHash, inspection.manifest, instance.id, decryptPluginConfig(inspection.manifest, config));
    }
    if (leaseError) throw leaseError;
    await assertDeadline();
    const namespace = await claimPluginNamespace(operation, inspection.publisher);
    await reconcileUnknownAttempts(namespace.id, operation);
    await executePluginMigrationFiles(operation, namespace, inspection.files, operation.declarations as unknown as PluginMigrationDeclaration[]);
    if (leaseError) throw leaseError;
    await assertDeadline();
    await candidate.commit(); candidate = undefined;
    await updateOwnedPluginMigrationOperation(operation, { phase: 'PUBLISHING' });
    await recoveryTestBarrier('before-publish', id);
    const { pluginFsInstaller } = await import('./plugin-fs-installer');
    const options = operation.installOptions as unknown as PluginInstallOptions;
    const result = await pluginFsInstaller.install(Readable.from(bytes), { ...options, operationId: id, lease: { slug: operation.slug, token: operation.leaseToken } });
    finish = { phase: 'SUCCESS', result: json({ ...result, warnings: result.warnings ?? [] }), artifactBytes: null, recoveryState: 'NONE', finishedAt: new Date() };
  } catch (error) {
    const durable = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } });
    if (durable.phase === 'PUBLISHED' && durable.result) {
      finish = { phase: 'SUCCESS', result: json({ ...(durable.result as Record<string, unknown>), warnings: ['PLUGIN_POST_COMMIT_WARNING'] }), artifactBytes: null, recoveryState: 'PUBLICATION_CONFIRMED', errorCode: null, finishedAt: new Date() };
    } else {
    const mapped = mapApiError(error);
    const namespace = await prisma.pluginNamespace.findUnique({ where: { slug: operation.slug } });
    const prefix = namespace ? await prisma.pluginMigrationSuccess.count({ where: { namespaceId: namespace.id } }) : 0;
    const recover = prefix > initialPrefix || !initiallyProvisioned && namespace?.provisionedAt || mapped.body.error.code === 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN';
    finish = { phase: recover ? 'NEEDS_RECOVERY' : 'FAILED', committedPrefix: Math.min(prefix, (operation.declarations as unknown as PluginMigrationDeclaration[]).length), errorCode: mapped.body.error.code, recoveryState: recover ? 'REQUIRED' : 'NONE', finishedAt: new Date() };
    }
  } finally {
    try {
    await candidate?.rollback().catch(() => undefined);
    if (temporary) await cleanupTemp(temporary).catch(() => undefined);
    if (finish) {
      try {
        await updateOwnedPluginMigrationOperation(operation, finish, true);
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 'PLUGIN_OPERATION_LEASE_LOST')) {
          await updateOwnedPluginMigrationOperation(operation, { phase: 'NEEDS_RECOVERY', recoveryState: 'COMPLETION_UNKNOWN', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', finishedAt: new Date() }, true).catch(() => undefined);
        }
        await releasePluginOperationLease(operation.slug, operation.leaseToken);
      }
    } else await releasePluginOperationLease(operation.slug, operation.leaseToken);
    } finally { clearInterval(heartbeat); await renewal; releaseSlot?.(); }
  }
}

async function reconcileUnknownAttempts(namespaceId: number, operation: PluginMigrationOperation): Promise<void> {
  for (const attempt of await prisma.pluginMigrationAttempt.findMany({ where: { namespaceId, status: 'UNKNOWN' } })) {
    if (attempt.order === 0) {
      const confirmed = await namespaceProvisioningConfirmed(namespaceId, attempt.operationId);
      if (!confirmed) await proveOldExecutionEnded(operation, attempt.operationId);
      await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, namespaceId, status: 'UNKNOWN' }, { status: confirmed ? 'SUCCESS' : 'ABORTED', endedAt: new Date(), resolution: confirmed ? 'NAMESPACE_CONFIRMED' : 'FENCED_EXECUTION_ENDED' });
      continue;
    }
    const ledger = await prisma.pluginMigrationSuccess.findUnique({ where: { namespaceId_order: { namespaceId, order: attempt.order } } });
    if (ledger && (ledger.migrationId !== attempt.migrationId || ledger.path !== attempt.path || ledger.sha256 !== attempt.sha256)) throw new ApiError('PLUGIN_MIGRATION_DRIFT');
    if (!ledger) await proveOldExecutionEnded(operation, attempt.operationId);
    await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, namespaceId, status: 'UNKNOWN' }, { status: ledger ? 'SUCCESS' : 'ABORTED', endedAt: new Date(), resolution: ledger ? 'LEDGER_CONFIRMED' : 'FENCED_EXECUTION_ENDED' });
  }
}
async function proveOldExecutionEnded(current: PluginMigrationOperation, oldId: string): Promise<void> {
  const old = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: oldId } });
  if (!old.ownerBootNonce || old.leaseToken === current.leaseToken || !TERMINAL_PLUGIN_OPERATION_PHASES.includes(old.phase)) throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
  // The current fenced lease was acquired after the old SQL transaction released
  // its lease row lock. The old token cannot start another migration transaction.
  const name = processApplicationName('migration', old.ownerBootNonce, old.id);
  const rows = await prisma.$queryRaw<Array<{ active: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name = ${name}) AS active`;
  if (rows[0].active) throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
}

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export async function publishPluginMigrationOperation(tx: Transaction, operationId: string | undefined): Promise<void> {
  if (!operationId) return;
  const operation = await tx.pluginMigrationOperation.findUniqueOrThrow({ where: { id: operationId } });
  if (operation.phase !== 'PUBLISHING') throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
  const time = await tx.$queryRaw<Array<{ expired: boolean }>>`SELECT clock_timestamp() AT TIME ZONE 'UTC' >= ${operation.createdAt} + interval '60 minutes' AS expired`;
  if (time[0].expired) throw new ApiError('PLUGIN_MIGRATION_FAILED');
  await fencePluginOperationLease(tx, operation.slug, operation.leaseToken);
  const namespace = await tx.pluginNamespace.findUniqueOrThrow({ where: { slug: operation.slug } });
  const declarations = operation.declarations as unknown as PluginMigrationDeclaration[];
  const rows = await tx.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } });
  if (!namespace.provisionedAt || rows.length !== declarations.length || rows.some((row, index) => row.order !== declarations[index].order || row.migrationId !== declarations[index].id || row.path !== declarations[index].path || row.sha256 !== declarations[index].sha256)) throw new ApiError('PLUGIN_MIGRATION_DRIFT');
  const installed = await tx.pluginInstall.findUniqueOrThrow({ where: { slug: operation.slug } });
  const published = await tx.pluginMigrationOperation.updateMany({ where: { id: operationId, leaseToken: operation.leaseToken, phase: 'PUBLISHING' }, data: { phase: 'PUBLISHED', result: json({ ...installed, zipHash: operation.packageHash, fsPath: installed.installPath ?? '', warnings: [] }) } });
  if (published.count !== 1) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
  await tx.pluginMigrationOperation.updateMany({ where: { slug: operation.slug, id: { not: operationId }, phase: 'NEEDS_RECOVERY' }, data: { phase: 'RECOVERED', artifactBytes: null, recoveryState: `RECOVERED_BY:${operationId}` } });
}

export async function getPluginInstallOperation(id: string, wait = false, observed?: Pick<PluginMigrationOperation, 'phase' | 'committedPrefix'>) {
  if (wait && observed) {
    const initial = await prisma.pluginMigrationOperation.findUnique({ where: { id }, select: { phase: true, committedPrefix: true } });
    const until = Date.now() + 5_000;
    while (initial && initial.phase === observed.phase && initial.committedPrefix === observed.committedPrefix && !terminal.has(initial.phase) && Date.now() < until) {
      const state = await prisma.pluginMigrationOperation.findUnique({ where: { id }, select: { phase: true, committedPrefix: true } });
      if (!state || terminal.has(state.phase) || state.phase !== initial.phase || state.committedPrefix !== initial.committedPrefix) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  let operation = await prisma.pluginMigrationOperation.findUnique({ where: { id } });
  if (!operation) throw new ApiError('NOT_FOUND');
  if (!terminal.has(operation.phase)) {
    await recoverPluginOperation(id);
    operation = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } });
  }
  const installed = operation.result as unknown as InstalledPlugin | null;
  const metadata = (operation.installOptions as unknown as PluginInstallOptions).uploadMetadata;
  if (installed && !metadata) throw new ApiError('PLUGIN_PACKAGE_CORRUPT');
  const result = installed ? {
    kind: 'plugin', name: installed.name, trustLevel: installed.trustLevel, warnings: installed.warnings ?? [], slug: installed.slug, version: installed.version,
    source: installed.source, fsPath: installed.fsPath, publisherId: installed.publisherId ?? null, publisherName: installed.publisherName ?? null,
    publisherVerified: installed.signingRoot === 'official', signingRoot: installed.signingRoot ?? null, publisherCertificateFingerprint: installed.publisherCertificateFingerprint ?? null,
    filename: metadata!.filename, originalName: metadata!.filename, size: metadata!.size,
    mimetype: metadata!.mimetype, url: '/api/v1/extensions/plugin/install',
    ...((operation.installOptions as unknown as PluginInstallOptions).source === 'marketplace' ? { installedVersion: installed.version } : {}),
  } : null;
  return { operationId: operation.id, slug: operation.slug, version: operation.packageVersion, phase: operation.phase, terminal: terminal.has(operation.phase), committedPrefix: operation.committedPrefix,
    recoveryState: operation.recoveryState, result, errorCode: operation.errorCode };
}

export async function retryPluginInstallOperation(id: string, actorId: string, confirmMigrations: boolean) {
  const operation = await prisma.pluginMigrationOperation.findUnique({ where: { id } });
  if (!operation) throw new ApiError('NOT_FOUND');
  if (operation.phase !== 'NEEDS_RECOVERY' && operation.phase !== 'FAILED') throw new ApiError('PLUGIN_OPERATION_IN_PROGRESS');
  if (!operation.artifactBytes) throw new ApiError('PLUGIN_MIGRATION_RECOVERY_REQUIRED');
  return startPluginInstallOperation(Buffer.from(operation.artifactBytes), { ...(operation.installOptions as unknown as PluginInstallOptions), actorUserId: actorId, confirmMigrations }, id);
}

export async function waitPluginInstallOperation(id: string): Promise<InstalledPlugin> {
  const work = running.get(id);
  if (work) await work;
  let state = await getPluginInstallOperation(id);
  while (!state.terminal) state = await getPluginInstallOperation(id, true, { phase: state.phase, committedPrefix: state.committedPrefix });
  if (state.phase !== 'SUCCESS') throw new ApiError((state.errorCode ?? 'PLUGIN_MIGRATION_FAILED') as ConstructorParameters<typeof ApiError>[0]);
  const operation = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id } });
  const result = operation.result as unknown as InstalledPlugin;
  return { ...result, installedAt: new Date(result.installedAt), updatedAt: new Date(result.updatedAt) };
}
