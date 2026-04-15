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

let activeProcess = null;

function resolveUpdaterInvocation() {
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
