import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { getPluginManifestIssues } from 'shared';
import { buildPluginUiAssetIndex, readPluginZipEntries } from 'shared/plugin-signing';
import { mapApiError } from '@/utils/api-errors';
import { validatePluginManifest } from '@/core/admin/extension-installer/utils';
import { pageManifest, pageFiles, symlinkDirectoryZip } from '../fixtures/plugin-pages';

describe('P-1 plugin page, task and service declarations', () => {
  it('accepts declarations without adding runtime capabilities', () => {
    expect(getPluginManifestIssues(pageManifest())).toEqual([]);
  });
  it.each([
    ['ui.bridgeVersion', 2], ['ui.unknown', true], ['ui.assetDirectory', '../ui'], ['ui.assetDirectory', 'server/ui'],
    ['ui.assetDirectory', 'migrations/ui'], ['ui.assetDirectory', 'META-INF/ui'], ['ui.assetDirectory', '/ui'],
    ['ui.storefrontPages.0.id', 'Invalid'], ['ui.storefrontPages.0.entry', '../index.html'],
    ['ui.storefrontPages.0.title.en', '<b>Title</b>'], ['ui.storefrontPages.0.title.en', ''],
    ['ui.storefrontPages.0.title.en', 'x'.repeat(81)], ['ui.storefrontPages.0.title.other', 'Title'],
    ['ui.storefrontPages.0.requiresLogin', 'true'], ['ui.storefrontPages.0.placements', ['header-nav', 'header-nav']],
    ['ui.adminPages.0.requiresLogin', false], ['ui.adminPages.0.placements', []],
    ['tasks.0.version', 1.5], ['tasks.0.concurrency', 17], ['tasks.0.maxAttempts', 21],
    ['tasks.0.name', { toString: 'blocked', valueOf: 'blocked' }], ['tasks.0.version', { toString: 'blocked', valueOf: 'blocked' }],
    ['services.0.name', { toString: 'blocked', valueOf: 'blocked' }], ['services.0.version', { toString: 'blocked', valueOf: 'blocked' }],
    ['serviceDependencies.0.plugin', { toString: 'blocked', valueOf: 'blocked' }],
    ['serviceDependencies.0.service', { toString: 'blocked', valueOf: 'blocked' }],
    ['serviceDependencies.0.version', { toString: 'blocked', valueOf: 'blocked' }],
    ['tasks.0.maxRuntimeSeconds', 601], ['tasks.0.onFinalFailure.maxRuntimeSeconds', 61], ['tasks.0.onFinalFailure.extra', true],
    ['services.0.methods.0.unknown', true], ['services.0.version', 0], ['services.0.methods.0.schema', 'services/../bad.json'],
    ['services.0.methods.0.idempotencyRequired', 'yes'], ['serviceDependencies.0.plugin', '*'],
    ['serviceDependencies.0.plugin', 'page-fixture'], ['serviceDependencies.0.methods', []], ['serviceDependencies.0.extra', true],
  ])('rejects malformed or unknown field %s', (path, value) => {
    const manifest = pageManifest();
    const parts = path.split('.');
    let target: any = manifest;
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts.at(-1)!] = value;
    expect(getPluginManifestIssues(manifest).length).toBeGreaterThan(0);
    expect(() => validatePluginManifest(manifest)).toThrow();
  });
  it.each(['/a/../b', '/a//b', '/a/', '/%2f', '/a?b', '/a#b', '/a\\b', '/*', '/Upper'])('rejects nonliteral path %s', value => {
    const manifest = pageManifest(); manifest.ui!.storefrontPages[0].path = value;
    expect(getPluginManifestIssues(manifest)[0].code).toBe('PLUGIN_UI_MANIFEST_INVALID');
  });
  it.each(['storefrontPages', 'adminPages', 'tasks', 'services', 'serviceDependencies'])('rejects duplicate %s and count overflow', field => {
    const manifest = pageManifest();
    const target: any = field.endsWith('Pages') ? manifest.ui : manifest;
    const item = target[field][0]; target[field] = [item, item];
    expect(getPluginManifestIssues(manifest).length).toBeGreaterThan(0);
    const cap = field.endsWith('Pages') ? 20 : 32;
    const distinct = (index: number) => field.endsWith('Pages') ? { ...item, id: `page-${index}`, path: `/page-${index}` } : { ...item, version: index + 1 };
    target[field] = Array.from({ length: cap }, (_, index) => distinct(index));
    expect(getPluginManifestIssues(manifest)).toEqual([]);
    target[field].push(distinct(cap));
    expect(getPluginManifestIssues(manifest).length).toBeGreaterThan(0);
  });
  it('rejects duplicate exported methods and duplicate paths with distinct page IDs', () => {
    const manifest = pageManifest();
    manifest.services![0].methods.push({ ...manifest.services![0].methods[0] });
    expect(getPluginManifestIssues(manifest)[0].code).toBe('PLUGIN_SERVICE_DEPENDENCY_INVALID');
    manifest.services![0].methods.pop();
    manifest.ui!.storefrontPages.push({ ...manifest.ui!.storefrontPages[0], id: 'another-page' });
    expect(getPluginManifestIssues(manifest)[0].code).toBe('PLUGIN_UI_MANIFEST_INVALID');
  });
  it('accepts the root route and the hard task limit boundaries', () => {
    const manifest = pageManifest(); manifest.ui!.storefrontPages[0].path = '/';
    Object.assign(manifest.tasks![0], { concurrency: 16, maxAttempts: 20, maxRuntimeSeconds: 600, onFinalFailure: { maxRuntimeSeconds: 60 } });
    expect(getPluginManifestIssues(manifest)).toEqual([]);
  });
});

describe('P-1 byte-derived UI asset index', () => {
  it('rejects symlink metadata even when an unsigned ZIP entry has a directory suffix', async () => {
    const bytes = await symlinkDirectoryZip();
    expect(() => readPluginZipEntries(bytes, true)).toThrow('PACKAGE_CONTENT_MISMATCH');
  });
  it.each([
    ['js', Buffer.from('export default 1')], ['css', Buffer.from('body{}')], ['html', Buffer.from('<html></html>')],
    ['json', Buffer.from('{}')], ['woff2', Buffer.from('wOF2')], ['.js', Buffer.from('export default 1')],
  ])('rejects a resource without a file extension: %s', (path, content) => {
    expect(() => buildPluginUiAssetIndex(pageManifest(), [...pageFiles(), { path: `ui/${path}`, content }])).toThrow('PLUGIN_UI_ASSET_INVALID');
  });
  it('indexes only UI bytes with stable paths, exact digests, MIME and sizes', () => {
    const files = pageFiles();
    const index = buildPluginUiAssetIndex(pageManifest(), files);
    expect(index.map(file => file.path)).toEqual(['admin.html', 'assets/app.js', 'assets/chunk.js', 'assets/data.json', 'assets/font.woff2', 'assets/style.css', 'index.html']);
    for (const item of index) {
      const bytes = files.find(file => file.path === `ui/${item.path}`)!.content;
      expect(item.size).toBe(bytes.length); expect(item.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
    expect(index.find(file => file.path.endsWith('.woff2'))!.mime).toBe('font/woff2');
    expect(index.find(file => file.path.endsWith('.js'))!.mime).toBe('text/javascript');
  });
  it.each(['image.svg', 'app.js.map', 'source.ts', 'index.d.ts', 'addon.node', 'file.constructor', 'file.__proto__', '../escape.js', '%2e%2e/escape.js', 'bad\\path.js', 'bad*.js'])('rejects %s', path => {
    expect(() => buildPluginUiAssetIndex(pageManifest(), [...pageFiles(), { path: `ui/${path}`, content: Buffer.from('x') }])).toThrow('PLUGIN_UI_ASSET_INVALID');
  });
  it('rejects case-folded collisions, symlinks, missing entries and disguised content', () => {
    const extra = (path: string, content: Buffer, mode?: number) => [...pageFiles(), { path, content, mode }];
    expect(() => buildPluginUiAssetIndex(pageManifest(), extra('ui/INDEX.html', Buffer.from('<html></html>')))).toThrow('PLUGIN_UI_ASSET_INVALID');
    expect(() => buildPluginUiAssetIndex(pageManifest(), extra('ui/Assets/other.js', Buffer.from('export default 1')))).toThrow('PLUGIN_UI_ASSET_INVALID');
    expect(() => buildPluginUiAssetIndex(pageManifest(), [...pageFiles(), ...['folder.js', 'folder.js-extra.js', 'folder.js/child.js']
      .map(path => ({ path: `ui/${path}`, content: Buffer.from('export default 1') }))])).toThrow('PLUGIN_UI_ASSET_INVALID');
    expect(() => buildPluginUiAssetIndex(pageManifest(), extra('ui/link.js', Buffer.from('x'), 0o120777))).toThrow('PLUGIN_UI_ASSET_INVALID');
    expect(() => buildPluginUiAssetIndex(pageManifest(), extra('ui/false-font.woff2', Buffer.from([247, 79, 70, 50])))).toThrow('PLUGIN_UI_ASSET_INVALID');
    expect(() => buildPluginUiAssetIndex(pageManifest(), pageFiles().filter(file => file.path !== 'ui/index.html'))).toThrow('PLUGIN_UI_ASSET_INVALID');
    for (const [name, content] of [['photo.png', '<svg/>'], ['photo.jpg', 'GIF89a'], ['code.js', '<html></html>'], ['font.woff2', 'font'], ['data.json', 'not json'], ['code.css', '\u007fELF'], ['document.html', '%PDF-1.7\n']] as const)
      expect(() => buildPluginUiAssetIndex(pageManifest(), extra(`ui/${name}`, Buffer.from(content)))).toThrow('PLUGIN_UI_ASSET_INVALID');
  });
  it.each([
    ['resource.js', 5 * 1024 * 1024 + 1], ['page.html', 1024 * 1024 + 1], ['font.woff2', 2 * 1024 * 1024 + 1],
  ])('rejects per-resource overflow %s', (name, size) => {
    expect(() => buildPluginUiAssetIndex(pageManifest(), [...pageFiles(), { path: `ui/${name}`, content: Buffer.alloc(size, 32) }])).toThrow('PLUGIN_UI_ASSET_TOO_LARGE');
  });
  it('enforces aggregate, font and file count limits', () => {
    const files = pageFiles();
    for (const extra of [
      Array.from({ length: 5 }, (_, i) => ({ path: `ui/${i}.js`, content: Buffer.alloc(5 * 1024 * 1024, 32) })),
      Array.from({ length: 3 }, (_, i) => ({ path: `ui/${i}.woff2`, content: Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(2 * 1024 * 1024 - 4)]) })),
      Array.from({ length: 512 }, (_, i) => ({ path: `ui/${i}.js`, content: Buffer.from('') })),
    ]) expect(() => buildPluginUiAssetIndex(pageManifest(), [...files, ...extra])).toThrow('PLUGIN_UI_ASSET_TOO_LARGE');
  });
  it('uses the public 422 and 413 error catalogue', () => {
    for (const [path, bytes, status, code] of [['bad.svg', Buffer.from('<svg/>'), 422, 'PLUGIN_UI_ASSET_INVALID'], ['huge.js', Buffer.alloc(5 * 1024 * 1024 + 1), 413, 'PLUGIN_UI_ASSET_TOO_LARGE']] as const) {
      try { buildPluginUiAssetIndex(pageManifest(), [...pageFiles(), { path: `ui/${path}`, content: bytes }]); throw new Error('Expected rejection'); }
      catch (error) { expect(mapApiError(error)).toMatchObject({ status, body: { error: { code } } }); }
    }
  });
});
