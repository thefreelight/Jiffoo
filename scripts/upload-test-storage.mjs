import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyUploadImageIdentity } from './upload-test-image-identity.mjs';

export const uploadTestImageIndexDigest = 'sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46';
export const uploadTestImage = `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@${uploadTestImageIndexDigest}`;
export const uploadTestImageDigest = 'sha256:39aab3c365848e32aca7b76c5b57f86d1cbca02d7b8f24e1fd1feff9fedddae5';
const require = createRequire(resolve('apps/api/package.json'));
const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

export async function waitForUploadBuckets(client, buckets, timeoutMs = 30_000) {
  const controller = new AbortController();
  let timer;
  let lastError = 'no S3 response';
  const code = error => {
    const value = error?.code ?? error?.name;
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : 'UnknownError';
  };
  const transient = error => ['XMinioServerNotInitialized', 'ServiceUnavailable', 'SlowDown', 'InternalError',
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'TimeoutError'].includes(code(error))
    || [500, 502, 503, 504].includes(error?.$metadata?.httpStatusCode);
  const provision = async () => {
    while (!controller.signal.aborted) {
      try {
        for (const Bucket of buckets) {
          controller.signal.throwIfAborted();
          try { await client.send(new CreateBucketCommand({ Bucket }), { abortSignal: controller.signal }); }
          catch (error) {
            // A prior uncertain response may have created this UUID-owned bucket.
            if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(code(error))) throw error;
          }
          controller.signal.throwIfAborted();
          await client.send(new HeadBucketCommand({ Bucket }), { abortSignal: controller.signal });
        }
        controller.signal.throwIfAborted();
        return;
      } catch (error) {
        if (controller.signal.aborted) throw error;
        lastError = code(error);
        if (!transient(error)) throw new Error(`Upload test storage S3 provisioning failed: ${lastError}`);
        // Retry only after an actual failed S3 operation, within the shared deadline.
        await delay(100, undefined, { signal: controller.signal });
      }
    }
  };
  try {
    await Promise.race([
      provision(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Upload test storage S3 did not become ready within ${timeoutMs}ms; last error: ${lastError}`));
        }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); controller.abort(); }
}

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (result.status !== 0) throw new Error(`Upload storage Docker preflight failed: docker ${args.join(' ')}\n${result.stderr || result.error?.message || result.stdout}`);
  return result.stdout.trim();
}

export async function startUploadTestStorage() {
  docker(['info', '--format', '{{.ServerVersion}}']);
  let platformInspect;
  let classicInspect;
  let identity;
  try {
    const result = spawnSync('docker', ['image', 'inspect', '--platform', 'linux/amd64', uploadTestImage], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    if (result.status === 0) platformInspect = JSON.parse(result.stdout);
    else if (!result.error && /(?:^|\n)unknown flag: --platform\s*(?:\r?\n|$)/.test(`${result.stderr ?? ''}\n${result.stdout ?? ''}`)) platformInspect = undefined;
    else throw new Error(result.stderr || result.error?.message || result.stdout || `docker exited with ${result.status}`);
    const missingDescriptor = Array.isArray(platformInspect) && platformInspect.length === 1 && platformInspect[0] && typeof platformInspect[0] === 'object' && !Array.isArray(platformInspect[0]) && !Object.hasOwn(platformInspect[0], 'Descriptor');
    if (platformInspect === undefined || missingDescriptor) classicInspect = JSON.parse(docker(['image', 'inspect', uploadTestImage]));
    identity = verifyUploadImageIdentity(platformInspect, classicInspect, uploadTestImageDigest, uploadTestImageIndexDigest);
  } catch (error) {
    throw new Error(`Upload storage Docker preflight failed: expected ${uploadTestImage} with linux/amd64 digest ${uploadTestImageDigest}. ${error.message}`);
  }
  console.log(`Upload storage image identity verified via ${identity}: linux/amd64 ${uploadTestImageDigest}`);
  const name = `jiffoo-upload-${randomUUID()}`;
  const volume = `${name}-data`;
  const bucket = `${name}-api`;
  const accessKeyId = 'jiffoo-test-user';
  const secretAccessKey = randomUUID();
  let container;
  let volumeCreated = false;
  const stop = () => {
    if (container) {
      docker(['stop', '--time', '10', container]);
      docker(['rm', container]);
      container = undefined;
    }
    if (volumeCreated) {
      docker(['volume', 'rm', volume]);
      volumeCreated = false;
    }
  };
  try {
    docker(['volume', 'create', volume]);
    volumeCreated = true;
    container = docker(['run', '--pull=never', '--platform', 'linux/amd64', '-d', '--name', name,
      '-e', `MINIO_ROOT_USER=${accessKeyId}`, '-e', `MINIO_ROOT_PASSWORD=${secretAccessKey}`,
      '-p', '127.0.0.1::9000', '-v', `${volume}:/data`, uploadTestImage, 'server', '/data']);
    const port = JSON.parse(docker(['inspect', container]))[0].NetworkSettings.Ports['9000/tcp'][0].HostPort;
    const endpoint = `http://127.0.0.1:${port}`;
    const client = new S3Client({ endpoint, region: 'us-east-1', credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true, maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
    try {
      await waitForUploadBuckets(client, [bucket, `${bucket}-e2e`]);
    } finally { client.destroy(); }
    console.log(`Upload test storage ready: ${name}, image ${uploadTestImage}`);
    return { stop, env: {
      UPLOAD_STORAGE_BACKEND: 's3', UPLOAD_S3_ENDPOINT: endpoint, UPLOAD_S3_REGION: 'us-east-1',
      UPLOAD_S3_BUCKET: bucket, UPLOAD_S3_ACCESS_KEY_ID: accessKeyId, UPLOAD_S3_SECRET_ACCESS_KEY: secretAccessKey,
      UPLOAD_S3_FORCE_PATH_STYLE: 'true',
    } };
  } catch (error) { stop(); throw error; }
}
