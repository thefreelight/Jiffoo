import { afterAll, beforeAll, expect, it } from 'vitest';
import { errorHttpFixture } from '../helpers/error-http-fixture';
import { createTestUser, signJwt } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

const prisma = getTestPrisma();
let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;
const users: Awaited<ReturnType<typeof createTestUser>>[] = [];

beforeAll(async () => {
  users.push(await createTestUser(), await createTestUser({ role: 'ADMIN' }));
  fixture = await errorHttpFixture();
  for (const user of users) fixture.users.add(user.id);
}, 60000);

afterAll(async () => {
  await fixture?.close();
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
}, 60000);

for (const [route, code, userIndex] of [
  ['/api/v1/account/avatar', 'VALIDATION_ERROR', 0],
  ['/api/v1/admin/products/upload-image', 'UPLOAD_FAILED', 1],
] as const) {
  it.each(['invalid type', 'too large'])('B real TCP ' + route + ' preserves HEAD 400 ' + code + ' for %s', async reason => {
    const body = new FormData();
    const bytes = reason === 'too large' ? new Uint8Array(5 * 1024 * 1024 + 1) : new Uint8Array([1]);
    body.append('file', new Blob([bytes], { type: reason === 'too large' ? 'image/png' : 'text/plain' }), 'upload.png');
    const response = await fixture.request(route, {
      method: 'POST', headers: { Authorization: `Bearer ${signJwt(users[userIndex])}` }, body,
    });
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error.code).toBe(code);
    expect(result.error.details).toEqual(reason === 'too large'
      ? { maxBytes: 5 * 1024 * 1024 }
      : { allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] });
    expect(JSON.stringify(result)).not.toMatch(/stack|cause|Prisma|SQL/);
  });
  it('K real TCP ' + route + ' sanitizes a real transactional foreign-key failure to 500', async () => {
    expect((await fixture.request('/api/v1/__fixture/b2b-constraint/upload', { method: 'POST' })).status).toBe(200);
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array([1])], { type: 'image/png' }), 'upload.png');
    const response = await fixture.request(route, { method: 'POST', headers: { Authorization: `Bearer ${signJwt(users[userIndex])}` }, body });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  });
  it('K real TCP ' + route + ' returns 503 DATABASE_UNAVAILABLE during a real relay outage', async () => {
    fixture.db.drop();
    try {
      const body = new FormData();
      body.append('file', new Blob([new Uint8Array([1])], { type: 'image/png' }), 'upload.png');
      const response = await fixture.request(route, { method: 'POST', headers: { Authorization: `Bearer ${signJwt(users[userIndex])}` }, body });
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('DATABASE_UNAVAILABLE');
      expect(response.headers.get('Retry-After')).toBe('5');
    } finally {
      fixture.db.recover();
      await fixture.send({ kind: 'disconnect-db' });
    }
  }, 120000);
}
