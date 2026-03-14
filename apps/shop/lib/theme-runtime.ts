import { ServerStoreContext } from './server-store-context';
import {
    sanitizeColorValue,
    sanitizeCSSLength,
    sanitizeFontFamily,
    validateThemeConfig,
} from './css-sanitizer';

export interface ThemeConfig {
    colors?: {
        primary?: string;
        secondary?: string;
        background?: string;
        foreground?: string;
        muted?: string;
        border?: string;
    };
    typography?: {
        fontFamily?: string;
        headingFamily?: string;
    };
    layout?: {
        radius?: string;
        containerWidth?: string;
    };
    images?: {
        logo?: string;
        banner?: string;
    };
}

/**
 * Generate CSS variables from theme config
 * All values are sanitized to prevent XSS attacks via CSS injection
 */
export function generateThemeStyles(theme: ServerStoreContext['theme']): string {
    if (!theme || !theme.config) return '';

    const config = theme.config as ThemeConfig;

    // First-level validation: check entire config for dangerous patterns
    if (!validateThemeConfig(config)) {
        console.warn('[Theme] Theme config failed validation - contains dangerous patterns');
        return '';
    }

    const cssVars: string[] = [];

    // Helper to add var with sanitization
    const addVar = (name: string, value: string | undefined, sanitizer: (v: string | undefined) => string) => {
        if (!value) return;

        const sanitized = sanitizer(value);
        if (sanitized) {
            cssVars.push(`--theme-${name}: ${sanitized};`);
        } else {
            console.warn(`[Theme] Rejected invalid CSS value for ${name}: ${value}`);
        }
    };

    // Colors - use color sanitizer
    if (config.colors) {
        addVar('colors-primary', config.colors.primary, sanitizeColorValue);
        addVar('colors-secondary', config.colors.secondary, sanitizeColorValue);
        addVar('colors-background', config.colors.background, sanitizeColorValue);
        addVar('colors-foreground', config.colors.foreground, sanitizeColorValue);
        addVar('colors-muted', config.colors.muted, sanitizeColorValue);
        addVar('colors-border', config.colors.border, sanitizeColorValue);
    }

    // Typography - use font family sanitizer
    if (config.typography) {
        addVar('typography-font-family', config.typography.fontFamily, sanitizeFontFamily);
        addVar('typography-heading-family', config.typography.headingFamily, sanitizeFontFamily);
    }

    // Layout - use CSS length sanitizer
    if (config.layout) {
        addVar('layout-radius', config.layout.radius, sanitizeCSSLength);
        addVar('layout-container-width', config.layout.containerWidth, sanitizeCSSLength);
    }

    if (cssVars.length === 0) return '';

    return `:root {
    ${cssVars.join('\n    ')}
  }`;
}

/**
 * Resolve asset URL
 * If URL starts with /, preprend API URL if explicitly needed, 
 * but usually Next.js proxy handles /extensions/...
 * However, if asset is /extensions/..., we want to make sure it works.
 */
export function resolveThemeAsset(path?: string): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;

    // If it's a relative path stored in config (e.g. "assets/logo.png")
    // We strictly don't support partial paths in config without full context, 
    // users should expect the theme packer/runtime to handle this.
    // BUT, our plan said: "Theme Pack contains static resources".
    // The API serves them at /extensions/themes/shop/{slug}/assets/...

    // If the config contains full relative path e.g. /extensions/themes/shop/dark/assets/logo.png
    // Then standard <img src> works via Proxy.
    return path;
}
