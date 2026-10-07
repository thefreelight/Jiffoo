import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { themeFixture, themeFiles, zipTheme, themeHttp, png, font, waitThemeMessage, releaseTheme } from '../helpers/theme-package-fixture';

let fixture: Awaited<ReturnType<typeof themeFixture>>;
beforeAll(async () => { fixture = await themeFixture(); }, 60000);
afterAll(async () => { await fixture?.close(); }, 60000);
const asset = (slug: string, hash: string, file = 'assets/hero.png') => `/api/v1/themes/${slug}/${hash}/${file}`;
function typed(response: Awaited<ReturnType<typeof themeHttp>>, status: number, code: string) {
  expect(response.status, response.bytes.toString()).toBe(status); expect(response.json().error.code).toBe(code);
  expect(response.headers['cache-control']).toBe('no-store');
  if (status === 503) expect(response.headers['retry-after']).toBe('5');
}

it('A real HTTP installation persists the exact archive and remains inactive', async () => {
  const { slug, bytes, record } = await fixture.install();
  expect(record.packageHash).toBe(createHash('sha256').update(bytes).digest('hex'));
  const blob = await fixture.prisma.themePackageBlob.findUniqueOrThrow({ where: { themeSlug_packageHash: { themeSlug: slug, packageHash: record.packageHash } } });
  expect(Buffer.from(blob.bytes).equals(bytes)).toBe(true); expect(blob.sizeBytes).toBe(bytes.length);
  expect(await fixture.prisma.themeActive.count({ where: { slug } })).toBe(0);
});
it('A real HTTP upload enforces authentication and unsigned confirmation without persisting a theme', async () => {
  const slug = `b4-${randomUUID().slice(0, 12)}`; fixture.slugs.push(slug);
  const bytes = await zipTheme(await themeFiles(slug));
  typed(await themeHttp(fixture.primary, '/api/v1/extensions/theme/install', 'POST', bytes, { 'Content-Type': 'application/zip' }), 401, 'UNAUTHORIZED');
  typed(await fixture.upload(fixture.primary, bytes, false), 400, 'UNSIGNED_CONFIRMATION_REQUIRED');
  expect(await fixture.prisma.theme.count({ where: { slug } })).toBe(0); expect(await fixture.prisma.themePackageBlob.count({ where: { themeSlug: slug } })).toBe(0);
});
it('A invalid ZIP fails through real HTTP without persisting bytes or metadata', async () => {
  const before = await fixture.prisma.themePackageBlob.count();
  typed(await fixture.upload(fixture.primary, Buffer.from('not a zip')), 400, 'THEME_INVALID_ZIP');
  expect(await fixture.prisma.themePackageBlob.count()).toBe(before);
});
it('A an expired real lease fences publication without committing theme blob pointer or audit', async () => {
  const child = await fixture.start('http', 'lease');
  const slug = `b4-${randomUUID().slice(0, 12)}`; fixture.slugs.push(slug);
  const pending = fixture.upload(child, await zipTheme(await themeFiles(slug)));
  const latch = await waitThemeMessage(child, message => message.kind === 'theme-barrier' && message.slug === slug);
  await fixture.prisma.pluginOperationLease.update({ where: { slug: `theme:package:${slug}` }, data: { expiresAt: new Date(0) } });
  releaseTheme(child, latch); typed(await pending, 409, 'THEME_OPERATION_LEASE_LOST');
  expect(await fixture.prisma.theme.count({ where: { slug } })).toBe(0);
  expect(await fixture.prisma.themePackageBlob.count({ where: { themeSlug: slug } })).toBe(0);
  expect(await fixture.prisma.adminAuditEvent.count({ where: { targetId: slug } })).toBe(0);
});
it('C hash-addressed image and font bytes have strong ETags immutable cache and nosniff', async () => {
  const { slug, record } = await fixture.install();
  for (const [file, bytes, type] of [['assets/hero.png', png, 'image/png'], ['fonts/brand.woff2', font, 'font/woff2']] as const) {
    const response = await themeHttp(fixture.primary, asset(slug, record.packageHash, file));
    expect(response.status).toBe(200); expect(response.bytes.equals(bytes)).toBe(true);
    expect(response.headers['content-type']).toContain(type); expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers.etag).toBe(`"${createHash('sha256').update(bytes).digest('hex')}"`);
  }
});
it('C conditional hash-addressed reads return 304 for the exact strong ETag', async () => {
  const { slug, record } = await fixture.install(), url = asset(slug, record.packageHash);
  const first = await themeHttp(fixture.primary, url);
  const cached = await themeHttp(fixture.primary, url, 'GET', undefined, { 'If-None-Match': String(first.headers.etag) });
  expect(cached.status).toBe(304); expect(cached.bytes.length).toBe(0); expect(cached.headers.etag).toBe(first.headers.etag);
});
it('C unknown hashes unsafe paths and semver aliases are rejected without immutable error caching', async () => {
  const { slug, record } = await fixture.install();
  typed(await themeHttp(fixture.primary, asset(slug, 'f'.repeat(64))), 404, 'THEME_ASSET_NOT_FOUND');
  typed(await themeHttp(fixture.primary, asset(slug, '1.0.0')), 400, 'VALIDATION_ERROR');
  typed(await themeHttp(fixture.primary, asset(slug, record.packageHash, 'theme.json')), 404, 'THEME_ASSET_NOT_FOUND');
});
it('C hard uninstall deletes every blob and never revives an old URL from a warm local cache', async () => {
  const { slug, record } = await fixture.install();
  expect((await themeHttp(fixture.primary, asset(slug, record.packageHash))).status).toBe(200);
  expect((await fixture.mutate(fixture.primary, `/api/v1/extensions/theme/${slug}`, 'DELETE')).status).toBe(200);
  expect(await fixture.prisma.themePackageBlob.count({ where: { themeSlug: slug } })).toBe(0);
  typed(await themeHttp(fixture.primary, asset(slug, record.packageHash)), 404, 'THEME_ASSET_NOT_FOUND');
});
it('D a missing current blob returns typed retryable 503 even with a local cache', async () => {
  const { slug, record } = await fixture.install();
  await fixture.prisma.themePackageBlob.deleteMany({ where: { themeSlug: slug } });
  typed(await themeHttp(fixture.primary, asset(slug, record.packageHash)), 503, 'THEME_PACKAGE_UNAVAILABLE');
});
it('D corrupt persisted length or hash returns sanitized 500 on a real cold instance', async () => {
  const { slug, record } = await fixture.install(), cold = await fixture.start();
  await fixture.prisma.themePackageBlob.update({ where: { themeSlug_packageHash: { themeSlug: slug, packageHash: record.packageHash } }, data: { bytes: Buffer.from('corrupt') } });
  typed(await themeHttp(cold, asset(slug, record.packageHash)), 500, 'THEME_PACKAGE_CORRUPT');
});
it('D a valid archive hash with mismatched manifest identity is a package corruption error', async () => {
  const { slug, record } = await fixture.install(), cold = await fixture.start();
  const bytes = await zipTheme(await themeFiles('another-theme')), hash = createHash('sha256').update(bytes).digest('hex');
  await fixture.prisma.themePackageBlob.create({ data: { themeSlug: slug, packageHash: hash, bytes, sizeBytes: bytes.length } });
  typed(await themeHttp(cold, asset(slug, hash)), 500, 'THEME_PACKAGE_CORRUPT');
  expect(record.packageHash).not.toBe(hash);
});
it('D a real held materialization returns typed 503 and the released flight serves the next request', async () => {
  const { slug, record } = await fixture.install(), cold = await fixture.start('http', 'materialize');
  const pending = themeHttp(cold, asset(slug, record.packageHash));
  const latch = await waitThemeMessage(cold, message => message.kind === 'theme-barrier' && message.slug === slug);
  try { typed(await pending, 503, 'THEME_PACKAGE_MATERIALIZATION_TIMEOUT'); }
  finally { releaseTheme(cold, latch); }
  expect((await themeHttp(cold, asset(slug, record.packageHash))).bytes.equals(png)).toBe(true);
}, 30000);
