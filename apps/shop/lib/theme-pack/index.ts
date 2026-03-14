/**
 * Theme Pack Module
 *
 * This module provides the Theme Pack system for the shop frontend.
 * Theme Packs are configuration/resource packages that control appearance and layout
 * WITHOUT any executable code.
 *
 * Key Components:
 * - ThemePackProvider: Context provider for theme runtime
 * - TemplateRenderer: Renders page templates from Theme Packs
 * - Block Registry: Built-in blocks that Theme Packs can use
 *
 * Usage:
 * ```tsx
 * import { ThemePackProvider, TemplateRenderer } from '@/lib/theme-pack';
 *
 * // Wrap app with provider
 * <ThemePackProvider>
 *   <App />
 * </ThemePackProvider>
 *
 * // Use template renderer for pages
 * <TemplateRenderer page="home" fallback={<DefaultHomePage />} />
 * ```
 */

// Types
export type {
  ThemePackManifest,
  ThemePackEntry,
  ThemeCompatibility,
  ThemePackConfig,
  PageTemplate,
  BlockInstance,
  BlockSettings,
  ActiveTheme,
  ThemeRuntimeState,
  BlockRegistryEntry,
  BlockComponentProps,
  SettingsSchema,
  SchemaProperty,
} from './types';

// Runtime
export {
  ThemePackProvider,
  useThemePack,
  useThemePackOptional,
} from './runtime';

// Template Renderer
export {
  TemplateRenderer,
  BlocksRenderer,
  BlockRenderer,
  useHasTemplate,
} from './template-renderer';

// Block Registry
export {
  BLOCK_REGISTRY,
  getBlockComponent,
  isBlockTypeRegistered,
  isAppBlockType,
  parseAppBlockType,
  getRegisteredBlockTypes,
  getAllBlocks,
  mergeBlockSettings,
} from './block-registry';

// App Block / App Embed (Plugin Theme Extensions - Section 10)
export { AppBlockRenderer } from './app-block-renderer';
export { AppEmbedInjector } from './app-embed-injector';
export { sanitizeHtml, sanitizeCSS } from './html-sanitizer';

// Loader utilities
export {
  getThemeBaseUrl,
  fetchActiveTheme,
  fetchThemeManifest,
  getTokensCssUrl,
  fetchPageTemplate,
  fetchSettingsSchema,
  resolveAssetUrl,
  clearCache,
  clearThemeCache,
  preloadTheme,
} from './loader';

// Block components (for direct use if needed)
export * from './blocks';
