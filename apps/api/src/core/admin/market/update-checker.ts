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

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'market:update-check:results';
const CACHE_TTL = 86400; // 24 hours in seconds

let checkInterval: NodeJS.Timeout | null = null;

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
    Array<{
      slug: string;
      currentVersion: string;
      latestVersion: string;
      hasUpdate: boolean;
    }>
  > {
    const installed = await prisma.pluginInstall.findMany({
      where: { source: 'official-market', deletedAt: null },
      select: { slug: true, version: true },
    });

    if (installed.length === 0) return [];

    try {
      const updates = await MarketClient.checkUpdates(installed);
      const available = updates.filter((u) => u.hasUpdate);

      if (available.length > 0) {
        LoggerService.logSystem(
          `Market updates available: ${available.map((u) => `${u.slug} (${u.currentVersion} -> ${u.latestVersion})`).join(', ')}`
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
  async getCachedResults(): Promise<Array<{
    slug: string;
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
  }> | null> {
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
