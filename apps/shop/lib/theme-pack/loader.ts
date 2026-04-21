/**
 * Theme Pack Loader
 *
 * Responsible for loading Theme Pack resources (CSS/JSON/assets) from the server.
 * Handles caching and cache invalidation based on theme version.
 */

import type {
  ActiveTheme,
  PageTemplate,
  SettingsSchema,
  ThemePackManifest,
} from './types';

const EXTENSIONS_BASE = '/extensions/themes/shop';

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveThemeAssetsOrigin(): string {
  if (typeof window !== 'undefined') {
    return '';
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return '';
  }

  try {
    const parsed = new URL(apiUrl);
    return stripTrailingSlash(`${parsed.protocol}//${parsed.host}`);
  } catch {
    return '';
  }
}

function withThemeAssetsOrigin(path: string): string {
  const origin = resolveThemeAssetsOrigin();
  if (!origin) {
    return path;
  }

  return `${origin}${path}`;
}

const resourceCache = new Map<string, unknown>();
const resolvedBaseUrlCache = new Map<string, string>();

function getBaseUrlCacheKey(slug: string, version?: string): string {
  return `${slug}:base-url:${version || 'latest'}`;
}

function appendVersionQuery(url: string, version?: string): string {
  return version ? `${url}?v=${version}` : url;
}

function getLegacyThemeBaseUrl(slug: string): string {
  return withThemeAssetsOrigin(`${EXTENSIONS_BASE}/${slug}`);
}

function getVersionedThemeBaseUrl(slug: string, version: string): string {
  return withThemeAssetsOrigin(`${EXTENSIONS_BASE}/.versions/${slug}/${version}`);
}

function getThemeBaseUrlCandidates(slug: string, version?: string): string[] {
  if (!version) {
    return [getLegacyThemeBaseUrl(slug)];
  }

  return [
    getVersionedThemeBaseUrl(slug, version),
    getLegacyThemeBaseUrl(slug),
  ];
}

function setResolvedThemeBaseUrl(slug: string, baseUrl: string, version?: string): void {
  resolvedBaseUrlCache.set(getBaseUrlCacheKey(slug, version), baseUrl);
}

function getResolvedThemeBaseUrl(slug: string, version?: string): string {
  return resolvedBaseUrlCache.get(getBaseUrlCacheKey(slug, version))
    || (version ? getVersionedThemeBaseUrl(slug, version) : getLegacyThemeBaseUrl(slug));
}

export function getThemeBaseUrl(slug: string, version?: string): string {
  return getResolvedThemeBaseUrl(slug, version);
}

function getCacheKey(slug: string, resource: string, version?: string): string {
  return `${slug}:${resource}:${version || 'latest'}`;
}

export async function fetchActiveTheme(): Promise<ActiveTheme | null> {
  try {
    const { themesApi } = await import('@/lib/api');
    const response = await themesApi.getActiveTheme();
    if (!response.success) {
      console.warn('[ThemePack] Failed to fetch active theme:', response.error?.message || 'unknown error');
      return null;
    }
    return (response.data || null) as ActiveTheme | null;
  } catch (error) {
    console.error('[ThemePack] Error fetching active theme:', error);
    return null;
  }
}

export async function fetchThemeManifest(slug: string, version?: string): Promise<ThemePackManifest | null> {
  const cacheKey = getCacheKey(slug, 'manifest', version);
  const cached = resourceCache.get(cacheKey);
  if (cached) return cached as ThemePackManifest;

  try {
    for (const baseUrl of getThemeBaseUrlCandidates(slug, version)) {
      const response = await fetch(appendVersionQuery(`${baseUrl}/theme.json`, version));
      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`[ThemePack] Failed to fetch manifest for ${slug} from ${baseUrl}:`, response.status);
        }
        continue;
      }
      const manifest = await response.json();
      resourceCache.set(cacheKey, manifest);
      setResolvedThemeBaseUrl(slug, baseUrl, version);
      return manifest;
    }
    return null;
  } catch (error) {
    console.error(`[ThemePack] Error fetching manifest for ${slug}:`, error);
    return null;
  }
}

export function getTokensCssUrl(slug: string, manifest?: ThemePackManifest, version?: string): string | null {
  const tokensPath = manifest?.entry?.tokensCSS || 'tokens.css';
  const baseUrl = getResolvedThemeBaseUrl(slug, version);
  const url = `${baseUrl}/${tokensPath}`;

  return appendVersionQuery(url, version);
}

export function getRuntimeJsUrl(slug: string, manifest?: ThemePackManifest, version?: string): string | null {
  const runtimePath = manifest?.entry?.runtimeJS;
  if (!runtimePath) {
    return null;
  }

  const baseUrl = getResolvedThemeBaseUrl(slug, version);
  const url = `${baseUrl}/${runtimePath}`;
  return appendVersionQuery(url, version);
}

export async function fetchPageTemplate(
  slug: string,
  page: string,
  manifest?: ThemePackManifest,
  version?: string,
): Promise<PageTemplate | null> {
  const cacheKey = getCacheKey(slug, `template:${page}`, version);
  const cached = resourceCache.get(cacheKey);
  if (cached) return cached as PageTemplate;

  try {
    const templatesDir = manifest?.entry?.templatesDir || 'templates';
    for (const baseUrl of getThemeBaseUrlCandidates(slug, version)) {
      const url = appendVersionQuery(`${baseUrl}/${templatesDir}/${page}.json`, version);
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`[ThemePack] Failed to fetch template ${page} for ${slug} from ${baseUrl}:`, response.status);
        }
        continue;
      }
      const template = await response.json();
      resourceCache.set(cacheKey, template);
      setResolvedThemeBaseUrl(slug, baseUrl, version);
      return template;
    }
    console.debug(`[ThemePack] Template ${page}.json not found for theme ${slug}`);
    return null;
  } catch (error) {
    console.error(`[ThemePack] Error fetching template ${page} for ${slug}:`, error);
    return null;
  }
}

export async function fetchSettingsSchema(
  slug: string,
  manifest?: ThemePackManifest,
  version?: string,
): Promise<SettingsSchema | null> {
  const cacheKey = getCacheKey(slug, 'settingsSchema', version);
  const cached = resourceCache.get(cacheKey);
  if (cached) return cached as SettingsSchema;

  const schemaPath = manifest?.entry?.settingsSchema;
  if (!schemaPath) {
    return null;
  }

  try {
    for (const baseUrl of getThemeBaseUrlCandidates(slug, version)) {
      const url = appendVersionQuery(`${baseUrl}/${schemaPath}`, version);
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`[ThemePack] Failed to fetch settings schema for ${slug} from ${baseUrl}:`, response.status);
        }
        continue;
      }
      const schema = await response.json();
      resourceCache.set(cacheKey, schema);
      setResolvedThemeBaseUrl(slug, baseUrl, version);
      return schema;
    }
    return null;
  } catch (error) {
    console.error(`[ThemePack] Error fetching settings schema for ${slug}:`, error);
    return null;
  }
}

export function resolveAssetUrl(
  slug: string,
  assetPath: string,
  manifest?: ThemePackManifest,
  version?: string,
): string {
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }

  if (assetPath.startsWith('/')) {
    return assetPath;
  }

  const baseUrl = getResolvedThemeBaseUrl(slug, version);

  if (assetPath.startsWith('assets/')) {
    return `${baseUrl}/${assetPath}`;
  }

  const assetsDir = manifest?.entry?.assetsDir || 'assets';
  return `${baseUrl}/${assetsDir}/${assetPath}`;
}

export function clearCache(): void {
  resourceCache.clear();
  resolvedBaseUrlCache.clear();
}

export function clearThemeCache(slug: string): void {
  for (const key of resourceCache.keys()) {
    if (key.startsWith(`${slug}:`)) {
      resourceCache.delete(key);
    }
  }
  for (const key of resolvedBaseUrlCache.keys()) {
    if (key.startsWith(`${slug}:base-url:`)) {
      resolvedBaseUrlCache.delete(key);
    }
  }
}

export async function preloadTheme(slug: string): Promise<void> {
  const manifest = await fetchThemeManifest(slug);
  if (!manifest) return;

  await fetchPageTemplate(slug, 'home', manifest);

  if (manifest.entry?.settingsSchema) {
    await fetchSettingsSchema(slug, manifest);
  }
}
