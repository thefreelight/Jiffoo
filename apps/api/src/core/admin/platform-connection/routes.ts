import type { FastifyPluginAsync } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { sendError, sendSuccess } from '@/utils/response';
import { platformConnectionService, PlatformConnectionStateError } from './service';

const platformConnectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  fastify.get('/status', async (_request, reply) => {
    try {
      const status = await platformConnectionService.getStatus();
      return sendSuccess(reply, status);
    } catch (error: any) {
      return sendError(reply, 500, 'PLATFORM_CONNECTION_STATUS_ERROR', error?.message || 'Failed to load platform connection status');
    }
  });

  fastify.post('/start', async (request, reply) => {
    try {
      const body = (request.body || {}) as {
        instanceName?: string;
        originUrl?: string;
        coreVersion?: string;
      };
      const status = await platformConnectionService.start(body);
      return sendSuccess(reply, status);
    } catch (error: any) {
      return sendError(reply, 500, 'PLATFORM_CONNECTION_START_ERROR', error?.message || 'Failed to start platform connection');
    }
  });

  fastify.post('/poll', async (request, reply) => {
    try {
      const body = (request.body || {}) as { deviceCode?: string };
      if (!body.deviceCode) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'deviceCode is required');
      }
      const status = await platformConnectionService.poll({ deviceCode: body.deviceCode });
      return sendSuccess(reply, status);
    } catch (error: any) {
      return sendError(reply, 400, 'PLATFORM_CONNECTION_POLL_ERROR', error?.message || 'Failed to poll platform connection');
    }
  });

  fastify.post('/complete', async (request, reply) => {
    try {
      const body = (request.body || {}) as {
        deviceCode?: string;
        accountEmail?: string;
        accountName?: string;
      };
      if (!body.deviceCode || !body.accountEmail) {
        return sendError(reply, 400, 'VALIDATION_ERROR', 'deviceCode and accountEmail are required');
      }
      const status = await platformConnectionService.complete({
        deviceCode: body.deviceCode,
        accountEmail: body.accountEmail,
        accountName: body.accountName,
      });
      return sendSuccess(reply, status);
    } catch (error: any) {
      if (error instanceof PlatformConnectionStateError) {
        return sendError(reply, 409, error.code, error.message, error.details);
      }
      return sendError(reply, 400, 'PLATFORM_CONNECTION_COMPLETE_ERROR', error?.message || 'Failed to complete platform connection');
    }
  });

  fastify.post('/bind-tenant', async (_request, reply) => {
    try {
      const status = await platformConnectionService.bindDefaultStore();
      return sendSuccess(reply, status);
    } catch (error: any) {
      if (error instanceof PlatformConnectionStateError) {
        return sendError(reply, 409, error.code, error.message, error.details);
      }
      return sendError(reply, 400, 'PLATFORM_TENANT_BINDING_ERROR', error?.message || 'Failed to bind default store');
    }
  });

  fastify.post('/disconnect', async (_request, reply) => {
    try {
      const status = await platformConnectionService.disconnect();
      return sendSuccess(reply, status);
    } catch (error: any) {
      return sendError(reply, 500, 'PLATFORM_CONNECTION_DISCONNECT_ERROR', error?.message || 'Failed to disconnect platform connection');
    }
  });
};

export default platformConnectionRoutes;
