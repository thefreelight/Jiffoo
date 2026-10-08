import { beforeAll, afterAll, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { uploadStorageFixture, image, mediaHttp, LocalUploadedObjectStore } from '../helpers/uploaded-storage-fixture';
import { signJwt } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

let fixture: Awaited<ReturnType<typeof uploadStorageFixture>>;
let second: Awaited<ReturnType<Awaited<ReturnType<typeof uploadStorageFixture>>['start']>>;
beforeAll(async () => { fixture = await uploadStorageFixture(); second = await fixture.start(); }, 60000);
afterAll(async () => { await fixture?.close(); }, 60000);

it('B an upload through API A is served by API B with separate empty local directories', async () => {
  const result = await fixture.upload(fixture.primary, await image()); expect(result.status).toBe(200);
  const url = result.json().data.url;
  expect(second.child.pid).not.toBe(fixture.primary.child.pid);
  expect(second.localRoot).not.toBe(fixture.primary.localRoot);
  expect(await fs.access(second.localRoot).then(() => true, () => false)).toBe(false);
  expect((await mediaHttp(second, url)).bytes).toEqual((await mediaHttp(fixture.primary, url)).bytes);
});
it('B every product variant uploaded through API A is readable through API B', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image());
  const url = uploaded.json().data.url;
  for (const variant of ['original', 'thumb', 'medium', 'large']) for (const format of ['jpg', 'webp'])
    expect((await mediaHttp(second, url.replace('original.jpg', `${variant}.${format}`))).status).toBe(200);
});
it('B avatar references saved through API A are observed and served by API B', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image(), true);
  const avatar = uploaded.json().data.url;
  const headers = { Authorization: `Bearer ${signJwt(fixture.actor)}`, 'Content-Type': 'application/json' };
  const saved = await mediaHttp(fixture.primary, '/api/v1/account/profile', 'PUT', Buffer.from(JSON.stringify({ avatar })), headers);
  expect(saved.status).toBe(200);
  const profile = await mediaHttp(second, '/api/v1/account/profile', 'GET', undefined, headers);
  expect(profile.status).toBe(200); expect(profile.json().data.avatar).toBe(avatar);
  expect((await mediaHttp(second, avatar)).status).toBe(200);
});
it('B removing a database reference retains immutable media on both API processes', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image(), true);
  const avatar = uploaded.json().data.url;
  await getTestPrisma().user.update({ where: { id: fixture.actor.id }, data: { avatar } });
  await getTestPrisma().user.update({ where: { id: fixture.actor.id }, data: { avatar: null } });
  expect((await mediaHttp(fixture.primary, avatar)).status).toBe(200);
  expect((await mediaHttp(second, avatar)).status).toBe(200);
});
it('E identical re-upload leaves the existing published media set readable by both processes', async () => {
  const bytes = await image();
  const first = await fixture.upload(fixture.primary, bytes), repeated = await fixture.upload(second, bytes);
  expect(first.status).toBe(200); expect(repeated.status).toBe(200);
  expect(repeated.json().data.url).toBe(first.json().data.url);
  expect((await mediaHttp(second, first.json().data.url)).status).toBe(200);
});
it('E behind-API same-length byte alteration is typed corruption on both processes', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image());
  const url = uploaded.json().data.url, key = url.slice('/uploads/'.length);
  const bytes = await fixture.store.get(key); bytes![0] ^= 1;
  await fixture.store.put(key, bytes!, 'image/jpeg');
  for (const node of [fixture.primary, second]) {
    const response = await mediaHttp(node, url);
    expect(response.status).toBe(500); expect(response.json().error.code).toBe('UPLOAD_STORAGE_CORRUPT');
    expect(response.headers['cache-control']).toBe('no-store'); expect(response.bytes).not.toEqual(bytes);
  }
});
it('E copying local media keys and bytes to S3 preserves the exact public URL', async () => {
  const local = await fixture.start({ UPLOAD_STORAGE_BACKEND: 'local' });
  const uploaded = await fixture.upload(local, await image()); const url = uploaded.json().data.url;
  const store = new LocalUploadedObjectStore(local.localRoot);
  const prefix = url.slice('/uploads/'.length).replace('original.jpg', '');
  const keys = await store.list(prefix);
  for (const key of keys.filter(key => !key.endsWith('manifest.json'))) await fixture.store.put(key, (await store.get(key))!, key.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  await fixture.store.put(`${prefix}manifest.json`, (await store.get(`${prefix}manifest.json`))!, 'application/json');
  expect((await mediaHttp(second, url)).bytes).toEqual((await mediaHttp(local, url)).bytes);
});
it('E copying S3 media keys and bytes to local preserves the exact public URL', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image()); const url = uploaded.json().data.url;
  const local = await fixture.start({ UPLOAD_STORAGE_BACKEND: 'local' });
  const store = new LocalUploadedObjectStore(local.localRoot);
  const prefix = url.slice('/uploads/'.length).replace('original.jpg', '');
  const keys = await fixture.store.list(prefix);
  for (const key of keys.filter(key => !key.endsWith('manifest.json'))) await store.put(key, (await fixture.store.get(key))!, key.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  await store.put(`${prefix}manifest.json`, (await fixture.store.get(`${prefix}manifest.json`))!, 'application/json');
  expect((await mediaHttp(local, url)).bytes).toEqual((await mediaHttp(second, url)).bytes);
});
