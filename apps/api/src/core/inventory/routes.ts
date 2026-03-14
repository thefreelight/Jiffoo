/**
 * Admin Inventory Routes
 */

import { FastifyInstance } from 'fastify';
import { InventoryService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';

export async function adminInventoryRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin inventory routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get inventory by variant
  fastify.get('/variants/:variantId', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Get inventory by variant',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          includeInactive: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { variantId } = request.params as any;
      const { includeInactive } = request.query as any;
      const inventory = await InventoryService.getInventoryByVariant(variantId, includeInactive);
      return sendSuccess(reply, inventory);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get inventory by warehouse
  fastify.get('/warehouses/:warehouseId', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Get inventory by warehouse',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          variantId: { type: 'string' },
          productId: { type: 'string' },
          lowStock: { type: 'boolean' },
          outOfStock: { type: 'boolean' },
          sortBy: { type: 'string', enum: ['quantity', 'available', 'reserved', 'createdAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { warehouseId } = request.params as any;
      const { page, limit, ...filters } = request.query as any;
      const result = await InventoryService.getInventoryByWarehouse(warehouseId, page, limit, filters);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Adjust inventory
  fastify.post('/adjustments', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Adjust inventory',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['warehouseId', 'variantId', 'type', 'quantity'],
        properties: {
          warehouseId: { type: 'string' },
          variantId: { type: 'string' },
          type: { type: 'string', enum: ['purchase', 'return', 'damaged', 'loss', 'correction', 'manual', 'initial'] },
          quantity: { type: 'integer' },
          reason: { type: 'string' },
          notes: { type: 'string' },
          userId: { type: 'string' },
          referenceId: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as any;
      const result = await InventoryService.adjustInventory(data);
      return sendSuccess(reply, result, undefined, 201);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Warehouse') || error.message.includes('Variant')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('cannot be zero')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get inventory adjustment history
  fastify.get('/adjustments', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Get inventory adjustment history',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          warehouseId: { type: 'string' },
          variantId: { type: 'string' },
          productId: { type: 'string' },
          type: { type: 'string', enum: ['purchase', 'return', 'damaged', 'loss', 'correction', 'manual', 'initial'] },
          userId: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          sortBy: { type: 'string', enum: ['type', 'quantity', 'createdAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await InventoryService.getInventoryHistory(page, limit, filters);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Calculate available stock for a variant
  fastify.get('/stock/:variantId', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Calculate available stock for variant',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { variantId } = request.params as any;
      const result = await InventoryService.calculateAvailableStock(variantId);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create inventory transfer
  fastify.post('/transfers', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Create inventory transfer',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fromWarehouseId', 'toWarehouseId', 'variantId', 'quantity'],
        properties: {
          fromWarehouseId: { type: 'string' },
          toWarehouseId: { type: 'string' },
          variantId: { type: 'string' },
          quantity: { type: 'integer' },
          reason: { type: 'string' },
          notes: { type: 'string' },
          userId: { type: 'string' },
          referenceId: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as any;
      const transfer = await InventoryService.createInventoryTransfer(data);
      return sendSuccess(reply, transfer, undefined, 201);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('Warehouse') || error.message.includes('Variant')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('different') || error.message.includes('greater than zero') || error.message.includes('Insufficient')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get inventory transfers
  fastify.get('/transfers', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Get inventory transfers',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          fromWarehouseId: { type: 'string' },
          toWarehouseId: { type: 'string' },
          variantId: { type: 'string' },
          productId: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'] },
          userId: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          sortBy: { type: 'string', enum: ['quantity', 'status', 'createdAt', 'completedAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await InventoryService.getInventoryTransfers(page, limit, filters);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get single inventory transfer
  fastify.get('/transfers/:id', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Get inventory transfer by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const transfer = await InventoryService.getInventoryTransferById(id);
      return sendSuccess(reply, transfer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update inventory transfer
  fastify.put('/transfers/:id', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Update inventory transfer',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'] },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const transfer = await InventoryService.updateInventoryTransfer(id, data);
      return sendSuccess(reply, transfer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('Cannot update')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Complete inventory transfer
  fastify.post('/transfers/:id/complete', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Complete inventory transfer',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const transfer = await InventoryService.completeInventoryTransfer(id, data);
      return sendSuccess(reply, transfer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('already') || error.message.includes('Cannot complete') || error.message.includes('Insufficient')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Cancel inventory transfer
  fastify.post('/transfers/:id/cancel', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Cancel inventory transfer',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      const transfer = await InventoryService.cancelInventoryTransfer(id, data);
      return sendSuccess(reply, transfer);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('already') || error.message.includes('Cannot cancel')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Export inventory to CSV
  fastify.get('/export', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Export inventory to CSV',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          warehouseId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { warehouseId } = request.query as any;
      const csv = await InventoryService.exportInventoryCSV(warehouseId);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="inventory-export.csv"');
      return reply.send(csv);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Import inventory from CSV
  fastify.post('/import', {
    schema: {
      tags: ['admin-inventory'],
      summary: 'Import inventory from CSV',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['csvData'],
        properties: {
          csvData: { type: 'string' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { csvData, userId } = request.body as any;
      const result = await InventoryService.importInventoryCSV(csvData, userId);

      if (!result.success) {
        return sendError(reply, 400, 'IMPORT_FAILED', 'Import failed', result);
      }

      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
