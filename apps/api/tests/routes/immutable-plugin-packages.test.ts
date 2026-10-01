import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
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
  version?: string; code?: string; incompleteSignature?: boolean;
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

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    token = (await createAdminWithToken()).token;
    base = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => {
    for (const id of slugs) {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: id } });
      await prisma.pluginInstall.deleteMany({ where: { slug: id } });
      await clearTestPluginCache(id);
    }
    await deleteAllTestUsers();
    await app.close();
  });

  async function upload(bytes: Buffer, confirmUnsigned = true) {
    return uploadTo(base, bytes, confirmUnsigned);
  }
  async function uploadTo(url: string, bytes: Buffer, confirmUnsigned = true) {
    const form = new FormData();
    if (confirmUnsigned) form.set('confirmUnsigned', 'true');
    form.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
    const response = await fetch(`${url}/api/v1/extensions/plugin/install`, {
      method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form,
    });
    return { status: response.status, body: await response.json() };
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
    expect((await upload(bad)).status).toBeGreaterThanOrEqual(400);
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
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/purge`, { method: 'DELETE', headers })).status).toBe(200);
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: id } })).toBe(0);
  });

  it('F builtin plugins have no blob rows', async () => {
    expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: { in: ['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email'] } } })).toBe(0);
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
      const first = uploadTo(aReady.base, oldZip);
      await aEntered;
      await prisma.pluginOperationLease.update({ where: { slug: id }, data: { expiresAt: new Date(0) } });
      const bEntered = message(b, 'plugin-lease-ready');
      const second = uploadTo(bReady.base, newZip);
      await bEntered;
      const bLease = await prisma.pluginOperationLease.findUniqueOrThrow({ where: { slug: id } });
      a.send({ kind: 'plugin-lease-release' });
      expect(await first).toMatchObject({ status: 409, body: { error: { code: 'PLUGIN_OPERATION_LEASE_LOST' } } });
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
    const rejected = await upload(bad);
    expect(rejected.status).toBeGreaterThanOrEqual(400);
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
    expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/purge`, { method: 'DELETE', headers })).status).toBe(200);
    expect(await prisma.pluginInstall.findUnique({ where: { slug: id } })).toBeNull();
    expect(await fs.stat(directory)).toBeDefined();
  });

  it('H same-version different-hash upgrade runs new code while an in-flight old call completes', async () => {
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
      const nextZip = await archive(id, 'new');
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
      expect((await fetch(`${base}/api/v1/extensions/plugin/${id}/purge`, {
        method: 'DELETE', headers: { authorization: `Bearer ${token}` },
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
