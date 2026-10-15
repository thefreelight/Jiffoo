import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionPlan, provisionLane } from './lane-provision.mjs';

const env = { LANE_ID: 'plugins', DATABASE_URL_TEST: 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test_plugins' };
test('provisioning is dry by default and never creates a client', async () => {
  const output = [];
  await provisionLane(provisionPlan(env), () => assert.fail('Dry run must never connect'), line => output.push(line));
  assert.deepEqual(output, [
    'DRY RUN: connect to local PostgreSQL maintenance database postgres; create jiffoo_core_test_plugins only if absent.',
    'DRY RUN: CREATE DATABASE "jiffoo_core_test_plugins"',
  ]);
});
test('only CREATE DATABASE for the registered exact name is allowed, once when absent', async () => {
  for (const exists of [false, true]) {
    const calls = [];
    await provisionLane(provisionPlan(env, ['--apply']), value => {
      assert.equal(new URL(value).pathname, '/postgres');
      return { async connect() {}, async end() {}, async query(sql, values) { calls.push([sql, values]); return { rows: exists ? [{}] : [] }; } };
    });
    assert.deepEqual(calls[0], ['SELECT 1 FROM pg_database WHERE datname = $1', ['jiffoo_core_test_plugins']]);
    assert.equal(calls.length, exists ? 1 : 2);
    if (!exists) assert.equal(calls[1][0], 'CREATE DATABASE "jiffoo_core_test_plugins"');
  }
  for (const sql of ['DROP DATABASE jiffoo_core', 'CREATE DATABASE "other"', 'CREATE DATABASE "jiffoo_core_test_plugins"; DROP DATABASE jiffoo_core']) {
    await assert.rejects(provisionLane({ ...provisionPlan(env), sql }, () => assert.fail('Invalid plan must not connect')), /CREATE DATABASE/);
  }
  for (const LANE_ID of ['', 'other', 'plugins;drop']) assert.throws(() => provisionPlan({ ...env, LANE_ID }));
  for (const DATABASE_URL_TEST of ['postgresql://remote/jiffoo_core_test_plugins', 'postgresql://localhost/jiffoo_core', 'postgresql://localhost/jiffoo_core_test_orders']) assert.throws(() => provisionPlan({ ...env, DATABASE_URL_TEST }));
  assert.throws(() => provisionPlan(env, ['--drop']), /CREATE DATABASE/);
});
