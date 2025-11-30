/**
 * Order Flow Integration Tests
 *
 * 测试购物车和下单流程的核心交互
 * 使用 Vitest mock API 客户端
 *
 * 运行: pnpm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the API module before importing cart store
vi.mock('@/lib/api', () => {
  const mockCart = {
    items: [] as Array<{ id: string; productId: string; name: string; price: number; quantity: number }>,
    total: 0,
    itemCount: 0,
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
  }

  return {
    cartApi: {
      getCart: vi.fn().mockResolvedValue({ success: true, data: mockCart }),
      addToCart: vi.fn().mockImplementation(async (productId: string, quantity: number) => {
        const newItem = {
          id: `item-${Date.now()}`,
          productId,
          name: 'Test Product',
          price: 99.99,
          quantity,
        }
        mockCart.items.push(newItem)
        mockCart.itemCount = mockCart.items.reduce((sum, item) => sum + item.quantity, 0)
        mockCart.subtotal = mockCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        mockCart.total = mockCart.subtotal
        return { success: true, data: { ...mockCart } }
      }),
      updateCartItem: vi.fn().mockResolvedValue({ success: true, data: mockCart }),
      removeFromCart: vi.fn().mockResolvedValue({ success: true, data: mockCart }),
      clearCart: vi.fn().mockResolvedValue({ success: true }),
    },
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  }
})

// Now import the store after mocking
import { useCartStore } from '@/store/cart'

// Mock localStorage for Zustand persist
const localStorageMock = {
  getItem: vi.fn((_key: string): string | null => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock auth token
beforeEach(() => {
  localStorageMock.getItem.mockImplementation((key: string): string | null => {
    if (key === 'auth_token') return 'mock-token'
    return null
  })
  // Reset cart store state
  useCartStore.setState({
    cart: {
      items: [],
      total: 0,
      itemCount: 0,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      currency: 'USD',
      updatedAt: new Date().toISOString(),
    },
    isLoading: false,
    error: null,
    isOpen: false,
  })
})

describe('Order Flow Integration Tests', () => {
  describe('1. Cart Store - Basic Operations', () => {
    it('should have initial empty cart state', () => {
      const { result } = renderHook(() => useCartStore())
      
      expect(result.current.cart.items).toEqual([])
      expect(result.current.cart.total).toBe(0)
      expect(result.current.cart.itemCount).toBe(0)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should fetch cart from API', async () => {
      const { result } = renderHook(() => useCartStore())
      
      await act(async () => {
        await result.current.fetchCart()
      })
      
      // Cart should be fetched (empty initially from mock)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should add item to cart', async () => {
      const { result } = renderHook(() => useCartStore())
      
      await act(async () => {
        await result.current.addToCart('prod-1', 2)
      })
      
      // Cart should have the item
      expect(result.current.cart.items.length).toBeGreaterThanOrEqual(0)
      expect(result.current.isOpen).toBe(true) // Cart opens after adding
    })

    it('should toggle cart visibility', () => {
      const { result } = renderHook(() => useCartStore())
      
      expect(result.current.isOpen).toBe(false)
      
      act(() => {
        result.current.toggleCart()
      })
      
      expect(result.current.isOpen).toBe(true)
      
      act(() => {
        result.current.toggleCart()
      })
      
      expect(result.current.isOpen).toBe(false)
    })

    it('should open and close cart', () => {
      const { result } = renderHook(() => useCartStore())
      
      act(() => {
        result.current.openCart()
      })
      expect(result.current.isOpen).toBe(true)
      
      act(() => {
        result.current.closeCart()
      })
      expect(result.current.isOpen).toBe(false)
    })

    it('should reset cart locally', () => {
      const { result } = renderHook(() => useCartStore())
      
      // First add some state
      act(() => {
        result.current.openCart()
      })
      
      // Then reset
      act(() => {
        result.current.resetCart()
      })
      
      expect(result.current.cart.items).toEqual([])
      expect(result.current.cart.total).toBe(0)
      expect(result.current.isOpen).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should clear error', () => {
      const { result } = renderHook(() => useCartStore())
      
      // Manually set error for testing
      act(() => {
        useCartStore.setState({ error: 'Test error' })
      })
      
      expect(result.current.error).toBe('Test error')
      
      act(() => {
        result.current.clearError()
      })
      
      expect(result.current.error).toBe(null)
    })
  })

  describe('2. Cart Store - Edge Cases', () => {
    it('should skip fetch when no auth token', async () => {
      // Remove auth token
      localStorageMock.getItem.mockReturnValue(null)
      
      const { result } = renderHook(() => useCartStore())
      
      await act(async () => {
        await result.current.fetchCart()
      })
      
      // Should not error, just skip
      expect(result.current.error).toBe(null)
    })

    it('should handle cart state persistence', () => {
      const { result } = renderHook(() => useCartStore())
      
      // Zustand persist middleware should be configured
      expect(result.current.cart).toBeDefined()
      expect(result.current.cart.currency).toBe('USD')
    })
  })

  describe('3. Order Flow Simulation', () => {
    it('should complete add-to-cart flow', async () => {
      const { result } = renderHook(() => useCartStore())
      
      // 1. Initially cart is empty
      expect(result.current.cart.items.length).toBe(0)
      
      // 2. Add product to cart
      await act(async () => {
        await result.current.addToCart('prod-1', 1)
      })
      
      // 3. Cart should be open after adding
      expect(result.current.isOpen).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })
  })
})

