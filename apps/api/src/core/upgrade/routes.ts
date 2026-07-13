/**
 * System Upgrade Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpgradeService } from './service';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { upgradeSchemas } from './schemas';
import { PUBLIC_CORE_UPDATE_MANIFEST } from 'shared';

export async function upgradeRoutes(fastify: FastifyInstance) {
  fastify.get('/manifest.json', {
    schema: {
      tags: ['upgrade'],
      summary: 'Get Public Upgrade Manifest',
      description: 'Public self-hosted core update manifest consumed by installer and updater clients',
      ...upgradeSchemas.getPublicManifest,
    },
  }, async (_request, reply: FastifyReply) => {
    reply.type('application/json; charset=utf-8');
    return reply.send(PUBLIC_CORE_UPDATE_MANIFEST);
  });

  await fastify.register(async (protectedFastify) => {
    protectedFastify.addHook('onRequest', authMiddleware);
    protectedFastify.addHook('onRequest', requireAdmin);

    /**
     * Get current version info
     */
    protectedFastify.get('/version', {
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
    protectedFastify.post('/check', {
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
    protectedFastify.get('/status', {
      schema: {
        tags: ['upgrade'],
        summary: 'Get Upgrade Status',
        description: 'Get current upgrade process status (Admin only)',
        security: [{ bearerAuth: [] }],
        ...upgradeSchemas.getStatus,
      }
    }, async (_request, reply: FastifyReply) => {
      try {
        const status = await UpgradeService.getUpgradeStatus();
        return sendSuccess(reply, status);
      } catch (error: any) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to get upgrade status');
      }
    });

    protectedFastify.post('/status/reset', {
      schema: {
        tags: ['upgrade'],
        summary: 'Reset Upgrade Status',
        description: 'Reset the visible upgrade status back to idle after a terminal state (Admin only)',
        security: [{ bearerAuth: [] }],
        ...upgradeSchemas.resetStatus,
      }
    }, async (_request, reply: FastifyReply) => {
      try {
        const status = await UpgradeService.resetUpgradeStatus();
        return sendSuccess(reply, status);
      } catch (error: any) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to reset upgrade status');
      }
    });

    /**
     * Create backup
     */
    protectedFastify.post('/backup', {
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
    protectedFastify.post('/perform', {
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

        if ('error' in result) {
          return sendError(reply, 400, 'BAD_REQUEST', result.error || 'Upgrade failed');
        }

        return sendSuccess(reply, {
          ...result.result,
        }, result.result.completed ? 'Upgrade completed successfully' : 'Upgrade accepted successfully');
      } catch (error: any) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message || 'Failed to perform upgrade');
      }
    });
  });
}
