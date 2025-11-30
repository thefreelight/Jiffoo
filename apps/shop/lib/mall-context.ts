/**
 * Mall Context Manager
 * Handles tenant identification and context loading for the mall frontend
 * 
 * This module is responsible for:
 * 1. Detecting tenant from domain/subdomain/query parameters
 * 2. Fetching tenant context from backend API
 * 3. Storing tenant information for use in authentication and API calls
 */

import { TenantManager } from './tenant';
import type { ThemeConfig } from 'shared/src/types/theme';

/**
 * 主题信息
 * 
 * 字段说明：
 * - slug: 主题包在前端 THEME_REGISTRY 中的 key（如 "default"）
 * - config: 租户级主题配置，结构遵循 ThemeConfig 接口
 * - version: 主题版本，与前端主题包版本保持一致
 * - pluginSlug: 对应的后端插件 slug（如 "shop-theme-default"），前端暂不使用
 */
export interface ThemeInfo {
  slug: string;
  config?: ThemeConfig;
  version?: string;
  pluginSlug?: string;
}

/**
 * Agent Mall 上下文信息
 * 当访问代理商城时，包含代理的详细信息
 */
export interface AgentMallInfo {
  agentId: string;
  agentCode: string;
  agentName: string;
  agentLevel: number;
  /** Agent 自定义主题（覆盖租户主题） */
  theme: Record<string, unknown> | null;
  /** Agent 自定义设置（覆盖租户设置） */
  settings: Record<string, unknown> | null;
}

export interface MallContext {
  tenantId: string;
  tenantName: string;
  subdomain: string | null;
  domain: string | null;
  logo: string | null;
  theme: ThemeInfo | null;
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

  // 🆕 Agent Mall 相关字段
  /**
   * 是否为 Agent Mall（代理商城）
   * true 表示当前访问的是某个 Agent 的商城
   */
  isAgentMall?: boolean;
  /**
   * Agent 信息（仅当 isAgentMall=true 时有值）
   */
  agent?: AgentMallInfo;

  // 🆕 便捷访问字段（从 agent 对象提取）
  /** Agent ID（仅当 isAgentMall=true 时有值） */
  agentId?: string;
  /** Agent 代码（仅当 isAgentMall=true 时有值） */
  agentCode?: string;
  /** Agent 名称（仅当 isAgentMall=true 时有值） */
  agentName?: string;
}

/**
 * 识别结果类型
 */
export interface TenantIdentifier {
  type: 'domain' | 'query' | null;
  value: string | null;
  /**
   * 🆕 Agent ID（可选），从 ?agent= 参数获取
   */
  agentId?: string | null;
}

/**
 * Detect tenant identifier from current URL
 * Priority:
 * 1. Custom domain (not containing main domain)
 * 2. Query parameter ?tenant=xxx (numeric only)
 *
 * 🆕 同时解析 ?agent= 参数用于 Agent Mall 场景
 */
export function detectTenantIdentifier(): TenantIdentifier {
  if (typeof window === 'undefined') {
    return { type: null, value: null, agentId: null };
  }

  const hostname = window.location.hostname;
  const mainDomain = process.env.NEXT_PUBLIC_PLATFORM_MAIN_DOMAIN;
  const searchParams = new URLSearchParams(window.location.search);

  // 🆕 解析 agent 参数
  const agentParam = searchParams.get('agent');

  // Priority 1: Custom domain (not our main domain)
  if (mainDomain && !hostname.includes(mainDomain) && hostname !== 'localhost') {
    return { type: 'domain', value: hostname, agentId: agentParam };
  }

  // Priority 2: Query parameter (numeric tenant ID only)
  const tenantParam = searchParams.get('tenant');
  if (tenantParam && /^\d+$/.test(tenantParam)) {
    return { type: 'query', value: tenantParam, agentId: agentParam };
  }

  return { type: null, value: null, agentId: agentParam };
}

/**
 * Fetch mall context from backend API
 *
 * 🆕 简化返回结构：移除 shouldRedirect，后端不再返回 redirect 字段
 * 🆕 支持 agentId 参数用于 Agent Mall 场景
 */
export async function fetchMallContext(identifier: TenantIdentifier): Promise<{ context: MallContext | null; error?: string }> {
  if (!identifier.type || !identifier.value) {
    return { context: null, error: 'No identifier provided' };
  }

  try {
    // Import mallContextApi dynamically to avoid circular dependency
    const { mallContextApi } = await import('./api');

    const params: Record<string, string> = {};

    // Map identifier type to API parameter
    switch (identifier.type) {
      case 'domain':
        params.domain = identifier.value;
        break;
      case 'query':
        params.tenant = identifier.value;
        break;
    }

    // 🆕 传递 agent 参数
    if (identifier.agentId) {
      params.agent = identifier.agentId;
    }

    const response = await mallContextApi.getContext(params);

    if (response.success && response.data) {
      const data = response.data;

      // 🆕 将后端返回的 agent 对象展开为便捷访问字段
      const context: MallContext = {
        ...data,
        theme: data.theme as ThemeInfo | null,
        // 便捷访问字段
        agentId: data.agent?.agentId,
        agentCode: data.agent?.agentCode,
        agentName: data.agent?.agentName,
      };

      return { context };
    }

    // Handle "Store not found" or any other error
    return {
      context: null,
      error: response.error || response.message || 'Store not found'
    };
  } catch (error) {
    console.error('Failed to fetch mall context:', error);
    return { context: null, error: 'Network error' };
  }
}

/**
 * Clear mall context
 */
export function clearMallContext(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    TenantManager.clearTenantInfo();
  } catch (error) {
    console.error('Failed to clear mall context:', error);
  }
}

/**
 * Initialize mall context
 * This should be called when the app starts
 *
 * Returns the mall context or redirects to store-not-found page
 *
 * 🆕 主域名访问规则：
 * - 主域名必须通过 ?tenant=<id> 访问
 * - 没有 tenant 参数时直接跳转到 store-not-found，不再 fallback 到 tenant=1
 */
export async function initializeMallContext(): Promise<MallContext | null> {
  // Detect tenant from URL
  const identifier = detectTenantIdentifier();

  // 🆕 If no identifier found, redirect to store-not-found (不再 fallback 到 tenant=1)
  // 主域名必须明确指定 tenant 参数
  if (!identifier.type || !identifier.value) {
    if (typeof window !== 'undefined') {
      // 记录当前域名信息用于调试
      const hostname = window.location.hostname;
      window.location.href = `/store-not-found?domain=${encodeURIComponent(hostname)}`;
    }
    return null;
  }

  // Fetch context from backend
  const result = await fetchMallContext(identifier);

  // 🆕 移除 shouldRedirect 处理 - 后端不再返回 redirect 字段

  // Handle "Store not found" or any error
  if (result.error || !result.context) {
    if (typeof window !== 'undefined') {
      const redirectParams = new URLSearchParams();

      if (identifier.type === 'query' && identifier.value) {
        redirectParams.set('tenant', identifier.value);
      }
      if (identifier.type === 'domain' && identifier.value) {
        redirectParams.set('domain', identifier.value);
      }

      window.location.href = `/store-not-found?${redirectParams.toString()}`;
    }
    return null;
  }

  if (result.context) {
    // Update TenantManager
    TenantManager.setCurrentTenantInfo({
      id: result.context.tenantId,
      name: result.context.tenantName,
      settings: result.context.settings || {}
    });

    return result.context;
  }

  return null;
}

