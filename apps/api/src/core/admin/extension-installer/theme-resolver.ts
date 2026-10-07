import { themeCoreDefaults, type ThemeManifest, type ThemeTarget } from '@jiffoo/shared';
import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';
import { resolveThemePackage, ThemePackageResolutionError } from '@/core/storage/current-theme-package';

type Locale = 'en' | 'zh-Hans' | 'zh-Hant';
const assetUrl = (slug: string, packageHash: string, file: string) =>
  file.startsWith('assets/') || file.startsWith('fonts/')
    ? `/api/v1/themes/${slug}/${packageHash}/${file}` : file;

export async function resolveTheme(target: ThemeTarget, locale: Locale) {
  const snapshot = await prisma.$transaction(async tx => {
    const active = await tx.themeActive.findUnique({ where: { target } });
    if (!active) return null;
    const theme = await tx.theme.findUnique({ where: { slug: active.slug }, include: { configuration: true } });
    if (!theme || theme.packageHash !== active.packageHash) throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
    return theme;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (!snapshot) return null;
  const theme = snapshot;
  await resolveThemePackage(theme.slug, theme.packageHash);
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
    if (typeof value === 'string') return assetUrl(theme.slug, theme.packageHash, value);
    return value;
  };
  const fonts = manifest.fonts.map((font) => ({
    id: font.id, family: font.family, url: assetUrl(theme.slug, theme.packageHash, font.file),
    weight: font.weight, style: font.style,
  }));
  return target === 'admin'
    ? {
      target, slug: theme.slug, version: theme.version, packageHash: theme.packageHash, tokens, fonts,
      logo: manifest.assets.logo ? assetUrl(theme.slug, theme.packageHash, manifest.assets.logo) : null,
      loginBackground: manifest.assets['login-background']
        ? assetUrl(theme.slug, theme.packageHash, manifest.assets['login-background']) : null,
    }
    : {
      target, slug: theme.slug, version: theme.version, packageHash: theme.packageHash, tokens, fonts,
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
