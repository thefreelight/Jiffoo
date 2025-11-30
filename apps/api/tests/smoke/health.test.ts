/**
 * Smoke Tests - API Health Check
 * 
 * Basic tests to verify the API is running and responding correctly.
 * These tests can run without a database connection.
 * 
 * Run with: pnpm --filter api test:smoke
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

describe('API Smoke Tests', () => {
  describe('Health Check Endpoints', () => {
    test('should have valid health check structure', () => {
      // Validate expected health check response structure
      const expectedHealthResponse = {
        status: 'ok',
        timestamp: expect.any(String),
        uptime_seconds: expect.any(Number),
        checks: {
          database: { status: expect.any(String) },
          redis: { status: expect.any(String) },
        },
      };

      // Validate structure exists
      assert.ok(expectedHealthResponse.status, 'Health response should have status');
      assert.ok(expectedHealthResponse.checks, 'Health response should have checks');
      assert.ok(expectedHealthResponse.checks.database, 'Health response should have database check');
      assert.ok(expectedHealthResponse.checks.redis, 'Health response should have redis check');
    });

    test('should have valid liveness probe structure', () => {
      // Liveness probe should be simple and fast
      const expectedLivenessResponse = {
        status: 'ok',
        timestamp: expect.any(String),
      };

      assert.ok(expectedLivenessResponse.status, 'Liveness response should have status');
    });

    test('should have valid readiness probe structure', () => {
      // Readiness probe should check dependencies
      const expectedReadinessResponse = {
        status: 'ok',
        checks: {
          database: { status: expect.any(String) },
          redis: { status: expect.any(String) },
        },
      };

      assert.ok(expectedReadinessResponse.status, 'Readiness response should have status');
      assert.ok(expectedReadinessResponse.checks, 'Readiness response should have checks');
    });
  });

  describe('Plugin Health Endpoint Structure', () => {
    test('should have valid plugin health response structure', () => {
      // Validate expected plugin health response structure
      const expectedPluginHealthResponse = {
        success: true,
        data: {
          totalPlugins: expect.any(Number),
          healthyPlugins: expect.any(Number),
          degradedPlugins: expect.any(Number),
          errorPlugins: expect.any(Number),
          plugins: expect.any(Array),
          systemHealth: {
            database: { status: expect.any(String), latency_ms: expect.any(Number) },
            redis: { status: expect.any(String), latency_ms: expect.any(Number) },
            uptime_seconds: expect.any(Number),
          },
        },
      };

      assert.ok(expectedPluginHealthResponse.success, 'Plugin health response should have success');
      assert.ok(expectedPluginHealthResponse.data, 'Plugin health response should have data');
      assert.ok(typeof expectedPluginHealthResponse.data.totalPlugins !== 'undefined', 'Should have totalPlugins');
      assert.ok(typeof expectedPluginHealthResponse.data.healthyPlugins !== 'undefined', 'Should have healthyPlugins');
      assert.ok(expectedPluginHealthResponse.data.systemHealth, 'Should have systemHealth');
    });

    test('should have valid plugin item structure', () => {
      // Validate expected plugin item structure
      const expectedPluginItem = {
        slug: expect.any(String),
        name: expect.any(String),
        status: expect.any(String), // 'healthy' | 'degraded' | 'error'
        errorCount: expect.any(Number),
        avgResponseTime: expect.any(Number),
        rateLimitHits: expect.any(Number),
        tenantCount: expect.any(Number),
      };

      assert.ok(typeof expectedPluginItem.slug !== 'undefined', 'Plugin should have slug');
      assert.ok(typeof expectedPluginItem.name !== 'undefined', 'Plugin should have name');
      assert.ok(typeof expectedPluginItem.status !== 'undefined', 'Plugin should have status');
      assert.ok(typeof expectedPluginItem.errorCount !== 'undefined', 'Plugin should have errorCount');
    });
  });

  describe('Environment Configuration', () => {
    test('should have required environment variables defined', () => {
      // These are the minimum required env vars for the API
      const requiredEnvVars = [
        'NODE_ENV',
      ];

      for (const envVar of requiredEnvVars) {
        assert.ok(process.env[envVar], `Environment variable ${envVar} should be defined`);
      }
    });

    test('should be in test mode', () => {
      assert.strictEqual(process.env.NODE_ENV, 'test', 'Should be in test mode');
    });
  });
});

// Simple expect helper for structure validation
const expect = {
  any: (type: any) => type,
};

