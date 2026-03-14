export type DeploymentMode = 'single-host' | 'docker-compose' | 'k8s' | 'unsupported';

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
  releaseNotes?: string | null;
  minimumCompatibleVersion?: string | null;
  checksumUrl?: string | null;
  signatureUrl?: string | null;
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string | null;
  deploymentMode: DeploymentMode;
  oneClickUpgradeSupported: boolean;
  updateSource: 'public-manifest' | 'local-fallback';
  recoveryMode: 'automatic-recovery';
  manualGuidance?: string | null;
}

export interface UpgradeStatus {
  status: UpgradeStatusState;
  progress: number;
  currentStep?: string | null;
  error?: string | null;
}

export interface BackupInfo {
  id: string;
  version: string;
  createdAt: Date;
  size: number;
  path: string;
}
