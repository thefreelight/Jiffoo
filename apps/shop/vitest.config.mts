import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.tsx'],
    include: ['tests/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', '.next', 'tests']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@shop-themes': path.resolve(__dirname, '../../packages/shop-themes'),
      '@jiffoo/theme-api-sdk': path.resolve(__dirname, '../../packages/theme-api-sdk/src/index.ts'),
      '@jiffoo/core-api-sdk': path.resolve(__dirname, '../../packages/core-api-sdk/src/index.ts'),
      '@jiffoo/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      // Map shared package paths for testing
      'shared/src/i18n': path.resolve(__dirname, '../../packages/shared/src/i18n'),
      'shared/src': path.resolve(__dirname, '../../packages/shared/src'),
      'shared': path.resolve(__dirname, '../../packages/shared/src'),
    }
  }
})
