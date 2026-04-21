/**
 * Theme Management Service
 * Manages theme activation and configuration using SystemSettings
 * Supports both 'shop' and 'admin' targets with separate directories and settings
 */

import path from 'path';
import { promises as fs } from 'fs';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { CacheService } from '@/core/cache/service';
import type { ActiveTheme, ThemeMeta, ThemeConfig, InstalledThemesResponse } from './types';
import * as ThemeAppRuntime from '../theme-app-runtime/manager';
import { THEME_APP_MANIFEST_FILE } from '../theme-app-runtime/contract';
import { getThemeAppRuntimePolicy } from '../theme-app-runtime/policy';
import { isAllowedExtensionSource, isOfficialMarketOnly } from '@/core/admin/extension-installer/official-only';
import { ensureInstalledThemeVersionAlias } from '@/core/admin/extension-installer/utils';
import { ensureOfficialMarketExtensionFiles } from '@/core/admin/market/official-package-recovery';

// Target type
export type ThemeTarget = 'shop' | 'admin';

// Get storage directory based on target (Theme Pack)
// Uses EXTENSIONS_PATH env var for consistency with server.ts and extension-installer
function getExtensionsDir(target: ThemeTarget): string {
  const extensionsRoot = process.env.EXTENSIONS_PATH || 'extensions';
  const basePath = path.isAbsolute(extensionsRoot)
    ? extensionsRoot
    : path.join(process.cwd(), extensionsRoot);
  return path.join(basePath, 'themes', target);
}

// Get Theme App storage directory based on target
function getThemeAppExtensionsDir(target: ThemeTarget): string {
  const extensionsRoot = process.env.EXTENSIONS_PATH || 'extensions';
  const basePath = path.isAbsolute(extensionsRoot)
    ? extensionsRoot
    : path.join(process.cwd(), extensionsRoot);
  return path.join(basePath, 'themes-app', target);
}

// Get system setting keys based on target
function getSettingKeys(target: ThemeTarget) {
  return {
    active: `theme.active.${target}`,
    previous: `theme.previous.${target}`,
  };
}

// Invalidate theme cache and bump store context version
async function invalidateThemeCache(target: ThemeTarget): Promise<void> {
  await CacheService.delete(`themes:installed:${target}`);
  await CacheService.delete(`themes:active:${target}`);
  await CacheService.incrementStoreContextVersion();
}

// ============================================================================
// Built-in Theme Constants
// ============================================================================

/**
 * Canonical builtin theme slug (as per PRD_FINAL_BLUEPRINT.md)
 * This is the only uninstallable theme that serves as fallback.
 */
const BUILTIN_DEFAULT_SLUG = 'builtin-default';

/**
 * Legacy slug for backwards compatibility
 * If this is found in DB, it should be treated as builtin-default
 */
const LEGACY_DEFAULT_SLUG = 'default';

/**
 * Normalize theme slug for backwards compatibility
 * Maps legacy 'default' to 'builtin-default'
 */
function normalizeThemeSlug(slug: string): string {
  return slug === LEGACY_DEFAULT_SLUG ? BUILTIN_DEFAULT_SLUG : slug;
}

/**
 * Check if a slug represents the builtin default theme
 */
function isBuiltinDefaultSlug(slug: string): boolean {
  return slug === BUILTIN_DEFAULT_SLUG || slug === LEGACY_DEFAULT_SLUG;
}

function isBuiltinThemeSlug(slug: string, target: ThemeTarget): boolean {
  const normalizedSlug = normalizeThemeSlug(slug);
  return getBuiltinThemes(target).some((theme) => theme.slug === normalizedSlug);
}

// Built-in themes (shop and admin each have builtin-default).
// Official launch themes such as `esim-mall` and `yevbi` are package-managed
// and must be installed from the official marketplace instead of being treated
// as builtin themes.
const BUILTIN_SHOP_THEMES: ThemeMeta[] = [
  {
    slug: BUILTIN_DEFAULT_SLUG,
    name: 'Default Theme',
    version: '1.0.0',
    description: 'Jiffoo Mall default theme, clean and modern e-commerce style',
    author: 'Jiffoo',
    category: 'general',
    source: 'builtin',
    type: 'pack',
    target: 'shop',
  },
];

const BUILTIN_ADMIN_THEMES: ThemeMeta[] = [
  {
    slug: BUILTIN_DEFAULT_SLUG,
    name: 'Default Admin',
    version: '1.0.0',
    description: 'Standard administrative interface',
    author: 'Jiffoo',
    category: 'admin',
    source: 'builtin',
    type: 'pack',
    target: 'admin',
  },
];

// Default active themes
const DEFAULT_ACTIVE_SHOP_THEME: ActiveTheme = {
  slug: BUILTIN_DEFAULT_SLUG,
  version: '1.0.0',
  source: 'builtin',
  type: 'pack', // Builtin themes are always Theme Packs
  config: {},
  activatedAt: new Date().toISOString(),
};

const DEFAULT_ACTIVE_ADMIN_THEME: ActiveTheme = {
  slug: BUILTIN_DEFAULT_SLUG,
  version: '1.0.0',
  source: 'builtin',
  type: 'pack', // Builtin themes are always Theme Packs
  config: {},
  activatedAt: new Date().toISOString(),
};

function getDefaultActiveTheme(target: ThemeTarget): ActiveTheme {
  return target === 'shop' ? DEFAULT_ACTIVE_SHOP_THEME : DEFAULT_ACTIVE_ADMIN_THEME;
}

function getBuiltinThemes(target: ThemeTarget): ThemeMeta[] {
  return target === 'shop' ? BUILTIN_SHOP_THEMES : BUILTIN_ADMIN_THEMES;
}

function isLegacyOfficialMarketThemeSlug(slug: string, target: ThemeTarget): boolean {
  return target === 'shop' && (slug === 'esim-mall' || slug === 'yevbi');
}

function shouldNormalizeToBuiltinTheme(theme: ActiveTheme, target: ThemeTarget): boolean {
  const normalizedSlug = normalizeThemeSlug(theme.slug);
  if (!isBuiltinThemeSlug(normalizedSlug, target)) {
    return false;
  }

  if (theme.source === 'builtin') {
    return true;
  }

  // Preserve installed Theme Pack records for builtin official themes so
  // marketplace-downloaded copies can remain the active source of truth.
  if (theme.type === 'pack') {
    return false;
  }

  return true;
}

function normalizeActiveThemeRecord(theme: ActiveTheme, target: ThemeTarget): ActiveTheme {
  const normalizedSlug = normalizeThemeSlug(theme.slug);
  const isLegacyOfficialMarketTheme =
    theme.source === 'builtin' && isLegacyOfficialMarketThemeSlug(normalizedSlug, target);
  const isActuallyBuiltin = shouldNormalizeToBuiltinTheme({
    ...theme,
    slug: normalizedSlug,
  }, target);

  const normalized: ActiveTheme = {
    ...theme,
    slug: normalizedSlug,
    type: isActuallyBuiltin || isLegacyOfficialMarketTheme ? 'pack' : (theme.type || 'pack'),
    source: isActuallyBuiltin ? 'builtin' : (isLegacyOfficialMarketTheme ? 'official-market' : theme.source),
  };

  if (isActuallyBuiltin) {
    delete normalized.baseUrl;
    delete normalized.port;
  }

  return normalized;
}

async function ensureOfficialThemePackFilesPresent(theme: ActiveTheme, target: ThemeTarget): Promise<void> {
  if (theme.source !== 'official-market' || theme.type !== 'pack') {
    return;
  }

  const themeJsonPath = path.join(getExtensionsDir(target), normalizeThemeSlug(theme.slug), 'theme.json');
  try {
    await fs.access(themeJsonPath);
    return;
  } catch {
    // Restore below.
  }

  try {
    await ensureOfficialMarketExtensionFiles({
      slug: normalizeThemeSlug(theme.slug),
      kind: 'theme-shop',
      version: theme.version,
    });
  } catch (error) {
    console.warn(
      `Failed to restore official theme pack "${theme.slug}" while resolving active theme:`,
      error,
    );
  }
}

async function ensureThemePackVersionAlias(theme: ActiveTheme, target: ThemeTarget): Promise<void> {
  if (theme.type !== 'pack' || theme.source === 'builtin') {
    return;
  }

  try {
    await ensureInstalledThemeVersionAlias(target, normalizeThemeSlug(theme.slug), theme.version);
  } catch (error) {
    console.warn(
      `Failed to ensure versioned theme alias for "${theme.slug}" (${theme.version}) while resolving active theme:`,
      error,
    );
  }
}

function didNormalizeActiveTheme(original: ActiveTheme, normalized: ActiveTheme): boolean {
  return (
    original.slug !== normalized.slug ||
    original.type !== normalized.type ||
    original.source !== normalized.source ||
    original.baseUrl !== normalized.baseUrl ||
    original.port !== normalized.port
  );
}

function serializeActiveTheme(theme: ActiveTheme): string {
  return JSON.stringify({
    slug: theme.slug,
    version: theme.version,
    source: theme.source,
    type: theme.type,
    config: theme.config ?? {},
    activatedAt: theme.activatedAt,
    baseUrl: theme.baseUrl,
    port: theme.port,
  });
}

function isSameActiveTheme(left: ActiveTheme, right: ActiveTheme): boolean {
  return serializeActiveTheme(left) === serializeActiveTheme(right);
}

/**
 * Get current active theme from SystemSettings
 * Normalizes legacy 'default' slug to 'builtin-default'
 */
export async function getActiveTheme(target: ThemeTarget = 'shop'): Promise<ActiveTheme> {
  const keys = getSettingKeys(target);
  const active = await systemSettingsService.getSetting(keys.active);
  const previous = await systemSettingsService.getSetting(keys.previous);

  const rawTheme = (active && typeof active === 'object' ? active : getDefaultActiveTheme(target)) as ActiveTheme;
  let theme = normalizeActiveThemeRecord(rawTheme, target);
  const prev = (previous && typeof previous === 'object' ? previous : null) as ActiveTheme | null;

  await ensureOfficialThemePackFilesPresent(theme, target);
  await ensureThemePackVersionAlias(theme, target);

  if (active && typeof active === 'object' && didNormalizeActiveTheme(rawTheme, theme)) {
    await systemSettingsService.setSetting(keys.active, theme);
  }

  const cacheKey = `themes:active:${target}`;
  const cached = await CacheService.get<ActiveTheme>(cacheKey);
  if (cached) {
    const normalizedCached = normalizeActiveThemeRecord(cached, target);
    const cacheMatchesTheme = isSameActiveTheme(normalizedCached, theme);
    if (cacheMatchesTheme && (!isOfficialMarketOnly() || isAllowedExtensionSource(normalizedCached.source))) {
      return {
        ...normalizedCached,
        previousSlug: prev?.slug ? normalizeThemeSlug(prev.slug) : undefined
      };
    }
    await CacheService.delete(cacheKey);
  }

  if (isOfficialMarketOnly() && !isAllowedExtensionSource(theme.source)) {
    const fallback = getDefaultActiveTheme(target);
    await systemSettingsService.setSetting(keys.active, fallback);
    await CacheService.set(cacheKey, fallback, { ttl: 60 });
    return {
      ...fallback,
      previousSlug: prev?.slug ? normalizeThemeSlug(prev.slug) : undefined
    };
  }
  const result = {
    ...theme,
    previousSlug: prev?.slug ? normalizeThemeSlug(prev.slug) : undefined
  };

  await CacheService.set(cacheKey, theme, { ttl: 60 });
  return result;
}

/**
 * Get previous theme from SystemSettings
 */
export async function getPreviousTheme(target: ThemeTarget = 'shop'): Promise<ActiveTheme | null> {
  const keys = getSettingKeys(target);
  const previous = await systemSettingsService.getSetting(keys.previous);
  if (previous && typeof previous === 'object') {
    return normalizeActiveThemeRecord(previous as ActiveTheme, target);
  }
  return null;
}

/**
 * Detect theme type (pack or app) by checking manifest files
 * Returns { type: 'pack' | 'app', manifest?, version? }
 */
async function detectThemeType(
  slug: string,
  target: ThemeTarget
): Promise<{ type: 'pack' | 'app'; manifest?: any; version?: string }> {
  // Check Theme Pack first (extensions/themes/{target}/{slug}/theme.json)
  const packDir = path.join(getExtensionsDir(target), slug);
  const packManifestPath = path.join(packDir, 'theme.json');
  try {
    const data = await fs.readFile(packManifestPath, 'utf-8');
    const manifest = JSON.parse(data);
    return { type: 'pack', manifest, version: manifest.version };
  } catch {
    // Not a Theme Pack, try Theme App
  }

  // Check Theme App (extensions/themes-app/{target}/{slug}/{version}/theme-app.json)
  const appBaseDir = path.join(getThemeAppExtensionsDir(target), slug);
  try {
    const versions = await fs.readdir(appBaseDir);
    // Use the latest version (sorted descending)
    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

    for (const version of versions) {
      const versionDir = path.join(appBaseDir, version);
      const stat = await fs.stat(versionDir);
      if (!stat.isDirectory()) continue;

      const manifestPath = path.join(versionDir, THEME_APP_MANIFEST_FILE);
      try {
        const data = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(data);
        return { type: 'app', manifest, version: manifest.version || version };
      } catch {
        // theme-app.json not found, skip this version
      }
    }
  } catch {
    // Not a Theme App
  }

  // Default to pack for builtin themes
  return { type: 'pack' };
}

/**
 * Activate theme
 * @param type - Optional explicit type ('pack' | 'app'). When provided, skips detectThemeType
 *               so pack and app variants of the same slug can be activated independently.
 */
export async function activateTheme(slug: string, target: ThemeTarget = 'shop', config?: ThemeConfig, type?: 'pack' | 'app'): Promise<ActiveTheme> {
  const keys = getSettingKeys(target);
  const extensionsDir = getExtensionsDir(target);

  // Normalize slug (support both 'default' and 'builtin-default')
  const normalizedSlug = normalizeThemeSlug(slug);

  // Find theme info — when type is provided, match on both slug and type to distinguish
  // pack vs app variants of the same slug (e.g. yevbi:pack vs yevbi:app)
  const installedThemes = await getInstalledThemes(target);
  const installedTheme = installedThemes.items.find(
    (item) => item.slug === normalizedSlug && item.source !== 'builtin' && (type ? item.type === type : true),
  );
  const builtinTheme = getBuiltinThemes(target)
    .map(t => ({ ...t, target }))
    .find(t => t.slug === normalizedSlug && (type ? (t.type ?? 'pack') === type : true));
  const theme = installedTheme || builtinTheme;

  if (!theme) {
    throw new Error(`Theme "${normalizedSlug}" not found for target "${target}"`);
  }

  if (isOfficialMarketOnly() && !isAllowedExtensionSource(theme.source)) {
    throw new Error(`Theme "${normalizedSlug}" is not allowed in official-market-only mode`);
  }

  // Get current theme to set as previous
  const currentTheme = await getActiveTheme(target);

  // Determine initial config
  let finalConfig = config;

  if (!finalConfig) {
    if (currentTheme.slug === normalizedSlug) {
      // Keep existing config if same theme
      finalConfig = currentTheme.config;
    } else if (theme.source !== 'builtin') {
      // Read theme.json for defaultConfig if new installed theme
      try {
        const themeJsonPath = path.join(extensionsDir, normalizedSlug, 'theme.json');
        const data = await fs.readFile(themeJsonPath, 'utf-8');
        const themeMeta = JSON.parse(data);
        finalConfig = themeMeta.defaultConfig || {};
      } catch {
        finalConfig = {};
      }
    } else {
      finalConfig = {};
    }
  }

  // Determine theme type: use caller-supplied type if given, otherwise detect from filesystem.
  // Explicit type is required when both a pack and an app exist for the same slug.
  const themeTypeInfo = type ? { type, version: theme.version } : await detectThemeType(normalizedSlug, target);
  const themeType = themeTypeInfo.type;

  let themeAppInstance: any = null;

  // If Theme App, start runtime and health check BEFORE switching active
  if (themeType === 'app') {
    try {
      // Get version from themeTypeInfo
      const version = themeTypeInfo.version || 'latest';

      // Start Theme App Runtime (with version)
      themeAppInstance = await ThemeAppRuntime.startThemeApp(target, normalizedSlug, version, {
        forceRestart: false, // Don't force restart if already running and healthy
      });

      // Perform health check
      const healthResult = await ThemeAppRuntime.checkThemeAppHealth(target, normalizedSlug);
      if (!healthResult || !healthResult.success) {
        // Health check failed, rollback and throw error
        await ThemeAppRuntime.stopThemeApp(target, normalizedSlug);
        throw new Error(
          `Theme App health check failed: ${healthResult?.error || 'Unknown error'}. ` +
          `Active theme not changed. Previous active: ${currentTheme.slug}`
        );
      }

      // Health check passed, theme app is ready
    } catch (error: any) {
      // If startup or health check fails, do NOT change active theme
      throw new Error(
        `Failed to activate Theme App "${normalizedSlug}": ${error.message}. ` +
        `Active theme remains: ${currentTheme.slug}`
      );
    }
  }

  const newActiveTheme: ActiveTheme = {
    slug: theme.slug,
    version: theme.version,
    source: theme.source,
    type: themeType, // 'pack' or 'app'
    config: finalConfig,
    activatedAt: new Date().toISOString(),
    // Add baseUrl and port for Theme App
    ...(themeType === 'app' && themeAppInstance
      ? {
        baseUrl: themeAppInstance.baseUrl,
        port: themeAppInstance.port,
      }
      : {}),
  };

  // If we are actually changing themes (slug different), save current as previous
  if (currentTheme.slug !== normalizedSlug) {
    // Remove previousSlug before saving as previous theme record
    const { previousSlug, ...themeToSave } = currentTheme;
    await systemSettingsService.setSetting(keys.previous, themeToSave);
  }

  // Save new active theme
  await systemSettingsService.setSetting(keys.active, newActiveTheme);
  await invalidateThemeCache(target);

  return newActiveTheme;
}

/**
 * Rollback to previous theme
 */
export async function rollbackTheme(target: ThemeTarget = 'shop'): Promise<ActiveTheme> {
  const keys = getSettingKeys(target);
  const previousTheme = await getPreviousTheme(target);
  if (!previousTheme) {
    throw new Error(`No previous theme available for rollback (target: ${target})`);
  }

  // We swap: New Active = Old Previous. New Previous = Old Active.
  const currentTheme = await getActiveTheme(target);

  // Remove previousSlug before saving as previous theme record
  const { previousSlug, ...themeToSave } = currentTheme;

  await systemSettingsService.setSetting(keys.active, previousTheme);
  await systemSettingsService.setSetting(keys.previous, themeToSave);
  await invalidateThemeCache(target);

  return previousTheme;
}

/**
 * Update theme config
 */
export async function updateThemeConfig(config: ThemeConfig, target: ThemeTarget = 'shop'): Promise<ActiveTheme> {
  const keys = getSettingKeys(target);
  const current = await getActiveTheme(target);
  const updated: ActiveTheme = {
    ...current,
    config: { ...current.config, ...config },
  };

  await systemSettingsService.setSetting(keys.active, updated);
  await invalidateThemeCache(target);

  return updated;
}

/**
 * Get installed themes list (includes both Theme Pack and Theme App)
 */
export async function getInstalledThemes(target: ThemeTarget = 'shop'): Promise<InstalledThemesResponse> {
  const cacheKey = `themes:installed:${target}`;
  const cached = await CacheService.get<InstalledThemesResponse>(cacheKey);
  if (cached) return cached;

  const extensionsDir = getExtensionsDir(target);
  // Use a Map keyed by slug so installed themes naturally supersede builtin entries
  const themesMap = new Map<string, ThemeMeta>(
    getBuiltinThemes(target).map(t => [t.slug, { ...t, target }])
  );

  // Read installed Theme Packs from extensions/themes/{target}
  try {
    const dirs = await fs.readdir(extensionsDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        let installedSource: ThemeMeta['source'] = 'installed';
        try {
          const metaPath = path.join(extensionsDir, dir.name, '.installed.json');
          const installedMeta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
          if (installedMeta?.source) {
            installedSource = installedMeta.source;
          }
        } catch {
          // Ignore missing/invalid .installed.json
        }
        const themeJsonPath = path.join(extensionsDir, dir.name, 'theme.json');
        try {
          const data = await fs.readFile(themeJsonPath, 'utf-8');
          const themeMeta = JSON.parse(data);
          const preview = themeMeta.previewImage || themeMeta.thumbnail;
          const slug = themeMeta.slug || dir.name;
          themesMap.set(slug, {
            slug,
            name: themeMeta.name || dir.name,
            version: themeMeta.version || '1.0.0',
            description: themeMeta.description,
            author: themeMeta.author,
            category: themeMeta.category,
            previewImage: preview,
            source: installedSource,
            type: 'pack',
            target,
          });
        } catch {
          // Ignore invalid theme.json
        }
      }
    }
  } catch (err) {
    // extensions directory does not exist or empty
  }

  // Read installed Theme Apps from extensions/themes-app/{target}
  // Theme Apps are a distinct delivery form: same slug can have both a pack and an app installed.
  // Use slug+':app' as Map key so theme apps never collapse onto their pack/builtin counterpart.
  try {
    const themeAppBaseDir = getThemeAppExtensionsDir(target);
    const slugDirs = await fs.readdir(themeAppBaseDir, { withFileTypes: true });

    for (const slugDir of slugDirs) {
      if (!slugDir.isDirectory()) continue;

      const slugPath = path.join(themeAppBaseDir, slugDir.name);
      const versionDirs = await fs.readdir(slugPath, { withFileTypes: true });

      // Get the latest version for this slug
      const versions = versionDirs
        .filter(v => v.isDirectory())
        .map(v => v.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

      if (versions.length === 0) continue;

      const latestVersion = versions[0];
      const versionPath = path.join(slugPath, latestVersion);

      // Prefer installed metadata for source + display info
      const metaPath = path.join(versionPath, '.installed.json');
      try {
        const installedMeta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        if (installedMeta?.type === 'theme-app') {
          const preview = installedMeta.icon || installedMeta.previewImage || installedMeta.thumbnail;
          const slug = installedMeta.slug || slugDir.name;
          themesMap.set(`${slug}:app`, {
            slug,
            name: installedMeta.name || slugDir.name,
            version: installedMeta.version || latestVersion,
            description: installedMeta.description,
            author: installedMeta.author,
            category: installedMeta.category,
            previewImage: preview,
            source: installedMeta.source || 'installed',
            type: 'app',
            target,
          });
          continue;
        }
      } catch {
        // Fall back to manifest files
      }

      const manifestPath = path.join(versionPath, THEME_APP_MANIFEST_FILE);
      try {
        const data = await fs.readFile(manifestPath, 'utf-8');
        const themeMeta = JSON.parse(data);

        if (themeMeta.type === 'theme-app') {
          const preview = themeMeta.icon || themeMeta.previewImage || themeMeta.thumbnail;
          const slug = themeMeta.slug || slugDir.name;
          themesMap.set(`${slug}:app`, {
            slug,
            name: themeMeta.name || slugDir.name,
            version: themeMeta.version || latestVersion,
            description: themeMeta.description,
            author: themeMeta.author,
            category: themeMeta.category,
            previewImage: preview,
            source: 'installed',
            type: 'app',
            target,
          });
        }
      } catch {
        // Ignore invalid or missing theme-app.json
      }
    }
  } catch (err) {
    // themes-app directory does not exist or empty
  }

  const themes: ThemeMeta[] = Array.from(themesMap.values());

  const filtered = isOfficialMarketOnly()
    ? themes.filter((theme) => isAllowedExtensionSource(theme.source))
    : themes;
  const deduped = dedupeThemeEntries(filtered);
  const result = { items: deduped, total: deduped.length };
  await CacheService.set(cacheKey, result, { ttl: 60 });
  return result;
}

export async function getInstalledThemesPaged(
  target: ThemeTarget = 'shop',
  page: number = 1,
  limit: number = 20
): Promise<InstalledThemesResponse & { page: number; limit: number; totalPages: number }> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const all = await getInstalledThemes(target);
  const start = (safePage - 1) * safeLimit;
  const items = all.items.slice(start, start + safeLimit);
  return {
    items,
    page: safePage,
    limit: safeLimit,
    total: all.total,
    totalPages: Math.ceil(all.total / safeLimit),
  };
}

/**
 * Restore active Theme Apps on server startup
 *
 * This function should be called during server initialization to restart
 * any Theme App that was previously active. When the API server restarts,
 * the Theme App processes are lost, but the database still records them
 * as active. This function detects such cases and restarts the Theme Apps.
 *
 * @returns Summary of restore operations
 */
export async function restoreActiveThemeApps(): Promise<{
  shop: { restored: boolean; slug?: string; error?: string };
  admin: { restored: boolean; slug?: string; error?: string };
}> {
  const results: {
    shop: { restored: boolean; slug?: string; error?: string };
    admin: { restored: boolean; slug?: string; error?: string };
  } = {
    shop: { restored: false },
    admin: { restored: false },
  };

  const runtimePolicy = getThemeAppRuntimePolicy();
  if (!runtimePolicy.supported) {
    const error = runtimePolicy.reasons.join(' ');
    return {
      shop: { restored: false, error },
      admin: { restored: false, error },
    };
  }

  const targets: ThemeTarget[] = ['shop', 'admin'];

  for (const target of targets) {
    try {
      const activeTheme = await getActiveTheme(target);

      // Only restore if it's a Theme App type
      if (activeTheme.type !== 'app') {
        continue;
      }

      // Check if already running
      const instance = ThemeAppRuntime.getThemeAppInstance(target, activeTheme.slug);
      if (instance && instance.status === 'healthy') {
        console.log(`[ThemeRestore] Theme App "${activeTheme.slug}" for ${target} is already running`);
        results[target] = { restored: true, slug: activeTheme.slug };
        continue;
      }

      // Detect theme type to get version info
      const themeTypeInfo = await detectThemeType(activeTheme.slug, target);
      if (themeTypeInfo.type !== 'app') {
        console.warn(`[ThemeRestore] Active theme "${activeTheme.slug}" for ${target} is marked as 'app' but no Theme App found`);
        continue;
      }

      const version = themeTypeInfo.version || activeTheme.version || 'latest';

      console.log(`[ThemeRestore] Restoring Theme App "${activeTheme.slug}" (v${version}) for ${target}...`);

      // Start the Theme App
      const startedInstance = await ThemeAppRuntime.startThemeApp(target, activeTheme.slug, version, {
        forceRestart: false,
      });

      // Health check
      const healthResult = await ThemeAppRuntime.checkThemeAppHealth(target, activeTheme.slug);

      if (healthResult && healthResult.success) {
        console.log(`[ThemeRestore] ✅ Theme App "${activeTheme.slug}" for ${target} restored successfully (port: ${startedInstance.port})`);
        results[target] = { restored: true, slug: activeTheme.slug };
      } else {
        console.error(`[ThemeRestore] ⚠️ Theme App "${activeTheme.slug}" for ${target} started but health check failed`);
        results[target] = {
          restored: false,
          slug: activeTheme.slug,
          error: healthResult?.error || 'Health check failed'
        };
      }
    } catch (error: any) {
      console.error(`[ThemeRestore] ❌ Failed to restore Theme App for ${target}:`, error.message);
      results[target] = { restored: false, error: error.message };
    }
  }

  return results;
}

function dedupeThemeEntries(themes: ThemeMeta[]): ThemeMeta[] {
  const deduped = new Map<string, ThemeMeta>();

  for (const theme of themes) {
    const existing = deduped.get(theme.slug);
    if (!existing || getThemeEntryPriority(theme) > getThemeEntryPriority(existing)) {
      deduped.set(theme.slug, theme);
    }
  }

  return Array.from(deduped.values());
}

function getThemeEntryPriority(theme: ThemeMeta): number {
  let score = 0;

  if (theme.type === 'pack') {
    score += 100;
  }

  if (theme.source === 'official-market') {
    score += 40;
  } else if (theme.source === 'installed' || theme.source === 'local-zip') {
    score += 30;
  } else if (theme.source === 'builtin') {
    score += 20;
  }

  if (theme.description) {
    score += 5;
  }

  if (theme.author) {
    score += 1;
  }

  return score;
}

export const ThemeManagementService = {
  getActiveTheme,
  getPreviousTheme,
  activateTheme,
  rollbackTheme,
  updateThemeConfig,
  getInstalledThemes,
  getInstalledThemesPaged,
  restoreActiveThemeApps,
};
