import { describe, expect, it } from 'vitest';
import {
  buildNativeCatalogResponse,
  deliveryRequestHeaders,
  officialPackageRoute,
  parsePlatformConnection,
  parseStoredLicenseSettings,
  requiresPlatformEntitlement,
} from './marketplace-mapping';

describe('non-free official extension gating', () => {
  it('only an explicit free answer from the platform skips the entitlement check', () => {
    expect(requiresPlatformEntitlement({ pricingModel: 'free' })).toBe(false);
    expect(requiresPlatformEntitlement({ pricingModel: 'free', packageAccess: 'license' })).toBe(true);
    for (const pricingModel of ['member', 'one_time', 'subscription', undefined]) {
      expect(requiresPlatformEntitlement({ pricingModel }), String(pricingModel)).toBe(true);
    }
  });

  it('lets anyone install an item the platform marks as having a free base', () => {
    expect(requiresPlatformEntitlement({ pricingModel: 'member', packageAccess: 'license', freeBase: true })).toBe(false);
    // Only the platform's explicit flag does it; a missing or a falsy flag changes nothing.
    expect(requiresPlatformEntitlement({ pricingModel: 'member', packageAccess: 'license' })).toBe(true);
    expect(requiresPlatformEntitlement({ pricingModel: 'member', packageAccess: 'license', freeBase: false })).toBe(true);
  });

  it('passes the free-base flag on to the admin catalog', () => {
    const response = buildNativeCatalogResponse([
      { slug: 'traffic-analytics', kind: 'plugin', pricingModel: 'member', packageAccess: 'license', freeBase: true },
      { slug: 'wallet', kind: 'plugin', pricingModel: 'member', packageAccess: 'license' },
    ], new Map());
    expect(response.items.map((item) => (item as { freeBase?: boolean }).freeBase)).toEqual([true, false]);
  });

  it('builds the authorized package route for themes and plugins', () => {
    expect(officialPackageRoute('theme', 'navtoai', '0.2.8')).toBe('/marketplace/official/package/theme/navtoai/0.2.8');
    expect(officialPackageRoute('plugin', 'wallet', '0.2.0')).toBe('/marketplace/official/package/plugin/wallet/0.2.0');
  });

  it('reads a membership license key from the system settings', () => {
    const key = `JIF-${'A'.repeat(32)}`;
    expect(parseStoredLicenseSettings(JSON.stringify({ platformLicenseKey: key, other: 1 }))).toBe(key);
    expect(parseStoredLicenseSettings(JSON.stringify({ platformLicenseKey: 'not-a-key' }))).toBeNull();
    expect(parseStoredLicenseSettings(JSON.stringify({}))).toBeNull();
    expect(parseStoredLicenseSettings('not json')).toBeNull();
    expect(parseStoredLicenseSettings(null)).toBeNull();
  });

  it('reads a complete platform connection and ignores a partial one', () => {
    const state = { instance: { instanceId: 'inst-1', instanceToken: 'tok-1', instanceName: 'shop' }, tenantBinding: { tenantBindingId: 'bind-1', localStoreId: 'store-1' } };
    expect(parsePlatformConnection(JSON.stringify(state))).toEqual({ instanceId: 'inst-1', instanceToken: 'tok-1', tenantBindingId: 'bind-1', localStoreId: 'store-1' });
    expect(parsePlatformConnection(JSON.stringify({ instance: state.instance }))).toBeNull();
    expect(parsePlatformConnection('not json')).toBeNull();
    expect(parsePlatformConnection(null)).toBeNull();
  });

  it('sends only the credentials the instance actually has', () => {
    expect(deliveryRequestHeaders({ licenseKey: null, connection: null })).toEqual({ accept: 'application/json' });
    expect(deliveryRequestHeaders({ licenseKey: `JIF-${'B'.repeat(32)}`, connection: null })).toEqual({ accept: 'application/json', 'x-jiffoo-license-key': `JIF-${'B'.repeat(32)}` });
    expect(Object.keys(deliveryRequestHeaders({ licenseKey: null, connection: { instanceId: 'i', instanceToken: 't', tenantBindingId: 'b', localStoreId: 's' } })).sort()).toEqual([
      'accept', 'x-jiffoo-instance-id', 'x-jiffoo-instance-token', 'x-jiffoo-local-store-id', 'x-jiffoo-tenant-binding-id',
    ]);
  });

  it('passes the member pricing model and license marker through to Merchant Admin', () => {
    const result = buildNativeCatalogResponse([
      { slug: 'wallet', kind: 'plugin', installable: true, pricingModel: 'member', price: 99, currency: 'USD', packageAccess: 'license' },
      { slug: 'coupon', kind: 'plugin', installable: true, pricingModel: 'free' },
    ], new Map());
    expect(result.items[0]).toMatchObject({ slug: 'wallet', pricingModel: 'member', price: 99 });
    expect(result.items[1]).toMatchObject({ slug: 'coupon', pricingModel: 'free' });
  });
});

describe('buildNativeCatalogResponse', () => {
  it('maps platform catalog fields and local plugin state for Merchant Admin', () => {
    const result = buildNativeCatalogResponse([
      {
        slug: 'stripe',
        name: 'Stripe Payment Gateway',
        kind: 'plugin',
        currentVersion: '1.0.2',
        sellableVersion: '1.0.2',
        installable: true,
        pricingModel: 'free',
        currency: 'USD',
        versions: [{ version: '1.0.2', packageUrl: 'https://get.jiffoo.com/stripe.jplugin', isCurrent: true }],
      },
      {
        slug: 'imagic-studio',
        name: 'Imagic Studio',
        kind: 'theme',
        currentVersion: '0.1.0',
        installable: true,
      },
    ], new Map([['stripe', true]]));

    expect(result.marketOnline).toBe(true);
    expect(result.officialMarketOnly).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      slug: 'stripe',
      installState: 'enabled',
      releaseStatus: 'published',
      category: 'payment',
      artifactPackageUrl: 'https://get.jiffoo.com/stripe.jplugin',
    });
    expect(result.items[1]).toMatchObject({
      slug: 'imagic-studio',
      kind: 'theme',
      installState: 'not_installed',
      category: 'storefront',
    });
  });

  it('prefers the platform-declared category over the slug heuristic', () => {
    const result = buildNativeCatalogResponse([
      {
        slug: 'hermes-bridge',
        kind: 'plugin',
        category: 'integration',
        installable: true,
      },
      {
        slug: 'paywall-tunables',
        kind: 'plugin',
        category: 'content',
        installable: true,
      },
    ], new Map());

    expect(result.items[0]).toMatchObject({ slug: 'hermes-bridge', category: 'integration' });
    expect(result.items[1]).toMatchObject({ slug: 'paywall-tunables', category: 'content' });
  });
});
