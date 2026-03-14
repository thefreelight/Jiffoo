/**
 * Admin Warehouse Routes
 */

import { FastifyInstance } from 'fastify';
import { WarehouseService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';

export async function adminWarehouseRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin warehouse routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get warehouses list
  fastify.get('/', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Get warehouses list',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' },
          isActive: { type: 'boolean' },
          sortBy: { type: 'string', enum: ['name', 'code', 'createdAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await WarehouseService.getWarehouses(page, limit, filters);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get warehouse statistics
  fastify.get('/stats', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Get warehouse statistics',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const stats = await WarehouseService.getWarehouseStats();
      return sendSuccess(reply, stats);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get default warehouse
  fastify.get('/default', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Get default warehouse',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const warehouse = await WarehouseService.getDefaultWarehouse();
      return sendSuccess(reply, warehouse);
    } catch (error: any) {
      if (error.message === 'No active warehouse found') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get single warehouse
  fastify.get('/:id', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Get warehouse by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const warehouse = await WarehouseService.getWarehouseById(id);
      return sendSuccess(reply, warehouse);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get warehouse with stats
  fastify.get('/:id/stats', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Get warehouse with inventory statistics',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const warehouse = await WarehouseService.getWarehouseWithStats(id);
      return sendSuccess(reply, warehouse);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create warehouse
  fastify.post('/', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Create warehouse',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          address: { type: 'string' },
          isActive: { type: 'boolean' },
          isDefault: { type: 'boolean' }
        },
        required: ['name', 'code', 'address']
      }
    }
  }, async (request, reply) => {
    try {
      const warehouse = await WarehouseService.createWarehouse(request.body as any);
      return sendSuccess(reply, warehouse, undefined, 201);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update warehouse
  fastify.put('/:id', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Update warehouse',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          code: { type: 'string' },
          address: { type: 'string' },
          isActive: { type: 'boolean' },
          isDefault: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const warehouse = await WarehouseService.updateWarehouse(id, request.body as any);
      return sendSuccess(reply, warehouse);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('already exists')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Set default warehouse
  fastify.put('/:id/default', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Set default warehouse',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const warehouse = await WarehouseService.setDefaultWarehouse(id);
      return sendSuccess(reply, warehouse);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete warehouse
  fastify.delete('/:id', {
    schema: {
      tags: ['admin-warehouses'],
      summary: 'Delete warehouse',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await WarehouseService.deleteWarehouse(id);
      return sendSuccess(reply, null, 'Warehouse deleted');
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      if (error.message.includes('Cannot delete')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
