import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import archiver from 'archiver';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { snapshotPluginRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';

const prisma = getTestPrisma();
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const slug = () => `immutable-${randomUUID().slice(0, 12)}`;
const source = (tag: string, blocked = false) => `module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/status', handler: async () => {
    if (${blocked} && globalThis.__pluginBarrier) {
      globalThis.__pluginBarrier.enter();
      await globalThis.__pluginBarrier.release;
    }
    return { tag: '${tag}' };
  } });
} };`;

async function archive(pluginSlug: string, tag: string, options: {
  version?: string; code?: string; incompleteSignature?: boolean; padding?: Buffer;
} = {}): Promise<Buffer> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'immutable-zip-'));
  const target = path.join(root, 'plugin.zip');
  try {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(target);
      const zip = archiver('zip', { zlib: { level: 9 } });
      output.once('close', resolve);
      output.once('error', reject);
      zip.once('error', reject);
      zip.pipe(output);
      zip.append(JSON.stringify({
        schemaVersion: 1, slug: pluginSlug, name: pluginSlug, version: options.version ?? '1.0.0',
        description: 'Immutable package test', author: 'Test', category: 'integration',
        runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
        entryModule: 'server/index.js', permissions: [], contracts: [],
      }), { name: 'manifest.json' });
      zip.append(options.code ?? source(tag), { name: 'server/index.js' });
      if (options.padding) zip.append(options.padding, { name: 'padding.bin' });
      if (options.incompleteSignature) zip.append('{}', { name: 'META-INF/jiffoo/package-signature.json' });
      void zip.finalize();
    });
    return await fs.readFile(target);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

describe('immutable plugin package deployment', () => {
  let app: FastifyInstance;
  let base: string;
  let token: string;
  const slugs = new Set<string>();
  const own = () => { const id = slug(); slugs.add(id); return id; };
  let before: Awaited<ReturnType<typeof snapshotPluginRows>>;
  beforeEach(async () => { before = await snapshotPluginRows(); });

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    token = (await createAdminWithToken()).token;
    base = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterEach(async () => {
    for (const id of slugs) {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: id } });
      await prisma.pluginInstall.deleteMany({ where: { slug: id } });
      await cleanupPluginMigrationFixture(id);
      await clearTestPluginCache(id);
    }
    slugs.clear();
    await assertPluginRowsUnchanged(before);
  });
  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  async function upload(bytes: Buffer, confirmUnsigned = true, expectedPhase = 'SUCCESS') {
    return uploadTo(base, bytes, confirmUnsigned, expectedPhase);
  }
  async function uploadTo(url: string, bytes: Buffer, confirmUnsigned = true, expectedPhase = 'SUCCESS') {
    const { uploadPluginZip, completedPluginUploadBody } = await import('../helpers/plugin-upload');
    const response = await uploadPluginZip(url, token, bytes, confirmUnsigned, expectedPhase);
    return { status: response.status, body: await completedPluginUploadBody(response) };
  }
  async function enabled(id: string) {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: id, instanceKey: 'default' } },
    });
    const response = await fetch(`${base}/api/v1/extensions/plugin/${id}/instances/${instance.id}`, {
      method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(response.status).toBe(200);
  }
  const status = (id: string) => fetch(`${base}/api/v1/extensions/plugin/${id}/api/status`);
  async function packagePath(id: string, zipHash: string) {
    const pkg = await pluginPackageStore.get(id, zipHash);
    expect(pkg).not.toBeNull();
    return pkg!.getEntryPath('');
  }
  async function blobInvariant(id: string, bytes: Buffer) {
    const rows = await prisma.pluginPackageBlob.findMany({
      where: { pluginSlug: id }, select: { zipHash: true, sizeBytes: true },
    });
    expect(rows).toEqual([{ zipHash: hash(bytes), sizeBytes: bytes.length }]);
    expect(Buffer.from((await pluginPackageBlobStore.get(id, hash(bytes)))!.bytes)).toEqual(bytes);
  }
  function child(stage: 'acquired' | 'published') {
    return fork(path.resolve('tests/helpers/plugin-lease-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_LEASE_BARRIER: stage },
    });
  }
  function message(process: ChildProcess, kind: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        process.off('message', receive);
        process.off('error', fail);
        process.off('exit', exit);
      };
      const fail = (error: Error) => { cleanup(); reject(error); };
      const exit = (code: number | null) => fail(new Error(`Child exited before ${kind}: ${code}`));
      const receive = (value: any) => {
        if (value?.kind !== kind && value?.kind !== 'error') return;
        cleanup();
        if (value.kind === 'error') reject(new Error(value.message));
        else resolve(value);
      };
      process.on('message', receive);
      process.on('error', fail);
      process.on('exit', exit);
    });
  }
  async function stop(childProcess: ChildProcess) {
    if (childProcess.exitCode !== null) return;
    const exited = once(childProcess, 'exit');
    childProcess.send({ kind: 'stop' });
    await exited;
  }

  async function isolatedChild(options: { observe?: boolean; barrier?: boolean } = {}) {
    const builtinSlugs = (await prisma.pluginInstall.findMany({ where: { source: 'builtin' } })).map((row) => row.slug);
    const builtinBefore = await snapshotPluginRows(builtinSlugs);
    const rowsBefore = await snapshotPluginRows();
    const root = await fs.mkdtemp(path.join(tmpdir(), 'materialize-cache-'));
    expect(await fs.readdir(root)).toEqual([]);
    const worker = fork(path.resolve('tests/helpers/plugin-lease-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env, NODE_ENV: 'test', EXTENSIONS_PATH: root,
        JIFFOO_TEST_ISOLATED_PLUGIN_ROOT: '1',
        JIFFOO_TEST_BUILTIN_SOURCE_ROOT: path.resolve(process.env.EXTENSIONS_PATH || 'extensions'),
        JIFFOO_TEST_PLUGIN_MATERIALIZE_OBSERVE: options.observe ? '1' : '0',
        JIFFOO_TEST_PLUGIN_MATERIALIZE_BARRIER: options.barrier ? '1' : '0',
      },
    });
    const ready = await message(worker, 'ready');
    return { worker, root, base: ready.base as string, builtinSlugs, builtinBefore, rowsBefore };
  }
  async function closeIsolated(child: Awaited<ReturnType<typeof isolatedChild>>) {
    child.worker.send({ kind: 'plugin-materialize-release' });
    await stop(child.worker);
    await fs.rm(child.root, { recursive: true, force: true });
    // Resolution-failure scenarios deliberately record health on caller-owned fixtures.
    // Reset those fields after the child stops, then compare every complete row.
    for (const row of child.rowsBefore.installations.filter((row) => slugs.has(row.pluginSlug))) {
      await prisma.pluginInstallation.update({ where: { id: row.id }, data: {
        lastFailureAt: row.lastFailureAt, lastFailureMessage: row.lastFailureMessage, updatedAt: row.updatedAt,
      } });
    }
    await assertPluginRowsUnchanged(child.builtinBefore, child.builtinSlugs);
    await assertPluginRowsUnchanged(child.rowsBefore);
  }
  const check = async (url: string, id: string) => {
    const response = await fetch(`${url}/api/v1/extensions/plugin/${id}/api/status`);
    return { status: response.status, body: await response.json() };
  };

  it('A a separate process with an empty root materializes and runs the DB-current ZIP', async () => {
    const id = own();
    expect((await upload(await archive(id, 'remote'))).status).toBe(200);
    await enabled(id);
    const child = await isolatedChild();
    try {
      await expect(fs.access(path.join(child.root, 'plugins', id))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await check(child.base, id)).toMatchObject({ status: 200, body: { tag: 'remote' } });
    } finally { await closeIsolated(child); }
  });

  it.each(['bytes', 'sizeBytes'] as const)('B tampered %s is corrupt and cannot execute the entry', async (tamper) => {
    const id = own();
    const zip = await archive(id, 'never', {
      code: `if (process.env.JIFFOO_TEST_ISOLATED_PLUGIN_ROOT === '1') require('fs').writeFileSync(${JSON.stringify(path.join(tmpdir(), `materialize-effect-${id}`))}, 'executed'); ${source('never')}`,
    });
    const effect = path.join(tmpdir(), `materialize-effect-${id}`);
    expect((await upload(zip)).status).toBe(200);
    await enabled(id);
    await prisma.pluginPackageBlob.update({
      where: { pluginSlug_zipHash: { pluginSlug: id, zipHash: hash(zip) } },
      data: tamper === 'bytes' ? { bytes: Buffer.from('tampered') } : { sizeBytes: zip.length + 1 },
    });
    const child = await isolatedChild();
    try {
      expect(await check(child.base, id)).toMatchObject({ status: 500, body: { error: { code: 'PLUGIN_PACKAGE_CORRUPT' } } });
      await expect(fs.access(effect)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await closeIsolated(child); await fs.rm(effect, { force: true }); }
  });

  it('C concurrent requests for one hash read and publish exactly once', async () => {
    const id = own();
    expect((await upload(await archive(id, 'shared'))).status).toBe(200);
    await enabled(id);
    const child = await isolatedChild({ observe: true, barrier: true });
    const seen: string[] = [];
    child.worker.on('message', (value: any) => { if (value?.kind?.startsWith('plugin-materialize-')) seen.push(value.kind); });
    try {
      const ready = message(child.worker, 'plugin-materialize-ready');
      const first = check(child.base, id);
      expect((await ready).slug).toBe(id);
      const second = check(child.base, id);
      const released = message(child.worker, 'plugin-materialize-released');
      child.worker.send({ kind: 'plugin-materialize-release' });
      expect((await released).slug).toBe(id);
      expect((await Promise.all([first, second])).map((result) => result.status)).toEqual([200, 200]);
      expect(seen.filter((kind) => kind === 'plugin-materialize-read')).toHaveLength(1);
      expect(seen.filter((kind) => kind === 'plugin-materialize-publish')).toHaveLength(1);
    } finally { await closeIsolated(child); }
  });

  it('D a missing blob returns PLUGIN_PACKAGE_UNAVAILABLE', async () => {
    const id = own();
    const zip = await archive(id, 'missing');
    expect((await upload(zip)).status).toBe(200);
    await enabled(id);
    await prisma.pluginPackageBlob.delete({ where: { pluginSlug_zipHash: { pluginSlug: id, zipHash: hash(zip) } } });
    const child = await isolatedChild();
    try {
      expect(await check(child.base, id)).toMatchObject({ status: 503, body: { error: { code: 'PLUGIN_PACKAGE_UNAVAILABLE' } } });
    } finally { await closeIsolated(child); }
  });

  it('E a held materialization times out and a late publish serves the next call', async () => {
    const id = own();
    expect((await upload(await archive(id, 'late'))).status).toBe(200);
    await enabled(id);
    const child = await isolatedChild({ barrier: true });
    try {
      const ready = message(child.worker, 'plugin-materialize-ready');
      const started = Date.now();
      const first = check(child.base, id);
      expect((await ready).slug).toBe(id);
      expect(await first).toMatchObject({ status: 503, body: { error: { code: 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT' } } });
      expect(Date.now() - started).toBeLessThan(12_000);
      const released = message(child.worker, 'plugin-materialize-released');
      child.worker.send({ kind: 'plugin-materialize-release' });
      expect((await released).slug).toBe(id);
      expect(await check(child.base, id)).toMatchObject({ status: 200, body: { tag: 'late' } });
    } finally { await closeIsolated(child); }
  }, 20_000);

  it('G only two different hashes enter materialization concurrently', async () => {
    const ids = [own(), own(), own()];
    for (const id of ids) {
      expect((await upload(await archive(id, id))).status).toBe(200);
      await enabled(id);
    }
    const child = await isolatedChild({ barrier: true, observe: true });
    const reads: string[] = [];
    child.worker.on('message', (value: any) => { if (value?.kind === 'plugin-materialize-read') reads.push(value.slug); });
    try {
      const finished = message(child.worker, 'resolved-packages');
      void finished.catch(() => undefined);
      const firstTwo = new Promise<string[]>((resolve) => {
        const seen: string[] = [];
        const observe = (value: any) => {
          if (value?.kind !== 'plugin-materialize-ready') return;
          seen.push(value.slug);
          if (seen.length === 2) { child.worker.off('message', observe); resolve(seen); }
        };
        child.worker.on('message', observe);
      });
      child.worker.send({ kind: 'resolve-packages', slugs: ids });
      const active = new Set(await firstTwo);
      expect(active.size).toBe(2);
      expect([...active].every((id) => ids.includes(id))).toBe(true);
      expect(new Set(reads)).toEqual(active);
      const thirdReady = message(child.worker, 'plugin-materialize-ready');
      child.worker.send({ kind: 'plugin-materialize-release' });
      expect(ids.filter((id) => !active.has(id))).toEqual([(await thirdReady).slug]);
      child.worker.send({ kind: 'plugin-materialize-release' });
      expect((await finished).results).toEqual(['ok', 'ok', 'ok']);
      expect(new Set(reads)).toEqual(new Set(ids));
    } finally { await closeIsolated(child); }
  }, 60_000);

  it('H a changed DB-current hash cannot run the old candidate', async () => {
    const id = own();
    expect((await upload(await archive(id, 'old'))).status).toBe(200);
    await enabled(id);
    const child = await isolatedChild({ barrier: true });
    try {
      const ready = message(child.worker, 'plugin-materialize-ready');
      const first = check(child.base, id);
      expect((await ready).slug).toBe(id);
      expect((await upload(await archive(id, 'new', { version: '2.0.0' }))).status).toBe(200);
      // The parent intentionally upgrades this fixture while the child is held.
      child.rowsBefore = await snapshotPluginRows();
      child.worker.send({ kind: 'plugin-materialize-release' });
      expect(await first).toMatchObject({ status: 503, body: { error: { code: 'PLUGIN_PACKAGE_UNAVAILABLE' } } });
      const nextReady = message(child.worker, 'plugin-materialize-ready');
      const next = check(child.base, id);
      expect((await nextReady).slug).toBe(id);
      child.worker.send({ kind: 'plugin-materialize-release' });
      expect(await next).toMatchObject({ status: 200, body: { tag: 'new' } });
    } finally { await closeIsolated(child); }
  });

  it('I plugin uploads reject over 10 MiB', async () => {
    const id = own();
    const large = await archive(id, 'large', { padding: randomBytes(10 * 1024 * 1024) });
    expect(large.length).toBeGreaterThan(10 * 1024 * 1024);
    const rejectedUpload = await upload(large);
    expect(rejectedUpload, JSON.stringify(rejectedUpload)).toMatchObject({ status: 413, body: { error: { code: 'PAYLOAD_TOO_LARGE' } } });
  });

  it('A new install persists the exact ZIP bytes, hash, and size', async () => {
    const id = own();
    const zip = await archive(id, 'blob');
    expect((await upload(zip)).status).toBe(200);
    await blobInvariant(id, zip);
  });

  it('B upgrade retains only the new ZIP blob', async () => {
    const id = own();
    expect((await upload(await archive(id, 'old'))).status).toBe(200);
    const next = await archive(id, 'new', { version: '2.0.0' });
    expect((await upload(next)).status).toBe(200);
    await blobInvariant(id, next);
  });

  it('C signature rejection leaves the row and blob unchanged without a lease', async () => {
    const id = own();
    const original = await archive(id, 'old');
    expect((await upload(original)).status).toBe(200);
    expect((await upload(await archive(id, 'bad', { incompleteSignature: true }))).status).toBe(422);
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(original));
    await blobInvariant(id, original);
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug: id } })).toBeNull();
  });

  it('C candidate prewarm failure preserves the row and blob without a lease', async () => {
    const id = own();
    const original = await archive(id, 'old');
    expect((await upload(original)).status).toBe(200);
    await enabled(id);
    const bad = await archive(id, 'bad', { version: '2.0.0', code: 'module.exports = {};' });
    const failed = await upload(bad, true, 'FAILED');
    expect(failed.status).toBe(200); expect(failed.body.operation.errorCode).toBe('PLUGIN_LOAD_FAILED');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(original));
    await blobInvariant(id, original);
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug: id } })).toBeNull();
  });

  it('D identical ZIP keeps one blob and repairs a missing blob on reupload', async () => {
    const id = own();
    const zip = await archive(id, 'same');
    expect((await upload(zip)).status).toBe(200);
    const initial = await pluginPackageBlobStore.get(id, hash(zip));
    expect((await upload(zip)).status).toBe(200);
    expect((await pluginPackageBlobStore.get(id, hash(zip)))?.id).toBe(initial?.id);
    await blobInvariant(id, zip);
    await prisma.pluginPackageBlob.delete({ where: { pluginSlug_zipHash: { pluginSlug: id, zipHash: hash(zip) } } });
    expect((await upload(zip)).status).toBe(200);
    await blobInvariant(id, zip);
  });

  it('E soft uninstall retains the blob, restore succeeds, and purge removes it', async () => {
    const id = own();
    const zip = await archive(id, 'retained');
    expect((await upload(zip)).status).toBe(200);
    const headers = { authorization: `Bearer ${token}` };
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}`, { method: 'DELETE', headers })).status).toBe(200);
    await blobInvariant(id, zip);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/restore`, { method: 'POST', headers })).status).toBe(200);
    await blobInvariant(id, zip);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}`, { method: 'DELETE', headers })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/purge`, { method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ confirmationSlug: id }) })).status).toBe(200);
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: id } })).toBe(0);
  });

  it('F builtin blobs match the installed hash and are unique per slug and hash', async () => {
    for (const slug of ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email']) {
      const installed = await prisma.pluginInstall.findUnique({ where: { slug } });
      const blobs = await prisma.pluginPackageBlob.findMany({ where: { pluginSlug: slug } });
      for (const blob of blobs) expect(blob.zipHash).toBe(installed?.zipHash);
      expect(new Set(blobs.map(blob => `${blob.pluginSlug}:${blob.zipHash}`)).size).toBe(blobs.length);
    }
  });

  it('G concurrent uploads of one slug reject the second while the first holds its lease', async () => {
    const id = own();
    const zip = await archive(id, 'held');
    const worker = child('acquired');
    try {
      const ready = await message(worker, 'ready');
      const entered = message(worker, 'plugin-lease-ready');
      const first = uploadTo(ready.base, zip);
      await entered;
      const second = await upload(zip);
      expect(second).toMatchObject({ status: 409, body: { error: { code: 'PLUGIN_OPERATION_IN_PROGRESS' } } });
      worker.send({ kind: 'plugin-lease-release' });
      expect((await first).status).toBe(200);
      await blobInvariant(id, zip);
    } finally {
      worker.send({ kind: 'plugin-lease-release' });
      await stop(worker);
    }
  });

  it('H expired lease takeover fences the old publisher without deleting the new lease', async () => {
    const id = own();
    const oldZip = await archive(id, 'old');
    const newZip = await archive(id, 'new', { version: '2.0.0' });
    const a = child('published');
    const b = child('published');
    try {
      const [aReady, bReady] = await Promise.all([message(a, 'ready'), message(b, 'ready')]);
      const aEntered = message(a, 'plugin-lease-ready');
      const first = uploadTo(aReady.base, oldZip, true, 'NEEDS_RECOVERY');
      const firstSettled = first.then(result => ({ result, error: undefined }), error => ({ result: undefined, error }));
      await aEntered;
      await prisma.pluginOperationLease.update({ where: { slug: id }, data: { expiresAt: new Date(0) } });
      const bEntered = message(b, 'plugin-lease-ready');
      const second = uploadTo(bReady.base, newZip);
      await Promise.race([bEntered, second.then(result => { throw new Error(`Takeover finished before publication barrier: ${JSON.stringify(result)}`); })]);
      const bLease = await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug: id } });
      const abandoned = await prisma.pluginMigrationOperation.findFirstOrThrow({ where: { slug: id, packageVersion: '1.0.0' } });
      expect(abandoned).toMatchObject({ phase: 'NEEDS_RECOVERY', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', recoveryState: 'LEASE_EXPIRED' });
      expect(Buffer.from(abandoned.artifactBytes!)).toEqual(oldZip);
      const aDrained = message(a, 'operations-drained');
      a.send({ kind: 'plugin-lease-release' });
      a.send({ kind: 'drain-operations' });
      await aDrained;
      const outcome = await firstSettled;
      expect(outcome.error).toBeUndefined();
      expect(outcome.result).toMatchObject({ status: 200, body: { operation: { phase: 'NEEDS_RECOVERY' } } });
      const fenced = await fetch(`${aReady.base}/api/v1/extensions/plugin/operations/${outcome.result!.body.operation.operationId}`, { headers: { authorization: `Bearer ${token}` } });
      expect(fenced.status).toBe(200);
      expect((await fenced.json()).data).toMatchObject({ phase: 'NEEDS_RECOVERY', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', committedPrefix: 0 });
      expect(await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: abandoned.id } })).toEqual(abandoned);
      expect(await prisma.pluginInstall.findUnique({ where: { slug: id } })).toBeNull();
      expect((await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug: id } })).token).toBe(bLease.token);
      b.send({ kind: 'plugin-lease-release' });
      expect((await second).status).toBe(200);
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(newZip));
      await blobInvariant(id, newZip);
      expect(await packagePath(id, hash(oldZip))).toBeDefined();
      expect(await packagePath(id, hash(newZip))).toBeDefined();
    } finally {
      a.send({ kind: 'plugin-lease-release' });
      b.send({ kind: 'plugin-lease-release' });
      await stop(a);
      await stop(b);
    }
  });

  it('H a stale runner cannot overwrite a recovered operation after the new lease holder publishes', async () => {
    const id = own(), oldZip = await archive(id, 'old'), newZip = await archive(id, 'new', { version: '2.0.0' });
    const a = child('published'), b = child('published');
    try {
      const [aReady, bReady] = await Promise.all([message(a, 'ready'), message(b, 'ready')]);
      const aEntered = message(a, 'plugin-lease-ready');
      const first = uploadTo(aReady.base, oldZip, true, 'NEEDS_RECOVERY');
      void first.catch(() => undefined);
      await aEntered;
      await prisma.pluginOperationLease.update({ where: { slug: id }, data: { expiresAt: new Date(0) } });
      const bEntered = message(b, 'plugin-lease-ready');
      const second = uploadTo(bReady.base, newZip);
      void second.catch(() => undefined);
      await Promise.race([bEntered, second.then(result => { throw new Error(`Recovery finished before barrier: ${JSON.stringify(result)}`); })]);
      const abandoned = await first;
      expect(abandoned).toMatchObject({ status: 200, body: { operation: { phase: 'NEEDS_RECOVERY', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN' } } });
      b.send({ kind: 'plugin-lease-release' });
      expect((await second).status).toBe(200);
      const recovered = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: abandoned.body.operation.operationId } });
      const replacement = await prisma.pluginMigrationOperation.findFirstOrThrow({ where: { slug: id, packageVersion: '2.0.0' } });
      expect(recovered).toMatchObject({ phase: 'RECOVERED', errorCode: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', recoveryState: `RECOVERED_BY:${replacement.id}` });
      expect(recovered.artifactBytes).toBeNull();
      expect(replacement).toMatchObject({ phase: 'SUCCESS', errorCode: null });
      expect(replacement.artifactBytes).toBeNull();
      const drained = message(a, 'operations-drained');
      a.send({ kind: 'plugin-lease-release' }); a.send({ kind: 'drain-operations' });
      await drained;
      expect(await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: recovered.id } })).toEqual(recovered);
      expect(await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: replacement.id } })).toEqual(replacement);
      expect(await prisma.pluginOperationLease.findUnique({ where: { slug: id } })).toBeNull();
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(newZip));
      await blobInvariant(id, newZip);
    } finally {
      a.send({ kind: 'plugin-lease-release' }); b.send({ kind: 'plugin-lease-release' });
      await stop(a); await stop(b);
    }
  });

  it('I different slugs acquire leases independently in real processes', async () => {
    const ids = [own(), own()];
    const zips = await Promise.all(ids.map((id) => archive(id, 'parallel')));
    const workers = ids.map(() => child('acquired'));
    try {
      const ready = await Promise.all(workers.map((worker) => message(worker, 'ready')));
      const entered = workers.map((worker) => message(worker, 'plugin-lease-ready'));
      const uploads = workers.map((worker, index) => uploadTo(ready[index].base, zips[index]));
      await Promise.all(entered);
      workers.forEach((worker) => worker.send({ kind: 'plugin-lease-release' }));
      expect((await Promise.all(uploads)).map((result) => result.status)).toEqual([200, 200]);
      for (let index = 0; index < ids.length; index++) await blobInvariant(ids[index], zips[index]);
    } finally {
      workers.forEach((worker) => worker.send({ kind: 'plugin-lease-release' }));
      await Promise.all(workers.map(stop));
    }
  });

  it('J uninstall, restore, and purge reject a held slug lease', async () => {
    const id = own();
    const zip = await archive(id, 'held');
    expect((await upload(zip)).status).toBe(200);
    const lease = await prisma.pluginOperationLease.create({
      data: { slug: id, token: randomUUID(), operation: 'test', acquiredAt: new Date(), expiresAt: new Date(Date.now() + 60000) },
    });
    const headers = { authorization: `Bearer ${token}` };
    try {
      for (const [method, suffix] of [['DELETE', ''], ['POST', '/restore'], ['DELETE', '/purge']] as const) {
        const response = await fetch(`${base}/api/v1/extensions/plugin/${id}${suffix}`, { method, headers });
        expect(response.status).toBe(409);
        expect((await response.json()).error.code).toBe('PLUGIN_OPERATION_IN_PROGRESS');
      }
      expect((await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug: id } })).token).toBe(lease.token);
    } finally {
      await prisma.pluginOperationLease.delete({ where: { slug: id } });
    }
    await blobInvariant(id, zip);
  });

  it('K success and failure both release the operation lease', async () => {
    const id = own();
    const zip = await archive(id, 'success');
    expect((await upload(zip)).status).toBe(200);
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug: id } })).toBeNull();
    expect((await upload(await archive(id, 'failure', { version: '2.0.0' }), false)).status).toBe(400);
    expect(await prisma.pluginOperationLease.findUnique({ where: { slug: id } })).toBeNull();
  });

  it('A upload publishes a complete hash directory without post-publish writes', async () => {
    const id = own();
    const zip = await archive(id, 'first');
    expect((await upload(zip)).status).toBe(200);
    const zipHash = hash(zip);
    const directory = await packagePath(id, zipHash);
    const marker = path.join(directory, '.complete.json');
    expect(await fs.readFile(marker, 'utf8')).toBe(JSON.stringify({ slug: id, zipHash }));
    expect(await fs.readdir(directory)).not.toContain('.installed.json');
    const before = await fs.stat(marker);
    const detail = await fetch(`${base}/api/v1/extensions/plugin/${id}`, { headers: { authorization: `Bearer ${token}` } });
    expect(detail.status).toBe(200);
    expect((await fs.stat(marker)).mtimeMs).toBe(before.mtimeMs);
  });

  it('B upgrade preserves the old directory and selects the new hash', async () => {
    const id = own();
    const oldZip = await archive(id, 'old');
    expect((await upload(oldZip)).status).toBe(200);
    const oldPath = await packagePath(id, hash(oldZip));
    const oldEntry = await fs.readFile(path.join(oldPath, 'server/index.js'), 'utf8');
    const newZip = await archive(id, 'new', { version: '2.0.0' });
    expect((await upload(newZip)).status).toBe(200);
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(newZip));
    expect(await fs.readFile(path.join(oldPath, 'server/index.js'), 'utf8')).toBe(oldEntry);
    expect(await packagePath(id, hash(newZip))).not.toBe(oldPath);
  });

  it('C rejects an incomplete signature and keeps the installed hash and files', async () => {
    const id = own();
    const original = await archive(id, 'old');
    expect((await upload(original)).status).toBe(200);
    const oldPath = await packagePath(id, hash(original));
    const bad = await archive(id, 'bad', { version: '2.0.0', incompleteSignature: true });
    const rejected = await upload(bad);
    expect(rejected.status).toBe(422);
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(original));
    expect(await fs.stat(oldPath)).toBeDefined();
    expect(await pluginPackageStore.get(id, hash(bad))).toBeNull();
  });

  it('C rejects candidate prewarm failure without changing the current hash', async () => {
    const id = own();
    const original = await archive(id, 'old');
    expect((await upload(original)).status).toBe(200);
    await enabled(id);
    const oldPath = await packagePath(id, hash(original));
    const bad = await archive(id, 'bad', { version: '2.0.0', code: 'module.exports = {};' });
    const rejected = await upload(bad, true, 'FAILED');
    expect(rejected.status).toBe(200); expect(rejected.body.operation.errorCode).toBe('PLUGIN_LOAD_FAILED');
    expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).zipHash).toBe(hash(original));
    expect(await fs.stat(oldPath)).toBeDefined();
  });

  it('D identical ZIP reupload reuses the hash directory unchanged', async () => {
    const id = own();
    const zip = await archive(id, 'same');
    expect((await upload(zip)).status).toBe(200);
    const directory = await packagePath(id, hash(zip));
    const before = await fs.stat(path.join(directory, '.complete.json'));
    expect((await upload(zip)).status).toBe(200);
    expect((await fs.stat(path.join(directory, '.complete.json'))).mtimeMs).toBe(before.mtimeMs);
    expect(await fs.readdir(path.dirname(directory))).toEqual([hash(zip)]);
  });

  it('E soft uninstall and restore retain the directory, while purge leaves it on disk', async () => {
    const id = own();
    const zip = await archive(id, 'stored');
    expect((await upload(zip)).status).toBe(200);
    const directory = await packagePath(id, hash(zip));
    const headers = { authorization: `Bearer ${token}` };
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}`, { method: 'DELETE', headers })).status).toBe(200);
    expect(await fs.stat(directory)).toBeDefined();
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/restore`, { method: 'POST', headers })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}`, { method: 'DELETE', headers })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/purge`, { method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ confirmationSlug: id }) })).status).toBe(200);
    expect(await prisma.pluginInstall.findUnique({ where: { slug: id } })).toBeNull();
    expect(await fs.stat(directory)).toBeDefined();
  });

  it('H version-changing different-hash upgrade runs new code while an in-flight old call completes', async () => {
    const id = own();
    const oldZip = await archive(id, 'old', { code: source('old', true) });
    expect((await upload(oldZip)).status).toBe(200);
    await enabled(id);
    let entered!: () => void;
    let release!: () => void;
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    (globalThis as any).__pluginBarrier = { enter: entered, release: releasePromise };
    try {
      const inFlight = status(id);
      await enteredPromise;
      const nextZip = await archive(id, 'new', { version: '2.0.0' });
      expect((await upload(nextZip)).status).toBe(200);
      delete (globalThis as any).__pluginBarrier;
      expect(await (await status(id)).json()).toMatchObject({ tag: 'new' });
      release();
      expect(await (await inFlight).json()).toMatchObject({ tag: 'old' });
    } finally {
      release();
      delete (globalThis as any).__pluginBarrier;
    }
  });

  it('I purge leaves an in-flight call running and rejects new calls', async () => {
    const id = own();
    const zip = await archive(id, 'old', { code: source('old', true) });
    expect((await upload(zip)).status).toBe(200);
    await enabled(id);
    let entered!: () => void;
    let release!: () => void;
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    (globalThis as any).__pluginBarrier = { enter: entered, release: releasePromise };
    try {
      const inFlight = status(id);
      await enteredPromise;
      expect((await fetch(`${base}/api/v1/extensions/plugin/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
      expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/purge`, {
        method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirmationSlug: id }),
      })).status).toBe(200);
      delete (globalThis as any).__pluginBarrier;
      expect((await status(id)).status).toBe(404);
      release();
      expect(await (await inFlight).json()).toMatchObject({ tag: 'old' });
    } finally {
      release();
      delete (globalThis as any).__pluginBarrier;
    }
  });

  it('K maps a hash-directory stack path to its slug and ignores temp paths', async () => {
    const id = own();
    const zip = await archive(id, 'current');
    expect((await upload(zip)).status).toBe(200);
    const directory = await packagePath(id, hash(zip));
    expect(await pluginPackageStore.findSlugByFilePath(path.join(directory, 'server/index.js'))).toBe(id);
    const temporary = await pluginPackageStore.createTemporaryDirectory('mapping');
    try {
      expect(await pluginPackageStore.findSlugByFilePath(path.join(temporary, 'entry.js'))).toBeNull();
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  });
});
