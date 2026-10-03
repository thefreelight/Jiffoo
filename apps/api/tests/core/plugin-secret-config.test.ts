import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { callContract, dropInternalRuntime } from '@/core/admin/extension-installer/plugin-runtime';
import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';
import { EventDeliveryEngine } from '@/infra/events/delivery';
import { emitEvent } from '@/infra/events/emit';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';

const schema = {
  type: 'object',
  properties: {
    token: { type: 'string', sensitive: true },
    label: { type: 'string' },
    directory: { type: 'string' },
  },
  required: ['token'],
};
const source = `
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
module.exports = {
  register(ctx) {
    const digest = () => createHash('sha256').update(ctx.config.token).digest('hex');
    ctx.contracts.implement('payment', 1, {
      describe: (input) => {
        if (ctx.config.failContract) throw new Error('contract ' + ctx.config.token);
        return { displayName: digest(), requiresManualConfirmation: true, unpaidTimeoutMinutes: 60, supportedCurrencies: [input.storeCurrency] };
      },
      createSession: (input) => ({ sessionId: input.orderId, action: { type: 'none' } }),
      getSessionStatus: () => ({ status: 'pending' }),
    });
    ctx.events.subscribe('order.created', 1, async (event) => {
      fs.writeFileSync(path.join(ctx.config.directory, event.id + '.digest'), digest());
      if (ctx.config.failEvent) throw new Error('event ' + ctx.config.token);
    });
    ctx.http.route({ method: 'GET', path: '/headers', handler: (request) => ({
      configHeader: request.headers['x-plugin-config'] || null,
      digest: digest(),
    }) });
  },
  __lifecycle_onDisable(context) {
    if (context.config.failLifecycle) throw new Error('lifecycle ' + context.config.token);
  },
  __lifecycle_onEnable(context) {
    if (context.config.failLifecycle) throw new Error('lifecycle ' + context.config.token);
  },
};`;

describe('plugin secret configuration', () => {
  let app: FastifyInstance;
  let admin: Awaited<ReturnType<typeof createAdminWithToken>>;
  let directory: string;
  const slugs: string[] = [];
  const events: string[] = [];
  const children: Array<{ child: ChildProcess; exited: Promise<unknown[]> }> = [];

  beforeEach(async () => {
    app = await createTestApp({ disableRedis: false });
    admin = await createAdminWithToken();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-secret-'));
  });
  afterEach(async () => {
    for (const { child, exited } of children.splice(0)) {
      if (child.connected) child.send({ command: 'stop', requestId: randomUUID() });
      await exited;
    }
    await prisma.eventDelivery.deleteMany({ where: { eventId: { in: events } } });
    await prisma.eventRecord.deleteMany({ where: { id: { in: events.splice(0) } } });
    for (const slug of slugs.splice(0)) {
      const row = await prisma.pluginInstallation.findFirst({ where: { pluginSlug: slug } });
      if (row) {
        await dropInternalRuntime(row.id);
        await prisma.pluginInstallation.update({ where: { id: row.id }, data: { enabled: false } });
      }
      await removeFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug);
    }
    await deleteTestUser(admin.user.id);
    await app.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  async function install(token: string, extras: Record<string, unknown> = {}) {
    const slug = `secret-${randomUUID().slice(0, 12)}`;
    slugs.push(slug);
    await installFixturePlugin(
      { app, adminToken: admin.token, adminUserId: admin.user.id },
      slug, 'payment', [{ name: 'payment', version: 1 }], source,
      { configSchema: { ...schema, properties: { ...schema.properties, ...Object.fromEntries(Object.keys(extras).map((key) => [key, { type: 'boolean' }])) } },
        subscriptions: [{ type: 'order.created', version: 1 }],
        lifecycle: { onDisable: true, onEnable: true },
        config: { token, label: 'ordinary', directory, ...extras } },
    );
    const row = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
    return { slug, row };
  }
  async function update(slug: string, id: string, config: Record<string, unknown>) {
    return app.inject({
      method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${id}`,
      headers: { authorization: `Bearer ${admin.token}` }, payload: { config },
    });
  }
  async function emit() {
    const event = await prisma.$transaction((tx) => emitEvent(tx, 'order.created', 1, randomUUID(), {
      id: randomUUID(), userId: randomUUID(), totalAmount: 10, currency: 'USD', items: [],
    }));
    events.push(event.id);
    return event;
  }

  it('A: encrypts sensitive values in the raw installation row while leaving ordinary values plain', async () => {
    const secret = `secret-${randomUUID()}`;
    const { row } = await install(secret);
    const config = row.configJson as Record<string, string>;
    expect(config.token).toMatch(/^enc:v1:[a-f0-9]{8}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(JSON.stringify(row.configJson)).not.toContain(secret);
    expect(config.label).toBe('ordinary');
  });

  it('B and G: contract, gateway and child worker receive config only through runtime context', async () => {
    const secret = `secret-${randomUUID()}`;
    const { slug } = await install(secret);
    const digest = createHash('sha256').update(secret).digest('hex');
    const described = await callContract(slug, 'payment', 1, 'describe', { storeCurrency: 'USD' }) as { displayName: string };
    expect(described.displayName).toBe(digest);
    const gateway = await app.inject({ method: 'GET', url: `/api/v1/extensions/plugin/${slug}/api/headers` });
    expect(gateway.statusCode).toBe(200);
    expect(gateway.json()).toMatchObject({ configHeader: null, digest });
    const event = await emit();
    const child = fork(path.resolve('tests/helpers/event-worker-child.ts'), [], {
      execArgv: ['--import', 'tsx'],
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST!, REDIS_URL: 'redis://localhost:6379/15' },
    });
    const exited = once(child, 'exit');
    children.push({ child, exited });
    await once(child, 'message');
    const result = new Promise<Record<string, unknown>>((resolve) => child.once('message', resolve));
    child.send({ command: 'run', requestId: randomUUID() });
    expect((await result).kind).toBe('claimed');
    await new Promise<void>((resolve) => child.once('message', () => resolve()));
    expect(await fs.readFile(path.join(directory, event.id + '.digest'), 'utf8')).toBe(digest);
  });

  it('C: omission preserves ciphertext and replacement uses a fresh IV', async () => {
    const { slug, row } = await install(`secret-${randomUUID()}`);
    const first = (row.configJson as Record<string, string>).token;
    expect((await update(slug, row.id, { label: 'changed', directory })).statusCode).toBe(200);
    const preserved = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } });
    expect((preserved.configJson as Record<string, string>).token).toBe(first);
    expect((await update(slug, row.id, { token: `replacement-${randomUUID()}`, label: 'changed', directory })).statusCode).toBe(200);
    const replaced = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } });
    expect((replaced.configJson as Record<string, string>).token).toMatch(/^enc:v1:/);
    expect((replaced.configJson as Record<string, string>).token).not.toBe(first);
    expect((replaced.configJson as Record<string, string>).token.split(':')[3]).not.toBe(first.split(':')[3]);
  });

  it.each(['wrong key', 'tampered', 'plaintext'])('D: %s secret makes only that installation unready', async (kind) => {
    const secret = `secret-${randomUUID()}`;
    const { slug, row } = await install(secret);
    const healthy = await install(`healthy-${randomUUID()}`);
    const config = row.configJson as Record<string, string>;
    const parts = config.token.split(':');
    const ciphertext = Buffer.from(parts[5], 'base64url');
    ciphertext[0] ^= 1;
    const broken = kind === 'wrong key' ? config.token.replace(/^enc:v1:[^:]+/, 'enc:v1:00000000')
      : kind === 'tampered' ? [...parts.slice(0, 5), ciphertext.toString('base64url')].join(':') : secret;
    await prisma.pluginInstallation.update({ where: { id: row.id }, data: { configJson: { ...config, token: broken } } });
    const manifest = (await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } })).manifestJson;
    expect(evaluatePluginConfigReadiness(manifest, { ...config, token: broken })).toMatchObject({ ready: false, missingFields: ['token'] });
    await expect(callContract(slug, 'payment', 1, 'describe', { storeCurrency: 'USD' })).rejects.toThrow();
    const failed = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } });
    expect(failed.lastFailureMessage).toContain('re-enter');
    expect(failed.lastFailureMessage).not.toContain(secret);
    expect(await callContract(healthy.slug, 'payment', 1, 'describe', { storeCurrency: 'USD' })).toMatchObject({ requiresManualConfirmation: true });
    const omitted = await update(slug, row.id, { label: 'changed', directory });
    expect(omitted.statusCode).toBe(400);
    expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } })).configJson).toMatchObject({ token: broken });
    expect((await update(slug, row.id, { token: secret, label: 'changed', directory })).statusCode).toBe(200);
    expect((await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } })).configJson).not.toMatchObject({ token: broken });
  });

  it('F: contract, lifecycle and event failures redact secrets in records and logs', async () => {
    const secret = `secret-${randomUUID()}`;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { slug, row } = await install(secret, { failContract: true, failLifecycle: false, failEvent: true });
      await expect(callContract(slug, 'payment', 1, 'describe', { storeCurrency: 'USD' })).rejects.toThrow('***');
      const failed = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } });
      expect(failed.lastFailureMessage).toContain('***');
      expect(failed.lastFailureMessage).not.toContain(secret);
      const event = await emit();
      const engine = new EventDeliveryEngine(randomUUID());
      await engine.runOnce();
      await engine.drain();
      const delivery = await prisma.eventDelivery.findUniqueOrThrow({ where: { eventId_installationId: { eventId: event.id, installationId: row.id } } });
      expect(delivery.lastError).toContain('***');
      expect(delivery.lastError).not.toContain(secret);
      await install(`healthy-${randomUUID()}`);
      expect((await update(slug, row.id, { label: 'ordinary', directory, failContract: true, failLifecycle: true, failEvent: true })).statusCode).toBe(200);
      const response = await app.inject({
        method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${row.id}`,
        headers: { authorization: `Bearer ${admin.token}` }, payload: { enabled: false },
      });
      expect(response.statusCode).toBe(200);
      const disabled = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id: row.id } });
      expect(disabled.lifecycleWarning).toContain('***');
      expect(disabled.lifecycleWarning).not.toContain(secret);
      const rejected = await app.inject({
        method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${row.id}`,
        headers: { authorization: `Bearer ${admin.token}` }, payload: { enabled: true },
      });
      expect(rejected.statusCode).toBe(500);
      expect(rejected.json().error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(rejected.json().error.message).toContain('***');
      expect(rejected.payload).not.toContain(secret);
      expect(JSON.stringify(spy.mock.calls)).not.toContain(secret);
    } finally {
      spy.mockRestore();
    }
  });
});
