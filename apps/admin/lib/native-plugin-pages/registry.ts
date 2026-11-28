import type { ComponentType } from 'react';

/**
 * The admin pages of the plugins compiled into this build, by slug.
 *
 * The open-source build has none: a page here belongs to a plugin's own implementation, and
 * this repository is the framework. A build that compiles plugin pages in rewrites this file
 * to list them as static imports. `PluginWorkspace` is the only component that reads it.
 */
export const NATIVE_PLUGIN_PAGES: Record<string, ComponentType> = {};

/** The compiled-in page of a plugin, when the build has one. */
export function nativePluginPage(slug: string): ComponentType | undefined {
  return Object.prototype.hasOwnProperty.call(NATIVE_PLUGIN_PAGES, slug) ? NATIVE_PLUGIN_PAGES[slug] : undefined;
}
