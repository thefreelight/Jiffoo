/**
 * Extension Installer Routes
 * 
 * API 路由：支持 ZIP 上传安装主题和插件
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { extensionInstaller, ExtensionKind } from './index';

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

interface GetParams {
  kind: ExtensionKind;
  slug: string;
}

/**
 * 注册扩展安装器路由
 *
 * 注意：multipart 已在 server.ts 全局注册，这里不需要重复注册
 */
export async function extensionInstallerRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/extensions/:kind/install
   * 从 ZIP 安装扩展
   * 
   * kind: 'theme-shop' | 'theme-admin' | 'plugin'
   */
  fastify.post<{ Params: InstallParams }>('/:kind/install', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'Install extension from ZIP',
      description: 'Upload and install a theme or plugin from a ZIP file',
      params: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['theme-shop', 'theme-admin', 'plugin'],
          },
        },
        required: ['kind'],
      },
    },
  }, async (request: FastifyRequest<{ Params: InstallParams }>, reply: FastifyReply) => {
    try {
      const { kind } = request.params;

      // 验证 kind
      if (!['theme-shop', 'theme-admin', 'plugin'].includes(kind)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid extension kind. Must be: theme-shop, theme-admin, or plugin',
        });
      }

      // 获取上传的文件
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      // 验证文件类型
      if (!data.filename.endsWith('.zip')) {
        return reply.status(400).send({
          success: false,
          error: 'File must be a ZIP archive',
        });
      }

      // 安装扩展
      const result = await extensionInstaller.installFromZip(kind, data.file as Readable);

      return reply.send({
        success: true,
        data: result,
        message: `${kind} "${result.slug}" v${result.version} installed successfully`,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install extension');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to install extension',
      });
    }
  });

  /**
   * DELETE /api/extensions/:kind/:slug
   * 卸载扩展
   */
  fastify.delete<{ Params: UninstallParams }>('/:kind/:slug', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'Uninstall extension',
      description: 'Uninstall a theme or plugin by slug',
    },
  }, async (request: FastifyRequest<{ Params: UninstallParams }>, reply: FastifyReply) => {
    try {
      const { kind, slug } = request.params;

      const result = await extensionInstaller.uninstall(kind, slug);

      return reply.send({
        success: true,
        data: result,
        message: `${kind} "${slug}" uninstalled successfully`,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to uninstall extension');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to uninstall extension',
      });
    }
  });

  /**
   * GET /api/extensions/:kind
   * 列出已安装的扩展
   */
  fastify.get<{ Params: ListParams }>('/:kind', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'List installed extensions',
      description: 'Get list of installed themes or plugins',
    },
  }, async (request: FastifyRequest<{ Params: ListParams }>, reply: FastifyReply) => {
    try {
      const { kind } = request.params;

      const extensions = await extensionInstaller.listInstalled(kind);

      return reply.send({
        success: true,
        data: extensions,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to list extensions');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to list extensions',
      });
    }
  });

  /**
   * GET /api/extensions/:kind/:slug
   * 获取扩展详情
   */
  fastify.get<{ Params: GetParams }>('/:kind/:slug', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'Get extension details',
      description: 'Get details of an installed theme or plugin',
    },
  }, async (request: FastifyRequest<{ Params: GetParams }>, reply: FastifyReply) => {
    try {
      const { kind, slug } = request.params;

      const extension = await extensionInstaller.getInstalled(kind, slug);

      if (!extension) {
        return reply.status(404).send({
          success: false,
          error: `${kind} "${slug}" not found`,
        });
      }

      return reply.send({
        success: true,
        data: extension,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get extension');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to get extension',
      });
    }
  });
}

