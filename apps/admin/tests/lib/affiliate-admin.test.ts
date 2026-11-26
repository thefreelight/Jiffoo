import { describe, expect, it } from 'vitest';
import {
  type AffiliateScopeProduct,
  affiliateScopeMode,
  affiliateScopeSummary,
  isPhysicalProduct,
  newOrganizationPayload,
  partnerScopeChange,
  scopeProductIdsOf,
  toggleGroup,
} from '@/lib/plugins/affiliate-admin';

// The owner's direction (2026-11-27): "顾客自己后台不能创建机构，机构只能由我们后台创建，或者客户前端申请，留下联系方式，我们审批"
// and "后台要设置可以适用的推广产品吧？不是全站的". These are the decisions behind the admin's affiliate workspace.

const CARD = { id: 'odoo-product-6', name: 'Bokmoo Card V1', price: 20, productKind: 'goods', requiresShipping: true };
const BLUETOOTH = { id: 'odoo-product-7', name: 'Bokmoo Bluetooth Card', price: 40, productKind: 'goods', requiresShipping: true };
const PLAN = { id: 'boss-JP-1GB-7D', name: 'Japan 1GB 7 days', price: 4.9, productKind: 'digital', requiresShipping: false };
const LEGACY = { id: 'old-1', name: 'Shipped before kinds were recorded', price: 9, requiresShipping: true };
const CATALOG = [CARD, BLUETOOTH, PLAN, LEGACY];

describe('what a promo code applies to', () => {
  it('reads the scope of a partner row, including rows written before scopes existed', () => {
    expect(affiliateScopeMode(undefined)).toBe('all');
    expect(affiliateScopeMode('selected')).toBe('selected');
    expect(affiliateScopeMode('except')).toBe('except');
    expect(affiliateScopeMode('nonsense')).toBe('all');
    expect(scopeProductIdsOf(undefined)).toEqual([]);
    expect(scopeProductIdsOf(['a', 2])).toEqual(['a', '2']);
    expect(affiliateScopeSummary('all', ['a'])).toBe('All products');
    expect(affiliateScopeSummary('selected', ['a', 'b'])).toBe('Only 2 picked');
    expect(affiliateScopeSummary('except', ['a'])).toBe('All but 1');
  });

  it('tells a shipped card from a plan', () => {
    expect(CATALOG.filter(isPhysicalProduct).map((product) => product.id)).toEqual(['odoo-product-6', 'odoo-product-7', 'old-1']);
  });

  it('sends the scope only when it changed', () => {
    const saved = { scope_mode: 'selected', scope_product_ids: ['odoo-product-6', 'odoo-product-7'] };
    expect(partnerScopeChange({ scopeMode: 'selected', scopeProductIds: ['odoo-product-7', 'odoo-product-6'] }, saved)).toEqual({ invalid: false });
    expect(partnerScopeChange({ scopeMode: 'all', scopeProductIds: [] }, { scope_mode: 'all' })).toEqual({ invalid: false });
    // a row from before scopes existed reads as "everything"
    expect(partnerScopeChange({ scopeMode: 'all', scopeProductIds: [] }, {})).toEqual({ invalid: false });
    expect(partnerScopeChange({ scopeMode: 'all', scopeProductIds: [] }, undefined)).toEqual({ invalid: false });
  });

  it('sends a changed scope, and never a limited code without products', () => {
    expect(partnerScopeChange({ scopeMode: 'except', scopeProductIds: ['boss-JP-1GB-7D'] }, { scope_mode: 'selected', scope_product_ids: ['odoo-product-6'] }))
      .toEqual({ scope: { mode: 'except', productIds: ['boss-JP-1GB-7D'] }, invalid: false });
    // back to everything: the list is dropped
    expect(partnerScopeChange({ scopeMode: 'all', scopeProductIds: ['odoo-product-6'] }, { scope_mode: 'selected', scope_product_ids: ['odoo-product-6'] }))
      .toEqual({ scope: { mode: 'all', productIds: [] }, invalid: false });
    expect(partnerScopeChange({ scopeMode: 'selected', scopeProductIds: [] }, { scope_mode: 'all' })).toEqual({ invalid: true });
    expect(partnerScopeChange({ scopeMode: 'except', scopeProductIds: [] }, undefined)).toEqual({ invalid: true });
  });

  it('picks and unpicks a whole group', () => {
    const cards = (product: AffiliateScopeProduct) => isPhysicalProduct(product);
    expect(toggleGroup(['boss-JP-1GB-7D'], CATALOG, cards)).toEqual(['boss-JP-1GB-7D', 'odoo-product-6', 'odoo-product-7', 'old-1']);
    // every card already picked: the group comes off, the plan stays
    expect(toggleGroup(['odoo-product-6', 'boss-JP-1GB-7D', 'odoo-product-7', 'old-1'], CATALOG, cards)).toEqual(['boss-JP-1GB-7D']);
    expect(toggleGroup([], CATALOG, (product) => !isPhysicalProduct(product))).toEqual(['boss-JP-1GB-7D']);
    // an empty group adds nothing
    expect(toggleGroup(['x'], CATALOG, () => false)).toEqual(['x']);
  });
});

describe('the store opens an organization itself', () => {
  it('asks for the owner by e-mail, or by account id', () => {
    expect(newOrganizationPayload({ name: ' Travel Crew ', owner: 'Owner@Example.com ', rate: '8' }))
      .toEqual({ payload: { name: 'Travel Crew', ownerEmail: 'owner@example.com', commissionRate: 8 } });
    expect(newOrganizationPayload({ name: 'Travel Crew', owner: ' 3f2a-user-id ', rate: '2.5' }))
      .toEqual({ payload: { name: 'Travel Crew', ownerUserId: '3f2a-user-id', commissionRate: 2.5 } });
  });

  it('refuses what the core would refuse, before asking', () => {
    const errorOf = (input: { name: string; owner: string; rate: string }) => {
      const result = newOrganizationPayload(input);
      return 'error' in result ? result.error : undefined;
    };
    expect(errorOf({ name: 'T', owner: 'owner@example.com', rate: '8' })).toMatch(/name/);
    expect(errorOf({ name: 'Crew', owner: '   ', rate: '8' })).toMatch(/owner/);
    expect(errorOf({ name: 'Crew', owner: 'owner@example.com', rate: '95' })).toMatch(/rate/);
    expect(errorOf({ name: 'Crew', owner: 'owner@example.com', rate: '' })).toMatch(/rate/);
    expect(errorOf({ name: 'Crew', owner: 'owner@example.com', rate: '8' })).toBeUndefined();
  });
});
