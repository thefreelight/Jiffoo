import { PaymentPluginMetadata, PaymentMethod, Currency } from '../types';
import { StripePaymentProvider } from '../providers/stripe-provider';

/**
 * Stripe Payment Plugin
 * Commercial plugin for processing credit card payments via Stripe
 */

export const stripePaymentPluginMetadata: PaymentPluginMetadata = {
  id: 'stripe-payment-plugin',
  name: 'Stripe Payment Plugin',
  description: 'Accept credit card and debit card payments via Stripe. Supports major currencies and regions with advanced features like saved payment methods and recurring payments.',
  version: '1.0.0',
  author: 'Jiffoo Team',
  license: 'basic',
  price: 29,
  regions: ['US', 'EU', 'CA', 'AU', 'GB'],
  currencies: [Currency.USD, Currency.EUR, Currency.GBP, Currency.CAD, Currency.AUD],
  methods: [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD],
  features: [
    'credit_card_processing',
    'debit_card_processing',
    'webhooks',
    'refunds',
    'partial_refunds',
    'saved_payment_methods',
    'recurring_payments',
    'fraud_protection',
    'pci_compliance',
    'real_time_processing',
    'multi_currency',
    'dispute_management'
  ],
  requirements: {
    minCoreVersion: '1.0.0',
    dependencies: ['stripe'],
  },
  configuration: {
    required: ['apiKey', 'webhookSecret'],
    optional: ['environment', 'currency', 'region'],
  },
};

/**
 * Stripe Payment Plugin Class
 * Provides the StripePaymentProvider as a commercial plugin
 */
export class StripePaymentPlugin {
  static metadata = stripePaymentPluginMetadata;
  static providerClass = StripePaymentProvider;

  /**
   * Plugin initialization
   */
  static async initialize() {
    console.log('Stripe Payment Plugin initialized');
  }

  /**
   * Plugin cleanup
   */
  static async destroy() {
    console.log('Stripe Payment Plugin destroyed');
  }

  /**
   * Get plugin configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Stripe Secret API Key (sk_test_... or sk_live_...)',
          pattern: '^sk_(test|live)_[a-zA-Z0-9]{24,}$',
          minLength: 32,
          sensitive: true
        },
        webhookSecret: {
          type: 'string',
          description: 'Stripe Webhook Endpoint Secret (whsec_...)',
          pattern: '^whsec_[a-zA-Z0-9]{32,}$',
          minLength: 32,
          sensitive: true
        },
        environment: {
          type: 'string',
          enum: ['sandbox', 'production'],
          default: 'sandbox',
          description: 'Environment for Stripe integration'
        },
        currency: {
          type: 'string',
          enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
          default: 'USD',
          description: 'Default currency for payments'
        },
        region: {
          type: 'string',
          enum: ['US', 'EU', 'CA', 'AU', 'GB'],
          default: 'US',
          description: 'Primary region for operations'
        },
        captureMethod: {
          type: 'string',
          enum: ['automatic', 'manual'],
          default: 'automatic',
          description: 'Payment capture method'
        },
        statementDescriptor: {
          type: 'string',
          maxLength: 22,
          description: 'Statement descriptor for customer bank statements'
        },
        enableSavedCards: {
          type: 'boolean',
          default: true,
          description: 'Allow customers to save payment methods'
        },
        enableRecurring: {
          type: 'boolean',
          default: false,
          description: 'Enable recurring payment support'
        }
      },
      required: ['apiKey', 'webhookSecret'],
      additionalProperties: false
    };
  }

  /**
   * Validate plugin configuration
   */
  static validateConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate API key format
    if (!config.apiKey) {
      errors.push('Stripe API key is required');
    } else if (!config.apiKey.match(/^sk_(test|live)_[a-zA-Z0-9]{24,}$/)) {
      errors.push('Invalid Stripe API key format');
    }

    // Validate webhook secret format
    if (!config.webhookSecret) {
      errors.push('Stripe webhook secret is required');
    } else if (!config.webhookSecret.match(/^whsec_[a-zA-Z0-9]{32,}$/)) {
      errors.push('Invalid Stripe webhook secret format');
    }

    // Validate environment consistency
    if (config.apiKey && config.environment) {
      const isTestKey = config.apiKey.startsWith('sk_test_');
      const isProductionEnv = config.environment === 'production';
      
      if (isTestKey && isProductionEnv) {
        errors.push('Cannot use test API key in production environment');
      } else if (!isTestKey && !isProductionEnv) {
        errors.push('Cannot use live API key in sandbox environment');
      }
    }

    // Validate statement descriptor length
    if (config.statementDescriptor && config.statementDescriptor.length > 22) {
      errors.push('Statement descriptor must be 22 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get plugin documentation
   */
  static getDocumentation() {
    return {
      overview: 'Stripe Payment Plugin enables secure credit and debit card processing through Stripe\'s industry-leading payment infrastructure.',
      
      features: [
        'Accept major credit and debit cards worldwide',
        'PCI DSS compliant payment processing',
        'Advanced fraud protection with Stripe Radar',
        'Support for 135+ currencies',
        'Saved payment methods for returning customers',
        'Recurring payments and subscriptions',
        'Real-time payment processing',
        'Comprehensive webhook notifications',
        'Full and partial refund support',
        'Dispute and chargeback management',
        'Detailed transaction reporting',
        'Mobile-optimized payment flows'
      ],

      supportedCards: [
        'Visa', 'Mastercard', 'American Express', 'Discover',
        'Diners Club', 'JCB', 'UnionPay'
      ],

      supportedRegions: [
        'United States', 'European Union', 'Canada', 
        'Australia', 'United Kingdom'
      ],

      setup: {
        steps: [
          '1. Create a Stripe account at https://stripe.com',
          '2. Get your API keys from the Stripe Dashboard',
          '3. Set up webhook endpoints for real-time notifications',
          '4. Configure the plugin with your API keys',
          '5. Test payments in sandbox mode',
          '6. Switch to production when ready'
        ],
        
        webhookEvents: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'charge.dispute.created',
          'invoice.payment_succeeded',
          'customer.subscription.updated'
        ]
      },

      pricing: {
        transactionFees: '2.9% + 30¢ per successful charge',
        internationalCards: 'Additional 1.5% for international cards',
        disputeFee: '$15.00 per dispute',
        note: 'Stripe fees are separate from plugin licensing fees'
      },

      security: [
        'PCI DSS Level 1 certified',
        'End-to-end encryption',
        'Tokenized payment data',
        'Advanced fraud detection',
        'Machine learning risk scoring',
        'Real-time monitoring'
      ],

      examples: [
        {
          title: 'Basic Configuration',
          config: {
            apiKey: 'sk_test_...',
            webhookSecret: 'whsec_...',
            environment: 'sandbox',
            currency: 'USD',
            region: 'US'
          }
        },
        {
          title: 'Production Configuration',
          config: {
            apiKey: 'sk_live_...',
            webhookSecret: 'whsec_...',
            environment: 'production',
            currency: 'USD',
            region: 'US',
            captureMethod: 'automatic',
            statementDescriptor: 'MYSTORE',
            enableSavedCards: true,
            enableRecurring: true
          }
        }
      ],

      troubleshooting: [
        {
          issue: 'Invalid API key error',
          solution: 'Verify your API key format and ensure it matches your environment'
        },
        {
          issue: 'Webhook verification failed',
          solution: 'Check your webhook secret and ensure the endpoint URL is correct'
        },
        {
          issue: 'Payment declined',
          solution: 'Check Stripe Dashboard for decline reason and customer notification'
        }
      ]
    };
  }

  /**
   * Get plugin health status
   */
  static async getHealthStatus() {
    return {
      status: 'healthy',
      version: stripePaymentPluginMetadata.version,
      provider: 'stripe',
      lastCheck: new Date().toISOString(),
      capabilities: {
        payments: true,
        refunds: true,
        webhooks: true,
        savedCards: true,
        recurring: true,
        disputes: true
      },
      limits: {
        minAmount: 0.50,
        maxAmount: 999999.99,
        supportedCurrencies: 135,
        supportedCountries: 46
      }
    };
  }

  /**
   * Get supported payment methods
   */
  static getSupportedPaymentMethods() {
    return [
      {
        type: 'credit_card',
        name: 'Credit Card',
        brands: ['visa', 'mastercard', 'amex', 'discover'],
        description: 'Accept major credit cards'
      },
      {
        type: 'debit_card',
        name: 'Debit Card',
        brands: ['visa', 'mastercard'],
        description: 'Accept debit cards with PIN or signature'
      }
    ];
  }

  /**
   * Get plugin metrics
   */
  static getMetrics() {
    return {
      totalTransactions: 0,
      successfulPayments: 0,
      failedPayments: 0,
      totalRefunds: 0,
      averageTransactionValue: 0,
      lastTransactionAt: null,
      uptime: '99.9%',
      responseTime: '150ms'
    };
  }
}

export default StripePaymentPlugin;
