/**
 * Redirect Service
 *
 * Manages 301/302 redirects for SEO and URL migration.
 */

import { prisma } from '@/config/database';

export interface RedirectData {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  isActive?: boolean;
}

export interface RedirectInfo {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RedirectListResult {
  items: RedirectInfo[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class RedirectService {
  /**
   * Find redirect by source path
   */
  static async findByPath(fromPath: string): Promise<RedirectInfo | null> {
    const redirect = await prisma.seoRedirect.findUnique({
      where: { fromPath },
    });

    return redirect;
  }

  /**
   * Find active redirect by source path
   */
  static async findActiveRedirect(fromPath: string): Promise<RedirectInfo | null> {
    const redirect = await prisma.seoRedirect.findFirst({
      where: {
        fromPath,
        isActive: true,
      },
    });

    return redirect;
  }

  /**
   * Get redirect by ID
   */
  static async getById(id: string): Promise<RedirectInfo | null> {
    const redirect = await prisma.seoRedirect.findUnique({
      where: { id },
    });

    return redirect;
  }

  /**
   * Create a new redirect
   */
  static async createRedirect(data: RedirectData): Promise<RedirectInfo> {
    // Check if redirect with fromPath already exists
    const existing = await prisma.seoRedirect.findUnique({
      where: { fromPath: data.fromPath },
    });

    if (existing) {
      throw new Error(`Redirect from path "${data.fromPath}" already exists`);
    }

    // Validate paths
    if (!data.fromPath.startsWith('/')) {
      throw new Error('fromPath must start with /');
    }

    if (!data.toPath.startsWith('/') && !data.toPath.startsWith('http')) {
      throw new Error('toPath must start with / or be an absolute URL');
    }

    // Validate status code
    const statusCode = data.statusCode || 301;
    if (![301, 302, 307, 308].includes(statusCode)) {
      throw new Error('statusCode must be 301, 302, 307, or 308');
    }

    const redirect = await prisma.seoRedirect.create({
      data: {
        fromPath: data.fromPath,
        toPath: data.toPath,
        statusCode,
        isActive: data.isActive ?? true,
      },
    });

    return redirect;
  }

  /**
   * Update existing redirect
   */
  static async updateRedirect(
    id: string,
    data: Partial<RedirectData>
  ): Promise<RedirectInfo> {
    const existing = await prisma.seoRedirect.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Redirect not found');
    }

    // If updating fromPath, check for conflicts
    if (data.fromPath && data.fromPath !== existing.fromPath) {
      const conflict = await prisma.seoRedirect.findUnique({
        where: { fromPath: data.fromPath },
      });

      if (conflict) {
        throw new Error(`Redirect from path "${data.fromPath}" already exists`);
      }

      if (!data.fromPath.startsWith('/')) {
        throw new Error('fromPath must start with /');
      }
    }

    // Validate toPath if provided
    if (data.toPath) {
      if (!data.toPath.startsWith('/') && !data.toPath.startsWith('http')) {
        throw new Error('toPath must start with / or be an absolute URL');
      }
    }

    // Validate status code if provided
    if (data.statusCode && ![301, 302, 307, 308].includes(data.statusCode)) {
      throw new Error('statusCode must be 301, 302, 307, or 308');
    }

    const updated = await prisma.seoRedirect.update({
      where: { id },
      data: {
        ...(data.fromPath !== undefined && { fromPath: data.fromPath }),
        ...(data.toPath !== undefined && { toPath: data.toPath }),
        ...(data.statusCode !== undefined && { statusCode: data.statusCode }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return updated;
  }

  /**
   * Delete redirect
   */
  static async deleteRedirect(id: string): Promise<void> {
    const existing = await prisma.seoRedirect.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Redirect not found');
    }

    await prisma.seoRedirect.delete({
      where: { id },
    });
  }

  /**
   * List redirects with pagination
   */
  static async listRedirects(
    page = 1,
    limit = 10,
    filters: { isActive?: boolean; search?: string } = {}
  ): Promise<RedirectListResult> {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { fromPath: { contains: filters.search, mode: 'insensitive' } },
        { toPath: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [redirects, total] = await Promise.all([
      prisma.seoRedirect.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.seoRedirect.count({ where }),
    ]);

    return {
      items: redirects,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Increment hit count for a redirect
   */
  static async incrementHitCount(id: string): Promise<void> {
    await prisma.seoRedirect.update({
      where: { id },
      data: {
        hitCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Bulk activate/deactivate redirects
   */
  static async bulkUpdateStatus(
    ids: string[],
    isActive: boolean
  ): Promise<number> {
    const result = await prisma.seoRedirect.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        isActive,
      },
    });

    return result.count;
  }

  /**
   * Delete multiple redirects
   */
  static async bulkDelete(ids: string[]): Promise<number> {
    const result = await prisma.seoRedirect.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return result.count;
  }

  /**
   * Check for redirect chains and circular redirects
   */
  static async checkRedirectChain(fromPath: string): Promise<{
    hasChain: boolean;
    hasCircular: boolean;
    chain: string[];
  }> {
    const visited = new Set<string>();
    const chain: string[] = [fromPath];
    let currentPath = fromPath;
    let hasCircular = false;

    // Follow redirect chain up to 10 hops
    for (let i = 0; i < 10; i++) {
      const redirect = await this.findActiveRedirect(currentPath);

      if (!redirect) {
        break;
      }

      if (visited.has(redirect.toPath)) {
        hasCircular = true;
        break;
      }

      visited.add(currentPath);
      chain.push(redirect.toPath);
      currentPath = redirect.toPath;
    }

    return {
      hasChain: chain.length > 2,
      hasCircular,
      chain,
    };
  }

  /**
   * Get redirect statistics
   */
  static async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalHits: number;
    mostUsed: Array<{ fromPath: string; toPath: string; hitCount: number }>;
  }> {
    const [total, active, inactive, allRedirects] = await Promise.all([
      prisma.seoRedirect.count(),
      prisma.seoRedirect.count({ where: { isActive: true } }),
      prisma.seoRedirect.count({ where: { isActive: false } }),
      prisma.seoRedirect.findMany({
        select: {
          fromPath: true,
          toPath: true,
          hitCount: true,
        },
        orderBy: {
          hitCount: 'desc',
        },
        take: 10,
      }),
    ]);

    const totalHits = allRedirects.reduce((sum, r) => sum + r.hitCount, 0);

    return {
      total,
      active,
      inactive,
      totalHits,
      mostUsed: allRedirects,
    };
  }
}
