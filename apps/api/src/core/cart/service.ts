import { CacheService } from '@/core/cache/service';
import { prisma } from '@/config/database';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
  maxQuantity: number;
  subtotal: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 购物车服务 (单商户版本)
 * 
 * 简化版本，移除了租户隔离逻辑。
 */
export class CartService {
  private static CART_CACHE_PREFIX = 'user_cart:';
  private static CART_CACHE_TTL = 86400 * 7; // 7天

  /**
   * 获取用户购物车
   */
  static async getCart(userId: string): Promise<Cart> {
    try {
      const cacheKey = this.buildCacheKey(userId);
      
      // 1. 先尝试从Redis缓存获取
      const cachedCart = await CacheService.get<string>(cacheKey);
      if (cachedCart) {
        return JSON.parse(cachedCart);
      }

      // 2. 从数据库获取
      const dbCart = await this.getCartFromDatabase(userId);
      
      if (dbCart) {
        await CacheService.set(cacheKey, JSON.stringify(dbCart), { ttl: this.CART_CACHE_TTL });
        return dbCart;
      }

      return this.createEmptyCart(userId);
    } catch (error) {
      console.error('Error getting cart:', error);
      return this.createEmptyCart(userId);
    }
  }

  /**
   * 添加商品到购物车
   */
  static async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    variantId?: string
  ): Promise<Cart> {
    try {
      // 获取或创建购物车
      let cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: true }
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId, status: 'ACTIVE' },
          include: { items: true }
        });
      }

      // 获取商品信息
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // 检查是否已存在该商品
      const existingItem = cart.items.find(
        item => item.productId === productId && item.variantId === variantId
      );

      if (existingItem) {
        // 更新数量
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity }
        });
      } else {
        // 添加新商品
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            variantId,
            quantity,
            price: product.price
          }
        });
      }

      // 清除缓存并返回更新后的购物车
      await this.invalidateCache(userId);
      return this.getCart(userId);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  /**
   * 更新购物车商品数量
   */
  static async updateCartItem(
    userId: string,
    itemId: string,
    quantity: number
  ): Promise<Cart> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: true }
      });

      if (!cart) {
        throw new Error('Cart not found');
      }

      const item = cart.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Cart item not found');
      }

      if (quantity <= 0) {
        await prisma.cartItem.delete({ where: { id: itemId } });
      } else {
        await prisma.cartItem.update({
          where: { id: itemId },
          data: { quantity }
        });
      }

      await this.invalidateCache(userId);
      return this.getCart(userId);
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  /**
   * 从购物车移除商品
   */
  static async removeFromCart(userId: string, itemId: string): Promise<Cart> {
    try {
      await prisma.cartItem.delete({ where: { id: itemId } });
      await this.invalidateCache(userId);
      return this.getCart(userId);
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  /**
   * 清空购物车
   */
  static async clearCart(userId: string): Promise<Cart> {
    try {
      const cart = await prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      await this.invalidateCache(userId);
      return this.createEmptyCart(userId);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private static buildCacheKey(userId: string): string {
    return `${this.CART_CACHE_PREFIX}${userId}`;
  }

  private static async invalidateCache(userId: string): Promise<void> {
    const cacheKey = this.buildCacheKey(userId);
    await CacheService.delete(cacheKey);
  }

  private static async getCartFromDatabase(userId: string): Promise<Cart | null> {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    });

    if (!cart) return null;

    const items: CartItem[] = cart.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || 'Unknown Product',
      productImage: item.product?.images ? JSON.parse(item.product.images as string)[0] : '',
      price: Number(item.price),
      quantity: item.quantity,
      variantId: item.variantId || undefined,
      variantName: item.variant?.name || undefined,
      maxQuantity: item.product?.stock || 0,
      subtotal: Number(item.price) * item.quantity
    }));

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      subtotal,
      tax: 0,
      shipping: 0,
      total: subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      status: cart.status,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt
    };
  }

  private static createEmptyCart(userId: string): Cart {
    return {
      id: '',
      userId,
      items: [],
      total: 0,
      itemCount: 0,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}
