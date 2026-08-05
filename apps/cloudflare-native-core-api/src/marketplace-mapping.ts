export type NativeCatalogItem = {
  slug: string;
  name?: string;
  kind?: 'plugin' | 'theme';
  listingDomain?: 'app_marketplace' | 'goods_marketplace' | 'merchant_store';
  listingKind?: 'plugin' | 'theme';
  providerType?: 'platform' | 'developer' | 'vendor' | 'merchant';
  description?: string;
  author?: string;
  deliveryMode?: 'package-managed' | 'service-managed';
  paymentMode?: 'platform_collect' | 'merchant_collect';
  settlementTargetType?: 'platform' | 'developer' | 'vendor' | 'merchant' | 'none';
  settlementTargetId?: string | null;
  pricingModel?: 'free' | 'one_time' | 'subscription';
  price?: number | null;
  currency?: string;
  currentVersion?: string;
  sellableVersion?: string;
  installable?: boolean;
  installCount?: number;
  iconUrl?: string | null;
  screenshots?: string[];
  versions?: Array<{ version: string; packageUrl?: string; minCoreVersion?: string | null; isCurrent?: boolean }>;
};

function category(item: NativeCatalogItem): string {
  if (item.kind === 'theme') return 'storefront';
  if (/stripe|payment|pay/i.test(item.slug)) return 'payment';
  if (/mail|smtp|email/i.test(item.slug)) return 'email';
  if (/ship/i.test(item.slug)) return 'shipping';
  if (/odoo|integration/i.test(item.slug)) return 'integration';
  return 'extensions';
}

export function buildNativeCatalogResponse(items: NativeCatalogItem[], installed: Map<string, boolean>) {
  return {
    items: items.map((item) => {
      const enabled = installed.get(item.slug);
      const version = item.sellableVersion || item.currentVersion || item.versions?.find((entry) => entry.isCurrent)?.version || '0.0.1';
      const versionInfo = item.versions?.find((entry) => entry.version === version) || item.versions?.[0];
      return {
        slug: item.slug,
        name: item.name || item.slug,
        kind: item.kind || 'plugin',
        listingDomain: item.listingDomain || 'app_marketplace',
        listingKind: item.listingKind || item.kind || 'plugin',
        providerType: item.providerType || 'platform',
        version,
        author: item.author || 'Jiffoo',
        description: item.description || '',
        category: category(item),
        deliveryMode: item.deliveryMode || 'package-managed',
        paymentMode: item.paymentMode || 'platform_collect',
        settlementTargetType: item.settlementTargetType || 'platform',
        settlementTargetId: item.settlementTargetId || 'platform:jiffoo',
        pricingModel: item.pricingModel || 'free',
        price: item.price || 0,
        currency: item.currency || 'USD',
        installState: enabled === undefined ? 'not_installed' : enabled ? 'enabled' : 'installed',
        releaseStatus: item.installable ? 'published' : 'catalog-only',
        source: enabled === undefined ? 'official-market' : 'installed',
        availableInMarket: Boolean(item.installable),
        thumbnailUrl: item.iconUrl || undefined,
        screenshots: item.screenshots || [],
        installedVersion: enabled === undefined ? null : version,
        sellableVersion: item.sellableVersion || version,
        latestVersion: version,
        artifactPackageUrl: versionInfo?.packageUrl || null,
        updateAvailable: false,
        downloads: item.installCount || 0,
      };
    }),
    marketOnline: true,
    marketError: undefined,
    officialMarketOnly: true,
    managedPackage: null,
    generatedAt: new Date().toISOString(),
  };
}
