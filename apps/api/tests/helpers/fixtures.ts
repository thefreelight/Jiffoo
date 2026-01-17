/**
 * Data Fixtures for Tests
 * 
 * Provides factory functions for creating test data:
 * - Products
 * - Cart items
 * - Orders
 * - etc.
 */

import { getTestPrisma } from './db';
import { v4 as uuidv4 } from 'uuid';
import type { TestUser } from './auth';

// ============================================
// Product Fixtures
// ============================================

export interface CreateProductOptions {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  /**
   * Category identifier used by tests.
   * Most tests pass a slug-like string (e.g. "electronics"), not a DB id.
   */
  category?: string;
  images?: string[];
}

export async function createTestProduct(options: CreateProductOptions = {}) {
  const prisma = getTestPrisma();
  const id = uuidv4();

  let categoryId: string | undefined;
  if (options.category) {
    // Accept either an actual Category id or a slug-like string.
    const existingById = await prisma.category.findUnique({
      where: { id: options.category },
      select: { id: true },
    });

    if (existingById) {
      categoryId = existingById.id;
    } else {
      // Treat as slug; create if missing.
      const slug = options.category.trim().toLowerCase().replace(/\s+/g, '-');
      const category = await prisma.category.upsert({
        where: { slug },
        update: {},
        create: {
          name: options.category,
          slug,
        },
        select: { id: true },
      });
      categoryId = category.id;
    }
  }

  return prisma.product.create({
    data: {
      id,
      name: options.name || `Test Product ${id.substring(0, 8)}`,
      slug: `product-${id}`, // Mandatory unique slug
      description: options.description || 'A test product description',
      productType: 'physical',
      // price/stock moved to ProductVariant
      categoryId,
      variants: {
        create: [
          {
            name: 'Default Variant',
            basePrice: options.price ?? 99.99,
            baseStock: options.stock ?? 100,
            isDefault: true,
            isActive: true
          }
        ]
      }
    },
    include: {
      variants: true
    }
  });
}

export async function createMultipleProducts(count: number, options: CreateProductOptions = {}) {
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push(await createTestProduct({
      ...options,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    }));
  }
  return products;
}

// ============================================
// Cart Fixtures
// ============================================

export interface CreateCartOptions {
  userId: string;
}

export async function createTestCart(options: CreateCartOptions) {
  const prisma = getTestPrisma();
  const id = uuidv4();

  return prisma.cart.create({
    data: {
      id,
      userId: options.userId,
    },
  });
}

export interface CreateCartItemOptions {
  cartId: string;
  productId: string;
  variantId?: string;
  quantity?: number;
  price?: number;
}

export async function createTestCartItem(options: CreateCartItemOptions) {
  const prisma = getTestPrisma();
  const id = uuidv4();

  // If no variantId provided, try to find default variant for product
  let variantId = options.variantId;
  let price = options.price;

  if (!variantId || !price) {
    const product = await prisma.product.findUnique({
      where: { id: options.productId },
      include: { variants: true }
    });
    if (!product || !product.variants.length) {
      throw new Error(`Product ${options.productId} has no variants, cannot create cart item`);
    }
    const defaultVariant = product.variants.find(v => v.isDefault) || product.variants[0];
    variantId = variantId || defaultVariant.id;
    price = price || defaultVariant.basePrice;
  }

  return prisma.cartItem.create({
    data: {
      id,
      cartId: options.cartId,
      productId: options.productId,
      variantId: variantId!,
      quantity: options.quantity ?? 1,
      price: price!,
    },
  });
}

/**
 * Create a cart with items for a user
 */
export async function createCartWithItems(user: TestUser, products: any[]) {
  const cart = await createTestCart({ userId: user.id });

  const items = [];
  for (const product of products) {
    const item = await createTestCartItem({
      cartId: cart.id,
      productId: product.id,
      quantity: 1,
    });
    items.push(item);
  }

  return { cart, items };
}

// ============================================
// Order Fixtures
// ============================================

export interface CreateOrderOptions {
  userId: string;
  status?: string;
  total?: number; // kept for backward compat, mapped to totalAmount
}

export async function createTestOrder(options: CreateOrderOptions) {
  const prisma = getTestPrisma();
  const id = uuidv4();

  return prisma.order.create({
    data: {
      id,
      userId: options.userId,
      status: options.status || 'PENDING',
      totalAmount: options.total ?? 0,
    },
  });
}

export interface CreateOrderItemOptions {
  orderId: string;
  productId: string;
  variantId?: string;
  quantity?: number;
  price?: number; // Mapped to unitPrice
}

export async function createTestOrderItem(options: CreateOrderItemOptions) {
  const prisma = getTestPrisma();
  const id = uuidv4();

  // If no variantId provided, try to find default variant for product
  let variantId = options.variantId;
  let unitPrice = options.price;

  if (!variantId) {
    const product = await prisma.product.findUnique({
      where: { id: options.productId },
      include: { variants: true }
    });
    if (product && product.variants.length > 0) {
      const defaultVariant = product.variants.find(v => v.isDefault) || product.variants[0];
      variantId = defaultVariant.id;
      if (!unitPrice) unitPrice = defaultVariant.basePrice;
    } else {
      // Fallback for tests that might mock products or rely on loose constraints (though DB will fail)
      variantId = 'missing-variant-id';
    }
  }

  return prisma.orderItem.create({
    data: {
      id,
      orderId: options.orderId,
      productId: options.productId,
      variantId: variantId!,
      quantity: options.quantity ?? 1,
      unitPrice: unitPrice ?? 99.99,
    },
  });
}

/**
 * Create an order with items
 */
export async function createOrderWithItems(
  user: TestUser,
  products: Array<{ product: any; quantity?: number }>
) {

  // Calculate total from variants if available (test products usually have them now)
  const total = products.reduce(
    (sum, p) => {
      const price = p.product.variants?.[0]?.basePrice ?? p.product.price ?? 0;
      return sum + price * (p.quantity ?? 1);
    },
    0
  );

  const order = await createTestOrder({
    userId: user.id,
    total,
  });

  const items = [];
  for (const { product, quantity } of products) {
    const variant = product.variants?.[0];
    const item = await createTestOrderItem({
      orderId: order.id,
      productId: product.id,
      variantId: variant?.id,
      quantity: quantity ?? 1,
      price: variant?.basePrice ?? product.price,
    });
    items.push(item);
  }

  return { order, items };
}

// ============================================
// Cleanup Helpers
// ============================================

export async function deleteTestProduct(productId: string) {
  const prisma = getTestPrisma();
  try {
    await prisma.product.delete({ where: { id: productId } });
  } catch (e) {
    // Ignore if doesn't exist
  }
}

export async function deleteAllTestProducts() {
  const prisma = getTestPrisma();
  // Clean all products created during tests, not just 'Test Product'
  // But to be safe, we look for those containing 'Test' or specific prefix patterns
  // or simply delete all if it's a dedicated test DB (but that's dangerous).
  // Following user instruction: "createTestProducts" and various others create "Cart Test Product", "Order Test Product", etc.
  // The safest broad filter for this suite:
  await prisma.product.deleteMany({
    where: {
      OR: [
        { name: { contains: 'Test Product' } },
        { name: { contains: 'Test' } }, // Cart Test Product, etc.
        { slug: { startsWith: 'product-' } } // UUID based slugs
      ]
    },
  });
}

export async function deleteTestOrder(orderId: string) {
  const prisma = getTestPrisma();
  try {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  } catch (e) {
    // Ignore if doesn't exist
  }
}

export async function deleteAllTestOrders() {
  const prisma = getTestPrisma();
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
}

export async function deleteAllTestCarts() {
  const prisma = getTestPrisma();
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
}

/**
 * Clean all test data
 */
export async function cleanAllFixtures() {
  await deleteAllTestOrders();
  await deleteAllTestCarts();
  await deleteAllTestProducts();
}
