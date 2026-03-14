/**
 * Admin Theme Pack Module
 *
 * This module provides the Theme Pack system for the admin frontend.
 * Admin Theme Packs are simpler than Shop Theme Packs - they focus on:
 * - CSS tokens (colors, typography, layout variables)
 * - Layout options (sidebar, header, density)
 *
 * Admin v1 does NOT implement page templates/blocks.
 *
 * Usage:
 * ```tsx
 * import { AdminThemePackProvider, useAdminThemePack } from '@/lib/theme-pack';
 *
 * // Wrap app with provider
 * <AdminThemePackProvider>
 *   <AdminApp />
 * </AdminThemePackProvider>
 *
 * // Access theme config in components
 * const { mergedConfig } = useAdminThemePack();
 * ```
 */

// Types
export type {
  AdminThemePackManifest,
  AdminThemePackEntry,
  AdminThemePackConfig,
  ActiveAdminTheme,
  AdminThemeRuntimeState,
} from './types';

// Runtime
export {
  AdminThemePackProvider,
  useAdminThemePack,
  useAdminThemePackOptional,
} from './runtime';
