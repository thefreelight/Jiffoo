/**
 * Pagination Property Tests
 * 
 * Property-based tests for pagination invariants using fast-check
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Pure pagination functions

interface PaginationParams {
  page: number;
  pageSize: number;
  totalItems: number;
}

interface PaginationResult {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  skip: number;
  take: number;
}

/**
 * Calculate pagination metadata
 */
function calculatePagination(params: PaginationParams): PaginationResult {
  const { page, pageSize, totalItems } = params;
  
  // Normalize inputs
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.max(1, Math.min(100, pageSize)); // Cap at 100
  
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const actualPage = Math.min(normalizedPage, totalPages);
  
  return {
    page: actualPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages,
    hasNextPage: actualPage < totalPages,
    hasPrevPage: actualPage > 1,
    skip: (actualPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
  };
}

/**
 * Get items for a specific page
 */
function getPageItems<T>(items: T[], skip: number, take: number): T[] {
  return items.slice(skip, skip + take);
}

/**
 * Calculate offset-based pagination
 */
function calculateOffset(page: number, pageSize: number): number {
  return Math.max(0, (page - 1) * pageSize);
}

describe('Pagination Property Tests', () => {
  describe('Page Number Invariants', () => {
    it('should always return page >= 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }), // page (can be negative)
          fc.integer({ min: 1, max: 100 }),    // pageSize
          fc.integer({ min: 0, max: 10000 }),  // totalItems
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.page).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never exceed totalPages', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),   // page (can be very high)
          fc.integer({ min: 1, max: 100 }),    // pageSize
          fc.integer({ min: 0, max: 10000 }),  // totalItems
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.page).toBeLessThanOrEqual(result.totalPages);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Total Pages Invariants', () => {
    it('should always be >= 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10000 }),
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.totalPages).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should equal ceil(totalItems / pageSize) when totalItems > 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 10000 }), // totalItems > 0
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            const expected = Math.ceil(totalItems / result.pageSize);
            expect(result.totalPages).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Navigation Flags Invariants', () => {
    it('should have hasPrevPage = false on first page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10000 }),
          (pageSize, totalItems) => {
            const result = calculatePagination({ page: 1, pageSize, totalItems });
            expect(result.hasPrevPage).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have hasNextPage = false on last page', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 500 }), // Limit totalItems so page 1000 is always beyond
          (pageSize, totalItems) => {
            // Calculate actual last page
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            const result = calculatePagination({ page: totalPages, pageSize, totalItems });
            expect(result.hasNextPage).toBe(false);
            expect(result.page).toBe(result.totalPages);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent navigation flags', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });

            // If on first page, no prev
            if (result.page === 1) {
              expect(result.hasPrevPage).toBe(false);
            }

            // If on last page, no next
            if (result.page === result.totalPages) {
              expect(result.hasNextPage).toBe(false);
            }

            // If in middle, both should be true
            if (result.page > 1 && result.page < result.totalPages) {
              expect(result.hasPrevPage).toBe(true);
              expect(result.hasNextPage).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Skip/Take Invariants', () => {
    it('should have skip >= 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10000 }),
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.skip).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have take = pageSize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 10000 }),
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.take).toBe(result.pageSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct offset', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (page, pageSize) => {
            const offset = calculateOffset(page, pageSize);
            expect(offset).toBe((page - 1) * pageSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Page Items Invariants', () => {
    it('should return at most pageSize items', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
          fc.integer({ min: 0, max: 50 }),  // skip
          fc.integer({ min: 1, max: 20 }),  // take
          (items, skip, take) => {
            const pageItems = getPageItems(items, skip, take);
            expect(pageItems.length).toBeLessThanOrEqual(take);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when skip >= items.length', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (items, take) => {
            const skip = items.length + 10; // Always beyond array
            const pageItems = getPageItems(items, skip, take);
            expect(pageItems).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve item order', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer(), { minLength: 5, maxLength: 50 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (items, skip, take) => {
            const pageItems = getPageItems(items, skip, take);
            const expected = items.slice(skip, skip + take);
            expect(pageItems).toEqual(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('PageSize Bounds Invariants', () => {
    it('should cap pageSize at 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 100, max: 1000 }), // pageSize > 100
          fc.integer({ min: 0, max: 10000 }),
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.pageSize).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure pageSize >= 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: -100, max: 0 }), // pageSize <= 0
          fc.integer({ min: 0, max: 10000 }),
          (page, pageSize, totalItems) => {
            const result = calculatePagination({ page, pageSize, totalItems });
            expect(result.pageSize).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

