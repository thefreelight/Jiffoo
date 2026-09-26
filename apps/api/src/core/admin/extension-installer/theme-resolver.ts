import { themeCoreDefaults, type ThemeManifest, type ThemeTarget } from '@jiffoo/shared';
import { prisma } from '@/config/database';

type Locale = 'en' | 'zh-Hans' | 'zh-Hant';
const assetUrl = (slug: string, version: string, file: string) =>
  file.startsWith('assets/') || file.startsWith('fonts/')
    ? `/api/v1/themes/${slug}/${version}/${file}` : file;

export async function resolveTheme(target: ThemeTarget, locale: Locale) {
  const active = await prisma.themeActive.findUnique({ where: { target } });
  if (!active) return null;
  const theme = await prisma.theme.findUnique({ where: { slug: active.slug }, include: { configuration: true } });
  if (!theme) return null;
  const manifest = theme.manifestJson as unknown as ThemeManifest;
  const values = (theme.configuration?.values ?? {}) as Record<string, unknown>;
  const effective = Object.fromEntries(manifest.settings.map((setting) =>
    [setting.id, values[setting.id] ?? setting.default]));
  const tokens: Record<string, unknown> = { ...themeCoreDefaults[target], ...manifest.tokens };
  for (const setting of manifest.settings) {
    if (setting.bindsToken) tokens[setting.bindsToken] = effective[setting.id];
  }
  const resolve = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.$setting === 'string') return resolve(effective[record.$setting]);
      if (['en', 'zh-Hans', 'zh-Hant'].every((key) => typeof record[key] === 'string'))
        return record[locale];
      return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, resolve(item)]));
    }
    if (typeof value === 'string') return assetUrl(theme.slug, theme.version, value);
    return value;
  };
  const fonts = manifest.fonts.map((font) => ({
    id: font.id, family: font.family, url: assetUrl(theme.slug, theme.version, font.file),
    weight: font.weight, style: font.style,
  }));
  return target === 'admin'
    ? {
      target, slug: theme.slug, version: theme.version, tokens, fonts,
      logo: manifest.assets.logo ? assetUrl(theme.slug, theme.version, manifest.assets.logo) : null,
      loginBackground: manifest.assets['login-background']
        ? assetUrl(theme.slug, theme.version, manifest.assets['login-background']) : null,
    }
    : {
      target, slug: theme.slug, version: theme.version, tokens, fonts,
      copy: resolve(manifest.copy), layout: resolve({
        ...(manifest.layout as object),
        pages: {
          ...(manifest.layout as { pages: object }).pages,
          home: { ...(manifest.layout as { pages: { home: object } }).pages.home,
            sections: values.$homeSections ?? (manifest.layout as {
              pages: { home: { sections: unknown[] } };
            }).pages.home.sections },
        },
      }),
    };
}
