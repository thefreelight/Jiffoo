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
  source: 'builtin' | 'installed';
}

export interface ActiveTheme {
  slug: string;
  version: string;
  source: 'builtin' | 'installed';
  config: Record<string, unknown>;
  activatedAt: string;
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
  themes: ThemeMeta[];
  total: number;
}

