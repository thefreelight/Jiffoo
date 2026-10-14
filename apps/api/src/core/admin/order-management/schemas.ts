/**
 * Admin Order Management OpenAPI Schemas
 */

import {
  createTypedReadResponses,
  createTypedUpdateResponses,
  createPageResultSchema,
  errorResponseSchema,
} from '@/types/common-dto';

const orderStatusEnum = [
  'PENDING',
  'PROCESSING',
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
    itemQuantitySum: { type: 'integer', description: 'Sum of order item quantities' },
    requiresPaymentReview: { type: 'boolean', description: 'Has an unresolved REQUIRES_REVIEW payment attempt' },
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
  required: ['id', 'status', 'totalAmount', 'currency', 'createdAt', 'itemsCount', 'itemQuantitySum', 'requiresPaymentReview', 'customer'],
} as const;

const adminOrderDetailSchema = {
  type: 'object',
  properties: {
    customerOrderNumber: { type: 'integer', minimum: 1 },
    customerOrderCount: { type: 'integer', minimum: 1 },
    amounts: {
      type: 'object', required: ['subtotal', 'shipping', 'tax', 'taxInclusive', 'total'],
      properties: { subtotal: { type: 'number' }, shipping: { type: 'number' }, tax: { type: 'number' }, taxInclusive: { type: 'boolean' }, total: { type: 'number' } },
    },
    timeline: {
      type: 'array', items: { type: 'object', required: ['at', 'fromStatus', 'toStatus', 'fromPaymentStatus', 'toPaymentStatus', 'actorType'],
        properties: { at: { type: 'string', format: 'date-time' }, fromStatus: { type: 'string', nullable: true }, toStatus: { type: 'string' },
          fromPaymentStatus: { type: 'string', nullable: true }, toPaymentStatus: { type: 'string', nullable: true }, actorType: { type: 'string', nullable: true } } },
    },
    id: { type: 'string', description: 'Order ID' },
    status: { type: 'string', enum: orderStatusEnum, description: 'Order status' },
    paymentStatus: { type: 'string', enum: paymentStatusEnum, nullable: true, description: 'Payment status' },
    totalAmount: { type: 'number', description: 'Total order amount' },
    currency: { type: 'string', description: 'Currency code' },
    notes: { type: 'string', nullable: true },
    paymentMethod: { type: 'string', nullable: true },
    canRecordManualPayment: { type: 'boolean' },
    refundRequired: { type: 'boolean' },
    canRefundOrder: { type: 'boolean' },
    paymentAttemptState: { type: 'string', nullable: true },
    paymentReviews: {
      type: 'array', items: {
        type: 'object', properties: {
          paymentId: { type: 'string' }, attemptNumber: { type: 'integer' }, status: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' },
          failureReason: { type: 'string', nullable: true }, reviewResolution: { type: 'string', nullable: true },
          reviewResolvedAt: { type: 'string', format: 'date-time', nullable: true },
          reviewResolvedBy: { type: 'string', nullable: true }, reviewReference: { type: 'string', nullable: true },
        }, required: ['paymentId', 'status', 'amount', 'currency', 'failureReason', 'reviewResolution', 'reviewResolvedAt', 'reviewResolvedBy', 'reviewReference'],
      },
    },
    refundResolutions: {
      type: 'array', items: {
        type: 'object', properties: {
          paymentId: { type: 'string' }, providerPaymentId: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'resolved'] }, reference: { type: 'string', nullable: true },
        }, required: ['paymentId', 'providerPaymentId', 'amount', 'currency', 'status', 'reference'],
      },
    },
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
          productImages: { type: 'array', items: { type: 'string' } },
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
    'amounts', 'timeline', 'customerOrderNumber', 'customerOrderCount',
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
    statusCounts: { type: 'object', properties: Object.fromEntries(orderStatusEnum.map(status => [status, { type: 'integer' }])), required: orderStatusEnum },
    paymentReviewCount: { type: 'integer' },
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
  required: ['metrics', 'statusCounts', 'paymentReviewCount'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const orderFilterProperties = {
  customerId: { type: 'string', minLength: 1, description: 'Exact customer user ID' },
  status: { type: 'string', enum: orderStatusEnum, description: 'Filter by order status' },
  paymentStatus: { type: 'string', enum: ['PAID', 'UNPAID', 'REFUNDED'], description: 'Unpaid includes pending and failed payments' },
  paymentReview: { type: 'string', enum: ['required'], description: 'Filter orders with unresolved payment reviews' },
  search: { type: 'string', description: 'Search by order id, customer email, or username' },
  createdFrom: { type: 'string', format: 'date-time', description: 'Inclusive UTC lower bound' },
  createdTo: { type: 'string', format: 'date-time', description: 'Exclusive UTC upper bound' },
} as const;
const orderSortProperties = {
  sortBy: { type: 'string', enum: ['createdAt', 'totalAmount'], default: 'createdAt' },
  sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
} as const;

export const adminOrderSchemas = {
  neighbors: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } },
    querystring: { type: 'object', additionalProperties: false, properties: { ...orderFilterProperties, ...orderSortProperties } },
    response: { ...createTypedReadResponses({ type: 'object', required: ['position', 'total', 'previousId', 'nextId'], properties: {
      position: { type: 'integer', minimum: 1, nullable: true }, total: { type: 'integer', minimum: 0 },
      previousId: { type: 'string', nullable: true }, nextId: { type: 'string', nullable: true },
    } }), 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema },
  },
  exportOrders: {
    body: { type: 'object', additionalProperties: false, required: ['selection'], properties: {
      ...orderSortProperties,
      selection: { type: 'object', additionalProperties: false, required: ['mode'], properties: {
        mode: { type: 'string', enum: ['ids', 'filter'] },
        ids: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'string', minLength: 1 } },
        filter: { type: 'object', additionalProperties: false, properties: orderFilterProperties },
        excludeIds: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1 } },
      }, oneOf: [
        { properties: { mode: { const: 'ids' } }, required: ['ids'], not: { anyOf: [{ required: ['filter'] }, { required: ['excludeIds'] }] } },
        { properties: { mode: { const: 'filter' } }, required: ['filter'], not: { required: ['ids'] } },
      ] },
    } },
    response: { 200: { description: 'UTF-8 CSV with BOM', content: { 'text/csv': { schema: { type: 'string' } } } },
      400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 500: errorResponseSchema },
  },
  resolvePaymentReview: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: { type: 'object', additionalProperties: false, required: ['paymentId', 'reference'], properties: {
      paymentId: { type: 'string', minLength: 1 }, reference: { type: 'string', minLength: 1, maxLength: 256 },
    } },
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
  },
  // GET /api/admin/orders/ (paginated)
  listOrders: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1 },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        ...orderFilterProperties,
        ...orderSortProperties,
      },
    },
    response: { ...createTypedReadResponses(createPageResultSchema(adminOrderListItemSchema)), 400: errorResponseSchema },
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

  recordManualPayment: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Order ID' },
      },
    },
    body: {
      type: 'object',
      required: ['reference'],
      properties: {
        reference: { type: 'string', minLength: 1, maxLength: 256, description: 'Required offline payment reference' },
      },
    },
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
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
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
  },

  deliverOrder: {
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
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
      required: ['idempotencyKey', 'reference'],
      properties: {
        reference: { type: 'string', minLength: 1, maxLength: 256, description: 'Required offline full refund reference' },
        reason: { type: 'string', description: 'Refund reason' },
        idempotencyKey: { type: 'string', description: 'Idempotency key to prevent duplicate refunds' },
      },
    },
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
  },

  // POST /api/admin/orders/:id/cancel
  resolveRefundRequiredPayment: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object', additionalProperties: false, required: ['paymentId', 'providerPaymentId', 'reference', 'idempotencyKey'],
      properties: {
        paymentId: { type: 'string', minLength: 1 },
        providerPaymentId: { type: 'string', minLength: 1 },
        reference: { type: 'string', minLength: 1, maxLength: 256 },
        idempotencyKey: { type: 'string', minLength: 1 },
      },
    },
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
  },

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
    response: { ...createTypedUpdateResponses(adminOrderDetailSchema), 409: errorResponseSchema },
  },
} as const;
