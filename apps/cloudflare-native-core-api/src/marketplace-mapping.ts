export type OfficialPricingModel = 'free' | 'one_time' | 'subscription' | 'member';

export type NativeCatalogItem = {
  slug: string;
  name?: string;
  kind?: 'plugin' | 'theme';
  listingDomain?: 'app_marketplace' | 'goods_marketplace' | 'merchant_store';
  listingKind?: 'plugin' | 'theme';
  providerType?: 'platform' | 'developer' | 'vendor' | 'merchant';
  description?: string;
  author?: string;
  category?: string;
  deliveryMode?: 'package-managed' | 'service-managed';
  paymentMode?: 'platform_collect' | 'merchant_collect';
  settlementTargetType?: 'platform' | 'developer' | 'vendor' | 'merchant' | 'none';
  settlementTargetId?: string | null;
  pricingModel?: OfficialPricingModel;
  /** `license` packages are only served by the platform after an entitlement check. */
  packageAccess?: 'public' | 'license';
  price?: number | null;
  currency?: string;
  currentVersion?: string;
  sellableVersion?: string;
  installable?: boolean;
  installCount?: number;
  iconUrl?: string | null;
  screenshots?: string[];
  versions?: Array<{ version: string; packageUrl?: string | null; minCoreVersion?: string | null; isCurrent?: boolean }>;
};

export type PlatformDeliveryCredentials = {
  licenseKey: string | null;
  connection: { instanceId: string; instanceToken: string; tenantBindingId: string; localStoreId: string } | null;
};

/**
 * Whether installing this item needs the platform to confirm an entitlement.
 * Only the platform saying `free` skips the check; anything else — including a
 * missing pricing model — is treated as non-free.
 */
export function requiresPlatformEntitlement(item: Pick<NativeCatalogItem, 'pricingModel' | 'packageAccess'>): boolean {
  return item.packageAccess === 'license' || item.pricingModel !== 'free';
}

/** The platform route that serves an official package after checking credentials. */
export function officialPackageRoute(kind: 'theme' | 'plugin', slug: string, version: string): string {
  return `/marketplace/official/package/${kind}/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** A Pro membership license key kept in the instance's system settings. */
export function parseStoredLicenseSettings(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { platformLicenseKey?: unknown };
    const key = text(parsed.platformLicenseKey);
    return /^JIF-[A-Z0-9-]{4,80}$/.test(key) ? key : null;
  } catch {
    return null;
  }
}

/** The instance's platform connection (device-authorised account + store binding). */
export function parsePlatformConnection(raw: string | null | undefined): PlatformDeliveryCredentials['connection'] {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as { instance?: unknown; tenantBinding?: unknown };
    const instance = (state.instance && typeof state.instance === 'object' ? state.instance : {}) as Record<string, unknown>;
    const binding = (state.tenantBinding && typeof state.tenantBinding === 'object' ? state.tenantBinding : {}) as Record<string, unknown>;
    const connection = {
      instanceId: text(instance.instanceId),
      instanceToken: text(instance.instanceToken),
      tenantBindingId: text(binding.tenantBindingId),
      localStoreId: text(binding.localStoreId),
    };
    return Object.values(connection).every(Boolean) ? connection : null;
  } catch {
    return null;
  }
}

/** Credential headers understood by the platform's package route; empty when nothing is configured. */
export function deliveryRequestHeaders(credentials: PlatformDeliveryCredentials): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (credentials.licenseKey) headers['x-jiffoo-license-key'] = credentials.licenseKey;
  if (credentials.connection) {
    headers['x-jiffoo-instance-id'] = credentials.connection.instanceId;
    headers['x-jiffoo-instance-token'] = credentials.connection.instanceToken;
    headers['x-jiffoo-tenant-binding-id'] = credentials.connection.tenantBindingId;
    headers['x-jiffoo-local-store-id'] = credentials.connection.localStoreId;
  }
  return headers;
}

const GROWTH_SLUG_CATEGORIES: Record<string, string> = {
  'visitor-identification': 'marketing',
  'lead-capture': 'marketing',
  'competitor-watch': 'marketing',
  'abm-pages': 'marketing',
  'ad-creative': 'marketing',
  'programmatic-seo': 'seo',
  'aeo-booster': 'seo',
  'experiments': 'analytics',
  'funnel-insights': 'analytics',
  'email-campaigns': 'email',
  'agentra-connect': 'integration',
  'hubspot-sync': 'integration',
};

function category(item: NativeCatalogItem): string {
  if (item.kind === 'theme') return 'storefront';
  if (item.category) return item.category;
  if (GROWTH_SLUG_CATEGORIES[item.slug]) return GROWTH_SLUG_CATEGORIES[item.slug];
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
