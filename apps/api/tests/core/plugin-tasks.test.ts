import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { Client } from 'pg';
import { sweepPluginRecovery } from '@/core/admin/extension-installer/plugin-recovery';
import { prisma } from '@/config/database';
import { ensureCoreProcess } from '@/infra/core-process';
import { coreProcessIdentity } from '@/infra/core-process-identity';
import { PluginTaskWorker, retryDelayMs, deathScanDue } from '@/core/plugins/task-worker';
import { assertTaskClaim, createTaskApi, DEFAULT_TASK_POLICY, lockTaskScheduler, recordTaskPrincipal, requireTaskPrincipal, setTaskDependencyAvailability, setTaskOperatorPolicy, transitionInstallationTasks, withTaskScope, type TaskClaim } from '@/core/plugins/tasks';
import { assertCurrentDatabase } from '@/config/test-lane';
import { createPluginDatabaseTestRuntime, withPluginDatabaseHandler, withPluginDatabaseInvocation } from '@/core/admin/extension-installer/plugin-database';
import { pluginSchemaName } from 'shared/plugin-signing';
import { TaskPermanentError } from '@jiffoo/shared';
import { ApiError, mapApiError } from '@/utils/api-errors';

const slugs: string[] = [];
const workers: PluginTaskWorker[] = [];
const users: string[] = [];
async function fixture(options: { maxAttempts?: number; maxRuntimeSeconds?: number; hook?: boolean } = {}) {
  const slug = `g1-${randomUUID().slice(0, 12)}`;
  slugs.push(slug);
  const declaration = { name: 'render', version: 1, concurrency: 2, maxAttempts: options.maxAttempts ?? 3, maxRuntimeSeconds: options.maxRuntimeSeconds ?? 300, ...(options.hook ? { onFinalFailure: { maxRuntimeSeconds: 2 } } : {}) };
  const plugin = await prisma.pluginInstall.create({ data: { slug, name: slug, version: '1.0.0', zipHash: 'a'.repeat(64), manifestJson: { tasks: [declaration] }, installations: { create: { instanceKey: 'default', enabled: true } } }, include: { installations: true } });
  const installationId = plugin.installations[0].id;
  const api = createTaskApi(installationId, () => { throw new Error('Registration is not used by this API fixture'); });
  const run = async <T>(fn: () => Promise<T>, request = true, principal: Parameters<typeof withTaskScope>[0]['principal'] = null) => {
    const live = await prisma.pluginInstallation.findUniqueOrThrow({where:{id:installationId},include:{plugin:true}});
    return withTaskScope({ installationId, generation:live.protectionGeneration, zipHash:live.plugin.zipHash!, request, principal, actorId: 'g1-test' }, fn);
  };
  const enqueue = (key = randomUUID(), payload: any = { render: true }, options: object = {}) => run(() => api.enqueue('render', 1, payload, { idempotencyKey: key, ...options }));
  const worker = (execute: NonNullable<ConstructorParameters<typeof PluginTaskWorker>[0]>['execute'], caps: object = {}) => {
    const w = new PluginTaskWorker({ installationIds: [installationId], execute, retryMs: [0], ...caps }); workers.push(w); return w;
  };
  return { slug, installationId, api, run, enqueue, worker, declaration };
}
/**
 * The ceiling of a single wait for a settled task state.
 *
 * The wait covers the start of the worker processes, the claim of a task, the
 * expiry of a lease and the settlement of the claim, so it is inherently
 * slower than an in process wait. The ceiling therefore has to fit a shard
 * that runs the rest of its files at the same time, including a file that
 * publishes plugin packages.
 *
 * It is a ceiling and not a delay: the helper returns as soon as the
 * predicate holds, so a healthy run never reaches it, while a loaded shard
 * gets the whole budget before the wait is reported as unsettled.
 *
 * It is the ceiling of the waits that do not wait for a lease of their own.
 * The wait for the settlement of a released claim uses
 * LEASE_EXPIRY_DEADLINE_MS instead.
 */
const SETTLE_DEADLINE_MS = 60_000;
/**
 * The ceiling of the wait for the settlement of a released claim.
 *
 * That wait covers the lease of the released claim, so it can outlive the
 * shared settle ceiling above. This ceiling stays above it, so the wait
 * reports the file's own diagnostic instead of an unrelated timeout.
 */
const LEASE_EXPIRY_DEADLINE_MS = 120_000;
/**
 * The grace a forked worker gets to exit after it was asked to stop.
 *
 * It stays independent of the settle ceiling on purpose: a worker that
 * refuses to exit must still be killed, and the test must still fail, within
 * a bounded time.
 */
const STOP_GRACE_MS = 20_000;
async function eventually(predicate: () => Promise<boolean>, deadlineMs = SETTLE_DEADLINE_MS) {
  const end = performance.now() + deadlineMs;
  while (!await predicate()) { if (performance.now() >= end) throw new Error('Task state did not settle before its deadline'); await delay(10); }
}
/**
 * The cleanup of the core-process fixtures of the reclaim cases.
 *
 * The rows of a fixture process are referenced by its task slots and by the
 * tasks it claimed, so the references go first: the registry refuses to
 * delete a process that still owns a slot or a claimed task. A claimed task
 * leaves the claim in one statement: a task that is not RUNNING may not keep
 * a claim token, a lease or a deadline, so clearing the owner of a running
 * task alone would break the status constraint of the table.
 */
async function releaseProcessFixtures(bootNonces: string[]) {
  await prisma.pluginTaskExecutionSlot.deleteMany({ where: { bootNonce: { in: bootNonces } } });
  await prisma.pluginTask.updateMany({ where: { claimedByBootNonce: { in: bootNonces } }, data: { status: 'FAILED', claimToken: null, leaseUntil: null, deadlineAt: null, claimedByBootNonce: null, finishedAt: new Date() } });
  await prisma.pluginTaskFinalFailure.deleteMany({ where: { bootNonce: { in: bootNonces } } });
  await prisma.coreProcess.deleteMany({ where: { bootNonce: { in: bootNonces } } });
}
afterEach(async () => {
  assertCurrentDatabase((await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name);
  for (const worker of workers.splice(0)) await worker.drain();
  const installations = await prisma.pluginInstallation.findMany({ where: { pluginSlug: { in: slugs } } });
  await prisma.pluginTaskExecutionSlot.deleteMany({ where: { installationId: { in: installations.map(i => i.id) } } });
  await prisma.pluginTaskFairness.deleteMany({ where: { installationId: { in: installations.map(i => i.id) } } });
  await prisma.pluginInstall.deleteMany({ where: { slug: { in: slugs.splice(0) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
});

it('retains idempotency keys and normalized delay requests through cancellation and rejects changed input', async () => {
  const f = await fixture();
  const first = await f.enqueue('stable', { a: 1, b: 2 }, { delayMs: 10_000 });
  const duplicate = await f.enqueue('stable', { b: 2, a: 1 }, { delayMs: 10_000 });
  expect(duplicate.id).toBe(first.id);
  await expect(f.enqueue('stable', { a: 2, b: 2 }, { delayMs: 10_000 })).rejects.toMatchObject({ code: 'PLUGIN_TASK_IDEMPOTENCY_CONFLICT' });
  await f.run(() => f.api.cancel(first.id));
  expect((await f.enqueue('stable', { a: 1, b: 2 }, { delayMs: 10_000 })).status).toBe('cancelled');
  expect((await f.run(() => f.api.list({ status: 'cancelled' }))).items).toHaveLength(1);
  expect((await prisma.pluginTask.findUniqueOrThrow({ where: { id: first.id } })).payload).toEqual({ a: 1, b: 2 });
});
it('reserves bootstrap keys and preserves ordinary replay after handler declaration removal', async () => {
  const f = await fixture();
  await expect(f.enqueue('admin-repair-bootstrap:forged')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  const task = await f.enqueue('historical');
  await f.run(() => f.api.cancel(task.id));
  await prisma.pluginInstall.update({ where: { slug: f.slug }, data: { manifestJson: { tasks: [] } } });
  expect((await f.enqueue('historical')).id).toBe(task.id);
});
it('binds anonymous requests to null and forbids request identity overrides', async () => {
  const f = await fixture();
  const task = await f.enqueue();
  expect((await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } })).principalId).toBeNull();
  await expect(f.enqueue('override', {}, { principal: { type: 'customer', id: 'forged' } })).rejects.toMatchObject({ code: 'PLUGIN_TASK_PRINCIPAL_OVERRIDE_FORBIDDEN' });
  await expect(f.run(() => f.api.enqueue('render', 1, {}, { idempotencyKey: 'repair', principal: { type: 'customer', id: 'unrecorded' } }), false)).rejects.toMatchObject({ code: 'PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED' });
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@g1.test`, username: 'G1', password: 'unused', role: 'USER' } }); users.push(user.id);
  const principal = await recordTaskPrincipal(f.installationId, { id: user.id, role: 'USER' });
  const bound = await f.run(() => f.api.enqueue('render', 1, {}, { idempotencyKey: 'bound' }), true, principal);
  expect((await prisma.pluginTask.findUniqueOrThrow({ where: { id: bound.id } })).principalId).toBe(user.id);
  await expect(f.enqueue('bound', {})).rejects.toMatchObject({ code: 'PLUGIN_TASK_IDEMPOTENCY_CONFLICT' });
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
  await expect(f.run(() => f.api.enqueue('render', 1, {}, { idempotencyKey: 'revoked', principal: principal! }), false)).rejects.toMatchObject({ code: 'PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED' });
  const admin = await prisma.user.create({ data: { email: `${randomUUID()}@g1.test`, username: 'G1 Admin', password: 'unused', role: 'ADMIN' } }); users.push(admin.id);
  const adminPrincipal = await recordTaskPrincipal(f.installationId, { id: admin.id, role: 'ADMIN' });
  await f.run(() => f.api.enqueue('render', 1, {}, { idempotencyKey:'admin-repair', principal:adminPrincipal! }),false);
  const other = await fixture();
  await expect(other.run(() => other.api.enqueue('render',1,{}, { idempotencyKey:'other-installation',principal:adminPrincipal! }),false)).rejects.toMatchObject({code:'PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED'});
  await expect(f.run(() => f.api.enqueue('render',1,{}, { idempotencyKey:'malformed',principal:{type:'admin',id:admin.id,extra:true} as any }),false)).rejects.toMatchObject({code:'PLUGIN_TASK_PRINCIPAL_INVALID'});
  await prisma.user.delete({where:{id:admin.id}});
  await expect(f.run(() => f.api.enqueue('render',1,{}, { idempotencyKey:'deleted',principal:adminPrincipal! }),false)).rejects.toMatchObject({code:'PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED'});
});
it('honors runAt, retries ordinary failures, and preserves succeeded terminal state on cancel', async () => {
  const f = await fixture(); let attempts = 0;
  const future = await f.enqueue('future', {}, { delayMs: 86_400_000 });
  const task = await f.enqueue('due');
  let releaseFailure!:()=>void;
  const firstAttempt=new Promise<void>(resolve=>{releaseFailure=resolve;});
  const worker = f.worker(async (_claim, input) => { attempts++; expect(input.attempt).toBe(attempts); if (attempts < 2) { await firstAttempt; throw new Error('Retryable'); } return { done: true }; });
  try {
  await worker.tick();releaseFailure();await eventually(async () => (await f.run(() => f.api.get(task.id))).status === 'queued');
  await worker.tick(); await worker.drain();
  expect(attempts).toBe(2);
  expect((await f.run(() => f.api.cancel(task.id))).status).toBe('succeeded');
  expect((await f.run(() => f.api.get(future.id))).status).toBe('queued');
  }finally{releaseFailure();await worker.drain();}
}, 90_000);
it('permanent errors fail immediately and admit one final hook after handler settlement', async () => {
  const f = await fixture({ hook: true, maxAttempts: 5 }); let calls = 0; let hooks = 0;
  const task = await f.enqueue();
  const worker = f.worker(async (claim, input) => {
    if (claim.hook) { hooks++; return; }
    calls++; expect(input.isFinalAttempt).toBe(false); throw new TaskPermanentError('RENDER_REJECTED', 'Rendering rejected');
  });
  await worker.tick(); await eventually(async () => (await f.run(() => f.api.get(task.id))).status === 'failed');
  await eventually(async () => await prisma.pluginTaskExecutionSlot.count({ where: { taskId: task.id, state: { not: 'RELEASED' } } }) === 0);
  await worker.tick(); await worker.drain();
  expect(calls).toBe(1); expect(hooks).toBe(1);
  expect((await f.run(() => f.api.get(task.id))).finalFailure?.status).toBe('succeeded');
  expect((await prisma.pluginTaskAttempt.findFirstOrThrow({ where: { taskId: task.id } })).outcome).toBe('PERMANENT_ERROR');
}, 90_000);
it('cancelling a failed task suppresses only its pending hook and keeps FAILED truthful', async () => {
  const f = await fixture({ hook: true, maxAttempts: 1 }); const task = await f.enqueue();
  const worker = f.worker(async () => { throw new Error('Final attempt'); });
  await worker.tick(); await worker.drain();
  const cancelled = await f.run(() => f.api.cancel(task.id));
  expect(cancelled.status).toBe('failed'); expect(cancelled.finalFailure).toEqual({ status: 'suppressed', suppressionReason: 'EXPLICIT_CANCEL' });
  expect((await f.run(() => f.api.cancel(task.id))).status).toBe('failed');
}, 90_000);
it('pause fences an ignored abort without consuming a retry or releasing physical occupancy', async () => {
  const f = await fixture({ hook: true, maxAttempts: 1 }); const task = await f.enqueue();
  let release!: () => void; let claimed!: TaskClaim;
  const settled = new Promise<void>(resolve => { release = resolve; });
  const worker = f.worker(async claim => { claimed = claim; await settled; return { obsolete: true }; }, { renewalMs: 20 });
  try {
  await worker.tick(); await eventually(async () => !!claimed);
  await prisma.$transaction(async tx => { await lockTaskScheduler(tx); await tx.pluginInstallation.update({ where: { id: f.installationId }, data: { enabled: false, protectionGeneration: { increment: 1 } } }); await transitionInstallationTasks(tx, f.installationId, 'PAUSE', 'plugin-disabled'); });
  await expect(prisma.$transaction(tx => assertTaskClaim(tx, claimed))).rejects.toMatchObject({ code: 'PLUGIN_TASK_CLAIM_LOST' });
  expect(await prisma.pluginTaskExecutionSlot.count({ where: { taskId: task.id, state: { in: ['ACTIVE', 'LINGERING'] } } })).toBe(1);
  expect((await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } })).attemptsCharged).toBe(0);
  expect(await prisma.pluginTaskFinalFailure.count({ where: { taskId: task.id } })).toBe(0);
  await prisma.pluginInstallation.update({ where: { id: f.installationId }, data: { enabled: true } });
  const next = f.worker(async (_claim, input) => { expect(input.attempt).toBe(1); expect(BigInt(input.fence)).toBeGreaterThan(claimed.fence); expect(input.claimId).not.toBe(claimed.claimId); return { resumed: true }; });
  await next.tick(); await next.drain();
  release(); await worker.drain();
  expect((await f.run(() => f.api.get(task.id))).result).toEqual({ resumed: true });
  } finally { release(); await worker.drain(); }
}, 90_000);
it('dependency loss pauses and recovery resumes the same task; uninstall cancels without a hook', async () => {
  const f = await fixture({ hook: true }); const task = await f.enqueue();
  await prisma.$transaction(tx => setTaskDependencyAvailability(tx, f.installationId, false));
  const worker = f.worker(async () => { throw new Error('Unavailable work must not execute'); });
  await worker.tick();
  const row = await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } }); expect(row.pauseReason).toBe('dependency-unavailable'); expect(row.attemptsCharged).toBe(0);
  await prisma.$transaction(tx => setTaskDependencyAvailability(tx, f.installationId, true));
  await prisma.$transaction(async tx => { await lockTaskScheduler(tx); await transitionInstallationTasks(tx, f.installationId, 'CANCEL', 'UNINSTALLED'); });
  expect((await f.run(() => f.api.get(task.id))).status).toBe('cancelled');
  expect(await prisma.pluginTaskFinalFailure.count({ where: { taskId: task.id } })).toBe(0);
}, 90_000);
it('renews a real 45-second invocation and reports progress beyond the gateway timeout', async () => {
  const f = await fixture({ maxRuntimeSeconds: 300 }); const task = await f.enqueue();
  let renewals = 0;
  const worker = f.worker(async (claim, input) => {
    const started = performance.now();
    while (performance.now() - started < 45_000) {
      await delay(5_000, undefined, { signal: input.signal }); await input.heartbeat({ seconds: Math.floor((performance.now() - started) / 1000) }); renewals++;
      if (renewals === 6) expect((await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } })).leaseUntil!.getTime()).toBeGreaterThan(claim.task.leaseUntil!.getTime());
    }
    return { rendered: true };
  });
  await worker.tick(); await worker.drain();
  expect(renewals).toBeGreaterThanOrEqual(9);
  const row = await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } });
  expect(row.status).toBe('SUCCEEDED'); expect(row.finishedAt!.getTime() - row.startedAt!.getTime()).toBeGreaterThan(30_000);
}, 120_000);

// The waits of this case cover the readiness of the two forked workers, the
// completion of their ticks, two claims, the expiry of the lease of the
// killed worker and the settlement of the released claim, so its timeout
// covers the sum of their ceilings (60 + 60 + 60 + 60 + 60 + 120 seconds)
// plus the stop grace of the cleanup, and a genuine failure still reports
// the file's own diagnostic.
it('two OS workers race one live claim and a killed owned worker is reclaimed with a higher fence', async () => {
  const f = await fixture(); const task = await f.enqueue();
  const messages: any[] = [];
  const children = [0, 1].map(() => {
    const child = fork(path.resolve('tests/fixtures/plugin-task-worker.ts'), [], { execArgv: ['--import', 'tsx'], env: { ...process.env, G1_TASK_INSTALLATION_ID: f.installationId }, silent: true, windowsHide: true });
    child.on('message', message => messages.push({ child, ...(message as object) }));
    return child;
  });
  try {
    await eventually(async () => messages.filter(m => m.kind === 'ready').length === 2, SETTLE_DEADLINE_MS);
    for (const child of children) child.send({ kind: 'tick' });
    await eventually(async () => messages.filter(m => m.kind === 'tick-complete').length === 2);
    await eventually(async () => messages.some(m => m.kind === 'claimed'));
    expect(messages.filter(m => m.kind === 'claimed')).toHaveLength(1);
    const first = messages.find(m => m.kind === 'claimed');
    const staleTask = await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } });
    const slot = await prisma.pluginTaskExecutionSlot.findFirstOrThrow({ where: { taskId: task.id } });
    const stale: TaskClaim = { task: staleTask, hook: null, claimId: first.claimId, fence: BigInt(first.fence), generation: staleTask.generation!, zipHash: staleTask.zipHash!, bootNonce: first.bootNonce, deadlineAt: staleTask.deadlineAt!, slotId: slot.id };
    const exited = once(first.child, 'exit'); first.child.kill('SIGKILL'); await exited;
    await prisma.coreProcess.update({ where: { bootNonce: first.bootNonce }, data: { state: 'DEAD_CONFIRMED', deathConfirmedAt: new Date(), deathProof: { source: 'test-owned-child-exit', pid: first.child.pid } } });
    await eventually(async () => (await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } })).leaseUntil!.getTime() <= Date.now());
    const survivor = children.find(child => child !== first.child)!;
    survivor.send({ kind: 'tick' });
    await eventually(async () => messages.filter(m => m.kind === 'claimed').length === 2);
    const next = messages.filter(m => m.kind === 'claimed')[1];
    expect(BigInt(next.fence)).toBeGreaterThan(BigInt(first.fence)); expect(next.claimId).not.toBe(first.claimId);
    await expect(prisma.$transaction(tx => assertTaskClaim(tx, stale))).rejects.toMatchObject({ code: 'PLUGIN_TASK_CLAIM_LOST' });
    await expect(withTaskScope({ installationId: f.installationId, generation:stale.generation, zipHash:stale.zipHash, request: false, principal: null, actorId: 'stale-test', claim: stale }, () => f.api.enqueue('render', 1, {}, { idempotencyKey: 'stale-enqueue' }))).rejects.toMatchObject({ code: 'PLUGIN_TASK_CLAIM_LOST' });
    survivor.send({ kind: 'release' });
    await eventually(async () => (await f.run(() => f.api.get(task.id))).status === 'succeeded', LEASE_EXPIRY_DEADLINE_MS);
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.send({ kind: 'stop' });
      const stopped = await Promise.race([exited.then(() => true), delay(STOP_GRACE_MS).then(() => false)]);
      if (!stopped) { child.kill('SIGKILL'); await exited; }
    }
  }
}, 540_000);

it('enforces max runtime with AbortSignal and leaves a timed-out hook UNKNOWN without replay', async () => {
  const f = await fixture({ maxAttempts: 1, maxRuntimeSeconds: 1, hook: true }); const task = await f.enqueue();
  let taskAborted = false; let hookAborted = false; let hooks = 0;
  const worker = f.worker(async (claim, input) => {
    input.signal.addEventListener('abort', () => { if (claim.hook) hookAborted = true; else taskAborted = true; }, { once: true });
    if (claim.hook) hooks++;
    await delay(10_000, undefined, { signal: input.signal });
  });
  await worker.tick();
  await eventually(async () => (await f.run(() => f.api.get(task.id))).status === 'failed');
  await eventually(async () => await prisma.pluginTaskExecutionSlot.count({ where: { taskId: task.id, state: { not: 'RELEASED' } } }) === 0);
  await worker.tick(); await worker.drain();
  expect(taskAborted).toBe(true); expect(hookAborted).toBe(true); expect(hooks).toBe(1);
  expect((await f.run(() => f.api.get(task.id))).finalFailure?.status).toBe('unknown');
  const retry = f.worker(async () => { throw new Error('UNKNOWN hooks must not replay'); });
  await retry.tick(); await retry.drain(); expect(hooks).toBe(1);
}, 90_000);
it('compatible updates retain policy and keys while removed versions are terminally cancelled', async () => {
  const f = await fixture(); const task = await f.enqueue('update');
  await prisma.$transaction(async tx => { await lockTaskScheduler(tx); await transitionInstallationTasks(tx, f.installationId, 'UPDATE', 'PACKAGE_UPDATED', [f.declaration]); await tx.pluginInstallation.update({ where: { id: f.installationId }, data: { protectionGeneration: { increment: 1 } } }); });
  expect((await f.enqueue('update')).id).toBe(task.id);
  await expect(prisma.$transaction(async tx => { await lockTaskScheduler(tx); await transitionInstallationTasks(tx, f.installationId, 'UPDATE', 'PACKAGE_UPDATED', [{ ...f.declaration, maxAttempts: 1 }]); })).rejects.toMatchObject({ code: 'PLUGIN_TASK_LIMIT_CONFLICT' });
  await prisma.$transaction(async tx => { await lockTaskScheduler(tx); await transitionInstallationTasks(tx, f.installationId, 'UPDATE', 'PACKAGE_UPDATED', []); });
  expect((await f.enqueue('update')).status).toBe('cancelled');
  expect((await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } })).cancellationReason).toBe('HANDLER_REMOVED');
});
it('shared operator caps block admission without changing admitted budgets', async () => {
  const f = await fixture(); const task = await f.enqueue();
  try {
    await prisma.$transaction(tx => setTaskOperatorPolicy(tx, { ...DEFAULT_TASK_POLICY, runtimeSeconds: 10 }));
    await expect(f.enqueue()).rejects.toMatchObject({ code: 'PLUGIN_TASK_DECLARATION_INVALID' });
    const worker = f.worker(async () => { throw new Error('Policy-blocked work must not execute'); });
    await worker.tick();
    const row = await prisma.pluginTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(row.status).toBe('PENDING'); expect(row.maxRuntimeSeconds).toBe(300); expect(row.attemptsCharged).toBe(0);
  } finally { await prisma.$transaction(tx => setTaskOperatorPolicy(tx, DEFAULT_TASK_POLICY)); }
}, 90_000);
it('a hot installation cannot consume the second installation first-round fair slot', async () => {
  const hot = await fixture(); const quiet = await fixture();
  for (let i = 0; i < 6; i++) await hot.enqueue(`hot-${i}`);
  const quietTask = await quiet.enqueue();
  const claimed: TaskClaim[] = []; let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const worker = new PluginTaskWorker({ installationIds: [hot.installationId, quiet.installationId], execute: async claim => { claimed.push(claim); await blocked; } }); workers.push(worker);
  try {
    await worker.tick(); await eventually(async () => claimed.length >= 2);
    expect(new Set(claimed.slice(0, 2).map(c => c.task.installationId)).size).toBe(2);
    expect(claimed.some(c => c.task.id === quietTask.id)).toBe(true);
  } finally { release(); await worker.drain(); }
}, 90_000);
it('installation-level execution cannot acquire customer authority from payload IDs', async () => {
  const f = await fixture();
  await expect(f.run(() => prisma.$transaction(tx => requireTaskPrincipal(tx, f.installationId)), false)).rejects.toMatchObject({ code: 'PLUGIN_TASK_PRINCIPAL_REQUIRED' });
  await expect(f.enqueue('invalid-schedule', {}, { runAt: new Date().toISOString(), delayMs: 0 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});

it('a delayed old invocation cannot write through the SDK or overwrite a newer plugin-owned result', async () => {
  const f = await fixture(); const task = await f.enqueue();
  const schema = pluginSchemaName(f.slug);
  const previousSwitch = process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL; process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL = '1';
  const runtime = createPluginDatabaseTestRuntime(process.env.DATABASE_URL_TEST!, 2);
  const database = runtime.database(f.slug, f.installationId);
  let release!: () => void; let oldInput: any; let staleCode: string | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  const sql = 'INSERT INTO results(id,claim,fence,value) VALUES($1,$2::uuid,$3::bigint,$4) ON CONFLICT(id) DO UPDATE SET claim=$2::uuid,fence=$3::bigint,value=$4 WHERE results.fence < $3::bigint';
  try {
    await prisma.pluginNamespace.create({ data: { slug: f.slug, schemaName: schema, publisherKind: 'unsigned', provisionedAt: new Date() } });
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".results(id TEXT PRIMARY KEY,claim UUID NOT NULL,fence BIGINT NOT NULL,value TEXT NOT NULL)`);
    const first = f.worker(async (_claim, input) => withPluginDatabaseInvocation(f.slug, f.installationId, () => withPluginDatabaseHandler(f.slug, f.installationId, async () => {
      oldInput = input;
      await database.query(sql, [task.id,input.claimId,input.fence,'old-owner']);
      await held;
      try { await database.query('UPDATE results SET value=$1 WHERE id=$2 AND claim=$3::uuid AND fence=$4::bigint', ['stale',task.id,input.claimId,input.fence]); }
      catch (error) { staleCode = (error as { code: string }).code; }
      return { stale: true };
    }), input.signal), { renewalMs: 20 });
    await first.tick(); await eventually(async () => !!oldInput && (await prisma.$queryRawUnsafe<Array<{value:string}>>(`SELECT value FROM "${schema}".results WHERE id=$1`,task.id))[0]?.value === 'old-owner');
    await prisma.$transaction(async tx => { await lockTaskScheduler(tx); await transitionInstallationTasks(tx,f.installationId,'UPDATE','PACKAGE_UPDATED',[f.declaration]); await tx.pluginInstallation.update({ where:{id:f.installationId},data:{protectionGeneration:{increment:1}} }); });
    const next = f.worker(async (_claim,input) => withPluginDatabaseInvocation(f.slug,f.installationId,() => withPluginDatabaseHandler(f.slug,f.installationId,async () => {
      await database.query(sql,[task.id,input.claimId,input.fence,'fresh']); return { fresh:true };
    }),input.signal));
    await next.tick(); await next.drain();
    await expect(oldInput.heartbeat({ stale: true })).rejects.toMatchObject({code:'PLUGIN_TASK_CLAIM_LOST'});
    release(); await first.drain();
    expect(staleCode).toBe('PLUGIN_TASK_CLAIM_LOST');
    expect((await prisma.$queryRawUnsafe<Array<{value:string}>>(`SELECT value FROM "${schema}".results WHERE id=$1`,task.id))[0].value).toBe('fresh');
    expect((await f.run(() => f.api.get(task.id))).result).toEqual({fresh:true});
  } finally {
    release();
    for (const worker of workers) await worker.drain();
    await runtime.close();
    assertCurrentDatabase((await prisma.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`)[0].name);
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.pluginNamespace.deleteMany({where:{slug:f.slug}});
    if(previousSwitch===undefined) delete process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL; else process.env.JIFFOO_TEST_PLUGIN_DATABASE_CONTROL=previousSwitch;
  }
}, 90_000);

it('shutdown stops admission and abandons an uncooperative invocation without releasing its slot', async () => {
  const f = await fixture(); const task = await f.enqueue();
  let release!: () => void; let entered = false;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const worker = f.worker(async () => { entered = true; await blocked; });
  try {
    await worker.tick(); await eventually(async () => entered);
    const drain = worker.drain();
    const drained = await Promise.race([drain.then(() => true), delay(50).then(() => false)]);
    expect(drained).toBe(false);
    worker.abandon();
    expect(worker.unsettled()).toEqual([{ kind:'plugin-task',id:task.id }]);
    expect(await prisma.pluginTaskExecutionSlot.count({where:{taskId:task.id,state:{in:['ACTIVE','LINGERING']}}})).toBe(1);
    await f.enqueue('after-stop'); await worker.tick();
    expect(await prisma.pluginTaskAttempt.count({where:{task:{installationId:f.installationId}}})).toBe(1);
    release(); await drain;
    expect((await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}})).status).toBe('RUNNING');
  } finally { release(); await worker.drain(); }
}, 90_000);

it('a simulated 180-second AI call fits a declared 300-second budget and the hard 600-second cap is enforced', async () => {
  const f = await fixture({maxRuntimeSeconds:300}); const task = await f.enqueue();
  let entered = false;
  const worker = f.worker(async (claim,input) => {
    expect(claim.deadlineAt.getTime()-claim.task.startedAt!.getTime()).toBe(300_000);
    entered = true;
    await new Promise<void>(resolve=>setTimeout(resolve,180_000));
    expect(input.signal.aborted).toBe(false);
    return {simulatedSeconds:180};
  });
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  try {
    await worker.tick(); await eventually(async()=>entered);
    await vi.advanceTimersByTimeAsync(180_000); await worker.drain();
    expect((await f.run(()=>f.api.get(task.id))).result).toEqual({simulatedSeconds:180});
  } finally { await vi.advanceTimersByTimeAsync(180_000); vi.useRealTimers(); await worker.drain(); }
  const invalid = await fixture({maxRuntimeSeconds:601});
  await expect(invalid.enqueue()).rejects.toMatchObject({code:'PLUGIN_TASK_DECLARATION_INVALID'});
}, 90_000);

it('a failed lingering-state write cannot forget an abort-ignoring invocation before actual settlement', async () => {
  const f = await fixture(); const task = await f.enqueue();
  let release!: () => void; let entered = false;
  const blocked = new Promise<void>(resolve=>{release=resolve;});
  let persistenceFailed=false;
  const worker = f.worker(async()=>{entered=true;await blocked;},{beforeLingeringWrite:async()=>{persistenceFailed=true;throw new Error('Simulated persistence outage');}});
  try {
    await worker.tick(); await eventually(async()=>entered);
    worker.abandon();
    await eventually(async()=>persistenceFailed);
    expect(worker.unsettled()).toEqual([{kind:'plugin-task',id:task.id}]);
    expect(await prisma.pluginTaskExecutionSlot.count({where:{taskId:task.id,state:{in:['ACTIVE','LINGERING']}}})).toBe(1);
    release(); await worker.drain();
    expect(await prisma.pluginTaskExecutionSlot.count({where:{taskId:task.id,state:{not:'RELEASED'}}})).toBe(0);
  } finally {release();await worker.drain();}
}, 90_000);

it('the retry ladder spreads the retries of a fleet that failed at the same moment',async()=>{
  // The jitter of a delay is bounded by a fifth of the ladder value, and two
  // draws of the same ladder value do not produce the same delay.
  expect(retryDelayMs(60_000,()=>0)).toBe(60_000);
  expect(retryDelayMs(60_000,()=>0.5)).toBe(66_000);
  expect(retryDelayMs(60_000,()=>0.999)).toBe(71_988);
  expect(retryDelayMs(1_000,()=>0)).toBe(1_000);
  expect(retryDelayMs(1_000,()=>0.999)).toBe(1_199);
  expect(retryDelayMs(60_000,()=>0.5)).not.toBe(retryDelayMs(60_000,()=>0.25));
  // One installation admits two tasks of a name at a time, so the fleet
  // spans five installations.
  const fixtures=await Promise.all([0,1,2,3,4].map(()=>fixture()));
  const tasks=[];
  for(const f of fixtures)tasks.push(await f.enqueue());
  const worker=new PluginTaskWorker({installationIds:fixtures.map(f=>f.installationId),execute:async()=>{throw new Error('Retryable');},retryMs:[1_000]});workers.push(worker);
  await worker.tick();await worker.drain();
  const delays:number[]=[];
  for(const task of tasks){
    const row=await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}});
    const attempt=await prisma.pluginTaskAttempt.findUniqueOrThrow({where:{taskId_executionSequence:{taskId:task.id,executionSequence:row.executionSequence}}});
    const delay=row.nextAttemptAt.getTime()-attempt.finishedAt!.getTime();
    expect(delay).toBeGreaterThanOrEqual(1_000);
    expect(delay).toBeLessThanOrEqual(1_200);
    delays.push(delay);
  }
  expect(delays).toHaveLength(5);
  // The tasks that failed together do not retry at the same moment.
  expect(new Set(delays).size).toBeGreaterThan(1);
}, 90_000);

it('task policy conflicts identify blocked work and dependency errors preserve retryable backoff', () => {
  expect(mapApiError(new ApiError('PLUGIN_TASK_LIMIT_CONFLICT',{taskId:'task-123',payload:'private'})).body.error).toMatchObject({code:'PLUGIN_TASK_LIMIT_CONFLICT',details:{taskId:'task-123'}});
  expect(mapApiError(new ApiError('PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE',{retryAfterSeconds:12,payload:'private'}))).toMatchObject({status:503,body:{error:{details:{retryable:true,retryAfterSeconds:12}}}});
  expect(mapApiError(new ApiError('PLUGIN_SERVICE_DEPENDENCY_UNAVAILABLE',{retryAfterSeconds:Infinity})).body.error.details).toEqual({retryable:true,retryAfterSeconds:5});
});

it('captured progress authority closes when the handler settles even before durable completion publishes', async () => {
  const f=await fixture();const task=await f.enqueue();
  let release!:()=>void;let input: any;
  const blocked=new Promise<void>(resolve=>{release=resolve;});
  const worker=f.worker(async(_claim,invocation)=>{input=invocation;await blocked;return {done:true};});
  const control=new Client({connectionString:process.env.DATABASE_URL_TEST});let locked=false;
  try{
    await worker.tick();await eventually(async()=>!!input);
    await control.connect();assertCurrentDatabase((await control.query('SELECT current_database() AS name')).rows[0].name);
    await control.query("SELECT pg_advisory_lock(hashtextextended('jiffoo:plugin-service-graph',0))");locked=true;
    release();
    await eventually(async()=>Number((await control.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%jiffoo:plugin-service-graph%' AND query LIKE '%pg_advisory_xact_lock%' ")).rows[0].count)>0,SETTLE_DEADLINE_MS);
    expect((await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}})).status).toBe('RUNNING');
    await expect(input.heartbeat({detached:true})).rejects.toMatchObject({code:'PLUGIN_TASK_CLAIM_LOST'});
    await control.query("SELECT pg_advisory_unlock(hashtextextended('jiffoo:plugin-service-graph',0))");locked=false;
    await worker.drain();expect((await f.run(()=>f.api.get(task.id))).status).toBe('succeeded');
  }finally{release();if(locked)await control.query("SELECT pg_advisory_unlock(hashtextextended('jiffoo:plugin-service-graph',0))");await control.end();await worker.drain();}
}, 90_000);

it('an inactive oldest principal blocks only its own task and resumes the same task after reactivation', async()=>{
  const f=await fixture();
  const user=await prisma.user.create({data:{email:`${randomUUID()}@g1.test`,username:'Queued customer',password:'unused',role:'USER'}});users.push(user.id);
  const principal=await recordTaskPrincipal(f.installationId,{id:user.id,role:'USER'});
  const blocked=await f.run(()=>f.api.enqueue('render',1,{}, {idempotencyKey:'inactive-head'}),true,principal);
  await prisma.user.update({where:{id:user.id},data:{isActive:false}});
  const eligible=await f.enqueue('eligible-tail');const calls:string[]=[];
  const worker=f.worker(async(_claim,input)=>{calls.push(input.taskId);return {done:true};});
  await worker.tick();await worker.drain();
  expect(calls).toEqual([eligible.id]);
  expect(await f.run(()=>f.api.get(blocked.id))).toMatchObject({status:'queued',attempt:0,lastError:{code:'PLUGIN_TASK_PRINCIPAL_NOT_ALLOWED'}});
  await prisma.user.update({where:{id:user.id},data:{isActive:true}});
  const resumed=f.worker(async(_claim,input)=>{expect(input.taskId).toBe(blocked.id);expect(input.attempt).toBe(1);expect(input.principal?.id).toBe(user.id);return {resumed:true};});
  await resumed.tick();await resumed.drain();
  expect((await f.run(()=>f.api.get(blocked.id))).result).toEqual({resumed:true});
}, 90_000);

it('default retry delays preserve the admitted budget and mark only the last budgeted attempt final', async()=>{
  const f=await fixture({maxAttempts:5,hook:true});const task=await f.enqueue();
  for(const [index,backoff] of [60_000,300_000,900_000,3_600_000].entries()){
    const worker=f.worker(async(_claim,input)=>{expect(input.attempt).toBe(index+1);expect(input.isFinalAttempt).toBe(false);throw new Error('Retryable');},{retryMs:undefined});
    await worker.tick();await worker.drain();
    const row=await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}});
    const attempt=await prisma.pluginTaskAttempt.findUniqueOrThrow({where:{taskId_executionSequence:{taskId:task.id,executionSequence:row.executionSequence}}});
    // The ladder value is the lower bound of the delay: every delay jitters
    // over a bounded share of it, so a fleet that failed together does not
    // retry together.
    const delay=row.nextAttemptAt.getTime()-attempt.finishedAt!.getTime();
    expect(delay).toBeGreaterThanOrEqual(backoff);
    expect(delay).toBeLessThanOrEqual(Math.floor(backoff*1.2));
    await prisma.pluginTask.updateMany({where:{id:task.id,status:'PENDING'},data:{nextAttemptAt:new Date(0)}});
  }
  const final=f.worker(async(_claim,input)=>{expect(input.attempt).toBe(5);expect(input.isFinalAttempt).toBe(true);return {done:true};},{retryMs:undefined});
  await final.tick();await final.drain();
  expect((await f.run(()=>f.api.get(task.id))).status).toBe('succeeded');
  expect(await prisma.pluginTaskFinalFailure.count({where:{taskId:task.id}})).toBe(0);
}, 90_000);

it('history cleanup retains permanent keys and distinct UTC buckets enqueue distinct tasks', async()=>{
  const f=await fixture();const key='cleanup:2026-10-20T10:10';const task=await f.enqueue(key);
  const worker=f.worker(async()=>({done:true}));await worker.tick();await worker.drain();
  await prisma.pluginTaskExecutionSlot.updateMany({where:{taskId:task.id,state:'RELEASED'},data:{releasedAt:new Date(Date.now()-31*86_400_000)}});
  await sweepPluginRecovery();
  expect(await prisma.pluginTaskExecutionSlot.count({where:{taskId:task.id}})).toBe(0);
  expect((await f.enqueue(key)).id).toBe(task.id);
  expect((await f.enqueue('cleanup:2026-10-20T10:11')).id).not.toBe(task.id);
}, 90_000);

it('missing task identifiers cannot read or cancel the first task of an installation',async()=>{
  const f=await fixture();const task=await f.enqueue();
  for(const id of [undefined,'','\0']){
    await expect(f.run(()=>f.api.get(id as any))).rejects.toMatchObject({code:'VALIDATION_ERROR'});
    await expect(f.run(()=>f.api.cancel(id as any))).rejects.toMatchObject({code:'VALIDATION_ERROR'});
  }
  expect((await f.run(()=>f.api.get(task.id))).status).toBe('queued');
});

it('an expired admitted hook from a confirmed-dead worker becomes UNKNOWN and never replays',async()=>{
  const f=await fixture({maxAttempts:1,hook:true});const task=await f.enqueue();
  const bootNonce=randomUUID();const claimToken=randomUUID();const now=Date.now();let calls=0;
  try{
    await prisma.coreProcess.create({data:{bootNonce,instanceId:randomUUID(),kind:'worker',hostname:'g1-simulated-crash',pid:1,databaseRole:'postgres',state:'DEAD_CONFIRMED',startedAt:new Date(now-10_000),heartbeatAt:new Date(now-2_000),deathConfirmedAt:new Date(now-1_000),deathProof:{source:'test-owned-confirmed-death-fixture'}}});
    await prisma.pluginTask.update({where:{id:task.id},data:{status:'FAILED',attemptsCharged:1,finishedAt:new Date(now-4_000),lastError:{code:'PLUGIN_ERROR',message:'Rendering failed.'}}});
    await prisma.pluginTaskFinalFailure.create({data:{taskId:task.id,name:'render',version:1,status:'RUNNING',maxRuntimeSeconds:2,claimToken,fence:1n,bootNonce,startedAt:new Date(now-3_000),leaseUntil:new Date(now-1_000),deadlineAt:new Date(now-1_000),zipHash:'a'.repeat(64),generation:0n}});
    await prisma.pluginTaskExecutionSlot.create({data:{installationId:f.installationId,taskId:task.id,kind:'FINAL_FAILURE',name:'render',version:1,claimToken,fence:1n,bootNonce,state:'ACTIVE'}});
    for(let i=0;i<2;i++){
      const worker=f.worker(async()=>{calls++;throw new Error('An admitted hook cannot replay');});await worker.tick();await worker.drain();
    }
    expect(calls).toBe(0);
    expect((await f.run(()=>f.api.get(task.id))).finalFailure?.status).toBe('unknown');
    expect(await prisma.pluginTaskFinalFailure.count({where:{taskId:task.id}})).toBe(1);
    expect(await prisma.pluginTaskExecutionSlot.count({where:{taskId:task.id,state:{not:'RELEASED'}}})).toBe(0);
  }finally{
    assertCurrentDatabase((await prisma.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`)[0].name);
    await prisma.pluginTaskExecutionSlot.deleteMany({where:{taskId:task.id}});
    await prisma.coreProcess.deleteMany({where:{bootNonce}});
  }
}, 90_000);

it.each(['pause-first','timeout-first'] as const)('last-attempt timeout and pause have one authoritative outcome: %s',async order=>{
  const f=await fixture({maxAttempts:1,maxRuntimeSeconds:1,hook:true});const task=await f.enqueue();let entered=false;
  const worker=f.worker(async(_claim,input)=>{entered=true;await delay(10_000,undefined,{signal:input.signal});});
  const control=new Client({connectionString:process.env.DATABASE_URL_TEST});let locked=false;let pause:Promise<unknown>|undefined;
  const enqueuePause=()=>{
    pause=prisma.$transaction(async tx=>{await lockTaskScheduler(tx);await tx.pluginInstallation.update({where:{id:f.installationId},data:{enabled:false,protectionGeneration:{increment:1}}});await transitionInstallationTasks(tx,f.installationId,'PAUSE','plugin-disabled');});
    void pause.catch(()=>undefined);
  };
  const waiting=async()=>Number((await control.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%jiffoo:plugin-service-graph%' AND query LIKE '%pg_advisory_xact_lock%' ")).rows[0].count);
  try{
    await worker.tick();await eventually(async()=>entered);await control.connect();assertCurrentDatabase((await control.query('SELECT current_database() AS name')).rows[0].name);
    await control.query("SELECT pg_advisory_lock(hashtextextended('jiffoo:plugin-service-graph',0))");locked=true;
    if(order==='pause-first')enqueuePause();
    await eventually(async()=>await waiting()>=1,SETTLE_DEADLINE_MS);
    if(order==='timeout-first')enqueuePause();
    await eventually(async()=>await waiting()>=2,SETTLE_DEADLINE_MS);
    await control.query("SELECT pg_advisory_unlock(hashtextextended('jiffoo:plugin-service-graph',0))");locked=false;
    await pause;await worker.drain();
    const row=await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}});
    const attempts=await prisma.pluginTaskAttempt.findMany({where:{taskId:task.id}});
    expect(attempts).toHaveLength(1);
    expect(row.status).toBe(order==='pause-first'?'PENDING':'FAILED');
    expect(row.attemptsCharged).toBe(order==='pause-first'?0:1);
    expect(attempts[0].outcome).toBe(order==='pause-first'?'PAUSE_ABORT':'TIMED_OUT');
    expect(await prisma.pluginTaskFinalFailure.count({where:{taskId:task.id}})).toBe(order==='pause-first'?0:1);
  }finally{if(locked)await control.query("SELECT pg_advisory_unlock(hashtextextended('jiffoo:plugin-service-graph',0))");await Promise.allSettled([pause]);await control.end();await worker.drain();}
}, 90_000);

it('the sweep confirms the death of a core process that stopped heartbeating and frees the global slot cap',async()=>{
  const f=await fixture();const crashed=randomUUID();const free=await f.enqueue('free');
  await prisma.$transaction(tx=>setTaskOperatorPolicy(tx,{...DEFAULT_TASK_POLICY,globalSlots:2}));
  await ensureCoreProcess('worker');
  try{
    // The row of the process that runs the sweep: a live process is never condemned.
    await prisma.coreProcess.update({where:{bootNonce:coreProcessIdentity.bootNonce},data:{heartbeatAt:new Date(Date.now()-600_000)}});
    // A worker that was killed: its row stays LIVE and it holds the whole cap.
    await prisma.coreProcess.create({data:{bootNonce:crashed,instanceId:randomUUID(),kind:'worker',hostname:'g1-crashed',pid:4242,databaseRole:'postgres',state:'LIVE',startedAt:new Date(Date.now()-600_000),heartbeatAt:new Date(Date.now()-600_000)}});
    const stale=await f.enqueue('stale');
    await prisma.pluginTaskExecutionSlot.create({data:{installationId:f.installationId,taskId:stale.id,kind:'TASK',name:'render',version:1,claimToken:randomUUID(),fence:0n,bootNonce:crashed,state:'ACTIVE',lastObservedAt:new Date()}});
    await prisma.pluginTaskExecutionSlot.create({data:{installationId:f.installationId,taskId:free.id,kind:'TASK',name:'render',version:1,claimToken:randomUUID(),fence:0n,bootNonce:crashed,state:'ACTIVE',lastObservedAt:new Date()}});
    // The cap is consumed: the scan finds no candidate at all.
    expect(await prisma.pluginTaskExecutionSlot.count({where:{state:{in:['ACTIVE','LINGERING']}}})).toBe(2);
    const worker=f.worker(async()=>({done:true}));
    // The first observation only marks the process as suspect: PostgreSQL
    // loses every session when it restarts, so a missing session alone
    // proves nothing about the process that owned it.
    await worker.tick();
    expect((await prisma.coreProcess.findUniqueOrThrow({where:{bootNonce:crashed}})).state).toBe('SUSPECT');
    // A suspect process may still be alive, so its slots keep their occupancy.
    expect(await prisma.pluginTaskExecutionSlot.count({where:{state:{in:['ACTIVE','LINGERING']}}})).toBe(2);
    expect(await prisma.adminAuditEvent.count({where:{action:'CORE_PROCESS_DEATH_CONFIRMED',targetId:crashed}})).toBe(0);
    // The second observation, from a later round, confirms the death.
    await delay(21_500);
    await worker.tick();await worker.drain();
    const dead=await prisma.coreProcess.findUniqueOrThrow({where:{bootNonce:crashed}});
    expect(dead.state).toBe('DEAD_CONFIRMED');expect(dead.deathConfirmedAt).not.toBeNull();
    expect(await prisma.adminAuditEvent.count({where:{action:'CORE_PROCESS_DEATH_CONFIRMED',targetId:crashed}})).toBe(1);
    // The row of the live process that runs the sweep is untouched.
    expect((await prisma.coreProcess.findUniqueOrThrow({where:{bootNonce:coreProcessIdentity.bootNonce}})).state).toBe('LIVE');
    // The slots of the crashed worker are released and the cap is free again.
    expect(await prisma.pluginTaskExecutionSlot.count({where:{state:{in:['ACTIVE','LINGERING']}}})).toBe(0);
    expect((await f.run(()=>f.api.get(free.id))).status).toBe('succeeded');
  }finally{
    await prisma.$transaction(tx=>setTaskOperatorPolicy(tx,DEFAULT_TASK_POLICY));
    await releaseProcessFixtures([crashed]);
    await prisma.coreProcess.update({where:{bootNonce:coreProcessIdentity.bootNonce},data:{heartbeatAt:new Date()}});
  }
}, 120_000);

it('a suspect process that refreshed its heartbeat returns to the live state',async()=>{
  const f=await fixture();const boot=randomUUID();
  try{
    await prisma.coreProcess.create({data:{bootNonce:boot,instanceId:randomUUID(),kind:'worker',hostname:'g1-suspect',pid:4247,databaseRole:'postgres',state:'SUSPECT',startedAt:new Date(Date.now()-600_000),heartbeatAt:new Date(),deathProof:{source:'heartbeat-timeout-suspect',suspectMs:30_000,observedAt:new Date(Date.now()-60_000).toISOString(),heartbeatAt:new Date(Date.now()-600_000).toISOString(),previousState:'LIVE'}}});
    const worker=f.worker(async()=>({done:true}));
    await worker.tick();await worker.drain();
    const row=await prisma.coreProcess.findUniqueOrThrow({where:{bootNonce:boot}});
    expect(row.state).toBe('LIVE');
    expect(row.deathProof).toBeNull();
  }finally{
    await releaseProcessFixtures([boot]);
  }
}, 90_000);

it('the death confirmation scan runs on its own cadence',()=>{
  expect(deathScanDue(0,1_000)).toBe(true);
  expect(deathScanDue(1_000,1_000)).toBe(false);
  expect(deathScanDue(1_000,5_999)).toBe(false);
  expect(deathScanDue(1_000,6_000)).toBe(true);
});

it('a deterministic failure ends the task instead of walking the retry ladder',async()=>{
  const f=await fixture();const task=await f.enqueue();
  let calls=0;
  const worker=f.worker(async()=>{calls++;throw new ApiError('PLUGIN_CIRCUIT_OPEN');});
  await worker.tick();await worker.drain();
  expect(calls).toBe(1);
  const row=await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}});
  expect(row.status).toBe('FAILED');
  expect(row.attemptsCharged).toBe(1);
  expect((row.lastError as {code:string}).code).toBe('PLUGIN_CIRCUIT_OPEN');
  // The task is not retried: a second round finds no work and charges no attempt.
  const again=f.worker(async()=>{calls++;throw new ApiError('PLUGIN_CIRCUIT_OPEN');});
  await again.tick();await again.drain();
  expect(calls).toBe(1);
  expect((await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}})).attemptsCharged).toBe(1);
}, 90_000);

it('the lease-expiry recovery ends a task whose last failure was deterministic and names the claim',async()=>{
  const f=await fixture();const task=await f.enqueue();
  const owner=randomUUID();const claimToken=randomUUID();
  const warnings:string[]=[];
  const spy=vi.spyOn(console,'warn').mockImplementation((...args:unknown[])=>{warnings.push(args.map(String).join(' '));});
  try{
    await prisma.coreProcess.create({data:{bootNonce:owner,instanceId:randomUUID(),kind:'worker',hostname:'g1-expiry',pid:4248,databaseRole:'postgres',state:'LIVE',startedAt:new Date(),heartbeatAt:new Date()}});
    await prisma.pluginTask.update({where:{id:task.id},data:{status:'RUNNING',claimToken,fence:7n,claimedByBootNonce:owner,generation:0n,zipHash:'a'.repeat(64),leaseUntil:new Date(Date.now()-1000),deadlineAt:new Date(Date.now()-1000),startedAt:new Date(Date.now()-3_600_000),lastError:{code:'PLUGIN_CIRCUIT_OPEN',message:'Plugin circuit open.'}}});
    const worker=f.worker(async()=>({done:true}));
    await worker.tick();await worker.drain();
    const row=await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}});
    // The recovery reuses the decision of the settlement path: a failure that
    // a retry cannot fix does not walk the ladder again.
    expect(row.status).toBe('FAILED');
    expect(row.attemptsCharged).toBe(1);
    // The structured record names the claim that expired.
    const record=warnings.map(line=>{try{return JSON.parse(line) as {event?:string;taskId?:string;claimId?:string;fence?:string};}catch{return {};}}).find(entry=>entry.event==='plugin_task_lease_expired');
    expect(record).toBeDefined();
    expect(record!.taskId).toBe(task.id);
    expect(record!.claimId).toBe(claimToken);
    expect(record!.fence).toBe('7');
  }finally{
    spy.mockRestore();
    await releaseProcessFixtures([owner]);
  }
}, 90_000);

it('a failing slot observation records one throttled structured record',async()=>{
  const f=await fixture();const task=await f.enqueue();
  const warnings:string[]=[];
  const spy=vi.spyOn(console,'warn').mockImplementation((...args:unknown[])=>{warnings.push(args.map(String).join(' '));});
  const observations=()=>warnings.filter(line=>line.includes('plugin_task_slot_observation_failed')).length;
  let release!:()=>void;
  const blocked=new Promise<void>(resolve=>{release=resolve;});
  try{
    // The observation of the slot fails while the invocation runs.
    const worker=f.worker(async()=>{await blocked;return {done:true};},{occupancyMs:20,recordWindowMs:300,beforeOccupancyWrite:async()=>{throw new Error('Simulated observation outage');}});
    await worker.tick();
    await eventually(async()=>observations()===1,30_000);
    const record=warnings.map(line=>{try{return JSON.parse(line) as {event?:string;taskId?:string;slotId?:string;installationId?:string;error?:string;errorMessage?:string};}catch{return {};}}).find(entry=>entry.event==='plugin_task_slot_observation_failed');
    expect(record).toBeDefined();
    expect(record!.taskId).toBe(task.id);
    expect(record!.slotId).toBeTruthy();
    expect(record!.installationId).toBe(f.installationId);
    expect(record!.error).toBe('Error');
    expect(record!.errorMessage).toBe('Simulated observation outage');
    // The window throttles the record: the repeated failures inside the
    // window write one line.
    await delay(150);
    expect(observations()).toBe(1);
    // A failure that persists is recorded again after the window.
    await eventually(async()=>observations()>1,30_000);
  }finally{
    spy.mockRestore();
    release();
    for(const worker of workers.splice(0))await worker.drain();
  }
}, 90_000);

it('a failing settled-slot release records the slot and the installation',async()=>{
  const f=await fixture();const task=await f.enqueue();
  const warnings:string[]=[];
  const spy=vi.spyOn(console,'warn').mockImplementation((...args:unknown[])=>{warnings.push(args.map(String).join(' '));});
  try{
    // The release of the settled slot fails, so the slot stays occupied.
    const worker=f.worker(async()=>({done:true}),{beforeSlotRelease:async()=>{throw new Error('Simulated release outage');}});
    await worker.tick();await worker.drain();
    const record=warnings.map(line=>{try{return JSON.parse(line) as {event?:string;taskId?:string;slotId?:string;installationId?:string;errorMessage?:string};}catch{return {};}}).find(entry=>entry.event==='plugin_task_slot_release_failed');
    expect(record).toBeDefined();
    expect(record!.taskId).toBe(task.id);
    expect(record!.slotId).toBeTruthy();
    // The record names the installation whose queue is blocked by the slot.
    expect(record!.installationId).toBe(f.installationId);
    expect(record!.errorMessage).toBe('Simulated release outage');
  }finally{
    spy.mockRestore();
  }
}, 90_000);

it('the sweep releases a slot that stopped being observed and frees the global slot cap',async()=>{
  const f=await fixture();const other=await fixture();const free=await f.enqueue('free');
  await prisma.$transaction(tx=>setTaskOperatorPolicy(tx,{...DEFAULT_TASK_POLICY,globalSlots:2}));
  const owner=randomUUID();
  try{
    // The owner of the slots is alive: it heartbeats and holds sessions.
    await prisma.coreProcess.create({data:{bootNonce:owner,instanceId:randomUUID(),kind:'worker',hostname:'g1-live',pid:4243,databaseRole:'postgres',state:'LIVE',startedAt:new Date(),heartbeatAt:new Date()}});
    // Both slots stopped being observed and both tasks are beyond their deadline.
    for(const key of ['beyond-a','beyond-b']){
      const task=await other.enqueue(key);
      await prisma.pluginTask.update({where:{id:task.id},data:{status:'RUNNING',claimToken:randomUUID(),fence:1n,claimedByBootNonce:owner,leaseUntil:new Date(Date.now()-1000),deadlineAt:new Date(Date.now()-1000),startedAt:new Date(Date.now()-3_600_000)}});
      await prisma.pluginTaskExecutionSlot.create({data:{installationId:other.installationId,taskId:task.id,kind:'TASK',name:'render',version:1,claimToken:randomUUID(),fence:0n,bootNonce:owner,state:'ACTIVE',lastObservedAt:new Date(Date.now()-3_600_000)}});
    }
    expect(await prisma.pluginTaskExecutionSlot.count({where:{state:{in:['ACTIVE','LINGERING']}}})).toBe(2);
    const worker=f.worker(async()=>({done:true}));
    await worker.tick();await worker.drain();
    // The stale slots are released and the cap is free again.
    expect(await prisma.pluginTaskExecutionSlot.count({where:{state:{in:['ACTIVE','LINGERING']}}})).toBe(0);
    expect((await f.run(()=>f.api.get(free.id))).status).toBe('succeeded');
  }finally{
    await prisma.$transaction(tx=>setTaskOperatorPolicy(tx,DEFAULT_TASK_POLICY));
    await releaseProcessFixtures([owner]);
  }
}, 90_000);

it('the sweep keeps the slot of a live owner whose task is still within its deadline',async()=>{
  const f=await fixture();const other=await fixture();const free=await f.enqueue('free');
  await prisma.$transaction(tx=>setTaskOperatorPolicy(tx,{...DEFAULT_TASK_POLICY,globalSlots:2}));
  const owner=randomUUID();
  try{
    await prisma.coreProcess.create({data:{bootNonce:owner,instanceId:randomUUID(),kind:'worker',hostname:'g1-live',pid:4244,databaseRole:'postgres',state:'LIVE',startedAt:new Date(),heartbeatAt:new Date()}});
    // The stale slot of a task that is beyond its deadline: it is released.
    const beyond=await other.enqueue('beyond');
    await prisma.pluginTask.update({where:{id:beyond.id},data:{status:'RUNNING',claimToken:randomUUID(),fence:1n,claimedByBootNonce:owner,leaseUntil:new Date(Date.now()-1000),deadlineAt:new Date(Date.now()-1000),startedAt:new Date(Date.now()-3_600_000)}});
    await prisma.pluginTaskExecutionSlot.create({data:{installationId:other.installationId,taskId:beyond.id,kind:'TASK',name:'render',version:1,claimToken:randomUUID(),fence:0n,bootNonce:owner,state:'ACTIVE',lastObservedAt:new Date(Date.now()-3_600_000)}});
    // The stale slot of a task that is still within its deadline: it is kept.
    const within=await other.enqueue('within');
    await prisma.pluginTask.update({where:{id:within.id},data:{status:'RUNNING',claimToken:randomUUID(),fence:1n,claimedByBootNonce:owner,leaseUntil:new Date(Date.now()+600_000),deadlineAt:new Date(Date.now()+600_000),startedAt:new Date(Date.now()-3_600_000)}});
    await prisma.pluginTaskExecutionSlot.create({data:{installationId:other.installationId,taskId:within.id,kind:'TASK',name:'render',version:1,claimToken:randomUUID(),fence:0n,bootNonce:owner,state:'LINGERING',lastObservedAt:new Date(Date.now()-3_600_000)}});
    const worker=f.worker(async()=>({done:true}));
    await worker.tick();await worker.drain();
    expect((await prisma.pluginTaskExecutionSlot.findFirstOrThrow({where:{taskId:beyond.id}})).state).toBe('RELEASED');
    expect((await prisma.pluginTaskExecutionSlot.findFirstOrThrow({where:{taskId:within.id}})).state).toBe('LINGERING');
    expect(await prisma.pluginTaskExecutionSlot.count({where:{state:{in:['ACTIVE','LINGERING']}}})).toBe(1);
    expect((await f.run(()=>f.api.get(free.id))).status).toBe('succeeded');
  }finally{
    await prisma.$transaction(tx=>setTaskOperatorPolicy(tx,DEFAULT_TASK_POLICY));
    await releaseProcessFixtures([owner]);
  }
}, 90_000);
