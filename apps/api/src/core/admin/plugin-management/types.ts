/**
 * Plugin Management Types
 */

export interface PluginMeta {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  source?: 'builtin' | 'installed' | 'marketplace';
  icon?: string;
}

export interface PluginState {
  slug: string;
  enabled: boolean;
  installed?: boolean;
  config: Record<string, unknown>;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  category?: string;
  icon?: string;
  source?: string;
  enabledAt?: string;
  disabledAt?: string;
  installedAt?: string;
}

export interface PluginConfig {
  [key: string]: unknown;
}

export interface InstalledPluginsResponse {
  plugins: Array<PluginMeta & { enabled: boolean }>;
  total: number;
}

