import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { S3UploadedObjectStore, LocalUploadedObjectStore } from '@/core/storage/uploaded-object-store';
import { mediaSha256 } from '@/core/storage/uploaded-media-set';
import { startThemeChild, stopThemeChild, themeHttp, type ThemeChild } from './theme-package-fixture';
import { createTestUser, signJwt } from './auth';
import { getTestPrisma } from './db';

export function s3Store(endpoint = process.env.UPLOAD_S3_ENDPOINT!, bucket = process.env.UPLOAD_S3_BUCKET!) {
  return new S3UploadedObjectStore(bucket, { endpoint, region: process.env.UPLOAD_S3_REGION!,
    accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID!, secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY!, forcePathStyle: true });
}
export async function image(format: 'png' | 'jpeg' | 'webp' = 'png') {
  const color = randomUUID().replace(/-/g, '').slice(0, 6);
  return sharp({ create: { width: 12, height: 10, channels: 3, background: `#${color}` } }).toFormat(format).toBuffer();
}
export async function uploadStorageFixture() {
  const actor = await createTestUser({ role: 'ADMIN' });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'b5-upload-'));
  const children: ThemeChild[] = [];
  const start = async (environment: Record<string, string> = {}) => {
    const root = path.join(directory, randomUUID());
    const node = await startThemeChild('http', undefined, { UPLOAD_LOCAL_PATH: root, ...environment });
    children.push(node); return { ...node, localRoot: root };
  };
  const primary = await start();
  const upload = async (node: ThemeChild, bytes: Buffer, avatar = false, mime = 'image/png', filename = 'misleading.webp') => {
    const boundary = randomUUID();
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    return themeHttp(node, avatar ? '/api/v1/account/avatar' : '/api/v1/admin/products/upload-image', 'POST', body,
      { Authorization: `Bearer ${signJwt(actor)}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` });
  };
  const close = async () => {
    for (const node of children) await stopThemeChild(node);
    const prisma = getTestPrisma();
    await prisma.user.delete({ where: { id: actor.id } });
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL!);
    try {
      for (const node of children) {
        const keys = await redis.keys(`jiffoo:protection:rl:*:ip:${node.ip}`);
        if (keys.length) await redis.del(...keys);
      }
      await redis.del(`jiffoo:protection:rl:user:user:${actor.id}`);
    } finally { redis.disconnect(); }
    await fs.rm(directory, { recursive: true, force: true });
  };
  return { actor, primary, start, upload, close, store: s3Store(), directory };
}
export { themeHttp as mediaHttp, mediaSha256, LocalUploadedObjectStore };
