/**
 * Cart Module OpenAPI Schemas
 *
 * Detailed schema definitions for all cart endpoints
 */

import {
  createTypedCrudResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
  createTypedDeleteResponses,
} from '@/types/common-dto';

// ============================================================================
// Cart Item Schema (Matches CartService output)
// ============================================================================

const cartItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Cart item ID' },
    productId: { type: 'string', description: 'Product ID' },
    productName: { type: 'string', description: 'Product name' },
    productImage: { type: 'string', description: 'Primary product image URL' },
    price: { type: 'number', description: 'Unit price at the time of adding to cart' },
    quantity: { type: 'integer', description: 'Quantity of this item' },
    variantId: { type: 'string', description: 'Variant ID' },
    variantName: { type: 'string', nullable: true, description: 'Variant name' },
    variantAttributes: { type: 'object', nullable: true, additionalProperties: true, description: 'Variant attributes snapshot' },
    requiresShipping: { type: 'boolean', description: 'Whether this item requires shipping address' },
    maxQuantity: { type: 'integer', description: 'Maximum quantity allowed (based on stock)' },
    subtotal: { type: 'number', description: 'Item subtotal (price * quantity)' },
    fulfillmentData: { type: 'object', nullable: true, additionalProperties: true, description: 'Supplier fulfillment payload' },
  },
  required: [
    'id',
    'productId',
    'productName',
    'productImage',
    'price',
    'quantity',
    'variantId',
    'requiresShipping',
    'maxQuantity',
    'subtotal',
  ],
} as const;

// ============================================================================
// Cart Schema (Full cart with items, matches CartService)
// ============================================================================

const cartSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Cart ID' },
    userId: { type: 'string', description: 'User ID who owns the cart' },
    items: {
      type: 'array',
      items: cartItemSchema,
      description: 'List of items in the cart',
    },
    total: { type: 'number', description: 'Total amount' },
    itemCount: { type: 'integer', description: 'Total quantity across items' },
    subtotal: { type: 'number', description: 'Subtotal before tax/shipping' },
    tax: { type: 'number', description: 'Tax amount' },
    shipping: { type: 'number', description: 'Shipping amount' },
    discount: { type: 'number', description: 'Discount amount' },
    discountAmount: { type: 'number', description: 'Discount amount alias for compatibility' },
    appliedDiscounts: {
      type: 'array',
      description: 'Applied discount list',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string' },
          type: { type: 'string' },
          value: { type: 'number' },
          amount: { type: 'number' },
        },
      },
    },
    status: { type: 'string', description: 'Cart status' },
    createdAt: { type: 'string', format: 'date-time', description: 'Cart creation timestamp' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
  },
  required: [
    'id',
    'userId',
    'items',
    'total',
    'itemCount',
    'subtotal',
    'tax',
    'shipping',
    'discount',
    'discountAmount',
    'appliedDiscounts',
    'status',
    'createdAt',
    'updatedAt',
  ],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const cartSchemas = {
  // GET /api/cart/
  getCart: {
    response: createTypedReadResponses(cartSchema),
  },

  // POST /api/cart/items
  addToCart: {
    body: {
      type: 'object',
      required: ['productId'],
      properties: {
        productId: { type: 'string', description: 'Product ID to add to cart' },
        quantity: { type: 'integer', default: 1, minimum: 1, description: 'Quantity to add (default: 1)' },
        variantId: { type: 'string', description: 'Optional product variant ID' },
        fulfillmentData: {
          type: 'object',
          nullable: true,
          additionalProperties: true,
          description: 'Supplier fulfillment payload such as cardUid or shippingAddress',
        },
      },
    },
    response: createTypedCrudResponses(cartSchema),
  },

  // POST /api/cart/items/batch
  batchAddToCart: {
    body: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['productId'],
            properties: {
              productId: { type: 'string', description: 'Product ID to add to cart' },
              quantity: { type: 'integer', default: 1, minimum: 1, description: 'Quantity to add (default: 1)' },
              variantId: { type: 'string', description: 'Optional product variant ID' },
            },
          },
          description: 'Array of items to add to cart',
        },
      },
    },
    response: createTypedCrudResponses(cartSchema),
  },

  // PUT /api/cart/items/:itemId
  updateCartItem: {
    params: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { type: 'string', description: 'Cart item ID to update' },
      },
    },
    body: {
      type: 'object',
      required: ['quantity'],
      properties: {
        quantity: { type: 'integer', minimum: 1, description: 'New quantity for the cart item' },
      },
    },
    response: createTypedUpdateResponses(cartSchema),
  },

  // DELETE /api/cart/items/:itemId
  removeFromCart: {
    params: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { type: 'string', description: 'Cart item ID to remove' },
      },
    },
    response: createTypedDeleteResponses(cartSchema),
  },

  // DELETE /api/cart/
  clearCart: {
    response: createTypedDeleteResponses(cartSchema),
  },
} as const;
