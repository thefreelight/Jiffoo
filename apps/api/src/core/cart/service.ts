import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { ProductService } from '@/core/product/service';
import { lineRequiresShippingAddress, stockCeilingFor } from '@/core/shared/fulfillment-policy';

/**
 * A cart line, read under the row lock of the line.
 */
type LockedCartLine = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
};

/**
 * The transaction surface required to lock the lines of a cart. A Prisma
 * transaction client satisfies it, so the caller passes its own transaction
 * client straight through.
 */
type CartLineLockTx = {
  $queryRaw: (...args: any[]) => Promise<any>;
};

/**
 * Transaction surface required to consume purchased cart lines. A Prisma
 * transaction client satisfies it, so the caller passes its own transaction
 * client straight through.
 */
export type CartPurchaseTx = CartLineLockTx & {
  cart: {
    findUnique(args: any): Promise<any>;
  };
  cartItem: {
    delete(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
};

export class InsufficientCartStockError extends ApiError {

  constructor(readonly availableQuantity: number) {
    super('INSUFFICIENT_STOCK', { availableQuantity });
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

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
}

/**
 * The fulfilment projection of a cart line.
 *
 * The projection carries the product type of the line, because the product
 * type is the key of the fulfilment policy, and the shipping requirement of
 * the line. It is a projection of its own: the public cart response keeps
 * its shape.
 */
export interface CartLineFulfillment {
  productId: string;
  variantId: string;
  quantity: number;
  /** The product type of the line, the key of the fulfilment policy. */
  productType: string;
  /** The line needs a shipping address. */
  requiresShipping: boolean;
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
      const dbCart = await this.getCartFromDatabase(userId);
      return dbCart ?? this.createEmptyCart(userId);
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
      // The cart of a customer is written in one transaction: the cart, the
      // cart of a customer that does not have one yet and the line of the
      // product belong to the same write, so a crash cannot leave an empty
      // cart or an orphan line behind.
      await this.runCartWrite(async (tx) => {
        // Every writer of the cart of a customer serializes on that cart, and
        // every writer of a line serializes on the row lock of that line, so
        // the quantity of a line is never read and written at the same time.
        await this.lockCartWrites(tx, userId);
        const cart = await this.ensureCart(tx, userId);

        const product = (await ProductService.getSellableCatalog(tx, [productId])).get(productId);

        if (!product || !product.isActive) {
          throw new ApiError('BAD_REQUEST');
        }

        const variant = variantId
          ? product.sellableVariants.find((item) => item.id === variantId)
          : product.sellableVariants[0];

        if (!variant) {
          throw new ApiError('NOT_FOUND');
        }

        // The line of the variant is locked before the ceiling is checked, so
        // the ceiling is checked against the quantity the cart holds under the
        // lock and not against a quantity that a concurrent consumption of the
        // purchased lines has already taken out of the line.
        const locked = await this.lockCartLines(tx, cart.id, [variant.id]);
        const currentQuantity = locked.length ? locked[0].quantity : 0;
        // The stock ceiling of the line is read under the lock of the line,
        // but never under the lock of the stock row. The order path takes the
        // stock row first and the line row second, so a cart writer that took
        // the stock row after the line row would invert that order and
        // deadlock with the order path. The ceiling is therefore advisory,
        // and the authoritative guard is the conditional decrement of the
        // sale, which refuses the sale when the stock is not there: the cart
        // can offer a line the stock no longer covers, and the order
        // placement rejects it.
        const availableQuantity = await this.lockedStockCeiling(tx, product, variant.id);
        if (currentQuantity + quantity > availableQuantity) {
          throw new InsufficientCartStockError(availableQuantity);
        }

        // The database owns the line: the unique key of a line is its cart and
        // its variant, so an add that arrives while another add of the same
        // variant is running increments the same row instead of writing a
        // second row for the same variant.
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
          create: {
            cartId: cart.id,
            productId,
            variantId: variant.id,
            quantity,
          },
          update: { quantity: { increment: quantity } },
        });
      });

      // Invalidate cache and return updated cart
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
      throw new ApiError('INTERNAL_SERVER_ERROR');
    }

    await this.runCartWrite(async (tx) => {
      // The batch is one write of one cart: the writers of the cart of a
      // customer serialize on that cart, and every writer of a line
      // serializes on the row lock of that line, so the quantity of a line is
      // never read and written at the same time.
      await this.lockCartWrites(tx, userId);
      const cart = await this.ensureCart(tx, userId);

      const productIds = Array.from(new Set(items.map((item) => item.productId)));
      const catalog = await ProductService.getSellableCatalog(tx, productIds);

      // The lines of the batch are written under the row lock of the line, so
      // every writer of a cart locks the lines of that cart in one order and
      // cannot deadlock with a writer that locks more than one line.
      const lines: Array<{ productId: string; variantId: string; quantity: number }> = [];

      for (const item of items) {
        const quantity = Number(item.quantity ?? 1);
        const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
        const product = catalog.get(item.productId);

        if (!product) {
          throw new ApiError('NOT_FOUND');
        }
        if (!product.isActive) {
          throw new ApiError('INTERNAL_SERVER_ERROR');
        }

        const variant = item.variantId
          ? product.sellableVariants.find((entry) => entry.id === item.variantId)
          : product.sellableVariants[0];

        if (!variant) {
          throw new ApiError('NOT_FOUND');
        }

        lines.push({ productId: item.productId, variantId: variant.id, quantity: normalizedQuantity });
      }

      // The lines of the batch are locked before they are written, so the
      // increment of a line cannot interleave with the consumption of the
      // purchased lines of the order module, which takes the same row lock of
      // the line. The locks are taken in the order of the database, the global
      // order of the line locks of a cart.
      await this.lockCartLines(tx, cart.id, lines.map((line) => line.variantId));

      for (const line of lines) {
        // The database owns the line: the unique key of a line is its cart and
        // its variant, so the batch increments the line of the variant instead
        // of reading the quantity and writing it back. The increment is atomic
        // in the database, and the line is already locked.
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: cart.id, variantId: line.variantId } },
          create: {
            cartId: cart.id,
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          },
          update: { quantity: { increment: line.quantity } },
        });
      }
    });

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
      await this.runCartWrite(async (tx) => {
        await this.lockCartWrites(tx, userId);
        const cart = await tx.cart.findUnique({
          where: { userId }
        });

        if (!cart) {
          throw new ApiError('NOT_FOUND');
        }

        // The line must belong to the cart of the caller, and the row lock of
        // the line is taken before the quantity of the line is read or
        // written. The lock is scoped to the cart of the caller, so a
        // customer cannot change a line of another customer.
        //
        // The write is applied to the locked row, so it cannot overwrite the
        // quantity that the consumption of the purchased lines of the order
        // module took out of the line while this edit was running. An edit
        // that writes an absolute quantity and does not take the row lock of
        // the line would give the purchased units back to the cart.
        const line = await this.lockCartLineById(tx, cart.id, itemId);
        if (!line) {
          throw new ApiError('NOT_FOUND');
        }

        if (quantity <= 0) {
          // The delete of the locked line takes the row lock of the line as
          // well, so the removal and the consumption of the purchased lines
          // are one protocol.
          await tx.cartItem.deleteMany({ where: { id: line.id, cartId: cart.id } });
        } else {
          // The catalog is read under the row lock of the line, so the
          // quantity of the line and the ceiling of the line belong to the
          // same locked state of the line. The stock of the ceiling is read
          // as an unlocked snapshot and never under the lock of the stock
          // row: the order path takes the stock row first and the line row
          // second, so taking the stock row here would invert that order and
          // deadlock with the order path. The ceiling is therefore advisory,
          // and the authoritative guard is the conditional decrement of the
          // sale, which refuses the sale when the stock is not there.
          const catalog = await ProductService.getSellableCatalog(tx, [line.productId]);
          const product = catalog.get(line.productId);
          const variant = product?.variants.find((entry) => entry.id === line.variantId);
          if (!variant) throw new ApiError('NOT_FOUND');
          // The stock ceiling of a line of a product type that does not track
          // its inventory is not the stock of the variant.
          const availableQuantity = stockCeilingFor(product?.productType ?? '', variant.stock);
          if (quantity > availableQuantity) throw new InsufficientCartStockError(availableQuantity);
          await tx.cartItem.update({
            where: { id: line.id },
            data: { quantity }
          });
        }
      });

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
      await this.runCartWrite(async (tx) => {
        await this.lockCartWrites(tx, userId);
        // The line is scoped to the cart of the caller, so a customer cannot
        // delete a line of another customer. The delete of the line takes the
        // row lock of the line, so the removal and the consumption of the
        // purchased lines of the order module are one protocol. A writer that
        // locks a single line has no order of its own, so it is consistent
        // with the global order of the line locks of a cart.
        const deleted = await tx.cartItem.deleteMany({
          where: { id: itemId, cart: { userId } },
        });
        if (deleted.count === 0) {
          // Nothing was deleted. A line that does not exist at all keeps the
          // idempotent answer of the endpoint, and a line of another customer
          // is a line the caller does not have.
          const other = await tx.cartItem.findFirst({ where: { id: itemId }, select: { id: true } });
          if (other) {
            throw new ApiError('NOT_FOUND');
          }
        }
      });

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
      await this.runCartWrite(async (tx) => {
        // The clear of a cart is a write of that cart, so it joins the
        // protocol of the writers of the cart: the clear and an add of a line
        // cannot interleave.
        await this.lockCartWrites(tx, userId);
        const cart = await tx.cart.findUnique({ where: { userId } });
        if (cart) {
          // The clear writes every line of the cart, so it takes the row lock
          // of every line of the cart before it deletes them. The delete
          // takes the row lock of the line as well, but the lock is taken
          // here in the order of the database, the global order of the line
          // locks of a cart, so the clear cannot deadlock with the
          // consumption of the purchased lines.
          await this.lockCartLines(tx, cart.id);
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }
      });
      return this.createEmptyCart(userId);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Consume the purchased lines of the customer's cart inside the caller's transaction
   *
   * Removes a cart line when it is fully purchased and decrements its quantity when only
   * part of it was purchased. The cart belongs to this module, so the order module asks
   * this method to give the purchased lines back instead of writing the cart tables.
   *
   * The consumption does not take the cart-wide lock of the cart writers: it runs inside
   * the transaction of the order, which already holds the order row and the stock row of
   * the purchased variants, and the order must never wait for the cart. The row lock of
   * the consumed lines is the granularity of this path.
   *
   * @param tx Transaction client owned by the caller
   * @param userId The unique identifier of the user whose cart is consumed
   * @param purchasedLines The purchased `{ productId, variantId, quantity }` lines
   * @returns Promise resolving once the purchased lines are removed or decremented
   *
   * @example
   * ```typescript
   * await CartService.consumePurchasedItems(tx, 'user-123', [{ productId: 'p-1', variantId: 'v-1', quantity: 2 }]);
   * ```
   */
  static async consumePurchasedItems(
    tx: CartPurchaseTx,
    userId: string,
    purchasedLines: Array<{ productId: string; variantId: string; quantity: number }>
  ): Promise<void> {
    const purchased = new Map<string, number>();
    for (const line of purchasedLines) {
      const key = `${line.productId}:${line.variantId}`;
      purchased.set(key, (purchased.get(key) ?? 0) + line.quantity);
    }
    if (purchased.size === 0) return;

    // The consumption does NOT take the cart-wide lock of `lockCartWrites`.
    // The order module calls this method from inside the transaction of the
    // order, which already holds the order row and the stock row of the
    // purchased variants, and the order must never wait for the cart: a cart
    // edit that runs while the order is inside this consumption has to be
    // applied while the order still commits completely. The row lock of the
    // consumed lines below is the granularity of this path.
    const cart = await tx.cart.findUnique({ where: { userId }, include: { items: true } });
    if (!cart) return;

    // The purchased lines of the cart, with the quantity that is purchased
    // from every line.
    const purchasedByLineId = new Map<string, number>();
    const purchasedVariants: string[] = [];
    for (const line of cart.items) {
      const quantity = purchased.get(`${line.productId}:${line.variantId}`) ?? 0;
      if (quantity <= 0) continue;
      purchasedByLineId.set(line.id, quantity);
      purchasedVariants.push(line.variantId);
    }
    if (!purchasedByLineId.size) return;

    // The lines are locked in the order of the database, which is the global
    // order of the line locks of a cart, so the consumption and the writers
    // of the cart cannot deadlock with each other. The quantity of a line is
    // read with the lock, so a concurrent cart edit cannot make it negative.
    const locked = await this.lockCartLines(tx, cart.id, purchasedVariants);

    for (const line of locked) {
      const quantity = purchasedByLineId.get(line.id) ?? 0;
      if (!quantity) continue;
      // UPDATE and DELETE already take this row lock.
      if (line.quantity <= quantity) {
        await tx.cartItem.delete({ where: { id: line.id } });
      } else {
        await tx.cartItem.update({ where: { id: line.id }, data: { quantity: { decrement: quantity } } });
      }
    }
  }

  /**
   * The fulfilment projection of the cart of a customer
   *
   * The cart owns the cart and reads the catalog, so it knows the product
   * type of every line. The checkout reads that projection to resolve the
   * fulfilment plan of a cart, and the projection is separate from the
   * public cart response, which keeps its shape.
   *
   * @param userId - The unique identifier of the user whose cart is projected
   * @returns Promise resolving to the fulfilment projection of every cart line
   */
  static async getLineFulfillments(userId: string): Promise<CartLineFulfillment[]> {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true }
    });
    if (!cart) return [];

    const catalog = await ProductService.getSellableCatalog(
      prisma,
      cart.items.map((item) => item.productId)
    );

    return cart.items.map((item) => {
      const product = catalog.get(item.productId);
      // A line the catalog does not know carries no product type, so the
      // default policy of a product type applies to it.
      const productType = product?.productType ?? '';
      // The shipping requirement of a line is the shared address rule of a
      // line, exactly as the public cart response reports it.
      return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        productType,
        requiresShipping: lineRequiresShippingAddress(productType, product?.requiresShipping ?? true),
      };
    });
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Run a write of the cart of a customer in one transaction
   *
   * The write of a cart is a read-modify-write of a quantity, so the whole
   * write belongs to one transaction. The transaction is retried when the
   * unique index of `carts.userId` decides the race between two writers that
   * create the cart of the same customer: the writer that lost the race reads
   * the cart the winner created and writes its line into that cart.
   *
   * @param write The write of the cart, run with the transaction client
   * @returns Promise resolving with the result of the write
   * @private
   */
  private static async runCartWrite(write: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        await prisma.$transaction(async (transaction) => {
          // The transaction client of the extended client of the repository
          // is the plain transaction client with the same operations.
          const tx = transaction as unknown as Prisma.TransactionClient;
          await write(tx);
        }, {
          // The writers of one cart wait for each other on the cart lock, so
          // the transaction of a writer waits for the writers before it.
          maxWait: 10_000,
          timeout: 15_000,
        });
        return;
      } catch (error) {
        const code = (error as { code?: string } | null | undefined)?.code;
        if (code !== 'P2002' || attempt >= 3) throw error;
      }
    }
  }

  /**
   * Serialize the writers of the cart of a customer
   *
   * The cart of a customer is the unit of the write, so the writers of that
   * cart wait for each other. The lock is a transaction-scoped advisory lock
   * keyed by the customer, so it is released when the transaction ends and two
   * customers never wait for each other.
   *
   * The lock is taken on the transaction client of the caller, so a writer that
   * runs inside the transaction of another module joins that transaction and
   * holds the lock until that transaction ends.
   *
   * The lock covers the writers of a cart that own no other lock: an add, a
   * batch add, an update, a remove and a clear. The consumption of the
   * purchased lines is the exception and does NOT take it: the order module
   * calls the consumption from inside the transaction of the order, which
   * already holds the order row and the stock row of the purchased variants,
   * and the order must never wait for the cart. A cart edit that runs while
   * the order is inside the consumption has to be applied while the order
   * still commits completely, so the consumption locks the rows of the lines
   * it consumes instead of the cart. Do not "fix" that exception: the order
   * would wait for the cart, and the order of a customer whose cart is being
   * written would fail.
   *
   * The advisory lock is the lock of the cart and the row lock of a line is
   * the lock of that line, and the two are one protocol:
   *
   * - Every writer of a line takes the row lock of that line, the writers of
   *   the cart take the advisory lock of the cart first and the row lock of
   *   the line second, and the consumption of the purchased lines takes the
   *   row lock of the line only. The consumption therefore never waits for the
   *   advisory lock, and the order never waits for the cart.
   * - The lines of a cart are locked in the order of the database, the order
   *   of the variants under the collation of the database, by every writer
   *   that locks more than one line. That order is global and must not
   *   change, so no writer of a cart and no consumption of a cart can
   *   deadlock with each other.
   * - The quantity of a line is read and written under the row lock of that
   *   line, so an absolute write of a quantity cannot overwrite the quantity
   *   that the consumption of the purchased lines took out of the line.
   * - The stock ceiling of a line is read under the lock of the line and never
   *   under the lock of the stock row. The order path takes the stock row
   *   first and the line row second, so a cart writer that took the stock row
   *   after the line row would invert that order and deadlock with the order
   *   path. The ceiling is therefore advisory, and the authoritative guard is
   *   the conditional decrement of the sale, which carries the predicate that
   *   the stock has to cover the sale and refuses the sale when it does not.
   *   The cart can offer a line the stock no longer covers, and the order
   *   placement rejects it. Do not "fix" that: the cart path must never take
   *   the stock row lock.
   *
   * @param tx The transaction client of the write
   * @param userId The unique identifier of the owner of the cart
   * @private
   */
  private static async lockCartWrites(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`jiffoo:cart:${userId}`}, 0))::text`;
  }

  /**
   * The cart of a customer, created when the customer does not have one yet
   *
   * @param tx The transaction client of the write
   * @param userId The unique identifier of the owner of the cart
   * @returns Promise resolving to the cart of the customer
   * @private
   */
  private static async ensureCart(tx: Prisma.TransactionClient, userId: string) {
    const cart = await tx.cart.findUnique({ where: { userId } });
    if (cart) return cart;
    return tx.cart.create({ data: { userId, status: 'ACTIVE' } });
  }

  /**
   * A line of a cart, locked by its identifier
   *
   * The lock is the row lock of the line, the same lock the consumption of
   * the purchased lines takes, and the lock is scoped to the cart of the
   * caller: a line of another cart is neither locked nor found.
   *
   * A writer that locks a single line has no order of its own, so it is
   * consistent with the global order of the line locks of a cart.
   *
   * @param tx The transaction client of the write
   * @param cartId The identifier of the cart that owns the line
   * @param itemId The identifier of the line
   * @returns Promise resolving to the locked line, null when the cart does not
   *          hold the line
   * @private
   */
  private static async lockCartLineById(
    tx: Prisma.TransactionClient,
    cartId: string,
    itemId: string
  ): Promise<LockedCartLine | null> {
    const rows: Array<{ id: string; productId: string; variantId: string; quantity: number }> = await tx.$queryRaw`
      SELECT id, "productId", "variantId", quantity FROM public.cart_items
      WHERE id = ${itemId} AND "cartId" = ${cartId} FOR UPDATE
    `;
    if (!rows.length) return null;
    const row = rows[0];
    return {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      quantity: Number(row.quantity)
    };
  }

  /**
   * The lines of a cart, locked in the order of the database
   *
   * The lock of every line of the cart is the row lock of that line, the
   * same lock the consumption of the purchased lines takes. The lines are
   * locked in the order of their variant, and that order comes from the
   * database, so every writer of a cart that locks more than one line locks
   * the lines of that cart in the same order and cannot deadlock with another
   * writer of that cart.
   *
   * The order of the line locks of a cart is global: the order of the
   * variants under the collation of the database. It must not change, because
   * a writer that locks the lines of a cart in another order can deadlock
   * with a writer that locks them in this order. A writer that locks a single
   * line has no order at all and is consistent with it.
   *
   * @param tx The transaction client of the write
   * @param cartId The identifier of the cart that owns the lines
   * @param variantIds The variants of the lines to lock, every line of the
   *                   cart when the list is omitted
   * @returns Promise resolving to the locked lines, in the order of the locks
   * @private
   */
  private static async lockCartLines(
    tx: CartLineLockTx,
    cartId: string,
    variantIds?: string[]
  ): Promise<LockedCartLine[]> {
    if (variantIds && variantIds.length === 0) return [];

    // The rows are sorted by the database before they are locked, so the locks
    // are taken in the order of the variants under the collation of the
    // database. That order is the one and only order of the line locks.
    const rows: Array<{ id: string; productId: string; variantId: string; quantity: number }> = variantIds
      ? await tx.$queryRaw`
          SELECT id, "productId", "variantId", quantity FROM public.cart_items
          WHERE "cartId" = ${cartId} AND "variantId" IN (${Prisma.join(variantIds)})
          ORDER BY "variantId" FOR UPDATE
        `
      : await tx.$queryRaw`
          SELECT id, "productId", "variantId", quantity FROM public.cart_items
          WHERE "cartId" = ${cartId}
          ORDER BY "variantId" FOR UPDATE
        `;

    return rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      quantity: Number(row.quantity)
    }));
  }

  /**
   * The stock ceiling of a line, read under the lock of the line.
   *
   * Only the stock is read here: the catalogue of the product was already
   * read by the caller, and reading the whole catalogue again would make
   * every add to a cart run the catalogue queries twice. The stock is read
   * under the lock of the line and never under the lock of the stock row: the
   * order path takes the stock row first and the line row second, so taking
   * the stock row here would invert that order and deadlock with the order
   * path. The ceiling is therefore advisory, and the authoritative guard is
   * the conditional decrement of the sale, which refuses the sale when the
   * stock is not there.
   */
  private static async lockedStockCeiling(
    tx: Prisma.TransactionClient,
    product: { productType: string },
    variantId: string
  ): Promise<number> {
    const stock = await ProductService.getVariantStockLevels([variantId], tx);
    const level = stock.get(variantId);
    if (level === undefined) {
      throw new ApiError('NOT_FOUND');
    }
    return stockCeilingFor(product.productType, level);
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
      include: { items: true }
    });

    if (!cart) return null;

    const catalog = await ProductService.getSellableCatalog(
      prisma,
      cart.items.map((item) => item.productId)
    );

    const items: CartItem[] = cart.items.map(item => {
      const product = catalog.get(item.productId);
      const variant = product?.variants.find((entry) => entry.id === item.variantId);
      if (!variant) throw new ApiError('NOT_FOUND');
      const typeData = parseJsonRecord(product?.typeData);
      const images = Array.isArray(typeData?.images)
        ? typeData?.images.filter((image): image is string => typeof image === 'string')
        : [];
      const availableStock = variant.stock;
      const unitPrice = variant.salePrice;
      // The shipping requirement of a cart line is the shared address rule of
      // a line, the same rule the order placement resolves, so the cart and
      // the order answer the address of a line the same way.
      const productType = product?.productType ?? '';
      return {
        id: item.id,
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        productImage: images[0] || '',
        price: unitPrice,
        quantity: item.quantity,
        variantId: item.variantId,
        variantName: variant?.name || undefined,
        variantAttributes: parseJsonRecord(variant?.attributes),
        requiresShipping: lineRequiresShippingAddress(productType, product?.requiresShipping ?? true),
        maxQuantity: stockCeilingFor(productType, availableStock),
        subtotal: unitPrice * item.quantity,
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
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
  }

}
