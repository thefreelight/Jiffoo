/**
 * i18n Plugin API Routes
 *
 * These endpoints are accessible via the plugin gateway:
 *   /api/extensions/plugin/i18n/api/...
 */

import { Router } from 'express';
import { ContentTranslationService } from '../services/content-translation.service';
import { UITranslationService } from '../services/ui-translation.service';
import { LanguageService } from '../services/language.service';
import { AutoTranslateService } from '../services/auto-translate.service';
import { getAvailableProviders } from '../services/translation-provider';
import { ImportExportService } from '../services/import-export.service';

export const apiRoutes = Router();

// ============================================================================
// Languages
// ============================================================================

apiRoutes.get('/languages', async (_req, res) => {
  try {
    const languages = await LanguageService.listLanguages();
    res.json({ success: true, data: languages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'LANGUAGE_LIST_FAILED', message: err.message } });
  }
});

apiRoutes.post('/languages', async (req, res) => {
  try {
    const { locale, name, nativeName, isDefault, isEnabled, fallbackTo, direction, sortOrder } = req.body || {};
    if (!locale || !name || !nativeName) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'locale, name, and nativeName are required' } });
      return;
    }
    await LanguageService.upsertLanguage({ locale, name, nativeName, isDefault, isEnabled, fallbackTo, direction, sortOrder });
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'LANGUAGE_UPSERT_FAILED', message: err.message } });
  }
});

apiRoutes.delete('/languages/:locale', async (req, res) => {
  try {
    const ok = await LanguageService.deleteLanguage(req.params.locale);
    if (!ok) {
      res.status(400).json({ success: false, error: { code: 'DELETE_FAILED', message: 'Cannot delete default or non-existent language' } });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'LANGUAGE_DELETE_FAILED', message: err.message } });
  }
});

// ============================================================================
// Content Translations
// ============================================================================

// IMPORTANT: /list/ route MUST be registered before /:entityId/ to avoid Express
// treating "list" as an entityId parameter.
apiRoutes.get('/content/:entityType/list/:locale', async (req, res) => {
  try {
    const { entityType, locale } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const result = await ContentTranslationService.listTranslatedEntities(entityType, locale, page, limit);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONTENT_LIST_FAILED', message: err.message } });
  }
});

apiRoutes.get('/content/:entityType/:entityId/:locale', async (req, res) => {
  try {
    const { entityType, entityId, locale } = req.params;
    const translations = await ContentTranslationService.getTranslations(entityType, entityId, locale);
    res.json({ success: true, data: translations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONTENT_FETCH_FAILED', message: err.message } });
  }
});

apiRoutes.put('/content/:entityType/:entityId/:locale', async (req, res) => {
  try {
    const { entityType, entityId, locale } = req.params;
    const { fields, sourceDigests } = req.body || {};
    if (!fields || typeof fields !== 'object') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'fields object is required' } });
      return;
    }
    await ContentTranslationService.setTranslations({ entityType, entityId, locale, fields, sourceDigests });
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONTENT_UPDATE_FAILED', message: err.message } });
  }
});

apiRoutes.delete('/content/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const locale = req.query.locale as string | undefined;
    const count = await ContentTranslationService.deleteTranslations(entityType, entityId, locale);
    res.json({ success: true, data: { deleted: count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONTENT_DELETE_FAILED', message: err.message } });
  }
});

// ============================================================================
// UI Translations
// ============================================================================

/**
 * GET /messages/:locale
 * Frontend calls this to load UI translations for a locale.
 * Returns all namespaces merged.
 */
apiRoutes.get('/messages/:locale', async (req, res) => {
  try {
    const { locale } = req.params;
    const translations = await UITranslationService.getAllTranslations(locale);
    res.json({ success: true, data: translations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UI_FETCH_FAILED', message: err.message } });
  }
});

apiRoutes.get('/ui/:locale/:namespace', async (req, res) => {
  try {
    const { locale, namespace } = req.params;
    const translations = await UITranslationService.getCachedTranslations(locale, namespace);
    res.json({ success: true, data: translations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UI_FETCH_FAILED', message: err.message } });
  }
});

apiRoutes.put('/ui/:locale/:namespace', async (req, res) => {
  try {
    const { locale, namespace } = req.params;
    const entries = req.body || {};
    if (typeof entries !== 'object') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Request body must be a key-value object' } });
      return;
    }
    await UITranslationService.setTranslations(locale, namespace, entries);
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UI_UPDATE_FAILED', message: err.message } });
  }
});

// ============================================================================
// Stats / Completeness
// ============================================================================

apiRoutes.get('/stats/:entityType/:locale', async (req, res) => {
  try {
    const { entityType, locale } = req.params;
    const stats = await ContentTranslationService.getCompleteness(entityType, locale);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'STATS_FAILED', message: err.message } });
  }
});

// ============================================================================
// Auto-Translate
// ============================================================================

apiRoutes.get('/auto-translate/providers', async (_req, res) => {
  res.json({ success: true, data: getAvailableProviders() });
});

apiRoutes.post('/auto-translate', async (req, res) => {
  try {
    const { targetLocale, provider, scope, entityType, namespace, entityIds, overwrite } = req.body || {};
    if (!targetLocale || !provider || !scope) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'targetLocale, provider, and scope are required' } });
      return;
    }
    const jobId = await AutoTranslateService.startJob({ targetLocale, provider, scope, entityType, namespace, entityIds, overwrite });
    res.json({ success: true, data: { jobId } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'AUTO_TRANSLATE_FAILED', message: err.message } });
  }
});

apiRoutes.get('/auto-translate/jobs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await AutoTranslateService.listJobs(page, limit);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'JOB_LIST_FAILED', message: err.message } });
  }
});

apiRoutes.get('/auto-translate/jobs/:jobId', async (req, res) => {
  try {
    const job = await AutoTranslateService.getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'JOB_FETCH_FAILED', message: err.message } });
  }
});

// ============================================================================
// Import / Export
// ============================================================================

apiRoutes.get('/export/content/csv', async (req, res) => {
  try {
    const csv = await ImportExportService.exportContentCSV(req.query.entityType as string, req.query.locale as string);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="content-translations.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});

apiRoutes.get('/export/content/json', async (req, res) => {
  try {
    const data = await ImportExportService.exportContentJSON(req.query.entityType as string, req.query.locale as string);
    res.header('Content-Disposition', 'attachment; filename="content-translations.json"');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});

apiRoutes.get('/export/ui/csv', async (req, res) => {
  try {
    const csv = await ImportExportService.exportUICSV(req.query.locale as string, req.query.namespace as string);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="ui-translations.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});

apiRoutes.get('/export/ui/json', async (req, res) => {
  try {
    const data = await ImportExportService.exportUIJSON(req.query.locale as string, req.query.namespace as string);
    res.header('Content-Disposition', 'attachment; filename="ui-translations.json"');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});

apiRoutes.post('/import/content/csv', async (req, res) => {
  try {
    const { csv, overwrite } = req.body || {};
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'csv string is required in request body' } });
      return;
    }
    const result = await ImportExportService.importContentCSV(csv, { overwrite });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IMPORT_FAILED', message: err.message } });
  }
});

apiRoutes.post('/import/content/json', async (req, res) => {
  try {
    const { data, overwrite } = req.body || {};
    if (!data || typeof data !== 'object') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'data object is required in request body' } });
      return;
    }
    const result = await ImportExportService.importContentJSON(data, { overwrite });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IMPORT_FAILED', message: err.message } });
  }
});

apiRoutes.post('/import/ui/csv', async (req, res) => {
  try {
    const { csv, overwrite } = req.body || {};
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'csv string is required in request body' } });
      return;
    }
    const result = await ImportExportService.importUICSV(csv, { overwrite });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IMPORT_FAILED', message: err.message } });
  }
});

apiRoutes.post('/import/ui/json', async (req, res) => {
  try {
    const { data, overwrite } = req.body || {};
    if (!data || typeof data !== 'object') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'data object is required in request body' } });
      return;
    }
    const result = await ImportExportService.importUIJSON(data, { overwrite });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'IMPORT_FAILED', message: err.message } });
  }
});
