/**
 * i18n plugin - Real DB integration tests
 *
 * Requires PostgreSQL running at localhost:5499.
 * Uses the i18n-specific Prisma client generated output.
 */

import { loadEnvFile } from '../../../../../tests/shared/load-env';
import path from 'path';
loadEnvFile(path.resolve(__dirname, '../../../../../.env.test'));

import { PrismaClient } from '../../node_modules/.prisma/i18n-client';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.I18N_DATABASE_URL },
  },
});

async function cleanAll() {
  await prisma.translationJob.deleteMany();
  await prisma.uITranslation.deleteMany();
  await prisma.contentTranslation.deleteMany();
  await prisma.managedLanguage.deleteMany();
}

describe('i18n DB Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await cleanAll();
  });

  afterAll(async () => {
    await cleanAll();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanAll();
  });

  // ==========================================================================
  // ManagedLanguage
  // ==========================================================================

  describe('ManagedLanguage', () => {
    it('should create and read a managed language', async () => {
      const lang = await prisma.managedLanguage.create({
        data: {
          locale: 'en',
          name: 'English',
          nativeName: 'English',
          isDefault: true,
          isEnabled: true,
          direction: 'ltr',
        },
      });

      expect(lang.id).toBeDefined();
      expect(lang.locale).toBe('en');
      expect(lang.isDefault).toBe(true);
      expect(lang.direction).toBe('ltr');

      const found = await prisma.managedLanguage.findUnique({
        where: { locale: 'en' },
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe('English');
    });

    it('should enforce unique constraint on locale', async () => {
      await prisma.managedLanguage.create({
        data: { locale: 'fr', name: 'French', nativeName: 'Francais' },
      });

      await expect(
        prisma.managedLanguage.create({
          data: { locale: 'fr', name: 'French 2', nativeName: 'Francais 2' },
        })
      ).rejects.toThrow();
    });

    it('should update a managed language', async () => {
      await prisma.managedLanguage.create({
        data: { locale: 'de', name: 'German', nativeName: 'Deutsch' },
      });

      const updated = await prisma.managedLanguage.update({
        where: { locale: 'de' },
        data: { isEnabled: false, fallbackTo: 'en' },
      });

      expect(updated.isEnabled).toBe(false);
      expect(updated.fallbackTo).toBe('en');
    });

    it('should delete a managed language', async () => {
      await prisma.managedLanguage.create({
        data: { locale: 'ja', name: 'Japanese', nativeName: 'Japanese' },
      });

      await prisma.managedLanguage.delete({ where: { locale: 'ja' } });

      const found = await prisma.managedLanguage.findUnique({
        where: { locale: 'ja' },
      });
      expect(found).toBeNull();
    });
  });

  // ==========================================================================
  // ContentTranslation
  // ==========================================================================

  describe('ContentTranslation', () => {
    it('should create and upsert a content translation', async () => {
      const ct = await prisma.contentTranslation.create({
        data: {
          entityType: 'product',
          entityId: 'prod_1',
          locale: 'fr',
          field: 'name',
          value: 'Produit 1',
        },
      });

      expect(ct.id).toBeDefined();
      expect(ct.value).toBe('Produit 1');

      // Upsert: update on conflict
      const upserted = await prisma.contentTranslation.upsert({
        where: {
          entityType_entityId_locale_field: {
            entityType: 'product',
            entityId: 'prod_1',
            locale: 'fr',
            field: 'name',
          },
        },
        update: { value: 'Produit Un' },
        create: {
          entityType: 'product',
          entityId: 'prod_1',
          locale: 'fr',
          field: 'name',
          value: 'Produit Un',
        },
      });

      expect(upserted.value).toBe('Produit Un');
    });

    it('should enforce unique constraint on entityType+entityId+locale+field', async () => {
      await prisma.contentTranslation.create({
        data: {
          entityType: 'category',
          entityId: 'cat_1',
          locale: 'de',
          field: 'name',
          value: 'Kategorie 1',
        },
      });

      await expect(
        prisma.contentTranslation.create({
          data: {
            entityType: 'category',
            entityId: 'cat_1',
            locale: 'de',
            field: 'name',
            value: 'Kategorie Eins',
          },
        })
      ).rejects.toThrow();
    });

    it('should allow same field for different locales', async () => {
      await prisma.contentTranslation.create({
        data: {
          entityType: 'product',
          entityId: 'prod_2',
          locale: 'fr',
          field: 'name',
          value: 'Produit 2 FR',
        },
      });

      const de = await prisma.contentTranslation.create({
        data: {
          entityType: 'product',
          entityId: 'prod_2',
          locale: 'de',
          field: 'name',
          value: 'Produkt 2 DE',
        },
      });

      expect(de.value).toBe('Produkt 2 DE');
    });
  });

  // ==========================================================================
  // UITranslation
  // ==========================================================================

  describe('UITranslation', () => {
    it('should create and read a UI translation', async () => {
      const ui = await prisma.uITranslation.create({
        data: {
          locale: 'fr',
          namespace: 'common',
          key: 'nav.home',
          value: 'Accueil',
        },
      });

      expect(ui.id).toBeDefined();
      expect(ui.value).toBe('Accueil');
    });

    it('should enforce unique constraint on locale+namespace+key', async () => {
      await prisma.uITranslation.create({
        data: {
          locale: 'de',
          namespace: 'shop',
          key: 'cart.title',
          value: 'Warenkorb',
        },
      });

      await expect(
        prisma.uITranslation.create({
          data: {
            locale: 'de',
            namespace: 'shop',
            key: 'cart.title',
            value: 'Einkaufswagen',
          },
        })
      ).rejects.toThrow();
    });

    it('should allow the same key in different namespaces', async () => {
      await prisma.uITranslation.create({
        data: { locale: 'ja', namespace: 'common', key: 'title', value: 'Title Common' },
      });

      const shopTitle = await prisma.uITranslation.create({
        data: { locale: 'ja', namespace: 'shop', key: 'title', value: 'Title Shop' },
      });

      expect(shopTitle.value).toBe('Title Shop');
    });
  });

  // ==========================================================================
  // TranslationJob
  // ==========================================================================

  describe('TranslationJob', () => {
    it('should create a translation job with defaults', async () => {
      const job = await prisma.translationJob.create({
        data: {
          targetLocale: 'fr',
          entityType: 'product',
          provider: 'deepl',
          totalKeys: 100,
        },
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.doneKeys).toBe(0);
      expect(job.totalKeys).toBe(100);
    });

    it('should update job status and progress', async () => {
      const job = await prisma.translationJob.create({
        data: {
          targetLocale: 'de',
          provider: 'gpt',
          totalKeys: 50,
        },
      });

      // Start the job
      const running = await prisma.translationJob.update({
        where: { id: job.id },
        data: { status: 'running', doneKeys: 10 },
      });
      expect(running.status).toBe('running');
      expect(running.doneKeys).toBe(10);

      // Complete the job
      const completed = await prisma.translationJob.update({
        where: { id: job.id },
        data: { status: 'completed', doneKeys: 50 },
      });
      expect(completed.status).toBe('completed');
      expect(completed.doneKeys).toBe(50);
    });

    it('should handle failed job with error message', async () => {
      const job = await prisma.translationJob.create({
        data: {
          targetLocale: 'ja',
          provider: 'deepl',
          totalKeys: 20,
        },
      });

      const failed = await prisma.translationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: 'API rate limit exceeded',
          doneKeys: 5,
        },
      });

      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('API rate limit exceeded');
      expect(failed.doneKeys).toBe(5);
    });
  });

  // ==========================================================================
  // Cascade operations
  // ==========================================================================

  describe('Cascade operations', () => {
    it('should delete multiple content translations for an entity', async () => {
      await prisma.contentTranslation.createMany({
        data: [
          { entityType: 'product', entityId: 'prod_del', locale: 'fr', field: 'name', value: 'Nom' },
          { entityType: 'product', entityId: 'prod_del', locale: 'fr', field: 'description', value: 'Description' },
          { entityType: 'product', entityId: 'prod_del', locale: 'de', field: 'name', value: 'Name' },
        ],
      });

      // Delete all FR translations for this product
      const deleted = await prisma.contentTranslation.deleteMany({
        where: {
          entityType: 'product',
          entityId: 'prod_del',
          locale: 'fr',
        },
      });

      expect(deleted.count).toBe(2);

      // DE translation should still exist
      const remaining = await prisma.contentTranslation.findMany({
        where: { entityType: 'product', entityId: 'prod_del' },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].locale).toBe('de');
    });
  });
});
