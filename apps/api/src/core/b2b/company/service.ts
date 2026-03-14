// @ts-nocheck
/**
 * Company Service (B2B)
 *
 * Handles CRUD operations for company accounts in the B2B commerce system.
 */

import { prisma } from '@/config/database';
import { CreateCompanyRequest, UpdateCompanyRequest, UpdateCompanyStatusRequest } from './types';

export class CompanyService {
  /**
   * Get all companies with pagination and search
   */
  static async getAllCompanies(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { taxId: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          taxId: true,
          website: true,
          description: true,
          industry: true,
          employeeCount: true,
          annualRevenue: true,
          isActive: true,
          accountStatus: true,
          accountType: true,
          paymentTerms: true,
          creditLimit: true,
          currentBalance: true,
          taxExempt: true,
          taxExemptionId: true,
          customerGroupId: true,
          discountPercent: true,
          billingAddress1: true,
          billingAddress2: true,
          billingCity: true,
          billingState: true,
          billingCountry: true,
          billingPostalCode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.company.count({ where: whereCondition }),
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

  /**
   * Get company by ID
   */
  static async getCompanyById(id: string) {
    return prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        website: true,
        description: true,
        industry: true,
        employeeCount: true,
        annualRevenue: true,
        isActive: true,
        accountStatus: true,
        accountType: true,
        paymentTerms: true,
        creditLimit: true,
        currentBalance: true,
        taxExempt: true,
        taxExemptionId: true,
        customerGroupId: true,
        discountPercent: true,
        billingAddress1: true,
        billingAddress2: true,
        billingCity: true,
        billingState: true,
        billingCountry: true,
        billingPostalCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get company by email
   */
  static async getCompanyByEmail(email: string) {
    return prisma.company.findFirst({
      where: { email },
    });
  }

  /**
   * Create new company
   */
  static async createCompany(data: CreateCompanyRequest) {
    // Check if company with email already exists
    const existingCompany = await prisma.company.findFirst({
      where: { email: data.email },
    });

    if (existingCompany) {
      throw new Error('Company with this email already exists');
    }

    return prisma.company.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        taxId: data.taxId,
        website: data.website,
        description: data.description,
        industry: data.industry,
        employeeCount: data.employeeCount,
        annualRevenue: data.annualRevenue,
        isActive: data.isActive ?? true,
        accountStatus: data.accountStatus ?? 'PENDING',
        accountType: data.accountType ?? 'STANDARD',
        paymentTerms: data.paymentTerms ?? 'IMMEDIATE',
        creditLimit: data.creditLimit ?? 0,
        taxExempt: data.taxExempt ?? false,
        taxExemptionId: data.taxExemptionId,
        customerGroupId: data.customerGroupId,
        discountPercent: data.discountPercent ?? 0,
        billingAddress1: data.billingAddress1,
        billingAddress2: data.billingAddress2,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingCountry: data.billingCountry,
        billingPostalCode: data.billingPostalCode,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        website: true,
        description: true,
        industry: true,
        employeeCount: true,
        annualRevenue: true,
        isActive: true,
        accountStatus: true,
        accountType: true,
        paymentTerms: true,
        creditLimit: true,
        currentBalance: true,
        taxExempt: true,
        taxExemptionId: true,
        customerGroupId: true,
        discountPercent: true,
        billingAddress1: true,
        billingAddress2: true,
        billingCity: true,
        billingState: true,
        billingCountry: true,
        billingPostalCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update company
   */
  static async updateCompany(id: string, data: UpdateCompanyRequest) {
    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // If email is being updated, check for duplicates
    if (data.email && data.email !== company.email) {
      const existingCompany = await prisma.company.findFirst({
        where: { email: data.email },
      });

      if (existingCompany) {
        throw new Error('Company with this email already exists');
      }
    }

    return prisma.company.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        taxId: data.taxId,
        website: data.website,
        description: data.description,
        industry: data.industry,
        employeeCount: data.employeeCount,
        annualRevenue: data.annualRevenue,
        isActive: data.isActive,
        accountStatus: data.accountStatus,
        accountType: data.accountType,
        paymentTerms: data.paymentTerms,
        creditLimit: data.creditLimit,
        taxExempt: data.taxExempt,
        taxExemptionId: data.taxExemptionId,
        customerGroupId: data.customerGroupId,
        discountPercent: data.discountPercent,
        billingAddress1: data.billingAddress1,
        billingAddress2: data.billingAddress2,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingCountry: data.billingCountry,
        billingPostalCode: data.billingPostalCode,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        website: true,
        description: true,
        industry: true,
        employeeCount: true,
        annualRevenue: true,
        isActive: true,
        accountStatus: true,
        accountType: true,
        paymentTerms: true,
        creditLimit: true,
        currentBalance: true,
        taxExempt: true,
        taxExemptionId: true,
        customerGroupId: true,
        discountPercent: true,
        billingAddress1: true,
        billingAddress2: true,
        billingCity: true,
        billingState: true,
        billingCountry: true,
        billingPostalCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update company status (Admin)
   */
  static async updateCompanyStatus(id: string, data: UpdateCompanyStatusRequest) {
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    return prisma.company.update({
      where: { id },
      data: { accountStatus: data.accountStatus },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        website: true,
        description: true,
        industry: true,
        employeeCount: true,
        annualRevenue: true,
        isActive: true,
        accountStatus: true,
        accountType: true,
        paymentTerms: true,
        creditLimit: true,
        currentBalance: true,
        taxExempt: true,
        taxExemptionId: true,
        customerGroupId: true,
        discountPercent: true,
        billingAddress1: true,
        billingAddress2: true,
        billingCity: true,
        billingState: true,
        billingCountry: true,
        billingPostalCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete company (Admin)
   */
  static async deleteCompany(id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    await prisma.company.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Get companies by status
   */
  static async getCompaniesByStatus(accountStatus: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where: { accountStatus },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          taxId: true,
          website: true,
          description: true,
          industry: true,
          employeeCount: true,
          annualRevenue: true,
          isActive: true,
          accountStatus: true,
          accountType: true,
          paymentTerms: true,
          creditLimit: true,
          currentBalance: true,
          taxExempt: true,
          taxExemptionId: true,
          customerGroupId: true,
          discountPercent: true,
          billingAddress1: true,
          billingAddress2: true,
          billingCity: true,
          billingState: true,
          billingCountry: true,
          billingPostalCode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.company.count({ where: { accountStatus } }),
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

  /**
   * Get companies by customer group
   */
  static async getCompaniesByCustomerGroup(customerGroupId: string, page = 1, limit = 10) {
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
          phone: true,
          taxId: true,
          website: true,
          description: true,
          industry: true,
          employeeCount: true,
          annualRevenue: true,
          isActive: true,
          accountStatus: true,
          accountType: true,
          paymentTerms: true,
          creditLimit: true,
          currentBalance: true,
          taxExempt: true,
          taxExemptionId: true,
          customerGroupId: true,
          discountPercent: true,
          billingAddress1: true,
          billingAddress2: true,
          billingCity: true,
          billingState: true,
          billingCountry: true,
          billingPostalCode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
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
