/**
 * Plugin Management Service
 * Manages plugin enable/disable state and configuration
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { PluginMeta, PluginState, PluginConfig, InstalledPluginsResponse } from './types';

// Storage paths
const CONFIG_DIR = path.join(process.cwd(), 'data');
const PLUGIN_STATES_FILE = path.join(CONFIG_DIR, 'plugin-states.json');
const EXTENSIONS_DIR = path.join(process.cwd(), 'extensions', 'plugins');

// Built-in plugins (always available)
// Alpha: Only Stripe is included as built-in payment method
const BUILTIN_PLUGINS: PluginMeta[] = [
  {
    slug: 'stripe-payment',
    name: 'Stripe Payment',
    version: '1.0.0',
    description: 'Accept credit card payments with Stripe. Supports one-time payments, subscriptions, and more.',
    author: 'Jiffoo Team',
    category: 'payment',
    source: 'builtin',
    icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/stripe.svg',
  },
];

/**
 * Ensure config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

/**
 * Read plugin states
 */
async function readPluginStates(): Promise<Record<string, PluginState>> {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(PLUGIN_STATES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save plugin states
 */
async function savePluginStates(states: Record<string, PluginState>): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(PLUGIN_STATES_FILE, JSON.stringify(states, null, 2));
}

/**
 * Get plugin state
 */
export async function getPluginState(slug: string): Promise<PluginState | null> {
  const states = await readPluginStates();
  return states[slug] || null;
}

/**
 * Enable plugin
 */
export async function enablePlugin(slug: string): Promise<PluginState> {
  // Verify plugin exists
  const plugins = await getInstalledPlugins();
  const plugin = plugins.plugins.find(p => p.slug === slug);
  if (!plugin) {
    throw new Error(`Plugin "${slug}" not found`);
  }

  const states = await readPluginStates();
  const state: PluginState = {
    slug,
    enabled: true,
    config: states[slug]?.config || {},
    enabledAt: new Date().toISOString(),
  };
  states[slug] = state;
  await savePluginStates(states);

  return state;
}

/**
 * Disable plugin
 */
export async function disablePlugin(slug: string): Promise<PluginState> {
  const states = await readPluginStates();
  const state: PluginState = {
    slug,
    enabled: false,
    config: states[slug]?.config || {},
    disabledAt: new Date().toISOString(),
  };
  states[slug] = state;
  await savePluginStates(states);

  return state;
}

/**
 * Update plugin config
 */
export async function updatePluginConfig(slug: string, config: PluginConfig): Promise<PluginState> {
  const states = await readPluginStates();
  const existing = states[slug] || { slug, enabled: false, config: {} };
  const state: PluginState = {
    ...existing,
    config: { ...existing.config, ...config },
  };
  states[slug] = state;
  await savePluginStates(states);

  return state;
}

/**
 * Get installed plugins list
 */
export async function getInstalledPlugins(): Promise<InstalledPluginsResponse> {
  const states = await readPluginStates();
  const plugins: Array<PluginMeta & { enabled: boolean }> = [];

  // Add built-in plugins
  for (const p of BUILTIN_PLUGINS) {
    plugins.push({ ...p, enabled: states[p.slug]?.enabled ?? true });
  }

  // Read installed plugins (from state file)
  for (const [slug, state] of Object.entries(states)) {
    // Skip if already in BUILTIN_PLUGINS
    if (BUILTIN_PLUGINS.some(p => p.slug === slug)) continue;

    // Check if it is an installed plugin
    if (state.installed) {
      plugins.push({
        slug,
        name: state.name || slug,
        version: state.version || '1.0.0',
        description: state.description,
        author: state.author,
        category: state.category,
        source: (state.source as 'builtin' | 'installed' | 'marketplace') || 'marketplace',
        enabled: state.enabled ?? false,
        icon: state.icon,
      });
    }
  }

  // Read installed plugins (from file system)
  try {
    const dirs = await fs.readdir(EXTENSIONS_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const manifestPath = path.join(EXTENSIONS_DIR, dir.name, 'manifest.json');
        try {
          const data = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(data);
          const slug = manifest.slug || dir.name;

          // Skip if already added
          if (plugins.some(p => p.slug === slug)) continue;

          plugins.push({
            slug,
            name: manifest.name || dir.name,
            version: manifest.version || '1.0.0',
            description: manifest.description,
            author: manifest.author,
            category: manifest.category,
            source: 'installed',
            enabled: states[slug]?.enabled ?? false,
          });
        } catch {
          // Ignore invalid plugins
        }
      }
    }
  } catch {
    // extensions directory does not exist
  }

  return { plugins, total: plugins.length };
}

/**
 * Install built-in plugin
 */
export async function installBuiltinPlugin(slug: string, pluginInfo: any): Promise<PluginState> {
  const states = await readPluginStates();

  const state: PluginState = {
    slug,
    enabled: true,
    installed: true,
    config: {},
    name: pluginInfo.name,
    version: pluginInfo.version,
    description: pluginInfo.description,
    author: pluginInfo.author,
    category: pluginInfo.category,
    icon: pluginInfo.icon,
    source: 'builtin',
    installedAt: new Date().toISOString(),
    enabledAt: new Date().toISOString(),
  };

  states[slug] = state;
  await savePluginStates(states);

  return state;
}

/**
 * Check if plugin is installed and enabled
 */
export async function isPluginEnabled(slug: string): Promise<boolean> {
  const state = await getPluginState(slug);
  return state?.installed === true && state?.enabled === true;
}

/**
 * Get plugin configuration
 */
export async function getPluginConfig(slug: string): Promise<PluginConfig | null> {
  const state = await getPluginState(slug);
  return state?.config || null;
}

export const PluginManagementService = {
  getPluginState,
  enablePlugin,
  disablePlugin,
  updatePluginConfig,
  getInstalledPlugins,
  installBuiltinPlugin,
  isPluginEnabled,
  getPluginConfig,
};

