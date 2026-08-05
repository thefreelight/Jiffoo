import { describe, expect, it } from 'vitest';
import { buildNativeCatalogResponse } from './marketplace-mapping';

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
});
