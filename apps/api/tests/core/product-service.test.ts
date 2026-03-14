/**
 * ProductService Unit Tests
 *
 * Coverage:
 * - getPublicProducts: pagination (page/limit), search filter, cache hit returns cached,
 *   basic result formatting (price from min variant, stock from sum, images from typeData)
 * - getProductById: success path returns DTO, product not found returns null,
 *   translations applied when locale differs from default
 * - searchProducts: returns results with pagination
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - declared before the service import so vi.mock hoisting works
// ---------------------------------------------------------------------------

vi.mock('@/config/database', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    productTranslation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    externalProductLink: {
      findMany: vi.fn(),
    },
    externalVariantLink: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    getProductVersion: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/core/inventory/service', () => ({
  InventoryService: {
    getAvailableStockByVariantIds: vi.fn(),
    getVariantIdsByAvailability: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ProductService } from '@/core/product/service';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { InventoryService } from '@/core/inventory/service';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  product: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  productTranslation: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  category: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  externalProductLink: {
    findMany: ReturnType<typeof vi.fn>;
  };
  externalVariantLink: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockCache = CacheService as unknown as {
  getProductVersion: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

const mockInventory = InventoryService as unknown as {
  getAvailableStockByVariantIds: ReturnType<typeof vi.fn>;
  getVariantIdsByAvailability: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_PRODUCT = {
  id: 'prod-1',
  name: 'Test Widget',
  description: 'A fine widget',
  typeData: JSON.stringify({ images: ['img1.jpg', 'img2.jpg'] }),
  createdAt: new Date('2025-06-01T12:00:00Z'),
  updatedAt: new Date('2025-06-01T12:00:00Z'),
  requiresShipping: true,
  variants: [
    { id: 'var-1', name: 'Small', skuCode: 'WDG-S', salePrice: 9.99, isActive: true, attributes: '{"size":"S"}' },
    { id: 'var-2', name: 'Large', skuCode: 'WDG-L', salePrice: 19.99, isActive: true, attributes: '{"size":"L"}' },
  ],
};

const MOCK_PRODUCT_2 = {
  id: 'prod-2',
  name: 'Another Gadget',
  description: 'A useful gadget',
  typeData: JSON.stringify({ images: ['gadget.jpg'] }),
  createdAt: new Date('2025-06-02T12:00:00Z'),
  updatedAt: new Date('2025-06-02T12:00:00Z'),
  requiresShipping: false,
  variants: [
    { id: 'var-3', name: 'Default', skuCode: 'GDG-D', salePrice: 14.99, isActive: true, attributes: '{}' },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply default mock returns
    mockCache.getProductVersion.mockResolvedValue(1);
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(true);
    mockPrisma.externalProductLink.findMany.mockResolvedValue([]);
    mockPrisma.externalVariantLink.findMany.mockResolvedValue([]);
    mockInventory.getVariantIdsByAvailability.mockResolvedValue([]);
    mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map());
  });

  // -----------------------------------------------------------------------
  // getPublicProducts
  // -----------------------------------------------------------------------

  describe('getPublicProducts', () => {
    it('should return paginated products with correct page/limit metadata', async () => {
      mockPrisma.product.findMany.mockResolvedValue([MOCK_PRODUCT, MOCK_PRODUCT_2]);
      mockPrisma.product.count.mockResolvedValue(2);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([
        ['var-1', 50],
        ['var-2', 30],
        ['var-3', 100],
      ]));

      const result = await ProductService.getPublicProducts(1, 10);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );

      expect(result).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(2);
    });

    it('should format price as min variant price and stock as sum of variant stocks', async () => {
      mockPrisma.product.findMany.mockResolvedValue([MOCK_PRODUCT]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([
        ['var-1', 50],
        ['var-2', 30],
      ]));

      const result = await ProductService.getPublicProducts(1, 10);

      const item = result.items[0];
      // Price should be minimum of 9.99 and 19.99
      expect(item.price).toBe(9.99);
      // Stock should be 50 + 30 = 80
      expect(item.stock).toBe(80);
      // Images parsed from typeData
      expect(item.images).toEqual(['img1.jpg', 'img2.jpg']);
    });

    it('should apply search filter to name and description', async () => {
      mockPrisma.product.findMany.mockResolvedValue([MOCK_PRODUCT]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([
        ['var-1', 50],
        ['var-2', 30],
      ]));

      await ProductService.getPublicProducts(1, 10, { search: 'Widget' });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'Widget', mode: 'insensitive' } },
              { description: { contains: 'Widget', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should return cached result on cache hit without querying database', async () => {
      const cachedResult = {
        items: [{ id: 'prod-cached', name: 'Cached' }],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      };
      mockCache.get.mockResolvedValue(cachedResult);

      const result = await ProductService.getPublicProducts(1, 10);

      expect(result).toEqual(cachedResult);
      // Database should NOT have been called
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.product.count).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getProductById
  // -----------------------------------------------------------------------

  describe('getProductById', () => {
    it('should return a consumer-facing DTO with price, stock, and images', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(MOCK_PRODUCT);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([
        ['var-1', 50],
        ['var-2', 30],
      ]));

      const result = await ProductService.getProductById('prod-1');

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        id: 'prod-1',
        name: 'Test Widget',
        description: 'A fine widget',
        price: 9.99,
        stock: 80,
        requiresShipping: true,
        images: ['img1.jpg', 'img2.jpg'],
      });
      // Variants should be formatted with parsed attributes
      expect(result!.variants).toHaveLength(2);
      expect(result!.variants[0]).toMatchObject({
        id: 'var-1',
        name: 'Small',
        skuCode: 'WDG-S',
        salePrice: 9.99,
        baseStock: 50,
        attributes: { size: 'S' },
      });
    });

    it('should return null when product is not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      const result = await ProductService.getProductById('nonexistent');

      expect(result).toBeNull();
      // Should not attempt to cache a null result
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should apply translation when locale differs from default', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(MOCK_PRODUCT);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([
        ['var-1', 50],
        ['var-2', 30],
      ]));
      mockPrisma.productTranslation.findUnique.mockResolvedValue({
        productId: 'prod-1',
        locale: 'zh-Hant',
        name: '測試小工具',
        description: '一個精緻的小工具',
      });

      const result = await ProductService.getProductById('prod-1', 'zh-Hant');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('測試小工具');
      expect(result!.description).toBe('一個精緻的小工具');

      // Should have queried translation
      expect(mockPrisma.productTranslation.findUnique).toHaveBeenCalledWith({
        where: {
          productId_locale: { productId: 'prod-1', locale: 'zh-Hant' },
        },
      });
    });
  });

  // -----------------------------------------------------------------------
  // searchProducts
  // -----------------------------------------------------------------------

  describe('searchProducts', () => {
    it('should return matching products with pagination metadata', async () => {
      mockPrisma.product.findMany.mockResolvedValue([MOCK_PRODUCT]);
      mockPrisma.product.count.mockResolvedValue(1);
      mockInventory.getAvailableStockByVariantIds.mockResolvedValue(new Map([
        ['var-1', 50],
        ['var-2', 30],
      ]));

      const result = await ProductService.searchProducts('Widget', 1, 10);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            variants: {
              where: { isActive: true },
            },
          },
          where: {
            isActive: true,
            OR: [
              { name: { contains: 'Widget', mode: 'insensitive' } },
              { description: { contains: 'Widget', mode: 'insensitive' } },
            ],
          },
          skip: 0,
          take: 10,
        })
      );

      expect(result).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'prod-1',
        name: 'Test Widget',
        price: 9.99,
        stock: 80,
        images: ['img1.jpg', 'img2.jpg'],
      });
    });
  });
});
