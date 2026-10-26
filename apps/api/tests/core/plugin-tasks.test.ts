import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { Client } from 'pg';
import { sweepPluginRecovery } from '@/core/admin/extension-installer/plugin-recovery';
import { prisma } from '@/config/database';
import { PluginTaskWorker } from '@/core/plugins/task-worker';
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
 * The budget of a single wait for a settled task state.
 *
 * The wait covers the start of the worker processes, the claim of a task, the
 * expiry of a lease and the settlement of the claim, so it is inherently
 * slower than an in process wait. The budget therefore has to fit a shard
 * that runs the rest of its files at the same time, including a file that
 * publishes plugin packages.
 */
const SETTLE_DEADLINE_MS = 20_000;
async function eventually(predicate: () => Promise<boolean>, deadlineMs = SETTLE_DEADLINE_MS) {
  const end = performance.now() + deadlineMs;
  while (!await predicate()) { if (performance.now() >= end) throw new Error('Task state did not settle before its deadline'); await delay(10); }
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
});
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
});
it('cancelling a failed task suppresses only its pending hook and keeps FAILED truthful', async () => {
  const f = await fixture({ hook: true, maxAttempts: 1 }); const task = await f.enqueue();
  const worker = f.worker(async () => { throw new Error('Final attempt'); });
  await worker.tick(); await worker.drain();
  const cancelled = await f.run(() => f.api.cancel(task.id));
  expect(cancelled.status).toBe('failed'); expect(cancelled.finalFailure).toEqual({ status: 'suppressed', suppressionReason: 'EXPLICIT_CANCEL' });
  expect((await f.run(() => f.api.cancel(task.id))).status).toBe('failed');
});
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
});
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
});
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
}, 60_000);

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
    await eventually(async () => (await f.run(() => f.api.get(task.id))).status === 'succeeded');
  } finally {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.send({ kind: 'stop' });
      const stopped = await Promise.race([exited.then(() => true), delay(SETTLE_DEADLINE_MS).then(() => false)]);
      if (!stopped) { child.kill('SIGKILL'); await exited; }
    }
  }
}, 180_000);

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
});
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
});
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
});
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
});

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
});

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
});

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
});

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
});

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
});

it('default retry delays preserve the admitted budget and mark only the last budgeted attempt final', async()=>{
  const f=await fixture({maxAttempts:5,hook:true});const task=await f.enqueue();
  for(const [index,backoff] of [60_000,300_000,900_000,3_600_000].entries()){
    const worker=f.worker(async(_claim,input)=>{expect(input.attempt).toBe(index+1);expect(input.isFinalAttempt).toBe(false);throw new Error('Retryable');},{retryMs:undefined});
    await worker.tick();await worker.drain();
    const row=await prisma.pluginTask.findUniqueOrThrow({where:{id:task.id}});
    const attempt=await prisma.pluginTaskAttempt.findUniqueOrThrow({where:{taskId_executionSequence:{taskId:task.id,executionSequence:row.executionSequence}}});
    expect(row.nextAttemptAt.getTime()-attempt.finishedAt!.getTime()).toBe(backoff);
    await prisma.pluginTask.updateMany({where:{id:task.id,status:'PENDING'},data:{nextAttemptAt:new Date(0)}});
  }
  const final=f.worker(async(_claim,input)=>{expect(input.attempt).toBe(5);expect(input.isFinalAttempt).toBe(true);return {done:true};},{retryMs:undefined});
  await final.tick();await final.drain();
  expect((await f.run(()=>f.api.get(task.id))).status).toBe('succeeded');
  expect(await prisma.pluginTaskFinalFailure.count({where:{taskId:task.id}})).toBe(0);
});

it('history cleanup retains permanent keys and distinct UTC buckets enqueue distinct tasks', async()=>{
  const f=await fixture();const key='cleanup:2026-10-20T10:10';const task=await f.enqueue(key);
  const worker=f.worker(async()=>({done:true}));await worker.tick();await worker.drain();
  await prisma.pluginTaskExecutionSlot.updateMany({where:{taskId:task.id,state:'RELEASED'},data:{releasedAt:new Date(Date.now()-31*86_400_000)}});
  await sweepPluginRecovery();
  expect(await prisma.pluginTaskExecutionSlot.count({where:{taskId:task.id}})).toBe(0);
  expect((await f.enqueue(key)).id).toBe(task.id);
  expect((await f.enqueue('cleanup:2026-10-20T10:11')).id).not.toBe(task.id);
});

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
});

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
});
