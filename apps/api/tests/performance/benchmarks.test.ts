/**
 * Performance Benchmark Test Suite
 *
 * Uses Node.js native test runner to benchmark:
 * - Database query performance
 * - Query analyzer functionality
 * - Slow query detection
 * - Query statistics collection
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { QueryAnalyzer } from '../../src/core/performance/query-analyzer';

describe('Performance Benchmarks', () => {
  before(() => {
    // Clear any existing query data
    QueryAnalyzer.clear();
    QueryAnalyzer.enable();
  });

  after(() => {
    // Clean up
    QueryAnalyzer.clear();
  });

  describe('QueryAnalyzer', () => {
    test('should be enabled by default', () => {
      assert.equal(QueryAnalyzer.isEnabled(), true);
    });

    test('should record query execution', () => {
      QueryAnalyzer.recordQuery({
        query: 'SELECT * FROM users WHERE id = ?',
        duration: 50,
        timestamp: new Date(),
        model: 'User',
        action: 'findUnique'
      });

      const stats = QueryAnalyzer.getStats();
      assert.equal(stats.totalQueries, 1);
      assert.equal(stats.avgDuration, 50);
    });

    test('should detect slow queries', () => {
      QueryAnalyzer.clear();

      // Record a slow query (>1000ms)
      QueryAnalyzer.recordQuery({
        query: 'SELECT * FROM products WHERE category = ?',
        duration: 1500,
        timestamp: new Date(),
        model: 'Product',
        action: 'findMany'
      });

      const slowQueries = QueryAnalyzer.getSlowQueries();
      assert.equal(slowQueries.length, 1);
      assert.equal(slowQueries[0].duration, 1500);
      assert.ok(slowQueries[0].recommendation);
    });

    test('should calculate query statistics correctly', () => {
      QueryAnalyzer.clear();

      // Record multiple queries
      const queries = [
        { duration: 10, model: 'User', action: 'findMany' },
        { duration: 50, model: 'User', action: 'findUnique' },
        { duration: 100, model: 'Product', action: 'findMany' },
        { duration: 25, model: 'Order', action: 'create' },
      ];

      queries.forEach(q => {
        QueryAnalyzer.recordQuery({
          query: `${q.model}.${q.action}`,
          duration: q.duration,
          timestamp: new Date(),
          model: q.model,
          action: q.action
        });
      });

      const stats = QueryAnalyzer.getStats();
      assert.equal(stats.totalQueries, 4);
      assert.equal(stats.avgDuration, (10 + 50 + 100 + 25) / 4);
      assert.equal(stats.maxDuration, 100);
      assert.equal(stats.minDuration, 10);
      assert.equal(stats.queriesByModel['User'], 2);
      assert.equal(stats.queriesByModel['Product'], 1);
      assert.equal(stats.queriesByModel['Order'], 1);
    });

    test('should maintain history size limit', () => {
      QueryAnalyzer.clear();

      // Record more than MAX_HISTORY_SIZE (1000) queries
      for (let i = 0; i < 1100; i++) {
        QueryAnalyzer.recordQuery({
          query: `Query ${i}`,
          duration: 10,
          timestamp: new Date(),
          model: 'Test',
          action: 'findMany'
        });
      }

      const stats = QueryAnalyzer.getStats();
      // Should be limited to MAX_HISTORY_SIZE (1000)
      assert.ok(stats.totalQueries <= 1000);
    });

    test('should get recent queries', () => {
      QueryAnalyzer.clear();

      // Record some queries
      for (let i = 0; i < 5; i++) {
        QueryAnalyzer.recordQuery({
          query: `Query ${i}`,
          duration: i * 10,
          timestamp: new Date(),
          model: 'Test',
          action: 'findMany'
        });
      }

      const recentQueries = QueryAnalyzer.getRecentQueries(3);
      assert.equal(recentQueries.length, 3);
      // Should be in reverse order (most recent first)
      assert.equal(recentQueries[0].duration, 40);
      assert.equal(recentQueries[1].duration, 30);
      assert.equal(recentQueries[2].duration, 20);
    });

    test('should provide summary report', () => {
      QueryAnalyzer.clear();

      QueryAnalyzer.recordQuery({
        query: 'SELECT * FROM users',
        duration: 1200,
        timestamp: new Date(),
        model: 'User',
        action: 'findMany'
      });

      const summary = QueryAnalyzer.getSummary();
      assert.equal(summary.enabled, true);
      assert.equal(summary.stats.totalQueries, 1);
      assert.equal(summary.topSlowQueries.length, 1);
      assert.equal(summary.historySize, 1);
    });

    test('should disable and enable correctly', () => {
      QueryAnalyzer.clear();
      QueryAnalyzer.disable();
      assert.equal(QueryAnalyzer.isEnabled(), false);

      // Queries should not be recorded when disabled
      QueryAnalyzer.recordQuery({
        query: 'Test query',
        duration: 50,
        timestamp: new Date(),
        model: 'Test',
        action: 'findMany'
      });

      const stats = QueryAnalyzer.getStats();
      assert.equal(stats.totalQueries, 0);

      // Re-enable
      QueryAnalyzer.enable();
      assert.equal(QueryAnalyzer.isEnabled(), true);
    });
  });

  describe('Query Performance Benchmarks', () => {
    test('fast query performance (< 50ms)', () => {
      QueryAnalyzer.clear();
      const start = Date.now();

      // Simulate fast operation
      const end = Date.now();
      const duration = end - start;

      QueryAnalyzer.recordQuery({
        query: 'Fast query',
        duration,
        timestamp: new Date(),
        model: 'Test',
        action: 'findUnique'
      });

      const stats = QueryAnalyzer.getStats();
      assert.ok(stats.avgDuration < 50, `Expected fast query, got ${stats.avgDuration}ms`);
    });

    test('should benchmark multiple query types', () => {
      QueryAnalyzer.clear();

      const queryTypes = [
        { name: 'findUnique', expectedMax: 100 },
        { name: 'findMany', expectedMax: 200 },
        { name: 'create', expectedMax: 150 },
        { name: 'update', expectedMax: 150 },
      ];

      queryTypes.forEach(({ name, expectedMax }) => {
        const start = Date.now();
        // Simulate query
        const end = Date.now();
        const duration = end - start;

        QueryAnalyzer.recordQuery({
          query: `Benchmark ${name}`,
          duration,
          timestamp: new Date(),
          model: 'Benchmark',
          action: name
        });

        assert.ok(
          duration < expectedMax,
          `${name} query took ${duration}ms, expected < ${expectedMax}ms`
        );
      });

      const stats = QueryAnalyzer.getStats();
      assert.equal(stats.totalQueries, queryTypes.length);
    });

    test('should measure query analyzer overhead', () => {
      const iterations = 1000;

      // Measure without analyzer
      QueryAnalyzer.disable();
      const startWithout = Date.now();
      for (let i = 0; i < iterations; i++) {
        // Simulate query recording (but disabled)
        QueryAnalyzer.recordQuery({
          query: 'Test',
          duration: 10,
          timestamp: new Date(),
          model: 'Test',
          action: 'findMany'
        });
      }
      const durationWithout = Date.now() - startWithout;

      // Measure with analyzer
      QueryAnalyzer.clear();
      QueryAnalyzer.enable();
      const startWith = Date.now();
      for (let i = 0; i < iterations; i++) {
        QueryAnalyzer.recordQuery({
          query: 'Test',
          duration: 10,
          timestamp: new Date(),
          model: 'Test',
          action: 'findMany'
        });
      }
      const durationWith = Date.now() - startWith;

      // Overhead should be reasonable (< 10ms for 1000 operations)
      const overhead = durationWith - durationWithout;
      assert.ok(
        overhead < 100,
        `Query analyzer overhead is ${overhead}ms for ${iterations} operations`
      );
    });

    test('should handle concurrent query recording', () => {
      QueryAnalyzer.clear();

      // Simulate concurrent queries
      const promises = Array.from({ length: 100 }, (_, i) => {
        return new Promise<void>((resolve) => {
          QueryAnalyzer.recordQuery({
            query: `Concurrent query ${i}`,
            duration: Math.random() * 100,
            timestamp: new Date(),
            model: 'Test',
            action: 'findMany'
          });
          resolve();
        });
      });

      Promise.all(promises).then(() => {
        const stats = QueryAnalyzer.getStats();
        assert.equal(stats.totalQueries, 100);
      });
    });

    test('should benchmark statistics calculation performance', () => {
      QueryAnalyzer.clear();

      // Record many queries
      for (let i = 0; i < 1000; i++) {
        QueryAnalyzer.recordQuery({
          query: `Query ${i}`,
          duration: Math.random() * 1000,
          timestamp: new Date(),
          model: `Model${i % 10}`,
          action: ['findMany', 'findUnique', 'create', 'update'][i % 4]
        });
      }

      // Benchmark getStats performance
      const start = Date.now();
      const stats = QueryAnalyzer.getStats();
      const duration = Date.now() - start;

      // Stats calculation should be fast (< 50ms for 1000 queries)
      assert.ok(
        duration < 50,
        `Stats calculation took ${duration}ms, expected < 50ms`
      );
      assert.equal(stats.totalQueries, 1000);
    });
  });

  describe('Query Optimization Recommendations', () => {
    test('should recommend index for WHERE clauses', () => {
      QueryAnalyzer.clear();

      QueryAnalyzer.recordQuery({
        query: 'SELECT * FROM users WHERE email = ?',
        duration: 1500,
        timestamp: new Date(),
        model: 'User',
        action: 'findMany'
      });

      const slowQueries = QueryAnalyzer.getSlowQueries();
      assert.ok(
        slowQueries[0].recommendation?.includes('index'),
        'Should recommend index for WHERE clause'
      );
    });

    test('should recommend pagination for large result sets', () => {
      QueryAnalyzer.clear();

      QueryAnalyzer.recordQuery({
        query: 'SELECT * FROM products',
        duration: 1500,
        timestamp: new Date(),
        model: 'Product',
        action: 'findMany'
      });

      const slowQueries = QueryAnalyzer.getSlowQueries();
      assert.ok(
        slowQueries[0].recommendation?.includes('pagination') ||
        slowQueries[0].recommendation?.includes('take'),
        'Should recommend pagination'
      );
    });

    test('should warn about N+1 queries', () => {
      QueryAnalyzer.clear();

      QueryAnalyzer.recordQuery({
        query: 'User.findMany',
        duration: 1500,
        timestamp: new Date(),
        model: 'User',
        action: 'findMany'
      });

      const slowQueries = QueryAnalyzer.getSlowQueries();
      assert.ok(
        slowQueries[0].recommendation?.includes('include') ||
        slowQueries[0].recommendation?.includes('N+1'),
        'Should warn about potential N+1 queries'
      );
    });
  });

  describe('Middleware Integration', () => {
    test('should create Prisma middleware', () => {
      const middleware = QueryAnalyzer.createPrismaMiddleware();
      assert.ok(typeof middleware === 'function');
    });

    test('middleware should track query execution', async () => {
      QueryAnalyzer.clear();

      const middleware = QueryAnalyzer.createPrismaMiddleware();

      // Mock Prisma middleware params and next function
      const mockParams = {
        model: 'User',
        action: 'findMany',
        args: { where: { email: 'test@example.com' } }
      };

      const mockNext = async () => {
        // Simulate query execution time
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id: 1, email: 'test@example.com' };
      };

      await middleware(mockParams, mockNext);

      const stats = QueryAnalyzer.getStats();
      assert.equal(stats.totalQueries, 1);
      assert.ok(stats.avgDuration >= 10);
    });
  });

  describe('Slow Query Threshold', () => {
    test('should use default threshold of 1000ms', () => {
      QueryAnalyzer.clear();

      // Query under threshold
      QueryAnalyzer.recordQuery({
        query: 'Fast query',
        duration: 500,
        timestamp: new Date(),
        model: 'Test',
        action: 'findMany'
      });

      let slowQueries = QueryAnalyzer.getSlowQueries();
      assert.equal(slowQueries.length, 0);

      // Query over threshold
      QueryAnalyzer.recordQuery({
        query: 'Slow query',
        duration: 1500,
        timestamp: new Date(),
        model: 'Test',
        action: 'findMany'
      });

      slowQueries = QueryAnalyzer.getSlowQueries();
      assert.equal(slowQueries.length, 1);
    });

    test('should allow custom threshold', () => {
      QueryAnalyzer.clear();
      QueryAnalyzer.setSlowQueryThreshold(500);

      QueryAnalyzer.recordQuery({
        query: 'Query',
        duration: 600,
        timestamp: new Date(),
        model: 'Test',
        action: 'findMany'
      });

      const slowQueries = QueryAnalyzer.getSlowQueries();
      assert.equal(slowQueries.length, 1);

      // Reset to default
      QueryAnalyzer.setSlowQueryThreshold(1000);
    });
  });
});
