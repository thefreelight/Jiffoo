import { describe, expect, it } from 'vitest';
import {
  classifySupplierProductType,
  resolveSupplierFulfillmentData,
  type SupplierProductProfile,
} from '@/core/external-orders/utils';

function buildProfile(productType: string, requiredUid = false): SupplierProductProfile {
  return {
    isSupplierProduct: true,
    provider: 'odoo',
    installationId: 'ins_test',
    externalProductCode: 'P001',
    productType,
    requiredUid,
  };
}

describe('external-order utils', () => {
  it('classifies odoo product types into data/esim/card groups', () => {
    expect(classifySupplierProductType('data')).toBe('data');
    expect(classifySupplierProductType('effective_date')).toBe('data');
    expect(classifySupplierProductType('external_data')).toBe('data');
    expect(classifySupplierProductType('esim')).toBe('esim');
    expect(classifySupplierProductType('ota-card')).toBe('card');
    expect(classifySupplierProductType('esim-card')).toBe('card');
    expect(classifySupplierProductType('sign_data')).toBe('unknown');
  });

  it('requires cardUid for data-like products', () => {
    expect(() =>
      resolveSupplierFulfillmentData(buildProfile('external_data'), {
        apn: 'cmnet',
      })
    ).toThrow('Supplier product requires cardUid');
  });

  it('requires shipping address for card-like products', () => {
    expect(() =>
      resolveSupplierFulfillmentData(buildProfile('esim-card'), {
        cardUid: '10001',
      })
    ).toThrow('Supplier card product requires shippingAddress');
  });
});
