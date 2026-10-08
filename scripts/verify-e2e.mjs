import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { testRoot } from '../apps/api/tests/fixtures/plugin-signing-keys.ts';
import { startUploadTestStorage } from './upload-test-storage.mjs';
import { resetTestPluginSchemas } from './reset-test-plugin-schemas.mjs';
import { apiBuildStep } from './verify-steps.mjs';

const started = performance.now();
const visual = process.argv.includes('--visual');
const compare = process.argv.includes('--compare');
const review = visual && process.env.VISUAL_CAPTURE_SET === 'review';
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
  EXTENSION_MARKETPLACE_URL: 'http://127.0.0.1:3010/catalog',
  EXTENSION_TEST_SIGNING_MODE: 'true',
  JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY: testRoot.publicKey,
  REDIS_URL: 'redis://localhost:6379/14',
  DISABLE_RATE_LIMITER: 'false',
  RATE_LIMITER_FAIL_CLOSED: 'true',
  JWT_SECRET: 'e2e-local-secret-at-least-32-characters',
  PLUGIN_SECRETS_KEY: Buffer.alloc(32, 17).toString('base64'),
  API_HOST: '127.0.0.1',
  API_PORT: '3001',
  WORKER_HEALTH_PORT: '3004',
  TRUSTED_PROXIES: '127.0.0.1,::1',
  API_SERVICE_URL: 'http://127.0.0.1:3001',
  NEXT_PUBLIC_API_URL: '/api/v1',
  ADMIN_URL: 'http://127.0.0.1:3002',
  STOREFRONT_URL: 'http://127.0.0.1:3003',
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  VISUAL_SET: visual ? (process.env.VISUAL_CAPTURE_SET || (compare ? 'current' : 'baseline')) : '',
  E2E_RELOAD_STRESS: process.env.E2E_RELOAD_STRESS || '',
};
if (visual) {
  if (!['baseline', 'current', 'noise-1', 'noise-2', 'review'].includes(env.VISUAL_SET)) {
    throw new Error('Invalid VISUAL_CAPTURE_SET');
  }
  mkdirSync(resolve(root, 'e2e/visual-results', env.VISUAL_SET), { recursive: true });
}
const results = [];
let uploadStorage;
const children = [];
const logs = [];
const providerStubMarker = readFileSync(resolve(root, 'e2e/provider-stubs/marker.js'), 'utf8');
const providerLibraryOverrides = JSON.stringify(Object.fromEntries(['ga4', 'meta', 'baidu'].map((provider) => [
  provider, `data:text/javascript,${encodeURIComponent(
    providerStubMarker + readFileSync(resolve(root, `e2e/provider-stubs/${provider}.js`), 'utf8'),
  )}`,
])));
const playwrightCounts = { expected: 0, unexpected: 0, skipped: 0 };
const playwrightGroups = [
  ['01-install', '02-login', '03-password', '04-language', '05-settings', '06-health-plugins', '07-products', '08-orders', '09-customers'],
  ['10-staff', '11-forgot-password', '12-translations', '13-shop', '14-shop-registration', '15-shop-account', '16-shop-checkout-price-stock', '17-shop-order-history-cancel', '18-order-refund', '19-themes', '20-admin-theme', '21-shop-page-boundaries', '22-shop-payment-csp'],
];
if (visual && !review) {
  const finalProjects = playwrightGroups[1].splice(playwrightGroups[1].indexOf('20-admin-theme'));
  playwrightGroups.push(['visual']);
  playwrightGroups.push(finalProjects);
}
// Merchant code is configured only after every other storefront/visual project has finished.
playwrightGroups.push(['23-shop-storefront-code']);
playwrightGroups.push(['24-admin-storefront-code']);
playwrightGroups.push(['25-shop-provider-code']);
playwrightGroups.push(['26-shop-purchase-tracking']);
playwrightGroups.push(['27-admin-audit-events']);
playwrightGroups.push(['28-disabled-payment-plugin']);
playwrightGroups.push(['29-plugin-config']);
playwrightGroups.push(['30-marketplace']);
playwrightGroups.push(['31-plugin-upload']);
playwrightGroups.push(['32-plugin-removal']);
playwrightGroups.push(['33-plugin-recorded-error']);
playwrightGroups.push(['34-shop-reload']);
playwrightGroups.push(['35-extension-center']);
playwrightGroups.push(['37-uploaded-storage']);
// Quota exhaustion runs alone and last; project boundaries clean only protection keys in test DB 14.
playwrightGroups.push(['36-shop-availability']);

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
  const logPath = resolve(resultsDir, `${name}.log`);
  if (existsSync(logPath)) {
    renameSync(logPath, resolve(resultsDir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`));
  }
  const log = createWriteStream(logPath, { flags: 'w' });
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

function apiService(name, script) {
  const cwd = resolve(root, 'apps/api');
  const command = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')).scripts[script];
  if (typeof command !== 'string' || !command.startsWith('node ')) {
    throw new Error(`API script ${script} must launch node directly`);
  }
  service(name, command.slice(5).split(' '), cwd);
}

async function health() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (children.some((child) => child.exitCode !== null)) throw new Error('A service exited before health checks completed');
    try {
      const api = await fetch('http://127.0.0.1:3001/health/live');
      if (!api.ok) throw new Error('API is not ready');
      const [admin, shop] = await Promise.all([
        fetch('http://127.0.0.1:3002/en/auth/login'),
        fetch('http://127.0.0.1:3003/'),
      ]);
      if (admin.ok && shop.ok) return;
    } catch {
      // Services are still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API, Admin or Shop did not become healthy within 60 seconds');
}

async function marketplaceHealth() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (children.some((child) => child.exitCode !== null)) throw new Error('Marketplace exited before health checks completed');
    try {
      if ((await fetch('http://127.0.0.1:3010/health')).ok) return;
    } catch {
      // Package generation is still running.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local marketplace did not become healthy within 60 seconds');
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

async function resetE2eLoginLimit(resetRegistration = false) {
  if (new URL(env.REDIS_URL).pathname !== '/14')
    throw new Error('Refusing to clear limits outside the dedicated E2E Redis DB 14');
  const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
  const { createClient } = apiRequire('redis');
  const client = createClient({ url: env.REDIS_URL });
  await client.connect();
  try {
    await client.del('jiffoo:protection:rl:/api/v1/auth/login:ip:127.0.0.1');
    if (resetRegistration) await client.del('jiffoo:protection:rl:/api/v1/auth/register:ip:127.0.0.1');
    await client.del('jiffoo:protection:rl:anonymous:ip:127.0.0.1');
    await client.del('jiffoo:protection:rl:abuse:ip:127.0.0.1');
    for await (const keys of client.scanIterator({ MATCH: 'jiffoo:protection:rl:user:*' })) {
      if (keys.length) await client.del(keys);
    }
    for await (const keys of client.scanIterator({ MATCH: 'stats:admin-dashboard:*' })) {
      if (keys.length) await client.del(keys);
    }
  } finally {
    await client.quit();
  }
}

async function resetE2eRedis() {
  if (new URL(env.REDIS_URL).pathname !== '/14')
    throw new Error('Refusing to clear a Redis database other than the dedicated E2E DB 14');
  const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
  const { createClient } = apiRequire('redis');
  const client = createClient({ url: env.REDIS_URL });
  await client.connect();
  try {
    for await (const keys of client.scanIterator({ MATCH: '*' })) {
      if (keys.length) await client.del(keys);
    }
  } finally {
    await client.quit();
  }
}

async function runPlaywrightGroup(args) {
  const reportPath = resolve(resultsDir, 'playwright-report.json');
  if (existsSync(reportPath)) unlinkSync(reportPath);
  try {
    await asyncCommand(args);
  } finally {
    if (existsSync(reportPath)) {
      const { stats } = JSON.parse(readFileSync(reportPath, 'utf8'));
      for (const key of Object.keys(playwrightCounts)) playwrightCounts[key] += stats[key];
    }
  }
}

async function runPlaywrightGroups() {
  for (const [index, projects] of playwrightGroups.entries()) {
    await resetE2eLoginLimit(projects.includes('35-extension-center'));
    await runPlaywrightGroup([
      'exec', 'playwright', 'test', '--config=e2e/playwright.config.ts',
      ...(index ? ['--no-deps'] : []),
      ...projects.map((project) => `--project=${project}`),
    ]);
  }
}

try {
  await step('Preflight upload storage before database reset', async () => {
    uploadStorage = await startUploadTestStorage();
    Object.assign(env, uploadStorage.env, { UPLOAD_S3_BUCKET: `${uploadStorage.env.UPLOAD_S3_BUCKET}-e2e` });
  });
  await step('Check observed browser contexts', () => {
    for (const args of [['--test', 'scripts/check-e2e-contexts.test.mjs'], ['scripts/check-e2e-contexts.mjs']]) {
      const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`E2E context guard failed: ${result.status ?? result.error?.message}`);
    }
  });
  await step('Clear dedicated E2E Redis database', resetE2eRedis);
  await step('Reset test database', async () => {
    await resetTestPluginSchemas(databaseUrl);
    await command(['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']);
  });
  await step('Build shared package', () => command(['--filter', 'shared', 'build']));
  await step('Build plugin SDK', () => command(['--filter', 'plugin-sdk', 'build']));
  await step(apiBuildStep[0], () => command(apiBuildStep[1][0]));
  await step('Build Admin', () => command(['--filter', 'admin', 'build']));
  await step('Build Shop', () => command(['--filter', 'shop', 'build']));
  await step('Start local marketplace', async () => {
    service('marketplace', ['--import', 'tsx', 'e2e/marketplace-server.ts'], root);
    await marketplaceHealth();
  });
  await step('Start API, worker, Admin and Shop', () => {
    apiService('api', 'start');
    apiService('worker', 'start:worker');
    service('admin', [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', '3002', '-H', '127.0.0.1'], resolve(root, 'apps/admin'));
    service('shop', ['server.mjs'], resolve(root, 'apps/shop'), {
      HOSTNAME: '127.0.0.1', PORT: '3003', TRUSTED_PROXIES: '',
      STOREFRONT_PROVIDER_LIBRARY_OVERRIDES: providerLibraryOverrides,
    });
  });
  await step('Wait for health', health);
  console.log(`Playwright start time: ${new Date().toISOString()}`);
  await step('Run Playwright', runPlaywrightGroups);
  if (compare) await step('Compare visual captures', () => command(['exec', 'node', 'scripts/visual-compare.mjs']));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  if (results.some(([name, result]) => name === 'Run Playwright' && result === 'FAIL')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dump = spawnSync(process.execPath, ['scripts/dump-e2e-notifications.mjs', timestamp], {
      cwd: root, env, stdio: 'inherit',
    });
    if (dump.status !== 0) console.error(`Notification evidence dump failed: ${dump.error?.message ?? dump.status}`);
  }
} finally {
  await step('Stop E2E child processes', stop);
  uploadStorage?.stop();
  try {
    console.log(`Playwright results: ${playwrightCounts.expected} passed, ${playwrightCounts.unexpected} failed, ${playwrightCounts.skipped} skipped`);
  } catch {
    console.log('Playwright results: unavailable (test runner did not produce a report)');
  }
  console.log('\n| Step | Result | Duration |');
  console.log('| --- | --- | --- |');
  for (const [name, result, duration] of results) console.log(`| ${name} | ${result} | ${duration} |`);
  console.log(`Total duration: ${((performance.now() - started) / 1000).toFixed(2)}s`);
}
