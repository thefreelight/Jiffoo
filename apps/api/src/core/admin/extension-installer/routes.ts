/**
 * Extension Installer Routes
 * 
 * API Routes: Support ZIP upload and installation of themes and plugins
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { extensionInstaller, type ExtensionKind } from './index';

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
 * Register extension installer routes
 *
 * Note: multipart is already registered globally in server.ts, no need to re-register here
 */
export async function extensionInstallerRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/extensions/:kind/install
   * Install extension from ZIP
   * 
   * kind: 'theme-shop' | 'theme-admin' | 'plugin'
   */
  fastify.post<{ Params: InstallParams }>('/:kind/install', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'Install extension from ZIP',
      description: 'Upload and install a theme or plugin from a ZIP file (Admin only)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
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
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                version: { type: 'string' },
                name: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        }
      }
    },
  }, async (request: FastifyRequest<{ Params: InstallParams }>, reply: FastifyReply) => {
    try {
      const { kind } = request.params;

      // Validate kind
      if (!['theme-shop', 'theme-admin', 'plugin'].includes(kind)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid extension kind. Must be: theme-shop, theme-admin, or plugin',
        });
      }

      // Get uploaded file
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Validate file type
      if (!data.filename.endsWith('.zip')) {
        return reply.status(400).send({
          success: false,
          error: 'File must be a ZIP archive',
        });
      }

      // Install extension
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
   * Uninstall extension
   */
  fastify.delete<{ Params: UninstallParams }>('/:kind/:slug', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'Uninstall extension',
      description: 'Uninstall a theme or plugin by slug (Admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['theme-shop', 'theme-admin', 'plugin'],
          },
          slug: { type: 'string' }
        },
        required: ['kind', 'slug'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        }
      }
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
   * List installed extensions
   */
  fastify.get<{ Params: ListParams }>('/:kind', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'List installed extensions',
      description: 'Get list of installed themes or plugins (Admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['theme-shop', 'theme-admin', 'plugin'],
          }
        },
        required: ['kind'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  slug: { type: 'string' },
                  name: { type: 'string' },
                  version: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        }
      }
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
   * Get extension details
   */
  fastify.get<{ Params: GetParams }>('/:kind/:slug', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['Extension Installer'],
      summary: 'Get extension details',
      description: 'Get details of an installed theme or plugin (Admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['theme-shop', 'theme-admin', 'plugin'],
          },
          slug: { type: 'string' }
        },
        required: ['kind', 'slug'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                name: { type: 'string' },
                version: { type: 'string' },
                description: { type: 'string' },
                author: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' }
          }
        }
      }
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
