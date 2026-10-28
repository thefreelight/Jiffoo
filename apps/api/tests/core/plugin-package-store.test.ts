import { mkdtempSync, rmSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTestPrisma } from '../helpers/db';

/**
 * The package store is a file system component: the suite runs against a
 * private extensions root so a publish never touches the shared cache.
 */
const root = mkdtempSync(path.join(os.tmpdir(), 'plugin-package-store-'));
const children: ChildProcess[] = [];
let pluginPackageStore: typeof import('@/core/storage/plugin-package-store').pluginPackageStore;

beforeAll(async () => {
  const previousExtensionsPath = process.env.EXTENSIONS_PATH;
  process.env.EXTENSIONS_PATH = root;
  // The store reads its root when it is created, so it is loaded against the
  // private root of this suite.
  vi.resetModules();
  ({ pluginPackageStore } = await import('@/core/storage/plugin-package-store'));
  if (previousExtensionsPath === undefined) delete process.env.EXTENSIONS_PATH;
  else process.env.EXTENSIONS_PATH = previousExtensionsPath;
});

afterAll(async () => {
  for (const child of children.splice(0)) {
    child.send({ kind: 'stop' });
    await once(child, 'exit').catch(() => undefined);
  }
  rmSync(root, { recursive: true, force: true });
});

function hashOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function sourceDirectory(entry: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-package-source-'));
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ slug: 'source', version: '1.0.0' }));
  await fs.writeFile(path.join(directory, 'entry.js'), entry);
  return directory;
}

function message(child: ChildProcess, kind: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off('message', receive);
      child.off('exit', exit);
    };
    const exit = (code: number | null) => reject(new Error(`Child exited before ${kind}: code=${code}`));
    const receive = (value: any) => {
      if (value?.kind !== kind && value?.kind !== 'error') return;
      cleanup();
      if (value.kind === 'error') reject(new Error(value.message));
      else resolve(value);
    };
    child.on('message', receive);
    child.on('exit', exit);
  });
}

describe('Plugin package store publish', () => {
  it('publishes the same package twice at the same time and keeps the published package intact', async () => {
    const slug = `race-${randomUUID().slice(0, 12)}`;
    const hash = hashOf(slug);
    const source = await sourceDirectory('module.exports = {};');
    try {
      const deployments = await Promise.all([
        pluginPackageStore.put(slug, hash, source),
        pluginPackageStore.put(slug, hash, source),
      ]);
      expect(deployments).toHaveLength(2);
      for (const deployment of deployments) {
        expect(await deployment.package.readText('entry.js')).toBe('module.exports = {};');
        expect(await deployment.package.readText('.complete.json')).toBe(JSON.stringify({ slug, zipHash: hash }));
      }
      const published = path.join(root, 'plugins', slug, hash);
      expect(await fs.readdir(path.join(root, 'plugins', slug))).toEqual([hash]);
      expect(await fs.readFile(path.join(published, '.complete.json'), 'utf8')).toBe(JSON.stringify({ slug, zipHash: hash }));
      expect(await fs.readFile(path.join(published, 'entry.js'), 'utf8')).toBe('module.exports = {};');
      expect(await fs.readdir(path.join(root, 'plugins', '.tmp'))).toEqual([]);
    } finally {
      await fs.rm(source, { recursive: true, force: true });
    }
  });

  it('treats a publish of an already published package as a no-op', async () => {
    const slug = `noop-${randomUUID().slice(0, 12)}`;
    const hash = hashOf(slug);
    const source = await sourceDirectory('module.exports = 1;');
    try {
      const first = await pluginPackageStore.put(slug, hash, source);
      expect(first.published).toBe(true);
      const marker = path.join(root, 'plugins', slug, hash, '.complete.json');
      const before = await fs.stat(marker);
      const second = await pluginPackageStore.put(slug, hash, source);
      expect(second.published).toBe(false);
      expect(await second.package.readText('entry.js')).toBe('module.exports = 1;');
      expect((await fs.stat(marker)).mtimeMs).toBe(before.mtimeMs);
      expect(await fs.readdir(path.join(root, 'plugins', slug))).toEqual([hash]);
    } finally {
      await fs.rm(source, { recursive: true, force: true });
    }
  });

  it('recovers when an overlapping publish takes the staging directory away', async () => {
    const slug = `stolen-${randomUUID().slice(0, 12)}`;
    const hash = hashOf(slug);
    const source = await sourceDirectory('module.exports = 2;');
    const child = fork(path.resolve('tests/helpers/plugin-publish-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, EXTENSIONS_PATH: root, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_PUBLISH_BARRIER: '1' },
    });
    children.push(child);
    try {
      await message(child, 'ready');
      const atBarrier = message(child, 'plugin-publish-ready');
      child.send({ kind: 'publish', slug, zipHash: hash, source });
      await atBarrier;
      // The overlapping publish removes the staged directory before it is renamed.
      const stagingRoot = path.join(root, 'plugins', '.tmp');
      const staged = await fs.readdir(stagingRoot);
      const staging = staged.find((entry) => entry.startsWith(`publish-${slug}-`));
      expect(staging).toBeDefined();
      await fs.rm(path.join(stagingRoot, staging!), { recursive: true, force: true });
      const finished = message(child, 'done');
      child.send({ kind: 'plugin-publish-release' });
      const done = await finished;
      expect(done.published).toBe(true);
      const published = path.join(root, 'plugins', slug, hash);
      expect(await fs.readFile(path.join(published, '.complete.json'), 'utf8')).toBe(JSON.stringify({ slug, zipHash: hash }));
      expect(await fs.readFile(path.join(published, 'entry.js'), 'utf8')).toBe('module.exports = 2;');
      expect(await fs.readdir(path.join(root, 'plugins', slug))).toEqual([hash]);
      expect(await fs.readdir(stagingRoot)).toEqual([]);
    } finally {
      await fs.rm(source, { recursive: true, force: true });
    }
  });

  it('republishes a package the runtime would refuse and keeps a complete package', async () => {
    const { publishBuiltinPackage } = await import('@/core/admin/extension-installer/builtin-sync');
    const { prisma: syncPrisma } = await import('@/config/database');
    const slug = `builtin-${randomUUID().slice(0, 12)}`;
    const hash = hashOf(slug);
    const source = await sourceDirectory('module.exports = {};');
    try {
      // A directory left behind by an interrupted publish: the package files are
      // there, the completion marker is not, so the runtime refuses it.
      const published = path.join(root, 'plugins', slug, hash);
      await fs.mkdir(published, { recursive: true });
      await fs.writeFile(path.join(published, 'manifest.json'), JSON.stringify({ slug, version: '0.0.0' }));
      expect(await pluginPackageStore.get(slug, hash)).toBeNull();
      expect(await publishBuiltinPackage(slug, hash, source)).toBe(true);
      const repaired = await pluginPackageStore.get(slug, hash);
      expect(repaired).not.toBeNull();
      expect(await repaired!.readText('.complete.json')).toBe(JSON.stringify({ slug, zipHash: hash }));
      expect(await repaired!.readText('entry.js')).toBe('module.exports = {};');
      // A complete package is immutable: the sync does not publish it again.
      const marker = await fs.stat(path.join(published, '.complete.json'));
      expect(await publishBuiltinPackage(slug, hash, source)).toBe(false);
      expect((await fs.stat(path.join(published, '.complete.json'))).mtimeMs).toBe(marker.mtimeMs);
    } finally {
      await syncPrisma.$disconnect();
      await fs.rm(source, { recursive: true, force: true });
    }
  });

  it('resolves a builtin package from the database when the store holds no published copy', async () => {
    const { publishBuiltinPackage } = await import('@/core/admin/extension-installer/builtin-sync');
    const { packBuiltinPlugin } = await import('@/core/admin/extension-installer/builtin-package');
    const { pluginPackageBlobStore } = await import('@/core/storage/plugin-package-blob-store');
    const slug = `builtin-cold-${randomUUID().slice(0, 12)}`;
    const source = await fs.mkdtemp(path.join(os.tmpdir(), 'builtin-cold-source-'));
    // The store of the resolver below is bound to this root, and it is empty.
    const privateRoot = mkdtempSync(path.join(os.tmpdir(), 'plugin-package-cold-'));
    try {
      await fs.mkdir(path.join(source, 'server'), { recursive: true });
      await fs.writeFile(path.join(source, 'manifest.json'), JSON.stringify({
        schemaVersion: 1, slug, name: slug, version: '1.0.0', description: 'Cold store builtin',
        author: 'Test', category: 'integration', runtimeType: 'internal-fastify',
        hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [], contracts: [],
      }));
      await fs.writeFile(path.join(source, 'server', 'index.js'), 'module.exports = {};');
      const { bytes, hash } = await packBuiltinPlugin(source);
      const prisma = getTestPrisma();
      await prisma.pluginInstall.create({
        data: { slug, name: slug, version: '1.0.0', source: 'builtin', zipHash: hash },
      });
      await prisma.$transaction(async tx => { await pluginPackageBlobStore.put(tx, slug, hash, bytes); });
      // The builtin is installed: the database holds its row and its bytes.
      expect(await publishBuiltinPackage(slug, hash, source)).toBe(true);

      const previousExtensionsPath = process.env.EXTENSIONS_PATH;
      process.env.EXTENSIONS_PATH = privateRoot;
      vi.resetModules();
      try {
        const { resolveCurrentPluginPackage } = await import('@/core/storage/current-plugin-package');
        const { pluginPackageStore: coldStore } = await import('@/core/storage/plugin-package-store');
        expect(await coldStore.get(slug, hash)).toBeNull();
        const resolved = await resolveCurrentPluginPackage(slug);
        expect(resolved).not.toBeNull();
        expect(await coldStore.get(slug, hash)).not.toBeNull();
        expect(await fs.readdir(path.join(privateRoot, 'plugins', slug))).toEqual([hash]);
      } finally {
        if (previousExtensionsPath === undefined) delete process.env.EXTENSIONS_PATH;
        else process.env.EXTENSIONS_PATH = previousExtensionsPath;
      }
    } finally {
      await getTestPrisma().pluginInstall.deleteMany({ where: { slug } });
      await fs.rm(source, { recursive: true, force: true });
      rmSync(privateRoot, { recursive: true, force: true });
    }
  });
});
