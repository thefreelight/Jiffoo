/**
 * Discount Service
 *
 * Handles CRUD operations for discount codes and promotions.
 */

import { prisma } from '@/config/database';
import {
  CreateDiscountRequest,
  UpdateDiscountRequest,
  ValidateDiscountRequest,
  DiscountResponse,
  DiscountListResponse,
  DiscountValidationResult,
} from './types';

interface DiscountFilters {
  search?: string;
  type?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Format discount for response
 */
function formatDiscountResponse(discount: any): DiscountResponse {
  return {
    id: discount.id,
    code: discount.code,
    type: discount.type,
    value: Number(discount.value),
    minAmount: discount.minAmount ? Number(discount.minAmount) : null,
    maxUses: discount.maxUses,
    usedCount: discount.usedCount,
    startDate: discount.startDate ? discount.startDate.toISOString() : null,
    endDate: discount.endDate ? discount.endDate.toISOString() : null,
    isActive: discount.isActive,
    stackable: discount.stackable,
    description: discount.description,
    createdAt: discount.createdAt.toISOString(),
    updatedAt: discount.updatedAt.toISOString(),
    products: discount.products?.map((p: any) => ({
      id: p.id,
      productId: p.productId,
      productName: p.product?.name,
    })),
    customerGroups: discount.customerGroups?.map((cg: any) => ({
      id: cg.id,
      customerGroup: cg.customerGroup,
    })),
  };
}

export class DiscountService {
  /**
   * Create a new discount
   */
  static async createDiscount(data: CreateDiscountRequest): Promise<DiscountResponse> {
    const normalizedCode = data.code.trim().toUpperCase();
    const discount = await prisma.$transaction(async (tx) => {
      const existing = await tx.discount.findUnique({
        where: { code: normalizedCode },
        select: { id: true },
      });

      if (existing) {
        await tx.discountProduct.deleteMany({ where: { discountId: existing.id } });
        await tx.discountCustomerGroup.deleteMany({ where: { discountId: existing.id } });

        return tx.discount.update({
          where: { id: existing.id },
          data: {
            code: normalizedCode,
            type: data.type,
            value: data.value,
            minAmount: data.minAmount,
            maxUses: data.maxUses,
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.endDate ? new Date(data.endDate) : null,
            isActive: data.isActive ?? true,
            stackable: data.stackable ?? false,
            description: data.description,
            products: data.productIds
              ? {
                  create: data.productIds.map((productId) => ({
                    productId,
                  })),
                }
              : undefined,
            customerGroups: data.customerGroups
              ? {
                  create: data.customerGroups.map((group) => ({
                    customerGroup: group,
                  })),
                }
              : undefined,
          },
          include: {
            products: {
              include: {
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            customerGroups: true,
          },
        });
      }

      return tx.discount.create({
        data: {
          code: normalizedCode,
          type: data.type,
          value: data.value,
          minAmount: data.minAmount,
          maxUses: data.maxUses,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          isActive: data.isActive ?? true,
          stackable: data.stackable ?? false,
          description: data.description,
          products: data.productIds
            ? {
                create: data.productIds.map((productId) => ({
                  productId,
                })),
              }
            : undefined,
          customerGroups: data.customerGroups
            ? {
                create: data.customerGroups.map((group) => ({
                  customerGroup: group,
                })),
              }
            : undefined,
        },
        include: {
          products: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
          customerGroups: true,
        },
      });
    });

    return formatDiscountResponse(discount);
  }

  /**
   * Get paginated list of discounts
   */
  static async getDiscounts(
    page = 1,
    limit = 10,
    filters: DiscountFilters = {}
  ): Promise<DiscountListResponse> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy && ['code', 'type', 'value', 'usedCount', 'createdAt', 'updatedAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'asc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Query discounts
    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          products: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
          customerGroups: true,
        },
      }),
      prisma.discount.count({ where }),
    ]);

    return {
      items: discounts.map(formatDiscountResponse),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single discount by ID
   */
  static async getDiscountById(discountId: string): Promise<DiscountResponse | null> {
    const discount = await prisma.discount.findUnique({
      where: { id: discountId },
      include: {
        products: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        customerGroups: true,
      },
    });

    if (!discount) {
      return null;
    }

    return formatDiscountResponse(discount);
  }

  /**
   * Get discount by code
   */
  static async getDiscountByCode(code: string): Promise<DiscountResponse | null> {
    const discount = await prisma.discount.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        products: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        customerGroups: true,
      },
    });

    if (!discount) {
      return null;
    }

    return formatDiscountResponse(discount);
  }

  /**
   * Update discount
   */
  static async updateDiscount(
    discountId: string,
    data: UpdateDiscountRequest
  ): Promise<DiscountResponse | null> {
    // Check if discount exists
    const existing = await prisma.discount.findUnique({
      where: { id: discountId },
    });

    if (!existing) {
      return null;
    }

    // Handle products update
    if (data.productIds !== undefined) {
      // Delete existing product associations
      await prisma.discountProduct.deleteMany({
        where: { discountId },
      });
    }

    // Handle customer groups update
    if (data.customerGroups !== undefined) {
      // Delete existing customer group associations
      await prisma.discountCustomerGroup.deleteMany({
        where: { discountId },
      });
    }

    // Update discount
    const discount = await prisma.discount.update({
      where: { id: discountId },
      data: {
        code: data.code?.trim().toUpperCase(),
        type: data.type,
        value: data.value,
        minAmount: data.minAmount,
        maxUses: data.maxUses,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
        endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
        isActive: data.isActive,
        stackable: data.stackable,
        description: data.description,
        products: data.productIds
          ? {
              create: data.productIds.map((productId) => ({
                productId,
              })),
            }
          : undefined,
        customerGroups: data.customerGroups
          ? {
              create: data.customerGroups.map((group) => ({
                customerGroup: group,
              })),
            }
          : undefined,
      },
      include: {
        products: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
        customerGroups: true,
      },
    });

    return formatDiscountResponse(discount);
  }

  /**
   * Delete discount
   */
  static async deleteDiscount(discountId: string): Promise<boolean> {
    try {
      await prisma.discount.delete({
        where: { id: discountId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate discount code
   */
  static async validateDiscount(
    data: ValidateDiscountRequest
  ): Promise<DiscountValidationResult> {
    const errors: string[] = [];

    // Find discount by code
    const discount = await prisma.discount.findUnique({
      where: { code: data.code.toUpperCase() },
      include: {
        products: true,
        customerGroups: true,
      },
    });

    // Check if discount exists
    if (!discount) {
      errors.push('Discount code not found');
      return { isValid: false, errors };
    }

    // Check if discount is active
    if (!discount.isActive) {
      errors.push('Discount code is not active');
    }

    // Check time constraints
    const now = new Date();
    if (discount.startDate && now < discount.startDate) {
      errors.push('Discount code is not yet valid');
    }
    if (discount.endDate && now > discount.endDate) {
      errors.push('Discount code has expired');
    }

    // Check usage limits
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      errors.push('Discount code has reached maximum usage limit');
    }

    // Check minimum amount requirement
    if (discount.minAmount && data.cartTotal) {
      if (data.cartTotal < Number(discount.minAmount)) {
        errors.push(`Minimum purchase amount of $${discount.minAmount} required`);
      }
    }

    // Check product restrictions
    if (discount.products.length > 0 && data.productIds) {
      const discountProductIds = discount.products.map((p) => p.productId);
      const hasMatchingProduct = data.productIds.some((pid) =>
        discountProductIds.includes(pid)
      );
      if (!hasMatchingProduct) {
        errors.push('Discount code is not applicable to products in your cart');
      }
    }

    // Check customer group restrictions
    if (discount.customerGroups.length > 0 && data.userId) {
      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { role: true },
      });

      if (user) {
        const allowedGroups = discount.customerGroups.map((cg) => cg.customerGroup);
        if (!allowedGroups.includes(user.role)) {
          errors.push('Discount code is not available for your customer group');
        }
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      discount: formatDiscountResponse(discount),
    };
  }

  /**
   * Get discount analytics
   */
  static async getAnalytics() {
    // Get basic metrics
    const [totalDiscounts, activeDiscounts, totalUsage, topDiscounts] = await Promise.all([
      // Total discounts count
      prisma.discount.count(),

      // Active discounts count
      prisma.discount.count({
        where: {
          isActive: true,
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } },
          ],
        },
      }),

      // Total usage statistics
      prisma.discountUsage.aggregate({
        _sum: {
          discountAmount: true,
        },
        _count: true,
      }),

      // Top 5 performing discounts
      prisma.discount.findMany({
        take: 5,
        orderBy: {
          usedCount: 'desc',
        },
        select: {
          id: true,
          code: true,
          type: true,
          value: true,
          usedCount: true,
          _count: {
            select: {
              usages: true,
            },
          },
        },
      }),
    ]);

    // Get total discount amount per discount
    const discountAmounts = await prisma.discountUsage.groupBy({
      by: ['discountId'],
      _sum: {
        discountAmount: true,
      },
      orderBy: {
        _sum: {
          discountAmount: 'desc',
        },
      },
      take: 5,
    });

    // Get recent usage activity
    const recentUsage = await prisma.discountUsage.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        discount: {
          select: {
            code: true,
            type: true,
          },
        },
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });

    const totalUsageCount = Number(
      (totalUsage as any)?._count?._all ??
      (totalUsage as any)?._count ??
      0
    );

    return {
      metrics: {
        totalDiscounts,
        activeDiscounts,
        totalUsageCount,
        totalDiscountAmount: Number(totalUsage._sum.discountAmount) || 0,
      },
      topPerformingDiscounts: topDiscounts.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: Number(d.value),
        usedCount: d.usedCount,
        totalUsages: d._count.usages,
      })),
      topDiscounts: topDiscounts.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: Number(d.value),
        usedCount: d.usedCount,
        totalUsages: d._count.usages,
      })),
      topDiscountsByRevenue: discountAmounts.map((d) => ({
        discountId: d.discountId,
        totalDiscountAmount: Number(d._sum.discountAmount) || 0,
      })),
      recentUsage: recentUsage.map((u) => ({
        id: u.id,
        userId: u.userId,
        discountCode: u.discount.code,
        discountType: u.discount.type,
        discountAmount: Number(u.discountAmount),
        userEmail: u.user.email,
        username: u.user.username,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }
}
