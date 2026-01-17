/**
 * Admin Product Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminProductService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';

export async function adminProductRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin product routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get products list
  fastify.get('/', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get products list',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' },
          category: { type: 'string' },
          minPrice: { type: 'number' },
          maxPrice: { type: 'number' },
          inStock: { type: 'boolean' },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await AdminProductService.getProducts(page, limit, filters);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get single product
  fastify.get('/:id', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get product by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const product = await AdminProductService.getProductById(id);
      if (!product) {
        return reply.code(404).send({ success: false, error: 'Product not found' });
      }
      return reply.send({ success: true, data: product });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Create product
  fastify.post('/', {
    schema: {
      tags: ['admin-products'],
      summary: 'Create product',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'price', 'stock'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          stock: { type: 'integer' },
          category: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const product = await AdminProductService.createProduct(request.body as any);
      return reply.code(201).send({ success: true, data: product });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Update product
  fastify.put('/:id', {
    schema: {
      tags: ['admin-products'],
      summary: 'Update product',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const product = await AdminProductService.updateProduct(id, request.body as any);
      return reply.send({ success: true, data: product });
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'Product not found') {
        return reply.code(404).send({ success: false, error: 'Product not found' });
      }
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Delete product
  fastify.delete('/:id', {
    schema: {
      tags: ['admin-products'],
      summary: 'Delete product',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await AdminProductService.deleteProduct(id);
      return reply.send({ success: true, message: 'Product deleted' });
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'Product not found') {
        return reply.code(404).send({ success: false, error: 'Product not found' });
      }
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get categories
  fastify.get('/categories', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get product categories',
      security: [{ bearerAuth: [] }]
    }
  }, async (_request, reply) => {
    try {
      const categories = await AdminProductService.getCategories();
      return reply.send({ success: true, data: categories });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
