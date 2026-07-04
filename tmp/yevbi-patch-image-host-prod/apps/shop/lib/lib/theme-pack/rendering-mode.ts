import type { ActiveTheme, ThemePackManifest } from './types';
import { isOfficialEmbeddedThemeSlug } from '@/lib/themes/contract';
import { isValidThemeSlug } from '@/lib/themes/registry';

const RUNTIME_BUNDLED_OFFICIAL_THEME_SLUGS = ['esim-mall'] as const;
const LEGACY_EMBEDDED_BRIDGE_SLUGS = ['yevbi'] as const;

function isBuiltinFallbackSlug(slug?: string | null): boolean {
  return slug === 'builtin-default' || slug === 'default';
}

function isRuntimeBundledOfficialThemeSlug(slug?: string | null): boolean {
  if (!slug) {
    return false;
  }

  return RUNTIME_BUNDLED_OFFICIAL_THEME_SLUGS.includes(
    slug as (typeof RUNTIME_BUNDLED_OFFICIAL_THEME_SLUGS)[number],
  );
}

function isLegacyEmbeddedBridgeSlug(slug?: string | null): boolean {
  if (!slug) {
    return false;
  }

  return LEGACY_EMBEDDED_BRIDGE_SLUGS.includes(
    slug as (typeof LEGACY_EMBEDDED_BRIDGE_SLUGS)[number],
  );
}

function isAllowedEmbeddedRendererSlug(slug: string): boolean {
  return isRuntimeBundledOfficialThemeSlug(slug) || isOfficialEmbeddedThemeSlug(slug);
}

export function isOfficialEmbeddedActiveTheme(activeTheme: ActiveTheme | null): boolean {
  if (activeTheme?.source !== 'official-market') {
    return false;
  }

  if (isLegacyEmbeddedBridgeSlug(activeTheme.slug)) {
    return isValidThemeSlug(activeTheme.slug);
  }

  return isAllowedEmbeddedRendererSlug(activeTheme.slug);
}

export function shouldLoadThemePackResources(
  activeTheme: ActiveTheme | null,
  previewSlug?: string,
): boolean {
  if (!activeTheme) {
    return false;
  }

  if (previewSlug) {
    return true;
  }

  if (activeTheme.source === 'builtin') {
    return false;
  }

  if (isOfficialEmbeddedActiveTheme(activeTheme)) {
    return false;
  }

  // Older API deployments may omit `source` for the builtin default theme.
  if (isBuiltinFallbackSlug(activeTheme.slug)) {
    return false;
  }

  return true;
}

export function getEmbeddedRendererSlug(manifest?: ThemePackManifest | null): string | null {
  if (!manifest) {
    return null;
  }

  if (manifest['x-jiffoo-renderer-mode'] !== 'embedded') {
    return null;
  }

  const rendererSlug = manifest['x-jiffoo-renderer-slug'];
  if (typeof rendererSlug !== 'string' || rendererSlug.trim().length === 0) {
    return null;
  }

  const normalizedRendererSlug = rendererSlug.trim();
  return isAllowedEmbeddedRendererSlug(normalizedRendererSlug)
    ? normalizedRendererSlug
    : null;
}

export function hasPackagedThemeRuntime(manifest?: ThemePackManifest | null): boolean {
  return typeof manifest?.entry?.runtimeJS === 'string' && manifest.entry.runtimeJS.trim().length > 0;
}

export function resolveThemeRendererSlug(options: {
  manifest?: ThemePackManifest | null;
  activeThemeSlug?: string | null;
  serverThemeSlug?: string | null;
}): string {
  if (hasPackagedThemeRuntime(options.manifest)) {
    if (options.activeThemeSlug) {
      return options.activeThemeSlug;
    }

    if (options.manifest?.slug) {
      return options.manifest.slug;
    }
  }

  const embeddedRendererSlug = getEmbeddedRendererSlug(options.manifest);

  if (embeddedRendererSlug && isValidThemeSlug(embeddedRendererSlug)) {
    return embeddedRendererSlug;
  }

  if (options.activeThemeSlug) {
    return options.activeThemeSlug;
  }

  if (options.serverThemeSlug) {
    return options.serverThemeSlug;
  }

  return 'builtin-default';
}
