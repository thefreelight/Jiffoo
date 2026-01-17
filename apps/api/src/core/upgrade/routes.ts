/**
 * System Upgrade Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpgradeService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';

export async function upgradeRoutes(fastify: FastifyInstance) {
  // Require Admin for all upgrade routes
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  /**
   * Get current version info
   */
  fastify.get('/version', {
    schema: {
      tags: ['upgrade'],
      summary: 'Get Version Info',
      description: 'Get current system version information (Admin only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                currentVersion: { type: 'string' },
                latestVersion: { type: 'string' },
                hasUpdate: { type: 'boolean' }
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
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const versionInfo = await UpgradeService.getVersionInfo();
      return reply.send({
        success: true,
        data: versionInfo
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get version info'
      });
    }
  });

  /**
   * Check upgrade compatibility
   */
  fastify.post('/check', {
    schema: {
      tags: ['upgrade'],
      summary: 'Check Upgrade Compatibility',
      description: 'Check if system can be upgraded to target version (Admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          targetVersion: { type: 'string' }
        },
        required: ['targetVersion']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                compatible: { type: 'boolean' },
                requirements: { type: 'array', items: { type: 'string' } },
                warnings: { type: 'array', items: { type: 'string' } }
              }
            }
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
    }
  }, async (
    request: FastifyRequest<{ Body: { targetVersion: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { targetVersion } = request.body;

      if (!targetVersion) {
        return reply.status(400).send({
          success: false,
          error: 'Target version is required'
        });
      }

      const compatibility = await UpgradeService.checkCompatibility(targetVersion);
      return reply.send({
        success: true,
        data: compatibility
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check compatibility'
      });
    }
  });

  /**
   * Get upgrade status
   */
  fastify.get('/status', {
    schema: {
      tags: ['upgrade'],
      summary: 'Get Upgrade Status',
      description: 'Get current upgrade process status (Admin only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['idle', 'checking', 'downloading', 'installing', 'completed', 'failed'] },
                progress: { type: 'number' },
                message: { type: 'string' }
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
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = UpgradeService.getUpgradeStatus();
      return reply.send({
        success: true,
        data: status
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upgrade status'
      });
    }
  });

  /**
   * Create backup
   */
  fastify.post('/backup', {
    schema: {
      tags: ['upgrade'],
      summary: 'Create Backup',
      description: 'Create a backup before upgrade (Admin only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                backupId: { type: 'string' },
                createdAt: { type: 'string' },
                size: { type: 'number' }
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
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const backup = await UpgradeService.createBackup();
      return reply.send({
        success: true,
        data: backup
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup'
      });
    }
  });

  /**
   * Perform upgrade
   */
  fastify.post('/perform', {
    schema: {
      tags: ['upgrade'],
      summary: 'Perform Upgrade',
      description: 'Execute system upgrade to target version (Admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          targetVersion: { type: 'string' }
        },
        required: ['targetVersion']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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
    }
  }, async (
    request: FastifyRequest<{ Body: { targetVersion: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { targetVersion } = request.body;

      if (!targetVersion) {
        return reply.status(400).send({
          success: false,
          error: 'Target version is required'
        });
      }

      const result = await UpgradeService.performUpgrade(targetVersion);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error
        });
      }

      return reply.send({
        success: true,
        message: 'Upgrade completed successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform upgrade'
      });
    }
  });

  /**
   * Rollback to backup
   */
  fastify.post('/rollback', {
    schema: {
      tags: ['upgrade'],
      summary: 'Rollback Upgrade',
      description: 'Rollback to a previous backup (Admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          backupId: { type: 'string' }
        },
        required: ['backupId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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
    }
  }, async (
    request: FastifyRequest<{ Body: { backupId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { backupId } = request.body;

      if (!backupId) {
        return reply.status(400).send({
          success: false,
          error: 'Backup ID is required'
        });
      }

      const result = await UpgradeService.rollback(backupId);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error
        });
      }

      return reply.send({
        success: true,
        message: 'Rollback completed successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rollback'
      });
    }
  });
}

