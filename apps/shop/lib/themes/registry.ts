/**
 * 主题注册表
 * 维护所有可用主题的映射关系，支持动态导入
 */

/**
 * 主题注册表
 * 将主题 slug 映射到动态导入函数
 */
export const THEME_REGISTRY = {
  default: () => import('@shop-themes/default'),
  // 未来可添加更多主题
  // premium: () => import('@shop-themes/premium'),
  // minimal: () => import('@shop-themes/minimal'),
} as const;

/**
 * 主题 Slug 类型
 * 从注册表自动推断
 */
export type ThemeSlug = keyof typeof THEME_REGISTRY;

/**
 * 验证主题 slug 是否有效
 * @param slug - 要验证的主题标识符
 * @returns 如果 slug 在注册表中则返回 true
 */
export function isValidThemeSlug(slug: string): slug is ThemeSlug {
  return slug in THEME_REGISTRY;
}

/**
 * 获取主题导入函数
 * @param slug - 主题标识符
 * @returns 主题包的动态导入函数
 */
export function getThemeImporter(slug: ThemeSlug) {
  return THEME_REGISTRY[slug];
}

/**
 * 获取所有可用的主题 slugs
 * @returns 主题标识符数组
 */
export function getAvailableThemes(): ThemeSlug[] {
  return Object.keys(THEME_REGISTRY) as ThemeSlug[];
}
