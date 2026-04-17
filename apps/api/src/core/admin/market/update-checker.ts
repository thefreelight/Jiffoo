/**
 * Market Update Checker (§4.9)
 *
 * Periodically checks for updates to installed market extensions.
 * Runs as a background job every 24 hours.
 */

import { prisma } from '@/config/database';
import { MarketClient } from './market-client';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { ThemeManagementService } from '@/core/admin/theme-management/service';
import { compareVersions } from '@/core/admin/extension-installer/version-utils';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'market:update-check:results';
const CACHE_TTL = 86400; // 24 hours in seconds

let checkInterval: NodeJS.Timeout | null = null;

export type MarketUpdateCheckResult = {
  kind: 'theme' | 'plugin';
  slug: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
};

function hasVersionUpdate(currentVersion: string, latestVersion: string): boolean {
  try {
    return compareVersions(latestVersion, currentVersion) > 0;
  } catch {
    return latestVersion !== currentVersion;
  }
}

async function getInstalledOfficialThemes(): Promise<Array<{ slug: string; version: string }>> {
  const [activeTheme, installedThemes] = await Promise.all([
    ThemeManagementService.getActiveTheme('shop'),
    ThemeManagementService.getInstalledThemes('shop'),
  ]);

  const themesBySlug = new Map<string, string>();

  for (const theme of installedThemes.items) {
    if (theme.source === 'official-market' && theme.type === 'pack') {
      themesBySlug.set(theme.slug, theme.version);
    }
  }

  if (activeTheme.source === 'official-market' && activeTheme.type === 'pack') {
    themesBySlug.set(activeTheme.slug, activeTheme.version);
  }

  return Array.from(themesBySlug.entries()).map(([slug, version]) => ({ slug, version }));
}

export const UpdateChecker = {
  /** Start the periodic update checker */
  start() {
    if (checkInterval) return;

    LoggerService.logSystem('Market update checker started (24h interval)');

    // Run first check after 5 minutes (let server settle)
    setTimeout(() => {
      this.check().catch((err) =>
        LoggerService.logError(err, { context: 'Market update check' })
      );
    }, 5 * 60 * 1000);

    checkInterval = setInterval(() => {
      this.check().catch((err) =>
        LoggerService.logError(err, { context: 'Market update check' })
      );
    }, CHECK_INTERVAL_MS);
  },

  /** Stop the periodic update checker */
  stop() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
      LoggerService.logSystem('Market update checker stopped');
    }
  },

  /** Run an update check */
  async check(): Promise<
    MarketUpdateCheckResult[]
  > {
    const [installedPlugins, installedThemes] = await Promise.all([
      prisma.pluginInstall.findMany({
        where: { source: 'official-market', deletedAt: null },
        select: { slug: true, version: true },
      }),
      getInstalledOfficialThemes(),
    ]);

    if (installedPlugins.length === 0 && installedThemes.length === 0) return [];

    try {
      const remoteCatalog = await MarketClient.getOfficialCatalog(undefined, { fresh: true });
      const remoteItemsBySlug = new Map(
        remoteCatalog.items.map((item) => [item.slug, item]),
      );
      const updates: MarketUpdateCheckResult[] = [
        ...installedThemes.map(({ slug, version }) => {
          const remoteItem = remoteItemsBySlug.get(slug);
          const latestVersion = remoteItem?.sellableVersion || remoteItem?.currentVersion || version;
          return {
            kind: 'theme' as const,
            slug,
            currentVersion: version,
            latestVersion,
            hasUpdate: hasVersionUpdate(version, latestVersion),
          };
        }),
        ...installedPlugins.map(({ slug, version }) => {
          const remoteItem = remoteItemsBySlug.get(slug);
          const latestVersion = remoteItem?.sellableVersion || remoteItem?.currentVersion || version;
          return {
            kind: 'plugin' as const,
            slug,
            currentVersion: version,
            latestVersion,
            hasUpdate: hasVersionUpdate(version, latestVersion),
          };
        }),
      ];
      const available = updates.filter((u) => u.hasUpdate);

      if (available.length > 0) {
        LoggerService.logSystem(
          `Market updates available: ${available.map((u) => `${u.kind}:${u.slug} (${u.currentVersion} -> ${u.latestVersion})`).join(', ')}`
        );
      }

      // Cache results
      await CacheService.set(CACHE_KEY, JSON.stringify(updates), { ttl: CACHE_TTL });

      return updates;
    } catch (error: any) {
      LoggerService.logError(error, { context: 'Market update check' });
      return [];
    }
  },

  /** Get cached update check results */
  async getCachedResults(): Promise<MarketUpdateCheckResult[] | null> {
    const cached = await CacheService.get<string>(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return null;
  },
};
