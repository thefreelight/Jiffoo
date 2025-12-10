/**
 * Theme Management Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { ThemeManagementService } from './service';
import type { ActivateThemeInput, ThemeConfig } from './types';

export async function adminThemeRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/themes
   * 获取已安装主题列表
   */
  fastify.get('/', {
    preHandler: [authMiddleware, requireAdmin],
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
   * 获取当前激活主题
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
   * 激活指定主题
   */
  fastify.post<{ Params: { slug: string }; Body?: { config?: ThemeConfig } }>('/:slug/activate', {
    preHandler: [authMiddleware, requireAdmin],
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
   * PUT /api/admin/themes/config
   * 更新主题配置
   */
  fastify.put<{ Body: ThemeConfig }>('/config', {
    preHandler: [authMiddleware, requireAdmin],
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
   * 获取当前激活主题 (公开 API)
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
   * 获取已安装主题列表 (公开 API)
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

