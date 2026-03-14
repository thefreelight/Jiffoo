/**
 * Jiffoo Shared - Validation Utilities
 *
 * Common validation types and helper functions used across plugin tooling and theme contracts.
 * This provides a lightweight, dependency-free validation layer for runtime checks.
 */

/**
 * Validation error with optional error code
 */
export interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

/**
 * Validation warning for non-critical issues
 */
export interface ValidationWarning {
  path: string;
  message: string;
}

/**
 * Validation result containing errors and warnings
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Create a successful validation result
 */
export function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Type guard for checking if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for checking if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for checking if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Add an error to validation result and mark as invalid
 */
export function addError(
  result: ValidationResult,
  path: string,
  message: string,
  code?: string
): void {
  result.errors.push({ path, message, code });
  result.valid = false;
}

/**
 * Add a warning to validation result (does not affect validity)
 */
export function addWarning(
  result: ValidationResult,
  path: string,
  message: string
): void {
  result.warnings.push({ path, message });
}

/**
 * Validate hex color format (#RGB or #RRGGBB)
 */
export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * Validate URL format
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate strict semver format (MAJOR.MINOR.PATCH)
 */
export function isValidSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value);
}

/**
 * Validate slug format (lowercase letters, numbers, hyphens)
 */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9-]+$/.test(value);
}

/**
 * Validate strict slug format (start with letter, end with letter/number)
 */
export function isValidStrictSlug(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/.test(value);
}

/**
 * Validate that a string is not empty after trimming
 */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

/**
 * Validate that a value is in a list of allowed values
 */
export function isInList<T>(value: T, list: readonly T[]): boolean {
  return (list as readonly unknown[]).includes(value);
}

/**
 * Deep merge two objects recursively
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
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

/**
 * Convert camelCase or PascalCase to kebab-case
 */
export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Validate that a value matches a regex pattern
 */
export function matchesPattern(value: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(value);
  } catch {
    return false;
  }
}

/**
 * Validate number is within range
 */
export function isInRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Validate string length is within range
 */
export function isValidLength(value: string, min?: number, max?: number): boolean {
  const length = value.length;
  if (min !== undefined && length < min) return false;
  if (max !== undefined && length > max) return false;
  return true;
}
