import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, HeadBucketCommand, HeadObjectCommand, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-errors';

export interface UploadedObjectStore {
  initialize(): Promise<void>;
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  head(key: string): Promise<{ size: number } | null>;
  list(prefix: string): Promise<string[]>;
}

function missing(error: unknown): boolean {
  const value = error as { code?: string; $metadata?: { httpStatusCode?: number } };
  return value?.code === 'ENOENT' || value?.$metadata?.httpStatusCode === 404;
}

async function available<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('UPLOAD_STORAGE_UNAVAILABLE'); }
}

export class LocalUploadedObjectStore implements UploadedObjectStore {
  constructor(readonly root: string) {}
  private target(key: string): string {
    if (!/^[a-zA-Z0-9/_.-]*$/.test(key) || key.includes('..') || key.startsWith('/')) throw new Error('Invalid uploaded object key');
    const target = path.resolve(this.root, key);
    if (target !== path.resolve(this.root) && !target.startsWith(`${path.resolve(this.root)}${path.sep}`)) throw new Error('Invalid uploaded object key');
    return target;
  }
  initialize() { return available(async () => { await fs.mkdir(this.root, { recursive: true }); await fs.access(this.root, fs.constants.R_OK | fs.constants.W_OK); }); }
  put(key: string, content: Buffer, _contentType: string) {
    return available(async () => {
      const target = this.target(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try { await fs.writeFile(temporary, content, { flag: 'wx' }); await fs.rename(temporary, target); }
      finally { await fs.rm(temporary, { force: true }); }
    });
  }
  get(key: string) {
    return available(async () => {
      try { return await fs.readFile(this.target(key)); } catch (error) { if (missing(error)) return null; throw error; }
    });
  }
  head(key: string) {
    return available(async () => {
      try { const stat = await fs.stat(this.target(key)); return stat.isFile() ? { size: stat.size } : null; }
      catch (error) { if (missing(error)) return null; throw error; }
    });
  }
  list(prefix: string) {
    return available(async () => {
      const walk = async (key: string): Promise<string[]> => {
        try {
          const entries = await fs.readdir(this.target(key), { withFileTypes: true });
          return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.posix.join(key, entry.name))
            : Promise.resolve(entry.isFile() && !entry.name.endsWith('.tmp') ? [path.posix.join(key, entry.name)] : [])))).flat();
        } catch (error) { if (missing(error)) return []; throw error; }
      };
      return (await walk('')).filter(key => key.startsWith(prefix)).sort();
    });
  }
}

export class S3UploadedObjectStore implements UploadedObjectStore {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, options: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean }) {
    this.client = new S3Client({ endpoint: options.endpoint, region: options.region,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      forcePathStyle: options.forcePathStyle, maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
    });
  }
  initialize() { return available(async () => { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })); }); }
  put(key: string, content: Buffer, contentType: string) {
    return available(async () => { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentType: contentType, ContentLength: content.length })); });
  }
  get(key: string) {
    return available(async () => {
      try {
        const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (!object.Body) throw new ApiError('UPLOAD_STORAGE_CORRUPT');
        return Buffer.from(await object.Body.transformToByteArray());
      } catch (error) { if (missing(error)) return null; throw error; }
    });
  }
  head(key: string) {
    return available(async () => {
      try { const object = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); return { size: object.ContentLength ?? 0 }; }
      catch (error) { if (missing(error)) return null; throw error; }
    });
  }
  list(prefix: string) {
    return available(async () => {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
        keys.push(...(page.Contents ?? []).flatMap(object => object.Key ? [object.Key] : []));
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys.sort();
    });
  }
}

export const uploadedObjectStore: UploadedObjectStore = env.UPLOAD_STORAGE_BACKEND === 's3'
  ? new S3UploadedObjectStore(env.UPLOAD_S3_BUCKET!, { endpoint: env.UPLOAD_S3_ENDPOINT!, region: env.UPLOAD_S3_REGION!,
    accessKeyId: env.UPLOAD_S3_ACCESS_KEY_ID!, secretAccessKey: env.UPLOAD_S3_SECRET_ACCESS_KEY!, forcePathStyle: env.UPLOAD_S3_FORCE_PATH_STYLE })
  : new LocalUploadedObjectStore(env.UPLOAD_LOCAL_PATH);
