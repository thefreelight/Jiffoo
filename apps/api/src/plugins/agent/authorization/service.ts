/**
 * Agent Authorization Service
 * 
 * Core business logic for the three-level agent authorization system.
 * Handles Self path (own mall sales) and Children path (delegation to sub-agents).
 * Computes effective pricing and authorization through inheritance chain.
 */

import { prisma } from '@/config/database';
import {
  OwnerType,
  SelfVariantConfig,
  ChildrenVariantConfig,
  GetSelfVariantConfigOptions,
  GetChildrenVariantConfigOptions,
  AgentChainItem,
  VariantInfo,
  OrderItemAuthorizationResult,
  OrderAuthorizationResult
} from './types';

/**
 * Get the upstream chain for an agent (agent -> parent -> ... -> tenant)
 */
async function getUpstreamChain(
  ownerType: OwnerType,
  ownerId: string,
  tenantId: number
): Promise<AgentChainItem[]> {
  const chain: AgentChainItem[] = [];
  
  if (ownerType === 'TENANT') {
    // Tenant is the root, no upstream
    return chain;
  }
  
  // Start from the agent and traverse up
  let currentId: string | null = ownerId;
  
  while (currentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: currentId },
      select: { id: true, level: true, parentAgentId: true }
    });
    
    if (!agent) break;
    chain.push({
      id: agent.id,
      level: agent.level,
      parentAgentId: agent.parentAgentId
    });
    currentId = agent.parentAgentId;
  }
  
  return chain;
}

/**
 * Get all variants for a tenant, optionally filtered by product
 */
async function getVariants(
  tenantId: number,
  productId?: string
): Promise<VariantInfo[]> {
  const where: any = {
    tenantId,
    isActive: true
  };
  
  if (productId) {
    where.productId = productId;
  }
  
  const variants = await prisma.productVariant.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          agentCanDelegate: true
        }
      }
    }
  });
  
  return variants.map(v => ({
    id: v.id,
    productId: v.productId,
    name: v.name,
    basePrice: v.basePrice,
    isActive: v.isActive,
    agentCanDelegate: v.agentCanDelegate,
    product: v.product
  }));
}

/**
 * Get Self path variant configurations
 * Computes effective price and authorization through the inheritance chain
 *
 * 🔑 核心业务逻辑：
 * - Self 可售集合 = 上游通过 Children 下发的变体集合 ∩ 本地 Self 设置
 * - 对于 Agent：必须先通过上游 Children 路径的授权检查
 * - selfPrice 不能低于上游 Children 路径的 effectiveMinPrice
 */
export async function getSelfVariantConfig(
  options: GetSelfVariantConfigOptions
): Promise<Map<string, SelfVariantConfig>> {
  const { tenantId, ownerType, ownerId, productId } = options;
  const result = new Map<string, SelfVariantConfig>();

  // 1. Get all relevant variants
  const variants = await getVariants(tenantId, productId);

  // 2. Get upstream chain (for agents)
  const upstreamChain = await getUpstreamChain(ownerType, ownerId, tenantId);

  // 3. 🆕 对于 Agent，必须先获取上游 Children 授权（Self 可售集合的前置约束）
  // Agent 的 Self 路径 = 直接上级的 Children 路径下发给它的授权
  let upstreamChildrenConstraints: Map<string, {
    canDelegate: boolean;
    effectiveMinPrice: number;
  }> = new Map();

  if (ownerType === 'AGENT' && upstreamChain.length > 0) {
    // 找到直接上级（可能是另一个 Agent 或 Tenant）
    const currentAgent = upstreamChain[0]; // 当前 Agent
    const parentAgentId = currentAgent.parentAgentId;

    let parentOwnerType: OwnerType;
    let parentOwnerId: string;

    if (parentAgentId) {
      // 上级是另一个 Agent
      parentOwnerType = 'AGENT';
      parentOwnerId = parentAgentId;
    } else {
      // 上级是 Tenant（L1 代理的情况）
      parentOwnerType = 'TENANT';
      parentOwnerId = tenantId.toString();
    }

    // 获取上级的 Children 配置
    const parentChildrenConfigs = await getChildrenVariantConfig({
      tenantId,
      ownerType: parentOwnerType,
      ownerId: parentOwnerId,
      productId
    });

    // 转换为约束 Map
    parentChildrenConfigs.forEach((config, variantId) => {
      upstreamChildrenConstraints.set(variantId, {
        canDelegate: config.canDelegateProduct && config.canDelegateVariant,
        effectiveMinPrice: config.effectiveMinPrice ?? variants.find(v => v.id === variantId)?.basePrice ?? 0
      });
    });
  }

  // 4. Get all Self configs for the owner
  const selfConfigs = await prisma.agentVariantSelfConfig.findMany({
    where: {
      tenantId,
      ownerType,
      ownerId,
      ...(productId ? { productId } : {})
    }
  });
  const selfConfigMap = new Map<string, typeof selfConfigs[0]>(selfConfigs.map(c => [c.variantId, c]));

  // 5. Compute effective config for each variant
  // 注意：不再加载 upstream Self configs，因为业务规则已变更：
  // Self 禁售只在本层生效，阻断下游由 Children 路径控制
  for (const variant of variants) {
    // Check product/variant level delegation toggles (base schema controls)
    if (!variant.product.agentCanDelegate || !variant.agentCanDelegate) {
      // Product or variant is not delegatable - only tenant can sell
      if (ownerType === 'AGENT') {
        result.set(variant.id, {
          variantId: variant.id,
          canSellSelf: false,
          selfPrice: null,
          effectivePrice: variant.basePrice,
          basePrice: variant.basePrice,
          isInherited: true
        });
        continue;
      }
    }

    // 🆕 对于 Agent，检查上游 Children 授权（核心约束）
    if (ownerType === 'AGENT') {
      const childrenConstraint = upstreamChildrenConstraints.get(variant.id);

      // 如果上游没有授权该变体给当前 Agent，则不可售
      if (!childrenConstraint || !childrenConstraint.canDelegate) {
        result.set(variant.id, {
          variantId: variant.id,
          canSellSelf: false,
          selfPrice: null,
          effectivePrice: variant.basePrice,
          basePrice: variant.basePrice,
          isInherited: true
        });
        continue;
      }
    }

    // Get owner's explicit config
    const ownConfig = selfConfigMap.get(variant.id);

    // Default to sellable with base price
    let canSellSelf = ownConfig?.canSellSelf ?? true;
    let selfPrice = ownConfig?.selfPrice ?? null;
    let effectivePrice = variant.basePrice;
    let isInherited = !ownConfig;

    // 🆕 重要业务规则变更：
    // Self 禁售只在本层生效，不再继承上游 Self 的禁售设置
    // 阻断下游只能通过 Children 路径（上面已检查 upstreamChildrenConstraints）
    //
    // 之前的错误逻辑（已移除）：
    // - 上游 Tenant Self canSellSelf=false → 下游 Agent 也被强制禁售
    //
    // 正确的业务逻辑：
    // - Tenant 自己不卖某 SKU（Self canSellSelf=false）
    // - 但 Tenant 可以通过 Children 授权给 Agent 卖
    // - Agent 能否卖由上游 Children 决定，不是由上游 Self 决定

    // Calculate effective price
    if (selfPrice !== null) {
      effectivePrice = selfPrice;
    }

    // 🆕 对于 Agent，确保 effectivePrice 不低于上游 Children 的 effectiveMinPrice
    if (ownerType === 'AGENT') {
      const childrenConstraint = upstreamChildrenConstraints.get(variant.id);
      if (childrenConstraint && effectivePrice < childrenConstraint.effectiveMinPrice) {
        effectivePrice = childrenConstraint.effectiveMinPrice;
      }
    }

    result.set(variant.id, {
      variantId: variant.id,
      canSellSelf,
      selfPrice,
      effectivePrice,
      basePrice: variant.basePrice,
      isInherited
    });
  }

  return result;
}

/**
 * Get Children path variant configurations
 * Computes delegation permissions and price constraints through inheritance
 */
export async function getChildrenVariantConfig(
  options: GetChildrenVariantConfigOptions
): Promise<Map<string, ChildrenVariantConfig>> {
  const { tenantId, ownerType, ownerId, productId } = options;
  const result = new Map<string, ChildrenVariantConfig>();

  // 1. Get all relevant variants
  const variants = await getVariants(tenantId, productId);

  // 2. Get upstream chain
  const upstreamChain = await getUpstreamChain(ownerType, ownerId, tenantId);

  // 3. Get owner's Children configs
  const childrenConfigs = await prisma.agentVariantChildrenConfig.findMany({
    where: {
      tenantId,
      ownerType,
      ownerId,
      ...(productId ? { productId } : {})
    }
  });

  // Separate product-level and variant-level configs
  const productConfigMap = new Map<string, any>();
  const variantConfigMap = new Map<string, any>();

  for (const config of childrenConfigs) {
    if (config.variantId === null) {
      productConfigMap.set(config.productId, config);
    } else {
      variantConfigMap.set(config.variantId, config);
    }
  }

  // 4. Get upstream Children configs for inheritance
  const upstreamChildrenConfigs: { productMap: Map<string, any>; variantMap: Map<string, any> }[] = [];

  // Tenant level
  const tenantChildrenConfigs = await prisma.agentVariantChildrenConfig.findMany({
    where: {
      tenantId,
      ownerType: 'TENANT',
      ownerId: tenantId.toString(),
      ...(productId ? { productId } : {})
    }
  });

  const tenantProductMap = new Map<string, any>();
  const tenantVariantMap = new Map<string, any>();
  for (const c of tenantChildrenConfigs) {
    if (c.variantId === null) {
      tenantProductMap.set(c.productId, c);
    } else {
      tenantVariantMap.set(c.variantId, c);
    }
  }
  upstreamChildrenConfigs.push({ productMap: tenantProductMap, variantMap: tenantVariantMap });

  // Upstream agents
  for (const agent of upstreamChain.reverse()) {
    const agentChildrenConfigs = await prisma.agentVariantChildrenConfig.findMany({
      where: {
        tenantId,
        ownerType: 'AGENT',
        ownerId: agent.id,
        ...(productId ? { productId } : {})
      }
    });

    const agentProductMap = new Map<string, any>();
    const agentVariantMap = new Map<string, any>();
    for (const c of agentChildrenConfigs) {
      if (c.variantId === null) {
        agentProductMap.set(c.productId, c);
      } else {
        agentVariantMap.set(c.variantId, c);
      }
    }
    upstreamChildrenConfigs.push({ productMap: agentProductMap, variantMap: agentVariantMap });
  }

  // 5. Compute effective config for each variant
  for (const variant of variants) {
    // Check base toggles
    if (!variant.product.agentCanDelegate || !variant.agentCanDelegate) {
      result.set(variant.id, {
        variantId: variant.id,
        canDelegateProduct: false,
        canDelegateVariant: false,
        priceForChildren: null,
        priceForChildrenMin: null,
        priceForChildrenMax: null,
        effectiveMinPrice: variant.basePrice,
        isInherited: true
      });
      continue;
    }

    // Get own configs
    const productConfig = productConfigMap.get(variant.productId);
    const variantConfig = variantConfigMap.get(variant.id);

    let canDelegateProduct = productConfig?.canDelegateProduct ?? true;
    let canDelegateVariant = variantConfig?.canDelegateVariant ?? true;
    let priceForChildren = variantConfig?.priceForChildren ?? null;
    let priceForChildrenMin = variantConfig?.priceForChildrenMin ?? null;
    let priceForChildrenMax = variantConfig?.priceForChildrenMax ?? null;
    let effectiveMinPrice: number | null = priceForChildrenMin;
    let isInherited = !variantConfig && !productConfig;

    // Apply upstream constraints
    for (const upstream of upstreamChildrenConfigs) {
      const upProductConfig = upstream.productMap.get(variant.productId);
      const upVariantConfig = upstream.variantMap.get(variant.id);

      // Product-level delegation
      if (upProductConfig?.canDelegateProduct === false) {
        canDelegateProduct = false;
        isInherited = true;
      }

      // Variant-level delegation
      if (upVariantConfig?.canDelegateVariant === false) {
        canDelegateVariant = false;
        isInherited = true;
      }

      // Price constraints - take the most restrictive
      if (upVariantConfig?.priceForChildrenMin !== null && upVariantConfig?.priceForChildrenMin !== undefined) {
        if (effectiveMinPrice === null || upVariantConfig.priceForChildrenMin > effectiveMinPrice) {
          effectiveMinPrice = upVariantConfig.priceForChildrenMin;
        }
      }
    }

    result.set(variant.id, {
      variantId: variant.id,
      canDelegateProduct,
      canDelegateVariant: canDelegateProduct && canDelegateVariant,
      priceForChildren,
      priceForChildrenMin,
      priceForChildrenMax,
      effectiveMinPrice: effectiveMinPrice ?? variant.basePrice,
      isInherited
    });
  }

  return result;
}

/**
 * Validate order items against authorization rules
 * Returns authorization status and effective prices for each item
 */
export async function validateOrderAuthorization(
  tenantId: number,
  ownerType: OwnerType,
  ownerId: string,
  items: Array<{ variantId: string; productId: string; quantity: number }>
): Promise<OrderAuthorizationResult> {
  const authorizedItems: OrderItemAuthorizationResult[] = [];
  const deniedItems: OrderItemAuthorizationResult[] = [];
  let calculatedTotal = 0;

  // Get unique product IDs
  const productIds = [...new Set(items.map(i => i.productId))];

  // Get Self configs for all relevant products
  const selfConfigsMap = new Map<string, SelfVariantConfig>();

  for (const productId of productIds) {
    const configs = await getSelfVariantConfig({
      tenantId,
      ownerType,
      ownerId,
      productId
    });

    configs.forEach((config, variantId) => {
      selfConfigsMap.set(variantId, config);
    });
  }

  // Validate each item
  for (const item of items) {
    const config = selfConfigsMap.get(item.variantId);

    if (!config) {
      deniedItems.push({
        variantId: item.variantId,
        productId: item.productId,
        isAuthorized: false,
        effectivePrice: 0,
        reason: 'Variant not found or not configured'
      });
      continue;
    }

    if (!config.canSellSelf) {
      deniedItems.push({
        variantId: item.variantId,
        productId: item.productId,
        isAuthorized: false,
        effectivePrice: config.effectivePrice,
        reason: 'Variant not authorized for sale in this mall'
      });
      continue;
    }

    authorizedItems.push({
      variantId: item.variantId,
      productId: item.productId,
      isAuthorized: true,
      effectivePrice: config.effectivePrice
    });

    calculatedTotal += config.effectivePrice * item.quantity;
  }

  return {
    isValid: deniedItems.length === 0,
    authorizedItems,
    deniedItems,
    calculatedTotal
  };
}

// Export authorization service as a module
export const AgentAuthorizationService = {
  getSelfVariantConfig,
  getChildrenVariantConfig,
  validateOrderAuthorization,
  getUpstreamChain
};
