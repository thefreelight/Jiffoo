/**
 * Theme Management Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { ThemeManagementService } from './service';
import type { ActivateThemeInput, ThemeConfig } from './types';

export async function adminThemeRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all admin theme routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  /**
   * GET /api/admin/themes
   * Get installed themes list
   */
  fastify.get('/', {
    schema: {
      tags: ['admin-themes'],
      summary: 'Get installed themes list',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await ThemeManagementService.getInstalledThemes();
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/themes/active
   * Get active theme
   */
  fastify.get('/active', {
    schema: {
      tags: ['admin-themes'],
      summary: 'Get active theme',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const activeTheme = await ThemeManagementService.getActiveTheme();
      return reply.send({ success: true, data: activeTheme });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/themes/:slug/activate
   * Activate theme
   */
  fastify.post<{ Params: { slug: string }; Body?: { config?: ThemeConfig } }>('/:slug/activate', {
    schema: {
      tags: ['admin-themes'],
      summary: 'Activate a theme',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const body = request.body as { config?: ThemeConfig } | undefined;
      const result = await ThemeManagementService.activateTheme(slug, body?.config);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/themes/rollback
   * Rollback to previous theme
   */
  fastify.post('/rollback', {
    schema: {
      tags: ['admin-themes'],
      summary: 'Rollback to previous theme',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => {
    try {
      const result = await ThemeManagementService.rollbackTheme();
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/admin/themes/config
   * Update theme config
   */
  fastify.put<{ Body: ThemeConfig }>('/config', {
    schema: {
      tags: ['admin-themes'],
      summary: 'Update theme config',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
      },
    },
  }, async (request, reply) => {
    try {
      const config = request.body;
      const result = await ThemeManagementService.updateThemeConfig(config);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}

/**
 * Public theme routes (no admin required)
 */
export async function publicThemeRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/themes/active
   * Get active theme (Public API)
   */
  fastify.get('/active', {
    schema: {
      tags: ['themes'],
      summary: 'Get active theme',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const activeTheme = await ThemeManagementService.getActiveTheme();
      return reply.send({ success: true, data: activeTheme });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/themes/installed
   * Get installed themes list (Public API)
   */
  fastify.get('/installed', {
    schema: {
      tags: ['themes'],
      summary: 'Get installed themes',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await ThemeManagementService.getInstalledThemes();
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}
