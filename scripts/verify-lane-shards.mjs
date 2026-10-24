// Local sharded API gate: runs the API Vitest suite as parallel shards, each with its own
// PostgreSQL and Redis container.
//
// Positioning - read this before trusting a result:
// - This script runs the API Vitest suite in parallel shards. It is the API step of the approved
//   runner when the runner invokes it (`pnpm verify:quick --shards=N`), and it does not run the
//   type check, the Prisma drift check, the planner-mandated suites, the admin or shop suites,
//   or the browser E2E.
// - It covers the API Vitest suite only. A result of this script is therefore never a complete
//   gate: the runner adds its own steps and the browser E2E stays with `pnpm verify` and CI.
// - A standalone invocation of this script (for example `pnpm verify:shards`) stays a tool: on
//   its own its result is not delivery evidence.
//
// Isolation contract:
// - every shard starts its own PostgreSQL and Redis container; Docker allocates the host port
//   dynamically and this run reads the published port back from the container it just created,
//   so two lanes (or the integration worktree) can never fight over a fixed port;
// - the shard database name and Redis logical DB match the lane configuration of the current
//   mode, so scripts/lane-config.mjs validation passes unchanged;
// - DATABASE_URL, DATABASE_URL_TEST and REDIS_URL are always overwritten with the shard
//   container URLs; the ambient DATABASE_URL_TEST / REDIS_URL of the shell are ignored;
// - a shard may never use a host service port (5432, 5498, 6379, 6398). The primary isolation
//   evidence is the container ID this run created plus the port mapping read back from it;
// - cleanup removes exactly the container IDs this run created - never a name-based scan; the
//   upload storage container and its volume of every shard are part of that inventory;
// - the expected file set comes from the same frozen snapshot, the same exclusion rules and the
//   same environment as the shards (`vitest list --filesOnly` plus localQuickVitestExclusions('api')
//   with the shard environment). The executed file set of every shard is read back from the Vitest
//   JSON reporter. Missing files, extra files, empty shards and cross-shard duplicates all fail
//   the run;
// - a single shard run (--shard=N) is never a PASS: the expected set stays the full catalogue, the
//   files the shard does not run are counted as missing, the delivery status is PARTIAL and the
//   run fails.
// - before a destructive `prisma migrate reset --force` the current database is measured inside
//   the shard container (`SELECT current_database()`); a mismatch aborts the shard.
// - the wall clock of a run is measured by that run: from the start of the run to the writing of
//   the summary, and per shard from the measured start to the measured end of that shard. A replay
//   (`--replay`) only reads the stored shard results of an earlier run back; it reports itself as
//   "not a run" and produces neither a measured duration nor a run verdict.
// - the upload storage container of a shard is identified by its real container id (the name is
//   derived from the bucket the upload storage helper created, the id is read back from Docker).
//   A placeholder name is never used; an upload storage that cannot be identified is a cleanup
//   failure, because its removal cannot be confirmed.
//
// Modes: with LANE_ID set the shard runs as that registered lane; without LANE_ID it runs in
// integration mode (database jiffoo_core_test, Redis DB 15).
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laneConfig, validateDatabaseUrl, validateRedisUrl } from './lane-config.mjs';
import { localQuickVitestExclusions } from './verify-selection.mjs';

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const apiDirectory = join(repositoryRoot, 'apps', 'api');
const apiDirectoryPrefix = 'apps/api/';

export const databaseImage = 'postgres:18.2';
export const redisImage = 'redis:7.2';
export const maxShards = 8;
export const defaultShards = 4;
export const readinessTimeoutMs = 90_000;
export const migrationTimeoutMs = 10 * 60_000;
// A shard that runs longer than this is treated as an incomplete handover, not as a safe stop.
export const shardTimeoutMs = 45 * 60_000;
// The overall budget is the shard budget plus the container startup and listing overhead.
export const overallTimeoutMs = shardTimeoutMs + 10 * 60_000;
// Grace period given to a terminated shard process tree before its containers are judged alive.
export const processTerminationGraceMs = 20_000;
// Delay between shard launches, so a signal can still stop the shards that did not start.
export const shardLaunchDelayMs = 250;
// Container prefix used when no LANE_ID is set; it never collides with a registered lane id.
export const integrationContainerPrefix = 'integration';
// Host ports of the integration PostgreSQL and Redis services. A shard must never use them.
export const hostServicePorts = Object.freeze([5432, 5498, 6379, 6398]);
// The complete gate is `pnpm verify`; these are the steps this script does NOT run.
export const stepsNotCovered = Object.freeze([
  'TypeScript type check (pnpm type-check)',
  'Prisma schema drift check',
  'Planner-mandated suites (scripts/verify-selection.mjs mandatorySuites)',
  'Admin application suite',
  'Shop application suite',
  'Browser E2E (Playwright)',
  'CI shard catalogue reconciliation',
]);

export function parseShardArgs(argv = []) {
  const shardsArgument = argv.filter(arg => arg.startsWith('--shards='));
  const shardArgument = argv.filter(arg => arg.startsWith('--shard='));
  if (shardsArgument.length > 1 || shardArgument.length > 1) throw new Error('Only one --shards and one --shard argument are accepted.');
  if (shardsArgument.length && shardArgument.length) throw new Error('--shard cannot be combined with --shards.');
  const unknown = argv.filter(arg => arg !== '--keep' && arg !== '--replay' && !arg.startsWith('--shards=') && !arg.startsWith('--shard='));
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  const replay = argv.includes('--replay');
  if (replay && (shardsArgument.length || shardArgument.length || argv.includes('--keep'))) {
    throw new Error('--replay cannot be combined with --shards, --shard or --keep.');
  }
  let shards = defaultShards;
  if (shardsArgument.length) {
    shards = Number(shardsArgument[0].slice('--shards='.length));
    if (!Number.isInteger(shards) || shards < 1 || shards > maxShards) throw new Error(`--shards must be an integer between 1 and ${maxShards}.`);
  }
  let shard;
  if (shardArgument.length) {
    shard = Number(shardArgument[0].slice('--shard='.length));
    if (!Number.isInteger(shard) || shard < 1 || shard > defaultShards) throw new Error(`--shard must be an integer between 1 and ${defaultShards}.`);
  }
  return { shards, shard, keep: argv.includes('--keep'), replay };
}

// A Docker published port line looks like "127.0.0.1:18151"; several lines mean several mappings.
export function parsePublishedPorts(output) {
  return String(output ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/:(\d+)\s*$/);
      return match ? Number(match[1]) : null;
    })
    .filter(port => Number.isInteger(port) && port > 0);
}

export function assertPortIsNotHostService(port, role) {
  if (hostServicePorts.includes(port)) {
    throw new Error(`Shard ${role} port ${port} is a host service port; a shard must never use ${hostServicePorts.join(', ')}.`);
  }
  return port;
}

export function shardContainerNames(containerPrefix, index, runId = '') {
  const suffix = runId ? `-${runId}` : '';
  return { database: `jiffoo-${containerPrefix}-shard${index}${suffix}-db`, redis: `jiffoo-${containerPrefix}-shard${index}${suffix}-redis` };
}

export function shardDatabaseUrl(databasePort, databaseName) {
  return `postgresql://postgres:postgres@127.0.0.1:${databasePort}/${databaseName}`;
}

export function shardRedisUrl(redisPort, redisDb) {
  return `redis://127.0.0.1:${redisPort}/${redisDb}`;
}

export function buildShardPlan(target, shards, only, runId = '') {
  const indexes = only ? [only] : Array.from({ length: shards }, (_, offset) => offset + 1);
  return indexes.map(index => {
    const names = shardContainerNames(target.containerPrefix, index, runId);
    return {
      index,
      shards,
      laneId: target.laneId,
      databaseContainer: names.database,
      redisContainer: names.redis,
      databaseName: target.databaseName,
      redisDb: target.redisDb,
      files: [],
    };
  });
}

// The shard target follows the lane configuration: a registered LANE_ID keeps the lane database
// name and Redis DB, no LANE_ID means integration mode (jiffoo_core_test, Redis DB 15).
export function resolveShardTarget(config = laneConfig()) {
  const laneId = config?.laneId ?? '';
  return {
    mode: laneId ? 'lane' : 'integration',
    laneId,
    containerPrefix: laneId || integrationContainerPrefix,
    databaseName: config?.databaseName,
    redisDb: config?.apiRedisDb,
  };
}

// Port ownership guard: a shard may only talk to the container this run created, and it may
// never land on a host service port.
export function assertShardPortOwnership(shard) {
  assertPortIsNotHostService(shard.databasePort, 'database');
  assertPortIsNotHostService(shard.redisPort, 'Redis');
  if (!shard.databaseContainerId || !shard.redisContainerId) {
    throw new Error(`Shard ${shard.index} must use the containers this run created; the container IDs are missing.`);
  }
  if (Number(new URL(shard.databaseUrl).port) !== shard.databasePort) {
    throw new Error(`Shard ${shard.index} database URL must point at its own port ${shard.databasePort}.`);
  }
  if (Number(new URL(shard.redisUrl).port) !== shard.redisPort) {
    throw new Error(`Shard ${shard.index} Redis URL must point at its own port ${shard.redisPort}.`);
  }
  return shard;
}

export function assertPlanPortOwnership(plan) {
  for (const shard of plan) assertShardPortOwnership(shard);
  return plan;
}

export function assertShardUrlsPassLaneGuards(plan, config) {
  for (const shard of plan) {
    validateDatabaseUrl(shard.databaseUrl, config);
    validateRedisUrl(shard.redisUrl, config);
  }
  return plan;
}

// The catalogue snapshot is collected with the environment of the shards: the same NODE_ENV, the
// same database and Redis URL, the same lane mode and the same exclusion rules.
export function catalogueSnapshotEnvironment(baseEnvironment, shard) {
  return shardEnvironment(baseEnvironment, shard);
}

// The shard environment always points at the shard's own containers; the ambient DATABASE_URL,
// DATABASE_URL_TEST and REDIS_URL of the shell are never used.
export function shardEnvironment(baseEnvironment, shard) {
  const environment = {
    ...baseEnvironment,
    DATABASE_URL: shard.databaseUrl,
    DATABASE_URL_TEST: shard.databaseUrl,
    REDIS_URL: shard.redisUrl,
  };
  if (shard.laneId) environment.LANE_ID = shard.laneId;
  else delete environment.LANE_ID;
  return environment;
}

export function assertContainersAvailable(plan, existingNames) {
  const existing = new Set(existingNames ?? []);
  const conflict = plan.flatMap(shard => [shard.databaseContainer, shard.redisContainer]).find(name => existing.has(name));
  if (conflict) throw new Error(`Container ${conflict} already exists; refusing to touch a container this run did not create.`);
  return plan;
}

// The catalogue is split deterministically so every file is assigned to exactly one shard and
// the shard file lists are known before the run starts.
export function partitionFiles(files, shardCount) {
  const sorted = [...new Set(files ?? [])].sort();
  const shards = Array.from({ length: shardCount }, () => []);
  sorted.forEach((file, offset) => shards[offset % shardCount].push(file));
  return shards;
}

export function normalizeTestFilePath(file, options = {}) {
  const root = options.root ?? repositoryRoot;
  const apiRoot = options.apiRoot ?? apiDirectory;
  const text = String(file ?? '').trim();
  if (!text) return '';
  const absolute = isAbsolute(text) ? text : resolve(apiRoot, text);
  return relative(root, absolute).split(sep).join('/');
}

// Vitest runs with its root at apps/api, so its file filters are relative to that directory.
export function toApiRelativePath(file) {
  const text = String(file ?? '').trim();
  return text.startsWith(apiDirectoryPrefix) ? text.slice(apiDirectoryPrefix.length) : text;
}

export function parseVitestListFiles(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!Array.isArray(parsed)) throw new Error('Unexpected vitest list output: the file list is not an array.');
  return parsed
    .map(item => (typeof item === 'string' ? item : item?.file))
    .filter(Boolean)
    .map(file => normalizeTestFilePath(file))
    .sort();
}

// The authoritative per-shard numbers come from the Vitest JSON reporter, not from the log
// text: the reporter lists every executed test file and its status. Note that
// numTotalTestSuites counts describe blocks (suites), not test files, so the file count is
// the length of testResults.
export function parseVitestShardReport(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const results = Array.isArray(parsed?.testResults) ? parsed.testResults : [];
  const entries = results.map(item => (typeof item === 'string' ? { name: item, status: 'passed' } : item));
  const executedFiles = entries.map(item => item?.name ?? item?.file).filter(Boolean).map(file => normalizeTestFilePath(file)).sort();
  const failedFiles = entries
    .filter(item => item && item.status && item.status !== 'passed')
    .map(item => normalizeTestFilePath(item?.name ?? item?.file))
    .filter(Boolean)
    .sort();
  const passedFiles = entries.filter(item => item?.status === 'passed').length;
  return {
    executedFiles,
    failedFiles,
    testFiles: {
      total: executedFiles.length,
      passed: passedFiles,
      failed: executedFiles.length - passedFiles,
    },
    suites: {
      total: parsed?.numTotalTestSuites ?? 0,
      passed: parsed?.numPassedTestSuites ?? 0,
      failed: parsed?.numFailedTestSuites ?? 0,
      pending: parsed?.numPendingTestSuites ?? 0,
    },
    tests: {
      total: parsed?.numTotalTests ?? 0,
      passed: parsed?.numPassedTests ?? 0,
      failed: parsed?.numFailedTests ?? 0,
      pending: parsed?.numPendingTests ?? 0,
    },
    startTime: parsed?.startTime ?? null,
    success: parsed?.success ?? null,
  };
}

export function formatStartTime(epochMilliseconds) {
  const value = Number(epochMilliseconds);
  if (!Number.isFinite(value) || value <= 0) return 'n/a';
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatCountSummary(counts, label) {
  if (!counts) return 'n/a';
  const parts = [];
  if (counts.total) parts.push(`${counts.total} ${label}`);
  if (counts.passed) parts.push(`${counts.passed} passed`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  return parts.length ? parts.join(', ') : `0 ${label}`;
}

// The totals of a sharded run, summed over the shard reports.
export function sumShardReports(reports) {
  const totals = { testFiles: { total: 0, passed: 0, failed: 0 }, tests: { total: 0, passed: 0, failed: 0, pending: 0 }, suites: { total: 0, passed: 0, failed: 0, pending: 0 } };
  for (const report of reports ?? []) {
    if (!report) continue;
    for (const key of ['testFiles', 'tests', 'suites']) {
      for (const field of Object.keys(totals[key])) totals[key][field] += report[key]?.[field] ?? 0;
    }
  }
  return totals;
}

// A single shard run never covers the whole catalogue. It is reported as PARTIAL, the files it
// does not run are counted as missing by the coverage check and the run fails.
export function describeRunScope({ shard, shards, expectedCount, coveredCount } = {}) {
  const partial = Number.isInteger(shard);
  const expected = expectedCount ?? 0;
  const covered = coveredCount ?? 0;
  return {
    partial,
    expectedCount: expected,
    coveredCount: covered,
    note: partial
      ? `single shard ${shard}/${shards}: only ${covered}/${expected} files covered`
      : `${covered}/${expected} files covered`,
  };
}

// The `docker ps --format` table of this script is an id and a name separated by a tab.
export function parseContainerTable(output) {
  return String(output ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [id, ...rest] = line.split('\t');
      return { id: id.trim(), name: rest.join('\t').trim() };
    })
    .filter(entry => entry.id);
}

// The named volumes of a container, read back from `docker inspect`.
export function parseVolumeNames(mounts) {
  const parsed = typeof mounts === 'string' ? JSON.parse(mounts) : mounts;
  return (Array.isArray(parsed) ? parsed : []).filter(mount => mount?.Type === 'volume' && mount?.Name).map(mount => mount.Name);
}

// The measured current database of a shard must be exactly the planned one. The name is measured
// inside the shard container, not read from the connection URL.
export function assertCurrentDatabaseMatches(measured, expected) {
  const actual = String(measured ?? '').trim();
  if (!actual) throw new Error('The current database could not be measured inside the shard container.');
  if (actual !== expected) {
    throw new Error(`The shard container is connected to database "${actual}", but this shard planned "${expected}"; refusing the destructive reset.`);
  }
  return actual;
}

// The database names that exist inside the shard container.
export function parseDatabaseNames(output) {
  return String(output ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

// Coverage verdict of a sharded run: the expected set must be executed exactly once.
export function computeCoverage(expectedFiles, executedByShard) {
  const expected = new Set(expectedFiles ?? []);
  const owners = new Map();
  const shardCounts = [];
  for (const entry of executedByShard ?? []) {
    const files = entry.files ?? [];
    shardCounts.push({ shard: entry.shard, count: new Set(files).size, reported: entry.reported !== false });
    for (const file of files) {
      if (!owners.has(file)) owners.set(file, []);
      owners.get(file).push(entry.shard);
    }
  }
  const executed = new Set(owners.keys());
  const missing = [...expected].filter(file => !executed.has(file)).sort();
  const extra = [...executed].filter(file => !expected.has(file)).sort();
  const duplicates = [...owners.entries()]
    .filter(([, shards]) => shards.length > 1)
    .map(([file, shards]) => ({ file, shards: [...new Set(shards)].sort((left, right) => left - right) }))
    .sort((left, right) => left.file.localeCompare(right.file));
  const emptyShards = shardCounts.filter(entry => entry.count === 0).map(entry => entry.shard).sort((left, right) => left - right);
  const passed = missing.length === 0 && extra.length === 0 && duplicates.length === 0 && emptyShards.length === 0;
  return {
    expectedCount: expected.size,
    unionSize: executed.size,
    shardCounts,
    missing,
    extra,
    duplicates,
    emptyShards,
    passed,
  };
}

// A timed-out or aborted shard is an incomplete handover: its containers may only be removed
// once the shard process tree is really gone.
export function decideTimeoutHandoff({ timedOut, aborted, lingeringProcesses }) {
  const lingering = lingeringProcesses ?? [];
  if (lingering.length) {
    return {
      removeContainers: false,
      retained: true,
      reason: `the shard did not finish cleanly and ${lingering.length} process(es) are still alive, so its containers are retained`,
    };
  }
  if (timedOut) return { removeContainers: true, retained: false, reason: 'the shard timed out but every child process exited' };
  if (aborted) return { removeContainers: true, retained: false, reason: 'the shard was aborted and every child process exited' };
  return { removeContainers: true, retained: false, reason: 'the shard finished normally' };
}

// Cleanup verdict over the container IDs this run created.
export function buildCleanupReport(containers, options = {}) {
  const rows = (containers ?? []).map(container => ({
    id: container.id,
    name: container.name,
    role: container.role,
    shard: container.shard,
    status: container.status,
    detail: container.detail ?? '',
  }));
  const failures = rows.filter(row => row.status === 'failed');
  const retained = rows.filter(row => row.status === 'retained');
  const removed = rows.filter(row => row.status === 'removed');
  const skipped = rows.filter(row => row.status === 'skipped');
  const passed = failures.length === 0 && retained.length === 0;
  const cell = value => String(value ?? '').replaceAll('|', '\\|');
  const header = ['| Container ID | Name | Role | Shard | Status | Detail |', '| --- | --- | --- | --- | --- | --- |'];
  const body = rows.map(row => `| ${cell(row.id)} | ${cell(row.name)} | ${cell(row.role)} | ${cell(row.shard)} | ${cell(row.status)} | ${cell(row.detail)} |`);
  const ownership = options.ownership ?? 'the operator of this run';
  const handling = options.handling ?? 'remove the container by its ID with `docker rm -f <id>` after confirming that no shard process is still running';
  return {
    passed,
    rows,
    failures,
    retained,
    removed,
    skipped,
    ownership,
    handling,
    table: [...header, ...body].join('\n'),
  };
}

// The delivery status carries the test verdict and the resource cleanup verdict separately.
// A partial run (a single shard of the catalogue) is never reported as PASS.
export function deliveryStatus(testConclusion, cleanupConclusion, scope = null) {
  const label = scope?.partial ? 'PARTIAL' : testConclusion;
  const note = scope?.partial && scope.note ? ` (${scope.note})` : '';
  return `API ${label}${note} / cleanup ${cleanupConclusion}`;
}

// The wall clock of a run is measured by that run. The summary states the measured span, so a
// reader can tell a measured duration from a number that was read back from a stored file.
export function formatMeasuredWallClock(startedAtMilliseconds, finishedAtMilliseconds, startedAtIso, finishedAtIso) {
  const started = Number(startedAtMilliseconds);
  const finished = Number(finishedAtMilliseconds);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    throw new Error('The measured wall clock of a run needs a start time that is not after its end time.');
  }
  return `${formatDuration(finished - started)} (measured by this run: ${startedAtIso} -> ${finishedAtIso})`;
}

// A replay reads the stored shard results of an earlier run back and prints them again. It is not
// a run: it executes no test, it measures no duration and it produces no run verdict. Its output
// therefore carries neither a wall clock nor a delivery status.
export const replaySummaryTitle = 'Replay of stored shard results — not a run';

export function buildReplaySummary(storedResults = []) {
  const rows = (storedResults ?? []).map(entry => ({
    shard: entry.shard,
    testFiles: entry.report ? formatCountSummary(entry.report.testFiles, 'files') : 'no stored results JSON',
    tests: entry.report ? formatCountSummary(entry.report.tests, 'tests') : 'no stored results JSON',
    failedFiles: entry.report?.failedFiles?.length ? entry.report.failedFiles.map(toApiRelativePath).join(', ') : 'not reported',
  }));
  const cell = value => String(value ?? 'n/a').replaceAll('|', '\\|');
  const table = [
    '| Shard | Test Files | Tests | Failed files |',
    '| --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.shard} | ${cell(row.testFiles)} | ${cell(row.tests)} | ${cell(row.failedFiles)} |`),
  ].join('\n');
  const lines = [
    replaySummaryTitle,
    'This output replays the stored shard results of an earlier run. It is not a run: no test was executed,',
    'no duration was measured and no run verdict is produced. Do not use it as a result.',
    `Stored shard result files read back: ${rows.length}`,
    '',
    '--- Stored shard results ---',
    table,
  ];
  return { title: replaySummaryTitle, rows, table, lines };
}

// The stored per-shard results JSON of an earlier run, read back for a replay.
export function readStoredShardResults(resultsDirectory) {
  if (!existsSync(resultsDirectory)) return [];
  const files = readdirSync(resultsDirectory).filter(name => /^shard-\d+\.results\.json$/.test(name)).sort();
  const stored = [];
  for (const file of files) {
    const shard = Number(file.match(/^shard-(\d+)\.results\.json$/)[1]);
    try {
      stored.push({ shard, report: parseVitestShardReport(readFileSync(join(resultsDirectory, file), 'utf8')) });
    } catch {
      stored.push({ shard, report: null });
    }
  }
  return stored;
}

export function indexProcessTree(entries) {
  const index = new Map();
  for (const entry of entries ?? []) index.set(Number(entry.pid), { ...entry, pid: Number(entry.pid), ppid: Number(entry.ppid) });
  return index;
}

export function descendantProcessIds(entries, rootPid) {
  const index = indexProcessTree(entries);
  const descendants = [];
  const queue = [Number(rootPid)];
  while (queue.length) {
    const current = queue.shift();
    for (const entry of index.values()) {
      if (entry.ppid === current && entry.pid !== Number(rootPid) && !descendants.includes(entry.pid)) {
        descendants.push(entry.pid);
        queue.push(entry.pid);
      }
    }
  }
  return descendants.sort((left, right) => left - right);
}

export function survivingProcesses(entries, pids) {
  const wanted = new Set((pids ?? []).map(Number));
  return (entries ?? []).filter(entry => wanted.has(Number(entry.pid))).map(entry => ({
    pid: Number(entry.pid),
    ppid: Number(entry.ppid),
    name: entry.name ?? '',
    commandLine: entry.commandLine ?? '',
  }));
}

// The Vitest output is ANSI coloured; the escape sequence has to be removed completely,
// otherwise the summary lines keep a leading escape character and are not recognised.
const ansi = /\u001B\[[0-9;]*[A-Za-z]/g;

export function summarizeVitestLog(text) {
  const lines = String(text ?? '').replace(ansi, '').split(/\r?\n/).map(line => line.trim());
  const pick = label => {
    const line = lines.findLast(candidate => candidate.startsWith(`${label} `) || candidate.startsWith(`${label}:`));
    if (!line) return 'n/a';
    return line.slice(label.length).trim().replace(/^:\s*/, '');
  };
  const failedFiles = [...new Set(String(text ?? '').replace(ansi, '').split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('FAIL '))
    .map(line => line.slice('FAIL '.length).trim().split(/\s+/)[0])
    .filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)))];
  return {
    startAt: pick('Start at'),
    testFiles: pick('Test Files'),
    tests: pick('Tests'),
    failedFiles,
  };
}

// The shard table only reports numbers that were read back from the per-shard results JSON of
// the Vitest JSON reporter. A shard without that JSON is reported as such, and a shard that
// failed never claims that it had no failing file.
export function aggregateShardResults(results) {
  const rows = results.map(result => {
    const report = result.report ?? null;
    const failedFiles = report ? report.failedFiles.map(toApiRelativePath) : [];
    const failedCell = failedFiles.length
      ? failedFiles.join(', ')
      : (result.exitCode === 0 ? 'none' : 'not reported (no per-shard results JSON)');
    return {
      shard: result.shard,
      exitCode: result.exitCode,
      duration: result.duration,
      startAt: report ? formatStartTime(report.startTime) : result.summary?.startAt ?? 'n/a',
      testFiles: report ? formatCountSummary(report.testFiles, 'files') : 'no per-shard results JSON',
      tests: report ? formatCountSummary(report.tests, 'tests') : 'no per-shard results JSON',
      failedFiles: failedCell,
      reportPresent: Boolean(report),
    };
  });
  const passed = results.length > 0 && results.every((result, offset) => result.exitCode === 0 && rows[offset].reportPresent);
  const cell = value => String(value ?? 'n/a').replaceAll('|', '\\|');
  const header = ['| Shard | Exit | Duration | Start at | Test Files | Tests | Failed files |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const body = rows.map(row => `| ${row.shard} | ${row.exitCode} | ${row.duration} | ${cell(row.startAt)} | ${cell(row.testFiles)} | ${cell(row.tests)} | ${cell(row.failedFiles)} |`);
  return { passed, rows, table: [...header, ...body].join('\n') };
}

export function truncateLine(line, limit = 120) {
  const text = String(line ?? '');
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 180_000, ...options });
  if (result.error) throw new Error(`docker ${args.join(' ')} failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed with ${result.status}: ${(result.stderr || result.stdout || '').trim()}`);
  return (result.stdout ?? '').trim();
}

function containerExists(name) {
  const output = docker(['ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.Names}}']);
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).includes(name);
}

function containerExistsById(containerId) {
  const result = spawnSync('docker', ['inspect', '--format', '{{.Id}}', containerId], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  return result.status === 0 && String(result.stdout ?? '').trim().length > 0;
}

function volumeExists(name) {
  const result = spawnSync('docker', ['volume', 'ls', '--filter', `name=^${name}$`, '--format', '{{.Name}}'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (result.status !== 0) return false;
  return String(result.stdout ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).includes(name);
}

// A container is looked up by its exact name; the full container id is read back from Docker.
function findContainerByName(name) {
  const listed = spawnSync('docker', ['ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.ID}}\t{{.Names}}'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (listed.status !== 0) return null;
  const entry = parseContainerTable(listed.stdout).find(candidate => candidate.name === name);
  if (!entry) return null;
  const inspected = spawnSync('docker', ['inspect', '--format', '{{.Id}}', entry.id], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  const id = inspected.status === 0 ? String(inspected.stdout ?? '').trim() : '';
  return { id: id || entry.id, name: entry.name };
}

// The upload storage container of a shard is found by the host port it publishes, so the cleanup
// inventory can name the container and the volume that the shard created. The docker `publish`
// filter does not match a dynamically published host port, so the candidates of the upload
// storage prefix are compared by their published port one by one.
function findContainerByPublishedPort(port) {
  const listed = spawnSync('docker', ['ps', '-a', '--filter', 'name=jiffoo-upload-', '--format', '{{.ID}}\t{{.Names}}'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (listed.status !== 0) return null;
  for (const candidate of parseContainerTable(listed.stdout)) {
    const published = spawnSync('docker', ['port', candidate.id, '9000'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    if (published.status !== 0) continue;
    if (parsePublishedPorts(published.stdout).includes(port)) return candidate;
  }
  return null;
}

function readContainerVolumes(containerId) {
  const result = spawnSync('docker', ['inspect', '--format', '{{json .Mounts}}', containerId], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (result.status !== 0) return [];
  try {
    return parseVolumeNames(String(result.stdout ?? '').trim());
  } catch {
    return [];
  }
}

// The current database is measured inside the shard container before a destructive reset.
function measureCurrentDatabase(containerId, databaseName) {
  const list = docker(['exec', containerId, 'psql', '-U', 'postgres', '-tAc', 'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname']);
  const databases = parseDatabaseNames(list);
  if (!databases.includes(databaseName)) {
    throw new Error(`The planned database "${databaseName}" does not exist inside the shard container ${containerId}; existing databases: ${databases.join(', ') || 'none'}.`);
  }
  const measured = docker(['exec', containerId, 'psql', '-U', 'postgres', '-p', '5432', '-d', databaseName, '-tAc', 'SELECT current_database()']);
  return { measured: String(measured ?? '').trim(), databases };
}

function existingContainers(names) {
  return names.filter(containerExists);
}

function imagePresent(image) {
  return spawnSync('docker', ['image', 'inspect', image], { encoding: 'utf8', windowsHide: true, timeout: 60_000 }).status === 0;
}

function pullImage(image) {
  if (imagePresent(image)) return;
  console.log(`Pulling ${image}`);
  docker(['pull', image]);
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function delay(milliseconds) {
  return new Promise(done => setTimeout(done, milliseconds));
}

function waitForReady(container, probe, timeoutMs = readinessTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    const result = spawnSync('docker', ['exec', container, ...probe], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    if (result.status === 0) return;
    lastError = (result.stderr || result.stdout || result.error?.message || '').trim();
    sleep(1_000);
  }
  const logs = spawnSync('docker', ['logs', '--tail', '40', container], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  throw new Error(`Container ${container} was not ready within ${timeoutMs}ms: ${lastError}\n${(logs.stdout ?? '') + (logs.stderr ?? '')}`.trim());
}

// Windows cannot spawn a bare `pnpm` (ENOENT) or `pnpm.cmd` without a shell (EINVAL), so the
// pnpm JavaScript entry is resolved and executed with the current Node binary instead.
export function resolvePnpmEntry(env = process.env) {
  if (env.npm_execpath) return env.npm_execpath;
  const home = env.APPDATA ?? env.HOME ?? env.USERPROFILE ?? '';
  const candidates = [
    home ? join(home, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs') : '',
    home ? join(home, 'AppData', 'Roaming', 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs') : '',
    home ? join(home, '.local', 'share', 'pnpm', 'pnpm.cjs') : '',
    home ? join(home, '.local', 'share', 'pnpm', '.tools', 'pnpm', 'latest', 'bin', 'pnpm.cjs') : '',
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return '';
}

export function pnpmInvocation(env = process.env) {
  const entry = resolvePnpmEntry(env);
  if (entry) return { command: process.execPath, prefix: [entry], shell: false, entry };
  if (process.platform === 'win32') return { command: 'pnpm.cmd', prefix: [], shell: true, entry: '' };
  return { command: 'pnpm', prefix: [], shell: false, entry: '' };
}

// A shell command line has to quote every argument that contains a space (the repository path
// of this worktree does), otherwise the argument is split into two.
export function shellCommandLine(command, args) {
  const quote = value => (/[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value);
  return [command, ...args].map(quote).join(' ');
}

function processSnapshot() {
  if (process.platform === 'win32') {
    const result = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    });
    if (result.status !== 0) return [];
    try {
      const parsed = JSON.parse(result.stdout || '[]');
      return (Array.isArray(parsed) ? parsed : [parsed]).map(entry => ({
        pid: entry.ProcessId,
        ppid: entry.ParentProcessId,
        name: entry.Name,
        commandLine: entry.CommandLine,
      }));
    } catch {
      return [];
    }
  }
  const result = spawnSync('ps', ['-eo', 'pid,ppid,args', '--no-headers'], { encoding: 'utf8', timeout: 30_000 });
  if (result.status !== 0) return [];
  return String(result.stdout ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      return match ? { pid: Number(match[1]), ppid: Number(match[2]), name: '', commandLine: match[3] } : null;
    })
    .filter(Boolean);
}

function terminateProcessTree(child, descendantPids) {
  if (process.platform === 'win32') {
    if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    return;
  }
  for (const pid of descendantPids ?? []) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* the process is already gone */ }
  }
  try { child?.kill('SIGKILL'); } catch { /* the process is already gone */ }
}

// Every running child process is tracked so a signal or the overall timeout can stop it.
const runningChildren = new Set();

function terminateChild(child, reason, state) {
  if (state.timedOut || state.aborted) return;
  if (reason === 'timeout') state.timedOut = true;
  else state.aborted = true;
  const snapshot = processSnapshot();
  state.descendants = descendantProcessIds(snapshot, child.pid);
  terminateProcessTree(child, state.descendants);
}

function terminateAllChildren(reason) {
  for (const record of [...runningChildren]) terminateChild(record.child, reason, record.state);
}

function runCommand(args, { env, cwd, log, timeoutMs } = {}) {
  const { command, prefix, shell } = pnpmInvocation(env);
  const fullArgs = [...prefix, ...args];
  const commandLine = shell ? shellCommandLine(command, fullArgs) : command;
  const commandArgs = shell ? [] : fullArgs;
  return new Promise(done => {
    const child = spawn(commandLine, commandArgs, {
      cwd: cwd ?? repositoryRoot,
      env,
      shell,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const state = { pid: child.pid, timedOut: false, aborted: false, descendants: [], lingering: [] };
    const record = { child, state };
    runningChildren.add(record);
    let timer = null;
    if (timeoutMs) timer = setTimeout(() => terminateChild(child, 'timeout', state), timeoutMs);
    child.stdout?.on('data', chunk => log?.write(chunk));
    child.stderr?.on('data', chunk => log?.write(chunk));
    child.once('error', error => {
      log?.write(`\nspawn error: ${error.message}\n`);
      if (timer) clearTimeout(timer);
      runningChildren.delete(record);
      done({ code: 1, error, ...state });
    });
    child.once('close', code => {
      if (timer) clearTimeout(timer);
      runningChildren.delete(record);
      if (state.timedOut || state.aborted) {
        const deadline = Date.now() + processTerminationGraceMs;
        let survivors = survivingProcesses(processSnapshot(), state.descendants);
        while (survivors.length && Date.now() < deadline) {
          sleep(500);
          survivors = survivingProcesses(processSnapshot(), state.descendants);
        }
        state.lingering = survivors;
      }
      done({ code: code ?? 1, ...state });
    });
  });
}

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function createRunId() {
  return `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
}

// The expected file set of the frozen snapshot. It is collected with the same exclusion rules and
// the same environment as the shards, so the snapshot and the run describe the same catalogue.
function listExpectedApiFiles(resultsDirectory, environment = process.env) {
  const listPath = join(resultsDirectory, 'expected-files.json');
  const { command, prefix, shell } = pnpmInvocation(environment);
  const args = [...prefix, '--filter', 'api', 'exec', 'vitest', 'list', '--filesOnly', ...localQuickVitestExclusions('api'), `--json=${listPath}`];
  const commandLine = shell ? shellCommandLine(command, args) : command;
  const commandArgs = shell ? [] : args;
  const result = spawnSync(commandLine, commandArgs, {
    cwd: repositoryRoot,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
    shell,
  });
  if (result.status !== 0) {
    throw new Error(`vitest list failed with ${result.status}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  if (!existsSync(listPath)) throw new Error(`vitest list did not write ${listPath}.`);
  return parseVitestListFiles(readFileSync(listPath, 'utf8'));
}

// The upload storage helper names its container `jiffoo-upload-<uuid>` and its bucket
// `<uuid>-api`, so the container of a shard can be named without guessing. The real container id
// is read back from Docker; a placeholder name is never used.
export function uploadStorageContainerName(uploadStorage) {
  const bucket = String(uploadStorage?.env?.UPLOAD_S3_BUCKET ?? '').trim();
  if (!bucket) return '';
  return bucket.endsWith('-api') ? bucket.slice(0, -'-api'.length) : '';
}

// The upload storage container of a shard is identified by its real container id. The name derived
// from the bucket is the primary lookup; the published host port of the upload endpoint is the
// fallback. When neither lookup finds the container, the caller has to report that the removal of
// the upload storage cannot be confirmed - never a placeholder name.
export function identifyUploadStorageContainer(uploadStorage, options = {}) {
  const lookupByName = options.lookupByName ?? findContainerByName;
  const lookupByPort = options.lookupByPort ?? findContainerByPublishedPort;
  const readVolumes = options.readVolumes ?? readContainerVolumes;
  const name = uploadStorageContainerName(uploadStorage);
  let container = name ? lookupByName(name) : null;
  let identifiedBy = container ? 'the container name derived from the upload storage bucket' : '';
  if (!container) {
    const endpoint = String(uploadStorage?.env?.UPLOAD_S3_ENDPOINT ?? '');
    const port = endpoint ? Number(new URL(endpoint).port) : 0;
    if (port) {
      container = lookupByPort(port);
      if (container) identifiedBy = 'the published host port of the upload storage endpoint';
    }
  }
  if (!container) return null;
  return { id: container.id, name: container.name, volumes: readVolumes(container.id), identifiedBy };
}

// The cleanup verdict of one upload storage resource: a retained storage stays, a storage that
// could not be removed is a failure and only a storage that is gone counts as removed.
export function uploadStorageResourceStatus(cleanupStatus, stillPresent) {
  if (cleanupStatus === 'skipped') return 'skipped';
  if (cleanupStatus === 'retained') return 'retained';
  if (cleanupStatus === 'failed' || stillPresent) return 'failed';
  return 'removed';
}

// The cleanup rows of the upload storage of a shard. A shard whose process is still alive keeps
// its upload storage; a storage that could not be removed is a cleanup failure, not a PASS. The
// rows always carry the real resource id; a container that could not be identified is reported as
// "not identified" and fails the cleanup, because its removal cannot be confirmed. The presence of
// the resources is measured by the caller and handed in, so this function stays pure.
export function uploadStorageCleanupRows(outcome, presence = {}) {
  const storage = outcome?.uploadStorage;
  if (!storage) return [];
  const cleanup = storage.cleanup ?? {};
  const rows = [];
  const containerPresent = presence.container ?? false;
  const containerStatus = uploadStorageResourceStatus(cleanup.status, containerPresent);
  const containerDetail = cleanup.status === 'retained'
    ? cleanup.detail ?? 'the shard process is still alive'
    : cleanup.status === 'failed'
      ? cleanup.detail ?? 'the upload storage cleanup failed'
      : containerPresent
        ? `the upload storage container still exists after the cleanup (${cleanup.detail ?? 'unknown reason'})`
        : 'reclaimed by the upload test storage helper of this run (the test removed the container itself)';
  rows.push({ id: storage.id, name: storage.name, role: 'upload-storage', shard: outcome.shard, status: containerStatus, detail: containerDetail });
  for (const volume of storage.volumes ?? []) {
    const volumePresent = presence.volumes?.[volume] ?? false;
    const volumeStatus = uploadStorageResourceStatus(cleanup.status, volumePresent);
    const volumeDetail = cleanup.status === 'retained'
      ? cleanup.detail ?? 'the shard process is still alive'
      : cleanup.status === 'failed'
        ? cleanup.detail ?? 'the upload storage cleanup failed'
        : volumePresent
          ? 'the upload storage volume still exists after the cleanup'
          : 'reclaimed by the upload test storage helper of this run (the test removed the volume itself)';
    rows.push({ id: volume, name: volume, role: 'upload-storage-volume', shard: outcome.shard, status: volumeStatus, detail: volumeDetail });
  }
  return rows;
}

async function runShard(shard, baseEnvironment, resultsDirectory, keep = false) {
  const logPath = join(resultsDirectory, `shard-${shard.index}.log`);
  const resultsPath = join(resultsDirectory, `shard-${shard.index}.results.json`);
  const log = createWriteStream(logPath, { flags: 'w' });
  // A results file of an earlier run must never be reported as the result of this shard.
  if (existsSync(resultsPath)) rmSync(resultsPath, { force: true });
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  let exitCode = 1;
  let uploadStorage;
  let uploadContainer = null;
  let uploadCleanup = null;
  let uploadUnidentified = false;
  let timedOut = false;
  let aborted = false;
  let lingering = [];
  try {
    log.write(`# shard ${shard.index}/${shard.shards}\n`);
    log.write(`# database ${shard.databaseUrl}\n`);
    log.write(`# redis ${shard.redisUrl}\n`);
    log.write(`# database container ${shard.databaseContainerId}\n`);
    log.write(`# redis container ${shard.redisContainerId}\n`);
    log.write(`# assigned test files ${shard.files.length}\n`);
    uploadStorage = await (await import('./upload-test-storage.mjs')).startUploadTestStorage();
    uploadContainer = identifyUploadStorageContainer(uploadStorage);
    uploadUnidentified = !uploadContainer;
    if (uploadContainer) {
      log.write(`# upload storage container ${uploadContainer.id} (${uploadContainer.name}), identified by ${uploadContainer.identifiedBy}\n`);
      for (const volume of uploadContainer.volumes) log.write(`# upload storage volume ${volume}\n`);
    } else {
      log.write('# upload storage container could not be identified; its removal cannot be confirmed\n');
    }
    const environment = shardEnvironment({ ...baseEnvironment, ...uploadStorage.env }, shard);
    // The destructive reset is only allowed after the current database was measured inside the
    // shard container; the URL string alone is not evidence.
    const urlDatabaseName = decodeURIComponent(new URL(shard.databaseUrl).pathname.slice(1));
    if (urlDatabaseName !== shard.databaseName) {
      throw new Error(`The shard database URL points at "${urlDatabaseName}" instead of the planned "${shard.databaseName}".`);
    }
    const measurement = measureCurrentDatabase(shard.databaseContainerId, shard.databaseName);
    assertCurrentDatabaseMatches(measurement.measured, shard.databaseName);
    log.write(`# current database measured inside the shard container: ${measurement.measured}\n`);
    const migration = await runCommand(['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed'], { env: environment, log, timeoutMs: migrationTimeoutMs });
    if (migration.code !== 0 || migration.timedOut || migration.aborted) {
      log.write(`# migration failed with ${migration.code}\n`);
      exitCode = migration.code;
      timedOut = migration.timedOut;
      aborted = migration.aborted;
      lingering = migration.lingering ?? [];
    } else {
      const vitest = await runCommand([
        '--filter', 'api', 'exec', 'vitest', 'run',
        ...localQuickVitestExclusions('api'),
        ...shard.files.map(toApiRelativePath),
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${resultsPath}`,
      ], { env: environment, log, timeoutMs: shardTimeoutMs });
      exitCode = vitest.code;
      timedOut = vitest.timedOut;
      aborted = vitest.aborted;
      lingering = vitest.lingering ?? [];
    }
  } catch (error) {
    log.write(`\n# shard error: ${error?.message ?? String(error)}\n`);
    exitCode = 1;
  } finally {
    if (uploadStorage) {
      if (keep) {
        uploadCleanup = { status: 'skipped', detail: 'kept on request (--keep)' };
        log.write('\n# upload storage kept on request (--keep)\n');
      } else if (lingering.length) {
        const alive = lingering.map(entry => `${entry.pid}:${entry.name}`).join(', ') || 'unknown';
        uploadCleanup = { status: 'retained', detail: `shard process still alive (${alive}); the upload storage of this shard is retained` };
        log.write(`\n# upload storage retained: the shard process is still alive (${alive})\n`);
      } else {
        try {
          uploadStorage.stop();
          uploadCleanup = uploadUnidentified
            ? { status: 'failed', detail: 'the upload storage container could not be identified by its name or its published port, so its removal cannot be confirmed' }
            : { status: 'removed', detail: 'reclaimed by the upload test storage helper of this run (the test removed the container itself)' };
        } catch (error) {
          uploadCleanup = { status: 'failed', detail: `upload storage cleanup failed: ${error.message}` };
          log.write(`\n# upload storage cleanup failed: ${error.message}\n`);
        }
      }
    }
    await new Promise(done => log.end(done));
  }
  const finishedAt = Date.now();
  const finishedAtIso = new Date(finishedAt).toISOString();
  const duration = Date.now() - startedAt;
  const text = readFileSync(logPath, 'utf8');
  let report = null;
  if (existsSync(resultsPath)) {
    try {
      report = parseVitestShardReport(readFileSync(resultsPath, 'utf8'));
    } catch (error) {
      log.write(`\n# vitest json report could not be parsed: ${error.message}\n`);
    }
  }
  return {
    shard: shard.index,
    exitCode,
    timedOut,
    aborted,
    lingering,
    duration: formatDuration(duration),
    startedAtIso,
    finishedAtIso,
    summary: summarizeVitestLog(text),
    report,
    assignedFiles: shard.files,
    executedFiles: report?.executedFiles ?? null,
    uploadStorage: uploadContainer
      ? { ...uploadContainer, cleanup: uploadCleanup }
      : uploadCleanup
        ? { id: 'not-identified', name: 'not identified', volumes: [], cleanup: uploadCleanup }
        : null,
    logPath,
  };
}

function startContainer(args) {
  const output = docker(args);
  const id = output.split(/\s+/)[0];
  if (!/^[0-9a-f]{12,64}$/i.test(id)) throw new Error(`docker run did not return a container ID: ${output}`);
  return id;
}

function readPublishedPort(containerId, containerPort, role) {
  const ports = parsePublishedPorts(docker(['port', containerId, String(containerPort)]));
  if (!ports.length) throw new Error(`Container ${containerId} published no ${role} port.`);
  const port = ports[0];
  assertPortIsNotHostService(port, role);
  return port;
}

function removeContainer(containerId) {
  const result = spawnSync('docker', ['rm', '-f', containerId], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (result.status !== 0) return { status: 'failed', detail: (result.stderr || result.stdout || `docker rm exited with ${result.status}`).trim() };
  return { status: 'removed', detail: 'removed by container ID' };
}

function containerState(containerId) {
  const result = spawnSync('docker', ['inspect', '--format', '{{.State.Status}}', containerId], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  if (result.status !== 0) return 'unknown';
  return (result.stdout ?? '').trim() || 'unknown';
}

async function main() {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const { shards, shard, keep, replay } = parseShardArgs(process.argv.slice(2));
  const resultsDirectory = resolve('tmp', 'lane-shards');
  mkdirSync(resultsDirectory, { recursive: true });
  if (replay) {
    // A replay only reads the stored shard results of an earlier run back. It is not a run: it
    // measures no duration and produces no run verdict.
    const replaySummary = buildReplaySummary(readStoredShardResults(resultsDirectory));
    for (const line of replaySummary.lines) console.log(truncateLine(line));
    writeFileSync(join(resultsDirectory, 'replay-summary.txt'), `${replaySummary.lines.join('\n')}\n`, 'utf8');
    return;
  }
  const config = laneConfig();
  const target = resolveShardTarget(config);
  const runId = createRunId();
  const plan = buildShardPlan(target, shards, shard, runId);
  const plannedNames = plan.flatMap(entry => [entry.databaseContainer, entry.redisContainer]);
  assertContainersAvailable(plan, existingContainers(plannedNames));

  console.log(`Mode ${target.mode}${target.laneId ? ` (lane ${target.laneId})` : ''}: database ${target.databaseName}, Redis DB ${target.redisDb}`);
  console.log(`Run ${runId}`);

  // The base environment of the run. The catalogue snapshot and every shard use this environment,
  // so the expected file set and the executed file set describe the same catalogue.
  const baseEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    CI: 'true',
    JWT_SECRET: 'ci-test-secret',
    PLUGIN_SECRETS_KEY: Buffer.alloc(32, 17).toString('base64'),
  };

  pullImage(databaseImage);
  pullImage(redisImage);

  const created = [];
  const outcomes = [];
  let cleanupDone = false;
  let stopping = false;
  const onSignal = signal => {
    if (stopping) return;
    stopping = true;
    console.error(`\nReceived ${signal}: stopping new shards and terminating running shards.`);
    terminateAllChildren('signal');
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    for (const entry of plan) {
      const databaseId = startContainer(['run', '-d', '--name', entry.databaseContainer, '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=postgres',
        '-e', `POSTGRES_DB=${entry.databaseName}`, '-p', '127.0.0.1::5432', databaseImage]);
      created.push({ id: databaseId, name: entry.databaseContainer, role: 'database', shard: entry.index });
      entry.databaseContainerId = databaseId;
      const redisId = startContainer(['run', '-d', '--name', entry.redisContainer, '-p', '127.0.0.1::6379', redisImage]);
      created.push({ id: redisId, name: entry.redisContainer, role: 'redis', shard: entry.index });
      entry.redisContainerId = redisId;
    }
    for (const entry of plan) {
      entry.databasePort = readPublishedPort(entry.databaseContainerId, 5432, 'database');
      entry.redisPort = readPublishedPort(entry.redisContainerId, 6379, 'Redis');
      entry.databaseUrl = shardDatabaseUrl(entry.databasePort, entry.databaseName);
      entry.redisUrl = shardRedisUrl(entry.redisPort, entry.redisDb);
      console.log(`Shard ${entry.index}/${entry.shards}: db ${entry.databaseUrl} | redis ${entry.redisUrl} | containers ${entry.databaseContainerId}, ${entry.redisContainerId}`);
    }
    assertPlanPortOwnership(plan);
    assertShardUrlsPassLaneGuards(plan, config);
    for (const entry of plan) {
      waitForReady(entry.databaseContainerId, ['pg_isready', '-U', 'postgres', '-d', entry.databaseName]);
      waitForReady(entry.redisContainerId, ['redis-cli', 'ping']);
    }

    // The catalogue snapshot is collected with the same environment and the same exclusion rules
    // as the shards that run against it.
    const catalogueEnvironment = catalogueSnapshotEnvironment(baseEnvironment, plan[0]);
    const catalogue = listExpectedApiFiles(resultsDirectory, catalogueEnvironment);
    const partition = partitionFiles(catalogue, plan[0].shards);
    for (const entry of plan) entry.files = partition[entry.index - 1] ?? [];
    const assigned = plan.flatMap(entry => entry.files);
    console.log(`Catalogue files: ${catalogue.length}; assigned to this run: ${assigned.length}`);

    const overallTimer = setTimeout(() => {
      stopping = true;
      console.error('\nOverall timeout reached: terminating running shards.');
      terminateAllChildren('timeout');
    }, overallTimeoutMs);
    try {
      const promises = [];
      for (const entry of plan) {
        if (stopping) {
          outcomes.push({
            shard: entry.index,
            exitCode: 1,
            timedOut: false,
            aborted: true,
            lingering: [],
            duration: '0.0s',
            summary: summarizeVitestLog(''),
            report: null,
            assignedFiles: entry.files,
            executedFiles: null,
            logPath: join(resultsDirectory, `shard-${entry.index}.log`),
            skipped: true,
          });
          continue;
        }
        promises.push(runShard(entry, baseEnvironment, resultsDirectory, keep));
        await delay(shardLaunchDelayMs);
      }
      const settled = await Promise.allSettled(promises);
      settled.forEach((entry, offset) => {
        if (entry.status === 'fulfilled') outcomes.push(entry.value);
        else {
          const index = plan[offset]?.index ?? offset + 1;
          outcomes.push({
            shard: index,
            exitCode: 1,
            timedOut: false,
            aborted: false,
            lingering: [],
            duration: '0.0s',
            summary: summarizeVitestLog(''),
            report: null,
            assignedFiles: plan[offset]?.files ?? [],
            executedFiles: null,
            logPath: join(resultsDirectory, `shard-${index}.log`),
            error: entry.reason?.message ?? String(entry.reason),
          });
        }
      });
    } finally {
      clearTimeout(overallTimer);
    }
    outcomes.sort((left, right) => left.shard - right.shard);

    const aggregate = aggregateShardResults(outcomes);
    // The expected set is always the full catalogue, never the subset this run happened to be
    // assigned. A single shard run therefore leaves the other files missing and fails.
    const coverage = computeCoverage(catalogue, outcomes.map(outcome => ({
      shard: outcome.shard,
      files: outcome.report?.executedFiles ?? [],
      reported: outcome.report !== null && outcome.report !== undefined,
    })));
    const scope = describeRunScope({ shard, shards, expectedCount: coverage.expectedCount, coveredCount: coverage.unionSize });

    // Resource cleanup: only the container IDs this run created are touched, and a shard whose
    // process tree is still alive keeps its containers.
    const retainShards = new Set();
    for (const outcome of outcomes) {
      const handoff = decideTimeoutHandoff({ timedOut: outcome.timedOut, aborted: outcome.aborted, lingeringProcesses: outcome.lingering });
      if (handoff.retained) retainShards.add(outcome.shard);
    }
    const cleanupContainers = created.map(container => {
      if (keep) return { ...container, status: 'skipped', detail: 'kept on request (--keep)' };
      if (retainShards.has(container.shard)) {
        const lingering = outcomes.find(outcome => outcome.shard === container.shard)?.lingering ?? [];
        return {
          ...container,
          status: 'retained',
          detail: `shard process still alive (${lingering.map(entry => `${entry.pid}:${entry.name}`).join(', ') || 'unknown'}); container state ${containerState(container.id)}`,
        };
      }
      return { ...container, ...removeContainer(container.id) };
    });
    // The upload storage container and its volume of every shard belong to the cleanup inventory.
    // Their presence is measured here, after the shards finished, so the conclusion says whether
    // the resource is really gone.
    const uploadRows = outcomes.flatMap(outcome => {
      const storage = outcome?.uploadStorage;
      if (!storage) return [];
      return uploadStorageCleanupRows(outcome, {
        container: storage.id ? containerExistsById(storage.id) : false,
        volumes: Object.fromEntries((storage.volumes ?? []).map(volume => [volume, volumeExists(volume)])),
      });
    });
    cleanupDone = true;
    const cleanup = buildCleanupReport([...cleanupContainers, ...uploadRows], {
      ownership: target.laneId ? `the operator of lane ${target.laneId}` : 'the operator of this integration run',
      handling: 'remove the residual container by its ID with `docker rm -f <id>` once no shard process is running',
    });

    const testConclusion = aggregate.passed && coverage.passed ? 'PASS' : 'FAIL';
    const cleanupConclusion = keep ? 'SKIPPED' : cleanup.passed ? 'PASS' : 'FAIL';
    const status = deliveryStatus(testConclusion, cleanupConclusion, scope);
    // The wall clock is measured by this run: from the start of the run to the writing of this
    // summary. It is never a number that was read back from a stored file.
    const finishedAt = Date.now();
    const finishedAtIso = new Date(finishedAt).toISOString();
    const wallClock = formatMeasuredWallClock(startedAt, finishedAt, startedAtIso, finishedAtIso);

    const totals = sumShardReports(outcomes.map(outcome => outcome.report));
    const reportsRead = outcomes.filter(outcome => outcome.report).length;
    const coverageLines = [
      `Catalogue files (vitest list --filesOnly, same exclusions, same environment as the shards): ${catalogue.length}`,
      `Expected set (the full catalogue, not the assigned subset): ${coverage.expectedCount}`,
      `Assigned to this run: ${assigned.length}`,
      `Executed (union over all shards): ${coverage.unionSize}`,
      ...coverage.shardCounts.map(entry => `Shard ${entry.shard}: ${entry.count} files${entry.reported ? '' : ' (no JSON report)'}`),
      `Missing files: ${coverage.missing.length ? coverage.missing.join(', ') : 'none'}`,
      `Extra files: ${coverage.extra.length ? coverage.extra.join(', ') : 'none'}`,
      `Cross-shard duplicates: ${coverage.duplicates.length ? coverage.duplicates.map(entry => `${entry.file} (shards ${entry.shards.join(', ')})`).join('; ') : 'none'}`,
      `Empty shards: ${coverage.emptyShards.length ? coverage.emptyShards.join(', ') : 'none'}`,
      `Coverage verdict: ${coverage.passed ? 'PASS' : 'FAIL'}`,
    ];

    const summary = [
      '=== Lane shard summary ===',
      `Mode: ${target.mode}${target.laneId ? ` (lane ${target.laneId})` : ''}`,
      `Database: ${target.databaseName}`,
      `Redis DB: ${target.redisDb}`,
      `Shards: ${plan.map(entry => entry.index).join(', ')} of ${plan[0].shards} (${plan.length}-shard run)`,
      `Run scope: ${scope.partial ? `PARTIAL (single shard ${shard} of ${shards})` : `full catalogue (${plan.length} shard(s))`}`,
      `Scope coverage: ${scope.note}`,
      `Totals: Test Files ${formatCountSummary(totals.testFiles, 'files')} | Tests ${formatCountSummary(totals.tests, 'tests')} | Suites ${formatCountSummary(totals.suites, 'suites')}`,
      `Shard results JSON read back: ${reportsRead}/${outcomes.length}`,
      `Test conclusion: ${testConclusion}`,
      `Cleanup conclusion: ${cleanupConclusion}`,
      `Delivery status: ${status}`,
      ...(scope.partial ? ['Partial run note: a single shard never covers the whole catalogue; the uncovered files are counted as missing, the run fails and it is never reported as PASS.'] : []),
      `Total wall clock: ${wallClock}`,
      '',
      '--- Positioning (read before trusting this result) ---',
      'This script runs the API Vitest suite in parallel shards.',
      'It is the API step of the approved runner when the runner invokes it (`pnpm verify:quick --shards=N`);',
      'a standalone invocation (for example `pnpm verify:shards`) stays a tool whose result is not delivery evidence on its own.',
      'It covers the API Vitest suite only, so it is never a complete gate on its own.',
      'Steps this script does not run:',
      ...stepsNotCovered.map(step => `  - ${step}`),
      '',
      '--- File coverage ---',
      ...coverageLines,
      '',
      '--- Shard results ---',
      aggregate.table,
      'The durations above are the measured wall clock of this run, per shard, from the measured start to the measured end of that shard.',
      '',
      '--- Shard timing (measured by this run) ---',
      ...outcomes.map(outcome => `Shard ${outcome.shard}: ${outcome.startedAtIso ?? 'not started'} -> ${outcome.finishedAtIso ?? 'not finished'} (${outcome.duration})`),
      '',
      '--- Container inventory (created by this run) ---',
      cleanup.table,
      '',
      '--- Resource cleanup ---',
      `Cleanup conclusion: ${cleanupConclusion}`,
      `Created resources (id, role, shard): ${cleanup.rows.map(row => `${row.id} (${row.role}, shard ${row.shard})`).join(', ') || 'none'}`,
      `Created container IDs: ${created.map(container => container.id).join(', ') || 'none'}`,
      `Created upload storage container IDs: ${uploadRows.filter(row => row.role === 'upload-storage').map(row => row.id).join(', ') || 'none'}`,
      `Created upload storage volume IDs: ${uploadRows.filter(row => row.role === 'upload-storage-volume').map(row => row.id).join(', ') || 'none'}`,
      `Removed resources (id, role, shard): ${cleanup.removed.map(row => `${row.id} (${row.role}, shard ${row.shard})`).join(', ') || 'none'}`,
      `Removed container IDs: ${cleanup.removed.filter(row => row.role !== 'upload-storage-volume').map(container => container.id).join(', ') || 'none'}`,
      `Removed upload storage volumes: ${cleanup.removed.filter(row => row.role === 'upload-storage-volume').map(container => container.id).join(', ') || 'none'}`,
      `Retained resources (id, role, shard): ${cleanup.retained.map(container => `${container.id} (${container.role}, shard ${container.shard})`).join(', ') || 'none'}`,
      `Failed resources (id, role, shard): ${cleanup.failures.map(container => `${container.id} (${container.role}, shard ${container.shard})`).join(', ') || 'none'}`,
      `Skipped resources (id, role, shard): ${cleanup.skipped.map(container => `${container.id} (${container.role}, shard ${container.shard})`).join(', ') || 'none'}`,
      `Upload storage of each shard (id, shard, status): ${uploadRows.filter(row => row.role === 'upload-storage').map(row => `${row.id} (shard ${row.shard}, ${row.status})`).join(', ') || 'none'}`,
      `Ownership of the residuals: ${cleanup.ownership}`,
      `Handling: ${cleanup.handling}`,
      '',
      ...plan.map(entry => `Shard ${entry.index} log: ${join('tmp', 'lane-shards', `shard-${entry.index}.log`)}`),
    ].join('\n');
    writeFileSync(join(resultsDirectory, 'summary.txt'), `${summary}\n`, 'utf8');
    for (const line of summary.split('\n')) console.log(truncateLine(line));
    if (testConclusion !== 'PASS' || cleanupConclusion === 'FAIL') process.exitCode = 1;
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    if (!cleanupDone && created.length) {
      for (const container of created) {
        const removal = removeContainer(container.id);
        console.error(`Emergency cleanup of container ${container.id} (${removal.status}): ${removal.detail}`);
      }
    }
    if (!cleanupDone) {
      for (const outcome of outcomes) {
        const storage = outcome.uploadStorage;
        if (!storage) continue;
        if (containerExistsById(storage.id)) {
          const removal = removeContainer(storage.id);
          console.error(`Emergency cleanup of upload storage container ${storage.id} (${removal.status}): ${removal.detail}`);
        }
        for (const volume of storage.volumes ?? []) {
          if (!volumeExists(volume)) continue;
          const removal = spawnSync('docker', ['volume', 'rm', volume], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
          console.error(`Emergency cleanup of upload storage volume ${volume} (${removal.status === 0 ? 'removed' : 'failed'}): ${(removal.stderr || removal.stdout || '').trim()}`);
        }
      }
    }
    if (keep) console.log('Keeping shard containers (--keep).');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message ?? String(error));
    process.exit(1);
  });
}
