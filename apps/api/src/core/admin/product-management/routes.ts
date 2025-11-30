import { FastifyInstance } from 'fastify';
import { AdminProductService } from './service';
import { authMiddleware, tenantMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { withTenantContext } from '@/core/database/tenant-middleware';
import { LOCALES } from '@/utils/i18n';


/**
 * 管理员商品管理API路由
 * 面向管理员的商品管理功能
 */
export async function adminProductRoutes(fastify: FastifyInstance) {

  /**
   * 获取商品统计信息
   * GET /api/admin/products/stats
   */
  fastify.get('/stats', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Get Product Statistics',
      description: 'Get product statistics within tenant',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalProducts: { type: 'integer' },
                inStockProducts: { type: 'integer' },
                outOfStockProducts: { type: 'integer' },
                categoryDistribution: {
                  type: 'object',
                  additionalProperties: { type: 'integer' }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;
      const stats = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.getProductStats(tenantId.toString())
      );

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch product statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取商品列表（管理员专用）
   * GET /api/admin/products
   */
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Get Product List',
      description: 'Get all products within tenant with search and pagination support',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string', description: 'Search product name or description' },
          category: { type: 'string', description: 'Filter by category' },
          minPrice: { type: 'number', description: 'Minimum price' },
          maxPrice: { type: 'number', description: 'Maximum price' },
          inStock: { type: 'boolean', description: 'Whether in stock' },
          lowStock: { type: 'boolean', description: 'Whether low stock products' },
          lowStockThreshold: { type: 'integer', minimum: 1, default: 10, description: 'Low stock threshold' },
          sortBy: { type: 'string', enum: ['name', 'price', 'createdAt', 'stock'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        category,
        minPrice,
        maxPrice,
        inStock,
        lowStock,
        lowStockThreshold = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = request.query as any;

      const filters = {
        search,
        category,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock !== undefined ? Boolean(inStock) : undefined,
        lowStock: lowStock !== undefined ? Boolean(lowStock) : undefined,
        lowStockThreshold: Number(lowStockThreshold),
        sortBy,
        sortOrder,
      };

      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;
      const result = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.getProducts(Number(page), Number(limit), filters, tenantId)
      );

      return reply.send({
        success: true,
        data: result.products,
        pagination: result.pagination
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * 获取低库存商品
   * GET /api/admin/products/stock/low
   */
  fastify.get('/stock/low', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Get Low Stock Products',
      description: 'Get products with stock below threshold',
      querystring: {
        type: 'object',
        properties: {
          threshold: { type: 'integer', minimum: 1, default: 10, description: 'Low stock threshold' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { threshold = 10, page = 1, limit = 10 } = request.query as any;
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;

      const result = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.getLowStockProducts(
          tenantId,
          Number(threshold),
          Number(page),
          Number(limit)
        )
      );

      return reply.send({
        success: true,
        data: result.products,
        pagination: result.pagination,
        threshold: result.threshold
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get low stock products'
      });
    }
  });

  /**
   * 获取库存总览
   * GET /api/admin/products/stock/overview
   */
  fastify.get('/stock/overview', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Get Stock Overview',
      description: 'Get stock statistics and warnings',
      querystring: {
        type: 'object',
        properties: {
          lowStockThreshold: { type: 'integer', minimum: 1, default: 10, description: 'Low stock threshold' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { lowStockThreshold = 10 } = request.query as any;
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;

      const result = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.getStockOverview(tenantId, Number(lowStockThreshold))
      );

      return reply.send({
        success: true,
        data: result
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get stock overview'
      });
    }
  });

  /**
   * 库存调整
   * POST /api/admin/products/:id/stock/adjust
   */
  fastify.post('/:id/stock/adjust', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Adjust Product Stock',
      description: 'Increase or decrease product stock',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['operation', 'quantity', 'reason'],
        properties: {
          operation: {
            type: 'string',
            enum: ['increase', 'decrease'],
            description: 'Operation type: increase-add stock, decrease-reduce stock'
          },
          quantity: { type: 'number', minimum: 1, description: 'Adjustment quantity' },
          reason: { type: 'string', description: 'Adjustment reason' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { operation, quantity, reason } = request.body as any;
      const user = (request as any).user!;
      const tenantId = user.tenantId;
      const userId = user.id;

      const result = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.adjustStock(
          id,
          operation,
          quantity,
          reason,
          user.userId,
          tenantId
        )
      );

      return reply.send({
        success: true,
        data: result,
        message: `Stock ${operation} completed successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Stock adjustment failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取商品详情（管理员专用）
   * GET /api/admin/products/:id
   */
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Get Product Details',
      description: 'Get complete product management information',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;
      const product = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.getProductById(id, tenantId)
      );

      if (!product) {
        return reply.status(404).send({
          success: false,
          error: 'Product not found'
        });
      }

      return reply.send({
        success: true,
        data: product
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * 创建商品
   * POST /api/admin/products
   */
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Create Product',
      description: 'Create new product',
      body: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          price: { type: 'number', minimum: 0.01 },
          stock: { type: 'integer', minimum: 0, default: 0 },
          category: { type: 'string' },
          images: { type: 'string', default: '' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;
      const product = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.createProduct(request.body as any, tenantId)
      );

      return reply.status(201).send({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch {
      return reply.status(400).send({
        success: false,
        error: 'Product creation failed'
      });
    }
  });

  /**
   * 更新商品
   * PUT /api/admin/products/:id
   */
  fastify.put('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Update Product',
      description: 'Update product information',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          price: { type: 'number', minimum: 0.01 },
          stock: { type: 'integer', minimum: 0 },
          category: { type: 'string' },
          images: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;
      const product = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.updateProduct(id, request.body as any, tenantId)
      );

      return reply.send({
        success: true,
        data: product,
        message: 'Product updated successfully'
      });
    } catch {
      return reply.status(400).send({
        success: false,
        error: 'Product update failed'
      });
    }
  });

  /**
   * 删除商品
   * DELETE /api/admin/products/:id
   */
  fastify.delete('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Delete Product',
      description: 'Delete product',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;
      await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.deleteProduct(id, tenantId)
      );

      return reply.send({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch {
      return reply.status(400).send({
        success: false,
        error: 'Product deletion failed'
      });
    }
  });

  /**
   * 批量操作商品
   * POST /api/admin/products/batch
   */
  fastify.post('/batch', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Batch Product Operations',
      description: 'Batch delete or update product stock',
      body: {
        type: 'object',
        required: ['action', 'productIds'],
        properties: {
          action: {
            type: 'string',
            enum: ['delete', 'updateStock', 'increaseStock', 'decreaseStock'],
            description: 'Operation type: delete-delete, updateStock-set stock, increaseStock-add stock, decreaseStock-reduce stock'
          },
          productIds: { type: 'array', items: { type: 'string' } },
          stockQuantity: { type: 'number', description: 'Stock quantity (required for stock operations)' },
          reason: { type: 'string', description: 'Operation reason' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { action, productIds, stockQuantity, reason } = request.body as any;
      const user = (request as any).user!;
      const tenantId = user.tenantId;
      const userId = user.id;

      const result = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.batchOperation(
          action,
          productIds,
          tenantId,
          stockQuantity,
          reason,
          user.userId
        )
      );

      return reply.send({
        success: true,
        data: result,
        message: `Batch ${action} completed successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Batch operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== Product Translation Management ====================

  /**
   * 获取商品翻译列表
   * GET /api/admin/products/:id/translations
   */
  fastify.get('/:id/translations', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Get Product Translations',
      description: 'Get all translations for a product',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;

      const translations = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.getProductTranslations(id, tenantId)
      );

      return reply.send({
        success: true,
        data: translations,
        supportedLocales: LOCALES
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to get translations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 创建或更新商品翻译
   * PUT /api/admin/products/:id/translations/:locale
   */
  fastify.put('/:id/translations/:locale', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Create or Update Product Translation',
      description: 'Create or update translation for a specific locale',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          locale: { type: 'string', enum: ['en', 'zh-Hant'] }
        },
        required: ['id', 'locale']
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200, description: 'Translated product name' },
          description: { type: 'string', description: 'Translated product description' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id, locale } = request.params as { id: string; locale: string };
      const { name, description } = request.body as { name: string; description?: string };
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;

      const translation = await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.upsertProductTranslation(id, locale, { name, description }, tenantId)
      );

      return reply.send({
        success: true,
        data: translation,
        message: 'Translation saved successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to save translation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 删除商品翻译
   * DELETE /api/admin/products/:id/translations/:locale
   */
  fastify.delete('/:id/translations/:locale', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-products'],
      summary: 'Delete Product Translation',
      description: 'Delete translation for a specific locale',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          locale: { type: 'string', enum: ['en', 'zh-Hant'] }
        },
        required: ['id', 'locale']
      }
    }
  }, async (request, reply) => {
    try {
      const { id, locale } = request.params as { id: string; locale: string };
      const tenantId = (request as any).user!.tenantId;
      const userId = (request as any).user!.id;

      await withTenantContext(
        tenantId,
        userId,
        () => AdminProductService.deleteProductTranslation(id, locale, tenantId)
      );

      return reply.send({
        success: true,
        message: 'Translation deleted successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to delete translation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

}
