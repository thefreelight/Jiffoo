/**
 * Unified Plugin Types - Open Source Edition
 * Central export for all plugin type definitions.
 */

export * from './payment';
export * from './analytics';
export * from './shipping';

// Core Plugin Types
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: PluginLicense;
  type: PluginType;
  status: PluginStatus;
  enabled: boolean;
  config?: Record<string, any>;
  dependencies?: PluginDependency[];
  routes?: PluginRoute[];
  hooks?: PluginHook[];
  createdAt: Date;
  updatedAt: Date;
}

export type PluginType = 'payment' | 'shipping' | 'analytics' | 'marketing' | 'crm' | 'inventory' | 'custom';
export type PluginStatus = 'installed' | 'active' | 'inactive' | 'error' | 'updating';
export type PluginLicense = 'opensource' | 'commercial' | 'enterprise';

export interface PluginDependency {
  pluginId: string;
  minVersion?: string;
  maxVersion?: string;
  optional?: boolean;
}

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  url?: string;  // Alias for path (compatibility)
  prefix?: string;
  handler: string | ((...args: any[]) => any);
  auth?: boolean;
  permissions?: string[];
}

export interface PluginHook {
  name: string;
  priority?: number;
  handler: string;
}

export interface PluginManager {
  install(pluginId: string, config?: Record<string, any>): Promise<Plugin>;
  uninstall(pluginId: string): Promise<boolean>;
  enable(pluginId: string): Promise<Plugin>;
  disable(pluginId: string): Promise<Plugin>;
  update(pluginId: string): Promise<Plugin>;
  getPlugin(pluginId: string): Promise<Plugin | null>;
  listPlugins(type?: PluginType): Promise<Plugin[]>;
  healthCheck(pluginId: string): Promise<PluginHealthStatus>;
}

export interface PluginHealthStatus {
  pluginId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: Date;
  details?: Record<string, any>;
}

export interface PluginEvent {
  type: 'installed' | 'uninstalled' | 'enabled' | 'disabled' | 'updated' | 'error';
  pluginId: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>;

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: PluginLicense;
  type: PluginType;
  downloadUrl: string;
  checksum: string;
  size: number;
}

export interface LicenseInfo {
  key: string;
  type: PluginLicense;
  valid: boolean;
  expiresAt?: Date;
  features: string[];
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: LicenseInfo;
  error?: string;
}

export const PLUGIN_REGISTRY_URL = 'https://plugins.jiffoo.com';
export const PLUGIN_API_VERSION = '1.0.0';

// Route Definition type with url support
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  path?: string;
  prefix?: string;
  handler: string | ((...args: any[]) => any);
  auth?: boolean;
  permissions?: string[];
}

// Payment Plugin Types
export interface PluginContext {
  config: Record<string, any>;
  logger: any;
  prisma?: any;
}

export interface PaymentParams {
  amount: number;
  currency: string;
  orderId: string;
  customerId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  redirectUrl?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface PaymentPluginImplementation {
  id: string;
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  processPayment(params: PaymentParams): Promise<PaymentResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
  getPaymentStatus(transactionId: string): Promise<PaymentStatus>;
}
