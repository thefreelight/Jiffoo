/**
 * Jiffoo Theme SDK - Utilities
 *
 * Common utility functions for theme development.
 */

/**
 * Logger interface
 */
export interface ThemeLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Create a logger instance for a theme
 *
 * @param themeSlug - Theme slug for log prefix
 * @param options - Logger options
 * @returns Logger instance
 */
export function createThemeLogger(
  themeSlug: string,
  options: { level?: 'debug' | 'info' | 'warn' | 'error' } = {}
): ThemeLogger {
  const { level = 'info' } = options;
  const levels = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(level);

  const prefix = `[theme:${themeSlug}]`;

  const shouldLog = (logLevel: string): boolean => {
    return levels.indexOf(logLevel) >= minLevel;
  };

  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog('debug')) {
        console.debug(`${prefix} [DEBUG] ${message}`, ...args);
      }
    },

    info(message: string, ...args: unknown[]) {
      if (shouldLog('info')) {
        console.info(`${prefix} [INFO] ${message}`, ...args);
      }
    },

    warn(message: string, ...args: unknown[]) {
      if (shouldLog('warn')) {
        console.warn(`${prefix} [WARN] ${message}`, ...args);
      }
    },

    error(message: string, ...args: unknown[]) {
      if (shouldLog('error')) {
        console.error(`${prefix} [ERROR] ${message}`, ...args);
      }
    },
  };
}

/**
 * Format an error for display
 *
 * @param error - Error object or message
 * @returns Formatted error object
 */
export function formatThemeError(
  error: unknown
): { error: string; code?: string; details?: unknown } {
  if (error instanceof Error) {
    const result: { error: string; code?: string; details?: unknown } = {
      error: error.message,
    };

    if ('code' in error && typeof error.code === 'string') {
      result.code = error.code;
    }

    if ('details' in error) {
      result.details = error.details;
    }

    return result;
  }

  if (typeof error === 'string') {
    return { error };
  }

  return { error: 'An unknown error occurred' };
}

/**
 * Convert hex color to HSL
 *
 * @param hex - Hex color string
 * @returns HSL values
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex color
 *
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate color palette from a base color
 *
 * @param baseColor - Base hex color
 * @returns Color palette with shades
 */
export function generateColorPalette(baseColor: string): Record<string, string> {
  const { h, s, l } = hexToHSL(baseColor);

  return {
    '50': hslToHex(h, s, 97),
    '100': hslToHex(h, s, 94),
    '200': hslToHex(h, s, 86),
    '300': hslToHex(h, s, 76),
    '400': hslToHex(h, s, 64),
    '500': hslToHex(h, s, l), // Base color
    '600': hslToHex(h, s, 47),
    '700': hslToHex(h, s, 39),
    '800': hslToHex(h, s, 32),
    '900': hslToHex(h, s, 24),
    '950': hslToHex(h, s, 14),
  };
}

/**
 * Check if a color is light or dark
 *
 * @param hex - Hex color string
 * @returns true if color is light
 */
export function isLightColor(hex: string): boolean {
  const { l } = hexToHSL(hex);
  return l > 50;
}

/**
 * Get contrasting text color (black or white)
 *
 * @param backgroundColor - Background hex color
 * @returns '#000000' or '#ffffff'
 */
export function getContrastColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#000000' : '#ffffff';
}
