import { mapApiError, sendMappedError } from '@/utils/api-errors';
/**
 * Extension Installer Routes
 * 
 * API Routes: Support ZIP upload and installation of plugins.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import { authMiddleware, requireAdmin, optionalAuthMiddleware } from '@/core/auth/middleware';
import { extensionInstaller, type ExtensionKind } from './index';
import { sendSuccess, sendError } from '@/utils/response';
import { extensionInstallerSchemas } from './schemas';
import { errorResponseSchema } from '@/utils/schema-helpers';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { handlePluginGateway, PluginGatewayError } from './plugin-runtime';
import { sanitizePluginConfigForAdmin } from '@/core/admin/plugin-management/config-secrets';
import { InvalidStoredManifestError, readStoredPluginManifest } from './stored-manifest';
import { ExtensionInstallerError } from './errors';
import { themeManagementRoutes } from './theme-routes';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { Prisma } from '@prisma/client';
import { PluginPackageResolutionError } from '@/core/storage/current-plugin-package';
import { PLUGIN_MAX_ZIP_SIZE } from 'shared/plugin-signing';
import { fetchMarketplaceCatalog, marketplaceUrl, MarketplaceError } from './marketplace-catalog';
import { checkPluginApiCompatibility, PluginLoaderError } from './plugin-compatibility';
import { compareVersions } from './version-utils';
import { listPluginRecovery } from './plugin-recovery';
import { pluginDatabaseAuditRoutes } from './plugin-database-audit-routes';
import { installMarketplacePlugin, previewMarketplacePlugin } from './marketplace-install';
import { previewPluginUpload, PluginUploadError } from './plugin-upload';
import { startPluginInstallOperation, getPluginInstallOperation, retryPluginInstallOperation } from './plugin-migration-operation';
import { sendKnownError } from '@/utils/api-errors';

const packageUnavailableResponse = {
  ...errorResponseSchema,
  description: 'PLUGIN_PACKAGE_UNAVAILABLE or PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT',
};
const packageCorruptResponse = {
  ...errorResponseSchema,
  description: 'Includes PLUGIN_PACKAGE_CORRUPT',
};

function sendReadDependencyError(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidStoredManifestError || error instanceof ExtensionInstallerError
    || error instanceof PluginLoaderError || error instanceof PluginUploadError) {
    return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
  return sendMappedError(reply, error);
}

function sendMarketplaceInstallError(reply: FastifyReply, error: unknown) {
  if (error instanceof PluginLoaderError || ((error instanceof ExtensionInstallerError || error instanceof PluginUploadError)
    && ![409, 413, 422].includes(mapApiError(error).status))) {
    return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
  return sendMappedError(reply, error);
}

// Plugin categories (hardcoded)
const PLUGIN_CATEGORIES = [
  { id: 'payment', name: 'Payment', count: 0 },
  { id: 'shipping', name: 'Shipping', count: 0 },
  { id: 'marketing', name: 'Marketing', count: 0 },
  { id: 'analytics', name: 'Analytics', count: 0 },
  { id: 'social', name: 'Social', count: 0 },
];

interface InstallParams {
  kind: ExtensionKind;
}

interface UninstallParams {
  kind: ExtensionKind;
  slug: string;
}

interface ListParams {
  kind: ExtensionKind;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  state?: 'active' | 'removed';
}

interface GetParams {
  kind: ExtensionKind;
  slug: string;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Register extension installer routes
 *
 * Note: multipart is already registered globally in server.ts, no need to re-register here
 */
export async function extensionInstallerRoutes(fastify: FastifyInstance) {
  /**
   * Plugin Gateway API (runtime)
   *
   * Makes plugins usable immediately after ZIP installation without restarting the main API server.
   * - internal-fastify: isolated Fastify instance + inject forwarding
   *
   * This gateway is intentionally NOT admin-protected because it may be called by Shop/Admin runtime.
   * Individual plugins should implement their own auth as needed.
   */
  fastify.all<{ Params: { slug: string } }>('/plugin/:slug/api', {
    onRequest: optionalAuthMiddleware,
    schema: {
      tags: ['plugin-gateway'],
      summary: 'Plugin Gateway (root)',
      description: 'Proxy to plugin runtime (passthrough response).',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
      response: {
        200: { type: 'string' },
        400: errorResponseSchema,
        404: errorResponseSchema,
        503: packageUnavailableResponse,
        500: packageCorruptResponse,
      },
    }
  }, async (request, reply) => {
    try {
      await handlePluginGateway(request, reply, '/', fastify);
    } catch (error) { return sendReadDependencyError(reply, error); }
  });

  fastify.all<{ Params: { slug: string; '*': string } }>('/plugin/:slug/api/*', {
    onRequest: optionalAuthMiddleware,
    schema: {
      tags: ['plugin-gateway'],
      summary: 'Plugin Gateway (wildcard)',
      description: 'Proxy to plugin runtime (passthrough response).',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          '*': { type: 'string' },
        },
        required: ['slug'],
      },
      response: {
        200: { type: 'string' },
        400: errorResponseSchema,
        404: errorResponseSchema,
        503: packageUnavailableResponse,
        500: packageCorruptResponse,
      },
    }
  }, async (request, reply) => {
    try {
      const targetPath = (request.params as any)['*'] || '';
      await handlePluginGateway(request, reply, `/${targetPath}`, fastify);
    } catch (error) { return sendReadDependencyError(reply, error); }
  });

  fastify.get<{ Params: { slug: string } }>('/plugin/:slug/health', {
    onRequest: optionalAuthMiddleware,
    schema: {
      tags: ['plugin-gateway'],
      summary: 'Plugin Health',
      description: 'Proxy to a plugin health endpoint.',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
      response: {
        200: { type: 'string' },
        400: errorResponseSchema,
        404: errorResponseSchema,
        503: packageUnavailableResponse,
        500: packageCorruptResponse,
      },
    }
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const installation = await PluginManagementService.getDefaultInstance(slug);
      const plugin = await prisma.pluginInstall.findUnique({ where: { slug } });
      if (plugin && installation && (plugin.deletedAt || installation.deletedAt || !installation.enabled)) {
        return reply.send('disabled');
      }
      await handlePluginGateway(request, reply, '/health', fastify, { requireEnabled: false });
    } catch (error) { return sendReadDependencyError(reply, error); }
  });

  fastify.get<{ Params: { slug: string } }>('/plugin/:slug/manifest', {
    onRequest: optionalAuthMiddleware,
    schema: {
      tags: ['plugin-gateway'],
      summary: 'Plugin Manifest',
      description: 'Proxy to a plugin manifest endpoint.',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
      response: {
        200: { type: 'string' },
        400: errorResponseSchema,
        404: errorResponseSchema,
        503: packageUnavailableResponse,
        500: packageCorruptResponse,
      },
    }
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const installation = await PluginManagementService.getDefaultInstance(slug);
      const plugin = await prisma.pluginInstall.findUnique({ where: { slug } });
      if (plugin && installation && (plugin.deletedAt || installation.deletedAt || !installation.enabled)) {
        return reply.send(JSON.stringify(readStoredPluginManifest(plugin)));
      }
      await handlePluginGateway(request, reply, '/manifest', fastify, { requireEnabled: false });
    } catch (error) { return sendReadDependencyError(reply, error); }
  });

  // Slug-level routes removed - use instance-level API only
  await fastify.register(async (admin) => {
    admin.addHook('onRequest', authMiddleware);
    admin.addHook('onRequest', requireAdmin);
    await admin.register(themeManagementRoutes);

    admin.get('/marketplace/status', {
      schema: {
        tags: ['admin-plugins'], summary: 'Get marketplace configuration status',
        security: [{ bearerAuth: [] }],
        querystring: { type: 'object', additionalProperties: false, properties: {} },
        response: {
          200: { type: 'object', required: ['success', 'data'], properties: {
            success: { type: 'boolean' },
            data: { type: 'object', required: ['configured', 'testSigningMode'], properties: {
              configured: { type: 'boolean' }, testSigningMode: { type: 'boolean' },
            } },
          } },
          401: errorResponseSchema, 403: errorResponseSchema,
        },
      },
    }, async (_request, reply) => sendSuccess(reply, {
      configured: Boolean(marketplaceUrl()), testSigningMode: env.EXTENSION_TEST_SIGNING_MODE,
    }));

    admin.get('/marketplace/catalog', {
      schema: {
        tags: ['admin-plugins'], summary: 'List marketplace plugins',
        security: [{ bearerAuth: [] }],
        querystring: { type: 'object', additionalProperties: false, properties: {} },
        response: {
          200: { type: 'object', required: ['success', 'data'], properties: {
            success: { type: 'boolean' },
            data: { type: 'object', required: ['schemaVersion', 'items'], properties: {
              schemaVersion: { type: 'integer', enum: [1] },
              items: { type: 'array', items: { type: 'object', required: ['id', 'slug', 'name', 'description', 'publisherId', 'versions', 'installedVersion', 'installedPublisherId', 'updateAvailable'], properties: {
                id: { type: 'string' }, slug: { type: 'string' }, name: { type: 'string' },
                description: { type: 'string' }, publisherId: { type: 'string' },
                declaredCapabilities: { type: 'array', items: { type: 'string' } },
                declaredCapabilitiesVerified: { type: 'boolean', const: false },
                capabilities: { type: 'array', items: { type: 'string' } },
                capabilitiesSource: { type: 'string', enum: ['package', 'declared'] },
                signingRoot: { type: 'string', enum: ['official', 'test'], nullable: true },
                installedVersion: { type: 'string', nullable: true },
                installedPublisherId: { type: 'string', nullable: true },
                updateAvailable: { type: 'boolean' },
                versions: { type: 'array', items: { type: 'object', required: ['version', 'minApiVersion', 'sha256', 'size', 'downloadUrl', 'compatible'], properties: {
                  version: { type: 'string' }, minApiVersion: { type: 'string' }, sha256: { type: 'string' },
                  size: { type: 'integer' }, downloadUrl: { type: 'string' }, compatible: { type: 'boolean' },
                } } },
              } } },
            } },
          } },
          401: errorResponseSchema, 403: errorResponseSchema, 502: errorResponseSchema,
          503: errorResponseSchema, 504: errorResponseSchema, 500: errorResponseSchema,
        },
      },
    }, async (_request, reply) => {
      try {
        const catalog = await fetchMarketplaceCatalog();
        const installed = await prisma.pluginInstall.findMany({
          where: { deletedAt: null, slug: { in: catalog.plugins.map((plugin) => plugin.slug) } },
        });
        const bySlug = new Map(installed.map((record) => [record.slug, record]));
        const items = catalog.plugins.map((plugin) => {
          const current = bySlug.get(plugin.slug);
          const versions = plugin.versions.map((entry) => ({
            ...entry,
            compatible: checkPluginApiCompatibility({ minApiVersion: entry.minApiVersion } as Parameters<typeof checkPluginApiCompatibility>[0]).compatible,
          }));
          return {
            ...plugin, versions,
            ...(plugin.declaredCapabilities !== undefined ? { declaredCapabilitiesVerified: false } : {}),
            capabilities: current
              ? [...new Set(readStoredPluginManifest(current).contracts?.map((contract) => contract.name) ?? [])]
              : plugin.declaredCapabilities ?? [],
            capabilitiesSource: current ? 'package' : 'declared',
            ...(current ? { signingRoot: current.signingRoot } : {}),
            installedVersion: current?.version ?? null,
            installedPublisherId: current?.publisherId ?? null,
            updateAvailable: Boolean(current && current.publisherId === plugin.publisherId &&
              versions.some((entry) => entry.compatible && compareVersions(entry.version, current.version) > 0)),
          };
        });
        return sendSuccess(reply, { schemaVersion: 1, items });
      } catch (error) { return sendReadDependencyError(reply, error); }
    });

    admin.post<{ Body: { pluginId: string; version: string } }>('/marketplace/preview', {
      schema: { tags: ['admin-plugins'], summary: 'Preview a verified marketplace artifact without loading its entry', security: [{ bearerAuth: [] }],
        body: { type: 'object', required: ['pluginId', 'version'], additionalProperties: false, properties: { pluginId: { type: 'string' }, version: { type: 'string' } } },
        response: { ...extensionInstallerSchemas.previewPlugin.response, 404: errorResponseSchema, 502: errorResponseSchema, 504: errorResponseSchema },
      },
    }, async (request, reply) => {
      try { return sendSuccess(reply, await previewMarketplacePlugin(request.body.pluginId, request.body.version, request.user!.id)); }
      catch (error) { return sendMarketplaceInstallError(reply, error); }
    });

    admin.post<{ Body: { pluginId: string; version: string; previewToken: string; confirmMigrations: boolean } }>('/marketplace/install', {
      preValidation: (request, reply, done) => {
        if (request.body && typeof request.body === 'object' && !Array.isArray(request.body) &&
          Object.keys(request.body).some((key) => !['pluginId', 'version', 'previewToken', 'confirmMigrations'].includes(key))) {
          void sendError(reply, 400, 'BAD_REQUEST', 'Unexpected marketplace install field');
          return;
        }
        done();
      },
      schema: {
        tags: ['admin-plugins'], summary: 'Install a marketplace plugin',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object', required: ['pluginId', 'version', 'previewToken', 'confirmMigrations'], additionalProperties: false,
          properties: {
            pluginId: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,30}[a-z0-9]$' },
            version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
            previewToken: { type: 'string', maxLength: 8192 }, confirmMigrations: { type: 'boolean' },
          },
        },
        response: {
          202: extensionInstallerSchemas.installExtension.response[202],
          400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema,
          404: errorResponseSchema, 409: errorResponseSchema, 413: errorResponseSchema,
          422: errorResponseSchema, 500: errorResponseSchema, 502: errorResponseSchema,
          503: errorResponseSchema, 504: errorResponseSchema,
        },
      },
    }, async (request, reply) => {
      try {
        return sendSuccess(reply, await installMarketplacePlugin(request.body.pluginId, request.body.version, request.user!.id, request.body.previewToken, request.body.confirmMigrations), undefined, 202);
      } catch (error) { return sendMarketplaceInstallError(reply, error); }
    });

    admin.get<{ Params: { slug: string } }>('/plugin/:slug/disable-impact', {
      schema: {
        tags: ['admin-plugins'],
        summary: 'Get plugin disable impact',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                required: ['pendingPaymentOrders'],
                properties: { pendingPaymentOrders: { type: 'integer' } },
              },
            },
          },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    }, async (request, reply) => {
      const plugin = await prisma.pluginInstall.findUnique({ where: { slug: request.params.slug } });
      if (!plugin || plugin.deletedAt) {
        return sendError(reply, 404, 'NOT_FOUND', 'Plugin not found');
      }
      let manifest: ReturnType<typeof readStoredPluginManifest>;
      try {
        manifest = readStoredPluginManifest(plugin);
      } catch (error) {
        return sendReadDependencyError(reply, error);
      }
      const pendingPaymentOrders = manifest.contracts?.some((contract) => contract.name === 'payment')
        ? await prisma.order.count({
          where: {
            status: 'PENDING',
            paymentStatus: 'PENDING',
            OR: [{ unpaidExpiresAt: null }, { unpaidExpiresAt: { gt: new Date() } }],
            payments: { some: { paymentMethod: plugin.slug, status: 'PENDING', sessionId: { not: null } } },
          },
        })
        : 0;
      return sendSuccess(reply, { pendingPaymentOrders });
    });

  // ============================================================================
  // Plugin Instance Management API (Multi-instance support)
  // ============================================================================

  /**
   * GET /api/extensions/plugin/:slug/instances
   * List all instances for a plugin
   */
  admin.get<{ Params: { slug: string }; Querystring: PaginationQuery }>('/plugin/:slug/instances', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'List plugin instances',
      description: 'Get all instances (excluding soft-deleted) for a plugin',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.listInstances,
    }
  }, async (request: FastifyRequest<{ Params: { slug: string }; Querystring: PaginationQuery }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      const safePage = Math.max(1, Number(request.query?.page) || 1);
      const safeLimit = Math.min(100, Math.max(1, Number(request.query?.limit) || 20));

      // Verify plugin exists
      const pluginPackage = await PluginManagementService.getPluginPackage(slug);
      if (!pluginPackage) {
        return sendError(reply, 404, 'NOT_FOUND', `Plugin "${slug}" not found`);
      }

      const instances = await PluginManagementService.getPluginInstances(slug);

      // Transform to API response format
      const items = instances.map((inst) => {
        const adminConfig = sanitizePluginConfigForAdmin(readStoredPluginManifest(pluginPackage), parseJsonObject(inst.configJson));
        return {
          installationId: inst.id,
          pluginSlug: inst.pluginSlug,
          instanceKey: inst.instanceKey,
          enabled: inst.enabled,
          config: adminConfig.config,
          configMeta: adminConfig.configMeta,
          grantedPermissions: parseJsonArray(inst.grantedPermissions),
          lastFailureAt: inst.lastFailureAt?.toISOString() ?? null,
          lastFailureMessage: inst.lastFailureMessage,
          createdAt: inst.createdAt.toISOString(),
          updatedAt: inst.updatedAt.toISOString(),
        };
      });

      const total = items.length;
      const pagedItems = items.slice((safePage - 1) * safeLimit, safePage * safeLimit);

      return sendSuccess(reply, {
        items: pagedItems,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      });
    } catch (error) { return sendReadDependencyError(reply, error); }
  });

  /**
   * PATCH /api/extensions/plugin/:slug/instances/:installationId
   * Update a plugin instance (enable/disable, config, permissions)
   */
  admin.patch<{
    Params: { slug: string; installationId: string };
    Body: {
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    };
  }>('/plugin/:slug/instances/:installationId', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'Update plugin instance',
      description: 'Update instance enable/disable state, config, or permissions',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.updateInstance,
    }
  }, async (request: FastifyRequest<{
    Params: { slug: string; installationId: string };
    Body: {
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    };
  }>, reply: FastifyReply) => {
    try {
      const { slug, installationId } = request.params;
      const { enabled, config, grantedPermissions } = request.body;

      // Verify the installation belongs to this plugin
      const existing = await PluginManagementService.getInstanceById(installationId);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', `Installation "${installationId}" not found`);
      }
      if (existing.pluginSlug !== slug) {
        return sendError(reply, 400, 'BAD_REQUEST', `Installation "${installationId}" does not belong to plugin "${slug}"`);
      }
      const pluginPackage = await PluginManagementService.getPluginPackage(slug);
      if (!pluginPackage) {
        return sendError(reply, 404, 'NOT_FOUND', `Plugin "${slug}" not found`);
      }

      const instance = await PluginManagementService.updateInstance(installationId, {
        enabled,
        config,
        grantedPermissions,
      });
      const adminConfig = sanitizePluginConfigForAdmin(readStoredPluginManifest(pluginPackage), parseJsonObject(instance.configJson));

      return sendSuccess(reply, {
        installationId: instance.id,
        pluginSlug: instance.pluginSlug,
        instanceKey: instance.instanceKey,
        enabled: instance.enabled,
        config: adminConfig.config,
        configMeta: adminConfig.configMeta,
        grantedPermissions: parseJsonArray(instance.grantedPermissions),
        lastFailureAt: instance.lastFailureAt?.toISOString() ?? null,
        lastFailureMessage: instance.lastFailureMessage,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
        replacedPlugins: instance.replacedPlugins,
      });
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * POST /api/extensions/:kind/install
   * Install extension from ZIP
   *
   * kind: 'plugin'
   */
  admin.post('/plugin/preview', {
    // Multipart fields are validated after consuming the bounded file stream.
    validatorCompiler: () => (value: unknown) => ({ value }),
    schema: { tags: ['admin-plugins'], summary: 'Preview a local plugin ZIP without executing it', security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'], ...extensionInstallerSchemas.previewPlugin },
  }, async (request, reply) => {
    try {
      if (!request.isMultipart()) return sendError(reply, 400, 'BAD_REQUEST', 'A multipart plugin ZIP is required');
      const data = await request.file({ limits: { fileSize: PLUGIN_MAX_ZIP_SIZE }, throwFileSizeLimit: true });
      if (!data || !data.filename.toLowerCase().endsWith('.zip')) return sendError(reply, 400, 'BAD_REQUEST', 'A plugin ZIP is required');
      const bytes = await data.toBuffer();
      if (data.fieldname !== 'file' || Object.keys(data.fields).some(name => name !== 'file')) return sendError(reply, 400, 'BAD_REQUEST', 'Preview accepts only one file field');
      if (data.file.truncated || bytes.length > PLUGIN_MAX_ZIP_SIZE) return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'Plugin ZIP exceeds 10 MiB');
      return sendSuccess(reply, await previewPluginUpload(bytes, request.user!.id));
    } catch (error) {
      if (error instanceof fastify.multipartErrors.RequestFileTooLargeError) return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'Plugin ZIP exceeds 10 MiB');
      return sendMappedError(reply, error);
    }
  });

  admin.post('/plugin/install', {
    validatorCompiler: () => (value: unknown) => ({ value }),
    schema: {
      tags: ['admin-plugins'],
      summary: 'Install extension from ZIP',
      description: 'Upload and install a plugin from a ZIP file (Admin only)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      ...extensionInstallerSchemas.installExtension,
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const kind = 'plugin' as const;
      if (!request.isMultipart()) return sendError(reply, 400, 'BAD_REQUEST', 'A multipart plugin ZIP is required');

      // Get uploaded file
      const data = await request.file({ limits: { fileSize: PLUGIN_MAX_ZIP_SIZE }, throwFileSizeLimit: true });
      if (!data) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No file uploaded');
      }

      // Validate file type
      if (!data.filename.toLowerCase().endsWith('.zip')) {
        return sendError(reply, 400, 'BAD_REQUEST', 'File must be a ZIP archive');
      }

      // Install extension
      const zipBytes = await data.toBuffer();
      if (data.fieldname !== 'file' || Object.keys(data.fields).some(name => !['file', 'previewToken', 'confirmUnsigned', 'confirmationSlug', 'confirmMigrations'].includes(name)))
        return sendError(reply, 400, 'BAD_REQUEST', 'Unexpected plugin upload field');
      if (data.file.truncated || zipBytes.length > PLUGIN_MAX_ZIP_SIZE) {
        return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'Plugin ZIP exceeds 10 MiB');
      }
      const confirmationField = data.fields?.confirmUnsigned;
      const confirmUnsigned = !Array.isArray(confirmationField)
        && confirmationField?.type === 'field'
        && confirmationField.value === 'true';
      const field = (name: string) => {
        const value = data.fields?.[name];
        return !Array.isArray(value) && value?.type === 'field' && typeof value.value === 'string' ? value.value : undefined;
      };
      const operation = await startPluginInstallOperation(zipBytes, {
        confirmUnsigned,
        confirmMigrations: field('confirmMigrations') === 'true',
        actorUserId: request.user!.id,
        previewToken: field('previewToken'), confirmationSlug: field('confirmationSlug'),
        uploadMetadata: { filename: data.filename, size: zipBytes.length, mimetype: data.mimetype },
      });
      return sendSuccess(reply, operation, undefined, 202);
    } catch (error) {
      if (error instanceof fastify.multipartErrors.RequestFileTooLargeError) return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'Plugin ZIP exceeds 10 MiB');
      return sendMappedError(reply, error);
    }
  });

  await pluginDatabaseAuditRoutes(admin);
  admin.get('/plugin/recovery', {
    schema: { tags: ['admin-plugins'], summary: 'List persistent plugin recovery and maintenance requirements', security: [{ bearerAuth: [] }], response: { 200: { type: 'object', required: ['success', 'data'], properties: { success: { type: 'boolean', enum: [true] }, data: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['slug', 'markerCount', 'maintenanceRequired', 'operations'], properties: { slug: { type: 'string' }, markerCount: { type: 'integer' }, maintenanceRequired: { type: 'boolean' }, operations: { type: 'array', items: { type: 'object', required: ['operationId', 'slug', 'version', 'phase', 'committedPrefix', 'retryAvailable', 'publicationWarning'], properties: { operationId: { type: 'string' }, slug: { type: 'string' }, version: { type: 'string' }, phase: { type: 'string' }, committedPrefix: { type: 'integer' }, retryAvailable: { type: 'boolean' }, publicationWarning: { type: 'boolean' } } } } } } } } } } } } },
  }, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return sendSuccess(reply, await listPluginRecovery()); } catch (error) { return sendMappedError(reply, error); }
  });

  admin.get<{ Params: { operationId: string }; Querystring: { wait?: boolean; phase?: string; committedPrefix?: number } }>('/plugin/operations/:operationId', {
    schema: { tags: ['admin-plugins'], summary: 'Read a durable plugin installation operation', security: [{ bearerAuth: [] }], ...extensionInstallerSchemas.pluginOperation },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return sendSuccess(reply, await getPluginInstallOperation(request.params.operationId, request.query.wait === true, request.query.phase !== undefined && request.query.committedPrefix !== undefined ? { phase: request.query.phase, committedPrefix: request.query.committedPrefix } : undefined)); }
    catch (error) { return sendMappedError(reply, error); }
  });

  admin.post<{ Params: { operationId: string }; Body: { confirmMigrations: boolean } }>('/plugin/operations/:operationId/retry', {
    schema: { tags: ['admin-plugins'], summary: 'Retry the retained plugin artifact without undoing migrations', security: [{ bearerAuth: [] }], ...extensionInstallerSchemas.retryPluginOperation },
  }, async (request, reply) => {
    try { return sendSuccess(reply, await retryPluginInstallOperation(request.params.operationId, request.user!.id, request.body.confirmMigrations), undefined, 202); }
    catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * DELETE /api/extensions/plugin/:slug
   * Uninstall plugin package (removes all instances)
   */
  admin.delete<{ Params: { slug: string } }>('/plugin/:slug', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'Uninstall plugin package',
      description: 'Stop new plugin work while retaining the package, configuration, credentials and plugin data (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.uninstallPlugin,
    }
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      await PluginManagementService.uninstallPlugin(slug, request.user!.id);
      return sendSuccess(reply, {
        kind: 'plugin',
        slug,
        uninstalled: true,
      }, `plugin "${slug}" uninstalled successfully`);
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * POST /api/extensions/plugin/:slug/restore
   * Restore a soft-uninstalled plugin package
   */
  admin.post<{ Params: { slug: string } }>('/plugin/:slug/restore', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'Restore plugin package',
      description: 'Restore a soft-uninstalled plugin (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.restorePlugin,
    }
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      await PluginManagementService.restorePlugin(slug, request.user!.id);
      return sendSuccess(reply, {
        kind: 'plugin',
        slug,
        restored: true,
      }, `plugin "${slug}" restored successfully`);
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * DELETE /api/extensions/plugin/:slug/purge
   * Permanently purge plugin package and files
   */
  admin.delete<{ Params: { slug: string }; Body: { confirmationSlug?: string } }>('/plugin/:slug/purge', {
    preValidation: async (request, reply) => {
      const body = request.body as unknown;
      if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body)
        || ('confirmationSlug' in body && typeof body.confirmationSlug !== 'string'))) {
        return sendError(reply, 400, 'PLUGIN_PURGE_CONFIRMATION_REQUIRED', 'Type the plugin slug to confirm deletion');
      }
      request.body ??= {};
    },
    schema: {
      tags: ['admin-plugins'],
      summary: 'Purge plugin package',
      description: 'Delete Core installation records, configuration, credentials and blob; preserve plugin data and order history (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.purgePlugin,
    }
  }, async (request, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      await PluginManagementService.purgePlugin(slug, request.body?.confirmationSlug, request.user!.id);
      return sendSuccess(reply, {
        kind: 'plugin',
        slug,
        purged: true,
      }, `plugin "${slug}" purged permanently`);
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * GET /api/extensions/plugin
   * List installed plugin packages.
   */
  admin.get<{ Params: ListParams; Querystring: PaginationQuery }>('/:kind', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'List installed plugins',
      description: 'Get the installed plugin packages (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.listPlugins,
    },
  }, async (request, reply) => {
    try {
      const safePage = Math.max(1, Number(request.query?.page) || 1);
      const safeLimit = Math.min(100, Math.max(1, Number(request.query?.limit) || 20));
      const extensions = await extensionInstaller.listInstalled(request.params.kind, request.query.state);
      const total = extensions.length;
      const items = extensions.slice((safePage - 1) * safeLimit, safePage * safeLimit);
      return sendSuccess(reply, {
        items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      });
    } catch (error) { return sendMappedError(reply, error); }
  });

  /**
   * GET /api/extensions/plugin/:slug
   * Get an installed plugin package.
   */
  admin.get<{ Params: GetParams }>('/:kind/:slug', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get installed plugin',
      description: 'Get an installed plugin package (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.getPlugin,
    },
  }, async (request, reply) => {
    try {
      const extension = await extensionInstaller.getInstalled(request.params.kind, request.params.slug);
      if (!extension) {
        return sendError(reply, 404, 'NOT_FOUND', `plugin "${request.params.slug}" not found`);
      }
      return sendSuccess(reply, extension);
    } catch (error) { return sendMappedError(reply, error); }
  });

  });
};
