import crypto from 'crypto';
import path from 'path';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { Readable } from 'stream';
import { prisma } from '@/config/database';
import {
  extensionInstaller,
  type ExtensionKind,
  type InstallResult,
} from '@/core/admin/extension-installer';
import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { ThemeManagementService, type ThemeTarget } from '@/core/admin/theme-management/service';
import type { ActiveTheme, ThemeConfig } from '@/core/admin/theme-management/types';
import { pluginPackageStore, type PluginPackage } from '@/core/storage/plugin-package-store';

export interface PluginInstallationState {
  installationId: string;
  instanceKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
  grantedPermissions: string[];
  lifecycleWarning: string | null;
  readiness: {
    requiresConfiguration: boolean;
    ready: boolean;
    missingFields: string[];
  };
}

export interface ThemeActivationState {
  target: ThemeTarget;
  activated: boolean;
  activeTheme: ActiveTheme;
}

export interface OfficialMarketInstallOptions {
  kind: ExtensionKind;
  zipBuffer?: Buffer;
  artifactPath?: string;
  activate?: boolean;
  themeConfig?: ThemeConfig;
  requestedVersion?: string;
  packageUrl?: string;
}

export interface OfficialMarketInstallResult extends InstallResult {
  source: 'official-market';
  marketInstall?: {
    requestedVersion?: string;
    installedVersion: string;
    packageUrl?: string;
  };
  pluginInstallation?: PluginInstallationState;
  themeActivation?: ThemeActivationState;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolveThemeTarget(kind: ExtensionKind): ThemeTarget | null {
  switch (kind) {
    case 'theme-shop':
    case 'theme-app-shop':
      return 'shop';
    case 'theme-admin':
    case 'theme-app-admin':
      return 'admin';
    default:
      return null;
  }
}

async function updateInstalledMetaSource(
  fsPath: string,
  installResult: InstallResult,
  options: OfficialMarketInstallOptions,
): Promise<void> {
  const metaPath = path.join(fsPath, '.installed.json');
  let meta: Record<string, unknown>;

  try {
    meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    const manifestPath = path.join(fsPath, 'manifest.json');
    const stat = await fs.stat(fsPath);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as Record<string, unknown>;

    meta = {
      id: crypto.randomUUID(),
      slug: typeof manifest.slug === 'string' ? manifest.slug : installResult.slug,
      name: typeof manifest.name === 'string' ? manifest.name : installResult.slug,
      version: typeof manifest.version === 'string' ? manifest.version : installResult.version,
      description: typeof manifest.description === 'string' ? manifest.description : '',
      category: typeof manifest.category === 'string' ? manifest.category : 'general',
      runtimeType: typeof manifest.runtimeType === 'string' ? manifest.runtimeType : 'internal-fastify',
      entryModule: typeof manifest.entryModule === 'string' ? manifest.entryModule : undefined,
      source: 'official-market',
      fsPath,
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      author: typeof manifest.author === 'string' ? manifest.author : undefined,
      authorUrl: typeof manifest.authorUrl === 'string' ? manifest.authorUrl : undefined,
      installedAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }

  meta.source = 'official-market';
  meta.officialMarket = {
    requestedVersion: options.requestedVersion,
    installedVersion: installResult.version,
    packageUrl: options.packageUrl,
    installedAt: new Date().toISOString(),
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

async function updatePluginInstalledMetaSource(pluginPackage: PluginPackage, installResult: InstallResult, options: OfficialMarketInstallOptions): Promise<void> {
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(await pluginPackage.readText('.installed.json')) as Record<string, unknown>;
  } catch {
    const manifest = JSON.parse(await pluginPackage.readText('manifest.json')) as Record<string, unknown>;
    const stat = await pluginPackage.stat();
    meta = {
      id: crypto.randomUUID(), slug: typeof manifest.slug === 'string' ? manifest.slug : installResult.slug,
      name: typeof manifest.name === 'string' ? manifest.name : installResult.slug,
      version: typeof manifest.version === 'string' ? manifest.version : installResult.version,
      description: typeof manifest.description === 'string' ? manifest.description : '',
      category: typeof manifest.category === 'string' ? manifest.category : 'general',
      runtimeType: typeof manifest.runtimeType === 'string' ? manifest.runtimeType : 'internal-fastify',
      entryModule: typeof manifest.entryModule === 'string' ? manifest.entryModule : undefined,
      source: 'official-market', fsPath: pluginPackage.getEntryPath(''),
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      author: typeof manifest.author === 'string' ? manifest.author : undefined,
      authorUrl: typeof manifest.authorUrl === 'string' ? manifest.authorUrl : undefined,
      installedAt: stat.birthtime.toISOString(), updatedAt: stat.mtime.toISOString(),
    };
  }
  meta.source = 'official-market';
  meta.officialMarket = { requestedVersion: options.requestedVersion, installedVersion: installResult.version, packageUrl: options.packageUrl, installedAt: new Date().toISOString() };
  await pluginPackage.writeText('.installed.json', JSON.stringify(meta, null, 2));
}

async function markInstalledSource(
  kind: ExtensionKind,
  slug: string,
  fsPath: string,
  installResult: InstallResult,
  options: OfficialMarketInstallOptions,
): Promise<void> {
  if (kind === 'plugin') {
    await prisma.pluginInstall.update({
      where: { slug },
      data: { source: 'official-market' },
    });
    const pluginPackage = await pluginPackageStore.get(slug);
    if (!pluginPackage) throw new Error(`Plugin package files are missing for "${slug}"`);
    await updatePluginInstalledMetaSource(pluginPackage, installResult, options);
    return;
  }

  await updateInstalledMetaSource(fsPath, installResult, options);
}

async function buildPluginInstallationState(slug: string): Promise<PluginInstallationState> {
  const pluginPackage = await PluginManagementService.getPluginPackage(slug);
  if (!pluginPackage) {
    throw new Error(`Plugin "${slug}" not found after install`);
  }

  let defaultInstance = await PluginManagementService.getDefaultInstance(slug);
  if (!defaultInstance) {
    defaultInstance = await PluginManagementService.createInstance(slug, 'default', {
      enabled: false,
      grantedPermissions: parseJsonArray(pluginPackage.permissions),
    });
  }

  const config = parseJsonObject(defaultInstance.configJson);
  const readiness = evaluatePluginConfigReadiness(pluginPackage.manifestJson, config);

  return {
    installationId: defaultInstance.id,
    instanceKey: defaultInstance.instanceKey,
    enabled: defaultInstance.enabled,
    config,
    grantedPermissions: parseJsonArray(defaultInstance.grantedPermissions),
    lifecycleWarning: defaultInstance.lifecycleWarning ?? null,
    readiness,
  };
}

async function buildThemeActivationState(
  kind: ExtensionKind,
  slug: string,
  activate?: boolean,
  themeConfig?: ThemeConfig
): Promise<ThemeActivationState | undefined> {
  const target = resolveThemeTarget(kind);
  if (!target) {
    return undefined;
  }

  const activeTheme = activate
    ? await ThemeManagementService.activateTheme(slug, target, themeConfig)
    : await ThemeManagementService.getActiveTheme(target);

  return {
    target,
    activated: activeTheme.slug === slug,
    activeTheme,
  };
}

export async function installOfficialMarketExtension(
  options: OfficialMarketInstallOptions
): Promise<OfficialMarketInstallResult> {
  const zipStream = options.artifactPath
    ? createReadStream(options.artifactPath)
    : options.zipBuffer
      ? Readable.from(options.zipBuffer)
      : null;

  if (!zipStream) {
    throw new Error('Official market install requires artifactPath or zipBuffer');
  }

  const installResult = await extensionInstaller.installFromZip(
    options.kind,
    zipStream,
    { source: 'official-market' }
  );

  await markInstalledSource(options.kind, installResult.slug, installResult.fsPath, installResult, options);

  const result: OfficialMarketInstallResult = {
    ...installResult,
    source: 'official-market',
    marketInstall: {
      requestedVersion: options.requestedVersion,
      installedVersion: installResult.version,
      packageUrl: options.packageUrl,
    },
  };

  if (options.kind === 'plugin') {
    result.pluginInstallation = await buildPluginInstallationState(installResult.slug);
    return result;
  }

  const themeActivation = await buildThemeActivationState(
    options.kind,
    installResult.slug,
    options.activate,
    options.themeConfig
  );

  if (themeActivation) {
    result.themeActivation = themeActivation;
  }

  return result;
}
