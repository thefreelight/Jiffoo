/**
 * Upload Limit Tests
 *
 * Coverage:
 * - A multipart part above the business cap is refused while the stream runs
 * - POST /api/v1/admin/products/upload-image refuses an oversized part
 * - POST /api/v1/account/avatar refuses an oversized part
 * - The plugin package route keeps its own, larger limit
 * - A streaming upload above the cap is answered, not reset
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Readable, PassThrough } from 'node:stream';
import { connect } from 'node:net';
import { once } from 'node:events';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, createTestUser, signJwt, deleteAllTestUsers } from '../helpers/auth';
import { errorHttpFixture } from '../helpers/error-http-fixture';
import { getTestPrisma } from '../helpers/db';
import { UploadService } from '@/core/upload/service';
import { readUploadContent } from '@/routes/multipart-content';

const prisma = getTestPrisma();

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

  it('refuses a part above the cap, reads it whole and buffers none of it', async () => {
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
    const raw = new PassThrough();
    raw.end();
    const request = { raw } as unknown as FastifyRequest;
    // The reader never materializes the part into a buffer, so the bytes above
    // the cap are observed at the source and never retained.
    const materialized = vi.spyOn(Buffer, 'concat');
    let failure: unknown;
    try { await readUploadContent(request, file, UploadService.MAX_FILE_SIZE); }
    catch (error) { failure = error; }
    const concatenations = materialized.mock.calls.length;
    materialized.mockRestore();
    expect(failure).toMatchObject({ reason: 'TOO_LARGE', details: { maxBytes: UploadService.MAX_FILE_SIZE } });
    // The whole part is read, so the request body is drained and the
    // connection can be reused.
    expect(produced).toBe(total);
    // No byte of the oversized part was ever concatenated into a buffer.
    expect(concatenations).toBe(0);
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
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    // The answer names the limit the client reached.
    expect(response.json().error.details).toEqual({ maxBytes: UploadService.MAX_FILE_SIZE });
  });

  it('rejects an oversized avatar with the upload validation error', async () => {
    const body = multipartBody(Buffer.alloc(UploadService.MAX_FILE_SIZE + 1024 * 1024, 0x41), 'big.png');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/account/avatar',
      headers: { authorization: `Bearer ${userToken}`, 'content-type': `multipart/form-data; boundary=${body.boundary}` },
      payload: body.payload,
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.json().error.details).toEqual({ maxBytes: UploadService.MAX_FILE_SIZE });
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

describe('Upload limits over a real connection', () => {
  const users: Awaited<ReturnType<typeof createTestUser>>[] = [];
  let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;

  beforeAll(async () => {
    users.push(await createTestUser());
    fixture = await errorHttpFixture();
  }, 120000);

  afterAll(async () => {
    await fixture?.close();
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }, 120000);

  it('answers a streaming upload above the cap instead of resetting the client', async () => {
    const boundary = '----jiffoo-stream-upload';
    const path = '/api/v1/account/avatar';
    const bodyBytes = UploadService.MAX_FILE_SIZE + 3 * 1024 * 1024;
    const partHead = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.png"\r\nContent-Type: image/png\r\n\r\n`, 'utf8');
    const partTail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const url = new URL(fixture.base);
    const socket = connect({ host: url.hostname, port: Number(url.port) });
    const failures: Error[] = [];
    const received: Buffer[] = [];
    socket.on('error', (error) => failures.push(error));
    socket.on('data', (chunk) => received.push(chunk));
    await once(socket, 'connect');
    socket.write(
      `POST ${path} HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${signJwt(users[0])}\r\nX-Forwarded-For: ${fixture.ip}\r\n`
      + `Content-Type: multipart/form-data; boundary=${boundary}\r\nContent-Length: ${partHead.length + bodyBytes + partTail.length}\r\nConnection: close\r\n\r\n`,
    );
    socket.write(partHead);
    const chunk = Buffer.alloc(256 * 1024, 0x41);
    let written = 0;
    while (written < bodyBytes) {
      const size = Math.min(chunk.length, bodyBytes - written);
      const flushed = socket.write(size === chunk.length ? chunk : chunk.subarray(0, size));
      written += size;
      if (!flushed) await once(socket, 'drain');
    }
    socket.write(partTail);
    await once(socket, 'end');
    const response = Buffer.concat(received).toString('utf8');
    // The client is never reset: the answer of the route arrives on the same
    // connection, after the rest of the body was consumed.
    expect(failures).toEqual([]);
    expect(response).toContain('413');
    expect(response).toContain('PAYLOAD_TOO_LARGE');
  }, 120000);
});
