import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { testRoot } from '../apps/api/tests/fixtures/plugin-signing-keys.ts';
import { startUploadTestStorage } from './upload-test-storage.mjs';
import { resetTestPluginSchemas } from './reset-test-plugin-schemas.mjs';
import { apiBuildStep } from './verify-steps.mjs';
import { laneConfig, assertIntegrationE2e, validateDatabaseUrl, validateRedisUrl } from './lane-config.mjs';

// Escapes that keep their own meaning: character classes, anchors, quantifiers
// and the numeric and control escapes are copied verbatim by the case expansion
// of a filter pattern.
const verbatimEscapes = new Set(['d', 'D', 'w', 'W', 's', 'S', 'b', 'B', 'n', 'N', 'r', 'R', 't', 'T', 'f', 'F', 'v', 'V', 'c', 'C', 'x', 'X', 'u', '0']);

const started = performance.now();
const visual = process.argv.includes('--visual');
const compare = process.argv.includes('--compare');
const review = visual && process.env.VISUAL_CAPTURE_SET === 'review';
const databaseUrl = process.env.DATABASE_URL_TEST;

// --- Filtered runs ---------------------------------------------------------
// A filtered run names one Playwright area. The area selects the target groups,
// and the groups before the last target are the chain: their cases build the
// fixtures in the database that the target needs, so the chain runs completely.
// The title filter narrows the target group only. The pattern keeps Playwright's
// own --grep semantics: a /pattern/flags literal keeps its flags, a plain pattern
// is matched case-insensitively.
// The extension-center project must also keep its login-budget partition, so the
// partition pattern and the user pattern are combined into a single expression
// that requires both. The partition has to stay case-sensitive (its letter range
// is the only thing that separates the two budgets, and folding the case would
// let one budget select the other budget's cases), so the user pattern is
// expanded into an explicitly case-agnostic form instead of relying on the
// case-insensitive flag that the combined expression cannot carry.
let grepArgument;
let areaArgument;
try {
  grepArgument = readFilterArgument(process.argv, '--grep');
  areaArgument = readFilterArgument(process.argv, '--area');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (grepArgument !== undefined && areaArgument === undefined) {
  console.error('--grep needs --area: a title filter needs the area whose cases it narrows.');
  process.exit(1);
}
const areaNeedle = areaArgument === undefined ? null : areaArgument.toLowerCase();
const filtered = areaArgument !== undefined;
if (filtered && (visual || compare)) {
  console.error('--grep and --area cannot be combined with --visual or --compare: the visual capture modes run the whole catalogue and cannot be filtered.');
  process.exit(1);
}
let filterSource = null;
if (grepArgument !== undefined) {
  try {
    filterSource = buildFilterSource(grepArgument);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
assertIntegrationE2e();
const config = laneConfig();
try {
  validateDatabaseUrl(databaseUrl, config);
} catch (error) {
  console.error(`DATABASE_URL_TEST guard failed: ${error.message}`);
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
  REDIS_URL: `redis://localhost:6379/${config.e2eRedisDb}`,
  DISABLE_RATE_LIMITER: 'false',
  RATE_LIMITER_FAIL_CLOSED: 'true',
  JWT_SECRET: 'e2e-local-secret-at-least-32-characters',
  PLUGIN_SECRETS_KEY: Buffer.alloc(32, 17).toString('base64'),
  PLUGIN_PAGE_TOKEN_SECRET: Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString('base64'),
  PLUGIN_FILE_URL_SECRET: Buffer.from(Array.from({ length: 32 }, (_, index) => index + 65)).toString('base64'),
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
let playwrightStarted;
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
// The extension-center project is split into ordered login budgets. The patterns
// are the regular expressions of the two partitions, the runner passes them to
// Playwright as /pattern/ literals.
const extensionCenterPartitions = ['\\b[A-C] ', '\\b[D-F] '];
// Login-heavy projects are split so each group stays within the login rate limit.
const playwrightGroups = [
  ['01-install'],
  // This project intentionally exhausts its isolated login budget.
  ['02-login'],
  ['03-password', '04-language'],
  ['05-settings', '06-health-plugins', '07-products'],
  ['08-orders', '09-customers'],
  ['10-staff', '11-forgot-password', '12-translations', '13-shop', '14-shop-registration', '15-shop-account'],
  ['16-shop-checkout-price-stock', '17-shop-order-history-cancel', '18-order-refund'],
  ['19-themes'],
  ['20-admin-theme'],
  ['21-shop-page-boundaries', '22-shop-payment-csp'],
];
if (visual && !review) {
  const themeGroup = playwrightGroups.find(group => group.includes('20-admin-theme'));
  const finalProjects = themeGroup.splice(themeGroup.indexOf('20-admin-theme'));
  if (!themeGroup.length) playwrightGroups.splice(playwrightGroups.indexOf(themeGroup), 1);
  playwrightGroups.push(['visual']);
  playwrightGroups.push(finalProjects);
}
// A separate group uses the runner's existing login-limit reset for the new shell flow.
playwrightGroups.push(['38-admin-shell']);
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
playwrightGroups.push(['39-plugin-page-assets']);
playwrightGroups.push(['40-plugin-page-shells']);
// Quota exhaustion runs alone and last; project boundaries clean only protection keys in test DB 14.
playwrightGroups.push(['36-shop-availability']);
if (process.env.E2E_RELOAD_STRESS === '1') playwrightGroups.splice(0, playwrightGroups.length, ['34-shop-reload']);
// The area names the target groups. Every group before the last target is the
// chain: its cases build the fixtures in the database that the target needs, so
// the chain runs completely and without the title filter. The groups after the
// last target are skipped, that is where the time is saved. A group is kept or
// skipped as a whole, so the login budget partitions of a kept group stay
// intact and in their order.
const areaTargetIndexes = areaNeedle === null
  ? []
  : playwrightGroups
      .map((projects, index) => ({ projects, index }))
      .filter(({ projects }) => projects.some((project) => project.toLowerCase().includes(areaNeedle)))
      .map(({ index }) => index);
const lastTargetIndex = areaTargetIndexes.length ? areaTargetIndexes[areaTargetIndexes.length - 1] : -1;
const runPlan = areaNeedle === null
  ? playwrightGroups.map((projects, index) => ({ projects, index, target: false }))
  : playwrightGroups
      .map((projects, index) => ({ projects, index, target: areaTargetIndexes.includes(index) }))
      .filter(({ index, target }) => target || index < lastTargetIndex);
const targetAreas = [...new Set(runPlan.filter((entry) => entry.target).flatMap((entry) => entry.projects))];
const chainAreas = [...new Set(runPlan.filter((entry) => !entry.target).flatMap((entry) => entry.projects))];
const plannedAreas = new Set(runPlan.flatMap((entry) => entry.projects));
const skippedAreas = [...new Set(playwrightGroups.flat())].filter((area) => !plannedAreas.has(area));

// --- Filtered run helpers --------------------------------------------------
function readFilterArgument(argv, flag) {
  let value;
  for (const argument of argv) {
    if (argument === flag) throw new Error(`${flag} needs a value, use ${flag}=<value>`);
    if (argument.startsWith(`${flag}=`)) {
      if (value !== undefined) throw new Error(`${flag} may only be given once`);
      value = argument.slice(flag.length + 1);
    }
  }
  if (value !== undefined && value.trim() === '') throw new Error(`${flag} needs a non-empty value`);
  return value;
}

// The literal form keeps the flags it carries, a plain pattern is matched
// case-insensitively. This mirrors the way Playwright parses its own --grep.
function buildFilterSource(pattern) {
  const literal = pattern.match(/^\/(.*)\/([gi]*)$/);
  const source = literal ? literal[1] : pattern;
  const flags = literal ? literal[2] : 'gi';
  if (/[\r\n]/.test(source)) throw new Error('--grep pattern must not contain a line break');
  try {
    new RegExp(source, flags);
  } catch (error) {
    throw new Error(`--grep pattern "${pattern}" is not a valid regular expression: ${error.message}`);
  }
  const expanded = flags.includes('i') ? expandCaseInsensitive(source) : source;
  try {
    new RegExp(expanded);
  } catch (error) {
    throw new Error(`--grep pattern "${pattern}" could not be expanded into a filter: ${error.message}`);
  }
  return expanded;
}

// The partition pattern and the user pattern have to hold at the same time, so
// both become lookaheads of one expression: the partition has to be found in the
// title and the user pattern has to be found in the title.
function combinePartitionAndFilter(partitionSource, filterSource) {
  return `/(?=.*(?:${partitionSource}))(?=.*(?:${filterSource}))/`;
}

function isAsciiLetter(character) {
  return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
}

function isHexDigit(character) {
  return (character >= '0' && character <= '9') || (character >= 'a' && character <= 'f') || (character >= 'A' && character <= 'F');
}

function swapCase(letter) {
  return letter === letter.toUpperCase() ? letter.toLowerCase() : letter.toUpperCase();
}

// The description of the filters of this run, empty for an unfiltered run.
function filterDescription() {
  const parts = [];
  if (areaArgument !== undefined) parts.push(`area ${areaArgument}`);
  if (grepArgument !== undefined) parts.push(`grep ${grepArgument}`);
  return parts.join(' and ');
}

// The target areas, the chain that replays their fixtures and the skipped areas.
function filterSummaryLines() {
  if (!filtered) return '';
  const lines = [`E2E area: ${areaArgument}`];
  if (grepArgument !== undefined) lines.push(`E2E title filter: ${grepArgument}`);
  lines.push(`E2E target areas: ${targetAreas.join(', ')}`);
  lines.push(`E2E fixture chain: ${chainAreas.join(', ') || 'none'}`);
  lines.push(`E2E skipped areas: ${skippedAreas.join(', ') || 'none'}`);
  return `${lines.join('\n')}\n`;
}

function playwrightResultsLine() {
  const base = `Playwright results: ${playwrightCounts.expected} passed, ${playwrightCounts.unexpected} failed, ${playwrightCounts.skipped} skipped`;
  if (!filtered) return base;
  return `${base} (filtered by ${filterDescription()}; this run is NOT the certifying E2E gate)`;
}

// Copies one escape sequence. An escape of a plain letter is an identity escape
// that matches that letter, so it becomes a class that matches both cases.
function copyEscape(source, index) {
  const next = source[index + 1];
  if (next === undefined) return { text: '\\', length: 1 };
  if (next === 'u' || next === 'x') {
    // A unicode or hexadecimal escape of a letter matches both cases as well.
    const width = next === 'u' ? 4 : 2;
    let end = index + 2;
    while (end < source.length && end < index + 2 + width && isHexDigit(source[end])) end += 1;
    const digits = source.slice(index + 2, end);
    if (digits.length === width) {
      const character = String.fromCharCode(parseInt(digits, 16));
      if (isAsciiLetter(character)) return { text: `[${character}${swapCase(character)}]`, length: end - index };
    }
    return { text: source.slice(index, end), length: end - index };
  }
  if (next === 'c') {
    const end = Math.min(source.length, index + 3);
    return { text: source.slice(index, end), length: end - index };
  }
  if (next === 'k' && source[index + 2] === '<') {
    const close = source.indexOf('>', index + 3);
    const end = close === -1 ? index + 2 : close + 1;
    return { text: source.slice(index, end), length: end - index };
  }
  if (verbatimEscapes.has(next) || !isAsciiLetter(next)) {
    return { text: source.slice(index, index + 2), length: 2 };
  }
  return { text: `[${next}${swapCase(next)}]`, length: 2 };
}

// Copies one character class. Every letter of the class also matches the other
// case, and a negated class keeps excluding both cases.
function copyCharacterClass(source, index) {
  let cursor = index + 1;
  let negated = false;
  if (source[cursor] === '^') {
    negated = true;
    cursor += 1;
  }
  let body = '';
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '\\') {
      const escape = copyEscape(source, cursor);
      body += escape.text;
      cursor += escape.length;
      continue;
    }
    if (character === ']') break;
    const rangeEnd = source[cursor + 2];
    if (source[cursor + 1] === '-' && rangeEnd !== undefined && rangeEnd !== ']') {
      body += `${character}-${rangeEnd}`;
      if (isAsciiLetter(character) && isAsciiLetter(rangeEnd)) body += `${swapCase(character)}-${swapCase(rangeEnd)}`;
      cursor += 3;
      continue;
    }
    body += isAsciiLetter(character) ? `${character}${swapCase(character)}` : character;
    cursor += 1;
  }
  const end = cursor < source.length ? cursor + 1 : cursor;
  return { text: `[${negated ? '^' : ''}${body}]`, length: end - index };
}

// Rewrites a pattern so that it matches both cases without the case-insensitive
// flag. The quantifier of a letter keeps binding to it because every letter
// becomes a single character class.
function expandCaseInsensitive(source) {
  let expanded = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    // The name of a named group is not a pattern and stays as it is.
    if (character === '(' && source.startsWith('(?<', index) && source[index + 3] !== '=' && source[index + 3] !== '!') {
      const close = source.indexOf('>', index + 3);
      if (close !== -1) {
        expanded += source.slice(index, close + 1);
        index = close + 1;
        continue;
      }
    }
    if (character === '\\') {
      const escape = copyEscape(source, index);
      expanded += escape.text;
      index += escape.length;
      continue;
    }
    if (character === '[') {
      const characterClass = copyCharacterClass(source, index);
      expanded += characterClass.text;
      index += characterClass.length;
      continue;
    }
    if (isAsciiLetter(character)) {
      expanded += `[${character}${swapCase(character)}]`;
      index += 1;
      continue;
    }
    expanded += character;
    index += 1;
  }
  return expanded;
}

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
  validateRedisUrl(env.REDIS_URL, undefined, true);
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
  validateRedisUrl(env.REDIS_URL, undefined, true);
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
  for (const { projects, index, target } of runPlan) {
    // Partition the six extension-center cases into ordered login budgets.
    const partitions = projects.includes('35-extension-center') ? extensionCenterPartitions : [null];
    for (const partition of partitions) {
      await resetE2eLoginLimit(projects.includes('35-extension-center'));
      // The title filter narrows the target group only. The chain runs its cases
      // completely, they build the fixtures of the target. The extension-center
      // group keeps its partition and adds the user pattern to the same
      // expression, so both hold at the same time and the budgets stay ordered.
      const grep = filterSource === null
        ? (partition === null ? null : `/${partition}/`)
        : (target
            ? (partition === null ? `/${filterSource}/` : combinePartitionAndFilter(partition, filterSource))
            : (partition === null ? null : `/${partition}/`));
      await runPlaywrightGroup([
        'exec', 'playwright', 'test', '--config=e2e/playwright.config.ts',
        ...(index || env.E2E_RELOAD_STRESS === '1' ? ['--no-deps'] : []),
        ...projects.map((project) => `--project=${project}`),
        ...(grep ? ['--grep', grep] : []),
      ]);
    }
  }
}

if (filtered) {
  if (areaTargetIndexes.length === 0) {
    console.error(`--area "${areaArgument}" matches no Playwright project of the runner.`);
    process.exit(1);
  }
  console.log('\n=== Filtered E2E run ===');
  console.log(filterSummaryLines().trimEnd());
  console.log('The chain replays the fixtures of the target areas. This run is NOT the certifying E2E gate.');
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
  await step('Build plugin SDK', () => command(['--filter', '@jiffoo-core/plugin-sdk', 'build']));
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
  playwrightStarted = new Date().toISOString();
  console.log(`Playwright start time: ${playwrightStarted}`);
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
  if (filtered) console.log(filterSummaryLines().trimEnd());
  try {
    console.log(playwrightResultsLine());
  } catch {
    console.log('Playwright results: unavailable (test runner did not produce a report)');
  }
  console.log('\n| Step | Result | Duration |');
  console.log('| --- | --- | --- |');
  for (const [name, result, duration] of results) console.log(`| ${name} | ${result} | ${duration} |`);
  console.log(`Total duration: ${((performance.now() - started) / 1000).toFixed(2)}s`);
  const summary = `=== Final test summary ===\nPlaywright start time: ${playwrightStarted ?? 'not started'}\n${filterSummaryLines()}${playwrightResultsLine()}\n\n| Step | Result | Duration |\n| --- | --- | --- |\n${results.map(([name, result, duration]) => `| ${name} | ${result} | ${duration} |`).join('\n')}\nTotal duration: ${((performance.now() - started) / 1000).toFixed(2)}s\n`;
  writeFileSync(resolve(root, 'verify-summary.txt'), summary);
  writeFileSync(resolve(resultsDir, 'verify-summary.txt'), summary);
}
