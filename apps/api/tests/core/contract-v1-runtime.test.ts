import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { decimalToMinor, minorToDecimal } from '@/core/payment/minor-units';
import { isContractV1Runtime, registerContractV1Runtime } from '@/core/admin/extension-installer/contract-v1-runtime';

vi.mock('@/config/database', () => ({ prisma: { $executeRawUnsafe: vi.fn(), $queryRawUnsafe: vi.fn(), $transaction: vi.fn() } }));

describe('contract v1 plugin runtime', () => {
  it('accepts only an object entry with register', () => {
    expect(isContractV1Runtime({ register() {} })).toBe(true);
    expect(isContractV1Runtime(async () => undefined)).toBe(false);
  });
  it('publishes exactly the supported context keys and mounts contract methods', async () => {
    const app = Fastify(); let keys: string[] = [];
    await registerContractV1Runtime(app, { register(ctx) {
      keys = Object.keys(ctx).sort();
      ctx.contracts.implement('payment', 1, { describe: () => ({ displayName: 'Test', requiresManualConfirmation: false, unpaidTimeoutMinutes: 30, supportedCurrencies: ['USD'] }), createSession: () => ({ sessionId: 'session-1', action: { type: 'redirect', url: 'https://pay.example/session-1' } }), getSessionStatus: () => ({ status: 'pending' }) });
    } }, { slug: 'test-plugin', installationId: 'install-1', version: '1.0.0', config: {}, declaredContracts: [{ name: 'payment', version: 1 }] });
    await app.ready(); expect(keys).toEqual(['config', 'contracts', 'events', 'http', 'logger', 'plugin']);
    expect((await app.inject({ method: 'POST', url: '/__contracts/payment/v1/describe', payload: {} })).statusCode).toBe(200); await app.close();
  });
  it('converts decimal amounts without floating point arithmetic', () => {
    expect(decimalToMinor('19.99', 'USD')).toBe(1999); expect(decimalToMinor('100', 'JPY')).toBe(100); expect(minorToDecimal(1999, 'USD')).toBe('19.99'); expect(decimalToMinor(minorToDecimal(12345, 'USD'), 'USD')).toBe(12345);
  });

  it('mounts shipping v1 quotes', async () => {
    const app = Fastify();
    await registerContractV1Runtime(app, { register(ctx) { ctx.contracts.implement('shipping', 1, { quote: () => ({ options: [{ id: 'standard', label: 'Standard', amountMinor: 499, estimatedDays: { min: 2, max: 4 } }] }) }); } }, { slug: 'shipping-plugin', installationId: 'shipping-install', version: '1.0.0', config: {}, declaredContracts: [{ name: 'shipping', version: 1 }] });
    expect((await app.inject({ method: 'POST', url: '/__contracts/shipping/v1/quote', payload: {} })).json()).toEqual({ options: [{ id: 'standard', label: 'Standard', amountMinor: 499, estimatedDays: { min: 2, max: 4 } }] });
    await app.close();
  });

  it('mounts tax v1 calculations', async () => {
    const app = Fastify();
    await registerContractV1Runtime(app, { register(ctx) { ctx.contracts.implement('tax', 1, { calculate: () => ({ pricesIncludeTax: false, lines: [{ lineId: 'line-1', taxMinor: 100 }], shippingTaxMinor: 20, totalTaxMinor: 120 }) }); } }, { slug: 'tax-plugin', installationId: 'tax-install', version: '1.0.0', config: {}, declaredContracts: [{ name: 'tax', version: 1 }] });
    expect((await app.inject({ method: 'POST', url: '/__contracts/tax/v1/calculate', payload: {} })).json().totalTaxMinor).toBe(120);
    await app.close();
  });

  it('mounts fulfillment v1 creation and notification v1 sending', async () => {
    const app = Fastify();
    await registerContractV1Runtime(app, { register(ctx) {
      ctx.contracts.implement('fulfillment', 1, { createFulfillment: () => ({ fulfillmentId: 'full-1', status: 'pending' }) });
      ctx.contracts.implement('notification', 1, { send: () => ({ accepted: true, providerMessageId: 'message-1' }) });
    } }, { slug: 'operations-plugin', installationId: 'operations-install', version: '1.0.0', config: {}, declaredContracts: [{ name: 'fulfillment', version: 1 }, { name: 'notification', version: 1 }] });
    expect((await app.inject({ method: 'POST', url: '/__contracts/fulfillment/v1/createFulfillment', payload: {} })).json().fulfillmentId).toBe('full-1');
    expect((await app.inject({ method: 'POST', url: '/__contracts/notification/v1/send', payload: {} })).json().accepted).toBe(true);
    await app.close();
  });
});
