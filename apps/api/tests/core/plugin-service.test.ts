import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { createTestApp } from '../helpers/create-test-app';
import { deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { validateServicePayload, validateServiceSchemaDocument, serviceSchemaDigest, getPluginManifestIssues } from '@jiffoo/shared';

/**
 * The core-mediated plugin service contract of G4.
 *
 * Two real plugins take part: a provider that offers the `wallet` service and a
 * consumer that calls it. The call goes through Core, so the merchant's grant
 * and the provider's declaration decide whether it happens.
 */
describe('Plugin service contract', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const providerSlug = `svcprov${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const consumerSlug = `svccons${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const directories: string[] = [];

  const schema = {
    input: { type: 'object', properties: { amount: { type: 'integer', minimum: 0 } }, required: ['amount'], additionalProperties: false },
    result: { type: 'object', properties: { debited: { type: 'boolean' } }, required: ['debited'], additionalProperties: false },
    errorDetails: { type: 'object', additionalProperties: true },
  };

  async function pluginDirectory(files: Record<string, string>): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-service-'));
    directories.push(directory);
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(directory, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf-8');
    }
    return directory;
  }

  async function install(slug: string, directory: string, manifest: Record<string, unknown>): Promise<string> {
    const zipHash = await publishTestPlugin(slug, directory);
    await prisma.pluginInstall.create({
      data: {
        slug, name: slug, version: '1.0.0', description: 'service test', category: 'integration',
        runtimeType: 'internal-fastify', entryModule: 'server/index.js', source: 'local-zip',
        zipHash, manifestJson: manifest, permissions: JSON.stringify([]),
      },
    });
    const installation = await prisma.pluginInstallation.create({
      data: { pluginSlug: slug, instanceKey: 'default', enabled: true, configJson: JSON.stringify({}) },
    });
    return installation.id;
  }

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });

    const providerManifest = {
      schemaVersion: 1, slug: providerSlug, name: 'Service provider', version: '1.0.0',
      description: 'offers the wallet service', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      services: [{ name: 'wallet', version: 1, methods: [
        { name: 'debit', idempotencyRequired: false, schema: 'services/debit.json' },
        { name: 'refuse', idempotencyRequired: false, schema: 'services/refuse.json' },
      ] }],
    };
    const providerDirectory = await pluginDirectory({
      'manifest.json': JSON.stringify(providerManifest),
      'services/debit.json': JSON.stringify(schema),
      'services/refuse.json': JSON.stringify(schema),
      'server/index.js': `module.exports = { register(ctx) {
        ctx.services.provide('wallet', 1, {
          debit: async (input) => ({ ok: true, data: { debited: input.amount >= 0 } }),
          refuse: async (input) => ctx.services.businessError({ code: 'INSUFFICIENT_FUNDS', message: 'Not enough funds', details: { required: input.amount } }),
        });
      } };`,
    });
    await install(providerSlug, providerDirectory, providerManifest);

    const consumerManifest = {
      schemaVersion: 1, slug: consumerSlug, name: 'Service consumer', version: '1.0.0',
      description: 'calls the wallet service', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit', 'refuse'] }],
    };
    const consumerDirectory = await pluginDirectory({
      'manifest.json': JSON.stringify(consumerManifest),
      'server/index.js': `module.exports = { register(ctx) {
        ctx.http.route({ method: 'POST', path: '/call', handler: async (request) => ctx.services.call({
          plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
          input: { amount: request.body.amount }, idempotencyKey: request.body.key,
        }) });
        ctx.http.route({ method: 'POST', path: '/ungranted', handler: async (request) => ctx.services.call({
          plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
          input: { amount: 1 }, idempotencyKey: 'key-2',
        }) });
        ctx.http.route({ method: 'POST', path: '/refused', handler: async (request) => ctx.services.call({
          plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'refuse',
          input: { amount: request.body.amount }, idempotencyKey: request.body.key,
        }) });
        ctx.http.route({ method: 'POST', path: '/undeclared', handler: async (request) => ctx.services.call({
          plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'missing',
          input: { amount: 1 }, idempotencyKey: request.body.key,
        }) });
      } };`,
    });
    consumerInstallationId = await install(consumerSlug, consumerDirectory, consumerManifest);
  });

  let consumerInstallationId = '';

  afterAll(async () => {
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: { in: [providerSlug, consumerSlug] } } });
    await prisma.pluginInstall.deleteMany({ where: { slug: { in: [providerSlug, consumerSlug] } } });
    await clearTestPluginCache(providerSlug);
    await clearTestPluginCache(consumerSlug);
    await deleteAllTestUsers();
    await app.close();
    for (const directory of directories) await fs.rm(directory, { recursive: true, force: true });
  });

  it('refuses a method the manifest does not declare', async () => {
    const issues = validateServiceSchemaDocument({ input: schema.input, result: schema.result, errorDetails: schema.errorDetails });
    expect(issues).toEqual([]);
    expect(validateServiceSchemaDocument({ input: schema.input, result: schema.result })).not.toEqual([]);
    expect(validateServiceSchemaDocument({ input: { type: 'object', $ref: 'https://example.com/schema.json' }, result: schema.result, errorDetails: schema.errorDetails })).not.toEqual([]);
    expect(validateServiceSchemaDocument({ input: { type: 'object', code: 'process.exit()' }, result: schema.result, errorDetails: schema.errorDetails })).not.toEqual([]);
    expect(validateServicePayload(schema.input, { amount: 5 })).toEqual([]);
    expect(validateServicePayload(schema.input, { amount: 5, extra: true })).not.toEqual([]);
    expect(serviceSchemaDigest(schema)).toBe(serviceSchemaDigest({ result: schema.result, input: schema.input, errorDetails: schema.errorDetails }));
  });

  it('calls the provider through Core when the merchant granted the method', async () => {
    await PluginManagementService.updateInstance(consumerInstallationId, {
      grantedPermissions: [`service:${providerSlug}:wallet.v1.debit`],
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/call`,
      payload: { amount: 3, key: 'key-1' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, data: { debited: true } });
  });

  it('refuses the call when the method is not granted', async () => {
    await PluginManagementService.updateInstance(consumerInstallationId, { grantedPermissions: [] });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/call`,
      payload: { amount: 3, key: 'key-3' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(false);
    expect(body.source).toBe('core');
    expect(body.error.code).toBe('PLUGIN_SERVICE_PERMISSION_DENIED');
    await PluginManagementService.updateInstance(consumerInstallationId, {
      grantedPermissions: [`service:${providerSlug}:wallet.v1.debit`, `service:${providerSlug}:wallet.v1.refuse`],
    });
  });

  it('passes the business rejection of the provider through unchanged', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/refused`,
      payload: { amount: 7, key: 'key-refused' },
    });
    expect(response.statusCode).toBe(200);
    // The provider answered: the rejection is its own, not a failure of Core.
    expect(response.json()).toEqual({
      ok: false,
      source: 'provider',
      error: { code: 'INSUFFICIENT_FUNDS', message: 'Not enough funds', details: { required: 7 } },
    });
  });

  it('refuses a method the caller does not declare before the provider is entered', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/undeclared`,
      payload: { amount: 1, key: 'key-undeclared' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(false);
    expect(body.source).toBe('core');
    expect(body.error.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
  });

  it('refuses a manifest that names a wildcard provider', () => {
    const manifest = {
      schemaVersion: 1, slug: 'wildcard-consumer', name: 'Wildcard consumer', version: '1.0.0',
      description: 'calls any provider', category: 'integration',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [],
      serviceDependencies: [{ plugin: '*', service: 'wallet', version: 1, methods: ['debit'] }],
    };
    const issues = getPluginManifestIssues(manifest);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(issue => issue.code === 'PLUGIN_SERVICE_DEPENDENCY_INVALID')).toBe(true);
  });
});
