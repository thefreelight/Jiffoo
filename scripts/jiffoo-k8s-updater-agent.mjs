#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const PORT = Number(process.env.JIFFOO_UPDATER_AGENT_PORT || '3015');
const STATUS_FILE =
  process.env.JIFFOO_UPDATER_STATUS_FILE || '/tmp/jiffoo-k8s-updater/status.json';
const KUBE_TOKEN_PATH =
  process.env.JIFFOO_K8S_SERVICEACCOUNT_TOKEN_PATH ||
  '/var/run/secrets/kubernetes.io/serviceaccount/token';
const KUBE_CA_PATH =
  process.env.JIFFOO_K8S_SERVICEACCOUNT_CA_PATH ||
  '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
const KUBE_HOST = process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc';
const KUBE_PORT = process.env.KUBERNETES_SERVICE_PORT || '443';
const IMAGE_TAG_TEMPLATE = process.env.JIFFOO_K8S_IMAGE_TAG_TEMPLATE || '{version}';
const SERVICE_LIST = (process.env.JIFFOO_K8S_UPDATER_SERVICES || 'api,admin,shop')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

let activeUpgrade = null;

function buildDefaultStatus() {
  return {
    status: 'idle',
    progress: 0,
    currentStep: null,
    error: null,
    updatedAt: null,
    targetVersion: null,
    releaseName: null,
    namespace: null,
  };
}

function readServiceAccountToken() {
  return fsSync.readFileSync(KUBE_TOKEN_PATH, 'utf8').trim();
}

function readClusterCa() {
  return fsSync.readFileSync(KUBE_CA_PATH, 'utf8');
}

function buildApiUrl(apiPath) {
  return `https://${KUBE_HOST}:${KUBE_PORT}${apiPath}`;
}

function requestJson(method, apiPath, body, contentType = 'application/json') {
  const token = readServiceAccountToken();
  const ca = readClusterCa();
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');

  return new Promise((resolve, reject) => {
    const request = https.request(
      buildApiUrl(apiPath),
      {
        method,
        ca,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': contentType,
                'Content-Length': String(payload.length),
              }
            : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const data = raw.length > 0 ? JSON.parse(raw) : null;

          if ((response.statusCode || 500) >= 400) {
            const message =
              data?.message ||
              data?.error ||
              `Kubernetes API ${method} ${apiPath} failed with HTTP ${response.statusCode || 500}`;
            reject(new Error(message));
            return;
          }

          resolve(data);
        });
      },
    );

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
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
    return buildDefaultStatus();
  }
}

async function writeStatus(patch) {
  const next = {
    ...(await readStatus()),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(STATUS_FILE), { recursive: true });
  await fs.writeFile(STATUS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveNamespace(payload) {
  return (
    payload.namespace ||
    process.env.JIFFOO_K8S_NAMESPACE ||
    process.env.POD_NAMESPACE ||
    'default'
  );
}

function substituteTag(template, version) {
  return template.replaceAll('{version}', version);
}

function replaceImageTag(image, tag) {
  const digestIndex = image.indexOf('@');
  const withoutDigest = digestIndex >= 0 ? image.slice(0, digestIndex) : image;
  const slashIndex = withoutDigest.lastIndexOf('/');
  const colonIndex = withoutDigest.lastIndexOf(':');
  if (colonIndex > slashIndex) {
    return `${withoutDigest.slice(0, colonIndex)}:${tag}`;
  }
  return `${withoutDigest}:${tag}`;
}

async function getDeployment(namespace, name) {
  return requestJson(
    'GET',
    `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
  );
}

function getPrimaryContainer(deployment, name) {
  const containers = deployment?.spec?.template?.spec?.containers || [];
  return containers.find((item) => item.name === name) || containers[0] || null;
}

async function patchDeployment(namespace, name, patch) {
  return requestJson(
    'PATCH',
    `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
    patch,
    'application/strategic-merge-patch+json',
  );
}

async function waitForDeploymentRollout(namespace, name, expectedImage, timeoutMs = 5 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const deployment = await getDeployment(namespace, name);
    const replicas = deployment?.spec?.replicas ?? 1;
    const status = deployment?.status || {};
    const container = getPrimaryContainer(deployment, name);
    const imageMatches = container?.image === expectedImage;
    const observedGeneration =
      (status.observedGeneration || 0) >= (deployment?.metadata?.generation || 0);
    const updated = (status.updatedReplicas || 0) >= replicas;
    const available = (status.availableReplicas || 0) >= replicas;

    if (imageMatches && observedGeneration && updated && available) {
      return;
    }

    await sleep(3000);
  }

  throw new Error(`Timed out waiting for deployment/${name} rollout in namespace ${namespace}`);
}

function buildMigrationJobName(targetVersion) {
  const safeVersion = targetVersion.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  return `jiffoo-upgrade-${safeVersion}-${Date.now().toString().slice(-6)}`;
}

async function createMigrationJob(namespace, image, targetVersion) {
  const jobName = buildMigrationJobName(targetVersion);
  const manifest = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      namespace,
    },
    spec: {
      ttlSecondsAfterFinished: 600,
      backoffLimit: 0,
      template: {
        spec: {
          restartPolicy: 'Never',
          containers: [
            {
              name: 'migrate',
              image,
              imagePullPolicy: 'IfNotPresent',
              command: [
                'npx',
                'prisma',
                'migrate',
                'deploy',
                '--schema',
                'apps/api/prisma/schema.prisma',
              ],
              env: [
                {
                  name: 'DATABASE_URL',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'jiffoo-db-credentials',
                      key: 'DATABASE_URL',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };

  await requestJson(
    'POST',
    `/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs`,
    manifest,
  );
  return jobName;
}

async function waitForJob(namespace, jobName, timeoutMs = 5 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await requestJson(
      'GET',
      `/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs/${encodeURIComponent(jobName)}`,
    );
    const status = job?.status || {};

    if ((status.succeeded || 0) > 0) {
      return;
    }

    if ((status.failed || 0) > 0) {
      throw new Error(`Migration job ${jobName} failed in namespace ${namespace}`);
    }

    await sleep(3000);
  }

  throw new Error(`Timed out waiting for migration job ${jobName}`);
}

async function rollbackDeployments(namespace, previousDeployments) {
  for (const previous of previousDeployments) {
    await patchDeployment(namespace, previous.name, {
      spec: {
        template: {
          spec: {
            containers: [
              {
                name: previous.name,
                image: previous.image,
                ...(previous.name === 'api' && previous.appVersion
                  ? {
                      env: [
                        {
                          name: 'APP_VERSION',
                          value: previous.appVersion,
                        },
                      ],
                    }
                  : {}),
              },
            ],
          },
        },
      },
    });
  }

  for (const previous of previousDeployments) {
    await waitForDeploymentRollout(namespace, previous.name, previous.image);
  }
}

async function performUpgrade(targetVersion, payload) {
  const namespace = resolveNamespace(payload);
  const previousDeployments = [];

  await writeStatus({
    status: 'checking',
    progress: 10,
    currentStep: 'Inspecting current Kubernetes release state',
    error: null,
    targetVersion,
    releaseName: payload.releaseName || null,
    namespace,
  });

  const deploymentRecords = [];
  for (const name of SERVICE_LIST) {
    const deployment = await getDeployment(namespace, name);
    const container = getPrimaryContainer(deployment, name);
    if (!container?.image) {
      throw new Error(`Deployment ${name} is missing a primary container image`);
    }

    const appVersion =
      name === 'api'
        ? (container.env || []).find((item) => item.name === 'APP_VERSION')?.value || null
        : null;

    previousDeployments.push({
      name,
      image: container.image,
      appVersion,
    });

    deploymentRecords.push({
      name,
      currentImage: container.image,
      nextImage: replaceImageTag(container.image, substituteTag(IMAGE_TAG_TEMPLATE, targetVersion)),
    });
  }

  const apiRecord = deploymentRecords.find((item) => item.name === 'api');
  if (!apiRecord) {
    throw new Error('API deployment was not found in service list');
  }

  await writeStatus({
    status: 'preparing',
    progress: 25,
    currentStep: 'Running database migrations for the target release',
  });

  const migrationJob = await createMigrationJob(namespace, apiRecord.nextImage, targetVersion);
  await waitForJob(namespace, migrationJob);

  try {
    await writeStatus({
      status: 'applying',
      progress: 45,
      currentStep: 'Rolling out upgraded API deployment',
    });

    await patchDeployment(namespace, 'api', {
      spec: {
        template: {
          spec: {
            containers: [
              {
                name: 'api',
                image: apiRecord.nextImage,
                env: [
                  {
                    name: 'APP_VERSION',
                    value: targetVersion,
                  },
                ],
              },
            ],
          },
        },
      },
    });
    await waitForDeploymentRollout(namespace, 'api', apiRecord.nextImage);

    for (const record of deploymentRecords.filter((item) => item.name !== 'api')) {
      const progress = record.name === 'admin' ? 65 : 80;
      await writeStatus({
        status: 'applying',
        progress,
        currentStep: `Rolling out upgraded ${record.name} deployment`,
      });

      await patchDeployment(namespace, record.name, {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: record.name,
                  image: record.nextImage,
                },
              ],
            },
          },
        },
      });
      await waitForDeploymentRollout(namespace, record.name, record.nextImage);
    }
  } catch (error) {
    await writeStatus({
      status: 'failed',
      progress: 90,
      currentStep: 'Upgrade failed; attempting deployment rollback',
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await rollbackDeployments(namespace, previousDeployments);
      await writeStatus({
        status: 'recovered',
        progress: 100,
        currentStep: 'Rolled deployments back to the previous image set',
        error: error instanceof Error ? error.message : String(error),
      });
    } catch (rollbackError) {
      await writeStatus({
        status: 'failed',
        progress: 100,
        currentStep: 'Rollback failed; operator intervention required',
        error:
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError),
      });
    }

    throw error;
  }

  await writeStatus({
    status: 'completed',
    progress: 100,
    currentStep: 'Kubernetes upgrade completed successfully',
    error: null,
  });
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
        mode: 'k8s',
        namespace: process.env.JIFFOO_K8S_NAMESPACE || process.env.POD_NAMESPACE || null,
        services: SERVICE_LIST,
        imageTagTemplate: IMAGE_TAG_TEMPLATE,
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/status') {
      sendJson(response, 200, await readStatus());
      return;
    }

    if (request.method === 'POST' && request.url === '/upgrade') {
      const body = await readJsonBody(request);
      const targetVersion =
        typeof body.targetVersion === 'string' ? body.targetVersion.trim() : '';
      if (!targetVersion) {
        sendJson(response, 400, { error: 'targetVersion is required' });
        return;
      }

      const status = await readStatus();
      if (activeUpgrade || !['idle', 'completed', 'failed', 'recovered'].includes(status.status)) {
        sendJson(response, 409, { error: 'Upgrade already in progress', status });
        return;
      }

      activeUpgrade = performUpgrade(targetVersion, body)
        .catch(() => {
          // status file already contains the failure detail
        })
        .finally(() => {
          activeUpgrade = null;
        });

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
      error: error instanceof Error ? error.message : 'K8s updater agent failed',
    });
  }
});

server.listen(PORT, () => {
  console.log(`[jiffoo-k8s-updater-agent] Listening on :${PORT}`);
});
