/**
 * Install Service (Single Store Version)
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/config/database';
import bcrypt from 'bcryptjs';

export interface InstallationStatus {
  isInstalled: boolean;
  version?: string;
  installedAt?: Date;
  siteName?: string;
}

export interface InstallData {
  siteName: string;
  siteDescription?: string;
  adminEmail: string;
  adminPassword: string;
  adminUsername?: string;
}

const CURRENT_VERSION = '1.0.0';
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function isValidReleaseVersion(version: string | null | undefined): version is string {
  return typeof version === 'string' && RELEASE_VERSION_PATTERN.test(version);
}

function parseReleaseVersion(version: string) {
  const [core, prerelease = ''] = version.split('-', 2);
  const [major, minor, patch] = core.split('.').map((part) => Number(part));
  return {
    major,
    minor,
    patch,
    prerelease: prerelease.length > 0 ? prerelease.split('.') : [],
  };
}

function compareReleaseVersions(a: string, b: string): number {
  const parsedA = parseReleaseVersion(a);
  const parsedB = parseReleaseVersion(b);

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

function resolveCurrentVersion(): string {
  const envVersion = process.env.JIFFOO_VERSION || process.env.APP_VERSION;
  if (isValidReleaseVersion(envVersion)) {
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
      if (isValidReleaseVersion(json.version)) {
        return json.version;
      }
    } catch {
      // Ignore unreadable package metadata and continue to fallback.
    }
  }

  return CURRENT_VERSION;
}

function resolveInstalledVersion(storedVersion: string | null | undefined, runtimeVersion: string): string {
  if (isValidReleaseVersion(storedVersion)) {
    return compareReleaseVersions(storedVersion, runtimeVersion) >= 0 ? storedVersion : runtimeVersion;
  }

  return runtimeVersion;
}

export class InstallService {
  static async checkInstallationStatus(): Promise<InstallationStatus> {
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'system' }
      });

      if (!settings) {
        return { isInstalled: false };
      }

      const runtimeVersion = resolveCurrentVersion();

      return {
        isInstalled: settings.isInstalled,
        version: resolveInstalledVersion(settings.version, runtimeVersion),
        installedAt: settings.installedAt || undefined,
        siteName: settings.siteName
      };
    } catch (error) {
      return { isInstalled: false };
    }
  }

  static async checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { connected: true };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  static async completeInstallation(data: InstallData): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.checkInstallationStatus();
      if (status.isInstalled) {
        return { success: false, error: 'System is already installed' };
      }

      const runtimeVersion = resolveCurrentVersion();

      // Create admin user account
      const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
      const existingAdmin = await prisma.user.findFirst({
        where: { email: data.adminEmail }
      });

      let adminUser;
      if (!existingAdmin) {
        adminUser = await prisma.user.create({
          data: {
            email: data.adminEmail,
            username: data.adminUsername || data.adminEmail.split('@')[0],
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
          }
        });
      } else {
        adminUser = existingAdmin;
      }

      // Update system settings
      await prisma.systemSettings.upsert({
        where: { id: 'system' },
        create: {
          id: 'system',
          isInstalled: true,
          installedAt: new Date(),
          installedBy: adminUser.id,
          siteName: data.siteName,
          siteDescription: data.siteDescription,
          version: runtimeVersion,
        },
        update: {
          isInstalled: true,
          installedAt: new Date(),
          installedBy: adminUser.id,
          siteName: data.siteName,
          siteDescription: data.siteDescription,
          version: runtimeVersion,
        }
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async getSystemSettings() {
    return prisma.systemSettings.findUnique({ where: { id: 'system' } });
  }

  static async updateSystemSettings(data: Partial<{
    siteName: string;
    siteDescription: string;
    logoUrl: string;
    faviconUrl: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;
    requireEmailVerification: boolean;
  }>) {
    return prisma.systemSettings.update({
      where: { id: 'system' },
      data
    });
  }
}
