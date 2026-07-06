/**
 * MCP Server Integration Tests
 *
 * Tests the full pipeline: tool handler → API client → HTTP request → response parsing → formatted output.
 *
 * A mock HTTP server simulates the Jiffoo API with seed data, and each tool
 * is called with a real (non-mocked) JiffooApiClient pointing to the mock server.
 *
 * Run with: npx tsx --test src/integration.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { JiffooApiClient, JiffooApiError } from './client.js';
import { toolHandlers, TOOL_LIST } from './tools.js';
import type { ToolContext } from './tools.js';

// ---------------------------------------------------------------------------
// Seed data (simulates Jiffoo API database)
// ---------------------------------------------------------------------------

const SEED = {
  products: [
    {
      id: 'prod-001',
      name: 'Steam Gift Card $50',
      description: 'Digital Steam gift card, delivered via email.',
      price: 50.00,
      stock: 100,
      requiresShipping: false,
      images: ['https://cdn.example.com/steam-50.png'],
      variants: [
        { id: 'var-001', name: 'Default', skuCode: 'STEAM-50', salePrice: 50.00, baseStock: 100, isActive: true },
      ],
      typeData: { fulfillmentType: 'digital' },
    },
    {
      id: 'prod-002',
      name: 'eSIM Europe 10GB',
      description: 'Prepaid eSIM data plan for Europe, 10GB for 30 days.',
      price: 29.99,
      stock: 500,
      requiresShipping: false,
      images: [],
      variants: [
        { id: 'var-002a', name: '30 Days', skuCode: 'ESIM-EU-10G-30D', salePrice: 29.99, baseStock: 500, isActive: true },
        { id: 'var-002b', name: '60 Days', skuCode: 'ESIM-EU-10G-60D', salePrice: 49.99, baseStock: 200, isActive: true },
      ],
      typeData: { fulfillmentType: 'digital' },
    },
  ],
  categories: [
    { id: 'cat-001', name: 'Gift Cards', slug: 'gift-cards', productCount: 1 },
    { id: 'cat-002', name: 'eSIM', slug: 'esim', productCount: 1 },
  ],
  cart: {
    id: 'cart-001',
    userId: 'api:tok_test',
    items: [
      {
        id: 'cartitem-001',
        productId: 'prod-001',
        productName: 'Steam Gift Card $50',
        productImage: 'https://cdn.example.com/steam-50.png',
        price: 50.00,
        quantity: 2,
        variantId: 'var-001',
        requiresShipping: false,
        maxQuantity: 100,
        subtotal: 100.00,
      },
    ],
    total: 100.00,
    itemCount: 2,
    subtotal: 100.00,
    tax: 0,
    shipping: 0,
    discount: 0,
    discountAmount: 0,
    status: 'ACTIVE',
  },
  order: {
    id: 'order-001',
    orderNumber: 'ORD-2026-001',
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    total: 100.00,
    items: [
      {
        id: 'orderitem-001',
        productId: 'prod-001',
        productName: 'Steam Gift Card $50',
        quantity: 2,
        price: 50.00,
        total: 100.00,
        fulfillmentStatus: 'processing',
        fulfillmentData: { type: 'digital', deliveryMethod: 'email' },
      },
    ],
  },
  paymentSession: {
    orderId: 'order-001',
    paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test_001',
    provider: 'stripe',
  },
};

// ---------------------------------------------------------------------------
// Mock API server
// ---------------------------------------------------------------------------

let mockServer: http.Server;
let baseUrl: string;

function startMockServer(): Promise<void> {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      // Parse URL
      const url = new URL(req.url || '/', `http://localhost`);

      // Set JSON content type
      res.setHeader('Content-Type', 'application/json');

      // Check auth for protected routes
      const authHeader = req.headers.authorization || '';
      const isProtectedRoute = url.pathname.startsWith('/cart') || url.pathname.startsWith('/orders') || url.pathname.startsWith('/payments');

      if (isProtectedRoute && !authHeader.startsWith('Bearer jiffoo_')) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API token' } }));
        return;
      }

      // Route handlers
      if (req.method === 'GET' && url.pathname === '/products/search') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { items: SEED.products, page: 1, limit: 10, total: 2, totalPages: 1 } }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/products/categories') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { items: SEED.categories, page: 1, limit: 20, total: 2, totalPages: 1 } }));
        return;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/products/')) {
        const productId = url.pathname.split('/')[2];
        const product = SEED.products.find((p) => p.id === productId);
        if (product) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: product }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Product not found' } }));
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/cart') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: SEED.cart }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/cart/items') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: SEED.cart }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/orders') {
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: SEED.order }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/payments/create-session') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: SEED.paymentSession }));
        return;
      }

      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${url.pathname}` } }));
    });

    mockServer.listen(0, '127.0.0.1', () => {
      const addr = mockServer.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Server Integration Tests', () => {
  let client: JiffooApiClient;
  let ctxWithToken: ToolContext;
  let ctxWithoutToken: ToolContext;

  before(async () => {
    await startMockServer();
    client = new JiffooApiClient({
      baseUrl,
      token: 'jiffoo_test_token',
    });
    ctxWithToken = { client, hasToken: true };
    ctxWithoutToken = { client, hasToken: false };
  });

  after((done) => {
    mockServer.close(done);
  });

  // -------------------------------------------------------------------------
  // Tool list
  // -------------------------------------------------------------------------

  describe('tool list', () => {
    it('should expose all 6 tools', () => {
      const names = TOOL_LIST.map((t) => t.name);
      assert.ok(names.includes('search_products'));
      assert.ok(names.includes('get_product'));
      assert.ok(names.includes('get_categories'));
      assert.ok(names.includes('get_cart'));
      assert.ok(names.includes('add_to_cart'));
      assert.ok(names.includes('create_checkout'));
      assert.equal(names.length, 6);
    });
  });

  // -------------------------------------------------------------------------
  // Read-only tools (no auth required)
  // -------------------------------------------------------------------------

  describe('search_products', () => {
    it('should return formatted product list from API', async () => {
      const result = await toolHandlers.search_products({ q: 'gift card' }, ctxWithoutToken);

      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Steam Gift Card'));
      assert.ok(result.content[0].text.includes('50'));
      assert.ok(result.content[0].text.includes('prod-001'));
      assert.ok(result.content[0].text.includes('Found 2 product'));
    });

    it('should handle empty results', async () => {
      // Create a client pointing to a server that returns empty results
      const emptyServer = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { items: [], page: 1, limit: 10, total: 0, totalPages: 0 } }));
      });

      await new Promise<void>((resolve) => emptyServer.listen(0, '127.0.0.1', resolve));
      const addr = emptyServer.address();
      const emptyUrl = `http://127.0.0.1:${(addr as any).port}`;

      const emptyClient = new JiffooApiClient({ baseUrl: emptyUrl });
      const result = await toolHandlers.search_products({}, { client: emptyClient, hasToken: false });

      assert.ok(result.content[0].text.includes('No products found'));

      await new Promise<void>((resolve) => emptyServer.close(() => resolve()));
    });
  });

  describe('get_product', () => {
    it('should return detailed product info with variants', async () => {
      const result = await toolHandlers.get_product({ productId: 'prod-002' }, ctxWithoutToken);

      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('eSIM Europe'));
      assert.ok(result.content[0].text.includes('29.99'));
      assert.ok(result.content[0].text.includes('30 Days'));
      assert.ok(result.content[0].text.includes('60 Days'));
      assert.ok(result.content[0].text.includes('var-002a'));
    });

    it('should return error for non-existent product', async () => {
      const result = await toolHandlers.get_product({ productId: 'non-existent' }, ctxWithoutToken);

      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes('404'));
      assert.ok(result.content[0].text.includes('not found'));
    });
  });

  describe('get_categories', () => {
    it('should return all categories with product counts', async () => {
      const result = await toolHandlers.get_categories({}, ctxWithoutToken);

      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Gift Cards'));
      assert.ok(result.content[0].text.includes('eSIM'));
      assert.ok(result.content[0].text.includes('cat-001'));
    });
  });

  // -------------------------------------------------------------------------
  // Auth-protected tools
  // -------------------------------------------------------------------------

  describe('get_cart', () => {
    it('should require authentication', async () => {
      const result = await toolHandlers.get_cart({}, ctxWithoutToken);

      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes('API token'));
    });

    it('should return cart contents when authenticated', async () => {
      const result = await toolHandlers.get_cart({}, ctxWithToken);

      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Steam Gift Card'));
      assert.ok(result.content[0].text.includes('× 2'));
      assert.ok(result.content[0].text.includes('100'));
    });
  });

  describe('add_to_cart', () => {
    it('should require authentication', async () => {
      const result = await toolHandlers.add_to_cart({ productId: 'prod-001' }, ctxWithoutToken);

      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes('API token'));
    });

    it('should add item when authenticated', async () => {
      const result = await toolHandlers.add_to_cart(
        { productId: 'prod-001', quantity: 2 },
        ctxWithToken,
      );

      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Added to cart'));
      assert.ok(result.content[0].text.includes('Steam Gift Card'));
      assert.ok(result.content[0].text.includes('× 2'));
    });
  });

  describe('create_checkout', () => {
    it('should require authentication', async () => {
      const result = await toolHandlers.create_checkout(
        { customerEmail: 'test@test.com' },
        ctxWithoutToken,
      );

      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes('API token'));
    });

    it('should create order and return payment URL', async () => {
      const result = await toolHandlers.create_checkout(
        { customerEmail: 'customer@test.com' },
        ctxWithToken,
      );

      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Order created'));
      assert.ok(result.content[0].text.includes('ORD-2026-001'));
      assert.ok(result.content[0].text.includes('stripe.com'));
      assert.ok(result.content[0].text.includes('Do NOT share payment credentials'));
    });

    it('should show digital delivery info for digital products', async () => {
      const result = await toolHandlers.create_checkout(
        { customerEmail: 'customer@test.com' },
        ctxWithToken,
      );

      assert.ok(result.content[0].text.includes('Digital Delivery'));
      assert.ok(result.content[0].text.includes('Steam Gift Card'));
      assert.ok(result.content[0].text.includes('processing'));
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('should format API errors with actionable suggestions', async () => {
      // Create client without token to trigger 401 on protected route
      const unauthClient = new JiffooApiClient({ baseUrl });
      const result = await toolHandlers.get_cart(
        {},
        { client: unauthClient, hasToken: true }, // hasToken=true but client has no token
      );

      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes('401'));
      assert.ok(result.content[0].text.includes('API token'));
      assert.ok(result.content[0].text.includes('Admin → Settings → API Tokens'));
    });

    it('should handle network errors gracefully', async () => {
      const badClient = new JiffooApiClient({
        baseUrl: 'http://127.0.0.1:1', // port 1 should fail
        timeoutMs: 1000,
      });

      const result = await toolHandlers.search_products(
        { q: 'test' },
        { client: badClient, hasToken: false },
      );

      assert.equal(result.isError, true);
    });
  });

  // -------------------------------------------------------------------------
  // Full purchase flow
  // -------------------------------------------------------------------------

  describe('full purchase flow (search → detail → cart → checkout)', () => {
    it('should complete end-to-end flow', async () => {
      // Step 1: Search for products
      const searchResult = await toolHandlers.search_products({ q: 'eSIM' }, ctxWithToken);
      assert.ok(searchResult.content[0].text.includes('eSIM Europe'));

      // Step 2: Get product details
      const detailResult = await toolHandlers.get_product({ productId: 'prod-002' }, ctxWithToken);
      assert.ok(detailResult.content[0].text.includes('eSIM Europe'));
      assert.ok(detailResult.content[0].text.includes('30 Days'));

      // Step 3: Add to cart (mock returns cart with prod-001, so check generic success)
      const cartResult = await toolHandlers.add_to_cart(
        { productId: 'prod-002', variantId: 'var-002a', quantity: 1 },
        ctxWithToken,
      );
      assert.ok(cartResult.content[0].text.toLowerCase().includes('added to cart'));

      // Step 4: View cart
      const viewCartResult = await toolHandlers.get_cart({}, ctxWithToken);
      assert.ok(viewCartResult.content[0].text.toLowerCase().includes('cart'));

      // Step 5: Create checkout
      const checkoutResult = await toolHandlers.create_checkout(
        { customerEmail: 'customer@test.com' },
        ctxWithToken,
      );
      assert.ok(checkoutResult.content[0].text.includes('Order created'));
      assert.ok(checkoutResult.content[0].text.includes('stripe.com'));
    });
  });
});
