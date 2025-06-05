import { PrismaClient } from '@prisma/client';
import { CacheService } from '@/core/cache/service';

const prisma = new PrismaClient();

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
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
}

export class CartService {
  private static CART_CACHE_PREFIX = 'cart:';
  private static CART_CACHE_TTL = 3600; // 1 hour

  static async getCart(userId?: string): Promise<Cart> {
    try {
      // For now, return a mock cart since we don't have user sessions
      const sessionId = userId || 'guest';
      const cacheKey = `${this.CART_CACHE_PREFIX}${sessionId}`;
      
      // Try to get from cache first
      const cachedCart = await CacheService.get(cacheKey);
      if (cachedCart) {
        return JSON.parse(cachedCart);
      }

      // Return empty cart if not found
      const emptyCart: Cart = {
        items: [],
        total: 0,
        itemCount: 0,
        subtotal: 0,
        tax: 0,
        shipping: 0,
      };

      // Cache the empty cart
      await CacheService.set(cacheKey, JSON.stringify(emptyCart), this.CART_CACHE_TTL);
      
      return emptyCart;
    } catch (error) {
      console.error('Error getting cart:', error);
      throw new Error('Failed to get cart');
    }
  }

  static async addToCart(
    productId: string, 
    quantity: number, 
    variantId?: string,
    userId?: string
  ): Promise<Cart> {
    try {
      const sessionId = userId || 'guest';
      const cacheKey = `${this.CART_CACHE_PREFIX}${sessionId}`;
      
      // Get current cart
      const currentCart = await this.getCart(sessionId);
      
      // Mock product data (in real app, fetch from database)
      const mockProducts: Record<string, any> = {
        '1': {
          id: '1',
          name: 'Wireless Headphones',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
          price: 99.99,
          stock: 15,
        },
        '2': {
          id: '2',
          name: 'Smart Watch',
          image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
          price: 199.99,
          stock: 8,
        },
        '3': {
          id: '3',
          name: 'Designer Jacket',
          image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
          price: 159.99,
          stock: 5,
        },
      };

      const product = mockProducts[productId];
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if item already exists in cart
      const existingItemIndex = currentCart.items.findIndex(
        item => item.productId === productId && item.variantId === variantId
      );

      if (existingItemIndex >= 0) {
        // Update quantity
        const newQuantity = currentCart.items[existingItemIndex].quantity + quantity;
        if (newQuantity > product.stock) {
          throw new Error('Not enough stock available');
        }
        currentCart.items[existingItemIndex].quantity = newQuantity;
      } else {
        // Add new item
        if (quantity > product.stock) {
          throw new Error('Not enough stock available');
        }
        
        const newItem: CartItem = {
          id: `${productId}-${variantId || 'default'}-${Date.now()}`,
          productId,
          productName: product.name,
          productImage: product.image,
          price: product.price,
          quantity,
          variantId,
          variantName: variantId ? `Variant ${variantId}` : undefined,
          maxQuantity: product.stock,
        };
        
        currentCart.items.push(newItem);
      }

      // Recalculate totals
      const updatedCart = this.calculateCartTotals(currentCart);
      
      // Cache the updated cart
      await CacheService.set(cacheKey, JSON.stringify(updatedCart), this.CART_CACHE_TTL);
      
      return updatedCart;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  static async updateCartItem(
    itemId: string, 
    quantity: number,
    userId?: string
  ): Promise<Cart> {
    try {
      const sessionId = userId || 'guest';
      const cacheKey = `${this.CART_CACHE_PREFIX}${sessionId}`;
      
      // Get current cart
      const currentCart = await this.getCart(sessionId);
      
      // Find item
      const itemIndex = currentCart.items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      if (quantity <= 0) {
        // Remove item
        currentCart.items.splice(itemIndex, 1);
      } else {
        // Update quantity
        if (quantity > currentCart.items[itemIndex].maxQuantity) {
          throw new Error('Not enough stock available');
        }
        currentCart.items[itemIndex].quantity = quantity;
      }

      // Recalculate totals
      const updatedCart = this.calculateCartTotals(currentCart);
      
      // Cache the updated cart
      await CacheService.set(cacheKey, JSON.stringify(updatedCart), this.CART_CACHE_TTL);
      
      return updatedCart;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  static async removeFromCart(itemId: string, userId?: string): Promise<Cart> {
    try {
      const sessionId = userId || 'guest';
      const cacheKey = `${this.CART_CACHE_PREFIX}${sessionId}`;
      
      // Get current cart
      const currentCart = await this.getCart(sessionId);
      
      // Remove item
      currentCart.items = currentCart.items.filter(item => item.id !== itemId);

      // Recalculate totals
      const updatedCart = this.calculateCartTotals(currentCart);
      
      // Cache the updated cart
      await CacheService.set(cacheKey, JSON.stringify(updatedCart), this.CART_CACHE_TTL);
      
      return updatedCart;
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  static async clearCart(userId?: string): Promise<void> {
    try {
      const sessionId = userId || 'guest';
      const cacheKey = `${this.CART_CACHE_PREFIX}${sessionId}`;
      
      // Clear cache
      await CacheService.delete(cacheKey);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw new Error('Failed to clear cart');
    }
  }

  private static calculateCartTotals(cart: Cart): Cart {
    const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const total = subtotal + tax + shipping;
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cart,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      total: Math.round(total * 100) / 100,
      itemCount,
    };
  }
}
