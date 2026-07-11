/**
 * Import/Export Service
 *
 * Handles CSV and JSON import/export for content and UI translations.
 * No external dependencies -- uses simple built-in CSV parsing.
 */

import { prisma } from '../lib/prisma';
import { ContentTranslationService } from './content-translation.service';
import { UITranslationService } from './ui-translation.service';

type ImportResult = { imported: number; skipped: number; errors: string[] };

// ============================================================================
// CSV Helpers
// ============================================================================

function escapeCSV(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function csvRow(fields: string[]): string {
  return fields.map(escapeCSV).join(',');
}

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  const chars = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < chars.length && chars[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        if (current.length > 1 || current[0] !== '') rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  current.push(field);
  if (current.length > 1 || current[0] !== '') rows.push(current);

  return rows;
}

// ============================================================================
// Content Translation Export/Import
// ============================================================================

export class ImportExportService {
  /**
   * Export content translations as CSV.
   * BOM prefix for Excel compatibility with CJK characters.
   */
  static async exportContentCSV(entityType?: string, locale?: string): Promise<string> {
    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (locale) where.locale = locale;

    let cursor: string | undefined;
    const lines: string[] = ['\uFEFF' + csvRow(['entityType', 'entityId', 'locale', 'field', 'value', 'sourceDigest'])];

    while (true) {
      const rows = await prisma.contentTranslation.findMany({
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: where as any,
        orderBy: { id: 'asc' },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const r of rows) {
        lines.push(csvRow([r.entityType, r.entityId, r.locale, r.field, r.value, r.sourceDigest || '']));
      }
    }

    return lines.join('\n');
  }

  /**
   * Import content translations from CSV.
   * Expected columns: entityType, entityId, locale, field, value [, sourceDigest]
   */
  static async importContentCSV(csv: string, options?: { overwrite?: boolean }): Promise<ImportResult> {
    const rows = parseCSV(csv);
    if (rows.length < 2) return { imported: 0, skipped: 0, errors: ['CSV has no data rows'] };

    // Skip BOM if present
    const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
    const colIdx = {
      entityType: header.indexOf('entitytype'),
      entityId: header.indexOf('entityid'),
      locale: header.indexOf('locale'),
      field: header.indexOf('field'),
      value: header.indexOf('value'),
      sourceDigest: header.indexOf('sourcedigest'),
    };

    if (colIdx.entityType < 0 || colIdx.entityId < 0 || colIdx.locale < 0 || colIdx.field < 0 || colIdx.value < 0) {
      return { imported: 0, skipped: 0, errors: ['Missing required columns: entityType, entityId, locale, field, value'] };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      try {
        const entityType = row[colIdx.entityType]?.trim();
        const entityId = row[colIdx.entityId]?.trim();
        const locale = row[colIdx.locale]?.trim();
        const field = row[colIdx.field]?.trim();
        const value = row[colIdx.value]?.trim();

        if (!entityType || !entityId || !locale || !field || !value) {
          errors.push(`Row ${i + 1}: missing required field`);
          continue;
        }

        if (!options?.overwrite) {
          const existing = await prisma.contentTranslation.findUnique({
            where: { entityType_entityId_locale_field: { entityType, entityId, locale, field } },
          });
          if (existing) { skipped++; continue; }
        }

        const digest = colIdx.sourceDigest >= 0 ? row[colIdx.sourceDigest]?.trim() : undefined;
        await ContentTranslationService.setTranslation({ entityType, entityId, locale, field, value, sourceDigest: digest });
        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${msg}`);
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Export content translations as JSON.
   */
  static async exportContentJSON(entityType?: string, locale?: string): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (locale) where.locale = locale;

    let cursor: string | undefined;
    const result: Record<string, Record<string, Record<string, string>>> = {};

    while (true) {
      const rows = await prisma.contentTranslation.findMany({
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: where as any,
        orderBy: { id: 'asc' },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const r of rows) {
        const typeKey = `${r.entityType}:${r.entityId}`;
        if (!result[typeKey]) result[typeKey] = {};
        if (!result[typeKey][r.locale]) result[typeKey][r.locale] = {};
        result[typeKey][r.locale][r.field] = r.value;
      }
    }

    return result;
  }

  /**
   * Import content translations from JSON.
   * Format: { "product:prod-001": { "zh-Hant": { "name": "...", "description": "..." } } }
   */
  static async importContentJSON(
    data: Record<string, Record<string, Record<string, string>>>,
    options?: { overwrite?: boolean }
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [compositeKey, locales] of Object.entries(data)) {
      const colonIdx = compositeKey.indexOf(':');
      if (colonIdx < 0) { errors.push(`Invalid key "${compositeKey}", expected "entityType:entityId"`); continue; }
      const entityType = compositeKey.slice(0, colonIdx);
      const entityId = compositeKey.slice(colonIdx + 1);

      for (const [locale, fields] of Object.entries(locales)) {
        if (typeof fields !== 'object') continue;
        try {
          if (!options?.overwrite) {
            const existing = await ContentTranslationService.getTranslations(entityType, entityId, locale);
            const newFields: Record<string, string> = {};
            for (const [f, v] of Object.entries(fields)) {
              if (existing[f]) { skipped++; } else { newFields[f] = v; }
            }
            if (Object.keys(newFields).length > 0) {
              await ContentTranslationService.setTranslations({ entityType, entityId, locale, fields: newFields });
              imported += Object.keys(newFields).length;
            }
          } else {
            await ContentTranslationService.setTranslations({ entityType, entityId, locale, fields });
            imported += Object.keys(fields).length;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${compositeKey}/${locale}: ${msg}`);
        }
      }
    }

    return { imported, skipped, errors };
  }

  // ============================================================================
  // UI Translation Export/Import
  // ============================================================================

  static async exportUICSV(locale?: string, namespace?: string): Promise<string> {
    const where: Record<string, unknown> = {};
    if (locale) where.locale = locale;
    if (namespace) where.namespace = namespace;

    let cursor: string | undefined;
    const lines: string[] = ['\uFEFF' + csvRow(['locale', 'namespace', 'key', 'value'])];

    while (true) {
      const rows = await prisma.uITranslation.findMany({
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: where as any,
        orderBy: { id: 'asc' },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const r of rows) {
        lines.push(csvRow([r.locale, r.namespace, r.key, r.value]));
      }
    }

    return lines.join('\n');
  }

  static async importUICSV(csv: string, options?: { overwrite?: boolean }): Promise<ImportResult> {
    const rows = parseCSV(csv);
    if (rows.length < 2) return { imported: 0, skipped: 0, errors: ['CSV has no data rows'] };

    const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
    const colIdx = {
      locale: header.indexOf('locale'),
      namespace: header.indexOf('namespace'),
      key: header.indexOf('key'),
      value: header.indexOf('value'),
    };

    if (colIdx.locale < 0 || colIdx.namespace < 0 || colIdx.key < 0 || colIdx.value < 0) {
      return { imported: 0, skipped: 0, errors: ['Missing required columns: locale, namespace, key, value'] };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      try {
        const locale = row[colIdx.locale]?.trim();
        const namespace = row[colIdx.namespace]?.trim();
        const key = row[colIdx.key]?.trim();
        const value = row[colIdx.value]?.trim();

        if (!locale || !namespace || !key || !value) { errors.push(`Row ${i + 1}: missing field`); continue; }

        if (!options?.overwrite) {
          const existing = await prisma.uITranslation.findUnique({
            where: { locale_namespace_key: { locale, namespace, key } },
          });
          if (existing) { skipped++; continue; }
        }

        await UITranslationService.setTranslation(locale, namespace, key, value);
        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${msg}`);
      }
    }

    return { imported, skipped, errors };
  }

  static async exportUIJSON(locale?: string, namespace?: string): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = {};
    if (locale) where.locale = locale;
    if (namespace) where.namespace = namespace;

    let cursor: string | undefined;
    const result: Record<string, Record<string, string>> = {};

    while (true) {
      const rows = await prisma.uITranslation.findMany({
        take: 500,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        where: where as any,
        orderBy: { id: 'asc' },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const r of rows) {
        const nsKey = `${r.locale}:${r.namespace}`;
        if (!result[nsKey]) result[nsKey] = {};
        result[nsKey][r.key] = r.value;
      }
    }

    return result;
  }

  static async importUIJSON(
    data: Record<string, Record<string, string>>,
    options?: { overwrite?: boolean }
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [compositeKey, entries] of Object.entries(data)) {
      const colonIdx = compositeKey.indexOf(':');
      if (colonIdx < 0) { errors.push(`Invalid key "${compositeKey}", expected "locale:namespace"`); continue; }
      const locale = compositeKey.slice(0, colonIdx);
      const namespace = compositeKey.slice(colonIdx + 1);

      if (typeof entries !== 'object') continue;

      try {
        if (!options?.overwrite) {
          const existing = await UITranslationService.getTranslations(locale, namespace);
          const newEntries: Record<string, string> = {};
          for (const [k, v] of Object.entries(entries)) {
            if (existing[k]) { skipped++; } else { newEntries[k] = v; }
          }
          if (Object.keys(newEntries).length > 0) {
            await UITranslationService.setTranslations(locale, namespace, newEntries);
            imported += Object.keys(newEntries).length;
          }
        } else {
          await UITranslationService.setTranslations(locale, namespace, entries);
          imported += Object.keys(entries).length;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${compositeKey}: ${msg}`);
      }
    }

    return { imported, skipped, errors };
  }
}
