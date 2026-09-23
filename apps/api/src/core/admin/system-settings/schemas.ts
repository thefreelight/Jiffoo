/**
 * Admin System Settings OpenAPI Schemas
 */

import {
  createTypedReadResponses,
  createTypedUpdateResponses,
} from '@/types/common-dto';

// ============================================================================
// Settings Schema
// ============================================================================

const settingValueSchema = {
  oneOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'object', additionalProperties: true },
    { type: 'array', items: {} },
    { type: 'null' },
  ],
  description: 'Setting value (scalar, object, array, or null)',
} as const;

const settingsSchema = {
  type: 'object',
  properties: {
    'branding.platform_name': { type: 'string', description: 'Store/platform display name' },
    'branding.logo': { type: 'string', nullable: true, description: 'Store logo URL' },
    'branding.store_description': { type: 'string', nullable: true, description: 'Store description' },
    'contact.email': { type: 'string', nullable: true, description: 'Contact email' },
    'contact.phone': { type: 'string', nullable: true, description: 'Contact phone' },
    'contact.address': { type: 'string', nullable: true, description: 'Contact address' },
    'localization.currency': { type: 'string', description: 'Localization currency code' },
    'localization.locale': { type: 'string', enum: ['en', 'zh-Hans', 'zh-Hant'], description: 'Default notification locale' },
    'localization.timezone': { type: 'string', description: 'Default timezone (e.g. UTC)' },
    'checkout.address.countries_require_state_postal': {
      type: 'array',
      items: { type: 'string' },
      description: 'Uppercase country codes that require state and postal code when shipping address is provided',
    },
  },
  additionalProperties: settingValueSchema,
  description: 'System settings key-value map. Known keys are listed explicitly; custom keys are allowed.',
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const adminSettingsSchemas = {
  // GET /api/admin/settings
  getSettings: {
    response: createTypedReadResponses(settingsSchema),
  },

  // PUT /api/admin/settings/batch
  batchUpdateSettings: {
    body: {
      type: 'object',
      required: ['settings'],
      properties: {
        settings: {
          ...settingsSchema,
          description: 'Key-value settings to update (supports known and custom keys)',
        },
      },
    },
    response: createTypedUpdateResponses(settingsSchema),
  },
} as const;
