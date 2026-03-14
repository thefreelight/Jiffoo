/**
 * Order Module OpenAPI Schemas
 *
 * Detailed schema definitions for all order endpoints
 */

import {
  createTypedCrudResponses,
  createTypedCreateResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
  createPageResultSchema,
} from '@/types/common-dto';

const orderStatusEnum = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'COMPLETED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;

const paymentStatusEnum = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

const fulfillmentStatusEnum = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'failed',
] as const;

const shipmentStatusEnum = ['PENDING', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED'] as const;

// ============================================================================
// Order Item Response Schema
// ============================================================================

const orderItemResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Order item ID' },
    productId: { type: 'string', description: 'Product ID' },
    productName: { type: 'string', description: 'Product name snapshot' },
    variantId: { type: 'string', description: 'Product variant ID' },
    variantName: { type: 'string', nullable: true, description: 'Variant name snapshot' },
    variantAttributes: { type: 'object', nullable: true, additionalProperties: true, description: 'Variant attributes snapshot' },
    quantity: { type: 'number', description: 'Quantity ordered' },
    unitPrice: { type: 'number', description: 'Unit price at time of order' },
    totalPrice: { type: 'number', description: 'Total price for this item' },
    fulfillmentStatus: {
      type: 'string',
      enum: fulfillmentStatusEnum,
      nullable: true,
      description: 'Fulfillment status',
    },
    fulfillmentData: { type: 'object', nullable: true, additionalProperties: true, description: 'Fulfillment payload' },
  },
  required: ['id', 'productId', 'productName', 'variantId', 'quantity', 'unitPrice', 'totalPrice'],
} as const;

const shipmentItemResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Shipment item ID' },
    orderItemId: { type: 'string', description: 'Associated order item ID' },
    quantity: { type: 'number', description: 'Quantity shipped' },
  },
  required: ['id', 'orderItemId', 'quantity'],
} as const;

const shipmentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Shipment ID' },
    trackingNumber: { type: 'string', nullable: true, description: 'Carrier tracking number' },
    carrier: { type: 'string', nullable: true, description: 'Shipping carrier' },
    status: { type: 'string', enum: shipmentStatusEnum, description: 'Shipment status' },
    shippedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Shipment time' },
    deliveredAt: { type: 'string', format: 'date-time', nullable: true, description: 'Delivery time' },
    items: { type: 'array', items: shipmentItemResponseSchema, description: 'Shipment items' },
  },
  required: ['id', 'status', 'items'],
} as const;

// ============================================================================
// Order Response Schema
// ============================================================================

const orderResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Order ID' },
    userId: { type: 'string', description: 'User ID who placed the order' },
    status: { type: 'string', enum: orderStatusEnum, description: 'Order status' },
    paymentStatus: { type: 'string', enum: paymentStatusEnum, description: 'Payment status' },
    subtotalAmount: { type: 'number', description: 'Subtotal before discount/tax/shipping' },
    totalAmount: { type: 'number', description: 'Total order amount' },
    discountAmount: { type: 'number', description: 'Discount amount applied to this order' },
    appliedDiscounts: {
      type: 'array',
      description: 'Applied discount entries',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string' },
          discountAmount: { type: 'number' },
        },
        required: ['id', 'code', 'discountAmount'],
      },
    },
    currency: { type: 'string', description: 'Currency code (e.g., USD)' },
    shippingAddress: { type: 'object', nullable: true, additionalProperties: true, description: 'Shipping address snapshot' },
    shipments: { type: 'array', items: shipmentResponseSchema, description: 'Shipment records (if any)' },
    items: { type: 'array', items: orderItemResponseSchema, description: 'Order items' },
    createdAt: { type: 'string', format: 'date-time', description: 'Order creation timestamp' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
    cancelReason: { type: 'string', nullable: true, description: 'Cancellation reason (if cancelled)' },
    cancelledAt: { type: 'string', format: 'date-time', nullable: true, description: 'Cancellation time (if cancelled)' },
  },
  required: ['id', 'userId', 'status', 'paymentStatus', 'totalAmount', 'currency', 'items', 'createdAt', 'updatedAt'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const orderSchemas = {
  // POST /api/orders/
  createOrder: {
    body: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['productId', 'variantId', 'quantity'],
            properties: {
              productId: { type: 'string', description: 'Product ID to order' },
              variantId: { type: 'string', description: 'Product variant ID' },
              quantity: { type: 'integer', minimum: 1, description: 'Quantity to order' },
              fulfillmentData: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
                description: 'Supplier fulfillment payload such as cardUid or shippingAddress',
              },
            },
          },
          description: 'List of items to order',
        },
        shippingAddress: {
          type: 'object',
          nullable: true,
          additionalProperties: true,
          required: ['addressLine1', 'city', 'country'],
          properties: {
            firstName: { type: 'string', minLength: 1, description: 'Recipient first name' },
            lastName: { type: 'string', minLength: 1, description: 'Recipient last name' },
            fullName: { type: 'string', minLength: 1, description: 'Legacy full name field' },
            phone: { type: 'string', minLength: 1, description: 'Recipient phone number (optional for legacy payloads)' },
            addressLine1: { type: 'string', minLength: 1, description: 'Street address line 1' },
            addressLine2: { type: 'string', nullable: true, description: 'Street address line 2 (optional)' },
            city: { type: 'string', minLength: 1, description: 'City' },
            state: { type: 'string', nullable: true, description: 'State / Province / Region (required for some countries)' },
            postalCode: { type: 'string', nullable: true, description: 'Postal / ZIP code (required for some countries)' },
            country: { type: 'string', minLength: 1, description: 'Country / Region' },
            email: { type: 'string', format: 'email', nullable: true, description: 'Address contact email (optional)' },
          },
          description: 'Shipping address for the order',
        },
        customerEmail: {
          type: 'string',
          format: 'email',
          description: 'Customer contact email (optional, defaults to authenticated user email)',
        },
        discountCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional discount codes to apply during order creation',
        },
      },
    },
    response: createTypedCreateResponses(orderResponseSchema),
  },

  // GET /api/orders/ (paginated)
  listOrders: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100, description: 'Items per page' },
        status: { type: 'string', enum: orderStatusEnum, description: 'Filter by order status' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(orderResponseSchema)),
  },

  // GET /api/orders/:id
  getOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    response: createTypedReadResponses(orderResponseSchema),
  },

  // POST /api/orders/:id/cancel
  cancelOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID to cancel' },
      },
    },
    body: {
      type: 'object',
      required: ['cancelReason'],
      properties: {
        cancelReason: { type: 'string', minLength: 1, description: 'Reason for cancellation' },
      },
    },
    response: createTypedUpdateResponses(orderResponseSchema),
  },
} as const;
