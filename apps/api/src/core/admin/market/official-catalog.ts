import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';
import { isOfficialMarketOnly } from '@/core/admin/extension-installer/official-only';
import { compareVersions } from '@/core/admin/extension-installer/version-utils';
import { managedPackageService } from '@/core/admin/managed-package/service';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { ThemeManagementService } from '@/core/admin/theme-management/service';
import type { ThemeMeta } from '@/core/admin/theme-management/types';
import {
  OFFICIAL_LAUNCH_EXTENSIONS,
  type CommercialPackageProjection,
  type OfficialCatalogSolutionPackageMeta,
  type OfficialCatalogEntry,
  type OfficialExtensionCatalogItem as RemoteOfficialCatalogItem,
  type OfficialExtensionDeliveryMode,
  type MarketplaceListingDomain,
  type MarketplacePaymentMode,
  type MarketplaceProviderType,
  type MarketplaceSettlementTargetType,
  type OfficialPricingModel,
} from 'shared';
import { MarketClient } from './market-client';
import { checkOfficialArtifactReachable } from './official-artifact-health';
import { UpdateChecker, type MarketUpdateCheckResult } from './update-checker';

type OfficialExtensionKind = 'theme' | 'plugin';
type OfficialInstallState = 'not_installed' | 'installed' | 'enabled' | 'active';
type OfficialReleaseStatus = 'published' | 'catalog-only' | 'offline';

interface OfficialCatalogPresentationMeta {
  category: string;
  target?: 'shop' | 'admin';
}

export interface OfficialCatalogItem {
  slug: string;
  name: string;
  kind: OfficialExtensionKind;
  listingDomain: MarketplaceListingDomain;
  listingKind: OfficialExtensionKind;
  providerType: MarketplaceProviderType;
  version: string;
  author: string;
  description: string;
  category: string;
  deliveryMode: OfficialExtensionDeliveryMode;
  paymentMode: MarketplacePaymentMode;
  settlementTargetType: MarketplaceSettlementTargetType;
  settlementTargetId?: string | null;
  target?: 'shop' | 'admin';
  pricingModel: OfficialPricingModel;
  price: number;
  currency: string;
  installState: OfficialInstallState;
  releaseStatus: OfficialReleaseStatus;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market' | 'catalog';
  availableInMarket: boolean;
  marketError?: string;
  rating?: number;
  downloads?: number;
  thumbnailUrl?: string;
  compatibility?: string;
  screenshots?: string[];
  publishState?: RemoteOfficialCatalogItem['publishState'];
  installable?: boolean;
  sellableVersion?: string;
  latestVersion?: string | null;
  updateAvailable?: boolean;
  configRequired?: boolean;
  configReady?: boolean;
  missingConfigFields?: string[];
  solutionPackage?: OfficialCatalogSolutionPackageMeta | null;
}

export interface OfficialCatalogResponse {
  items: OfficialCatalogItem[];
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  managedPackage?: CommercialPackageProjection | null;
  generatedAt: string;
}

const OFFICIAL_CATALOG_META: Record<string, OfficialCatalogPresentationMeta> = {
  fire: {
    category: 'finance',
    target: 'shop',
  },
  'imagic-studio': {
    category: 'ai',
    target: 'shop',
  },
  'navtoai': {
    category: 'ai',
    target: 'shop',
  },
  modelsfind: {
    category: 'gallery',
    target: 'shop',
  },
  'ai-gateway': {
    category: 'ai',
    target: 'shop',
  },
  'esim-mall': {
    category: 'storefront',
    target: 'shop',
  },
  'quiet-curator': {
    category: 'community',
    target: 'shop',
  },
  'stellar-midnight': {
    category: 'saas',
    target: 'shop',
  },
  yevbi: {
    category: 'storefront',
    target: 'shop',
  },
  'imagic-core': {
    category: 'ai',
  },
  'quiet-curator-cms': {
    category: 'content',
  },
  'ai-gateway-core': {
    category: 'ai',
  },
  stripe: {
    category: 'payment',
  },
  i18n: {
    category: 'localization',
  },
  odoo: {
    category: 'integration',
  },
  'admin-security': {
    category: 'security',
    target: 'admin',
  },
  'partner-network': {
    category: 'operations',
    target: 'admin',
  },
  'support-hub': {
    category: 'support',
    target: 'admin',
  },
};

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeCatalogSource(source: unknown): OfficialCatalogItem['source'] {
  return source === 'builtin' ||
    source === 'installed' ||
    source === 'local-zip' ||
    source === 'official-market'
    ? source
    : 'catalog';
}

function hasVersionUpdate(currentVersion?: string | null, latestVersion?: string | null): boolean {
  if (!currentVersion || !latestVersion) {
    return false;
  }

  try {
    return compareVersions(latestVersion, currentVersion) > 0;
  } catch {
    return latestVersion !== currentVersion;
  }
}

function buildSolutionPackageMeta(
  managedPackage: CommercialPackageProjection | null | undefined,
  kind: OfficialExtensionKind,
  slug: string,
): OfficialCatalogSolutionPackageMeta | null {
  if (!managedPackage || managedPackage.offerKind !== 'theme_first_solution') {
    return null;
  }

  const included = kind === 'theme'
    ? managedPackage.includedThemes.includes(slug)
    : managedPackage.includedPlugins.includes(slug);

  if (!included) {
    return null;
  }

  const defaultTheme = kind === 'theme' && managedPackage.defaultThemeSlug === slug;

  return {
    offerKind: 'theme_first_solution',
    packageId: managedPackage.packageId,
    packageName: managedPackage.packageName,
    displayBrandName: managedPackage.displayBrandName,
    displaySolutionName: managedPackage.displaySolutionName,
    packageStatus: managedPackage.status,
    role: kind === 'theme'
      ? defaultTheme
        ? 'primary_theme'
        : 'included_theme'
      : 'companion_plugin',
    defaultTheme,
    setupStepCount: managedPackage.setupSteps.length,
  };
}

function isNonBuiltinThemeSource(
  source: OfficialCatalogItem['source'] | undefined,
): source is Exclude<OfficialCatalogItem['source'], 'builtin' | 'catalog'> {
  return source === 'installed' || source === 'local-zip' || source === 'official-market';
}

function buildInstalledOfficialThemeState(
  activeTheme: Awaited<ReturnType<typeof ThemeManagementService.getActiveTheme>>,
  installedThemes: Awaited<ReturnType<typeof ThemeManagementService.getInstalledThemes>>,
) {
  const installedBySlug = new Map<
    string,
    {
      version: string;
      source: Exclude<OfficialCatalogItem['source'], 'builtin' | 'catalog'>;
      installState: OfficialInstallState;
      themeMeta?: ThemeMeta;
    }
  >();

  for (const theme of installedThemes.items) {
    if (theme.target !== 'shop' || !isNonBuiltinThemeSource(theme.source)) {
      continue;
    }

    installedBySlug.set(theme.slug, {
      version: theme.version,
      source: theme.source,
      installState: activeTheme.slug === theme.slug && activeTheme.type === (theme.type ?? 'pack')
        ? 'active'
        : 'installed',
      themeMeta: theme,
    });
  }

  if (activeTheme.source === 'official-market' && activeTheme.type === 'pack') {
    const existing = installedBySlug.get(activeTheme.slug);
    installedBySlug.set(activeTheme.slug, {
      version: activeTheme.version,
      source: 'official-market',
      installState: 'active',
      themeMeta: existing?.themeMeta,
    });
  }

  return installedBySlug;
}

function toFallbackRemoteItem(seed: OfficialCatalogEntry): RemoteOfficialCatalogItem {
  return {
    id: `seed:${seed.slug}`,
    submissionId: `seed:${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    kind: seed.kind,
    listingDomain: seed.listingDomain,
    listingKind: seed.listingKind,
    providerType: seed.providerType,
    description: seed.description,
    author: seed.author,
    deliveryMode: seed.deliveryMode,
    paymentMode: seed.paymentMode,
    settlementTargetType: seed.settlementTargetType,
    settlementTargetId: seed.settlementTargetId ?? null,
    launchWave: seed.launchWave,
    publishState: 'draft',
    installable: false,
    featured: false,
    recommended: false,
    pricingModel: seed.defaultPricingModel,
    price: seed.defaultPricingModel === 'free' ? null : 0,
    currency: seed.defaultCurrency,
    currentVersion: seed.version,
    sellableVersion: seed.version,
    installState: 'not_installed',
    installCount: 0,
    entitlementCount: 0,
    activeEntitlementCount: 0,
    versions: [
      {
        version: seed.version,
        packageUrl: seed.packageUrl,
        minCoreVersion: seed.minCoreVersion,
        isCurrent: true,
        isSellable: true,
        createdAt: new Date(0).toISOString(),
      },
    ],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function getCatalogSeed(slug: string): OfficialCatalogEntry | undefined {
  return OFFICIAL_LAUNCH_EXTENSIONS.find((entry) => entry.slug === slug);
}

export async function getOfficialCatalog(): Promise<OfficialCatalogResponse> {
  const [connectivity, activeTheme, installedThemes, pluginPackages, managedStatus] = await Promise.all([
    MarketClient.checkConnectivity(),
    ThemeManagementService.getActiveTheme('shop'),
    ThemeManagementService.getInstalledThemes('shop'),
    PluginManagementService.getAllPluginPackages(),
    managedPackageService.getStatus().catch(() => ({ mode: 'oss' as const, package: null })),
  ]);

  const hasInstalledOfficialSurface =
    installedThemes.items.some((theme) => isNonBuiltinThemeSource(theme.source)) ||
    pluginPackages.some((plugin) => normalizeCatalogSource(plugin?.source) !== 'catalog' && normalizeCatalogSource(plugin?.source) !== 'builtin');

  const remoteCatalog = connectivity.ok
    ? await MarketClient.getOfficialCatalog(undefined, { fresh: hasInstalledOfficialSurface }).catch(() => null)
    : null;
  const cachedUpdates = remoteCatalog
    ? null
    : await UpdateChecker.getCachedResults().catch(() => null);
  const cachedUpdatesBySlug = new Map<string, MarketUpdateCheckResult>(
    (cachedUpdates || []).map((item) => [`${item.kind}:${item.slug}`, item] as const),
  );

  const remoteItemsBySlug = new Map<string, RemoteOfficialCatalogItem>(
    (remoteCatalog?.items || OFFICIAL_LAUNCH_EXTENSIONS.map(toFallbackRemoteItem)).map((item) => [
      item.slug,
      item,
    ]),
  );
  const managedPackage = managedStatus.package;

  const installedOfficialThemesBySlug = buildInstalledOfficialThemeState(activeTheme, installedThemes);
  const installedPluginsBySlug = new Map(pluginPackages.map((plugin) => [plugin.slug, plugin]));

  const items = await Promise.all(
    OFFICIAL_LAUNCH_EXTENSIONS.map(async (seed): Promise<OfficialCatalogItem> => {
      const meta = OFFICIAL_CATALOG_META[seed.slug];
      const remoteItem = remoteItemsBySlug.get(seed.slug) || toFallbackRemoteItem(seed);
      const effectiveSellableVersion = remoteItem.sellableVersion || remoteItem.currentVersion || seed.version;
      const effectiveVersionSummary = remoteItem.versions.find((candidate) => candidate.version === effectiveSellableVersion)
        || remoteItem.versions.find((candidate) => candidate.isSellable)
        || remoteItem.versions[0];
      const artifactReachable = await checkOfficialArtifactReachable(effectiveVersionSummary?.packageUrl);
      const availableInMarket = Boolean(connectivity.ok && remoteCatalog && remoteItem.installable && remoteItem.publishState === 'published');
      const marketInstallable = availableInMarket && artifactReachable;
      const releaseStatus: OfficialReleaseStatus = connectivity.ok
        ? marketInstallable
          ? 'published'
          : 'catalog-only'
        : 'offline';

      if (seed.kind === 'theme') {
        const installedThemeState = installedOfficialThemesBySlug.get(seed.slug);
        const installedVersion = installedThemeState?.version || null;
        const cachedThemeUpdate = cachedUpdatesBySlug.get(`theme:${seed.slug}`);
        const latestVersion = (!remoteCatalog ? cachedThemeUpdate?.latestVersion : null)
          || remoteItem.sellableVersion
          || remoteItem.currentVersion
          || cachedThemeUpdate?.latestVersion
          || seed.version;
        const updateAvailable = installedThemeState
          ? hasVersionUpdate(installedVersion, latestVersion)
          : cachedThemeUpdate?.hasUpdate || false;

        const installState: OfficialInstallState = installedThemeState?.installState || 'not_installed';
        const installedTheme = installedThemeState?.themeMeta || null;

        return {
          slug: seed.slug,
          name: installedTheme?.name || remoteItem.name || seed.name,
          kind: seed.kind,
          listingDomain: remoteItem.listingDomain ?? seed.listingDomain,
          listingKind: remoteItem.listingKind ?? seed.listingKind,
          providerType: remoteItem.providerType ?? seed.providerType,
          version: installedVersion || remoteItem.sellableVersion || remoteItem.currentVersion || seed.version,
          author: installedTheme?.author || remoteItem.author || seed.author,
          description: installedTheme?.description || remoteItem.description || seed.description,
          category: meta.category,
          deliveryMode: remoteItem.deliveryMode,
          paymentMode: remoteItem.paymentMode ?? seed.paymentMode,
          settlementTargetType: remoteItem.settlementTargetType ?? seed.settlementTargetType,
          settlementTargetId: remoteItem.settlementTargetId ?? seed.settlementTargetId ?? null,
          target: meta.target,
          pricingModel: remoteItem.pricingModel,
          price: remoteItem.price ?? 0,
          currency: remoteItem.currency,
          installState,
          releaseStatus,
          source: installedThemeState?.source || 'catalog',
          availableInMarket: marketInstallable,
          publishState: remoteItem.publishState,
          installable: remoteItem.installable && artifactReachable,
          sellableVersion: remoteItem.sellableVersion,
          latestVersion,
          updateAvailable,
          downloads: remoteItem.installCount,
          solutionPackage: buildSolutionPackageMeta(managedPackage, seed.kind, seed.slug),
          marketError: availableInMarket && !artifactReachable
            ? 'Official artifact is currently unavailable for installation'
            : undefined,
        };
      }

      const pluginPackage = installedPluginsBySlug.get(seed.slug);
      const defaultInstance = pluginPackage
        ? await PluginManagementService.getDefaultInstance(seed.slug)
        : null;
      const config = parseJsonObject(defaultInstance?.configJson);
      const readiness = pluginPackage
        ? evaluatePluginConfigReadiness(pluginPackage.manifestJson, config)
        : {
            requiresConfiguration: false,
            ready: true,
            missingFields: [] as string[],
          };

      const installState: OfficialInstallState = defaultInstance?.enabled
        ? 'enabled'
        : pluginPackage
          ? 'installed'
          : 'not_installed';
      const cachedPluginUpdate = cachedUpdatesBySlug.get(`plugin:${seed.slug}`);
      const latestVersion = (!remoteCatalog ? cachedPluginUpdate?.latestVersion : null)
        || remoteItem.sellableVersion
        || remoteItem.currentVersion
        || cachedPluginUpdate?.latestVersion
        || seed.version;
      const updateAvailable = pluginPackage
        ? hasVersionUpdate(pluginPackage.version, latestVersion)
        : cachedPluginUpdate?.hasUpdate || false;

      return {
        slug: seed.slug,
        name: pluginPackage?.name || remoteItem.name || seed.name,
        kind: seed.kind,
        listingDomain: remoteItem.listingDomain ?? seed.listingDomain,
        listingKind: remoteItem.listingKind ?? seed.listingKind,
        providerType: remoteItem.providerType ?? seed.providerType,
        version: pluginPackage?.version || remoteItem.sellableVersion || remoteItem.currentVersion || seed.version,
        author: pluginPackage?.author || remoteItem.author || seed.author,
        description: pluginPackage?.description || remoteItem.description || seed.description,
        category: meta.category,
        deliveryMode: remoteItem.deliveryMode,
        paymentMode: remoteItem.paymentMode ?? seed.paymentMode,
        settlementTargetType: remoteItem.settlementTargetType ?? seed.settlementTargetType,
        settlementTargetId: remoteItem.settlementTargetId ?? seed.settlementTargetId ?? null,
        pricingModel: remoteItem.pricingModel,
        price: remoteItem.price ?? 0,
        currency: remoteItem.currency,
        installState,
        releaseStatus,
        source: normalizeCatalogSource(pluginPackage?.source),
        availableInMarket: marketInstallable,
        publishState: remoteItem.publishState,
        installable: remoteItem.installable && artifactReachable,
        sellableVersion: remoteItem.sellableVersion,
        latestVersion,
        updateAvailable,
        downloads: remoteItem.installCount,
        configRequired: readiness.requiresConfiguration,
        configReady: readiness.ready,
        missingConfigFields: readiness.missingFields,
        solutionPackage: buildSolutionPackageMeta(managedPackage, seed.kind, seed.slug),
        marketError: availableInMarket && !artifactReachable
          ? 'Official artifact is currently unavailable for installation'
          : undefined,
      };
    }),
  );
  const visibleItems = managedPackage
    ? items.filter((item) =>
        item.kind === 'theme'
          ? managedPackage.includedThemes.includes(item.slug)
          : managedPackage.includedPlugins.includes(item.slug),
      )
    : connectivity.ok && remoteCatalog
      ? items.filter((item) => item.availableInMarket || item.installState !== 'not_installed')
      : items.filter((item) => item.installState !== 'not_installed');

  return {
    items: visibleItems,
    marketOnline: Boolean(connectivity.ok && remoteCatalog),
    marketError: remoteCatalog ? connectivity.error : connectivity.error || 'Official marketplace unavailable',
    officialMarketOnly: isOfficialMarketOnly(),
    managedPackage,
    generatedAt: new Date().toISOString(),
  };
}

export function getOfficialCatalogEntry(slug: string): OfficialCatalogEntry | undefined {
  return getCatalogSeed(slug);
}
