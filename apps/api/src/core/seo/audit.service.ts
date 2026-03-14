/**
 * SEO Audit Service
 *
 * Detects SEO issues like missing meta tags, broken canonicals, invalid structured data, etc.
 */

import { prisma } from '@/config/database';
import { SeoService } from './service';

export type SeoIssueSeverity = 'critical' | 'warning' | 'info';

export interface SeoIssue {
  id: string;
  type: string;
  severity: SeoIssueSeverity;
  message: string;
  entity: {
    type: 'product' | 'category';
    id: string;
    name: string;
    slug: string;
  };
  recommendation?: string;
}

export interface AuditSummary {
  totalIssues: number;
  critical: number;
  warnings: number;
  info: number;
  issuesByType: Record<string, number>;
}

export interface AuditResult {
  summary: AuditSummary;
  issues: SeoIssue[];
  timestamp: Date;
}

export interface AuditOptions {
  includeProducts?: boolean;
  includeCategories?: boolean;
  limit?: number;
  offset?: number;
}

export class SeoAuditService {
  /**
   * Run full SEO audit
   */
  static async runAudit(options: AuditOptions = {}): Promise<AuditResult> {
    const {
      includeProducts = true,
      includeCategories = true,
      limit = 100,
      offset = 0,
    } = options;

    const issues: SeoIssue[] = [];

    if (includeProducts) {
      const productIssues = await this.auditProducts(limit, offset);
      issues.push(...productIssues);
    }

    if (includeCategories) {
      const categoryIssues = await this.auditCategories(limit, offset);
      issues.push(...categoryIssues);
    }

    const summary = this.calculateSummary(issues);

    return {
      summary,
      issues,
      timestamp: new Date(),
    };
  }

  /**
   * Audit products for SEO issues
   */
  static async auditProducts(limit = 100, offset = 0): Promise<SeoIssue[]> {
    const products = await prisma.product.findMany({
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const issues: SeoIssue[] = [];

    for (const product of products) {
      // Check missing meta title
      if (!product.metaTitle || product.metaTitle.trim() === '') {
        issues.push({
          id: `product-${product.id}-no-meta-title`,
          type: 'missing-meta-title',
          severity: 'critical',
          message: 'Missing meta title',
          entity: {
            type: 'product',
            id: product.id,
            name: product.name,
            slug: product.slug,
          },
          recommendation: 'Add a unique, descriptive meta title (50-60 characters)',
        });
      }

      // Check meta title length
      if (product.metaTitle && product.metaTitle.length > 60) {
        issues.push({
          id: `product-${product.id}-long-meta-title`,
          type: 'long-meta-title',
          severity: 'warning',
          message: `Meta title too long (${product.metaTitle.length} characters)`,
          entity: {
            type: 'product',
            id: product.id,
            name: product.name,
            slug: product.slug,
          },
          recommendation: 'Keep meta titles between 50-60 characters for optimal display',
        });
      }

      // Check missing meta description
      if (!product.metaDescription || product.metaDescription.trim() === '') {
        issues.push({
          id: `product-${product.id}-no-meta-description`,
          type: 'missing-meta-description',
          severity: 'critical',
          message: 'Missing meta description',
          entity: {
            type: 'product',
            id: product.id,
            name: product.name,
            slug: product.slug,
          },
          recommendation: 'Add a compelling meta description (150-160 characters)',
        });
      }

      // Check meta description length
      if (product.metaDescription && product.metaDescription.length > 160) {
        issues.push({
          id: `product-${product.id}-long-meta-description`,
          type: 'long-meta-description',
          severity: 'warning',
          message: `Meta description too long (${product.metaDescription.length} characters)`,
          entity: {
            type: 'product',
            id: product.id,
            name: product.name,
            slug: product.slug,
          },
          recommendation: 'Keep meta descriptions between 150-160 characters',
        });
      }

      // Check canonical URL
      if (product.canonicalUrl) {
        const canonicalIssue = this.validateCanonicalUrl(
          product.canonicalUrl,
          product.slug
        );
        if (canonicalIssue) {
          issues.push({
            id: `product-${product.id}-invalid-canonical`,
            type: 'invalid-canonical-url',
            severity: 'warning',
            message: canonicalIssue,
            entity: {
              type: 'product',
              id: product.id,
              name: product.name,
              slug: product.slug,
            },
            recommendation: 'Ensure canonical URL is valid and points to the correct page',
          });
        }
      }

      // Check structured data
      if (!product.structuredData) {
        issues.push({
          id: `product-${product.id}-no-structured-data`,
          type: 'missing-structured-data',
          severity: 'info',
          message: 'Missing structured data (JSON-LD)',
          entity: {
            type: 'product',
            id: product.id,
            name: product.name,
            slug: product.slug,
          },
          recommendation: 'Add Product schema structured data for better search visibility',
        });
      } else {
        const isValid = SeoService.validateStructuredData(product.structuredData);
        if (!isValid) {
          issues.push({
            id: `product-${product.id}-invalid-structured-data`,
            type: 'invalid-structured-data',
            severity: 'warning',
            message: 'Invalid structured data JSON',
            entity: {
              type: 'product',
              id: product.id,
              name: product.name,
              slug: product.slug,
            },
            recommendation: 'Fix JSON-LD structured data format',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Audit categories for SEO issues
   */
  static async auditCategories(limit = 100, offset = 0): Promise<SeoIssue[]> {
    const categories = await prisma.category.findMany({
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        structuredData: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const issues: SeoIssue[] = [];

    for (const category of categories) {
      // Check missing meta title
      if (!category.metaTitle || category.metaTitle.trim() === '') {
        issues.push({
          id: `category-${category.id}-no-meta-title`,
          type: 'missing-meta-title',
          severity: 'critical',
          message: 'Missing meta title',
          entity: {
            type: 'category',
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
          recommendation: 'Add a unique, descriptive meta title (50-60 characters)',
        });
      }

      // Check meta title length
      if (category.metaTitle && category.metaTitle.length > 60) {
        issues.push({
          id: `category-${category.id}-long-meta-title`,
          type: 'long-meta-title',
          severity: 'warning',
          message: `Meta title too long (${category.metaTitle.length} characters)`,
          entity: {
            type: 'category',
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
          recommendation: 'Keep meta titles between 50-60 characters for optimal display',
        });
      }

      // Check missing meta description
      if (!category.metaDescription || category.metaDescription.trim() === '') {
        issues.push({
          id: `category-${category.id}-no-meta-description`,
          type: 'missing-meta-description',
          severity: 'critical',
          message: 'Missing meta description',
          entity: {
            type: 'category',
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
          recommendation: 'Add a compelling meta description (150-160 characters)',
        });
      }

      // Check meta description length
      if (category.metaDescription && category.metaDescription.length > 160) {
        issues.push({
          id: `category-${category.id}-long-meta-description`,
          type: 'long-meta-description',
          severity: 'warning',
          message: `Meta description too long (${category.metaDescription.length} characters)`,
          entity: {
            type: 'category',
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
          recommendation: 'Keep meta descriptions between 150-160 characters',
        });
      }

      // Check canonical URL
      if (category.canonicalUrl) {
        const canonicalIssue = this.validateCanonicalUrl(
          category.canonicalUrl,
          category.slug
        );
        if (canonicalIssue) {
          issues.push({
            id: `category-${category.id}-invalid-canonical`,
            type: 'invalid-canonical-url',
            severity: 'warning',
            message: canonicalIssue,
            entity: {
              type: 'category',
              id: category.id,
              name: category.name,
              slug: category.slug,
            },
            recommendation: 'Ensure canonical URL is valid and points to the correct page',
          });
        }
      }

      // Check structured data
      if (!category.structuredData) {
        issues.push({
          id: `category-${category.id}-no-structured-data`,
          type: 'missing-structured-data',
          severity: 'info',
          message: 'Missing structured data (JSON-LD)',
          entity: {
            type: 'category',
            id: category.id,
            name: category.name,
            slug: category.slug,
          },
          recommendation: 'Add CollectionPage schema structured data for better search visibility',
        });
      } else {
        const isValid = SeoService.validateStructuredData(category.structuredData);
        if (!isValid) {
          issues.push({
            id: `category-${category.id}-invalid-structured-data`,
            type: 'invalid-structured-data',
            severity: 'warning',
            message: 'Invalid structured data JSON',
            entity: {
              type: 'category',
              id: category.id,
              name: category.name,
              slug: category.slug,
            },
            recommendation: 'Fix JSON-LD structured data format',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for duplicate meta descriptions
   */
  static async findDuplicateMetaDescriptions(): Promise<Array<{
    metaDescription: string;
    entities: Array<{ type: 'product' | 'category'; id: string; name: string }>;
  }>> {
    // Get all products with meta descriptions
    const products = await prisma.product.findMany({
      where: {
        metaDescription: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        metaDescription: true,
      },
    });

    // Get all categories with meta descriptions
    const categories = await prisma.category.findMany({
      where: {
        metaDescription: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        metaDescription: true,
      },
    });

    // Group by meta description
    const descriptionMap = new Map<
      string,
      Array<{ type: 'product' | 'category'; id: string; name: string }>
    >();

    products.forEach((product) => {
      if (product.metaDescription) {
        const desc = product.metaDescription.toLowerCase().trim();
        if (!descriptionMap.has(desc)) {
          descriptionMap.set(desc, []);
        }
        descriptionMap.get(desc)!.push({
          type: 'product',
          id: product.id,
          name: product.name,
        });
      }
    });

    categories.forEach((category) => {
      if (category.metaDescription) {
        const desc = category.metaDescription.toLowerCase().trim();
        if (!descriptionMap.has(desc)) {
          descriptionMap.set(desc, []);
        }
        descriptionMap.get(desc)!.push({
          type: 'category',
          id: category.id,
          name: category.name,
        });
      }
    });

    // Filter duplicates (more than 1 entity with same description)
    const duplicates: Array<{
      metaDescription: string;
      entities: Array<{ type: 'product' | 'category'; id: string; name: string }>;
    }> = [];

    descriptionMap.forEach((entities, metaDescription) => {
      if (entities.length > 1) {
        duplicates.push({
          metaDescription,
          entities,
        });
      }
    });

    return duplicates;
  }

  /**
   * Check for duplicate meta titles
   */
  static async findDuplicateMetaTitles(): Promise<Array<{
    metaTitle: string;
    entities: Array<{ type: 'product' | 'category'; id: string; name: string }>;
  }>> {
    // Get all products with meta titles
    const products = await prisma.product.findMany({
      where: {
        metaTitle: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        metaTitle: true,
      },
    });

    // Get all categories with meta titles
    const categories = await prisma.category.findMany({
      where: {
        metaTitle: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        metaTitle: true,
      },
    });

    // Group by meta title
    const titleMap = new Map<
      string,
      Array<{ type: 'product' | 'category'; id: string; name: string }>
    >();

    products.forEach((product) => {
      if (product.metaTitle) {
        const title = product.metaTitle.toLowerCase().trim();
        if (!titleMap.has(title)) {
          titleMap.set(title, []);
        }
        titleMap.get(title)!.push({
          type: 'product',
          id: product.id,
          name: product.name,
        });
      }
    });

    categories.forEach((category) => {
      if (category.metaTitle) {
        const title = category.metaTitle.toLowerCase().trim();
        if (!titleMap.has(title)) {
          titleMap.set(title, []);
        }
        titleMap.get(title)!.push({
          type: 'category',
          id: category.id,
          name: category.name,
        });
      }
    });

    // Filter duplicates (more than 1 entity with same title)
    const duplicates: Array<{
      metaTitle: string;
      entities: Array<{ type: 'product' | 'category'; id: string; name: string }>;
    }> = [];

    titleMap.forEach((entities, metaTitle) => {
      if (entities.length > 1) {
        duplicates.push({
          metaTitle,
          entities,
        });
      }
    });

    return duplicates;
  }

  /**
   * Get audit summary statistics
   */
  static async getAuditStats(): Promise<{
    products: {
      total: number;
      missingMetaTitle: number;
      missingMetaDescription: number;
      missingCanonicalUrl: number;
      missingStructuredData: number;
    };
    categories: {
      total: number;
      missingMetaTitle: number;
      missingMetaDescription: number;
      missingCanonicalUrl: number;
      missingStructuredData: number;
    };
  }> {
    const isStructuredDataMissing = (value: unknown): boolean => {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
      return false;
    };

    const [
      totalProducts,
      productsMissingMetaTitle,
      productsMissingMetaDescription,
      productsMissingCanonicalUrl,
      productStructuredDataRows,
      totalCategories,
      categoriesMissingMetaTitle,
      categoriesMissingMetaDescription,
      categoriesMissingCanonicalUrl,
      categoryStructuredDataRows,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { OR: [{ metaTitle: null }, { metaTitle: '' }] } }),
      prisma.product.count({
        where: { OR: [{ metaDescription: null }, { metaDescription: '' }] },
      }),
      prisma.product.count({ where: { OR: [{ canonicalUrl: null }, { canonicalUrl: '' }] } }),
      prisma.product.findMany({
        select: { structuredData: true },
      }),
      prisma.category.count(),
      prisma.category.count({ where: { OR: [{ metaTitle: null }, { metaTitle: '' }] } }),
      prisma.category.count({
        where: { OR: [{ metaDescription: null }, { metaDescription: '' }] },
      }),
      prisma.category.count({
        where: { OR: [{ canonicalUrl: null }, { canonicalUrl: '' }] },
      }),
      prisma.category.findMany({
        select: { structuredData: true },
      }),
    ]);

    const productsMissingStructuredData = productStructuredDataRows.filter((row) =>
      isStructuredDataMissing(row.structuredData)
    ).length;
    const categoriesMissingStructuredData = categoryStructuredDataRows.filter((row) =>
      isStructuredDataMissing(row.structuredData)
    ).length;

    return {
      products: {
        total: totalProducts,
        missingMetaTitle: productsMissingMetaTitle,
        missingMetaDescription: productsMissingMetaDescription,
        missingCanonicalUrl: productsMissingCanonicalUrl,
        missingStructuredData: productsMissingStructuredData,
      },
      categories: {
        total: totalCategories,
        missingMetaTitle: categoriesMissingMetaTitle,
        missingMetaDescription: categoriesMissingMetaDescription,
        missingCanonicalUrl: categoriesMissingCanonicalUrl,
        missingStructuredData: categoriesMissingStructuredData,
      },
    };
  }

  /**
   * Validate canonical URL format
   */
  private static validateCanonicalUrl(url: string, expectedSlug: string): string | null {
    // Check if empty
    if (!url || url.trim() === '') {
      return 'Canonical URL is empty';
    }

    // Check if it's a valid URL format
    try {
      // If it's a relative URL, validate format
      if (url.startsWith('/')) {
        if (!url.includes(expectedSlug)) {
          return 'Canonical URL does not contain the expected slug';
        }
        return null;
      }

      // If it's an absolute URL, validate it
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('http')) {
        return 'Canonical URL must use HTTP or HTTPS protocol';
      }
      return null;
    } catch {
      return 'Invalid canonical URL format';
    }
  }

  /**
   * Calculate audit summary from issues
   */
  private static calculateSummary(issues: SeoIssue[]): AuditSummary {
    const summary: AuditSummary = {
      totalIssues: issues.length,
      critical: 0,
      warnings: 0,
      info: 0,
      issuesByType: {},
    };

    issues.forEach((issue) => {
      // Count by severity
      if (issue.severity === 'critical') {
        summary.critical++;
      } else if (issue.severity === 'warning') {
        summary.warnings++;
      } else {
        summary.info++;
      }

      // Count by type
      if (!summary.issuesByType[issue.type]) {
        summary.issuesByType[issue.type] = 0;
      }
      summary.issuesByType[issue.type]++;
    });

    return summary;
  }
}
