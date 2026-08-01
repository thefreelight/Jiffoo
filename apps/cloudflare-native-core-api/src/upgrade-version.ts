interface UpgradeVersionEnv {
  RUNTIME_VERSION?: string;
}

export function nativeUpgradeVersion(env: UpgradeVersionEnv): Response {
  const currentVersion = env.RUNTIME_VERSION || '0.0.1';
  const releaseTag = `v${currentVersion}-opensource`;

  return Response.json({
    success: true,
    data: {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      releaseNotes: 'Current Cloudflare-native runtime release.',
      changelogUrl: `https://github.com/thefreelight/Jiffoo/releases/tag/${releaseTag}`,
      sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
      checksumUrl: null,
      releaseTag,
      repository: 'thefreelight/Jiffoo',
      deliveryMode: 'image-first',
      runtimeImages: null,
      releaseDate: null,
      releaseChannel: 'stable',
      deploymentMode: 'unsupported',
      deploymentModeSource: 'env',
      deploymentModeReason: 'Cloudflare-native runtime manages deployments through the platform release pipeline.',
      oneClickUpgradeSupported: false,
      oneClickUpgradeAvailable: false,
      oneClickUpgradeBlockedReason: 'Cloudflare-native instances are upgraded through the published Worker release pipeline.',
      updateSource: 'env-manifest',
      manifestUrl: 'https://get.jiffoo.com/releases/core/manifest.json',
      manifestStatus: 'available',
      minimumAutoUpgradableVersion: '1.0.0',
      requiresManualIntervention: false,
      recoveryMode: 'automatic-recovery',
      manualGuidance: null,
    },
  }, { headers: { 'x-jiffoo-runtime': 'cloudflare-native-version' } });
}
