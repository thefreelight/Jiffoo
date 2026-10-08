import { beforeAll, afterAll, expect, it } from 'vitest';
import sharp from 'sharp';
import { uploadStorageFixture, image, mediaHttp, mediaSha256, LocalUploadedObjectStore } from '../helpers/uploaded-storage-fixture';
import { tcpRelay } from '../helpers/error-http-fixture';

let fixture: Awaited<ReturnType<typeof uploadStorageFixture>>;
beforeAll(async () => { fixture = await uploadStorageFixture(); }, 60000);
afterAll(async () => { await fixture?.close(); }, 60000);

for (const format of ['png', 'jpeg', 'webp'] as const) {
  it(`A ${format} input publishes eight variants with actual MIME and extensions over TCP`, async () => {
    const uploaded = await fixture.upload(fixture.primary, await image(format), false, `image/${format}`);
    expect(uploaded.status).toBe(200);
    const result = uploaded.json().data;
    expect(result.url).toMatch(/^\/uploads\/products\/[a-f0-9]{64}\/original\.jpg$/);
    expect(result.mimetype).toBe('image/jpeg');
    for (const variant of ['original', 'thumb', 'medium', 'large']) for (const extension of ['jpg', 'webp']) {
      const response = await mediaHttp(fixture.primary, result.url.replace('original.jpg', `${variant}.${extension}`));
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe(extension === 'jpg' ? 'image/jpeg' : 'image/webp');
      expect((await sharp(response.bytes).metadata()).format).toBe(extension === 'jpg' ? 'jpeg' : 'webp');
    }
  });
}
it('A avatar uses the avatar flow and publishes exactly two 200 by 200 variants', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image(), true);
  expect(uploaded.status).toBe(200);
  const url = uploaded.json().data.url;
  expect(url).toMatch(/^\/uploads\/avatars\/[a-f0-9]{64}\/original\.jpg$/);
  const keys = await fixture.store.list(url.slice('/uploads/'.length).replace('original.jpg', ''));
  expect(keys.map(key => key.split('/').at(-1))).toEqual(['manifest.json', 'original.jpg', 'original.webp']);
  expect(await sharp((await mediaHttp(fixture.primary, url)).bytes).metadata()).toMatchObject({ width: 200, height: 200 });
  const absent = await mediaHttp(fixture.primary, url.replace('original.jpg', 'thumb.jpg'));
  expect(absent.status).toBe(404); expect(absent.headers['cache-control']).toBe('no-store');
});
it('A local development backend serves the same canonical media contract', async () => {
  const node = await fixture.start({ UPLOAD_STORAGE_BACKEND: 'local' });
  const uploaded = await fixture.upload(node, await image());
  expect(uploaded.status).toBe(200);
  expect((await mediaHttp(node, uploaded.json().data.url)).status).toBe(200);
});
it('C successful media has a strong content ETag and immutable security headers', async () => {
  const uploaded = await fixture.upload(fixture.primary, await image());
  const response = await mediaHttp(fixture.primary, uploaded.json().data.url);
  expect(response.status).toBe(200);
  expect(response.headers.etag).toBe(`"${mediaSha256(response.bytes)}"`);
  expect(response.headers['content-length']).toBe(String(response.bytes.length));
  expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
});
it('C absent manifests hide partially written objects through real HTTP', async () => {
  const bytes = await image();
  const manifest = Buffer.from(JSON.stringify({ files: [{ name: 'original.png', mime: 'image/png', size: bytes.length, sha256: mediaSha256(bytes) }] }));
  const hash = mediaSha256(manifest), key = `products/${hash}/original.png`;
  await fixture.store.put(key, bytes, 'image/png');
  const hidden = await mediaHttp(fixture.primary, `/uploads/${key}`);
  expect(hidden.status).toBe(404); expect(hidden.headers['cache-control']).toBe('no-store');
  await fixture.store.put(`products/${hash}/manifest.json`, manifest, 'application/json');
  expect((await mediaHttp(fixture.primary, `/uploads/${key}`)).bytes).toEqual(bytes);
});
it('C old UUID paths have no alias or legacy read', async () => {
  const response = await mediaHttp(fixture.primary, '/uploads/products/old-uuid.jpg');
  expect(response.status).toBe(404); expect(response.json().error.code).toBe('NOT_FOUND');
  expect(response.headers['cache-control']).toBe('no-store');
});
it('C real S3 relay outage returns typed 503 with Retry-After on reads and uploads', async () => {
  const relay = await tcpRelay(process.env.UPLOAD_S3_ENDPOINT!, 80);
  try {
    const node = await fixture.start({ UPLOAD_S3_ENDPOINT: relay.url });
    const uploaded = await fixture.upload(node, await image()); expect(uploaded.status).toBe(200);
    relay.drop();
    for (const response of [await mediaHttp(node, uploaded.json().data.url), await fixture.upload(node, await image())]) {
      expect(response.status).toBe(503); expect(response.json().error.code).toBe('UPLOAD_STORAGE_UNAVAILABLE');
      expect(response.headers['cache-control']).toBe('no-store'); expect(response.headers['retry-after']).toBe('5');
      expect(response.bytes.toString()).not.toMatch(/secret|credential|bucket|127\.0\.0\.1/i);
    }
    relay.recover();
    expect((await mediaHttp(node, uploaded.json().data.url)).status).toBe(200);
  } finally { relay.recover(); await relay.close(); }
}, 60000);
for (const fault of ['size', 'sha256', 'missing-object', 'manifest'] as const) {
  it(`D ${fault} corruption never serves stored media bytes`, async () => {
    const uploaded = await fixture.upload(fixture.primary, await image());
    let url = uploaded.json().data.url;
    const key = url.slice('/uploads/'.length);
    if (fault === 'missing-object') {
      const manifest = Buffer.from(JSON.stringify({ files: [{ name: 'original.jpg', mime: 'image/jpeg', size: 10, sha256: mediaSha256(await image()) }] }));
      const hash = mediaSha256(manifest);
      await fixture.store.put(`products/${hash}/manifest.json`, manifest, 'application/json');
      url = `/uploads/products/${hash}/original.jpg`;
    } else if (fault === 'manifest') await fixture.store.put(key.replace('original.jpg', 'manifest.json'), Buffer.from('{}'), 'application/json');
    else {
      const original = await fixture.store.get(key);
      const changed = fault === 'sha256' ? Buffer.from(original!) : Buffer.from('bad');
      if (fault === 'sha256') changed[0] ^= 1;
      await fixture.store.put(key, changed, 'image/jpeg');
    }
    const response = await mediaHttp(fixture.primary, url);
    expect(response.status).toBe(500); expect(response.json().error.code).toBe('UPLOAD_STORAGE_CORRUPT');
    expect(response.headers['cache-control']).toBe('no-store'); expect(response.headers.etag).toBeUndefined();
    expect(response.headers['content-type']).toContain('application/json');
  });
}
it('D local stored byte tampering is detected over real HTTP', async () => {
  const node = await fixture.start({ UPLOAD_STORAGE_BACKEND: 'local' });
  const uploaded = await fixture.upload(node, await image());
  await new LocalUploadedObjectStore(node.localRoot).put(uploaded.json().data.url.slice('/uploads/'.length), Buffer.from('corrupt'), 'image/jpeg');
  const response = await mediaHttp(node, uploaded.json().data.url);
  expect(response.status).toBe(500); expect(response.json().error.code).toBe('UPLOAD_STORAGE_CORRUPT');
});
