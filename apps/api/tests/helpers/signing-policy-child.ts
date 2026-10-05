import { env, envSchema } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { redisCache } from '../../src/core/cache/redis';
import { sharedProtection } from '../../src/infra/shared-protection';
import { PluginManagementService } from '../../src/core/admin/plugin-management/service';
import { callContract, warmPluginInstanceRuntime } from '../../src/core/admin/extension-installer/plugin-runtime';
import { resetPluginState } from '../../src/core/admin/extension-installer/plugin-state';
import { CheckoutService } from '../../src/core/checkout/service';
import { assertTestRootEnvironment } from 'shared/plugin-signing';
import { createTestApp } from './create-test-app';
import { executeLifecycleHook } from '../../src/core/admin/plugin-management/lifecycle-hooks';
import type { PluginManifest } from 'shared';

async function run() {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_SIGNING_POLICY_CHILD !== 'true' || !process.send) {
    throw new Error('Signing policy child requires the explicit test IPC guard');
  }
  const [action, slug, officialSlug, token] = process.argv.slice(2);
  assertTestRootEnvironment(env.EXTENSION_TEST_SIGNING_MODE);
  const app = await createTestApp();
  const instance = await prisma.pluginInstallation.findUniqueOrThrow({
    where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
  });
  const describe = (name: string) => callContract(name, 'payment', 1, 'describe', { storeCurrency: 'USD' });
  const capture = async (operation: () => Promise<unknown>) => {
    try { return { value: await operation() }; }
    catch (error) { return { code: (error as { code?: string }).code, statusCode: (error as { statusCode?: number }).statusCode, message: String(error) }; }
  };
  const gateway = () => app.inject({ url: `/api/v1/extensions/plugin/${slug}/api/health` });
  const headers = { authorization: `Bearer ${token}` };
  let result: Record<string, unknown>;
  try {
    if (action === 'cached') {
      const root = process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
      const before = await describe(slug);
      process.env.EXTENSION_TEST_SIGNING_MODE = 'false';
      delete process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
      Object.assign(env, envSchema.parse(process.env));
      assertTestRootEnvironment(env.EXTENSION_TEST_SIGNING_MODE);
      const blocked = await capture(() => describe(slug));
      const blockedGateway = await gateway();
      process.env.EXTENSION_TEST_SIGNING_MODE = 'true';
      process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY = root;
      Object.assign(env, envSchema.parse(process.env));
      assertTestRootEnvironment(env.EXTENSION_TEST_SIGNING_MODE);
      result = { before, blocked, gatewayStatus: blockedGateway.statusCode, gatewayError: blockedGateway.json().error.code, after: await describe(slug) };
    } else if (action === 'on') {
      result = { test: await describe(slug), official: await describe(officialSlug) };
    } else {
      const load = await capture(() => warmPluginInstanceRuntime(slug, instance.id));
      const invoke = await capture(() => describe(slug));
      const response = await gateway();
      const lifecycle = await capture(async () => executeLifecycleHook('onEnable', {
        installationId: instance.id, pluginSlug: slug, instanceKey: 'default', config: {},
      }, { lifecycle: { onEnable: true } } as PluginManifest));
      const detail = await app.inject({ url: `/api/v1/extensions/plugin/${slug}`, headers });
      const list = await app.inject({ url: '/api/v1/extensions/plugin', headers });
      const enable = await app.inject({
        method: 'PATCH', url: `/api/v1/extensions/plugin/${slug}/instances/${instance.id}`, headers,
        payload: { enabled: true },
      });
      const quote = await CheckoutService.quoteItems('USD', [], { shippingAddress: {
        firstName: 'Test', lastName: 'User', phone: '+1-555-0101', addressLine1: '123 Test St',
        city: 'Test City', state: 'CA', postalCode: '94016', country: 'US',
      } });
      await prisma.$transaction([
        prisma.pluginInstall.update({ where: { slug }, data: { deletedAt: new Date() } }),
        prisma.pluginInstallation.update({ where: { id: instance.id }, data: { deletedAt: new Date() } }),
      ]);
      try {
        const restore = await app.inject({ method: 'POST', url: `/api/v1/extensions/plugin/${slug}/restore`, headers });
        const preserved = await prisma.pluginInstall.findUniqueOrThrow({ where: { slug } });
        result = {
          load, invoke, lifecycle, gatewayStatus: response.statusCode, gatewayError: response.json().error.code,
          detailStatus: detail.statusCode, detailRoot: detail.json().data.signingRoot, listStatus: list.statusCode,
          enableStatus: enable.statusCode, enableError: enable.json().error.code,
          restoreStatus: restore.statusCode, restoreError: restore.json().error.code,
          keptDeleted: preserved.deletedAt !== null,
          official: await describe(officialSlug), builtin: await describe('manual-payment'), quote,
        };
      } finally {
        await prisma.$transaction([
          prisma.pluginInstall.update({ where: { slug }, data: { deletedAt: null } }),
          prisma.pluginInstallation.update({ where: { id: instance.id }, data: { deletedAt: null } }),
        ]);
      }
    }
    process.send({ result });
  } finally {
    await resetPluginState(slug);
    await resetPluginState(officialSlug);
    await resetPluginState('manual-payment');
    await resetPluginState('free-shipping');
    await app.close();
    await redisCache.disconnect();
    sharedProtection.close();
    await prisma.$disconnect();
  }
}

void run().catch((error) => {
  console.error(error);
  process.send?.({ error: String(error) });
  process.exitCode = 1;
}).finally(() => process.disconnect?.());
