/**
 * System Upgrade Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpgradeService } from './service';

export async function upgradeRoutes(fastify: FastifyInstance) {
  /**
   * Get current version info
   */
  fastify.get('/version', async (request: FastifyRequest, reply: FastifyReply) => {
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
  fastify.post('/check', async (
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
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
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
  fastify.post('/backup', async (request: FastifyRequest, reply: FastifyReply) => {
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
  fastify.post('/perform', async (
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
  fastify.post('/rollback', async (
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

