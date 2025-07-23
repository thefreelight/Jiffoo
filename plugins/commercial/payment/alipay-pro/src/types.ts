/**
 * Temporary type definitions for plugin core
 * These should be replaced with actual imports from @jiffoo/plugin-core
 */

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
  ALIPAY = 'alipay',
  WECHAT_PAY = 'wechat_pay',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto'
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  CNY = 'CNY',
  JPY = 'JPY',
  KRW = 'KRW',
  HKD = 'HKD',
  SGD = 'SGD'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export interface PaymentConfig {
  environment: 'sandbox' | 'production';
  currency: Currency;
  [key: string]: any;
}

export interface PaymentRequest {
  orderId: string;
  amount: {
    value: number;
    currency: Currency;
  };
  description?: string;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  payUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerification {
  isValid: boolean;
  status: PaymentStatus;
  transactionId?: string;
  amount?: number;
  paidAt?: Date;
  metadata?: any;
}

export interface RefundRequest {
  paymentId: string;
  refundId?: string;
  amount: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  paymentId: string;
  amount: number;
  status: string;
  processedAt?: Date;
  metadata?: any;
}

export interface WebhookEvent {
  data: Record<string, any>;
  headers: Record<string, string>;
}

export interface PaymentCapabilities {
  supportedMethods: PaymentMethod[];
  supportedCurrencies: Currency[];
  supportedRegions: string[];
  features: {
    refunds: boolean;
    partialRefunds: boolean;
    webhooks: boolean;
    recurringPayments: boolean;
    savedPaymentMethods: boolean;
    multiPartyPayments: boolean;
  };
  limits: {
    minAmount: number;
    maxAmount: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  };
}

export interface PaymentProvider {
  readonly name: string;
  readonly version: string;
  readonly capabilities: PaymentCapabilities;

  initialize(): Promise<void>;
  isInitialized(): boolean;
  destroy(): Promise<void>;

  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(paymentId: string): Promise<PaymentVerification>;
  cancelPayment(paymentId: string): Promise<boolean>;
  refund(request: RefundRequest): Promise<RefundResult>;
  getRefund(refundId: string): Promise<RefundResult>;
  verifyWebhook(event: WebhookEvent): Promise<boolean>;
  handleWebhook(event: WebhookEvent): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// Mock License Validator
export class LicenseValidator {
  static async validateLicense(pluginName: string, licenseKey: string, domain: string) {
    return {
      valid: true,
      plan: 'professional',
      features: ['payments', 'refunds', 'webhooks', 'analytics'],
      isDemo: false,
      upgradeUrl: 'https://jiffoo.com/upgrade'
    };
  }

  static async incrementUsage(pluginName: string, action: string) {
    return true;
  }

  static isUsageLimitExceeded(licenseInfo: any) {
    return false;
  }
}
