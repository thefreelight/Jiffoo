import { z } from 'zod';

/**
 * Admin Plugin Management Type Definitions
 * 
 * This file contains all TypeScript types and Zod schemas for
 * plugin management operations in the Admin panel.
 */

// ============================================
// Request Schemas (Zod)
// ============================================

/**
 * Schema for installing a plugin
 */
export const InstallPluginSchema = z.object({
  planId: z.string().optional().describe('Subscription plan ID (required for subscription plugins)'),
  startTrial: z.boolean().default(true).describe('Whether to start trial period'),
  configData: z.record(z.any()).optional().describe('Initial plugin configuration')
});

/**
 * Schema for toggling plugin status
 */
export const TogglePluginSchema = z.object({
  enabled: z.boolean().describe('Whether to enable or disable the plugin')
});

/**
 * Schema for configuring a plugin
 */
export const ConfigurePluginSchema = z.object({
  configData: z.record(z.any()).describe('Plugin configuration data')
});

/**
 * Schema for marketplace query parameters
 */
export const MarketplaceQuerySchema = z.object({
  category: z.string().optional().describe('Filter by category'),
  businessModel: z.enum(['free', 'freemium', 'subscription', 'usage_based']).optional().describe('Filter by business model'),
  sortBy: z.enum(['name', 'rating', 'installCount', 'createdAt']).default('name').describe('Sort field'),
  sortOrder: z.enum(['asc', 'desc']).default('asc').describe('Sort order')
});

/**
 * Schema for installed plugins query parameters
 */
export const InstalledQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'TRIAL', 'EXPIRED']).optional().describe('Filter by status'),
  enabled: z.boolean().optional().describe('Filter by enabled status')
});

// ============================================
// TypeScript Types (Inferred from Zod)
// ============================================

export type InstallPluginRequest = z.infer<typeof InstallPluginSchema>;
export type TogglePluginRequest = z.infer<typeof TogglePluginSchema>;
export type ConfigurePluginRequest = z.infer<typeof ConfigurePluginSchema>;
export type MarketplaceQuery = z.infer<typeof MarketplaceQuerySchema>;
export type InstalledQuery = z.infer<typeof InstalledQuerySchema>;

// ============================================
// Response Types
// ============================================

/**
 * Subscription plan information
 */
export interface SubscriptionPlanInfo {
  id: string;
  planId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string;
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
}

/**
 * Plugin pricing information
 */
export interface PluginPricing {
  model: string;
  plans: SubscriptionPlanInfo[];
}

/**
 * Plugin marketplace item
 */
export interface PluginMarketplaceItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  iconUrl: string | null;
  screenshots: string[];
  businessModel: string;
  supportsSubscription: boolean;
  trialDays: number;
  version: string;
  developer: string;
  rating: number;
  installCount: number;
  subscriptionPlans: SubscriptionPlanInfo[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Installed plugin information
 */
export interface InstalledPluginInfo {
  id: string;
  plugin: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    category: string;
    iconUrl: string | null;
    businessModel: string;
    supportsSubscription: boolean;
    subscriptionPlans: SubscriptionPlanInfo[];
  };
  status: string;
  enabled: boolean;
  installedAt: Date;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  configData: Record<string, any> | null;
}

/**
 * Plugin installation result
 */
export interface PluginInstallationResult {
  success: boolean;
  installation?: {
    id: string;
    status: string;
    enabled: boolean;
    installedAt: Date;
    plugin: {
      id: string;
      name: string;
      slug: string;
      businessModel: string;
    };
  };
  requiresPayment?: boolean;
  checkoutUrl?: string;
  subscription?: any;
  requiresOAuth?: boolean;
  oauthUrl?: string;
  message: string;
}

/**
 * Plugin configuration data
 */
export interface PluginConfigData {
  pluginSlug: string;
  configData: Record<string, any> | null;
  configSchema?: Record<string, any>;
}

/**
 * Plugin toggle result
 */
export interface PluginToggleResult {
  success: boolean;
  installation: {
    id: string;
    status: string;
    enabled: boolean;
    plugin: {
      id: string;
      name: string;
      slug: string;
    };
  };
  message: string;
}

/**
 * Plugin uninstall result
 */
export interface PluginUninstallResult {
  success: boolean;
  message: string;
}

/**
 * Marketplace response
 */
export interface MarketplaceResponse {
  plugins: PluginMarketplaceItem[];
  total: number;
}

/**
 * Installed plugins response
 */
export interface InstalledPluginsResponse {
  plugins: InstalledPluginInfo[];
  total: number;
}

/**
 * API success response wrapper
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * API error response wrapper
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
}

/**
 * Generic API response
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

