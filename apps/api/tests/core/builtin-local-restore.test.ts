import { afterAll, describe, expect, it } from 'vitest';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '@/config/database';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { packBuiltinPlugin } from '@/core/admin/extension-installer/builtin-package';

const builtinRoot = path.resolve('builtin-plugins');
const roots: string[] = [];

async function child(file: string, args: string[], extensionsRoot?: string): Promise<any> {
  const process = fork(path.resolve('tests/helpers', file), args, {
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...globalThis.process.env, NODE_ENV: 'test', ...(extensionsRoot ? { EXTENSIONS_PATH: extensionsRoot } : {}) },
  });
  let output = '';
  process.stdout?.on('data', (data) => { output += data.toString(); });
  process.stderr?.on('data', (data) => { output += data.toString(); });
  const exited = once(process, 'exit');
  const received = new Promise<any>((resolve, reject) => {
    process.on('message', (value: any) => {
      if (value?.kind === 'error') reject(new Error(value.message));
      else if (value?.kind === 'done' || value?.kind === 'packed') resolve(value);
    });
    process.once('error', reject);
    process.once('exit', (code) => reject(new Error(`Child exited ${code}: ${output}`)));
  });
  try {
    const result = await received;
    await exited;
    return result;
  } catch (error) {
    throw new Error(`${String(error)}\n${output}`);
  }
}

describe('builtin deterministic packing and local restore', () => {
  afterAll(async () => {
    await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('A restores a builtin in an empty real-process root without DB, registry, or lifecycle changes', async () => {
    await syncBuiltinPlugins(builtinRoot);
    const beforeRows = await prisma.pluginInstall.findMany({ where: { source: 'builtin' }, orderBy: { slug: 'asc' } });
    const beforeRegistry = (await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion;
    const beforeAudit = await prisma.adminStaffAuditLog.count({ where: { action: 'BUILTIN_PLUGIN_INSTALLED' } });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builtin-restore-'));
    roots.push(root);
    expect(await fs.readdir(root)).toEqual([]);
    await child('builtin-cache-child.ts', [], root);
    const shipping = beforeRows.find((row) => row.slug === 'free-shipping');
    expect(shipping?.zipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await fs.readFile(path.join(root, 'plugins', 'free-shipping', shipping!.zipHash!, '.complete.json'), 'utf8'))
      .toBe(JSON.stringify({ slug: 'free-shipping', zipHash: shipping!.zipHash }));
    expect(await prisma.pluginInstall.findMany({ where: { source: 'builtin' }, orderBy: { slug: 'asc' } })).toEqual(beforeRows);
    expect((await prisma.systemSettings.findUnique({ where: { id: 'system' } }))?.pluginRegistryVersion).toBe(beforeRegistry);
    expect(await prisma.adminStaffAuditLog.count({ where: { action: 'BUILTIN_PLUGIN_INSTALLED' } })).toBe(beforeAudit);
  });

  it('B packs identical builtin bytes and hashes twice and in separate processes', async () => {
    const source = path.join(builtinRoot, 'manual-payment');
    const first = await packBuiltinPlugin(source);
    const second = await packBuiltinPlugin(source);
    expect(second.bytes).toEqual(first.bytes);
    const childA = await child('builtin-pack-child.ts', [source]);
    const childB = await child('builtin-pack-child.ts', [source]);
    expect([childA.hash, childB.hash]).toEqual([first.hash, first.hash]);
  });

  it('C upgrades an older builtin DB version through the existing installer and increments the registry', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builtin-version-'));
    roots.push(root);
    const source = path.join(root, 'free-shipping');
    await fs.cp(path.join(builtinRoot, 'free-shipping'), source, { recursive: true });
    const manifestPath = path.join(source, 'manifest.json');
    const original = await fs.readFile(manifestPath, 'utf8');
    try {
      const manifest = JSON.parse(original);
      manifest.version = '0.0.1';
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
      await syncBuiltinPlugins(root);
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: 'free-shipping' } })).version).toBe('0.0.1');
      const before = (await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion;
      await fs.writeFile(manifestPath, original);
      await syncBuiltinPlugins(root);
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: 'free-shipping' } })).version)
        .toBe(JSON.parse(original).version);
      expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion).toBeGreaterThan(before);
    } finally {
      await fs.writeFile(manifestPath, original);
      await syncBuiltinPlugins(root);
    }
  });
});
