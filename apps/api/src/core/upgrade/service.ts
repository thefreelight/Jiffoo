/**
 * System Upgrade Service
 *
 * Handles system version management, compatibility checks, and upgrades.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/config/database';
import { createUpdateExecutor } from './executors';
import type {
  BackupInfo,
  CoreUpdateManifest,
  DeploymentMode,
  UpgradeStatus,
  UpgradeStatusState,
  VersionInfo,
} from './types';

// Current system version fallback
export const CURRENT_VERSION = '1.0.0';

// Minimum compatible version for upgrades
export const MIN_COMPATIBLE_VERSION = '0.9.0';

const UPDATE_MANIFEST_TIMEOUT_MS = 5000;

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

    const installedVersion = settings?.version || this.resolveCurrentVersion();
    const deploymentMode = this.detectDeploymentMode();
    const manifest = await this.fetchUpdateManifest();
    const latestVersion = manifest?.latestVersion || installedVersion;
    const updateAvailable = this.compareVersions(installedVersion, latestVersion) < 0;
    const executor = createUpdateExecutor(deploymentMode);
    const availability = await executor.probe();

    return {
      currentVersion: installedVersion,
      latestVersion,
      updateAvailable,
      releaseNotes: manifest?.releaseNotes || (updateAvailable ? 'A newer core release is available.' : null),
      deploymentMode,
      oneClickUpgradeSupported: availability.available,
      updateSource: manifest ? 'public-manifest' : 'local-fallback',
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

    const currentVersion = settings?.version || this.resolveCurrentVersion();
    const deploymentMode = this.detectDeploymentMode();
    const manifest = await this.fetchUpdateManifest();
    const minimumCompatibleVersion = manifest?.minimumCompatibleVersion || MIN_COMPATIBLE_VERSION;
    const executor = createUpdateExecutor(deploymentMode);
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
  static getUpgradeStatus(): UpgradeStatus {
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
    const deploymentMode = this.detectDeploymentMode();
    const backupPath = deploymentMode === 'single-host'
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
  static async performUpgrade(targetVersion: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (this.upgradeInProgress) {
      return { success: false, error: 'Upgrade already in progress' };
    }

    const deploymentMode = this.detectDeploymentMode();
    const compatibility = await this.checkCompatibility(targetVersion);
    if (!compatibility.compatible) {
      return { success: false, error: compatibility.issues[0] || 'Incompatible target version' };
    }

    try {
      this.upgradeInProgress = true;
      this.lastError = null;
      this.reportProgress('checking', 'Resolving updater executor', 5);

      const executor = createUpdateExecutor(deploymentMode);
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

      const manifest = await this.fetchUpdateManifest();
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
      return { success: true };
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
    if (envVersion && this.isStrictSemver(envVersion)) {
      return envVersion;
    }

    const candidates = [
      path.resolve(process.cwd(), '../../package.json'),
      path.resolve(process.cwd(), 'package.json'),
    ];

    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const json = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { version?: string };
        if (json.version && this.isStrictSemver(json.version)) {
          return json.version;
        }
      } catch {
        // ignore malformed or unreadable package metadata
      }
    }

    return CURRENT_VERSION;
  }

  private static async fetchUpdateManifest(): Promise<CoreUpdateManifest | null> {
    const manifestUrl = process.env.JIFFOO_CORE_UPDATE_MANIFEST_URL || process.env.JIFFOO_UPDATE_MANIFEST_URL;
    if (!manifestUrl) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPDATE_MANIFEST_TIMEOUT_MS);

    try {
      const response = await fetch(manifestUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const payload = await response.json() as CoreUpdateManifest;
      if (!payload?.latestVersion || !this.isStrictSemver(payload.latestVersion)) {
        return null;
      }

      return {
        latestVersion: payload.latestVersion,
        releaseNotes: payload.releaseNotes || null,
        minimumCompatibleVersion: payload.minimumCompatibleVersion || null,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private static detectDeploymentMode(): DeploymentMode {
    const override = process.env.JIFFOO_DEPLOYMENT_MODE;
    if (override === 'single-host' || override === 'docker-compose' || override === 'k8s' || override === 'unsupported') {
      return override;
    }

    if (process.env.KUBERNETES_SERVICE_HOST || process.env.HELM_RELEASE_NAME || process.env.ARGOCD_APP_NAME) {
      return 'k8s';
    }

    if (process.env.COMPOSE_PROJECT_NAME || process.env.JIFFOO_DOCKER_COMPOSE === 'true') {
      return 'docker-compose';
    }

    if (fs.existsSync(path.resolve(process.cwd(), 'ecosystem.config.js')) || fs.existsSync('/opt/jiffoo/current')) {
      return 'single-host';
    }

    return 'unsupported';
  }

  private static isStrictSemver(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version);
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
  private static compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;

      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }

    return 0;
  }
}
