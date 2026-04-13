export type CoreReleaseChannel = 'stable' | 'prerelease';
export type CoreReleaseDeliveryMode = 'source' | 'image';

export interface PublicCoreUpdateImages {
  api: string;
  shop: string;
  admin: string;
  updater?: string | null;
}

export interface PublicCoreUpdateManifest {
  latestVersion: string;
  latestStableVersion: string;
  latestPrereleaseVersion: string | null;
  channel: CoreReleaseChannel;
  deliveryMode?: CoreReleaseDeliveryMode;
  images?: PublicCoreUpdateImages | null;
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

// This is the public update-feed source of truth that self-hosted instances use
// for release detection. Keep it aligned with the published OSS release tag and
// changelog entry whenever a new public release is cut.
export const PUBLIC_CORE_UPDATE_MANIFEST: PublicCoreUpdateManifest = {
  latestVersion: '1.0.7',
  latestStableVersion: '1.0.7',
  latestPrereleaseVersion: null,
  channel: 'stable',
  deliveryMode: 'source',
  images: null,
  releaseDate: '2026-04-13T00:00:00.000Z',
  changelogUrl: 'https://github.com/thefreelight/Jiffoo/releases/tag/v1.0.7-opensource',
  sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
  minimumCompatibleVersion: '1.0.0',
  minimumAutoUpgradableVersion: '1.0.0',
  requiresManualIntervention: false,
  releaseNotes:
    'Adds official theme/plugin update detection in Merchant Admin, while keeping the self-hosted update feed and docker-compose recovery path aligned with the public 1.0.7 release.',
  checksumUrl: null,
  signatureUrl: null,
};
