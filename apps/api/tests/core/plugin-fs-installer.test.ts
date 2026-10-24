import archiver from 'archiver';
import { createReadStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma as applicationPrisma } from '@/config/database';
import { PluginFsInstaller } from '@/core/admin/extension-installer/plugin-fs-installer';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { createAdminUser, deleteTestUser, type TestUser } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { localUploadOptions } from '../helpers/plugin-upload';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { createHash, randomUUID } from 'node:crypto';

/**
 * The application Prisma client is an extended client (`prisma.$extends(...)`).
 * Its own property descriptors report `undefined`, so `vi.spyOn` refuses to
 * patch it. Overriding the property directly intercepts the call the product
 * code makes on the client and restores the previous value afterwards.
 */
function overridePrismaMethod(target: object, key: string, implementation: (...args: any[]) => any): () => void {
  const original = (target as Record<string, unknown>)[key];
  Object.defineProperty(target, key, { value: implementation, writable: true, configurable: true, enumerable: true });
  return () => { Object.defineProperty(target, key, { value: original, writable: true, configurable: true, enumerable: true }); };
}

async function createPluginArchive(
  slug: string,
  options: { version?: string; lifecycle?: Record<string, boolean>; entrySource?: string } = {},
): Promise<{ archivePath: string; cleanup: () => Promise<void> }> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-plugin-package-'));
  const sourceDir = path.join(rootDir, 'package');
  const archivePath = path.join(rootDir, `${slug}.zip`);
  await fs.mkdir(path.join(sourceDir, 'dist'), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    slug,
    name: 'Unsigned In-Process Test Plugin',
    version: options.version ?? '1.0.0',
    description: 'Installs through the Core in-process gateway.',
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    entryModule: 'dist/index.js',
    permissions: [],
    category: 'integration',
    contracts: [],
    lifecycle: options.lifecycle,
  }, null, 2));
  await fs.writeFile(path.join(sourceDir, 'package.json'), JSON.stringify({ name: slug, version: '1.0.0' }));
  await fs.writeFile(path.join(sourceDir, 'LICENSE'), 'GPL-3.0');
  await fs.writeFile(
    path.join(sourceDir, 'dist', 'index.js'),
    options.entrySource ?? "module.exports = { register(ctx) { ctx.http.route({ method: 'GET', path: '/status', handler: async () => ({ status: 'active' }) }); } };\n",
  );

  await new Promise<void>((resolve, reject) => {
    const output = require('fs').createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });

  return { archivePath, cleanup: () => fs.rm(rootDir, { recursive: true, force: true }) };
}

describe('PluginFsInstaller unsigned packages', () => {
  const prisma = getTestPrisma();
  const installer = new PluginFsInstaller();
  const slug = `unsigned-${Date.now().toString(36)}`.slice(0, 30);
  let admin: TestUser;
  let cleanupArchive: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    admin = await createAdminUser();
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await cleanupPluginMigrationFixture(slug);
    if (admin) {
      await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: admin.id } });
      await deleteTestUser(admin.id);
    }
    await clearTestPluginCache(slug);
    await cleanupArchive?.();
  });

  it('requires confirmation and records the confirmation before installation', async () => {
    const archive = await createPluginArchive(slug);
    cleanupArchive = archive.cleanup;
    const registryBefore = await prisma.systemSettings.findUnique({ where: { id: 'system' } });

    await expect(installer.install(createReadStream(archive.archivePath), await localUploadOptions(await fs.readFile(archive.archivePath), admin.id, false))).rejects.toMatchObject({
      code: 'UNSIGNED_CONFIRMATION_REQUIRED',
      statusCode: 400,
    });
    expect(await prisma.adminAuditEvent.count({ where: { actorId: admin.id } })).toBe(0);

    const installed = await installer.install(createReadStream(archive.archivePath), await localUploadOptions(await fs.readFile(archive.archivePath), admin.id));

    expect(installed.runtimeType).toBe('internal-fastify');
    expect(installed.trustLevel).toBe('unsigned');
    const audit = await prisma.adminAuditEvent.findFirst({
      where: { actorId: admin.id, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.targetId).toBe(slug);
    expect(audit?.summary).toMatchObject({ version: '1.0.0', source: 'local-zip' });
    const registryAfter = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
    expect(registryAfter?.pluginRegistryVersion).toBe((registryBefore?.pluginRegistryVersion ?? 0) + 1);
  });

  it('reads package archives outside publication transactions for installs and upgrades', async () => {
    const packageSlug = `archive-io-${randomUUID().slice(0, 12)}`;
    const first = await createPluginArchive(packageSlug);
    const second = await createPluginArchive(packageSlug, { version: '2.0.0' });
    const transaction = applicationPrisma.$transaction.bind(applicationPrisma);
    const readFile = fs.readFile.bind(fs);
    let inTransaction = false;
    const archiveReads: boolean[] = [];
    const restoreTransaction = overridePrismaMethod(applicationPrisma, '$transaction', async (callback: any, options: any) =>
      transaction(async (tx: any) => {
        inTransaction = true;
        try { return await callback(tx); } finally { inTransaction = false; }
      }, options));
    const readSpy = vi.spyOn(fs, 'readFile').mockImplementation((async (...args: any[]) => {
      if (String(args[0]).endsWith('.zip')) archiveReads.push(inTransaction);
      return (readFile as any)(...args);
    }) as any);
    try {
      await installer.install(createReadStream(first.archivePath), { source: 'builtin' });
      await installer.install(createReadStream(second.archivePath), { source: 'builtin' });
      expect(archiveReads.length).toBeGreaterThanOrEqual(2);
      expect(archiveReads.every(value => !value)).toBe(true);
      expect((await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: packageSlug } })).version).toBe('2.0.0');
    } finally {
      readSpy.mockRestore(); restoreTransaction();
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: packageSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: packageSlug } });
      await clearTestPluginCache(packageSlug);
      await first.cleanup(); await second.cleanup();
    }
  });

  it('runs onUpgrade on a version-changing upload and onUninstall on package delete', async () => {
    const hookSlug = `hooks-${Date.now().toString(36)}`.slice(0, 30);
    const markerPath = path.join(os.tmpdir(), `${hookSlug}.txt`);
    const entrySource = `
const fs = require('fs/promises');
module.exports = { register() {} };
module.exports.__lifecycle_onUpgrade = async function onUpgrade() { await fs.appendFile(${JSON.stringify(markerPath)}, 'upgrade\\n'); };
module.exports.__lifecycle_onUninstall = async function onUninstall() { await fs.appendFile(${JSON.stringify(markerPath)}, 'uninstall\\n'); };
`;
    const first = await createPluginArchive(hookSlug, {
      lifecycle: { onUpgrade: true, onUninstall: true },
      entrySource,
    });
    const second = await createPluginArchive(hookSlug, {
      version: '2.0.0',
      lifecycle: { onUpgrade: true, onUninstall: true },
      entrySource,
    });

    try {
      await installer.install(createReadStream(first.archivePath), await localUploadOptions(await fs.readFile(first.archivePath), admin.id));
      await installer.install(createReadStream(second.archivePath), await localUploadOptions(await fs.readFile(second.archivePath), admin.id));
      await PluginManagementService.uninstallPlugin(hookSlug);

      expect(await fs.readFile(markerPath, 'utf-8')).toBe('upgrade\nuninstall\n');
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: hookSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: hookSlug } });
      await cleanupPluginMigrationFixture(hookSlug);
      await clearTestPluginCache(hookSlug);
      await fs.rm(markerPath, { force: true });
      await first.cleanup();
      await second.cleanup();
    }
  });
  it('L2: package publication advances protectionGeneration and registry version exactly once', async () => {
    const updateSlug = `update-gen-${randomUUID().slice(0, 12)}`;
    const first = await createPluginArchive(updateSlug);
    const second = await createPluginArchive(updateSlug, { version: '2.0.0' });
    try {
      await installer.install(createReadStream(first.archivePath), await localUploadOptions(await fs.readFile(first.archivePath), admin.id));
      const before = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: updateSlug, instanceKey: 'default' } } });
      const registry = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } });
      const published = await installer.install(createReadStream(second.archivePath), await localUploadOptions(await fs.readFile(second.archivePath), admin.id));
      const after = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: before.id } });
      const pkg = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: updateSlug } });
      expect(pkg.version).toBe('2.0.0');
      expect(pkg.zipHash).toBe(published.zipHash);
      expect(after.protectionGeneration).toBe(before.protectionGeneration + 1n);
      expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion).toBe(registry.pluginRegistryVersion + 1);
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: updateSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: updateSlug } });
      await cleanupPluginMigrationFixture(updateSlug);
      await clearTestPluginCache(updateSlug); await first.cleanup(); await second.cleanup();
    }
  });
  it('L2: a real registry integer overflow rolls back package publication and protectionGeneration', async () => {
    const updateSlug = `rollback-gen-${randomUUID().slice(0, 12)}`;
    const first = await createPluginArchive(updateSlug);
    const second = await createPluginArchive(updateSlug, { version: '2.0.0' });
    let registryVersion: number | undefined;
    try {
      await installer.install(createReadStream(first.archivePath), await localUploadOptions(await fs.readFile(first.archivePath), admin.id));
      const before = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: updateSlug, instanceKey: 'default' } } });
      const pkg = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: updateSlug } });
      registryVersion = (await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion;
      await prisma.systemSettings.update({ where: { id: 'system' }, data: { pluginRegistryVersion: 2147483647 } });
      const bytes = await fs.readFile(second.archivePath);
      await expect(installer.install(createReadStream(second.archivePath), await localUploadOptions(bytes, admin.id))).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', statusCode: 500 });
      const after = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: before.id } });
      const retained = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: updateSlug } });
      expect(after.protectionGeneration).toBe(before.protectionGeneration);
      expect(retained.version).toBe(pkg.version); expect(retained.zipHash).toBe(pkg.zipHash);
      expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 'system' } })).pluginRegistryVersion).toBe(2147483647);
      expect(await prisma.pluginPackageBlob.count({ where: { pluginSlug: updateSlug, zipHash: createHash('sha256').update(bytes).digest('hex') } })).toBe(0);
    } finally {
      if (registryVersion !== undefined) await prisma.systemSettings.update({ where: { id: 'system' }, data: { pluginRegistryVersion: registryVersion } });
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: updateSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: updateSlug } });
      await cleanupPluginMigrationFixture(updateSlug);
      await clearTestPluginCache(updateSlug); await first.cleanup(); await second.cleanup();
    }
  });
});
