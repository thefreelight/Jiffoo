/**
 * Language Service
 *
 * Manages available languages, fallback chains, and locale configuration.
 * Syncs enabled locales to Redis for core API and frontend awareness.
 */

import { prisma } from '../lib/prisma';
import { syncLocalesToRedis } from '../lib/redis';

export type LanguageInput = {
  locale: string;
  name: string;
  nativeName: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  fallbackTo?: string | null;
  direction?: string;
  sortOrder?: number;
};

export class LanguageService {
  /**
   * Add or update a language.
   */
  static async upsertLanguage(input: LanguageInput): Promise<void> {
    const { locale, name, nativeName, isDefault, isEnabled, fallbackTo, direction, sortOrder } = input;

    // If setting as default, unset previous default
    if (isDefault) {
      await prisma.managedLanguage.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    await prisma.managedLanguage.upsert({
      where: { locale },
      update: {
        name,
        nativeName,
        isDefault: isDefault ?? false,
        isEnabled: isEnabled ?? true,
        fallbackTo: fallbackTo ?? null,
        direction: direction ?? 'ltr',
        sortOrder: sortOrder ?? 0,
      },
      create: {
        locale,
        name,
        nativeName,
        isDefault: isDefault ?? false,
        isEnabled: isEnabled ?? true,
        fallbackTo: fallbackTo ?? null,
        direction: direction ?? 'ltr',
        sortOrder: sortOrder ?? 0,
      },
    });

    await this.syncToRedis();
  }

  /**
   * List all managed languages.
   */
  static async listLanguages() {
    return prisma.managedLanguage.findMany({
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { locale: 'asc' }],
    });
  }

  /**
   * Get enabled languages only.
   */
  static async getEnabledLanguages() {
    return prisma.managedLanguage.findMany({
      where: { isEnabled: true },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  /**
   * Get the default language.
   */
  static async getDefaultLanguage() {
    return prisma.managedLanguage.findFirst({
      where: { isDefault: true },
    });
  }

  /**
   * Disable a language (cannot disable the default).
   */
  static async disableLanguage(locale: string): Promise<boolean> {
    const lang = await prisma.managedLanguage.findUnique({ where: { locale } });
    if (!lang || lang.isDefault) return false;

    await prisma.managedLanguage.update({
      where: { locale },
      data: { isEnabled: false },
    });

    await this.syncToRedis();
    return true;
  }

  /**
   * Enable a language.
   */
  static async enableLanguage(locale: string): Promise<boolean> {
    const lang = await prisma.managedLanguage.findUnique({ where: { locale } });
    if (!lang) return false;

    await prisma.managedLanguage.update({
      where: { locale },
      data: { isEnabled: true },
    });

    await this.syncToRedis();
    return true;
  }

  /**
   * Delete a language (cannot delete the default).
   */
  static async deleteLanguage(locale: string): Promise<boolean> {
    const lang = await prisma.managedLanguage.findUnique({ where: { locale } });
    if (!lang || lang.isDefault) return false;

    await prisma.managedLanguage.delete({ where: { locale } });
    await this.syncToRedis();
    return true;
  }

  /**
   * Seed default languages if none exist.
   */
  static async seedDefaults(): Promise<void> {
    const count = await prisma.managedLanguage.count();
    if (count > 0) return;

    await prisma.managedLanguage.createMany({
      data: [
        { locale: 'en', name: 'English', nativeName: 'English', isDefault: true, isEnabled: true, sortOrder: 0 },
        { locale: 'zh-Hant', name: 'Traditional Chinese', nativeName: '繁體中文', isDefault: false, isEnabled: true, fallbackTo: 'en', sortOrder: 1 },
      ],
    });

    await this.syncToRedis();
  }

  // --------------------------------------------------------------------------
  // Redis Sync
  // --------------------------------------------------------------------------

  /**
   * Sync enabled locale list to Redis.
   */
  private static async syncToRedis(): Promise<void> {
    const enabled = await this.getEnabledLanguages();
    const locales = enabled.map((l: { locale: string }) => l.locale);
    await syncLocalesToRedis(locales);
  }

  /**
   * Full sync (called during plugin warm-up).
   */
  static async fullSyncToRedis(): Promise<void> {
    await this.syncToRedis();
  }
}
