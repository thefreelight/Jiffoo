/**
 * Analytics Plugin Types - Open Source Stub
 * 
 * This file provides type definitions for analytics plugins in the open source version.
 * Commercial analytics plugins are available at https://plugins.jiffoo.com
 */

export interface AnalyticsProvider {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: AnalyticsConfig;
}

export interface AnalyticsConfig {
  trackingId?: string;
  apiKey?: string;
  environment: 'development' | 'production';
  enableEcommerce: boolean;
  enableUserTracking: boolean;
  dataRetentionDays: number;
}

export interface AnalyticsEvent {
  id: string;
  type: 'page_view' | 'purchase' | 'add_to_cart' | 'remove_from_cart' | 'search' | 'custom';
  userId?: string;
  sessionId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EcommerceEvent {
  transactionId: string;
  revenue: number;
  currency: string;
  items: AnalyticsItem[];
  coupon?: string;
  shipping?: number;
  tax?: number;
}

export interface AnalyticsItem {
  itemId: string;
  itemName: string;
  category: string;
  quantity: number;
  price: number;
  currency: string;
  variant?: string;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type: 'sales' | 'traffic' | 'conversion' | 'custom';
  dateRange: {
    start: Date;
    end: Date;
  };
  data: Record<string, any>;
  generatedAt: Date;
}

export interface UserBehavior {
  userId?: string;
  sessionId: string;
  pageViews: number;
  timeOnSite: number;
  bounceRate: number;
  conversionRate: number;
  lastVisit: Date;
}

// Stub implementations for open source version
export const AVAILABLE_ANALYTICS_PROVIDERS = [
  'basic-analytics',
  'simple-tracking'
];

export const COMMERCIAL_ANALYTICS_PROVIDERS = [
  'google-analytics-pro',
  'adobe-analytics',
  'mixpanel-advanced',
  'segment-pro',
  'hotjar-premium'
];

/**
 * Get available analytics providers for open source version
 */
export function getAvailableAnalyticsProviders(): AnalyticsProvider[] {
  return [
    {
      id: 'basic-analytics',
      name: 'Basic Analytics',
      version: '1.0.0',
      enabled: true,
      config: {
        environment: 'production',
        enableEcommerce: true,
        enableUserTracking: false,
        dataRetentionDays: 30
      }
    }
  ];
}

/**
 * Get commercial analytics providers (requires license)
 */
export function getCommercialAnalyticsProviders(): AnalyticsProvider[] {
  // This would connect to plugins.jiffoo.com in a real implementation
  return [];
}

/**
 * Track an analytics event (stub implementation)
 */
export function trackEvent(event: AnalyticsEvent): void {
  console.log('Analytics event tracked:', event.type);
  // In commercial version, this would send to actual analytics providers
}

/**
 * Generate analytics report (stub implementation)
 */
export function generateReport(type: string, dateRange: { start: Date; end: Date }): AnalyticsReport {
  return {
    id: `report_${Date.now()}`,
    name: `${type} Report`,
    type: type as any,
    dateRange,
    data: {
      message: 'Upgrade to commercial analytics for detailed reports',
      upgradeUrl: 'https://plugins.jiffoo.com/analytics'
    },
    generatedAt: new Date()
  };
}
