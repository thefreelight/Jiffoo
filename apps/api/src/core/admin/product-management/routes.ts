/**
 * Admin Product Routes
 */

import { FastifyInstance } from 'fastify';
import { AdminProductService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { storeContextMiddleware } from '@/middleware/store-context';
import { sendSuccess, sendError } from '@/utils/response';
import { UploadService } from '@/core/upload/service';
import { adminProductSchemas } from './schemas';

export async function adminProductRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin product routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);
  fastify.addHook('onRequest', storeContextMiddleware);

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
      const storeId = request.storeContext?.id;
      const result = await AdminProductService.getProducts(page, limit, filters, storeId);
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
  fastify.get('/:id/external-source', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get product external source details',
      description: 'Get external source snapshot and pending change details for a product (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.getExternalSource,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const details = await AdminProductService.getExternalSourceByProductId(id);
      if (!details) {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      return sendSuccess(reply, details);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  fastify.post('/:id/ack-source-change', {
    schema: {
      tags: ['admin-products'],
      summary: 'Acknowledge pending external source changes',
      description: 'Clear pending external source change markers for a product and its variants (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.acknowledgeExternalSource,
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await AdminProductService.acknowledgeExternalSourceChanges(id);
      if (!result) {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  fastify.post('/:id/variants/:variantId/ack-source-change', {
    schema: {
      tags: ['admin-products'],
      summary: 'Acknowledge pending external source changes for a single variant',
      description: 'Clear pending external source change markers for a single product variant (admin only)',
      security: [{ bearerAuth: [] }],
      ...adminProductSchemas.acknowledgeExternalSourceVariant,
    }
  }, async (request, reply) => {
    try {
      const { id, variantId } = request.params as any;
      const result = await AdminProductService.acknowledgeExternalSourceVariantChange(id, variantId);
      if (!result) {
        return sendError(reply, 404, 'NOT_FOUND', 'Variant not found');
      }
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
      const storeId = request.storeContext?.id;
      if (!storeId) {
        return sendError(reply, 400, 'STORE_REQUIRED', 'Store context is required');
      }
      const product = await AdminProductService.createProduct(request.body as any, storeId);
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

  // Set currency-specific price for variant
  fastify.post('/:id/variants/:variantId/prices', {
    schema: {
      tags: ['admin-products'],
      summary: 'Set currency-specific price for variant',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'variantId'],
        properties: {
          id: { type: 'string' },
          variantId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['currency', 'price'],
        properties: {
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          price: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id, variantId } = request.params as any;
      const { currency, price } = request.body as any;
      const result = await AdminProductService.setCurrencyPrice(id, variantId, currency, price);
      return sendSuccess(reply, result, 'Currency price set successfully', 201);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get all currency prices for variant
  fastify.get('/:id/variants/:variantId/prices', {
    schema: {
      tags: ['admin-products'],
      summary: 'Get currency-specific prices for variant',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id', 'variantId'],
        properties: {
          id: { type: 'string' },
          variantId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id, variantId } = request.params as any;
      const prices = await AdminProductService.getVariantCurrencyPrices(id, variantId);
      return sendSuccess(reply, { items: prices, total: prices.length });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
