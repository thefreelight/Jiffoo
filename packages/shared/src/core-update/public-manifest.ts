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
  latestVersion: '1.0.38',
  latestStableVersion: '1.0.38',
  latestPrereleaseVersion: null,
  channel: 'stable',
  deliveryMode: 'image-first',
  images: {
    api: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/api:1.0.38',
    admin: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/admin:1.0.38',
    shop: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/shop:1.0.38',
    updater: 'crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/updater:1.0.38',
  },
  releaseDate: '2026-07-15T02:18:56.548Z',
  changelogUrl: 'https://github.com/thefreelight/Jiffoo/releases/tag/v1.0.38-opensource',
  sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
  minimumCompatibleVersion: '1.0.0',
  minimumAutoUpgradableVersion: '1.0.0',
  requiresManualIntervention: false,
  releaseNotes:
    'Consolidates the 2026 H2 repo-hardening line (PR quality gates, test-debt cleanup, branch and dependency convergence) and adds an email-verification toggle for providerless deployments, dotted-key Stripe plugin config with live-mode inference, backend-gated social sign-in buttons, and a storefront Cloudflare Workers deploy path.',
  checksumUrl: null,
  signatureUrl: null,
};
