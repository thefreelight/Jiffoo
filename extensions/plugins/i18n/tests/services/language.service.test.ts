import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { prismaMock, syncLocalesToRedisMock } = vi.hoisted(() => ({
  prismaMock: {
    managedLanguage: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  },
  syncLocalesToRedisMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/lib/redis', () => ({
  syncLocalesToRedis: syncLocalesToRedisMock,
}));

import { LanguageService } from '../../src/services/language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // upsertLanguage
  // ==========================================================================

  describe('upsertLanguage', () => {
    it('upserts a language and syncs to Redis', async () => {
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'en', isEnabled: true },
      ]);

      await LanguageService.upsertLanguage({
        locale: 'fr',
        name: 'French',
        nativeName: 'Francais',
      });

      expect(prismaMock.managedLanguage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { locale: 'fr' },
          create: expect.objectContaining({ locale: 'fr', name: 'French' }),
          update: expect.objectContaining({ name: 'French' }),
        })
      );
      expect(syncLocalesToRedisMock).toHaveBeenCalled();
    });

    it('unsets previous default when isDefault is true', async () => {
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'zh-Hant', isEnabled: true },
      ]);

      await LanguageService.upsertLanguage({
        locale: 'zh-Hant',
        name: 'Traditional Chinese',
        nativeName: 'Traditional Chinese',
        isDefault: true,
      });

      expect(prismaMock.managedLanguage.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });

    it('does not unset defaults when isDefault is not provided', async () => {
      prismaMock.managedLanguage.findMany.mockResolvedValue([]);

      await LanguageService.upsertLanguage({
        locale: 'ja',
        name: 'Japanese',
        nativeName: 'Japanese',
      });

      expect(prismaMock.managedLanguage.updateMany).not.toHaveBeenCalled();
    });

    it('applies default values for optional fields', async () => {
      prismaMock.managedLanguage.findMany.mockResolvedValue([]);

      await LanguageService.upsertLanguage({
        locale: 'ko',
        name: 'Korean',
        nativeName: 'Korean',
      });

      expect(prismaMock.managedLanguage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isDefault: false,
            isEnabled: true,
            fallbackTo: null,
            direction: 'ltr',
            sortOrder: 0,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // listLanguages
  // ==========================================================================

  describe('listLanguages', () => {
    it('returns all languages ordered by isDefault, sortOrder, locale', async () => {
      const langs = [
        { locale: 'en', name: 'English', isDefault: true },
        { locale: 'fr', name: 'French', isDefault: false },
      ];
      prismaMock.managedLanguage.findMany.mockResolvedValue(langs);

      const result = await LanguageService.listLanguages();

      expect(result).toEqual(langs);
      expect(prismaMock.managedLanguage.findMany).toHaveBeenCalledWith({
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { locale: 'asc' }],
      });
    });
  });

  // ==========================================================================
  // getDefaultLanguage
  // ==========================================================================

  describe('getDefaultLanguage', () => {
    it('returns the default language', async () => {
      const lang = { locale: 'en', name: 'English', isDefault: true };
      prismaMock.managedLanguage.findFirst.mockResolvedValue(lang);

      const result = await LanguageService.getDefaultLanguage();

      expect(result).toEqual(lang);
      expect(prismaMock.managedLanguage.findFirst).toHaveBeenCalledWith({
        where: { isDefault: true },
      });
    });

    it('returns null when no default exists', async () => {
      prismaMock.managedLanguage.findFirst.mockResolvedValue(null);

      const result = await LanguageService.getDefaultLanguage();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // deleteLanguage
  // ==========================================================================

  describe('deleteLanguage', () => {
    it('deletes a non-default language and syncs to Redis', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue({
        locale: 'fr',
        isDefault: false,
      });
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'en', isEnabled: true },
      ]);

      const ok = await LanguageService.deleteLanguage('fr');

      expect(ok).toBe(true);
      expect(prismaMock.managedLanguage.delete).toHaveBeenCalledWith({
        where: { locale: 'fr' },
      });
      expect(syncLocalesToRedisMock).toHaveBeenCalled();
    });

    it('refuses to delete the default language', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue({
        locale: 'en',
        isDefault: true,
      });

      const ok = await LanguageService.deleteLanguage('en');

      expect(ok).toBe(false);
      expect(prismaMock.managedLanguage.delete).not.toHaveBeenCalled();
    });

    it('returns false for non-existent language', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue(null);

      const ok = await LanguageService.deleteLanguage('xx');

      expect(ok).toBe(false);
    });
  });

  // ==========================================================================
  // disableLanguage
  // ==========================================================================

  describe('disableLanguage', () => {
    it('disables a non-default language', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue({
        locale: 'fr',
        isDefault: false,
      });
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'en', isEnabled: true },
      ]);

      const ok = await LanguageService.disableLanguage('fr');

      expect(ok).toBe(true);
      expect(prismaMock.managedLanguage.update).toHaveBeenCalledWith({
        where: { locale: 'fr' },
        data: { isEnabled: false },
      });
    });

    it('refuses to disable the default language', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue({
        locale: 'en',
        isDefault: true,
      });

      const ok = await LanguageService.disableLanguage('en');

      expect(ok).toBe(false);
    });
  });

  // ==========================================================================
  // enableLanguage
  // ==========================================================================

  describe('enableLanguage', () => {
    it('enables a language', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue({
        locale: 'fr',
        isDefault: false,
        isEnabled: false,
      });
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'en', isEnabled: true },
        { locale: 'fr', isEnabled: true },
      ]);

      const ok = await LanguageService.enableLanguage('fr');

      expect(ok).toBe(true);
      expect(prismaMock.managedLanguage.update).toHaveBeenCalledWith({
        where: { locale: 'fr' },
        data: { isEnabled: true },
      });
    });

    it('returns false for non-existent language', async () => {
      prismaMock.managedLanguage.findUnique.mockResolvedValue(null);

      const ok = await LanguageService.enableLanguage('xx');

      expect(ok).toBe(false);
    });
  });

  // ==========================================================================
  // seedDefaults
  // ==========================================================================

  describe('seedDefaults', () => {
    it('seeds default languages when table is empty', async () => {
      prismaMock.managedLanguage.count.mockResolvedValue(0);
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'en', isEnabled: true },
        { locale: 'zh-Hant', isEnabled: true },
      ]);

      await LanguageService.seedDefaults();

      expect(prismaMock.managedLanguage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ locale: 'en', isDefault: true }),
          expect.objectContaining({ locale: 'zh-Hant', isDefault: false }),
        ]),
      });
      expect(syncLocalesToRedisMock).toHaveBeenCalled();
    });

    it('does nothing when languages already exist', async () => {
      prismaMock.managedLanguage.count.mockResolvedValue(3);

      await LanguageService.seedDefaults();

      expect(prismaMock.managedLanguage.createMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // fullSyncToRedis
  // ==========================================================================

  describe('fullSyncToRedis', () => {
    it('syncs enabled locales to Redis', async () => {
      prismaMock.managedLanguage.findMany.mockResolvedValue([
        { locale: 'en', isEnabled: true },
        { locale: 'fr', isEnabled: true },
      ]);

      await LanguageService.fullSyncToRedis();

      expect(syncLocalesToRedisMock).toHaveBeenCalledWith(['en', 'fr']);
    });
  });
});
