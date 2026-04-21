#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  adminToken: process.env.ADMIN_TOKEN || '',
  skipBuild: process.argv.includes('--skip-build'),
  verbose: process.argv.includes('--verbose'),
  zipName: 'modelsfind-theme-pack.zip',
  slug: 'modelsfind',
  target: 'shop',
};

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--api-url' && process.argv[i + 1]) {
    config.apiUrl = process.argv[++i];
  } else if (process.argv[i] === '--admin-token' && process.argv[i + 1]) {
    config.adminToken = process.argv[++i];
  }
}

const state = {
  zipPath: path.join(__dirname, config.zipName),
};
const manifestPath = path.join(__dirname, 'theme-pack', 'theme.json');

function log(message, level = 'info') {
  const tag = {
    info: '[INFO]',
    pass: '[PASS]',
    fail: '[FAIL]',
    step: '[STEP]',
    warn: '[WARN]',
  }[level] || '[INFO]';
  console.log(`${tag} ${message}`);
}

function debug(message) {
  if (config.verbose) {
    console.log(`[DEBUG] ${message}`);
  }
}

function requireToken() {
  if (!config.adminToken) {
    throw new Error('ADMIN_TOKEN is required. Set env ADMIN_TOKEN or pass --admin-token <token>.');
  }
}

async function apiRequest(method, endpoint, body = null) {
  const url = `${config.apiUrl}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${config.adminToken}`,
  };
  const options = { method, headers };

  if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  debug(`${method} ${url}`);
  const response = await fetch(url, options);
  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  debug(`Response ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { ok: response.ok, status: response.status, data };
}

async function uploadZip(endpoint, filePath) {
  const url = `${config.apiUrl}${endpoint}`;
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const boundary = `----FormBoundary${Date.now()}`;
  const CRLF = '\r\n';

  const header = Buffer.from(
    `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
      `Content-Type: application/zip${CRLF}${CRLF}`
  );
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  debug(`POST ${url} (multipart)`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.adminToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  debug(`Upload response ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { ok: response.ok, status: response.status, data };
}

function stepBuildZip() {
  log('1/6 Build theme pack zip', 'step');

  if (config.skipBuild) {
    if (!fs.existsSync(state.zipPath)) {
      throw new Error(`ZIP not found: ${state.zipPath}`);
    }
    log('Using existing zip (--skip-build)', 'info');
    return;
  }

  execSync('node build-theme-pack.mjs', { cwd: __dirname, stdio: config.verbose ? 'inherit' : 'pipe' });

  if (!fs.existsSync(state.zipPath)) {
    throw new Error(`ZIP was not created: ${state.zipPath}`);
  }

  const sizeMb = fs.statSync(state.zipPath).size / 1024 / 1024;
  log(`ZIP ready (${sizeMb.toFixed(2)} MB)`, 'pass');
}

async function stepInstall() {
  log('2/6 Upload and install theme-shop zip', 'step');
  const result = await uploadZip('/api/extensions/theme-shop/install', state.zipPath);
  if (!result.ok) {
    throw new Error(`Install failed: ${result.status} ${JSON.stringify(result.data)}`);
  }
  log(`Installed: ${result.data?.data?.slug || config.slug}`, 'pass');
}

async function stepListInstalled() {
  log('3/6 Verify installed list contains theme', 'step');
  const result = await apiRequest('GET', '/api/extensions/theme-shop');
  if (!result.ok) {
    throw new Error(`List failed: ${result.status} ${JSON.stringify(result.data)}`);
  }

  const items = result.data?.data?.items || [];
  const found = items.find((t) => t.slug === config.slug);
  if (!found) {
    throw new Error(`Theme ${config.slug} not found in installed list`);
  }

  log('Theme appears in extension list', 'pass');
}

async function stepActivate() {
  log('4/6 Activate theme for shop target', 'step');
  const result = await apiRequest('POST', `/api/admin/themes/${config.target}/${config.slug}/activate`, { type: 'pack' });
  if (!result.ok) {
    throw new Error(`Activate failed: ${result.status} ${JSON.stringify(result.data)}`);
  }
  log('Theme activated', 'pass');
}

async function stepVerifyActive() {
  log('5/6 Verify admin active theme', 'step');
  const adminActive = await apiRequest('GET', `/api/admin/themes/${config.target}/active`);
  if (!adminActive.ok) {
    throw new Error(`Admin active check failed: ${adminActive.status} ${JSON.stringify(adminActive.data)}`);
  }

  const active = adminActive.data?.data;
  if (!active || active.slug !== config.slug) {
    throw new Error(`Unexpected active theme: ${JSON.stringify(active)}`);
  }

  log('Admin active theme is correct', 'pass');

  log('6/6 Verify public active theme endpoint', 'step');
  const publicActive = await apiRequest('GET', '/api/themes/active?target=shop');
  if (!publicActive.ok) {
    throw new Error(`Public active check failed: ${publicActive.status} ${JSON.stringify(publicActive.data)}`);
  }
  log('Public active endpoint responds', 'pass');
}

async function main() {
  requireToken();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  stepBuildZip();
  await stepInstall();
  await stepListInstalled();
  await stepActivate();
  await stepVerifyActive();

  log('Theme pack ZIP installation integration is ready.', 'pass');
  log(`Admin should now see ${manifest.slug}@${manifest.version} as the active installed pack.`, 'info');
}

main().catch((error) => {
  log(error instanceof Error ? error.message : String(error), 'fail');
  process.exit(1);
});
