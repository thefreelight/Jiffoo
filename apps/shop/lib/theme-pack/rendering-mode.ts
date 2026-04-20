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

export function resolveThemeRendererSlug(options: {
  manifest?: ThemePackManifest | null;
  activeThemeSlug?: string | null;
  serverThemeSlug?: string | null;
}): string {
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
