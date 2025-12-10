/**
 * Product Factory - 产品测试数据工厂
 *
 * 用于创建测试用的产品数据
 */

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string;
  tenantId: number;
  categoryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

let productIdCounter = 1;

export const createMockProduct = (overrides: Partial<MockProduct> = {}): MockProduct => {
  const id = overrides.id || `product-${productIdCounter++}`;

  return {
    id,
    name: `测试商品 ${id}`,
    description: `这是测试商品 ${id} 的描述`,
    price: 99.99,
    stock: 100,
    images: `https://example.com/product-${id}.jpg`,
    tenantId: 1,
    categoryId: 'category-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
};

export const createMockProducts = (count: number, overrides: Partial<MockProduct> = {}): MockProduct[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockProduct({
      id: `product-${index + 1}`,
      name: `测试商品 ${index + 1}`,
      ...overrides,
    })
  );
};

/**
 * 创建缺货商品
 */
export const createOutOfStockProduct = (overrides: Partial<MockProduct> = {}): MockProduct => {
  return createMockProduct({
    stock: 0,
    ...overrides,
  });
};

/**
 * 创建低库存商品
 */
export const createLowStockProduct = (stock: number, overrides: Partial<MockProduct> = {}): MockProduct => {
  return createMockProduct({
    stock,
    ...overrides,
  });
};

/**
 * 重置产品ID计数器（用于测试隔离）
 */
export const resetProductIdCounter = () => {
  productIdCounter = 1;
};
