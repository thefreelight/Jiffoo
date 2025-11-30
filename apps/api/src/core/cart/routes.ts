import { FastifyInstance } from 'fastify';
import { authMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { CartService } from './service';
import { withTenantContext } from '@/core/database/tenant-middleware';

/**
 * 购物车路由 - 仅支持登录用户
 * 
 * 特点：
 * - 所有接口都需要登录认证
 * - 简化的购物车逻辑
 * - 数据库+Redis混合存储
 */
export async function cartRoutes(fastify: FastifyInstance) {
  // 获取购物车 - 需要登录
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['cart'],
      summary: 'Get user cart',
      description: 'Get the current user\'s shopping cart (login required)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
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
                      maxQuantity: { type: 'integer' },
                      subtotal: { type: 'number' }
                    }
                  }
                },
                total: { type: 'number' },
                itemCount: { type: 'integer' },
                subtotal: { type: 'number' },
                tax: { type: 'number' },
                shipping: { type: 'number' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const tenantId = (request as any).user.tenantId.toString();

      const cart = await withTenantContext(parseInt(tenantId), userId, async () => {
        return await CartService.getCart(userId, tenantId);
      });
      
      return reply.send({
        success: true,
        data: cart
      });
    } catch (error) {
      return (reply as any).status(500).send({
        success: false,
        error: 'Failed to get cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 添加商品到购物车 - 需要登录
  fastify.post('/add', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['cart'],
      summary: 'Add item to cart',
      description: 'Add a product to the shopping cart (login required)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          variantId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId, quantity, variantId } = request.body as any;
      const userId = (request as any).user.id;
      const tenantId = (request as any).user.tenantId.toString();

      const cart = await withTenantContext(parseInt(tenantId), userId, async () => {
        return await CartService.addToCart(
          userId,
          productId,
          quantity,
          tenantId,
          variantId
        );
      });
      
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

  // 更新购物车商品数量 - 需要登录
  fastify.put('/update', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['cart'],
      summary: 'Update cart item',
      description: 'Update the quantity of an item in the cart (login required)',
      security: [{ bearerAuth: [] }],
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
      const userId = (request as any).user.id;
      const tenantId = (request as any).user.tenantId.toString();

      const cart = await withTenantContext(parseInt(tenantId), userId, async () => {
        return await CartService.updateCartItem(
          userId,
          itemId,
          quantity,
          tenantId
        );
      });
      
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

  // 从购物车移除商品 - 需要登录
  fastify.delete('/remove/:itemId', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['cart'],
      summary: 'Remove item from cart',
      description: 'Remove an item from the shopping cart (login required)',
      security: [{ bearerAuth: [] }],
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
      const userId = (request as any).user.id;
      const tenantId = (request as any).user.tenantId.toString();

      const cart = await withTenantContext(parseInt(tenantId), userId, async () => {
        return await CartService.removeFromCart(userId, itemId, tenantId);
      });
      
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

  // 清空购物车 - 需要登录
  fastify.delete('/clear', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['cart'],
      summary: 'Clear cart',
      description: 'Remove all items from the shopping cart (login required)',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const tenantId = (request as any).user.tenantId.toString();

      await withTenantContext(parseInt(tenantId), userId, async () => {
        return await CartService.clearCart(userId, tenantId);
      });
      
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

  // 获取购物车统计信息 - 管理员功能
  fastify.get('/stats', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['cart'],
      summary: 'Get cart statistics',
      description: 'Get cart statistics for the current tenant (admin only)',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId.toString();
      const stats = await withTenantContext(parseInt(tenantId), (request as any).user.id, async () => {
        return await CartService.getCartStats(tenantId);
      });
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cart stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
