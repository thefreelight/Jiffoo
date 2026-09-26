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

function normalizePublicReleaseVersion(version: string | null | undefined): string | null {
  if (typeof version !== 'string') return null;
  const normalized = version.trim().replace(/-opensource$/, '');
  return normalized.length > 0 ? normalized : null;
}

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
  const envVersion = normalizePublicReleaseVersion(process.env.JIFFOO_VERSION || process.env.APP_VERSION);
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
      const normalizedVersion = normalizePublicReleaseVersion(json.version);
      if (isValidReleaseVersion(normalizedVersion)) {
        return normalizedVersion;
      }
    } catch {
      // Ignore unreadable package metadata and continue to fallback.
    }
  }

  return CURRENT_VERSION;
}

function resolveInstalledVersion(storedVersion: string | null | undefined, runtimeVersion: string): string {
  const normalizedStoredVersion = normalizePublicReleaseVersion(storedVersion);
  const normalizedRuntimeVersion = normalizePublicReleaseVersion(runtimeVersion) || runtimeVersion;

  if (isValidReleaseVersion(normalizedStoredVersion)) {
    return compareReleaseVersions(normalizedStoredVersion, normalizedRuntimeVersion) >= 0
      ? normalizedStoredVersion
      : normalizedRuntimeVersion;
  }

  return normalizedRuntimeVersion;
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
        siteName: (settings.settings as Record<string, unknown> | null)?.['branding.platform_name'] as string | undefined
      };
    } catch (error) {
      return { isInstalled: false };
    }
  }

  static async checkDatabaseConnection(): Promise<{ connected: boolean }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { connected: true };
    } catch {
      return { connected: false };
    }
  }

  static async completeInstallation(data: InstallData): Promise<{ success: boolean; error?: string; code?: string }> {
    try {
      const runtimeVersion = resolveCurrentVersion();
      const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(9131472026)::text`;
        const settings = await tx.systemSettings.findUnique({ where: { id: 'system' } });
        if (settings?.isInstalled) return { success: false, error: 'System is already installed' };

        const email = data.adminEmail.trim().toLowerCase();
        const existingAdmin = await tx.user.findUnique({ where: { email } });
        if (existingAdmin) {
          return { success: false, error: 'Email is already in use', code: 'INSTALL_EMAIL_IN_USE' };
        }
        const adminUser = await tx.user.create({
          data: {
            email,
            username: data.adminUsername || email.split('@')[0],
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
          },
        });
        const installedSettings = {
          'branding.platform_name': data.siteName,
          'localization.locale': 'en',
        };
        await tx.systemSettings.upsert({
          where: { id: 'system' },
          create: {
            id: 'system', isInstalled: true, installedAt: new Date(),
            installedBy: adminUser.id, siteDescription: data.siteDescription,
            settings: installedSettings, version: runtimeVersion,
          },
          update: {
            isInstalled: true, installedAt: new Date(),
            installedBy: adminUser.id, siteDescription: data.siteDescription,
            settings: installedSettings, version: runtimeVersion,
          },
        });
        return { success: true };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return { success: false, error: 'Email is already in use', code: 'INSTALL_EMAIL_IN_USE' };
      }
      return { success: false, error: error.message };
    }
  }

  static async getSystemSettings() {
    return prisma.systemSettings.findUnique({ where: { id: 'system' } });
  }

  static async updateSystemSettings(data: Partial<{
    siteDescription: string;
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
