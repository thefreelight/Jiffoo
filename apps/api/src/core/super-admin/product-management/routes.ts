import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, superAdminMiddleware } from '@/core/auth/middleware';
import { SuperAdminProductService } from './service';
import {
  CreateProductSchema,
  UpdateProductSchema,
  BatchProductOperationSchema,
  GetProductsRequest,
  CreateProductRequest,
  UpdateProductRequest,
  BatchProductOperationRequest
} from './types';

export async function superAdminProductRoutes(fastify: FastifyInstance) {
  // 应用中间件到所有路由
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', superAdminMiddleware);

  /**
   * 获取产品统计信息（超级管理员）- 跨租户统计
   */
  fastify.get('/stats', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Get product statistics (super admin)',
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await SuperAdminProductService.getProductStats();
      reply.code(200).send(stats);
    } catch (error) {
      console.error('Get product stats error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get product statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取所有产品列表（超级管理员）- 跨租户
   */
  fastify.get('/', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Get all products (super admin)',
      querystring: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as GetProductsRequest;
      const result = await SuperAdminProductService.getAllProducts(query);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Get all products error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get products',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取产品详情（超级管理员）
   */
  fastify.get('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Get product by ID (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        404: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await SuperAdminProductService.getProductById(id);

      if (!product) {
        return reply.code(404).send({
          success: false,
          message: 'Product not found'
        });
      }

      reply.code(200).send({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Get product by ID error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 创建产品（超级管理员）
   */
  fastify.post('/', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Create product (super admin)',
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        201: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证请求体
      const validationResult = CreateProductSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }

      const productData: CreateProductRequest = validationResult.data;
      const newProduct = await SuperAdminProductService.createProduct(productData);

      reply.code(201).send({
        success: true,
        data: newProduct,
        message: 'Product created successfully'
      });
    } catch (error) {
      console.error('Create product error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to create product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 更新产品信息（超级管理员）
   */
  fastify.put('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Update product (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // 验证请求体
      const validationResult = UpdateProductSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }

      const updateData: UpdateProductRequest = validationResult.data;
      const updatedProduct = await SuperAdminProductService.updateProduct(id, updateData);

      reply.code(200).send({
        success: true,
        data: updatedProduct,
        message: 'Product updated successfully'
      });
    } catch (error) {
      console.error('Update product error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to update product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 批量操作产品（超级管理员）
   */
  fastify.post('/batch', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Batch operate products (super admin)',
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证请求体
      const validationResult = BatchProductOperationSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }

      const batchData: BatchProductOperationRequest = validationResult.data;
      const result = await SuperAdminProductService.batchOperation(batchData);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Batch operation error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to perform batch operation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 删除产品（超级管理员）
   */
  fastify.delete('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-products'],
      summary: 'Delete product (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      await SuperAdminProductService.deleteProduct(id);

      reply.code(200).send({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Delete product error:', error);

      if (error instanceof Error && error.message.includes('existing orders')) {
        return reply.code(400).send({
          success: false,
          message: 'Cannot delete product with existing orders'
        });
      }

      reply.code(500).send({
        success: false,
        message: 'Failed to delete product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
