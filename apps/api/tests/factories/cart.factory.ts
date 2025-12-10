/**
 * Cart Factory - 购物车测试数据工厂
 *
 * 用于创建测试用的购物车和购物车项数据
 */

import { createMockProduct, MockProduct } from './product.factory';

export interface MockCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  price: number;
  variantId?: string | null;
  tenantId: number;
  product?: MockProduct;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCart {
  id: string;
  userId: string;
  tenantId: number;
  status: string;
  items: MockCartItem[];
  createdAt: Date;
  updatedAt: Date;
}

let cartIdCounter = 1;
let cartItemIdCounter = 1;

/**
 * 创建模拟购物车
 */
export const createMockCart = (overrides: Partial<MockCart> = {}): MockCart => {
  const id = overrides.id || `cart-${cartIdCounter++}`;

  return {
    id,
    userId: 'user-123',
    tenantId: 1,
    status: 'ACTIVE',
    items: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
};

/**
 * 创建模拟购物车项
 */
export const createMockCartItem = (overrides: Partial<MockCartItem> = {}): MockCartItem => {
  const id = overrides.id || `cart-item-${cartItemIdCounter++}`;
  const product = overrides.product || createMockProduct();

  return {
    id,
    cartId: 'cart-1',
    productId: product.id,
    quantity: 1,
    price: product.price,
    variantId: null,
    tenantId: 1,
    product,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
};

/**
 * 创建带商品的购物车
 */
export const createMockCartWithItems = (
  itemCount: number,
  overrides: Partial<MockCart> = {}
): MockCart => {
  const cart = createMockCart(overrides);

  cart.items = Array.from({ length: itemCount }, (_, index) => {
    const product = createMockProduct({ id: `product-${index + 1}` });
    return createMockCartItem({
      id: `cart-item-${index + 1}`,
      cartId: cart.id,
      productId: product.id,
      quantity: index + 1,
      price: product.price,
      product,
      tenantId: cart.tenantId,
    });
  });

  return cart;
};

/**
 * 创建空购物车
 */
export const createEmptyCart = (userId: string = 'user-123', tenantId: number = 1): MockCart => {
  return createMockCart({
    userId,
    tenantId,
    items: [],
  });
};

/**
 * 重置购物车ID计数器（用于测试隔离）
 */
export const resetCartIdCounter = () => {
  cartIdCounter = 1;
};

/**
 * 重置购物车项ID计数器（用于测试隔离）
 */
export const resetCartItemIdCounter = () => {
  cartItemIdCounter = 1;
};

/**
 * 重置所有计数器
 */
export const resetAllCounters = () => {
  resetCartIdCounter();
  resetCartItemIdCounter();
};
