import { FastifyInstance } from 'fastify';
import { CartService } from './service';

export async function cartRoutes(fastify: FastifyInstance) {
  // Get cart
  fastify.get('/', {
    schema: {
      tags: ['cart'],
      summary: 'Get shopping cart',
      description: 'Get the current shopping cart contents',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      productId: { type: 'string' },
                      productName: { type: 'string' },
                      productImage: { type: 'string' },
                      price: { type: 'number' },
                      quantity: { type: 'integer' },
                      variantId: { type: 'string' },
                      variantName: { type: 'string' },
                      maxQuantity: { type: 'integer' }
                    }
                  }
                },
                total: { type: 'number' },
                itemCount: { type: 'integer' },
                subtotal: { type: 'number' },
                tax: { type: 'number' },
                shipping: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Get user ID from session/auth (for now use guest)
      const userId = (request as any).user?.id;
      
      const cart = await CartService.getCart(userId);
      
      return reply.send({
        success: true,
        data: cart
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add to cart
  fastify.post('/add', {
    schema: {
      tags: ['cart'],
      summary: 'Add item to cart',
      description: 'Add a product to the shopping cart',
      body: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          variantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array' },
                total: { type: 'number' },
                itemCount: { type: 'integer' },
                subtotal: { type: 'number' },
                tax: { type: 'number' },
                shipping: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId, quantity, variantId } = request.body as any;
      const userId = (request as any).user?.id;
      
      const cart = await CartService.addToCart(productId, quantity, variantId, userId);
      
      return reply.send({
        success: true,
        data: cart
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to add to cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update cart item
  fastify.put('/update', {
    schema: {
      tags: ['cart'],
      summary: 'Update cart item',
      description: 'Update the quantity of an item in the cart',
      body: {
        type: 'object',
        required: ['itemId', 'quantity'],
        properties: {
          itemId: { type: 'string' },
          quantity: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { itemId, quantity } = request.body as any;
      const userId = (request as any).user?.id;
      
      const cart = await CartService.updateCartItem(itemId, quantity, userId);
      
      return reply.send({
        success: true,
        data: cart
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update cart item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Remove from cart
  fastify.delete('/remove/:itemId', {
    schema: {
      tags: ['cart'],
      summary: 'Remove item from cart',
      description: 'Remove an item from the shopping cart',
      params: {
        type: 'object',
        required: ['itemId'],
        properties: {
          itemId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { itemId } = request.params as any;
      const userId = (request as any).user?.id;
      
      const cart = await CartService.removeFromCart(itemId, userId);
      
      return reply.send({
        success: true,
        data: cart
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to remove from cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clear cart
  fastify.delete('/clear', {
    schema: {
      tags: ['cart'],
      summary: 'Clear cart',
      description: 'Remove all items from the shopping cart'
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id;
      
      await CartService.clearCart(userId);
      
      return reply.send({
        success: true,
        message: 'Cart cleared successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to clear cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
