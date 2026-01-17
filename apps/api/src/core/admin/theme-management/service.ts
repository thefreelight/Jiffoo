/**
 * Theme Management Service
 * Manages theme activation and configuration using SystemSettings
 */

import path from 'path';
import { promises as fs } from 'fs';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import type { ActiveTheme, ThemeMeta, ThemeConfig, InstalledThemesResponse } from './types';

// Storage configuration
const EXTENSIONS_DIR = path.join(process.cwd(), 'extensions', 'themes', 'shop');

// Constants
const THEME_ACTIVE_KEY = 'theme.active.shop';
const THEME_PREVIOUS_KEY = 'theme.previous.shop';

// Built-in themes
const BUILTIN_THEMES: ThemeMeta[] = [
  {
    slug: 'default',
    name: 'Default Theme',
    version: '1.0.0',
    description: 'Jiffoo Mall default theme, clean and modern e-commerce style',
    author: 'Jiffoo',
    category: 'general',
    source: 'builtin',
  },
  {
    slug: 'yevbi',
    name: 'Yevbi Travel Theme',
    version: '1.0.0',
    description: 'Travel-focused e-commerce theme with purple-indigo gradient design for eSIM and travel packages',
    author: 'Yevbi',
    category: 'travel',
    source: 'builtin',
  },
];

// Default active theme
const DEFAULT_ACTIVE_THEME: ActiveTheme = {
  slug: 'default',
  version: '1.0.0',
  source: 'builtin',
  config: {},
  activatedAt: new Date().toISOString(),
};

/**
 * Get current active theme from SystemSettings
 */
export async function getActiveTheme(): Promise<ActiveTheme> {
  const active = await systemSettingsService.getSetting(THEME_ACTIVE_KEY);
  if (active && typeof active === 'object') {
    return active as ActiveTheme;
  }
  return DEFAULT_ACTIVE_THEME;
}

/**
 * Get previous theme from SystemSettings
 */
export async function getPreviousTheme(): Promise<ActiveTheme | null> {
  const previous = await systemSettingsService.getSetting(THEME_PREVIOUS_KEY);
  if (previous && typeof previous === 'object') {
    return previous as ActiveTheme;
  }
  return null;
}

/**
 * Activate theme
 */
export async function activateTheme(slug: string, config?: ThemeConfig): Promise<ActiveTheme> {
  // Find theme info
  const installedThemes = await getInstalledThemes();
  const allThemes = [...BUILTIN_THEMES, ...installedThemes.themes.filter(t => t.source === 'installed')];
  const theme = allThemes.find(t => t.slug === slug);

  if (!theme) {
    throw new Error(`Theme "${slug}" not found`);
  }

  // Get current theme to set as previous
  const currentTheme = await getActiveTheme();

  const newActiveTheme: ActiveTheme = {
    slug: theme.slug,
    version: theme.version,
    source: theme.source,
    config: config || currentTheme.slug === slug ? currentTheme.config : {}, // Keep config if same theme, else empty or new
    activatedAt: new Date().toISOString(),
  };

  // If we are actually changing themes (slug different), save current as previous
  if (currentTheme.slug !== slug) {
    await systemSettingsService.setSetting(THEME_PREVIOUS_KEY, currentTheme);
  }

  // Save new active theme
  await systemSettingsService.setSetting(THEME_ACTIVE_KEY, newActiveTheme);

  return newActiveTheme;
}

/**
 * Rollback to previous theme
 */
export async function rollbackTheme(): Promise<ActiveTheme> {
  const previousTheme = await getPreviousTheme();
  if (!previousTheme) {
    throw new Error('No previous theme available for rollback');
  }

  // Activate previous theme (this will swap current -> previous again logic effectively)
  // To strictly follow "rollback", we might want to restore exact config.
  // activateTheme method handles basic logic, but let's do it explicitly to ensure we restore exact state of previous.

  // We swap: New Active = Old Previous. New Previous = Old Active.
  const currentTheme = await getActiveTheme();

  await systemSettingsService.setSetting(THEME_ACTIVE_KEY, previousTheme);
  await systemSettingsService.setSetting(THEME_PREVIOUS_KEY, currentTheme);

  return previousTheme;
}

/**
 * Update theme config
 */
export async function updateThemeConfig(config: ThemeConfig): Promise<ActiveTheme> {
  const current = await getActiveTheme();
  const updated: ActiveTheme = {
    ...current,
    config: { ...current.config, ...config },
  };

  await systemSettingsService.setSetting(THEME_ACTIVE_KEY, updated);

  return updated;
}

/**
 * Get installed themes list
 */
export async function getInstalledThemes(): Promise<InstalledThemesResponse> {
  const themes: ThemeMeta[] = [...BUILTIN_THEMES];

  // Read installed themes from disk
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
          // Ignore invalid themes
        }
      }
    }
  } catch {
    // extensions directory does not exist or empty
  }

  return { themes, total: themes.length };
}

export const ThemeManagementService = {
  getActiveTheme,
  getPreviousTheme,
  activateTheme,
  rollbackTheme,
  updateThemeConfig,
  getInstalledThemes,
};
