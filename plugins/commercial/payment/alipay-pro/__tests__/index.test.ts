/**
 * Alipay Pro Plugin Tests
 */

import { AlipayProPlugin } from '../src/index';
import { PaymentMethod, Currency, PaymentStatus } from '../src/types';

// Mock crypto module to avoid RSA key issues in tests
jest.mock('crypto', () => ({
  createSign: jest.fn().mockReturnValue({
    update: jest.fn(),
    sign: jest.fn().mockReturnValue('mock_signature')
  }),
  createVerify: jest.fn().mockReturnValue({
    update: jest.fn(),
    verify: jest.fn().mockReturnValue(true)
  })
}));

describe('AlipayProPlugin', () => {
  let plugin: AlipayProPlugin;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      appId: 'test_app_id',
      privateKey: 'test_private_key',
      alipayPublicKey: 'test_public_key',
      signType: 'RSA2' as const,
      charset: 'utf-8' as const,
      format: 'JSON' as const,
      version: '1.0',
      environment: 'sandbox' as const,
      currency: Currency.CNY,
      sandbox: true,
      licenseKey: 'test_license_key',
      domain: 'test.example.com'
    };

    plugin = new AlipayProPlugin(mockConfig);
  });

  describe('Plugin Metadata', () => {
    test('should have correct plugin metadata', () => {
      expect(plugin.name).toBe('alipay-pro');
      expect(plugin.version).toBe('2.1.0');
      expect(plugin.capabilities.supportedMethods).toContain(PaymentMethod.ALIPAY);
      expect(plugin.capabilities.supportedCurrencies).toContain(Currency.CNY);
    });

    test('should support required features', () => {
      expect(plugin.capabilities.features.refunds).toBe(true);
      expect(plugin.capabilities.features.webhooks).toBe(true);
      expect(plugin.capabilities.features.partialRefunds).toBe(true);
    });

    test('should have correct limits', () => {
      expect(plugin.capabilities.limits.minAmount).toBe(0.01);
      expect(plugin.capabilities.limits.maxAmount).toBe(500000.00);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid config', async () => {
      await expect(plugin.initialize()).resolves.not.toThrow();
      expect(plugin.isInitialized()).toBe(true);
    });

    test('should throw error with invalid config', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.appId;
      
      const invalidPlugin = new AlipayProPlugin(invalidConfig);
      await expect(invalidPlugin.initialize()).rejects.toThrow('missing required field: appId');
    });
  });

  describe('Payment Creation', () => {
    beforeEach(async () => {
      await plugin.initialize();
    });

    test('should create payment request successfully', async () => {
      const paymentRequest = {
        orderId: 'test_order_123',
        amount: { value: 100.00, currency: Currency.CNY },
        description: 'Test payment',
        customer: { email: 'test@example.com', id: 'user_123' },
        metadata: { paymentType: 'web' }
      };

      const result = await plugin.createPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('test_order_123');
      expect(result.amount).toBe(100.00);
      expect(result.currency).toBe(Currency.CNY);
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.payUrl).toBeDefined();
    });

    test('should handle different payment types', async () => {
      const webPayment = {
        orderId: 'web_order',
        amount: { value: 50.00, currency: Currency.CNY },
        description: 'Web payment',
        customer: { email: 'test@example.com' },
        metadata: { paymentType: 'web' }
      };

      const result = await plugin.createPayment(webPayment);
      expect(result.metadata?.productCode).toBe('FAST_INSTANT_TRADE_PAY');
    });
  });

  describe('Static Methods', () => {
    test('should return health status', async () => {
      const health = await AlipayProPlugin.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('2.1.0');
      expect(health.provider).toBe('alipay');
      expect(health.capabilities.payments).toBe(true);
    });

    test('should return supported payment methods', () => {
      const methods = AlipayProPlugin.getSupportedPaymentMethods();
      
      expect(methods).toHaveLength(1);
      expect(methods[0].type).toBe('alipay');
      expect(methods[0].name).toBe('Alipay');
    });

    test('should return configuration schema', () => {
      const schema = AlipayProPlugin.getConfigurationSchema();
      
      expect(schema.required).toContain('appId');
      expect(schema.required).toContain('privateKey');
      expect(schema.required).toContain('alipayPublicKey');
      expect(schema.optional).toContain('sandbox');
    });
  });

  describe('Lifecycle', () => {
    test('should destroy properly', async () => {
      await plugin.initialize();
      expect(plugin.isInitialized()).toBe(true);
      
      await plugin.destroy();
      expect(plugin.isInitialized()).toBe(false);
    });
  });
});
