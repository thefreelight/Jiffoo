import archiver from 'archiver';
import { createReadStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PluginFsInstaller } from '@/core/admin/extension-installer/plugin-fs-installer';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { createAdminUser, deleteTestUser, type TestUser } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

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
    if (admin) {
      await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: admin.id } });
      await deleteTestUser(admin.id);
    }
    await pluginPackageStore.delete(slug);
    await cleanupArchive?.();
  });

  it('requires confirmation and records the confirmation before installation', async () => {
    const archive = await createPluginArchive(slug);
    cleanupArchive = archive.cleanup;
    const registryBefore = await prisma.systemSettings.findUnique({ where: { id: 'system' } });

    await expect(installer.install(createReadStream(archive.archivePath))).rejects.toMatchObject({
      code: 'UNSIGNED_CONFIRMATION_REQUIRED',
      statusCode: 400,
    });
    expect(await prisma.adminStaffAuditLog.count({ where: { staffUserId: admin.id } })).toBe(0);

    const installed = await installer.install(createReadStream(archive.archivePath), {
      confirmUnsigned: true,
      actorUserId: admin.id,
    });

    expect(installed.runtimeType).toBe('internal-fastify');
    expect(installed.trustLevel).toBe('unsigned');
    const audit = await prisma.adminStaffAuditLog.findFirst({
      where: { staffUserId: admin.id, action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.metadata).toMatchObject({ slug, version: '1.0.0', source: 'local-zip' });
    const registryAfter = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
    expect(registryAfter?.pluginRegistryVersion).toBe((registryBefore?.pluginRegistryVersion ?? 0) + 1);
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
      await installer.install(createReadStream(first.archivePath), { confirmUnsigned: true, actorUserId: admin.id });
      await installer.install(createReadStream(second.archivePath), { confirmUnsigned: true, actorUserId: admin.id });
      await PluginManagementService.uninstallPlugin(hookSlug);

      expect(await fs.readFile(markerPath, 'utf-8')).toBe('upgrade\nuninstall\n');
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: hookSlug } });
      await prisma.pluginInstall.deleteMany({ where: { slug: hookSlug } });
      await pluginPackageStore.delete(hookSlug);
      await fs.rm(markerPath, { force: true });
      await first.cleanup();
      await second.cleanup();
    }
  });
});
