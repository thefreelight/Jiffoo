import { afterAll, describe, expect, it, vi } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { getTestPrisma } from '../helpers/db';
import { recordPluginFailure } from '@/core/admin/extension-installer/plugin-failure';
import { handlePluginProcessFailure } from '@/core/admin/extension-installer/plugin-process-failure';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { resetPluginState } from '@/core/admin/extension-installer/plugin-state';

describe('Plugin failure containment', () => {
  const prisma = getTestPrisma();
  const slug = `failure-${Date.now().toString(36)}`.slice(0, 30);
  const sourceDirectories: string[] = [];

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
    await prisma.pluginInstall.deleteMany({ where: { slug } });
    await pluginPackageStore.delete(slug);
    await Promise.all(sourceDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  });

  async function createPlugin(): Promise<string> {
    const source = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-failure-'));
    sourceDirectories.push(source);
    await fs.writeFile(path.join(source, 'manifest.json'), '{}', 'utf-8');
    await pluginPackageStore.put(slug, source);
    await prisma.pluginInstall.create({
      data: { slug, name: slug, version: '1.0.0', runtimeType: 'internal-fastify', source: 'local-zip' },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled: true },
    });
    return installation.id;
  }

  it('records only the first failure within the five second throttle window', async () => {
    await createPlugin();
    await recordPluginFailure(slug, new Error('first failure'), 'event');
    await recordPluginFailure(slug, new Error('second failure'), 'event');

    const installation = await prisma.pluginInstallation.findUnique({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    expect(installation?.lastFailureAt).not.toBeNull();
    expect(installation?.lastFailureMessage).toBe('first failure');
  });

  it('attributes plugin stack paths without exiting the process', async () => {
    const packageDirectory = (await pluginPackageStore.get(slug))!.getEntryPath('index.js');
    const error = new Error('plugin process failure');
    error.stack = `Error: plugin process failure\n    at plugin (${packageDirectory}:1:1)`;
    const exitSpy = vi.spyOn(process, 'exit');

    await resetPluginState(slug);
    await handlePluginProcessFailure(error, 'uncaughtException');

    const installation = await prisma.pluginInstallation.findUnique({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    expect(installation?.lastFailureMessage).toBe('plugin process failure');
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
