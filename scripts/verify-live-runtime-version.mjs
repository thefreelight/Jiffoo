#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/verify-live-runtime-version.mjs --base-url https://api.example.com --target-version v1.0.37-opensource

Options:
  --base-url        Live API origin to verify.
  --target-version  Expected runtime version. Accepts 1.0.37 or v1.0.37-opensource.
  --health-path     Health path, default: /health.
  --ready-path      Readiness path, default: /health/ready.
  --timeout-ms      Request timeout, default: ${DEFAULT_TIMEOUT_MS}.
  --skip-ready      Skip readiness probe.

Checks:
  - /health/ready is reachable unless --skip-ready is set.
  - /health returns JSON with version matching the target APP_VERSION.
  - /health returns package_version matching the target package/runtime version.
`);
}

function fail(message) {
  throw new Error(message);
}

function normalizeVersion(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = value.trim().replace(/^v/, '').replace(/-opensource$/, '');
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized) ? normalized : null;
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== 'string') {
    fail('Missing --base-url.');
  }

  const parsed = new URL(value);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function normalizePath(value) {
  if (!value || typeof value !== 'string') {
    return '/';
  }
  return value.startsWith('/') ? value : `/${value}`;
}

function buildUrl(baseUrl, pathname) {
  return new URL(normalizePath(pathname), `${baseUrl}/`).toString();
}

async function fetchJson(url, label, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      fail(`${label} ${url} did not return JSON: ${text.slice(0, 300)}`);
    }
    if (!response.ok) {
      fail(`${label} ${url} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function assertVersionField(payload, field, expectedVersion, label) {
  const value = payload?.[field];
  const normalized = normalizeVersion(value);
  if (!normalized) {
    fail(`${label} is missing a valid ${field}.`);
  }
  if (normalized !== expectedVersion) {
    fail(`${label} ${field} mismatch: expected ${expectedVersion}, found ${value}.`);
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(args['base-url'] || process.env.JIFFOO_LIVE_API_URL || process.env.JIFFOO_RELEASE_LIVE_API_URL);
  const expectedVersion = normalizeVersion(args['target-version']);
  if (!expectedVersion) {
    fail(`Missing or invalid --target-version: ${args['target-version'] || '<missing>'}`);
  }

  const timeoutMs = Number(args['timeout-ms'] || process.env.JIFFOO_LIVE_RUNTIME_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    fail(`Invalid --timeout-ms: ${args['timeout-ms']}`);
  }

  const healthUrl = buildUrl(baseUrl, args['health-path'] || '/health');
  const readyUrl = buildUrl(baseUrl, args['ready-path'] || '/health/ready');

  if (args['skip-ready'] !== 'true') {
    await fetchJson(readyUrl, 'Readiness probe', timeoutMs);
  }

  const health = await fetchJson(healthUrl, 'Health endpoint', timeoutMs);
  const appVersion = assertVersionField(health, 'version', expectedVersion, 'Health endpoint');
  const packageVersion = assertVersionField(health, 'package_version', expectedVersion, 'Health endpoint');

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    healthUrl,
    readyUrl: args['skip-ready'] === 'true' ? null : readyUrl,
    expectedVersion,
    appVersion,
    packageVersion,
    gitSha: health.git_sha || null,
    buildTime: health.build_time || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
