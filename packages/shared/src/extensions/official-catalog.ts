export type OfficialExtensionKind = 'theme' | 'plugin';

export type MarketplaceListingDomain =
  | 'app_marketplace'
  | 'goods_marketplace'
  | 'merchant_store';

export type MarketplaceProviderType =
  | 'platform'
  | 'developer'
  | 'vendor'
  | 'merchant';

export type MarketplacePaymentMode =
  | 'platform_collect'
  | 'merchant_collect';

export type MarketplaceSettlementTargetType =
  | 'platform'
  | 'developer'
  | 'vendor'
  | 'merchant'
  | 'none';

export type OfficialExtensionDeliveryMode =
  | 'package-managed'
  | 'service-managed';

export type OfficialArtifactKind =
  | 'theme-package'
  | 'plugin-package'
  | 'service-descriptor';

export type OfficialPricingModel = 'free' | 'one_time' | 'subscription';

export type OfficialPublishState = 'draft' | 'published' | 'unpublished' | 'blocked';

export type OfficialCatalogInstallState =
  | 'not_installed'
  | 'installed'
  | 'enabled'
  | 'active';

export interface OfficialCatalogSolutionOffer {
  offerKind: 'theme_first_solution';
  packageId?: string | null;
  role: 'primary_theme' | 'included_theme' | 'companion_plugin';
  badgeLabel?: string | null;
  ctaLabel?: string | null;
  summary?: string | null;
}

export type OfficialCatalogSolutionRole =
  | 'primary_theme'
  | 'included_theme'
  | 'companion_plugin';

export interface OfficialCatalogSolutionPackageMeta {
  offerKind: 'theme_first_solution';
  packageId: string;
  packageName: string;
  displayBrandName: string;
  displaySolutionName: string;
  packageStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  role: OfficialCatalogSolutionRole;
  defaultTheme: boolean;
  setupStepCount: number;
}

export interface OfficialCatalogEntry {
  slug: string;
  name: string;
  kind: OfficialExtensionKind;
  target?: 'shop' | 'admin';
  listingDomain: MarketplaceListingDomain;
  listingKind: OfficialExtensionKind;
  providerType: MarketplaceProviderType;
  version: string;
  author: string;
  description: string;
  deliveryMode: OfficialExtensionDeliveryMode;
  paymentMode: MarketplacePaymentMode;
  settlementTargetType: MarketplaceSettlementTargetType;
  settlementTargetId?: string | null;
  artifactKind: OfficialArtifactKind;
  launchWave: 'official-extensions-go-live-v1';
  packageUrl: string;
  thumbnailUrl?: string | null;
  screenshots?: string[];
  iconName?: string | null;
  iconUrl?: string | null;
  releaseNotesUrl?: string | null;
  minCoreVersion: string;
  defaultPricingModel: OfficialPricingModel;
  defaultCurrency: string;
  pricingConfigured: boolean;
}

export interface OfficialExtensionVersionSummary {
  version: string;
  packageUrl: string;
  changelog?: string | null;
  minCoreVersion?: string | null;
  isCurrent: boolean;
  isSellable: boolean;
  createdAt: string;
}

export interface OfficialExtensionCatalogItem {
  id: string;
  submissionId: string;
  slug: string;
  name: string;
  kind: OfficialExtensionKind;
  target?: 'shop' | 'admin';
  listingDomain: MarketplaceListingDomain;
  listingKind: OfficialExtensionKind;
  providerType: MarketplaceProviderType;
  description: string;
  author: string;
  thumbnailUrl?: string | null;
  screenshots?: string[];
  iconName?: string | null;
  iconUrl?: string | null;
  releaseNotesUrl?: string | null;
  deliveryMode: OfficialExtensionDeliveryMode;
  paymentMode: MarketplacePaymentMode;
  settlementTargetType: MarketplaceSettlementTargetType;
  settlementTargetId?: string | null;
  launchWave: string;
  publishState: OfficialPublishState;
  installable: boolean;
  featured: boolean;
  recommended: boolean;
  pricingModel: OfficialPricingModel;
  price: number | null;
  currency: string;
  currentVersion: string;
  sellableVersion: string;
  installState: OfficialCatalogInstallState;
  installCount: number;
  entitlementCount: number;
  activeEntitlementCount: number;
  solutionOffer?: OfficialCatalogSolutionOffer | null;
  solutionPackage?: OfficialCatalogSolutionPackageMeta | null;
  versions: OfficialExtensionVersionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface OfficialExtensionCatalogSummary {
  total: number;
  published: number;
  installable: number;
  blocked: number;
  themes: number;
  plugins: number;
  free: number;
  paid: number;
  subscription: number;
  totalInstalls: number;
  totalEntitlements: number;
  activeEntitlements: number;
}

export interface OfficialExtensionCatalogResponse {
  items: OfficialExtensionCatalogItem[];
  summary: OfficialExtensionCatalogSummary;
}

export interface OfficialInstallAuthorizationRequest {
  userId: string;
  version?: string;
  instanceId?: string;
  instanceToken?: string;
  platformAccountId?: string;
  tenantBindingId?: string;
  localStoreId?: string;
}

export interface OfficialInstallEntitlement {
  required: boolean;
  status: 'not_required' | 'granted' | 'denied';
  pricingModel: OfficialPricingModel;
  licenseId?: string | null;
  licenseType?: 'PERPETUAL' | 'SUBSCRIPTION' | 'TRIAL' | null;
  expiresAt?: string | null;
  reason?: string | null;
}

export interface OfficialInstallAuthorizationResponse {
  allowed: boolean;
  slug: string;
  kind: OfficialExtensionKind;
  listingDomain?: MarketplaceListingDomain;
  listingKind?: OfficialExtensionKind;
  providerType?: MarketplaceProviderType;
  deliveryMode: OfficialExtensionDeliveryMode;
  paymentMode?: MarketplacePaymentMode;
  settlementTargetType?: MarketplaceSettlementTargetType;
  settlementTargetId?: string | null;
  artifactKind: OfficialArtifactKind;
  version: string;
  packageUrl: string;
  checksumUrl?: string | null;
  signatureUrl?: string | null;
  minCoreVersion?: string | null;
  pricingModel: OfficialPricingModel;
  price: number | null;
  currency: string;
  entitlement: OfficialInstallEntitlement;
  reason?: string;
}

export interface OfficialInstallRecordRequest {
  userId: string;
  version: string;
  instanceId?: string;
  instanceToken?: string;
  tenantBindingId?: string;
  localStoreId?: string;
}

export interface OfficialExtensionLicenseSummary {
  id: string;
  submissionId: string;
  extensionSlug: string;
  extensionName: string;
  userId: string;
  licenseKey: string;
  type: 'PERPETUAL' | 'SUBSCRIPTION' | 'TRIAL';
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  maxSites: number;
  activeSites: number;
  orderId?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficialExtensionLicenseResponse {
  items: OfficialExtensionLicenseSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
    suspended: number;
  };
}

export interface UpdateOfficialExtensionInput {
  publishState?: OfficialPublishState;
  installable?: boolean;
  featured?: boolean;
  recommended?: boolean;
  pricingModel?: OfficialPricingModel;
  price?: number | null;
  currency?: string;
  sellableVersion?: string;
  solutionOffer?: OfficialCatalogSolutionOffer | null;
}

export const OFFICIAL_LAUNCH_EXTENSIONS: OfficialCatalogEntry[] = [
  {
    slug: 'fire',
    name: 'Fire Theme',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official finance-first theme pack with an upload-driven FIRE dashboard for mixed personal and company balance sheets.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/fire/0.1.0.jtheme',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'imagic-studio',
    name: 'Imagic Studio',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Cinematic creator storefront for imagic.art with image restyling and video transformation flows.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/imagic-studio/0.1.0.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/imagic-studio',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/imagic-studio/0.1.0/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'navtoai',
    name: 'NavToAI',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Editorial AI navigation storefront theme for curated tool catalogs and workflow directories.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/navtoai/0.1.0.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/navtoai',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/navtoai/0.1.0/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'modelsfind',
    name: 'ModelsFind',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.2',
    author: 'Jiffoo',
    description: 'Official dark booking-first storefront theme for premium model directories, private shortlist flows, coordinated desktop/mobile layouts, and AI-assisted editorial discovery.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/modelsfind/0.1.2.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/modelsfind',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/modelsfind/0.1.2/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'ai-gateway',
    name: 'AI Gateway Theme',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official theme-first storefront surface for the AI Gateway solution package.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/ai-gateway/0.1.0.jtheme',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'esim-mall',
    name: 'eSIM Mall',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '1.0.0',
    author: 'Jiffoo',
    description: 'Official downloadable storefront theme package for digital eSIM sales.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/esim-mall/1.0.0.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/esim-mall',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/esim-mall/1.0.0/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'yevbi',
    name: 'Yevbi',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '1.0.0',
    author: 'Jiffoo',
    description: 'Official downloadable storefront theme package with a travel-focused design language.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/yevbi/1.0.0.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/yevbi',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/yevbi/1.0.0/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'quiet-curator',
    name: 'Quiet Curator',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official editorial membership storefront theme for paid communities, premium archives, and calm member dashboards.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/quiet-curator/0.1.0.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/quiet-curator',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/quiet-curator/0.1.0/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'stellar-midnight',
    name: 'Stellar Midnight',
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official dark SaaS storefront theme for control-room launches, onboarding dashboards, and pricing-led product sites.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'theme-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/themes/stellar-midnight/0.1.0.jtheme',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/packages/shop-themes/stellar-midnight',
    thumbnailUrl: 'https://market.jiffoo.com/artifacts/themes/stellar-midnight/0.1.0/assets/thumbnail.svg',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'imagic-core',
    name: 'Imagic Core',
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official creative runtime plugin for imagic.art image restyling and async video transformation.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/imagic-core/0.1.0.jplugin',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'quiet-curator-cms',
    name: 'Quiet Curator CMS',
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official companion CMS plugin for Quiet Curator archive content, discussion payloads, and member dashboards.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/quiet-curator-cms/0.1.0.jplugin',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'ai-gateway-core',
    name: 'AI Gateway Core',
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official companion runtime plugin for the AI Gateway solution package.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/ai-gateway-core/0.1.0.jplugin',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'stripe',
    name: 'Stripe Payment Gateway',
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '1.0.0',
    author: 'Jiffoo',
    description: 'Official Stripe payment integration for Jiffoo stores. Supports credit/debit card payments, refunds, and webhook-based status tracking.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/stripe/1.0.0.jplugin',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/extensions/plugins/stripe',
    iconName: 'credit-card',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'i18n',
    name: 'Store Localization',
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '1.0.0',
    author: 'Jiffoo',
    description: 'Official internationalization plugin. Manages content translations, UI text overrides, and language configuration.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/i18n/1.0.0.jplugin',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/extensions/plugins/i18n',
    iconName: 'languages',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'odoo',
    name: 'Odoo',
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '1.0.0',
    author: 'Jiffoo',
    description: 'Odoo product and fulfillment integration for esim-mall theme',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/odoo/1.0.0.jplugin',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/extensions/plugins/odoo',
    iconName: 'package',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'admin-security',
    name: 'Admin Security',
    kind: 'plugin',
    target: 'admin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official commercial operator plugin for enforced admin 2FA, backup codes, and security policy management.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/admin-security/0.1.0.jplugin',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/extensions/plugins/admin-security',
    iconName: 'shield',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'partner-network',
    name: 'Partner Network',
    kind: 'plugin',
    target: 'admin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official commercial operator plugin for partner attribution, channel pricing, and commission ledgers.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/partner-network/0.1.0.jplugin',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/extensions/plugins/partner-network',
    iconName: 'handshake',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
  {
    slug: 'support-hub',
    name: 'Support Hub',
    kind: 'plugin',
    target: 'admin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    version: '0.1.0',
    author: 'Jiffoo',
    description: 'Official commercial operator plugin for Telegram first support inbox workflows and retained transcripts.',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    artifactKind: 'plugin-package',
    launchWave: 'official-extensions-go-live-v1',
    packageUrl: 'https://market.jiffoo.com/artifacts/plugins/support-hub/0.1.0.jplugin',
    releaseNotesUrl: 'https://github.com/thefreelight/jiffoo-extensions-official/tree/master/extensions/plugins/support-hub',
    iconName: 'life-buoy',
    minCoreVersion: '0.2.0',
    defaultPricingModel: 'free',
    defaultCurrency: 'USD',
    pricingConfigured: false,
  },
];

export function getOfficialLaunchExtensions(): OfficialCatalogEntry[] {
  return [...OFFICIAL_LAUNCH_EXTENSIONS];
}
