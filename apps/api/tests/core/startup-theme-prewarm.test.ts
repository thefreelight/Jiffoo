import { afterEach, beforeEach, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { themeFixture, themeHttp, startThemeChild } from '../helpers/theme-package-fixture';

let fixture: Awaited<ReturnType<typeof themeFixture>>;
beforeEach(async () => { fixture = await themeFixture(); }, 60000);
afterEach(async () => { await fixture?.close(); }, 60000);
async function activate(slug: string, target = 'shop') {
  const response = await fixture.mutate(fixture.primary, `/api/v1/extensions/themes/${target}/activate`, 'POST', { slug });
  expect(response.status).toBe(200);
}
const marker = (root: string, slug: string, hash: string) => fs.readFile(path.join(root, 'themes', slug, hash, '.complete.json'), 'utf8');

it('G a real API prewarms both active targets before its first theme request', async () => {
  const shop = await fixture.install(), admin = await fixture.install(fixture.primary, 'admin'); await activate(shop.slug); await activate(admin.slug, 'admin');
  const node = await fixture.start('startup-api');
  for (const installed of [shop, admin]) expect(await marker(node.root, installed.slug, installed.record.packageHash)).toBe(JSON.stringify({ slug: installed.slug, packageHash: installed.record.packageHash }));
  expect((await themeHttp(node, '/api/v1/store/theme?target=shop&locale=en')).json().data.packageHash).toBe(shop.record.packageHash);
});
it('G two APIs and two read-only workers prewarm shared active themes in four separate local roots', async () => {
  const shop = await fixture.install(), admin = await fixture.install(fixture.primary, 'admin'); await activate(shop.slug); await activate(admin.slug, 'admin');
  const before = await fixture.prisma.themeActive.findMany({ orderBy: { target: 'asc' } });
  const nodes = await Promise.all(['startup-api', 'startup-api', 'worker', 'worker'].map(role => fixture.start(role)));
  expect(new Set(nodes.map(node => node.root)).size).toBe(4);
  for (const node of nodes) for (const installed of [shop, admin]) expect(await marker(node.root, installed.slug, installed.record.packageHash)).toBe(JSON.stringify({ slug: installed.slug, packageHash: installed.record.packageHash }));
  for (const node of nodes.slice(0, 2)) for (const [target, installed] of [['shop', shop], ['admin', admin]] as const) {
    const response = await themeHttp(node, `/api/v1/store/theme?target=${target}&locale=en`);
    expect(response.status).toBe(200); expect(response.json().data.packageHash).toBe(installed.record.packageHash);
  }
  expect(await fixture.prisma.themeActive.findMany({ orderBy: { target: 'asc' } })).toEqual(before);
}, 120000);
it('G missing active bytes are best-effort at startup and remain typed 503 on HTTP reads', async () => {
  const installed = await fixture.install(); await activate(installed.slug);
  await fixture.prisma.themePackageBlob.deleteMany({ where: { themeSlug: installed.slug } });
  const node = await fixture.start('startup-api');
  expect(node.output.join('')).toContain('Theme package startup prewarm failed');
  const response = await themeHttp(node, '/api/v1/store/theme?target=shop&locale=en');
  expect(response.status).toBe(503); expect(response.json().error.code).toBe('THEME_PACKAGE_UNAVAILABLE');
  expect((await fixture.prisma.themeActive.findUniqueOrThrow({ where: { target: 'shop' } })).slug).toBe(installed.slug);
});
it('G a corrupt startup flight publishes nothing and retries after the exact persisted bytes are repaired', async () => {
  const installed = await fixture.install(); await activate(installed.slug);
  await fixture.prisma.themePackageBlob.updateMany({ where: { themeSlug: installed.slug }, data: { bytes: Buffer.from('corrupt') } });
  const node = await fixture.start('startup-api');
  const failed = await themeHttp(node, '/api/v1/store/theme?target=shop&locale=en'); expect(failed.status).toBe(500); expect(failed.json().error.code).toBe('THEME_PACKAGE_CORRUPT');
  expect(await fs.access(path.join(node.root, 'themes', installed.slug, installed.record.packageHash)).then(() => true, () => false)).toBe(false);
  await fixture.prisma.themePackageBlob.updateMany({ where: { themeSlug: installed.slug }, data: { bytes: installed.bytes } });
  expect((await themeHttp(node, '/api/v1/store/theme?target=shop&locale=en')).status).toBe(200);
  expect(await marker(node.root, installed.slug, installed.record.packageHash)).toBe(JSON.stringify({ slug: installed.slug, packageHash: installed.record.packageHash }));
});
it('G API and worker reject the theme test barrier outside the test environment at startup', async () => {
  for (const role of ['startup-api', 'worker']) await expect(startThemeChild(role, 'publish', {
    NODE_ENV: 'production', JWT_SECRET: 'b4-production-safety-secret-at-least-32-characters', STOREFRONT_URL: 'http://127.0.0.1:3003',
    ADMIN_URL: 'http://127.0.0.1:3002', CORS_ORIGIN: 'http://127.0.0.1:3002', DISABLE_RATE_LIMITER: 'false',
  })).rejects.toThrow('Theme test barriers require NODE_ENV=test');
});
