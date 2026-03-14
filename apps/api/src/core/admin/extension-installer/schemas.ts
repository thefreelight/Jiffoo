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
    source: { type: 'string', nullable: true, description: 'Extension source' },
    manifestJson: {
      description: 'Raw or parsed manifest JSON payload',
      anyOf: [
        { type: 'string' },
        { type: 'object', additionalProperties: true },
        { type: 'null' },
      ],
    },
    deletedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Soft-delete timestamp for uninstalled plugin' },
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
    grantedPermissions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Granted permissions',
    },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update time' },
  },
  required: ['installationId', 'pluginSlug', 'instanceKey', 'enabled', 'createdAt', 'updatedAt'],
} as const;

const deletePluginInstanceResultSchema = {
  type: 'object',
  properties: {
    pluginSlug: { type: 'string', description: 'Plugin slug' },
    installationId: { type: 'string', description: 'Deleted installation ID' },
    instanceKey: { type: 'string', description: 'Deleted instance key' },
    deleted: { type: 'boolean', description: 'Whether deletion succeeded' },
  },
  required: ['pluginSlug', 'installationId', 'instanceKey', 'deleted'],
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

const uninstallExtensionResultSchema = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: ['theme-shop', 'theme-admin', 'theme-app-shop', 'theme-app-admin', 'plugin'],
      description: 'Extension kind',
    },
    slug: { type: 'string', description: 'Uninstalled extension slug' },
    uninstalled: { type: 'boolean', description: 'Whether uninstallation succeeded' },
  },
  required: ['kind', 'slug', 'uninstalled'],
} as const;

// ============================================================================
// Bundle Install Result Schema
// ============================================================================

const bundleInstallResultSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Bundle name' },
    version: { type: 'string', description: 'Bundle version' },
    bundleHash: { type: 'string', description: 'Bundle hash for deduplication' },
    installed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', description: 'Extension kind' },
          slug: { type: 'string', description: 'Extension slug' },
          version: { type: 'string', description: 'Extension version' },
          success: { type: 'boolean', description: 'Whether installation succeeded' },
          error: { type: 'string', nullable: true, description: 'Error message if failed' },
        },
      },
      description: 'Installation results for each extension',
    },
    themeActivated: {
      type: 'object',
      nullable: true,
      properties: {
        slug: { type: 'string' },
        target: { type: 'string' },
      },
      description: 'Theme that was auto-activated',
    },
  },
  required: ['name', 'version', 'bundleHash', 'installed'],
} as const;

const extensionInstallWithUploadSchema = {
  type: 'object',
  properties: {
    ...uploadResultSchema.properties,
    ...extensionMetaSchema.properties,
  },
  required: [
    ...uploadResultSchema.required,
    ...extensionMetaSchema.required,
  ],
} as const;

const bundleInstallWithUploadSchema = {
  type: 'object',
  properties: {
    ...uploadResultSchema.properties,
    ...bundleInstallResultSchema.properties,
  },
  required: [
    ...uploadResultSchema.required,
    ...bundleInstallResultSchema.required,
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

  // POST /api/extensions/plugin/:slug/instances
  createInstance: {
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug' },
      },
    },
    body: {
      type: 'object',
      required: ['instanceKey'],
      properties: {
        instanceKey: {
          type: 'string',
          pattern: '^[a-z0-9-]{1,32}$',
          description: 'Instance key (lowercase letters, numbers, hyphens only)',
        },
        enabled: { type: 'boolean', default: true, description: 'Enable instance on creation' },
        config: { type: 'object', additionalProperties: true, description: 'Initial configuration' },
        grantedPermissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Initial granted permissions',
        },
      },
    },
    response: createTypedCreateResponses(pluginInstanceSchema),
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
    response: createTypedUpdateResponses(pluginInstanceSchema),
  },

  // DELETE /api/extensions/plugin/:slug/instances/:installationId
  deleteInstance: {
    params: {
      type: 'object',
      required: ['slug', 'installationId'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug' },
        installationId: { type: 'string', description: 'Installation ID to delete' },
      },
    },
    response: createTypedDeleteResponses(deletePluginInstanceResultSchema),
  },

  // POST /api/extensions/bundle/install
  installBundle: {
    response: {
      ...createTypedCreateResponses(bundleInstallWithUploadSchema),
      413: errorResponseSchema,
    },
  },

  // POST /api/extensions/:kind/install
  installExtension: {
    params: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: {
          type: 'string',
          enum: ['theme-shop', 'theme-admin', 'theme-app-shop', 'theme-app-admin', 'plugin'],
          description: 'Extension kind',
        },
      },
    },
    response: {
      ...createTypedCreateResponses(extensionInstallWithUploadSchema),
      413: errorResponseSchema,
    },
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
    response: createTypedDeleteResponses(uninstallPluginResultSchema),
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
    response: createTypedCreateResponses(restorePluginResultSchema),
  },

  // DELETE /api/extensions/plugin/:slug/purge
  purgePlugin: {
    params: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: 'Plugin slug to purge permanently' },
      },
    },
    response: createTypedDeleteResponses(purgePluginResultSchema),
  },

  // DELETE /api/extensions/:kind/:slug
  uninstallExtension: {
    params: {
      type: 'object',
      required: ['kind', 'slug'],
      properties: {
        kind: {
          type: 'string',
          enum: ['theme-shop', 'theme-admin', 'theme-app-shop', 'theme-app-admin', 'plugin'],
          description: 'Extension kind',
        },
        slug: { type: 'string', description: 'Extension slug to uninstall' },
      },
    },
    response: createTypedDeleteResponses(uninstallExtensionResultSchema),
  },

  // GET /api/extensions/:kind
  listExtensions: {
    params: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: {
          type: 'string',
          enum: ['theme-shop', 'theme-admin', 'theme-app-shop', 'theme-app-admin', 'plugin'],
          description: 'Extension kind',
        },
      },
    },
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Items per page' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(extensionMetaSchema)),
  },

  // GET /api/extensions/:kind/:slug
  getExtension: {
    params: {
      type: 'object',
      required: ['kind', 'slug'],
      properties: {
        kind: {
          type: 'string',
          enum: ['theme-shop', 'theme-admin', 'theme-app-shop', 'theme-app-admin', 'plugin'],
          description: 'Extension kind',
        },
        slug: { type: 'string', description: 'Extension slug' },
      },
    },
    response: createTypedReadResponses(extensionMetaSchema),
  },
} as const;
