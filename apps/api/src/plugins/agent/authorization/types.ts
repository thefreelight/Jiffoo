/**
 * Agent Authorization Types
 * 
 * Type definitions for the agent variant authorization system.
 * Supports Self path (own mall sales) and Children path (delegation to sub-agents).
 */

// Owner types for authorization configs
export type OwnerType = 'TENANT' | 'AGENT';

// Self path configuration - controls "own mall" variant sales
export interface SelfVariantConfig {
  variantId: string;
  canSellSelf: boolean;
  selfPrice: number | null;
  effectivePrice: number; // Final calculated price after inheritance
  basePrice: number; // Original variant base price
  isInherited: boolean; // Whether this config is inherited from upstream
}

// Children path configuration - controls "delegation to sub-agents"
export interface ChildrenVariantConfig {
  variantId: string;
  canDelegateProduct: boolean; // Product-level delegation toggle
  canDelegateVariant: boolean; // Variant-level delegation toggle
  priceForChildren: number | null; // Cost price for children
  priceForChildrenMin: number | null; // Minimum selling price for children
  priceForChildrenMax: number | null; // Maximum selling price for children
  effectiveMinPrice: number | null; // Calculated minimum after inheritance
  isInherited: boolean;
}

// Options for fetching Self configs
export interface GetSelfVariantConfigOptions {
  tenantId: number;
  ownerType: OwnerType;
  ownerId: string;
  productId?: string; // Optional: filter by specific product
}

// Options for fetching Children configs
export interface GetChildrenVariantConfigOptions {
  tenantId: number;
  ownerType: OwnerType;
  ownerId: string;
  productId?: string;
}

// Agent chain item for upstream traversal
export interface AgentChainItem {
  id: string;
  level: number;
  parentAgentId: string | null;
}

// Variant info from database
export interface VariantInfo {
  id: string;
  productId: string;
  name: string;
  basePrice: number;
  isActive: boolean;
  agentCanDelegate: boolean;
  product: {
    id: string;
    name: string;
    agentCanDelegate: boolean;
  };
}

// Self config update request
export interface UpdateSelfConfigRequest {
  canSellSelf?: boolean;
  selfPrice?: number | null;
}

// Children config update request - product level
export interface UpdateChildrenProductConfigRequest {
  canDelegateProduct?: boolean;
}

// Children config update request - variant level
export interface UpdateChildrenVariantConfigRequest {
  canDelegateVariant?: boolean;
  priceForChildren?: number | null;
  priceForChildrenMin?: number | null;
  priceForChildrenMax?: number | null;
}

// Authorization check result for order validation
export interface OrderItemAuthorizationResult {
  variantId: string;
  productId: string;
  isAuthorized: boolean;
  effectivePrice: number;
  reason?: string; // Reason for denial if not authorized
}

// Batch order validation result
export interface OrderAuthorizationResult {
  isValid: boolean;
  authorizedItems: OrderItemAuthorizationResult[];
  deniedItems: OrderItemAuthorizationResult[];
  calculatedTotal: number;
}

