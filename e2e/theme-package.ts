import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import archiver from 'archiver';

export async function themePackage(forbidden = false, uploadedMedia = false): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((done, fail) => {
    archive.on('end', done);
    archive.on('error', fail);
  });
  const manifest = JSON.parse(await readFile(resolve(__dirname, 'fixtures/themes/test-shop-theme/theme.json'), 'utf8'));
  manifest.layout.pages.home.sections[0].settings.image = 'assets/hero.png';
  manifest.layout.pages.home.sections[0].settings.alt = { en: 'Theme hero', 'zh-Hans': '主题主视觉', 'zh-Hant': '主題主視覺' };
  if (uploadedMedia) {
    manifest.slug = 'e2e-upload-theme';
    manifest.name = 'E2E Upload Theme';
    manifest.settings.push({ id: 'hero-image', type: 'image',
      label: { en: 'Hero image', 'zh-Hans': '主视觉图片', 'zh-Hant': '主視覺圖片' },
      default: 'assets/hero.png', constraints: {} });
    manifest.layout.pages.home.sections[0].settings.image = { $setting: 'hero-image' };
  }
  archive.append(JSON.stringify(manifest), { name: 'theme.json' });
  archive.append(await readFile(resolve(__dirname, 'fixtures/themes/test-admin-logo.png')), { name: 'assets/hero.png' });
  if (forbidden) archive.append('console.log("not allowed")', { name: 'scripts/run.js' });
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}

export async function headerThemePackage(header: {
  variant: 'logo-left' | 'logo-center'; menu: 'inline' | 'drawer'; showSearch: boolean;
}): Promise<{ name: string; buffer: Buffer }> {
  const manifest = JSON.parse(await readFile(resolve(__dirname, '../apps/api/builtin-themes/default-shop/theme.json'), 'utf8'));
  const slug = `e2e-header-${header.variant === 'logo-left' ? 'left' : 'center'}-${header.menu}-${header.showSearch ? 'on' : 'off'}`;
  manifest.slug = slug;
  manifest.name = slug;
  manifest.layout.header = header;
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((done, fail) => {
    archive.on('end', done);
    archive.on('error', fail);
  });
  archive.append(JSON.stringify(manifest), { name: 'theme.json' });
  await archive.finalize();
  await finished;
  return { name: slug, buffer: Buffer.concat(chunks) };
}

export async function adminThemePackage(): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((done, fail) => {
    archive.on('end', done);
    archive.on('error', fail);
  });
  const fixture = (name: string) => resolve(__dirname, 'fixtures/themes', name);
  archive.append(await readFile(fixture('test-admin-theme/theme.json')), { name: 'theme.json' });
  archive.append(await readFile(fixture('test-admin-logo.png')), { name: 'assets/logo.png' });
  archive.append(await readFile(fixture('test-admin-background.png')), { name: 'assets/login.png' });
  archive.append(await readFile(resolve(__dirname, '../apps/admin/app/fonts/outfit-latin-400-normal.woff2')),
    { name: 'fonts/outfit.woff2' });
  archive.append(await readFile(resolve(__dirname, '../apps/admin/app/fonts/OFL.txt')), { name: 'LICENSE' });
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}
