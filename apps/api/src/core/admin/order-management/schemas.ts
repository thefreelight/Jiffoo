/**
 * Admin Order Management OpenAPI Schemas
 */

import {
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

const shipmentStatusEnum = ['PENDING', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED'] as const;

// ============================================================================
// Admin Order Schemas
// ============================================================================

const adminOrderListItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Order ID' },
    status: { type: 'string', enum: orderStatusEnum, description: 'Order status' },
    paymentStatus: { type: 'string', enum: paymentStatusEnum, nullable: true, description: 'Payment status' },
    totalAmount: { type: 'number', description: 'Total order amount' },
    currency: { type: 'string', description: 'Currency code' },
    createdAt: { type: 'string', format: 'date-time' },
    itemsCount: { type: 'integer', description: 'Number of items in the order' },
    customer: {
      type: 'object',
      properties: {
        id: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        username: { type: 'string', nullable: true },
      },
      required: ['id', 'email', 'username'],
    },
  },
  required: ['id', 'status', 'totalAmount', 'currency', 'createdAt', 'itemsCount', 'customer'],
} as const;

const adminOrderDetailSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Order ID' },
    status: { type: 'string', enum: orderStatusEnum, description: 'Order status' },
    paymentStatus: { type: 'string', enum: paymentStatusEnum, nullable: true, description: 'Payment status' },
    totalAmount: { type: 'number', description: 'Total order amount' },
    currency: { type: 'string', description: 'Currency code' },
    notes: { type: 'string', nullable: true },
    cancelReason: { type: 'string', nullable: true, description: 'Cancellation reason' },
    cancelledAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    customer: {
      type: 'object',
      properties: {
        id: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        username: { type: 'string', nullable: true },
      },
      required: ['id', 'email', 'username'],
    },
    shippingAddress: {
      type: 'object',
      nullable: true,
      properties: {
        recipientName: { type: 'string' },
        phone: { type: 'string' },
        street: { type: 'string' },
        street2: { type: 'string', nullable: true },
        city: { type: 'string' },
        state: { type: 'string' },
        zipCode: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['recipientName', 'phone', 'street', 'city', 'state', 'zipCode', 'country'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          quantity: { type: 'integer' },
          unitPrice: { type: 'number' },
          totalPrice: { type: 'number' },
          productId: { type: 'string', nullable: true },
          productName: { type: 'string', nullable: true },
          variantId: { type: 'string', nullable: true },
          skuCode: { type: 'string', nullable: true },
          variantName: { type: 'string', nullable: true },
        },
        required: [
          'id',
          'quantity',
          'unitPrice',
          'totalPrice',
          'productId',
          'productName',
          'variantId',
          'skuCode',
          'variantName',
        ],
      },
    },
    shipments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          carrier: { type: 'string' },
          trackingNumber: { type: 'string' },
          status: { type: 'string', enum: shipmentStatusEnum },
          shippedAt: { type: 'string', format: 'date-time', nullable: true },
          deliveredAt: { type: 'string', format: 'date-time', nullable: true },
        },
        required: ['id', 'carrier', 'trackingNumber', 'status', 'shippedAt', 'deliveredAt'],
      },
    },
  },
  required: [
    'id',
    'status',
    'paymentStatus',
    'totalAmount',
    'currency',
    'notes',
    'cancelReason',
    'cancelledAt',
    'createdAt',
    'updatedAt',
    'customer',
    'shippingAddress',
    'items',
    'shipments',
  ],
} as const;

const adminOrderStatsSchema = {
  type: 'object',
  properties: {
    metrics: {
      type: 'object',
      properties: {
        totalOrders: { type: 'integer' },
        paidOrders: { type: 'integer' },
        shippedOrders: { type: 'integer' },
        refundedOrders: { type: 'integer' },
        totalRevenue: { type: 'number' },
        currency: { type: 'string' },
        totalOrdersTrend: { type: 'number' },
        paidOrdersTrend: { type: 'number' },
        shippedOrdersTrend: { type: 'number' },
        refundedOrdersTrend: { type: 'number' },
        totalRevenueTrend: { type: 'number' },
      },
      required: [
        'totalOrders',
        'paidOrders',
        'shippedOrders',
        'refundedOrders',
        'totalRevenue',
        'currency',
        'totalOrdersTrend',
        'paidOrdersTrend',
        'shippedOrdersTrend',
        'refundedOrdersTrend',
        'totalRevenueTrend',
      ],
    }
  },
  required: ['metrics'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const adminOrderSchemas = {
  // GET /api/admin/orders/ (paginated)
  listOrders: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1 },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
        status: { type: 'string', enum: orderStatusEnum, description: 'Filter by order status' },
        search: { type: 'string', description: 'Search by order id, customer email, or username' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(adminOrderListItemSchema)),
  },

  // GET /api/admin/orders/stats
  getOrderStats: {
    response: createTypedReadResponses(adminOrderStatsSchema),
  },

  // GET /api/admin/orders/:id
  getOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    response: createTypedReadResponses(adminOrderDetailSchema),
  },

  // PUT /api/admin/orders/:id/status
  updateStatus: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    body: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: orderStatusEnum, description: 'New order status' },
      },
    },
    response: createTypedUpdateResponses(adminOrderDetailSchema),
  },

  // POST /api/admin/orders/:id/ship
  shipOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    body: {
      type: 'object',
      required: ['carrier', 'trackingNumber'],
      properties: {
        carrier: { type: 'string', description: 'Shipping carrier name' },
        trackingNumber: { type: 'string', description: 'Tracking number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              orderItemId: { type: 'string' },
              quantity: { type: 'integer' },
            },
          },
          description: 'Optional partial shipment items',
        },
      },
    },
    response: createTypedUpdateResponses(adminOrderDetailSchema),
  },

  // POST /api/admin/orders/:id/refund
  refundOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    body: {
      type: 'object',
      required: ['idempotencyKey'],
      properties: {
        reason: { type: 'string', description: 'Refund reason' },
        idempotencyKey: { type: 'string', description: 'Idempotency key to prevent duplicate refunds' },
      },
    },
    response: createTypedUpdateResponses(adminOrderDetailSchema),
  },

  // POST /api/admin/orders/:id/cancel
  cancelOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    body: {
      type: 'object',
      required: ['cancelReason'],
      properties: {
        cancelReason: { type: 'string', description: 'Reason for cancellation' },
      },
    },
    response: createTypedUpdateResponses(adminOrderDetailSchema),
  },
} as const;
