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

function dockerFailure(args, result) {
  return Object.assign(new Error(`Upload storage Docker preflight failed: docker ${args.join(' ')}\n${result.stderr || result.error?.message || result.stdout}`, { cause: result.error }), {
    status: result.status, error: result.error, signal: result.signal, stdout: result.stdout, stderr: result.stderr,
  });
}

function docker(args, execute = spawnSync) {
  const result = execute('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  if (result.status !== 0 || result.error || result.signal) throw dockerFailure(args, result);
  return result.stdout.trim();
}

export function createUploadStorageCleanup(resources, execute = spawnSync) {
  const remove = (args, missing) => {
    const result = execute('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    if (result.status === 0 && !result.error && !result.signal) return false;
    // Only a complete daemon response for this exact owned resource is benign.
    if (result.status === 1 && !result.error && !result.signal && !(result.stdout ?? '').trim()
      && (result.stderr ?? '').trim() === missing) return true;
    throw dockerFailure(args, result);
  };
  return () => {
    const failures = [];
    if (resources.container) {
      try {
        const missing = `Error response from daemon: No such container: ${resources.container}`;
        if (!remove(['stop', '--time', '10', resources.container], missing)) {
          remove(['rm', resources.container], missing);
        }
        resources.container = undefined;
      } catch (error) { failures.push(error); }
    }
    if (resources.volumeCreated) {
      try {
        remove(['volume', 'rm', resources.volume], `Error response from daemon: get ${resources.volume}: no such volume`);
        resources.volumeCreated = false;
      } catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'Upload storage cleanup failed');
  };
}

export function createOwnedUploadStorage({ name, accessKeyId, secretAccessKey }, execute = spawnSync) {
  if (!/^jiffoo-upload-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(name)) {
    throw new Error('Upload storage requires an invocation-specific UUID name');
  }
  const volume = `${name}-data`;
  const owner = randomUUID();
  const ownerLabel = 'jiffoo.upload-test-owner';
  const resources = { volume, volumeCreated: false, container: undefined };
  const stop = createUploadStorageCleanup(resources, execute);
  let volumeAttempted = false;
  let volumeInspectionAttempted = false;
  const claimVolume = () => {
    volumeInspectionAttempted = true;
    const inspected = JSON.parse(docker(['volume', 'inspect', volume], execute));
    if (!Array.isArray(inspected) || inspected.length !== 1 || inspected[0]?.Name !== volume
      || inspected[0]?.Labels?.[ownerLabel] !== owner) {
      throw new Error(`Upload storage volume ownership could not be verified for ${volume}`);
    }
    resources.volumeCreated = true;
  };
  let createAttempted = false;
  try {
    volumeAttempted = true;
    docker(['volume', 'create', '--label', `${ownerLabel}=${owner}`, volume], execute);
    // Docker volume create can also return an existing volume: success alone proves no ownership.
    claimVolume();
    createAttempted = true;
    const container = docker(['create', '--pull=never', '--platform', 'linux/amd64', '--name', name,
      '--label', `${ownerLabel}=${owner}`,
      '-e', `MINIO_ROOT_USER=${accessKeyId}`, '-e', `MINIO_ROOT_PASSWORD=${secretAccessKey}`,
      '-p', '127.0.0.1::9000', '-v', `${volume}:/data`, uploadTestImage, 'server', '/data'], execute);
    if (!/^[a-f0-9]{64}$/.test(container)) throw new Error('Upload storage Docker create did not return a full container ID');
    resources.container = container;
    docker(['start', container], execute);
    return { container, stop };
  } catch (error) {
    const failures = [error];
    if (volumeAttempted && !volumeInspectionAttempted) {
      try { claimVolume(); } catch (recoveryError) { failures.push(recoveryError); }
    }
    if (createAttempted && !resources.container) {
      try {
        // A lost create response is uncertain: recover only this invocation's exact identity.
        const inspected = JSON.parse(docker(['container', 'inspect', name], execute));
        if (!Array.isArray(inspected) || inspected.length !== 1
          || inspected[0]?.Name !== `/${name}` || inspected[0]?.Config?.Labels?.[ownerLabel] !== owner
          || !/^[a-f0-9]{64}$/.test(inspected[0]?.Id ?? '')) {
          throw new Error(`Upload storage ownership could not be verified for ${name}`);
        }
        resources.container = inspected[0].Id;
      } catch (recoveryError) { failures.push(recoveryError); }
    }
    const uncertainResources = {
      volume: volumeAttempted && !resources.volumeCreated ? volume : undefined,
      container: createAttempted && !resources.container ? name : undefined,
      ownerLabel, owner,
    };
    try { stop(); } catch (cleanupError) { failures.push(cleanupError); }
    if (failures.length > 1) {
      throw Object.assign(new AggregateError(failures, `Upload storage startup or cleanup failed: ${name}; volume ${volume}`, { cause: error }), {
        ownedResources: { ...resources },
        uncertainResources,
      });
    }
    throw Object.assign(error, { ownedResources: { ...resources }, uncertainResources });
  }
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
  const bucket = `${name}-api`;
  const accessKeyId = 'jiffoo-test-user';
  const secretAccessKey = randomUUID();
  const { container, stop } = createOwnedUploadStorage({ name, accessKeyId, secretAccessKey });
  try {
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
  } catch (error) {
    try { stop(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Upload storage startup and cleanup failed', { cause: error }); }
    throw error;
  }
}
