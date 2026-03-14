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
  source?: 'builtin' | 'installed';
  icon?: string;
}

export interface PluginState {
  slug: string;
  enabled: boolean;
  /** Pseudo-uninstall flag: hidden plugins are treated as removed from UI and gateway */
  hidden?: boolean;
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
  hiddenAt?: string;
}

export interface PluginConfig {
  [key: string]: unknown;
}

export interface InstalledPluginsResponse {
  items: Array<PluginMeta & { enabled: boolean }>;
  total: number;
}

