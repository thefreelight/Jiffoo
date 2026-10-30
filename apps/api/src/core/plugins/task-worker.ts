import { randomUUID } from 'node:crypto';
import type { PluginTaskDeclaration, TaskInput } from '@jiffoo/shared';
import { Prisma, type PluginTask as StoredTask, type PluginTaskFinalFailure } from '@prisma/client';
import { prisma } from '@/config/database';
import { ensureCoreProcess, confirmDeadCoreProcesses, coreProcessSuspectMs } from '@/infra/core-process';
import { ApiError } from '@/utils/api-errors';
import { recordPluginFailure, redactPluginFailure } from '@/core/extensions/runtime/failure';
import { AuditService } from '@/core/audit/service';
import { assertTaskClaim, assertTaskPolicy, DEFAULT_TASK_POLICY, lockTaskScheduler, occupiedTaskSlots, principalForTask, staleTaskSlotMs, taskDatabaseTime, taskJson, transitionInstallationTasks, validateTaskPrincipal, withTaskScope, type TaskClaim, type TaskPolicy, type TaskTransaction } from './tasks';

const RETRIES = [60_000, 300_000, 900_000, 3_600_000];
/**
 * The share of the retry ladder that a delay may jitter by.
 *
 * A fleet of workers that failed at the same moment retries at the same
 * moment without a jitter, so every delay spreads over a bounded share of
 * its ladder value.
 */
const RETRY_JITTER_RATIO = 0.2;

/**
 * The delay before the next attempt of a failed task.
 *
 * The ladder itself stays fixed, and the delay is the ladder value plus a
 * bounded random jitter of up to a fifth of it. The random source is a
 * parameter, so the spread is testable without a seed.
 */
export function retryDelayMs(base: number, random: () => number = Math.random): number {
  return base + Math.floor(random() * base * RETRY_JITTER_RATIO);
}

/** The number of candidates one claim round keeps in flight. */
const MAX_CLAIM_CANDIDATES = 32;
/** The number of installations one recovery transaction covers. */
const RECOVERY_INSTALLATION_BATCH = 10;
/** The number of running tasks one recovery statement covers. */
const RECOVERY_TASK_BATCH = 50;
/**
 * The number of tasks one recovery transaction covers.
 *
 * The recovery of the expired claims transitions the tasks of an
 * installation, and a transition is one atomic state machine. The budget
 * bounds the number of tasks one recovery transaction touches, so the
 * recovery never opens a transaction across an unbounded amount of work. An
 * installation that does not fit in the budget is left to the next
 * transaction.
 */
const RECOVERY_TASK_BUDGET = 1000;

/** A task that only an active and matching principal may run. */
function principalEligible(): Prisma.Sql {
  return Prisma.sql`(t."principalId" IS NULL OR EXISTS(SELECT 1 FROM public.users u JOIN public.plugin_principals r ON r."principalId"=u.id AND r."installationId"=t."installationId" AND r."principalType"=t."principalType" WHERE u.id=t."principalId" AND u."isActive" AND u."removedAt" IS NULL AND ((t."principalType"='CUSTOMER' AND u.role='USER') OR (t."principalType"='ADMIN' AND u.role='ADMIN'))))`;
}

/** One candidate of the claim scan: the task that a claim transaction locks. */
type ClaimCandidate = { installationId: string; taskId: string; hook: boolean };
/** One installation of the recovery, with the plugin it belongs to. */
type RecoveryInstallation = Prisma.PluginInstallationGetPayload<{ include: { plugin: true } }>;
function permanentTaskError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && error.name === 'TaskPermanentError' && 'code' in error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) && error.message.length > 0 && error.message.length <= 512 && !/[<>\u0000-\u001f]/.test(error.message);
}
type Executor = (claim: TaskClaim, input: TaskInput) => Promise<unknown>;
type WorkerOptions = { installationIds?: string[]; execute?: Executor; leaseMs?: number; renewalMs?: number; retryMs?: number[]; beforeLingeringWrite?: () => Promise<void> };

/**
 * The release of the slots that stopped being observed.
 *
 * The observation of a slot is written every ten seconds while its
 * invocation lives, so a slot that was not observed for twice the runtime of
 * a task cannot belong to a running invocation any more. That is the case of
 * a handler that never settles: the slot stays occupied and consumes the
 * global slot cap until the sweep releases it.
 *
 * A slot whose owner is alive and whose task is still within its deadline
 * keeps its occupancy, because that invocation is still running. The write
 * happens on the transaction of the caller, so it stays atomic with the rest
 * of the recovery.
 */
async function releaseStaleTaskSlots(tx: TaskTransaction, policy: TaskPolicy, now: Date): Promise<void> {
  const staleMs = staleTaskSlotMs(policy);
  await tx.$executeRaw`UPDATE public.plugin_task_execution_slots s SET state = 'RELEASED', "releasedAt" = ${now}, "updatedAt" = clock_timestamp() WHERE s.state IN (${Prisma.join(occupiedTaskSlots)}) AND s."lastObservedAt" < ${now} - ${staleMs} * interval '1 millisecond' AND NOT EXISTS (SELECT 1 FROM public.core_processes p WHERE p."bootNonce" = s."bootNonce" AND p.state IN ('LIVE','DRAINING') AND COALESCE(CASE WHEN s.kind = 'FINAL_FAILURE' THEN (SELECT h."deadlineAt" FROM public.plugin_task_final_failures h WHERE h."taskId" = s."taskId") ELSE (SELECT t."deadlineAt" FROM public.plugin_tasks t WHERE t.id = s."taskId") END, 'epoch'::timestamptz) > ${now})`;
}
export class PluginTaskWorker {
  private stopping = false;
  private abandoning = false;
  private readonly pending = new Map<string, { claim: TaskClaim; controller: AbortController; work: Promise<void> }>();
  private readonly settledSlots = new Set<string>();
  private timer?: NodeJS.Timeout;
  private poll?: Promise<void>;
  constructor(private readonly options: WorkerOptions = {}) {
    if (['leaseMs','renewalMs','retryMs','execute','beforeLingeringWrite'].some(key=>Object.hasOwn(options,key)) && process.env.NODE_ENV !== 'test') throw new Error('Task worker test controls require NODE_ENV=test');
    if (options.leaseMs !== undefined && (!Number.isInteger(options.leaseMs) || options.leaseMs < 1 || options.leaseMs > 60_000)
      || options.renewalMs !== undefined && (!Number.isInteger(options.renewalMs) || options.renewalMs < 1 || options.renewalMs > 15_000)
      || options.retryMs !== undefined && (!options.retryMs.length || options.retryMs.length > 20 || options.retryMs.some(ms=>!Number.isInteger(ms) || ms < 0 || ms > 3_600_000))) throw new Error('Invalid task worker test controls');
  }
  unsettled() { return [...this.pending.values()].map(({ claim }) => ({ kind: claim.hook ? 'plugin-task-final-failure' : 'plugin-task', id: claim.task.id })); }
  /** The retry ladder of this worker: the shared ladder or the test control. */
  private retryLadder(): number[] { return this.options.retryMs ?? RETRIES; }
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick().catch(error => console.error('Plugin task poll failed', error instanceof Error ? error.name : 'UnknownError')); }, 250);
  }
  stopClaiming(): void { this.stopping = true; clearInterval(this.timer); this.timer = undefined; }
  async drain(): Promise<void> { this.stopClaiming(); await this.poll; while (this.pending.size) await Promise.allSettled([...this.pending.values()].map(p => p.work)); await this.releaseSettledSlots(); }
  abandon(): void { this.abandoning = true; this.stopClaiming(); for (const p of this.pending.values()) p.controller.abort(); }
  async tick(): Promise<void> {
    if (this.stopping) return;
    if (this.poll) return this.poll;
    this.poll = (async () => {
      await this.releaseSettledSlots();
      await this.recover();
      await Promise.all([...this.pending.values()].filter(p => !p.controller.signal.aborted).map(async p => {
        try { await prisma.$transaction(tx => assertTaskClaim(tx, p.claim)); }
        catch { p.controller.abort(); }
      }));
      for (let count = 0; count < 256 && !this.stopping; count++) {
        const claim = await this.claim();
        if (!claim) break;
        const controller = new AbortController();
        const work = Promise.resolve().then(() => this.execute(claim, controller));
        this.pending.set(claim.slotId, { claim, controller, work });
        void work.finally(() => this.pending.delete(claim.slotId)).catch(error => console.error('Plugin task execution failed', error instanceof Error ? error.name : 'UnknownError'));
      }
    })().finally(() => { this.poll = undefined; });
    return this.poll;
  }
  private async releaseSettledSlots(): Promise<void> {
    const ids = [...this.settledSlots];
    if (!ids.length) return;
    await prisma.$executeRaw`UPDATE public.plugin_task_execution_slots SET state = 'RELEASED', "releasedAt" = clock_timestamp(), "updatedAt" = clock_timestamp() WHERE id IN (${Prisma.join(ids)}) AND state IN ('ACTIVE','LINGERING')`;
    for (const id of ids) this.settledSlots.delete(id);
  }
  /**
   * The candidate scan runs outside of every locking transaction.
   *
   * The scan only reads, so it never holds a row lock and never keeps the
   * scheduler lock while it walks the installations. The claim transaction
   * locks the candidate again and re-checks every condition, so a stale
   * candidate is skipped instead of claimed.
   */
  private async scanCandidates(): Promise<ClaimCandidate[]> {
    const scheduler = await prisma.pluginTaskScheduler.findUnique({ where: { id: 'singleton' } });
    const policy = (scheduler?.policy as TaskPolicy | undefined) ?? DEFAULT_TASK_POLICY;
    const slots = await prisma.pluginTaskExecutionSlot.findMany({ where: { state: { in: occupiedTaskSlots } } });
    if (slots.length >= policy.globalSlots) return [];
    const installations = await prisma.$queryRaw<Array<{ id: string }>>`SELECT i.id FROM public.plugin_installations i JOIN public.plugin_installs p ON p.slug = i."pluginSlug" LEFT JOIN public.plugin_task_fairness f ON f."installationId" = i.id WHERE i.enabled AND i."deletedAt" IS NULL AND p."deletedAt" IS NULL AND NOT i."taskDependencyUnavailable" ORDER BY coalesce(f."lastServedSequence",0), i.id`;
    const candidates: ClaimCandidate[] = [];
    for (const candidate of installations) {
      if (this.options.installationIds && !this.options.installationIds.includes(candidate.id) || slots.filter(s => s.installationId === candidate.id).length >= policy.installationSlots) continue;
      const installation = await prisma.pluginInstallation.findUnique({ where: { id: candidate.id }, include: { plugin: true } });
      if (!installation) continue;
      if (await prisma.pluginMigrationOperation.findFirst({ where: { slug: installation.pluginSlug, phase: { in: ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'] } }, select: { id: true } })) continue;
      const declarations = (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks ?? [];
      const tasks = await prisma.$queryRaw<StoredTask[]>`SELECT * FROM public.plugin_tasks WHERE id IN (SELECT DISTINCT ON (t.name,t.version) t.id FROM public.plugin_tasks t WHERE t."installationId" = ${candidate.id} AND t.status = 'PENDING' AND t."nextAttemptAt" <= clock_timestamp() AND ${principalEligible()} ORDER BY t.name,t.version,t."nextAttemptAt",t.id) ORDER BY "nextAttemptAt", id`;
      const hookIds = await prisma.$queryRaw<Array<{ taskId: string }>>`SELECT h."taskId" FROM public.plugin_task_final_failures h WHERE h."taskId" IN (SELECT DISTINCT ON (c.name,c.version) c."taskId" FROM public.plugin_task_final_failures c JOIN public.plugin_tasks t ON t.id=c."taskId" WHERE t."installationId"=${candidate.id} AND c.status='PENDING' AND ${principalEligible()} AND NOT EXISTS(SELECT 1 FROM public.plugin_task_execution_slots s WHERE s."taskId"=t.id AND s.kind='TASK' AND s.state IN ('ACTIVE','LINGERING')) ORDER BY c.name,c.version,c."createdAt",c."taskId") ORDER BY h."createdAt",h."taskId"`;
      const hooks = hookIds.length ? await prisma.pluginTaskFinalFailure.findMany({ where: { taskId: { in: hookIds.map(h => h.taskId) } }, orderBy: { createdAt: 'asc' }, include: { task: true } }) : [];
      const due = [...tasks.map(task => ({ task, hook: null as typeof hooks[number] | null, at: task.nextAttemptAt })), ...hooks.filter(h => !slots.some(s => s.taskId === h.taskId && s.kind === 'TASK')).map(hook => ({ task: hook.task, hook, at: hook.createdAt }))].sort((a, b) => a.at.getTime() - b.at.getTime() || a.task.id.localeCompare(b.task.id));
      for (const item of due) {
        const declaration = declarations.find(d => d.name === item.task.name && d.version === item.task.version);
        if (!declaration || item.hook && !declaration.onFinalFailure) continue;
        try { assertTaskPolicy([declaration], policy); } catch { continue; }
        if (item.task.maxAttempts > declaration.maxAttempts || item.task.maxRuntimeSeconds > declaration.maxRuntimeSeconds || item.task.declaredConcurrency > declaration.concurrency) continue;
        if (slots.filter(s => s.installationId === candidate.id && s.name === declaration.name && s.version === declaration.version).length >= Math.min(item.task.declaredConcurrency, declaration.concurrency)) continue;
        candidates.push({ installationId: candidate.id, taskId: item.task.id, hook: Boolean(item.hook) });
        if (candidates.length >= MAX_CLAIM_CANDIDATES) return candidates;
      }
    }
    return candidates;
  }
  /**
   * The atomic claim of one candidate.
   *
   * Only the claim itself runs in the locking transaction: the row lock, the
   * fence, the claim token and the slot are written by the same transaction,
   * and the settle time re-check of the status, the claim token and the fence
   * stays unchanged.
   */
  private async claimCandidate(tx: TaskTransaction, candidate: ClaimCandidate, bootNonce: string): Promise<TaskClaim | null> {
    const scheduler = await lockTaskScheduler(tx);
    const slots = await tx.pluginTaskExecutionSlot.findMany({ where: { state: { in: occupiedTaskSlots } } });
    if (slots.length >= scheduler.policy.globalSlots) return null;
    if (this.options.installationIds && !this.options.installationIds.includes(candidate.installationId)) return null;
    if (slots.filter(s => s.installationId === candidate.installationId).length >= scheduler.policy.installationSlots) return null;
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${candidate.installationId} FOR UPDATE`;
    const installation = await tx.pluginInstallation.findUniqueOrThrow({ where: { id: candidate.installationId }, include: { plugin: true } });
    if (!installation.enabled || installation.deletedAt || installation.plugin.deletedAt || installation.taskDependencyUnavailable) return null;
    if (await tx.pluginMigrationOperation.findFirst({ where: { slug: installation.pluginSlug, phase: { in: ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'] } }, select: { id: true } })) return null;
    const declarations = (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks ?? [];
    let task: StoredTask;
    let hook: (PluginTaskFinalFailure & { task: StoredTask }) | null = null;
    if (candidate.hook) {
      const locked = await tx.$queryRaw<Array<{ taskId: string }>>`SELECT h."taskId" FROM public.plugin_task_final_failures h JOIN public.plugin_tasks t ON t.id=h."taskId" WHERE h."taskId"=${candidate.taskId} AND h.status='PENDING' AND ${principalEligible()} AND NOT EXISTS(SELECT 1 FROM public.plugin_task_execution_slots s WHERE s."taskId"=t.id AND s.kind='TASK' AND s.state IN ('ACTIVE','LINGERING')) FOR UPDATE OF h SKIP LOCKED`;
      if (!locked.length) return null;
      hook = await tx.pluginTaskFinalFailure.findFirstOrThrow({ where: { taskId: candidate.taskId }, include: { task: true } });
      task = hook.task;
    } else {
      const locked = await tx.$queryRaw<StoredTask[]>`SELECT t.* FROM public.plugin_tasks t WHERE t.id=${candidate.taskId} AND t.status='PENDING' AND t."nextAttemptAt" <= clock_timestamp() AND ${principalEligible()} FOR UPDATE SKIP LOCKED`;
      if (!locked.length) return null;
      task = locked[0];
    }
    const declaration = declarations.find(d => d.name === task.name && d.version === task.version);
    if (!declaration || hook && !declaration.onFinalFailure) return null;
    try { assertTaskPolicy([declaration], scheduler.policy); } catch { return null; }
    if (task.maxAttempts > declaration.maxAttempts || task.maxRuntimeSeconds > declaration.maxRuntimeSeconds || task.declaredConcurrency > declaration.concurrency) return null;
    if (slots.filter(s => s.installationId === candidate.installationId && s.name === declaration.name && s.version === declaration.version).length >= Math.min(task.declaredConcurrency, declaration.concurrency)) return null;
    try { await validateTaskPrincipal(tx, candidate.installationId, principalForTask(task)); }
    catch { await tx.pluginTask.update({ where: { id: task.id }, data: { lastError: { code: 'PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED', message: 'The bound principal is no longer active for this installation.' } } }); return null; }
    const now = await taskDatabaseTime(tx);
    const claimId = randomUUID();
    const fence = hook ? hook.fence + 1n : task.fence + 1n;
    const runtime = hook?.maxRuntimeSeconds ?? task.maxRuntimeSeconds;
    if (hook && runtime > scheduler.policy.hookSeconds) return null;
    const deadlineAt = new Date(now.getTime() + runtime * 1000);
    const leaseUntil = new Date(Math.min(deadlineAt.getTime(), now.getTime() + (this.options.leaseMs ?? 60_000)));
    if (hook) await tx.pluginTaskFinalFailure.update({ where: { taskId: task.id }, data: { status: 'RUNNING', claimToken: claimId, fence, bootNonce, zipHash: installation.plugin.zipHash, generation: installation.protectionGeneration, leaseUntil, deadlineAt, startedAt: now } });
    else {
      await tx.pluginTask.update({ where: { id: task.id }, data: { status: 'RUNNING', claimToken: claimId, fence, claimedByBootNonce: bootNonce, zipHash: installation.plugin.zipHash, generation: installation.protectionGeneration, leaseUntil, deadlineAt, executionSequence: { increment: 1 }, startedAt: now, pauseReason: null, pausedAt: null } });
      await tx.pluginTaskAttempt.create({ data: { taskId: task.id, executionSequence: task.executionSequence + 1, chargedAttempt: task.attemptsCharged + 1, claimToken: claimId, fence, bootNonce, startedAt: now } });
    }
    const slot = await tx.pluginTaskExecutionSlot.create({ data: { installationId: candidate.installationId, taskId: task.id, kind: hook ? 'FINAL_FAILURE' : 'TASK', name: task.name, version: task.version, claimToken: claimId, fence, bootNonce, lastObservedAt: now } });
    const sequence = scheduler.roundSequence + 1n;
    await tx.pluginTaskScheduler.update({ where: { id: 'singleton' }, data: { roundSequence: sequence } });
    await tx.pluginTaskFairness.upsert({ where: { installationId: candidate.installationId }, create: { installationId: candidate.installationId, lastServedSequence: sequence }, update: { lastServedSequence: sequence } });
    return { task: await tx.pluginTask.findUniqueOrThrow({ where: { id: task.id } }), hook: hook ? await tx.pluginTaskFinalFailure.findUniqueOrThrow({ where: { taskId: task.id } }) : null, claimId, fence, generation: installation.protectionGeneration, zipHash: installation.plugin.zipHash!, bootNonce, deadlineAt, slotId: slot.id };
  }
  private async claim(): Promise<TaskClaim | null> {
    const bootNonce = await ensureCoreProcess('worker');
    const candidates = await this.scanCandidates();
    for (const candidate of candidates) {
      const claim = await prisma.$transaction(async tx => this.claimCandidate(tx, candidate, bootNonce));
      if (claim) return claim;
    }
    return null;
  }
  private async heartbeat(claim: TaskClaim, progress?: unknown): Promise<void> {
    await prisma.$transaction(async tx => {
      await assertTaskClaim(tx, claim);
      if (progress !== undefined && !claim.hook) await tx.pluginTask.update({ where: { id: claim.task.id }, data: { progress: taskJson(progress) } });
    });
  }
  private async renew(claim: TaskClaim): Promise<void> {
    await prisma.$transaction(async tx => {
      await assertTaskClaim(tx, claim);
      const now = await taskDatabaseTime(tx);
      const leaseUntil = new Date(Math.min(claim.deadlineAt.getTime(), now.getTime() + (this.options.leaseMs ?? 60_000)));
      if (claim.hook) await tx.pluginTaskFinalFailure.update({ where: { taskId: claim.task.id }, data: { leaseUntil } });
      else await tx.pluginTask.update({ where: { id: claim.task.id }, data: { leaseUntil } });
      console.info(JSON.stringify({ event: 'plugin_task_lease_renewed', taskId: claim.task.id, claimId: claim.claimId, fence: claim.fence.toString(), leaseUntil: leaseUntil.toISOString() }));
    });
  }
  private async execute(claim: TaskClaim, controller: AbortController): Promise<void> {
    let renewing: Promise<unknown> | undefined;
    const timer = setInterval(() => {
      if (renewing) return;
      renewing = this.renew(claim).catch(() => controller.abort()).finally(() => { renewing = undefined; });
    }, this.options.renewalMs ?? 15_000);
    const occupancy = setInterval(() => { void prisma.$executeRaw`UPDATE public.plugin_task_execution_slots SET "lastObservedAt" = clock_timestamp(), "updatedAt" = clock_timestamp() WHERE id = ${claim.slotId} AND state IN ('ACTIVE','LINGERING')`.catch(() => undefined); }, 10_000);
    const scope = { installationId: claim.task.installationId, generation: claim.generation, zipHash: claim.zipHash, request: false, principal: principalForTask(claim.task), actorId: `task:${claim.task.id}:${claim.claimId}`, signal: controller.signal, claim };
    let invocationOpen = true;
    const invocation = withTaskScope(scope, async () => {
      await prisma.$transaction(tx => assertTaskClaim(tx, claim));
      console.info(JSON.stringify({ event: 'plugin_task_started', taskId: claim.task.id, installationId: claim.task.installationId, claimId: claim.claimId, fence: claim.fence.toString(), kind: claim.hook ? 'FINAL_FAILURE' : 'TASK' }));
      const input: TaskInput = { taskId: claim.task.id, payload: claim.task.payload as TaskInput['payload'], idempotencyKey: claim.task.idempotencyKey, attempt: claim.task.attemptsCharged + (claim.hook ? 0 : 1), isFinalAttempt: claim.task.attemptsCharged + 1 === claim.task.maxAttempts, claimId: claim.claimId, fence: claim.fence.toString(), principal: scope.principal, signal: controller.signal, heartbeat: progress => invocationOpen && !controller.signal.aborted ? this.heartbeat(claim, progress) : Promise.reject(new ApiError('PLUGIN_TASK_CLAIM_LOST')) };
      return this.options.execute ? this.options.execute(claim, input) : (await import('@/core/extensions/runtime/plugin-runtime')).invokePluginTask(claim, input);
    }).finally(()=>{invocationOpen=false;});
    void invocation.catch(()=>undefined);
    let timeout: NodeJS.Timeout | undefined;
    let watchingDeadline = true;
    const deadline = new Promise<never>((_resolve, reject) => {
      const expire = async () => {
        try {
          const now = await prisma.$transaction(taskDatabaseTime);
          if (!watchingDeadline) return;
          const remaining = claim.deadlineAt.getTime() - now.getTime();
          if (remaining > 0) { timeout = setTimeout(() => { void expire(); }, remaining); return; }
          reject(new ApiError('PLUGIN_TIMEOUT')); controller.abort();
        } catch { if (watchingDeadline) { reject(new ApiError('DATABASE_UNAVAILABLE')); controller.abort(); } }
      };
      void expire();
    });
    const aborted = new Promise<never>((_resolve, reject) => controller.signal.addEventListener('abort', () => reject(new ApiError('PLUGIN_TASK_CLAIM_LOST')), { once: true }));
    try {
      const result = await Promise.race([invocation, deadline, aborted]);
      if (!this.abandoning) await this.settle(claim, null, result);
    } catch (error) {
      if (!this.abandoning) await this.settle(claim, error, undefined, true).catch(() => undefined);
    } finally {
      // The occupancy observation stops when the invocation leaves the race.
      // A handler that never settles must not keep its slot observed, or the
      // sweep could never reclaim the slot it holds forever.
      watchingDeadline = false; clearTimeout(timeout); clearInterval(timer); clearInterval(occupancy); await renewing;
      await Promise.resolve().then(()=>this.options.beforeLingeringWrite?.()).then(()=>prisma.pluginTaskExecutionSlot.updateMany({ where: { id: claim.slotId, state: 'ACTIVE' }, data: { state: 'LINGERING' } })).catch(() => undefined);
      // Slot release follows actual settlement, never the outward timeout.
      await invocation.catch(() => undefined);
      this.settledSlots.add(claim.slotId);
      await this.releaseSettledSlots().catch(() => undefined);
    }
  }
  private async settle(claim: TaskClaim, error: unknown, result?: unknown, failure = false): Promise<void> {
    const owner = await prisma.pluginInstallation.findUnique({ where: { id: claim.task.installationId } });
    const safe = failure ? { code: permanentTaskError(error) ? error.code : error instanceof ApiError ? error.code : 'PLUGIN_ERROR', message: permanentTaskError(error) ? (await redactPluginFailure(owner?.pluginSlug ?? '', error, claim.task.installationId)).slice(0, 512) : error instanceof ApiError ? error.message : 'Plugin task handler failed.' } : null;
    await prisma.$transaction(async tx => {
      await lockTaskScheduler(tx);
      const installation = await tx.pluginInstallation.findUnique({ where: { id: claim.task.installationId }, include: { plugin: true } });
      if (!installation) return;
      if (!installation.enabled || installation.deletedAt || installation.plugin.deletedAt || installation.taskDependencyUnavailable || error instanceof ApiError && error.code === 'PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE') {
        await transitionInstallationTasks(tx, installation.id, installation.deletedAt || installation.plugin.deletedAt ? 'CANCEL' : 'PAUSE', installation.taskDependencyUnavailable || error instanceof ApiError && error.code === 'PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE' ? 'dependency-unavailable' : 'plugin-disabled');
        if (error instanceof ApiError && error.code === 'PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE') {
          const now = await taskDatabaseTime(tx);
          const suggested = (error.safeDetails as { retryAfterSeconds?: unknown })?.retryAfterSeconds;
          const seconds = typeof suggested === 'number' && Number.isSafeInteger(suggested) && suggested >= 5 && Number.isFinite(new Date(now.getTime()+suggested*1000).getTime()) ? suggested : 5;
          await tx.pluginTask.updateMany({ where: { id: claim.task.id, status: 'PENDING' }, data: { nextAttemptAt: new Date(now.getTime() + seconds * 1000) } });
        }
        return;
      }
      const task = await tx.pluginTask.findUniqueOrThrow({ where: { id: claim.task.id } });
      const row = claim.hook ? await tx.pluginTaskFinalFailure.findUnique({ where: { taskId: task.id } }) : task;
      if (row?.status !== 'RUNNING' || row.claimToken !== claim.claimId || row.fence !== claim.fence) return;
      if (installation.protectionGeneration !== claim.generation || installation.plugin.zipHash !== claim.zipHash) {
        await transitionInstallationTasks(tx, installation.id, 'UPDATE', 'PACKAGE_UPDATED', (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks ?? []); return;
      }
      const now = await taskDatabaseTime(tx);
      if (row.leaseUntil && row.leaseUntil <= now && now < claim.deadlineAt) return;
      if (claim.hook) {
        await tx.pluginTaskFinalFailure.update({ where: { taskId: task.id }, data: { status: now >= claim.deadlineAt || error instanceof ApiError && ['PLUGIN_TIMEOUT', 'PLUGIN_TASK_CLAIM_LOST', 'DATABASE_UNAVAILABLE', 'PLUGIN_DATABASE_OUTCOME_UNKNOWN'].includes(error.code) ? 'UNKNOWN' : failure ? 'FAILED' : 'SUCCEEDED', safeError: safe ?? undefined, finishedAt: now, claimToken: null, leaseUntil: null, deadlineAt: null } });
      } else {
        const permanent = permanentTaskError(error);
        const timeout = now >= claim.deadlineAt;
        const failed = failure || timeout;
        if (!failed) await assertTaskClaim(tx, claim);
        const charged = task.attemptsCharged + 1;
        const terminal = failed && (permanent || charged >= task.maxAttempts);
        await tx.pluginTaskAttempt.update({ where: { taskId_executionSequence: { taskId: task.id, executionSequence: task.executionSequence } }, data: { finishedAt: now, outcome: permanent ? 'PERMANENT_ERROR' : timeout ? 'TIMED_OUT' : failed ? 'FAILED' : 'SUCCEEDED', safeError: safe ?? undefined } });
        await tx.pluginTask.update({ where: { id: task.id }, data: { status: failed ? terminal ? 'FAILED' : 'PENDING' : 'SUCCEEDED', attemptsCharged: charged, result: failed || result === undefined ? undefined : taskJson(result), lastError: safe ?? undefined, nextAttemptAt: failed && !terminal ? new Date(now.getTime() + retryDelayMs(this.retryLadder()[Math.min(charged - 1, this.retryLadder().length - 1)])) : task.nextAttemptAt, finishedAt: !failed || terminal ? now : null, claimToken: null, claimedByBootNonce: null, leaseUntil: null, deadlineAt: null } });
        if (terminal) await createFinalFailure(tx, task);
      }
    });
    if (failure) {
      const installation = await prisma.pluginInstallation.findUnique({ where: { id: claim.task.installationId } });
      if (installation) await recordPluginFailure(installation.pluginSlug, new Error(`Task execution failed: ${safe!.code}`), claim.hook ? 'task-final-failure' : 'task', installation.id);
    }
  }
  /**
   * The recovery of one installation.
   *
   * The expired claims of the installation are settled and its tasks are
   * transitioned when the plugin is disabled or being replaced. The work
   * stays inside the transaction of the caller, so the recovery of an
   * installation is atomic.
   */
  private async recoverInstallation(tx: TaskTransaction, installation: RecoveryInstallation, now: Date, recovered: Array<{ slug: string; installationId: string }>): Promise<void> {
    if (!installation.enabled || installation.deletedAt || installation.plugin.deletedAt || installation.taskDependencyUnavailable) {
      await transitionInstallationTasks(tx, installation.id, installation.deletedAt || installation.plugin.deletedAt ? 'CANCEL' : 'PAUSE', installation.taskDependencyUnavailable ? 'dependency-unavailable' : 'plugin-disabled');
      return;
    }
    if (await tx.pluginMigrationOperation.findFirst({ where: { slug: installation.pluginSlug, phase: { in: ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'] } }, select: { id: true } })) {
      await transitionInstallationTasks(tx, installation.id, 'UPDATE', 'PACKAGE_UPDATING', (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks ?? []);
      return;
    }
    let taskCursor: string | undefined;
    for (;;) {
      const running = await tx.pluginTask.findMany({ where: { installationId: installation.id, status: 'RUNNING', ...(taskCursor ? { id: { gt: taskCursor } } : {}) }, orderBy: { id: 'asc' }, take: RECOVERY_TASK_BATCH });
      if (!running.length) break;
      let replaced = false;
      for (const task of running) {
        if (task.generation !== installation.protectionGeneration || task.zipHash !== installation.plugin.zipHash) {
          await transitionInstallationTasks(tx, installation.id, 'UPDATE', 'PACKAGE_UPDATED', (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks ?? []);
          replaced = true; break;
        }
        if (task.leaseUntil && task.leaseUntil <= now) {
          const lastError = { code: 'PLUGIN_TIMEOUT', message: 'Plugin task lease expired.' };
          await tx.pluginTaskAttempt.updateMany({ where: { taskId: task.id, executionSequence: task.executionSequence, finishedAt: null }, data: { outcome: 'TIMED_OUT', finishedAt: now, safeError: lastError } });
          const charged = task.attemptsCharged + 1;
          await tx.pluginTask.update({ where: { id: task.id }, data: { status: charged >= task.maxAttempts ? 'FAILED' : 'PENDING', attemptsCharged: charged, lastError, claimToken: null, claimedByBootNonce: null, leaseUntil: null, deadlineAt: null, finishedAt: charged >= task.maxAttempts ? now : null, nextAttemptAt: new Date(now.getTime() + retryDelayMs(this.retryLadder()[Math.min(charged - 1, this.retryLadder().length - 1)])) } });
          recovered.push({ slug: installation.pluginSlug, installationId: installation.id });
          await tx.pluginTaskExecutionSlot.updateMany({ where: { taskId: task.id, kind: 'TASK', fence: task.fence, state: 'ACTIVE' }, data: { state: 'LINGERING' } });
          if (charged >= task.maxAttempts) await createFinalFailure(tx, task);
        }
      }
      if (replaced) break;
      taskCursor = running[running.length - 1].id;
      if (running.length < RECOVERY_TASK_BATCH) break;
    }
  }
  /**
   * The recovery of the expired claims.
   *
   * The recovery covers the installations in bounded batches, one
   * transaction per batch, and the tasks of a batch in a bounded budget. A
   * recovery of many installations therefore never holds one transaction
   * open for the whole sweep.
   */
  private async recover(): Promise<void> {
    const failures: Array<{ slug: string; installationId: string }> = [];
    let cursor: string | undefined;
    let firstBatch = true;
    for (;;) {
      const batch = await prisma.$transaction(async tx => {
        const scheduler = await lockTaskScheduler(tx);
        const now = await taskDatabaseTime(tx);
        if (firstBatch) {
          firstBatch = false;
          // A core process that was killed leaves its row in state LIVE, and
          // the execution slots it owns stay occupied until an operator
          // reclaims them by hand. The sweep confirms the death of every
          // process that stopped heartbeating, so the slots of a crashed
          // worker become reclaimable again.
          const suspectMs = coreProcessSuspectMs();
          const dead = await confirmDeadCoreProcesses(tx, suspectMs);
          for (const process of dead) {
            console.warn(JSON.stringify({ event: 'core_process_death_confirmed', bootNonce: process.bootNonce, kind: process.kind, suspectMs }));
            await AuditService.write(tx, { actorId: 'system', action: 'CORE_PROCESS_DEATH_CONFIRMED', targetType: 'core-process', targetId: process.bootNonce, summary: { bootNonce: process.bootNonce, kind: process.kind, suspectMs, heartbeatAt: process.heartbeatAt } });
          }
          await tx.pluginTaskFinalFailure.updateMany({ where: { status: 'RUNNING', leaseUntil: { lte: now }, ...(this.options.installationIds ? { task:{installationId:{in:this.options.installationIds}} } : {}) }, data: { status: 'UNKNOWN', safeError: { code:'PLUGIN_TIMEOUT',message:'Final-failure hook outcome is unknown after lease expiry.' }, claimToken: null, leaseUntil: null, deadlineAt: null, finishedAt: now } });
        }
        await tx.pluginTaskExecutionSlot.updateMany({ where: { state: { in: occupiedTaskSlots }, owner: { state: { in: ['DEAD_CONFIRMED', 'QUIESCENT'] } } }, data: { state: 'RELEASED', releasedAt: now } });
        // A slot that stopped being observed is stale, whatever the state of
        // its owner: its invocation is gone, or its handler never settles.
        await releaseStaleTaskSlots(tx, scheduler.policy, now);
        const installations = await tx.pluginInstallation.findMany({ where: this.options.installationIds ? { id: { in: this.options.installationIds } } : {}, include: { plugin: true }, orderBy: { id: 'asc' }, take: RECOVERY_INSTALLATION_BATCH + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        const page = installations.slice(0, RECOVERY_INSTALLATION_BATCH);
        const recovered: Array<{ slug: string; installationId: string }> = [];
        // The budget of this transaction: the number of tasks the recovery may
        // touch. An installation that does not fit is left to the next
        // transaction, so a recovery transaction never covers an unbounded
        // amount of work.
        let budget = RECOVERY_TASK_BUDGET;
        let consumed = 0;
        for (const installation of page) {
          const tasks = await tx.pluginTask.count({ where: { installationId: installation.id, status: { in: ['PENDING', 'RUNNING'] } } });
          if (consumed > 0 && tasks > budget) break;
          try {
            await this.recoverInstallation(tx, installation, now, recovered);
          } catch (error) {
            // An installation with more active tasks than one transition may
            // cover fails the transition loudly. Its tasks stay as they are and
            // the recovery moves on to the next installation instead of
            // rolling the whole sweep back.
            if (!(error instanceof ApiError) || error.code !== 'PLUGIN_TASK_LIMIT_CONFLICT') throw error;
            console.error(JSON.stringify({ event: 'plugin_task_recovery_limit', slug: installation.pluginSlug, installationId: installation.id, tasks }));
            consumed += 1;
            continue;
          }
          budget -= tasks;
          consumed += 1;
        }
        return { recovered, more: installations.length > RECOVERY_INSTALLATION_BATCH || consumed < page.length, nextCursor: consumed ? page[consumed - 1].id : undefined };
      });
      failures.push(...batch.recovered);
      if (!batch.more || !batch.nextCursor) break;
      cursor = batch.nextCursor;
    }
    for (const failure of failures) await recordPluginFailure(failure.slug, new Error('Plugin task lease expired.'), 'task-recovery', failure.installationId);
  }
}
async function createFinalFailure(tx: TaskTransaction, task: StoredTask): Promise<void> {
  const installation = await tx.pluginInstallation.findUniqueOrThrow({ where: { id: task.installationId }, include: { plugin: true } });
  const declaration = (installation.plugin.manifestJson as unknown as { tasks?: PluginTaskDeclaration[] }).tasks?.find(d => d.name === task.name && d.version === task.version);
  if (declaration?.onFinalFailure) await tx.pluginTaskFinalFailure.upsert({ where: { taskId: task.id }, create: { taskId: task.id, name: task.name, version: task.version, maxRuntimeSeconds: declaration.onFinalFailure.maxRuntimeSeconds }, update: {} });
}
