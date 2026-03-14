import { CacheService } from '@/core/cache/service';
import { prisma } from '@/config/database';
import {
  buildFulfillmentSignature,
  getSupplierProductProfile,
  parseJsonRecord,
  resolveSupplierFulfillmentData,
} from '@/core/external-orders/utils';
import { InventoryService } from '@/core/inventory/service';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  variantId: string;
  variantName?: string;
  variantAttributes?: Record<string, unknown> | null;
  requiresShipping: boolean;
  maxQuantity: number;
  subtotal: number;
  fulfillmentData?: Record<string, unknown> | null;
}

export interface AppliedCartDiscount {
  id: string;
  code: string;
  type: string;
  value: number;
  amount: number;
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
  discount: number;
  discountAmount: number;
  appliedDiscounts: AppliedCartDiscount[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cart Service
 *
 * Manages shopping cart operations with Redis caching and Prisma database persistence.
 * Handles cart item management including adding, updating, removing items and cart totals calculation.
 */
export class CartService {
  private static CART_CACHE_PREFIX = 'user_cart:';
  private static CART_DISCOUNT_CACHE_PREFIX = 'user_cart_discounts:';
  private static CART_CACHE_TTL = 86400 * 7; // 7 days
  private static inMemoryDiscountCodes = new Map<string, string[]>();

  private static async ensureProductPurchasable(productId: string, variantId: string): Promise<void> {
    const [productLink, variantLink] = await Promise.all([
      prisma.externalProductLink.findFirst({
        where: {
          coreProductId: productId,
        },
        select: {
          sourceIsActive: true,
        },
      }),
      prisma.externalVariantLink.findFirst({
        where: {
          coreProductId: productId,
          coreVariantId: variantId,
        },
        select: {
          sourceIsActive: true,
        },
      }),
    ]);

    if (productLink?.sourceIsActive === false || variantLink?.sourceIsActive === false) {
      throw new Error('Product is no longer available from source');
    }
  }

  /**
   * Get user cart with caching
   *
   * Retrieves the user's cart from Redis cache first, falling back to database if not cached.
   * Returns an empty cart if no cart exists for the user.
   *
   * @param userId - The unique identifier of the user
   * @returns Promise resolving to the user's Cart with items and calculated totals
   *
   * @example
   * ```typescript
   * const cart = await CartService.getCart('user-123');
   * console.log(cart.items.length, cart.total);
   * ```
   *
   * Error handling: Returns empty cart on any errors to ensure a valid response
   */
  static async getCart(userId: string): Promise<Cart> {
    try {
      const cacheKey = this.buildCacheKey(userId);

      // 1. Try to get from Redis cache first
      const cachedCart = await CacheService.get<unknown>(cacheKey);
      if (cachedCart) {
        // Backward-compatible normalization for old cached payloads.
        const parsed = typeof cachedCart === 'string' ? JSON.parse(cachedCart) : cachedCart;
        const normalized = this.normalizeCart(parsed, userId);
        return this.attachAppliedDiscountState(userId, normalized);
      }

      // 2. Get from database
      const dbCart = await this.getCartFromDatabase(userId);

      if (dbCart) {
        await CacheService.set(cacheKey, dbCart, { ttl: this.CART_CACHE_TTL });
        return this.attachAppliedDiscountState(userId, dbCart);
      }

      return this.createEmptyCart(userId);
    } catch (error) {
      console.error('Error getting cart:', error);
      return this.createEmptyCart(userId);
    }
  }

  /**
   * Add item to cart or update quantity if already exists
   *
   * Creates a new cart if the user doesn't have one. If the item already exists in the cart,
   * increments its quantity. Otherwise, adds the item as a new cart entry. Automatically
   * selects a default variant if none is specified.
   *
   * @param userId - The unique identifier of the user
   * @param productId - The unique identifier of the product to add
   * @param quantity - The quantity to add (defaults to 1)
   * @param variantId - Optional product variant ID. If not provided, uses default or first variant
   * @returns Promise resolving to the updated Cart
   * @throws Error if product or variant not found
   *
   * @example
   * ```typescript
   * const cart = await CartService.addToCart('user-123', 'prod-456', 2, 'variant-789');
   * ```
   *
   * Error scenarios:
   * - Product or variant not found: Throws 'Product or variant not found'
   * - Database errors: Propagated to caller
   */
  static async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    variantId?: string,
    fulfillmentData?: Record<string, unknown>
  ): Promise<Cart> {
    try {
      // Get or create cart
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

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              name: true,
              salePrice: true,
              isActive: true,
            },
          },
        },
      });

      if (!product || !product.isActive) {
        throw new Error('Product is not available');
      }

      const variant = variantId
        ? product.variants.find((item) => item.id === variantId)
        : product.variants[0];

      if (!variant) {
        throw new Error('Product or variant not found');
      }

      await this.ensureProductPurchasable(productId, variant.id);

      const supplierProfile = getSupplierProductProfile(product.typeData);
      const resolvedFulfillmentData = supplierProfile.isSupplierProduct
        ? resolveSupplierFulfillmentData(supplierProfile, fulfillmentData)
        : null;
      const fulfillmentSignature = supplierProfile.isSupplierProduct
        ? buildFulfillmentSignature(resolvedFulfillmentData)
        : null;

      // Check if item already exists
      const existingItem = cart.items.find(
        (item) =>
          item.productId === productId &&
          item.variantId === variant.id &&
          buildFulfillmentSignature(parseJsonRecord(item.fulfillmentData)) === fulfillmentSignature
      );

      if (existingItem) {
        // Update quantity
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity }
        });
      } else {
        // Add new item
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            variantId: variant.id,
            quantity,
            price: variant.salePrice,
            fulfillmentData: (resolvedFulfillmentData ?? null) as any,
          }
        });
      }

      // Invalidate cache and return updated cart
      await this.clearAppliedDiscountCodes(userId);
      await this.invalidateCache(userId);
      return this.getCart(userId);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  /**
   * Batch add items to cart atomically.
   */
  static async batchAddToCart(
    userId: string,
    items: Array<{
      productId: string;
      quantity?: number;
      variantId?: string;
      fulfillmentData?: Record<string, unknown>;
    }>
  ): Promise<Cart> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items are required');
    }

    await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: { userId, status: 'ACTIVE' },
          include: { items: true },
        });
      }

      const productIds = Array.from(new Set(items.map((item) => item.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              name: true,
              salePrice: true,
              isActive: true,
            },
          },
        },
      });
      const productMap = new Map(products.map((product) => [product.id, product]));

      for (const item of items) {
        const quantity = Number(item.quantity ?? 1);
        const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error('Product or variant not found');
        }
        if (!product.isActive) {
          throw new Error('Product is not available');
        }

        const variant = item.variantId
          ? product.variants.find((entry) => entry.id === item.variantId)
          : product.variants[0];

        if (!variant) {
          throw new Error('Product or variant not found');
        }

        await this.ensureProductPurchasable(item.productId, variant.id);

        const supplierProfile = getSupplierProductProfile(product.typeData);
        const resolvedFulfillmentData = supplierProfile.isSupplierProduct
          ? resolveSupplierFulfillmentData(supplierProfile, item.fulfillmentData)
          : null;
        const fulfillmentSignature = supplierProfile.isSupplierProduct
          ? buildFulfillmentSignature(resolvedFulfillmentData)
          : null;

        const existingItem = await tx.cartItem.findFirst({
          where: {
            cartId: cart.id,
            productId: item.productId,
            variantId: variant.id,
          },
        });

        if (
          existingItem &&
          buildFulfillmentSignature(parseJsonRecord(existingItem.fulfillmentData)) === fulfillmentSignature
        ) {
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + normalizedQuantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: item.productId,
              variantId: variant.id,
              quantity: normalizedQuantity,
              price: variant.salePrice,
              fulfillmentData: (resolvedFulfillmentData ?? null) as any,
            },
          });
        }
      }
    });

    await this.clearAppliedDiscountCodes(userId);
    await this.invalidateCache(userId);
    return this.getCart(userId);
  }

  /**
   * Apply a single discount code to current cart.
   */
  static async applyDiscount(userId: string, code: string): Promise<Cart> {
    const normalizedCode = code.trim().toUpperCase();
    const cart = await this.getCart(userId);
    if (!cart.items.length) {
      throw new Error('Cart is empty');
    }

    const { DiscountEngine } = await import('@/core/discount/engine');
    const { DiscountService } = await import('@/core/discount/service');
    const validation = await DiscountService.validateDiscount({
      code: normalizedCode,
      userId,
      cartTotal: cart.subtotal,
      productIds: cart.items.map((item) => item.productId),
    });

    if (!validation.isValid) {
      throw new Error(validation.errors?.[0] || 'Invalid discount code');
    }

    const existingCodes = await this.getAppliedDiscountCodes(userId);
    const candidateCodes = existingCodes.includes(normalizedCode)
      ? existingCodes
      : [...existingCodes, normalizedCode];
    const result = await DiscountEngine.calculateDiscount(cart, candidateCodes, { id: userId });

    if (result.appliedDiscounts.length === 0) {
      throw new Error('Discount code is not applicable');
    }

    const appliedCodes = result.appliedDiscounts.map((discount) => discount.code.toUpperCase());
    await this.setAppliedDiscountCodes(userId, appliedCodes);

    return {
      ...cart,
      discount: result.discountAmount,
      total: result.finalTotal,
      discountAmount: result.discountAmount,
      appliedDiscounts: result.appliedDiscounts.map((discount) => ({
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        amount: discount.discountAmount,
      })),
    };
  }

  /**
   * Remove discount from cart response (cart baseline stays unchanged in DB).
   */
  static async removeDiscount(userId: string, code: string): Promise<Cart> {
    const normalizedCode = code.trim().toUpperCase();
    const existingCodes = await this.getAppliedDiscountCodes(userId);
    const nextCodes = existingCodes.filter((item) => item !== normalizedCode);

    if (nextCodes.length === 0) {
      await this.clearAppliedDiscountCodes(userId);
    } else {
      await this.setAppliedDiscountCodes(userId, nextCodes);
    }

    return this.getCart(userId);
  }

  /**
   * Update cart item quantity
   *
   * Updates the quantity of an existing cart item. If quantity is set to 0 or less,
   * the item is removed from the cart instead.
   *
   * @param userId - The unique identifier of the user
   * @param itemId - The unique identifier of the cart item to update
   * @param quantity - The new quantity. If <= 0, the item is removed
   * @returns Promise resolving to the updated Cart
   * @throws Error if cart or cart item not found
   *
   * @example
   * ```typescript
   * const cart = await CartService.updateCartItem('user-123', 'item-456', 3);
   * // Or remove by setting quantity to 0
   * const cart = await CartService.updateCartItem('user-123', 'item-456', 0);
   * ```
   *
   * Error scenarios:
   * - Cart not found: Throws 'Cart not found'
   * - Cart item not found: Throws 'Cart item not found'
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

      await this.clearAppliedDiscountCodes(userId);
      await this.invalidateCache(userId);
      return this.getCart(userId);
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  /**
   * Remove item from cart
   *
   * Deletes a specific cart item and invalidates the cache to reflect the change.
   *
   * @param userId - The unique identifier of the user
   * @param itemId - The unique identifier of the cart item to remove
   * @returns Promise resolving to the updated Cart
   * @throws Error if item deletion fails
   *
   * @example
   * ```typescript
   * const cart = await CartService.removeFromCart('user-123', 'item-456');
   * ```
   *
   * Error scenarios:
   * - Cart item not found: Database error propagated to caller
   */
  static async removeFromCart(userId: string, itemId: string): Promise<Cart> {
    try {
      await prisma.cartItem.deleteMany({ where: { id: itemId } });
      await this.clearAppliedDiscountCodes(userId);
      await this.invalidateCache(userId);
      return this.getCart(userId);
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  /**
   * Clear all items from cart
   *
   * Removes all items from the user's cart while keeping the cart entity itself.
   * Returns an empty cart structure.
   *
   * @param userId - The unique identifier of the user
   * @returns Promise resolving to an empty Cart
   *
   * @example
   * ```typescript
   * const emptyCart = await CartService.clearCart('user-123');
   * console.log(emptyCart.items.length); // 0
   * ```
   *
   * Error handling: Logs errors and returns empty cart to ensure valid response
   */
  static async clearCart(userId: string): Promise<Cart> {
    try {
      const cart = await prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      await this.clearAppliedDiscountCodes(userId);
      await this.invalidateCache(userId);
      return this.createEmptyCart(userId);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Build Redis cache key for user cart
   *
   * @param userId - The unique identifier of the user
   * @returns Formatted cache key string
   * @private
   */
  private static buildCacheKey(userId: string): string {
    return `${this.CART_CACHE_PREFIX}${userId}`;
  }

  private static buildDiscountStateKey(userId: string): string {
    return `${this.CART_DISCOUNT_CACHE_PREFIX}${userId}`;
  }

  private static async getAppliedDiscountCodes(userId: string): Promise<string[]> {
    const key = this.buildDiscountStateKey(userId);
    const cachedCodes = await CacheService.get<unknown>(key);
    if (Array.isArray(cachedCodes)) {
      return cachedCodes
        .filter((code): code is string => typeof code === 'string')
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0);
    }
    const memoryCodes = this.inMemoryDiscountCodes.get(userId);
    return memoryCodes ? [...memoryCodes] : [];
  }

  private static async setAppliedDiscountCodes(userId: string, codes: string[]): Promise<void> {
    const key = this.buildDiscountStateKey(userId);
    const normalizedCodes = Array.from(
      new Set(
        codes
          .filter((code) => typeof code === 'string')
          .map((code) => code.trim().toUpperCase())
          .filter((code) => code.length > 0)
      )
    );
    if (!normalizedCodes.length) {
      this.inMemoryDiscountCodes.delete(userId);
      await CacheService.delete(key);
      return;
    }
    this.inMemoryDiscountCodes.set(userId, normalizedCodes);
    await CacheService.set(key, normalizedCodes, { ttl: this.CART_CACHE_TTL });
  }

  private static async clearAppliedDiscountCodes(userId: string): Promise<void> {
    const key = this.buildDiscountStateKey(userId);
    this.inMemoryDiscountCodes.delete(userId);
    await CacheService.delete(key);
  }

  private static async attachAppliedDiscountState(userId: string, cart: Cart): Promise<Cart> {
    const appliedCodes = await this.getAppliedDiscountCodes(userId);
    if (!appliedCodes.length || cart.items.length === 0) {
      if (appliedCodes.length && cart.items.length === 0) {
        await this.clearAppliedDiscountCodes(userId);
      }
      return {
        ...cart,
        discount: 0,
        discountAmount: 0,
        appliedDiscounts: [],
        total: cart.subtotal + cart.tax + cart.shipping,
      };
    }

    const { DiscountEngine } = await import('@/core/discount/engine');
    const result = await DiscountEngine.calculateDiscount(cart, appliedCodes, { id: userId });
    const resultCodes = result.appliedDiscounts.map((discount) => discount.code.toUpperCase());

    if (resultCodes.length === 0) {
      await this.clearAppliedDiscountCodes(userId);
    } else if (
      resultCodes.length !== appliedCodes.length ||
      resultCodes.some((code, index) => code !== appliedCodes[index])
    ) {
      await this.setAppliedDiscountCodes(userId, resultCodes);
    }

    return {
      ...cart,
      discount: result.discountAmount,
      discountAmount: result.discountAmount,
      appliedDiscounts: result.appliedDiscounts.map((discount) => ({
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        amount: discount.discountAmount,
      })),
      total: result.finalTotal,
    };
  }

  /**
   * Invalidate cached cart for user
   *
   * Deletes the cart from Redis cache to force fresh data on next retrieval.
   *
   * @param userId - The unique identifier of the user
   * @returns Promise that resolves when cache is invalidated
   * @private
   */
  private static async invalidateCache(userId: string): Promise<void> {
    const cacheKey = this.buildCacheKey(userId);
    await CacheService.delete(cacheKey);
  }

  /**
   * Retrieve cart from database with full item details
   *
   * Fetches the cart from Prisma with all related items, products, and variants.
   * Calculates subtotals, totals, and formats the response structure.
   *
   * @param userId - The unique identifier of the user
   * @returns Promise resolving to Cart or null if not found
   * @private
   *
   * Note: Parses product images from typeData JSON field
   */
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

    const variantIds = cart.items.map(item => item.variantId).filter(Boolean);
    const stockMap = await InventoryService.getAvailableStockByVariantIds(variantIds);

    const items: CartItem[] = cart.items.map(item => {
      const typeData = parseJsonRecord(item.product?.typeData);
      const images = Array.isArray(typeData?.images)
        ? typeData?.images.filter((image): image is string => typeof image === 'string')
        : [];
      const availableStock = stockMap.get(item.variantId) ?? 0;
      return {
        id: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Unknown Product',
        productImage: images[0] || '',
        price: Number(item.price),
        quantity: item.quantity,
        variantId: item.variantId,
        variantName: item.variant?.name || undefined,
        variantAttributes: parseJsonRecord(item.variant?.attributes),
        requiresShipping: item.product?.requiresShipping ?? true,
        maxQuantity: availableStock,
        subtotal: Number(item.price) * item.quantity,
        fulfillmentData: parseJsonRecord(item.fulfillmentData),
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      subtotal,
      tax: 0,
      shipping: 0,
      discount: 0,
      discountAmount: 0,
      appliedDiscounts: [],
      total: subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      status: cart.status,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString()
    };
  }

  /**
   * Create an empty cart structure
   *
   * Returns a Cart object with no items and zero totals. Used as a fallback
   * when no cart exists or on errors.
   *
   * @param userId - The unique identifier of the user
   * @returns Empty Cart object with current timestamp
   * @private
   */
  private static createEmptyCart(userId: string): Cart {
    const now = new Date().toISOString();
    return {
      id: '',
      userId,
      items: [],
      total: 0,
      itemCount: 0,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      discountAmount: 0,
      appliedDiscounts: [],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
  }

  private static normalizeCart(raw: any, userId: string): Cart {
    const now = new Date().toISOString();
    const items = Array.isArray(raw?.items) ? raw.items : [];
    const subtotal = Number(raw?.subtotal ?? 0);
    const tax = Number(raw?.tax ?? 0);
    const shipping = Number(raw?.shipping ?? 0);
    const discount = Number(raw?.discount ?? 0);
    const discountAmount = Number(raw?.discountAmount ?? discount ?? 0);
    const total = Number(raw?.total ?? (subtotal + tax + shipping - discount));
    const itemCount = Number(raw?.itemCount ?? items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0));
    const appliedDiscounts = Array.isArray(raw?.appliedDiscounts) ? raw.appliedDiscounts : [];

    return {
      id: typeof raw?.id === 'string' ? raw.id : '',
      userId: typeof raw?.userId === 'string' ? raw.userId : userId,
      items,
      subtotal,
      tax,
      shipping,
      discount,
      discountAmount,
      appliedDiscounts,
      total,
      itemCount,
      status: typeof raw?.status === 'string' ? raw.status : 'ACTIVE',
      createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : now,
      updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : now,
    };
  }
}
