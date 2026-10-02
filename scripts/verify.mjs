import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

const databaseUrl = process.env.DATABASE_URL_TEST;
const quick = process.argv.includes('--quick');
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
      if (isWindowsFileLock(output)) {
        console.error('The Prisma engine file is locked by another process. Open Resource Monitor (resmon) > CPU > Associated Handles, search query_engine, and close the process that holds it.');
      }
      return false;
    }
    waitForRetry();
  }

  return false;
}

const steps = quick
  ? [
      ['Prisma generate', [['--filter', 'api', 'exec', 'prisma', 'generate']]],
      ['Type-check API, Shop and shared', [['exec', 'turbo', 'run', 'type-check', '--filter=api', '--filter=shop', '--filter=shared']]],
      ['Lint Shop', [['--filter', 'shop', 'lint']]],
      ['Reset test database', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']]],
      ['Run changed API tests', [['--filter', 'api', 'exec', 'vitest', 'run', '--changed', '--passWithNoTests']]],
      ['Run Shop tests', [['--filter', 'shop', 'exec', 'vitest', 'run']]],
    ]
  : [
      ['Install dependencies', [['install', '--frozen-lockfile']]],
      ['Validate and generate Prisma client', [['--filter', 'api', 'exec', 'prisma', 'validate'], ['--filter', 'api', 'exec', 'prisma', 'generate']]],
      ['Build shared package', [['--filter', 'shared', 'build']]],
      ['Build admin application', [['--filter', 'admin', 'build']]],
      ['Build Shop application', [['--filter', 'shop', 'build']]],
      ['Build plugin SDK', [['--filter', 'plugin-sdk', 'build']]],
      ['Type-check workspace', [['exec', 'turbo', 'run', 'type-check', '--continue=always', '--force']]],
      ['Lint Shop', [['--filter', 'shop', 'lint']]],
      ['Export OpenAPI', [['--filter', 'api', 'export:openapi']]],
      ['Reset test database', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']]],
      ['Check Prisma migration drift', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'diff', '--from-url', databaseUrl, '--to-schema-datamodel', 'prisma/schema', '--exit-code']]],
      ['Run API tests', [['--filter', 'api', 'exec', 'vitest', 'run']]],
      ['Run Admin tests', [['--filter', 'admin', 'exec', 'vitest', 'run']]],
      ['Run Shop tests', [['--filter', 'shop', 'exec', 'vitest', 'run']]],
      ['Run browser E2E', [['verify:e2e']]],
    ];

const results = [];
const testOutputs = [];
for (const [name, commands] of steps) {
  console.log(`\n=== ${name} ===`);
  const startedAt = performance.now();
  let succeeded = true;

  for (const args of commands) {
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
    process.exit(1);
  }
}

if (!printSummary(results, testOutputs)) process.exitCode = 1;

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
  process.stdout.write(`\n${block}`);
  return valid;
}
