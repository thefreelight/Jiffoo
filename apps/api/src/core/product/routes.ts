/**
 * Product Routes (Multi-Store Version)
 */

import { createHash } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { ProductService } from './service';
import { DEFAULT_LOCALE } from '@/utils/i18n';
import { sendSuccess, sendError } from '@/utils/response';
import { productSchemas } from './schemas';
import { CacheService } from '@/core/cache/service';
import { storeContextMiddleware } from '@/middleware/store-context';

function setHttpCache(reply: FastifyReply, data: any, maxAge: number, swr: number) {
  const etag = `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
  reply.header('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
  reply.header('ETag', etag);
  return etag;
}

export async function productRoutes(fastify: FastifyInstance) {
  // Apply store context middleware to all product routes
  fastify.addHook('onRequest', storeContextMiddleware);

  // Get products list
  fastify.get('/', {
    schema: {
      tags: ['products'],
      summary: 'Get products list',
      description: 'Get paginated list of products with optional filters and sorting',
      ...productSchemas.listProducts,
      response: {
        304: { type: 'null' },
        ...((productSchemas.listProducts as any).response || {}),
      },
    }
  }, async (request, reply) => {
    try {
      const { page, limit, locale, ...filters } = request.query as any;
      const result = await ProductService.getPublicProducts(
        page || 1,
        limit || 10,
        filters,
        locale || DEFAULT_LOCALE
      );
      const etag = setHttpCache(reply, result, 30, 60);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get categories
  fastify.get('/categories', {
    schema: {
      tags: ['products'],
      summary: 'Get product categories',
      description: 'Get list of all product categories',
      ...productSchemas.getCategories,
      response: {
        304: { type: 'null' },
        ...((productSchemas.getCategories as any).response || {}),
      },
    }
  }, async (request, reply) => {
    try {
      const { page, limit } = request.query as { page?: number; limit?: number };
      const categories = await ProductService.getCategories(page, limit);
      const etag = setHttpCache(reply, categories, 60, 120);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return sendSuccess(reply, categories);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Search products
  fastify.get('/search', {
    schema: {
      tags: ['products'],
      summary: 'Search products',
      description: 'Search products by keyword query',
      ...productSchemas.searchProducts,
      response: {
        304: { type: 'null' },
        ...((productSchemas.searchProducts as any).response || {}),
      },
    }
  }, async (request, reply) => {
    try {
      const { q, page, limit, locale } = request.query as any;
      const products = await ProductService.searchProducts(
        q,
        page || 1,
        limit || 10,
        locale || DEFAULT_LOCALE
      );
      const etag = setHttpCache(reply, products, 20, 40);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return sendSuccess(reply, products);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get product by ID (Must be last to avoid collision with static routes)
  fastify.get('/:id', {
    schema: {
      tags: ['products'],
      summary: 'Get product by ID',
      description: 'Get detailed information about a specific product',
      ...productSchemas.getProduct,
      response: {
        304: { type: 'null' },
        ...((productSchemas.getProduct as any).response || {}),
      },
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { locale } = request.query as any;
      const product = await ProductService.getProductById(id, locale || DEFAULT_LOCALE);
      if (!product) {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }
      const etag = setHttpCache(reply, product, 60, 120);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return sendSuccess(reply, product);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
