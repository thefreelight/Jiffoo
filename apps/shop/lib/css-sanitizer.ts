/**
 * CSS Sanitization Utility
 *
 * Prevents XSS attacks via CSS injection by validating CSS values
 * using an allowlist approach. Only safe, validated patterns are allowed.
 */

/**
 * Dangerous patterns that should never appear in CSS values
 */
const DANGEROUS_PATTERNS = [
  /<\/style/i,
  /<script/i,
  /javascript:/i,
  /expression\s*\(/i,
  /import\s+/i,
  /@import/i,
  /@charset/i,
  /binding\s*:/i,
  /behavior\s*:/i,
  /vbscript:/i,
  /data:text\/html/i,
];

/**
 * Safe CSS color names (subset of standard colors)
 */
const SAFE_COLOR_NAMES = new Set([
  'transparent',
  'currentcolor',
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'brown',
  'gray',
  'grey',
  'cyan',
  'magenta',
  'lime',
  'navy',
  'teal',
  'olive',
  'maroon',
  'aqua',
  'silver',
  'fuchsia',
]);

/**
 * Safe CSS length units
 */
const SAFE_LENGTH_UNITS = new Set([
  'px',
  'em',
  'rem',
  '%',
  'vh',
  'vw',
  'vmin',
  'vmax',
  'ch',
  'ex',
  'cm',
  'mm',
  'in',
  'pt',
  'pc',
]);

/**
 * Check if a value contains dangerous patterns
 */
function containsDangerousPattern(value: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Sanitize a hex color value
 */
function sanitizeHexColor(value: string): string | null {
  // Match #RGB or #RRGGBB format
  const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  return hexPattern.test(value) ? value : null;
}

/**
 * Sanitize rgb/rgba color values
 */
function sanitizeRgbColor(value: string): string | null {
  // Match rgb(r, g, b) - exactly 3 parameters
  const rgbPattern = /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i;
  // Match rgba(r, g, b, a) - exactly 4 parameters
  const rgbaPattern = /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0|1|0?\.\d+)\s*\)$/i;

  let match = value.match(rgbPattern);
  if (!match) {
    match = value.match(rgbaPattern);
  }

  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  // Validate RGB values are in range 0-255
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }

  return value;
}

/**
 * Sanitize hsl/hsla color values
 */
function sanitizeHslColor(value: string): string | null {
  // Match hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslPattern = /^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;
  const match = value.match(hslPattern);

  if (!match) return null;

  const h = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  const l = parseInt(match[3], 10);

  // Validate HSL values are in valid ranges
  if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
    return null;
  }

  return value;
}

/**
 * Sanitize a CSS color value
 *
 * Accepts:
 * - Hex colors (#fff, #ffffff)
 * - RGB/RGBA (rgb(255, 0, 0), rgba(255, 0, 0, 0.5))
 * - HSL/HSLA (hsl(0, 100%, 50%), hsla(0, 100%, 50%, 0.5))
 * - Named colors from safe list
 */
export function sanitizeColorValue(value: string | undefined): string {
  if (!value) return '';

  // Trim and normalize
  const normalized = value.trim().toLowerCase();

  // Check for dangerous patterns
  if (containsDangerousPattern(normalized)) {
    return '';
  }

  // Check if it's a safe named color
  if (SAFE_COLOR_NAMES.has(normalized)) {
    return normalized;
  }

  // Check if it's a hex color
  if (normalized.startsWith('#')) {
    const sanitized = sanitizeHexColor(normalized);
    return sanitized || '';
  }

  // Check if it's rgb/rgba
  if (normalized.startsWith('rgb')) {
    const sanitized = sanitizeRgbColor(normalized);
    return sanitized || '';
  }

  // Check if it's hsl/hsla
  if (normalized.startsWith('hsl')) {
    const sanitized = sanitizeHslColor(normalized);
    return sanitized || '';
  }

  // Unknown format - reject
  return '';
}

/**
 * Sanitize a CSS length value
 *
 * Accepts values like: 10px, 2em, 50%, 100vh, etc.
 * Rejects negative values for safety (can be adjusted if needed)
 */
export function sanitizeCSSLength(value: string | undefined): string {
  if (!value) return '';

  // Trim and normalize
  const normalized = value.trim().toLowerCase();

  // Check for dangerous patterns
  if (containsDangerousPattern(normalized)) {
    return '';
  }

  // Special case: '0' is valid without a unit
  if (normalized === '0') {
    return normalized;
  }

  // Match number followed by unit
  const lengthPattern = /^([0-9]+(?:\.[0-9]+)?)(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/;
  const match = normalized.match(lengthPattern);

  if (!match) return '';

  const unit = match[2];

  // Verify unit is in safe list
  if (!SAFE_LENGTH_UNITS.has(unit)) {
    return '';
  }

  return normalized;
}

/**
 * Sanitize a font family value
 *
 * Accepts standard font names and generic families.
 * Rejects values with quotes that could break out of CSS context.
 */
export function sanitizeFontFamily(value: string | undefined): string {
  if (!value) return '';

  // Trim the value
  const normalized = value.trim();

  // Check for dangerous patterns
  if (containsDangerousPattern(normalized)) {
    return '';
  }

  // Allow alphanumeric, spaces, commas, hyphens, and common generic families
  // This regex allows: "Arial", "Times New Roman", "sans-serif", etc.
  // It prevents quotes and other special characters that could be used for injection
  const fontPattern = /^[\w\s,\-]+$/;

  if (!fontPattern.test(normalized)) {
    return '';
  }

  // Additional check: no semicolons or braces
  if (normalized.includes(';') || normalized.includes('{') || normalized.includes('}')) {
    return '';
  }

  // Limit length to prevent DoS
  if (normalized.length > 200) {
    return '';
  }

  return normalized;
}

/**
 * Sanitize a generic CSS value
 *
 * Performs basic safety checks. Use more specific sanitizers when possible.
 */
export function sanitizeCSSValue(value: string | undefined): string {
  if (!value) return '';

  // Trim the value
  const normalized = value.trim();

  // Check for dangerous patterns
  if (containsDangerousPattern(normalized)) {
    return '';
  }

  // Check for URL functions - we'll be very strict here
  // Only allow data:image URLs (for inline images) and reject everything else
  if (normalized.includes('url(')) {
    // For now, reject all url() to be safe
    // Can be refined later to allow specific whitelisted domains
    return '';
  }

  // Check for other function calls that might be dangerous
  if (normalized.includes('calc(') || normalized.includes('var(')) {
    // These are generally safe but let's validate they don't contain dangerous content
    // For now, allow them but keep the dangerous pattern check
    // A more sophisticated implementation might parse these
  }

  // Reject values with semicolons (could break out of property)
  if (normalized.includes(';')) {
    return '';
  }

  // Reject values with curly braces (could inject new rules)
  if (normalized.includes('{') || normalized.includes('}')) {
    return '';
  }

  // Limit length to prevent DoS
  if (normalized.length > 500) {
    return '';
  }

  return normalized;
}

/**
 * Validate an entire theme config object
 *
 * Returns true if the config appears safe, false otherwise.
 * This is an additional defense layer.
 */
export function validateThemeConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Convert to string and check for obvious XSS patterns
  const configStr = JSON.stringify(config);

  return !containsDangerousPattern(configStr);
}
