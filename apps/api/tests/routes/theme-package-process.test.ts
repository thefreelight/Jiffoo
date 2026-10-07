import { afterAll, beforeAll, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { themeFixture, themeFiles, zipTheme, themeHttp, png, font, waitThemeMessage, releaseTheme, builtinOperation } from '../helpers/theme-package-fixture';

let fixture: Awaited<ReturnType<typeof themeFixture>>;
let second: Awaited<ReturnType<typeof fixture.start>>;
beforeAll(async () => { fixture = await themeFixture(); second = await fixture.start(); }, 60000);
afterAll(async () => { await fixture?.close(); }, 60000);
const active = (item: typeof second, target = 'shop') => themeHttp(item, `/api/v1/store/theme?target=${target}&locale=en`);
const activate = (item: typeof second, slug: string, target = 'shop') => fixture.mutate(item, `/api/v1/extensions/themes/${target}/activate`, 'POST', { slug });
const asset = (slug: string, hash: string, file = 'assets/hero.png') => `/api/v1/themes/${slug}/${hash}/${file}`;

it('B process A installs and activates a theme that cold process B resolves with byte-exact images and fonts', async () => {
  expect(fixture.primary.root).not.toBe(second.root);
  const { slug, record } = await fixture.install(); expect((await activate(fixture.primary, slug)).status).toBe(200);
  for (const item of [fixture.primary, second]) {
    const response = await active(item); expect(response.status).toBe(200); expect(response.json().data).toMatchObject({ slug, packageHash: record.packageHash });
    expect(response.json().data.fonts[0].url).toBe(asset(slug, record.packageHash, 'fonts/brand.woff2'));
    for (const [file, bytes] of [['assets/hero.png', png], ['fonts/brand.woff2', font]] as const)
      expect((await themeHttp(item, asset(slug, record.packageHash, file))).bytes.equals(bytes)).toBe(true);
  }
  expect(JSON.parse(await fs.readFile(path.join(second.root, 'themes', slug, record.packageHash, '.complete.json'), 'utf8'))).toEqual({ slug, packageHash: record.packageHash });
});
it('B same-slug upgrade commits configuration and active hash together and is seen by both API processes', async () => {
  const { slug, record } = await fixture.install(); await activate(fixture.primary, slug);
  expect((await fixture.mutate(fixture.primary, `/api/v1/extensions/themes/${slug}/config`, 'PUT', { values: { picture: 'assets/hero.png' }, expectedRevision: 0 })).status).toBe(200);
  const bytes = await zipTheme(await themeFiles(slug, 'shop', '1.1.0'));
  const uploaded = await fixture.upload(fixture.primary, bytes); expect(uploaded.status).toBe(200);
  const hash = createHash('sha256').update(bytes).digest('hex'); expect(hash).not.toBe(record.packageHash);
  for (const item of [fixture.primary, second]) expect((await active(item)).json().data).toMatchObject({ slug, version: '1.1.0', packageHash: hash });
  expect(await fixture.prisma.themeActive.findUniqueOrThrow({ where: { target: 'shop' } })).toMatchObject({ slug, packageHash: hash });
  expect(await fixture.prisma.themeConfiguration.findUniqueOrThrow({ where: { slug } })).toMatchObject({ revision: 2, values: { picture: 'assets/hero.png' } });
});
it('B activation through either API is immediately observed by both API processes', async () => {
  const a = await fixture.install(), b = await fixture.install(second);
  for (const [writer, installed] of [[fixture.primary, a], [second, b]] as const) {
    expect((await activate(writer, installed.slug)).status).toBe(200);
    for (const reader of [fixture.primary, second]) expect((await active(reader)).json().data).toMatchObject({ slug: installed.slug, packageHash: installed.record.packageHash });
  }
});
it('C retained old hash bytes remain readable on a new cold process after an active upgrade', async () => {
  const old = await fixture.install(); await activate(fixture.primary, old.slug);
  const changed = Buffer.concat([png, Buffer.from('new image')]);
  const upgraded = await fixture.upload(fixture.primary, await zipTheme(await themeFiles(old.slug, 'shop', '2.0.0', changed))); expect(upgraded.status).toBe(200);
  const cold = await fixture.start();
  expect((await themeHttp(cold, asset(old.slug, old.record.packageHash))).bytes.equals(png)).toBe(true);
  expect((await themeHttp(cold, asset(old.slug, upgraded.json().data.packageHash))).bytes.equals(changed)).toBe(true);
  expect(await fixture.prisma.themePackageBlob.count({ where: { themeSlug: old.slug } })).toBe(2);
});
it('E reads share one atomic publication repair incomplete caches and cap materialization concurrency at two', async () => {
  const { slug, record } = await fixture.install(), cold = await fixture.start('http', 'publish');
  const pending = [themeHttp(cold, asset(slug, record.packageHash)), themeHttp(cold, asset(slug, record.packageHash))];
  const entered = await waitThemeMessage(cold, message => message.kind === 'theme-barrier' && message.slug === slug);
  expect(await fs.access(path.join(cold.root, 'themes', slug, record.packageHash)).then(() => true, () => false)).toBe(false);
  releaseTheme(cold, entered);
  for (const response of await Promise.all(pending)) expect(response.bytes.equals(png)).toBe(true);
  expect(cold.messages.filter(message => message.kind === 'theme-barrier' && message.slug === slug)).toHaveLength(1);
  await fs.unlink(path.join(cold.root, 'themes', slug, record.packageHash, '.complete.json'));
  const repair = themeHttp(cold, asset(slug, record.packageHash));
  const repairedLatch = await waitThemeMessage(cold, message => message.kind === 'theme-barrier' && message.slug === slug && cold.messages.filter(value => value.kind === 'theme-barrier' && value.slug === slug).indexOf(message) === 1);
  releaseTheme(cold, repairedLatch); expect((await repair).status).toBe(200);
  const held = await fixture.start('http', 'materialize');
  const installs = [await fixture.install(), await fixture.install(), await fixture.install()];
  const requests = installs.slice(0, 2).map(value => themeHttp(held, asset(value.slug, value.record.packageHash)));
  const latches = await Promise.all(installs.slice(0, 2).map(value => waitThemeMessage(held, message => message.kind === 'theme-barrier' && message.slug === value.slug)));
  requests.push(themeHttp(held, asset(installs[2].slug, installs[2].record.packageHash)));
  await waitThemeMessage(held, message => message.kind === 'theme-materialize-queued' && message.slug === installs[2].slug);
  expect(held.messages.filter(message => message.kind === 'theme-barrier')).toHaveLength(2);
  releaseTheme(held, latches[0]);
  const third = await waitThemeMessage(held, message => message.kind === 'theme-barrier' && message.slug === installs[2].slug);
  releaseTheme(held, latches[1]); releaseTheme(held, third);
  for (const response of await Promise.all(requests)) expect(response.status).toBe(200);
});
it('E a held package operation returns 409 to another API without changing the installed package', async () => {
  const child = await fixture.start('http', 'lease'), slug = `b4-${randomUUID().slice(0, 12)}`; fixture.slugs.push(slug);
  const bytes = await zipTheme(await themeFiles(slug)), pending = fixture.upload(child, bytes);
  const entered = await waitThemeMessage(child, message => message.kind === 'theme-barrier' && message.slug === slug);
  const conflict = await fixture.upload(second, bytes); expect(conflict.status).toBe(409); expect(conflict.json().error.code).toBe('THEME_OPERATION_IN_PROGRESS');
  expect(await fixture.prisma.theme.count({ where: { slug } })).toBe(0);
  releaseTheme(child, entered); expect((await pending).status).toBe(200);
});
it('E expired lease takeover fences the old publisher and preserves the new publisher package', async () => {
  const child = await fixture.start('http', 'lease'), slug = `b4-${randomUUID().slice(0, 12)}`; fixture.slugs.push(slug);
  const oldBytes = await zipTheme(await themeFiles(slug)), pending = fixture.upload(child, oldBytes);
  const entered = await waitThemeMessage(child, message => message.kind === 'theme-barrier' && message.slug === slug);
  await fixture.prisma.pluginOperationLease.updateMany({ where: { slug: { in: [`theme:target:shop`, `theme:package:${slug}`] } }, data: { expiresAt: new Date(0) } });
  const newBytes = await zipTheme(await themeFiles(slug, 'shop', '2.0.0')), current = await fixture.upload(second, newBytes); expect(current.status).toBe(200);
  releaseTheme(child, entered); const stale = await pending; expect(stale.status).toBe(409); expect(stale.json().error.code).toBe('THEME_OPERATION_LEASE_LOST');
  expect((await fixture.prisma.theme.findUniqueOrThrow({ where: { slug } })).packageHash).toBe(createHash('sha256').update(newBytes).digest('hex'));
  expect(await fixture.prisma.themePackageBlob.count({ where: { themeSlug: slug } })).toBe(1);
});
it('E activation and uninstall cannot race past a held target lease', async () => {
  const { slug, record } = await fixture.install(), child = await fixture.start('http', 'lease');
  const pending = activate(child, slug);
  const entered = await waitThemeMessage(child, message => message.kind === 'theme-barrier' && message.slug === slug);
  try {
    const deletion = await fixture.mutate(second, `/api/v1/extensions/theme/${slug}`, 'DELETE'); expect(deletion.status, deletion.bytes.toString()).toBe(409); expect(deletion.json().error.code).toBe('THEME_OPERATION_IN_PROGRESS');
  } finally { releaseTheme(child, entered); }
  expect((await pending).status).toBe(200);
  expect((await active(second)).json().data).toMatchObject({ slug, packageHash: record.packageHash });
});
it('F builtin archive hash covers image font and license bytes and rejects same-version content changes', async () => {
  const slug = `b4-${randomUUID().slice(0, 12)}`; fixture.slugs.push(slug);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'b4-builtin-'));
  try {
    const files = await themeFiles(slug); files.set('LICENSE', Buffer.from('MIT'));
    for (const [name, bytes] of files) { const file = path.join(directory, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); }
    const first = await builtinOperation(fixture.primary, directory); expect(first.error).toBeUndefined();
    expect((await activate(fixture.primary, slug)).status).toBe(200);
    expect((await active(second)).json().data.packageHash).toBe(first.result.packageHash);
    expect((await themeHttp(second, asset(slug, first.result.packageHash))).bytes.equals(png)).toBe(true);
    for (const name of ['assets/hero.png', 'fonts/brand.woff2', 'LICENSE']) {
      const file = path.join(directory, name), original = await fs.readFile(file); await fs.writeFile(file, Buffer.concat([original, Buffer.from('changed')]));
      const rejected = await builtinOperation(second, directory); expect(rejected.error.code).toBe('THEME_VERSION_CONFLICT');
      expect((await fixture.prisma.theme.findUniqueOrThrow({ where: { slug } })).packageHash).toBe(first.result.packageHash);
      expect((await themeHttp(second, asset(slug, first.result.packageHash))).bytes.equals(png)).toBe(true);
      await fs.writeFile(file, original);
    }
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
it('F builtin archives ignore filesystem time and order and an older release cannot overwrite the newer DB version', async () => {
  const slug = `b4-${randomUUID().slice(0, 12)}`; fixture.slugs.push(slug);
  const a = await fs.mkdtemp(path.join(os.tmpdir(), 'b4-release-a-')), b = await fs.mkdtemp(path.join(os.tmpdir(), 'b4-release-b-'));
  try {
    const files = await themeFiles(slug);
    for (const [root, entries] of [[a, [...files]], [b, [...files].reverse()]] as const) for (const [name, bytes] of entries) {
      const file = path.join(root, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); await fs.utimes(file, new Date(root === a ? 0 : 1000000), new Date(root === a ? 0 : 1000000));
    }
    const first = await builtinOperation(fixture.primary, a), same = await builtinOperation(second, b); expect(same.result.packageHash).toBe(first.result.packageHash);
    const manifest = JSON.parse(files.get('theme.json')!.toString()); manifest.version = '2.0.0'; await fs.writeFile(path.join(a, 'theme.json'), JSON.stringify(manifest));
    const updated = await builtinOperation(fixture.primary, a), old = await builtinOperation(second, b);
    expect(old.result).toMatchObject({ version: '2.0.0', packageHash: updated.result.packageHash });
    expect((await activate(second, slug)).status).toBe(200);
    expect((await active(fixture.primary)).json().data).toMatchObject({ version: '2.0.0', packageHash: updated.result.packageHash });
  } finally { await fs.rm(a, { recursive: true, force: true }); await fs.rm(b, { recursive: true, force: true }); }
});
