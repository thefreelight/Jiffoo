import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
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
    const form = new FormData();
    if (confirmUnsigned) form.set('confirmUnsigned', 'true');
    form.set('file', new Blob([bytes], { type: 'application/zip' }), 'plugin.zip');
    const response = await fetch(`${base}/api/v1/extensions/plugin/install`, {
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
