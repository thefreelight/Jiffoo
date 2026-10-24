// Unit coverage for the local lane shard gate. These tests are database-free and container-free:
// only the pure planning, rejection, coverage and aggregation helpers of
// scripts/verify-lane-shards.mjs run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { laneConfig } from './lane-config.mjs';
import {
  aggregateShardResults,
  assertContainersAvailable,
  assertCurrentDatabaseMatches,
  assertPlanPortOwnership,
  assertShardPortOwnership,
  assertShardUrlsPassLaneGuards,
  buildCleanupReport,
  buildReplaySummary,
  buildShardPlan,
  catalogueSnapshotEnvironment,
  collectDurationsFromResults,
  computeCoverage,
  decideTimeoutHandoff,
  deliveryStatus,
  descendantProcessIds,
  describeRunScope,
  durationWeights,
  formatCountSummary,
  formatMeasuredWallClock,
  formatStartTime,
  hostServicePorts,
  identifyUploadStorageContainer,
  indexProcessTree,
  integrationContainerPrefix,
  normalizeDurationTable,
  parseContainerTable,
  parseDatabaseNames,
  parseDurationEntries,
  parsePublishedPorts,
  parseShardArgs,
  parseVitestListFiles,
  parseVitestShardReport,
  parseVolumeNames,
  partitionCatalogue,
  partitionFiles,
  partitionFilesByDuration,
  replaySummaryTitle,
  resolveShardTarget,
  shardBalance,
  shardBalanceTolerance,
  shardContainerNames,
  shardDatabaseUrl,
  shardEnvironment,
  shardRedisUrl,
  shellCommandLine,
  sumShardReports,
  summarizeVitestLog,
  survivingProcesses,
  toApiRelativePath,
  truncateLine,
  uploadStorageCleanupRows,
  uploadStorageContainerName,
  uploadStorageResourceStatus,
  writeDurationTable,
} from './verify-lane-shards.mjs';

const apiFile = name => resolve('apps/api/tests', name);

test('arguments accept one shard count or one shard index and reject anything else', () => {
  assert.deepEqual(parseShardArgs([]), { shards: 4, shard: undefined, keep: false, replay: false, recordDurations: false });
  assert.deepEqual(parseShardArgs(['--shards=4']), { shards: 4, shard: undefined, keep: false, replay: false, recordDurations: false });
  assert.deepEqual(parseShardArgs(['--shards=1', '--keep']), { shards: 1, shard: undefined, keep: true, replay: false, recordDurations: false });
  assert.deepEqual(parseShardArgs(['--shard=2']), { shards: 4, shard: 2, keep: false, replay: false, recordDurations: false });
  assert.deepEqual(parseShardArgs(['--replay']), { shards: 4, shard: undefined, keep: false, replay: true, recordDurations: false });
  assert.deepEqual(parseShardArgs(['--record-durations']), { shards: 4, shard: undefined, keep: false, replay: false, recordDurations: true });
  assert.throws(() => parseShardArgs(['--shards=4', '--shard=2']), /cannot be combined/);
  assert.throws(() => parseShardArgs(['--shards=0']), /between 1 and 8/);
  assert.throws(() => parseShardArgs(['--shards=9']), /between 1 and 8/);
  assert.throws(() => parseShardArgs(['--shard=0']), /between 1 and 4/);
  assert.throws(() => parseShardArgs(['--replay', '--shards=2']), /--replay cannot be combined/);
  assert.throws(() => parseShardArgs(['--replay', '--keep']), /--replay cannot be combined/);
  assert.throws(() => parseShardArgs(['--replay', '--record-durations']), /--replay cannot be combined/);
  assert.throws(() => parseShardArgs(['--record-durations', '--shards=2']), /--record-durations cannot be combined/);
  assert.throws(() => parseShardArgs(['--unknown']), /Unknown argument/);
});

test('the published port of a dynamically mapped container is read back from the docker output', () => {
  assert.deepEqual(parsePublishedPorts('127.0.0.1:18151'), [18151]);
  assert.deepEqual(parsePublishedPorts('0.0.0.0:15834\n'), [15834]);
  assert.deepEqual(parsePublishedPorts('127.0.0.1:18151\n127.0.0.1:18152\n'), [18151, 18152]);
  assert.deepEqual(parsePublishedPorts(''), []);
  assert.deepEqual(parsePublishedPorts('no port'), []);
});

test('a shard port is never a host service port and always matches its own container', () => {
  const plan = buildShardPlan(resolveShardTarget(laneConfig('orders')), 2);
  const shard = {
    ...plan[0],
    databasePort: 18151,
    redisPort: 18152,
    databaseContainerId: 'abc123def456',
    redisContainerId: 'def456abc123',
    databaseUrl: shardDatabaseUrl(18151, plan[0].databaseName),
    redisUrl: shardRedisUrl(18152, plan[0].redisDb),
  };
  assert.doesNotThrow(() => assertShardPortOwnership(shard));
  for (const hostPort of hostServicePorts) {
    assert.throws(() => assertShardPortOwnership({ ...shard, databasePort: hostPort }), /host service port/);
    assert.throws(() => assertShardPortOwnership({ ...shard, redisPort: hostPort }), /host service port/);
  }
  assert.throws(() => assertShardPortOwnership({ ...shard, databaseContainerId: undefined }), /container IDs are missing/);
  assert.throws(() => assertShardPortOwnership({ ...shard, databaseUrl: shardDatabaseUrl(18152, plan[0].databaseName) }), /must point at its own port/);
  assert.throws(() => assertShardPortOwnership({ ...shard, redisUrl: shardRedisUrl(18153, plan[0].redisDb) }), /must point at its own port/);
  assert.doesNotThrow(() => assertPlanPortOwnership([shard]));
});

test('every shard keeps the lane database name and Redis DB while its containers carry the run id', () => {
  const config = laneConfig('orders');
  const plan = buildShardPlan(resolveShardTarget(config), 4, undefined, 'run123');
  assert.equal(plan.length, 4);
  const databaseUrls = new Set();
  for (const shard of plan) {
    assert.equal(shard.databaseName, 'jiffoo_core_test_orders');
    assert.equal(shard.redisDb, 12);
    assert.equal(shard.databaseContainer, `jiffoo-orders-shard${shard.index}-run123-db`);
    assert.equal(shard.redisContainer, `jiffoo-orders-shard${shard.index}-run123-redis`);
    databaseUrls.add(shard.databaseContainer);
  }
  assert.equal(databaseUrls.size, 4);
  assert.deepEqual(shardContainerNames('orders', 1, 'run123'), {
    database: 'jiffoo-orders-shard1-run123-db',
    redis: 'jiffoo-orders-shard1-run123-redis',
  });
});

test('integration mode without LANE_ID keeps the integration database and Redis DB', () => {
  const config = laneConfig('');
  const target = resolveShardTarget(config);
  assert.equal(target.mode, 'integration');
  assert.equal(target.laneId, '');
  assert.equal(target.containerPrefix, integrationContainerPrefix);
  assert.equal(target.databaseName, 'jiffoo_core_test');
  assert.equal(target.redisDb, 15);
  const plan = buildShardPlan(target, 2, undefined, 'run123');
  assert.equal(plan.length, 2);
  assert.equal(plan[0].databaseContainer, 'jiffoo-integration-shard1-run123-db');
  assert.equal(plan[1].redisContainer, 'jiffoo-integration-shard2-run123-redis');
});

test('the shard environment never uses the ambient database or Redis URL', () => {
  const plan = buildShardPlan(resolveShardTarget(laneConfig('')), 1);
  const shard = {
    ...plan[0],
    databasePort: 18151,
    redisPort: 18152,
    databaseUrl: shardDatabaseUrl(18151, plan[0].databaseName),
    redisUrl: shardRedisUrl(18152, plan[0].redisDb),
  };
  const environment = shardEnvironment({
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/jiffoo_core_test',
    DATABASE_URL_TEST: 'postgresql://postgres:postgres@127.0.0.1:5498/jiffoo_core_test',
    REDIS_URL: 'redis://127.0.0.1:6379/15',
    LANE_ID: 'orders',
  }, shard);
  assert.equal(environment.DATABASE_URL, shard.databaseUrl);
  assert.equal(environment.DATABASE_URL_TEST, shard.databaseUrl);
  assert.equal(environment.REDIS_URL, shard.redisUrl);
  assert.equal(environment.LANE_ID, undefined);
  const lanePlan = buildShardPlan(resolveShardTarget(laneConfig('orders')), 1);
  assert.equal(shardEnvironment({}, lanePlan[0]).LANE_ID, 'orders');
});

test('shard URLs pass the existing lane guards unchanged', () => {
  const config = laneConfig('orders');
  const target = resolveShardTarget(config);
  const plan = buildShardPlan(target, 4).map(shard => ({
    ...shard,
    databasePort: 18151 + shard.index,
    redisPort: 18251 + shard.index,
    databaseUrl: shardDatabaseUrl(18151 + shard.index, shard.databaseName),
    redisUrl: shardRedisUrl(18251 + shard.index, shard.redisDb),
  }));
  assert.doesNotThrow(() => assertShardUrlsPassLaneGuards(plan, config));
  const wrongName = plan.map(shard => ({ ...shard, databaseUrl: shardDatabaseUrl(shard.databasePort, 'jiffoo_core_test') }));
  assert.throws(() => assertShardUrlsPassLaneGuards(wrongName, config), /must be exactly/);
  const wrongRedis = plan.map(shard => ({ ...shard, redisUrl: shardRedisUrl(shard.redisPort, 15) }));
  assert.throws(() => assertShardUrlsPassLaneGuards(wrongRedis, config), /logical DB 12/);
});

test('the gate refuses to touch a container name that already exists', () => {
  const plan = buildShardPlan(resolveShardTarget(laneConfig('orders')), 4, undefined, 'run123');
  assert.doesNotThrow(() => assertContainersAvailable(plan, []));
  assert.doesNotThrow(() => assertContainersAvailable(plan, ['jiffoo-core-api-test-db', 'jiffoo-core-api-test-redis']));
  assert.throws(() => assertContainersAvailable(plan, ['jiffoo-orders-shard2-run123-db']), /already exists/);
  assert.throws(() => assertContainersAvailable(plan, ['jiffoo-orders-shard3-run123-redis']), /already exists/);
});

test('the catalogue is partitioned into disjoint, complete and balanced shard file lists', () => {
  const files = Array.from({ length: 10 }, (_, offset) => `apps/api/tests/core/file-${offset}.test.ts`);
  const shards = partitionFiles(files, 3);
  assert.equal(shards.length, 3);
  const flattened = shards.flat();
  assert.equal(flattened.length, files.length);
  assert.equal(new Set(flattened).size, files.length);
  for (const file of files) assert.ok(flattened.includes(file));
  assert.equal(shards[0].length, 4);
  assert.equal(shards[1].length, 3);
  assert.equal(shards[2].length, 3);
  assert.deepEqual(partitionFiles(files, 1), [files.slice().sort()]);
});

test('the expected file set is read from the vitest list output and normalized to the repository', () => {
  const files = parseVitestListFiles([{ file: apiFile('core/one.test.ts') }, { file: apiFile('routes/two.test.ts') }]);
  assert.deepEqual(files, ['apps/api/tests/core/one.test.ts', 'apps/api/tests/routes/two.test.ts']);
  assert.deepEqual(parseVitestListFiles('[]'), []);
  assert.throws(() => parseVitestListFiles({}), /not an array/);
});

test('a vitest file filter is relative to the API directory', () => {
  assert.equal(toApiRelativePath('apps/api/tests/core/one.test.ts'), 'tests/core/one.test.ts');
  assert.equal(toApiRelativePath('tests/core/one.test.ts'), 'tests/core/one.test.ts');
});

test('coverage passes when every expected file runs exactly once', () => {
  const expected = ['a.test.ts', 'b.test.ts', 'c.test.ts', 'd.test.ts'];
  const coverage = computeCoverage(expected, [
    { shard: 1, files: ['a.test.ts', 'b.test.ts'] },
    { shard: 2, files: ['c.test.ts', 'd.test.ts'] },
  ]);
  assert.equal(coverage.passed, true);
  assert.equal(coverage.expectedCount, 4);
  assert.equal(coverage.unionSize, 4);
  assert.deepEqual(coverage.missing, []);
  assert.deepEqual(coverage.extra, []);
  assert.deepEqual(coverage.duplicates, []);
  assert.deepEqual(coverage.emptyShards, []);
});

test('coverage fails on a missing file', () => {
  const coverage = computeCoverage(['a.test.ts', 'b.test.ts'], [{ shard: 1, files: ['a.test.ts'] }]);
  assert.equal(coverage.passed, false);
  assert.deepEqual(coverage.missing, ['b.test.ts']);
  assert.equal(coverage.unionSize, 1);
});

test('coverage fails on a file that is not part of the frozen snapshot', () => {
  const coverage = computeCoverage(['a.test.ts'], [{ shard: 1, files: ['a.test.ts', 'stale.test.ts'] }]);
  assert.equal(coverage.passed, false);
  assert.deepEqual(coverage.extra, ['stale.test.ts']);
  assert.deepEqual(coverage.missing, []);
});

test('coverage fails when the same file runs in two shards', () => {
  const coverage = computeCoverage(['a.test.ts', 'b.test.ts'], [
    { shard: 1, files: ['a.test.ts', 'b.test.ts'] },
    { shard: 2, files: ['a.test.ts'] },
  ]);
  assert.equal(coverage.passed, false);
  assert.deepEqual(coverage.duplicates, [{ file: 'a.test.ts', shards: [1, 2] }]);
});

test('coverage fails on an empty shard', () => {
  const coverage = computeCoverage(['a.test.ts'], [
    { shard: 1, files: ['a.test.ts'] },
    { shard: 2, files: [] },
  ]);
  assert.equal(coverage.passed, false);
  assert.deepEqual(coverage.emptyShards, [2]);
  assert.deepEqual(coverage.shardCounts, [{ shard: 1, count: 1, reported: true }, { shard: 2, count: 0, reported: true }]);
});

test('a shard without a json report is reported as not reported and fails the coverage', () => {
  const coverage = computeCoverage(['a.test.ts'], [{ shard: 1, files: [], reported: false }]);
  assert.equal(coverage.passed, false);
  assert.deepEqual(coverage.missing, ['a.test.ts']);
  assert.deepEqual(coverage.emptyShards, [1]);
  assert.equal(coverage.shardCounts[0].reported, false);
});

test('a timed-out shard keeps its containers while a process is still alive', () => {
  const handoff = decideTimeoutHandoff({ timedOut: true, lingeringProcesses: [{ pid: 4242, name: 'node.exe' }] });
  assert.equal(handoff.retained, true);
  assert.equal(handoff.removeContainers, false);
  assert.match(handoff.reason, /still alive/);
});

test('a timed-out shard whose processes exited may be cleaned up', () => {
  const handoff = decideTimeoutHandoff({ timedOut: true, lingeringProcesses: [] });
  assert.equal(handoff.retained, false);
  assert.equal(handoff.removeContainers, true);
  assert.match(handoff.reason, /timed out/);
});

test('a normally finished shard is cleaned up', () => {
  const handoff = decideTimeoutHandoff({ timedOut: false, aborted: false, lingeringProcesses: [] });
  assert.equal(handoff.retained, false);
  assert.equal(handoff.removeContainers, true);
});

test('the cleanup report separates removed, retained, failed and skipped containers', () => {
  const report = buildCleanupReport([
    { id: 'aaa', name: 'db-1', role: 'database', shard: 1, status: 'removed', detail: 'removed by container ID' },
    { id: 'bbb', name: 'redis-1', role: 'redis', shard: 1, status: 'failed', detail: 'device or resource busy' },
    { id: 'ccc', name: 'db-2', role: 'database', shard: 2, status: 'retained', detail: 'shard process still alive' },
    { id: 'ddd', name: 'redis-2', role: 'redis', shard: 2, status: 'skipped', detail: 'kept on request' },
  ], { ownership: 'lane orders', handling: 'docker rm -f <id>' });
  assert.equal(report.passed, false);
  assert.deepEqual(report.removed.map(row => row.id), ['aaa']);
  assert.deepEqual(report.failures.map(row => row.id), ['bbb']);
  assert.deepEqual(report.retained.map(row => row.id), ['ccc']);
  assert.deepEqual(report.skipped.map(row => row.id), ['ddd']);
  assert.equal(report.ownership, 'lane orders');
  assert.match(report.table, /\| aaa \| db-1 \| database \| 1 \| removed \|/);
});

test('the cleanup report passes when every container of this run was removed', () => {
  const report = buildCleanupReport([
    { id: 'aaa', name: 'db-1', role: 'database', shard: 1, status: 'removed' },
    { id: 'bbb', name: 'redis-1', role: 'redis', shard: 1, status: 'removed' },
  ]);
  assert.equal(report.passed, true);
  assert.deepEqual(report.failures, []);
  assert.deepEqual(report.retained, []);
});

test('the delivery status carries the test verdict and the cleanup verdict separately', () => {
  assert.equal(deliveryStatus('PASS', 'PASS'), 'API PASS / cleanup PASS');
  assert.equal(deliveryStatus('PASS', 'FAIL'), 'API PASS / cleanup FAIL');
  assert.equal(deliveryStatus('FAIL', 'PASS'), 'API FAIL / cleanup PASS');
  assert.equal(deliveryStatus('FAIL', 'FAIL'), 'API FAIL / cleanup FAIL');
});

test('the process tree helper finds the descendants of a shard process', () => {
  const entries = [
    { pid: 100, ppid: 1, name: 'node.exe', commandLine: 'pnpm vitest run' },
    { pid: 101, ppid: 100, name: 'node.exe', commandLine: 'vitest' },
    { pid: 102, ppid: 101, name: 'node.exe', commandLine: 'tinypool' },
    { pid: 200, ppid: 1, name: 'other.exe', commandLine: 'unrelated' },
  ];
  assert.deepEqual(descendantProcessIds(entries, 100), [101, 102]);
  assert.deepEqual(descendantProcessIds(entries, 200), []);
  assert.equal(indexProcessTree(entries).get(101).ppid, 100);
  assert.deepEqual(survivingProcesses(entries, [102, 200]), [
    { pid: 102, ppid: 101, name: 'node.exe', commandLine: 'tinypool' },
    { pid: 200, ppid: 1, name: 'other.exe', commandLine: 'unrelated' },
  ]);
});

test('a shell command line quotes arguments that contain a space', () => {
  assert.equal(shellCommandLine('pnpm', ['--filter', 'api', 'exec']), 'pnpm --filter api exec');
  assert.equal(shellCommandLine('pnpm', ['--json=C:/Personal Develop/repo/tmp/list.json']), 'pnpm "--json=C:/Personal Develop/repo/tmp/list.json"');
});

test('vitest summaries are extracted from a shard log', () => {
  const log = [
    ' RUN  v4.0.15 /repo/apps/api',
    '',
    ' ✓ tests/core/one.test.ts (3 tests) 120ms',
    '',
    ' Test Files  41 passed (41)',
    '      Tests  570 passed (570)',
    '   Start at  12:00:00',
  ].join('\n');
  assert.deepEqual(summarizeVitestLog(log), {
    startAt: '12:00:00',
    testFiles: '41 passed (41)',
    tests: '570 passed (570)',
    failedFiles: [],
  });
  assert.deepEqual(summarizeVitestLog(''), { startAt: 'n/a', testFiles: 'n/a', tests: 'n/a', failedFiles: [] });
});

test('the ANSI coloured vitest output is parsed into the shard summary', () => {
  const log = [
    '\u001B[41m\u001B[1m FAIL \u001B[22m\u001B[49m tests/core/module-boundary-audit.test.ts\u001B[2m > \u001B[22mmodule boundary audit',
    '\u001B[2m Test Files \u001B[22m \u001B[1m\u001B[31m1 failed\u001B[39m\u001B[22m | \u001B[1m\u001B[32m81 passed\u001B[39m\u001B[22m\u001B[90m (82)\u001B[39m',
    '\u001B[2m      Tests \u001B[22m \u001B[1m\u001B[31m4 failed\u001B[39m\u001B[22m | \u001B[1m\u001B[32m560 passed\u001B[39m\u001B[22m (564)',
    '\u001B[2m   Start at \u001B[22m 19:24:31',
  ].join('\n');
  const summary = summarizeVitestLog(log);
  assert.deepEqual(summary.failedFiles, ['tests/core/module-boundary-audit.test.ts']);
  assert.equal(summary.testFiles, '1 failed | 81 passed (82)');
  assert.equal(summary.tests, '4 failed | 560 passed (564)');
  assert.equal(summary.startAt, '19:24:31');
});

test('the shard report of the vitest json reporter carries the file, test and failure numbers', () => {
  const report = parseVitestShardReport({
    numTotalTestSuites: 249,
    numPassedTestSuites: 247,
    numFailedTestSuites: 2,
    numPendingTestSuites: 0,
    numTotalTests: 1290,
    numPassedTests: 1284,
    numFailedTests: 4,
    numPendingTests: 2,
    startTime: 1792755323767,
    testResults: [
      { name: apiFile('core/one.test.ts'), status: 'passed' },
      { name: apiFile('core/two.test.ts'), status: 'failed' },
    ],
  });
  assert.deepEqual(report.executedFiles, ['apps/api/tests/core/one.test.ts', 'apps/api/tests/core/two.test.ts']);
  assert.deepEqual(report.failedFiles, ['apps/api/tests/core/two.test.ts']);
  assert.deepEqual(report.testFiles, { total: 2, passed: 1, failed: 1 });
  assert.deepEqual(report.tests, { total: 1290, passed: 1284, failed: 4, pending: 2 });
  assert.deepEqual(report.suites, { total: 249, passed: 247, failed: 2, pending: 0 });
  assert.equal(formatCountSummary(report.testFiles, 'files'), '2 files, 1 passed, 1 failed');
  assert.equal(formatCountSummary(report.tests, 'tests'), '1290 tests, 1284 passed, 4 failed, 2 pending');
  assert.equal(report.startTime, 1792755323767);
});

test('an empty vitest json report is reported as an empty shard report', () => {
  const report = parseVitestShardReport({ testResults: [] });
  assert.deepEqual(report.executedFiles, []);
  assert.deepEqual(report.failedFiles, []);
  assert.deepEqual(report.testFiles, { total: 0, passed: 0, failed: 0 });
  assert.equal(formatCountSummary(report.testFiles, 'files'), '0 files');
});

test('the shard table shows the file, test and failure numbers of the json reporter', () => {
  const report = parseVitestShardReport({
    numTotalTests: 1290,
    numPassedTests: 1284,
    numFailedTests: 4,
    numPendingTests: 2,
    startTime: 1792755323767,
    testResults: [
      { name: apiFile('core/one.test.ts'), status: 'passed' },
      { name: apiFile('core/two.test.ts'), status: 'failed' },
    ],
  });
  const aggregate = aggregateShardResults([{ shard: 1, exitCode: 1, duration: '1080.2s', report, summary: summarizeVitestLog('') }]);
  assert.equal(aggregate.passed, false);
  assert.match(aggregate.table, /\| 1 \| 1 \| 1080\.2s \| \d\d:\d\d:\d\d \| 2 files, 1 passed, 1 failed \| 1290 tests, 1284 passed, 4 failed, 2 pending \| tests\/core\/two\.test\.ts \|/);
});

test('the totals of a sharded run are summed over the shard reports', () => {
  const totals = sumShardReports([
    { testFiles: { total: 2, passed: 1, failed: 1 }, tests: { total: 10, passed: 8, failed: 2, pending: 0 }, suites: { total: 5, passed: 4, failed: 1, pending: 0 } },
    { testFiles: { total: 3, passed: 3, failed: 0 }, tests: { total: 20, passed: 20, failed: 0, pending: 0 }, suites: { total: 7, passed: 7, failed: 0, pending: 0 } },
  ]);
  assert.deepEqual(totals.testFiles, { total: 5, passed: 4, failed: 1 });
  assert.deepEqual(totals.tests, { total: 30, passed: 28, failed: 2, pending: 0 });
  assert.equal(formatCountSummary(totals.testFiles, 'files'), '5 files, 4 passed, 1 failed');
});

test('the start time of a shard is rendered as a wall clock time', () => {
  assert.match(formatStartTime(1792755323767), /^\d\d:\d\d:\d\d$/);
  assert.equal(formatStartTime(null), 'n/a');
  assert.equal(formatStartTime(0), 'n/a');
});

test('a failing shard names the test files that failed', () => {
  const log = [
    ' FAIL  tests/core/module-boundary-audit.test.ts > module boundary audit > rejects every cross-domain table write',
    ' Test Files  2 failed | 39 passed (41)',
    '      Tests  5 failed | 413 passed (418)',
  ].join('\n');
  const summary = summarizeVitestLog(log);
  assert.deepEqual(summary.failedFiles, ['tests/core/module-boundary-audit.test.ts']);
  const report = parseVitestShardReport({
    numTotalTests: 418,
    numPassedTests: 413,
    numFailedTests: 5,
    numPendingTests: 0,
    testResults: [{ name: apiFile('core/module-boundary-audit.test.ts'), status: 'failed' }],
  });
  const aggregate = aggregateShardResults([{ shard: 1, exitCode: 1, duration: '570.1s', report, summary }]);
  assert.equal(aggregate.passed, false);
  assert.match(aggregate.table, /tests\/core\/module-boundary-audit\.test\.ts/);
});

test('a shard without a per-shard results json never claims that it had no failing file', () => {
  const aggregate = aggregateShardResults([{ shard: 1, exitCode: 1, duration: '12.0s', summary: summarizeVitestLog('') }]);
  assert.equal(aggregate.passed, false);
  assert.match(aggregate.table, /no per-shard results JSON/);
  assert.match(aggregate.table, /not reported \(no per-shard results JSON\)/);
  assert.doesNotMatch(aggregate.table, /\| none \|/);
});

test('a shard that exited zero without a per-shard results json still fails the aggregation', () => {
  const aggregate = aggregateShardResults([{ shard: 1, exitCode: 0, duration: '12.0s', summary: summarizeVitestLog('') }]);
  assert.equal(aggregate.passed, false);
  assert.match(aggregate.table, /no per-shard results JSON/);
});

test('aggregation builds one table row per shard and fails when any shard fails', () => {
  const reportOne = parseVitestShardReport({
    numTotalTests: 570,
    numPassedTests: 570,
    numFailedTests: 0,
    startTime: 1792755323767,
    testResults: [{ name: apiFile('core/one.test.ts'), status: 'passed' }],
  });
  const reportTwo = parseVitestShardReport({
    numTotalTests: 569,
    numPassedTests: 569,
    numFailedTests: 0,
    startTime: 1792755323767,
    testResults: [{ name: apiFile('core/two.test.ts'), status: 'passed' }],
  });
  const results = [
    { shard: 1, exitCode: 0, duration: '300.0s', report: reportOne, summary: summarizeVitestLog('') },
    { shard: 2, exitCode: 0, duration: '320.0s', report: reportTwo, summary: summarizeVitestLog('') },
  ];
  const passed = aggregateShardResults(results);
  assert.equal(passed.passed, true);
  assert.equal(passed.rows.length, 2);
  assert.match(passed.table, /\| 1 \| 0 \| 300\.0s \| \d\d:\d\d:\d\d \| 1 files, 1 passed \| 570 tests, 570 passed \| none \|/);
  assert.match(passed.table, /\| 2 \| 0 \| 320\.0s \| \d\d:\d\d:\d\d \| 1 files, 1 passed \| 569 tests, 569 passed \| none \|/);

  const failedReport = parseVitestShardReport({
    numTotalTests: 561,
    numPassedTests: 560,
    numFailedTests: 1,
    startTime: 1792755323767,
    testResults: [{ name: apiFile('core/three.test.ts'), status: 'failed' }],
  });
  const failed = aggregateShardResults([
    ...results,
    { shard: 3, exitCode: 1, duration: '90.0s', report: failedReport, summary: summarizeVitestLog('') },
  ]);
  assert.equal(failed.passed, false);
  assert.match(failed.table, /\| 3 \| 1 \| 90\.0s \| \d\d:\d\d:\d\d \| 1 files, 1 failed \| 561 tests, 560 passed, 1 failed \| tests\/core\/three\.test\.ts \|/);
  assert.equal(aggregateShardResults([]).passed, false);
});

test('printed lines stay within the terminal width limit', () => {
  assert.equal(truncateLine('short line'), 'short line');
  const long = 'x'.repeat(200);
  assert.equal(truncateLine(long).length, 120);
  assert.equal(truncateLine(long).endsWith('…'), true);
});

test('a single shard run is PARTIAL and states how much of the catalogue it covered', () => {
  const scope = describeRunScope({ shard: 2, shards: 4, expectedCount: 164, coveredCount: 41 });
  assert.equal(scope.partial, true);
  assert.match(scope.note, /only 41\/164 files covered/);
  assert.equal(deliveryStatus('FAIL', 'PASS', scope), 'API PARTIAL (single shard 2/4: only 41/164 files covered) / cleanup PASS');
  assert.doesNotMatch(deliveryStatus('FAIL', 'PASS', scope), /PASS \/ cleanup/);
  const full = describeRunScope({ shard: undefined, shards: 4, expectedCount: 164, coveredCount: 164 });
  assert.equal(full.partial, false);
  assert.equal(deliveryStatus('PASS', 'PASS', full), 'API PASS / cleanup PASS');
});

test('a single shard run leaves the uncovered catalogue files missing and therefore fails', () => {
  const catalogue = Array.from({ length: 164 }, (_, offset) => `apps/api/tests/core/file-${offset}.test.ts`);
  const coverage = computeCoverage(catalogue, [{ shard: 2, files: catalogue.slice(0, 41) }]);
  assert.equal(coverage.passed, false);
  assert.equal(coverage.expectedCount, 164);
  assert.equal(coverage.unionSize, 41);
  assert.equal(coverage.missing.length, 123);
  assert.deepEqual(coverage.emptyShards, []);
});

test('the catalogue snapshot is collected with the environment of the shards', () => {
  const plan = buildShardPlan(resolveShardTarget(laneConfig('')), 2);
  const shard = {
    ...plan[0],
    databasePort: 18151,
    redisPort: 18152,
    databaseUrl: shardDatabaseUrl(18151, plan[0].databaseName),
    redisUrl: shardRedisUrl(18152, plan[0].redisDb),
  };
  const base = { NODE_ENV: 'test', CI: 'true', DATABASE_URL_TEST: 'postgresql://postgres:postgres@127.0.0.1:5498/jiffoo_core_test' };
  const environment = catalogueSnapshotEnvironment(base, shard);
  assert.equal(environment.NODE_ENV, 'test');
  assert.equal(environment.CI, 'true');
  assert.equal(environment.DATABASE_URL_TEST, shard.databaseUrl);
  assert.equal(environment.DATABASE_URL, shard.databaseUrl);
  assert.equal(environment.REDIS_URL, shard.redisUrl);
  assert.equal(environment.LANE_ID, undefined);
  assert.deepEqual(environment, shardEnvironment(base, shard));
});

test('the upload storage of a shard is part of the cleanup inventory', () => {
  assert.equal(uploadStorageResourceStatus('removed', false), 'removed');
  assert.equal(uploadStorageResourceStatus('removed', true), 'failed');
  assert.equal(uploadStorageResourceStatus('failed', false), 'failed');
  assert.equal(uploadStorageResourceStatus('retained', true), 'retained');
  assert.equal(uploadStorageResourceStatus('skipped', true), 'skipped');
  const report = buildCleanupReport([
    { id: 'aaa', name: 'db-1', role: 'database', shard: 1, status: 'removed' },
    { id: 'jiffoo-upload-1', name: 'jiffoo-upload-1', role: 'upload-storage', shard: 1, status: 'removed' },
    { id: 'jiffoo-upload-1-data', name: 'jiffoo-upload-1-data', role: 'upload-storage-volume', shard: 1, status: 'failed' },
  ]);
  assert.equal(report.passed, false);
  assert.deepEqual(report.failures.map(row => row.id), ['jiffoo-upload-1-data']);
  assert.deepEqual(report.failures.map(row => row.shard), [1]);
  assert.match(report.table, /jiffoo-upload-1-data \| jiffoo-upload-1-data \| upload-storage-volume \| 1 \| failed/);
});

test('the upload storage container and its volume are read back from the docker output', () => {
  assert.deepEqual(parseContainerTable('abc123def456\tjiffoo-upload-1\n'), [{ id: 'abc123def456', name: 'jiffoo-upload-1' }]);
  assert.deepEqual(parseContainerTable(''), []);
  assert.deepEqual(parseVolumeNames('[{"Type":"volume","Name":"jiffoo-upload-1-data"}]'), ['jiffoo-upload-1-data']);
  assert.deepEqual(parseVolumeNames('[{"Type":"bind","Source":"/tmp/data"}]'), []);
  assert.deepEqual(parseVolumeNames('[]'), []);
});

test('the current database is measured inside the shard container and must match the plan', () => {
  assert.equal(assertCurrentDatabaseMatches('jiffoo_core_test', 'jiffoo_core_test'), 'jiffoo_core_test');
  assert.throws(() => assertCurrentDatabaseMatches('jiffoo_core_test_orders', 'jiffoo_core_test'), /refusing the destructive reset/);
  assert.throws(() => assertCurrentDatabaseMatches('', 'jiffoo_core_test'), /could not be measured/);
  assert.throws(() => assertCurrentDatabaseMatches(undefined, 'jiffoo_core_test'), /could not be measured/);
  assert.deepEqual(parseDatabaseNames('jiffoo_core_test\npostgres\n'), ['jiffoo_core_test', 'postgres']);
  assert.deepEqual(parseDatabaseNames(''), []);
});

test('the wall clock of a run is the measured span of that run', () => {
  const wallClock = formatMeasuredWallClock(1000, 9300, '2026-10-23T21:11:07.000Z', '2026-10-23T21:11:16.300Z');
  assert.match(wallClock, /^8\.3s \(measured by this run: 2026-10-23T21:11:07\.000Z -> 2026-10-23T21:11:16\.300Z\)$/);
  assert.throws(() => formatMeasuredWallClock(2000, 1000, 'a', 'b'), /not after its end time/);
  assert.throws(() => formatMeasuredWallClock(Number.NaN, 1000, 'a', 'b'), /not after its end time/);
});

test('the replay of stored shard results is not a run: it has no wall clock and no run verdict', () => {
  const stored = [{
    shard: 1,
    report: parseVitestShardReport({
      numTotalTests: 570,
      numPassedTests: 570,
      numFailedTests: 0,
      startTime: 1792755323767,
      testResults: [{ name: apiFile('core/one.test.ts'), status: 'passed' }],
    }),
  }];
  const replay = buildReplaySummary(stored);
  assert.equal(replay.title, replaySummaryTitle);
  assert.match(replay.title, /not a run/);
  const text = replay.lines.join('\n');
  assert.doesNotMatch(text, /wall clock/i);
  assert.doesNotMatch(text, /delivery status/i);
  assert.doesNotMatch(text, /Total wall clock/);
  assert.doesNotMatch(text, /Delivery status/);
  assert.match(text, /not a run/);
  assert.match(text, /no duration was measured/);
  assert.match(text, /1 files, 1 passed/);
});

test('the replay of stored shard results reports a missing report instead of a number', () => {
  const replay = buildReplaySummary([{ shard: 2, report: null }]);
  const text = replay.lines.join('\n');
  assert.match(text, /no stored results JSON/);
  assert.doesNotMatch(text, /wall clock/i);
  assert.doesNotMatch(text, /delivery status/i);
});

test('the upload storage container is identified by its real id, never by a placeholder name', () => {
  const uploadStorage = {
    env: {
      UPLOAD_S3_BUCKET: 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-api',
      UPLOAD_S3_ENDPOINT: 'http://127.0.0.1:49153',
    },
  };
  assert.equal(uploadStorageContainerName(uploadStorage), 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca');
  assert.equal(uploadStorageContainerName({ env: {} }), '');
  const identified = identifyUploadStorageContainer(uploadStorage, {
    lookupByName: name => ({ id: '3871701a536f9c0d3e5a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071', name }),
    lookupByPort: () => { throw new Error('the port lookup must not be used when the name lookup succeeds'); },
    readVolumes: () => ['jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-data'],
  });
  assert.equal(identified.id, '3871701a536f9c0d3e5a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071');
  assert.equal(identified.name, 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca');
  assert.deepEqual(identified.volumes, ['jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-data']);
  assert.match(identified.identifiedBy, /container name/);
});

test('the upload storage container falls back to its published port when the name lookup finds nothing', () => {
  const uploadStorage = { env: { UPLOAD_S3_BUCKET: 'jiffoo-upload-abc-api', UPLOAD_S3_ENDPOINT: 'http://127.0.0.1:49153' } };
  const identified = identifyUploadStorageContainer(uploadStorage, {
    lookupByName: () => null,
    lookupByPort: port => ({ id: '02d24e18816c', name: 'jiffoo-upload-abc' }),
    readVolumes: () => [],
  });
  assert.equal(identified.id, '02d24e18816c');
  assert.match(identified.identifiedBy, /published host port/);
  const unidentified = identifyUploadStorageContainer(uploadStorage, { lookupByName: () => null, lookupByPort: () => null });
  assert.equal(unidentified, null);
});

test('the cleanup rows of an upload storage carry the real ids and never a placeholder name', () => {
  const rows = uploadStorageCleanupRows({
    shard: 1,
    uploadStorage: {
      id: '3871701a536f',
      name: 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca',
      volumes: ['jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-data'],
      cleanup: { status: 'removed', detail: 'reclaimed by the upload test storage helper of this run' },
    },
  }, { container: false, volumes: { 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-data': false } });
  assert.deepEqual(rows.map(row => row.id), ['3871701a536f', 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-data']);
  assert.deepEqual(rows.map(row => row.status), ['removed', 'removed']);
  assert.match(rows[0].detail, /reclaimed by the upload test storage helper/);
  assert.doesNotMatch(rows.map(row => row.name).join(' '), /unidentified/);
});

test('the cleanup rows of an upload storage need no docker call and no presence measurement', () => {
  const rows = uploadStorageCleanupRows({
    shard: 3,
    uploadStorage: {
      id: '3871701a536f',
      name: 'jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca',
      volumes: ['jiffoo-upload-934a6025-b836-48c2-a6c9-f7ecd36236ca-data'],
      cleanup: { status: 'removed' },
    },
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.status), ['removed', 'removed']);
  assert.deepEqual(uploadStorageCleanupRows({ shard: 1 }), []);
});

test('an upload storage that could not be identified fails the cleanup instead of using a placeholder name', () => {
  const rows = uploadStorageCleanupRows({
    shard: 2,
    uploadStorage: {
      id: 'not-identified',
      name: 'not identified',
      volumes: [],
      cleanup: { status: 'failed', detail: 'the upload storage container could not be identified' },
    },
  }, { container: false, volumes: {} });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'failed');
  assert.equal(rows[0].name, 'not identified');
  assert.doesNotMatch(rows.map(row => row.name).join(' '), /unidentified-upload-storage/);
  const report = buildCleanupReport(rows);
  assert.equal(report.passed, false);
  assert.deepEqual(report.failures.map(row => row.id), ['not-identified']);
});

// The duration table of the API test files: a repository relative path and its measured duration
// in milliseconds.
const skewedDurations = () => {
  const durations = { 'apps/api/tests/core/slow.test.ts': 30_000 };
  for (let offset = 0; offset < 39; offset += 1) {
    durations[`apps/api/tests/core/file-${offset}.test.ts`] = 1_000 + offset * 50;
  }
  return durations;
};

test('the catalogue is split by the measured duration and the slowest shard stays within the tolerance', () => {
  const durations = skewedDurations();
  const files = Object.keys(durations).sort();
  const shards = partitionFilesByDuration(files, 4, durations);
  const balance = shardBalance(shards, durations);
  assert.equal(shards.length, 4);
  assert.ok(balance.slowest <= balance.bound * shardBalanceTolerance, `slowest ${balance.slowest} exceeds ${balance.bound * shardBalanceTolerance}`);
  assert.equal(balance.balanced, true);
  assert.ok(balance.ratio <= shardBalanceTolerance);
  // The slow file dominates one shard, the small files fill the others.
  assert.ok(shards.some(shard => shard.includes('apps/api/tests/core/slow.test.ts')));
});

test('the duration partition keeps every file exactly once and does not change the file count', () => {
  const durations = skewedDurations();
  const files = Object.keys(durations).sort();
  const shards = partitionFilesByDuration(files, 4, durations);
  const flattened = shards.flat();
  assert.equal(flattened.length, files.length);
  assert.equal(new Set(flattened).size, files.length);
  for (const file of files) assert.ok(flattened.includes(file));
});

test('the duration partition is stable: the same input always produces the same shard file lists', () => {
  const durations = skewedDurations();
  const files = Object.keys(durations).sort();
  const first = partitionFilesByDuration(files, 4, durations);
  const second = partitionFilesByDuration(files, 4, durations);
  const shuffled = partitionFilesByDuration([...files].reverse(), 4, durations);
  assert.deepEqual(second, first);
  assert.deepEqual(shuffled, first);
});

test('the duration partition beats the file count partition on a skewed catalogue', () => {
  const durations = skewedDurations();
  const files = Object.keys(durations).sort();
  const byCount = shardBalance(partitionFiles(files, 4), durations);
  const byDuration = shardBalance(partitionFilesByDuration(files, 4, durations), durations);
  assert.ok(byDuration.slowest < byCount.slowest);
  assert.ok(byDuration.ratio <= byCount.ratio);
});

test('a file without a measured duration is weighted with the median of the known durations', () => {
  const durations = { 'apps/api/tests/core/one.test.ts': 1_000, 'apps/api/tests/core/two.test.ts': 3_000 };
  const { weights, fallback } = durationWeights(['apps/api/tests/core/one.test.ts', 'apps/api/tests/core/two.test.ts', 'apps/api/tests/core/unknown.test.ts'], durations);
  assert.equal(fallback, 2_000);
  assert.equal(weights.get('apps/api/tests/core/one.test.ts'), 1_000);
  assert.equal(weights.get('apps/api/tests/core/unknown.test.ts'), 2_000);
});

test('the catalogue falls back to the file count when no duration is known', () => {
  const files = Array.from({ length: 10 }, (_, offset) => `apps/api/tests/core/file-${offset}.test.ts`);
  const withoutDurations = partitionCatalogue(files, 3, {});
  assert.equal(withoutDurations.mode, 'file count');
  assert.equal(withoutDurations.measured, 0);
  assert.deepEqual(withoutDurations.shards.map(shard => shard.length), [4, 3, 3]);
  const withDurations = partitionCatalogue(files, 3, { [files[0]]: 10_000 });
  assert.equal(withDurations.mode, 'measured duration');
  assert.equal(withDurations.measured, 1);
  assert.equal(withDurations.shards.flat().length, files.length);
});

test('the duration table keeps only valid measurements', () => {
  const table = normalizeDurationTable({
    'apps/api/tests/core/one.test.ts': 1_234.6,
    'apps/api/tests/core/two.test.ts': -5,
    'apps/api/tests/core/three.test.ts': 'not a number',
    'apps/api/tests/core/four.test.ts': Number.POSITIVE_INFINITY,
  });
  assert.deepEqual(table, { 'apps/api/tests/core/one.test.ts': 1_235 });
  assert.deepEqual(normalizeDurationTable(null), {});
  assert.deepEqual(normalizeDurationTable([1, 2]), {});
});

test('a duration is taken from the reported duration or from the measured span', () => {
  const entries = parseDurationEntries({
    testResults: [
      { name: apiFile('core/one.test.ts'), startTime: 1_000, endTime: 4_000 },
      { name: apiFile('core/two.test.ts'), duration: 900 },
      { name: apiFile('core/three.test.ts'), assertionResults: [{ duration: 100 }, { duration: 250 }] },
    ],
  });
  assert.deepEqual(entries, [
    { file: 'apps/api/tests/core/one.test.ts', durationMs: 3_000 },
    { file: 'apps/api/tests/core/two.test.ts', durationMs: 900 },
    { file: 'apps/api/tests/core/three.test.ts', durationMs: 350 },
  ]);
});

test('the durations of the last run are read back from the stored shard results', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lane-shards-durations-'));
  try {
    writeFileSync(join(directory, 'shard-1.results.json'), JSON.stringify({
      testResults: [{ name: apiFile('core/one.test.ts'), startTime: 1_000, endTime: 4_000 }],
    }));
    writeFileSync(join(directory, 'shard-2.results.json'), JSON.stringify({
      testResults: [{ name: apiFile('core/two.test.ts'), startTime: 1_000, endTime: 2_500 }],
    }));
    const collected = collectDurationsFromResults(directory);
    assert.deepEqual(collected.durations, {
      'apps/api/tests/core/one.test.ts': 3_000,
      'apps/api/tests/core/two.test.ts': 1_500,
    });
    assert.deepEqual(collected.shards.map(entry => entry.shard), [1, 2]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the duration table is written and read back in a stable order', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lane-shards-table-'));
  try {
    const path = join(directory, 'api-test-durations.json');
    const written = writeDurationTable(path, { 'apps/api/tests/core/b.test.ts': 2_000, 'apps/api/tests/core/a.test.ts': 1_000 });
    assert.deepEqual(Object.keys(written), ['apps/api/tests/core/a.test.ts', 'apps/api/tests/core/b.test.ts']);
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), {
      'apps/api/tests/core/a.test.ts': 1_000,
      'apps/api/tests/core/b.test.ts': 2_000,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
