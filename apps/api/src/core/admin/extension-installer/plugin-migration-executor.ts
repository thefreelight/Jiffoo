import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import type { PluginMigrationOperation, PluginNamespace } from '@prisma/client';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-errors';
import { pluginSchemaName, validatePluginMigrations, type MigrationPackageFile } from 'shared/plugin-signing';
import type { PluginMigrationDeclaration } from '@jiffoo/shared';
import { PLUGIN_MIGRATION_LOCK_CLASS, RUNNING_PLUGIN_OPERATION_PHASES, fenceOwnedPluginMigrationOperation, updateOwnedPluginMigrationOperation, createOwnedPluginMigrationAttempt, updateOwnedPluginMigrationAttempt } from './plugin-migration-gate';
import { pluginMigrationTestControl, observePluginMigrationDrain } from './plugin-migration-test-control';
import { processDatabaseUrl } from '@/infra/core-process-identity';
import { recoveryLimit } from './plugin-recovery-test-control';
import { databaseNowMs } from '@/infra/database-clock';

export const PLUGIN_MIGRATION_LOCK_TIMEOUT_MS = 5_000;
export const PLUGIN_MIGRATION_STATEMENT_TIMEOUT_MS = 600_000;
export const PLUGIN_MIGRATION_DEADLINE_MS = 3_600_000;

export function migrationConnectionUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  for (const parameter of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(parameter);
  // Keep every TLS parameter intact; pg retains its normal TLS URL semantics.
  return url.toString();
}

export async function migrationPlan(slug: string, database: unknown, files: readonly MigrationPackageFile[], publisher: { publisherId: string } | null) {
  const schemaName = pluginSchemaName(slug);
  const namespace = await prisma.pluginNamespace.findUnique({ where: { slug } });
  if (namespace && (namespace.schemaName !== schemaName || namespace.publisherKind === 'signed'
    && (!publisher || publisher.publisherId !== namespace.publisherId))) throw new ApiError(publisher ? 'PUBLISHER_CHANGE_FORBIDDEN' : 'SIGNED_UPGRADE_REQUIRED');
  const collision = await prisma.pluginNamespace.findUnique({ where: { schemaName } });
  if (collision && collision.slug !== slug) throw new ApiError('PLUGIN_MIGRATION_DRIFT');
  const existing = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = ${schemaName}) AS "exists"`;
  if (Boolean(namespace?.provisionedAt) !== existing[0]?.exists) throw new ApiError('PLUGIN_MIGRATION_DRIFT');
  const rows = namespace ? await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } }) : [];
  const applied = rows.map(row => ({ id: row.migrationId, order: row.order, path: row.path, sha256: row.sha256 }));
  const declarations = validatePluginMigrations(database, files, applied);
  return { schemaName, provisionNamespace: !namespace?.provisionedAt, applied, pending: declarations.slice(applied.length), changesDatabase: !namespace?.provisionedAt || declarations.length > applied.length };
}

export async function claimPluginNamespace(operation: PluginMigrationOperation, publisher: { publisherId: string } | null): Promise<PluginNamespace> {
  return prisma.$transaction(async tx => {
    await fenceOwnedPluginMigrationOperation(tx, operation);
    const existing = await tx.pluginNamespace.findUnique({ where: { slug: operation.slug } });
    if (existing?.publisherKind === 'signed' && (!publisher || existing.publisherId !== publisher.publisherId)) {
      throw new ApiError(publisher ? 'PUBLISHER_CHANGE_FORBIDDEN' : 'SIGNED_UPGRADE_REQUIRED');
    }
    if (existing) {
      if (existing.publisherKind === 'unsigned' && publisher) {
        await tx.adminAuditEvent.create({ data: { actorId: operation.actorId, targetType: 'plugin', targetId: operation.slug, action: 'PLUGIN_NAMESPACE_SIGNED', summary: { operationId: operation.id, publisherId: publisher.publisherId } } });
        return tx.pluginNamespace.update({ where: { id: existing.id }, data: { publisherKind: 'signed', publisherId: publisher.publisherId } });
      }
      return existing;
    }
    return tx.pluginNamespace.create({ data: { slug: operation.slug, schemaName: pluginSchemaName(operation.slug), publisherKind: publisher ? 'signed' : 'unsigned', publisherId: publisher?.publisherId ?? null, createdAt: new Date() } });
  });
}

export async function renewPluginMigrationLease(slug: string, token: string): Promise<void> {
  const leaseMs = recoveryLimit('leaseMs', 15 * 60_000);
  const count = await prisma.$executeRaw`UPDATE plugin_operation_leases SET "expiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + ${leaseMs} * interval '1 millisecond'
    WHERE slug = ${slug} AND token = ${token} AND "expiresAt" > clock_timestamp() AT TIME ZONE 'UTC'`;
  if (count !== 1) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
}

async function fence(client: Client, operation: PluginMigrationOperation): Promise<void> {
  const result = await client.query('SELECT token, "expiresAt" > clock_timestamp() AT TIME ZONE \'UTC\' AS valid FROM public.plugin_operation_leases WHERE slug = $1 FOR UPDATE', [operation.slug]);
  if (result.rows.length !== 1 || result.rows[0].token !== operation.leaseToken || !result.rows[0].valid) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
}

/** A dedicated connection owns the per-plugin drain lock and is always closed before returning. */
export async function executePluginMigrationFiles(operation: PluginMigrationOperation, namespace: PluginNamespace, files: readonly MigrationPackageFile[], declarations: PluginMigrationDeclaration[]): Promise<void> {
  const prefix = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } });
  validatePluginMigrations({ apiVersion: 1, migrations: declarations }, files, prefix.map(row => ({ id: row.migrationId, order: row.order, path: row.path, sha256: row.sha256 })));
  if (namespace.provisionedAt && prefix.length === declarations.length) {
    await updateOwnedPluginMigrationOperation(operation, { committedPrefix: prefix.length });
    return;
  }
  const client = new Client({ connectionString: processDatabaseUrl(env.DATABASE_URL, 'migration', operation.id, true), connectionTimeoutMillis: 5_000 });
  client.on('error', () => undefined);
  let deadline = operation.createdAt.getTime() + PLUGIN_MIGRATION_DEADLINE_MS;
  let deadlineExpired = false;
  const expire = () => { deadlineExpired = true; void client.end().catch(() => undefined); };
  let deadlineTimer = setTimeout(expire, Math.max(1, deadline - await databaseNowMs()));
  let heartbeat: NodeJS.Timeout | undefined;
  let renewal: Promise<void> | undefined;
  let renewalError: unknown;
  try {
    await client.connect();
    await prisma.$transaction(async tx => {
      await fenceOwnedPluginMigrationOperation(tx, operation);
      await tx.$queryRaw`SELECT id FROM public.plugin_installs WHERE slug = ${operation.slug} FOR UPDATE`;
      const paused = await tx.pluginMigrationOperation.updateMany({ where: { id: operation.id, leaseToken: operation.leaseToken, phase: { in: RUNNING_PLUGIN_OPERATION_PHASES } }, data: { phase: 'PAUSING' } });
      if (paused.count !== 1) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
    });
    const limits = await pluginMigrationTestControl('before-drain', operation.id);
    if (limits.deadlineMs !== undefined) {
      deadline = Math.min(deadline, await databaseNowMs() + limits.deadlineMs);
      clearTimeout(deadlineTimer); deadlineTimer = setTimeout(expire, Math.max(1, deadline - await databaseNowMs()));
    }
    const lockTimeout = limits.lockTimeoutMs ?? PLUGIN_MIGRATION_LOCK_TIMEOUT_MS;
    const statementTimeout = limits.statementTimeoutMs ?? PLUGIN_MIGRATION_STATEMENT_TIMEOUT_MS;
    await client.query(`SET lock_timeout = '${lockTimeout}ms'`);
    await client.query(`SET statement_timeout = '${lockTimeout}ms'`);
    try { await client.query('SELECT pg_advisory_lock($1::integer, $2::integer)', [PLUGIN_MIGRATION_LOCK_CLASS, namespace.id]); }
    catch { throw new ApiError('PLUGIN_MAINTENANCE'); }
    const drainDeadline = await databaseNowMs() + (limits.drainTimeoutMs ?? PLUGIN_MIGRATION_LOCK_TIMEOUT_MS);
    let announcedDrain = false;
    for (;;) {
      const markers = await client.query('SELECT EXISTS(SELECT 1 FROM public.plugin_operation_leases WHERE operation = $1) AS active', [`plugin-invocation:${operation.slug}`]);
      // Expired markers are still evidence of unknown work; never infer completion from a TTL.
      if (!markers.rows[0].active) break;
      if (!announcedDrain) { observePluginMigrationDrain(operation.id); announcedDrain = true; }
      if (await databaseNowMs() >= drainDeadline) throw new ApiError('PLUGIN_MAINTENANCE');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await updateOwnedPluginMigrationOperation(operation, { phase: 'MIGRATING' });
    heartbeat = setInterval(() => {
      if (renewal) return;
      renewal = renewPluginMigrationLease(operation.slug, operation.leaseToken).then(() => {
        if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_MIGRATION_CONTROL === '1' && process.send) process.send({ kind: 'plugin-migration-renewed', operationId: operation.id });
      }).catch(error => { renewalError = error; }).finally(() => { renewal = undefined; });
    }, limits.renewalIntervalMs ?? 60_000);
    let currentNamespace = namespace;
    const existing = await prisma.pluginMigrationSuccess.findMany({ where: { namespaceId: namespace.id }, orderBy: { order: 'asc' } });
    validatePluginMigrations({ apiVersion: 1, migrations: declarations }, files, existing.map(row => ({ id: row.migrationId, order: row.order, path: row.path, sha256: row.sha256 })));
    await updateOwnedPluginMigrationOperation(operation, { committedPrefix: existing.length });
    for (const declaration of declarations.slice(existing.length)) {
      if (renewalError) throw renewalError;
      if (deadlineExpired || await databaseNowMs() >= deadline) throw new ApiError('PLUGIN_MIGRATION_FAILED');
      await renewPluginMigrationLease(operation.slug, operation.leaseToken);
      const startedAt = Date.now();
      const attempt = await createOwnedPluginMigrationAttempt(operation, { namespaceId: namespace.id, operationId: operation.id, order: declaration.order, migrationId: declaration.id, path: declaration.path, sha256: declaration.sha256, startedAt: new Date() });
      const control = await pluginMigrationTestControl('before-file', operation.id, declaration.order);
      const remainingMs = deadline - await databaseNowMs();
      const fileTimer = setTimeout(() => { void client.end().catch(() => undefined); }, Math.max(1, Math.min(PLUGIN_MIGRATION_STATEMENT_TIMEOUT_MS, remainingMs)));
      let committing = false;
      try {
        await client.query('BEGIN');
        await fence(client, operation);
        await client.query(`SET LOCAL lock_timeout = '${lockTimeout}ms'`);
        await client.query(`SET LOCAL statement_timeout = '${Math.max(1, Math.min(control.statementTimeoutMs ?? statementTimeout, remainingMs))}ms'`);
        await client.query(`SET LOCAL search_path = "${namespace.schemaName}"`);
        if (!currentNamespace.provisionedAt) await client.query(`CREATE SCHEMA "${namespace.schemaName}"`);
        const file = files.find(candidate => candidate.path === declaration.path)!;
        await client.query(Buffer.from(file.content).toString('utf8'));
        const schema = await client.query('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = $1) AS present', [namespace.schemaName]);
        if (!schema.rows[0].present) throw new ApiError('PLUGIN_MIGRATION_FAILED');
        await fence(client, operation);
        await client.query('INSERT INTO public.plugin_migration_successes (id, "namespaceId", "order", "migrationId", path, sha256, "packageHash", "packageVersion", "manifestDigest", "operationId", "actorId", "appliedAt", "durationMs") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp() AT TIME ZONE \'UTC\',$12)', [randomUUID(), namespace.id, declaration.order, declaration.id, declaration.path, declaration.sha256, operation.packageHash, operation.packageVersion, operation.manifestDigest, operation.id, operation.actorId, Date.now() - startedAt]);
        const succeeded = await client.query('UPDATE public.plugin_migration_attempts SET status = \'SUCCESS\', "endedAt" = clock_timestamp() AT TIME ZONE \'UTC\' WHERE id = $1 AND "operationId" = $2', [attempt.id, operation.id]);
        if (succeeded.rowCount !== 1) throw new ApiError('PLUGIN_MIGRATION_FAILED');
        const progress = await client.query('UPDATE public.plugin_migration_operations SET "committedPrefix" = $2 WHERE id = $1 AND "leaseToken" = $3 AND phase = \'MIGRATING\'', [operation.id, declaration.order, operation.leaseToken]);
        if (progress.rowCount !== 1) throw new ApiError('PLUGIN_OPERATION_LEASE_LOST');
        if (!currentNamespace.provisionedAt) {
          const provisioned = await client.query('UPDATE public.plugin_namespaces SET "provisionedAt" = clock_timestamp() AT TIME ZONE \'UTC\' WHERE id = $1', [namespace.id]);
          if (provisioned.rowCount !== 1) throw new ApiError('PLUGIN_MIGRATION_FAILED');
        }
        await pluginMigrationTestControl('before-commit', operation.id, declaration.order);
        committing = true;
        await client.query('COMMIT');
        currentNamespace = { ...currentNamespace, provisionedAt: new Date() };
      } catch (error) {
        const sqlstate = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
        if (committing && !sqlstate) {
          // Record uncertainty before reconciling from durable evidence; never execute this file again blindly.
          await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, operationId: operation.id }, { status: 'UNKNOWN', endedAt: new Date(), errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN' });
          const ledger = await prisma.pluginMigrationSuccess.findUnique({ where: { namespaceId_order: { namespaceId: namespace.id, order: declaration.order } } });
          if (ledger && ledger.migrationId === declaration.id && ledger.path === declaration.path && ledger.sha256 === declaration.sha256) {
            await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, operationId: operation.id, status: 'UNKNOWN' }, { status: 'SUCCESS', resolution: 'LEDGER_CONFIRMED' });
          }
          throw new ApiError('PLUGIN_MIGRATION_OUTCOME_UNKNOWN');
        }
        await client.query('ROLLBACK').catch(() => undefined);
        await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, operationId: operation.id }, { status: 'FAILED', endedAt: new Date(), sqlstate, errorCode: error instanceof ApiError ? error.code : 'PLUGIN_MIGRATION_FAILED' });
        throw error instanceof ApiError ? error : new ApiError('PLUGIN_MIGRATION_FAILED');
      } finally { clearTimeout(fileTimer); }
    }
    if (!currentNamespace.provisionedAt) {
      const attempt = await createOwnedPluginMigrationAttempt(operation, { namespaceId: namespace.id, operationId: operation.id, order: 0, migrationId: '__namespace__', path: '@namespace', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', startedAt: new Date() });
      let committing = false;
      await client.query('BEGIN');
      try {
        await fence(client, operation);
        await client.query(`CREATE SCHEMA "${namespace.schemaName}"`);
        const provisioned = await client.query('UPDATE public.plugin_namespaces SET "provisionedAt" = clock_timestamp() AT TIME ZONE \'UTC\' WHERE id = $1', [namespace.id]);
        if (provisioned.rowCount !== 1) throw new ApiError('PLUGIN_MIGRATION_FAILED');
        await client.query('INSERT INTO public.admin_audit_events (id, "actorId", action, "targetType", "targetId", summary, "createdAt") VALUES ($1,$2,\'PLUGIN_NAMESPACE_PROVISIONED\',\'plugin\',$3,$4::jsonb,clock_timestamp() AT TIME ZONE \'UTC\')', [randomUUID(), operation.actorId, operation.slug, JSON.stringify({ operationId: operation.id, schemaName: namespace.schemaName })]);
        await fence(client, operation);
        const succeeded = await client.query('UPDATE public.plugin_migration_attempts SET status = \'SUCCESS\', "endedAt" = clock_timestamp() AT TIME ZONE \'UTC\' WHERE id = $1 AND "operationId" = $2', [attempt.id, operation.id]);
        if (succeeded.rowCount !== 1) throw new ApiError('PLUGIN_MIGRATION_FAILED');
        committing = true;
        await client.query('COMMIT');
      } catch (error) {
        const sqlstate = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
        if (committing && !sqlstate) {
          await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, operationId: operation.id }, { status: 'UNKNOWN', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', endedAt: new Date() });
          const proof = await namespaceProvisioningConfirmed(namespace.id, operation.id);
          if (proof) await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, operationId: operation.id, status: 'UNKNOWN' }, { status: 'SUCCESS', resolution: 'NAMESPACE_CONFIRMED' });
          throw new ApiError('PLUGIN_MIGRATION_OUTCOME_UNKNOWN');
        }
        await client.query('ROLLBACK').catch(() => undefined);
        await updateOwnedPluginMigrationAttempt(operation, { id: attempt.id, operationId: operation.id }, { status: 'FAILED', sqlstate, endedAt: new Date(), errorCode: error instanceof ApiError ? error.code : 'PLUGIN_MIGRATION_FAILED' });
        throw error instanceof ApiError ? error : new ApiError('PLUGIN_MIGRATION_FAILED');
      }
    }
  } finally {
    clearTimeout(deadlineTimer);
    if (heartbeat) clearInterval(heartbeat);
    await client.end().catch(() => undefined);
    await renewal;
  }
}

export async function namespaceProvisioningConfirmed(namespaceId: number, operationId: string): Promise<boolean> {
  const namespace = await prisma.pluginNamespace.findUniqueOrThrow({ where: { id: namespaceId } });
  const audit = await prisma.adminAuditEvent.findFirst({ where: { targetId: namespace.slug, action: 'PLUGIN_NAMESPACE_PROVISIONED', summary: { path: ['operationId'], equals: operationId } } });
  return Boolean(namespace.provisionedAt && audit);
}
