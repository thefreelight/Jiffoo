/**
 * Shipping Plugin Types - Open Source Stub
 * 
 * This file provides type definitions for shipping plugins in the open source version.
 * Commercial shipping plugins are available at https://plugins.jiffoo.com
 */

export interface ShippingProvider {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: ShippingConfig;
}

export interface ShippingConfig {
  apiKey?: string;
  accountId?: string;
  environment: 'sandbox' | 'production';
  supportedCountries: string[];
  supportedServices: string[];
}

export interface ShippingMethod {
  id: string;
  provider: string;
  name: string;
  description: string;
  estimatedDays: number;
  cost: number;
  currency: string;
  trackingSupported: boolean;
}

export interface ShippingRate {
  id: string;
  provider: string;
  service: string;
  cost: number;
  currency: string;
  estimatedDays: number;
  metadata?: Record<string, any>;
}

export interface ShippingLabel {
  id: string;
  trackingNumber: string;
  labelUrl: string;
  provider: string;
  service: string;
  cost: number;
  currency: string;
  createdAt: Date;
}

export interface TrackingInfo {
  trackingNumber: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'exception' | 'cancelled';
  events: TrackingEvent[];
  estimatedDelivery?: Date;
  actualDelivery?: Date;
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  description: string;
  location?: string;
}

// Stub implementations for open source version
export const AVAILABLE_SHIPPING_PROVIDERS = [
  'flat-rate',
  'free-shipping',
  'local-pickup'
];

export const COMMERCIAL_SHIPPING_PROVIDERS = [
  'fedex',
  'ups',
  'dhl',
  'usps',
  'canada-post'
];

/**
 * Get available shipping providers for open source version
 */
export function getAvailableShippingProviders(): ShippingProvider[] {
  return [
    {
      id: 'flat-rate',
      name: 'Flat Rate Shipping',
      version: '1.0.0',
      enabled: true,
      config: {
        environment: 'production',
        supportedCountries: ['*'],
        supportedServices: ['standard']
      }
    },
    {
      id: 'free-shipping',
      name: 'Free Shipping',
      version: '1.0.0',
      enabled: true,
      config: {
        environment: 'production',
        supportedCountries: ['*'],
        supportedServices: ['free']
      }
    }
  ];
}

/**
 * Get commercial shipping providers (requires license)
 */
export function getCommercialShippingProviders(): ShippingProvider[] {
  // This would connect to plugins.jiffoo.com in a real implementation
  return [];
}
