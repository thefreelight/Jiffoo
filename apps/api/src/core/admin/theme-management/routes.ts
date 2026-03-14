/**
 * Theme Management Routes
 * Supports both shop and admin themes with separate sub-paths
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { ThemeManagementService, type ThemeTarget } from './service';
import type { ActivateThemeInput, ThemeConfig } from './types';
import { sendSuccess, sendError } from '@/utils/response';
import { adminThemeSchemas, publicThemeSchemas } from './schemas';

/**
 * Create theme routes for a specific target (shop or admin)
 */
function createTargetThemeRoutes(fastify: FastifyInstance, target: ThemeTarget) {
  /**
   * GET /api/admin/themes/{target}/installed
   * Get installed themes list for target
   */
  fastify.get('/installed', {
    schema: {
      tags: ['admin-themes'],
      summary: `Get installed ${target} themes`,
      description: `Get list of all installed themes for ${target}`,
      security: [{ bearerAuth: [] }],
      ...adminThemeSchemas.getInstalled,
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>, reply: FastifyReply) => {
    try {
      const { page, limit } = request.query || {};
      const result = await ThemeManagementService.getInstalledThemesPaged(target, page, limit);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  /**
   * GET /api/admin/themes/{target}/active
   * Get active theme for target
   */
  fastify.get('/active', {
    schema: {
      tags: ['admin-themes'],
      summary: `Get active ${target} theme`,
      description: `Get currently active theme for ${target}`,
      security: [{ bearerAuth: [] }],
      ...adminThemeSchemas.getActive,
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const activeTheme = await ThemeManagementService.getActiveTheme(target);
      return sendSuccess(reply, activeTheme);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  /**
   * POST /api/admin/themes/{target}/:slug/activate
   * Activate theme for target
   */
  fastify.post<{ Params: { slug: string }; Body?: { config?: ThemeConfig; type?: 'pack' | 'app' } }>('/:slug/activate', {
    schema: {
      tags: ['admin-themes'],
      summary: `Activate ${target} theme`,
      description: `Activate a specific theme for ${target}`,
      security: [{ bearerAuth: [] }],
      ...adminThemeSchemas.activate,
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const body = request.body as { config?: ThemeConfig; type?: 'pack' | 'app' } | undefined;
      const result = await ThemeManagementService.activateTheme(slug, target, body?.config, body?.type);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 400, 'ACTIVATE_ERROR', error.message);
    }
  });

  /**
   * POST /api/admin/themes/{target}/rollback
   * Rollback to previous theme for target
   */
  fastify.post('/rollback', {
    schema: {
      tags: ['admin-themes'],
      summary: `Rollback ${target} theme`,
      description: `Rollback to previous theme for ${target}`,
      security: [{ bearerAuth: [] }],
      ...adminThemeSchemas.rollback,
    },
  }, async (_request, reply) => {
    try {
      const result = await ThemeManagementService.rollbackTheme(target);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 400, 'ROLLBACK_ERROR', error.message);
    }
  });

  /**
   * PUT /api/admin/themes/{target}/config
   * Update theme config for target
   */
  fastify.put<{ Body: ThemeConfig }>('/config', {
    schema: {
      tags: ['admin-themes'],
      summary: `Update ${target} theme config`,
      description: `Update theme configuration for ${target}`,
      security: [{ bearerAuth: [] }],
      ...adminThemeSchemas.updateConfig,
    },
  }, async (request, reply) => {
    try {
      const config = request.body;
      const result = await ThemeManagementService.updateThemeConfig(config, target);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}

export async function adminThemeRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin theme routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // GET /api/admin/themes/
  // Keep a root endpoint so contract checks don't hit 404 on module base path.
  fastify.get('/', {
    schema: {
      tags: ['admin-themes'],
      summary: 'Theme management root',
      description: 'Theme management API root for admin module',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              required: ['targets'],
              properties: {
                targets: {
                  type: 'array',
                  items: { type: 'string', enum: ['shop', 'admin'] },
                },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    return sendSuccess(reply, { targets: ['shop', 'admin'] });
  });

  // Register shop theme routes under /shop
  fastify.register(async (shopInstance) => {
    createTargetThemeRoutes(shopInstance, 'shop');
  }, { prefix: '/shop' });

  // Register admin theme routes under /admin
  fastify.register(async (adminInstance) => {
    createTargetThemeRoutes(adminInstance, 'admin');
  }, { prefix: '/admin' });
}

/**
 * Public theme routes (no admin required)
 */
export async function publicThemeRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/themes/active?target=shop|admin
   * Get active theme (Public API)
   * Returns type ('pack'|'app'), and baseUrl/port when type=app
   */
  fastify.get<{ Querystring: { target?: 'shop' | 'admin' } }>('/active', {
    schema: {
      tags: ['themes'],
      summary: 'Get active theme',
      description: 'Get the currently active theme for shop or admin',
      ...publicThemeSchemas.getActive,
    },
  }, async (request: FastifyRequest<{ Querystring: { target?: 'shop' | 'admin' } }>, reply: FastifyReply) => {
    try {
      const target = request.query.target || 'shop';
      const activeTheme = await ThemeManagementService.getActiveTheme(target);
      return sendSuccess(reply, activeTheme);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  /**
   * GET /api/themes/installed
   * Get installed themes list (Public API, shop only)
   */
  fastify.get('/installed', {
    schema: {
      tags: ['themes'],
      summary: 'Get installed themes',
      description: 'Get list of all installed shop themes',
      ...publicThemeSchemas.getInstalled,
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>, reply: FastifyReply) => {
    try {
      const { page, limit } = request.query || {};
      const result = await ThemeManagementService.getInstalledThemesPaged('shop', page, limit);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}
