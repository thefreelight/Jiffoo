/**
 * System Upgrade Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpgradeService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { upgradeSchemas } from './schemas';

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
      ...upgradeSchemas.getVersion,
    }
  }, async (_request, reply: FastifyReply) => {
    try {
      const versionInfo = await UpgradeService.getVersionInfo();
      return sendSuccess(reply, versionInfo);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to get version info');
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
      ...upgradeSchemas.checkCompatibility,
    }
  }, async (
    request: FastifyRequest<{ Body: { targetVersion: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { targetVersion } = request.body as any;
      if (!targetVersion) {
        return sendError(reply, 400, 'BAD_REQUEST', 'targetVersion is required');
      }
      const compatibility = await UpgradeService.checkCompatibility(targetVersion);
      return sendSuccess(reply, compatibility);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to check compatibility');
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
      ...upgradeSchemas.getStatus,
    }
  }, async (_request, reply: FastifyReply) => {
    try {
      const status = UpgradeService.getUpgradeStatus();
      return sendSuccess(reply, status);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to get upgrade status');
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
      ...upgradeSchemas.createBackup,
    }
  }, async (_request, reply: FastifyReply) => {
    try {
      const backup = await UpgradeService.createBackup();
      return sendSuccess(reply, backup);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to create backup');
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
      ...upgradeSchemas.performUpgrade,
    }
  }, async (
    request: FastifyRequest<{ Body: { targetVersion: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { targetVersion } = request.body as any;
      if (!targetVersion) {
        return sendError(reply, 400, 'BAD_REQUEST', 'targetVersion is required');
      }
      const result = await UpgradeService.performUpgrade(targetVersion);

      if (!result.success) {
        return sendError(reply, 400, 'BAD_REQUEST', result.error || 'Upgrade failed');
      }

      return sendSuccess(reply, {
        targetVersion,
        upgraded: true,
        completedAt: new Date().toISOString(),
      }, 'Upgrade completed successfully');
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to perform upgrade');
    }
  });

}
