#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.JIFFOO_UPDATER_AGENT_PORT || '3015');
const STATUS_FILE = process.env.JIFFOO_UPDATER_STATUS_FILE || '/workspace/.jiffoo-updater/status.json';
const COMPOSE_FILE = process.env.JIFFOO_DOCKER_COMPOSE_FILE || '/workspace/docker-compose.prod.yml';
const ENV_FILE = process.env.JIFFOO_DOCKER_ENV_FILE || '/workspace/.env.production.local';
const UPDATER_BIN = process.env.JIFFOO_UPDATER_BIN || '/usr/local/bin/jiffoo-updater';
const WORKSPACE_UPDATER_SCRIPT =
  process.env.JIFFOO_UPDATER_SCRIPT || '/workspace/scripts/jiffoo-updater.mjs';
const WORKSPACE_PACKAGE_JSON =
  process.env.JIFFOO_WORKSPACE_PACKAGE_JSON || '/workspace/package.json';

let activeProcess = null;

function parseReleaseVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    return null;
  }

  const [core, prerelease = ''] = version.split('-', 2);
  const [major, minor, patch] = core.split('.').map((part) => Number(part));
  return {
    major,
    minor,
    patch,
    prerelease: prerelease.length > 0 ? prerelease.split('.') : [],
  };
}

function compareReleaseVersions(a, b) {
  const parsedA = parseReleaseVersion(a);
  const parsedB = parseReleaseVersion(b);
  if (!parsedA || !parsedB) return 0;

  if (parsedA.major !== parsedB.major) return parsedA.major < parsedB.major ? -1 : 1;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor < parsedB.minor ? -1 : 1;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch < parsedB.patch ? -1 : 1;

  const aPre = parsedA.prerelease;
  const bPre = parsedB.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;

  const maxLen = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < maxLen; i += 1) {
    const left = aPre[i];
    const right = bPre[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left !== right) return left < right ? -1 : 1;
  }

  return 0;
}

function resolveWorkspaceVersion() {
  try {
    if (!WORKSPACE_PACKAGE_JSON || !fsSync.existsSync(WORKSPACE_PACKAGE_JSON)) {
      return null;
    }
    const json = JSON.parse(fsSync.readFileSync(WORKSPACE_PACKAGE_JSON, 'utf8'));
    return typeof json.version === 'string' ? json.version.replace(/-opensource$/, '') : null;
  } catch {
    return null;
  }
}

function resolveUpdaterInvocation() {
  const containerVersion = (process.env.APP_VERSION || '').trim();
  const workspaceVersion = resolveWorkspaceVersion();

  if (
    WORKSPACE_UPDATER_SCRIPT &&
    fsSync.existsSync(WORKSPACE_UPDATER_SCRIPT) &&
    workspaceVersion &&
    containerVersion &&
    compareReleaseVersions(workspaceVersion, containerVersion) > 0
  ) {
    return {
      command: 'node',
      prefixArgs: [WORKSPACE_UPDATER_SCRIPT],
    };
  }

  if (UPDATER_BIN && fsSync.existsSync(UPDATER_BIN)) {
    return {
      command: UPDATER_BIN,
      prefixArgs: [],
    };
  }

  if (WORKSPACE_UPDATER_SCRIPT && fsSync.existsSync(WORKSPACE_UPDATER_SCRIPT)) {
    return {
      command: 'node',
      prefixArgs: [WORKSPACE_UPDATER_SCRIPT],
    };
  }

  throw new Error('No updater invocation is available');
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readStatus() {
  try {
    const raw = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      status: 'idle',
      progress: 0,
      currentStep: null,
      error: null,
      updatedAt: null,
      targetVersion: null,
    };
  }
}

async function writeStatus(patch) {
  const current = await readStatus();
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(STATUS_FILE), { recursive: true });
  await fs.writeFile(STATUS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function startUpgrade(targetVersion) {
  if (activeProcess) {
    throw new Error('Upgrade already in progress');
  }

  await writeStatus({
    status: 'preparing',
    progress: 5,
    currentStep: 'Upgrade accepted by updater agent',
    error: null,
    targetVersion,
  });

  const { command, prefixArgs } = resolveUpdaterInvocation();
  const args = [
    ...prefixArgs,
    'upgrade',
    '--mode',
    'docker-compose',
    '--target-version',
    targetVersion,
    '--compose-file',
    COMPOSE_FILE,
    '--status-file',
    STATUS_FILE,
  ];

  if (ENV_FILE && fsSync.existsSync(ENV_FILE)) {
    args.push('--env-file', ENV_FILE);
  }

  activeProcess = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  activeProcess.unref();
  activeProcess = null;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: true,
        composeFile: COMPOSE_FILE,
        envFile: ENV_FILE,
        updaterBinary: UPDATER_BIN,
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/status') {
      sendJson(response, 200, await readStatus());
      return;
    }

    if (request.method === 'POST' && request.url === '/upgrade') {
      const body = await readJsonBody(request);
      const targetVersion = typeof body.targetVersion === 'string' ? body.targetVersion.trim() : '';
      if (!targetVersion) {
        sendJson(response, 400, { error: 'targetVersion is required' });
        return;
      }

      const status = await readStatus();
      if (!['idle', 'completed', 'failed', 'recovered'].includes(status.status)) {
        sendJson(response, 409, { error: 'Upgrade already in progress', status });
        return;
      }

      await startUpgrade(targetVersion);
      sendJson(response, 202, {
        accepted: true,
        targetVersion,
        status: 'preparing',
        statusUrl: '/status',
      });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Updater agent failed',
    });
  }
});

server.listen(PORT, () => {
  console.log(`[jiffoo-updater-agent] Listening on :${PORT}`);
});
