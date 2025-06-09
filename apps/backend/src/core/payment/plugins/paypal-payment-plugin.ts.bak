import { PaymentPluginMetadata, PaymentMethod, Currency } from '../types';
import { PayPalPaymentProvider } from '../providers/paypal-provider';

/**
 * PayPal Payment Plugin
 * Commercial plugin for processing PayPal payments
 */

export const paypalPaymentPluginMetadata: PaymentPluginMetadata = {
  id: 'paypal-payment-plugin',
  name: 'PayPal Payment Plugin',
  description: 'Accept payments via PayPal. Supports global payments with PayPal\'s trusted checkout experience and buyer protection.',
  version: '1.0.0',
  author: 'Jiffoo Team',
  license: 'basic',
  price: 29,
  regions: ['*'], // PayPal is available globally
  currencies: [Currency.USD, Currency.EUR, Currency.GBP, Currency.CAD, Currency.AUD],
  methods: [PaymentMethod.PAYPAL],
  features: [
    'paypal_checkout',
    'buyer_protection',
    'global_payments',
    'webhooks',
    'refunds',
    'partial_refunds',
    'fraud_protection',
    'mobile_optimized',
    'one_touch_payments',
    'guest_checkout',
    'multi_currency',
    'dispute_resolution'
  ],
  requirements: {
    minCoreVersion: '1.0.0',
    dependencies: ['@paypal/paypal-server-sdk'],
  },
  configuration: {
    required: ['clientId', 'clientSecret'],
    optional: ['environment', 'currency', 'region', 'brandName'],
  },
};

/**
 * PayPal Payment Plugin Class
 * Provides the PayPalPaymentProvider as a commercial plugin
 */
export class PayPalPaymentPlugin {
  static metadata = paypalPaymentPluginMetadata;
  static providerClass = PayPalPaymentProvider;

  /**
   * Plugin initialization
   */
  static async initialize() {
    console.log('PayPal Payment Plugin initialized');
  }

  /**
   * Plugin cleanup
   */
  static async destroy() {
    console.log('PayPal Payment Plugin destroyed');
  }

  /**
   * Get plugin configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'PayPal Client ID from PayPal Developer Dashboard',
          pattern: '^[A-Za-z0-9_-]+$',
          minLength: 20,
          sensitive: false
        },
        clientSecret: {
          type: 'string',
          description: 'PayPal Client Secret from PayPal Developer Dashboard',
          pattern: '^[A-Za-z0-9_-]+$',
          minLength: 20,
          sensitive: true
        },
        environment: {
          type: 'string',
          enum: ['sandbox', 'production'],
          default: 'sandbox',
          description: 'Environment for PayPal integration'
        },
        currency: {
          type: 'string',
          enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
          default: 'USD',
          description: 'Default currency for payments'
        },
        region: {
          type: 'string',
          default: 'global',
          description: 'Primary region for operations'
        },
        brandName: {
          type: 'string',
          maxLength: 127,
          default: 'Jiffoo Mall',
          description: 'Brand name displayed in PayPal checkout'
        },
        landingPage: {
          type: 'string',
          enum: ['LOGIN', 'BILLING', 'NO_PREFERENCE'],
          default: 'BILLING',
          description: 'PayPal checkout landing page preference'
        },
        userAction: {
          type: 'string',
          enum: ['CONTINUE', 'PAY_NOW'],
          default: 'PAY_NOW',
          description: 'Call-to-action text on PayPal checkout'
        },
        enableShipping: {
          type: 'boolean',
          default: true,
          description: 'Enable shipping address collection'
        },
        enableGuestCheckout: {
          type: 'boolean',
          default: true,
          description: 'Allow guest checkout without PayPal account'
        }
      },
      required: ['clientId', 'clientSecret'],
      additionalProperties: false
    };
  }

  /**
   * Validate plugin configuration
   */
  static validateConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate Client ID
    if (!config.clientId) {
      errors.push('PayPal Client ID is required');
    } else if (config.clientId.length < 20) {
      errors.push('PayPal Client ID appears to be invalid (too short)');
    }

    // Validate Client Secret
    if (!config.clientSecret) {
      errors.push('PayPal Client Secret is required');
    } else if (config.clientSecret.length < 20) {
      errors.push('PayPal Client Secret appears to be invalid (too short)');
    }

    // Validate environment consistency
    if (config.clientId && config.environment) {
      const isSandboxId = config.clientId.includes('sandbox') || config.environment === 'sandbox';
      const isProductionEnv = config.environment === 'production';
      
      if (isSandboxId && isProductionEnv) {
        errors.push('Sandbox Client ID cannot be used in production environment');
      }
    }

    // Validate brand name length
    if (config.brandName && config.brandName.length > 127) {
      errors.push('Brand name must be 127 characters or less');
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
      overview: 'PayPal Payment Plugin enables secure payments through PayPal\'s trusted global payment platform with buyer protection and fraud prevention.',
      
      features: [
        'Accept PayPal payments globally',
        'PayPal buyer protection for customers',
        'Support for 200+ markets worldwide',
        'Guest checkout without PayPal account required',
        'One Touch payments for returning customers',
        'Mobile-optimized checkout experience',
        'Real-time payment processing',
        'Comprehensive webhook notifications',
        'Full and partial refund support',
        'Dispute resolution through PayPal',
        'Multi-currency support',
        'Fraud protection and risk management'
      ],

      supportedPaymentMethods: [
        'PayPal Balance',
        'Credit and Debit Cards (via PayPal)',
        'Bank Transfers (in supported regions)',
        'PayPal Credit (where available)',
        'Local Payment Methods (region-specific)'
      ],

      globalCoverage: [
        '200+ markets worldwide',
        '100+ currencies supported',
        '56 languages available',
        'Local payment methods in key markets'
      ],

      setup: {
        steps: [
          '1. Create a PayPal Business account at https://paypal.com',
          '2. Access PayPal Developer Dashboard at https://developer.paypal.com',
          '3. Create a new application to get Client ID and Secret',
          '4. Configure webhook endpoints for notifications',
          '5. Configure the plugin with your credentials',
          '6. Test payments in sandbox mode',
          '7. Switch to production when ready'
        ],
        
        webhookEvents: [
          'PAYMENT.CAPTURE.COMPLETED',
          'PAYMENT.CAPTURE.DENIED',
          'PAYMENT.CAPTURE.PENDING',
          'PAYMENT.CAPTURE.REFUNDED',
          'CHECKOUT.ORDER.APPROVED'
        ]
      },

      pricing: {
        transactionFees: '2.9% + fixed fee per transaction',
        internationalFees: 'Additional fees for cross-border transactions',
        disputeFee: '$20.00 per dispute',
        note: 'PayPal fees are separate from plugin licensing fees'
      },

      security: [
        'PCI DSS compliant',
        'Advanced fraud protection',
        'Buyer and seller protection',
        'Encrypted data transmission',
        'Risk monitoring and scoring',
        'Regulatory compliance worldwide'
      ],

      examples: [
        {
          title: 'Basic Configuration',
          config: {
            clientId: 'your-sandbox-client-id',
            clientSecret: 'your-sandbox-client-secret',
            environment: 'sandbox',
            currency: 'USD',
            brandName: 'Your Store'
          }
        },
        {
          title: 'Production Configuration',
          config: {
            clientId: 'your-live-client-id',
            clientSecret: 'your-live-client-secret',
            environment: 'production',
            currency: 'USD',
            brandName: 'Your Store',
            landingPage: 'BILLING',
            userAction: 'PAY_NOW',
            enableShipping: true,
            enableGuestCheckout: true
          }
        }
      ],

      troubleshooting: [
        {
          issue: 'Invalid client credentials',
          solution: 'Verify your Client ID and Secret from PayPal Developer Dashboard'
        },
        {
          issue: 'Payment not completing',
          solution: 'Check webhook configuration and ensure return URLs are correct'
        },
        {
          issue: 'Currency not supported',
          solution: 'Verify the currency is supported in your PayPal account region'
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
      version: paypalPaymentPluginMetadata.version,
      provider: 'paypal',
      lastCheck: new Date().toISOString(),
      capabilities: {
        payments: true,
        refunds: true,
        webhooks: true,
        guestCheckout: true,
        buyerProtection: true,
        disputes: true
      },
      limits: {
        minAmount: 0.01,
        maxAmount: 10000.00,
        supportedCurrencies: 100,
        supportedCountries: 200
      }
    };
  }

  /**
   * Get supported payment methods
   */
  static getSupportedPaymentMethods() {
    return [
      {
        type: 'paypal',
        name: 'PayPal',
        description: 'Pay with PayPal balance, cards, or bank account',
        features: ['buyer_protection', 'guest_checkout', 'one_touch']
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
      responseTime: '200ms'
    };
  }

  /**
   * Get regional information
   */
  static getRegionalInfo() {
    return {
      supportedRegions: [
        'North America', 'Europe', 'Asia Pacific', 
        'Latin America', 'Middle East', 'Africa'
      ],
      localPaymentMethods: {
        'Germany': ['SOFORT', 'giropay'],
        'Netherlands': ['iDEAL'],
        'Poland': ['BLIK'],
        'Italy': ['MyBank'],
        'Spain': ['Bizum']
      },
      currencies: [
        'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 
        'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'
      ]
    };
  }
}

export default PayPalPaymentPlugin;
