// @ts-nocheck
/**
 * CompanyUser Service (B2B)
 *
 * Handles management of users within company accounts in the B2B commerce system.
 */

import { prisma } from '@/config/database';
import { AddCompanyUserRequest, UpdateCompanyUserRequest, UpdateCompanyUserRoleRequest } from './types';

export class CompanyUserService {
  /**
   * Get all users in a company with pagination
   */
  static async getCompanyUsers(companyId: string, page = 1, limit = 10, role?: string) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {
      companyId,
    };

    if (role) {
      whereCondition.role = role;
    }

    const [companyUsers, total] = await Promise.all([
      prisma.companyUser.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          companyId: true,
          userId: true,
          role: true,
          permissions: true,
          approvalLimit: true,
          isActive: true,
          invitedBy: true,
          invitedAt: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.companyUser.count({ where: whereCondition }),
    ]);

    return {
      companyUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get company user by ID
   */
  static async getCompanyUserById(id: string) {
    return prisma.companyUser.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        permissions: true,
        approvalLimit: true,
        isActive: true,
        invitedBy: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            email: true,
            accountStatus: true,
          },
        },
      },
    });
  }

  /**
   * Get user's companies
   */
  static async getUserCompanies(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [companyUsers, total] = await Promise.all([
      prisma.companyUser.findMany({
        where: { userId },
        skip,
        take: limit,
        select: {
          id: true,
          companyId: true,
          userId: true,
          role: true,
          permissions: true,
          approvalLimit: true,
          isActive: true,
          invitedBy: true,
          invitedAt: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true,
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              accountStatus: true,
              accountType: true,
              paymentTerms: true,
              creditLimit: true,
              currentBalance: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.companyUser.count({ where: { userId } }),
    ]);

    return {
      companyUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add user to company
   */
  static async addUserToCompany(data: AddCompanyUserRequest) {
    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a member of this company
    const existingMembership = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: data.companyId,
          userId: data.userId,
        },
      },
    });

    if (existingMembership) {
      throw new Error('User is already a member of this company');
    }

    return prisma.companyUser.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        role: data.role ?? 'BUYER',
        permissions: data.permissions,
        approvalLimit: data.approvalLimit ?? 0,
        isActive: data.isActive ?? true,
        invitedBy: data.invitedBy,
        invitedAt: data.invitedBy ? new Date() : undefined,
      },
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        permissions: true,
        approvalLimit: true,
        isActive: true,
        invitedBy: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Update company user
   */
  static async updateCompanyUser(id: string, data: UpdateCompanyUserRequest) {
    // Check if company user exists
    const companyUser = await prisma.companyUser.findUnique({
      where: { id },
    });

    if (!companyUser) {
      throw new Error('Company user not found');
    }

    return prisma.companyUser.update({
      where: { id },
      data: {
        role: data.role,
        permissions: data.permissions,
        approvalLimit: data.approvalLimit,
        isActive: data.isActive,
      },
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        permissions: true,
        approvalLimit: true,
        isActive: true,
        invitedBy: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Update company user role (Admin/simplified)
   */
  static async updateCompanyUserRole(id: string, data: UpdateCompanyUserRoleRequest) {
    const companyUser = await prisma.companyUser.findUnique({
      where: { id },
    });

    if (!companyUser) {
      throw new Error('Company user not found');
    }

    return prisma.companyUser.update({
      where: { id },
      data: { role: data.role },
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        permissions: true,
        approvalLimit: true,
        isActive: true,
        invitedBy: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Remove user from company
   */
  static async removeUserFromCompany(id: string) {
    const companyUser = await prisma.companyUser.findUnique({
      where: { id },
    });

    if (!companyUser) {
      throw new Error('Company user not found');
    }

    await prisma.companyUser.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Get company users by role
   */
  static async getCompanyUsersByRole(companyId: string, role: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [companyUsers, total] = await Promise.all([
      prisma.companyUser.findMany({
        where: {
          companyId,
          role,
        },
        skip,
        take: limit,
        select: {
          id: true,
          companyId: true,
          userId: true,
          role: true,
          permissions: true,
          approvalLimit: true,
          isActive: true,
          invitedBy: true,
          invitedAt: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.companyUser.count({ where: { companyId, role } }),
    ]);

    return {
      companyUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if user is a member of company
   */
  static async isUserMemberOfCompany(userId: string, companyId: string) {
    const companyUser = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId,
        },
      },
    });

    return !!companyUser;
  }

  /**
   * Get active company admins
   */
  static async getCompanyAdmins(companyId: string) {
    return prisma.companyUser.findMany({
      where: {
        companyId,
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        permissions: true,
        approvalLimit: true,
        isActive: true,
        invitedBy: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
