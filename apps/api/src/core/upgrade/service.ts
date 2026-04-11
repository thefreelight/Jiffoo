/**
 * System Upgrade Service
 *
 * Handles system version management, compatibility checks, and upgrades.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/config/database';
import { createUpdateExecutor } from './executors';
import {
  DEFAULT_PUBLIC_CORE_UPDATE_MANIFEST_URL,
  LEGACY_PUBLIC_CORE_UPDATE_MANIFEST_URL,
  PUBLIC_CORE_UPDATE_MANIFEST,
} from 'shared';
import type {
  BackupInfo,
  CoreUpdateManifest,
  DeploymentModeSource,
  DeploymentMode,
  ReleaseChannel,
  UpgradePerformResult,
  UpdateManifestStatus,
  UpdateSource,
  UpgradeStatus,
  UpgradeStatusState,
  VersionInfo,
} from './types';

// Current system version fallback
export const CURRENT_VERSION = '1.0.0';

// Minimum compatible version for upgrades
export const MIN_COMPATIBLE_VERSION = '0.9.0';

const UPDATE_MANIFEST_TIMEOUT_MS = 5000;

type DeploymentModeDetection = {
  mode: DeploymentMode;
  source: DeploymentModeSource;
  reason: string | null;
};

type ManifestResolution = {
  manifest: CoreUpdateManifest | null;
  url: string | null;
  source: UpdateSource;
  status: UpdateManifestStatus;
  error: string | null;
};

/**
 * Upgrade Service
 */
export class UpgradeService {
  private static upgradeInProgress = false;
  private static currentStep = '';
  private static progress = 0;
  private static status: UpgradeStatusState = 'idle';
  private static lastError: string | null = null;

  private static async ensureSystemSettings() {
    const defaultSettings = {
      'localization.currency': 'USD',
      'localization.locale': 'en',
      'localization.timezone': 'UTC',
    };

    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', settings: defaultSettings },
      update: {},
    });
  }

  /**
   * Get current version info
   */
  static async getVersionInfo(): Promise<VersionInfo> {
    await this.ensureSystemSettings();
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    const runtimeVersion = this.resolveCurrentVersion();
    const installedVersion = this.resolveInstalledVersion(settings?.version ?? null, runtimeVersion);
    const deployment = this.detectDeploymentMode();
    const preferredChannel = this.resolveReleaseChannel();
    const manifestResult = await this.fetchUpdateManifest(preferredChannel);
    const manifest = manifestResult.manifest;
    const latestVersion = manifest?.latestVersion || installedVersion;
    const updateAvailable = this.compareVersions(installedVersion, latestVersion) < 0;
    const executor = createUpdateExecutor(deployment.mode);
    const availability = await executor.probe();

    return {
      currentVersion: installedVersion,
      latestVersion,
      updateAvailable,
      releaseNotes: manifest?.releaseNotes || (updateAvailable ? 'A newer core release is available.' : null),
      changelogUrl: manifest?.changelogUrl || null,
      sourceArchiveUrl: manifest?.sourceArchiveUrl || null,
      releaseDate: manifest?.releaseDate || null,
      releaseChannel: manifest?.channel || preferredChannel,
      deploymentMode: deployment.mode,
      deploymentModeSource: deployment.source,
      deploymentModeReason: deployment.reason,
      oneClickUpgradeSupported: availability.available,
      updateSource: manifestResult.source,
      manifestUrl: manifestResult.url,
      manifestStatus: manifestResult.status,
      manifestError: manifestResult.error,
      minimumAutoUpgradableVersion: manifest?.minimumAutoUpgradableVersion || null,
      requiresManualIntervention: manifest?.requiresManualIntervention ?? false,
      recoveryMode: 'automatic-recovery',
      manualGuidance: availability.available ? null : executor.getManualGuidance(availability.reason),
    };
  }

  /**
   * Check version compatibility
   */
  static async checkCompatibility(targetVersion: string): Promise<{
    compatible: boolean;
    currentVersion: string;
    targetVersion: string;
    issues: string[];
    warnings: string[];
  }> {
    await this.ensureSystemSettings();
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    const runtimeVersion = this.resolveCurrentVersion();
    const currentVersion = this.resolveInstalledVersion(settings?.version ?? null, runtimeVersion);
    const deployment = this.detectDeploymentMode();
    const manifest = (await this.fetchUpdateManifest(this.resolveReleaseChannel())).manifest;
    const minimumCompatibleVersion = manifest?.minimumCompatibleVersion || MIN_COMPATIBLE_VERSION;
    const executor = createUpdateExecutor(deployment.mode);
    const availability = await executor.probe();

    // Check if current version is too old
    if (this.compareVersions(currentVersion, minimumCompatibleVersion) < 0) {
      return {
        compatible: false,
        currentVersion,
        targetVersion,
        issues: [`Current version ${currentVersion} is too old. Minimum required: ${minimumCompatibleVersion}`],
        warnings: [],
      };
    }

    // Check if target version is valid
    if (this.compareVersions(targetVersion, currentVersion) <= 0) {
      return {
        compatible: false,
        currentVersion,
        targetVersion,
        issues: [`Target version ${targetVersion} must be newer than current version ${currentVersion}`],
        warnings: [],
      };
    }

    const warnings = [
      'Create a pre-upgrade backup',
      'Run backward-compatible migrations only',
      'Verify plugin and theme compatibility before cutover',
      'Rely on automatic recovery if the upgrade fails',
    ];

    if (!availability.available) {
      warnings.push(executor.getManualGuidance(availability.reason));
    }

    return {
      compatible: availability.available,
      currentVersion,
      targetVersion,
      issues: availability.available
        ? []
        : [availability.reason || 'This installation does not currently have a ready one-click upgrade executor.'],
      warnings,
    };
  }

  /**
   * Get upgrade status
   */
  static async getUpgradeStatus(): Promise<UpgradeStatus> {
    const deployment = this.detectDeploymentMode();
    if (deployment.mode === 'docker-compose' && process.env.JIFFOO_UPDATER_URL) {
      try {
        const response = await fetch(`${process.env.JIFFOO_UPDATER_URL}/status`);
        if (response.ok) {
          return await response.json() as UpgradeStatus;
        }
      } catch {
        // Fall back to in-memory status below.
      }
    }

    return {
      status: this.status,
      progress: this.progress,
      currentStep: this.currentStep || null,
      error: this.lastError,
    };
  }

  /**
   * Create backup before upgrade
   */
  static async createBackup(): Promise<BackupInfo> {
    await this.ensureSystemSettings();
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    const backupId = `backup-${Date.now()}`;
    const deployment = this.detectDeploymentMode();
    const backupPath = deployment.mode === 'single-host'
      ? `/opt/jiffoo/backups/${backupId}`
      : `/backups/${backupId}`;

    // In production, this would create actual database backup
    // For now, we just record the backup metadata

    return {
      id: backupId,
      version: settings?.version || CURRENT_VERSION,
      createdAt: new Date(),
      size: 0, // Would be actual backup size
      path: backupPath
    };
  }

  /**
   * Perform system upgrade
   */
  static async performUpgrade(targetVersion: string): Promise<
    | { success: false; error: string }
    | { success: true; result: UpgradePerformResult }
  > {
    if (this.upgradeInProgress) {
      return { success: false, error: 'Upgrade already in progress' };
    }

    const deployment = this.detectDeploymentMode();
    const compatibility = await this.checkCompatibility(targetVersion);
    if (!compatibility.compatible) {
      return { success: false, error: compatibility.issues[0] || 'Incompatible target version' };
    }

    try {
      this.upgradeInProgress = true;
      this.lastError = null;
      this.reportProgress('checking', 'Resolving updater executor', 5);

      const executor = createUpdateExecutor(deployment.mode);
      const availability = await executor.probe();
      if (!availability.available) {
        this.reportProgress('failed', 'Upgrade executor unavailable', 8);
        this.lastError = availability.guidance || executor.getManualGuidance(availability.reason);
        return { success: false, error: this.lastError };
      }

      // Step 1: Create backup
      this.reportProgress('preparing', 'Creating pre-upgrade backup', 10);
      const backup = await this.createBackup();
      this.reportProgress('backing_up', `Backup created at ${backup.path}`, 18);

      const manifest = (await this.fetchUpdateManifest(this.resolveReleaseChannel())).manifest;
      const result = await executor.execute({
        targetVersion,
        manifest,
        backup,
        reportProgress: (status, step, progress) => this.reportProgress(status, step, progress),
      });

      if (!result.success) {
        this.reportProgress('failed', 'Upgrade failed; waiting for automatic recovery', 95);
        this.lastError = result.error || 'Upgrade executor failed';
        return { success: false, error: this.lastError };
      }

      if (deployment.mode === 'docker-compose' && process.env.JIFFOO_UPDATER_URL) {
        this.reportProgress('preparing', 'Upgrade accepted by updater agent', 15);
        return {
          success: true,
          result: {
            targetVersion,
            started: true,
            completed: false,
            completedAt: null,
          },
        };
      }

      await prisma.systemSettings.upsert({
        where: { id: 'system' },
        create: {
          id: 'system',
          settings: {
            'localization.currency': 'USD',
            'localization.locale': 'en',
            'localization.timezone': 'UTC',
          },
          version: targetVersion,
        },
        update: {
          version: targetVersion,
        },
      });
      this.reportProgress('completed', 'Upgrade completed successfully', 100);
      return {
        success: true,
        result: {
          targetVersion,
          started: true,
          completed: true,
          completedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.status = 'failed';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: this.lastError,
      };
    } finally {
      this.upgradeInProgress = false;
    }
  }

  private static resolveCurrentVersion(): string {
    const envVersion = process.env.JIFFOO_VERSION || process.env.APP_VERSION;
    if (envVersion && this.isValidReleaseVersion(envVersion)) {
      return envVersion;
    }

    if (
      PUBLIC_CORE_UPDATE_MANIFEST?.latestStableVersion &&
      this.isValidReleaseVersion(PUBLIC_CORE_UPDATE_MANIFEST.latestStableVersion)
    ) {
      return PUBLIC_CORE_UPDATE_MANIFEST.latestStableVersion;
    }

    const candidates = [
      path.resolve(process.cwd(), '../../package.json'),
      path.resolve(process.cwd(), 'package.json'),
    ];

    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const json = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { version?: string };
        if (json.version && this.isValidReleaseVersion(json.version)) {
          return json.version;
        }
      } catch {
        // ignore malformed or unreadable package metadata
      }
    }

    return CURRENT_VERSION;
  }

  private static async fetchUpdateManifest(preferredChannel: ReleaseChannel): Promise<ManifestResolution> {
    const explicitManifestUrl = process.env.JIFFOO_CORE_UPDATE_MANIFEST_URL || process.env.JIFFOO_UPDATE_MANIFEST_URL;
    const normalizedExplicitManifestUrl =
      explicitManifestUrl === LEGACY_PUBLIC_CORE_UPDATE_MANIFEST_URL
        ? DEFAULT_PUBLIC_CORE_UPDATE_MANIFEST_URL
        : explicitManifestUrl;
    const manifestUrl =
      normalizedExplicitManifestUrl || (process.env.NODE_ENV === 'test' ? null : DEFAULT_PUBLIC_CORE_UPDATE_MANIFEST_URL);
    const source: UpdateSource =
      explicitManifestUrl && explicitManifestUrl !== LEGACY_PUBLIC_CORE_UPDATE_MANIFEST_URL
        ? 'env-manifest'
        : 'default-public-manifest';

    if (!manifestUrl) {
      return {
        manifest: null,
        url: null,
        source: 'local-fallback',
        status: 'missing',
        error: 'No public update manifest URL is configured for this runtime',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPDATE_MANIFEST_TIMEOUT_MS);

    try {
      const response = await fetch(manifestUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          manifest: null,
          url: manifestUrl,
          source: 'local-fallback',
          status: 'unreachable',
          error: `Update manifest returned HTTP ${response.status}`,
        };
      }

      const payload = await response.json() as CoreUpdateManifest;
      const normalized = this.normalizeManifestPayload(payload, preferredChannel);
      if (!normalized) {
        return {
          manifest: null,
          url: manifestUrl,
          source: 'local-fallback',
          status: 'invalid',
          error: 'Update manifest is missing a valid latest version',
        };
      }

      return {
        manifest: normalized,
        url: manifestUrl,
        source,
        status: 'available',
        error: null,
      };
    } catch (error) {
      return {
        manifest: null,
        url: manifestUrl,
        source: 'local-fallback',
        status: 'unreachable',
        error: error instanceof Error ? error.message : 'Failed to fetch update manifest',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private static detectDeploymentMode(): DeploymentModeDetection {
    const override = process.env.JIFFOO_DEPLOYMENT_MODE;
    if (override === 'single-host' || override === 'docker-compose' || override === 'k8s' || override === 'unsupported') {
      return {
        mode: override,
        source: 'env',
        reason: `Detected from JIFFOO_DEPLOYMENT_MODE=${override}`,
      };
    }

    if (process.env.KUBERNETES_SERVICE_HOST || process.env.HELM_RELEASE_NAME || process.env.ARGOCD_APP_NAME) {
      return {
        mode: 'k8s',
        source: 'k8s-signals',
        reason: 'Detected Kubernetes runtime signals (KUBERNETES_SERVICE_HOST/HELM_RELEASE_NAME/ARGOCD_APP_NAME)',
      };
    }

    if (
      process.env.COMPOSE_PROJECT_NAME ||
      process.env.JIFFOO_DOCKER_COMPOSE === 'true' ||
      fs.existsSync(path.resolve(process.cwd(), 'docker-compose.prod.yml')) ||
      fs.existsSync(path.resolve(process.cwd(), 'docker-compose.yml'))
    ) {
      return {
        mode: 'docker-compose',
        source: 'compose-signals',
        reason: 'Detected Docker Compose runtime signals (COMPOSE_PROJECT_NAME / JIFFOO_DOCKER_COMPOSE / compose file)',
      };
    }

    if (fs.existsSync(path.resolve(process.cwd(), 'ecosystem.config.js')) || fs.existsSync('/opt/jiffoo/current')) {
      return {
        mode: 'single-host',
        source: 'single-host-signals',
        reason: 'Detected single-host release layout (ecosystem.config.js or /opt/jiffoo/current)',
      };
    }

    return {
      mode: 'unsupported',
      source: 'fallback',
      reason: 'No supported self-hosted deployment markers were detected',
    };
  }

  private static resolveReleaseChannel(): ReleaseChannel {
    return process.env.JIFFOO_UPDATE_CHANNEL === 'prerelease' ? 'prerelease' : 'stable';
  }

  private static reportProgress(status: UpgradeStatusState, step: string, progress: number) {
    this.status = status;
    this.currentStep = step;
    this.progress = progress;
  }

  /**
   * Compare semantic versions
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private static isValidReleaseVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
  }

  private static parseReleaseVersion(version: string) {
    if (!this.isValidReleaseVersion(version)) {
      throw new Error(`Invalid release version: ${version}`);
    }

    const [core, prerelease = ''] = version.split('-', 2);
    const [major, minor, patch] = core.split('.').map((part) => Number(part));
    return {
      major,
      minor,
      patch,
      prerelease: prerelease.length > 0 ? prerelease.split('.') : [],
    };
  }

  private static compareVersions(a: string, b: string): number {
    const parsedA = this.parseReleaseVersion(a);
    const parsedB = this.parseReleaseVersion(b);

    if (parsedA.major !== parsedB.major) return parsedA.major < parsedB.major ? -1 : 1;
    if (parsedA.minor !== parsedB.minor) return parsedA.minor < parsedB.minor ? -1 : 1;
    if (parsedA.patch !== parsedB.patch) return parsedA.patch < parsedB.patch ? -1 : 1;

    const aPre = parsedA.prerelease;
    const bPre = parsedB.prerelease;

    if (aPre.length === 0 && bPre.length === 0) return 0;
    if (aPre.length === 0) return 1;
    if (bPre.length === 0) return -1;

    const maxLen = Math.max(aPre.length, bPre.length);
    for (let i = 0; i < maxLen; i += 1) {
      const left = aPre[i];
      const right = bPre[i];

      if (left === undefined) return -1;
      if (right === undefined) return 1;

      const leftIsNumeric = /^\d+$/.test(left);
      const rightIsNumeric = /^\d+$/.test(right);

      if (leftIsNumeric && rightIsNumeric) {
        const leftNum = Number(left);
        const rightNum = Number(right);
        if (leftNum !== rightNum) return leftNum < rightNum ? -1 : 1;
        continue;
      }

      if (leftIsNumeric) return -1;
      if (rightIsNumeric) return 1;
      if (left !== right) return left < right ? -1 : 1;
    }

    return 0;
  }

  private static resolveInstalledVersion(storedVersion: string | null, runtimeVersion: string): string {
    if (storedVersion && this.isValidReleaseVersion(storedVersion)) {
      return this.compareVersions(storedVersion, runtimeVersion) >= 0 ? storedVersion : runtimeVersion;
    }

    return runtimeVersion;
  }

  private static normalizeManifestPayload(
    payload: CoreUpdateManifest,
    preferredChannel: ReleaseChannel,
  ): CoreUpdateManifest | null {
    const stableVersion = payload.latestStableVersion ?? payload.latestVersion;
    const prereleaseVersion = payload.latestPrereleaseVersion ?? null;
    const effectiveVersion =
      preferredChannel === 'prerelease' && prereleaseVersion && this.isValidReleaseVersion(prereleaseVersion)
        ? prereleaseVersion
        : stableVersion;

    if (!effectiveVersion || !this.isValidReleaseVersion(effectiveVersion)) {
      return null;
    }

    return {
      latestVersion: effectiveVersion,
      latestStableVersion: stableVersion,
      latestPrereleaseVersion: prereleaseVersion,
      channel: preferredChannel,
      deliveryMode: payload.deliveryMode || null,
      images: payload.images || null,
      releaseDate: payload.releaseDate || null,
      changelogUrl: payload.changelogUrl || null,
      sourceArchiveUrl: payload.sourceArchiveUrl || null,
      releaseNotes: payload.releaseNotes || null,
      minimumCompatibleVersion: payload.minimumCompatibleVersion || null,
      minimumAutoUpgradableVersion: payload.minimumAutoUpgradableVersion || null,
      requiresManualIntervention: payload.requiresManualIntervention ?? false,
      checksumUrl: payload.checksumUrl || null,
      signatureUrl: payload.signatureUrl || null,
    };
  }
}
