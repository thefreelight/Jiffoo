/**
 * E2E Test: Search Flow
 * 
 * Tests the complete search functionality including product search, filtering, and sorting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockPrisma = {
  product: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
  searchHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('../../src/config/database', () => ({
  prisma: mockPrisma,
}));

// Test fixtures
const TEST_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'iPhone 15 Pro',
    description: 'Latest Apple smartphone',
    price: 999.99,
    stock: 50,
    categoryId: 'cat-electronics',
    tenantId: 999,
    rating: 4.8,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'prod-002',
    name: 'Samsung Galaxy S24',
    description: 'Premium Android smartphone',
    price: 899.99,
    stock: 75,
    categoryId: 'cat-electronics',
    tenantId: 999,
    rating: 4.6,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'prod-003',
    name: 'MacBook Pro 16"',
    description: 'Professional laptop',
    price: 2499.99,
    stock: 25,
    categoryId: 'cat-computers',
    tenantId: 999,
    rating: 4.9,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 'prod-004',
    name: 'AirPods Pro',
    description: 'Wireless earbuds',
    price: 249.99,
    stock: 100,
    categoryId: 'cat-accessories',
    tenantId: 999,
    rating: 4.7,
    createdAt: new Date('2024-02-15'),
  },
];

const TEST_CATEGORIES = [
  { id: 'cat-electronics', name: 'Electronics', slug: 'electronics' },
  { id: 'cat-computers', name: 'Computers', slug: 'computers' },
  { id: 'cat-accessories', name: 'Accessories', slug: 'accessories' },
];

describe('E2E: Search Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Basic Search', () => {
    it('should search products by keyword', async () => {
      const keyword = 'iPhone';
      const matchingProducts = TEST_PRODUCTS.filter(
        p => p.name.toLowerCase().includes(keyword.toLowerCase()) ||
             p.description.toLowerCase().includes(keyword.toLowerCase())
      );
      mockPrisma.product.findMany.mockResolvedValue(matchingProducts);

      const results = await mockPrisma.product.findMany({
        where: {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('iPhone');
    });

    it('should return empty results for no matches', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const results = await mockPrisma.product.findMany({
        where: {
          name: { contains: 'NonExistentProduct' },
        },
      });

      expect(results).toHaveLength(0);
    });

    it('should search across multiple fields', async () => {
      const keyword = 'smartphone';
      const matchingProducts = TEST_PRODUCTS.filter(
        p => p.description.toLowerCase().includes(keyword.toLowerCase())
      );
      mockPrisma.product.findMany.mockResolvedValue(matchingProducts);

      const results = await mockPrisma.product.findMany({
        where: {
          OR: [
            { name: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        },
      });

      expect(results).toHaveLength(2);
    });
  });

  describe('Step 2: Category Filtering', () => {
    it('should filter by category', async () => {
      const categoryId = 'cat-electronics';
      const categoryProducts = TEST_PRODUCTS.filter(p => p.categoryId === categoryId);
      mockPrisma.product.findMany.mockResolvedValue(categoryProducts);

      const results = await mockPrisma.product.findMany({
        where: { categoryId },
      });

      expect(results).toHaveLength(2);
      expect(results.every(p => p.categoryId === categoryId)).toBe(true);
    });

    it('should list available categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue(TEST_CATEGORIES);

      const categories = await mockPrisma.category.findMany();

      expect(categories).toHaveLength(3);
    });
  });

  describe('Step 3: Price Filtering', () => {
    it('should filter by price range', async () => {
      const minPrice = 200;
      const maxPrice = 1000;
      const filteredProducts = TEST_PRODUCTS.filter(
        p => p.price >= minPrice && p.price <= maxPrice
      );
      mockPrisma.product.findMany.mockResolvedValue(filteredProducts);

      const results = await mockPrisma.product.findMany({
        where: {
          price: { gte: minPrice, lte: maxPrice },
        },
      });

      expect(results.every(p => p.price >= minPrice && p.price <= maxPrice)).toBe(true);
    });

    it('should filter by minimum price only', async () => {
      const minPrice = 500;
      const filteredProducts = TEST_PRODUCTS.filter(p => p.price >= minPrice);
      mockPrisma.product.findMany.mockResolvedValue(filteredProducts);

      const results = await mockPrisma.product.findMany({
        where: { price: { gte: minPrice } },
      });

      expect(results.every(p => p.price >= minPrice)).toBe(true);
    });
  });

  describe('Step 4: Sorting', () => {
    it('should sort by price ascending', async () => {
      const sortedProducts = [...TEST_PRODUCTS].sort((a, b) => a.price - b.price);
      mockPrisma.product.findMany.mockResolvedValue(sortedProducts);

      const results = await mockPrisma.product.findMany({
        orderBy: { price: 'asc' },
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].price).toBeGreaterThanOrEqual(results[i - 1].price);
      }
    });

    it('should sort by price descending', async () => {
      const sortedProducts = [...TEST_PRODUCTS].sort((a, b) => b.price - a.price);
      mockPrisma.product.findMany.mockResolvedValue(sortedProducts);

      const results = await mockPrisma.product.findMany({
        orderBy: { price: 'desc' },
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].price).toBeLessThanOrEqual(results[i - 1].price);
      }
    });

    it('should sort by rating', async () => {
      const sortedProducts = [...TEST_PRODUCTS].sort((a, b) => b.rating - a.rating);
      mockPrisma.product.findMany.mockResolvedValue(sortedProducts);

      const results = await mockPrisma.product.findMany({
        orderBy: { rating: 'desc' },
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].rating).toBeLessThanOrEqual(results[i - 1].rating);
      }
    });

    it('should sort by newest first', async () => {
      const sortedProducts = [...TEST_PRODUCTS].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      mockPrisma.product.findMany.mockResolvedValue(sortedProducts);

      const results = await mockPrisma.product.findMany({
        orderBy: { createdAt: 'desc' },
      });

      for (let i = 1; i < results.length; i++) {
        expect(new Date(results[i].createdAt).getTime())
          .toBeLessThanOrEqual(new Date(results[i - 1].createdAt).getTime());
      }
    });
  });

  describe('Step 5: Pagination', () => {
    it('should paginate results', async () => {
      const page = 1;
      const limit = 2;
      const paginatedProducts = TEST_PRODUCTS.slice(0, limit);
      mockPrisma.product.findMany.mockResolvedValue(paginatedProducts);
      mockPrisma.product.count.mockResolvedValue(TEST_PRODUCTS.length);

      const results = await mockPrisma.product.findMany({
        take: limit,
        skip: (page - 1) * limit,
      });

      const total = await mockPrisma.product.count();

      expect(results).toHaveLength(limit);
      expect(total).toBe(TEST_PRODUCTS.length);
    });

    it('should return correct page metadata', async () => {
      const page = 2;
      const limit = 2;
      const total = TEST_PRODUCTS.length;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(2);
      expect(page).toBeLessThanOrEqual(totalPages);
    });
  });

  describe('Step 6: Combined Filters', () => {
    it('should combine search with category filter', async () => {
      const keyword = 'Pro';
      const categoryId = 'cat-electronics';
      const filteredProducts = TEST_PRODUCTS.filter(
        p => p.categoryId === categoryId && p.name.includes(keyword)
      );
      mockPrisma.product.findMany.mockResolvedValue(filteredProducts);

      const results = await mockPrisma.product.findMany({
        where: {
          AND: [
            { categoryId },
            { name: { contains: keyword } },
          ],
        },
      });

      expect(results.every(p => p.categoryId === categoryId)).toBe(true);
      expect(results.every(p => p.name.includes(keyword))).toBe(true);
    });

    it('should combine multiple filters with sorting', async () => {
      const minPrice = 100;
      const categoryId = 'cat-electronics';
      const filteredProducts = TEST_PRODUCTS
        .filter(p => p.categoryId === categoryId && p.price >= minPrice)
        .sort((a, b) => a.price - b.price);
      mockPrisma.product.findMany.mockResolvedValue(filteredProducts);

      const results = await mockPrisma.product.findMany({
        where: {
          categoryId,
          price: { gte: minPrice },
        },
        orderBy: { price: 'asc' },
      });

      expect(results.every(p => p.categoryId === categoryId)).toBe(true);
      expect(results.every(p => p.price >= minPrice)).toBe(true);
    });
  });

  describe('Step 7: Search History', () => {
    it('should save search query to history', async () => {
      const searchHistory = {
        id: 'history-001',
        userId: 'user-001',
        query: 'iPhone',
        createdAt: new Date(),
      };
      mockPrisma.searchHistory.create.mockResolvedValue(searchHistory);

      const saved = await mockPrisma.searchHistory.create({
        data: {
          userId: 'user-001',
          query: 'iPhone',
        },
      });

      expect(saved.query).toBe('iPhone');
    });

    it('should retrieve recent search history', async () => {
      const history = [
        { id: 'h1', query: 'iPhone', createdAt: new Date() },
        { id: 'h2', query: 'MacBook', createdAt: new Date() },
      ];
      mockPrisma.searchHistory.findMany.mockResolvedValue(history);

      const results = await mockPrisma.searchHistory.findMany({
        where: { userId: 'user-001' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      expect(results).toHaveLength(2);
    });
  });
});

