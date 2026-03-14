/**
 * Admin Theme Management OpenAPI Schemas
 */

import {
  createTypedReadResponses,
  createTypedUpdateResponses,
  createPageResultSchema,
} from '@/types/common-dto';

// ============================================================================
// Theme Metadata Schema
// ============================================================================

const themeMetaSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'Theme slug identifier' },
    name: { type: 'string', description: 'Theme display name' },
    version: { type: 'string', description: 'Theme version' },
    type: { type: 'string', enum: ['pack', 'app'], description: 'Theme type (pack or app)' },
    description: { type: 'string', nullable: true, description: 'Theme description' },
    author: { type: 'string', nullable: true, description: 'Theme author' },
    preview: { type: 'string', nullable: true, description: 'Preview image URL' },
    baseUrl: { type: 'string', nullable: true, description: 'Base URL for theme-app' },
    port: { type: 'number', nullable: true, description: 'Port for theme-app' },
    isActive: { type: 'boolean', description: 'Whether theme is currently active' },
  },
  required: ['slug', 'name', 'version', 'type'],
} as const;

// ============================================================================
// Active Theme Schema
// ============================================================================

const activeThemeSchema = {
  type: 'object',
  nullable: true,
  properties: {
    slug: { type: 'string', description: 'Theme slug' },
    name: { type: 'string', description: 'Theme name' },
    version: { type: 'string', description: 'Theme version' },
    source: { type: 'string', description: 'Theme source (builtin or installed)' },
    type: { type: 'string', enum: ['pack', 'app'], description: 'Theme type' },
    baseUrl: { type: 'string', nullable: true, description: 'Base URL for theme-app' },
    port: { type: 'number', nullable: true, description: 'Port for theme-app' },
    config: { type: 'object', additionalProperties: true, description: 'Theme config' },
  },
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const adminThemeSchemas = {
  // GET /api/admin/themes/{target}/installed
  getInstalled: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Items per page' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(themeMetaSchema)),
  },

  // GET /api/admin/themes/{target}/active
  getActive: {
    response: createTypedReadResponses(activeThemeSchema),
  },

  // POST /api/admin/themes/{target}/:slug/activate
  activate: {
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Theme slug to activate' },
      },
    },
    body: {
      type: 'object',
      properties: {
        config: { type: 'object', additionalProperties: true, description: 'Theme configuration' },
        type: { type: 'string', enum: ['pack', 'app'], description: 'Theme type: pack or app. Required when both variants share the same slug.' },
      },
    },
    response: createTypedUpdateResponses(activeThemeSchema),
  },

  // POST /api/admin/themes/{target}/rollback
  rollback: {
    response: createTypedUpdateResponses(activeThemeSchema),
  },

  // PUT /api/admin/themes/{target}/config
  updateConfig: {
    body: {
      type: 'object',
      additionalProperties: true,
      description: 'Theme configuration to update',
    },
    response: createTypedUpdateResponses(activeThemeSchema),
  },
} as const;

// Public theme schemas
export const publicThemeSchemas = {
  // GET /api/themes/active
  getActive: {
    querystring: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['shop', 'admin'], default: 'shop', description: 'Theme target' },
      },
    },
    response: createTypedReadResponses(activeThemeSchema),
  },

  // GET /api/themes/installed
  getInstalled: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Items per page' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(themeMetaSchema)),
  },
} as const;
