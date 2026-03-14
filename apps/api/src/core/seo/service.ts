// @ts-nocheck
/**
 * SEO Service
 *
 * Manages SEO metadata for products, categories, and other content types.
 */

import { prisma } from '@/config/database';

export interface SeoMetadata {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  structuredData?: string | Record<string, unknown> | null; // JSON string or object
}

export interface ProductSeoData extends SeoMetadata {
  id: string;
  name: string;
  slug: string;
}

export interface CategorySeoData extends SeoMetadata {
  id: string;
  name: string;
  slug: string;
}

type StructuredDataInput = SeoMetadata['structuredData'];

function normalizeStructuredDataInput(value: StructuredDataInput): StructuredDataInput {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? parsed as Record<string, unknown> : value;
  } catch {
    return value;
  }
}

function serializeStructuredDataOutput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export class SeoService {
  /**
   * Get product SEO metadata
   */
  static async getProductSeo(productId: string): Promise<ProductSeoData | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
    });

    if (!product) return null;

    return {
      ...product,
      structuredData: serializeStructuredDataOutput(product.structuredData),
    };
  }

  /**
   * Update product SEO metadata
   */
  static async updateProductSeo(
    productId: string,
    data: SeoMetadata
  ): Promise<ProductSeoData> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        canonicalUrl: data.canonicalUrl,
        structuredData: normalizeStructuredDataInput(data.structuredData),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
    });

    return {
      ...updated,
      structuredData: serializeStructuredDataOutput(updated.structuredData),
    };
  }

  /**
   * Get category SEO metadata
   */
  static async getCategorySeo(categoryId: string): Promise<CategorySeoData | null> {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
    });

    if (!category) return null;

    return {
      ...category,
      structuredData: serializeStructuredDataOutput(category.structuredData),
    };
  }

  /**
   * Update category SEO metadata
   */
  static async updateCategorySeo(
    categoryId: string,
    data: SeoMetadata
  ): Promise<CategorySeoData> {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        canonicalUrl: data.canonicalUrl,
        structuredData: normalizeStructuredDataInput(data.structuredData),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
    });

    return {
      ...updated,
      structuredData: serializeStructuredDataOutput(updated.structuredData),
    };
  }

  /**
   * Batch get SEO data for multiple products
   */
  static async getProductsSeo(productIds: string[]): Promise<ProductSeoData[]> {
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
    });

    return products.map((product) => ({
      ...product,
      structuredData: serializeStructuredDataOutput(product.structuredData),
    }));
  }

  /**
   * Batch get SEO data for multiple categories
   */
  static async getCategoriesSeo(categoryIds: string[]): Promise<CategorySeoData[]> {
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
    });

    return categories.map((category) => ({
      ...category,
      structuredData: serializeStructuredDataOutput(category.structuredData),
    }));
  }

  /**
   * Generate default structured data for a product
   */
  static generateProductStructuredData(product: {
    name: string;
    description?: string | null;
    slug: string;
    salePrice?: number;
    imageUrl?: string;
  }): string {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || '',
      url: `/products/${product.slug}`,
      ...(product.imageUrl && { image: product.imageUrl }),
      ...(product.salePrice && {
        offers: {
          '@type': 'Offer',
          price: product.salePrice,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      }),
    };

    return JSON.stringify(structuredData);
  }

  /**
   * Generate default structured data for a category
   */
  static generateCategoryStructuredData(category: {
    name: string;
    description?: string | null;
    slug: string;
  }): string {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category.name,
      description: category.description || '',
      url: `/categories/${category.slug}`,
    };

    return JSON.stringify(structuredData);
  }

  /**
   * Validate structured data JSON
   */
  static validateStructuredData(input: unknown): boolean {
    if (!input) return false;
    let data: unknown = input;
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch {
        return false;
      }
    }
    return typeof data === 'object' && data !== null && '@context' in (data as Record<string, unknown>) && '@type' in (data as Record<string, unknown>);
  }
}
