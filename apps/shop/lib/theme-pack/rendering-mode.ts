import type { ActiveTheme, ThemePackManifest } from './types';
import { isOfficialEmbeddedThemeSlug } from '@/lib/themes/contract';
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
  if (typeof rendererSlug !== 'string' || rendererSlug.trim().length === 0) {
    return null;
  }

  const normalizedRendererSlug = rendererSlug.trim();
  return isOfficialEmbeddedThemeSlug(normalizedRendererSlug)
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

  // A raw embedded-renderer declaration (even for a renderer that is not an
  // official bridge) is still a renderer contract — preserve the declared
  // slug so the provider can resolve it downstream.
  const declaredRendererSlug =
    options.manifest?.['x-jiffoo-renderer-mode'] === 'embedded'
    && typeof options.manifest?.['x-jiffoo-renderer-slug'] === 'string'
    && options.manifest['x-jiffoo-renderer-slug'].trim().length > 0
      ? options.manifest['x-jiffoo-renderer-slug'].trim()
      : null;

  if (declaredRendererSlug) {
    return options.activeThemeSlug || declaredRendererSlug;
  }

  // While the manifest has not loaded yet, preserve the raw slugs so the
  // provider can wait for a packaged runtime. Once the manifest is loaded and
  // offers neither a packaged runtime nor an embedded renderer contract, an
  // unknown slug cannot render — fall back to a registry-valid slug instead.
  const manifestLoaded = Boolean(options.manifest);

  if (options.activeThemeSlug && (!manifestLoaded || isValidThemeSlug(options.activeThemeSlug))) {
    return options.activeThemeSlug;
  }

  if (options.serverThemeSlug && (!manifestLoaded || isValidThemeSlug(options.serverThemeSlug))) {
    return options.serverThemeSlug;
  }

  return 'builtin-default';
}
