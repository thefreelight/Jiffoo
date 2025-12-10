/**
 * Jiffoo Theme SDK
 *
 * SDK for building themes for the Jiffoo Mall platform.
 *
 * Features:
 * - Theme manifest validation
 * - Design token validation
 * - CSS variable generation
 * - Token merging utilities
 *
 * @example
 * ```typescript
 * import {
 *   validateThemeManifest,
 *   validateThemeTokens,
 *   generateCSSVariables
 * } from '@jiffoo/theme-sdk';
 *
 * // Validate manifest
 * const result = validateThemeManifest(manifest);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 *
 * // Generate CSS variables
 * const css = generateCSSVariables(tokens);
 * ```
 */

// Validators
export {
  validateThemeManifest,
  validateThemeTokens,
  validateColorTokens,
  generateCSSVariables,
  mergeTokens,
  VALID_CATEGORIES
} from './validators';

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
  ThemeConfig
} from './types';

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './validators';

