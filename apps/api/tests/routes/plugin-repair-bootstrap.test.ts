import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { buildApp } from '@/server';
import { prisma } from '@/config/database';
import { AuditService } from '@/core/audit/service';
import { PluginTaskWorker } from '@/core/plugins/task-worker';
import { prepareRepairBootstrap } from '@/core/extensions/runtime/plugin-runtime';
import * as pluginRuntime from '@/core/extensions/runtime/plugin-runtime';
import { assertCurrentDatabase } from '@/config/test-lane';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { ensureCoreProcess } from '@/infra/core-process';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import * as contractRuntime from '@/core/admin/extension-installer/contract-v1-runtime';
import { createUserWithToken } from '../helpers/auth';
import { pageFiles, pageManifest, pageZip } from '../fixtures/plugin-pages';

let app: Awaited<ReturnType<typeof buildApp>>;
let admin: Awaited<ReturnType<typeof createUserWithToken>>;
const slugs: string[] = [];
const users: string[] = [];
beforeAll(async () => { app = await buildApp(); admin = await createUserWithToken({ role: 'ADMIN' }); users.push(admin.user.id); });
afterAll(async () => {
  vi.restoreAllMocks();
  assertCurrentDatabase((await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name);
  const installations = await prisma.pluginInstallation.findMany({ where: { pluginSlug: { in: slugs } } });
  for (const installation of installations) await pluginRuntime.dropInternalRuntime(installation.id);
  await prisma.pluginTaskExecutionSlot.deleteMany({ where: { installationId: { in: installations.map(item => item.id) } } });
  await prisma.pluginTaskFairness.deleteMany({ where: { installationId: { in: installations.map(item => item.id) } } });
  for (const slug of slugs) await cleanupPluginMigrationFixture(slug);
  await prisma.pluginInstall.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await app?.close();
});
async function fixture(options: { optIn?: boolean; missingHandler?: boolean; wrongOptions?: boolean; lifecycle?: boolean } = {}) {
  const slug = `bootstrap-${randomUUID().slice(0, 8)}`; slugs.push(slug);
  const manifest = pageManifest(slug);
  delete manifest.services; delete manifest.serviceDependencies;
  manifest.tasks = [{ name: 'restore-state', version: 1, concurrency: 1, maxAttempts: 1, maxRuntimeSeconds: 30 }];
  if (options.optIn !== false) manifest.repairBootstrap = { name: 'restore-state', version: 1 };
  if (options.lifecycle) manifest.lifecycle = { onEnable: true };
  const files = pageFiles(manifest);
  if (options.missingHandler) files.find(file => file.path === 'server/index.js')!.content = Buffer.from('module.exports = { register() {} };');
  if (options.wrongOptions) files.find(file => file.path === 'server/index.js')!.content = Buffer.from(`module.exports = { register(ctx) { ctx.tasks.handle('restore-state', 1, async () => null, { concurrency: 2, maxAttempts: 1, maxRuntimeSeconds: 30 }); } };`);
  if (options.lifecycle) {
    const entry = files.find(file => file.path === 'server/index.js')!;
    entry.content = Buffer.concat([entry.content, Buffer.from('\nmodule.exports.__lifecycle_onEnable = async () => {};')]);
  }
  const bytes = await pageZip(files); const zipHash = createHash('sha256').update(bytes).digest('hex');
  const plugin = await prisma.pluginInstall.create({ data: { slug, name: slug, version: manifest.version, manifestJson: JSON.parse(JSON.stringify(manifest)), zipHash, source: 'local-zip', entryModule: manifest.entryModule,
    packageBlobs: { create: { zipHash, bytes, sizeBytes: bytes.length } }, installations: { create: { instanceKey: 'default', enabled: true } } }, include: { installations: true } });
  const installationId = plugin.installations[0].id;
  const post = (payload: unknown = { idempotencyKey: 'first', reason: 'OPERATOR_REPAIR' }, token: string | null = admin.token) => app.inject({ method: 'POST', url: `/api/v1/extensions/plugin/${slug}/instances/${installationId}/repair-bootstrap`, ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}), payload: payload as object });
  return { slug, manifest, installationId, post };
}

it('requires a live Admin session and audits rejected authentication without a task', async () => {
  const f = await fixture();
  expect((await f.post(undefined, null)).statusCode).toBe(401);
  const customer = await createUserWithToken(); users.push(customer.user.id);
  expect((await f.post(undefined, customer.token)).statusCode).toBe(403);
  for (const state of [{ isActive: false }, { removedAt: new Date() }, { sessionVersion: 1 }]) {
    const actor = await createUserWithToken({ role: 'ADMIN' }); users.push(actor.user.id);
    await prisma.user.update({ where: { id: actor.user.id }, data: state });
    expect([401, 403]).toContain((await f.post(undefined, actor.token)).statusCode);
  }
  expect(await prisma.pluginTask.count({ where: { installationId: f.installationId } })).toBe(0);
  expect(await prisma.adminAuditEvent.count({ where: { targetId: f.installationId, action: 'PLUGIN_TASK_BOOTSTRAP_REJECTED' } })).toBe(5);
});

it('rejects arbitrary authority, task, payload, schedule and non-string input without stripping or coercion', async () => {
  const f = await fixture();
  for (const field of ['task', 'name', 'version', 'payload', 'owner', 'principal', 'actor', 'actorId', 'runAt', 'delayMs', 'schedule']) {
    expect((await f.post({ idempotencyKey: 'bad', reason: 'REPAIR', [field]: 'injected' })).statusCode).toBe(400);
  }
  for (const payload of [{ idempotencyKey: 123, reason: 'REPAIR' }, { idempotencyKey: 'bad', reason: 123 }, { idempotencyKey: 'bad', reason: 'REPAIR\n' }, { idempotencyKey: 'bad\n', reason: 'REPAIR' }]) {
    expect((await f.post(payload)).statusCode).toBe(400);
  }
  expect(await prisma.pluginTask.count({ where: { installationId: f.installationId } })).toBe(0);
});

it('requires explicit manifest opt-in and a real registered handler', async () => {
  const ordinary = await fixture({ optIn: false });
  expect((await ordinary.post()).statusCode).toBe(403);
  const missing = await fixture({ missingHandler: true });
  expect((await missing.post()).statusCode).toBeGreaterThanOrEqual(400);
  expect(await prisma.pluginTask.count({ where: { installationId: missing.installationId } })).toBe(0);
  const wrong = await fixture({ wrongOptions: true });
  expect((await wrong.post()).statusCode).toBeGreaterThanOrEqual(400);
  expect(await prisma.pluginTask.count({ where: { installationId: wrong.installationId } })).toBe(0);
});

it('enables an opted-in installation through its real lifecycle without creating a bootstrap task', async () => {
  const f = await fixture({ lifecycle: true });
  await prisma.pluginInstallation.update({ where: { id: f.installationId }, data: { enabled: false } });
  const enabled = await PluginManagementService.updateInstance(f.installationId, { enabled: true });
  expect(enabled.enabled).toBe(true);
  expect(await prisma.pluginTask.count({ where: { installationId: f.installationId } })).toBe(0);
  expect(await prisma.pluginPrincipal.count({ where: { installationId: f.installationId } })).toBe(0);
});

it('times out blocked registration and releases the late runtime lease before retirement', async () => {
  const started = Date.now();
  const beforeDeadline = async <T>(operation: Promise<T>, deadline: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Repair readiness test stage exceeded its deadline')), Math.max(0, deadline - Date.now()));
      })]);
    } finally { if (timer) clearTimeout(timer); }
  };
  const f = await beforeDeadline(fixture(), started + 5_000);
  let release!: () => void; let entered = false; let retired = false; let closed = false;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const originalRegister = contractRuntime.registerContractV1Runtime;
  const registration = vi.spyOn(contractRuntime, 'registerContractV1Runtime').mockImplementation(async (runtimeApp, entry, options) => {
    runtimeApp.addHook('onClose', async () => { closed = true; });
    entered = true; await barrier;
    return originalRegister(runtimeApp, entry, options);
  });
  const readiness = prepareRepairBootstrap(f.slug, f.installationId);
  const rejected = expect(readiness).rejects.toMatchObject({ code: 'PLUGIN_TIMEOUT' });
  let mainFailed = false; let mainFailure: unknown;
  try {
    await beforeDeadline(vi.waitFor(() => expect(entered).toBe(true), { timeout: 5_000 }), started + 15_000);
    // Use the real readiness deadline; package materialization has its own equal-duration timer.
    await beforeDeadline(rejected, started + 15_000);
    expect(await beforeDeadline(prisma.pluginTask.count({ where: { installationId: f.installationId } }), started + 15_000)).toBe(0);
  } catch (error) { mainFailed = true; mainFailure = error;
  } finally {
    release();
    registration.mockRestore();
    const cleanupDeadline = Date.now() + 4_000;
    try {
      await beforeDeadline(Promise.allSettled([readiness, rejected]), cleanupDeadline);
      if (entered) {
        while (!retired || !closed) {
          if (!retired) retired = await beforeDeadline(pluginRuntime.dropInternalRuntime(f.installationId), cleanupDeadline);
          if (!retired || !closed) await beforeDeadline(new Promise<void>(resolve => setTimeout(resolve, 25)), cleanupDeadline);
        }
        expect(retired).toBe(true); expect(closed).toBe(true);
      }
    } catch (error) {
      if (mainFailed) throw new AggregateError([mainFailure, error], 'Repair readiness assertion and bounded cleanup both failed');
      throw error;
    }
  }
  if (mainFailed) throw mainFailure;
});

it('enqueues one unbound task concurrently, replays terminal state and rejects changed reason or declaration', async () => {
  const f = await fixture();
  const replies = await Promise.all([f.post(), f.post()]);
  for (const response of replies) expect(response.statusCode, response.body).toBe(200);
  const id = replies[0].json().data.id;
  expect(replies[1].json().data.id).toBe(id);
  const task = await prisma.pluginTask.findUniqueOrThrow({ where: { id } });
  expect(task.principalType).toBeNull(); expect(task.principalId).toBeNull(); expect(task.payload).toEqual({ reason: 'OPERATOR_REPAIR' });
  expect(await prisma.pluginPrincipal.count({ where: { installationId: f.installationId } })).toBe(0);
  expect((await f.post({ idempotencyKey: 'first', reason: 'OTHER_REASON' })).statusCode).toBe(409);
  expect((await f.post({ idempotencyKey: 'second', reason: 'OPERATOR_REPAIR' })).statusCode).toBe(409);
  const worker = new PluginTaskWorker({ installationIds: [f.installationId] });
  try { await worker.tick(); await worker.drain(); } finally { await worker.drain(); }
  const replay = await f.post(); expect(replay.statusCode, replay.body).toBe(200); expect(replay.json().data.id).toBe(id);
  expect(replay.json().data.status).toBe('succeeded');
  expect(await prisma.adminAuditEvent.count({ where: { targetId: id, action: 'PLUGIN_TASK_BOOTSTRAP_ALLOWED' } })).toBe(3);
  f.manifest.tasks![0].version = 2; f.manifest.repairBootstrap!.version = 2;
  const bytes = await pageZip(pageFiles(f.manifest)); const zipHash = createHash('sha256').update(bytes).digest('hex');
  await prisma.pluginInstall.update({ where: { slug: f.slug }, data: { zipHash, manifestJson: JSON.parse(JSON.stringify(f.manifest)), packageBlobs: { create: { zipHash, bytes, sizeBytes: bytes.length } } } });
  expect((await f.post()).statusCode).toBe(409);
});

it('rejects disabled and unavailable dependencies and never enqueues during readiness alone', async () => {
  const f = await fixture(); await prepareRepairBootstrap(f.slug, f.installationId);
  expect(await prisma.pluginTask.count({ where: { installationId: f.installationId } })).toBe(0);
  await prisma.pluginInstallation.update({ where: { id: f.installationId }, data: { taskDependencyUnavailable: true } });
  expect((await f.post()).statusCode).toBeGreaterThanOrEqual(400);
  await prisma.pluginInstallation.update({ where: { id: f.installationId }, data: { taskDependencyUnavailable: false, enabled: false } });
  expect((await f.post()).statusCode).toBeGreaterThanOrEqual(400);
});

it('rolls back the task when the transactional success audit fails', async () => {
  const f = await fixture();
  const original = AuditService.write;
  const spy = vi.spyOn(AuditService, 'write').mockImplementation((tx, event) => {
    if (event.action === 'PLUGIN_TASK_BOOTSTRAP_ALLOWED') throw new Error('Audit unavailable');
    return original(tx, event);
  });
  try { expect((await f.post()).statusCode).toBe(500); } finally { spy.mockRestore(); }
  expect(await prisma.pluginTask.count({ where: { installationId: f.installationId } })).toBe(0);
  expect(await prisma.adminAuditEvent.count({ where: { action: 'PLUGIN_TASK_BOOTSTRAP_ALLOWED', summary: { path: ['installationId'], equals: f.installationId } } })).toBe(0);
});

it('rechecks generation, package identity and enabled state after readiness', async () => {
  for (const mutation of ['generation', 'zipHash', 'disabled', 'session'] as const) {
    const f = await fixture();
    const actor = await createUserWithToken({ role: 'ADMIN' }); users.push(actor.user.id);
    const original = pluginRuntime.prepareRepairBootstrap;
    const spy = vi.spyOn(pluginRuntime, 'prepareRepairBootstrap').mockImplementation(async (...args) => {
      const permit = await original(...args);
      if (mutation === 'zipHash') await prisma.pluginInstall.update({ where: { slug: f.slug }, data: { zipHash: 'f'.repeat(64) } });
      else if (mutation === 'session') await prisma.user.update({ where: { id: actor.user.id }, data: { sessionVersion: { increment: 1 } } });
      else await prisma.pluginInstallation.update({ where: { id: f.installationId }, data: mutation === 'disabled' ? { enabled: false } : { protectionGeneration: { increment: 1 } } });
      return permit;
    });
    try { expect((await f.post(undefined, actor.token)).statusCode).toBeGreaterThanOrEqual(400); } finally { spy.mockRestore(); }
    expect(await prisma.pluginTask.count({ where: { installationId: f.installationId } })).toBe(0);
  }
});

it('keeps unknown final hooks occupied while allowing exact historical replay', async () => {
  const f = await fixture(); const created = await f.post(); expect(created.statusCode, created.body).toBe(200);
  const id = created.json().data.id;
  await prisma.pluginTask.update({ where: { id }, data: { status: 'FAILED' } });
  await prisma.pluginTaskFinalFailure.create({ data: { taskId: id, name: 'restore-state', version: 1, status: 'UNKNOWN', maxRuntimeSeconds: 1 } });
  expect((await f.post()).statusCode).toBe(200);
  expect((await f.post({ idempotencyKey: 'next', reason: 'REPAIR' })).statusCode).toBe(409);
  await prisma.pluginTaskFinalFailure.update({ where: { taskId: id }, data: { status: 'SUPPRESSED' } });
  await prisma.pluginTaskExecutionSlot.create({ data: { installationId: f.installationId, taskId: id, kind: 'TASK', name: 'restore-state', version: 1, claimToken: randomUUID(), fence: 1n, bootNonce: await ensureCoreProcess(), state: 'LINGERING' } });
  expect((await f.post({ idempotencyKey: 'after-hook', reason: 'REPAIR' })).statusCode).toBe(409);
});

it.each(['task-pending', 'task-running', 'hook-pending', 'hook-running', 'hook-unknown', 'slot-active', 'slot-lingering'] as const)('blocks another key for %s and preserves occupancy across a manifest task rename', async state => {
  const f = await fixture(); const response = await f.post(); expect(response.statusCode, response.body).toBe(200);
  const id = response.json().data.id;
  const runningClaim = async () => {
    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: f.installationId }, include: { plugin: true } });
    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + (state === 'hook-running' ? 1_000 : 30_000));
    return { claimToken: randomUUID(), fence: 1n, bootNonce: await ensureCoreProcess(), startedAt, leaseUntil: deadlineAt, deadlineAt, zipHash: installation.plugin.zipHash, generation: installation.protectionGeneration };
  };
  if (state === 'task-running') {
    const { bootNonce, ...claim } = await runningClaim();
    await prisma.pluginTask.update({ where: { id }, data: { status: 'RUNNING', ...claim, claimedByBootNonce: bootNonce, executionSequence: 1 } });
  } else if (state !== 'task-pending') await prisma.pluginTask.update({ where: { id }, data: { status: 'FAILED' } });
  if (state.startsWith('hook-')) {
    await prisma.pluginTaskFinalFailure.create({ data: { taskId: id, name: 'restore-state', version: 1, status: state.slice(5).toUpperCase(), maxRuntimeSeconds: 1, ...(state === 'hook-running' ? await runningClaim() : {}) } });
  }
  if (state.startsWith('slot-')) {
    await prisma.pluginTaskExecutionSlot.create({ data: { installationId: f.installationId, taskId: id, kind: 'TASK', name: 'restore-state', version: 1, claimToken: randomUUID(), fence: 1n, bootNonce: await ensureCoreProcess(), state: state.slice(5).toUpperCase() } });
  }
  expect((await f.post({ idempotencyKey: 'second', reason: 'REPAIR' })).statusCode).toBe(409);
  f.manifest.tasks![0].name = 'recover-state'; f.manifest.repairBootstrap!.name = 'recover-state';
  const bytes = await pageZip(pageFiles(f.manifest)); const zipHash = createHash('sha256').update(bytes).digest('hex');
  await prisma.pluginInstall.update({ where: { slug: f.slug }, data: { zipHash, manifestJson: JSON.parse(JSON.stringify(f.manifest)), packageBlobs: { create: { zipHash, bytes, sizeBytes: bytes.length } } } });
  expect((await f.post({ idempotencyKey: 'after-rename', reason: 'REPAIR' })).statusCode).toBe(409);
  expect((await f.post()).statusCode).toBe(409);
});
