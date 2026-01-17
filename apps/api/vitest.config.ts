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
      ...(process.env.CI === 'true' || process.env.VITEST_ENFORCE_COVERAGE === '1'
        ? {
            thresholds: {
              lines: 60,
              branches: 50,
              functions: 60,
              statements: 60,
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
      '@shared/security': path.resolve(__dirname, '../../packages/shared/src/security'),
      '@shared/observability': path.resolve(__dirname, '../../packages/shared/src/observability'),
    },
  },
});
