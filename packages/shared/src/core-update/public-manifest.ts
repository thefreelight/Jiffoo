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

// This is the public update-feed source of truth that self-hosted instances use
// for release detection. Keep it aligned with the published OSS release tag and
// changelog entry whenever a new public release is cut.
export const PUBLIC_CORE_UPDATE_MANIFEST: PublicCoreUpdateManifest = {
  latestVersion: '1.0.139',
  latestStableVersion: '1.0.139',
  latestPrereleaseVersion: null,
  channel: 'stable',
  deliveryMode: 'image-first',
  images: {
    api: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/api:1.0.139',
    admin: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/admin:1.0.139',
    shop: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:1.0.139',
    updater: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/updater:1.0.139',
  },
  releaseDate: '2026-09-14T11:26:00.000Z',
  changelogUrl: 'https://github.com/thefreelight/Jiffoo/releases/tag/v1.0.139-opensource',
  sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
  minimumCompatibleVersion: '1.0.0',
  minimumAutoUpgradableVersion: '1.0.0',
  requiresManualIntervention: false,
  releaseNotes:
    'Native Merchant Admin adapters land for Cloudflare-native instances: system settings (GET + batch write via migration 0057 native_settings), an idle upgrade-status view with reset no-op, admin sessions on /account/profile and /account/email, and a real /account/avatar upload to instance asset storage — replacing the CORE_ORIGIN self-proxy 522s behind the Settings and Profile network errors.',
  checksumUrl: null,
  signatureUrl: null,
};
