export type CoreReleaseChannel = 'stable' | 'prerelease';
export type CoreUpdateDeliveryMode = 'image-first' | 'source-archive';

export interface PublicCoreUpdateRuntimeImages {
  api: string;
  admin: string;
  shop: string;
  updater?: string | null;
}

export interface PublicCoreUpdateManifest {
  latestVersion: string;
  latestStableVersion: string;
  latestPrereleaseVersion: string | null;
  channel: CoreReleaseChannel;
  deliveryMode: CoreUpdateDeliveryMode;
  images: PublicCoreUpdateRuntimeImages | null;
  releaseDate: string;
  changelogUrl: string;
  sourceArchiveUrl: string;
  minimumCompatibleVersion: string;
  minimumAutoUpgradableVersion: string;
  requiresManualIntervention: boolean;
  releaseNotes: string | null;
  checksumUrl: string | null;
  signatureUrl: string | null;
}

export const LEGACY_PUBLIC_CORE_UPDATE_MANIFEST_URL =
  'https://api.jiffoo.com/api/upgrade/manifest.json';

export const DEFAULT_PUBLIC_CORE_UPDATE_MANIFEST_URL =
  'https://get.jiffoo.com/releases/core/manifest.json';

// Keep the embedded fallback aligned with the latest published OSS stable release.
export const PUBLIC_CORE_UPDATE_MANIFEST: PublicCoreUpdateManifest = {
  latestVersion: '1.0.33',
  latestStableVersion: '1.0.33',
  latestPrereleaseVersion: null,
  channel: 'stable',
  deliveryMode: 'image-first',
  images: {
    api: 'ghcr.io/thefreelight/jiffoo-api:v1.0.33-opensource',
    admin: 'ghcr.io/thefreelight/jiffoo-admin:v1.0.33-opensource',
    shop: 'ghcr.io/thefreelight/jiffoo-shop:v1.0.33-opensource',
    updater: 'ghcr.io/thefreelight/jiffoo-updater:v1.0.33-opensource',
  },
  releaseDate: '2026-04-21T09:30:00.000Z',
  changelogUrl: 'https://github.com/thefreelight/Jiffoo/releases/tag/v1.0.33-opensource',
  sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
  minimumCompatibleVersion: '1.0.0',
  minimumAutoUpgradableVersion: '1.0.0',
  requiresManualIntervention: false,
  releaseNotes:
    'Restores the self-hosted updater bridge assets, retries official theme downloads cleanly after stale partial 416 failures, and brings the official theme marketplace back to the compact four-column desktop layout.',
  checksumUrl: null,
  signatureUrl: null,
};
