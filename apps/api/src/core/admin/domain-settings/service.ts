import { prisma } from '@/config/database';
import { env } from '@/config/env';
import {
  UpdateDomainSettingsRequest,
  DomainSettingsResponse,
  DomainValidationResponse,
  DomainStatusResponse,
} from './types';

/**
 * 域名配置服务
 * 处理租户的域名和子域名配置
 *
 * 🆕 支持 TenantDomain 模型：
 * - 同步更新 Tenant.domain/subdomain 和 TenantDomain 表
 * - 提供 Admin/API 域名的示例 URL
 */
export class DomainSettingsService {
  /**
   * 获取当前租户的域名配置
   */
  static async getDomainSettings(tenantId: number): Promise<DomainSettingsResponse> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        companyName: true,
        domain: true,
        subdomain: true,
        status: true,
        domains: true, // 🆕 包含 TenantDomain 关系
      },
    });

    if (!tenant) {
      return {
        success: false,
        error: 'Tenant not found',
      };
    }

    // 确定域名状态
    let domainStatus: 'not_configured' | 'pending_dns' | 'active' = 'not_configured';
    if (tenant.domain) {
      // 🆕 检查 TenantDomain 表中的 DNS 验证状态
      const domainRecord = tenant.domains?.find(d => d.host === tenant.domain && d.appType === 'frontend');
      if (domainRecord?.dnsVerified) {
        domainStatus = 'active';
      } else {
        domainStatus = 'pending_dns';
      }
    }

    // 🆕 使用平台域名配置
    const platformMainDomain = env.PLATFORM_MAIN_DOMAIN;
    const platformFrontendDomain = env.PLATFORM_FRONTEND_DOMAIN;
    const platformAdminDomain = env.PLATFORM_ADMIN_DOMAIN;
    const platformApiDomain = env.PLATFORM_API_DOMAIN;

    // 构建访问URL（包含前台、后台、API）
    const accessUrls: any = {
      frontend: {
        platform: `https://${platformFrontendDomain}/?tenant=${tenant.id}`,
      },
      admin: {
        platform: `https://${platformAdminDomain}`,
      },
      api: {
        platform: `https://${platformApiDomain}`,
      },
    };

    if (tenant.domain) {
      accessUrls.frontend.custom = `https://${tenant.domain}`;
      accessUrls.admin.custom = `https://admin.${tenant.domain}`;
      accessUrls.api.custom = `https://api.${tenant.domain}`;
    }
    if (tenant.subdomain) {
      accessUrls.frontend.subdomain = `https://${tenant.subdomain}.${platformMainDomain}`;
    }
    accessUrls.frontend.fallback = `https://${platformFrontendDomain}/?tenant=${tenant.id}`;

    // DNS配置说明
    const dnsInstructions = tenant.domain ? {
      frontend: {
        type: 'CNAME' as const,
        host: tenant.domain,
        value: platformFrontendDomain,
        ttl: 3600,
      },
      admin: {
        type: 'CNAME' as const,
        host: `admin.${tenant.domain}`,
        value: platformAdminDomain,
        ttl: 3600,
      },
      api: {
        type: 'CNAME' as const,
        host: `api.${tenant.domain}`,
        value: platformApiDomain,
        ttl: 3600,
      },
    } : undefined;

    return {
      success: true,
      data: {
        tenantId: tenant.id.toString(),
        companyName: tenant.companyName,
        domain: tenant.domain,
        subdomain: tenant.subdomain,
        domainStatus,
        accessUrls,
        dnsInstructions,
      },
    };
  }

  /**
   * 更新域名配置
   * 🆕 同时同步 TenantDomain 表
   */
  static async updateDomainSettings(
    tenantId: number,
    data: UpdateDomainSettingsRequest
  ): Promise<DomainSettingsResponse> {
    // 1. 检查域名是否已被其他租户使用
    if (data.domain) {
      const existingDomain = await prisma.tenant.findFirst({
        where: {
          domain: data.domain,
          id: { not: tenantId },
        },
      });

      if (existingDomain) {
        return {
          success: false,
          error: 'Domain already in use',
          message: `The domain ${data.domain} is already configured for another tenant`,
        };
      }

      // 🆕 检查 TenantDomain 表
      const existingTenantDomain = await prisma.tenantDomain.findFirst({
        where: {
          host: data.domain,
          tenantId: { not: tenantId },
        },
      });

      if (existingTenantDomain) {
        return {
          success: false,
          error: 'Domain already in use',
          message: `The domain ${data.domain} is already configured for another tenant`,
        };
      }
    }

    // 2. 检查子域名是否已被其他租户使用
    if (data.subdomain) {
      const existingSubdomain = await prisma.tenant.findFirst({
        where: {
          subdomain: data.subdomain,
          id: { not: tenantId },
        },
      });

      if (existingSubdomain) {
        return {
          success: false,
          error: 'Subdomain already in use',
          message: `The subdomain ${data.subdomain} is already taken`,
        };
      }
    }

    // 3. 获取旧的域名配置
    const oldTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { domain: true, subdomain: true },
    });

    // 4. 更新租户配置
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        domain: data.domain || null,
        subdomain: data.subdomain || null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        companyName: true,
        domain: true,
        subdomain: true,
      },
    });

    // 🆕 5. 同步 TenantDomain 表
    await this.syncTenantDomains(tenantId, oldTenant?.domain, data.domain);

    // 6. 返回更新后的配置
    return this.getDomainSettings(updatedTenant.id);
  }

  /**
   * 🆕 同步 TenantDomain 表
   * 当域名变化时，更新对应的 TenantDomain 记录
   */
  private static async syncTenantDomains(
    tenantId: number,
    oldDomain: string | null | undefined,
    newDomain: string | null | undefined
  ): Promise<void> {
    // 如果旧域名存在，删除对应的 TenantDomain 记录
    if (oldDomain && oldDomain !== newDomain) {
      await prisma.tenantDomain.deleteMany({
        where: {
          tenantId,
          host: oldDomain,
          appType: 'frontend',
        },
      });
    }

    // 如果新域名存在，创建或更新对应的 TenantDomain 记录
    if (newDomain) {
      await prisma.tenantDomain.upsert({
        where: {
          host_appType: {
            host: newDomain,
            appType: 'frontend',
          },
        },
        update: {
          tenantId,
          isCustom: true,
          isPrimary: true,
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          host: newDomain,
          appType: 'frontend',
          isCustom: true,
          isPrimary: true,
        },
      });
    }
  }

  /**
   * 验证域名可用性
   */
  static async validateDomain(domain: string): Promise<DomainValidationResponse> {
    // 检查域名是否已被使用
    const existingTenant = await prisma.tenant.findFirst({
      where: { domain },
    });

    if (existingTenant) {
      return {
        success: true,
        available: false,
        message: 'This domain is already in use',
      };
    }

    // TODO: 可以添加更多验证逻辑
    // - 检查域名是否在黑名单中
    // - 检查域名是否符合公司政策
    // - 检查域名DNS是否可解析

    return {
      success: true,
      available: true,
      message: 'Domain is available',
    };
  }

  /**
   * 验证子域名可用性
   */
  static async validateSubdomain(subdomain: string): Promise<DomainValidationResponse> {
    // 保留的子域名列表
    const reservedSubdomains = [
      'www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost',
      'staging', 'dev', 'test', 'demo', 'support', 'help',
      'blog', 'shop', 'store', 'cdn', 'static', 'assets',
    ];

    if (reservedSubdomains.includes(subdomain.toLowerCase())) {
      return {
        success: true,
        available: false,
        message: 'This subdomain is reserved',
        suggestions: [`${subdomain}-shop`, `${subdomain}-store`, `my-${subdomain}`],
      };
    }

    // 检查子域名是否已被使用
    const existingTenant = await prisma.tenant.findFirst({
      where: { subdomain },
    });

    if (existingTenant) {
      return {
        success: true,
        available: false,
        message: 'This subdomain is already taken',
        suggestions: [`${subdomain}1`, `${subdomain}-shop`, `${subdomain}-store`],
      };
    }

    return {
      success: true,
      available: true,
      message: 'Subdomain is available',
    };
  }

  /**
   * 检查域名DNS配置状态
   */
  static async checkDomainStatus(domain: string): Promise<DomainStatusResponse> {
    // TODO: 实际项目中应该使用DNS查询库检查域名解析
    // 这里提供一个简化的实现

    const tenant = await prisma.tenant.findFirst({
      where: { domain },
    });

    if (!tenant) {
      return {
        success: false,
        error: 'Domain not configured',
      };
    }

    // 简化的状态检查
    // 实际应该检查：
    // 1. DNS A记录是否指向正确的IP
    // 2. SSL证书是否配置
    // 3. 域名是否可访问

    return {
      success: true,
      data: {
        domain,
        configured: true,
        dnsResolved: false, // TODO: 实际DNS检查
        sslConfigured: false, // TODO: 实际SSL检查
        status: 'pending_dns',
        message: 'Domain configured, waiting for DNS propagation',
        nextSteps: [
          'Configure DNS A record to point to server IP',
          'Wait for DNS propagation (may take up to 48 hours)',
          'Contact support to configure SSL certificate',
        ],
      },
    };
  }
}

