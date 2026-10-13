import { afterEach, beforeEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { themeFixture, themeHttp, zipTheme } from '../helpers/theme-package-fixture';
let fixture: Awaited<ReturnType<typeof themeFixture>>;
let priorConfigs: Awaited<ReturnType<Awaited<ReturnType<typeof themeFixture>>['prisma']['themeConfiguration']['findMany']>>;
beforeEach(async () => {
  fixture = await themeFixture();
  priorConfigs = await fixture.prisma.themeConfiguration.findMany({ where: { slug: { in: ['default-admin', 'default-shop'] } } });
}, 60000);
afterEach(async () => {
  try { await fixture?.close(); }
  finally {
    if (fixture) {
      await fixture.prisma.themeConfiguration.deleteMany({ where: { slug: { in: ['default-admin', 'default-shop'] } } });
      for (const config of priorConfigs ?? []) await fixture.prisma.themeConfiguration.create({ data: config });
    }
  }
}, 60000);
const activate = async (slug: string, target: 'admin' | 'shop') => {
  expect((await fixture.mutate(fixture.primary, `/api/v1/extensions/themes/${target}/activate`, 'POST', { slug })).status).toBe(200);
};
it('a real API replaces uploaded v1 active packages for both targets, audits and retains bytes', async () => {
  const owned = [];
  for (const target of ['admin', 'shop'] as const) {
    const item = await fixture.install(fixture.primary, target); await activate(item.slug, target);
    const manifest = JSON.parse(item.files.get('theme.json')!.toString()); manifest.schemaVersion = 1;
    const files = new Map(item.files); files.set('theme.json', Buffer.from(JSON.stringify(manifest)));
    const bytes = await zipTheme(files), packageHash = createHash('sha256').update(bytes).digest('hex');
    await fixture.prisma.theme.update({ where: { slug: item.slug }, data: { manifestJson: manifest, packageHash } });
    await fixture.prisma.themePackageBlob.create({ data: { themeSlug: item.slug, packageHash, bytes: new Uint8Array(bytes), sizeBytes: bytes.length } });
    await fixture.prisma.themeActive.update({ where: { target }, data: { packageHash } });
    owned.push({ ...item, target, bytes, packageHash });
  }
  const node = await fixture.start('startup-api');
  for (const item of owned) {
    const response = await themeHttp(node, `/api/v1/store/theme?target=${item.target}&locale=en`);
    expect(response.status).toBe(200);
    expect(response.json().data).toMatchObject({ schemaVersion: 2, slug: `default-${item.target}`, darkAvailable: item.target === 'admin' });
    expect((await fixture.prisma.theme.findUniqueOrThrow({ where: { slug: item.slug } })).manifestJson).toMatchObject({ schemaVersion: 1 });
    expect(Buffer.from((await fixture.prisma.themePackageBlob.findUniqueOrThrow({ where: { themeSlug_packageHash: { themeSlug: item.slug, packageHash: item.packageHash } } })).bytes).equals(item.bytes)).toBe(true);
    expect(await fixture.prisma.adminAuditEvent.count({ where: { action: 'theme.startup_fallback', targetId: `default-${item.target}` } })).toBeGreaterThan(0);
  }
}, 120000);
it('a real API ignores invalid persisted setting values without deleting configuration or revisions', async () => {
  const item = await fixture.install();
  const manifest = JSON.parse(item.files.get('theme.json')!.toString());
  manifest.settings.push({ id: 'primary', type: 'color', label: { en: 'Primary', 'zh-Hans': 'Primary', 'zh-Hant': 'Primary' }, default: '#abcdef', constraints: {}, bindsToken: 'extras.primary' });
  manifest.version = '1.0.1'; const files = new Map(item.files); files.set('theme.json', Buffer.from(JSON.stringify(manifest)));
  expect((await fixture.upload(fixture.primary, await zipTheme(files))).status).toBe(200);
  await activate(item.slug, 'shop');
  const values = { primary: 'url(https://example.com)', removed: 'preserve', picture: 'assets/missing.png', $homeSections: [{ type: 'script' }] };
  await fixture.prisma.themeConfiguration.create({ data: { slug: item.slug, revision: 7, values } });
  await fixture.prisma.themeConfigRevision.create({ data: { slug: item.slug, revision: 7, values } });
  const before = await fixture.prisma.themeConfiguration.findUniqueOrThrow({ where: { slug: item.slug } });
  const node = await fixture.start('startup-api');
  const response = await themeHttp(node, '/api/v1/store/theme?target=shop&locale=en');
  expect(response.status).toBe(200);
  expect(response.json().data).toMatchObject({ slug: item.slug, tokens: { extras: { primary: '#abcdef' } }, darkAvailable: false });
  expect(await fixture.prisma.themeConfiguration.findUniqueOrThrow({ where: { slug: item.slug } })).toEqual(before);
  expect((await fixture.prisma.themeConfigRevision.findUniqueOrThrow({ where: { slug_revision: { slug: item.slug, revision: 7 } } })).values).toEqual(values);
}, 120000);
it('startup reinstalls both v2 builtin versions over stored v1 builtin records without removing config', async () => {
  const first = await fixture.start('startup-api');
  for (const target of ['admin', 'shop'] as const) {
    const slug = `default-${target}`;
    const stored = await fixture.prisma.theme.findUniqueOrThrow({ where: { slug } });
    await fixture.prisma.theme.update({ where: { slug }, data: { version: '1.0.0', packageHash: '1'.repeat(64), manifestJson: { ...stored.manifestJson as object, schemaVersion: 1 } } });
    await fixture.prisma.themeConfiguration.upsert({ where: { slug }, create: { slug, revision: 0, values: { retired: 'keep' } }, update: { values: { retired: 'keep' } } });
  }
  const node = await fixture.start('startup-api');
  for (const target of ['admin', 'shop'] as const) {
    const slug = `default-${target}`;
    expect(await fixture.prisma.theme.findUniqueOrThrow({ where: { slug } })).toMatchObject({ version: '2.0.0', manifestJson: { schemaVersion: 2 } });
    expect((await fixture.prisma.themeConfiguration.findUniqueOrThrow({ where: { slug } })).values).toEqual({ retired: 'keep' });
    expect((await themeHttp(node, `/api/v1/store/theme?target=${target}&locale=en`)).status).toBe(200);
  }
  expect(first.child.exitCode).toBeNull();
}, 120000);
