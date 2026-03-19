import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { sendError, sendSuccess } from '@/utils/response';
import { managedPackageService } from './service';

function getSiteUrl(request: FastifyRequest): string | null {
  const host = typeof request.headers['x-forwarded-host'] === 'string'
    ? request.headers['x-forwarded-host']
    : typeof request.headers.host === 'string'
      ? request.headers.host
      : '';

  if (!host) {
    return null;
  }

  const proto = typeof request.headers['x-forwarded-proto'] === 'string'
    ? request.headers['x-forwarded-proto']
    : request.protocol || 'https';

  return `${proto}://${host}`;
}

export default async function managedPackageRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/branding',
    {
      schema: {
        tags: ['admin-commercial-package'],
        summary: 'Get public managed package branding',
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await managedPackageService.getBranding();
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 500, 'MANAGED_PACKAGE_BRANDING_ERROR', error?.message || 'Failed to load managed package branding');
      }
    },
  );

  fastify.get(
    '/status',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-commercial-package'],
        summary: 'Get managed package status',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await managedPackageService.getStatus(getSiteUrl(request));
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 500, 'MANAGED_PACKAGE_STATUS_ERROR', error?.message || 'Failed to load managed package status');
      }
    },
  );

  fastify.post(
    '/activate',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-commercial-package'],
        summary: 'Activate a managed package',
        security: [{ bearerAuth: [] }],
      },
    },
    async (
      request: FastifyRequest<{ Body: { activationCode?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const activationCode = request.body?.activationCode?.trim();
        if (!activationCode) {
          return sendError(reply, 400, 'VALIDATION_ERROR', 'activationCode is required');
        }

        const result = await managedPackageService.activate(activationCode, getSiteUrl(request));
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 400, 'MANAGED_PACKAGE_ACTIVATION_ERROR', error?.message || 'Activation failed');
      }
    },
  );

  fastify.post(
    '/provision',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-commercial-package'],
        summary: 'Provision included assets for the active managed package',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await managedPackageService.provision(getSiteUrl(request));
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 400, 'MANAGED_PACKAGE_PROVISION_ERROR', error?.message || 'Provision failed');
      }
    },
  );
}
