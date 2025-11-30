/**
 * Email Gateway Service
 * 
 * 统一邮件网关服务，负责：
 * 1. 获取租户可用的邮件提供商
 * 2. 验证邮件插件的可用性
 * 3. 路由邮件请求到对应的插件
 * 4. 智能故障转移
 * 5. 模板渲染
 */

import { FastifyInstance } from 'fastify';
import { SendEmailRequest, SendEmailResponse, getEmailPluginInfo } from './types';

export class EmailGatewayService {
  /**
   * 获取租户可用的邮件提供商
   * 
   * 核心逻辑：
   * 1. 获取租户已安装的邮件插件
   * 2. 检查每个插件的许可证和邮件发送量限制
   * 3. 只返回完全可用的邮件提供商
   * 
   * @param fastify Fastify实例
   * @param tenantId 租户ID
   * @returns 可用的邮件提供商列表
   */
  static async getAvailableProviders(
    fastify: FastifyInstance,
    tenantId: number
  ) {
    try {
      // 1. 获取租户已安装的邮件插件
      const installations = await fastify.prisma.pluginInstallation.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          enabled: true,
          plugin: {
            category: 'email',
            status: 'ACTIVE'
          }
        },
        include: { plugin: true }
      });
      
      fastify.log.info(`Found ${installations.length} installed email plugins for tenant ${tenantId}`);
      
      // 2. 检查每个插件的可用性
      const availableProviders = [];
      
      for (const installation of installations) {
        const plugin = installation.plugin;
        
        // 检查许可证
        const licenseCheck = await (fastify as any).checkPluginLicense(
          tenantId,
          plugin.slug,
          'basic_email'
        );
        
        if (!licenseCheck.valid) {
          fastify.log.info(
            `Plugin ${plugin.slug} license invalid for tenant ${tenantId}: ${licenseCheck.reason}`
          );
          continue;
        }
        
        // 检查邮件发送量限制
        const emailCheck = await (fastify as any).checkUsageLimit(
          tenantId,
          plugin.slug,
          'emails_sent'
        );
        
        fastify.log.info(
          `🔍 [getAvailableProviders] Email check for ${plugin.slug}: ${JSON.stringify(emailCheck)}`
        );
        
        if (!emailCheck.allowed) {
          fastify.log.info(
            `Plugin ${plugin.slug} email limit exceeded for tenant ${tenantId}: ${emailCheck.current}/${emailCheck.limit}`
          );
          continue;
        }
        
        // 所有检查通过，添加到可用列表
        const pluginInfo = getEmailPluginInfo(plugin.slug);
        
        availableProviders.push({
          pluginSlug: plugin.slug,
          name: plugin.name,
          displayName: pluginInfo.displayName,
          icon: pluginInfo.icon,
          capabilities: pluginInfo.capabilities,
          current: emailCheck.current,
          limit: emailCheck.limit,
          percentage: emailCheck.percentage
        });
        
        fastify.log.info(`Plugin ${plugin.slug} is available for tenant ${tenantId}`);
      }
      
      // 3. 按固定顺序排序
      const order = ['resend', 'sendgrid', 'mailgun', 'aws-ses'];
      availableProviders.sort((a, b) => {
        const indexA = order.indexOf(a.pluginSlug);
        const indexB = order.indexOf(b.pluginSlug);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
      
      return availableProviders;
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get available email providers');
      throw error;
    }
  }

  /**
   * 发送邮件（智能路由 + 故障转移）
   * 
   * @param fastify Fastify实例
   * @param tenantId 租户ID
   * @param emailData 邮件数据
   * @returns 发送结果
   */
  static async sendEmail(
    fastify: FastifyInstance,
    tenantId: number,
    emailData: SendEmailRequest
  ): Promise<SendEmailResponse> {
    try {
      // 1. 获取可用的邮件提供商
      const providers = await this.getAvailableProviders(fastify, tenantId);
      
      if (providers.length === 0) {
        throw new Error('No email provider available');
      }
      
      // 2. 选择提供商
      let selectedProvider: string;
      
      if (emailData.provider) {
        // 用户指定了提供商
        const provider = providers.find(p => p.pluginSlug === emailData.provider);
        if (!provider) {
          throw new Error(`Provider ${emailData.provider} not available`);
        }
        selectedProvider = emailData.provider;
      } else {
        // 使用租户默认提供商
        const tenant = await fastify.prisma.tenant.findUnique({
          where: { id: tenantId }
        });
        
        selectedProvider = tenant?.defaultEmailProvider || providers[0].pluginSlug;
      }
      
      // 3. 如果使用模板，渲染模板
      if (emailData.templateSlug) {
        const template = await fastify.prisma.emailTemplate.findUnique({
          where: {
            tenantId_slug: {
              tenantId,
              slug: emailData.templateSlug
            }
          }
        });
        
        if (template && template.isActive) {
          // 渲染模板（简单的变量替换）
          emailData.subject = this.renderTemplate(template.subject, emailData.templateVariables || {});
          emailData.html = this.renderTemplate(template.html, emailData.templateVariables || {});
          emailData.text = template.text ? this.renderTemplate(template.text, emailData.templateVariables || {}) : undefined;
          
          // 使用模板的默认配置（如果有）
          if (template.fromName) emailData.fromName = template.fromName;
          if (template.fromEmail) emailData.from = template.fromEmail;
          if (template.replyTo) emailData.replyTo = template.replyTo;
        }
      }
      
      // 4. 调用插件发送邮件
      try {
        fastify.log.info(`Sending email via ${selectedProvider} for tenant ${tenantId}`);
        
        const response = await fastify.inject({
          method: 'POST',
          url: `/api/plugins/${selectedProvider}/api/send`,
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': tenantId.toString()
          },
          payload: emailData
        });
        
        if (response.statusCode !== 200) {
          throw new Error(`Provider ${selectedProvider} failed with status ${response.statusCode}`);
        }
        
        return JSON.parse(response.body);
      } catch (error) {
        fastify.log.error({ err: error }, `Primary provider ${selectedProvider} failed`);
        
        // 5. 故障转移：尝试其他提供商
        const tenant = await fastify.prisma.tenant.findUnique({
          where: { id: tenantId }
        });
        
        const emailSettings = tenant?.emailSettings 
          ? JSON.parse(tenant.emailSettings) 
          : {};
        
        if (emailSettings.enableAutoFallback) {
          const fallbackProviders = emailSettings.fallbackProviders || [];
          
          for (const fallbackSlug of fallbackProviders) {
            const fallbackProvider = providers.find(p => p.pluginSlug === fallbackSlug);
            if (!fallbackProvider || fallbackSlug === selectedProvider) continue;
            
            try {
              fastify.log.info(`Trying fallback provider: ${fallbackSlug}`);
              
              const response = await fastify.inject({
                method: 'POST',
                url: `/api/plugins/${fallbackSlug}/api/send`,
                headers: {
                  'content-type': 'application/json',
                  'x-tenant-id': tenantId.toString()
                },
                payload: emailData
              });
              
              if (response.statusCode === 200) {
                fastify.log.info(`✅ Fallback provider ${fallbackSlug} succeeded`);
                return JSON.parse(response.body);
              }
            } catch (fallbackError) {
              fastify.log.error({ err: fallbackError }, `Fallback provider ${fallbackSlug} failed`);
              continue;
            }
          }
        }
        
        throw new Error('All email providers failed');
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Email gateway error');
      throw error;
    }
  }

  /**
   * 简单的模板渲染（变量替换）
   */
  private static renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    return rendered;
  }
}

