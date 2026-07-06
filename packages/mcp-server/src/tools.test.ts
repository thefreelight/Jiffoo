/**
 * Unit tests for MCP tool definitions.
 *
 * Run with: npx tsx --test src/tools.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toolSchemas, toolHandlers, TOOL_LIST } from './tools.js';
import { JiffooApiClient } from './client.js';
import type { ToolContext } from './tools.js';

// ---------------------------------------------------------------------------
// Mock client for testing
// ---------------------------------------------------------------------------

function createMockClient(overrides: Partial<JiffooApiClient> = {}): JiffooApiClient {
  return {
    searchProducts: async () => ({
      items: [
        { id: 'p1', name: 'Test Product', price: 19.99, stock: 10 },
      ],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    }),
    getProduct: async () => ({
      id: 'p1',
      name: 'Test Product',
      description: 'A test product',
      price: 19.99,
      stock: 10,
      requiresShipping: false,
      variants: [
        { id: 'v1', name: 'Default', salePrice: 19.99, baseStock: 10, isActive: true },
      ],
    }),
    getCategories: async () => ({
      items: [
        { id: 'c1', name: 'Electronics', slug: 'electronics', productCount: 5 },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    }),
    getCart: async () => ({
      id: 'cart1',
      userId: 'u1',
      items: [],
      total: 0,
      itemCount: 0,
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      discountAmount: 0,
      status: 'ACTIVE',
    }),
    addToCart: async () => ({
      id: 'cart1',
      userId: 'u1',
      items: [
        {
          id: 'item1',
          productId: 'p1',
          productName: 'Test Product',
          productImage: '',
          price: 19.99,
          quantity: 1,
          variantId: 'v1',
          requiresShipping: false,
          maxQuantity: 10,
          subtotal: 19.99,
        },
      ],
      total: 19.99,
      itemCount: 1,
      subtotal: 19.99,
      tax: 0,
      shipping: 0,
      discount: 0,
      discountAmount: 0,
      status: 'ACTIVE',
    }),
    createOrder: async () => ({
      id: 'order1',
      orderNumber: 'ORD-001',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      total: 19.99,
    }),
    createPaymentSession: async () => ({
      orderId: 'order1',
      paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test',
      provider: 'stripe',
    }),
    ...overrides,
  } as unknown as JiffooApiClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Tools', () => {
  describe('tool definitions', () => {
    it('should have all required tools', () => {
      const names = TOOL_LIST.map((t) => t.name);
      assert.ok(names.includes('search_products'));
      assert.ok(names.includes('get_product'));
      assert.ok(names.includes('get_categories'));
      assert.ok(names.includes('get_cart'));
      assert.ok(names.includes('add_to_cart'));
      assert.ok(names.includes('create_checkout'));
    });

    it('each tool should have name, description, and inputSchema', () => {
      for (const tool of TOOL_LIST) {
        assert.ok(tool.name, 'Tool missing name');
        assert.ok(tool.description, `Tool "${tool.name}" missing description`);
        assert.ok(tool.inputSchema, `Tool "${tool.name}" missing inputSchema`);
        assert.equal(tool.inputSchema.type, 'object');
      }
    });

    it('get_product should require productId', () => {
      const schema = toolSchemas.get_product.inputSchema as any;
      assert.ok(schema.required?.includes('productId'));
    });

    it('add_to_cart should require productId', () => {
      const schema = toolSchemas.add_to_cart.inputSchema as any;
      assert.ok(schema.required?.includes('productId'));
    });
  });

  describe('search_products handler', () => {
    it('should return formatted product list', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: false,
      };

      const result = await toolHandlers.search_products({ q: 'test' }, ctx);
      assert.ok(result.content);
      assert.equal(result.content[0].type, 'text');
      assert.ok(result.content[0].text.includes('Test Product'));
      assert.ok(result.content[0].text.includes('19.99'));
    });

    it('should handle empty results', async () => {
      const ctx: ToolContext = {
        client: createMockClient({
          searchProducts: async () => ({
            items: [],
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          }),
        }),
        hasToken: false,
      };

      const result = await toolHandlers.search_products({ q: 'nonexistent' }, ctx);
      assert.ok(result.content[0].text.includes('No products found'));
    });
  });

  describe('get_product handler', () => {
    it('should return formatted product details', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: false,
      };

      const result = await toolHandlers.get_product({ productId: 'p1' }, ctx);
      assert.ok(result.content[0].text.includes('Test Product'));
      assert.ok(result.content[0].text.includes('19.99'));
      assert.ok(result.content[0].text.includes('A test product'));
      assert.ok(result.content[0].text.includes('Default'));
    });
  });

  describe('get_categories handler', () => {
    it('should return formatted category list', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: false,
      };

      const result = await toolHandlers.get_categories({}, ctx);
      assert.ok(result.content[0].text.includes('Electronics'));
      assert.ok(result.content[0].text.includes('5 product'));
    });
  });

  describe('get_cart handler', () => {
    it('should require authentication', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: false,
      };

      const result = await toolHandlers.get_cart({}, ctx);
      assert.equal(result.isError, true);
      assert.ok(result.content[0].text.includes('requires an API token'));
    });

    it('should return cart contents when authenticated', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: true,
      };

      const result = await toolHandlers.get_cart({}, ctx);
      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('cart is empty'));
    });
  });

  describe('add_to_cart handler', () => {
    it('should require authentication', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: false,
      };

      const result = await toolHandlers.add_to_cart({ productId: 'p1' }, ctx);
      assert.equal(result.isError, true);
    });

    it('should add item when authenticated', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: true,
      };

      const result = await toolHandlers.add_to_cart({ productId: 'p1', quantity: 1 }, ctx);
      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Added to cart'));
      assert.ok(result.content[0].text.includes('Test Product'));
    });
  });

  describe('create_checkout handler', () => {
    it('should require authentication', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: false,
      };

      const result = await toolHandlers.create_checkout({ customerEmail: 'test@test.com' }, ctx);
      assert.equal(result.isError, true);
    });

    it('should create order and return payment URL', async () => {
      const ctx: ToolContext = {
        client: createMockClient(),
        hasToken: true,
      };

      const result = await toolHandlers.create_checkout(
        { customerEmail: 'test@test.com' },
        ctx,
      );
      assert.equal(result.isError, undefined);
      assert.ok(result.content[0].text.includes('Order created'));
      assert.ok(result.content[0].text.includes('ORD-001'));
      assert.ok(result.content[0].text.includes('stripe.com'));
      assert.ok(result.content[0].text.includes('Do NOT share payment credentials'));
    });
  });
});
