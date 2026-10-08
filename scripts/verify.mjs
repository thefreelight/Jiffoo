import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { startUploadTestStorage } from './upload-test-storage.mjs';
import { resetTestPluginSchemas } from './reset-test-plugin-schemas.mjs';
import { localSteps, ciSteps } from './verify-steps.mjs';

const databaseUrl = process.env.DATABASE_URL_TEST;
const quick = process.argv.includes('--quick');
const selectedArgument = process.argv.slice(2).filter(value => value.startsWith('--test-files='));
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
const selectedFiles = { api: [], admin: [], shop: [] };
if (selectedArgument.length) {
  const files = selectedArgument[0].slice('--test-files='.length).split(',');
  for (const file of files) {
    const match = file.match(/^apps\/(api|admin|shop)\/(tests\/[A-Za-z0-9_./-]+\.(?:test|spec)\.[cm]?[jt]sx?)$/);
    if (!match || file.split('/').some(part => part === '.' || part === '..') || !existsSync(resolve(file))) {
      console.error(`Invalid explicit test file: ${file}`);
      process.exit(1);
    }
    selectedFiles[match[1]].push(match[2]);
  }
}
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
  REDIS_URL: 'redis://localhost:6379/15',
  JWT_SECRET: 'ci-test-secret',
  PLUGIN_SECRETS_KEY: Buffer.alloc(32, 17).toString('base64'),
};

if (!databaseUrl) {
  console.error('DATABASE_URL_TEST is required. Set it to the jiffoo_core_test database before verifying.');
  process.exit(1);
}

let databaseName;
try {
  const url = new URL(databaseUrl);
  databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
} catch {
  console.error('DATABASE_URL_TEST must be a valid PostgreSQL connection URL.');
  process.exit(1);
}

console.log(`DATABASE_URL_TEST database: ${databaseName}`);
if (databaseName !== 'jiffoo_core_test') {
  console.error('GUARD failed: DATABASE_URL_TEST must target exactly jiffoo_core_test.');
  process.exit(1);
}

const childEnv = { ...process.env, DATABASE_URL: databaseUrl, DATABASE_URL_TEST: databaseUrl };
for (const [name, value] of Object.entries(testDefaults)) {
  childEnv[name] ??= value;
}
let uploadStorage;
try {
  uploadStorage = await startUploadTestStorage();
  Object.assign(childEnv, uploadStorage.env);
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

const steps = plannedSteps ?? localSteps(databaseUrl, quick, selectedArgument, selectedFiles);

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
      uploadStorage.stop();
      process.exit(1);
    }
  }

  for (const args of commands) {
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
    uploadStorage.stop();
    process.exit(1);
  }
}

if (!printSummary(results, testOutputs)) process.exitCode = 1;
uploadStorage.stop();

function printSummary(summary, outputs) {
  const lines = ['=== Final test summary ==='];
  let valid = true;
  for (const { name, kind, output } of outputs) {
    lines.push(`${name}:`);
    const outputLines = output.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
    if (name === 'Run changed API tests' && outputLines.some((line) => line.includes('No test files found'))) {
      lines.push('No changed API test files');
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
