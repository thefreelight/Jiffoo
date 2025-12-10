/**
 * Theme Management Service
 * Manages theme activation and configuration
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { ActiveTheme, ThemeMeta, ThemeConfig, InstalledThemesResponse } from './types';

// 存储路径
const CONFIG_DIR = path.join(process.cwd(), 'data');
const ACTIVE_THEME_FILE = path.join(CONFIG_DIR, 'active-theme.json');
const EXTENSIONS_DIR = path.join(process.cwd(), 'extensions', 'themes', 'shop');

// 内置主题
const BUILTIN_THEMES: ThemeMeta[] = [
  {
    slug: 'default',
    name: 'Default Theme',
    version: '1.0.0',
    description: 'Jiffoo Mall 默认主题，简洁现代的电商风格',
    author: 'Jiffoo',
    category: 'general',
    source: 'builtin',
  },
];

// 默认激活主题
const DEFAULT_ACTIVE_THEME: ActiveTheme = {
  slug: 'default',
  version: '1.0.0',
  source: 'builtin',
  config: {},
  activatedAt: new Date().toISOString(),
};

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
 * 获取当前激活的主题
 */
export async function getActiveTheme(): Promise<ActiveTheme> {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(ACTIVE_THEME_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // 文件不存在，返回默认主题
    return DEFAULT_ACTIVE_THEME;
  }
}

/**
 * 激活主题
 */
export async function activateTheme(slug: string, config?: ThemeConfig): Promise<ActiveTheme> {
  // 查找主题
  const installedThemes = await getInstalledThemes();
  const allThemes = [...BUILTIN_THEMES, ...installedThemes.themes.filter(t => t.source === 'installed')];
  const theme = allThemes.find(t => t.slug === slug);

  if (!theme) {
    throw new Error(`Theme "${slug}" not found`);
  }

  const activeTheme: ActiveTheme = {
    slug: theme.slug,
    version: theme.version,
    source: theme.source,
    config: config || {},
    activatedAt: new Date().toISOString(),
  };

  await ensureConfigDir();
  await fs.writeFile(ACTIVE_THEME_FILE, JSON.stringify(activeTheme, null, 2));

  return activeTheme;
}

/**
 * 更新主题配置
 */
export async function updateThemeConfig(config: ThemeConfig): Promise<ActiveTheme> {
  const current = await getActiveTheme();
  const updated: ActiveTheme = {
    ...current,
    config: { ...current.config, ...config },
  };

  await ensureConfigDir();
  await fs.writeFile(ACTIVE_THEME_FILE, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * 获取已安装主题列表
 */
export async function getInstalledThemes(): Promise<InstalledThemesResponse> {
  const themes: ThemeMeta[] = [...BUILTIN_THEMES];

  // 读取已安装的主题
  try {
    const dirs = await fs.readdir(EXTENSIONS_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const themeJsonPath = path.join(EXTENSIONS_DIR, dir.name, 'theme.json');
        try {
          const data = await fs.readFile(themeJsonPath, 'utf-8');
          const themeMeta = JSON.parse(data);
          themes.push({
            slug: themeMeta.slug || dir.name,
            name: themeMeta.name || dir.name,
            version: themeMeta.version || '1.0.0',
            description: themeMeta.description,
            author: themeMeta.author,
            category: themeMeta.category,
            previewImage: themeMeta.previewImage,
            source: 'installed',
          });
        } catch {
          // 忽略无效主题
        }
      }
    }
  } catch {
    // extensions 目录不存在
  }

  return { themes, total: themes.length };
}

export const ThemeManagementService = {
  getActiveTheme,
  activateTheme,
  updateThemeConfig,
  getInstalledThemes,
};

