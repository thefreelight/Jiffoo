/**
 * Plugin Management Service
 * Manages plugin enable/disable state and configuration
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { PluginMeta, PluginState, PluginConfig, InstalledPluginsResponse } from './types';

// 存储路径
const CONFIG_DIR = path.join(process.cwd(), 'data');
const PLUGIN_STATES_FILE = path.join(CONFIG_DIR, 'plugin-states.json');
const EXTENSIONS_DIR = path.join(process.cwd(), 'extensions', 'plugins');

// 内置插件 (这些始终可用)
const BUILTIN_PLUGINS: PluginMeta[] = [];

/**
 * 确保配置目录存在
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // 目录已存在
  }
}

/**
 * 读取插件状态
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
 * 保存插件状态
 */
async function savePluginStates(states: Record<string, PluginState>): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(PLUGIN_STATES_FILE, JSON.stringify(states, null, 2));
}

/**
 * 获取插件状态
 */
export async function getPluginState(slug: string): Promise<PluginState | null> {
  const states = await readPluginStates();
  return states[slug] || null;
}

/**
 * 启用插件
 */
export async function enablePlugin(slug: string): Promise<PluginState> {
  // 验证插件存在
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
 * 禁用插件
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
 * 更新插件配置
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
 * 获取已安装插件列表
 */
export async function getInstalledPlugins(): Promise<InstalledPluginsResponse> {
  const states = await readPluginStates();
  const plugins: Array<PluginMeta & { enabled: boolean }> = [];

  // 添加内置插件
  for (const p of BUILTIN_PLUGINS) {
    plugins.push({ ...p, enabled: states[p.slug]?.enabled ?? true });
  }

  // 读取已安装的插件（从状态文件中）
  for (const [slug, state] of Object.entries(states)) {
    // 跳过已经在 BUILTIN_PLUGINS 中的
    if (BUILTIN_PLUGINS.some(p => p.slug === slug)) continue;

    // 检查是否是已安装的插件
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

  // 读取已安装的插件（从文件系统）
  try {
    const dirs = await fs.readdir(EXTENSIONS_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const manifestPath = path.join(EXTENSIONS_DIR, dir.name, 'manifest.json');
        try {
          const data = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(data);
          const slug = manifest.slug || dir.name;

          // 跳过已经添加的
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
          // 忽略无效插件
        }
      }
    }
  } catch {
    // extensions 目录不存在
  }

  return { plugins, total: plugins.length };
}

/**
 * 安装内置插件
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
 * 检查插件是否已安装并启用
 */
export async function isPluginEnabled(slug: string): Promise<boolean> {
  const state = await getPluginState(slug);
  return state?.installed === true && state?.enabled === true;
}

/**
 * 获取插件配置
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

