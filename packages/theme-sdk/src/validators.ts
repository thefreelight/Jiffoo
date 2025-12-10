/**
 * Jiffoo Theme SDK - Validators
 */

import type { ThemeManifest, ThemeTokens, ColorTokens } from './types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

/**
 * Valid theme categories
 */
export const VALID_CATEGORIES = [
  'general',
  'fashion',
  'electronics',
  'food',
  'home',
  'beauty',
  'sports',
  'minimal',
  'luxury'
] as const;

/**
 * Validate theme manifest
 */
export function validateThemeManifest(manifest: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Manifest must be an object', code: 'INVALID_TYPE' }],
      warnings: []
    };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (!m.slug || typeof m.slug !== 'string') {
    errors.push({ path: 'slug', message: 'slug is required and must be a string', code: 'REQUIRED' });
  } else if (!/^[a-z0-9-]+$/.test(m.slug)) {
    errors.push({ path: 'slug', message: 'slug must be lowercase alphanumeric with hyphens', code: 'INVALID_FORMAT' });
  }

  if (!m.name || typeof m.name !== 'string') {
    errors.push({ path: 'name', message: 'name is required and must be a string', code: 'REQUIRED' });
  }

  if (!m.version || typeof m.version !== 'string') {
    errors.push({ path: 'version', message: 'version is required and must be a string', code: 'REQUIRED' });
  } else if (!/^\d+\.\d+\.\d+/.test(m.version)) {
    errors.push({ path: 'version', message: 'version must follow semver format (x.y.z)', code: 'INVALID_FORMAT' });
  }

  if (!m.description || typeof m.description !== 'string') {
    errors.push({ path: 'description', message: 'description is required and must be a string', code: 'REQUIRED' });
  }

  if (!m.author || typeof m.author !== 'string') {
    errors.push({ path: 'author', message: 'author is required and must be a string', code: 'REQUIRED' });
  }

  if (!m.category || typeof m.category !== 'string') {
    errors.push({ path: 'category', message: 'category is required and must be a string', code: 'REQUIRED' });
  } else if (!VALID_CATEGORIES.includes(m.category as any)) {
    errors.push({ path: 'category', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`, code: 'INVALID_VALUE' });
  }

  if (!m.thumbnail || typeof m.thumbnail !== 'string') {
    errors.push({ path: 'thumbnail', message: 'thumbnail is required and must be a string', code: 'REQUIRED' });
  }

  // Optional screenshots
  if (m.screenshots !== undefined) {
    if (!Array.isArray(m.screenshots)) {
      errors.push({ path: 'screenshots', message: 'screenshots must be an array', code: 'INVALID_TYPE' });
    } else if (m.screenshots.length === 0) {
      warnings.push({ path: 'screenshots', message: 'screenshots array is empty', code: 'EMPTY_ARRAY' });
    }
  } else {
    warnings.push({ path: 'screenshots', message: 'screenshots is recommended for better presentation', code: 'RECOMMENDED' });
  }

  // Optional tokens
  if (m.tokens !== undefined) {
    const tokensResult = validateThemeTokens(m.tokens);
    errors.push(...tokensResult.errors.map(e => ({ ...e, path: `tokens.${e.path}` })));
    warnings.push(...tokensResult.warnings.map(w => ({ ...w, path: `tokens.${w.path}` })));
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate theme tokens
 */
export function validateThemeTokens(tokens: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!tokens || typeof tokens !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Tokens must be an object', code: 'INVALID_TYPE' }],
      warnings: []
    };
  }

  const t = tokens as Record<string, unknown>;

  // Validate colors
  if (t.colors !== undefined) {
    const colorsResult = validateColorTokens(t.colors);
    errors.push(...colorsResult.errors.map(e => ({ ...e, path: `colors.${e.path}` })));
    warnings.push(...colorsResult.warnings.map(w => ({ ...w, path: `colors.${w.path}` })));
  }

  // Validate typography
  if (t.typography !== undefined && typeof t.typography !== 'object') {
    errors.push({ path: 'typography', message: 'typography must be an object', code: 'INVALID_TYPE' });
  }

  // Validate spacing
  if (t.spacing !== undefined && typeof t.spacing !== 'object') {
    errors.push({ path: 'spacing', message: 'spacing must be an object', code: 'INVALID_TYPE' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate color tokens
 */
export function validateColorTokens(colors: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!colors || typeof colors !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Colors must be an object', code: 'INVALID_TYPE' }],
      warnings: []
    };
  }

  const c = colors as Record<string, unknown>;
  const colorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$|^rgb|^hsl|^var\(/;

  // Required colors
  const requiredColors = ['primary', 'background', 'foreground'];
  for (const key of requiredColors) {
    if (!c[key]) {
      warnings.push({ path: key, message: `${key} color is recommended`, code: 'RECOMMENDED' });
    }
  }

  // Validate color format
  for (const [key, value] of Object.entries(c)) {
    if (typeof value !== 'string') {
      errors.push({ path: key, message: `${key} must be a string`, code: 'INVALID_TYPE' });
    } else if (!colorRegex.test(value)) {
      warnings.push({ path: key, message: `${key} may not be a valid color format`, code: 'INVALID_FORMAT' });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Generate CSS variables from tokens
 */
export function generateCSSVariables(tokens: ThemeTokens): string {
  const lines: string[] = [':root {'];

  if (tokens.colors) {
    for (const [key, value] of Object.entries(tokens.colors)) {
      if (value) {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        lines.push(`  --color-${cssKey}: ${value};`);
      }
    }
  }

  if (tokens.spacing) {
    for (const [key, value] of Object.entries(tokens.spacing)) {
      if (value) {
        lines.push(`  --spacing-${key}: ${value};`);
      }
    }
  }

  if (tokens.borderRadius) {
    for (const [key, value] of Object.entries(tokens.borderRadius)) {
      if (value) {
        lines.push(`  --radius-${key}: ${value};`);
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Merge theme tokens with defaults
 */
export function mergeTokens(base: ThemeTokens, override: Partial<ThemeTokens>): ThemeTokens {
  return {
    colors: { ...base.colors, ...override.colors },
    typography: { ...base.typography, ...override.typography },
    spacing: { ...base.spacing, ...override.spacing },
    borderRadius: { ...base.borderRadius, ...override.borderRadius },
    shadows: { ...base.shadows, ...override.shadows },
    animations: { ...base.animations, ...override.animations }
  };
}

