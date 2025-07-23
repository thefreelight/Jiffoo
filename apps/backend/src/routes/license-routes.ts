/**
 * License Management API Routes
 *
 * Handles license validation, usage tracking, and subscription management
 */

import { FastifyInstance } from 'fastify';
import { LicenseServer, LicenseValidationRequest } from '../services/license-server';

export async function licenseRoutes(fastify: FastifyInstance) {
  // License validation endpoint
  fastify.post('/license/validate', async (request, reply) => {
    try {
      const validationRequest = request.body as LicenseValidationRequest;

      // Add client IP and user agent for security
      const clientInfo = {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        timestamp: new Date()
      };

      const result = await LicenseServer.validateLicense(validationRequest);

      // Log validation attempt
      console.log(`🔍 License validation: ${validationRequest.pluginId} - ${result.valid ? 'VALID' : 'INVALID'}`);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('License validation failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'License validation failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Usage reporting endpoint
  fastify.post('/license/usage', async (request, reply) => {
    try {
      const { pluginId, licenseKey, domain, action, metadata } = request.body as {
        pluginId: string;
        licenseKey: string;
        domain: string;
        action: string;
        metadata?: Record<string, any>;
      };

      await LicenseServer.reportUsage(pluginId, licenseKey, domain, action, metadata);

      return {
        success: true,
        message: 'Usage reported successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Usage reporting failed:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Usage reporting failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get usage statistics
  fastify.get('/license/:licenseKey/usage', async (request, reply) => {
    try {
      const { licenseKey } = request.params as { licenseKey: string };

      const stats = await LicenseServer.getUsageStats(licenseKey);

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to get usage stats:', error);
      return reply.status(404).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage statistics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin: Get all licenses
  fastify.get('/admin/licenses', async (request, reply) => {
    try {
      // In production, add admin authentication here
      const licenses = await LicenseServer.getAllLicenses();

      return {
        success: true,
        data: licenses,
        count: licenses.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to get licenses:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve licenses',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Generate license (simplified for testing)
  fastify.post('/license/generate', {
    schema: {
      tags: ['licenses'],
      summary: '生成许可证',
      description: '为指定插件生成许可证',
      body: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' },
          plan: { type: 'string', enum: ['starter', 'professional', 'enterprise'] }
        },
        required: ['pluginId', 'plan']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                licenseKey: { type: 'string' },
                pluginId: { type: 'string' },
                plan: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { pluginId, plan } = request.body as { pluginId: string; plan: string };

      // 简单的许可证生成（用于测试）
      const licenseKey = `${pluginId.toUpperCase()}-${plan.toUpperCase()}-${Date.now()}`;

      return {
        success: true,
        data: {
          licenseKey,
          pluginId,
          plan
        },
        message: 'License generated successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to generate license:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate license',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin: Generate new license
  fastify.post('/admin/licenses', async (request, reply) => {
    try {
      const {
        pluginId,
        customerId,
        plan,
        domains,
        features,
        expiresAt,
        usageLimit
      } = request.body as {
        pluginId: string;
        customerId: string;
        plan: 'starter' | 'professional' | 'enterprise';
        domains: string[];
        features: string[];
        expiresAt: string;
        usageLimit?: number;
      };

      const license = await LicenseServer.generateLicense(
        pluginId,
        customerId,
        plan,
        domains,
        features,
        new Date(expiresAt),
        usageLimit
      );

      return {
        success: true,
        data: license,
        message: 'License generated successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to generate license:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate license',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin: Revoke license
  fastify.delete('/admin/licenses/:licenseKey', async (request, reply) => {
    try {
      const { licenseKey } = request.params as { licenseKey: string };

      await LicenseServer.revokeLicense(licenseKey);

      return {
        success: true,
        message: 'License revoked successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to revoke license:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to revoke license',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin: Extend license
  fastify.patch('/admin/licenses/:licenseKey/extend', async (request, reply) => {
    try {
      const { licenseKey } = request.params as { licenseKey: string };
      const { additionalDays } = request.body as { additionalDays: number };

      await LicenseServer.extendLicense(licenseKey, additionalDays);

      return {
        success: true,
        message: `License extended by ${additionalDays} days`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to extend license:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to extend license',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check for license server
  fastify.get('/license/health', async (request, reply) => {
    try {
      const licenses = await LicenseServer.getAllLicenses();
      const activeLicenses = licenses.filter(l => l.status === 'active').length;
      const expiredLicenses = licenses.filter(l => l.status === 'expired').length;

      return {
        success: true,
        status: 'healthy',
        data: {
          totalLicenses: licenses.length,
          activeLicenses,
          expiredLicenses,
          serverTime: new Date().toISOString()
        }
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        status: 'unhealthy',
        error: 'License server health check failed'
      });
    }
  });

  // Commercial plugin catalog: Get available plugins
  fastify.get('/commercial/plugins', async (request, reply) => {
    try {
      // Mock plugin store data
      const plugins = [
        {
          id: 'wechat-pay-pro',
          name: 'WeChat Pay Pro',
          description: 'Complete WeChat payment integration with advanced features',
          category: 'payment',
          version: '2.1.0',
          pricing: {
            starter: { price: 29.99, features: ['basic_payments', 'webhooks'] },
            professional: { price: 49.99, features: ['basic_payments', 'webhooks', 'auto_reconciliation', 'refunds'] },
            enterprise: { price: 99.99, features: ['all_features', 'custom_integration', 'priority_support'] }
          },
          features: [
            'JSAPI payments',
            'Native QR payments',
            'H5 mobile payments',
            'Mini-program payments',
            'Automatic reconciliation',
            'Refund processing',
            'Real-time webhooks',
            'Transaction analytics'
          ],
          requirements: {
            jiffooVersion: '>=1.0.0',
            nodeVersion: '>=18.0.0'
          },
          documentation: 'https://docs.jiffoo.com/plugins/wechat-pay-pro',
          support: 'https://support.jiffoo.com/plugins/wechat-pay-pro'
        },
        {
          id: 'enterprise-auth',
          name: 'Enterprise Authentication',
          description: 'SAML, LDAP, SSO, and MFA for enterprise security',
          category: 'authentication',
          version: '1.5.0',
          pricing: {
            professional: { price: 79.99, features: ['saml', 'ldap', 'sso'] },
            enterprise: { price: 149.99, features: ['saml', 'ldap', 'sso', 'mfa', 'audit_logs', 'custom_providers'] }
          },
          features: [
            'SAML 2.0 integration',
            'LDAP/Active Directory',
            'Single Sign-On (SSO)',
            'Multi-Factor Authentication',
            'Audit logging',
            'Custom authentication providers',
            'Risk-based authentication',
            'Compliance reporting'
          ],
          requirements: {
            jiffooVersion: '>=1.0.0',
            nodeVersion: '>=18.0.0'
          },
          documentation: 'https://docs.jiffoo.com/plugins/enterprise-auth',
          support: 'https://support.jiffoo.com/plugins/enterprise-auth'
        },
        {
          id: 'email-marketing-pro',
          name: 'Email Marketing Pro',
          description: 'Advanced email marketing with automation and analytics',
          category: 'marketing',
          version: '3.2.0',
          pricing: {
            starter: { price: 19.99, features: ['campaigns', 'templates', 'basic_analytics'], usageLimit: 1000 },
            professional: { price: 49.99, features: ['campaigns', 'templates', 'automation', 'advanced_analytics'], usageLimit: 10000 },
            enterprise: { price: 99.99, features: ['all_features', 'custom_templates', 'dedicated_ip'], usageLimit: null }
          },
          features: [
            'Drag-and-drop campaign builder',
            'Professional email templates',
            'Marketing automation',
            'A/B testing',
            'Advanced analytics',
            'Customer segmentation',
            'Deliverability optimization',
            'CRM integration'
          ],
          requirements: {
            jiffooVersion: '>=1.0.0',
            nodeVersion: '>=18.0.0'
          },
          documentation: 'https://docs.jiffoo.com/plugins/email-marketing-pro',
          support: 'https://support.jiffoo.com/plugins/email-marketing-pro'
        }
      ];

      return {
        success: true,
        data: plugins,
        count: plugins.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      fastify.log.error('Failed to get plugins:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve plugins',
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('✅ License management routes registered');
}
