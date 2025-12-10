/**
 * Jiffoo Design System - Accessibility Utilities
 */

/**
 * Parse a color string to RGB values
 */
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }
  return null;
}

/**
 * Calculate relative luminance of a color
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function calculateContrastRatio(
  foreground: string,
  background: string
): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  if (!fg || !bg) return 0;

  const l1 = getLuminance(fg.r, fg.g, fg.b);
  const l2 = getLuminance(bg.r, bg.g, bg.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color contrast meets WCAG AA standard (4.5:1 for normal text)
 */
export function meetsContrastAA(foreground: string, background: string): boolean {
  return calculateContrastRatio(foreground, background) >= 4.5;
}

/**
 * Check if color contrast meets WCAG AAA standard (7:1 for normal text)
 */
export function meetsContrastAAA(foreground: string, background: string): boolean {
  return calculateContrastRatio(foreground, background) >= 7;
}

/**
 * Validate touch target size meets 44x44px minimum
 */
export function validateTouchTarget(
  element: HTMLElement
): { valid: boolean; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    valid: rect.width >= 44 && rect.height >= 44,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Check if element has accessible name (via aria-label, aria-labelledby, or text content)
 */
export function hasAccessibleName(element: HTMLElement): boolean {
  return !!(
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') ||
    element.textContent?.trim()
  );
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

