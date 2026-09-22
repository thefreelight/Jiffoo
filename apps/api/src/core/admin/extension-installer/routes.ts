/**
 * Extension Installer Routes
 * 
 * API Routes: Support ZIP upload and installation of plugins.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable, PassThrough } from 'stream';
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from '@/core/auth/middleware';
import { extensionInstaller, type ExtensionKind } from './index';
import { sendSuccess, sendError } from '@/utils/response';
import { extensionInstallerSchemas } from './schemas';
import { errorResponseSchema } from '@/utils/schema-helpers';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { handlePluginGateway, PluginGatewayError, warmPluginRuntime } from './plugin-runtime';
import { bundleInstaller } from './bundle-installer';
import { sanitizePluginConfigForAdmin } from '@/core/admin/plugin-management/config-secrets';

// Per spec (EXTENSIONS_IMPLEMENTATION.md) size limits for offline ZIP installs
const ZIP_SIZE_LIMITS: Record<ExtensionKind, number> = {
  'plugin': 50 * 1024 * 1024, // 50MB
  'bundle': 500 * 1024 * 1024, // 500MB
};

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${Math.round(value * 100) / 100}${units[unitIndex]}`;
}

function enforceZipSizeLimit(stream: Readable, kind: ExtensionKind): { stream: Readable; getTotalBytes: () => number } {
  const maxBytes = ZIP_SIZE_LIMITS[kind] ?? (10 * 1024 * 1024);
  const pass = new PassThrough();
  let total = 0;

  stream.on('data', (chunk: Buffer) => {
    total += chunk.length;
    if (total > maxBytes) {
      const err: any = new Error(
        `ZIP file too large for ${kind}: ${formatBytes(total)} (max ${formatBytes(maxBytes)})`
      );
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      stream.destroy(err);
    }
  });

  stream.on('error', (err) => pass.destroy(err));
  stream.pipe(pass);
  return {
    stream: pass,
    getTotalBytes: () => total,
  };
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
    preHandler: optionalAuthMiddleware,
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
        500: errorResponseSchema,
      },
    }
  }, async (request, reply) => {
    try {
      await handlePluginGateway(request, reply, '/', fastify);
    } catch (error: any) {
      if (error instanceof PluginGatewayError) {
        return sendError(reply, error.statusCode, error.code, error.message);
      }
      fastify.log.error({ err: error }, 'Plugin gateway failed');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error?.message || 'Plugin gateway failed');
    }
  });

  fastify.all<{ Params: { slug: string; '*': string } }>('/plugin/:slug/api/*', {
    preHandler: optionalAuthMiddleware,
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
        500: errorResponseSchema,
      },
    }
  }, async (request, reply) => {
    try {
      const targetPath = (request.params as any)['*'] || '';
      await handlePluginGateway(request, reply, `/${targetPath}`, fastify);
    } catch (error: any) {
      if (error instanceof PluginGatewayError) {
        return sendError(reply, error.statusCode, error.code, error.message);
      }
      fastify.log.error({ err: error }, 'Plugin gateway failed');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error?.message || 'Plugin gateway failed');
    }
  });

  fastify.get<{ Params: { slug: string } }>('/plugin/:slug/health', {
    preHandler: optionalAuthMiddleware,
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
        500: errorResponseSchema,
      },
    }
  }, async (request, reply) => {
    try {
      await handlePluginGateway(request, reply, '/health', fastify, { requireEnabled: false });
    } catch (error: any) {
      if (error instanceof PluginGatewayError) {
        return sendError(reply, error.statusCode, error.code, error.message);
      }
      fastify.log.error({ err: error }, 'Plugin health gateway failed');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error?.message || 'Plugin health gateway failed');
    }
  });

  fastify.get<{ Params: { slug: string } }>('/plugin/:slug/manifest', {
    preHandler: optionalAuthMiddleware,
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
        500: errorResponseSchema,
      },
    }
  }, async (request, reply) => {
    try {
      await handlePluginGateway(request, reply, '/manifest', fastify, { requireEnabled: false });
    } catch (error: any) {
      if (error instanceof PluginGatewayError) {
        return sendError(reply, error.statusCode, error.code, error.message);
      }
      fastify.log.error({ err: error }, 'Plugin manifest gateway failed');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error?.message || 'Plugin manifest gateway failed');
    }
  });

  // Slug-level routes removed - use instance-level API only

  // ============================================================================
  // Plugin Instance Management API (Multi-instance support)
  // ============================================================================

  /**
   * GET /api/extensions/plugin/:slug/instances
   * List all instances for a plugin
   */
  fastify.get<{ Params: { slug: string }; Querystring: PaginationQuery }>('/plugin/:slug/instances', {
    onRequest: [authMiddleware, adminMiddleware],
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
        const adminConfig = sanitizePluginConfigForAdmin(pluginPackage.manifestJson, parseJsonObject(inst.configJson));
        return {
          installationId: inst.id,
          pluginSlug: inst.pluginSlug,
          instanceKey: inst.instanceKey,
          enabled: inst.enabled,
          config: adminConfig.config,
          configMeta: adminConfig.configMeta,
          grantedPermissions: parseJsonArray(inst.grantedPermissions),
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
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  /**
   * POST /api/extensions/plugin/:slug/instances
   * Create a new plugin instance
   */
  fastify.post<{
    Params: { slug: string };
    Body: {
      instanceKey: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    };
  }>('/plugin/:slug/instances', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Create plugin instance',
      description: 'Create a new instance for a plugin with unique instanceKey',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.createInstance,
    }
  }, async (request: FastifyRequest<{
    Params: { slug: string };
    Body: {
      instanceKey: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    };
  }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      const { instanceKey, enabled, config, grantedPermissions } = request.body;

      // CRITICAL: Verify plugin exists and is not soft-deleted (consistent with list route)
      const pluginPackage = await PluginManagementService.getPluginPackage(slug);
      if (!pluginPackage) {
        return sendError(reply, 404, 'NOT_FOUND', `Plugin "${slug}" not found`);
      }

      const instance = await PluginManagementService.createInstance(slug, instanceKey, {
        enabled,
        config,
        grantedPermissions,
      });
      const adminConfig = sanitizePluginConfigForAdmin(pluginPackage.manifestJson, parseJsonObject(instance.configJson));

      return sendSuccess(reply, {
        installationId: instance.id,
        pluginSlug: instance.pluginSlug,
        instanceKey: instance.instanceKey,
        enabled: instance.enabled,
        config: adminConfig.config,
        configMeta: adminConfig.configMeta,
        grantedPermissions: parseJsonArray(instance.grantedPermissions),
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      }, `Instance "${instanceKey}" created for plugin "${slug}"`);
    } catch (error: any) {
      const statusCode =
        typeof error?.statusCode === 'number' && Number.isFinite(error.statusCode)
          ? error.statusCode
          : error?.message?.includes('not found')
            ? 404
            : 400;
      const code = typeof error?.code === 'string' ? error.code : 'CREATE_ERROR';
      return sendError(reply, statusCode, code, error.message, error?.details);
    }
  });

  /**
   * PATCH /api/extensions/plugin/:slug/instances/:installationId
   * Update a plugin instance (enable/disable, config, permissions)
   */
  fastify.patch<{
    Params: { slug: string; installationId: string };
    Body: {
      enabled?: boolean;
      config?: Record<string, unknown>;
      grantedPermissions?: string[];
    };
  }>('/plugin/:slug/instances/:installationId', {
    onRequest: [authMiddleware, adminMiddleware],
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
      const adminConfig = sanitizePluginConfigForAdmin(pluginPackage.manifestJson, parseJsonObject(instance.configJson));

      return sendSuccess(reply, {
        installationId: instance.id,
        pluginSlug: instance.pluginSlug,
        instanceKey: instance.instanceKey,
        enabled: instance.enabled,
        config: adminConfig.config,
        configMeta: adminConfig.configMeta,
        grantedPermissions: parseJsonArray(instance.grantedPermissions),
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      });
    } catch (error: any) {
      const statusCode =
        typeof error?.statusCode === 'number' && Number.isFinite(error.statusCode)
          ? error.statusCode
          : 400;
      const code = typeof error?.code === 'string' ? error.code : 'UPDATE_ERROR';
      return sendError(reply, statusCode, code, error.message, error?.details);
    }
  });

  /**
   * DELETE /api/extensions/plugin/:slug/instances/:installationId
   * Soft-delete a plugin instance (installationId cannot be reused)
   */
  fastify.delete<{ Params: { slug: string; installationId: string } }>('/plugin/:slug/instances/:installationId', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Delete plugin instance',
      description: 'Soft-delete an instance (installationId cannot be reused). Default instance cannot be deleted.',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.deleteInstance,
    }
  }, async (request: FastifyRequest<{ Params: { slug: string; installationId: string } }>, reply: FastifyReply) => {
    try {
      const { slug, installationId } = request.params;

      // Verify the installation belongs to this plugin
      const existing = await PluginManagementService.getInstanceById(installationId);
      if (!existing) {
        return sendError(reply, 404, 'NOT_FOUND', `Installation "${installationId}" not found`);
      }
      if (existing.pluginSlug !== slug) {
        return sendError(reply, 400, 'BAD_REQUEST', `Installation "${installationId}" does not belong to plugin "${slug}"`);
      }

      await PluginManagementService.deleteInstance(installationId);

      return sendSuccess(reply, {
        pluginSlug: slug,
        installationId,
        instanceKey: existing.instanceKey,
        deleted: true,
      }, `Instance "${existing.instanceKey}" deleted (soft)`);
    } catch (error: any) {
      const statusCode = error.message.includes('default') ? 400 : 500;
      return sendError(reply, statusCode, 'DELETE_ERROR', error.message);
    }
  });

  // ============================================================================
  // Bundle Installation
  // ============================================================================

  /**
   * POST /api/extensions/bundle/install
   * Install bundle from ZIP
   *
   * Bundle format:
   * - bundle.json (manifest)
   * - extensions/ (directory containing extension ZIPs)
   */
  fastify.post('/bundle/install', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Install bundle from ZIP',
      description: 'Upload and install a bundle containing multiple extensions (Admin only)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      ...extensionInstallerSchemas.installBundle,
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get uploaded file
      const data = await request.file();
      if (!data) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No file uploaded');
      }

      // Validate file type
      if (!data.filename.toLowerCase().endsWith('.zip')) {
        return sendError(reply, 400, 'BAD_REQUEST', 'File must be a ZIP archive');
      }

      // Install bundle
      const { stream: limitedStream, getTotalBytes } = enforceZipSizeLimit(data.file as Readable, 'bundle');
      const result = await bundleInstaller.install(limitedStream);

      // Count successes and failures
      const successCount = result.installed.filter(i => i.success).length;
      const failureCount = result.installed.filter(i => !i.success).length;

      let message = `Bundle "${result.manifest.name}" v${result.manifest.version} installed: ${successCount} extensions`;
      if (failureCount > 0) {
        message += ` (${failureCount} optional extensions failed)`;
      }

      return sendSuccess(reply, {
        filename: data.filename || 'bundle.zip',
        originalName: data.filename || 'bundle.zip',
        size: getTotalBytes(),
        mimetype: data.mimetype || 'application/zip',
        url: '/api/extensions/bundle/install',
        name: result.manifest.name,
        version: result.manifest.version,
        bundleHash: result.bundleHash,
        installed: result.installed,
      }, message);
    } catch (error: any) {
      const statusCode =
        typeof error?.statusCode === 'number' && Number.isFinite(error.statusCode)
          ? error.statusCode
          : 500;
      const code =
        statusCode === 413
          ? 'PAYLOAD_TOO_LARGE'
          : typeof error?.code === 'string'
            ? error.code
          : statusCode >= 500
            ? 'INTERNAL_SERVER_ERROR'
            : 'BAD_REQUEST';

      if (statusCode >= 500) {
        fastify.log.error({ err: error }, 'Failed to install bundle');
      } else {
        fastify.log.warn({ err: error }, 'Bundle install rejected');
      }

      return sendError(reply, statusCode, code, error?.message || 'Failed to install bundle');
    }
  });

  /**
   * POST /api/extensions/:kind/install
   * Install extension from ZIP
   *
   * kind: 'plugin'
   */
  fastify.post<{ Params: InstallParams }>('/:kind/install', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Install extension from ZIP',
      description: 'Upload and install a plugin from a ZIP file (Admin only)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      ...extensionInstallerSchemas.installExtension,
    }
  }, async (request: FastifyRequest<{ Params: InstallParams }>, reply: FastifyReply) => {
    try {
      const { kind } = request.params;

      // Validate kind
      if (kind !== 'plugin') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid extension kind. Must be: plugin');
      }

      // Get uploaded file
      const data = await request.file();
      if (!data) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No file uploaded');
      }

      // Validate file type
      if (!data.filename.toLowerCase().endsWith('.zip')) {
        return sendError(reply, 400, 'BAD_REQUEST', 'File must be a ZIP archive');
      }

      // Install extension
      const { stream: limitedStream, getTotalBytes } = enforceZipSizeLimit(data.file as Readable, kind);
      const confirmationField = data.fields?.confirmUnsigned;
      const confirmUnsigned = !Array.isArray(confirmationField)
        && confirmationField?.type === 'field'
        && confirmationField.value === 'true';
      const result = await extensionInstaller.installFromZip(kind, limitedStream, {
        confirmUnsigned,
        actorUserId: request.user!.id,
      });

      try {
          // Create default instance if not exists
          const defaultInstance = await PluginManagementService.getDefaultInstance(result.slug);
          if (!defaultInstance) {
            await PluginManagementService.createInstance(result.slug, 'default', { enabled: false });
          }
          // Warm up runtime (hot upgrade supported, no restart needed)
          await warmPluginRuntime(result.slug);
          return sendSuccess(reply, {
            filename: data.filename || `${result.slug}.zip`,
            originalName: data.filename || `${result.slug}.zip`,
            size: getTotalBytes(),
            mimetype: data.mimetype || 'application/zip',
            url: `/api/extensions/${kind}/install`,
            ...result,
          }, `${kind} "${result.slug}" v${result.version} installed successfully`);
      } catch (e) {
          // If runtime warm fails, disable the default instance
          const defaultInstance = await PluginManagementService.getDefaultInstance(result.slug);
          if (defaultInstance) {
            await PluginManagementService.updateInstance(defaultInstance.id, { enabled: false });
          }
          throw e;
      }
    } catch (error: any) {
      const statusCode =
        typeof error?.statusCode === 'number' && Number.isFinite(error.statusCode)
          ? error.statusCode
          : 500;
      const code =
        statusCode === 413
          ? 'PAYLOAD_TOO_LARGE'
          : typeof error?.code === 'string'
            ? error.code
          : statusCode >= 500
            ? 'INTERNAL_SERVER_ERROR'
            : 'BAD_REQUEST';

      if (statusCode >= 500) {
        fastify.log.error({ err: error }, 'Failed to install extension');
      } else {
        fastify.log.warn({ err: error }, 'Extension install rejected');
      }

      return sendError(reply, statusCode, code, error?.message || 'Failed to install extension');
    }
  });

  /**
   * DELETE /api/extensions/plugin/:slug
   * Uninstall plugin package (removes all instances)
   */
  fastify.delete<{ Params: { slug: string } }>('/plugin/:slug', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Uninstall plugin package',
      description: 'Uninstall a plugin by slug, removes all instances (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.uninstallPlugin,
    }
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      await PluginManagementService.uninstallPlugin(slug);
      return sendSuccess(reply, {
        kind: 'plugin',
        slug,
        uninstalled: true,
      }, `plugin "${slug}" uninstalled successfully`);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to uninstall plugin');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to uninstall plugin');
    }
  });

  /**
   * POST /api/extensions/plugin/:slug/restore
   * Restore a soft-uninstalled plugin package
   */
  fastify.post<{ Params: { slug: string } }>('/plugin/:slug/restore', {
    onRequest: [authMiddleware, adminMiddleware],
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
      await PluginManagementService.restorePlugin(slug);
      return sendSuccess(reply, {
        kind: 'plugin',
        slug,
        restored: true,
      }, `plugin "${slug}" restored successfully`);
    } catch (error: any) {
      const message = error?.message || 'Failed to restore plugin';
      const statusCode = message.includes('not found') ? 404 : 400;
      return sendError(reply, statusCode, 'RESTORE_ERROR', message);
    }
  });

  /**
   * DELETE /api/extensions/plugin/:slug/purge
   * Permanently purge plugin package and files
   */
  fastify.delete<{ Params: { slug: string } }>('/plugin/:slug/purge', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Purge plugin package',
      description: 'Permanently remove plugin records and files (Admin only)',
      security: [{ bearerAuth: [] }],
      ...extensionInstallerSchemas.purgePlugin,
    }
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      await PluginManagementService.purgePlugin(slug);
      return sendSuccess(reply, {
        kind: 'plugin',
        slug,
        purged: true,
      }, `plugin "${slug}" purged permanently`);
    } catch (error: any) {
      const statusCode = error?.message?.includes('not found') ? 404 : 400;
      return sendError(reply, statusCode, 'PURGE_ERROR', error.message || 'Failed to purge plugin');
    }
  });

  /**
   * GET /api/extensions/plugin
   * List installed plugin packages.
   */
  fastify.get<{ Params: ListParams; Querystring: PaginationQuery }>('/:kind', {
    onRequest: [authMiddleware, adminMiddleware],
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
      const extensions = await extensionInstaller.listInstalled(request.params.kind);
      const total = extensions.length;
      const items = extensions.slice((safePage - 1) * safeLimit, safePage * safeLimit);
      return sendSuccess(reply, {
        items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list plugins';
      fastify.log.error({ err: error }, 'Failed to list plugins');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

  /**
   * GET /api/extensions/plugin/:slug
   * Get an installed plugin package.
   */
  fastify.get<{ Params: GetParams }>('/:kind/:slug', {
    onRequest: [authMiddleware, adminMiddleware],
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get plugin';
      fastify.log.error({ err: error }, 'Failed to get plugin');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', message);
    }
  });

};
