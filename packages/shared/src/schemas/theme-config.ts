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
  name: z.string().max(120).optional(),
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
 * Site Config Schema
 */
const SiteConfigSchema = z.object({
  archetype: z.enum(['storefront', 'landing-commerce', 'product-site']).optional(),
  eyebrow: z.string().max(120).optional(),
  headline: z.string().max(240).optional(),
  subheadline: z.string().max(400).optional(),
  primaryCtaLabel: z.string().max(80).optional(),
  primaryCtaHref: z.string().max(500).optional(),
  secondaryCtaLabel: z.string().max(80).optional(),
  secondaryCtaHref: z.string().max(500).optional(),
  installCommand: z.string().max(240).optional(),
  docsHref: z.string().max(500).optional(),
  demoHref: z.string().max(500).optional(),
  supportEmail: z.string().email().max(160).optional(),
}).optional();

/**
 * Theme Config Schema
 */
export const ThemeConfigSchema = z.object({
  brand: BrandConfigSchema,
  layout: LayoutConfigSchema,
  features: FeaturesConfigSchema,
  site: SiteConfigSchema,
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
