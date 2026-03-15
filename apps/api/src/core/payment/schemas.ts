/**
 * Payment Module OpenAPI Schemas
 *
 * Detailed schema definitions for all payment endpoints
 */

import {
  createTypedCrudResponses,
  createTypedReadResponses,
} from '@/types/common-dto';

// ============================================================================
// Payment Method Schema
// ============================================================================

const paymentMethodSchema = {
  type: 'object',
  properties: {
    pluginSlug: { type: 'string', description: 'Plugin slug identifier' },
    name: { type: 'string', description: 'Payment method name (lowercase)' },
    displayName: { type: 'string', description: 'Display name for UI' },
    icon: { type: 'string', description: 'Icon URL path' },
    supportedCurrencies: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of supported currency codes',
    },
    isLive: { type: 'boolean', description: 'Whether this is a live (real) payment method' },
    clientConfig: {
      type: 'object',
      nullable: true,
      description: 'Client-safe payment config exposed to storefronts',
      properties: {
        publishableKey: { type: 'string', description: 'Public key used by client SDKs such as Stripe.js' },
      },
      additionalProperties: false,
    },
  },
  required: ['pluginSlug', 'name', 'displayName', 'icon', 'supportedCurrencies', 'isLive'],
} as const;

// ============================================================================
// Payment Session Schema
// ============================================================================

const paymentSessionSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string', description: 'Payment session ID' },
    url: { type: 'string', description: 'Redirect URL for payment' },
    expiresAt: { type: 'string', format: 'date-time', description: 'Session expiration time' },
  },
  required: ['sessionId', 'url', 'expiresAt'],
} as const;

// ============================================================================
// Payment Verification Schema
// ============================================================================

const paymentVerificationSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string', description: 'Payment session ID' },
    orderId: { type: 'string', nullable: true, description: 'Associated order ID' },
    status: { type: 'string', description: 'Payment status (completed, pending, failed)' },
    paidAt: { type: 'string', format: 'date-time', nullable: true, description: 'Payment completion time' },
    paymentMethod: { type: 'string', description: 'Payment method used' },
  },
  required: ['sessionId', 'status', 'paymentMethod'],
} as const;

// ============================================================================
// Webhook Response Schema
// ============================================================================

const webhookResponseSchema = {
  type: 'object',
  properties: {
    received: { type: 'boolean', description: 'Whether the webhook was received successfully' },
  },
  required: ['received'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const paymentSchemas = {
  // GET /api/payments/available-methods
  getAvailableMethods: {
    response: createTypedReadResponses({
      type: 'array',
      items: paymentMethodSchema,
      description: 'List of available payment methods',
    }),
  },

  // POST /api/payments/create-session
  createSession: {
    body: {
      type: 'object',
      required: ['paymentMethod', 'orderId'],
      properties: {
        paymentMethod: { type: 'string', description: 'Payment method to use (e.g., stripe, paypal, alipay)' },
        orderId: { type: 'string', description: 'Order ID to pay for' },
        successUrl: { type: 'string', description: 'URL to redirect on successful payment' },
        cancelUrl: { type: 'string', description: 'URL to redirect on cancelled payment' },
        idempotencyKey: { type: 'string', description: 'Idempotency key to avoid duplicate payment sessions' },
      },
    },
    response: createTypedCrudResponses(paymentSessionSchema),
  },

  // GET /api/payments/verify/:sessionId
  verifyPayment: {
    params: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string', description: 'Payment session ID to verify' },
      },
    },
    response: createTypedReadResponses(paymentVerificationSchema),
  },

  // POST /api/payments/webhook/:provider
  webhook: {
    params: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: { type: 'string', description: 'Payment provider name (e.g., stripe, paypal)' },
      },
    },
    body: {
      type: 'object',
      additionalProperties: true,
      description: 'Webhook payload forwarded by the payment provider (provider-specific JSON structure)',
    },
    response: createTypedCrudResponses(webhookResponseSchema),
  },
} as const;
