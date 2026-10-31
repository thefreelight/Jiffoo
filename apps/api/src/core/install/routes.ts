import { FastifyInstance } from 'fastify';
import { InstallService } from './service';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { sendSuccess } from '@/utils/response';
import { createSuccessResponseSchema, errorResponseSchema } from '@/types/common-dto';

export async function installRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/install/status
   * Check installation status
   */
  fastify.get('/status', {
    schema: {
      tags: ['Install'],
      summary: 'Check installation status',
      response: {
        200: createSuccessResponseSchema({
          type: 'object',
          properties: {
            isInstalled: { type: 'boolean' },
            version: { type: 'string' },
            installedAt: { type: 'string', format: 'date-time' },
            siteName: { type: 'string' },
          },
          required: ['isInstalled'],
        }),
        500: errorResponseSchema,
      }
    }
  }, async (request, reply) => {
    const status = await InstallService.checkInstallationStatus();
    return sendSuccess(reply, status);
  });

  /**
   * GET /api/install/check-database
   * Check database connection
   */
  fastify.get('/check-database', {
    schema: {
      tags: ['Install'],
      summary: 'Check database connection',
      response: {
        200: createSuccessResponseSchema({
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
          },
          required: ['connected'],
        }),
        404: errorResponseSchema,
        500: errorResponseSchema,
      }
    }
  }, async (request, reply) => {
    const status = await InstallService.checkInstallationStatus();
    if (status.isInstalled) return reply.code(404).send();
    const result = await InstallService.checkDatabaseConnection();
    return sendSuccess(reply, result);
  });

  /**
   * POST /api/install/complete
   * Complete installation
   */
  fastify.post('/complete', {
    schema: {
      tags: ['Install'],
      summary: 'Complete installation',
      body: {
        type: 'object',
        required: ['siteName', 'adminEmail', 'adminPassword'],
        properties: {
          siteName: { type: 'string', minLength: 1 },
          siteDescription: { type: 'string' },
          adminEmail: { type: 'string', format: 'email' },
          adminPassword: { type: 'string', minLength: 8 },
          adminUsername: { type: 'string', minLength: 2, maxLength: 64, pattern: '^[A-Za-z0-9._-]+$' }
        }
      },
      response: {
        200: createSuccessResponseSchema({
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            siteName: { type: 'string' },
            adminUsername: { type: 'string' },
            adminEmail: { type: 'string', format: 'email' },
            timezone: { type: 'string' },
          },
          required: ['success', 'siteName', 'adminUsername', 'adminEmail', 'timezone']
        }),
        400: errorResponseSchema,
        409: errorResponseSchema,
        500: errorResponseSchema,
        503: errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const body = request.body as any;

    // Check if already installed
    const status = await InstallService.checkInstallationStatus();
    if (status.isInstalled) {
      return sendMappedError(reply, new ApiError('INSTALL_ALREADY_COMPLETED'));
    }

    const result = await InstallService.completeInstallation({
      siteName: body.siteName,
      siteDescription: body.siteDescription,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      adminUsername: body.adminUsername
    });

    return sendSuccess(reply, result);
  });
}

