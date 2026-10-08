import { createTestApp } from './create-test-app';
import { seedBuiltinCache } from './seed-builtin-cache';
import { resolveCurrentPluginPackage } from '../../src/core/storage/current-plugin-package';
import { drainPluginInstallOperations } from '../../src/core/admin/extension-installer/plugin-migration-operation';

async function main() {
  if (process.env.JIFFOO_TEST_ISOLATED_PLUGIN_ROOT === '1') {
    await seedBuiltinCache();
  }
  const app = await createTestApp({ disableFileSystem: false });
  const base = await app.listen({ port: 0, host: '127.0.0.1' });
  process.send?.({ kind: 'ready', base });
  process.on('message', async (message: unknown) => {
    if ((message as { kind?: string })?.kind === 'drain-operations') {
      await drainPluginInstallOperations();
      process.send?.({ kind: 'operations-drained' });
      return;
    }
    if ((message as { kind?: string })?.kind === 'resolve-packages') {
      const slugs = (message as { slugs: string[] }).slugs;
      const results = await Promise.allSettled(slugs.map((slug) => resolveCurrentPluginPackage(slug)));
      process.send?.({
        kind: 'resolved-packages',
        results: results.map((result) => result.status === 'fulfilled' ? 'ok' : String(result.reason)),
      });
      return;
    }
    if ((message as { kind?: string })?.kind !== 'stop') return;
    await app.close();
    process.exit(0);
  });
}

main().catch((error) => {
  process.send?.({ kind: 'error', message: error instanceof Error ? error.stack : String(error) });
  process.exitCode = 1;
});
