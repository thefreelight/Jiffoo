import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { startUploadTestStorage } from './upload-test-storage.mjs';
import { resetTestPluginSchemas } from './reset-test-plugin-schemas.mjs';
import { localSteps, ciSteps, localShardSteps } from './verify-steps.mjs';
import { parseShardArgs } from './verify-lane-shards.mjs';
import { laneConfig, validateDatabaseUrl, validateRedisUrl } from './lane-config.mjs';
import { parseSelection, mandatorySuites, quickRequirements } from './verify-selection.mjs';

const databaseUrl = process.env.DATABASE_URL_TEST;
const quick = process.argv.includes('--quick');
const selectedArgument = process.argv.slice(2).filter(value => value.startsWith('--test-files='));
// The optional local shard mode: `pnpm verify:quick --shards=N` replaces the API suite step of
// the approved runner with the sharded API run of scripts/verify-lane-shards.mjs. It is explicit
// and it is mutually exclusive with the explicit file selection.
const laneShardArguments = process.argv.slice(2).filter(value => value.startsWith('--shards='));
const shardMode = laneShardArguments.length > 0;
const ciArguments = process.argv.slice(2).filter(value => value.startsWith('--ci-'));
const groupArguments = ciArguments.filter(value => value.startsWith('--ci-group='));
const shardArguments = ciArguments.filter(value => value.startsWith('--ci-shard='));
const group = groupArguments[0]?.slice('--ci-group='.length);
const shard = shardArguments[0]?.slice('--ci-shard='.length);
if (ciArguments.length && (process.env.GITHUB_ACTIONS !== 'true' || quick || selectedArgument.length || groupArguments.length !== 1 || shardArguments.length > 1 || ciArguments.length !== groupArguments.length + shardArguments.length)) {
  console.error('CI group/shard selection requires GitHub Actions and cannot be combined with local selection.');
  process.exit(1);
}
const plannedSteps = group ? ciSteps(databaseUrl, group, shard) : undefined;
if (selectedArgument.length > 1 || selectedArgument.length && !quick) {
  console.error('--test-files is supported exactly once and only with --quick; full verification always runs every step.');
  process.exit(1);
}
if (laneShardArguments.length > 1) {
  console.error('--shards is supported exactly once.');
  process.exit(1);
}
if (shardMode && selectedArgument.length) {
  console.error('--shards and --test-files are mutually exclusive: --shards=N runs the whole API suite in shards, --test-files selects individual files. Use one of them.');
  process.exit(1);
}
if (shardMode && !quick) {
  console.error('--shards is supported only with --quick (pnpm verify:quick --shards=N); the full verification always runs every step.');
  process.exit(1);
}
if (shardMode && group) {
  console.error('--shards cannot be combined with the CI group selection.');
  process.exit(1);
}
if (shardMode && process.argv.slice(2).some(value => value.startsWith('--scope='))) {
  console.error('--shards cannot be combined with --scope: the shard mode runs the full API, Admin and Shop suites.');
  process.exit(1);
}
let shardCount = null;
if (shardMode) {
  try {
    shardCount = parseShardArgs(laneShardArguments).shards;
  } catch (error) {
    console.error(`Invalid --shards argument: ${error.message}`);
    process.exit(1);
  }
}
const selection = parseSelection(process.argv.slice(2), file => existsSync(resolve(file)));
if (group && selection.scopes.length) throw new Error('CI cannot use local scope selection.');
const selectedFiles = selection.files;
const config = laneConfig();
function gitFiles(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Cannot inspect changed files for mandatory suites.');
  return result.stdout.split('\0').filter(Boolean).map(file => file.replaceAll('\\', '/'));
}
const changed = quick ? [...new Set([...gitFiles(['diff', '--name-only', '-z', 'HEAD']), ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z'])])] : [];
const catalogue = quick ? [...new Set(gitFiles(['ls-files', '--cached', '--others', '--exclude-standard', '-z', 'apps/api/tests', 'apps/admin/tests', 'apps/shop/tests']))].filter(file => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) : [];
function sharedConsumers() {
  if (!changed.some(file => file.startsWith('packages/shared/'))) return [];
  const consumers = new Set();
  for (const file of gitFiles(['ls-files', '--cached', '--others', '--exclude-standard', '-z', 'apps/api', 'apps/admin', 'apps/shop'])) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || !existsSync(resolve(file))) continue;
    if (/(?:@jiffoo\/shared|@shared\/|['"]shared(?:\/|['"]))/m.test(readFileSync(file, 'utf8'))) consumers.add(file.split('/')[1]);
  }
  return [...consumers];
}
const plannedSuites = mandatorySuites(changed, selection.scopes, catalogue, sharedConsumers());
// The shard mode runs the whole API catalogue and the whole Admin and Shop suites, so the
// planner's mandatory suites are covered by those runs and nothing is added to a selection.
const added = shardMode ? [] : plannedSuites.filter(({ file }) => {
  const [, app, ...parts] = file.split('/');
  return !selectedFiles[app].includes(parts.join('/'));
});
for (const { file, reason } of added) {
  const [, app, ...parts] = file.split('/');
  selectedFiles[app].push(parts.join('/'));
  console.log(`Mandatory suite added: ${file} (${reason})`);
}
if (shardMode) console.log(`Shard mode covers ${plannedSuites.length} planner-mandated suite(s) through the full API, Admin and Shop runs.`);
const requirements = quickRequirements(selection);
const scoped = !shardMode && quick && (selection.scopes.length || selectedFiles.scripts.length || added.length);
const needsDatabase = !scoped || requirements.database;
const pnpmExecPath = process.env.npm_execpath;
const pnpm = process.platform === 'win32' && pnpmExecPath ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const pnpmPrefix = process.platform === 'win32' && pnpmExecPath ? [pnpmExecPath] : [];
const summaryPath = resolve('verify-summary.txt');
writeFileSync(summaryPath, '', 'utf8');
const apiDirectory = resolve('apps/api');
const apiRequire = createRequire(join(apiDirectory, 'package.json'));
const prismaClientDirectory = join(dirname(dirname(dirname(apiRequire.resolve('@prisma/client/package.json')))), '.prisma', 'client');
const prismaClientEntry = join(prismaClientDirectory, 'default.js');
const prismaFingerprintPath = join(prismaClientDirectory, '.jiffoo-prisma-fingerprint');
const testDefaults = {
  CI: 'true',
  NODE_ENV: 'test',
  REDIS_URL: `redis://localhost:6379/${config.apiRedisDb}`,
  JWT_SECRET: 'ci-test-secret',
  PLUGIN_SECRETS_KEY: Buffer.alloc(32, 17).toString('base64'),
};

if (needsDatabase && !databaseUrl) {
  console.error(`DATABASE_URL_TEST is required. Set it to ${config.databaseName} before verifying.`);
  process.exit(1);
}

let databaseName = config.databaseName;
try {
  if (needsDatabase) validateDatabaseUrl(databaseUrl, config);
} catch (error) {
  console.error(`DATABASE_URL_TEST guard failed: ${error.message}`);
  process.exit(1);
}

console.log(`DATABASE_URL_TEST database: ${databaseName}`);
if (group && databaseName !== 'jiffoo_core_test') {
  console.error('GUARD failed: DATABASE_URL_TEST must target exactly jiffoo_core_test.');
  process.exit(1);
}

const childEnv = { ...process.env, DATABASE_URL: databaseUrl, DATABASE_URL_TEST: databaseUrl };
for (const [name, value] of Object.entries(testDefaults)) {
  childEnv[name] ??= value;
}
if (needsDatabase && !group) validateRedisUrl(childEnv.REDIS_URL, config);
let uploadStorage;
try {
  if (needsDatabase) {
    uploadStorage = await startUploadTestStorage();
    Object.assign(childEnv, uploadStorage.env);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}

function listSchemaFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = join(directory, entry.name);
      return entry.isDirectory() ? listSchemaFiles(entryPath) : [entryPath];
    })
    .sort((left, right) => relative(apiDirectory, left).localeCompare(relative(apiDirectory, right)));
}

function getInstalledPackageVersion(packageName) {
  const packageJson = JSON.parse(readFileSync(apiRequire.resolve(`${packageName}/package.json`), 'utf8'));
  return packageJson.version;
}

function getPrismaFingerprint() {
  const hash = createHash('sha256');
  for (const schemaFile of listSchemaFiles(join(apiDirectory, 'prisma', 'schema'))) {
    hash.update(relative(apiDirectory, schemaFile));
    hash.update('\0');
    hash.update(readFileSync(schemaFile));
    hash.update('\0');
  }
  hash.update(`prisma:${getInstalledPackageVersion('prisma')}\0`);
  hash.update(`@prisma/client:${getInstalledPackageVersion('@prisma/client')}\0`);
  return hash.digest('hex');
}

function printGenerateOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function isWindowsFileLock(output) {
  return /EPERM|EBUSY|operation not permitted|rename/i.test(output);
}

function waitForRetry() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);
}

function runPrismaGenerate() {
  const fingerprint = getPrismaFingerprint();
  if (existsSync(prismaClientEntry) && existsSync(prismaFingerprintPath) && readFileSync(prismaFingerprintPath, 'utf8').trim() === fingerprint) {
    console.log(`Prisma client up to date (fingerprint ${fingerprint.slice(0, 12)}), generate skipped`);
    return true;
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    console.log(`Prisma generate attempt ${attempt} of 3`);
    const result = spawnSync(pnpm, [...pnpmPrefix, '--filter', 'api', 'exec', 'prisma', 'generate'], {
      cwd: process.cwd(),
      env: childEnv,
      encoding: 'utf8',
    });
    printGenerateOutput(result);
    if (result.status === 0) {
      writeFileSync(prismaFingerprintPath, `${fingerprint}\n`);
      return true;
    }

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (!isWindowsFileLock(output) || attempt === 3) {
      if (process.platform === 'win32' && isWindowsFileLock(output)) {
        console.error('The Prisma engine file is locked by another process. Open Resource Monitor (resmon) > CPU > Associated Handles, search query_engine, and close the process that holds it.');
      }
      return false;
    }
    waitForRetry();
  }

  return false;
}

const stepOptions = scoped ? { ...requirements, drift: changed.some(file => file.startsWith('apps/api/prisma/')) } : undefined;
let steps = plannedSteps ?? (shardMode
  ? localShardSteps(databaseUrl, shardCount, { drift: changed.some(file => file.startsWith('apps/api/prisma/')) })
  : localSteps(databaseUrl, quick, added.length ? ['mandatory'] : selectedArgument, selectedFiles, stepOptions));
if (!shardMode && quick && !selection.explicit && added.length) {
  // Mandatory suites augment the existing default changed-API and full-Shop invocation.
  steps = selection.scopes.length
    ? localSteps(databaseUrl, true, [], { api: [], admin: [], shop: [], scripts: [] }, stepOptions)
    : localSteps(databaseUrl, true);
  if (stepOptions.drift && !steps.some(([name]) => name === 'Check Prisma migration drift')) steps.splice(4, 0, ...localSteps(databaseUrl, true, ['mandatory'], selectedFiles, stepOptions).filter(([name]) => name === 'Check Prisma migration drift'));
  steps.push(...localSteps(databaseUrl, true, ['mandatory'], selectedFiles, stepOptions).filter(([name]) => name.startsWith('Run ')));
}

function readShardSummary() {
  const path = resolve('tmp', 'lane-shards', 'summary.txt');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

// The shard summary carries the shard count, the per-shard Test Files / Tests and the coverage
// verdict. Only these parts are copied into the gate summary.
function shardSummaryLines(text) {
  const lines = String(text ?? '').replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
  const picked = [];
  for (const header of ['Shards:', 'Run scope:', 'Scope coverage:', 'Totals:', 'Test conclusion:', 'Cleanup conclusion:', 'Delivery status:']) {
    const line = lines.find(candidate => candidate.trimStart().startsWith(header));
    if (line) picked.push(line.trim());
  }
  for (const [title, keep] of [['--- File coverage ---', line => true], ['--- Shard results ---', line => line.trimStart().startsWith('|')]]) {
    const start = lines.indexOf(title);
    if (start < 0) continue;
    const body = [];
    for (const line of lines.slice(start + 1)) {
      if (line.trimStart().startsWith('--- ')) break;
      if (line.trim() && keep(line)) body.push(line.trimEnd());
    }
    picked.push(title, ...body);
  }
  return picked;
}

const results = [];
const testOutputs = [];
let fullApiFiles = [];
let apiFiles = [];
const ciDirectory = group ? process.env.RUNNER_TEMP : undefined;
if (group && !ciDirectory) throw new Error('RUNNER_TEMP is required for CI artifacts.');
for (const [name, commands] of steps) {
  console.log(`\n=== ${name} ===`);
  const startedAt = performance.now();
  let succeeded = true;

  if (name === 'Reset test database') {
    try {
      await resetTestPluginSchemas(databaseUrl);
    } catch (error) {
      console.error(error);
      results.push([name, 'FAIL', `${((performance.now() - startedAt) / 1000).toFixed(2)}s`]);
      printSummary(results, testOutputs);
      uploadStorage?.stop();
      process.exit(1);
    }
  }

  for (const args of commands) {
    if (args[0] === '__node_test__') {
      const started = new Date().toISOString();
      const result = spawnSync(process.execPath, ['--test', ...args.slice(1)], { cwd: process.cwd(), env: childEnv, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      process.stdout.write(output);
      testOutputs.push({ name, kind: 'node', output: `Node test start time: ${started}\n${output}` });
      if (result.status !== 0) { succeeded = false; break; }
      continue;
    }
    if (args[0] === '__lane_shards__') {
      const started = new Date().toISOString();
      const result = spawnSync(process.execPath, [resolve('scripts', 'verify-lane-shards.mjs'), ...args.slice(1)], {
        cwd: process.cwd(), env: childEnv, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
      });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      process.stdout.write(output);
      testOutputs.push({ name, kind: 'shards', output: `Shard run start time: ${started}\n${output}`, detail: readShardSummary() });
      if (result.status !== 0) { succeeded = false; break; }
      continue;
    }
    if (group === 'api' && name === 'Run API tests') {
      const listPath = join(ciDirectory, 'api-files.json');
      const list = spawnSync(pnpm, [...pnpmPrefix, '--filter', 'api', 'exec', 'vitest', 'list', '--filesOnly', `--json=${listPath}`], {
        cwd: process.cwd(), env: childEnv, stdio: 'inherit',
      });
      if (list.status !== 0) { succeeded = false; break; }
      fullApiFiles = JSON.parse(readFileSync(listPath, 'utf8')).map(item => relative(apiDirectory, item.file).replaceAll('\\', '/')).sort();
      args.push('--reporter=default', '--reporter=verbose', '--reporter=json', `--outputFile.json=${join(ciDirectory, 'api-results.json')}`);
    }
    if (args.join(' ') === '--filter api exec prisma generate') {
      if (!runPrismaGenerate()) {
        succeeded = false;
        break;
      }
      continue;
    }
    const capture = args.includes('vitest') || name === 'Run browser E2E';
    const result = spawnSync(pnpm, [...pnpmPrefix, ...args], {
      cwd: process.cwd(),
      env: childEnv,
      ...(capture ? { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 } : { stdio: 'inherit' }),
    });
    if (capture) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      if (process.env.VERIFY_RAW_OUTPUT_LOG) appendFileSync(process.env.VERIFY_RAW_OUTPUT_LOG, `\n=== ${name} ===\n${output}`, 'utf8');
      testOutputs.push({ name, kind: args.includes('vitest') ? 'vitest' : 'e2e', output });
      if (group === 'api' && name === 'Run API tests' && existsSync(join(ciDirectory, 'api-results.json'))) {
        apiFiles = JSON.parse(readFileSync(join(ciDirectory, 'api-results.json'), 'utf8')).testResults.map(item => relative(apiDirectory, item.name).replaceAll('\\', '/')).sort();
      }
      if (result.status !== 0) {
        process.stdout.write(output);
      } else if (args.includes('vitest') && !quick) {
        const files = new Map();
        for (const line of output.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) {
          const match = line.match(/\b(tests\/\S+?\.(?:test|spec)\.[cm]?[jt]sx?) \((\d+) tests?(?: \| \d+ skipped)?\)/);
          if (match) files.set(match[1], match[0]);
        }
        for (const file of files.values()) console.log(file);
      } else if (name === 'Run browser E2E') {
        for (const line of output.split(/\r?\n/)) {
          if (line.includes('Observed browser contexts:') || line.includes('E2E context guard:')) console.log(line);
        }
      }
    }
    if (result.status !== 0) {
      if (result.error) console.error(`${name}: ${result.error.message}`);
      succeeded = false;
      break;
    }
  }

  results.push([name, succeeded ? 'PASS' : 'FAIL', `${((performance.now() - startedAt) / 1000).toFixed(2)}s`]);
  if (!succeeded) {
    printSummary(results, testOutputs);
    uploadStorage?.stop();
    process.exit(1);
  }
}

if (!printSummary(results, testOutputs)) process.exitCode = 1;
uploadStorage?.stop();

function printSummary(summary, outputs) {
  const lines = ['=== Final test summary ==='];
  if (!group) {
    const plannerLine = shardMode
      ? `not applicable (the shard mode runs the full API catalogue and the full Admin and Shop suites, covering ${plannedSuites.length} planner-mandated suite(s))`
      : added.map(item => `${item.file} (${item.reason})`).join('; ') || 'none';
    lines.push(`Scope: ${selection.scopes.join(',') || (requirements.scriptOnly ? 'scripts' : 'default')}`, `Lane: ${config.laneId || 'integration'}`, `Database: ${needsDatabase ? databaseName : 'not used'}`, `Planner added suites: ${plannerLine}`);
    if (shardMode) {
      lines.push(`Mode: shard mode (--shards=${shardCount})`,
        'Gate note: the API suite ran in parallel shards. The Prisma generate, the type check, the Lint Shop step, the test database reset, the Admin suite and the Shop suite ran as well.',
        'Gate note: this mode is not the complete gate: the browser E2E and the serial full-suite run are not part of it.');
    }
  }
  let valid = true;
  for (const { name, kind, output, detail } of outputs) {
    lines.push(`${name}:`);
    const outputLines = output.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
    if (name === 'Run changed API tests' && outputLines.some((line) => line.includes('No test files found'))) {
      lines.push('No changed API test files');
      continue;
    }
    if (kind === 'node') {
      lines.push(...outputLines.filter(line => /^(Node test start time:|# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) |\u2139 (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) )/.test(line)));
      continue;
    }
    if (kind === 'shards') {
      const shardLines = shardSummaryLines(detail || output);
      const complete = shardLines.some(line => line.startsWith('Shards:'))
        && shardLines.some(line => line.startsWith('Coverage verdict:'))
        && shardLines.some(line => /^\|\s*\d+\s*\|/.test(line));
      if (!complete) {
        console.error(`VERIFY SUMMARY ERROR: ${name} is missing its shard count, its per-shard results or its coverage verdict.`);
        valid = false;
      }
      lines.push(...shardLines);
      continue;
    }
    const expected = kind === 'vitest'
      ? ['Start at', 'Test Files', 'Tests']
      : ['Playwright start time', 'Playwright results'];
    for (const label of expected) {
      const line = outputLines.findLast((candidate) => candidate.trimStart().startsWith(`${label} `) || candidate.trimStart().startsWith(`${label}:`));
      if (!line) {
        console.error(`VERIFY SUMMARY ERROR: ${name} is missing its "${label}" line.`);
        valid = false;
      } else if (label === 'Playwright results' && !/^Playwright results: \d+ passed, \d+ failed, \d+ skipped$/.test(line)) {
        console.error(`VERIFY SUMMARY ERROR: ${name} has no valid Playwright passed/failed/skipped counts.`);
        valid = false;
      } else {
        lines.push(line);
      }
    }
  }
  lines.push('', '| Step | Result | Duration |', '| --- | --- | --- |');
  for (const [name, result, duration] of summary) {
    lines.push(`| ${name} | ${result} | ${duration} |`);
  }
  const block = `${lines.join('\n')}\n`;
  writeFileSync(summaryPath, block, 'utf8');
  if (group) writeFileSync(join(ciDirectory, 'verify-result.json'), JSON.stringify({ group, shard, results: summary, outputs, fullApiFiles, apiFiles, valid }, null, 2));
  process.stdout.write(`\n${block}`);
  return valid;
}
