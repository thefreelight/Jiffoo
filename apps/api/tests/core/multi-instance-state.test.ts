import { afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { signJwt } from '../helpers/auth';
import { themeFixture, themeHttp, zipTheme, waitThemeMessage, type ThemeChild } from '../helpers/theme-package-fixture';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { sharedProtection } from '@/infra/shared-protection';

afterAll(async () => {
  try { await redisCache.disconnect(); }
  finally { sharedProtection.close(); await prisma.$disconnect(); }
});

type Fixture = Awaited<ReturnType<typeof themeFixture>>;
async function installPlugin(fixture: Fixture, source: string) {
  const slug = 'b14-' + randomUUID().slice(0, 12);
  const manifest = { schemaVersion: 1, slug, name: slug, version: '1.0.0', description: 'Cross-instance state fixture',
    category: 'shipping', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js',
    permissions: [], contracts: [{ name: 'shipping', version: 1 }], subscriptions: [] };
  const bytes = await zipTheme(new Map([['manifest.json', Buffer.from(JSON.stringify(manifest))], ['server/index.js', Buffer.from(source)]]));
  const result = await uploadPluginZip(fixture.primary.base!, signJwt(fixture.actor), bytes);
  expect(result.status, await result.clone().text()).toBe(200);
  const row = await fixture.prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
  const enabled = await fixture.mutate(fixture.primary, `/api/v1/extensions/plugin/${slug}/instances/${row.id}`, 'PATCH', { enabled: true });
  expect(enabled.status, enabled.bytes.toString()).toBe(200);
  return { slug, id: row.id };
}

async function contract(child: ThemeChild, slug: string) {
  const id = randomUUID();
  const response = waitThemeMessage(child, message => message.kind === 'result' && message.id === id);
  child.child.send({ kind: 'contract-call', id, slug });
  return response;
}

async function cleanupPlugins(fixture: Fixture, plugins: Array<{ slug: string; id: string }>) {
  const redis = new Redis(process.env.REDIS_URL!);
  try {
    for (const plugin of plugins) {
      await cleanupPluginMigrationFixture(plugin.slug);
      await fixture.prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: [plugin.slug, plugin.id] } } });
      await fixture.prisma.pluginOperationLease.deleteMany({ where: { slug: plugin.slug } });
      await fixture.prisma.pluginInstallation.deleteMany({ where: { pluginSlug: plugin.slug } });
      await fixture.prisma.pluginInstall.deleteMany({ where: { slug: plugin.slug } });
      const keys = await redis.keys(`jiffoo:protection:plugin:{${plugin.id}:*`);
      if (keys.length) await redis.del(...keys);
    }
  } finally { redis.disconnect(); }
}

const healthySource = `module.exports = { register(ctx) {
  ctx.http.route({ method: 'GET', path: '/probe', handler: () => ({ serving: true }) });
  ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Standard', amountMinor: 0 }] }) });
} };`;

it('Scenario 17: two real API processes immediately observe disable, re-enable and a different active Shop theme', async () => {
  let fixture: Fixture | undefined;
  const plugins: Array<{ slug: string; id: string }> = [];
  try {
    expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
    fixture = await themeFixture();
    const second = await fixture.start();
    expect(fixture.primary.child.pid).not.toBe(second.child.pid);
    expect(fixture.primary.root).not.toBe(second.root);
    const companion = await installPlugin(fixture, healthySource); plugins.push(companion);
    const plugin = await installPlugin(fixture, healthySource); plugins.push(plugin);
    const gateway = () => themeHttp(second, `/api/v1/extensions/plugin/${plugin.slug}/api/probe`);
    const initial = await gateway();
    expect(initial.json()).toMatchObject({ serving: true });
    expect(initial.headers.connection).toBe('close');
    expect((await contract(second, plugin.slug)).value.options).toHaveLength(1);
    const toggle = (enabled: boolean) => fixture!.mutate(fixture!.primary, `/api/v1/extensions/plugin/${plugin.slug}/instances/${plugin.id}`, 'PATCH', { enabled });
    expect((await toggle(false)).status).toBe(200);
    const disabled = await gateway();
    expect(disabled.status, disabled.bytes.toString()).toBe(503); expect(disabled.json().error.code).toBe('PLUGIN_DISABLED');
    expect((await contract(second, plugin.slug)).error.code).toBe('PLUGIN_DISABLED');
    expect((await toggle(true)).status).toBe(200);
    expect((await gateway()).json()).toMatchObject({ serving: true });
    expect((await contract(second, plugin.slug)).value.options).toHaveLength(1);
    const firstTheme = await fixture.install(), nextTheme = await fixture.install();
    const activate = (slug: string) => fixture!.mutate(fixture!.primary, '/api/v1/extensions/themes/shop/activate', 'POST', { slug });
    expect((await activate(firstTheme.slug)).status).toBe(200);
    expect((await themeHttp(second, '/api/v1/store/theme?target=shop&locale=en')).json().data.slug).toBe(firstTheme.slug);
    expect((await activate(nextTheme.slug)).status).toBe(200);
    expect((await themeHttp(second, '/api/v1/store/theme?target=shop&locale=en')).json().data).toMatchObject({ slug: nextTheme.slug, packageHash: nextTheme.record.packageHash });
    expect(second.child.exitCode).toBeNull();
  } finally {
    if (fixture) { try { await fixture.close(); } finally { await cleanupPlugins(fixture, plugins); } }
  }
}, 60000);

it.each(['unhandledRejection', 'uncaughtException'] as const)('Scenario 16: a real plugin %s keeps Core serving and another plugin capability working', async kind => {
  let fixture: Fixture | undefined;
  const plugins: Array<{ slug: string; id: string }> = [];
  try {
    fixture = await themeFixture();
    const second = await fixture.start();
    const healthy = await installPlugin(fixture, healthySource); plugins.push(healthy);
    const source = `module.exports = { register(ctx) {
      ctx.http.route({ method: 'GET', path: '/fail', handler: () => {
        setImmediate(() => { ${kind === 'unhandledRejection' ? "Promise.reject(new Error('b14 unhandled rejection'));" : "throw new Error('b14 uncaught exception');"} });
        return { scheduled: true };
      } });
      ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Standard', amountMinor: 0 }] }) });
    } };`;
    const failing = await installPlugin(fixture, source); plugins.push(failing);
    expect((await contract(second, healthy.slug)).value.options).toHaveLength(1);
    expect((await themeHttp(second, `/api/v1/extensions/plugin/${failing.slug}/api/fail`)).status).toBe(200);
    const expected = kind === 'unhandledRejection' ? 'b14 unhandled rejection' : 'b14 uncaught exception';
    const deadline = Date.now() + 5000;
    for (;;) {
      const recorded = await fixture.prisma.pluginInstallation.findUniqueOrThrow({ where: { id: failing.id } });
      if (recorded.lastFailureMessage === expected) { expect(recorded.enabled).toBe(true); expect(recorded.lastFailureAt).not.toBeNull(); break; }
      if (Date.now() >= deadline) throw new Error(`Plugin failure was not attributed: ${second.output.join('')}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const processFailure = second.output.join('').split('\n').filter(line => line.startsWith('{')).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).find(entry => entry?.event === 'plugin_process_failure' && entry.context === kind);
    expect(processFailure).toMatchObject({ slug: failing.slug, context: kind });
    const live = await themeHttp(second, '/health/live');
    expect(live.status, live.bytes.toString()).toBe(200);
    expect((await contract(second, healthy.slug)).value.options).toHaveLength(1);
    expect((await themeHttp(second, `/api/v1/extensions/plugin/${healthy.slug}/api/probe`)).status).toBe(200);
    expect((await fixture.prisma.pluginInstallation.findUniqueOrThrow({ where: { id: healthy.id } })).lastFailureAt).toBeNull();
    expect(second.child.exitCode).toBeNull();
  } finally {
    if (fixture) { try { await fixture.close(); } finally { await cleanupPlugins(fixture, plugins); } }
  }
}, 60000);
