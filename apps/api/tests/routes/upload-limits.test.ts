/**
 * Upload Limit Tests
 *
 * Coverage:
 * - A multipart part above the business cap is refused while the stream runs
 * - POST /api/v1/admin/products/upload-image refuses an oversized part
 * - POST /api/v1/account/avatar refuses an oversized part
 * - The plugin package route keeps its own, larger limit
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'node:stream';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { UploadService } from '@/core/upload/service';
import { readUploadContent } from '@/routes/multipart-content';

function multipartBody(content: Buffer, filename: string, fieldname = 'file', mimetype = 'image/png'): { boundary: string; payload: Buffer } {
  const boundary = '----jiffoo-upload-limit-test';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return { boundary, payload: Buffer.concat([head, content, tail]) };
}

describe('Upload limits', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await createAdminWithToken()).token;
    userToken = (await createUserWithToken()).token;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('refuses a part above the cap while the stream runs', async () => {
    const chunk = Buffer.alloc(1024 * 1024, 0x41);
    const total = 16 * 1024 * 1024;
    let produced = 0;
    const source = new Readable({
      read() {
        if (produced >= total) { this.push(null); return; }
        produced += chunk.length;
        this.push(chunk);
      },
    });
    const file = { file: source, filename: 'big.png', mimetype: 'image/png', fieldname: 'file', fields: {} } as unknown as MultipartFile;
    await expect(readUploadContent(file, UploadService.MAX_FILE_SIZE)).rejects.toMatchObject({ reason: 'TOO_LARGE' });
    // The reader stopped at the cap: the payload was never buffered as a whole.
    expect(produced).toBeLessThan(total);
    expect(produced).toBeLessThanOrEqual(UploadService.MAX_FILE_SIZE + 3 * chunk.length);
  });

  it('rejects an oversized product image with the upload validation error', async () => {
    // The part is far below the global multipart ceiling, so only the limit of
    // the route itself can refuse it.
    const body = multipartBody(Buffer.alloc(UploadService.MAX_FILE_SIZE + 1024 * 1024, 0x41), 'big.png');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/products/upload-image',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('UPLOAD_FAILED');
  });

  it('rejects an oversized avatar with the upload validation error', async () => {
    const body = multipartBody(Buffer.alloc(UploadService.MAX_FILE_SIZE + 1024 * 1024, 0x41), 'big.png');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/account/avatar',
      headers: { authorization: `Bearer ${userToken}`, 'content-type': `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps the own, larger limit of the plugin package route', async () => {
    // A part above the image cap but below the package cap passes the size
    // gate of the package route and is refused later by its own validation.
    const accepted = multipartBody(Buffer.alloc(8 * 1024 * 1024, 0x41), 'big.zip', 'other', 'application/zip');
    const allowed = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions/plugin/preview',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': `multipart/form-data; boundary=${accepted.boundary}` },
      payload: accepted.payload,
    });
    expect(allowed.statusCode).toBe(400);
    expect(allowed.statusCode).not.toBe(413);
    // A part above the package cap is refused by the limit of the route, not
    // by the global multipart ceiling.
    const rejected = multipartBody(Buffer.alloc(12 * 1024 * 1024, 0x41), 'big.zip', 'file', 'application/zip');
    const tooLarge = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions/plugin/preview',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': `multipart/form-data; boundary=${rejected.boundary}` },
      payload: rejected.payload,
    });
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
