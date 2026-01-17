/**
 * Cart Routes
 */

import { FastifyInstance } from 'fastify';
import { CartService } from './service';
import { authMiddleware } from '@/core/auth/middleware';

export async function cartRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all cart routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Get cart
  fastify.get('/', {
    schema: {
      tags: ['cart'],
      summary: 'Get user cart',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const cart = await CartService.getCart(request.user!.id);
      return reply.send({ success: true, data: cart });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Add to cart
  fastify.post('/items', {
    schema: {
      tags: ['cart'],
      summary: 'Add item to cart',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', default: 1 },
          variantId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId, quantity, variantId } = request.body as any;
      const cart = await CartService.addToCart(
        request.user!.id,
        productId,
        quantity,
        variantId
      );
      return reply.send({ success: true, data: cart });
    } catch (error: any) {
      const message = error.message;
      if (message === 'Product or variant not found') {
        return reply.code(404).send({ success: false, error: message });
      }
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Update cart item
  fastify.put('/items/:itemId', {
    schema: {
      tags: ['cart'],
      summary: 'Update cart item quantity',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { itemId } = request.params as any;
      const { quantity } = request.body as any;
      const cart = await CartService.updateCartItem(
        request.user!.id,
        itemId,
        quantity
      );
      return reply.send({ success: true, data: cart });
    } catch (error: any) {
      const message = error.message;
      if (message === 'Cart not found' || message === 'Cart item not found') {
        return reply.code(404).send({ success: false, error: message });
      }
      return reply.code(500).send({ success: false, error: message });
    }
  });

  // Remove from cart
  fastify.delete('/items/:itemId', {
    schema: {
      tags: ['cart'],
      summary: 'Remove item from cart',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { itemId } = request.params as any;
      const cart = await CartService.removeFromCart(request.user!.id, itemId);
      return reply.send({ success: true, data: cart });
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'Cart item not found') {
        return reply.code(404).send({ success: false, error: 'Cart item not found' });
      }
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Clear cart
  fastify.delete('/', {
    schema: {
      tags: ['cart'],
      summary: 'Clear cart',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const cart = await CartService.clearCart(request.user!.id);
      return reply.send({ success: true, data: cart });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
