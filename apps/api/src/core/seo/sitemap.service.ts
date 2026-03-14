/**
 * Sitemap Service
 *
 * Generates XML sitemaps for products, categories, and static pages.
 * Follows the Sitemaps protocol: https://www.sitemaps.org/protocol.html
 */

import { prisma } from '@/config/database';
import { env } from '@/config/env';

export interface SitemapUrl {
  loc: string; // URL of the page
  lastmod?: string; // Last modification date (ISO 8601)
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number; // 0.0 to 1.0
}

export interface SitemapOptions {
  baseUrl?: string;
  includeProducts?: boolean;
  includeCategories?: boolean;
  includePages?: boolean;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date to ISO 8601 format (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Generate XML sitemap from URLs
 */
function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map((url) => {
      const parts = [`    <url>`, `      <loc>${escapeXml(url.loc)}</loc>`];

      if (url.lastmod) {
        parts.push(`      <lastmod>${url.lastmod}</lastmod>`);
      }

      if (url.changefreq) {
        parts.push(`      <changefreq>${url.changefreq}</changefreq>`);
      }

      if (url.priority !== undefined) {
        parts.push(`      <priority>${url.priority.toFixed(1)}</priority>`);
      }

      parts.push(`    </url>`);
      return parts.join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

export class SitemapService {
  /**
   * Get all products for sitemap
   */
  static async getProductUrls(baseUrl: string): Promise<SitemapUrl[]> {
    const products = await prisma.product.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return products.map((product) => ({
      loc: `${baseUrl}/products/${product.slug}`,
      lastmod: formatDate(product.updatedAt),
      changefreq: 'weekly' as const,
      priority: 0.8,
    }));
  }

  /**
   * Get all categories for sitemap
   */
  static async getCategoryUrls(baseUrl: string): Promise<SitemapUrl[]> {
    const categories = await prisma.category.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return categories.map((category) => ({
      loc: `${baseUrl}/categories/${category.slug}`,
      lastmod: formatDate(category.updatedAt),
      changefreq: 'weekly' as const,
      priority: 0.7,
    }));
  }

  /**
   * Get static pages for sitemap
   */
  static async getPageUrls(baseUrl: string): Promise<SitemapUrl[]> {
    // Static pages that should be included in the sitemap
    const staticPages = [
      { path: '', priority: 1.0, changefreq: 'daily' as const }, // Homepage
      { path: 'products', priority: 0.9, changefreq: 'daily' as const },
      { path: 'categories', priority: 0.9, changefreq: 'daily' as const },
      { path: 'about', priority: 0.5, changefreq: 'monthly' as const },
      { path: 'contact', priority: 0.5, changefreq: 'monthly' as const },
    ];

    return staticPages.map((page) => ({
      loc: page.path ? `${baseUrl}/${page.path}` : baseUrl,
      changefreq: page.changefreq,
      priority: page.priority,
    }));
  }

  /**
   * Generate complete sitemap XML
   */
  static async generateSitemap(options: SitemapOptions = {}): Promise<string> {
    const {
      baseUrl = env.NEXT_PUBLIC_SHOP_URL,
      includeProducts = true,
      includeCategories = true,
      includePages = true,
    } = options;

    const urls: SitemapUrl[] = [];

    // Add static pages
    if (includePages) {
      const pageUrls = await this.getPageUrls(baseUrl);
      urls.push(...pageUrls);
    }

    // Add categories
    if (includeCategories) {
      const categoryUrls = await this.getCategoryUrls(baseUrl);
      urls.push(...categoryUrls);
    }

    // Add products
    if (includeProducts) {
      const productUrls = await this.getProductUrls(baseUrl);
      urls.push(...productUrls);
    }

    return generateSitemapXml(urls);
  }

  /**
   * Get sitemap statistics
   */
  static async getSitemapStats(): Promise<{
    totalUrls: number;
    productCount: number;
    categoryCount: number;
    pageCount: number;
    lastGenerated: string;
  }> {
    const [productCount, categoryCount] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
    ]);

    // Static page count (update if more pages are added)
    const pageCount = 5;

    return {
      totalUrls: productCount + categoryCount + pageCount,
      productCount,
      categoryCount,
      pageCount,
      lastGenerated: new Date().toISOString(),
    };
  }

  /**
   * Generate sitemap index for large sites (multiple sitemaps)
   * This can be used when the site grows beyond 50,000 URLs or 50MB
   */
  static async generateSitemapIndex(baseUrl: string = env.NEXT_PUBLIC_SHOP_URL): Promise<string> {
    const now = formatDate(new Date());

    const sitemaps = [
      { loc: `${baseUrl}/sitemap-pages.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemap-categories.xml`, lastmod: now },
      { loc: `${baseUrl}/sitemap-products.xml`, lastmod: now },
    ];

    const sitemapEntries = sitemaps
      .map(
        (sitemap) => `  <sitemap>
    <loc>${escapeXml(sitemap.loc)}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
  }

  /**
   * Generate individual sitemaps for large sites
   */
  static async generateProductsSitemap(baseUrl: string = env.NEXT_PUBLIC_SHOP_URL): Promise<string> {
    const productUrls = await this.getProductUrls(baseUrl);
    return generateSitemapXml(productUrls);
  }

  static async generateCategoriesSitemap(baseUrl: string = env.NEXT_PUBLIC_SHOP_URL): Promise<string> {
    const categoryUrls = await this.getCategoryUrls(baseUrl);
    return generateSitemapXml(categoryUrls);
  }

  static async generatePagesSitemap(baseUrl: string = env.NEXT_PUBLIC_SHOP_URL): Promise<string> {
    const pageUrls = await this.getPageUrls(baseUrl);
    return generateSitemapXml(pageUrls);
  }
}
