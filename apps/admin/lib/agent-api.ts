/**
 * Agent Management API Client for Tenant Admin
 *
 * 租户管理员使用的代理管理API客户端
 * 对接后端Agent插件的租户维度API
 *
 * 注意：所有API调用需要传入tenantId参数，从useAuthStore获取
 * 使用示例：
 * const { tenantInfo } = useAuthStore();
 * const tenantId = parseInt(tenantInfo?.id || '0');
 * agentAdminApi.getAgents(tenantId, { level: 1 });
 */

import { apiClient } from './api';
import type { ApiResponse } from './types';

// ============================================
// 类型定义
// ============================================

export interface Agent {
  id: string;
  tenantId: number;
  userId: string;
  code: string;
  name: string;
  level: number;
  parentAgentId: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  invitedByTenantId: number | null;
  invitedByAgentId: string | null;
  notes: string | null;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  availableBalance: number;
  pendingBalance: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    username: string;
    avatar?: string;
  };
  parentAgent?: {
    id: string;
    name: string;
    code: string;
    level?: number;
  };
  childAgents?: Agent[];
  _count?: {
    childAgents: number;
    orders: number;
    productAuthorizations?: number;
  };
}

export interface AgentLevelConfig {
  id: string;
  tenantId: number;
  level: number;
  commissionRate: number;
  maxAgentsPerParent: number;
  maxProducts: number | null;
  l1ShareRate: number | null;
  l2ShareRate: number | null;
  l3ShareRate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCommission {
  id: string;
  tenantId: number;
  agentId: string;
  orderId: string;
  buyerId: string;
  agentLevel: number;
  sourceAgentId: string | null;
  orderAmount: number;
  rate: number;
  amount: number;
  status: 'PENDING' | 'SETTLED' | 'PAID' | 'REFUNDED';
  settleAt: string;
  settledAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agent?: {
    id: string;
    name: string;
    code: string;
    level: number;
  };
  order?: {
    id: string;
    totalAmount: number;
    createdAt: string;
  };
}

export interface AgentStats {
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  availableBalance: number;
  pendingBalance: number;
  recentOrders: number;
  recentSales: number;
}

export interface CreateAgentRequest {
  userId: string;
  name: string;
  level: number;
  parentAgentId?: string;
  notes?: string;
}

export interface UpdateLevelConfigRequest {
  commissionRate: number;
  maxAgentsPerParent?: number;
  maxProducts?: number | null;
  l1ShareRate?: number | null;
  l2ShareRate?: number | null;
  l3ShareRate?: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Agent管理API客户端
// ============================================

export const agentAdminApi = {
  /**
   * 创建代理
   */
  createAgent: (tenantId: number, data: CreateAgentRequest): Promise<ApiResponse<Agent>> =>
    apiClient.post(`/plugins/agent/api/tenants/${tenantId}/agents`, data),

  /**
   * 获取代理列表
   */
  getAgents: (tenantId: number, params?: {
    level?: number;
    status?: string;
    tree?: boolean;
  }): Promise<ApiResponse<Agent[]>> =>
    apiClient.get(`/plugins/agent/api/tenants/${tenantId}/agents`, { params }),

  /**
   * 获取代理详情
   */
  getAgent: (tenantId: number, agentId: string): Promise<ApiResponse<Agent>> =>
    apiClient.get(`/plugins/agent/api/tenants/${tenantId}/agents/${agentId}`),

  /**
   * 更新代理状态
   */
  updateAgentStatus: (tenantId: number, agentId: string, status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED'): Promise<ApiResponse<Agent>> =>
    apiClient.put(`/plugins/agent/api/tenants/${tenantId}/agents/${agentId}/status`, { status }),

  /**
   * 获取代理业绩统计
   */
  getAgentStats: (tenantId: number, agentId: string): Promise<ApiResponse<AgentStats>> =>
    apiClient.get(`/plugins/agent/api/tenants/${tenantId}/agents/${agentId}/stats`),

  /**
   * 获取代理等级配置
   */
  getLevelConfigs: (tenantId: number): Promise<ApiResponse<AgentLevelConfig[]>> =>
    apiClient.get(`/plugins/agent/api/tenants/${tenantId}/levels`),

  /**
   * 更新代理等级配置
   */
  updateLevelConfig: (tenantId: number, level: number, data: UpdateLevelConfigRequest): Promise<ApiResponse<AgentLevelConfig>> =>
    apiClient.put(`/plugins/agent/api/tenants/${tenantId}/levels/${level}`, data),

  /**
   * 获取租户的代理佣金列表
   */
  getCommissions: (tenantId: number, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResponse<AgentCommission>>> =>
    apiClient.get(`/plugins/agent/api/tenants/${tenantId}/commissions`, { params }),

  // ============================================
  // 代理域名管理（租户维度）
  // ============================================

  /**
   * 获取代理域名列表
   */
  getAgentDomains: (tenantId: number, agentId: string): Promise<ApiResponse<AgentDomain[]>> =>
    apiClient.get(`/plugins/agent/api/agents/${agentId}/domains`),

  /**
   * 添加代理域名
   */
  addAgentDomain: (tenantId: number, agentId: string, data: { host: string; isPrimary?: boolean }): Promise<ApiResponse<AgentDomain>> =>
    apiClient.post(`/plugins/agent/api/agents/${agentId}/domains`, data),

  /**
   * 删除代理域名
   */
  deleteAgentDomain: (tenantId: number, agentId: string, domainId: string): Promise<ApiResponse<{ success: boolean }>> =>
    apiClient.delete(`/plugins/agent/api/agents/${agentId}/domains/${domainId}`),

  // ============================================
  // BYOK配置（租户维度查看）
  // ============================================

  /**
   * 获取代理BYOK配置
   */
  getAgentByokConfig: (tenantId: number, agentId: string): Promise<ApiResponse<{
    agentId: string;
    tenantId: number;
    tenantName: string;
    byokConfig: {
      stripeAccountId?: string;
      paymentMethods?: string[];
      enabledAt?: string;
      notes?: string;
    } | null;
    byokEnabled: boolean;
    message: string;
  }>> =>
    apiClient.get(`/plugins/agent/api/agents/${agentId}/byok-config`),

  // ============================================
  // 🆕 变体授权配置API（Self路径 + Children路径）
  // ============================================

  /**
   * 获取商品下所有变体的Self配置（自己商城可售性和价格）
   */
  getSelfVariantConfigs: (productId: string, params?: {
    ownerType?: 'TENANT' | 'AGENT';
    ownerId?: string;
  }): Promise<ApiResponse<SelfVariantConfig[]>> =>
    apiClient.get(`/plugins/agent/api/self/products/${productId}/variants`, { params }),

  /**
   * 更新变体的Self配置
   */
  updateSelfVariantConfig: (variantId: string, data: {
    canSellSelf?: boolean;
    selfPrice?: number | null;
    ownerType?: 'TENANT' | 'AGENT';
    ownerId?: string;
  }): Promise<ApiResponse<SelfVariantConfig>> =>
    apiClient.put(`/plugins/agent/api/self/variants/${variantId}`, data),

  /**
   * 获取商品下所有变体的Children配置（给下级代理的授权和价格）
   */
  getChildrenVariantConfigs: (productId: string, params?: {
    ownerType?: 'TENANT' | 'AGENT';
    ownerId?: string;
  }): Promise<ApiResponse<ChildrenVariantConfig[]>> =>
    apiClient.get(`/plugins/agent/api/children/products/${productId}/variants`, { params }),

  /**
   * 更新商品级Children配置
   */
  updateChildrenProductConfig: (productId: string, data: {
    canDelegateProduct?: boolean;
    ownerType?: 'TENANT' | 'AGENT';
    ownerId?: string;
  }): Promise<ApiResponse<ChildrenProductConfig>> =>
    apiClient.put(`/plugins/agent/api/children/products/${productId}`, data),

  /**
   * 更新变体级Children配置
   */
  updateChildrenVariantConfig: (variantId: string, data: {
    canDelegateVariant?: boolean;
    priceForChildren?: number | null;
    priceForChildrenMin?: number | null;
    priceForChildrenMax?: number | null;
    ownerType?: 'TENANT' | 'AGENT';
    ownerId?: string;
  }): Promise<ApiResponse<ChildrenVariantConfig>> =>
    apiClient.put(`/plugins/agent/api/children/variants/${variantId}`, data),
};

// 代理域名类型
export interface AgentDomain {
  id: string;
  agentId: string;
  tenantId: number;
  host: string;
  isPrimary: boolean;
  sslConfigured: boolean;
  dnsVerified: boolean;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 🆕 Self路径配置类型
export interface SelfVariantConfig {
  variantId: string;
  variantName?: string;
  productName?: string;
  basePrice?: number;
  canSellSelf: boolean;
  selfPrice: number | null;
  effectivePrice: number;
  isInherited: boolean;
}

// 🆕 Children路径配置类型
export interface ChildrenVariantConfig {
  variantId: string;
  variantName?: string;
  productName?: string;
  basePrice?: number;
  productAgentCanDelegate?: boolean;
  variantAgentCanDelegate?: boolean;
  canDelegateProduct: boolean;
  canDelegateVariant: boolean;
  priceForChildren: number | null;
  priceForChildrenMin: number | null;
  priceForChildrenMax: number | null;
  effectiveMinPrice: number;
  isInherited: boolean;
}

// 🆕 Children商品级配置类型
export interface ChildrenProductConfig {
  id: string;
  productId: string;
  canDelegateProduct: boolean;
}

