import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { recordPluginFailure } from '@/core/admin/extension-installer/plugin-failure';
import { handlePluginProcessFailure } from '@/core/admin/extension-installer/plugin-process-failure';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { EventDeliveryEngine } from '@/infra/events/delivery';
import { emitEvent } from '@/infra/events/emit';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { extensionInstallerSchemas } from '@/core/admin/extension-installer/schemas';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin } from '../helpers/fixture-plugin';
import { snapshotPluginRows, assertPluginRowsUnchanged } from '../helpers/plugin-db-snapshot';
import { clearTestPluginCache } from '../helpers/plugin-cache';

let app: FastifyInstance, token: string, actorId: string, base: string;
let before: Awaited<ReturnType<typeof snapshotPluginRows>>;
const slugs = new Set<string>(), events = new Set<string>();
const secret = 'recorded-error-fixture-secret';
const schema = { type: 'object', properties: { credential: { type: 'string', sensitive: true } }, required: ['credential'] };
beforeAll(async () => { app = await createTestApp({ disableRedis: false, disableFileSystem: false }); const admin = await createAdminWithToken(); token = admin.token; actorId = admin.user.id; base = await app.listen({ port: 0, host: '127.0.0.1' }); });
beforeEach(async () => { before = await snapshotPluginRows(); });
afterEach(async () => {
  await prisma.eventDelivery.deleteMany({ where: { eventId: { in: [...events] } } }); await prisma.eventRecord.deleteMany({ where: { id: { in: [...events] } } }); events.clear();
  for (const slug of slugs) { await prisma.pluginInstall.deleteMany({ where: { slug } }); await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } }); await clearTestPluginCache(slug); }
  slugs.clear(); await assertPluginRowsUnchanged(before);
});
afterAll(async () => { await app.close(); await deleteAllTestUsers(); });
async function fixture(source = "module.exports={register(ctx){ctx.http.route({method:'GET',path:'/ok',handler:async()=>({ok:true})});}};", options: { lifecycle?: Record<string, boolean>; subscriptions?: Array<{ type: 'order.created'; version: 1 }>; contracts?: Array<{ name: 'payment'; version: 1 }>; enable?: boolean } = {}) {
  const slug = `recorded-${randomUUID().slice(0, 12)}`; slugs.add(slug);
  await installFixturePlugin({ app, adminToken: token, adminUserId: actorId }, slug, options.contracts ? 'payment' : 'integration', options.contracts ?? [], source, { configSchema: schema, config: { credential: secret }, enable: false, ...options });
  const instance = await prisma.pluginInstallation.findFirstOrThrow({ where: { pluginSlug: slug } }); return { slug, instance };
}
const patch = (slug: string, id: string, enabled: boolean) => app.inject({ method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${id}`, headers: { authorization: `Bearer ${token}` }, payload: { enabled } });
async function stored(id: string) { const row = await prisma.pluginInstallation.findUniqueOrThrow({ where: { id } }); expect(row.lastFailureAt).not.toBeNull(); expect(row.lastFailureMessage).toContain('***'); expect(row.lastFailureMessage).not.toContain(secret); return row; }
describe('Last recorded plugin errors', () => {
  it('B a real runtime exception is sanitized and the five second throttle keeps the first recorded error', async () => {
    const { slug, instance } = await fixture("module.exports={register(ctx){ctx.contracts.implement('payment',1,{describe:()=>({displayName:'Failure fixture',requiresManualConfirmation:false,unpaidTimeoutMinutes:30,supportedCurrencies:['USD']}),createSession:()=>({sessionId:'fixture',action:{type:'none'}}),getSessionStatus:()=>{throw new Error('failed '+ctx.config.credential+' twice '+ctx.config.credential+'\\n at handler (/private/file:1:1)');}});}};", { contracts: [{ name: 'payment', version: 1 }], enable: true });
    await expect(callContract(slug, 'payment', 1, 'getSessionStatus', { sessionId: 'fixture' })).rejects.toThrow();
    const first = await stored(instance.id); expect(first.lastFailureMessage).not.toContain('/private/file');
    await recordPluginFailure(slug, new Error('second error'), 'load', instance.id); expect(await prisma.pluginInstallation.findUnique({ where: { id: instance.id } })).toEqual(first);
  });
  it('B a process-attributed exception stores only sanitized error text', async () => {
    const { slug, instance } = await fixture(); const pkg = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } }); const files = await pluginPackageStore.get(slug, pkg.zipHash!);
    const error = new Error(`process failed ${secret}`); error.stack = `Error: failure\n at handler (${files!.getEntryPath('server/index.js')}:1:1)`;
    await handlePluginProcessFailure(error, 'uncaughtException'); await stored(instance.id);
  });
  it('B a real onEnable lifecycle failure is sanitized, recorded and leaves enablement unchanged', async () => {
    const { slug, instance } = await fixture("module.exports={register(){},__lifecycle_onEnable(ctx){throw new Error('hook failed '+ctx.config.credential);}};", { lifecycle: { onEnable: true } });
    const response = await patch(slug, instance.id, true); expect(response.statusCode).toBe(500); expect((await stored(instance.id)).enabled).toBe(false);
  });
  it('B a non-blocking lifecycle failure records its sanitized warning and last error together', async () => {
    const { slug, instance } = await fixture("module.exports={register(){},__lifecycle_onDisable(ctx){throw new Error('hook failed '+ctx.config.credential);}};", { lifecycle: { onDisable: true }, enable: true });
    expect((await patch(slug, instance.id, false)).statusCode).toBe(200); const row = await stored(instance.id); expect(row.lifecycleWarning).toContain('***'); expect(row.lifecycleWarning).not.toContain(secret);
  });
  it('B candidate registration failures use the same sanitizer before recording', async () => {
    const { slug, instance } = await fixture("module.exports={register(ctx){throw new Error('candidate failed '+ctx.config.credential);}};");
    expect((await patch(slug, instance.id, true)).statusCode).toBe(500); await stored(instance.id);
  });
  it('B terminal event failure atomically records sanitized text on the eighth attempt', async () => {
    const { slug, instance } = await fixture("module.exports={register(ctx){ctx.events.subscribe('order.created',1,()=>{throw new Error('event failed '+ctx.config.credential);});}};", { subscriptions: [{ type: 'order.created', version: 1 }], enable: true });
    const event = await prisma.$transaction(tx => emitEvent(tx, 'order.created', 1, randomUUID(), { id: 'snapshot-order', userId: 'snapshot-user', totalAmount: 10, currency: 'USD', items: [] })); events.add(event.id);
    const delivery = await prisma.eventDelivery.findUniqueOrThrow({ where: { eventId_installationId: { eventId: event.id, installationId: instance.id } } });
    await prisma.eventDelivery.update({ where: { id: delivery.id }, data: { attempts: 7 } }); const engine = new EventDeliveryEngine(`recorded-${slug}`);
    try { await engine.runOnce(); await engine.drain(); } finally { await engine.stop(); }
    const finished = await prisma.eventDelivery.findUniqueOrThrow({ where: { id: delivery.id } }); const row = await stored(instance.id);
    expect(finished.status).toBe('FAILED'); expect(finished.attempts).toBe(8); expect(row.lastFailureAt).toEqual(finished.finishedAt); expect(row.lastFailureMessage).toBe(finished.lastError);
  });
  it('C package list and detail expose both safe fields of the default instance with declared schemas', async () => {
    const { slug, instance } = await fixture(); await recordPluginFailure(slug, new Error(`failure ${secret}`), 'load', instance.id); const row = await stored(instance.id);
    for (const path of ['/api/v1/extensions/plugin?limit=100', `/api/v1/extensions/plugin/${slug}`]) {
      const response = await fetch(base + path, { headers: { authorization: `Bearer ${token}` } }); expect(response.status).toBe(200); const data = (await response.json()).data;
      const plugin = Array.isArray(data.items) ? data.items.find((item: { slug: string }) => item.slug === slug) : data;
      expect(plugin.lastFailureMessage).toBe(row.lastFailureMessage); expect(plugin.lastFailureAt).toBe(row.lastFailureAt!.toISOString());
    }
    expect(extensionInstallerSchemas.getPlugin.response[200].properties.data.properties).toHaveProperty('lastFailureMessage');
    expect(extensionInstallerSchemas.getPlugin.response[200].properties.data.properties).toHaveProperty('lastFailureAt');
  });
  it('D successful enable, invocation and restore retain the recorded error while purge removes its instance', async () => {
    const { slug, instance } = await fixture(); await recordPluginFailure(slug, new Error(`historical ${secret}`), 'load', instance.id); const first = await stored(instance.id);
    expect((await patch(slug, instance.id, true)).statusCode).toBe(200);
    expect((await fetch(`${base}/api/v1/extensions/plugin/${slug}/api/ok`)).status).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/extensions/plugin/${slug}`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/v1/extensions/plugin/${slug}/restore`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    const restored = await stored(instance.id); expect(restored.lastFailureAt).toEqual(first.lastFailureAt); expect(restored.lastFailureMessage).toBe(first.lastFailureMessage);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/extensions/plugin/${slug}`, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/extensions/plugin/${slug}/purge`, headers: { authorization: `Bearer ${token}` }, payload: { confirmationSlug: slug } })).statusCode).toBe(200);
    expect(await prisma.pluginInstallation.findUnique({ where: { id: instance.id } })).toBeNull();
    expect(JSON.stringify(await prisma.adminAuditEvent.findMany({ where: { targetId: slug } }))).not.toContain(first.lastFailureMessage!);
  });
});
