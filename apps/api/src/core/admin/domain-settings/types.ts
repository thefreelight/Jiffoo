import { z } from 'zod';

/**
 * 域名配置类型定义
 * 租户管理员可以配置自定义域名和子域名
 */

// 域名验证正则
const DOMAIN_REGEX = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

// 更新域名配置Schema
export const UpdateDomainSettingsSchema = z.object({
  domain: z.string()
    .regex(DOMAIN_REGEX, 'Invalid domain format (e.g., example.com)')
    .optional()
    .nullable(),
  subdomain: z.string()
    .regex(SUBDOMAIN_REGEX, 'Invalid subdomain format (lowercase letters, numbers, and hyphens only)')
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .optional()
    .nullable(),
});

export type UpdateDomainSettingsRequest = z.infer<typeof UpdateDomainSettingsSchema>;

// DNS 记录类型
export interface DnsRecord {
  type: 'A' | 'CNAME';
  host: string;
  value: string;
  ttl: number;
}

// 域名配置响应
export interface DomainSettingsResponse {
  success: boolean;
  data?: {
    tenantId: string;
    companyName: string;
    domain: string | null;
    subdomain: string | null;
    domainStatus: 'not_configured' | 'pending_dns' | 'active';
    accessUrls: {
      frontend?: { custom?: string; subdomain?: string; platform?: string; fallback?: string };
      admin?: { custom?: string; platform?: string };
      api?: { custom?: string; platform?: string };
      // 兼容旧结构
      customDomain?: string;
      subdomain?: string;
      fallback?: string;
    };
    dnsInstructions?: {
      frontend?: DnsRecord;
      admin?: DnsRecord;
      api?: DnsRecord;
    };
  };
  message?: string;
  error?: string;
}

// 域名验证响应
export interface DomainValidationResponse {
  success: boolean;
  available: boolean;
  message: string;
  suggestions?: string[];
}

// 域名状态检查响应
export interface DomainStatusResponse {
  success: boolean;
  data?: {
    domain: string;
    configured: boolean;
    dnsResolved: boolean;
    sslConfigured: boolean;
    status: 'not_configured' | 'pending_dns' | 'dns_resolved' | 'active' | 'error';
    message: string;
    nextSteps?: string[];
  };
  error?: string;
}

