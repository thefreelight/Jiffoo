import { createTypedReadResponses } from '@/types/common-dto';

const shippingAddressSchema = {
  type: 'object',
  required: ['country'],
  properties: {
    country: { type: 'string' },
    state: { type: 'string' },
    city: { type: 'string' },
    postalCode: { type: 'string' },
    addressLine1: { type: 'string' },
    addressLine2: { type: 'string' },
  },
} as const;

const quoteResponseSchema = {
  type: 'object',
  properties: {
    currency: { type: 'string' },
    subtotal: { type: 'string' },
    shippingOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          providerSlug: { type: 'string' },
          label: { type: 'string' },
          amount: { type: 'string' },
          amountMinor: { type: 'integer' },
          estimatedDays: {
            type: 'object',
            properties: { min: { type: 'integer' }, max: { type: 'integer' } },
            required: ['min', 'max'],
          },
        },
        required: ['id', 'providerSlug', 'label', 'amount', 'amountMinor'],
      },
    },
    paymentMethods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          providerSlug: { type: 'string' },
          displayName: { type: 'string' },
          requiresManualConfirmation: { type: 'boolean' },
        },
        required: ['providerSlug', 'displayName', 'requiresManualConfirmation'],
      },
    },
    tax: { type: 'string' },
    taxInclusive: { type: 'boolean' },
    total: { type: 'string' },
  },
  required: ['currency', 'subtotal', 'shippingOptions', 'paymentMethods'],
} as const;

export const checkoutSchemas = {
  quote: {
    body: {
      type: 'object',
      required: ['shippingAddress'],
      properties: { shippingAddress: shippingAddressSchema, shippingOptionId: { type: 'string' } },
    },
    response: createTypedReadResponses(quoteResponseSchema),
  },
} as const;
