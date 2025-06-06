import { PaymentPluginMetadata } from '../types';
import { MockPaymentProvider } from '../providers/mock-provider';

/**
 * Mock Payment Plugin
 * This is a free plugin for testing and development
 */

export const mockPaymentPluginMetadata: PaymentPluginMetadata = {
  id: 'mock-payment-plugin',
  name: 'Mock Payment Plugin',
  description: 'Mock payment provider for testing and development',
  version: '1.0.0',
  author: 'Jiffoo Team',
  license: 'free',
  regions: ['*'],
  currencies: ['USD', 'EUR', 'GBP', 'CNY'],
  methods: ['mock', 'credit_card', 'paypal'],
  features: [
    'refunds',
    'partial_refunds',
    'webhooks',
    'test_scenarios',
    'development_mode'
  ],
  requirements: {
    minCoreVersion: '1.0.0',
  },
  configuration: {
    required: [],
    optional: ['environment', 'currency', 'region'],
  },
};

/**
 * Mock Payment Plugin Class
 * Provides the MockPaymentProvider as a plugin
 */
export class MockPaymentPlugin {
  static metadata = mockPaymentPluginMetadata;
  static providerClass = MockPaymentProvider;

  /**
   * Plugin initialization
   */
  static async initialize() {
    // Any plugin-specific initialization logic
    console.log('Mock Payment Plugin initialized');
  }

  /**
   * Plugin cleanup
   */
  static async destroy() {
    // Any plugin-specific cleanup logic
    console.log('Mock Payment Plugin destroyed');
  }

  /**
   * Get plugin configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          enum: ['sandbox', 'production'],
          default: 'sandbox',
          description: 'Environment for the mock provider'
        },
        currency: {
          type: 'string',
          enum: ['USD', 'EUR', 'GBP', 'CNY'],
          default: 'USD',
          description: 'Default currency for payments'
        },
        region: {
          type: 'string',
          default: 'global',
          description: 'Region for the mock provider'
        },
        enableTestScenarios: {
          type: 'boolean',
          default: true,
          description: 'Enable test scenarios based on email patterns'
        },
        simulateNetworkDelay: {
          type: 'boolean',
          default: false,
          description: 'Simulate network delays for testing'
        },
        maxAmount: {
          type: 'number',
          default: 999999.99,
          description: 'Maximum payment amount'
        },
        minAmount: {
          type: 'number',
          default: 0.01,
          description: 'Minimum payment amount'
        }
      },
      required: [],
      additionalProperties: false
    };
  }

  /**
   * Validate plugin configuration
   */
  static validateConfig(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.maxAmount && config.minAmount && config.maxAmount <= config.minAmount) {
      errors.push('maxAmount must be greater than minAmount');
    }

    if (config.currency && !['USD', 'EUR', 'GBP', 'CNY'].includes(config.currency)) {
      errors.push('Invalid currency specified');
    }

    if (config.environment && !['sandbox', 'production'].includes(config.environment)) {
      errors.push('Invalid environment specified');
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
      overview: 'Mock Payment Plugin provides a simulated payment provider for testing and development purposes.',
      features: [
        'Simulates various payment scenarios',
        'Supports multiple test cases based on email patterns',
        'Configurable success/failure rates',
        'Full refund support',
        'Webhook simulation',
        'No real money transactions'
      ],
      testScenarios: [
        {
          scenario: 'Successful Payment',
          trigger: 'Any normal email address',
          result: 'Payment completes successfully'
        },
        {
          scenario: 'Failed Payment',
          trigger: 'Email containing "fail"',
          result: 'Payment fails with decline error'
        },
        {
          scenario: 'Pending Payment',
          trigger: 'Email containing "pending"',
          result: 'Payment remains in pending status'
        },
        {
          scenario: 'Amount Too Small',
          trigger: 'Amount less than $1.00',
          result: 'Payment fails with amount error'
        },
        {
          scenario: 'Amount Too Large',
          trigger: 'Amount greater than $999,999',
          result: 'Payment fails with limit error'
        }
      ],
      configuration: {
        environment: 'Set to "sandbox" for testing, "production" for live simulation',
        currency: 'Default currency for all transactions',
        region: 'Geographic region for the provider',
        enableTestScenarios: 'Enable email-based test scenarios',
        simulateNetworkDelay: 'Add realistic network delays',
        maxAmount: 'Maximum allowed payment amount',
        minAmount: 'Minimum allowed payment amount'
      },
      examples: [
        {
          title: 'Basic Configuration',
          config: {
            environment: 'sandbox',
            currency: 'USD',
            region: 'global'
          }
        },
        {
          title: 'Development Configuration',
          config: {
            environment: 'sandbox',
            currency: 'USD',
            region: 'global',
            enableTestScenarios: true,
            simulateNetworkDelay: true,
            maxAmount: 10000,
            minAmount: 1
          }
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
      version: mockPaymentPluginMetadata.version,
      uptime: process.uptime(),
      lastCheck: new Date().toISOString(),
      capabilities: {
        payments: true,
        refunds: true,
        webhooks: true,
        testMode: true
      }
    };
  }
}

export default MockPaymentPlugin;
