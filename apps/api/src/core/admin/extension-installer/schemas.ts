/**
 * Extension Installer OpenAPI Schemas
 */

import {
  createTypedReadResponses,
  createTypedCreateResponses,
  createTypedDeleteResponses,
  createTypedUpdateResponses,
  createPageResultSchema,
  uploadResultSchema,
} from '@/types/common-dto';
import { errorResponseSchema } from '@/utils/schema-helpers';

// ============================================================================
// Extension Metadata Schema
// ============================================================================

const extensionMetaSchema = {
  type: 'object',
  properties: {
    slug: { type: 'string', description: 'Extension slug identifier' },
    name: { type: 'string', description: 'Extension display name' },
    version: { type: 'string', description: 'Extension version' },
    description: { type: 'string', nullable: true, description: 'Extension description' },
    author: { type: 'string', nullable: true, description: 'Extension author' },
    category: { type: 'string', nullable: true, description: 'Extension category' },
    runtimeType: { type: 'string', nullable: true, description: 'Extension runtime type' },
    trustLevel: { type: 'string', nullable: true, description: 'Plugin trust level (builtin | signed | unsigned)' },
    publisherId: { type: 'string', nullable: true },
    publisherName: { type: 'string', nullable: true },
    publisherVerified: { type: 'boolean' },
    signingRoot: { type: 'string', enum: ['official', 'test'], nullable: true },
    publisherCertificateFingerprint: { type: 'string', nullable: true },
    source: { type: 'string', nullable: true, description: 'Extension source' },
    manifestJson: {
      description: 'Raw or parsed manifest JSON payload',
      anyOf: [
        { type: 'string' },
        { type: 'object', additionalProperties: true },
        { type: 'null' },
      ],
    },
    manifestError: {
      type: 'object',
      nullable: true,
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              message: { type: 'string' },
              code: { type: 'string' },
            },
            required: ['path', 'message', 'code'],
          },
        },
      },
      required: ['issues'],
    },
    deletedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Soft-delete timestamp for uninstalled plugin' },
    lastFailureAt: { type: 'string', format: 'date-time', nullable: true, description: 'Timestamp of the last recorded error; not current health' },
    lastFailureMessage: { type: 'string', nullable: true, maxLength: 500, description: 'Sanitized last recorded error; historical information' },
    packageState: {
      type: 'object', required: ['status', 'code'],
      properties: {
        status: { type: 'string', enum: ['available', 'unavailable', 'corrupt'] },
        code: { type: 'string', nullable: true, enum: ['PLUGIN_PACKAGE_UNAVAILABLE', 'PLUGIN_PACKAGE_CORRUPT', null] },
      },
    },
  },
  required: ['slug', 'name', 'version'],
} as const;

// ============================================================================
// Plugin Instance Schema
// ============================================================================

const pluginInstanceSchema = {
  type: 'object',
  properties: {
    installationId: { type: 'string', description: 'Unique installation ID' },
    pluginSlug: { type: 'string', description: 'Plugin slug' },
    instanceKey: { type: 'string', description: 'Instance key (unique per plugin)' },
    enabled: { type: 'boolean', description: 'Whether instance is enabled' },
    config: { type: 'object', additionalProperties: true, description: 'Instance configuration' },
    configMeta: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description: 'Metadata describing write-only configuration fields',
    },
    grantedPermissions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Granted permissions',
    },
    lastFailureAt: { type: 'string', format: 'date-time', nullable: true, description: 'Most recent runtime failure time' },
    lastFailureMessage: { type: 'string', nullable: true, description: 'Most recent runtime failure message' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update time' },
    replacedPlugins: { type: 'array', items: { type: 'string' }, description: 'Providers disabled by a single-provider replacement' },
  },
  required: ['installationId', 'pluginSlug', 'instanceKey', 'enabled', 'createdAt', 'updatedAt'],
} as const;

const uninstallPluginResultSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['plugin'], description: 'Extension kind' },
    slug: { type: 'string', description: 'Uninstalled plugin slug' },
    uninstalled: { type: 'boolean', description: 'Whether uninstallation succeeded' },
  },
  required: ['kind', 'slug', 'uninstalled'],
} as const;

const restorePluginResultSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['plugin'], description: 'Extension kind' },
    slug: { type: 'string', description: 'Restored plugin slug' },
    restored: { type: 'boolean', description: 'Whether restore succeeded' },
  },
  required: ['kind', 'slug', 'restored'],
} as const;

const purgePluginResultSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['plugin'], description: 'Extension kind' },
    slug: { type: 'string', description: 'Purged plugin slug' },
    purged: { type: 'boolean', description: 'Whether purge succeeded' },
  },
  required: ['kind', 'slug', 'purged'],
} as const;

const extensionInstallWithUploadSchema = {
  type: 'object',
  properties: {
    ...uploadResultSchema.properties,
    ...extensionMetaSchema.properties,
    kind: { type: 'string', const: 'plugin' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    ...uploadResultSchema.required,
    ...extensionMetaSchema.required,
  ],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const extensionInstallerSchemas = {
  // Plugin Gateway (passthrough - only error responses defined)
  pluginGateway: {
    response: {
      200: { type: 'string', description: 'Passthrough response from plugin' },
      400: errorResponseSchema,
      404: errorResponseSchema,
      500: errorResponseSchema,
      503: errorResponseSchema,
    },
  },

  // GET /api/extensions/plugin/:slug/instances
  listInstances: {
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug' },
      },
    },
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Items per page' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(pluginInstanceSchema)),
  },

  // PATCH /api/extensions/plugin/:slug/instances/:installationId
  updateInstance: {
    params: {
      type: 'object',
      required: ['slug', 'installationId'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug' },
        installationId: { type: 'string', description: 'Installation ID' },
      },
    },
    body: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable/disable instance' },
        config: { type: 'object', additionalProperties: true, description: 'Configuration updates' },
        grantedPermissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated granted permissions',
        },
      },
    },
    response: { ...createTypedUpdateResponses(pluginInstanceSchema), 409: errorResponseSchema, 503: errorResponseSchema },
  },

  // POST /api/extensions/:kind/install
  installExtension: {
    body: { type: 'object', required: ['file', 'previewToken'], additionalProperties: false, properties: {
      file: { type: 'string', format: 'binary' }, previewToken: { type: 'string', maxLength: 8192 },
      confirmUnsigned: { type: 'string', enum: ['true', 'false'] }, confirmationSlug: { type: 'string' },
    } },
    response: {
      200: { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: extensionInstallWithUploadSchema } },
      400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 500: errorResponseSchema,
      413: errorResponseSchema,
      422: errorResponseSchema,
      409: errorResponseSchema,
    },
    lastFailureAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last plugin failure timestamp' },
    lastFailureMessage: { type: 'string', nullable: true, description: 'Last plugin failure message' },
  },

  previewPlugin: {
    body: { type: 'object', required: ['file'], additionalProperties: false, properties: { file: { type: 'string', format: 'binary' } } },
    response: {
      200: { type: 'object', required: ['success', 'data'], properties: {
        success: { type: 'boolean' }, data: { type: 'object', required: ['package', 'current', 'operation', 'compatibility', 'requiresUnsignedConfirmation', 'expiresAt', 'previewToken'], properties: {
          package: { type: 'object', required: ['slug', 'name', 'version', 'hash', 'trust', 'publisher', 'declaredCapabilities'], properties: {
            slug: { type: 'string' }, name: { type: 'string' }, version: { type: 'string' }, hash: { type: 'string' }, trust: { type: 'string', enum: ['signed', 'unsigned'] },
            publisher: { type: 'object', nullable: true, properties: { publisherId: { type: 'string' }, publisherName: { type: 'string' }, publisherCertificateFingerprint: { type: 'string' }, signingRoot: { type: 'string', enum: ['official', 'test'] } } },
            declaredCapabilities: { type: 'array', items: { type: 'string' } },
          } },
          current: { type: 'object', required: ['version', 'hash', 'state'], properties: { version: { type: 'string', nullable: true }, hash: { type: 'string', nullable: true }, state: { type: 'string', enum: ['installed', 'uninstalled', 'not-installed'] } } },
          operation: { type: 'string', enum: ['install', 'upgrade', 'unchanged'] },
          compatibility: { type: 'object', required: ['compatible', 'currentApiVersion'], properties: { compatible: { type: 'boolean' }, currentApiVersion: { type: 'string' }, requiredApiVersion: { type: 'string' }, reason: { type: 'string' } } },
          requiresUnsignedConfirmation: { type: 'boolean' }, expiresAt: { type: 'string', format: 'date-time' }, previewToken: { type: 'string' },
        } },
      } },
      400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 409: errorResponseSchema, 413: errorResponseSchema, 422: errorResponseSchema, 500: errorResponseSchema,
    },
  },

  // GET /api/extensions/plugin
  listPlugins: {
    params: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: { type: 'string', enum: ['plugin'], description: 'Extension kind' },
      },
    },
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Page size' },
        state: { type: 'string', enum: ['active', 'removed'], default: 'active' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(extensionMetaSchema)),
  },

  // GET /api/extensions/plugin/:slug
  getPlugin: {
    params: {
      type: 'object',
      required: ['kind', 'slug'],
      properties: {
        kind: { type: 'string', enum: ['plugin'], description: 'Extension kind' },
        slug: { type: 'string', description: 'Plugin slug' },
      },
    },
    response: createTypedReadResponses(extensionMetaSchema),
  },

  // DELETE /api/extensions/plugin/:slug
  uninstallPlugin: {
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug to uninstall' },
      },
    },
    response: { ...createTypedDeleteResponses(uninstallPluginResultSchema), 400: errorResponseSchema, 409: errorResponseSchema },
  },

  // POST /api/extensions/plugin/:slug/restore
  restorePlugin: {
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug to restore' },
      },
    },
    response: { ...createTypedReadResponses(restorePluginResultSchema), 409: errorResponseSchema, 503: errorResponseSchema },
  },

  // DELETE /api/extensions/plugin/:slug/purge
  purgePlugin: {
    body: {
      type: 'object', additionalProperties: false,
      properties: { confirmationSlug: { type: 'string' } },
    },
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug to purge permanently' },
      },
    },
    response: { ...createTypedDeleteResponses(purgePluginResultSchema), 400: errorResponseSchema, 409: errorResponseSchema },
  },

} as const;
