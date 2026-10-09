import { coreProcessState } from '../../src/infra/core-process';
import { createPluginDatabase, pluginDatabaseResources, withPluginDatabaseInvocation, withPluginDatabaseHandler } from '../../src/core/admin/extension-installer/plugin-database';
import { withPluginMigrationGate } from '../../src/core/admin/extension-installer/plugin-migration-gate';
import { redisCache } from '../../src/core/cache/redis';

async function main() {
  const role = process.argv[2];
  const runtime = role === 'api'
    ? await (await import('../../src/server')).startApiRuntime({ port: 0, host: '127.0.0.1' })
    : await (await import('../../src/worker-runtime')).startWorkerRuntime({ healthPort: 0 });
  const slug = process.argv[3];
  const database = createPluginDatabase(slug, slug);
  await withPluginMigrationGate(slug, () => withPluginDatabaseInvocation(slug, slug,
    () => withPluginDatabaseHandler(slug, slug, () => database.query('SELECT 1 AS value', []))));
  const state = () => ({ process: coreProcessState(), database: pluginDatabaseResources(), redis: redisCache.getRawClient().status,
    redisConnected: redisCache.getConnectionStatus(), redisStreamDestroyed: redisCache.getRawClient().stream?.destroyed ?? true,
    worker: 'state' in runtime ? runtime.state() : null });
  if (process.argv[4] === 'outage') redisCache.getRawClient().once('close', () => process.send?.({ kind: 'redis-closed' }));
  process.send?.({ kind: 'started', state: state() });
  process.once('message', () => {
    void (async () => {
      if ('app' in runtime) await runtime.app.close();
      else await runtime.stop();
      process.send?.({ kind: 'stopped', state: state() }, () => process.disconnect());
    })().catch(error => { console.error(error); process.exitCode = 1; process.disconnect(); });
  });
}
void main().catch(error => { console.error(error); process.exitCode = 1; process.disconnect(); });
