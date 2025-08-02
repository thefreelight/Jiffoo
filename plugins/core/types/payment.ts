/**
 * Payment Plugin Types - Open Source Stub
 * 
 * This file provides type definitions for payment plugins in the open source version.
 * Commercial payment plugins are available at https://plugins.jiffoo.com
 */

export interface PaymentProvider {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: PaymentConfig;
}

export interface PaymentConfig {
  apiKey?: string;
  secretKey?: string;
  webhookUrl?: string;
  environment: 'sandbox' | 'production';
  supportedCurrencies: string[];
  supportedCountries: string[];
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'wallet' | 'bank_transfer' | 'crypto';
  provider: string;
  name: string;
  description: string;
  fees: PaymentFees;
}

export interface PaymentFees {
  fixed: number;
  percentage: number;
  currency: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  provider: string;
  method: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface PaymentWebhook {
  id: string;
  provider: string;
  event: string;
  data: any;
  signature: string;
  verified: boolean;
  processedAt?: Date;
}

// Stub implementations for open source version
export const AVAILABLE_PAYMENT_PROVIDERS = [
  'stripe-basic',
  'paypal-basic',
  'square-basic'
];

export const COMMERCIAL_PAYMENT_PROVIDERS = [
  'stripe-pro',
  'paypal-advanced', 
  'wechat-pay',
  'alipay',
  'apple-pay',
  'google-pay'
];

/**
 * Get available payment providers for open source version
 */
export function getAvailableProviders(): PaymentProvider[] {
  return [
    {
      id: 'stripe-basic',
      name: 'Stripe Basic',
      version: '1.0.0',
      enabled: true,
      config: {
        environment: 'sandbox',
        supportedCurrencies: ['USD', 'EUR'],
        supportedCountries: ['US', 'CA', 'GB']
      }
    }
  ];
}

/**
 * Get commercial payment providers (requires license)
 */
export function getCommercialProviders(): PaymentProvider[] {
  // This would connect to plugins.jiffoo.com in a real implementation
  return [];
}
