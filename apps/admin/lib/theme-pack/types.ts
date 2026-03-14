/**
 * Admin Theme Pack Types
 *
 * Type definitions for Admin Theme Pack v1 specification.
 * Admin themes are simpler than Shop themes - they primarily focus on
 * tokens (CSS variables) and layout options, not page templates.
 */

/**
 * Admin Theme Pack Manifest (theme.json)
 */
export interface AdminThemePackManifest {
  /** Schema version, must be 1 for v1 */
  schemaVersion: 1;
  /** Theme slug (lowercase letters, numbers, hyphens only) */
  slug: string;
  /** Display name */
  name: string;
  /** Semantic version */
  version: string;
  /** Target platform (must be 'admin') */
  target: 'admin';
  /** Theme description */
  description?: string;
  /** Author name */
  author?: string;
  /** Author URL */
  authorUrl?: string;
  /** Entry points configuration */
  entry?: AdminThemePackEntry;
  /** Default configuration */
  defaultConfig?: AdminThemePackConfig;
}

/**
 * Admin Theme Pack entry points
 */
export interface AdminThemePackEntry {
  /** CSS tokens file path, e.g., "tokens.css" */
  tokensCSS?: string;
  /** Settings schema file path */
  settingsSchema?: string;
}

/**
 * Admin Theme Pack configuration
 */
export interface AdminThemePackConfig {
  /** Color configurations */
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    foreground?: string;
    muted?: string;
    border?: string;
    accent?: string;
    sidebar?: string;
    header?: string;
  };
  /** Typography configurations */
  typography?: {
    fontFamily?: string;
    headingFamily?: string;
    fontSize?: string;
  };
  /** Layout configurations */
  layout?: {
    radius?: string;
    sidebarWidth?: string;
    headerHeight?: string;
    density?: 'compact' | 'normal' | 'comfortable';
  };
  /** Additional custom config */
  [key: string]: unknown;
}

/**
 * Active admin theme information
 */
export interface ActiveAdminTheme {
  slug: string;
  version: string;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market';
  config: AdminThemePackConfig;
  activatedAt: string;
  previousSlug?: string;
}

/**
 * Admin theme runtime state
 */
export interface AdminThemeRuntimeState {
  /** Current active theme */
  activeTheme: ActiveAdminTheme | null;
  /** Whether tokens CSS is loaded */
  tokensLoaded: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}
