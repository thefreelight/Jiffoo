/**
 * Theme Configuration Validation Schema
 * Use Zod to validate theme configuration security and validity
 */

import { z } from 'zod';

/**
 * Brand Config Schema
 */
const BrandConfigSchema = z.object({
  logoUrl: z.string().url().max(500).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  fontFamily: z.string().max(100).optional(),
}).optional();

/**
 * Layout Config Schema
 */
const LayoutConfigSchema = z.object({
  headerSticky: z.boolean().optional(),
  showFooterLinks: z.boolean().optional(),
  maxWidth: z.string().max(20).optional(),
}).optional();

/**
 * Features Config Schema
 */
const FeaturesConfigSchema = z.object({
  showWishlist: z.boolean().optional(),
  showRatings: z.boolean().optional(),
  enableQuickView: z.boolean().optional(),
}).optional();

/**
 * Theme Config Schema
 */
export const ThemeConfigSchema = z.object({
  brand: BrandConfigSchema,
  layout: LayoutConfigSchema,
  features: FeaturesConfigSchema,
});

/**
 * Theme Config Type (Inferred from Schema)
 */
export type ThemeConfigSchemaType = z.infer<typeof ThemeConfigSchema>;

/**
 * Validate theme config
 * @param config - Config object to validate
 * @returns Validation result
 */
export function validateThemeConfig(config: unknown) {
  return ThemeConfigSchema.safeParse(config);
}

/**
 * Sanitize CSS value to prevent injection attacks
 * @param value - CSS value
 * @returns Sanitized value
 */
export function sanitizeCSSValue(value: string): string {
  // Only allow safe characters: letters, numbers, #, -, ,, ., spaces, ()
  return value.replace(/[^a-zA-Z0-9#\-,.\s()]/g, '');
}
