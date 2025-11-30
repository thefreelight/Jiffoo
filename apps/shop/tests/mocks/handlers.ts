/**
 * MSW Request Handlers for Frontend Tests
 * Mock API responses for cart and order flow testing
 */

import { http, HttpResponse } from 'msw'

// Mock data
const mockProducts = [
  {
    id: 'prod-1',
    name: 'Test Product 1',
    description: 'A test product',
    price: 99.99,
    currency: 'USD',
    images: [{ url: '/test.jpg', alt: 'Test' }],
    inventory: { available: 100 },
    status: 'active',
  },
  {
    id: 'prod-2',
    name: 'Test Product 2',
    description: 'Another test product',
    price: 149.99,
    currency: 'USD',
    images: [{ url: '/test2.jpg', alt: 'Test 2' }],
    inventory: { available: 50 },
    status: 'active',
  },
]

let mockCart = {
  items: [] as Array<{
    id: string
    productId: string
    name: string
    price: number
    quantity: number
    image: string
  }>,
  total: 0,
  itemCount: 0,
  subtotal: 0,
  tax: 0,
  shipping: 0,
  discount: 0,
  currency: 'USD',
  updatedAt: new Date().toISOString(),
}

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  username: 'testuser',
  role: 'customer',
}

let mockOrders: Array<{
  id: string
  status: string
  total: number
  items: typeof mockCart.items
  createdAt: string
}> = []

// Helper to calculate cart totals
const updateCartTotals = () => {
  mockCart.itemCount = mockCart.items.reduce((sum, item) => sum + item.quantity, 0)
  mockCart.subtotal = mockCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  mockCart.tax = mockCart.subtotal * 0.1
  mockCart.total = mockCart.subtotal + mockCart.tax + mockCart.shipping - mockCart.discount
  mockCart.updatedAt = new Date().toISOString()
}

// Reset function for tests
export const resetMockData = () => {
  mockCart = {
    items: [],
    total: 0,
    itemCount: 0,
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
  }
  mockOrders = []
}

export const handlers = [
  // Auth endpoints
  http.post('*/api/auth/login', () => {
    return HttpResponse.json({
      success: true,
      data: { access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 },
    })
  }),

  http.get('*/api/account/profile', () => {
    return HttpResponse.json({ success: true, data: mockUser })
  }),

  // Products endpoints
  http.get('*/api/products', () => {
    return HttpResponse.json({
      success: true,
      data: { items: mockProducts, total: mockProducts.length, page: 1, pageSize: 10 },
    })
  }),

  http.get('*/api/products/:id', ({ params }) => {
    const product = mockProducts.find((p) => p.id === params.id)
    if (!product) {
      return HttpResponse.json({ success: false, message: 'Product not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: product })
  }),

  // Cart endpoints
  http.get('*/api/cart', () => {
    return HttpResponse.json({ success: true, data: mockCart })
  }),

  http.post('*/api/cart/add', async ({ request }) => {
    const body = (await request.json()) as { productId: string; quantity: number }
    const product = mockProducts.find((p) => p.id === body.productId)

    if (!product) {
      return HttpResponse.json({ success: false, message: 'Product not found' }, { status: 404 })
    }

    const existingItem = mockCart.items.find((item) => item.productId === body.productId)
    if (existingItem) {
      existingItem.quantity += body.quantity
    } else {
      mockCart.items.push({
        id: `cart-item-${Date.now()}`,
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: body.quantity,
        image: product.images[0]?.url || '',
      })
    }
    updateCartTotals()
    return HttpResponse.json({ success: true, data: mockCart })
  }),

  http.put('*/api/cart/update', async ({ request }) => {
    const body = (await request.json()) as { itemId: string; quantity: number }
    const item = mockCart.items.find((i) => i.id === body.itemId)
    if (item) {
      item.quantity = body.quantity
      updateCartTotals()
    }
    return HttpResponse.json({ success: true, data: mockCart })
  }),

  http.delete('*/api/cart/:id', ({ params }) => {
    mockCart.items = mockCart.items.filter((i) => i.id !== params.id)
    updateCartTotals()
    return HttpResponse.json({ success: true, data: mockCart })
  }),

  http.delete('*/api/cart/clear', () => {
    mockCart.items = []
    updateCartTotals()
    return HttpResponse.json({ success: true })
  }),

  // Orders endpoints
  http.post('*/api/orders', async ({ request }) => {
    const body = (await request.json()) as { items: Array<{ productId: string; quantity: number }> }
    const order = {
      id: `order-${Date.now()}`,
      status: 'pending',
      total: mockCart.total,
      items: [...mockCart.items],
      createdAt: new Date().toISOString(),
    }
    mockOrders.push(order)
    // Clear cart after order
    mockCart.items = []
    updateCartTotals()
    return HttpResponse.json({ success: true, data: order })
  }),

  http.get('*/api/orders', () => {
    return HttpResponse.json({
      success: true,
      data: { items: mockOrders, total: mockOrders.length, page: 1, pageSize: 10 },
    })
  }),

  http.get('*/api/orders/:id', ({ params }) => {
    const order = mockOrders.find((o) => o.id === params.id)
    if (!order) {
      return HttpResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: order })
  }),
]

