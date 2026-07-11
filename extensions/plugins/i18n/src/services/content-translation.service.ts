/**
 * Content Translation Service
 *
 * Manages translations for core entities (products, categories, pages, etc.).
 * Writes to plugin DB + syncs to Redis for core API consumption.
 */

import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { syncContentToRedis, removeContentFromRedis } from '../lib/redis';

export type TranslationInput = {
  entityType: string;
  entityId: string;
  locale: string;
  field: string;
  value: string;
  sourceDigest?: string;
};

export type BulkTranslationInput = {
  entityType: string;
  entityId: string;
  locale: string;
  fields: Record<string, string>;
  sourceDigests?: Record<string, string>;
};

export class ContentTranslationService {
  /**
   * Set a single field translation. Creates or updates.
   */
  static async setTranslation(input: TranslationInput): Promise<void> {
    const { entityType, entityId, locale, field, value, sourceDigest } = input;

    await prisma.contentTranslation.upsert({
      where: {
        entityType_entityId_locale_field: { entityType, entityId, locale, field },
      },
      update: { value, sourceDigest: sourceDigest ?? null },
      create: { entityType, entityId, locale, field, value, sourceDigest: sourceDigest ?? null },
    });

    // Sync all fields for this entity+locale to Redis
    await this.syncEntityToRedis(entityType, entityId, locale);
  }

  /**
   * Set multiple field translations for a single entity+locale at once.
   */
  static async setTranslations(input: BulkTranslationInput): Promise<void> {
    const { entityType, entityId, locale, fields, sourceDigests } = input;

    const operations = Object.entries(fields).map(([field, value]) => {
      const digest = sourceDigests?.[field] ?? null;
      return prisma.contentTranslation.upsert({
        where: {
          entityType_entityId_locale_field: { entityType, entityId, locale, field },
        },
        update: { value, sourceDigest: digest },
        create: { entityType, entityId, locale, field, value, sourceDigest: digest },
      });
    });

    await prisma.$transaction(operations);
    await this.syncEntityToRedis(entityType, entityId, locale);
  }

  /**
   * Get all translations for an entity in a specific locale.
   */
  static async getTranslations(
    entityType: string,
    entityId: string,
    locale: string
  ): Promise<Record<string, string>> {
    const rows = await prisma.contentTranslation.findMany({
      where: { entityType, entityId, locale },
    });

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.field] = row.value;
    }
    return result;
  }

  /**
   * Get translations for multiple entities of the same type.
   */
  static async getBatchTranslations(
    entityType: string,
    entityIds: string[],
    locale: string
  ): Promise<Map<string, Record<string, string>>> {
    const rows = await prisma.contentTranslation.findMany({
      where: { entityType, entityId: { in: entityIds }, locale },
    });

    const map = new Map<string, Record<string, string>>();
    for (const row of rows) {
      let entry = map.get(row.entityId);
      if (!entry) {
        entry = {};
        map.set(row.entityId, entry);
      }
      entry[row.field] = row.value;
    }
    return map;
  }

  /**
   * Delete all translations for an entity (all locales) or specific locale.
   */
  static async deleteTranslations(
    entityType: string,
    entityId: string,
    locale?: string
  ): Promise<number> {
    const where: { entityType: string; entityId: string; locale?: string } = {
      entityType,
      entityId,
    };
    if (locale) where.locale = locale;

    const { count } = await prisma.contentTranslation.deleteMany({ where });
    await removeContentFromRedis(entityType, entityId, locale);
    return count;
  }

  /**
   * List all translated entity IDs for a given type and locale.
   */
  static async listTranslatedEntities(
    entityType: string,
    locale: string,
    page = 1,
    limit = 50
  ) {
    const skip = (page - 1) * limit;

    // Get distinct entityIds
    const rows = await prisma.contentTranslation.findMany({
      where: { entityType, locale },
      select: { entityId: true },
      distinct: ['entityId'],
      skip,
      take: limit,
    });

    const total = await prisma.contentTranslation.groupBy({
      by: ['entityId'],
      where: { entityType, locale },
    });

    return {
      items: rows.map((r: { entityId: string }) => r.entityId),
      page,
      limit,
      total: total.length,
      totalPages: Math.ceil(total.length / limit),
    };
  }

  /**
   * Get translation completeness stats for a locale.
   */
  static async getCompleteness(entityType: string, locale: string) {
    const translatedCount = await prisma.contentTranslation.groupBy({
      by: ['entityId'],
      where: { entityType, locale },
    });

    return {
      entityType,
      locale,
      translatedEntities: translatedCount.length,
    };
  }

  // --------------------------------------------------------------------------
  // Redis Sync
  // --------------------------------------------------------------------------

  /**
   * Rebuild the Redis cache entry for a specific entity+locale.
   */
  private static async syncEntityToRedis(
    entityType: string,
    entityId: string,
    locale: string
  ): Promise<void> {
    const fields = await this.getTranslations(entityType, entityId, locale);
    await syncContentToRedis(entityType, entityId, locale, fields);
  }

  /**
   * Full sync: rebuild all Redis content translation keys.
   * Uses cursor-based pagination to avoid loading all rows into memory.
   */
  static async fullSyncToRedis(): Promise<number> {
    const BATCH_SIZE = 500;
    let cursor: string | undefined;
    let totalSynced = 0;

    // Buffer to accumulate fields for a composite key across batch boundaries
    let bufferKey = '';
    let bufferParts: [string, string, string] = ['', '', ''];
    let bufferFields: Record<string, string> = {};

    while (true) {
      const rows = await prisma.contentTranslation.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, entityType: true, entityId: true, locale: true, field: true, value: true },
        orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }, { locale: 'asc' }, { id: 'asc' }],
      });

      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const row of rows) {
        const key = `${row.entityType}:${row.entityId}:${row.locale}`;
        if (key !== bufferKey) {
          // Flush previous buffer
          if (bufferKey && Object.keys(bufferFields).length > 0) {
            await syncContentToRedis(bufferParts[0], bufferParts[1], bufferParts[2], bufferFields);
            totalSynced++;
          }
          bufferKey = key;
          bufferParts = [row.entityType, row.entityId, row.locale];
          bufferFields = {};
        }
        bufferFields[row.field] = row.value;
      }
    }

    // Flush final buffer
    if (bufferKey && Object.keys(bufferFields).length > 0) {
      await syncContentToRedis(bufferParts[0], bufferParts[1], bufferParts[2], bufferFields);
      totalSynced++;
    }

    return totalSynced;
  }

  // --------------------------------------------------------------------------
  // Digest Helpers
  // --------------------------------------------------------------------------

  /**
   * Compute a SHA-256 digest for source content (Shopify pattern).
   * Used to detect stale translations when source content changes.
   */
  static computeDigest(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }
}
