/**
 * System Upgrade Service
 * 
 * Handles system version management, compatibility checks, and upgrades.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Current system version
export const CURRENT_VERSION = '1.0.0';

// Minimum compatible version for upgrades
export const MIN_COMPATIBLE_VERSION = '0.9.0';

/**
 * Version info
 */
export interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  releaseDate?: string;
}

/**
 * Upgrade status
 */
export interface UpgradeStatus {
  inProgress: boolean;
  currentStep?: string;
  progress?: number;
  error?: string;
}

/**
 * Backup info
 */
export interface BackupInfo {
  id: string;
  version: string;
  createdAt: Date;
  size: number;
  path: string;
}

/**
 * Upgrade Service
 */
export class UpgradeService {
  private static upgradeInProgress = false;
  private static currentStep = '';
  private static progress = 0;

  /**
   * Get current version info
   */
  static async getVersionInfo(): Promise<VersionInfo> {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    const installedVersion = settings?.version || CURRENT_VERSION;

    // In production, this would check a remote server for updates
    const latestVersion = CURRENT_VERSION;
    const updateAvailable = this.compareVersions(installedVersion, latestVersion) < 0;

    return {
      current: installedVersion,
      latest: latestVersion,
      updateAvailable,
      releaseNotes: updateAvailable ? 'Bug fixes and performance improvements' : undefined,
      releaseDate: updateAvailable ? new Date().toISOString() : undefined
    };
  }

  /**
   * Check version compatibility
   */
  static async checkCompatibility(targetVersion: string): Promise<{
    compatible: boolean;
    reason?: string;
    requiredSteps?: string[];
  }> {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    const currentVersion = settings?.version || CURRENT_VERSION;

    // Check if current version is too old
    if (this.compareVersions(currentVersion, MIN_COMPATIBLE_VERSION) < 0) {
      return {
        compatible: false,
        reason: `Current version ${currentVersion} is too old. Minimum required: ${MIN_COMPATIBLE_VERSION}`
      };
    }

    // Check if target version is valid
    if (this.compareVersions(targetVersion, currentVersion) <= 0) {
      return {
        compatible: false,
        reason: `Target version ${targetVersion} must be newer than current version ${currentVersion}`
      };
    }

    return {
      compatible: true,
      requiredSteps: [
        'Backup database',
        'Run migrations',
        'Update configuration',
        'Restart services'
      ]
    };
  }

  /**
   * Get upgrade status
   */
  static getUpgradeStatus(): UpgradeStatus {
    return {
      inProgress: this.upgradeInProgress,
      currentStep: this.currentStep,
      progress: this.progress
    };
  }

  /**
   * Create backup before upgrade
   */
  static async createBackup(): Promise<BackupInfo> {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    const backupId = `backup-${Date.now()}`;
    const backupPath = `/backups/${backupId}`;

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

    const compatibility = await this.checkCompatibility(targetVersion);
    if (!compatibility.compatible) {
      return { success: false, error: compatibility.reason };
    }

    try {
      this.upgradeInProgress = true;

      // Step 1: Create backup
      this.currentStep = 'Creating backup';
      this.progress = 10;
      await this.createBackup();

      // Step 2: Run migrations
      this.currentStep = 'Running migrations';
      this.progress = 40;
      // In production: await this.runMigrations();

      // Step 3: Update configuration
      this.currentStep = 'Updating configuration';
      this.progress = 70;
      await prisma.systemSettings.update({
        where: { id: 'system' },
        data: { version: targetVersion }
      });

      // Step 4: Complete
      this.currentStep = 'Completed';
      this.progress = 100;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.upgradeInProgress = false;
    }
  }

  /**
   * Rollback to previous version
   */
  static async rollback(backupId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    // In production, this would restore from backup
    return {
      success: true
    };
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

