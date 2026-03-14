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
  productType?: string;
  requiresShipping?: boolean;
  typeData?: Record<string, unknown>;
  skuCode?: string;
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
  const store = await getOrCreateTestStore(prisma);

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

  const product = await prisma.product.create({
    data: {
      id,
      name: options.name || `Test Product ${id.substring(0, 8)}`,
      slug: `product-${id}`, // Mandatory unique slug
      description: options.description || 'A test product description',
      productType: options.productType || 'physical',
      requiresShipping: options.requiresShipping ?? true,
      typeData: options.typeData ?? (options.images ? { images: options.images } : null),
      storeId: store.id,
      // price/stock moved to ProductVariant
      categoryId,
      variants: {
        create: [
          {
            name: 'Base Variant',
            salePrice: options.price ?? 99.99,
            baseStock: options.stock ?? 100,
            isActive: true,
            skuCode: options.skuCode,
          }
        ]
      }
    },
    include: {
      variants: true
    }
  });

  const defaultWarehouse = await prisma.warehouse.upsert({
    where: { code: 'TEST' },
    update: { isDefault: true },
    create: {
      id: 'test-warehouse',
      name: 'Test Warehouse',
      code: 'TEST',
      isActive: true,
      isDefault: true,
    },
  });

  const variant = product.variants[0];
  if (variant) {
    const stock = Math.max(0, Math.trunc(Number(options.stock ?? 100)));
    await prisma.warehouseInventory.upsert({
      where: {
        warehouseId_variantId: {
          warehouseId: defaultWarehouse.id,
          variantId: variant.id,
        },
      },
      update: {
        quantity: stock,
        reserved: 0,
        available: stock,
        lowStock: 10,
      },
      create: {
        warehouseId: defaultWarehouse.id,
        variantId: variant.id,
        quantity: stock,
        reserved: 0,
        available: stock,
        lowStock: 10,
      },
    });
  }

  return product;
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

  // If no variantId provided, use the first available variant for product
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
    const variant = product.variants[0];
    variantId = variantId || variant.id;
    price = price || variant.salePrice;
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

async function getOrCreateTestStore(prisma: ReturnType<typeof getTestPrisma>) {
  const storeId = process.env.STORE_DEFAULT_ID || 'test-store';
  return prisma.store.upsert({
    where: { slug: 'test-store' },
    update: {
      name: 'Test Store',
      status: 'active',
      currency: 'USD',
      defaultLocale: 'en',
    },
    create: {
      id: storeId,
      name: 'Test Store',
      slug: 'test-store',
      status: 'active',
      currency: 'USD',
      defaultLocale: 'en',
    },
  });
}

export async function createTestOrder(options: CreateOrderOptions) {
  const prisma = getTestPrisma();
  const id = uuidv4();
  const store = await getOrCreateTestStore(prisma);
  const totalAmount = options.total ?? 0;

  return prisma.order.create({
    data: {
      id,
      userId: options.userId,
      storeId: store.id,
      status: options.status || 'PENDING',
      paymentStatus: 'PENDING',
      subtotalAmount: totalAmount,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount,
      currency: 'USD',
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

  // If no variantId provided, use the first available variant for product
  let variantId = options.variantId;
  let unitPrice = options.price;

  if (!variantId) {
    const product = await prisma.product.findUnique({
      where: { id: options.productId },
      include: { variants: true }
    });
    if (product && product.variants.length > 0) {
      const variant = product.variants[0];
      variantId = variant.id;
      if (!unitPrice) unitPrice = variant.salePrice;
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
      const price = p.product.variants?.[0]?.salePrice ?? p.product.price ?? 0;
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
      price: variant?.salePrice ?? product.price,
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
  await prisma.reorderAlert.deleteMany({});
  await prisma.inventoryForecast.deleteMany({});
  await prisma.productTranslation.deleteMany({});
  // Variants are referenced by cart items in several route suites.
  await prisma.cartItem.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.externalVariantLink.deleteMany({});
  await prisma.externalProductLink.deleteMany({});
  await prisma.externalCategoryLink.deleteMany({});
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
  // Delete dependent records first to avoid FK constraint violations
  await prisma.externalOrderLink.deleteMany({});
  await prisma.shipmentItem.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.inventoryReservation.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderShippingAddress.deleteMany({});
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
