import { FastifyInstance } from 'fastify';
import { PaymentMethod, getPluginInfo } from './types';

/**
 * Payment Gateway Service
 * 
 * 统一支付网关服务,负责:
 * 1. 获取租户可用的支付方式
 * 2. 验证支付插件的可用性
 * 3. 路由支付请求到对应的插件
 */
export class PaymentGatewayService {
  /**
   * 获取租户可用的支付方式
   * 
   * 核心逻辑:
   * 1. 获取租户已安装的支付插件
   * 2. 检查每个插件的许可证、API调用限制、交易次数限制
   * 3. 只返回完全可用的支付方式
   * 4. 不返回任何额度信息给终端用户
   * 
   * @param fastify Fastify实例
   * @param tenantId 租户ID
   * @returns 可用的支付方式列表
   */
  static async getAvailablePaymentMethods(
    fastify: FastifyInstance,
    tenantId: number
  ): Promise<PaymentMethod[]> {
    try {
      // 1. 获取租户已安装的支付插件
      const installations = await fastify.prisma.pluginInstallation.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          enabled: true,
          plugin: {
            category: 'payment',
            status: 'ACTIVE'
          }
        },
        include: { plugin: true }
      });

      fastify.log.info(`Found ${installations.length} installed payment plugins for tenant ${tenantId}`);

      // 2. 检查每个插件的可用性
      const availableMethods: PaymentMethod[] = [];

      for (const installation of installations) {
        const plugin = installation.plugin;

        // 检查许可证
        const licenseCheck = await (fastify as any).checkPluginLicense(
          tenantId,
          plugin.slug,
          'basic_payments'
        );

        if (!licenseCheck.valid) {
          fastify.log.info(
            `Plugin ${plugin.slug} license invalid for tenant ${tenantId}: ${licenseCheck.reason}`
          );
          continue; // 许可证无效,跳过
        }

        // 检查API调用限制
        const apiCallCheck = await (fastify as any).checkUsageLimit(
          tenantId,
          plugin.slug,
          'api_calls'
        );

        fastify.log.info(
          `🔍 [getAvailablePaymentMethods] API call check for ${plugin.slug}: ${JSON.stringify(apiCallCheck)}`
        );

        if (!apiCallCheck.allowed) {
          fastify.log.info(
            `Plugin ${plugin.slug} API call limit exceeded for tenant ${tenantId}: ${apiCallCheck.current}/${apiCallCheck.limit}`
          );
          continue; // API调用额度用完,跳过
        }

        // 检查交易次数限制
        const transactionCheck = await (fastify as any).checkUsageLimit(
          tenantId,
          plugin.slug,
          'transactions'
        );

        fastify.log.info(
          `🔍 [getAvailablePaymentMethods] Transaction check for ${plugin.slug}: ${JSON.stringify(transactionCheck)}`
        );

        if (!transactionCheck.allowed) {
          fastify.log.info(
            `Plugin ${plugin.slug} transaction limit exceeded for tenant ${tenantId}: ${transactionCheck.current}/${transactionCheck.limit}`
          );
          continue; // 交易次数用完,跳过
        }

        // 所有检查通过,添加到可用列表
        const pluginInfo = getPluginInfo(plugin.slug);

        availableMethods.push({
          pluginSlug: plugin.slug,
          name: plugin.name,
          displayName: pluginInfo.displayName,
          icon: pluginInfo.icon,
          supportedCurrencies: pluginInfo.supportedCurrencies
          // 🔒 不返回额度信息给终端用户!
        });

        fastify.log.info(`Plugin ${plugin.slug} is available for tenant ${tenantId}`);
      }

      // 3. 按固定顺序排序
      const order = ['stripe', 'paypal', 'alipay', 'wechat'];
      availableMethods.sort((a, b) => {
        const indexA = order.indexOf(a.pluginSlug);
        const indexB = order.indexOf(b.pluginSlug);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      fastify.log.info(
        `Available payment methods for tenant ${tenantId}: ${availableMethods.map(m => m.pluginSlug).join(', ')}`
      );

      return availableMethods;
    } catch (error) {
      fastify.log.error('Failed to get available payment methods:', error);
      throw error;
    }
  }

  /**
   * 验证支付方式是否可用
   * 
   * 在创建支付会话前再次验证,防止竞态条件
   * (用户在选择支付方式和提交之间,租户的额度可能用完)
   * 
   * @param fastify Fastify实例
   * @param tenantId 租户ID
   * @param paymentMethod 支付方式(插件slug)
   * @returns 验证结果
   */
  static async validatePaymentMethod(
    fastify: FastifyInstance,
    tenantId: number,
    paymentMethod: string
  ): Promise<{
    valid: boolean;
    reason?: string;
    message?: string;
  }> {
    try {
      // 1. 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: paymentMethod }
      });

      if (!plugin) {
        return {
          valid: false,
          reason: 'PLUGIN_NOT_FOUND',
          message: 'Invalid payment method'
        };
      }

      // 2. 检查插件是否已安装
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          pluginId: plugin.id,
          status: 'ACTIVE',
          enabled: true
        }
      });

      if (!installation) {
        return {
          valid: false,
          reason: 'PLUGIN_NOT_INSTALLED',
          message: 'This payment method is not installed or enabled'
        };
      }

      // 3. 检查许可证
      const licenseCheck = await (fastify as any).checkPluginLicense(
        tenantId,
        paymentMethod,
        'basic_payments'
      );

      if (!licenseCheck.valid) {
        return {
          valid: false,
          reason: 'LICENSE_INVALID',
          message: 'This payment method is currently unavailable. Please try another payment method or contact support.'
        };
      }

      // 4. 检查API调用限制
      const apiCallCheck = await (fastify as any).checkUsageLimit(
        tenantId,
        paymentMethod,
        'api_calls'
      );

      if (!apiCallCheck.allowed) {
        return {
          valid: false,
          reason: 'API_LIMIT_EXCEEDED',
          message: 'This payment method is currently unavailable. Please try another payment method or contact support.'
        };
      }

      // 5. 检查交易次数限制
      const transactionCheck = await (fastify as any).checkUsageLimit(
        tenantId,
        paymentMethod,
        'transactions'
      );

      if (!transactionCheck.allowed) {
        return {
          valid: false,
          reason: 'TRANSACTION_LIMIT_EXCEEDED',
          message: 'This payment method is currently unavailable. Please try another payment method or contact support.'
        };
      }

      return { valid: true };
    } catch (error) {
      fastify.log.error('Failed to validate payment method:', error);
      return {
        valid: false,
        reason: 'VALIDATION_ERROR',
        message: 'Failed to validate payment method'
      };
    }
  }
}

