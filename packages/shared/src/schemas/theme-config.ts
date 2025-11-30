/**
 * 主题配置验证 Schema
 * 使用 Zod 验证主题配置的安全性和有效性
 */

import { z } from 'zod';

/**
 * 品牌配置 Schema
 */
const BrandConfigSchema = z.object({
  logoUrl: z.string().url().max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  fontFamily: z.string().max(100).optional(),
}).optional();

/**
 * 布局配置 Schema
 */
const LayoutConfigSchema = z.object({
  headerSticky: z.boolean().optional(),
  showFooterLinks: z.boolean().optional(),
  maxWidth: z.string().max(20).optional(),
}).optional();

/**
 * 功能配置 Schema
 */
const FeaturesConfigSchema = z.object({
  showWishlist: z.boolean().optional(),
  showRatings: z.boolean().optional(),
  enableQuickView: z.boolean().optional(),
}).optional();

/**
 * 主题配置 Schema
 */
export const ThemeConfigSchema = z.object({
  brand: BrandConfigSchema,
  layout: LayoutConfigSchema,
  features: FeaturesConfigSchema,
});

/**
 * 主题配置类型（从 Schema 推断）
 */
export type ThemeConfigSchemaType = z.infer<typeof ThemeConfigSchema>;

/**
 * 验证主题配置
 * @param config - 要验证的配置对象
 * @returns 验证结果
 */
export function validateThemeConfig(config: unknown) {
  return ThemeConfigSchema.safeParse(config);
}

/**
 * 清理 CSS 值，防止注入攻击
 * @param value - CSS 值
 * @returns 清理后的值
 */
export function sanitizeCSSValue(value: string): string {
  // 只允许安全的字符：字母、数字、#、-、,、.、空格、()
  return value.replace(/[^a-zA-Z0-9#\-,.\s()]/g, '');
}
