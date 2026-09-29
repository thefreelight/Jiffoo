import { describe, expect, it } from 'vitest';
import { isStorefrontCodeProviderId, storefrontCodeSlotCap, storefrontCodeCharacterCount } from '../../../packages/shared/src/extensions/storefront-code';

describe('Shared storefront code validation', () => {
  it('G preserves the API C provider cases and exact slot cap', () => {
    const invalid = {
      ga4MeasurementId: ['G-abc123', 'UA-123', ' G-ABC123 ', 'G-ABC123\n', `G-${'A'.repeat(33)}`],
      metaPixelId: ['pixel123', ' 123456 ', '123456\n', '1'.repeat(33), 123456],
      baiduSiteKey: ['0123456789ABCDEF0123456789ABCDEF', 'abcdef',
        ' 0123456789abcdef0123456789abcdef ', '0123456789abcdef0123456789abcdef\n'],
    };
    for (const key of Object.keys(invalid) as Array<keyof typeof invalid>) {
      for (const value of invalid[key]) expect(isStorefrontCodeProviderId(key, value), String(value)).toBe(false);
      expect(isStorefrontCodeProviderId(key, null)).toBe(true);
    }
    expect(isStorefrontCodeProviderId('ga4MeasurementId', 'G-ABC123')).toBe(true);
    expect(isStorefrontCodeProviderId('metaPixelId', '123456')).toBe(true);
    expect(isStorefrontCodeProviderId('baiduSiteKey', '0123456789abcdef0123456789abcdef')).toBe(true);
    expect(storefrontCodeSlotCap).toBe(65536);
    for (const value of [` ${'x'.repeat(65534)} `, 's'.repeat(65536), 'e'.repeat(65536)])
      expect(storefrontCodeCharacterCount(value)).toBe(storefrontCodeSlotCap);
    for (const value of ['x'.repeat(65537), 's'.repeat(65537), 'e'.repeat(65537)])
      expect(storefrontCodeCharacterCount(value)).toBeGreaterThan(storefrontCodeSlotCap);
  });
});
