import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const databaseUrl = process.env.DATABASE_URL_TEST;
let databaseName;
try {
  databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
} catch {
  console.error('DATABASE_URL_TEST must be a valid PostgreSQL URL targeting jiffoo_core_test.');
  process.exit(1);
}
if (databaseName !== 'jiffoo_core_test') {
  console.error('DATABASE_URL_TEST must target exactly jiffoo_core_test.');
  process.exit(1);
}

const root = process.cwd();
const resultsDir = resolve(root, 'e2e/test-results');
mkdirSync(resultsDir, { recursive: true });
const pnpm = process.platform === 'win32' && process.env.npm_execpath ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const prefix = process.platform === 'win32' && process.env.npm_execpath ? [process.env.npm_execpath] : [];
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_TEST: databaseUrl,
  NODE_ENV: 'production',
  REDIS_URL: 'redis://localhost:6379/14',
  DISABLE_RATE_LIMITER: 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'e2e-local-secret',
  API_HOST: '127.0.0.1',
  API_PORT: '3001',
  API_SERVICE_URL: 'http://127.0.0.1:3001',
  NEXT_PUBLIC_API_URL: '/api/v1',
  ADMIN_URL: 'http://127.0.0.1:3002',
  STOREFRONT_URL: 'http://127.0.0.1:3003',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  JIFFOO_DEMO_MODE: 'false',
};
const results = [];
const children = [];
const logs = [];

function step(name, fn) {
  console.log(`\n=== ${name} ===`);
  const begin = performance.now();
  return Promise.resolve().then(fn).then(() => {
    results.push([name, 'PASS', `${((performance.now() - begin) / 1000).toFixed(2)}s`]);
  }, (error) => {
    results.push([name, 'FAIL', `${((performance.now() - begin) / 1000).toFixed(2)}s`]);
    throw error;
  });
}

function command(args, cwd = root, extraEnv = {}) {
  const result = spawnSync(pnpm, [...prefix, ...args], { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`pnpm ${args.join(' ')} exited with ${result.status ?? result.error?.message}`);
}

function asyncCommand(args) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(pnpm, [...prefix, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolveCommand();
      else reject(new Error(`pnpm ${args.join(' ')} exited with ${code}`));
    });
  });
}

function service(name, args, cwd, extraEnv = {}) {
  const log = createWriteStream(resolve(resultsDir, `${name}.log`), { flags: 'w' });
  logs.push(log);
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.push(child);
  const capture = (chunk) => {
    log.write(chunk);
    process.stdout.write(`[${name}] ${chunk}`);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  console.log(`${name} PID ${child.pid}`);
}

async function health() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (children.some((child) => child.exitCode !== null)) throw new Error('A service exited before health checks completed');
    try {
      const [api, admin] = await Promise.all([
        fetch('http://127.0.0.1:3001/health/live'),
        fetch('http://127.0.0.1:3002/en/auth/login'),
      ]);
      if (api.ok && admin.ok) return;
    } catch {
      // Services are still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API or Admin did not become healthy within 60 seconds');
}

async function stop() {
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  for (const log of logs) await new Promise((resolve) => log.end(resolve));
}

try {
  await step('Reset test database', () => command(['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']));
  await step('Build shared package', () => command(['--filter', 'shared', 'build']));
  await step('Build API', () => command(['--filter', 'api', 'build']));
  await step('Build Admin', () => command(['--filter', 'admin', 'build']));
  await step('Start API, worker and Admin', () => {
    service('api', ['dist/server.js'], resolve(root, 'apps/api'), { WORKER_MODE: 'off', ENABLE_OUTBOX_WORKER: 'false' });
    service('worker', ['dist/worker.js'], resolve(root, 'apps/api'), { WORKER_MODE: 'standalone' });
    service('admin', [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', '3002', '-H', '127.0.0.1'], resolve(root, 'apps/admin'));
  });
  await step('Wait for health', health);
  console.log(`Playwright start time: ${new Date().toISOString()}`);
  await step('Run Playwright', () => asyncCommand(['exec', 'playwright', 'test', '--config=e2e/playwright.config.ts']));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await step('Stop E2E child processes', stop);
  try {
    const report = JSON.parse(readFileSync(resolve(resultsDir, 'playwright-report.json'), 'utf8'));
    const counts = report.stats;
    console.log(`Playwright results: ${counts.expected} passed, ${counts.unexpected} failed, ${counts.skipped} skipped`);
  } catch {
    console.log('Playwright results: unavailable (test runner did not produce a report)');
  }
  console.log('\n| Step | Result | Duration |');
  console.log('| --- | --- | --- |');
  for (const [name, result, duration] of results) console.log(`| ${name} | ${result} | ${duration} |`);
  console.log(`Total duration: ${((performance.now() - started) / 1000).toFixed(2)}s`);
}
