export type CommercialPackageStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export type CommercialPackageAssetKind = 'theme' | 'plugin';

export type CommercialPackageOfferKind = 'standard' | 'theme_first_solution';

export type CommercialPackageSetupSurface =
  | 'dashboard'
  | 'settings'
  | 'themes'
  | 'plugins'
  | 'external';

export interface CommercialPackageSetupStep {
  id: string;
  title: string;
  description?: string | null;
  href?: string | null;
  ctaLabel?: string | null;
  surface?: CommercialPackageSetupSurface | null;
}

export interface CommercialPackageAsset {
  id: string;
  slug: string;
  kind: CommercialPackageAssetKind;
  name?: string;
  includedByDefault: boolean;
}

export interface CommercialPackageSummary {
  id: string;
  name: string;
  activationCode: string;
  status: CommercialPackageStatus;
  offerKind: CommercialPackageOfferKind;
  displayBrandName: string;
  displaySolutionName: string;
  description?: string | null;
  defaultThemeSlug?: string | null;
  supportEmail?: string | null;
  activatedInstanceKey?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assets: CommercialPackageAsset[];
  setupSteps: CommercialPackageSetupStep[];
}

export interface CommercialPackageProjection {
  packageId: string;
  activationCode: string;
  status: CommercialPackageStatus;
  offerKind: CommercialPackageOfferKind;
  packageName: string;
  displayBrandName: string;
  displaySolutionName: string;
  description?: string | null;
  defaultThemeSlug?: string | null;
  supportEmail?: string | null;
  includedThemes: string[];
  includedPlugins: string[];
  assets: CommercialPackageAsset[];
  activatedAt?: string | null;
  expiresAt?: string | null;
  setupSteps: CommercialPackageSetupStep[];
}

export interface CommercialPackageReadinessPlugin {
  slug: string;
  installed: boolean;
  configRequired: boolean;
  configReady: boolean;
  missingFields: string[];
}

export interface CommercialPackageReadiness {
  ready: boolean;
  defaultThemeSlug?: string | null;
  defaultThemeActive: boolean;
  themesInstalled: number;
  themesTotal: number;
  pluginsInstalled: number;
  pluginsConfigured: number;
  pluginsTotal: number;
  missingThemeSlugs: string[];
  pluginDetails: CommercialPackageReadinessPlugin[];
}

export interface CommercialPackageActivationRequest {
  activationCode: string;
  instanceKey: string;
  siteUrl?: string | null;
}

export interface CommercialPackageActivationResponse {
  found: boolean;
  allowed: boolean;
  reason?: string;
  package?: CommercialPackageProjection | null;
}

export interface ManagedPackageStatusResponse {
  mode: 'oss' | 'managed';
  package: CommercialPackageProjection | null;
  readiness?: CommercialPackageReadiness | null;
}

export interface ManagedPackageBrandingResponse {
  mode: 'oss' | 'managed';
  displayBrandName: string | null;
  displaySolutionName: string | null;
}
