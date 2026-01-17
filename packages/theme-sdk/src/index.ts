/**
 * Jiffoo Theme SDK
 *
 * SDK for building themes for the Jiffoo Mall platform.
 *
 * Features:
 * - Theme definition and configuration
 * - Design token validation
 * - CSS variable generation
 * - React hooks for theme data
 * - CLI tools for development
 *
 * @example
 * ```typescript
 * import {
 *   defineTheme,
 *   validateThemeManifest,
 *   generateCSSVariables
 * } from '@jiffoo/theme-sdk';
 *
 * // Define your theme
 * const theme = defineTheme({
 *   slug: 'my-theme',
 *   name: 'My Theme',
 *   version: '1.0.0',
 *   category: 'general',
 *   tokens: {
 *     colors: {
 *       primary: '#3b82f6',
 *       secondary: '#64748b',
 *     },
 *   },
 * });
 *
 * // Generate CSS variables
 * const css = generateCSSVariables(theme.tokens);
 * ```
 */

// Theme definition
export { defineTheme, registerComponent, registerPage } from './theme';

// Validators
export {
  validateThemeManifest,
  validateThemeTokens,
  validateColorTokens,
  generateCSSVariables,
  mergeTokens,
  VALID_CATEGORIES
} from './validators';

// Utilities
export { createThemeLogger, formatThemeError } from './utils';

// Type definitions
export type {
  ThemeManifest,
  ThemeCategory,
  ThemeTokens,
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  BorderRadiusTokens,
  ShadowTokens,
  AnimationTokens,
  ThemeComponents,
  ComponentConfig,
  ThemeConfig,
  ThemeDefinition,
  ThemePageConfig,
  ThemeComponentConfig
} from './types';

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './validators';

// SDK Version
export const SDK_VERSION = '1.0.0';
export const PLATFORM_COMPATIBILITY = '>=0.2.0';

