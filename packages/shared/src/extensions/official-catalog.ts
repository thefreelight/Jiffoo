export type OfficialExtensionKind = 'theme' | 'plugin';
export type OfficialArtifactKind = 'theme-package' | 'plugin-package';
export type OfficialExtensionDeliveryMode = 'package-managed';
export type OfficialPublishState = 'draft' | 'published' | 'unpublished' | 'blocked';
export type OfficialCatalogInstallState = 'not_installed' | 'installed' | 'enabled' | 'active';

export interface OfficialCatalogEntry {
  slug: string;
  name: string;
  kind: OfficialExtensionKind;
  target?: 'shop' | 'admin';
  version: string;
  author: string;
  description: string;
  artifactKind: OfficialArtifactKind;
  packageUrl: string;
  minCoreVersion: string;
}

export interface OfficialExtensionVersionSummary {
  version: string;
  packageUrl: string;
  changelog?: string | null;
  minCoreVersion?: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export interface OfficialExtensionCatalogItem {
  slug: string;
  name: string;
  kind: OfficialExtensionKind;
  target?: 'shop' | 'admin';
  description: string;
  author: string;
  deliveryMode: OfficialExtensionDeliveryMode;
  publishState: OfficialPublishState;
  installable: boolean;
  currentVersion: string;
  versions: OfficialExtensionVersionSummary[];
}

export interface OfficialExtensionCatalogResponse {
  items: OfficialExtensionCatalogItem[];
}

export const OFFICIAL_LAUNCH_EXTENSIONS: OfficialCatalogEntry[] = [];
