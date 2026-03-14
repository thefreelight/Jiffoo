/**
 * Purchase Order Routes
 */

import { FastifyInstance } from 'fastify';
import { PurchaseOrderService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import {
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  ApprovePurchaseOrderSchema,
  RejectPurchaseOrderSchema,
  ReceivePurchaseOrderItemSchema,
  PurchaseOrderStatusEnum,
  PaymentStatusEnum
} from './types';

export async function purchaseOrderRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all purchase order routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Create purchase order
  fastify.post('/', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Create purchase order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['companyId', 'items'],
        properties: {
          companyId: { type: 'string' },
          userId: { type: 'string' },
          quoteId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'variantId', 'quantity'],
              properties: {
                productId: { type: 'string' },
                variantId: { type: 'string' },
                quantity: { type: 'integer' },
                unitPrice: { type: 'number' },
                discount: { type: 'number' },
                taxRate: { type: 'number' },
                notes: { type: 'string' },
                skuSnapshot: { type: 'string' },
                customization: { type: 'string' }
              }
            }
          },
          paymentTermId: { type: 'string' },
          expectedDate: { type: 'string' },
          notes: { type: 'string' },
          customerNotes: { type: 'string' },
          termsConditions: { type: 'string' },
          internalRef: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string' },
          contactPhone: { type: 'string' },
          shippingAddress1: { type: 'string' },
          shippingAddress2: { type: 'string' },
          shippingCity: { type: 'string' },
          shippingState: { type: 'string' },
          shippingCountry: { type: 'string' },
          shippingPostalCode: { type: 'string' },
          billingAddress1: { type: 'string' },
          billingAddress2: { type: 'string' },
          billingCity: { type: 'string' },
          billingState: { type: 'string' },
          billingCountry: { type: 'string' },
          billingPostalCode: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const validatedData = CreatePurchaseOrderSchema.parse(request.body);
      const purchaseOrder = await PurchaseOrderService.createPurchaseOrder(
        validatedData,
        request.user!.id
      );
      return sendSuccess(reply, purchaseOrder, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get user purchase orders
  fastify.get('/', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Get user purchase orders',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, status } = request.query as any;
      const result = await PurchaseOrderService.getUserPurchaseOrders(
        request.user!.id,
        page,
        limit,
        status
      );
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get purchase order by ID
  fastify.get('/:id', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Get purchase order by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const purchaseOrder = await PurchaseOrderService.getPurchaseOrderById(id);
      if (!purchaseOrder) {
        return sendError(reply, 404, 'NOT_FOUND', 'Purchase order not found');
      }
      return sendSuccess(reply, purchaseOrder);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update purchase order
  fastify.put('/:id', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Update purchase order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          paymentStatus: { type: 'string' },
          paymentTermId: { type: 'string' },
          expectedDate: { type: 'string' },
          receivedDate: { type: 'string' },
          notes: { type: 'string' },
          customerNotes: { type: 'string' },
          termsConditions: { type: 'string' },
          internalRef: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string' },
          contactPhone: { type: 'string' },
          shippingAddress1: { type: 'string' },
          shippingAddress2: { type: 'string' },
          shippingCity: { type: 'string' },
          shippingState: { type: 'string' },
          shippingCountry: { type: 'string' },
          shippingPostalCode: { type: 'string' },
          billingAddress1: { type: 'string' },
          billingAddress2: { type: 'string' },
          billingCity: { type: 'string' },
          billingState: { type: 'string' },
          billingCountry: { type: 'string' },
          billingPostalCode: { type: 'string' },
          trackingNumber: { type: 'string' },
          carrier: { type: 'string' },
          subtotal: { type: 'number' },
          taxAmount: { type: 'number' },
          discountAmount: { type: 'number' },
          shippingAmount: { type: 'number' },
          totalAmount: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const validatedData = UpdatePurchaseOrderSchema.parse(request.body);
      const purchaseOrder = await PurchaseOrderService.updatePurchaseOrder(id, validatedData);
      return sendSuccess(reply, purchaseOrder);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Delete purchase order
  fastify.delete('/:id', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Delete purchase order',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await PurchaseOrderService.deletePurchaseOrder(id);
      return sendSuccess(reply, { message: 'Purchase order deleted successfully' });
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Submit purchase order for approval
  fastify.post('/:id/submit', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Submit purchase order for approval',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const purchaseOrder = await PurchaseOrderService.submitPurchaseOrder(id);
      return sendSuccess(reply, purchaseOrder);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Approve purchase order
  fastify.post('/:id/approve', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Approve purchase order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['approvedBy'],
        properties: {
          approvedBy: { type: 'string', minLength: 1 },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const validatedData = ApprovePurchaseOrderSchema.parse(request.body);
      const purchaseOrder = await PurchaseOrderService.approvePurchaseOrder(id, validatedData);
      return sendSuccess(reply, purchaseOrder);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Reject purchase order
  fastify.post('/:id/reject', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Reject purchase order',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['rejectedBy', 'rejectionReason'],
        properties: {
          rejectedBy: { type: 'string', minLength: 1 },
          rejectionReason: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const validatedData = RejectPurchaseOrderSchema.parse(request.body);
      const purchaseOrder = await PurchaseOrderService.rejectPurchaseOrder(id, validatedData);
      return sendSuccess(reply, purchaseOrder);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Receive purchase order items
  fastify.post('/:id/receive', {
    schema: {
      tags: ['purchase-orders'],
      summary: 'Receive purchase order items',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['itemId', 'quantityReceived', 'receivedBy'],
        properties: {
          itemId: { type: 'string', minLength: 1 },
          quantityReceived: { type: 'integer', minimum: 1 },
          receivedBy: { type: 'string', minLength: 1 },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const validatedData = ReceivePurchaseOrderItemSchema.parse(request.body);
      const purchaseOrder = await PurchaseOrderService.receivePurchaseOrderItem(id, validatedData);
      return sendSuccess(reply, purchaseOrder);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });
}
