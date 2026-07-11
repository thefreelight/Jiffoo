/**
 * Auto-Translate Service
 *
 * Creates translation jobs, processes them in background,
 * and tracks progress via the TranslationJob table.
 */

import { prisma } from '../lib/prisma';
import { ContentTranslationService } from './content-translation.service';
import { UITranslationService } from './ui-translation.service';
import { LanguageService } from './language.service';
import { getProvider, type TranslationProvider } from './translation-provider';

const TRANSLATE_BATCH_SIZE = 20;

export type AutoTranslateRequest = {
  targetLocale: string;
  provider: string;
  scope: 'content' | 'ui';
  entityType?: string;
  namespace?: string;
  entityIds?: string[];
  overwrite?: boolean;
};

export class AutoTranslateService {
  /**
   * Create and start a translation job. Returns job ID immediately.
   */
  static async startJob(request: AutoTranslateRequest): Promise<string> {
    const provider = getProvider(request.provider);
    if (!provider) throw new Error(`Provider "${request.provider}" is not configured. Set the API key env var.`);

    const defaultLang = await LanguageService.getDefaultLanguage();
    if (!defaultLang) throw new Error('No default language configured');

    if (request.scope === 'content' && !request.entityType) {
      throw new Error('entityType is required for content scope');
    }

    const totalKeys = await this.countSourceKeys(request, defaultLang.locale);

    const job = await prisma.translationJob.create({
      data: {
        targetLocale: request.targetLocale,
        entityType: request.scope === 'content' ? request.entityType : null,
        provider: request.provider,
        status: 'running',
        totalKeys,
        doneKeys: 0,
      },
    });

    // Fire-and-forget background processing
    this.processJob(job.id, request, provider, defaultLang.locale).catch((err) => {
      console.error(`[i18n] Auto-translate job ${job.id} failed:`, err);
    });

    return job.id;
  }

  static async getJob(jobId: string) {
    return prisma.translationJob.findUnique({ where: { id: jobId } });
  }

  static async listJobs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.translationJob.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.translationJob.count(),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private static async countSourceKeys(req: AutoTranslateRequest, sourceLang: string): Promise<number> {
    if (req.scope === 'content') {
      const where: Record<string, unknown> = { entityType: req.entityType, locale: sourceLang };
      if (req.entityIds?.length) where.entityId = { in: req.entityIds };
      return prisma.contentTranslation.count({ where: where as any });
    }
    const where: Record<string, unknown> = { locale: sourceLang };
    if (req.namespace) where.namespace = req.namespace;
    return prisma.uITranslation.count({ where: where as any });
  }

  private static async processJob(
    jobId: string,
    request: AutoTranslateRequest,
    provider: TranslationProvider,
    sourceLang: string
  ): Promise<void> {
    try {
      if (request.scope === 'content') {
        await this.processContentJob(jobId, request, provider, sourceLang);
      } else {
        await this.processUIJob(jobId, request, provider, sourceLang);
      }
      await prisma.translationJob.update({ where: { id: jobId }, data: { status: 'completed' } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await prisma.translationJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message.slice(0, 500) },
      });
    }
  }

  private static async processContentJob(
    jobId: string,
    request: AutoTranslateRequest,
    provider: TranslationProvider,
    sourceLang: string
  ): Promise<void> {
    let cursor: string | undefined;
    let doneKeys = 0;

    while (true) {
      const where: Record<string, unknown> = { entityType: request.entityType, locale: sourceLang };
      if (request.entityIds?.length) where.entityId = { in: request.entityIds };

      const sourceRows = await prisma.contentTranslation.findMany({
        take: 100,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: where as any,
        orderBy: { id: 'asc' as const },
      });

      if (sourceRows.length === 0) break;
      cursor = sourceRows[sourceRows.length - 1].id;

      // Filter out already translated (unless overwrite)
      let toTranslate = sourceRows;
      if (!request.overwrite) {
        const existingKeys = new Set<string>();
        const existing = await prisma.contentTranslation.findMany({
          where: {
            entityType: request.entityType!,
            locale: request.targetLocale,
            entityId: { in: sourceRows.map((r) => r.entityId) },
            field: { in: sourceRows.map((r) => r.field) },
          },
          select: { entityId: true, field: true },
        });
        for (const e of existing) existingKeys.add(`${e.entityId}:${e.field}`);
        toTranslate = sourceRows.filter((r) => !existingKeys.has(`${r.entityId}:${r.field}`));
      }

      // Translate in sub-batches
      for (let i = 0; i < toTranslate.length; i += TRANSLATE_BATCH_SIZE) {
        const batch = toTranslate.slice(i, i + TRANSLATE_BATCH_SIZE);
        const translated = await provider.translateBatch(
          batch.map((r) => r.value),
          sourceLang,
          request.targetLocale
        );

        for (let j = 0; j < batch.length; j++) {
          await ContentTranslationService.setTranslation({
            entityType: request.entityType!,
            entityId: batch[j].entityId,
            locale: request.targetLocale,
            field: batch[j].field,
            value: translated[j],
            sourceDigest: ContentTranslationService.computeDigest(batch[j].value),
          });
        }

        doneKeys += batch.length;
        await prisma.translationJob.update({ where: { id: jobId }, data: { doneKeys } });
      }

      // Count skipped toward progress
      doneKeys += sourceRows.length - toTranslate.length;
      await prisma.translationJob.update({ where: { id: jobId }, data: { doneKeys } });
    }
  }

  private static async processUIJob(
    jobId: string,
    request: AutoTranslateRequest,
    provider: TranslationProvider,
    sourceLang: string
  ): Promise<void> {
    let cursor: string | undefined;
    let doneKeys = 0;

    while (true) {
      const where: Record<string, unknown> = { locale: sourceLang };
      if (request.namespace) where.namespace = request.namespace;

      const sourceRows = await prisma.uITranslation.findMany({
        take: 100,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: where as any,
        orderBy: { id: 'asc' as const },
      });

      if (sourceRows.length === 0) break;
      cursor = sourceRows[sourceRows.length - 1].id;

      let toTranslate = sourceRows;
      if (!request.overwrite) {
        const existingKeys = new Set<string>();
        const existing = await prisma.uITranslation.findMany({
          where: {
            locale: request.targetLocale,
            namespace: { in: sourceRows.map((r) => r.namespace) },
            key: { in: sourceRows.map((r) => r.key) },
          },
          select: { namespace: true, key: true },
        });
        for (const e of existing) existingKeys.add(`${e.namespace}:${e.key}`);
        toTranslate = sourceRows.filter((r) => !existingKeys.has(`${r.namespace}:${r.key}`));
      }

      for (let i = 0; i < toTranslate.length; i += TRANSLATE_BATCH_SIZE) {
        const batch = toTranslate.slice(i, i + TRANSLATE_BATCH_SIZE);
        const translated = await provider.translateBatch(
          batch.map((r) => r.value),
          sourceLang,
          request.targetLocale
        );

        for (let j = 0; j < batch.length; j++) {
          await UITranslationService.setTranslation(request.targetLocale, batch[j].namespace, batch[j].key, translated[j]);
        }

        doneKeys += batch.length;
        await prisma.translationJob.update({ where: { id: jobId }, data: { doneKeys } });
      }

      doneKeys += sourceRows.length - toTranslate.length;
      await prisma.translationJob.update({ where: { id: jobId }, data: { doneKeys } });
    }
  }
}
