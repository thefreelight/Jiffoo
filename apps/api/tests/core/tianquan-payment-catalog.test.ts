import { describe, expect, it } from 'vitest';
import { getOfficialCatalogEntry } from '@/core/admin/market/official-catalog';

describe('Tianquan payment catalog', () => {
  it('points YiPay and subscriptions at dependency-closed releases', () => {
    expect(getOfficialCatalogEntry('yipay')).toMatchObject({
      version: '0.0.5',
      packageUrl: 'https://artifacts.jiffoo.com/official-artifacts/plugins/yipay/0.0.5.jplugin',
      minCoreVersion: '1.0.81',
      defaultCurrency: 'USD',
    });
    expect(getOfficialCatalogEntry('subscription')).toMatchObject({
      version: '0.1.6',
      packageUrl: 'https://artifacts.jiffoo.com/official-artifacts/plugins/subscription/0.1.6.jplugin',
      minCoreVersion: '1.0.81',
      defaultCurrency: 'USD',
    });
  });
});
