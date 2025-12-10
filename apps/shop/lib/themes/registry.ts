/**
 * 主题注册表
 * 维护所有可用主题的映射关系，支持动态导入
 *
 * 支持两种主题来源：
 * 1. 内置主题 - 通过 npm 包安装，使用静态导入
 * 2. 已安装主题 - 通过 Extension Installer 安装到 extensions/themes/shop/
 */

import type { ThemePackage, ThemeMeta, ThemeRegistryEntry, ThemeRegistry } from 'shared/src/types/theme';

// ============================================================================
// 内置主题注册表（静态）
// ============================================================================

/**
 * 内置主题注册表
 * 将主题 slug 映射到动态导入函数
 */
export const BUILTIN_THEMES: ThemeRegistry = {
  default: {
    meta: {
      slug: 'default',
      name: 'Default Theme',
      version: '1.0.0',
      description: 'Jiffoo Mall 默认主题，简洁现代的电商风格',
      category: 'general',
      author: 'Jiffoo',
      target: 'shop',
      tags: ['modern', 'clean', 'responsive'],
    },
    load: async () => {
      const module = await import('@shop-themes/default');
      return module.default || module.theme;
    },
  },
  // 未来可添加更多内置主题
  // premium: {
  //   meta: { ... },
  //   load: () => import('@shop-themes/premium'),
  // },
};

// ============================================================================
// 动态主题注册表（运行时）
// ============================================================================

/**
 * 已安装主题注册表（运行时动态添加）
 */
const installedThemes: ThemeRegistry = {};

/**
 * 合并后的完整主题注册表
 */
export function getThemeRegistry(): ThemeRegistry {
  return {
    ...BUILTIN_THEMES,
    ...installedThemes,
  };
}

/**
 * 注册已安装的主题
 * @param slug - 主题标识符
 * @param entry - 主题注册表条目
 */
export function registerInstalledTheme(slug: string, entry: ThemeRegistryEntry): void {
  installedThemes[slug] = entry;
}

/**
 * 注销已安装的主题
 * @param slug - 主题标识符
 */
export function unregisterInstalledTheme(slug: string): void {
  delete installedThemes[slug];
}

/**
 * 清空已安装主题注册表
 */
export function clearInstalledThemes(): void {
  Object.keys(installedThemes).forEach(key => delete installedThemes[key]);
}

// ============================================================================
// 兼容性导出（保持向后兼容）
// ============================================================================

/**
 * 主题注册表（兼容旧代码）
 * @deprecated 使用 getThemeRegistry() 代替
 */
export const THEME_REGISTRY = new Proxy({} as Record<string, () => Promise<any>>, {
  get(_, slug: string) {
    const registry = getThemeRegistry();
    const entry = registry[slug];
    return entry ? entry.load : undefined;
  },
  has(_, slug: string) {
    return slug in getThemeRegistry();
  },
  ownKeys() {
    return Object.keys(getThemeRegistry());
  },
  getOwnPropertyDescriptor(_, slug: string) {
    if (slug in getThemeRegistry()) {
      return { enumerable: true, configurable: true };
    }
    return undefined;
  },
});

/**
 * 主题 Slug 类型
 */
export type ThemeSlug = string;

/**
 * 验证主题 slug 是否有效
 * @param slug - 要验证的主题标识符
 * @returns 如果 slug 在注册表中则返回 true
 */
export function isValidThemeSlug(slug: string): boolean {
  return slug in getThemeRegistry();
}

/**
 * 获取主题导入函数
 * @param slug - 主题标识符
 * @returns 主题包的动态导入函数
 */
export function getThemeImporter(slug: string): (() => Promise<any>) | undefined {
  const registry = getThemeRegistry();
  const entry = registry[slug];
  return entry?.load;
}

/**
 * 获取主题元数据
 * @param slug - 主题标识符
 * @returns 主题元数据
 */
export function getThemeMeta(slug: string): ThemeMeta | undefined {
  const registry = getThemeRegistry();
  return registry[slug]?.meta;
}

/**
 * 获取所有可用的主题 slugs
 * @returns 主题标识符数组
 */
export function getAvailableThemes(): string[] {
  return Object.keys(getThemeRegistry());
}

/**
 * 获取所有主题元数据
 * @returns 主题元数据数组
 */
export function getAllThemeMetas(): ThemeMeta[] {
  const registry = getThemeRegistry();
  return Object.values(registry).map(entry => entry.meta);
}

/**
 * 检查是否为内置主题
 * @param slug - 主题标识符
 */
export function isBuiltinTheme(slug: string): boolean {
  return slug in BUILTIN_THEMES;
}

/**
 * 检查是否为已安装主题
 * @param slug - 主题标识符
 */
export function isInstalledTheme(slug: string): boolean {
  return slug in installedThemes;
}
