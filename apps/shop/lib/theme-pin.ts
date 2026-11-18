import type { ActiveTheme } from './theme-pack/types';
import type { ServerStoreContext } from './server-store-context';

/**
 * Deployment-level theme pin.
 *
 * `THEME_SLUG_PIN` / `THEME_VERSION_PIN` let one shared core API and one
 * shared theme asset library serve multiple storefront workers with
 * different active themes. When the pin is configured on a worker, it is
 * authoritative: it overrides whichever theme the store context and
 * active theme endpoints report. Workers that do not set the pin resolve
 * themes exactly as before, so the pin is additive and opt-in.
 */
export interface ThemePin {
  slug: string;
  version?: string;
}

export function getThemePin(): ThemePin | null {
  const slug = process.env.THEME_SLUG_PIN?.trim();
  if (!slug) {
    return null;
  }
  const version = process.env.THEME_VERSION_PIN?.trim();
  return { slug, version: version || undefined };
}

/**
 * Build the ActiveTheme the pinned worker serves, for injection into the
 * ThemePackProvider as `initialActiveTheme`. The client-side provider then
 * renders this theme without consulting `/themes/active`, while manifest,
 * tokens and templates still load from the versioned theme asset library.
 *
 * `config` stays empty on purpose: the pinned theme's `defaultConfig` in
 * its manifest is the source of truth, so no tenant config can leak in.
 */
export function buildPinnedActiveTheme(): ActiveTheme | null {
  const pin = getThemePin();
  if (!pin) {
    return null;
  }
  return {
    slug: pin.slug,
    version: pin.version || '',
    source: 'installed',
    config: {},
    activatedAt: '',
  };
}

/**
 * Server-side store contexts resolved on a pinned worker must not leak the
 * API-reported theme slug, version, or tenant config. Theme config comes
 * from the pinned theme's manifest once the Theme Pack loads; dropping it
 * here also prevents a first-paint flash of the API-reported branding.
 */
export function applyThemePinToServerStoreContext(
  context: ServerStoreContext | null,
): ServerStoreContext | null {
  const pin = getThemePin();
  if (!pin || !context) {
    return context;
  }
  return {
    ...context,
    theme: {
      slug: pin.slug,
      version: pin.version,
      config: undefined,
      pluginSlug: undefined,
    },
  };
}
