import archiver from 'archiver';
import { createReadStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PluginFsInstaller } from '@/core/admin/extension-installer/plugin-fs-installer';
import { getPluginDir } from '@/core/admin/extension-installer/utils';
import { createAdminUser, deleteTestUser, type TestUser } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

async function createPluginArchive(slug: string): Promise<{ archivePath: string; cleanup: () => Promise<void> }> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-plugin-package-'));
  const sourceDir = path.join(rootDir, 'package');
  const archivePath = path.join(rootDir, `${slug}.zip`);
  await fs.mkdir(path.join(sourceDir, 'dist'), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    slug,
    name: 'Unsigned In-Process Test Plugin',
    version: '1.0.0',
    description: 'Installs through the Core in-process gateway.',
    runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1',
    trustLevel: 'unsigned',
    entryModule: 'dist/index.js',
    permissions: [],
  }, null, 2));
  await fs.writeFile(path.join(sourceDir, 'package.json'), JSON.stringify({ name: slug, version: '1.0.0' }));
  await fs.writeFile(path.join(sourceDir, 'LICENSE'), 'GPL-3.0');
  await fs.writeFile(path.join(sourceDir, 'dist', 'index.js'), "module.exports = async function plugin(fastify) { fastify.get('/status', async () => ({ status: 'active' })); };\n");

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
    await fs.rm(getPluginDir(slug), { recursive: true, force: true });
    await cleanupArchive?.();
  });

  it('requires confirmation and records the confirmation before installation', async () => {
    const archive = await createPluginArchive(slug);
    cleanupArchive = archive.cleanup;

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
  });
});
