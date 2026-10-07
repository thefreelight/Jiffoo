import { sendMappedError } from '@/utils/api-errors';
/**
 * Cart Routes
 */

import { FastifyInstance } from 'fastify';
import { CartService, InsufficientCartStockError } from './service';
import { dualAuthMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { cartSchemas } from './schemas';
import { sendKnownError } from '@/utils/api-errors';

export async function cartRoutes(fastify: FastifyInstance) {
  // Apply dual auth (JWT or API token with cart:write scope)
  fastify.addHook('onRequest', dualAuthMiddleware('cart:write'));

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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
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
    } catch (error) { return sendMappedError(reply, error); }
  });

}
