/**
 * Product Routes (单商户版本)
 */

import { FastifyInstance } from 'fastify';
import { ProductService } from './service';
import { DEFAULT_LOCALE } from '@/utils/i18n';

export async function productRoutes(fastify: FastifyInstance) {
  // Get products list
  fastify.get('/', {
    schema: {
      tags: ['products'],
      summary: 'Get products list',
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
          sortOrder: { type: 'string' },
          locale: { type: 'string', default: 'en' }
        }
      }
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
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get product by ID
  fastify.get('/:id', {
    schema: {
      tags: ['products'],
      summary: 'Get product by ID',
      querystring: {
        type: 'object',
        properties: {
          locale: { type: 'string', default: 'en' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { locale } = request.query as any;
      const product = await ProductService.getProductById(id, locale || DEFAULT_LOCALE);
      if (!product) {
        return reply.code(404).send({ success: false, error: 'Product not found' });
      }
      return reply.send({ success: true, data: product });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Get categories
  fastify.get('/categories', {
    schema: {
      tags: ['products'],
      summary: 'Get product categories'
    }
  }, async (_request, reply) => {
    try {
      const categories = await ProductService.getCategories();
      return reply.send({ success: true, data: categories });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Search products
  fastify.get('/search', {
    schema: {
      tags: ['products'],
      summary: 'Search products',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string' },
          limit: { type: 'integer', default: 10 },
          locale: { type: 'string', default: 'en' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { q, limit, locale } = request.query as any;
      const products = await ProductService.searchProducts(
        q,
        limit || 10,
        locale || DEFAULT_LOCALE
      );
      return reply.send({ success: true, data: products });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
