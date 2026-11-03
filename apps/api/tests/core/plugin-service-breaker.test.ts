import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { pluginProtectionScope } from '@/infra/shared-protection';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';
import { clearTestPluginCache } from '../helpers/plugin-cache';

describe('Provider outcomes determine service breaker samples', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  let scope: string;
  const redis = new Redis(env.REDIS_URL);
  const suffix = Date.now().toString(36).slice(-6);
  const providerSlug = `brkprovider${suffix}`;
  const consumerSlug = `brkconsumer${suffix}`;
  const options = () => ({ app, adminToken: admin.token, adminUserId: admin.user.id });

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    admin = await createAdminWithToken();
    await installFixturePlugin(options(), providerSlug, 'integration', [], `module.exports = { register(ctx) {
      class PluginBusinessError extends Error {
        constructor(code, message, details) { super(message); this.code = code; this.details = details; this[Symbol.for('jiffoo.plugin.businessError')] = true; }
      }
      ctx.services.provide('probe', 1, { run: async (input, invocation) => {
        if (input.mode === 'timeout') return new Promise((_, reject) => {
          const abort = () => reject(new Error('Call aborted'));
          if (invocation.signal.aborted) abort();
          else invocation.signal.addEventListener('abort', abort, { once: true });
        });
        if (input.mode === 'throw-refusal') return ctx.database.transaction(async () => {
          throw new PluginBusinessError('REFUSED', 'Refused', {});
        });
        if (input.mode === 'throw') throw new Error('Provider crashed');
        if (input.mode === 'invalid') return { ok: true, data: { value: 42 } };
        if (input.mode === 'refusal') return ctx.services.businessError({ code: 'REFUSED', message: 'Refused', details: {} });
        return { ok: true, data: { value: 'accepted' } };
      } });
    } };`, {
      services: [{ name: 'probe', version: 1, methods: [{ name: 'run', idempotencyRequired: false, schema: 'services/run.json' }] }],
      files: { 'services/run.json': JSON.stringify({
        input: { type: 'object', properties: { mode: { type: 'string' } }, required: ['mode'], additionalProperties: false },
        result: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false },
        errorDetails: { type: 'object', additionalProperties: true },
      }) },
    });
    await installFixturePlugin(options(), consumerSlug, 'integration', [], `module.exports = { register(ctx) {
      ctx.http.route({ method: 'POST', path: '/call', handler: async request => ctx.services.call({
        plugin: ${JSON.stringify(providerSlug)}, service: 'probe', version: 1, method: 'run',
        input: request.body.input, idempotencyKey: request.body.key, ...(request.body.input.mode === 'timeout' ? { timeoutMs: 20 } : {}),
      }) });
    } };`, { serviceDependencies: [{ plugin: providerSlug, service: 'probe', version: 1, methods: ['run'] }] });
    const consumer = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: consumerSlug } });
    await PluginManagementService.updateInstance(consumer.id, { grantedPermissions: [`service:${providerSlug}:probe.v1.run`] });
    const provider = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: providerSlug } });
    scope = pluginProtectionScope(provider.id, provider.protectionGeneration);
  });

  afterAll(async () => {
    for (const slug of [consumerSlug, providerSlug]) {
      await clearTestPluginCache(slug);
      await removeFixturePlugin(options(), slug);
    }
    if (scope) {
      const keys = await redis.keys(`${scope}:*`);
      if (keys.length) await redis.del(...keys);
    }
    redis.disconnect();
    await deleteAllTestUsers();
    await app.close();
  });

  it.each([
    ['success', { mode: 'success' }, 1, 0, undefined],
    ['invalid result', { mode: 'invalid' }, 1, 1, 'PLUGIN_SERVICE_PROVIDER_CRASHED'],
    ['timeout', { mode: 'timeout' }, 1, 1, 'PLUGIN_SERVICE_TIMEOUT'],
    ['business refusal', { mode: 'refusal' }, 1, 0, 'REFUSED'],
    ['thrown business refusal', { mode: 'throw-refusal' }, 1, 0, 'REFUSED'],
    ['ordinary exception', { mode: 'throw' }, 1, 1, 'PLUGIN_SERVICE_PROVIDER_CRASHED'],
    ['Core input refusal', {}, 0, 0, 'PLUGIN_SERVICE_DEPENDENCY_INVALID'],
  ] as const)('records exactly the provider sample for %s', async (name, input, samples, failures, code) => {
    const beforeSamples = await redis.zcard(`${scope}:samples`);
    const beforeFailures = await redis.zcard(`${scope}:failures`);
    const response = await app.inject({ method: 'POST', url: `/api/v1/extensions/plugin/${consumerSlug}/api/call`, payload: { input, key: name } });
    expect(response.statusCode).toBe(200);
    const result = response.json();
    if (code) expect(result.error.code).toBe(code);
    else expect(result.ok).toBe(true);
    if (code === 'REFUSED') expect(result.source).toBe('provider');
    expect(await redis.zcard(`${scope}:samples`)).toBe(beforeSamples + samples);
    expect(await redis.zcard(`${scope}:failures`)).toBe(beforeFailures + failures);
  });
});
