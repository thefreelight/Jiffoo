/**
 * Theme Pack Loader
 *
 * Responsible for loading Theme Pack resources (CSS/JSON/assets) from the server.
 * Handles caching and cache invalidation based on theme version.
 */

import type {
  ThemePackManifest,
  PageTemplate,
  ActiveTheme,
  SettingsSchema,
} from './types';

/** Base URL for theme assets */
const EXTENSIONS_BASE = '/extensions/themes/shop';

/** Cache for loaded resources */
const resourceCache = new Map<string, unknown>();

/**
 * Get the base URL for a theme's assets
 */
export function getThemeBaseUrl(slug: string): string {
  return `${EXTENSIONS_BASE}/${slug}`;
}

/**
 * Get cache key for a resource
 */
function getCacheKey(slug: string, resource: string, version?: string): string {
  return `${slug}:${resource}:${version || 'latest'}`;
}

/**
 * Fetch active theme from API
 */
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

/**
 * Fetch theme manifest (theme.json)
 * @param slug - Theme slug
 * @param version - Theme version (for cache key to ensure upgrades get fresh data)
 */
export async function fetchThemeManifest(slug: string, version?: string): Promise<ThemePackManifest | null> {
  const cacheKey = getCacheKey(slug, 'manifest', version);
  const cached = resourceCache.get(cacheKey);
  if (cached) return cached as ThemePackManifest;

  try {
    const url = `${getThemeBaseUrl(slug)}/theme.json${version ? `?v=${version}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[ThemePack] Failed to fetch manifest for ${slug}:`, response.status);
      return null;
    }
    const manifest = await response.json();
    resourceCache.set(cacheKey, manifest);
    return manifest;
  } catch (error) {
    console.error(`[ThemePack] Error fetching manifest for ${slug}:`, error);
    return null;
  }
}

/**
 * Get tokens CSS URL for a theme
 */
export function getTokensCssUrl(slug: string, manifest?: ThemePackManifest, version?: string): string | null {
  const tokensPath = manifest?.entry?.tokensCSS || 'tokens.css';
  const baseUrl = getThemeBaseUrl(slug);
  const url = `${baseUrl}/${tokensPath}`;

  // Add version query param for cache busting
  if (version) {
    return `${url}?v=${version}`;
  }
  return url;
}

/**
 * Fetch page template
 * @param slug - Theme slug
 * @param page - Page name
 * @param manifest - Theme manifest
 * @param version - Theme version (for cache key to ensure upgrades get fresh data)
 */
export async function fetchPageTemplate(
  slug: string,
  page: string,
  manifest?: ThemePackManifest,
  version?: string
): Promise<PageTemplate | null> {
  const cacheKey = getCacheKey(slug, `template:${page}`, version);
  const cached = resourceCache.get(cacheKey);
  if (cached) return cached as PageTemplate;

  try {
    const templatesDir = manifest?.entry?.templatesDir || 'templates';
    const url = `${getThemeBaseUrl(slug)}/${templatesDir}/${page}.json${version ? `?v=${version}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Template not found is not necessarily an error
      if (response.status === 404) {
        console.debug(`[ThemePack] Template ${page}.json not found for theme ${slug}`);
        return null;
      }
      console.warn(`[ThemePack] Failed to fetch template ${page} for ${slug}:`, response.status);
      return null;
    }

    const template = await response.json();
    resourceCache.set(cacheKey, template);
    return template;
  } catch (error) {
    console.error(`[ThemePack] Error fetching template ${page} for ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch settings schema
 * @param slug - Theme slug
 * @param manifest - Theme manifest
 * @param version - Theme version (for cache key to ensure upgrades get fresh data)
 */
export async function fetchSettingsSchema(
  slug: string,
  manifest?: ThemePackManifest,
  version?: string
): Promise<SettingsSchema | null> {
  const cacheKey = getCacheKey(slug, 'settingsSchema', version);
  const cached = resourceCache.get(cacheKey);
  if (cached) return cached as SettingsSchema;

  const schemaPath = manifest?.entry?.settingsSchema;
  if (!schemaPath) {
    return null;
  }

  try {
    const url = `${getThemeBaseUrl(slug)}/${schemaPath}${version ? `?v=${version}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[ThemePack] Failed to fetch settings schema for ${slug}:`, response.status);
      return null;
    }
    const schema = await response.json();
    resourceCache.set(cacheKey, schema);
    return schema;
  } catch (error) {
    console.error(`[ThemePack] Error fetching settings schema for ${slug}:`, error);
    return null;
  }
}

/**
 * Resolve asset URL within a theme
 */
export function resolveAssetUrl(
  slug: string,
  assetPath: string,
  manifest?: ThemePackManifest
): string {
  // If it's already an absolute URL, return as-is
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }

  // If it starts with /, it's already a root-relative path
  if (assetPath.startsWith('/')) {
    return assetPath;
  }

  // Otherwise, resolve relative to theme base
  const baseUrl = getThemeBaseUrl(slug);

  // If the path starts with "assets/", use it directly
  // Otherwise, if assetsDir is defined, prefix with it
  if (assetPath.startsWith('assets/')) {
    return `${baseUrl}/${assetPath}`;
  }

  const assetsDir = manifest?.entry?.assetsDir || 'assets';
  return `${baseUrl}/${assetsDir}/${assetPath}`;
}

/**
 * Clear all cached resources
 */
export function clearCache(): void {
  resourceCache.clear();
}

/**
 * Clear cache for a specific theme
 */
export function clearThemeCache(slug: string): void {
  for (const key of resourceCache.keys()) {
    if (key.startsWith(`${slug}:`)) {
      resourceCache.delete(key);
    }
  }
}

/**
 * Preload theme resources for better performance
 */
export async function preloadTheme(slug: string): Promise<void> {
  // Fetch manifest first
  const manifest = await fetchThemeManifest(slug);
  if (!manifest) return;

  // Preload home template (most common)
  await fetchPageTemplate(slug, 'home', manifest);

  // Preload settings schema if available
  if (manifest.entry?.settingsSchema) {
    await fetchSettingsSchema(slug, manifest);
  }
}
