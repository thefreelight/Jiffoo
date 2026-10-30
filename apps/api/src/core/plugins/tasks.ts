import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { Prisma, type PluginTask, type PluginTaskFinalFailure } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import type { PluginTasks, PluginTaskDeclaration, TaskPrincipal, TaskStatus } from '@jiffoo/shared';
import type { PoolClient } from 'pg';
import { AuditService } from '@/core/audit/service';

export type TaskTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type TaskPolicy = { globalSlots: number; installationSlots: number; handlerConcurrency: number; attempts: number; runtimeSeconds: number; hookSeconds: number };
export const DEFAULT_TASK_POLICY: TaskPolicy = { globalSlots: 16, installationSlots: 4, handlerConcurrency: 4, attempts: 10, runtimeSeconds: 600, hookSeconds: 30 };
export type TaskClaim = { task: PluginTask; hook: PluginTaskFinalFailure | null; claimId: string; fence: bigint; generation: bigint; zipHash: string; bootNonce: string; deadlineAt: Date; slotId: string };
type TaskScope = { installationId: string; generation: bigint; zipHash: string; request: boolean; principal: TaskPrincipal | null; actorId: string; signal?: AbortSignal; claim?: TaskClaim; open: boolean };
const scopes = new AsyncLocalStorage<TaskScope>();
const activeStates = ['ACTIVE', 'LINGERING'];
export const occupiedTaskSlots = activeStates;

/**
 * The age after which an execution slot that stopped being observed is stale.
 *
 * The observation of a slot is written every ten seconds while its invocation
 * lives, so a slot that was not observed for twice the runtime of a task
 * cannot belong to a running invocation any more.
 */
export function staleTaskSlotMs(policy: TaskPolicy): number {
  return 2 * policy.runtimeSeconds * 1000;
}

export async function withTaskScope<T>(scope: Omit<TaskScope, 'open'>, run: () => Promise<T>): Promise<T> {
  const admission = { ...scope, open: true };
  return scopes.run(admission, async () => { try { return await run(); } finally { admission.open = false; } });
}
export function currentTaskClaim(): TaskClaim | undefined { return scopes.getStore()?.claim; }
export function withInstallationTaskHandler<T>(installationId: string, generation: bigint, zipHash: string, run: () => Promise<T>): Promise<T> {
  const inherited = scopes.getStore();
  if (inherited?.installationId === installationId) return run();
  return withTaskScope({ installationId, generation, zipHash, request: false, principal: null, actorId: `installation:${installationId}` }, run);
}

/** Lock and validate the Core claim inside the plugin-owned SQL transaction. */
export async function fenceTaskDatabase(client: PoolClient): Promise<void> {
  const claim = currentTaskClaim();
  if (!claim) return;
  const table = claim.hook ? 'plugin_task_final_failures' : 'plugin_tasks';
  const key = claim.hook ? 'taskId' : 'id';
  const result = await client.query(`SELECT c."claimToken" FROM public.${table} c JOIN public.plugin_installations i ON i.id = $4 JOIN public.plugin_installs p ON p.slug = i."pluginSlug" WHERE c."${key}" = $1 AND c."claimToken" = $2::uuid AND c.fence = $3::bigint AND c.status = 'RUNNING' AND c."leaseUntil" > clock_timestamp() AND c."deadlineAt" > clock_timestamp() AND c.generation = i."protectionGeneration" AND c."zipHash" = p."zipHash" AND i.enabled AND i."deletedAt" IS NULL AND p."deletedAt" IS NULL AND NOT i."taskDependencyUnavailable" FOR SHARE OF c, i, p`, [claim.task.id, claim.claimId, claim.fence.toString(), claim.task.installationId]);
  if (!result.rows.length || !scopes.getStore()?.open || scopes.getStore()?.signal?.aborted) throw new ApiError('PLUGIN_TASK_CLAIM_LOST');
  const principal = principalForTask(claim.task);
  if (principal) {
    const user = await client.query('SELECT id FROM public.users WHERE id=$1 AND "isActive" AND "removedAt" IS NULL AND role=$2 FOR SHARE', [principal.id, principal.type === 'admin' ? 'ADMIN' : 'USER']);
    if (!user.rows.length) throw new ApiError('PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED');
  }
}

/** Shared lifecycle lock order: graph, scheduler, then ordered installation rows. */
export async function lockTaskScheduler(tx: TaskTransaction): Promise<{ policy: TaskPolicy; policyVersion: number; roundSequence: bigint }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('jiffoo:plugin-service-graph', 0))`;
  await tx.pluginTaskScheduler.upsert({ where: { id: 'singleton' }, create: { policy: DEFAULT_TASK_POLICY }, update: {} });
  await tx.$queryRaw`SELECT id FROM public.plugin_task_scheduler WHERE id = 'singleton' FOR UPDATE`;
  const row = await tx.pluginTaskScheduler.findUniqueOrThrow({ where: { id: 'singleton' } });
  const policy = row.policy as TaskPolicy;
  const caps = { globalSlots: 256, installationSlots: 256, handlerConcurrency: 16, attempts: 20, runtimeSeconds: 600, hookSeconds: 60 };
  if (Object.keys(policy).length !== Object.keys(caps).length || Object.entries(caps).some(([key, max]) => !Number.isInteger(policy[key as keyof TaskPolicy]) || policy[key as keyof TaskPolicy] < 1 || policy[key as keyof TaskPolicy] > max)) throw new ApiError('PLUGIN_TASK_LIMIT_CONFLICT');
  return { ...row, policy };
}
export async function taskDatabaseTime(tx: TaskTransaction): Promise<Date> {
  return (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
}
export async function setTaskOperatorPolicy(tx: TaskTransaction, policy: TaskPolicy): Promise<void> {
  await lockTaskScheduler(tx);
  await tx.pluginTaskScheduler.update({ where: { id: 'singleton' }, data: { policy, policyVersion: { increment: 1 } } });
  await lockTaskScheduler(tx);
}
export function assertTaskPolicy(declarations: readonly PluginTaskDeclaration[], policy: TaskPolicy): void {
  for (const d of declarations) if (d.concurrency > policy.handlerConcurrency || d.concurrency > policy.installationSlots || d.concurrency > policy.globalSlots || d.maxAttempts > policy.attempts || d.maxRuntimeSeconds > policy.runtimeSeconds || d.onFinalFailure && d.onFinalFailure.maxRuntimeSeconds > policy.hookSeconds) throw new ApiError('PLUGIN_TASK_DECLARATION_INVALID');
}

/**
 * The failure codes that no retry can fix.
 *
 * A task whose declaration is invalid, or whose plugin is blocked by an open
 * circuit, fails the same way on every attempt. Such a failure is terminal:
 * it must not walk the retry ladder, and it must not count against the
 * circuit breaker of the plugin again and again.
 */
export const DETERMINISTIC_TASK_FAILURES = ['PLUGIN_TASK_DECLARATION_INVALID', 'PLUGIN_CIRCUIT_OPEN'] as const;

/** Whether a failure code names a failure that no retry can fix. */
export function isDeterministicTaskFailure(code: string | null | undefined): boolean {
  return !!code && (DETERMINISTIC_TASK_FAILURES as readonly string[]).includes(code);
}

/** G4 publishes derived availability here under the same graph transaction. */
export async function setTaskDependencyAvailability(tx: TaskTransaction, installationId: string, available: boolean): Promise<void> {
  await lockTaskScheduler(tx);
  await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${installationId} FOR UPDATE`;
  await tx.pluginInstallation.update({ where: { id: installationId }, data: { taskDependencyUnavailable: !available } });
  if (!available) await transitionInstallationTasks(tx, installationId, 'PAUSE', 'dependency-unavailable');
}

export async function validateTaskPrincipal(tx: TaskTransaction, installationId: string, principal: TaskPrincipal | null): Promise<void> {
  if (!principal) return;
  const user = await tx.user.findUnique({ where: { id: principal.id }, select: { role: true, isActive: true, removedAt: true } });
  const recorded = await tx.pluginPrincipal.findUnique({ where: { installationId_principalType_principalId: { installationId, principalType: principal.type.toUpperCase(), principalId: principal.id } } });
  if (!user?.isActive || user.removedAt || (principal.type === 'admin' ? user.role !== 'ADMIN' : user.role !== 'USER') || !recorded) throw new ApiError('PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED');
}
export async function recordTaskPrincipal(installationId: string, user: { id: string; role: string } | null, source: 'GATEWAY' | 'PAGE_SESSION' = 'GATEWAY'): Promise<TaskPrincipal | null> {
  if (!user) return null;
  return prisma.$transaction(tx => recordTaskPrincipalInTransaction(tx, installationId, user, source));
}

/** Record a trusted principal atomically with its owning shell admission. */
export async function recordTaskPrincipalInTransaction(tx: TaskTransaction, installationId: string, user: { id: string; role: string } | null, source: 'GATEWAY' | 'PAGE_SESSION'): Promise<TaskPrincipal | null> {
  if (!user) return null;
  const principal: TaskPrincipal = Object.freeze({ type: user.role === 'ADMIN' ? 'admin' : 'customer', id: user.id });
  const live = await tx.user.findUnique({ where: { id: user.id } });
  if (!live?.isActive || live.removedAt || live.role !== user.role || !['USER', 'ADMIN'].includes(live.role)) throw new ApiError('PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED');
  const now = await taskDatabaseTime(tx);
  await tx.pluginPrincipal.upsert({ where: { installationId_principalType_principalId: { installationId, principalType: principal.type.toUpperCase(), principalId: user.id } }, create: { installationId, principalType: principal.type.toUpperCase(), principalId: user.id, source, firstSeenAt: now, lastSeenAt: now }, update: { lastSeenAt: now, source } });
  return principal;
}
export function principalForTask(task: PluginTask): TaskPrincipal | null {
  return task.principalId ? Object.freeze({ type: task.principalType === 'ADMIN' ? 'admin' : 'customer', id: task.principalId }) : null;
}

export async function assertTaskClaim(tx: TaskTransaction, claim: TaskClaim): Promise<void> {
  const live = claim.hook
    ? await tx.$queryRaw<Array<{ valid: boolean }>>`SELECT true AS valid FROM public.plugin_task_final_failures h JOIN public.plugin_tasks t ON t.id = h."taskId" JOIN public.plugin_installations i ON i.id = t."installationId" JOIN public.plugin_installs p ON p.slug = i."pluginSlug" WHERE h."taskId" = ${claim.task.id} AND h.status = 'RUNNING' AND h."claimToken" = ${claim.claimId}::uuid AND h.fence = ${claim.fence} AND h."leaseUntil" > clock_timestamp() AND h."deadlineAt" > clock_timestamp() AND h.generation = i."protectionGeneration" AND h."zipHash" = p."zipHash" AND i.enabled AND i."deletedAt" IS NULL AND p."deletedAt" IS NULL AND NOT i."taskDependencyUnavailable" FOR SHARE OF h, i, p`
    : await tx.$queryRaw<Array<{ valid: boolean }>>`SELECT true AS valid FROM public.plugin_tasks t JOIN public.plugin_installations i ON i.id = t."installationId" JOIN public.plugin_installs p ON p.slug = i."pluginSlug" WHERE t.id = ${claim.task.id} AND t.status = 'RUNNING' AND t."claimToken" = ${claim.claimId}::uuid AND t.fence = ${claim.fence} AND t."leaseUntil" > clock_timestamp() AND t."deadlineAt" > clock_timestamp() AND t.generation = i."protectionGeneration" AND t."zipHash" = p."zipHash" AND i.enabled AND i."deletedAt" IS NULL AND p."deletedAt" IS NULL AND NOT i."taskDependencyUnavailable" FOR SHARE OF t, i, p`;
  if (!live.length) {
    console.warn(JSON.stringify({ event: 'plugin_task_stale_claim', taskId: claim.task.id, claimId: claim.claimId, fence: claim.fence.toString() }));
    throw new ApiError('PLUGIN_TASK_CLAIM_LOST');
  }
  await validateTaskPrincipal(tx, claim.task.installationId, principalForTask(claim.task));
}
export async function assertTaskOperation(tx: TaskTransaction, installationId: string): Promise<TaskScope> {
  const scope = scopes.getStore();
  if (!scope?.open || scope.installationId !== installationId || scope.signal?.aborted) throw new ApiError('PLUGIN_TASK_CLAIM_LOST');
  if (scope.claim) await assertTaskClaim(tx, scope.claim);
  else {
    const installation = await tx.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
    if (!installation?.enabled || installation.deletedAt || installation.plugin.deletedAt) throw new ApiError('PLUGIN_DISABLED');
    if (installation.protectionGeneration !== scope.generation || installation.plugin.zipHash !== scope.zipHash) throw new ApiError('PLUGIN_TASK_CLAIM_LOST');
    if (installation.taskDependencyUnavailable) throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE', { retryable: true, retryAfterSeconds: 5 });
    await validateTaskPrincipal(tx, installationId, scope.principal);
  }
  return scope;
}
export async function requireTaskPrincipal(tx: TaskTransaction, installationId: string): Promise<TaskPrincipal> {
  const scope = await assertTaskOperation(tx, installationId);
  if (!scope.principal) throw new ApiError('PLUGIN_TASK_PRINCIPAL_REQUIRED');
  return scope.principal;
}
function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, canonical).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  throw new ApiError('VALIDATION_ERROR');
}
export function taskJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  let text: string;
  try { text = canonical(value); } catch { throw new ApiError('VALIDATION_ERROR'); }
  if (Buffer.byteLength(text) > 65_536) throw new ApiError('PAYLOAD_TOO_LARGE');
  return value === null ? Prisma.JsonNull : JSON.parse(text);
}
export function taskDeclarationIdentity(declaration: PluginTaskDeclaration): string {
  return canonical(declaration);
}
export async function taskStatus(tx: TaskTransaction, task: PluginTask): Promise<TaskStatus> {
  const installation = await tx.pluginInstallation.findUnique({ where: { id: task.installationId }, include: { plugin: true } });
  const reason = !installation?.enabled || installation.deletedAt || installation.plugin.deletedAt ? 'plugin-disabled' : installation.taskDependencyUnavailable ? 'dependency-unavailable' : undefined;
  const hook = await tx.pluginTaskFinalFailure.findUnique({ where: { taskId: task.id } });
  const statuses = { PENDING: 'queued', RUNNING: 'running', SUCCEEDED: 'succeeded', FAILED: 'failed', CANCELLED: 'cancelled' } as const;
  let lastError=task.lastError as TaskStatus['lastError'];
  if(task.status==='PENDING' && task.principalId){
    try{await validateTaskPrincipal(tx,task.installationId,principalForTask(task));}
    catch(error){if(!(error instanceof ApiError && error.code==='PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED'))throw error;lastError={code:error.code,message:error.message};}
  }
  return { id: task.id, status: statuses[task.status as keyof typeof statuses], paused: task.status === 'PENDING' && !!reason, ...(task.status === 'PENDING' && reason ? { pauseReason: reason } : {}), attempt: task.attemptsCharged + (task.status === 'RUNNING' ? 1 : 0), lastError, ...(task.result !== null ? { result: task.result as TaskStatus['result'] } : {}), ...(hook ? { finalFailure: { status: hook.status.toLowerCase() as NonNullable<TaskStatus['finalFailure']>['status'], ...(hook.safeError ? { lastError: hook.safeError as { code: string; message: string } } : {}), ...(hook.suppressionReason ? { suppressionReason: hook.suppressionReason } : {}) } } : {}) };
}

/**
 * The number of tasks one transition transaction covers.
 *
 * The transition of an installation is one atomic state machine, so the
 * number of tasks it covers has to be bounded. The bound is loud: an
 * installation with more active tasks than this fails the transition with a
 * limit conflict instead of opening a transaction across an unbounded amount
 * of work.
 */
const TASK_TRANSITION_LIMIT = 1000;

/**
 * The set-based projection of a task list.
 *
 * The per-row projection runs three statements per task, so a list of a
 * hundred tasks opened three hundred statements in one transaction. This
 * projection answers the same questions with a fixed number of statements:
 * one for the installation, one for the final-failure hooks and one per
 * principal table.
 */
async function taskStatuses(tx: TaskTransaction, installationId: string, tasks: PluginTask[]): Promise<TaskStatus[]> {
  const installation = await tx.pluginInstallation.findUnique({ where: { id: installationId }, include: { plugin: true } });
  const reason = !installation?.enabled || installation.deletedAt || installation.plugin.deletedAt ? 'plugin-disabled' : installation.taskDependencyUnavailable ? 'dependency-unavailable' : undefined;
  const hooks = tasks.length ? await tx.pluginTaskFinalFailure.findMany({ where: { taskId: { in: tasks.map(task => task.id) } } }) : [];
  const hookByTask = new Map(hooks.map(hook => [hook.taskId, hook]));
  // The principal of a pending task is validated once per distinct principal
  // instead of once per task.
  const principals = new Map<string, TaskPrincipal>();
  for (const task of tasks) {
    if (task.status !== 'PENDING' || !task.principalId) continue;
    const principal = principalForTask(task);
    if (principal) principals.set(`${principal.type}:${principal.id}`, principal);
  }
  const rejections = new Map<string, ApiError | null>();
  if (principals.size) {
    const ids = [...new Set([...principals.values()].map(principal => principal.id))];
    const users = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, isActive: true, removedAt: true } });
    const recorded = await tx.pluginPrincipal.findMany({ where: { installationId, principalId: { in: ids } } });
    const userById = new Map(users.map(user => [user.id, user]));
    const recordedKeys = new Set(recorded.map(principal => `${principal.principalType}:${principal.principalId}`));
    for (const [key, principal] of principals) {
      const user = userById.get(principal.id);
      const allowed = !!user?.isActive && !user.removedAt && (principal.type === 'admin' ? user.role === 'ADMIN' : user.role === 'USER') && recordedKeys.has(`${principal.type.toUpperCase()}:${principal.id}`);
      rejections.set(key, allowed ? null : new ApiError('PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED'));
    }
  }
  const statuses = { PENDING: 'queued', RUNNING: 'running', SUCCEEDED: 'succeeded', FAILED: 'failed', CANCELLED: 'cancelled' } as const;
  return tasks.map(task => {
    const hook = hookByTask.get(task.id);
    let lastError = task.lastError as TaskStatus['lastError'];
    if (task.status === 'PENDING' && task.principalId) {
      const principal = principalForTask(task);
      const rejection = principal ? rejections.get(`${principal.type}:${principal.id}`) : null;
      if (rejection) lastError = { code: rejection.code, message: rejection.message };
    }
    return { id: task.id, status: statuses[task.status as keyof typeof statuses], paused: task.status === 'PENDING' && !!reason, ...(task.status === 'PENDING' && reason ? { pauseReason: reason } : {}), attempt: task.attemptsCharged + (task.status === 'RUNNING' ? 1 : 0), lastError, ...(task.result !== null ? { result: task.result as TaskStatus['result'] } : {}), ...(hook ? { finalFailure: { status: hook.status.toLowerCase() as NonNullable<TaskStatus['finalFailure']>['status'], ...(hook.safeError ? { lastError: hook.safeError as { code: string; message: string } } : {}), ...(hook.suppressionReason ? { suppressionReason: hook.suppressionReason } : {}) } } : {}) };
  });
}

export const REPAIR_BOOTSTRAP_KEY_PREFIX = 'admin-repair-bootstrap:';

/** Caller owns admission; all task writes use this transactional enqueue path. */
export async function enqueueTaskInTransaction(tx: TaskTransaction, input: {
  installationId: string; name: string; version: number; payload: unknown; principal: TaskPrincipal | null;
  idempotencyKey: string; runAt: Date; schedule: Prisma.InputJsonObject; declaration?: PluginTaskDeclaration;
  bootstrapIdentity?: string;
}): Promise<{ task: PluginTask; replay: boolean }> {
  const { policy, policyVersion } = await lockTaskScheduler(tx);
  const { installationId, name, version, payload, principal, idempotencyKey, runAt, schedule } = input;
  taskJson(payload);
  const inputHash = createHash('sha256').update(canonical({ payload, principal, schedule, ...(input.bootstrapIdentity ? { bootstrapIdentity: input.bootstrapIdentity } : {}) })).digest('hex');
  const previous = input.bootstrapIdentity
    ? await tx.pluginTask.findFirst({ where: { installationId, idempotencyKey } })
    : await tx.pluginTask.findUnique({ where: { installationId_name_version_idempotencyKey: { installationId, name, version, idempotencyKey } } });
  if (previous) {
    if (previous.inputHash !== inputHash || previous.name !== name || previous.version !== version) throw new ApiError('PLUGIN_TASK_IDEMPOTENCY_CONFLICT');
    return { task: previous, replay: true };
  }
  const installation = await tx.pluginInstallation.findUniqueOrThrow({ where: { id: installationId }, include: { plugin: true } });
  const declaration = input.declaration ?? (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks?.find(d => d.name === name && d.version === version);
  if (!declaration) throw new ApiError('PLUGIN_TASK_DECLARATION_INVALID');
  assertTaskPolicy([declaration], policy);
  if (input.bootstrapIdentity) {
    const candidates = { installationId, OR: [{ name }, { idempotencyKey: { startsWith: REPAIR_BOOTSTRAP_KEY_PREFIX } }] };
    const active = await tx.pluginTask.findFirst({ where: { ...candidates, OR: [
      { AND: [{ OR: candidates.OR }, { status: { in: ['PENDING', 'RUNNING'] } }] },
      { AND: [{ OR: candidates.OR }, { finalFailure: { status: { in: ['PENDING', 'RUNNING', 'UNKNOWN'] } } }] },
    ] } });
    const slots = await tx.pluginTaskExecutionSlot.findMany({ where: { installationId, state: { in: occupiedTaskSlots } }, select: { taskId: true } });
    const occupied = slots.length ? await tx.pluginTask.findFirst({ where: { ...candidates, id: { in: slots.map(slot => slot.taskId) } } }) : null;
    if (active || occupied) throw new ApiError('PLUGIN_TASK_LIMIT_CONFLICT');
  }
  const task = await tx.pluginTask.create({ data: { installationId, name, version, idempotencyKey, inputHash, scheduleRequest: schedule, payload: taskJson(payload), principalType: principal?.type.toUpperCase() ?? null, principalId: principal?.id ?? null, runAt, nextAttemptAt: runAt, maxAttempts: declaration.maxAttempts, maxRuntimeSeconds: declaration.maxRuntimeSeconds, declaredConcurrency: declaration.concurrency, policyVersion } });
  return { task, replay: false };
}

export function createTaskApi(installationId: string, handle: PluginTasks['handle']): PluginTasks {
  const owned = async (tx: TaskTransaction, id: string) => {
    if(typeof id!=='string' || !id || Buffer.byteLength(id)>128 || id.includes('\0'))throw new ApiError('VALIDATION_ERROR');
    const row = await tx.pluginTask.findFirst({ where: { id, installationId } });
    if (!row) throw new ApiError('PLUGIN_TASK_NOT_FOUND');
    return row;
  };
  return {
    handle,
    enqueue: async (name, version, payload, options) => prisma.$transaction(async tx => {
      await lockTaskScheduler(tx);
      const scope = await assertTaskOperation(tx, installationId);
      if (!options || typeof options !== 'object' || typeof options.idempotencyKey !== 'string' || !options.idempotencyKey || options.idempotencyKey.startsWith(REPAIR_BOOTSTRAP_KEY_PREFIX) || Buffer.byteLength(options.idempotencyKey) > 128 || Object.keys(options).some(k => !['idempotencyKey', 'runAt', 'delayMs', 'principal'].includes(k))) throw new ApiError('VALIDATION_ERROR');
      let principal = scope.principal;
      if (Object.hasOwn(options, 'principal')) {
        if (scope.request) throw new ApiError('PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN');
        const p = options.principal;
        if (!p || typeof p !== 'object' || !['customer', 'admin'].includes(p.type) || typeof p.id !== 'string' || !p.id || p.id.length > 128 || Object.keys(p).sort().join(',') !== 'id,type') throw new ApiError('PLUGIN_TASK_PRINCIPAL_INVALID');
        principal = Object.freeze({ type: p.type, id: p.id });
      }
      await validateTaskPrincipal(tx, installationId, principal);
      const now = await taskDatabaseTime(tx);
      if (options.runAt !== undefined && options.delayMs !== undefined || options.delayMs !== undefined && (!Number.isSafeInteger(options.delayMs) || options.delayMs < 0 || options.delayMs > 30 * 86_400_000)) throw new ApiError('VALIDATION_ERROR');
      if (options.runAt !== undefined && typeof options.runAt !== 'string') throw new ApiError('VALIDATION_ERROR');
      const runAt = options.runAt === undefined ? new Date(now.getTime() + (options.delayMs ?? 0)) : new Date(options.runAt);
      if (!Number.isFinite(runAt.getTime()) || runAt.getTime() > now.getTime() + 30 * 86_400_000) throw new ApiError('VALIDATION_ERROR');
      const schedule = options.runAt !== undefined ? { runAt: runAt.toISOString() } : options.delayMs !== undefined ? { delayMs: options.delayMs } : {};
      const { task, replay } = await enqueueTaskInTransaction(tx, { installationId, name, version, payload, principal, schedule, runAt, idempotencyKey: options.idempotencyKey });
      if (replay) return taskStatus(tx, task);
      await AuditService.write(tx, { actorId: scope.actorId, action: 'PLUGIN_TASK_PRINCIPAL_BOUND', targetType: 'plugin-task', targetId: task.id, summary: { installationId, principal, outcome: 'ALLOWED' } });
      return taskStatus(tx, task);
    }).catch(async error => {
      if (error instanceof ApiError && ['PLUGIN_TASK_PRINCIPAL_INVALID','PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN','PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED','PLUGIN_TASK_PRINCIPAL_REQUIRED'].includes(error.code)) {
        const scope = scopes.getStore();
        const selected = options?.principal;
        await AuditService.write(prisma, { actorId: scope?.actorId ?? 'unknown', action: 'PLUGIN_TASK_PRINCIPAL_REJECTED', targetType: 'plugin', targetId: installationId, summary: { installationId, executionTaskId: scope?.claim?.task.id ?? null, principal: selected && ['customer','admin'].includes(selected.type) && typeof selected.id === 'string' && selected.id.length <= 128 ? { type: selected.type, id: selected.id } : null, outcome: error.code } });
      }
      throw error;
    }),
    get: id => prisma.$transaction(async tx => { await assertTaskOperation(tx, installationId); return taskStatus(tx, await owned(tx, id)); }),
    list: options => prisma.$transaction(async tx => {
      await assertTaskOperation(tx, installationId);
      const statuses = { queued: 'PENDING', running: 'RUNNING', succeeded: 'SUCCEEDED', failed: 'FAILED', cancelled: 'CANCELLED' };
      if (!options || options.status !== undefined && !Object.hasOwn(statuses, options.status) || options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) || options.cursor !== undefined && (typeof options.cursor !== 'string' || options.cursor.length > 128)) throw new ApiError('VALIDATION_ERROR');
      const limit = options.limit ?? 25;
      const rows = await tx.pluginTask.findMany({ where: { installationId, ...(options.status ? { status: statuses[options.status] } : {}), ...(options.cursor ? { id: { gt: options.cursor } } : {}) }, orderBy: { id: 'asc' }, take: limit + 1 });
      return { items: await taskStatuses(tx, installationId, rows.slice(0, limit)), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
    }),
    cancel: id => prisma.$transaction(async tx => {
      await lockTaskScheduler(tx);
      await assertTaskOperation(tx, installationId);
      const row = await owned(tx, id);
      await tx.$queryRaw`SELECT id FROM public.plugin_tasks WHERE id = ${id} AND "installationId" = ${installationId} FOR UPDATE`;
      if (['PENDING', 'RUNNING'].includes(row.status)) await transitionTask(tx, row, 'CANCEL', 'EXPLICIT_CANCEL');
      const suppressed = await tx.pluginTaskFinalFailure.updateMany({ where: { taskId: id, status: 'PENDING' }, data: { status: 'SUPPRESSED', suppressionReason: 'EXPLICIT_CANCEL', finishedAt: await taskDatabaseTime(tx) } });
      if (suppressed.count) await AuditService.write(tx, { actorId: scopes.getStore()?.actorId ?? 'system', action: 'PLUGIN_TASK_FINAL_FAILURE_SUPPRESSED', targetType: 'plugin-task', targetId: id, summary: { installationId, reason:'EXPLICIT_CANCEL' } });
      return taskStatus(tx, await owned(tx, id));
    }),
  };
}

/**
 * The state machine of a task transition, applied to a set of tasks.
 *
 * The writes are set-based: the tasks that end in the same state are written
 * with one statement per table, so a transition of an installation with many
 * tasks costs a fixed number of statements instead of a statement per task.
 * The audit stays one event per cancelled task, because the audit outlet
 * writes one event per call.
 */
async function transitionTaskRows(tx: TaskTransaction, rows: PluginTask[], mode: 'PAUSE' | 'UPDATE' | 'CANCEL', reason: string): Promise<void> {
  const now = await taskDatabaseTime(tx);
  const running = rows.filter(row => row.status === 'RUNNING');
  if (running.length) {
    const ids = running.map(row => row.id);
    await tx.pluginTaskAttempt.updateMany({ where: { taskId: { in: ids }, finishedAt: null }, data: { finishedAt: now, outcome: mode === 'PAUSE' ? 'PAUSE_ABORT' : mode === 'UPDATE' ? 'UPDATE_ABORT' : 'CANCELLED' } });
    await tx.pluginTaskExecutionSlot.updateMany({ where: { taskId: { in: ids }, kind: 'TASK', state: 'ACTIVE' }, data: { state: 'LINGERING' } });
  }
  for (const status of ['PENDING', 'RUNNING'] as const) {
    const group = rows.filter(row => row.status === status);
    if (!group.length) continue;
    await tx.pluginTask.updateMany({ where: { id: { in: group.map(row => row.id) } }, data: mode === 'CANCEL'
      ? { status: 'CANCELLED', claimToken: null, claimedByBootNonce: null, leaseUntil: null, deadlineAt: null, previousState: status, cancellationReason: reason, cancelRequestedAt: now, finishedAt: now }
      : { status: 'PENDING', claimToken: null, claimedByBootNonce: null, leaseUntil: null, deadlineAt: null, pauseReason: mode === 'PAUSE' ? reason : null, pausedAt: mode === 'PAUSE' ? now : null } });
    if (mode !== 'CANCEL') continue;
    for (const row of group) await AuditService.write(tx, { actorId: scopes.getStore()?.actorId ?? 'system', action: 'PLUGIN_TASK_CANCELLED', targetType: 'plugin-task', targetId: row.id, summary: { installationId: row.installationId, previousState: row.status, reason } });
  }
}
export async function transitionTask(tx: TaskTransaction, task: PluginTask, mode: 'PAUSE' | 'UPDATE' | 'CANCEL', reason: string): Promise<void> {
  await transitionTaskRows(tx, [task], mode, reason);
}
export async function transitionInstallationTasks(tx: TaskTransaction, installationId: string, mode: 'PAUSE' | 'UPDATE' | 'CANCEL', reason: string, declarations?: readonly PluginTaskDeclaration[]): Promise<void> {
  // The transition stays atomic in the transaction of the caller. It reads the
  // tasks of the installation once and writes them with set-based statements,
  // so the transaction covers a bounded number of tasks with a fixed number
  // of statements. The bound is loud: an installation with more active tasks
  // than the limit fails the transition with a limit conflict instead of
  // opening a transaction across an unbounded amount of work.
  const rows = await tx.pluginTask.findMany({ where: { installationId, status: { in: ['PENDING', 'RUNNING'] } }, orderBy: { id: 'asc' }, take: TASK_TRANSITION_LIMIT + 1 });
  if (rows.length > TASK_TRANSITION_LIMIT) throw new ApiError('PLUGIN_TASK_LIMIT_CONFLICT', { installationId, limit: TASK_TRANSITION_LIMIT, tasks: rows.length });
  // An update cancels the tasks whose handler is gone, so the tasks are
  // grouped by the state they end in.
  const groups = new Map<string, { mode: 'PAUSE' | 'UPDATE' | 'CANCEL'; reason: string; rows: PluginTask[] }>();
  for (const row of rows) {
    const next = declarations?.find(d => d.name === row.name && d.version === row.version);
    if (mode === 'UPDATE' && next && (row.maxAttempts > next.maxAttempts || row.maxRuntimeSeconds > next.maxRuntimeSeconds || row.declaredConcurrency > next.concurrency)) throw new ApiError('PLUGIN_TASK_LIMIT_CONFLICT', { taskId: row.id });
    const effective = mode === 'UPDATE' && !next ? 'CANCEL' : mode;
    const effectiveReason = mode === 'UPDATE' && !next ? 'HANDLER_REMOVED' : reason;
    const key = `${effective}|${effectiveReason}`;
    const group = groups.get(key) ?? { mode: effective, reason: effectiveReason, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) await transitionTaskRows(tx, group.rows, group.mode, group.reason);
  // The final-failure hooks of the installation end in the same two states,
  // so they are written with the same set-based statements.
  const hooks = await tx.pluginTaskFinalFailure.findMany({ where: { task: { installationId }, status: { in: ['PENDING', 'RUNNING'] } } });
  const runningHooks: string[] = [], suppressedHooks: string[] = [];
  for (const hook of hooks) {
    const nextHook = declarations?.find(d => d.name === hook.name && d.version === hook.version)?.onFinalFailure;
    if (mode === 'UPDATE' && nextHook && hook.maxRuntimeSeconds > nextHook.maxRuntimeSeconds) throw new ApiError('PLUGIN_TASK_LIMIT_CONFLICT', { taskId: hook.taskId });
    const keep = mode === 'PAUSE' || mode === 'UPDATE' && declarations?.some(d => d.name === hook.name && d.version === hook.version && d.onFinalFailure);
    if (hook.status === 'RUNNING') runningHooks.push(hook.taskId);
    else if (!keep) suppressedHooks.push(hook.taskId);
  }
  const now = await taskDatabaseTime(tx);
  if (runningHooks.length) await tx.pluginTaskFinalFailure.updateMany({ where: { taskId: { in: runningHooks } }, data: { status: 'UNKNOWN', suppressionReason: null, safeError: { code: 'PLUGIN_TASK_CLAIM_LOST', message: 'Final-failure hook was revoked by a lifecycle change.' }, claimToken: null, leaseUntil: null, deadlineAt: null, finishedAt: now } });
  if (suppressedHooks.length) await tx.pluginTaskFinalFailure.updateMany({ where: { taskId: { in: suppressedHooks } }, data: { status: 'SUPPRESSED', suppressionReason: reason, claimToken: null, leaseUntil: null, deadlineAt: null, finishedAt: now } });
  const lingering = [...runningHooks, ...suppressedHooks];
  if (lingering.length) await tx.pluginTaskExecutionSlot.updateMany({ where: { taskId: { in: lingering }, kind: 'FINAL_FAILURE', state: 'ACTIVE' }, data: { state: 'LINGERING' } });
}
