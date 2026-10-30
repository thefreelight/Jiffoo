import { afterAll, describe, expect, it, vi } from 'vitest';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { executeLifecycleHook, type LifecycleContext } from '@/core/admin/plugin-management/lifecycle-hooks';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { getTestPrisma } from '../helpers/db';
import { LoggerService } from '@/core/logger/unified-logger';
import type { PluginManifest } from '@jiffoo/shared';

describe('Plugin lifecycle hooks', () => {
  const slug = `lifecycletest${Date.now().toString(36).slice(-6)}`.slice(0, 24);
  const failingSlug = `lifecyclefail${Date.now().toString(36).slice(-6)}`.slice(0, 24);
  let markerPath = path.join(os.tmpdir(), `.plugin-lifecycle-${slug}.json`);
  let pluginDir = '';
  let failingPluginDir = '';

  afterAll(async () => {
    await getTestPrisma().pluginInstall.deleteMany({ where: { slug: { in: [slug, failingSlug] } } });
    await clearTestPluginCache(slug);
    await clearTestPluginCache(failingSlug);
    await fs.rm(markerPath, { force: true });
    await fs.rm(pluginDir, { recursive: true, force: true });
    await fs.rm(failingPluginDir, { recursive: true, force: true });
  });

  it('loads internal-fastify lifecycle hooks from the plugin entry module', async () => {
    pluginDir = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-lifecycle-'));
    await fs.mkdir(path.join(pluginDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'src', 'index.js'),
      `
const fs = require('fs/promises');

module.exports.__lifecycle_onEnable = async function onEnable(context) {
  await fs.writeFile(${JSON.stringify(markerPath)}, JSON.stringify(context), 'utf-8');
};
      `.trim(),
      'utf-8',
    );

    const manifest: PluginManifest = {
      schemaVersion: 1,
      slug,
      name: 'Lifecycle Test Plugin',
      version: '1.0.0',
      description: 'Ensures lifecycle hooks can import plugin entry modules',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule: 'src/index.js',
      permissions: [],
      lifecycle: {
        onEnable: true,
      },
    };
    await fs.writeFile(path.join(pluginDir, 'manifest.json'), JSON.stringify(manifest));
    const zipHash = await publishTestPlugin(slug, pluginDir);
    await getTestPrisma().pluginInstall.create({
      data: { slug, name: manifest.name, version: manifest.version, source: 'local-zip', zipHash, manifestJson: manifest },
    });

    const context: LifecycleContext = {
      installationId: 'inst_test',
      pluginSlug: slug,
      instanceKey: 'default',
      config: { enabled: true },
    };

    const result = await executeLifecycleHook('onEnable', context, manifest);

    expect(result.success).toBe(true);

    const writtenContext = JSON.parse(await fs.readFile(markerPath, 'utf-8')) as LifecycleContext;
    expect(writtenContext.installationId).toBe('inst_test');
    expect(writtenContext.pluginSlug).toBe(slug);
    expect(writtenContext.config).toEqual({ enabled: true });
  });

  it('records a structured entry when the compensating write of a failed hook fails', async () => {
    failingPluginDir = await fs.mkdtemp(path.join(os.tmpdir(), '.plugin-lifecycle-failing-'));
    await fs.mkdir(path.join(failingPluginDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(failingPluginDir, 'src', 'index.js'),
      `
module.exports.__lifecycle_onDisable = async function onDisable() {
  throw new Error('the hook failed');
};
      `.trim(),
      'utf-8',
    );

    const manifest: PluginManifest = {
      schemaVersion: 1,
      slug: failingSlug,
      name: 'Lifecycle Failing Plugin',
      version: '1.0.0',
      description: 'Ensures a failed compensating write leaves a record',
      author: 'test-suite',
      runtimeType: 'internal-fastify',
      hostProtocol: 'internal-fastify-v1',
      entryModule: 'src/index.js',
      permissions: [],
      lifecycle: {
        onDisable: true,
      },
    };
    await fs.writeFile(path.join(failingPluginDir, 'manifest.json'), JSON.stringify(manifest));
    const zipHash = await publishTestPlugin(failingSlug, failingPluginDir);
    await getTestPrisma().pluginInstall.create({
      data: { slug: failingSlug, name: manifest.name, version: manifest.version, source: 'local-zip', zipHash, manifestJson: manifest },
    });

    const logError = vi.spyOn(LoggerService, 'logError');
    let result: Awaited<ReturnType<typeof executeLifecycleHook>> | undefined;
    let calls: unknown[][] = [];
    try {
      // The installation does not exist, so the compensating write of the
      // failure fails and the failure is not recorded anywhere else.
      result = await executeLifecycleHook('onDisable', {
        installationId: 'inst_missing',
        pluginSlug: failingSlug,
        instanceKey: 'default',
        config: { enabled: true },
      }, manifest);
      calls = logError.mock.calls;
    } finally {
      logError.mockRestore();
    }

    expect(result?.success).toBe(false);
    expect(result?.error).toBeTruthy();
    const compensation = calls.find(([, meta]) => (meta as Record<string, unknown> | undefined)?.failureStage === 'compensating-write');
    expect(compensation).toBeDefined();
    expect(compensation?.[1]).toMatchObject({
      pluginSlug: failingSlug,
      installationId: 'inst_missing',
      hookName: 'onDisable',
    });
  });
});
