import { z } from 'zod';

// Legacy schemas for backward compatibility
export const ProcessPaymentSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.enum(['CREDIT_CARD', 'PAYPAL', 'BANK_TRANSFER']),
  paymentDetails: z.object({
    amount: z.number().positive(),
  }),
});

export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentSchema>;

export interface PaymentResponse {
  id: string;
  orderId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  paymentMethod: string;
  transactionId?: string;
  createdAt: Date;
}

// === NEW PAYMENT SYSTEM TYPES ===

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
  WECHAT_PAY = 'wechat_pay',
  ALIPAY = 'alipay',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto',
  MOCK = 'mock', // For testing
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  CNY = 'CNY',
  JPY = 'JPY',
  KRW = 'KRW',
  CAD = 'CAD',
  AUD = 'AUD',
}

export interface PaymentConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
  currency: Currency;
  region?: string;
  [key: string]: any;
}

export interface PaymentAmount {
  value: number;
  currency: Currency;
}

export interface PaymentCustomer {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}

export interface PaymentItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentRequest {
  orderId: string;
  amount: PaymentAmount;
  customer: PaymentCustomer;
  items: PaymentItem[];
  description?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  amount: PaymentAmount;
  transactionId?: string;
  providerResponse?: any;
  redirectUrl?: string;
  clientSecret?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentVerification {
  isValid: boolean;
  status: PaymentStatus;
  amount?: PaymentAmount;
  transactionId?: string;
  paidAt?: Date;
  error?: {
    code: string;
    message: string;
  };
}

export interface RefundRequest {
  paymentId: string;
  amount?: PaymentAmount;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: PaymentAmount;
  status: 'pending' | 'completed' | 'failed';
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  signature?: string;
  timestamp: Date;
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
    minAmount?: number;
    maxAmount?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  };
}

// Core payment provider interface
export interface PaymentProvider {
  readonly name: string;
  readonly version: string;
  readonly capabilities: PaymentCapabilities;

  // Lifecycle methods
  initialize(config: PaymentConfig): Promise<void>;
  isInitialized(): boolean;
  destroy(): Promise<void>;

  // Payment operations
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(paymentId: string): Promise<PaymentVerification>;
  cancelPayment(paymentId: string): Promise<boolean>;

  // Refund operations
  refund(request: RefundRequest): Promise<RefundResult>;
  getRefund(refundId: string): Promise<RefundResult>;

  // Webhook handling
  verifyWebhook(event: WebhookEvent): Promise<boolean>;
  handleWebhook(event: WebhookEvent): Promise<void>;

  // Payment method management (optional)
  savePaymentMethod?(customerId: string, paymentMethodData: any): Promise<string>;
  getPaymentMethods?(customerId: string): Promise<any[]>;
  deletePaymentMethod?(paymentMethodId: string): Promise<boolean>;

  // Health check
  healthCheck(): Promise<boolean>;
}

// Plugin metadata for the plugin system
export interface PaymentPluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  license: 'free' | 'basic' | 'premium' | 'enterprise';
  price?: number;
  regions: string[];
  currencies: Currency[];
  methods: PaymentMethod[];
  features: string[];
  requirements: {
    minCoreVersion: string;
    dependencies?: string[];
  };
  configuration: {
    required: string[];
    optional: string[];
  };
}

// Events for the payment system
export enum PaymentEventType {
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_PROCESSING = 'payment.processing',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELLED = 'payment.cancelled',
  REFUND_CREATED = 'refund.created',
  REFUND_COMPLETED = 'refund.completed',
  REFUND_FAILED = 'refund.failed',
}

export interface PaymentEvent {
  type: PaymentEventType;
  paymentId: string;
  orderId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}
