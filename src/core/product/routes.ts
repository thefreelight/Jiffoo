import { FastifyInstance } from 'fastify';
import { ProductService } from './service';
import { CreateProductSchema, UpdateProductSchema } from './types';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';

export async function productRoutes(fastify: FastifyInstance) {
  // Get all products (public)
  fastify.get('/', async (request, reply) => {
    try {
      const { page = 1, limit = 10, search } = request.query as any;
      const result = await ProductService.getAllProducts(
        Number(page),
        Number(limit),
        search
      );
      return reply.send(result);
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
    schema: {
      body: CreateProductSchema
    },
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
    schema: {
      body: UpdateProductSchema
    },
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
    schema: {
      body: {
        type: 'object',
        properties: {
          quantity: { type: 'number' }
        },
        required: ['quantity']
      }
    },
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
