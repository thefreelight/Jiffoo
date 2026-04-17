import type { ActiveTheme, ThemePackManifest } from './types';
import { isValidThemeSlug } from '@/lib/themes/registry';

function isBuiltinFallbackSlug(slug?: string | null): boolean {
  return slug === 'builtin-default' || slug === 'default';
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
  return typeof rendererSlug === 'string' && rendererSlug.trim().length > 0
    ? rendererSlug.trim()
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

  if (options.activeThemeSlug && isValidThemeSlug(options.activeThemeSlug)) {
    return options.activeThemeSlug;
  }

  if (options.serverThemeSlug && isValidThemeSlug(options.serverThemeSlug)) {
    return options.serverThemeSlug;
  }

  return 'builtin-default';
}
