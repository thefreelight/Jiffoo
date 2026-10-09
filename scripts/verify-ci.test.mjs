import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localSteps, ciSteps, apiBuildStep } from './verify-steps.mjs';
import { mergeResults } from './verify-ci-summary.mjs';

function inActions(fn) {
  const previous = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = 'true';
  try { return fn(); } finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = previous;
  }
}

const needs = { api: { result: 'success' }, quality: { result: 'success' }, e2e: { result: 'success' } };
function reports() {
  return inActions(() => [
    ...[1, 2, 3, 4].map(index => ['api', index + '/4']),
    ['quality', undefined], ['e2e', undefined],
  ].map(([group, shard]) => {
    const plan = ciSteps('postgresql://postgres@localhost/jiffoo_core_test', group, shard);
    return {
      group, shard, valid: true,
      results: plan.map(([name]) => [name, 'PASS', '1.00s']),
      fullApiFiles: group === 'api' ? ['tests/a.test.ts', 'tests/b.test.ts', 'tests/c.test.ts', 'tests/d.test.ts'] : [],
      apiFiles: group === 'api' ? ['tests/' + 'abcd'[Number(shard[0]) - 1] + '.test.ts'] : [],
      outputs: plan.filter(([name]) => name.startsWith('Run ')).map(([name]) => ({
        name, kind: name === 'Run browser E2E' ? 'e2e' : 'vitest',
        output: name === 'Run browser E2E'
          ? 'Playwright start time: 2026-10-08T00:00:00.000Z\nPlaywright results: 1 passed, 0 failed, 0 skipped\n'
          : '   Start at  00:00:00\n Test Files  1 passed (1)\n      Tests  1 passed (1)\n',
      })),
    };
  }));
}

test('CI selection is rejected outside GitHub Actions and rejects malformed shards', () => {
  const previous = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try { assert.throws(() => ciSteps('test', 'api', '1/4'), /GitHub|GITHUB/); } finally {
    if (previous !== undefined) process.env.GITHUB_ACTIONS = previous;
  }
  inActions(() => {
    for (const shard of ['0/4', '5/4', '1/3', undefined]) assert.throws(() => ciSteps('test', 'api', shard));
    assert.throws(() => ciSteps('test', 'quality', '1/4'));
    assert.throws(() => ciSteps('test', 'unknown'));
  });
});

test('CI union contains all full steps and every job retains database guards', () => inActions(() => {
  const plans = ['api', 'quality', 'e2e'].map(group => ciSteps('test', group, group === 'api' ? '1/4' : undefined));
  const union = new Set(plans.flatMap(plan => plan.map(([name]) => name)));
  assert.deepEqual([...union].sort(), [...localSteps('test').map(([name]) => name), apiBuildStep[0]].sort());
  for (const plan of plans) for (const name of ['Install dependencies', 'Validate and generate Prisma client', 'Build plugin SDK', 'Reset test database', 'Check Prisma migration drift']) assert.ok(plan.some(([step]) => step === name));
}));

test('every API shard exports its own OpenAPI spec in full catalogue order before tests', () => inActions(() => {
  const expected = ['Install dependencies', 'Validate and generate Prisma client', 'Build shared package', 'Build plugin SDK', 'Export OpenAPI', 'Reset test database', 'Check Prisma migration drift', 'Run API tests'];
  const full = localSteps('test').map(([name]) => name);
  for (const shard of ['1/4', '2/4', '3/4', '4/4']) {
    const plan = ciSteps('test', 'api', shard);
    assert.deepEqual(plan.map(([name]) => name), expected);
    assert.deepEqual(plan.find(([name]) => name === 'Export OpenAPI')[1], localSteps('test').find(([name]) => name === 'Export OpenAPI')[1]);
    assert.deepEqual(expected, full.filter(name => expected.includes(name)));
  }
}));

test('summary requires OpenAPI export in each API shard even when quality exported it', () => inActions(() => {
  const complete = mergeResults(reports(), needs);
  assert.equal(complete.valid, true);
  assert.match(complete.block, /\| Export OpenAPI \| PASS \| 5\.00s \|/);
  for (let index = 0; index < 4; index++) {
    const rows = reports();
    rows[index].results = rows[index].results.filter(([name]) => name !== 'Export OpenAPI');
    const result = mergeResults(rows, needs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('Incomplete job step catalogue: api'));
  }
}));

test('complete successful reports reconcile exactly once and retain all suite summaries', () => inActions(() => {
  const result = mergeResults(reports(), needs);
  assert.equal(result.valid, true);
  assert.match(result.block, /API shard file coverage \(4\/4\) \| PASS/);
  assert.equal((result.block.match(/Start at/g) ?? []).length, 7);
  assert.match(result.block, /Test Files  4 passed \(4\)/);
  assert.match(result.block, /Playwright results: 1 passed, 0 failed, 0 skipped/);
}));

test('cancelled, skipped, failed and missing jobs never pass', () => inActions(() => {
  for (const result of ['cancelled', 'skipped', 'failure']) assert.equal(mergeResults(reports(), { ...needs, api: { result } }).valid, false);
  assert.equal(mergeResults(reports().slice(1), needs).valid, false);
}));

test('missing, duplicate and inconsistent API inventories never pass', () => inActions(() => {
  for (const mutate of [
    rows => { rows[0].apiFiles = []; },
    rows => { rows[0].apiFiles = rows[1].apiFiles; },
    rows => { rows[0].fullApiFiles = []; },
    rows => { rows.push(rows[0]); },
  ]) {
    const rows = reports(); mutate(rows);
    assert.equal(mergeResults(rows, needs).valid, false);
  }
}));

test('a successful job cannot omit a catalogue step or its test summaries', () => inActions(() => {
  const rows = reports();
  rows[0].results.shift();
  assert.equal(mergeResults(rows, needs).valid, false);
  const missingOutput = reports();
  missingOutput[0].outputs = [];
  assert.equal(mergeResults(missingOutput, needs).valid, false);
}));
