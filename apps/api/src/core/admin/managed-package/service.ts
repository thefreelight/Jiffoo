import crypto from 'crypto';
import { activateTheme, ThemeManagementService } from '@/core/admin/theme-management/service';
import { MarketClient } from '@/core/admin/market/market-client';
import { cleanupDownloadedArtifact, downloadArtifactWithResume } from '@/core/admin/market/resumable-downloader';
import { verifyOfficialArtifact } from '@/core/admin/market/artifact-verification';
import { installOfficialMarketExtension } from '@/core/admin/market/install-handoff';
import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import type {
  CommercialPackageOfferKind,
  CommercialPackageReadiness,
  ManagedPackageBrandingResponse,
  CommercialPackageProjection,
  CommercialPackageSetupStep,
  ManagedPackageStatusResponse,
} from 'shared';

const MANAGED_PACKAGE_SETTINGS_KEY = 'commercial.managedPackage';
const MANAGED_PACKAGE_INSTANCE_KEY = 'commercial.managedPackage.instanceKey';

type StoredManagedPackage = {
  activationCode: string;
  package: CommercialPackageProjection;
  syncedAt: string;
};

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function normalizeStoredRecord(value: unknown): StoredManagedPackage | null {
  if (!isObject(value) || typeof value.activationCode !== 'string' || !isObject(value.package)) {
    return null;
  }

  const rawPackage = value.package as Record<string, any>;
  const offerKind: CommercialPackageOfferKind =
    rawPackage.offerKind === 'theme_first_solution' ? 'theme_first_solution' : 'standard';
  const setupSteps: CommercialPackageSetupStep[] = Array.isArray(rawPackage.setupSteps)
    ? rawPackage.setupSteps
        .filter((item): item is CommercialPackageSetupStep => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : '',
          title: typeof item.title === 'string' ? item.title : '',
          description: typeof item.description === 'string' ? item.description : null,
          href: typeof item.href === 'string' ? item.href : null,
          ctaLabel: typeof item.ctaLabel === 'string' ? item.ctaLabel : null,
          surface: typeof item.surface === 'string' ? item.surface : null,
        }))
        .filter((item) => item.id && item.title)
    : [];

  return {
    activationCode: value.activationCode,
    package: {
      ...(value.package as CommercialPackageProjection),
      offerKind,
      setupSteps,
    },
    syncedAt: typeof value.syncedAt === 'string' ? value.syncedAt : new Date().toISOString(),
  };
}

export class ManagedPackageService {
  async ensureInstanceKey(): Promise<string> {
    const existing = await systemSettingsService.getString(MANAGED_PACKAGE_INSTANCE_KEY, '');
    if (existing) {
      return existing;
    }

    const next = crypto.randomUUID();
    await systemSettingsService.setSetting(MANAGED_PACKAGE_INSTANCE_KEY, next);
    return next;
  }

  private async readRecord(): Promise<StoredManagedPackage | null> {
    return normalizeStoredRecord(await systemSettingsService.getSetting(MANAGED_PACKAGE_SETTINGS_KEY));
  }

  private async writeRecord(record: StoredManagedPackage | null): Promise<void> {
    if (!record) {
      await systemSettingsService.resetSetting(MANAGED_PACKAGE_SETTINGS_KEY);
      return;
    }

    await systemSettingsService.setSetting(MANAGED_PACKAGE_SETTINGS_KEY, record);
  }

  async activate(activationCode: string, siteUrl?: string | null): Promise<ManagedPackageStatusResponse> {
    const instanceKey = await this.ensureInstanceKey();
    const remote = await MarketClient.activateCommercialPackage({
      activationCode,
      instanceKey,
      siteUrl: siteUrl ?? null,
    });

    if (!remote.found || !remote.package) {
      throw new Error(remote.reason || 'Activation code not found');
    }

    if (remote.package.status === 'REVOKED') {
      await this.revertToOss();
      return { mode: 'oss', package: null };
    }

    const nextRecord: StoredManagedPackage = {
      activationCode: remote.package.activationCode,
      package: remote.package,
      syncedAt: new Date().toISOString(),
    };
    await this.writeRecord(nextRecord);
    await this.syncIncludedAssets(remote.package);
    await this.applyDefaultTheme(remote.package);
    const readiness = await this.computeReadiness(remote.package);

    return {
      mode: 'managed',
      package: remote.package,
      readiness,
    };
  }

  async getStatus(siteUrl?: string | null): Promise<ManagedPackageStatusResponse> {
    const current = await this.readRecord();
    if (!current) {
      return { mode: 'oss', package: null, readiness: null };
    }

    const instanceKey = await this.ensureInstanceKey();
    let remote;
    try {
      remote = await MarketClient.activateCommercialPackage({
        activationCode: current.activationCode,
        instanceKey,
        siteUrl: siteUrl ?? null,
      });
    } catch {
      return {
        mode: 'managed',
        package: current.package,
        readiness: await this.computeReadiness(current.package),
      };
    }

    if (!remote.found || !remote.package || remote.package.status === 'REVOKED') {
      await this.revertToOss();
      return { mode: 'oss', package: null, readiness: null };
    }

    const nextRecord: StoredManagedPackage = {
      activationCode: remote.package.activationCode,
      package: remote.package,
      syncedAt: new Date().toISOString(),
    };
    await this.writeRecord(nextRecord);

    const readiness = await this.computeReadiness(remote.package);
    return {
      mode: 'managed',
      package: remote.package,
      readiness,
    };
  }

  async getBranding(): Promise<ManagedPackageBrandingResponse> {
    const current = await this.readRecord();
    if (!current || current.package.status === 'REVOKED') {
      return {
        mode: 'oss',
        displayBrandName: null,
        displaySolutionName: null,
      };
    }

    return {
      mode: 'managed',
      displayBrandName: current.package.displayBrandName,
      displaySolutionName: current.package.displaySolutionName,
    };
  }

  async provision(siteUrl?: string | null): Promise<ManagedPackageStatusResponse> {
    const currentStatus = await this.getStatus(siteUrl);
    if (currentStatus.mode !== 'managed' || !currentStatus.package) {
      throw new Error('No managed package is active');
    }

    if (currentStatus.package.status === 'SUSPENDED') {
      throw new Error('Managed package provisioning is disabled while the package is suspended');
    }

    await this.syncIncludedAssets(currentStatus.package);
    await this.applyDefaultTheme(currentStatus.package);

    return {
      ...currentStatus,
      readiness: await this.computeReadiness(currentStatus.package),
    };
  }

  async revertToOss(): Promise<void> {
    await this.writeRecord(null);
    try {
      await activateTheme('builtin-default', 'shop');
    } catch {
      // Keep OSS revert best-effort; activation state should still clear.
    }
  }

  private async applyDefaultTheme(pkg: CommercialPackageProjection): Promise<void> {
    if (!pkg.defaultThemeSlug) {
      return;
    }

    try {
      await activateTheme(pkg.defaultThemeSlug, 'shop');
    } catch {
      // Managed activation should not fail purely because a preferred theme
      // is missing or cannot be activated yet. The package state stays active
      // and Admin can still surface the included assets.
    }
  }

  private async syncIncludedAssets(pkg: CommercialPackageProjection): Promise<void> {
    if (pkg.offerKind !== 'theme_first_solution') {
      return;
    }

    for (const asset of pkg.assets.filter((item) => item.includedByDefault)) {
      try {
        if (asset.kind === 'theme') {
          await this.ensureThemeInstalled(asset.slug, pkg.defaultThemeSlug === asset.slug);
        } else {
          await this.ensurePluginInstalled(asset.slug);
        }
      } catch (error) {
        console.warn(
          `[ManagedPackage] Failed to preinstall ${asset.kind}:${asset.slug} for package ${pkg.packageId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  private async ensureThemeInstalled(slug: string, activateAfterInstall: boolean): Promise<void> {
    const installedThemes = await ThemeManagementService.getInstalledThemes('shop');
    if (installedThemes.items.some((theme) => theme.slug === slug)) {
      return;
    }

    const detail = await MarketClient.getOfficialDetail(slug);
    const requestedVersion = detail.sellableVersion;
    const versionSummary = detail.versions.find((item) => item.version === requestedVersion);

    if (!versionSummary?.packageUrl) {
      throw new Error(`No sellable package artifact found for theme "${slug}"`);
    }

    const downloadResult = await downloadArtifactWithResume({
      slug,
      version: requestedVersion,
      url: versionSummary.packageUrl,
    });

    try {
      const artifactVerification = await verifyOfficialArtifact({
        filePath: downloadResult.filePath,
        packageUrl: versionSummary.packageUrl,
        checksumUrl: `${versionSummary.packageUrl}.sha256`,
        signatureUrl: `${versionSummary.packageUrl}.sig`,
      });

      await installOfficialMarketExtension({
        kind: 'theme-shop',
        artifactPath: downloadResult.filePath,
        artifactVerification,
        activate: activateAfterInstall,
        requestedVersion,
        packageUrl: versionSummary.packageUrl,
        listingDomain: detail.listingDomain,
        listingKind: detail.listingKind,
        providerType: detail.providerType,
        deliveryMode: detail.deliveryMode,
        paymentMode: detail.paymentMode,
        settlementTargetType: detail.settlementTargetType,
        settlementTargetId: detail.settlementTargetId ?? null,
        entitlement: {
          required: false,
          status: 'not_required',
          pricingModel: detail.pricingModel,
        },
      });
    } finally {
      await cleanupDownloadedArtifact(slug, requestedVersion).catch(() => undefined);
    }
  }

  private async ensurePluginInstalled(slug: string): Promise<void> {
    const existing = await PluginManagementService.getPluginPackage(slug);
    if (existing) {
      return;
    }

    const detail = await MarketClient.getOfficialDetail(slug);
    const requestedVersion = detail.sellableVersion;
    const versionSummary = detail.versions.find((item) => item.version === requestedVersion);

    if (!versionSummary?.packageUrl) {
      throw new Error(`No sellable package artifact found for plugin "${slug}"`);
    }

    const downloadResult = await downloadArtifactWithResume({
      slug,
      version: requestedVersion,
      url: versionSummary.packageUrl,
    });

    try {
      const artifactVerification = await verifyOfficialArtifact({
        filePath: downloadResult.filePath,
        packageUrl: versionSummary.packageUrl,
        checksumUrl: `${versionSummary.packageUrl}.sha256`,
        signatureUrl: `${versionSummary.packageUrl}.sig`,
      });

      await installOfficialMarketExtension({
        kind: 'plugin',
        artifactPath: downloadResult.filePath,
        artifactVerification,
        requestedVersion,
        packageUrl: versionSummary.packageUrl,
        listingDomain: detail.listingDomain,
        listingKind: detail.listingKind,
        providerType: detail.providerType,
        deliveryMode: detail.deliveryMode,
        paymentMode: detail.paymentMode,
        settlementTargetType: detail.settlementTargetType,
        settlementTargetId: detail.settlementTargetId ?? null,
        entitlement: {
          required: false,
          status: 'not_required',
          pricingModel: detail.pricingModel,
        },
      });
    } finally {
      await cleanupDownloadedArtifact(slug, requestedVersion).catch(() => undefined);
    }
  }

  private async computeReadiness(pkg: CommercialPackageProjection): Promise<CommercialPackageReadiness> {
    const includedThemes = pkg.assets
      .filter((asset) => asset.kind === 'theme' && asset.includedByDefault)
      .map((asset) => asset.slug);
    const includedPlugins = pkg.assets
      .filter((asset) => asset.kind === 'plugin' && asset.includedByDefault)
      .map((asset) => asset.slug);

    const [installedThemes, activeTheme] = await Promise.all([
      ThemeManagementService.getInstalledThemes('shop'),
      ThemeManagementService.getActiveTheme('shop'),
    ]);

    const installedThemeSlugs = new Set(installedThemes.items.map((theme) => theme.slug));
    const missingThemeSlugs = includedThemes.filter((slug) => !installedThemeSlugs.has(slug));
    const defaultThemeActive = Boolean(pkg.defaultThemeSlug && activeTheme.slug === pkg.defaultThemeSlug);

    const pluginDetails = await Promise.all(
      includedPlugins.map(async (slug) => {
        const pluginPackage = await PluginManagementService.getPluginPackage(slug);
        const defaultInstance = pluginPackage
          ? await PluginManagementService.getDefaultInstance(slug)
          : null;
        const config = parseJsonObject(defaultInstance?.configJson);
        const readiness = pluginPackage
          ? evaluatePluginConfigReadiness(pluginPackage.manifestJson, config)
          : {
              requiresConfiguration: false,
              ready: false,
              missingFields: [] as string[],
            };

        return {
          slug,
          installed: Boolean(pluginPackage),
          configRequired: readiness.requiresConfiguration,
          configReady: pluginPackage ? readiness.ready : false,
          missingFields: readiness.missingFields,
        };
      }),
    );

    const pluginsInstalled = pluginDetails.filter((item) => item.installed).length;
    const pluginsConfigured = pluginDetails.filter(
      (item) => item.installed && (item.configRequired ? item.configReady : true),
    ).length;

    return {
      ready:
        missingThemeSlugs.length === 0 &&
        (!pkg.defaultThemeSlug || defaultThemeActive) &&
        pluginDetails.every((item) => item.installed && (item.configRequired ? item.configReady : true)),
      defaultThemeSlug: pkg.defaultThemeSlug ?? null,
      defaultThemeActive,
      themesInstalled: includedThemes.length - missingThemeSlugs.length,
      themesTotal: includedThemes.length,
      pluginsInstalled,
      pluginsConfigured,
      pluginsTotal: includedPlugins.length,
      missingThemeSlugs,
      pluginDetails,
    };
  }
}

export const managedPackageService = new ManagedPackageService();
