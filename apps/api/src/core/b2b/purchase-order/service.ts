// @ts-nocheck
/**
 * Purchase Order Service
 *
 * Handles purchase order workflow for B2B customers.
 */

import { prisma } from '@/config/database';
import {
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  ApprovePurchaseOrderRequest,
  RejectPurchaseOrderRequest,
  ReceivePurchaseOrderItemRequest,
  PurchaseOrderResponse,
  PurchaseOrderListResponse,
  PurchaseOrderStatus,
  PaymentStatus
} from './types';
import { PricingService } from '../pricing/service';
import { InventoryService } from '@/core/inventory/service';
import { WarehouseService } from '@/core/warehouse/service';

export class PurchaseOrderService {
  /**
   * Generate unique purchase order number
   */
  private static async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    // Get the last PO number for this year
    const lastPO = await prisma.purchaseOrder.findFirst({
      where: {
        poNumber: {
          startsWith: prefix
        }
      },
      orderBy: {
        poNumber: 'desc'
      },
      select: {
        poNumber: true
      }
    });

    let nextNumber = 1;
    if (lastPO) {
      const lastNumberStr = lastPO.poNumber.replace(prefix, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // Pad with zeros (e.g., PO-2024-00001)
    const paddedNumber = nextNumber.toString().padStart(5, '0');
    return `${prefix}${paddedNumber}`;
  }

  /**
   * Calculate purchase order totals from items
   */
  private static calculatePOTotals(items: Array<{
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
  }>, shippingAmount: number = 0): {
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

    const totalAmount = subtotal - discountAmount + taxAmount + shippingAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount
    };
  }

  /**
   * Calculate payment due date based on payment term
   */
  private static calculatePaymentDueDate(
    orderDate: Date,
    dueInDays: number
  ): Date {
    const dueDate = new Date(orderDate);
    dueDate.setDate(dueDate.getDate() + dueInDays);
    return dueDate;
  }

  /**
   * Create a new purchase order
   */
  static async createPurchaseOrder(
    data: CreatePurchaseOrderRequest,
    userId?: string
  ): Promise<PurchaseOrderResponse> {
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

    // If quoteId is provided, verify quote exists and belongs to the company
    if (data.quoteId) {
      const quote = await prisma.quote.findUnique({
        where: { id: data.quoteId }
      });

      if (!quote) {
        throw new Error('Quote not found');
      }

      if (quote.companyId !== data.companyId) {
        throw new Error('Quote does not belong to this company');
      }

      if (quote.status !== 'APPROVED') {
        throw new Error('Only approved quotes can be converted to purchase orders');
      }
    }

    // Validate payment term if provided
    let paymentTerm = null;
    if (data.paymentTermId) {
      paymentTerm = await prisma.paymentTerm.findUnique({
        where: { id: data.paymentTermId }
      });

      if (!paymentTerm) {
        throw new Error('Payment term not found');
      }

      if (!paymentTerm.isActive) {
        throw new Error('Payment term is not active');
      }
    }

    // Validate items and calculate pricing
    const poItems: Array<{
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

    const requestedQuantityByVariant = new Map<string, number>();
    for (const item of data.items) {
      requestedQuantityByVariant.set(
        item.variantId,
        (requestedQuantityByVariant.get(item.variantId) || 0) + item.quantity
      );
    }

    const defaultWarehouse = await WarehouseService.getDefaultWarehouse();
    const stockMap = await InventoryService.getAvailableStockByVariantIds(
      [...requestedQuantityByVariant.keys()],
      { warehouseId: defaultWarehouse.id }
    );

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

      // Verify stock availability
      const availableStock = stockMap.get(item.variantId) ?? 0;
      const requestedQuantity = requestedQuantityByVariant.get(item.variantId) ?? item.quantity;
      if (availableStock < requestedQuantity) {
        throw new Error(`Insufficient stock for variant ${variant.name} of product: ${product.name}`);
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

      poItems.push({
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
    const totals = this.calculatePOTotals(poItems);

    // Calculate payment due date if payment term is provided
    const orderDate = new Date();
    let paymentDueDate = null;
    if (paymentTerm) {
      paymentDueDate = this.calculatePaymentDueDate(orderDate, paymentTerm.dueInDays);
    }

    // Generate PO number
    const poNumber = await this.generatePONumber();

    // Create purchase order
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        companyId: data.companyId,
        userId: requestUserId,
        quoteId: data.quoteId,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        paymentTermId: data.paymentTermId,
        orderDate,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        paymentDueDate,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        shippingAmount: 0,
        totalAmount: totals.totalAmount,
        notes: data.notes,
        customerNotes: data.customerNotes,
        termsConditions: data.termsConditions,
        internalRef: data.internalRef,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        shippingAddress1: data.shippingAddress1,
        shippingAddress2: data.shippingAddress2,
        shippingCity: data.shippingCity,
        shippingState: data.shippingState,
        shippingCountry: data.shippingCountry,
        shippingPostalCode: data.shippingPostalCode,
        billingAddress1: data.billingAddress1,
        billingAddress2: data.billingAddress2,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingCountry: data.billingCountry,
        billingPostalCode: data.billingPostalCode,
        items: {
          create: poItems
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
        },
        paymentTerm: {
          select: {
            id: true,
            code: true,
            name: true,
            dueInDays: true
          }
        }
      }
    });

    return this.formatPurchaseOrderResponse(purchaseOrder);
  }

  /**
   * Get purchase order by ID
   */
  static async getPurchaseOrderById(
    id: string
  ): Promise<PurchaseOrderResponse> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
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
        },
        paymentTerm: {
          select: {
            id: true,
            code: true,
            name: true,
            dueInDays: true
          }
        }
      }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    return this.formatPurchaseOrderResponse(purchaseOrder);
  }

  /**
   * Get user's purchase orders
   */
  static async getUserPurchaseOrders(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: PurchaseOrderStatus
  ): Promise<PurchaseOrderListResponse> {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
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
          },
          paymentTerm: {
            select: {
              id: true,
              code: true,
              name: true,
              dueInDays: true
            }
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    return {
      purchaseOrders: purchaseOrders.map(po => this.formatPurchaseOrderResponse(po)),
      total,
      page,
      limit
    };
  }

  /**
   * Get company's purchase orders
   */
  static async getCompanyPurchaseOrders(
    companyId: string,
    page: number = 1,
    limit: number = 10,
    status?: PurchaseOrderStatus
  ): Promise<PurchaseOrderListResponse> {
    const skip = (page - 1) * limit;
    const where: any = { companyId };

    if (status) {
      where.status = status;
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
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
          },
          paymentTerm: {
            select: {
              id: true,
              code: true,
              name: true,
              dueInDays: true
            }
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    return {
      purchaseOrders: purchaseOrders.map(po => this.formatPurchaseOrderResponse(po)),
      total,
      page,
      limit
    };
  }

  /**
   * Get all purchase orders (admin)
   */
  static async getAllPurchaseOrders(
    page: number = 1,
    limit: number = 10,
    status?: PurchaseOrderStatus,
    paymentStatus?: PaymentStatus,
    companyId?: string
  ): Promise<PurchaseOrderListResponse> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
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
          },
          paymentTerm: {
            select: {
              id: true,
              code: true,
              name: true,
              dueInDays: true
            }
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    return {
      purchaseOrders: purchaseOrders.map(po => this.formatPurchaseOrderResponse(po)),
      total,
      page,
      limit
    };
  }

  /**
   * Update purchase order
   */
  static async updatePurchaseOrder(
    id: string,
    data: UpdatePurchaseOrderRequest
  ): Promise<PurchaseOrderResponse> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    // Prevent updates to completed or cancelled purchase orders
    if (['RECEIVED', 'CANCELLED'].includes(purchaseOrder.status)) {
      throw new Error(`Cannot update purchase order with status: ${purchaseOrder.status}`);
    }

    const updateData: any = {};

    // Only allow certain fields to be updated
    if (data.status !== undefined) updateData.status = data.status;
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
    if (data.paymentTermId !== undefined) updateData.paymentTermId = data.paymentTermId;
    if (data.expectedDate !== undefined) {
      updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null;
    }
    if (data.receivedDate !== undefined) {
      updateData.receivedDate = data.receivedDate ? new Date(data.receivedDate) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.customerNotes !== undefined) updateData.customerNotes = data.customerNotes;
    if (data.termsConditions !== undefined) updateData.termsConditions = data.termsConditions;
    if (data.internalRef !== undefined) updateData.internalRef = data.internalRef;
    if (data.contactName !== undefined) updateData.contactName = data.contactName;
    if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
    if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber;
    if (data.carrier !== undefined) updateData.carrier = data.carrier;

    // Address fields
    if (data.shippingAddress1 !== undefined) updateData.shippingAddress1 = data.shippingAddress1;
    if (data.shippingAddress2 !== undefined) updateData.shippingAddress2 = data.shippingAddress2;
    if (data.shippingCity !== undefined) updateData.shippingCity = data.shippingCity;
    if (data.shippingState !== undefined) updateData.shippingState = data.shippingState;
    if (data.shippingCountry !== undefined) updateData.shippingCountry = data.shippingCountry;
    if (data.shippingPostalCode !== undefined) updateData.shippingPostalCode = data.shippingPostalCode;
    if (data.billingAddress1 !== undefined) updateData.billingAddress1 = data.billingAddress1;
    if (data.billingAddress2 !== undefined) updateData.billingAddress2 = data.billingAddress2;
    if (data.billingCity !== undefined) updateData.billingCity = data.billingCity;
    if (data.billingState !== undefined) updateData.billingState = data.billingState;
    if (data.billingCountry !== undefined) updateData.billingCountry = data.billingCountry;
    if (data.billingPostalCode !== undefined) updateData.billingPostalCode = data.billingPostalCode;

    // Pricing fields
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount;
    if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
    if (data.shippingAmount !== undefined) updateData.shippingAmount = data.shippingAmount;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;

    const updated = await prisma.purchaseOrder.update({
      where: { id },
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
        },
        paymentTerm: {
          select: {
            id: true,
            code: true,
            name: true,
            dueInDays: true
          }
        }
      }
    });

    return this.formatPurchaseOrderResponse(updated);
  }

  /**
   * Submit purchase order for approval (DRAFT -> PENDING_APPROVAL)
   */
  static async submitPurchaseOrder(
    id: string
  ): Promise<PurchaseOrderResponse> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.status !== 'DRAFT') {
      throw new Error('Only draft purchase orders can be submitted for approval');
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
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
        },
        paymentTerm: {
          select: {
            id: true,
            code: true,
            name: true,
            dueInDays: true
          }
        }
      }
    });

    return this.formatPurchaseOrderResponse(updated);
  }

  /**
   * Approve purchase order (PENDING_APPROVAL -> APPROVED)
   */
  static async approvePurchaseOrder(
    id: string,
    data: ApprovePurchaseOrderRequest
  ): Promise<PurchaseOrderResponse> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.status !== 'PENDING_APPROVAL') {
      throw new Error('Only pending purchase orders can be approved');
    }

    const now = new Date();
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: data.approvedBy,
        approvedAt: now,
        approvalDate: now,
        notes: data.notes
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
        },
        paymentTerm: {
          select: {
            id: true,
            code: true,
            name: true,
            dueInDays: true
          }
        }
      }
    });

    return this.formatPurchaseOrderResponse(updated);
  }

  /**
   * Reject purchase order (PENDING_APPROVAL -> REJECTED)
   */
  static async rejectPurchaseOrder(
    id: string,
    data: RejectPurchaseOrderRequest
  ): Promise<PurchaseOrderResponse> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (purchaseOrder.status !== 'PENDING_APPROVAL') {
      throw new Error('Only pending purchase orders can be rejected');
    }

    const now = new Date();
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: data.rejectedBy,
        rejectedAt: now,
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
        },
        paymentTerm: {
          select: {
            id: true,
            code: true,
            name: true,
            dueInDays: true
          }
        }
      }
    });

    return this.formatPurchaseOrderResponse(updated);
  }

  /**
   * Receive purchase order items
   */
  static async receivePurchaseOrderItem(
    id: string,
    data: ReceivePurchaseOrderItemRequest
  ): Promise<PurchaseOrderResponse> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (!['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status)) {
      throw new Error('Can only receive items for approved or ordered purchase orders');
    }

    const item = purchaseOrder.items.find(i => i.id === data.itemId);
    if (!item) {
      throw new Error('Purchase order item not found');
    }

    const newQuantityReceived = item.quantityReceived + data.quantityReceived;
    if (newQuantityReceived > item.quantity) {
      throw new Error('Cannot receive more than ordered quantity');
    }

    // Update item
    await prisma.purchaseOrderItem.update({
      where: { id: data.itemId },
      data: {
        quantityReceived: newQuantityReceived,
        receivedDate: new Date(),
        receivedBy: data.receivedBy,
        notes: data.notes
      }
    });

    // Check if all items are fully received
    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    const allItemsReceived = updatedPO!.items.every(
      i => i.quantityReceived === i.quantity
    );
    const someItemsReceived = updatedPO!.items.some(
      i => i.quantityReceived > 0
    );

    let newStatus = purchaseOrder.status;
    if (allItemsReceived) {
      newStatus = 'RECEIVED';
    } else if (someItemsReceived) {
      newStatus = 'PARTIALLY_RECEIVED';
    }

    // Update PO status if needed
    if (newStatus !== purchaseOrder.status) {
      await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: allItemsReceived ? new Date() : null
        }
      });
    }

    return this.getPurchaseOrderById(id);
  }

  /**
   * Delete purchase order (only DRAFT or REJECTED)
   */
  static async deletePurchaseOrder(id: string): Promise<void> {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id }
    });

    if (!purchaseOrder) {
      throw new Error('Purchase order not found');
    }

    if (!['DRAFT', 'REJECTED'].includes(purchaseOrder.status)) {
      throw new Error('Can only delete draft or rejected purchase orders');
    }

    await prisma.purchaseOrder.delete({
      where: { id }
    });
  }

  /**
   * Get pending purchase orders (admin)
   */
  static async getPendingPurchaseOrders(
    page: number = 1,
    limit: number = 10
  ): Promise<PurchaseOrderListResponse> {
    return this.getAllPurchaseOrders(page, limit, 'PENDING_APPROVAL');
  }

  /**
   * Mark payment status as overdue for purchase orders past due date
   */
  static async markOverduePurchaseOrders(): Promise<number> {
    const now = new Date();

    const result = await prisma.purchaseOrder.updateMany({
      where: {
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        paymentDueDate: {
          lt: now
        }
      },
      data: {
        paymentStatus: 'OVERDUE'
      }
    });

    return result.count;
  }

  /**
   * Format purchase order response
   */
  private static formatPurchaseOrderResponse(po: any): PurchaseOrderResponse {
    return {
      id: po.id,
      poNumber: po.poNumber,
      companyId: po.companyId,
      userId: po.userId,
      quoteId: po.quoteId,
      status: po.status,
      paymentStatus: po.paymentStatus,
      paymentTermId: po.paymentTermId,
      orderDate: po.orderDate,
      approvalDate: po.approvalDate,
      expectedDate: po.expectedDate,
      receivedDate: po.receivedDate,
      paymentDueDate: po.paymentDueDate,
      subtotal: po.subtotal,
      taxAmount: po.taxAmount,
      discountAmount: po.discountAmount,
      shippingAmount: po.shippingAmount,
      totalAmount: po.totalAmount,
      notes: po.notes,
      customerNotes: po.customerNotes,
      termsConditions: po.termsConditions,
      internalRef: po.internalRef,
      contactName: po.contactName,
      contactEmail: po.contactEmail,
      contactPhone: po.contactPhone,
      shippingAddress1: po.shippingAddress1,
      shippingAddress2: po.shippingAddress2,
      shippingCity: po.shippingCity,
      shippingState: po.shippingState,
      shippingCountry: po.shippingCountry,
      shippingPostalCode: po.shippingPostalCode,
      billingAddress1: po.billingAddress1,
      billingAddress2: po.billingAddress2,
      billingCity: po.billingCity,
      billingState: po.billingState,
      billingCountry: po.billingCountry,
      billingPostalCode: po.billingPostalCode,
      approvedBy: po.approvedBy,
      approvedAt: po.approvedAt,
      rejectedBy: po.rejectedBy,
      rejectedAt: po.rejectedAt,
      rejectionReason: po.rejectionReason,
      trackingNumber: po.trackingNumber,
      carrier: po.carrier,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      items: po.items?.map((item: any) => ({
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        total: item.total,
        quantityReceived: item.quantityReceived,
        receivedDate: item.receivedDate,
        receivedBy: item.receivedBy,
        notes: item.notes,
        skuSnapshot: item.skuSnapshot,
        customization: item.customization,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        product: item.product,
        variant: item.variant
      })),
      company: po.company,
      user: po.user,
      paymentTerm: po.paymentTerm
    };
  }
}
