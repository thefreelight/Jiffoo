import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proveDatabaseQuiescence } from '../deploy/release/maintenance-proof.mjs';

const unknown = { pid: 42, application_name: 'external-client', usename: 'postgres', state: 'idle' };
const executor = { databaseRole: 'plugin_executor', applicationPrefix: 'jf:live-boot:' };
const noWait = async () => {};

test('maintenance requires a clean snapshot after a transient connection exits', async () => {
  let reads = 0, waits = 0;
  const proof = await proveDatabaseQuiescence(async () => ++reads === 1 ? [unknown] : [], undefined, async () => { waits++; });
  assert.deepEqual(proof, { checks: 2, observed: [unknown] });
  assert.equal(waits, 1);
});

test('persistent unknown connections remain blocking even when idle', async () => {
  let reads = 0, waits = 0;
  await assert.rejects(() => proveDatabaseQuiescence(async () => { reads++; return [unknown]; }, undefined, async () => { waits++; }), error => {
    assert.match(error.message, /maintenance is not proven/);
    assert.match(error.message, /"pid":42/);
    assert.match(error.message, /external-client/);
    return true;
  });
  assert.equal(reads, 21); assert.equal(waits, 20);
});

test('only the live executor role and complete application prefix are admitted', async () => {
  const own = { ...unknown, application_name: 'jf:live-boot:core', usename: 'plugin_executor' };
  assert.deepEqual(await proveDatabaseQuiescence(async () => [own], executor, noWait), { checks: 1, observed: [] });
  for (const foreign of [unknown, { ...own, usename: 'postgres' }, { ...own, application_name: 'jf:live-boot-lookalike:core' }]) {
    await assert.rejects(() => proveDatabaseQuiescence(async () => [own, foreign], executor, noWait), /maintenance is not proven/);
  }
});

test('session visibility errors propagate without claiming maintenance', async () => {
  const failure = new Error('Session visibility unavailable');
  await assert.rejects(() => proveDatabaseQuiescence(async () => { throw failure; }, undefined, noWait), error => error === failure);
});
