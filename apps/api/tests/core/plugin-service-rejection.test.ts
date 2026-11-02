import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { pluginSchemaName } from 'shared/plugin-signing';

/**
 * The business rejection of a plugin service.
 *
 * The provider refuses a request it understands: the customer has no points.
 * The refusal is raised inside the provider's own transaction, so the
 * transaction is rolled back and the refusal reaches the consumer with its
 * code. The consumer sees a rejection and not a system failure.
 */
describe('The business rejection of a plugin service', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  const providerSlug = `refusal${Date.now().toString(36).slice(-6)}`.slice(0, 20);
  const consumerSlug = `refusals${Date.now().toString(36).slice(-6)}`.slice(0, 20);

  const serviceSchema = {
    input: { type: 'object', properties: { amount: { type: 'integer', minimum: 0 }, reference: { type: 'string' } }, required: ['amount', 'reference'], additionalProperties: false },
    result: { type: 'object', properties: { debited: { type: 'boolean' } }, required: ['debited'], additionalProperties: false },
    errorDetails: { type: 'object', additionalProperties: true },
  };

  const providerSource = `module.exports = { register(ctx) {
    // A plugin carries its own copy of the class, the way a bundled SDK does.
    // The marker is a global symbol, so Core recognises the refusal of the
    // copy the plugin ships.
    class PluginBusinessError extends Error {
      constructor(code, message, details) { super(message); this.code = code; this.details = details; this[Symbol.for('jiffoo.plugin.businessError')] = true; }
    }
    ctx.services.provide('wallet', 1, {
      debit: async input => ctx.database.transaction(async tx => {
        await tx.query('INSERT INTO records VALUES ($1, $2)', [input.reference, 'debit']);
        throw new PluginBusinessError('INSUFFICIENT_BALANCE', 'The customer does not have enough points.', { balance: 0, required: input.amount });
      }),
    });
  } };`;

  const consumerSource = `module.exports = { register(ctx) {
    ctx.http.route({ method: 'POST', path: '/call', handler: async request => ctx.services.call({
      plugin: ${JSON.stringify(providerSlug)}, service: 'wallet', version: 1, method: 'debit',
      input: { amount: request.body.amount, reference: request.body.reference }, idempotencyKey: request.body.key,
    }) });
  } };`;

  const options = () => ({ app, adminToken: admin.token, adminUserId: admin.user.id });

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    admin = await createAdminWithToken();
    await installFixturePlugin(options(), providerSlug, 'integration', [], providerSource, {
      services: [{ name: 'wallet', version: 1, methods: [{ name: 'debit', idempotencyRequired: false, schema: 'services/debit.json' }] }],
      migrations: [{ id: 'first', path: 'migrations/001.sql', sql: 'CREATE TABLE records (id TEXT PRIMARY KEY, value TEXT NOT NULL);' }],
      files: { 'services/debit.json': JSON.stringify(serviceSchema) },
    });
    await installFixturePlugin(options(), consumerSlug, 'integration', [], consumerSource, {
      serviceDependencies: [{ plugin: providerSlug, service: 'wallet', version: 1, methods: ['debit'] }],
    });
    const consumer = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: consumerSlug } });
    await PluginManagementService.updateInstance(consumer.id, { grantedPermissions: [`service:${providerSlug}:wallet.v1.debit`] });
  });

  afterAll(async () => {
    for (const slug of [consumerSlug, providerSlug]) {
      await clearTestPluginCache(slug);
      await removeFixturePlugin(options(), slug);
      await cleanupPluginMigrationFixture(slug);
    }
    await deleteAllTestUsers();
    await app.close();
  });

  it('answers the consumer with the refusal of the provider and rolls the transaction back', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/extensions/plugin/${consumerSlug}/api/call`,
      payload: { amount: 10, reference: 'ref-1', key: 'call-1' },
    });
    expect(response.statusCode).toBe(200);
    // The refusal is the provider's answer: it keeps its code and it is not a
    // failure of the provider.
    expect(response.json()).toEqual({
      ok: false,
      source: 'provider',
      error: { code: 'INSUFFICIENT_BALANCE', message: 'The customer does not have enough points.', details: { balance: 0, required: 10 } },
    });
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "${pluginSchemaName(providerSlug)}".records`);
    expect(rows).toEqual([]);
    const installation = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: providerSlug } });
    expect(installation.lastFailureMessage).toBeNull();
  });
});
