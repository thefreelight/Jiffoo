import { FastifyInstance } from 'fastify';
import { ProductService } from './service';
import { CreateProductSchema, UpdateProductSchema } from './types';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';

export async function productRoutes(fastify: FastifyInstance) {
  // Get all products (public)
  fastify.get('/', {
    schema: {
      tags: ['products'],
      summary: 'Get products with search and filters',
      description: 'Get paginated products with search, category, price filters and sorting',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string' },
          category: { type: 'string' },
          minPrice: { type: 'number', minimum: 0 },
          maxPrice: { type: 'number', minimum: 0 },
          inStock: { type: 'boolean' },
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
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = request.query as any;

      const filters = {
        search,
        category,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock !== undefined ? Boolean(inStock) : undefined,
        sortBy,
        sortOrder,
      };

      const result = await ProductService.getAllProducts(
        Number(page),
        Number(limit),
        filters
      );
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get search suggestions (public)
  fastify.get('/search/suggestions', {
    schema: {
      tags: ['products'],
      summary: 'Get search suggestions',
      description: 'Get product name suggestions based on query',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2 },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { q, limit = 5 } = request.query as any;
      const suggestions = await ProductService.getSearchSuggestions(q, Number(limit));
      return reply.send({ suggestions });
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get categories (public)
  fastify.get('/categories', {
    schema: {
      tags: ['products'],
      summary: 'Get product categories',
      description: 'Get all available product categories with counts'
    }
  }, async (request, reply) => {
    try {
      const categories = await ProductService.getCategories();
      return reply.send({ categories });
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get price ranges (public)
  fastify.get('/price-ranges', {
    schema: {
      tags: ['products'],
      summary: 'Get price ranges',
      description: 'Get price range statistics for filtering'
    }
  }, async (request, reply) => {
    try {
      const priceRanges = await ProductService.getPriceRanges();
      return reply.send(priceRanges);
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get popular search terms (public)
  fastify.get('/search/popular', {
    schema: {
      tags: ['products'],
      summary: 'Get popular search terms',
      description: 'Get popular/trending search terms',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { limit = 10 } = request.query as any;
      const popularTerms = await ProductService.getPopularSearchTerms(Number(limit));
      return reply.send({ popularTerms });
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get product by ID (public)
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await ProductService.getProductById(id);

      if (!product) {
        return reply.status(404).send({
          error: 'Product not found'
        });
      }

      return reply.send({ product });
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create product (admin only)
  fastify.post('/', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const product = await ProductService.createProduct(request.body as any);
      return reply.status(201).send({ product });
    } catch (error) {
      return reply.status(400).send({
        error: 'Product creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update product (admin only)
  fastify.put('/:id', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await ProductService.updateProduct(id, request.body as any);
      return reply.send({ product });
    } catch (error) {
      return reply.status(400).send({
        error: 'Product update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete product (admin only)
  fastify.delete('/:id', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await ProductService.deleteProduct(id);
      return reply.status(204).send();
    } catch (error) {
      return reply.status(400).send({
        error: 'Product deletion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update product stock (admin only)
  fastify.patch('/:id/stock', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { quantity } = request.body as { quantity: number };

      const product = await ProductService.updateStock(id, quantity);
      return reply.send({ product });
    } catch (error) {
      return reply.status(400).send({
        error: 'Stock update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
