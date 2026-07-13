/**
 * MCP Tool Definitions
 *
 * Each tool is designed with agent-friendly descriptions:
 * - Parameters have clear semantic descriptions and units
 * - Error responses include actionable suggestions
 * - Read-only tools are safe to call without authentication
 * - Write tools (cart, checkout) require a valid API token
 */

import { z } from 'zod';
import { JiffooApiClient, JiffooApiError } from './client.js';

// ---------------------------------------------------------------------------
// Tool Schema Definitions
// ---------------------------------------------------------------------------

export const toolSchemas = {
  search_products: {
    name: 'search_products',
    description:
      'Search the product catalog by keyword, category, or price range. ' +
      'Returns paginated results with product name, price, stock, and images. ' +
      'Use this when a user asks to browse or find products.',
    inputSchema: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Search query — matches product name and description (case-insensitive). Example: "gift card" or "eSIM Europe"',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (1-based). Default: 1.',
          default: 1,
          minimum: 1,
        },
        limit: {
          type: 'number',
          description: 'Number of results per page (max 100). Default: 10.',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
        category: {
          type: 'string',
          description: 'Category ID to filter by. Use get_categories to find available category IDs.',
        },
        minPrice: {
          type: 'number',
          description: 'Minimum price filter (in store currency). Example: 10.00',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price filter (in store currency). Example: 100.00',
        },
        inStock: {
          type: 'boolean',
          description: 'If true, only return products that are currently in stock.',
        },
        sortBy: {
          type: 'string',
          enum: ['price', 'name', 'createdAt', 'stock'],
          description: 'Sort field. Default: relevance (search order).',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction. Default: asc.',
        },
      },
    },
  },

  get_product: {
    name: 'get_product',
    description:
      'Get detailed information about a specific product, including all variants, ' +
      'pricing, stock levels, and product type data. ' +
      'Use this after search_products when the user wants full details on a specific product.',
    inputSchema: {
      type: 'object',
      required: ['productId'],
      properties: {
        productId: {
          type: 'string',
          description: 'The unique product ID (returned by search_products). Example: "prod-001"',
        },
      },
    },
  },

  get_categories: {
    name: 'get_categories',
    description:
      'Get all product categories with product counts. ' +
      'Use this to help users browse by category or to find category IDs for filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number (1-based). Default: 1.',
          default: 1,
        },
        limit: {
          type: 'number',
          description: 'Results per page (max 100). Default: 20.',
          default: 20,
        },
      },
    },
  },

  get_cart: {
    name: 'get_cart',
    description:
      'Get the current shopping cart contents, including items, quantities, subtotals, and applied discounts. ' +
      'Requires authentication (API token). ' +
      'Use this to show the user what is currently in their cart.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  add_to_cart: {
    name: 'add_to_cart',
    description:
      'Add a product (with optional variant) to the shopping cart. ' +
      'Requires authentication (API token). ' +
      'Use this when a user wants to add an item to their cart. ' +
      'If the product has multiple variants, specify variantId from get_product results.',
    inputSchema: {
      type: 'object',
      required: ['productId'],
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID to add. Example: "prod-001"',
        },
        variantId: {
          type: 'string',
          description: 'Specific variant ID. If omitted, the default variant is used.',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add (minimum 1). Default: 1.',
          default: 1,
          minimum: 1,
        },
      },
    },
  },

  create_checkout: {
    name: 'create_checkout',
    description:
      'Create an order from the current cart and generate a payment URL. ' +
      'Requires authentication (API token). ' +
      'Returns an order number and a hosted payment URL (e.g. Stripe Checkout). ' +
      'The agent should NEVER handle payment credentials — always redirect the user to the payment URL. ' +
      'For digital goods (eSIM, gift cards), fulfillment happens automatically after payment.',
    inputSchema: {
      type: 'object',
      properties: {
        customerEmail: {
          type: 'string',
          description: 'Customer email for order confirmation and digital delivery. Required for digital goods.',
        },
        shippingAddress: {
          type: 'object',
          description: 'Shipping address. Required for physical goods. Omit for digital-only orders.',
          properties: {
            fullName: { type: 'string', description: 'Recipient full name' },
            address1: { type: 'string', description: 'Street address line 1' },
            address2: { type: 'string', description: 'Street address line 2 (optional)' },
            city: { type: 'string', description: 'City' },
            state: { type: 'string', description: 'State or province' },
            country: { type: 'string', description: 'Country (ISO 3166-1 alpha-2 code, e.g. "US", "JP")' },
            postalCode: { type: 'string', description: 'Postal / ZIP code' },
            phone: { type: 'string', description: 'Phone number (optional)' },
          },
          required: ['fullName', 'address1', 'city', 'country', 'postalCode'],
        },
        discountCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Discount / coupon codes to apply. Optional.',
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

export interface ToolContext {
  client: JiffooApiClient;
  hasToken: boolean;
}

function formatError(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const text = error instanceof JiffooApiError
    ? `API Error (${error.statusCode} ${error.code}): ${error.message}` +
      (error.statusCode === 401 ? '\n\nSuggestion: The API token is missing or invalid. Generate a token in Admin → Settings → API Tokens.' : '') +
      (error.statusCode === 404 ? '\n\nSuggestion: The requested resource was not found. Verify the ID is correct.' : '')
    : error instanceof Error
      ? `Error: ${error.message}`
      : `Unexpected error: ${String(error)}`;

  return {
    content: [{ type: 'text' as const, text }],
    isError: true,
  };
}

function formatSuccess(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  };
}

function requireToken(ctx: ToolContext): string | null {
  if (!ctx.hasToken) {
    return 'This tool requires an API token. Set the JIFFOO_API_TOKEN environment variable or use --token flag.\n\nGenerate a token in Admin → Settings → API Tokens.';
  }
  return null;
}

export const toolHandlers: Record<string, (params: any, ctx: ToolContext) => Promise<any>> = {
  search_products: async (params, ctx) => {
    try {
      const result = await ctx.client.searchProducts(params);
      const lines: string[] = [];

      if (result.items.length === 0) {
        return formatSuccess('No products found. Try different search terms or filters.');
      }

      lines.push(`Found ${result.total} product(s) (page ${result.page}/${result.totalPages}):`);
      lines.push('');

      for (const product of result.items) {
        const stock = product.stock > 0 ? `${product.stock} in stock` : 'out of stock';
        lines.push(`• ${product.name} — ${product.price} (${stock})`);
        lines.push(`  ID: ${product.id}`);
        if (product.description) {
          const desc = product.description.length > 100
            ? product.description.slice(0, 100) + '...'
            : product.description;
          lines.push(`  ${desc}`);
        }
        lines.push('');
      }

      return formatSuccess(lines.join('\n'));
    } catch (error) {
      return formatError(error);
    }
  },

  get_product: async (params, ctx) => {
    try {
      const product = await ctx.client.getProduct(params.productId);

      const lines: string[] = [];
      lines.push(`# ${product.name}`);
      lines.push(`Price: ${product.price}`);
      lines.push(`Stock: ${product.stock}`);
      lines.push(`Requires shipping: ${product.requiresShipping ? 'Yes' : 'No'}`);
      lines.push('');

      if (product.description) {
        lines.push('## Description');
        lines.push(product.description);
        lines.push('');
      }

      if (product.variants && product.variants.length > 0) {
        lines.push('## Variants');
        for (const v of product.variants) {
          const stock = v.baseStock > 0 ? `${v.baseStock} in stock` : 'out of stock';
          lines.push(`• ${v.name} — ${v.salePrice} (${stock})`);
          lines.push(`  Variant ID: ${v.id}`);
          if (v.skuCode) {
            lines.push(`  SKU: ${v.skuCode}`);
          }
        }
        lines.push('');
      }

      if (product.images && product.images.length > 0) {
        lines.push('## Images');
        for (const img of product.images) {
          lines.push(`- ${img}`);
        }
      }

      return formatSuccess(lines.join('\n'));
    } catch (error) {
      return formatError(error);
    }
  },

  get_categories: async (params, ctx) => {
    try {
      const result = await ctx.client.getCategories(params.page, params.limit);

      if (result.items.length === 0) {
        return formatSuccess('No categories found.');
      }

      const lines: string[] = [];
      lines.push(`Categories (${result.total} total):`);
      lines.push('');

      for (const cat of result.items) {
        lines.push(`• ${cat.name} — ${cat.productCount} product(s)`);
        lines.push(`  ID: ${cat.id} | Slug: ${cat.slug}`);
      }

      return formatSuccess(lines.join('\n'));
    } catch (error) {
      return formatError(error);
    }
  },

  get_cart: async (_params, ctx) => {
    const tokenError = requireToken(ctx);
    if (tokenError) return formatError(new Error(tokenError));

    try {
      const cart = await ctx.client.getCart();

      if (cart.items.length === 0) {
        return formatSuccess('Your cart is empty.');
      }

      const lines: string[] = [];
      lines.push(`Cart (${cart.itemCount} item(s)):`);
      lines.push('');

      for (const item of cart.items) {
        lines.push(`• ${item.productName} × ${item.quantity} — ${item.subtotal}`);
        lines.push(`  Product ID: ${item.productId} | Variant: ${item.variantId}`);
      }

      lines.push('');
      lines.push(`Subtotal: ${cart.subtotal}`);
      if (cart.discount > 0) {
        lines.push(`Discount: -${cart.discountAmount}`);
      }
      if (cart.shipping > 0) {
        lines.push(`Shipping: ${cart.shipping}`);
      }
      if (cart.tax > 0) {
        lines.push(`Tax: ${cart.tax}`);
      }
      lines.push(`Total: ${cart.total}`);

      return formatSuccess(lines.join('\n'));
    } catch (error) {
      return formatError(error);
    }
  },

  add_to_cart: async (params, ctx) => {
    const tokenError = requireToken(ctx);
    if (tokenError) return formatError(new Error(tokenError));

    try {
      const cart = await ctx.client.addToCart(params);

      const item = cart.items.find(
        (i) => i.productId === params.productId && i.variantId === (params.variantId || i.variantId),
      );

      const msg = item
        ? `Added to cart: ${item.productName} × ${item.quantity} (${item.subtotal})\n\nCart total: ${cart.total} (${cart.itemCount} item(s))`
        : `Item added to cart. Cart total: ${cart.total} (${cart.itemCount} item(s))`;

      return formatSuccess(msg);
    } catch (error) {
      return formatError(error);
    }
  },

  create_checkout: async (params, ctx) => {
    const tokenError = requireToken(ctx);
    if (tokenError) return formatError(new Error(tokenError));

    try {
      // Step 1: Create the order
      const order = await ctx.client.createOrder(params);

      const lines: string[] = [];
      lines.push(`✅ Order created: ${order.orderNumber || order.id}`);
      lines.push(`Status: ${order.status}`);
      lines.push(`Payment Status: ${order.paymentStatus}`);
      lines.push(`Total: ${order.total}`);
      lines.push('');

      // Step 2: Create payment session
      try {
        const session = await ctx.client.createPaymentSession({
          orderId: order.id,
        });
        lines.push('## Payment');
        lines.push(`To complete the purchase, the user must visit this URL:`);
        lines.push(session.paymentUrl);
        lines.push('');
        lines.push('⚠️ Do NOT share payment credentials. The user must enter payment details on the hosted page.');
      } catch {
        lines.push('⚠️ Payment session could not be created automatically.');
        lines.push('The user can complete payment from their order page in the storefront.');
      }

      // Show digital fulfillment info if applicable
      if (order.items) {
        const digitalItems = order.items.filter(
          (i) => i.fulfillmentStatus === 'processing' || i.fulfillmentData,
        );
        if (digitalItems.length > 0) {
          lines.push('');
          lines.push('## Digital Delivery');
          lines.push('Digital products will be delivered automatically after payment:');
          for (const item of digitalItems) {
            lines.push(`• ${item.productName} — fulfillment status: ${item.fulfillmentStatus || 'pending'}`);
          }
        }
      }

      return formatSuccess(lines.join('\n'));
    } catch (error) {
      return formatError(error);
    }
  },
};

// ---------------------------------------------------------------------------
// Exported tool list (for MCP server registration)
// ---------------------------------------------------------------------------

export const TOOL_LIST = Object.values(toolSchemas);
