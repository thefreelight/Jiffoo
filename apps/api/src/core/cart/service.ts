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
 * 购物车服务 - 仅支持登录用户
 * 
 * 特点：
 * - 只支持登录用户，简化逻辑
 * - 数据库+Redis混合存储
 * - 跨设备同步
 * - 多租户隔离
 * - 高性能缓存
 */
export class CartService {
  private static CART_CACHE_PREFIX = 'user_cart:';
  private static CART_CACHE_TTL = 86400 * 7; // 7天

  /**
   * 获取用户购物车
   */
  static async getCart(userId: string, tenantId: string): Promise<Cart> {
    try {
      const cacheKey = this.buildCacheKey(userId, tenantId);
      
      // 1. 先尝试从Redis缓存获取
      const cachedCart = await CacheService.get<string>(cacheKey);
      if (cachedCart) {
        return JSON.parse(cachedCart);
      }

      // 2. 从数据库获取
      const dbCart = await this.getCartFromDatabase(userId, tenantId);
      
      if (dbCart) {
        // 3. 写入缓存
        await CacheService.set(cacheKey, JSON.stringify(dbCart), { ttl: this.CART_CACHE_TTL });
        return dbCart;
      }

      // 4. 返回空购物车
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
    quantity: number,
    tenantId: string,
    variantId?: string
  ): Promise<Cart> {
    try {
      // 1. 验证商品存在性和库存
      const product = await this.validateProduct(productId, tenantId);
      
      // 2. 获取或创建购物车
      let cart = await this.getOrCreateCart(userId, tenantId);
      
      // 3. 检查商品是否已存在
      const existingItemIndex = cart.items.findIndex(
        item => item.productId === productId && item.variantId === variantId
      );

      if (existingItemIndex >= 0) {
        // 更新数量
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        if (newQuantity > product.stock) {
          throw new Error('库存不足');
        }
        
        await this.updateCartItemInDatabase(
          cart.items[existingItemIndex].id,
          newQuantity
        );
        
        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].subtotal = newQuantity * cart.items[existingItemIndex].price;
      } else {
        // 添加新商品
        if (quantity > product.stock) {
          throw new Error('库存不足');
        }
        
        const newCartItem = await this.addCartItemToDatabase(
          cart.id,
          productId,
          quantity,
          product.price,
          tenantId,
          variantId
        );
        
        const cartItem: CartItem = {
          id: newCartItem.id,
          productId,
          productName: product.name,
          productImage: product.images || '',
          price: product.price,
          quantity,
          variantId,
          variantName: variantId ? `变体 ${variantId}` : undefined,
          maxQuantity: product.stock,
          subtotal: quantity * product.price,
        };
        
        cart.items.push(cartItem);
      }

      // 4. 重新计算总价
      cart = this.calculateCartTotals(cart);
      
      // 5. 更新缓存
      await this.updateCartCache(cart, userId, tenantId);
      
      return cart;
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
    quantity: number,
    tenantId: string
  ): Promise<Cart> {
    try {
      if (quantity <= 0) {
        return this.removeFromCart(userId, itemId, tenantId);
      }

      // 1. 获取购物车
      const cart = await this.getCart(userId, tenantId);
      
      // 2. 查找商品项
      const itemIndex = cart.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        throw new Error('购物车中未找到该商品');
      }

      // 3. 验证库存
      if (quantity > cart.items[itemIndex].maxQuantity) {
        throw new Error('库存不足');
      }

      // 4. 更新数据库
      await this.updateCartItemInDatabase(itemId, quantity);
      
      // 5. 更新内存中的数据
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].subtotal = quantity * cart.items[itemIndex].price;
      
      // 6. 重新计算总价
      const updatedCart = this.calculateCartTotals(cart);
      
      // 7. 更新缓存
      await this.updateCartCache(updatedCart, userId, tenantId);
      
      return updatedCart;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  /**
   * 从购物车移除商品
   */
  static async removeFromCart(
    userId: string,
    itemId: string,
    tenantId: string
  ): Promise<Cart> {
    try {
      // 1. 获取购物车
      const cart = await this.getCart(userId, tenantId);
      
      // 2. 从数据库删除
      await this.removeCartItemFromDatabase(itemId);
      
      // 3. 从内存中移除
      cart.items = cart.items.filter(item => item.id !== itemId);
      
      // 4. 重新计算总价
      const updatedCart = this.calculateCartTotals(cart);
      
      // 5. 更新缓存
      await this.updateCartCache(updatedCart, userId, tenantId);
      
      return updatedCart;
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  /**
   * 清空购物车
   */
  static async clearCart(userId: string, tenantId: string): Promise<void> {
    try {
      // 1. 从数据库删除
      await this.clearCartInDatabase(userId, tenantId);
      
      // 2. 清除缓存
      const cacheKey = this.buildCacheKey(userId, tenantId);
      await CacheService.delete(cacheKey);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  /**
   * 购物车转订单后标记为已转换
   */
  static async markCartAsConverted(userId: string, tenantId: string): Promise<void> {
    try {
      await prisma.cart.updateMany({
        where: {
          userId,
          tenantId: parseInt(tenantId),
          status: 'ACTIVE',
        },
        data: {
          status: 'CONVERTED',
          updatedAt: new Date(),
        },
      });

      // 清除缓存
      const cacheKey = this.buildCacheKey(userId, tenantId);
      await CacheService.delete(cacheKey);
    } catch (error) {
      console.error('Error marking cart as converted:', error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  private static buildCacheKey(userId: string, tenantId: string): string {
    return `${this.CART_CACHE_PREFIX}${tenantId}:${userId}`;
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
      updatedAt: new Date(),
    };
  }

  /**
   * 从数据库获取购物车
   */
  private static async getCartFromDatabase(userId: string, tenantId: string): Promise<Cart | null> {
    try {
      const dbCart = await prisma.cart.findUnique({
        where: {
          userId_tenantId: {
            userId,
            tenantId: parseInt(tenantId),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!dbCart || dbCart.status !== 'ACTIVE') {
        return null;
      }

      // 转换为Cart格式
      const cartItems: CartItem[] = dbCart.items.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productImage: item.product.images || '',
        price: item.price,
        quantity: item.quantity,
        variantId: item.variantId || undefined,
        variantName: item.variantId ? `变体 ${item.variantId}` : undefined,
        maxQuantity: item.product.stock,
        subtotal: item.quantity * item.price,
      }));

      const cart: Cart = {
        id: dbCart.id,
        userId: dbCart.userId,
        items: cartItems,
        total: 0,
        itemCount: 0,
        subtotal: 0,
        tax: 0,
        shipping: 0,
        status: dbCart.status,
        createdAt: dbCart.createdAt,
        updatedAt: dbCart.updatedAt,
      };

      return this.calculateCartTotals(cart);
    } catch (error) {
      console.error('Error getting cart from database:', error);
      return null;
    }
  }

  /**
   * 获取或创建购物车
   */
  private static async getOrCreateCart(userId: string, tenantId: string): Promise<Cart> {
    let cart = await this.getCart(userId, tenantId);

    if (!cart.id) {
      // 创建新购物车
      const dbCart = await prisma.cart.create({
        data: {
          userId,
          tenantId: parseInt(tenantId),
          status: 'ACTIVE',
        },
      });

      cart.id = dbCart.id;
      cart.createdAt = dbCart.createdAt;
      cart.updatedAt = dbCart.updatedAt;
    }

    return cart;
  }

  /**
   * 验证商品
   */
  private static async validateProduct(productId: string, tenantId: string) {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: parseInt(tenantId),
      },
    });

    if (!product) {
      throw new Error('商品不存在');
    }

    if (product.stock <= 0) {
      throw new Error('商品已售罄');
    }

    return product;
  }

  /**
   * 添加购物车商品到数据库
   */
  private static async addCartItemToDatabase(
    cartId: string,
    productId: string,
    quantity: number,
    price: number,
    tenantId: string,
    variantId?: string
  ) {
    return await prisma.cartItem.create({
      data: {
        cartId,
        productId,
        quantity,
        price,
        variantId: variantId || null,
        tenantId: parseInt(tenantId),
      },
    });
  }

  /**
   * 更新购物车商品数量
   */
  private static async updateCartItemInDatabase(itemId: string, quantity: number) {
    return await prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 从数据库删除购物车商品
   */
  private static async removeCartItemFromDatabase(itemId: string) {
    return await prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * 清空数据库中的购物车
   */
  private static async clearCartInDatabase(userId: string, tenantId: string) {
    // 删除购物车商品（级联删除会自动处理）
    await prisma.cart.deleteMany({
      where: {
        userId,
        tenantId: parseInt(tenantId),
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 更新购物车缓存
   */
  private static async updateCartCache(cart: Cart, userId: string, tenantId: string) {
    const cacheKey = this.buildCacheKey(userId, tenantId);
    await CacheService.set(cacheKey, JSON.stringify(cart), { ttl: this.CART_CACHE_TTL });
  }

  /**
   * 计算购物车总价
   */
  private static calculateCartTotals(cart: Cart): Cart {
    const subtotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * 0.1; // 10% 税率
    const shipping = subtotal > 100 ? 0 : 10; // 满100免运费
    const total = subtotal + tax + shipping;
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cart,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      total: Math.round(total * 100) / 100,
      itemCount,
      updatedAt: new Date(),
    };
  }

  /**
   * 获取购物车统计信息（管理员功能）
   */
  static async getCartStats(tenantId?: string) {
    try {
      const where: any = {};
      if (tenantId) {
        where.tenantId = parseInt(tenantId);
      }

      const [totalCarts, activeCarts, totalItems] = await Promise.all([
        prisma.cart.count({ where }),
        prisma.cart.count({ where: { ...where, status: 'ACTIVE' } }),
        prisma.cartItem.count({
          where: tenantId ? { tenantId: parseInt(tenantId) } : {},
        }),
      ]);

      return {
        totalCarts,
        activeCarts,
        totalItems,
        averageItemsPerCart: totalCarts > 0 ? Math.round((totalItems / totalCarts) * 100) / 100 : 0,
      };
    } catch (error) {
      console.error('Error getting cart stats:', error);
      throw error;
    }
  }
}
