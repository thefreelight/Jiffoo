import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';

/**
 * The admin surface of the service contract.
 *
 * The merchant sees which permissions the services a plugin calls need, which
 * of them are granted, and which plugins lose a service when a provider is
 * disabled. The confirmation of that impact binds the list and the revision of
 * the graph, and the lifecycle audit records the granted declaration.
 */
describe('The admin surface of the plugin services', () => {
  let app: FastifyInstance;
  let token = '';
  let actorId = '';
  const providerSlug = `permprov${randomUUID().slice(0, 8)}`;
  const consumerSlug = `permcons${randomUUID().slice(0, 8)}`;
  const schema = {
    input: { type: 'object', properties: { amount: { type: 'integer', minimum: 0 } }, required: ['amount'], additionalProperties: false },
    result: { type: 'object', properties: { debited: { type: 'boolean' } }, required: ['debited'], additionalProperties: false },
    errorDetails: { type: 'object', additionalProperties: true },
  };
  const permission = `service:${providerSlug}:wallet.v1.debit`;

  async function request(url: string, options: { method?: string; payload?: unknown } = {}) {
    return app.inject({
      method: (options.method ?? 'GET') as 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(options.payload === undefined ? {} : { payload: options.payload as never }),
    });
  }

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false, disableRedis: false, disableDynamicPlugins: false });
    const admin = await createAdminWithToken();
    token = admin.token;
    actorId = admin.user.id;
    const options = { app, adminToken: token, adminUserId: actorId };
    await installFixturePlugin(options, providerSlug, 'integration', [],
      `module.exports = { register(ctx) { ctx.services.provide('wallet', 1, { debit: async () => ({ ok: true, data: { debited: true } }) }); } };`,
      { services: [{ name: 'wallet', version: 1, methods: [{ name: 'debit', idempotencyRequired: true, schema: 'services/debit.json' }] }], files: { 'services/debit.json': JSON.stringify(schema) } });
    await installFixturePlugin(options, consumerSlug, 'integration', [],
      `module.exports = { register(ctx) {} };`,
      { enable: false, serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit'] }] });
  });

  afterAll(async () => {
    const options = { app, adminToken: token, adminUserId: actorId };
    await removeFixturePlugin(options, consumerSlug);
    await removeFixturePlugin(options, providerSlug);
    await prisma.adminAuditEvent.deleteMany({ where: { targetType: 'plugin', targetId: { in: [providerSlug, consumerSlug] } } });
    await deleteAllTestUsers();
    await app.close();
  });

  it('lists the permissions the services a plugin calls need', async () => {
    const response = await request(`/api/v1/extensions/plugin/${consumerSlug}`);
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.servicePermissions).toEqual([permission]);
  });

  it('grants the declared service permissions when the plugin is installed', async () => {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: consumerSlug, instanceKey: 'default' } },
    });
    expect(instance.grantedPermissions).toEqual([permission]);
  });

  it('activates the consumer only with the granted permission', async () => {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: consumerSlug, instanceKey: 'default' } },
    });
    const refused = await request(`/api/v1/extensions/plugin/${consumerSlug}/instances/${instance.id}`, {
      method: 'PATCH', payload: { enabled: true, grantedPermissions: [] },
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');

    const allowed = await request(`/api/v1/extensions/plugin/${consumerSlug}/instances/${instance.id}`, {
      method: 'PATCH', payload: { enabled: true, grantedPermissions: [permission] },
    });
    expect(allowed.statusCode).toBe(200);
  });

  it('names the dependents of a provider and the confirmation of their loss', async () => {
    const impact = await request(`/api/v1/extensions/plugin/${providerSlug}/disable-impact`);
    expect(impact.statusCode).toBe(200);
    const data = impact.json().data;
    expect(data.serviceDependents).toContain(consumerSlug);
    expect(data.graphRevision).toBeTruthy();
    expect(data.disableConfirmation).toBeTruthy();
  });

  it('refuses a disable without the confirmation and accepts it with the confirmation', async () => {
    const instance = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: providerSlug, instanceKey: 'default' } },
    });
    const refused = await request(`/api/v1/extensions/plugin/${providerSlug}/instances/${instance.id}`, {
      method: 'PATCH', payload: { enabled: false },
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('PLUGIN_SERVICE_DISABLE_CONFIRMATION_REQUIRED');
    expect(refused.json().error.details.affectedDependents).toContain(consumerSlug);

    const impact = await request(`/api/v1/extensions/plugin/${providerSlug}/disable-impact`);
    const confirmed = await request(`/api/v1/extensions/plugin/${providerSlug}/instances/${instance.id}`, {
      method: 'PATCH', payload: { enabled: false, confirmation: impact.json().data.disableConfirmation },
    });
    expect(confirmed.statusCode).toBe(200);
  });

  it('records the granted declaration in the lifecycle audit', async () => {
    const rows = await prisma.adminAuditEvent.findMany({
      where: { targetType: 'plugin', targetId: { in: [providerSlug, consumerSlug] } },
      orderBy: { createdAt: 'asc' },
    });
    const disabled = rows.find(row => row.action === 'PLUGIN_DISABLED' && row.targetId === providerSlug);
    expect(disabled).toBeTruthy();
    expect(disabled?.actorId).toBe(actorId);
    const disabledSummary = disabled?.summary as { grantedPermissions?: string[]; grantedPermissionDigest?: string; servicePermissions?: string[] };
    expect(disabledSummary.grantedPermissions).toEqual([]);
    expect(disabledSummary.grantedPermissionDigest).toBeTruthy();
    expect(disabledSummary.servicePermissions).toEqual([]);

    const enabled = rows.find(row => row.action === 'PLUGIN_ENABLED' && row.targetId === consumerSlug);
    expect(enabled).toBeTruthy();
    const enabledSummary = enabled?.summary as { grantedPermissions?: string[]; grantedPermissionDigest?: string; servicePermissions?: string[] };
    expect(enabledSummary.grantedPermissions).toEqual([permission]);
    expect(enabledSummary.grantedPermissionDigest).toBeTruthy();
    expect(enabledSummary.servicePermissions).toEqual([permission]);
  });
});
