import { FastifyInstance } from 'fastify';
import { InventoryService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { requirePermission, requireRole } from '@/core/permissions/middleware';
import { Resource, Action, UserRole } from '@/core/permissions/types';
import { InventoryOperation } from './types';

export async function inventoryRoutes(fastify: FastifyInstance) {
  // 获取库存统计 (管理员及以上)
  fastify.get('/stats', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['inventory'],
      summary: '获取库存统计',
      description: '获取库存总体统计数据',
      response: {
        200: {
          type: 'object',
          properties: {
            totalProducts: { type: 'integer' },
            inStockProducts: { type: 'integer' },
            lowStockProducts: { type: 'integer' },
            outOfStockProducts: { type: 'integer' },
            totalValue: { type: 'number' },
            averageStockLevel: { type: 'number' },
            turnoverRate: { type: 'number' },
            alerts: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                unresolved: { type: 'integer' },
                byType: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await InventoryService.getInventoryStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get inventory stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 更新库存 (员工及以上)
  fastify.post('/update', {
    preHandler: [authMiddleware, requireRole(UserRole.STAFF)],
    schema: {
      tags: ['inventory'],
      summary: '更新库存',
      description: '执行单个库存操作',
      body: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          operation: {
            type: 'string',
            enum: Object.values(InventoryOperation)
          },
          quantity: { type: 'integer', minimum: 1 },
          reason: { type: 'string' },
          reference: { type: 'string' }
        },
        required: ['productId', 'operation', 'quantity']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            productId: { type: 'string' },
            operation: { type: 'string' },
            quantity: { type: 'integer' },
            previousStock: { type: 'integer' },
            newStock: { type: 'integer' },
            reason: { type: 'string' },
            reference: { type: 'string' },
            operatorId: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { productId, operation, quantity, reason, reference } = request.body as {
        productId: string;
        operation: InventoryOperation;
        quantity: number;
        reason?: string;
        reference?: string;
      };

      const record = await InventoryService.updateInventory({
        productId,
        operation,
        quantity,
        reason,
        reference,
        operatorId: user.userId
      });

      return reply.send(record);
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to update inventory',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 批量更新库存 (管理员及以上)
  fastify.post('/bulk-update', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['inventory'],
      summary: '批量更新库存',
      description: '执行多个库存操作',
      body: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                operation: {
                  type: 'string',
                  enum: Object.values(InventoryOperation)
                },
                quantity: { type: 'integer', minimum: 1 },
                reason: { type: 'string' },
                reference: { type: 'string' }
              },
              required: ['productId', 'operation', 'quantity']
            }
          },
          reason: { type: 'string' }
        },
        required: ['operations']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            records: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  productId: { type: 'string' },
                  operation: { type: 'string' },
                  quantity: { type: 'integer' },
                  previousStock: { type: 'integer' },
                  newStock: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { operations, reason } = request.body as {
        operations: Array<{
          productId: string;
          operation: InventoryOperation;
          quantity: number;
          reason?: string;
          reference?: string;
        }>;
        reason?: string;
      };

      const records = await InventoryService.bulkUpdateInventory({
        operations,
        reason: reason || 'Bulk inventory update',
        operatorId: user.userId
      });

      return reply.send({
        success: true,
        records
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to bulk update inventory',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取库存记录 (员工及以上)
  fastify.get('/records', {
    preHandler: [authMiddleware, requireRole(UserRole.STAFF)],
    schema: {
      tags: ['inventory'],
      summary: '获取库存记录',
      description: '获取库存操作记录列表',
      querystring: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          operation: {
            type: 'string',
            enum: Object.values(InventoryOperation)
          },
          operatorId: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sortBy: {
            type: 'string',
            enum: ['createdAt', 'quantity', 'stock'],
            default: 'createdAt'
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            records: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  productId: { type: 'string' },
                  operation: { type: 'string' },
                  quantity: { type: 'integer' },
                  previousStock: { type: 'integer' },
                  newStock: { type: 'integer' },
                  reason: { type: 'string' },
                  reference: { type: 'string' },
                  operatorId: { type: 'string' },
                  createdAt: { type: 'string' },
                  product: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' }
                    }
                  }
                }
              }
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any;

      // 转换日期字符串
      if (query.startDate) query.startDate = new Date(query.startDate);
      if (query.endDate) query.endDate = new Date(query.endDate);

      const result = await InventoryService.getInventoryRecords(query);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get inventory records',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取商品库存配置 (管理员及以上)
  fastify.get('/config/:productId', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['inventory'],
      summary: '获取商品库存配置',
      description: '获取指定商品的库存配置',
      params: {
        type: 'object',
        properties: {
          productId: { type: 'string' }
        },
        required: ['productId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            productId: { type: 'string' },
            minStock: { type: 'integer' },
            maxStock: { type: 'integer' },
            reorderPoint: { type: 'integer' },
            reorderQuantity: { type: 'integer' },
            leadTime: { type: 'integer' },
            autoReorder: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };

      const config = await InventoryService.getInventoryConfig(productId);

      if (!config) {
        return reply.status(404).send({
          error: 'Inventory config not found'
        });
      }

      return reply.send(config);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get inventory config',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 设置商品库存配置 (管理员及以上)
  fastify.put('/config/:productId', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['inventory'],
      summary: '设置商品库存配置',
      description: '设置或更新指定商品的库存配置',
      params: {
        type: 'object',
        properties: {
          productId: { type: 'string' }
        },
        required: ['productId']
      },
      body: {
        type: 'object',
        properties: {
          minStock: { type: 'integer', minimum: 0 },
          maxStock: { type: 'integer', minimum: 1 },
          reorderPoint: { type: 'integer', minimum: 0 },
          reorderQuantity: { type: 'integer', minimum: 1 },
          leadTime: { type: 'integer', minimum: 0 },
          autoReorder: { type: 'boolean' }
        },
        required: ['minStock', 'maxStock', 'reorderPoint', 'reorderQuantity']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            productId: { type: 'string' },
            minStock: { type: 'integer' },
            maxStock: { type: 'integer' },
            reorderPoint: { type: 'integer' },
            reorderQuantity: { type: 'integer' },
            leadTime: { type: 'integer' },
            autoReorder: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const config = request.body as any;

      // 验证最大库存大于最小库存
      if (config.maxStock <= config.minStock) {
        return reply.status(400).send({
          error: 'Max stock must be greater than min stock'
        });
      }

      const result = await InventoryService.setInventoryConfig(productId, config);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to set inventory config',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除库存缓存 (管理员及以上)
  fastify.delete('/cache', {
    preHandler: [authMiddleware, requirePermission(Resource.CACHE, Action.MANAGE)],
    schema: {
      tags: ['inventory'],
      summary: '清除库存缓存',
      description: '清除所有库存相关的缓存',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await InventoryService.clearInventoryCache();
      return reply.send({
        success: true,
        message: 'Inventory cache cleared successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
