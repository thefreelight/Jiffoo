/**
 * Cart Routes (Multi-Store Version)
 */

import { FastifyInstance } from 'fastify';
import { CartService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { storeContextMiddleware } from '@/middleware/store-context';
import { sendSuccess, sendError } from '@/utils/response';
import { cartSchemas } from './schemas';

export async function cartRoutes(fastify: FastifyInstance) {
  // Apply auth and store context middleware to all cart routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', storeContextMiddleware);

  // Get cart
  fastify.get('/', {
    schema: {
      tags: ['cart'],
      summary: 'Get user cart',
      description: 'Retrieve current user shopping cart with all items',
      security: [{ bearerAuth: [] }],
      ...cartSchemas.getCart,
    }
  }, async (request, reply) => {
    try {
      const cart = await CartService.getCart(request.user!.id);
      return sendSuccess(reply, cart);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Add to cart
  fastify.post('/items', {
    schema: {
      tags: ['cart'],
      summary: 'Add item to cart',
      description: 'Add a product variant to the user cart',
      security: [{ bearerAuth: [] }],
      ...cartSchemas.addToCart,
    }
  }, async (request, reply) => {
    try {
      const { productId, quantity, variantId, fulfillmentData } = request.body as any;
      const cart = await CartService.addToCart(
        request.user!.id,
        productId,
        quantity,
        variantId,
        fulfillmentData
      );
      return sendSuccess(reply, cart);
    } catch (error: any) {
      const message = error.message;
      if (message === 'Product or variant not found') {
        return sendError(reply, 404, 'NOT_FOUND', message);
      }
      if (message === 'Product is not available' || message === 'Product is no longer available from source') {
        return sendError(reply, 400, 'BAD_REQUEST', message);
      }
      if (message === 'Supplier product requires cardUid' || message === 'Supplier card product requires shippingAddress') {
        return sendError(reply, 400, 'BAD_REQUEST', message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

  // Batch add to cart
  fastify.post('/items/batch', {
    schema: {
      tags: ['cart'],
      summary: 'Batch add items to cart',
      description: 'Add multiple products (with optional variants) to the user cart in a single request',
      security: [{ bearerAuth: [] }],
      ...cartSchemas.batchAddToCart,
    }
  }, async (request, reply) => {
    try {
      const { items } = request.body as any;
      const cart = await (CartService as any).batchAddToCart(request.user!.id, items);
      return sendSuccess(reply, cart);
    } catch (error: any) {
      const message = error.message;
      if (message.includes('Product or variant not found')) {
        return sendError(reply, 404, 'NOT_FOUND', message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

  // Update cart item
  fastify.put('/items/:itemId', {
    schema: {
      tags: ['cart'],
      summary: 'Update cart item quantity',
      description: 'Update the quantity of a specific cart item',
      security: [{ bearerAuth: [] }],
      ...cartSchemas.updateCartItem,
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
      return sendSuccess(reply, cart);
    } catch (error: any) {
      const message = error.message;
      if (message === 'Cart not found' || message === 'Cart item not found') {
        return sendError(reply, 404, 'NOT_FOUND', message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

  // Remove from cart
  fastify.delete('/items/:itemId', {
    schema: {
      tags: ['cart'],
      summary: 'Remove item from cart',
      description: 'Remove a specific item from the user cart',
      security: [{ bearerAuth: [] }],
      ...cartSchemas.removeFromCart,
    }
  }, async (request, reply) => {
    try {
      const { itemId } = request.params as any;
      const cart = await CartService.removeFromCart(request.user!.id, itemId);
      return sendSuccess(reply, cart);
    } catch (error: any) {
      if (error.code === 'P2025' || error.message === 'Cart item not found') {
        return sendError(reply, 404, 'NOT_FOUND', 'Cart item not found');
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Clear cart
  fastify.delete('/', {
    schema: {
      tags: ['cart'],
      summary: 'Clear cart',
      description: 'Remove all items from the user cart',
      security: [{ bearerAuth: [] }],
      ...cartSchemas.clearCart,
    }
  }, async (request, reply) => {
    try {
      const cart = await CartService.clearCart(request.user!.id);
      return sendSuccess(reply, cart);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Apply discount code
  fastify.post('/apply-discount', {
    schema: {
      tags: ['cart'],
      summary: 'Apply discount code to cart',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { code } = request.body as any;
      const cart = await (CartService as any).applyDiscount(request.user!.id, code);
      return sendSuccess(reply, cart);
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  // Remove discount code
  fastify.delete('/discount/:code', {
    schema: {
      tags: ['cart'],
      summary: 'Remove discount code from cart',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { code } = request.params as any;
      const cart = await (CartService as any).removeDiscount(request.user!.id, code);
      return sendSuccess(reply, cart);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
