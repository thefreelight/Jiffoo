import { laneConfig, validateDatabaseUrl } from '../../src/config/test-lane';
import { afterAll, expect, it } from 'vitest';
import { once } from 'node:events';
import { createServer, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { sharedProtection } from '@/infra/shared-protection';
import { themeFixture, themeHttp, startThemeChild, zipTheme } from '../helpers/theme-package-fixture';
import { uploadPluginZip } from '../helpers/plugin-upload';
import { signJwt } from '../helpers/auth';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { recordB10ProcessTree, forceB10ProcessTree, confirmB10ProcessTreeExited } from '../helpers/b10-process-tree';
import { listenOnUsablePort } from '../helpers/mock-server-port';

afterAll(async () => {
  try { await redisCache.disconnect(); }
  finally { sharedProtection.close(); await prisma.$disconnect(); }
});

it.each([false, true])('real API SIGTERM drains an in-flight plugin request or keeps an exceeded deadline DRAINING: %s', async exceedsDeadline => {
  expect(validateDatabaseUrl(process.env.DATABASE_URL_TEST!).pathname).toBe('/' + laneConfig().databaseName);
  const slug = 'api-drain-' + randomUUID().slice(0, 12);
  let providerResponse: ServerResponse | undefined;
  let admitted!: () => void;
  const inFlight = new Promise<void>(resolve => { admitted = resolve; });
  const provider = createServer((_request, response) => { providerResponse = response; admitted(); });
  let fixture: Awaited<ReturnType<typeof themeFixture>> | undefined;
  let child: Awaited<ReturnType<typeof startThemeChild>> | undefined;
  let exited: Promise<[number | null, NodeJS.Signals | null]> | undefined;
  let response: ReturnType<typeof themeHttp> | undefined;
  let bootNonce: string | undefined;
  try {
    const providerPort = await listenOnUsablePort(provider);
    const providerUrl = `http://127.0.0.1:${providerPort}`;
    fixture = await themeFixture();
    const manifest = { schemaVersion: 1, slug, name: slug, version: '1.0.0', description: 'API drain fixture',
      category: 'integration', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
      entryModule: 'server/index.js', permissions: [], contracts: [], subscriptions: [] };
    const source = `module.exports = { register(ctx) {
      ctx.http.route({ method: 'GET', path: '/slow', handler: async () => {
        await (await fetch(${JSON.stringify(providerUrl)})).text();
        const result = await ctx.database.query('SELECT 1 AS value', []);
        return { settled: true, value: result.rows[0].value };
      } });
    } };`;
    const uploaded = await uploadPluginZip(fixture.primary.base!, signJwt(fixture.actor), await zipTheme(new Map([
      ['manifest.json', Buffer.from(JSON.stringify(manifest))], ['server/index.js', Buffer.from(source)],
    ])));
    expect(uploaded.status, await uploaded.clone().text()).toBe(200);
    const installation = await prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } } });
    expect((await fixture.mutate(fixture.primary, `/api/v1/extensions/plugin/${slug}/instances/${installation.id}`, 'PATCH', { enabled: true })).status).toBe(200);
    child = await startThemeChild(exceedsDeadline ? 'shutdown-api-short' : 'shutdown-api');
    fixture.children.push(child);
    bootNonce = child.messages.find(value => value.kind === 'ready').bootNonce;
    exited = once(child.child, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;
    response = themeHttp(child, `/api/v1/extensions/plugin/${slug}/api/slow`);
    void response.catch(() => undefined);
    let admissionTimer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        inFlight,
        response.then(value => { throw new Error(`Plugin request ended before admission: ${value.bytes.toString()}`); }),
        exited.then(() => { throw new Error(child!.output.join('')); }),
        new Promise<never>((_resolve, reject) => { admissionTimer = setTimeout(() => reject(new Error('Plugin request did not reach its provider')), 10_000); }),
      ]);
    } finally { clearTimeout(admissionTimer); }
    const tree = await recordB10ProcessTree(child.child.pid!);
    const started = performance.now();
    if (process.platform === 'win32') child.child.send({ kind: 'api-sigterm' });
    else child.child.kill('SIGTERM');
    const deadline = Date.now() + 3000;
    for (;;) {
      const state = await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce } });
      if (state.state === 'DRAINING') break;
      if (Date.now() > deadline) throw new Error('API did not enter DRAINING');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (exceedsDeadline) {
      expect((await exited)[0], child.output.join('')).toBe(1);
      expect(performance.now() - started).toBeLessThan(3000);
      expect(child.output.join('')).toContain('api-shutdown-deadline');
      expect(child.output.join('')).toContain('gateway-request');
      expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce } })).state).toBe('DRAINING');
      await expect(response).rejects.toThrow();
    } else {
      expect(child.child.exitCode).toBeNull();
      providerResponse!.end('settled');
      const completed = await response;
      expect(completed.status, completed.bytes.toString()).toBe(200);
      expect(completed.json()).toEqual({ settled: true, value: 1 });
      expect((await exited)[0], child.output.join('')).toBe(0);
      expect(performance.now() - started).toBeLessThan(10_000);
      expect((await prisma.coreProcess.findUniqueOrThrow({ where: { bootNonce } })).state).toBe('QUIESCENT');
    }
    await confirmB10ProcessTreeExited(tree);
  } finally {
    providerResponse?.end('cleanup');
    if (child && child.child.exitCode === null && child.child.signalCode === null) {
      const tree = await recordB10ProcessTree(child.child.pid!);
      if (process.platform === 'win32') child.child.send({ kind: 'api-sigterm' });
      else child.child.kill('SIGTERM');
      let timer: NodeJS.Timeout | undefined;
      try {
        const settled = await Promise.race([exited!.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 10_000); })]);
        if (!settled) await forceB10ProcessTree(child.child.pid!, tree.find(row => row.ProcessId === child!.child.pid)!.CreationDate);
        await exited;
        await confirmB10ProcessTreeExited(tree);
      } finally { clearTimeout(timer); }
    }
    await response?.catch(() => undefined);
    await new Promise<void>(resolve => provider.close(() => resolve()));
    try { await fixture?.close(); }
    finally {
      await cleanupPluginMigrationFixture(slug);
      await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
      await prisma.pluginOperationLease.deleteMany({ where: { slug } });
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      if (bootNonce) {
        // A deadline exit deliberately retains its invocation marker until death is proven.
        // The recorded child tree has exited, so the test may remove its own retained marker.
        await prisma.pluginOperationLease.deleteMany({ where: { ownerBootNonce: bootNonce } });
        await prisma.coreProcess.deleteMany({ where: { bootNonce } });
      }
    }
  }
}, 60_000);
