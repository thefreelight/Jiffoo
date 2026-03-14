// @ts-nocheck
/**
 * Quote Service
 *
 * Handles quote request and approval workflow for B2B customers.
 */

import { prisma } from '@/config/database';
import {
  CreateQuoteRequest,
  UpdateQuoteRequest,
  ApproveQuoteRequest,
  RejectQuoteRequest,
  QuoteResponse,
  QuoteListResponse,
  QuoteStatus
} from './types';
import { PricingService } from '../pricing/service';

export class QuoteService {
  /**
   * Generate unique quote number
   */
  private static async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `Q-${year}-`;

    // Get the last quote number for this year
    const lastQuote = await prisma.quote.findFirst({
      where: {
        quoteNumber: {
          startsWith: prefix
        }
      },
      orderBy: {
        quoteNumber: 'desc'
      },
      select: {
        quoteNumber: true
      }
    });

    let nextNumber = 1;
    if (lastQuote) {
      const lastNumberStr = lastQuote.quoteNumber.replace(prefix, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // Pad with zeros (e.g., Q-2024-00001)
    const paddedNumber = nextNumber.toString().padStart(5, '0');
    return `${prefix}${paddedNumber}`;
  }

  /**
   * Calculate quote totals from items
   */
  private static calculateQuoteTotals(items: Array<{
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
  }>): {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
  } {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (const item of items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;
      discountAmount += item.discount;

      // Calculate tax on discounted amount
      const taxableAmount = itemSubtotal - item.discount;
      const itemTax = (taxableAmount * item.taxRate) / 100;
      taxAmount += itemTax;
    }

    const totalAmount = subtotal - discountAmount + taxAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount
    };
  }

  /**
   * Create a new quote request
   */
  static async createQuote(
    data: CreateQuoteRequest,
    userId?: string
  ): Promise<QuoteResponse> {
    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: data.companyId }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Use provided userId or from data
    const requestUserId = userId || data.userId;
    if (!requestUserId) {
      throw new Error('User ID is required');
    }

    // Verify user exists and is associated with company
    const user = await prisma.user.findUnique({
      where: { id: requestUserId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const companyUser = await prisma.companyUser.findFirst({
      where: {
        userId: requestUserId,
        companyId: data.companyId,
        isActive: true
      }
    });

    if (!companyUser) {
      throw new Error('User is not associated with this company');
    }

    // Validate items and calculate pricing
    const quoteItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      taxRate: number;
      total: number;
      notes?: string;
      skuSnapshot?: string;
      customization?: string;
    }> = [];

    for (const item of data.items) {
      // Verify product and variant exist
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const variant = product.variants.find(v => v.id === item.variantId);
      if (!variant) {
        throw new Error(`Variant not found: ${item.variantId}`);
      }

      // Calculate price using pricing rules if no unit price provided
      let unitPrice = item.unitPrice ?? Number(variant.salePrice);

      if (!item.unitPrice) {
        try {
          const priceCalculation = await PricingService.calculatePrice({
            variantId: item.variantId,
            productId: item.productId,
            quantity: item.quantity,
            companyId: data.companyId,
            customerGroupId: company.customerGroupId ?? undefined
          });
          unitPrice = priceCalculation.finalPrice;
        } catch (error) {
          // Fall back to sale price if pricing calculation fails
          unitPrice = Number(variant.salePrice);
        }
      }

      // Calculate item total
      const itemSubtotal = item.quantity * unitPrice;
      const taxableAmount = itemSubtotal - item.discount;
      const itemTax = (taxableAmount * item.taxRate) / 100;
      const itemTotal = itemSubtotal - item.discount + itemTax;

      quoteItems.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        total: itemTotal,
        notes: item.notes,
        skuSnapshot: variant.skuCode,
        customization: item.customization
      });
    }

    // Calculate totals
    const totals = this.calculateQuoteTotals(quoteItems);

    // Generate quote number
    const quoteNumber = await this.generateQuoteNumber();

    // Create quote with items
    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        companyId: data.companyId,
        userId: requestUserId,
        status: 'DRAFT',
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        shippingAmount: 0, // Can be updated later
        totalAmount: totals.totalAmount,
        notes: data.notes,
        customerNotes: data.customerNotes,
        termsConditions: data.termsConditions,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        shippingAddress1: data.shippingAddress1,
        shippingAddress2: data.shippingAddress2,
        shippingCity: data.shippingCity,
        shippingState: data.shippingState,
        shippingCountry: data.shippingCountry,
        shippingPostalCode: data.shippingPostalCode,
        items: {
          create: quoteItems
        }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                skuCode: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return quote as unknown as QuoteResponse;
  }

  /**
   * Get quote by ID
   */
  static async getQuoteById(quoteId: string): Promise<QuoteResponse> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                skuCode: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!quote) {
      throw new Error('Quote not found');
    }

    return quote as unknown as QuoteResponse;
  }

  /**
   * Get quotes for a user
   */
  static async getUserQuotes(
    userId: string,
    page = 1,
    limit = 10,
    status?: QuoteStatus
  ): Promise<QuoteListResponse> {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  skuCode: true
                }
              }
            }
          },
          company: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.quote.count({ where })
    ]);

    return {
      quotes: quotes as unknown as QuoteResponse[],
      total,
      page,
      limit
    };
  }

  /**
   * Get quotes for a company
   */
  static async getCompanyQuotes(
    companyId: string,
    page = 1,
    limit = 10,
    status?: QuoteStatus
  ): Promise<QuoteListResponse> {
    const skip = (page - 1) * limit;
    const where: any = { companyId };

    if (status) {
      where.status = status;
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  skuCode: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      }),
      prisma.quote.count({ where })
    ]);

    return {
      quotes: quotes as unknown as QuoteResponse[],
      total,
      page,
      limit
    };
  }

  /**
   * Get all quotes (admin)
   */
  static async getAllQuotes(
    page = 1,
    limit = 10,
    status?: QuoteStatus,
    companyId?: string
  ): Promise<QuoteListResponse> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  skuCode: true
                }
              }
            }
          },
          company: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      }),
      prisma.quote.count({ where })
    ]);

    return {
      quotes: quotes as unknown as QuoteResponse[],
      total,
      page,
      limit
    };
  }

  /**
   * Update quote
   */
  static async updateQuote(
    quoteId: string,
    data: UpdateQuoteRequest
  ): Promise<QuoteResponse> {
    // Verify quote exists and is not in a final state
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!existingQuote) {
      throw new Error('Quote not found');
    }

    if (['APPROVED', 'REJECTED', 'CONVERTED'].includes(existingQuote.status)) {
      throw new Error(`Cannot update quote in ${existingQuote.status} status`);
    }

    const updateData: any = {};

    if (data.status) updateData.status = data.status;
    if (data.validFrom) updateData.validFrom = new Date(data.validFrom);
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.customerNotes !== undefined) updateData.customerNotes = data.customerNotes;
    if (data.termsConditions !== undefined) updateData.termsConditions = data.termsConditions;
    if (data.contactName !== undefined) updateData.contactName = data.contactName;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.shippingAddress1 !== undefined) updateData.shippingAddress1 = data.shippingAddress1;
    if (data.shippingAddress2 !== undefined) updateData.shippingAddress2 = data.shippingAddress2;
    if (data.shippingCity !== undefined) updateData.shippingCity = data.shippingCity;
    if (data.shippingState !== undefined) updateData.shippingState = data.shippingState;
    if (data.shippingCountry !== undefined) updateData.shippingCountry = data.shippingCountry;
    if (data.shippingPostalCode !== undefined) updateData.shippingPostalCode = data.shippingPostalCode;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
    if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
    if (data.shippingAmount !== undefined) updateData.shippingAmount = data.shippingAmount;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                skuCode: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return quote as unknown as QuoteResponse;
  }

  /**
   * Submit quote for approval (change from DRAFT to PENDING)
   */
  static async submitQuote(quoteId: string): Promise<QuoteResponse> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!quote) {
      throw new Error('Quote not found');
    }

    if (quote.status !== 'DRAFT') {
      throw new Error('Only DRAFT quotes can be submitted');
    }

    return this.updateQuote(quoteId, { status: 'PENDING' });
  }

  /**
   * Approve quote (merchant/admin action)
   */
  static async approveQuote(
    quoteId: string,
    data: ApproveQuoteRequest
  ): Promise<QuoteResponse> {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!existingQuote) {
      throw new Error('Quote not found');
    }

    if (existingQuote.status !== 'PENDING') {
      throw new Error('Only PENDING quotes can be approved');
    }

    const updateData: any = {
      status: 'APPROVED',
      approvedBy: data.approvedBy,
      approvedAt: new Date()
    };

    if (data.validUntil) {
      updateData.validUntil = new Date(data.validUntil);
    }

    if (data.notes) {
      updateData.notes = data.notes;
    }

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                skuCode: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return quote as unknown as QuoteResponse;
  }

  /**
   * Reject quote (merchant/admin action)
   */
  static async rejectQuote(
    quoteId: string,
    data: RejectQuoteRequest
  ): Promise<QuoteResponse> {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!existingQuote) {
      throw new Error('Quote not found');
    }

    if (existingQuote.status !== 'PENDING') {
      throw new Error('Only PENDING quotes can be rejected');
    }

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'REJECTED',
        rejectedBy: data.rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: data.rejectionReason
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            variant: {
              select: {
                id: true,
                name: true,
                skuCode: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    return quote as unknown as QuoteResponse;
  }

  /**
   * Delete quote
   */
  static async deleteQuote(quoteId: string): Promise<void> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!quote) {
      throw new Error('Quote not found');
    }

    // Only allow deletion of DRAFT or REJECTED quotes
    if (!['DRAFT', 'REJECTED'].includes(quote.status)) {
      throw new Error('Only DRAFT or REJECTED quotes can be deleted');
    }

    await prisma.quote.delete({
      where: { id: quoteId }
    });
  }

  /**
   * Expire quotes that have passed their validUntil date
   */
  static async expireQuotes(): Promise<number> {
    const now = new Date();

    const result = await prisma.quote.updateMany({
      where: {
        status: {
          in: ['DRAFT', 'PENDING', 'APPROVED']
        },
        validUntil: {
          lt: now
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    return result.count;
  }

  /**
   * Get quotes by status
   */
  static async getQuotesByStatus(
    status: QuoteStatus,
    page = 1,
    limit = 10
  ): Promise<QuoteListResponse> {
    return this.getAllQuotes(page, limit, status);
  }

  /**
   * Get pending quotes (admin view)
   */
  static async getPendingQuotes(
    page = 1,
    limit = 10
  ): Promise<QuoteListResponse> {
    return this.getQuotesByStatus('PENDING', page, limit);
  }
}
