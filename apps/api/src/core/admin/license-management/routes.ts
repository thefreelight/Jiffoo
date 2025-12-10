/**
 * License Management API Routes
 * 许可证管理 API - 管理商业插件的许可证
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLicenseService, LicenseActivationRequest } from '@/services/license';
import { LoggerService } from '@/core/logger/unified-logger';

interface ActivateLicenseBody {
  licenseKey: string;
  customerEmail?: string;
  customerName?: string;
}

interface PluginParams {
  slug: string;
}

export async function registerLicenseRoutes(fastify: FastifyInstance) {
  const licenseService = getLicenseService(fastify.prisma);

  // ============================================
  // 获取所有许可证
  // GET /api/admin/licenses
  // ============================================
  fastify.get('/admin/licenses', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const licenses = await licenseService.getAllLicenses();
      return {
        success: true,
        data: { licenses, total: licenses.length },
      };
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'getLicenses' });
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch licenses',
      });
    }
  });

  // ============================================
  // 获取插件许可证状态
  // GET /api/admin/plugins/:slug/license
  // ============================================
  fastify.get<{ Params: PluginParams }>(
    '/admin/plugins/:slug/license',
    async (request, reply) => {
      try {
        const { slug } = request.params;
        const result = await licenseService.getStatus(slug);
        return { success: true, data: result };
      } catch (error) {
        LoggerService.logError(error as Error, { context: 'getLicenseStatus' });
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch license status',
        });
      }
    }
  );

  // ============================================
  // 激活许可证
  // POST /api/admin/plugins/:slug/license/activate
  // ============================================
  fastify.post<{ Params: PluginParams; Body: ActivateLicenseBody }>(
    '/admin/plugins/:slug/license/activate',
    async (request, reply) => {
      try {
        const { slug } = request.params;
        const { licenseKey, customerEmail, customerName } = request.body;

        if (!licenseKey) {
          return reply.status(400).send({
            success: false,
            error: 'License key is required',
          });
        }

        const activationRequest: LicenseActivationRequest = {
          pluginSlug: slug,
          licenseKey,
          customerEmail,
          customerName,
        };

        const result = await licenseService.activate(activationRequest);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.error,
            errorCode: result.errorCode,
          });
        }

        return { success: true, data: { license: result.license } };
      } catch (error) {
        LoggerService.logError(error as Error, { context: 'activateLicense' });
        return reply.status(500).send({
          success: false,
          error: 'Failed to activate license',
        });
      }
    }
  );

  // ============================================
  // 停用许可证
  // POST /api/admin/plugins/:slug/license/deactivate
  // ============================================
  fastify.post<{ Params: PluginParams }>(
    '/admin/plugins/:slug/license/deactivate',
    async (request, reply) => {
      try {
        const { slug } = request.params;
        const result = await licenseService.deactivate(slug);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.error,
          });
        }

        return { success: true, message: 'License deactivated' };
      } catch (error) {
        LoggerService.logError(error as Error, { context: 'deactivateLicense' });
        return reply.status(500).send({
          success: false,
          error: 'Failed to deactivate license',
        });
      }
    }
  );

  // ============================================
  // 验证许可证
  // POST /api/admin/plugins/:slug/license/validate
  // ============================================
  fastify.post<{ Params: PluginParams; Body: { licenseKey: string } }>(
    '/admin/plugins/:slug/license/validate',
    async (request, reply) => {
      try {
        const { slug } = request.params;
        const { licenseKey } = request.body;

        if (!licenseKey) {
          return reply.status(400).send({
            success: false,
            error: 'License key is required',
          });
        }

        const result = await licenseService.validate(slug, licenseKey);
        return { success: true, data: result };
      } catch (error) {
        LoggerService.logError(error as Error, { context: 'validateLicense' });
        return reply.status(500).send({
          success: false,
          error: 'Failed to validate license',
        });
      }
    }
  );
}

