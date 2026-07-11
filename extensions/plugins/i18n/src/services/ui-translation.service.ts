/**
 * UI Translation Service
 *
 * Manages UI text translations/overrides for themes and apps.
 * Theme built-in locale files provide defaults; these entries override them.
 * Cached in Redis for frontend consumption.
 */

import { prisma } from '../lib/prisma';
import { syncUIToRedis, getUIFromRedis } from '../lib/redis';

export class UITranslationService {
  /**
   * Set a single UI string translation.
   */
  static async setTranslation(
    locale: string,
    namespace: string,
    key: string,
    value: string
  ): Promise<void> {
    await prisma.uITranslation.upsert({
      where: { locale_namespace_key: { locale, namespace, key } },
      update: { value },
      create: { locale, namespace, key, value },
    });

    await this.syncNamespaceToRedis(locale, namespace);
  }

  /**
   * Set multiple UI translations for a locale+namespace at once.
   */
  static async setTranslations(
    locale: string,
    namespace: string,
    entries: Record<string, string>
  ): Promise<void> {
    const operations = Object.entries(entries).map(([key, value]) =>
      prisma.uITranslation.upsert({
        where: { locale_namespace_key: { locale, namespace, key } },
        update: { value },
        create: { locale, namespace, key, value },
      })
    );

    await prisma.$transaction(operations);
    await this.syncNamespaceToRedis(locale, namespace);
  }

  /**
   * Get all UI translations for a locale+namespace.
   */
  static async getTranslations(
    locale: string,
    namespace: string
  ): Promise<Record<string, string>> {
    const rows = await prisma.uITranslation.findMany({
      where: { locale, namespace },
    });

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /**
   * Get all UI translations for a locale (all namespaces merged).
   * Returns { namespace: { key: value } } structure.
   */
  static async getAllTranslations(
    locale: string
  ): Promise<Record<string, Record<string, string>>> {
    const rows = await prisma.uITranslation.findMany({
      where: { locale },
    });

    const result: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (!result[row.namespace]) {
        result[row.namespace] = {};
      }
      result[row.namespace][row.key] = row.value;
    }
    return result;
  }

  /**
   * Delete a single UI translation.
   */
  static async deleteTranslation(
    locale: string,
    namespace: string,
    key: string
  ): Promise<boolean> {
    try {
      await prisma.uITranslation.delete({
        where: { locale_namespace_key: { locale, namespace, key } },
      });
      await this.syncNamespaceToRedis(locale, namespace);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all UI translations for a locale (or locale+namespace).
   */
  static async deleteAll(locale: string, namespace?: string): Promise<number> {
    // Before deleting, get all affected namespaces for Redis cleanup
    const namespacesToClean: string[] = [];
    if (namespace) {
      namespacesToClean.push(namespace);
    } else {
      const distinct = await prisma.uITranslation.findMany({
        where: { locale },
        select: { namespace: true },
        distinct: ['namespace'],
      });
      namespacesToClean.push(...distinct.map((d: { namespace: string }) => d.namespace));
    }

    const { count } = await prisma.uITranslation.deleteMany({
      where: namespace ? { locale, namespace } : { locale },
    });

    // Sync each affected namespace to Redis (will write empty = delete key)
    for (const ns of namespacesToClean) {
      await this.syncNamespaceToRedis(locale, ns);
    }
    return count;
  }

  /**
   * Get translation from Redis cache (used by API endpoint for frontend).
   * Falls back to DB if cache miss.
   */
  static async getCachedTranslations(
    locale: string,
    namespace: string
  ): Promise<Record<string, string>> {
    const cached = await getUIFromRedis(locale, namespace);
    if (cached) return cached;

    // Cache miss: load from DB and sync
    const translations = await this.getTranslations(locale, namespace);
    if (Object.keys(translations).length > 0) {
      await syncUIToRedis(locale, namespace, translations);
    }
    return translations;
  }

  // --------------------------------------------------------------------------
  // Redis Sync
  // --------------------------------------------------------------------------

  private static async syncNamespaceToRedis(
    locale: string,
    namespace: string
  ): Promise<void> {
    const translations = await this.getTranslations(locale, namespace);
    await syncUIToRedis(locale, namespace, translations);
  }

  /**
   * Full sync: rebuild all Redis UI translation keys.
   * Uses cursor-based pagination to avoid loading all rows into memory.
   */
  static async fullSyncToRedis(): Promise<number> {
    const BATCH_SIZE = 500;
    let cursor: string | undefined;

    // UI translations are grouped by locale:namespace, accumulate per group
    const grouped = new Map<string, Record<string, string>>();

    while (true) {
      const rows = await prisma.uITranslation.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, locale: true, namespace: true, key: true, value: true },
        orderBy: { id: 'asc' },
      });

      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const row of rows) {
        const compositeKey = `${row.locale}:${row.namespace}`;
        let entry = grouped.get(compositeKey);
        if (!entry) {
          entry = {};
          grouped.set(compositeKey, entry);
        }
        entry[row.key] = row.value;
      }
    }

    // UI groups are typically small (hundreds of keys per namespace),
    // so flushing all at the end is fine.
    for (const [compositeKey, messages] of grouped) {
      const idx = compositeKey.indexOf(':');
      const locale = compositeKey.slice(0, idx);
      const namespace = compositeKey.slice(idx + 1);
      await syncUIToRedis(locale, namespace, messages);
    }

    return grouped.size;
  }
}
