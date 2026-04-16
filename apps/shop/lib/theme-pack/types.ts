/**
 * Theme Pack Types
 *
 * Type definitions for Theme Pack v1 specification
 * Theme Packs are configuration/resource packages that control appearance and layout
 * WITHOUT any executable code (JS/TS/React runtime code).
 */

/**
 * Theme Pack Manifest (theme.json)
 * This is the main entry point for a Theme Pack
 */
export interface ThemePackManifest {
  /** Schema version, must be 1 for v1 */
  schemaVersion: 1;
  /** Theme slug (lowercase letters, numbers, hyphens only) */
  slug: string;
  /** Display name */
  name: string;
  /** Semantic version */
  version: string;
  /** Target platform */
  target: 'shop' | 'admin';
  /** Theme description */
  description?: string;
  /** Author name */
  author?: string;
  /** Author URL */
  authorUrl?: string;
  /** Entry points configuration */
  entry?: ThemePackEntry;
  /** Compatibility requirements */
  compatibility?: ThemeCompatibility;
  /** Default configuration */
  defaultConfig?: ThemePackConfig;
  /**
   * Optional storefront renderer mode.
   * "embedded" means the downloaded Theme Pack selects a built-in React theme renderer.
   */
  'x-jiffoo-renderer-mode'?: 'platform' | 'embedded';
  /**
   * Built-in renderer slug to use when renderer mode is "embedded".
   */
  'x-jiffoo-renderer-slug'?: string;
}

/**
 * Theme Pack entry points (paths relative to theme root)
 */
export interface ThemePackEntry {
  /** CSS tokens file path, e.g., "tokens.css" */
  tokensCSS?: string;
  /** Templates directory path, e.g., "templates" */
  templatesDir?: string;
  /** Assets directory path, e.g., "assets" */
  assetsDir?: string;
  /** Optional packaged embedded theme runtime bridge. */
  runtimeJS?: string;
  /** Settings schema file path, e.g., "schemas/settings.schema.json" */
  settingsSchema?: string;
  /** Presets directory path, e.g., "presets" */
  presetsDir?: string;
}

/**
 * Theme Pack compatibility requirements
 */
export interface ThemeCompatibility {
  /** Minimum core version required */
  minCoreVersion?: string;
}

/**
 * Theme Pack configuration (stored in DB, not in theme files)
 */
export interface ThemePackConfig {
  /** Color configurations */
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    foreground?: string;
    muted?: string;
    border?: string;
    accent?: string;
  };
  /** Typography configurations */
  typography?: {
    fontFamily?: string;
    headingFamily?: string;
    fontSize?: string;
    lineHeight?: string;
  };
  /** Layout configurations */
  layout?: {
    radius?: string;
    containerWidth?: string;
    spacing?: string;
    headerHeight?: string;
  };
  /** Additional custom config */
  [key: string]: unknown;
}

/**
 * Page Template (templates/{page}.json)
 * Defines the block composition for a page
 */
export interface PageTemplate {
  /** Schema version */
  schemaVersion: 1;
  /** Page identifier (e.g., "home", "product", "category") */
  page: string;
  /** Ordered list of blocks */
  blocks: BlockInstance[];
}

/**
 * Block instance in a template
 */
export interface BlockInstance {
  /** Block type identifier (must be from platform's Block Registry) */
  type: string;
  /** Block-specific settings (data only, no logic) */
  settings?: BlockSettings;
  /** Optional unique ID for this block instance */
  id?: string;
}

/**
 * Block settings - data-only configuration
 */
export interface BlockSettings {
  [key: string]: string | number | boolean | string[] | BlockSettings | undefined;
}

/**
 * Active theme information from API
 */
export interface ActiveTheme {
  slug: string;
  version: string;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market';
  config: ThemePackConfig;
  activatedAt: string;
  previousSlug?: string;
}

/**
 * Theme runtime state
 */
export interface ThemeRuntimeState {
  /** Current active theme */
  activeTheme: ActiveTheme | null;
  /** Whether tokens CSS is loaded */
  tokensLoaded: boolean;
  /** Current page template */
  currentTemplate: PageTemplate | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Block Registry entry
 */
export interface BlockRegistryEntry {
  /** Block type identifier */
  type: string;
  /** Display name */
  name: string;
  /** Block description */
  description?: string;
  /** React component to render this block */
  component: React.ComponentType<BlockComponentProps>;
  /** Default settings */
  defaultSettings?: BlockSettings;
}

/**
 * Props passed to block components
 */
export interface BlockComponentProps {
  /** Block settings from template */
  settings: BlockSettings;
  /** Theme configuration */
  themeConfig?: ThemePackConfig;
  /** Block instance ID */
  blockId?: string;
}

/**
 * Settings Schema for dynamic form generation
 */
export interface SettingsSchema {
  /** JSON Schema $schema */
  $schema?: string;
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Schema property definition
 */
export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Property title for UI */
  title?: string;
  /** Property description */
  description?: string;
  /** Default value */
  default?: unknown;
  /** Format hint (e.g., 'color', 'uri') */
  format?: string;
  /** Enum values for select */
  enum?: (string | number)[];
  /** Minimum value for numbers */
  minimum?: number;
  /** Maximum value for numbers */
  maximum?: number;
  /** Nested properties for objects */
  properties?: Record<string, SchemaProperty>;
}
