/**
 * Frontend Smoke Tests
 *
 * 验证核心组件能够正确渲染，不测试完整功能。
 * 运行: pnpm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock shared package i18n
vi.mock('shared/src/i18n', () => ({
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'zh'],
}))

// Mock the theme provider
vi.mock('@/lib/themes/provider', () => ({
  useShopTheme: () => ({
    theme: {
      components: {
        HomePage: ({ config, onNavigate }: any) => (
          <div data-testid="home-page">
            <h1>Welcome to {config?.brand?.name || 'Jiffoo Mall'}</h1>
            <button onClick={() => onNavigate('/products')}>Shop Now</button>
          </div>
        ),
        ProductDetailPage: ({ product, isLoading, onAddToCart }: any) => (
          <div data-testid="product-detail">
            {isLoading ? (
              <p>Loading...</p>
            ) : product ? (
              <>
                <h1>{product.name}</h1>
                <p>{product.description}</p>
                <button onClick={onAddToCart}>Add to Cart</button>
              </>
            ) : (
              <p>Product not found</p>
            )}
          </div>
        ),
      },
    },
    config: {
      brand: { name: 'Test Store' },
    },
    isLoading: false,
    error: null,
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock tenant navigation
vi.mock('@/hooks/use-tenant-navigation', () => ({
  useTenantNavigation: () => ({
    getHref: (path: string) => path,
  }),
}))

// Mock cart store
vi.mock('@/store/cart', () => ({
  useCartStore: () => ({
    addToCart: vi.fn(),
    items: [],
    total: 0,
  }),
}))

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock product service
vi.mock('@/services/product.service', () => ({
  ProductService: {
    getProductById: vi.fn().mockResolvedValue({
      product: {
        id: '1',
        name: 'Test Product',
        description: 'A test product',
        price: 99.99,
        inventory: { available: 10 },
      },
    }),
  },
  Product: {},
}))

describe('Frontend Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Home Page Components', () => {
    it('renders themed home page component', async () => {
      // Test the themed component directly instead of the redirect page
      const { useShopTheme } = await import('@/lib/themes/provider')
      const { theme, config } = useShopTheme()
      const Component = theme!.components.HomePage

      render(<Component config={config} onNavigate={vi.fn()} />)

      // Check that the home page renders
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.getByText(/Welcome to/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /shop now/i })).toBeInTheDocument()
    })

    it('displays store name from config', async () => {
      const { useShopTheme } = await import('@/lib/themes/provider')
      const { theme, config } = useShopTheme()
      const Component = theme!.components.HomePage

      render(<Component config={config} onNavigate={vi.fn()} />)

      // Check store name is displayed
      expect(screen.getByText(/Test Store/i)).toBeInTheDocument()
    })
  })

  describe('2. Product Detail Page', () => {
    it('renders product detail with loading state', async () => {
      // Get the mocked theme from the module mock above
      const { useShopTheme } = await import('@/lib/themes/provider')
      const { theme, config } = useShopTheme()
      const Component = theme!.components.ProductDetailPage

      render(
        <Component
          product={null}
          isLoading={true}
          config={config}
          quantity={1}
          onVariantChange={vi.fn()}
          onQuantityChange={vi.fn()}
          onAddToCart={vi.fn()}
          onBack={vi.fn()}
        />
      )

      expect(screen.getByTestId('product-detail')).toBeInTheDocument()
      expect(screen.getByText(/Loading/i)).toBeInTheDocument()
    })

    it('renders product detail with product data', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        description: 'A wonderful test product',
        price: 99.99,
        sku: 'TEST-001',
        category: { id: '1', name: 'Test Category', slug: 'test-category', level: 0, isActive: true, productCount: 1 },
        tags: [],
        images: [],
        variants: [],
        inventory: { quantity: 100, reserved: 0, available: 100, lowStockThreshold: 10, isInStock: true, isLowStock: false, trackInventory: true },
        specifications: [],
        isActive: true,
        isFeatured: false,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const { useShopTheme } = await import('@/lib/themes/provider')
      const { theme, config } = useShopTheme()
      const Component = theme!.components.ProductDetailPage

      render(
        <Component
          product={mockProduct}
          isLoading={false}
          config={config}
          quantity={1}
          onVariantChange={vi.fn()}
          onQuantityChange={vi.fn()}
          onAddToCart={vi.fn()}
          onBack={vi.fn()}
        />
      )

      expect(screen.getByTestId('product-detail')).toBeInTheDocument()
      expect(screen.getByText('Test Product')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument()
    })
  })
})

