/**
 * Admin Product Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminProductService, CatalogConflictError } from './service';
import { sendSuccess, sendError } from '@/utils/response';
import { UploadService } from '@/core/upload/service';
import { adminProductSchemas } from './schemas';
import { isPrismaDatabaseError } from '@/utils/route-error-mapper';
import { sendKnownError } from '@/utils/api-errors';

export async function adminProductRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin product routes (before schema validation)

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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      if (isPrismaDatabaseError(error)) {
        request.log.error({ err: error }, 'Product creation database failure');
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Unable to create product');
      }
      if (error instanceof CatalogConflictError) return sendError(reply, 400, error.code, error.message);
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      if (error instanceof CatalogConflictError) return sendError(reply, 400, error.code, error.message);
      if (error.code === 'P2025' || error.message === 'Product not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      if (isPrismaDatabaseError(error)) {
        request.log.error({ err: error }, 'Product update database failure');
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Unable to update product');
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      if (error.code === 'P2025' || error.message === 'Product not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Upload product image
  fastify.post('/upload-image', {
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
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
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  fastify.get('/categories/:id', {
    schema: {
      tags: ['admin-products'], summary: 'Get category by ID',
      security: [{ bearerAuth: [] }], ...adminProductSchemas.getCategory,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await AdminProductService.getCategoryById(id);
    return category ? sendSuccess(reply, category) : sendError(reply, 404, 'NOT_FOUND', 'Category not found');
  });

  fastify.post('/categories', {
    schema: {
      tags: ['admin-products'], summary: 'Create category',
      security: [{ bearerAuth: [] }], ...adminProductSchemas.createCategory,
    },
  }, async (request, reply) => {
    try {
      const category = await AdminProductService.createCategory(request.body as any);
      return sendSuccess(reply, category, undefined, 201);
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      if (error instanceof CatalogConflictError) return sendError(reply, 400, error.code, error.message);
      throw error;
    }
  });

  fastify.put('/categories/:id', {
    schema: {
      tags: ['admin-products'], summary: 'Update category',
      security: [{ bearerAuth: [] }], ...adminProductSchemas.updateCategory,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const category = await AdminProductService.updateCategory(id, request.body as any);
      return sendSuccess(reply, category);
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      if (error instanceof CatalogConflictError) return sendError(reply, 400, error.code, error.message);
      throw error;
    }
  });

  fastify.delete('/categories/:id', {
    schema: {
      tags: ['admin-products'], summary: 'Delete category',
      security: [{ bearerAuth: [] }], ...adminProductSchemas.deleteCategory,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await AdminProductService.deleteCategory(id);
      return sendSuccess(reply, { categoryId: id, deleted: true });
    } catch (error) {
      const knownErrorResponse = sendKnownError(reply, error);
      if (knownErrorResponse) return knownErrorResponse;
      if (error instanceof CatalogConflictError) return sendError(reply, 409, error.code, error.message);
      throw error;
    }
  });

}
