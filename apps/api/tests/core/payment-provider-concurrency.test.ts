import { afterAll, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { prisma } from '@/config/database';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { closePluginDatabase } from '@/core/admin/extension-installer/plugin-database';
import { finishCoreProcess } from '@/infra/core-process';
import { sharedProtection } from '@/infra/shared-protection';
import { redisCache } from '@/core/cache/redis';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteTestUser } from '../helpers/auth';
import { checkoutPaymentFixtureSource, installFixturePlugin } from '../helpers/fixture-plugin';
import { cleanupPluginMigrationFixture } from '../helpers/plugin-migration-cleanup';
import { snapshotPluginRows, restoreBuiltinRows } from '../helpers/plugin-db-snapshot';
import { clearTestPluginCache } from '../helpers/plugin-cache';

afterAll(async () => {
  await closePluginDatabase();
  await finishCoreProcess();
  sharedProtection.close();
  await redisCache.disconnect();
  await prisma.$disconnect();
});

it.each([['disable', 'disable'], ['uninstall', 'uninstall'], ['disable', 'uninstall']] as const)(
  'two administrators concurrently %s and %s different payment providers and retain exactly one', async (first, second) => {
    expect(process.env.DATABASE_URL_TEST).toBe('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
    const snapshot = await snapshotPluginRows(['manual-payment']);
    const app = await createTestApp();
    const administrators: Awaited<ReturnType<typeof createAdminWithToken>>[] = [];
    const slugs = [0, 1].map(() => 'payment-race-' + randomUUID().slice(0, 10));
    const control = new Client({ connectionString: process.env.DATABASE_URL_TEST });
    let locked = false;
    let requests: Array<ReturnType<typeof app.inject>> = [];
    try {
      await control.connect();
      expect((await control.query('SELECT current_database() AS name')).rows[0].name).toBe('jiffoo_core_test');
      await syncBuiltinPlugins(path.resolve('builtin-plugins'));
      for (const slug of slugs) {
        const admin = await createAdminWithToken(); administrators.push(admin);
        await installFixturePlugin({ app, adminToken: admin.token, adminUserId: admin.user.id }, slug, 'payment', [{ name: 'payment', version: 2 }], checkoutPaymentFixtureSource);
      }
      await prisma.pluginInstallation.updateMany({ where: { pluginSlug: 'manual-payment' }, data: { enabled: false } });
      const instances = await Promise.all(slugs.map(pluginSlug => prisma.pluginInstallation.findUniqueOrThrow({ where: { pluginSlug_instanceKey: { pluginSlug, instanceKey: 'default' } } })));
      await control.query("SELECT pg_advisory_lock(hashtextextended('jiffoo:payment-provider-decision', 0))");
      locked = true;
      requests = [first, second].map((operation, index) => app.inject({
        method: operation === 'disable' ? 'PATCH' : 'DELETE',
        url: `/api/v1/extensions/plugin/${slugs[index]}${operation === 'disable' ? `/instances/${instances[index].id}` : ''}`,
        headers: administrators[index].authHeader,
        ...(operation === 'disable' ? { payload: { enabled: false } } : {}),
      }));
      const deadline = Date.now() + 2500;
      for (;;) {
        const waiting = await control.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE '%pg_advisory_xact_lock%' AND query LIKE '%jiffoo:payment-provider-decision%'");
        if (waiting.rows[0].count === 2) break;
        if (Date.now() > deadline) throw new Error('Both real PostgreSQL transactions did not wait for the shared provider decision lock');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(await prisma.pluginInstallation.count({ where: { pluginSlug: { in: slugs }, enabled: true, deletedAt: null } })).toBe(2);
      await control.query("SELECT pg_advisory_unlock(hashtextextended('jiffoo:payment-provider-decision', 0))");
      locked = false;
      const responses = await Promise.all(requests);
      expect(responses.map(response => response.statusCode).sort(), responses.map(response => response.body).join('\n')).toEqual([200, 409]);
      expect(responses.find(response => response.statusCode === 409)!.json().error.code).toBe('LAST_PROVIDER_REQUIRED');
      expect(await prisma.pluginInstallation.count({ where: { pluginSlug: { in: slugs }, enabled: true, deletedAt: null, plugin: { deletedAt: null } } })).toBe(1);
    } finally {
      try {
        if (locked) await control.query("SELECT pg_advisory_unlock(hashtextextended('jiffoo:payment-provider-decision', 0))");
        await Promise.allSettled(requests);
      } finally {
        await control.end();
        for (const slug of slugs) {
          await cleanupPluginMigrationFixture(slug);
          await prisma.adminAuditEvent.deleteMany({ where: { targetId: slug } });
          await prisma.pluginOperationLease.deleteMany({ where: { slug } });
          await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
          await prisma.pluginInstall.deleteMany({ where: { slug } });
          await clearTestPluginCache(slug);
        }
        await restoreBuiltinRows(snapshot, ['manual-payment']);
        await app.close();
        for (const admin of administrators) await deleteTestUser(admin.user.id);
      }
    }
  }, 60_000,
);
