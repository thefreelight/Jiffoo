/**
 * Admin Product Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminProductService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { UploadService } from '@/core/upload/service';
import { adminProductSchemas } from './schemas';

export async function adminProductRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin product routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // Get products list
  fastify.get('/', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get products list',
      description: 'Get paginated list of all products (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.listProducts,
    }
  }, async (request, reply) => {
    try {
      const { page, limit, ...filters } = request.query as any;
      const result = await AdminProductService.getProducts(page, limit, filters);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get global product stats
  fastify.get('/stats', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get product stats',
      description: 'Get global product statistics for admin products page',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.getProductStats,
    }
  }, async (_request, reply) => {
    try {
      const result = await AdminProductService.getProductStats();
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get single product
  fastify.get('/:id', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get product by ID',
      description: 'Get detailed product information (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.getProduct,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const product = await AdminProductService.getProductById(id);
      if (!product) {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      return sendSuccess(reply, product);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create product
  fastify.post('/', {
    schema: {
      tags: ['admin-products'],
      summary: 'Create product',
      description: 'Create a new product with variants (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.createProduct,
    }
  }, async (request, reply) => {
    try {
      const product = await AdminProductService.createProduct(request.body as any);
      return sendSuccess(reply, product, undefined, 201);
    } catch (error: any) {
      if (error.message.includes('variants') || error.message.includes('at least 1')) {
        return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update product
  fastify.put('/:id', {
    schema: {
      tags: ['admin-products'],
      summary: 'Update product',
      description: 'Update product information and variants (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.updateProduct,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const product = await AdminProductService.updateProduct(id, request.body as any);
      return sendSuccess(reply, product);
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'Product not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete product
  fastify.delete('/:id', {
    schema: {
      tags: ['admin-products'],
      summary: 'Delete product',
      description: 'Delete a product (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.deleteProduct,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await AdminProductService.deleteProduct(id);
      return sendSuccess(reply, {
        productId: id,
        deleted: true,
      }, 'Product deleted');
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'Product not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Upload product image
  fastify.post('/upload-image', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-products'],
      summary: 'Upload Product Image',
      description: 'Upload product image, supports JPEG, PNG, WebP formats, max 5MB',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      ...adminProductSchemas.uploadImage,
    }
  }, async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No file uploaded');
      }

      const result = await UploadService.uploadProductImage(data);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 400, 'UPLOAD_FAILED', error.message || 'Upload failed');
    }
  });

  // Get categories
  fastify.get('/categories', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get product categories',
      description: 'Get list of all product categories (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.getCategories,
    }
  }, async (request, reply) => {
    try {
      const { page, limit } = request.query as { page?: number; limit?: number };
      const categories = await AdminProductService.getCategories(page, limit);
      return sendSuccess(reply, categories);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

}
