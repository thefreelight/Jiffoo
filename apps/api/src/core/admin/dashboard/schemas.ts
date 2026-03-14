/**
 * Admin Dashboard OpenAPI Schemas
 */

import { errorResponseSchema, createSuccessResponseSchema } from '@/types/common-dto';

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

// ============================================================================
// Dashboard Metrics Schema
// ============================================================================

const dashboardMetricsSchema = {
  type: 'object',
  properties: {
    metrics: {
      type: 'object',
      properties: {
        totalRevenue: { type: 'number', description: 'Total revenue' },
        totalOrders: { type: 'number', description: 'Total orders count' },
        totalProducts: { type: 'number', description: 'Total products count' },
        totalUsers: { type: 'number', description: 'Total users count' },
        currency: { type: 'string', description: 'Currency code' },
        totalRevenueTrend: { type: 'number', description: 'Revenue trend compared to yesterday in percentage' },
        totalOrdersTrend: { type: 'number', description: 'Orders trend compared to yesterday in percentage' },
        totalProductsTrend: { type: 'number', description: 'Products trend compared to yesterday in percentage' },
        totalUsersTrend: { type: 'number', description: 'Users trend compared to yesterday in percentage' },
      },
      required: [
        'totalRevenue',
        'totalOrders',
        'totalProducts',
        'totalUsers',
        'currency',
        'totalRevenueTrend',
        'totalOrdersTrend',
        'totalProductsTrend',
        'totalUsersTrend'
      ],
    },
    ordersByStatus: {
      type: 'object',
      additionalProperties: { type: 'number' },
      description: 'Order counts grouped by status',
    },
    recentOrders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
          status: { type: 'string', enum: orderStatusEnum, description: 'Order status' },
          paymentStatus: { type: 'string', enum: paymentStatusEnum, nullable: true, description: 'Payment status' },
          totalAmount: { type: 'number', description: 'Total amount' },
          currency: { type: 'string', description: 'Currency code' },
          createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
          customer: {
            type: 'object',
            properties: {
              id: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              username: { type: 'string', nullable: true },
            },
          },
        },
      },
      description: 'Recent orders list',
    },
  },
  required: ['metrics', 'ordersByStatus', 'recentOrders'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const adminDashboardSchemas = {
  // GET /api/admin/dashboard
  getDashboard: {
    querystring: {
      type: 'object',
      properties: {
        include: { type: 'string', description: 'Comma-separated list of sections to include' },
      },
    },
    response: {
      200: createSuccessResponseSchema(dashboardMetricsSchema),
      401: errorResponseSchema,
      403: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
} as const;
