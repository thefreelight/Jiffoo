import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { getTestPrisma } from '../helpers/db';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import {
  assertNoEnabledDependents,
  assertProviderUpdateKeepsDependents,
  assertServiceDependenciesSatisfied,
  assertServiceDisableConfirmed,
  satisfiesPackageRange,
  serviceDisableConfirmation,
  serviceGraph,
} from '@/core/extensions/registry';

/**
 * The service dependency graph of the plugin registry.
 *
 * The graph decides whether a consumer may run, names the dependents of a
 * provider that is about to be disabled, and publishes the derived
 * availability of every installation. The tests drive three real plugins: a
 * provider, a consumer and a plugin that depends on the consumer, so the
 * transitive case is a real one.
 */
describe('The service dependency graph', () => {
  const prisma = getTestPrisma();
  const suffix = Date.now().toString(36).slice(-6);
  const providerSlug = `graphprov${suffix}`;
  const consumerSlug = `graphcons${suffix}`;
  const downstreamSlug = `graphdown${suffix}`;
  const directories: string[] = [];
  let providerInstallationId = '';
  let consumerInstallationId = '';
  let downstreamInstallationId = '';

  const methodSchema = {
    input: { type: 'object', properties: { amount: { type: 'integer', minimum: 0 } }, required: ['amount'], additionalProperties: false },
    result: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    errorDetails: { type: 'object', additionalProperties: true },
  };

  const providerManifest = {
    schemaVersion: 1, slug: providerSlug, name: 'Graph provider', version: '1.0.0',
    description: 'offers the wallet service', category: 'integration',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js', permissions: [],
    services: [{ name: 'wallet', version: 1, methods: [{ name: 'debit', idempotencyRequired: false, schema: 'services/debit.json' }] }],
  };

  const consumerManifest = {
    schemaVersion: 1, slug: consumerSlug, name: 'Graph consumer', version: '1.0.0',
    description: 'calls the wallet service', category: 'integration',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js', permissions: [],
    dependencies: { [providerSlug]: '^1.0.0' },
    services: [{ name: 'ledger', version: 1, methods: [{ name: 'report', idempotencyRequired: false, schema: 'services/report.json' }] }],
    serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit'] }],
  };

  const downstreamManifest = {
    schemaVersion: 1, slug: downstreamSlug, name: 'Graph downstream', version: '1.0.0',
    description: 'calls the ledger service', category: 'integration',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
    entryModule: 'server/index.js', permissions: [],
    serviceDependencies: [{ plugin: consumerSlug, service: 'ledger', version: 1, methods: ['report'] }],
  };

  async function pluginDirectory(files: Record<string, string>): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-graph-'));
    directories.push(directory);
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(directory, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf-8');
    }
    return directory;
  }

  async function install(slug: string, manifest: Record<string, unknown>, source: string, enabled: boolean): Promise<string> {
    const directory = await pluginDirectory({
      'manifest.json': JSON.stringify(manifest),
      'services/debit.json': JSON.stringify(methodSchema),
      'services/report.json': JSON.stringify(methodSchema),
      'server/index.js': source,
    });
    const zipHash = await publishTestPlugin(slug, directory);
    await prisma.pluginInstall.create({
      data: {
        slug, name: slug, version: manifest.version as string, description: 'graph test', category: 'integration',
        runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip',
        zipHash, manifestJson: manifest, permissions: JSON.stringify([]),
      },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled, configJson: JSON.stringify({}) },
    });
    return installation.id;
  }

  beforeAll(async () => {
    providerInstallationId = await install(providerSlug, providerManifest, `module.exports = { register(ctx) {
      ctx.services.provide('wallet', 1, { debit: async () => ({ ok: true, data: { ok: true } }) });
    } };`, false);
    consumerInstallationId = await install(consumerSlug, consumerManifest, `module.exports = { register(ctx) {
      ctx.services.provide('ledger', 1, { report: async () => ({ ok: true, data: { ok: true } }) });
    } };`, false);
    downstreamInstallationId = await install(downstreamSlug, downstreamManifest, `module.exports = { register(ctx) {} };`, false);

    // The provider runs first: a consumer may only run once its provider is
    // operational.
    await PluginManagementService.updateInstance(providerInstallationId, { enabled: true });
    await PluginManagementService.updateInstance(consumerInstallationId, {
      enabled: true,
      grantedPermissions: [`service:${providerSlug}:wallet.v1.debit`],
    });
    await PluginManagementService.updateInstance(downstreamInstallationId, {
      enabled: true,
      grantedPermissions: [`service:${consumerSlug}:ledger.v1.report`],
    });
  });

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: { in: [providerSlug, consumerSlug, downstreamSlug] } } });
    await prisma.pluginInstall.deleteMany({ where: { slug: { in: [providerSlug, consumerSlug, downstreamSlug] } } });
    for (const slug of [providerSlug, consumerSlug, downstreamSlug]) await clearTestPluginCache(slug);
    for (const directory of directories) await fs.rm(directory, { recursive: true, force: true });
  });

  it('reads the declarations of the providers and of the consumers', async () => {
    const graph = await serviceGraph();
    expect(graph.entries.get(providerSlug)?.exports).toEqual([{ service: 'wallet', version: 1, methods: ['debit'] }]);
    expect(graph.entries.get(consumerSlug)?.requires).toEqual([
      { provider: providerSlug, service: 'wallet', version: 1, methods: ['debit'], packageRange: '^1.0.0' },
    ]);
    expect(graph.unavailable.has(consumerSlug)).toBe(false);
    expect(graph.unavailable.has(downstreamSlug)).toBe(false);
  });

  it('answers the version of the graph it read', async () => {
    const first = await serviceGraph();
    const second = await serviceGraph();
    expect(first.revision).toBe(second.revision);
    expect(first.revision).toHaveLength(32);
  });

  it('refuses a consumer whose provider is not installed', async () => {
    const manifest = {
      ...consumerManifest,
      slug: 'graphorphan',
      serviceDependencies: [{ plugin: 'graphmissing', service: 'wallet', version: 1, methods: ['debit'] }],
    };
    await expect(assertServiceDependenciesSatisfied({ slug: 'graphorphan', manifest: manifest as never, grantedPermissions: [] }))
      .rejects.toMatchObject({ code: 'PLUGIN_SERVICE_DEPENDENCY_INVALID' });
  });

  it('refuses a consumer that calls a method the provider does not export', async () => {
    const manifest = {
      ...consumerManifest,
      slug: 'graphmethod',
      serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit', 'withdraw'] }],
    };
    const failure = await assertServiceDependenciesSatisfied({ slug: 'graphmethod', manifest: manifest as never, grantedPermissions: [] })
      .then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
    expect(String((failure?.safeDetails as { reasons?: string[] }).reasons?.[0])).toContain('withdraw');
  });

  it('refuses a version outside the range the consumer asks for', async () => {
    const manifest = {
      ...consumerManifest,
      slug: 'graphrange',
      dependencies: { [providerSlug]: '^2.0.0' },
    };
    const failure = await assertServiceDependenciesSatisfied({ slug: 'graphrange', manifest: manifest as never, grantedPermissions: [] })
      .then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
    expect(String((failure?.safeDetails as { reasons?: string[] }).reasons?.[0])).toContain('^2.0.0');
  });

  it('refuses a consumer whose methods are not granted', async () => {
    const failure = await assertServiceDependenciesSatisfied({
      slug: 'graphgrant', manifest: consumerManifest as never, grantedPermissions: [],
    }).then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
    expect(String((failure?.safeDetails as { reasons?: string[] }).reasons?.[0])).toContain(`service:${providerSlug}:wallet.v1.debit`);
  });

  it('refuses a dependency cycle', async () => {
    const firstSlug = `graphcyca${suffix}`;
    const secondSlug = `graphcycb${suffix}`;
    const first = {
      schemaVersion: 1, slug: firstSlug, name: 'Cycle a', version: '1.0.0', description: 'cycle', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [],
      services: [{ name: 'alpha', version: 1, methods: [{ name: 'ping', idempotencyRequired: false, schema: 'services/debit.json' }] }],
      serviceDependencies: [{ plugin: secondSlug, service: 'beta', version: 1, methods: ['pong'] }],
    };
    const second = {
      schemaVersion: 1, slug: secondSlug, name: 'Cycle b', version: '1.0.0', description: 'cycle', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [],
      services: [{ name: 'beta', version: 1, methods: [{ name: 'pong', idempotencyRequired: false, schema: 'services/debit.json' }] }],
      serviceDependencies: [{ plugin: firstSlug, service: 'alpha', version: 1, methods: ['ping'] }],
    };
    await prisma.pluginInstall.createMany({
      data: [
        { slug: firstSlug, name: firstSlug, version: '1.0.0', description: 'cycle', category: 'integration', runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip', zipHash: 'cycle-a', manifestJson: first, permissions: JSON.stringify([]) },
        { slug: secondSlug, name: secondSlug, version: '1.0.0', description: 'cycle', category: 'integration', runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip', zipHash: 'cycle-b', manifestJson: second, permissions: JSON.stringify([]) },
      ],
    });
    await prisma.pluginInstallation.createMany({
      data: [
        { pluginSlug: firstSlug, instanceKey: 'default', enabled: true, configJson: JSON.stringify({}) },
        { pluginSlug: secondSlug, instanceKey: 'default', enabled: true, configJson: JSON.stringify({}) },
      ],
    });
    try {
      const failure = await assertServiceDependenciesSatisfied({
        slug: firstSlug, manifest: first as never, grantedPermissions: [`service:${secondSlug}:beta.v1.pong`],
      }).then(() => null, (error: any) => error);
      expect(failure?.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
      expect(String((failure?.safeDetails as { reasons?: string[] }).reasons?.[0])).toContain('cycle');
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: { in: [firstSlug, secondSlug] } } });
      await prisma.pluginInstall.deleteMany({ where: { slug: { in: [firstSlug, secondSlug] } } });
    }
  });

  it('names the dependents of a provider and needs a confirmation to disable it', async () => {
    const confirmation = await serviceDisableConfirmation(providerSlug);
    expect(confirmation.affected).toContain(consumerSlug);

    const failure = await PluginManagementService.updateInstance(providerInstallationId, { enabled: false })
      .then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DISABLE_CONFIRMATION_REQUIRED');
    expect((failure?.safeDetails as { affectedDependents?: string[] }).affectedDependents).toContain(consumerSlug);
  });

  it('publishes the transitive unavailability of the dependents', async () => {
    const confirmation = await serviceDisableConfirmation(providerSlug);
    await PluginManagementService.updateInstance(providerInstallationId, { enabled: false, confirmation: confirmation.digest });

    const consumer = await prisma.pluginInstallation.findUnique({ where: { id: consumerInstallationId } });
    expect(consumer?.taskDependencyUnavailable).toBe(true);
    // The plugin that depends on the consumer is unavailable as well.
    const downstream = await prisma.pluginInstallation.findUnique({ where: { id: downstreamInstallationId } });
    expect(downstream?.taskDependencyUnavailable).toBe(true);

    const graph = await serviceGraph();
    expect(graph.unavailable.has(consumerSlug)).toBe(true);
    expect(graph.unavailable.has(downstreamSlug)).toBe(true);
  });

  it('publishes the availability again when the provider comes back', async () => {
    await PluginManagementService.updateInstance(providerInstallationId, { enabled: true });
    const consumer = await prisma.pluginInstallation.findUnique({ where: { id: consumerInstallationId } });
    expect(consumer?.taskDependencyUnavailable).toBe(false);
    const downstream = await prisma.pluginInstallation.findUnique({ where: { id: downstreamInstallationId } });
    expect(downstream?.taskDependencyUnavailable).toBe(false);
  });

  it('refuses a confirmation that was given for another revision of the graph', async () => {
    const failure = await assertServiceDisableConfirmed(providerSlug, 'not-the-digest')
      .then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DISABLE_CONFIRMATION_REQUIRED');
  });

  it('refuses to uninstall a provider an enabled dependent calls', async () => {
    const failure = await PluginManagementService.uninstallPlugin(providerSlug)
      .then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DEPENDENTS_ENABLED');
    expect((failure?.safeDetails as { affectedDependents?: string[] }).affectedDependents).toContain(consumerSlug);
    await expect(assertNoEnabledDependents(providerSlug)).rejects.toMatchObject({ code: 'PLUGIN_SERVICE_DEPENDENTS_ENABLED' });
  });

  it('refuses a provider version outside the range its dependents ask for', async () => {
    const failure = await assertProviderUpdateKeepsDependents(providerSlug, '2.0.0')
      .then(() => null, (error: any) => error);
    expect(failure?.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
    expect((failure?.safeDetails as { affectedDependents?: string[] }).affectedDependents).toContain(consumerSlug);
    await expect(assertProviderUpdateKeepsDependents(providerSlug, '1.4.0')).resolves.toBeUndefined();
  });

  it('answers the ranges the manifest accepts', () => {
    expect(satisfiesPackageRange('1.0.0', '^1.0.0')).toBe(true);
    expect(satisfiesPackageRange('1.9.9', '^1.0.0')).toBe(true);
    expect(satisfiesPackageRange('2.0.0', '^1.0.0')).toBe(false);
    expect(satisfiesPackageRange('1.0.9', '~1.0.0')).toBe(true);
    expect(satisfiesPackageRange('1.1.0', '~1.0.0')).toBe(false);
    expect(satisfiesPackageRange('1.2.0', '>=1.1.0')).toBe(true);
    expect(satisfiesPackageRange('1.2.0', '<=1.1.0')).toBe(false);
    expect(satisfiesPackageRange('1.2.0', '>1.1.0')).toBe(true);
    expect(satisfiesPackageRange('1.2.0', '<1.3.0')).toBe(true);
    expect(satisfiesPackageRange('1.2.0', '1.2.0')).toBe(true);
    expect(satisfiesPackageRange('1.2.0', '1.2.1')).toBe(false);
    expect(satisfiesPackageRange('1.2.0', '^1.0')).toBe(false);
  });
});
