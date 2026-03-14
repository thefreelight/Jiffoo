/**
 * Block Registry
 *
 * The platform's built-in Block Registry that Theme Packs can reference.
 * Theme Packs can only "select/arrange/configure" these blocks - they cannot add new types.
 *
 * Each block is a React component that receives:
 * - settings: Block-specific configuration from the template
 * - themeConfig: The merged theme configuration
 * - blockId: Optional unique identifier for this block instance
 */

import type { BlockRegistryEntry, BlockSettings } from './types';

// Import block components
import { HeroBlock } from './blocks/hero-block';
import { ProductGridBlock } from './blocks/product-grid-block';
import { BannerBlock } from './blocks/banner-block';
import { FeaturedCategoriesBlock } from './blocks/featured-categories-block';
import { FaqBlock } from './blocks/faq-block';
import { TestimonialBlock } from './blocks/testimonial-block';

/**
 * Built-in Block Registry
 *
 * Maps block type identifiers to their implementations.
 * Theme Packs reference these types in their templates.
 */
export const BLOCK_REGISTRY: Record<string, BlockRegistryEntry> = {
  hero: {
    type: 'hero',
    name: 'Hero Banner',
    description: 'A large hero banner with headline, subtitle, and call-to-action',
    component: HeroBlock,
    defaultSettings: {
      headline: 'Welcome to Our Store',
      subtitle: 'Discover amazing products at great prices',
      ctaText: 'Shop Now',
      ctaHref: '/products',
      backgroundImage: '',
      overlayOpacity: 0.4,
      textAlign: 'center',
      height: 'large',
    },
  },

  product_grid: {
    type: 'product_grid',
    name: 'Product Grid',
    description: 'A responsive grid of product cards',
    component: ProductGridBlock,
    defaultSettings: {
      title: 'Featured Products',
      columns: 4,
      limit: 8,
      gap: 'md',
      showTitle: true,
      category: '',
      sortBy: 'newest',
    },
  },

  banner: {
    type: 'banner',
    name: 'Promotional Banner',
    description: 'A promotional banner with image and text',
    component: BannerBlock,
    defaultSettings: {
      image: '',
      title: '',
      subtitle: '',
      link: '',
      position: 'center',
    },
  },

  featured_categories: {
    type: 'featured_categories',
    name: 'Featured Categories',
    description: 'Display featured product categories',
    component: FeaturedCategoriesBlock,
    defaultSettings: {
      title: 'Shop by Category',
      limit: 6,
      columns: 3,
      showTitle: true,
    },
  },

  faq: {
    type: 'faq',
    name: 'FAQ Section',
    description: 'Frequently asked questions accordion',
    component: FaqBlock,
    defaultSettings: {
      title: 'Frequently Asked Questions',
      items: [],
      showTitle: true,
    },
  },

  testimonial: {
    type: 'testimonial',
    name: 'Testimonials',
    description: 'Customer testimonials/reviews carousel',
    component: TestimonialBlock,
    defaultSettings: {
      title: 'What Our Customers Say',
      items: [],
      showTitle: true,
      autoplay: true,
    },
  },
};

/**
 * Check if a block type is an app block (provided by a plugin).
 * App block types use the format "app_block:{pluginSlug}:{extensionId}".
 */
export function isAppBlockType(type: string): boolean {
  return type.startsWith('app_block:');
}

/**
 * Parse an app block type string into its components.
 * Format: "app_block:{pluginSlug}:{extensionId}"
 */
export function parseAppBlockType(type: string): { pluginSlug: string; extensionId: string } | null {
  if (!isAppBlockType(type)) return null;
  const parts = type.split(':');
  if (parts.length < 3) return null;
  return {
    pluginSlug: parts[1],
    extensionId: parts.slice(2).join(':'),
  };
}

/**
 * Get a block component by type
 */
export function getBlockComponent(type: string): BlockRegistryEntry | null {
  return BLOCK_REGISTRY[type] || null;
}

/**
 * Check if a block type is registered
 */
export function isBlockTypeRegistered(type: string): boolean {
  return type in BLOCK_REGISTRY;
}

/**
 * Get all registered block types
 */
export function getRegisteredBlockTypes(): string[] {
  return Object.keys(BLOCK_REGISTRY);
}

/**
 * Get all registered blocks
 */
export function getAllBlocks(): BlockRegistryEntry[] {
  return Object.values(BLOCK_REGISTRY);
}

/**
 * Merge block settings with defaults
 */
export function mergeBlockSettings(
  type: string,
  settings: BlockSettings = {}
): BlockSettings {
  const entry = BLOCK_REGISTRY[type];
  if (!entry) {
    return settings;
  }
  return { ...entry.defaultSettings, ...settings };
}
