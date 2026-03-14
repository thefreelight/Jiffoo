// @ts-nocheck
/**
 * Customer Group Service (B2B)
 *
 * Handles CRUD operations for customer groups used in tiered pricing.
 */

import { prisma } from '@/config/database';
import { CreateCustomerGroupRequest, UpdateCustomerGroupRequest, UpdateCustomerGroupStatusRequest } from './types';

export class CustomerGroupService {
  /**
   * Get all customer groups with pagination and search
   */
  static async getAllCustomerGroups(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const [customerGroups, total] = await Promise.all([
      prisma.customerGroup.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          discount: true,
          priority: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              companies: true,
              priceRules: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' }, // Higher priority first
          { createdAt: 'desc' },
        ],
      }),
      prisma.customerGroup.count({ where: whereCondition }),
    ]);

    return {
      customerGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get customer group by ID
   */
  static async getCustomerGroupById(id: string) {
    return prisma.customerGroup.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        discount: true,
        priority: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            companies: true,
            priceRules: true,
          },
        },
      },
    });
  }

  /**
   * Get customer group by name
   */
  static async getCustomerGroupByName(name: string) {
    return prisma.customerGroup.findFirst({
      where: { name },
    });
  }

  /**
   * Create new customer group
   */
  static async createCustomerGroup(data: CreateCustomerGroupRequest) {
    // Check if customer group with name already exists
    const existingGroup = await prisma.customerGroup.findFirst({
      where: { name: data.name },
    });

    if (existingGroup) {
      throw new Error('Customer group with this name already exists');
    }

    return prisma.customerGroup.create({
      data: {
        name: data.name,
        description: data.description,
        discount: data.discount ?? 0,
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        discount: true,
        priority: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            companies: true,
            priceRules: true,
          },
        },
      },
    });
  }

  /**
   * Update customer group
   */
  static async updateCustomerGroup(id: string, data: UpdateCustomerGroupRequest) {
    // Check if customer group exists
    const customerGroup = await prisma.customerGroup.findUnique({
      where: { id },
    });

    if (!customerGroup) {
      throw new Error('Customer group not found');
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name !== customerGroup.name) {
      const existingGroup = await prisma.customerGroup.findFirst({
        where: { name: data.name },
      });

      if (existingGroup) {
        throw new Error('Customer group with this name already exists');
      }
    }

    return prisma.customerGroup.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        discount: data.discount,
        priority: data.priority,
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        description: true,
        discount: true,
        priority: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            companies: true,
            priceRules: true,
          },
        },
      },
    });
  }

  /**
   * Update customer group status (Admin)
   */
  static async updateCustomerGroupStatus(id: string, data: UpdateCustomerGroupStatusRequest) {
    const customerGroup = await prisma.customerGroup.findUnique({
      where: { id },
    });

    if (!customerGroup) {
      throw new Error('Customer group not found');
    }

    return prisma.customerGroup.update({
      where: { id },
      data: { isActive: data.isActive },
      select: {
        id: true,
        name: true,
        description: true,
        discount: true,
        priority: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            companies: true,
            priceRules: true,
          },
        },
      },
    });
  }

  /**
   * Delete customer group (Admin)
   */
  static async deleteCustomerGroup(id: string) {
    const customerGroup = await prisma.customerGroup.findUnique({
      where: { id },
    });

    if (!customerGroup) {
      throw new Error('Customer group not found');
    }

    // Check if there are companies using this customer group
    const companiesCount = await prisma.company.count({
      where: { customerGroupId: id },
    });

    if (companiesCount > 0) {
      throw new Error('Cannot delete customer group with associated companies. Please reassign companies first.');
    }

    await prisma.customerGroup.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Get active customer groups
   */
  static async getActiveCustomerGroups(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [customerGroups, total] = await Promise.all([
      prisma.customerGroup.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          discount: true,
          priority: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              companies: true,
              priceRules: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { name: 'asc' },
        ],
      }),
      prisma.customerGroup.count({ where: { isActive: true } }),
    ]);

    return {
      customerGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get customer groups ordered by priority
   */
  static async getCustomerGroupsByPriority(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [customerGroups, total] = await Promise.all([
      prisma.customerGroup.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          discount: true,
          priority: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              companies: true,
              priceRules: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' }, // Higher priority first
          { name: 'asc' },
        ],
      }),
      prisma.customerGroup.count({ where: { isActive: true } }),
    ]);

    return {
      customerGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get companies in a customer group
   */
  static async getCustomerGroupCompanies(customerGroupId: string, page = 1, limit = 10) {
    // Verify customer group exists
    const customerGroup = await prisma.customerGroup.findUnique({
      where: { id: customerGroupId },
    });

    if (!customerGroup) {
      throw new Error('Customer group not found');
    }

    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where: { customerGroupId },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          accountStatus: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.company.count({ where: { customerGroupId } }),
    ]);

    return {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
