import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { laneConfig, registry, validateDatabaseUrl, validateRedisUrl, assertCurrentDatabase, assertIntegrationE2e } from './lane-config.mjs';

const url = name => `postgresql://postgres:postgres@localhost:5432/${name}`;
test('integration and registered lanes use exact database and Redis assignments', () => {
  assert.deepEqual(registry, { plugins: 13, orders: 12, storefront: 11 });
  assert.equal(laneConfig('').databaseName, 'jiffoo_core_test');
  validateDatabaseUrl(url('jiffoo_core_test'), laneConfig(''));
  validateDatabaseUrl(url('jiffoo_core_test_plugins'), laneConfig('plugins'));
  for (const id of ['other', 'Plugins', 'plugins-x', 'a'.repeat(17), '../plugins', 'constructor']) assert.throws(() => laneConfig(id));
  for (const name of ['jiffoo_core', '', 'jiffoo_core_test', 'jiffoo_core_test_other', 'jiffoo_core_test_plugins%2f', '%2fjiffoo_core_test_plugins', 'jiffoo_core_test_plugins%00']) {
    assert.throws(() => validateDatabaseUrl(url(name), laneConfig('plugins')));
  }
  assert.throws(() => validateDatabaseUrl(url('jiffoo_core_test_plugins'), laneConfig('')));
  for (const value of ['mysql://localhost/jiffoo_core_test', 'postgresql://remote/jiffoo_core_test', url('jiffoo_core_test') + '?dbname=jiffoo_core', url('jiffoo_core_test') + '?options=unsafe']) assert.throws(() => validateDatabaseUrl(value, laneConfig('')));
  validateDatabaseUrl('postgresql://[::1]/jiffoo_core_test', laneConfig(''));
  const timezone = new URL(url('jiffoo_core_test'));
  timezone.searchParams.set('options', '-c timezone=Asia/Shanghai');
  validateDatabaseUrl(timezone.href, laneConfig(''));
  for (const options of ['-c dbname=jiffoo_core', '-c timezone=UTC -c dbname=jiffoo_core', '-c timezone=UTC\n', '-c host=remote']) {
    timezone.searchParams.set('options', options);
    assert.throws(() => validateDatabaseUrl(timezone.href, laneConfig('')));
  }
  for (const path of ['other/../jiffoo_core_test', '%2e/jiffoo_core_test', '%2e%2e/jiffoo_core_test']) assert.throws(() => validateDatabaseUrl(url(path), laneConfig('')));
  assertCurrentDatabase('jiffoo_core_test_plugins', laneConfig('plugins'));
  assert.throws(() => assertCurrentDatabase('jiffoo_core_test', laneConfig('plugins')));
});
test('Redis is local, exact and cannot route lanes to E2E DB 14', () => {
  validateRedisUrl('redis://127.0.0.1/15', laneConfig(''));
  validateRedisUrl('redis://localhost/13', laneConfig('plugins'));
  validateRedisUrl('redis://localhost/14', laneConfig(''), true);
  for (const value of ['redis://remote/13', 'http://localhost/13', 'redis://localhost/14', 'redis://localhost/013', 'redis://localhost/13?db=14']) assert.throws(() => validateRedisUrl(value, laneConfig('plugins')));
  assert.throws(() => validateRedisUrl('redis://localhost/14', laneConfig('plugins'), true), /Lane E2E runs in CI/);
  assert.throws(() => assertIntegrationE2e(laneConfig('plugins')), /Lane E2E runs in CI/);
});
test('both E2E entrypoints guard lanes before any side effects', () => {
  for (const file of ['verify-e2e.mjs', 'dump-e2e-notifications.mjs']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const guard = source.indexOf('assertIntegrationE2e();');
    assert.ok(guard > 0);
    assert.ok(guard < source.indexOf(file.startsWith('verify') ? 'mkdirSync(resultsDir' : 'new PrismaClient'));
  }
});
test('API TypeScript bridge and ESM use the same specification', () => {
  const path = new URL('../apps/api/src/config/test-lane.ts', import.meta.url);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: createRequire(path) };
  vm.runInNewContext(source, context);
  assert.deepEqual(context.exports.laneConfig('plugins'), laneConfig('plugins'));
  for (const id of ['', 'plugins']) {
    const config = laneConfig(id);
    assert.equal(context.exports.validateDatabaseUrl(url(config.databaseName), config).href, validateDatabaseUrl(url(config.databaseName), config).href);
    for (const name of ['jiffoo_core', 'jiffoo_core_test_other', '']) {
      assert.throws(() => context.exports.validateDatabaseUrl(url(name), config));
      assert.throws(() => validateDatabaseUrl(url(name), config));
    }
    assert.equal(context.exports.validateRedisUrl(`redis://localhost/${config.apiRedisDb}`, config).href, validateRedisUrl(`redis://localhost/${config.apiRedisDb}`, config).href);
  }
  assert.throws(() => context.exports.laneConfig('other'));
});
test('loading the API bridge in a production image does not load absent test tooling', () => {
  const path = new URL('../apps/api/src/config/test-lane.ts', import.meta.url);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports: {}, require: () => assert.fail('Production module load must not import scripts/') });
});
