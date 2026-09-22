import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL_TEST;
const quick = process.argv.includes('--quick');
const pnpmExecPath = process.env.npm_execpath;
const pnpm = process.platform === 'win32' && pnpmExecPath ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const pnpmPrefix = process.platform === 'win32' && pnpmExecPath ? [pnpmExecPath] : [];
const testDefaults = {
  CI: 'true',
  NODE_ENV: 'test',
  REDIS_URL: 'redis://localhost:6379/15',
  JWT_SECRET: 'ci-test-secret',
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

const steps = quick
  ? [
      ['Prisma generate', [['--filter', 'api', 'exec', 'prisma', 'generate']]],
      ['Type-check API and shared', [['exec', 'turbo', 'run', 'type-check', '--filter=api', '--filter=shared']]],
      ['Reset test database', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']]],
      ['Run changed API tests', [['--filter', 'api', 'exec', 'vitest', 'run', '--changed']]],
    ]
  : [
      ['Install dependencies', [['install', '--frozen-lockfile']]],
      ['Validate and generate Prisma client', [['--filter', 'api', 'exec', 'prisma', 'validate'], ['--filter', 'api', 'exec', 'prisma', 'generate']]],
      ['Build shared package', [['--filter', 'shared', 'build']]],
      ['Build admin application', [['--filter', 'admin', 'build']]],
      ['Type-check workspace', [['exec', 'turbo', 'run', 'type-check', '--continue=always', '--force']]],
      ['Export OpenAPI', [['--filter', 'api', 'export:openapi']]],
      ['Reset test database', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']]],
      ['Check Prisma migration drift', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'diff', '--from-url', databaseUrl, '--to-schema-datamodel', 'prisma/schema', '--exit-code']]],
      ['Run API tests', [['--filter', 'api', 'exec', 'vitest', 'run']]],
    ];

const results = [];
for (const [name, commands] of steps) {
  console.log(`\n=== ${name} ===`);
  const startedAt = performance.now();
  let succeeded = true;

  for (const args of commands) {
    const result = spawnSync(pnpm, [...pnpmPrefix, ...args], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      succeeded = false;
      break;
    }
  }

  results.push([name, succeeded ? 'PASS' : 'FAIL', `${((performance.now() - startedAt) / 1000).toFixed(2)}s`]);
  if (!succeeded) {
    printSummary(results);
    process.exit(1);
  }
}

printSummary(results);

function printSummary(summary) {
  console.log('\n| Step | Result | Duration |');
  console.log('| --- | --- | --- |');
  for (const [name, result, duration] of summary) {
    console.log(`| ${name} | ${result} | ${duration} |`);
  }
}
