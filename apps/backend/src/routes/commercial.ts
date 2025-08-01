import { FastifyInstance } from 'fastify';
import { commercialVerificationMiddleware } from '../middleware/commercial-verification';

/**
 * 商业服务 API 路由
 * 使用混淆保护的商业服务器地址 + 服务器端验证
 * 开源用户可以访问但无法修改服务器地址或绕过验证
 */

export default async function commercialRoutes(fastify: FastifyInstance) {

  // 注册商业服务验证中间件
  fastify.addHook('preHandler', commercialVerificationMiddleware);
  
  // 插件商店相关路由
  fastify.register(async function pluginRoutes(fastify) {
    
    // 浏览商业插件
    fastify.get('/plugins/browse', async (request, reply) => {
      try {
        // 动态导入混淆后的商业服务器配置
        const { pluginService } = require('../core/commercial-servers');
        const plugins = await pluginService.browsePlugins();

        // 添加客户端信息到响应
        const clientInfo = (request as any).commercialClient;

        reply.send({
          success: true,
          plugins: plugins,
          message: 'Plugins loaded successfully',
          clientType: clientInfo?.type || 'unknown'
        });
      } catch (error) {
        fastify.log.error('Browse plugins error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to load plugins'
        });
      }
    });

    // 购买插件
    fastify.post('/plugins/purchase', async (request, reply) => {
      try {
        const { pluginId, userEmail, paymentToken } = request.body as {
          pluginId: string;
          userEmail: string;
          paymentToken: string;
        };

        if (!pluginId || !userEmail || !paymentToken) {
          reply.status(400).send({
            success: false,
            error: 'Missing required parameters'
          });
          return;
        }

        const result = await pluginStoreService.purchasePlugin(pluginId, userEmail, paymentToken);
        
        if (result.success) {
          reply.send(result);
        } else {
          reply.status(400).send(result);
        }
      } catch (error) {
        fastify.log.error('Purchase plugin error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to purchase plugin'
        });
      }
    });

    // 下载插件
    fastify.post('/plugins/download', async (request, reply) => {
      try {
        const { pluginId, licenseKey } = request.body as {
          pluginId: string;
          licenseKey: string;
        };

        if (!pluginId || !licenseKey) {
          reply.status(400).send({
            success: false,
            error: 'Missing required parameters'
          });
          return;
        }

        const pluginData = await pluginStoreService.downloadPlugin(pluginId, licenseKey);
        
        if (!pluginData) {
          reply.status(404).send({
            success: false,
            error: 'Plugin not found or invalid license'
          });
          return;
        }

        reply.header('Content-Type', 'application/zip');
        reply.header('Content-Disposition', `attachment; filename="${pluginId}.zip"`);
        reply.send(pluginData);
      } catch (error) {
        fastify.log.error('Download plugin error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to download plugin'
        });
      }
    });

  });

  // SaaS 服务相关路由
  fastify.register(async function saasRoutes(fastify) {
    
    // 浏览 SaaS 服务
    fastify.get('/saas/services', async (request, reply) => {
      try {
        const services = await saasService.browseServices();
        
        reply.send({
          success: true,
          services: services,
          message: 'SaaS services loaded successfully'
        });
      } catch (error) {
        fastify.log.error('Browse SaaS services error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to load SaaS services'
        });
      }
    });

    // 订阅 SaaS 服务
    fastify.post('/saas/subscribe', async (request, reply) => {
      try {
        const { serviceId, planId, userEmail, paymentToken } = request.body as {
          serviceId: string;
          planId: string;
          userEmail: string;
          paymentToken: string;
        };

        if (!serviceId || !planId || !userEmail || !paymentToken) {
          reply.status(400).send({
            success: false,
            error: 'Missing required parameters'
          });
          return;
        }

        const result = await saasService.subscribe(serviceId, planId, userEmail, paymentToken);
        
        if (result.success) {
          reply.send(result);
        } else {
          reply.status(400).send(result);
        }
      } catch (error) {
        fastify.log.error('SaaS subscription error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to subscribe to SaaS service'
        });
      }
    });

  });

  // 许可证验证相关路由
  fastify.register(async function licenseRoutes(fastify) {
    
    // 验证许可证
    fastify.post('/license/validate', async (request, reply) => {
      try {
        const { licenseKey, pluginId } = request.body as {
          licenseKey: string;
          pluginId?: string;
        };

        if (!licenseKey) {
          reply.status(400).send({
            success: false,
            error: 'License key is required'
          });
          return;
        }

        const isValid = await licenseService.validateLicense(licenseKey, pluginId);
        
        reply.send({
          success: true,
          valid: isValid,
          message: isValid ? 'License is valid' : 'License is invalid'
        });
      } catch (error) {
        fastify.log.error('License validation error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to validate license'
        });
      }
    });

  });

  // 系统更新相关路由
  fastify.register(async function updateRoutes(fastify) {
    
    // 检查更新
    fastify.get('/updates/check', async (request, reply) => {
      try {
        const updateInfo = await updateService.checkForUpdates();
        
        reply.send({
          success: true,
          ...updateInfo
        });
      } catch (error) {
        fastify.log.error('Check updates error:', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to check for updates'
        });
      }
    });

  });

  // 健康检查
  fastify.get('/health', async (request, reply) => {
    reply.send({
      success: true,
      message: 'Commercial services are available',
      timestamp: new Date().toISOString(),
      clientType: process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource'
    });
  });

}
