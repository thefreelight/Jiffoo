/**
 * Repair bootstrap admission for a plugin installation.
 *
 * The repair-bootstrap route belongs to the extension-installer module, and so
 * does the admission itself: the installer owns the plugin runtime, the durable
 * task API and the stored manifest of an installation, and it records the
 * rejection audit through the single audit outlet.
 */

import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { AuthService } from '@/core/auth/service';
import { AuditService } from '@/core/audit/service';
import {
  assertTaskPolicy,
  enqueueTaskInTransaction,
  lockTaskScheduler,
  REPAIR_BOOTSTRAP_KEY_PREFIX,
  taskDatabaseTime,
  taskDeclarationIdentity,
  taskStatus,
} from '@/core/plugins/tasks';
import { readStoredPluginManifest } from './stored-manifest';
import { prepareRepairBootstrap } from '@/core/extensions/runtime/plugin-runtime';

/**
 * Record the audit row of a rejected repair-bootstrap request.
 *
 * The row itself is mandatory: it is the only record that a repair attempt was
 * refused. The manifest fields of the summary are a convenience, so a failing
 * manifest lookup never keeps the row from being written.
 */
export async function recordRepairBootstrapRejection(request: FastifyRequest, installationId: string, outcome: string) {
  const subject = AuthService.requestSessionSubject(request);
  const body = request.body as Record<string, unknown> | null;
  const reason = typeof body?.reason === 'string' && /^[A-Z][A-Z0-9_]{0,63}$(?![\s\S])/.test(body.reason) ? body.reason : null;
  const key = typeof body?.idempotencyKey === 'string' && /^[A-Za-z0-9_-]{1,96}$(?![\s\S])/.test(body.idempotencyKey) ? body.idempotencyKey : null;
  const targetId = installationId.slice(0, 128);
  // The manifest fields of the summary are a convenience, so a failing lookup
  // never keeps the audit row itself from being written.
  let manifestVersion: string | null = null;
  let manifestName: string | null = null;
  let manifestTaskVersion: number | null = null;
  try {
    const installation = await prisma.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
    const manifest = installation?.plugin.manifestJson as { version?: unknown; repairBootstrap?: { name?: unknown; version?: unknown } } | undefined;
    manifestVersion = typeof manifest?.version === 'string' ? manifest.version.slice(0, 128) : null;
    manifestName = typeof manifest?.repairBootstrap?.name === 'string' ? manifest.repairBootstrap.name.slice(0, 128) : null;
    manifestTaskVersion = typeof manifest?.repairBootstrap?.version === 'number' ? manifest.repairBootstrap.version : null;
  } catch (error) {
    request.log.warn({ err: error }, 'Repair bootstrap rejection manifest lookup failed');
  }
  await AuditService.write(prisma, {
    actorId: subject ? `verified-token:${subject.userId}` : 'anonymous', action: 'PLUGIN_TASK_BOOTSTRAP_REJECTED',
    targetType: 'plugin-installation', targetId,
    summary: { installationId: targetId, outcome, replay: null, reason, keyHash: key ? createHash('sha256').update(key).digest('hex') : null,
      name: manifestName, version: manifestTaskVersion, manifestVersion },
  });
}

/**
 * Authorize a repair-bootstrap task for an installation.
 *
 * The task is enqueued unbound: it carries no principal and runs with the
 * privileges of the installation itself.
 */
export async function repairBootstrap(slug: string, installationId: string, body: unknown, request: FastifyRequest) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'idempotencyKey,reason') throw new ApiError('VALIDATION_ERROR');
  const { idempotencyKey, reason } = body as Record<string, unknown>;
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{1,96}$(?![\s\S])/.test(idempotencyKey) || typeof reason !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$(?![\s\S])/.test(reason)) throw new ApiError('VALIDATION_ERROR');
  if (!AuthService.requestSessionSubject(request)) throw new ApiError('UNAUTHORIZED');
  const identity = await prepareRepairBootstrap(slug, installationId);
  return prisma.$transaction(async tx => {
    const { policy } = await lockTaskScheduler(tx);
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${installationId} FOR UPDATE`;
    const installation = await tx.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
    if (!installation || installation.pluginSlug !== slug || installation.deletedAt || installation.plugin.deletedAt || !installation.enabled) throw new ApiError('PLUGIN_DISABLED');
    if (installation.taskDependencyUnavailable) throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE');
    if (installation.protectionGeneration !== identity.generation || installation.plugin.zipHash !== identity.zipHash) throw new ApiError('PLUGIN_TASK_CLAIM_LOST');
    const manifest = readStoredPluginManifest(installation.plugin);
    const selected = manifest.repairBootstrap;
    const declaration = manifest.tasks?.find(task => task.name === selected?.name && task.version === selected?.version);
    if (!selected || !declaration || selected.name !== identity.name || selected.version !== identity.version || taskDeclarationIdentity(declaration) !== identity.declaration) throw new ApiError('PLUGIN_TASK_BOOTSTRAP_NOT_ALLOWED');
    assertTaskPolicy([declaration], policy);
    const actorId = await AuthService.admitRequestAdmin(tx, request);
    const { task, replay } = await enqueueTaskInTransaction(tx, {
      installationId, name: selected.name, version: selected.version, payload: { reason }, principal: null,
      idempotencyKey: REPAIR_BOOTSTRAP_KEY_PREFIX + idempotencyKey, schedule: {}, runAt: await taskDatabaseTime(tx), declaration,
      bootstrapIdentity: `${manifest.version}:${identity.declaration}`,
    });
    await AuditService.write(tx, { actorId, action: 'PLUGIN_TASK_BOOTSTRAP_ALLOWED', targetType: 'plugin-task', targetId: task.id,
      summary: { installationId, taskId: task.id, name: task.name, version: task.version, manifestVersion: manifest.version, declaration: identity.declaration, reason, replay, outcome: 'ALLOWED', keyHash: createHash('sha256').update(idempotencyKey).digest('hex') } });
    return taskStatus(tx, task);
  });
}
