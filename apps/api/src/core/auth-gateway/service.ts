/**
 * Auth Gateway Service
 * 
 * 统一认证网关服务，负责：
 * 1. 获取租户可用的认证方式
 * 2. 验证认证插件的可用性
 * 3. 路由认证请求到对应的插件
 */

import { FastifyInstance } from 'fastify';
import { AuthMethod, getAuthPluginInfo } from './types';

export class AuthGatewayService {
  /**
   * 获取租户可用的认证方式
   * 
   * 核心逻辑：
   * 1. 获取租户已安装的认证插件
   * 2. 检查每个插件的许可证和使用量限制
   * 3. 只返回完全可用的认证方式
   * 
   * @param fastify Fastify实例
   * @param tenantId 租户ID
   * @returns 可用的认证方式列表
   */
  static async getAvailableAuthMethods(
    fastify: FastifyInstance,
    tenantId: number
  ): Promise<AuthMethod[]> {
    try {
      // 1. 获取租户已安装的认证插件（OAuth和邮件插件）
      const installations = await fastify.prisma.pluginInstallation.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          enabled: true,
          plugin: {
            OR: [
              { category: 'authentication' },
              { category: 'email' }
            ],
            status: 'ACTIVE'
          }
        },
        include: { plugin: true }
      });

      fastify.log.info(`Found ${installations.length} installed auth plugins for tenant ${tenantId}`);

      // 2. 检查每个插件的可用性
      const availableMethods: AuthMethod[] = [];

      for (const installation of installations) {
        const plugin = installation.plugin;

        // 根据插件类型检查不同的功能
        let featureToCheck = 'basic_auth';
        if (plugin.category === 'email') {
          featureToCheck = 'basic_email';
        }

        // 检查许可证
        const licenseCheck = await (fastify as any).checkPluginLicense(
          tenantId,
          plugin.slug,
          featureToCheck
        );

        if (!licenseCheck.valid) {
          fastify.log.info(
            `Plugin ${plugin.slug} license invalid for tenant ${tenantId}: ${licenseCheck.reason}`
          );
          continue;
        }

        // 检查使用量限制
        let usageMetric = 'api_calls';
        if (plugin.category === 'email') {
          usageMetric = 'emails_sent';
        } else if (plugin.slug === 'google') {
          usageMetric = 'login_attempts';
        }

        const usageCheck = await (fastify as any).checkUsageLimit(
          tenantId,
          plugin.slug,
          usageMetric
        );

        fastify.log.info(
          `🔍 [getAvailableAuthMethods] Usage check for ${plugin.slug}: ${JSON.stringify(usageCheck)}`
        );

        if (!usageCheck.allowed) {
          fastify.log.info(
            `Plugin ${plugin.slug} usage limit exceeded for tenant ${tenantId}: ${usageCheck.current}/${usageCheck.limit}`
          );
          continue;
        }

        // 所有检查通过，添加到可用列表
        const pluginInfo = getAuthPluginInfo(plugin.slug);

        availableMethods.push({
          pluginSlug: plugin.slug,
          name: plugin.name,
          displayName: pluginInfo.displayName,
          icon: pluginInfo.icon,
          type: pluginInfo.type,
          capabilities: pluginInfo.capabilities
        });

        fastify.log.info(`Plugin ${plugin.slug} is available for tenant ${tenantId}`);
      }

      // 3. 按固定顺序排序（OAuth优先，然后是邮件/短信）
      const order = ['google', 'facebook', 'resend', 'twilio'];
      availableMethods.sort((a, b) => {
        const indexA = order.indexOf(a.pluginSlug);
        const indexB = order.indexOf(b.pluginSlug);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      fastify.log.info(
        `Available auth methods for tenant ${tenantId}: ${availableMethods.map(m => m.pluginSlug).join(', ')}`
      );

      return availableMethods;
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get available auth methods');
      throw error;
    }
  }
}

