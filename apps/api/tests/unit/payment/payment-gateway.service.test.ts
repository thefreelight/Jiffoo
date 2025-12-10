/**
 * Payment Gateway Service Unit Tests
 * 
 * Tests for payment method validation and availability checking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentGatewayService } from '@/core/payment-gateway/service';
import { getPluginInfo, PLUGIN_INFO_MAP } from '@/core/payment-gateway/types';

describe('PaymentGatewayService', () => {
  // Create mock Fastify instance
  const createMockFastify = (overrides = {}) => ({
    prisma: {
      pluginInstallation: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      plugin: {
        findUnique: vi.fn(),
      },
    },
    log: {
      info: vi.fn(),
      error: vi.fn(),
    },
    checkPluginLicense: vi.fn(),
    checkUsageLimit: vi.fn(),
    ...overrides,
  });

  describe('getAvailablePaymentMethods', () => {
    it('should return empty array when no plugins installed', async () => {
      const fastify = createMockFastify();
      fastify.prisma.pluginInstallation.findMany.mockResolvedValue([]);

      const methods = await PaymentGatewayService.getAvailablePaymentMethods(
        fastify as any,
        1
      );

      expect(methods).toEqual([]);
    });

    it('should return available methods when all checks pass', async () => {
      const fastify = createMockFastify();
      fastify.prisma.pluginInstallation.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          tenantId: 1,
          plugin: { id: 'p1', slug: 'stripe', name: 'Stripe Payment', status: 'ACTIVE' },
        },
      ]);
      fastify.checkPluginLicense.mockResolvedValue({ valid: true });
      fastify.checkUsageLimit.mockResolvedValue({ allowed: true });

      const methods = await PaymentGatewayService.getAvailablePaymentMethods(
        fastify as any,
        1
      );

      expect(methods).toHaveLength(1);
      expect(methods[0].pluginSlug).toBe('stripe');
      expect(methods[0].displayName).toBe('Credit Card (Stripe)');
    });

    it('should filter out plugins with invalid license', async () => {
      const fastify = createMockFastify();
      fastify.prisma.pluginInstallation.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          tenantId: 1,
          plugin: { id: 'p1', slug: 'stripe', name: 'Stripe', status: 'ACTIVE' },
        },
      ]);
      fastify.checkPluginLicense.mockResolvedValue({ valid: false, reason: 'EXPIRED' });

      const methods = await PaymentGatewayService.getAvailablePaymentMethods(
        fastify as any,
        1
      );

      expect(methods).toHaveLength(0);
    });

    it('should filter out plugins with exceeded API limits', async () => {
      const fastify = createMockFastify();
      fastify.prisma.pluginInstallation.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          tenantId: 1,
          plugin: { id: 'p1', slug: 'stripe', name: 'Stripe', status: 'ACTIVE' },
        },
      ]);
      fastify.checkPluginLicense.mockResolvedValue({ valid: true });
      fastify.checkUsageLimit
        .mockResolvedValueOnce({ allowed: false }) // API calls limit exceeded
        .mockResolvedValue({ allowed: true });

      const methods = await PaymentGatewayService.getAvailablePaymentMethods(
        fastify as any,
        1
      );

      expect(methods).toHaveLength(0);
    });

    it('should sort methods by predefined order', async () => {
      const fastify = createMockFastify();
      fastify.prisma.pluginInstallation.findMany.mockResolvedValue([
        { id: 'inst-2', tenantId: 1, plugin: { id: 'p2', slug: 'paypal', name: 'PayPal', status: 'ACTIVE' } },
        { id: 'inst-1', tenantId: 1, plugin: { id: 'p1', slug: 'stripe', name: 'Stripe', status: 'ACTIVE' } },
      ]);
      fastify.checkPluginLicense.mockResolvedValue({ valid: true });
      fastify.checkUsageLimit.mockResolvedValue({ allowed: true });

      const methods = await PaymentGatewayService.getAvailablePaymentMethods(
        fastify as any,
        1
      );

      expect(methods[0].pluginSlug).toBe('stripe'); // stripe first
      expect(methods[1].pluginSlug).toBe('paypal'); // paypal second
    });
  });

  describe('validatePaymentMethod', () => {
    it('should return invalid when plugin not found', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockResolvedValue(null);

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'invalid-method'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('PLUGIN_NOT_FOUND');
    });

    it('should return invalid when plugin not installed', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockResolvedValue({ id: 'p1', slug: 'stripe' });
      fastify.prisma.pluginInstallation.findFirst.mockResolvedValue(null);

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'stripe'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('PLUGIN_NOT_INSTALLED');
    });

    it('should return invalid when license is invalid', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockResolvedValue({ id: 'p1', slug: 'stripe' });
      fastify.prisma.pluginInstallation.findFirst.mockResolvedValue({
        id: 'inst-1',
        status: 'ACTIVE',
        enabled: true,
      });
      fastify.checkPluginLicense.mockResolvedValue({ valid: false, reason: 'EXPIRED' });

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'stripe'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('LICENSE_INVALID');
    });

    it('should return invalid when API limit exceeded', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockResolvedValue({ id: 'p1', slug: 'stripe' });
      fastify.prisma.pluginInstallation.findFirst.mockResolvedValue({
        id: 'inst-1',
        status: 'ACTIVE',
        enabled: true,
      });
      fastify.checkPluginLicense.mockResolvedValue({ valid: true });
      fastify.checkUsageLimit.mockResolvedValueOnce({ allowed: false }); // API calls

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'stripe'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('API_LIMIT_EXCEEDED');
    });

    it('should return invalid when transaction limit exceeded', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockResolvedValue({ id: 'p1', slug: 'stripe' });
      fastify.prisma.pluginInstallation.findFirst.mockResolvedValue({
        id: 'inst-1',
        status: 'ACTIVE',
        enabled: true,
      });
      fastify.checkPluginLicense.mockResolvedValue({ valid: true });
      fastify.checkUsageLimit
        .mockResolvedValueOnce({ allowed: true }) // API calls OK
        .mockResolvedValueOnce({ allowed: false }); // Transactions exceeded

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'stripe'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TRANSACTION_LIMIT_EXCEEDED');
    });

    it('should return valid when all checks pass', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockResolvedValue({ id: 'p1', slug: 'stripe' });
      fastify.prisma.pluginInstallation.findFirst.mockResolvedValue({
        id: 'inst-1',
        status: 'ACTIVE',
        enabled: true,
      });
      fastify.checkPluginLicense.mockResolvedValue({ valid: true });
      fastify.checkUsageLimit.mockResolvedValue({ allowed: true });

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'stripe'
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      const fastify = createMockFastify();
      fastify.prisma.plugin.findUnique.mockRejectedValue(new Error('DB error'));

      const result = await PaymentGatewayService.validatePaymentMethod(
        fastify as any,
        1,
        'stripe'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('VALIDATION_ERROR');
    });
  });
});

describe('getPluginInfo', () => {
  it('should return correct info for known plugins', () => {
    const stripeInfo = getPluginInfo('stripe');
    expect(stripeInfo.displayName).toBe('Credit Card (Stripe)');
    expect(stripeInfo.supportedCurrencies).toContain('USD');
  });

  it('should return default info for unknown plugins', () => {
    const unknownInfo = getPluginInfo('unknown-plugin');
    expect(unknownInfo.displayName).toBe('unknown-plugin');
    expect(unknownInfo.icon).toBe('/icons/default.svg');
  });

  it('should have all expected plugins in PLUGIN_INFO_MAP', () => {
    expect(PLUGIN_INFO_MAP).toHaveProperty('stripe');
    expect(PLUGIN_INFO_MAP).toHaveProperty('paypal-payment');
    expect(PLUGIN_INFO_MAP).toHaveProperty('alipay-payment');
    expect(PLUGIN_INFO_MAP).toHaveProperty('wechat-payment');
  });
});

