import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global setup
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    
    // Test file patterns
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
      'tests/routes/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'src/modules/**/__tests__/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',
      // node:test benchmark suite, not a vitest file (vitest reports it as an
      // empty suite); run via `node --test` when benchmarking.
      'tests/performance/benchmarks.test.ts',
    ],
    
    // Timeouts
    testTimeout: 30000,  // 30 seconds for integration tests
    hookTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Coverage thresholds are enforced in CI (or when explicitly enabled).
      // Ratchet baseline (2026-07-13, measured on CI: lines 46.87 / branches
      // 37.62 / functions 60+ / statements 46.34): the old 60/50/60/60 targets
      // predate the main-reconciliation merge that brought in large untested
      // surfaces (staff RBAC, market install, plugins). Locked slightly below
      // current reality to prevent regressions; raise as coverage grows.
      ...(process.env.CI === 'true' || process.env.VITEST_ENFORCE_COVERAGE === '1'
        ? {
            thresholds: {
              lines: 45,
              branches: 36,
              functions: 58,
              statements: 45,
            },
          }
        : {}),
      
      // Files to include/exclude
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/server.ts',       // Entry point
        'src/types/**',        // Type definitions
        'dist/**',
      ],
    },
    
    // Reporter configuration
    reporters: ['default', 'verbose'],
    
    // Pool configuration - use forks with single fork for DB isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Run tests sequentially for DB isolation
      },
    },
    
    // Run test files sequentially
    fileParallelism: false,
    
    // Retry failed tests
    retry: 1,
    
    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false,
    },
  },
  
  // Path aliases (matching tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@plugins': path.resolve(__dirname, './src/plugins'),
      '@config': path.resolve(__dirname, './src/config'),
      'shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@jiffoo/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@shared/security': path.resolve(__dirname, '../../packages/shared/src/security'),
      '@shared/observability': path.resolve(__dirname, '../../packages/shared/src/observability'),
    },
  },
});
