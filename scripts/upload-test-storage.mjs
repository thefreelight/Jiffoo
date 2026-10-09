import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { verifyUploadImageIdentity } from './upload-test-image-identity.mjs';

export const uploadTestImage = 'pgsty/minio:RELEASE.2026-08-04T00-00-00Z';
export const uploadTestImageDigest = 'sha256:2b36182f3479c58b5cba920f20479738ee85ce218de0596a244f9a1368268db9';
const require = createRequire(resolve('apps/api/package.json'));
const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

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
    identity = verifyUploadImageIdentity(platformInspect, classicInspect, uploadTestImageDigest);
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
      // HTTP readiness retries are bounded and do not substitute for test latches.
      const deadline = Date.now() + 30_000;
      while (true) {
        try { if ((await fetch(`${endpoint}/minio/health/ready`)).ok) break; } catch {}
        if (Date.now() >= deadline) throw new Error('Upload test storage did not become ready within 30 seconds');
        await new Promise((done) => setTimeout(done, 100));
      }
      for (const Bucket of [bucket, `${bucket}-e2e`]) {
        await client.send(new CreateBucketCommand({ Bucket }));
        await client.send(new HeadBucketCommand({ Bucket }));
      }
    } finally { client.destroy(); }
    console.log(`Upload test storage ready: ${name}, image ${uploadTestImage}`);
    return { stop, env: {
      UPLOAD_STORAGE_BACKEND: 's3', UPLOAD_S3_ENDPOINT: endpoint, UPLOAD_S3_REGION: 'us-east-1',
      UPLOAD_S3_BUCKET: bucket, UPLOAD_S3_ACCESS_KEY_ID: accessKeyId, UPLOAD_S3_SECRET_ACCESS_KEY: secretAccessKey,
      UPLOAD_S3_FORCE_PATH_STYLE: 'true',
    } };
  } catch (error) { stop(); throw error; }
}
