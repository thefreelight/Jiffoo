/**
 * Jiffoo Theme SDK - Validators
 *
 * Lightweight runtime validation helpers used by the SDK and CLI.
 * This intentionally avoids adding heavy schema dependencies so the SDK
 * stays small and can run in Node scripts and build tools.
 */

import type { ThemeCategory, ThemeManifest, ThemeTokens, ColorTokens } from './types';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export const VALID_CATEGORIES: readonly ThemeCategory[] = [
  'general',
  'fashion',
  'electronics',
  'food',
  'home',
  'beauty',
  'sports',
  'minimal',
  'luxury',
] as const;

function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function addError(result: ValidationResult, path: string, message: string): void {
  result.errors.push({ path, message });
  result.valid = false;
}

function addWarning(result: ValidationResult, path: string, message: string): void {
  result.warnings.push({ path, message });
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

export function validateThemeManifest(manifest: unknown): ValidationResult {
  const result = ok();

  if (!isObject(manifest)) {
    addError(result, '', 'Manifest must be an object');
    return result;
  }

  const slug = manifest.slug;
  const name = manifest.name;
  const version = manifest.version;
  const category = manifest.category;

  if (!isString(slug) || slug.trim().length === 0) {
    addError(result, 'slug', 'Missing or invalid "slug"');
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    addError(result, 'slug', 'Slug must contain only lowercase letters, numbers, and hyphens');
  }

  if (!isString(name) || name.trim().length === 0) {
    addError(result, 'name', 'Missing or invalid "name"');
  }

  if (!isString(version) || version.trim().length === 0) {
    addError(result, 'version', 'Missing or invalid "version"');
  }

  if (!isString(category) || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    addError(result, 'category', `Invalid "category" (expected one of: ${VALID_CATEGORIES.join(', ')})`);
  }

  if ('description' in manifest && manifest.description !== undefined && !isString(manifest.description)) {
    addError(result, 'description', '"description" must be a string');
  }
  if ('author' in manifest && manifest.author !== undefined && !isString(manifest.author)) {
    addError(result, 'author', '"author" must be a string');
  }
  if ('thumbnail' in manifest && manifest.thumbnail !== undefined && !isString(manifest.thumbnail)) {
    addError(result, 'thumbnail', '"thumbnail" must be a string');
  }
  if ('screenshots' in manifest && manifest.screenshots !== undefined && !Array.isArray(manifest.screenshots)) {
    addError(result, 'screenshots', '"screenshots" must be an array of strings');
  }
  if ('tags' in manifest && manifest.tags !== undefined && !Array.isArray(manifest.tags)) {
    addError(result, 'tags', '"tags" must be an array of strings');
  }

  if ('tokens' in manifest && manifest.tokens !== undefined) {
    const tokensResult = validateThemeTokens(manifest.tokens);
    if (!tokensResult.valid) {
      for (const error of tokensResult.errors) addError(result, `tokens.${error.path}`.replace(/\.$/, ''), error.message);
    }
    for (const warning of tokensResult.warnings) addWarning(result, `tokens.${warning.path}`.replace(/\.$/, ''), warning.message);
  }

  return result;
}

export function validateThemeTokens(tokens: unknown): ValidationResult {
  const result = ok();

  if (tokens === undefined) return result;
  if (!isObject(tokens)) {
    addError(result, '', 'Tokens must be an object');
    return result;
  }

  if ('colors' in tokens && tokens.colors !== undefined) {
    const colorsResult = validateColorTokens(tokens.colors);
    if (!colorsResult.valid) {
      for (const error of colorsResult.errors) addError(result, `colors.${error.path}`.replace(/\.$/, ''), error.message);
    }
    for (const warning of colorsResult.warnings) addWarning(result, `colors.${warning.path}`.replace(/\.$/, ''), warning.message);
  }

  const objectSections: Array<keyof ThemeTokens> = [
    'typography',
    'spacing',
    'borderRadius',
    'shadows',
    'animations',
  ];

  for (const section of objectSections) {
    const value = (tokens as ThemeTokens)[section];
    if (value === undefined) continue;
    if (!isObject(value)) addError(result, String(section), `"${String(section)}" must be an object`);
  }

  return result;
}

export function validateColorTokens(colors: unknown): ValidationResult {
  const result = ok();

  if (colors === undefined) return result;
  if (!isObject(colors)) {
    addError(result, '', 'Colors must be an object');
    return result;
  }

  for (const [key, value] of Object.entries(colors)) {
    if (value === undefined) continue;
    if (!isString(value)) {
      addError(result, key, 'Color value must be a string');
      continue;
    }
    if (!isHexColor(value)) {
      addWarning(result, key, 'Color is not a hex value (expected #RGB or #RRGGBB)');
    }
  }

  return result;
}

export function mergeTokens(base: ThemeTokens = {}, override: Partial<ThemeTokens> = {}): ThemeTokens {
  return deepMerge(base, override);
}

export function generateCSSVariables(tokens: ThemeTokens = {}, options?: { selector?: string; prefix?: string }): string {
  const selector = options?.selector ?? ':root';
  const prefix = options?.prefix ?? '--jiffoo';

  const lines: string[] = [];
  const pushVar = (name: string, value: string) => {
    lines.push(`  ${prefix}-${name}: ${value};`);
  };

  const walk = (path: string[], value: unknown) => {
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const nextPath = [...path, toKebabCase(key)];
      if (isString(child)) {
        pushVar(nextPath.join('-'), child);
      } else if (isObject(child)) {
        walk(nextPath, child);
      }
    }
  };

  walk([], tokens as ThemeTokens);

  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };

  for (const [key, sourceValue] of Object.entries(source as Record<string, unknown>)) {
    if (sourceValue === undefined) continue;
    const targetValue = result[key];
    if (isObject(sourceValue) && isObject(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

// Narrowing helper for callers that already have ThemeTokens types.
export function isThemeTokens(value: unknown): value is ThemeTokens {
  return validateThemeTokens(value).valid;
}

// Convenience helper for callers that already have ColorTokens types.
export function isColorTokens(value: unknown): value is ColorTokens {
  return validateColorTokens(value).valid;
}

