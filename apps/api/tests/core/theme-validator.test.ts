import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { validateBuiltinTheme } from '@/core/admin/extension-installer/theme-service';
import { validateThemeFiles, validateThemeZip } from '@/core/admin/extension-installer/theme-validator';

const themeRoot = path.resolve(process.cwd(), 'builtin-themes');
const base = async () => JSON.parse(await fs.readFile(path.join(themeRoot, 'default-shop/theme.json'), 'utf8'));
const files = (manifest: unknown, extra: Record<string, Buffer> = {}) =>
  new Map<string, Buffer>([
    ['theme.json', Buffer.from(JSON.stringify(manifest))],
    ...Object.entries(extra),
  ]);
const rejected = (manifest: unknown, code: string, location: string, extra: Record<string, Buffer> = {}) => {
  try {
    validateThemeFiles(files(manifest, extra));
    throw new Error('Expected a theme validation error');
  } catch (error) {
    expect(error).toMatchObject({ code, details: { path: location } });
  }
};
const zip = async (entries: Array<{ name: string; data: Buffer }>) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
  });
  for (const entry of entries) archive.append(entry.data, { name: entry.name });
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
};

describe('T1a declarative theme validator', () => {
  it('O rejects density in an Admin theme manifest', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(themeRoot, 'default-admin/theme.json'), 'utf8'));
    manifest.tokens.density = 'compact';
    rejected(manifest, 'THEME_SCHEMA_INVALID', '/tokens/density');
  });
  it('I validates both builtin sources and maps the Shop CSS defaults and Admin palette', async () => {
    const shop = await validateBuiltinTheme(path.join(themeRoot, 'default-shop'));
    const admin = await validateBuiltinTheme(path.join(themeRoot, 'default-admin'));
    const css = await fs.readFile(path.resolve(process.cwd(), '../shop/app/default-tokens.css'), 'utf8');
    const mapping = {
      background: 'canvas', surface: 'surface', text: 'ink', 'text-muted': 'subtle',
      border: 'line', primary: 'action', 'primary-foreground': 'action-ink',
      accent: 'highlight', 'radius-md': 'radius', 'card-radius': 'radius',
    };
    for (const [role, token] of Object.entries(mapping)) {
      const canonical = role === 'card-radius' ? 'card-radius' : role;
      const cssValue = new RegExp(`--shop-${canonical}:\\s*([^;]+);`).exec(css)?.[1];
      expect(shop.manifest.tokens[role], role).toBe(cssValue);
      if (token !== canonical) {
        const aliasTarget = token === 'radius' ? 'radius-md' : canonical;
        expect(new RegExp(`--shop-${token}:\\s*var\\(--shop-${aliasTarget}\\);`).test(css), token).toBe(true);
      }
    }
    expect((shop.manifest.layout as { pages: { home: { sections: Array<{ type: string }> } } })
      .pages.home.sections.map((section) => section.type)).toEqual(['category-list', 'product-grid']);
    expect(admin.manifest.tokens).toMatchObject({
      background: '#F8FAFC', surface: '#FFFFFF', primary: '#3B82F6',
      text: '#0F172A', border: '#E2E8F0', 'font-body': 'system-sans',
      'radius-md': '8px',
    });
  });

  it('T2 accepts bounded section presentation options and rejects out-of-range columns', async () => {
    const manifest = await base();
    const grid = manifest.layout.pages.home.sections[1].settings;
    grid.count = 8;
    grid.columns = 3;
    manifest.layout.pages.home.sections.push({
      id: 'story', type: 'image-with-text',
      settings: {
        image: 'assets/story.png',
        alt: { en: 'Story', 'zh-Hans': '故事', 'zh-Hant': '故事' },
        title: { en: 'About', 'zh-Hans': '关于', 'zh-Hant': '關於' },
        body: { en: 'Local', 'zh-Hans': '本地', 'zh-Hant': '本地' },
        position: 'right',
      },
    });
    const assets = { 'assets/story.png': pngBytes() };
    expect(validateThemeFiles(files(manifest, assets)).manifest.layout).toBeDefined();
    grid.columns = 8;
    rejected(manifest, 'THEME_SCHEMA_INVALID', '/layout/pages/home/sections/1/settings/columns', assets);
  });

  it.each(['index.js', 'run.mjs', 'index.cjs', 'index.html', 'index.htm', 'style.css',
    'logo.svg', 'other.json', 'nested.zip', '.hidden', 'unexpected.bin'])(
    'B rejects forbidden entry %s with its name', async (name) => {
      const manifest = await base();
      rejected(manifest, 'THEME_FORBIDDEN_ENTRY', name, { [name]: Buffer.from('data') });
    },
  );

  it('C rejects a script disguised as PNG and a fake woff2', async () => {
    const manifest = await base();
    rejected(manifest, 'THEME_MAGIC_MISMATCH', 'assets/bad.png', {
      'assets/bad.png': Buffer.from('<script>alert(1)</script>'),
    });
    rejected(manifest, 'THEME_MAGIC_MISMATCH', 'fonts/bad.woff2', {
      'fonts/bad.woff2': Buffer.from('fake font'),
    });
  });

  it('D rejects traversal and absolute ZIP paths', async () => {
    const manifest = await base();
    const original = await zip([
      { name: 'theme.json', data: Buffer.from(JSON.stringify(manifest)) },
      { name: 'assets/a.png', data: Buffer.from('invalid') },
    ]);
    for (const name of ['../evil/.png', '/evil/ab.png']) {
      const modified = Buffer.from(original);
      const current = Buffer.from('assets/a.png');
      const replacement = Buffer.from(name);
      expect(replacement.length).toBe(current.length);
      const local = modified.indexOf(current);
      const central = modified.lastIndexOf(current);
      replacement.copy(modified, local);
      replacement.copy(modified, central);
      expect(() => validateThemeZip(modified)).toThrowError(
        expect.objectContaining({ code: 'THEME_UNSAFE_PATH' }),
      );
    }
  });

  it('D rejects ZIP symlinks and case-colliding entries', async () => {
    const manifest = await base();
    const original = await zip([
      { name: 'theme.json', data: Buffer.from(JSON.stringify(manifest)) },
      { name: 'assets/a.png', data: pngBytes() },
    ]);
    const modified = Buffer.from(original);
    const central = modified.indexOf(Buffer.from('504b0102', 'hex'));
    modified.writeUInt32LE(0xa1ff0000, central + 38);
    expect(() => validateThemeZip(modified))
      .toThrowError(expect.objectContaining({ code: 'THEME_SYMLINK' }));
    const collision = await zip([
      { name: 'theme.json', data: Buffer.from(JSON.stringify(manifest)) },
      { name: 'assets/A.png', data: pngBytes() },
      { name: 'assets/a.png', data: pngBytes() },
    ]);
    expect(() => validateThemeZip(collision))
      .toThrowError(expect.objectContaining({ code: 'THEME_DUPLICATE_ENTRY' }));
  });

  it('D rejects oversized package, image, font and excessive entry count', async () => {
    const manifest = await base();
    expect(() => validateThemeZip(Buffer.alloc(20 * 1024 * 1024 + 1)))
      .toThrowError(expect.objectContaining({ code: 'THEME_PACKAGE_TOO_LARGE' }));
    rejected(manifest, 'THEME_FILE_TOO_LARGE', 'assets/huge.png', {
      'assets/huge.png': Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    rejected(manifest, 'THEME_FILE_TOO_LARGE', 'fonts/huge.woff2', {
      'fonts/huge.woff2': Buffer.alloc(2 * 1024 * 1024 + 1),
    });
    const entries = [{ name: 'theme.json', data: Buffer.from(JSON.stringify(manifest)) }];
    for (let i = 0; i < 200; i++) entries.push({ name: `assets/${i}.png`, data: Buffer.from('x') });
    const archive = await zip(entries);
    expect(() => validateThemeZip(archive))
      .toThrowError(expect.objectContaining({ code: 'THEME_TOO_MANY_ENTRIES' }));
  });

  it('E rejects unknown properties, injection tokens, missing locales and unknown sections with JSON paths', async () => {
    const manifest = await base();
    rejected({ ...manifest, unexpected: true }, 'THEME_SCHEMA_INVALID', '/unexpected');
    for (const token of ['#fff;} body{', 'url(x)', 'expression(', 'red']) {
      rejected({ ...manifest, tokens: { background: token } }, 'THEME_SCHEMA_INVALID', '/tokens/background');
    }
    rejected({ ...manifest, tokens: { background: `#${'f'.repeat(500)}` } },
      'THEME_SCHEMA_INVALID', '/tokens/background');
    const missing = structuredClone(manifest);
    delete missing.layout.pages.home.sections[0].settings.title['zh-Hant'];
    rejected(missing, 'THEME_SCHEMA_INVALID', '/layout/pages/home/sections/0/settings/title');
    const unknown = structuredClone(manifest);
    unknown.layout.pages.home.sections[0].type = 'script';
    rejected(unknown, 'THEME_SCHEMA_INVALID', '/layout/pages/home/sections/0/type');
    const forbidden = structuredClone(manifest);
    forbidden.layout.pages.cart = { sections: [] };
    rejected(forbidden, 'THEME_SCHEMA_INVALID', '/layout/pages/cart');
  });

  it('E rejects dangling setting references and missing assets or font files', async () => {
    const manifest = await base();
    const dangling = structuredClone(manifest);
    dangling.layout.pages.home.sections[0].settings.title = { $setting: 'missing' };
    rejected(dangling, 'THEME_UNKNOWN_SETTING',
      '/layout/pages/home/sections/0/settings/title/$setting');
    const missingAsset = structuredClone(manifest);
    missingAsset.layout.pages.home.sections[0] = {
      id: 'home-hero', type: 'hero-banner',
      settings: {
        title: { en: 'Hello', 'zh-Hans': '你好', 'zh-Hant': '你好' },
        image: 'assets/missing.png',
      },
    };
    rejected(missingAsset, 'THEME_MISSING_FILE',
      '/layout/pages/home/sections/0/settings/image');
    const font = structuredClone(manifest);
    font.fonts.push({
      id: 'custom', family: 'Custom', file: 'fonts/custom.woff2',
      weight: 400, style: 'normal', license: 'OFL-1.1',
    });
    rejected(font, 'THEME_MISSING_FILE', '/fonts/0/file');
  });
});

function pngBytes() {
  return Buffer.from('89504e470d0a1a0a00000000', 'hex');
}
