import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

describe('stored manifest admin responses', () => {
  const prisma = getTestPrisma();
  const slug = `admin-invalid-${Date.now().toString(36)}`.slice(0, 30);
  let app: FastifyInstance;
  let adminToken: string;
  let installationId: string;
  let sourceDirectory = '';

  beforeAll(async () => {
    sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), '.stored-manifest-admin-'));
    await fs.writeFile(path.join(sourceDirectory, 'manifest.json'), '{}', 'utf-8');
    const deployment = await pluginPackageStore.put(slug, sourceDirectory);
    await deployment.commit();
    await prisma.pluginInstall.create({
      data: {
        slug,
        name: 'Invalid stored manifest',
        version: '1.0.0',
        runtimeType: 'internal-fastify',
        source: 'local-zip',
        manifestJson: {},
      },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled: false },
    });
    installationId = installation.id;
    app = await createTestApp({ disableFileSystem: false });
    adminToken = (await createAdminWithToken()).token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await pluginPackageStore.delete(slug);
    await fs.rm(sourceDirectory, { recursive: true, force: true });
    await deleteAllTestUsers();
  });

  it('returns manifest errors in the installed plugin list', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions/plugin',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.items.find((item: { slug: string }) => item.slug === slug).manifestError.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'schemaVersion' })]),
    );
  });

  it('returns manifest errors in the installed plugin detail', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/plugin/${slug}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.manifestError.issues).toEqual(expect.any(Array));
  });

  it('rejects enabling an invalid stored manifest without changing the instance', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/plugin/${slug}/instances/${installationId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { enabled: true },
    });

    expect(response.statusCode).toBe(422);
    expect((await prisma.pluginInstallation.findUnique({ where: { id: installationId } }))?.enabled).toBe(false);
  });
});
