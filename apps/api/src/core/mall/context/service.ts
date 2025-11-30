import { prisma } from '@/config/database';
import { mallContextCache } from './cache';

/**
 * Mall Context Service
 * Provides tenant context information for mall frontend
 * Used before user authentication to identify which tenant the user is accessing
 *
 * Domain Resolution Strategy:
 * 1. First try AgentDomain table (agent mall with custom domain)
 * 2. Then try TenantDomain table (new model, supports multiple domains per tenant)
 * 3. Fallback to Tenant.domain field (legacy support)
 * 4. Use tenant ID from query parameter
 * 5. Use agent code from query parameter (e.g., ?agent=AG123456)
 *
 * Performance: Uses in-memory LRU cache with 60s TTL to reduce database load
 */

/**
 * Agent Mall Context - 代理商城上下文
 * 当访问代理商城时，除了租户信息外还包含代理信息
 */
export interface AgentMallContext {
  agentId: string;
  agentCode: string;
  agentName: string;
  agentLevel: number;
  /**
   * Agent-specific theme configuration
   * Overrides tenant theme when present
   */
  theme: Record<string, unknown> | null;
  /**
   * Agent-specific mall settings
   * Overrides tenant settings when present
   */
  settings: Record<string, unknown> | null;
}

export interface MallContextResponse {
  tenantId: string;
  tenantName: string;
  subdomain: string | null;
  domain: string | null;
  logo: string | null;
  /**
   * Theme information for the tenant.
   * Expected structure (unified schema):
   * {
   *   slug: string;              // Theme package key in frontend THEME_REGISTRY (e.g., "default")
   *   config?: ThemeConfig;      // Tenant-level theme configuration (brand, features, etc.)
   *   version?: string;          // Theme version (should match frontend theme package version)
   *   pluginSlug?: string;       // Backend plugin slug (e.g., "shop-theme-default")
   * }
   *
   * Frontend uses theme.slug to load the corresponding theme package from THEME_REGISTRY.
   * Frontend merges theme.config with the theme package's defaultConfig.
   */
  theme: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  status: string;
  /**
   * Default locale for the tenant.
   * Used as the initial language when no locale is specified in URL.
   * Default: 'en'
   */
  defaultLocale: string;
  /**
   * Supported locales for this tenant.
   * Frontend will only show language switcher options for these locales.
   * Default: ['en', 'zh-Hant']
   */
  supportedLocales: string[];
  /**
   * Agent mall context - present when accessing via agent domain or agent code
   * When present, frontend should use agent's theme/settings instead of tenant's
   */
  agent?: AgentMallContext;
  /**
   * Indicates whether this is an agent mall context
   */
  isAgentMall: boolean;
}

// Default locale settings
const DEFAULT_LOCALE = 'en';
const DEFAULT_SUPPORTED_LOCALES = ['en', 'zh-Hant'];

/**
 * Extract locale settings from tenant settings JSON
 * @param settings - Parsed tenant settings object
 * @returns Object with defaultLocale and supportedLocales
 */
function extractLocaleSettings(settings: Record<string, unknown> | null): {
  defaultLocale: string;
  supportedLocales: string[];
} {
  if (!settings) {
    return { defaultLocale: DEFAULT_LOCALE, supportedLocales: DEFAULT_SUPPORTED_LOCALES };
  }

  const defaultLocale = typeof settings.defaultLocale === 'string'
    ? settings.defaultLocale
    : DEFAULT_LOCALE;

  const supportedLocales = Array.isArray(settings.supportedLocales)
    ? settings.supportedLocales.filter((l): l is string => typeof l === 'string')
    : DEFAULT_SUPPORTED_LOCALES;

  return { defaultLocale, supportedLocales };
}

export class MallContextService {
  /**
   * Get mall context by domain (custom domain)
   * Resolution order:
   * 1. AgentDomain table (agent mall with custom domain)
   * 2. TenantDomain table (new model)
   * 3. Tenant.domain field (legacy fallback)
   */
  static async getContextByDomain(domain: string): Promise<MallContextResponse | null> {
    const cacheKey = `domain:${domain}`;

    // Check cache first
    const cached = mallContextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 🆕 Priority 0: Try AgentDomain table first (Agent Mall)
    const agentDomain = await prisma.agentDomain.findFirst({
      where: {
        host: domain,
        agent: {
          status: 'ACTIVE',
          tenant: {
            status: 'ACTIVE'
          }
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
            level: true,
            tenantId: true,
            mallConfig: true,
            tenant: {
              select: {
                id: true,
                companyName: true,
                subdomain: true,
                domain: true,
                logo: true,
                theme: true,
                settings: true,
                status: true,
              }
            }
          }
        }
      }
    });

    if (agentDomain) {
      const agent = agentDomain.agent;
      const tenant = agent.tenant;
      const parsedTenantSettings = tenant.settings ? JSON.parse(tenant.settings) : null;
      const localeSettings = extractLocaleSettings(parsedTenantSettings);

      // Parse agent mall config
      const agentTheme = agent.mallConfig?.themeConfig
        ? JSON.parse(agent.mallConfig.themeConfig)
        : null;
      const agentSettings = agent.mallConfig?.settings
        ? JSON.parse(agent.mallConfig.settings)
        : null;

      const response: MallContextResponse = {
        tenantId: tenant.id.toString(),
        tenantName: tenant.companyName,
        subdomain: tenant.subdomain,
        domain: tenant.domain,
        logo: tenant.logo,
        // Use agent theme if available, otherwise use tenant theme
        theme: agentTheme || (tenant.theme ? JSON.parse(tenant.theme) : null),
        // Merge agent settings with tenant settings
        settings: agentSettings ? { ...parsedTenantSettings, ...agentSettings } : parsedTenantSettings,
        status: tenant.status,
        defaultLocale: localeSettings.defaultLocale,
        supportedLocales: localeSettings.supportedLocales,
        isAgentMall: true,
        agent: {
          agentId: agent.id,
          agentCode: agent.code,
          agentName: agent.name,
          agentLevel: agent.level,
          theme: agentTheme,
          settings: agentSettings,
        }
      };

      // Cache the result
      mallContextCache.set(cacheKey, response);
      return response;
    }

    // 🆕 Priority 1: Try TenantDomain table first
    const tenantDomain = await prisma.tenantDomain.findFirst({
      where: {
        host: domain,
        appType: 'frontend',
        tenant: {
          status: 'ACTIVE'
        }
      },
      include: {
        tenant: {
          select: {
            id: true,
            companyName: true,
            subdomain: true,
            domain: true,
            logo: true,
            theme: true,
            settings: true,
            status: true,
          }
        }
      }
    });

    if (tenantDomain) {
      const tenant = tenantDomain.tenant;
      const parsedSettings = tenant.settings ? JSON.parse(tenant.settings) : null;
      const localeSettings = extractLocaleSettings(parsedSettings);
      const response: MallContextResponse = {
        tenantId: tenant.id.toString(),
        tenantName: tenant.companyName,
        subdomain: tenant.subdomain,
        domain: tenant.domain,
        logo: tenant.logo,
        theme: tenant.theme ? JSON.parse(tenant.theme) : null,
        settings: parsedSettings,
        status: tenant.status,
        defaultLocale: localeSettings.defaultLocale,
        supportedLocales: localeSettings.supportedLocales,
        isAgentMall: false,
      };

      // Cache the result
      mallContextCache.set(cacheKey, response);
      return response;
    }

    // 🔄 Priority 2: Fallback to legacy Tenant.domain field
    const tenant = await prisma.tenant.findFirst({
      where: {
        domain: domain,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        companyName: true,
        subdomain: true,
        domain: true,
        logo: true,
        theme: true,
        settings: true,
        status: true,
      }
    });

    if (!tenant) return null;

    const parsedSettings = tenant.settings ? JSON.parse(tenant.settings) : null;
    const localeSettings = extractLocaleSettings(parsedSettings);
    const response: MallContextResponse = {
      tenantId: tenant.id.toString(),
      tenantName: tenant.companyName,
      subdomain: tenant.subdomain,
      domain: tenant.domain,
      logo: tenant.logo,
      theme: tenant.theme ? JSON.parse(tenant.theme) : null,
      settings: parsedSettings,
      status: tenant.status,
      defaultLocale: localeSettings.defaultLocale,
      supportedLocales: localeSettings.supportedLocales,
      isAgentMall: false,
    };

    // Cache the result
    mallContextCache.set(cacheKey, response);

    return response;
  }

  /**
   * Get mall context by tenant ID
   * Priority 2: Query parameter (e.g., ?tenant=1)
   */
  static async getContextByTenantId(tenantId: number): Promise<MallContextResponse | null> {
    const cacheKey = `tenant:${tenantId}`;

    // Check cache first
    const cached = mallContextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: tenantId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        companyName: true,
        subdomain: true,
        domain: true,
        logo: true,
        theme: true,
        settings: true,
        status: true,
      }
    });

    if (!tenant) return null;

    const parsedSettings = tenant.settings ? JSON.parse(tenant.settings) : null;
    const localeSettings = extractLocaleSettings(parsedSettings);
    const response: MallContextResponse = {
      tenantId: tenant.id.toString(),
      tenantName: tenant.companyName,
      subdomain: tenant.subdomain,
      domain: tenant.domain,
      logo: tenant.logo,
      theme: tenant.theme ? JSON.parse(tenant.theme) : null,
      settings: parsedSettings,
      status: tenant.status,
      defaultLocale: localeSettings.defaultLocale,
      supportedLocales: localeSettings.supportedLocales,
      isAgentMall: false,
    };

    // Cache the result
    mallContextCache.set(cacheKey, response);

    return response;
  }

  /**
   * Get mall context by agent code
   * Used when accessing via ?agent=AG123456 query parameter
   */
  static async getContextByAgentCode(agentCode: string, tenantId?: number): Promise<MallContextResponse | null> {
    const cacheKey = `agent:${agentCode}:${tenantId || 'any'}`;

    // Check cache first
    const cached = mallContextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const whereClause: any = {
      code: agentCode,
      status: 'ACTIVE',
      tenant: {
        status: 'ACTIVE'
      }
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const agent = await prisma.agent.findFirst({
      where: whereClause,
      include: {
        mallConfig: true,
        tenant: {
          select: {
            id: true,
            companyName: true,
            subdomain: true,
            domain: true,
            logo: true,
            theme: true,
            settings: true,
            status: true,
          }
        }
      }
    });

    if (!agent) return null;

    const tenant = agent.tenant;
    const parsedTenantSettings = tenant.settings ? JSON.parse(tenant.settings) : null;
    const localeSettings = extractLocaleSettings(parsedTenantSettings);

    // Parse agent mall config
    const agentTheme = agent.mallConfig?.themeConfig
      ? JSON.parse(agent.mallConfig.themeConfig)
      : null;
    const agentSettings = agent.mallConfig?.settings
      ? JSON.parse(agent.mallConfig.settings)
      : null;

    const response: MallContextResponse = {
      tenantId: tenant.id.toString(),
      tenantName: tenant.companyName,
      subdomain: tenant.subdomain,
      domain: tenant.domain,
      logo: tenant.logo,
      // Use agent theme if available, otherwise use tenant theme
      theme: agentTheme || (tenant.theme ? JSON.parse(tenant.theme) : null),
      // Merge agent settings with tenant settings
      settings: agentSettings ? { ...parsedTenantSettings, ...agentSettings } : parsedTenantSettings,
      status: tenant.status,
      defaultLocale: localeSettings.defaultLocale,
      supportedLocales: localeSettings.supportedLocales,
      isAgentMall: true,
      agent: {
        agentId: agent.id,
        agentCode: agent.code,
        agentName: agent.name,
        agentLevel: agent.level,
        theme: agentTheme,
        settings: agentSettings,
      }
    };

    // Cache the result
    mallContextCache.set(cacheKey, response);

    return response;
  }

  /**
   * Get mall context by tenant identifier (only numeric ID)
   * Priority 3: Query parameter (e.g., ?tenant=1)
   */
  static async getContextByIdentifier(identifier: string): Promise<MallContextResponse | null> {
    // 只接受纯数字的租户ID
    if (!/^\d+$/.test(identifier)) {
      return null;
    }

    const tenantId = parseInt(identifier, 10);
    return await this.getContextByTenantId(tenantId);
  }

  /**
   * Get mall context with priority-based resolution
   * Tries multiple methods in order: agent code -> domain -> tenant ID
   */
  static async getContext(params: {
    domain?: string;
    tenant?: string;
    agent?: string;
  }): Promise<MallContextResponse | null> {
    // Priority 0: Agent code (e.g., ?agent=AG123456)
    if (params.agent) {
      const tenantId = params.tenant ? parseInt(params.tenant, 10) : undefined;
      const context = await this.getContextByAgentCode(params.agent, tenantId);
      if (context) return context;
    }

    // Priority 1: Custom domain (may resolve to agent domain or tenant domain)
    if (params.domain) {
      const context = await this.getContextByDomain(params.domain);
      if (context) return context;
    }

    // Priority 2: Tenant ID (query parameter)
    if (params.tenant) {
      const context = await this.getContextByIdentifier(params.tenant);
      if (context) return context;
    }

    return null;
  }

  /**
   * Get default tenant (ID=1) for root domain access
   */
  static async getDefaultTenant(): Promise<MallContextResponse | null> {
    return await this.getContextByTenantId(1);
  }
}

