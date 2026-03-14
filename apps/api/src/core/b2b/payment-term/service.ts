// @ts-nocheck
/**
 * Payment Term Service (B2B)
 *
 * Handles CRUD operations for payment terms (Net 15/30/60/90) and due date calculations.
 */

import { prisma } from '@/config/database';
import {
  CreatePaymentTermRequest,
  UpdatePaymentTermRequest,
  UpdatePaymentTermStatusRequest,
  CalculateDueDateRequest,
  DueDateCalculationResult,
  PaymentTermResponse,
  PaymentTermWithCountResponse,
} from './types';

export class PaymentTermService {
  /**
   * Get all payment terms with pagination and search
   */
  static async getAllPaymentTerms(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const [paymentTerms, total] = await Promise.all([
      prisma.paymentTerm.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          dueInDays: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { dueInDays: 'asc' },
        ],
      }),
      prisma.paymentTerm.count({ where: whereCondition }),
    ]);

    return {
      paymentTerms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payment term by ID
   */
  static async getPaymentTermById(id: string): Promise<PaymentTermWithCountResponse | null> {
    return prisma.paymentTerm.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        dueInDays: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Get payment term by code (e.g., "NET30", "NET60")
   */
  static async getPaymentTermByCode(code: string): Promise<PaymentTermResponse | null> {
    return prisma.paymentTerm.findUnique({
      where: { code },
    });
  }

  /**
   * Create new payment term
   */
  static async createPaymentTerm(data: CreatePaymentTermRequest): Promise<PaymentTermWithCountResponse> {
    // Check if payment term with code already exists
    const existingTerm = await prisma.paymentTerm.findUnique({
      where: { code: data.code },
    });

    if (existingTerm) {
      throw new Error('Payment term with this code already exists');
    }

    return prisma.paymentTerm.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        dueInDays: data.dueInDays ?? 0,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        dueInDays: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Update payment term
   */
  static async updatePaymentTerm(
    id: string,
    data: UpdatePaymentTermRequest
  ): Promise<PaymentTermWithCountResponse> {
    // Check if payment term exists
    const paymentTerm = await prisma.paymentTerm.findUnique({
      where: { id },
    });

    if (!paymentTerm) {
      throw new Error('Payment term not found');
    }

    // If code is being updated, check for duplicates
    if (data.code && data.code !== paymentTerm.code) {
      const existingTerm = await prisma.paymentTerm.findUnique({
        where: { code: data.code },
      });

      if (existingTerm) {
        throw new Error('Payment term with this code already exists');
      }
    }

    return prisma.paymentTerm.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        dueInDays: data.dueInDays,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        dueInDays: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Update payment term status (Admin)
   */
  static async updatePaymentTermStatus(
    id: string,
    data: UpdatePaymentTermStatusRequest
  ): Promise<PaymentTermWithCountResponse> {
    const paymentTerm = await prisma.paymentTerm.findUnique({
      where: { id },
    });

    if (!paymentTerm) {
      throw new Error('Payment term not found');
    }

    return prisma.paymentTerm.update({
      where: { id },
      data: { isActive: data.isActive },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        dueInDays: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });
  }

  /**
   * Delete payment term (Admin)
   */
  static async deletePaymentTerm(id: string): Promise<{ success: boolean }> {
    const paymentTerm = await prisma.paymentTerm.findUnique({
      where: { id },
    });

    if (!paymentTerm) {
      throw new Error('Payment term not found');
    }

    // Check if there are purchase orders using this payment term
    const purchaseOrdersCount = await prisma.purchaseOrder.count({
      where: { paymentTermId: id },
    });

    if (purchaseOrdersCount > 0) {
      throw new Error(
        'Cannot delete payment term with associated purchase orders. Please reassign purchase orders first.'
      );
    }

    await prisma.paymentTerm.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Get active payment terms
   */
  static async getActivePaymentTerms(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [paymentTerms, total] = await Promise.all([
      prisma.paymentTerm.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          dueInDays: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { dueInDays: 'asc' },
        ],
      }),
      prisma.paymentTerm.count({ where: { isActive: true } }),
    ]);

    return {
      paymentTerms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payment terms ordered by due days
   */
  static async getPaymentTermsByDueDays(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [paymentTerms, total] = await Promise.all([
      prisma.paymentTerm.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          dueInDays: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
        orderBy: [
          { dueInDays: 'asc' }, // Shortest payment period first
          { sortOrder: 'asc' },
        ],
      }),
      prisma.paymentTerm.count({ where: { isActive: true } }),
    ]);

    return {
      paymentTerms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calculate payment due date based on payment term
   */
  static async calculateDueDate(request: CalculateDueDateRequest): Promise<DueDateCalculationResult> {
    let paymentTerm: PaymentTermResponse | null = null;

    // Get payment term by ID or code
    if (request.paymentTermId) {
      paymentTerm = await prisma.paymentTerm.findUnique({
        where: { id: request.paymentTermId },
      });
    } else if (request.paymentTermCode) {
      paymentTerm = await prisma.paymentTerm.findUnique({
        where: { code: request.paymentTermCode },
      });
    }

    if (!paymentTerm) {
      throw new Error('Payment term not found');
    }

    // Parse start date
    const startDate = typeof request.startDate === 'string'
      ? new Date(request.startDate)
      : request.startDate;

    // Calculate due date by adding dueInDays to start date
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + paymentTerm.dueInDays);

    return {
      paymentTermId: paymentTerm.id,
      paymentTermCode: paymentTerm.code,
      paymentTermName: paymentTerm.name,
      dueInDays: paymentTerm.dueInDays,
      startDate,
      dueDate,
      isImmediate: paymentTerm.dueInDays === 0,
    };
  }

  /**
   * Calculate due date from days (utility method)
   */
  static calculateDueDateFromDays(startDate: Date, dueInDays: number): Date {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + dueInDays);
    return dueDate;
  }

  /**
   * Check if payment is overdue
   */
  static isPaymentOverdue(dueDate: Date): boolean {
    const now = new Date();
    return now > dueDate;
  }

  /**
   * Get days until payment due (negative if overdue)
   */
  static getDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Initialize default payment terms (for setup)
   */
  static async initializeDefaultPaymentTerms(): Promise<void> {
    const defaultTerms = [
      {
        code: 'IMMEDIATE',
        name: 'Immediate Payment',
        description: 'Payment due immediately upon receipt',
        dueInDays: 0,
        sortOrder: 0,
        isActive: true,
      },
      {
        code: 'NET15',
        name: 'Net 15 Days',
        description: 'Payment due within 15 days',
        dueInDays: 15,
        sortOrder: 1,
        isActive: true,
      },
      {
        code: 'NET30',
        name: 'Net 30 Days',
        description: 'Payment due within 30 days',
        dueInDays: 30,
        sortOrder: 2,
        isActive: true,
      },
      {
        code: 'NET60',
        name: 'Net 60 Days',
        description: 'Payment due within 60 days',
        dueInDays: 60,
        sortOrder: 3,
        isActive: true,
      },
      {
        code: 'NET90',
        name: 'Net 90 Days',
        description: 'Payment due within 90 days',
        dueInDays: 90,
        sortOrder: 4,
        isActive: true,
      },
    ];

    for (const term of defaultTerms) {
      const existing = await prisma.paymentTerm.findUnique({
        where: { code: term.code },
      });

      if (!existing) {
        await prisma.paymentTerm.create({
          data: term,
        });
      }
    }
  }
}
