/**
 * Theme Management Types
 */

export interface ThemeMeta {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  previewImage?: string;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market';
  type?: 'pack' | 'app';
  target?: 'shop' | 'admin';
}

export interface ActiveTheme {
  slug: string;
  version: string;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market';
  type: 'pack' | 'app'; // Required: 'pack' for Theme Pack, 'app' for Theme App
  config: Record<string, unknown>;
  activatedAt: string;
  previousSlug?: string;
  // Only present when type='app'
  baseUrl?: string;
  port?: number;
}

export interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  customCss?: string;
  [key: string]: unknown;
}

export interface ActivateThemeInput {
  slug: string;
  config?: ThemeConfig;
}

export interface InstalledThemesResponse {
  items: ThemeMeta[];
  total: number;
}
