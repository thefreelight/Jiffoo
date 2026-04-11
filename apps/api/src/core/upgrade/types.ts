export type DeploymentMode = 'single-host' | 'docker-compose' | 'k8s' | 'unsupported';
export type UpdateSource = 'env-manifest' | 'default-public-manifest' | 'local-fallback';
export type UpdateManifestStatus = 'available' | 'missing' | 'unreachable' | 'invalid';
export type DeploymentModeSource =
  | 'env'
  | 'k8s-signals'
  | 'compose-signals'
  | 'single-host-signals'
  | 'fallback';
export type ReleaseChannel = 'stable' | 'prerelease';

export type UpgradeStatusState =
  | 'idle'
  | 'checking'
  | 'preparing'
  | 'downloading'
  | 'backing_up'
  | 'applying'
  | 'migrating'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'recovered';

export interface CoreUpdateManifest {
  latestVersion: string;
  latestStableVersion?: string | null;
  latestPrereleaseVersion?: string | null;
  channel?: ReleaseChannel | null;
  releaseDate?: string | null;
  changelogUrl?: string | null;
  sourceArchiveUrl?: string | null;
  releaseNotes?: string | null;
  minimumCompatibleVersion?: string | null;
  minimumAutoUpgradableVersion?: string | null;
  requiresManualIntervention?: boolean | null;
  checksumUrl?: string | null;
  signatureUrl?: string | null;
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string | null;
  changelogUrl?: string | null;
  sourceArchiveUrl?: string | null;
  releaseDate?: string | null;
  releaseChannel: ReleaseChannel;
  deploymentMode: DeploymentMode;
  deploymentModeSource: DeploymentModeSource;
  deploymentModeReason?: string | null;
  oneClickUpgradeSupported: boolean;
  updateSource: UpdateSource;
  manifestUrl?: string | null;
  manifestStatus: UpdateManifestStatus;
  manifestError?: string | null;
  minimumAutoUpgradableVersion?: string | null;
  requiresManualIntervention?: boolean;
  recoveryMode: 'automatic-recovery';
  manualGuidance?: string | null;
}

export interface UpgradeStatus {
  status: UpgradeStatusState;
  progress: number;
  currentStep?: string | null;
  error?: string | null;
}

export interface UpgradePerformResult {
  targetVersion: string;
  started: boolean;
  completed: boolean;
  completedAt?: string | null;
}

export interface BackupInfo {
  id: string;
  version: string;
  createdAt: Date;
  size: number;
  path: string;
}
