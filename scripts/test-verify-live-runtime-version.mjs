#!/usr/bin/env node

import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-live-runtime-version.mjs');
const TARGET_VERSION = '1.0.37';

function json(body) {
  return `${JSON.stringify(body, null, 2)}\n`;
}

async function startServer(options = {}) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/health/ready') {
      if (options.readyStatus && options.readyStatus !== 200) {
        response.writeHead(options.readyStatus, { 'content-type': 'application/json' });
        response.end(json({ status: 'not_ready' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json({
        status: 'ok',
        version: options.appVersion || TARGET_VERSION,
        ...(options.omitPackageVersion ? {} : { package_version: options.packageVersion || `${TARGET_VERSION}-opensource` }),
        git_sha: 'abc123',
        build_time: '2026-06-03T00:00:00.000Z',
      }));
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake live runtime server.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function runVerifier(baseUrl, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      '--base-url',
      baseUrl,
      '--target-version',
      `v${TARGET_VERSION}-opensource`,
      '--timeout-ms',
      '10000',
      ...extraArgs,
    ], {
      cwd: ROOT,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error);
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function assertStatus(result, expectedStatus, label, expectedOutput = null) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: expected exit ${expectedStatus}, got ${result.status ?? '<signal>'}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (expectedOutput && !combined.includes(expectedOutput)) {
    throw new Error(`${label}: missing expected output "${expectedOutput}"\n${combined}`);
  }
}

async function withServer(options, fn) {
  const server = await startServer(options);
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.close();
  }
}

async function main() {
  await withServer({}, async (baseUrl) => {
    assertStatus(await runVerifier(baseUrl), 0, 'matching live runtime passes', '"ok": true');
  });

  await withServer({ appVersion: '1.0.36' }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'APP_VERSION mismatch fails',
      'version mismatch',
    );
  });

  await withServer({ packageVersion: '1.0.36-opensource' }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'package version mismatch fails',
      'package_version mismatch',
    );
  });

  await withServer({ omitPackageVersion: true }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'missing package version fails',
      'missing a valid package_version',
    );
  });

  await withServer({ readyStatus: 503 }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'unready runtime fails',
      'Readiness probe',
    );
  });

  console.log('Live runtime version verifier regression tests passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
