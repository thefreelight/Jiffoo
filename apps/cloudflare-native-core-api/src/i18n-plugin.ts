import type { NativeAuthEnv } from './auth';
import { requireAdminPermission } from './admin-access';
import { ADMIN_PERMISSIONS } from './native-rbac';

/**
 * Store Localization (i18n) plugin on the Cloudflare-native stack.
 *
 * The plugin owns two things: which locales the store serves, and UI text
 * translations — `{ locale, namespace, key } -> value` rows in
 * `i18n_translations` that override a theme's built-in copy. Theme built-ins
 * stay the defaults; rows here win.
 *
 * Paths follow the plugin gateway contract so the admin workspace and the
 * storefront read the same routes the legacy plugin exposed:
 *   GET/PUT /api/v1/extensions/plugin/i18n/api/localization   (admin workspace)
 *   GET     /api/v1/plugins/i18n/ui                            (namespaces, admin)
 *   GET/PUT /api/v1/plugins/i18n/ui/:locale/:namespace         (read public / write admin)
 *   GET     /api/v1/plugins/i18n/messages/:locale              (all namespaces merged, public)
 *   GET     /api/v1/plugins/i18n/export/ui/json                (admin)
 *   POST    /api/v1/plugins/i18n/import/ui/json                (admin)
 */

type I18nPluginEnv = NativeAuthEnv & { DB: D1Database };

type TranslationEntries = Record<string, string>;

const STORE_CONTEXT_KEY = 'core:snapshot:/api/v1/store/context';
const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const MAX_ENTRIES_PER_REQUEST = 2000;
const MAX_KEY_LENGTH = 500;
const MAX_VALUE_LENGTH = 5000;
// D1 batches are chunked to stay under the per-call limit.
const BATCH_SIZE = 50;

const NO_STORE = { 'cache-control': 'no-store' };
const PUBLIC_READ = { 'cache-control': 'public, max-age=30, stale-while-revalidate=120' };

function fail(code: string, message: string, status: number): Response {
  return Response.json({ success: false, error: { code, message } }, { status, headers: NO_STORE });
}

function ok(data: unknown, headers: Record<string, string> = NO_STORE): Response {
  return Response.json({ success: true, data }, { headers });
}

async function pluginEnabled(env: I18nPluginEnv): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT enabled FROM native_plugin_instances WHERE plugin_slug = 'i18n' AND instance_key = 'default'",
  ).first<{ enabled: number }>();
  return row?.enabled === 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function localeExists(env: I18nPluginEnv, locale: string): Promise<boolean> {
  if (!LOCALE_PATTERN.test(locale)) return false;
  const row = await env.DB.prepare('SELECT locale FROM i18n_locales WHERE locale = ?1').bind(locale).first<{ locale: string }>();
  return Boolean(row);
}

async function listEntries(env: I18nPluginEnv, locale: string, namespace: string): Promise<TranslationEntries> {
  const result = await env.DB.prepare(
    'SELECT translation_key, value FROM i18n_translations WHERE locale = ?1 AND namespace = ?2 ORDER BY translation_key ASC',
  ).bind(locale, namespace).all<{ translation_key: string; value: string }>();
  const entries: TranslationEntries = {};
  for (const row of result.results ?? []) entries[row.translation_key] = row.value;
  return entries;
}

async function listNamespaces(env: I18nPluginEnv, locale: string): Promise<Record<string, TranslationEntries>> {
  const result = await env.DB.prepare(
    'SELECT namespace, translation_key, value FROM i18n_translations WHERE locale = ?1 ORDER BY namespace ASC, translation_key ASC',
  ).bind(locale).all<{ namespace: string; translation_key: string; value: string }>();
  const namespaced: Record<string, TranslationEntries> = {};
  for (const row of result.results ?? []) {
    (namespaced[row.namespace] ??= {})[row.translation_key] = row.value;
  }
  return namespaced;
}

/** Upsert statements for non-empty values; an empty value removes the override. */
function writeStatements(env: I18nPluginEnv, locale: string, namespace: string, entries: TranslationEntries): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (const [key, value] of Object.entries(entries)) {
    if (value.trim() === '') {
      statements.push(env.DB.prepare(
        'DELETE FROM i18n_translations WHERE locale = ?1 AND namespace = ?2 AND translation_key = ?3',
      ).bind(locale, namespace, key));
      continue;
    }
    statements.push(env.DB.prepare(
      `INSERT INTO i18n_translations (id, locale, namespace, translation_key, value, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
       ON CONFLICT (locale, namespace, translation_key)
       DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    ).bind(crypto.randomUUID(), locale, namespace, key, value));
  }
  return statements;
}

async function runBatch(env: I18nPluginEnv, statements: D1PreparedStatement[]): Promise<void> {
  for (let index = 0; index < statements.length; index += BATCH_SIZE) {
    await env.DB.batch(statements.slice(index, index + BATCH_SIZE));
  }
}

/** Normalizes `{ key: value }` input; returns null with the offending reason when invalid. */
function normalizeEntries(input: unknown): { entries: TranslationEntries } | { error: Response } {
  if (!isRecord(input)) {
    return { error: fail('VALIDATION_ERROR', 'Request body must be a key-value object', 400) };
  }
  const keys = Object.keys(input);
  if (keys.length > MAX_ENTRIES_PER_REQUEST) {
    return { error: fail('VALIDATION_ERROR', `At most ${MAX_ENTRIES_PER_REQUEST} entries per request`, 400) };
  }
  const entries: TranslationEntries = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key.trim() || key.length > MAX_KEY_LENGTH) {
      return { error: fail('VALIDATION_ERROR', `Translation keys must be 1-${MAX_KEY_LENGTH} characters`, 400) };
    }
    if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) {
      return { error: fail('VALIDATION_ERROR', `Value for "${key.slice(0, 40)}" must be a string of at most ${MAX_VALUE_LENGTH} characters`, 400) };
    }
    entries[key] = value;
  }
  return { entries };
}

// ── store locales (admin workspace) ───────────────────────────────────────────

interface LocaleRow {
  locale: string;
  name: string;
  native_name: string;
  is_default: number;
  is_enabled: number;
}

/** Locales in the plugin's own order (sort_order), so every reader lists them the same way. */
async function localizationState(env: I18nPluginEnv) {
  const result = await env.DB.prepare(
    'SELECT locale, name, native_name, is_default, is_enabled FROM i18n_locales ORDER BY sort_order ASC, locale ASC',
  ).all<LocaleRow>();
  const rows = result.results ?? [];
  return {
    availableLocales: rows.map((row) => ({
      code: row.locale,
      name: row.name,
      nativeName: row.native_name,
      enabled: row.is_enabled === 1,
    })),
    store: {
      defaultLocale: rows.find((row) => row.is_default === 1)?.locale ?? rows[0]?.locale ?? 'en',
      supportedLocales: rows.filter((row) => row.is_enabled === 1).map((row) => row.locale),
    },
  };
}

async function writeLocalization(env: I18nPluginEnv, body: unknown): Promise<Response> {
  const input = isRecord(body) ? body : {};
  const defaultLocale = typeof input.defaultLocale === 'string' ? input.defaultLocale.trim() : '';
  const supportedLocales = Array.isArray(input.supportedLocales)
    ? [...new Set(input.supportedLocales.filter((code): code is string => typeof code === 'string' && Boolean(code.trim())).map((code) => code.trim()))]
    : [];
  if (!LOCALE_PATTERN.test(defaultLocale)) {
    return fail('VALIDATION_ERROR', 'defaultLocale is required', 400);
  }
  if (!supportedLocales.includes(defaultLocale)) supportedLocales.unshift(defaultLocale);

  const known = new Set(((await env.DB.prepare('SELECT locale FROM i18n_locales').all<{ locale: string }>()).results ?? []).map((row) => row.locale));
  const unknown = supportedLocales.filter((code) => !known.has(code));
  if (unknown.length) {
    return fail('VALIDATION_ERROR', `Unknown locales: ${unknown.join(', ')}`, 400);
  }

  const statements: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE i18n_locales SET is_default = CASE WHEN locale = ?1 THEN 1 ELSE 0 END, updated_at = CURRENT_TIMESTAMP').bind(defaultLocale),
  ];
  for (const code of known) {
    statements.push(env.DB.prepare(
      'UPDATE i18n_locales SET is_enabled = ?2, updated_at = CURRENT_TIMESTAMP WHERE locale = ?1',
    ).bind(code, supportedLocales.includes(code) ? 1 : 0));
  }
  await runBatch(env, statements);
  // The storefront reads its locale list from the store context snapshot;
  // keep it in step with the plugin's own table (same order, same members).
  const state = await localizationState(env);
  await env.DB.batch([env.DB.prepare(
    "UPDATE core_api_snapshots SET payload = json_set(payload, '$.defaultLocale', ?1, '$.supportedLocales', json(?2)) WHERE cache_key = ?3",
  ).bind(state.store.defaultLocale, JSON.stringify(state.store.supportedLocales), STORE_CONTEXT_KEY)]);
  return ok(state);
}

// ── UI translations ───────────────────────────────────────────────────────────

async function namespaceSummary(env: I18nPluginEnv): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT namespace, locale, COUNT(*) AS count FROM i18n_translations GROUP BY namespace, locale ORDER BY namespace ASC, locale ASC',
  ).all<{ namespace: string; locale: string; count: number }>();
  const byNamespace = new Map<string, { namespace: string; total: number; locales: Record<string, number> }>();
  for (const row of result.results ?? []) {
    const entry = byNamespace.get(row.namespace) ?? { namespace: row.namespace, total: 0, locales: {} };
    entry.locales[row.locale] = row.count;
    entry.total += row.count;
    byNamespace.set(row.namespace, entry);
  }
  const items = [...byNamespace.values()];
  return ok({ items, total: items.length });
}

async function exportTranslations(env: I18nPluginEnv, url: URL): Promise<Response> {
  const locale = url.searchParams.get('locale') || '';
  const namespace = url.searchParams.get('namespace') || '';
  if (locale && !(await localeExists(env, locale))) return fail('LOCALE_NOT_FOUND', `Unknown locale: ${locale}`, 404);
  const locales = locale ? [locale] : ((await env.DB.prepare('SELECT locale FROM i18n_locales ORDER BY sort_order ASC').all<{ locale: string }>()).results ?? []).map((row) => row.locale);
  const translations: Record<string, Record<string, TranslationEntries>> = {};
  for (const code of locales) {
    const namespaced = await listNamespaces(env, code);
    translations[code] = namespace ? (namespaced[namespace] ? { [namespace]: namespaced[namespace] } : {}) : namespaced;
  }
  return ok({ translations });
}

async function importTranslations(env: I18nPluginEnv, body: unknown): Promise<Response> {
  // Two shapes: one { locale, namespace, entries } object, or the export's
  // { translations: { [locale]: { [namespace]: { key: value } } } }.
  const targets: Array<{ locale: string; namespace: string; entries: TranslationEntries; replace: boolean }> = [];
  if (isRecord(body) && isRecord(body.translations)) {
    for (const [locale, namespaced] of Object.entries(body.translations)) {
      if (!isRecord(namespaced)) return fail('VALIDATION_ERROR', `translations.${locale} must be an object`, 400);
      for (const [namespace, raw] of Object.entries(namespaced)) {
        const normalized = normalizeEntries(raw);
        if ('error' in normalized) return normalized.error;
        targets.push({ locale, namespace, entries: normalized.entries, replace: false });
      }
    }
  } else {
    if (!isRecord(body)) return fail('VALIDATION_ERROR', 'Request body must be an object', 400);
    const normalized = normalizeEntries(body.entries);
    if ('error' in normalized) return normalized.error;
    targets.push({
      locale: String(body.locale ?? ''),
      namespace: String(body.namespace ?? ''),
      entries: normalized.entries,
      // "replace" drops every other key of that locale + namespace first.
      replace: body.mode === 'replace',
    });
  }
  if (targets.every((target) => Object.values(target.entries).every((value) => value.trim() === ''))) {
    return fail('VALIDATION_ERROR', 'Nothing to import', 400);
  }

  const statements: D1PreparedStatement[] = [];
  let imported = 0;
  for (const target of targets) {
    if (!(await localeExists(env, target.locale))) return fail('LOCALE_NOT_FOUND', `Unknown locale: ${target.locale}`, 404);
    if (!NAMESPACE_PATTERN.test(target.namespace)) return fail('VALIDATION_ERROR', `Invalid namespace: ${target.namespace}`, 400);
    if (target.replace) {
      statements.push(env.DB.prepare('DELETE FROM i18n_translations WHERE locale = ?1 AND namespace = ?2').bind(target.locale, target.namespace));
    }
    statements.push(...writeStatements(env, target.locale, target.namespace, target.entries));
    imported += Object.values(target.entries).filter((value) => value.trim() !== '').length;
  }
  await runBatch(env, statements);
  return ok({ imported, targets: targets.length });
}

export async function tryNativeI18nPlugin(request: Request, env: I18nPluginEnv): Promise<Response | null> {
  // The admin gateway prefixes plugin API routes; normalize to the bare namespace.
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1\/extensions\/plugin\/i18n\/api\//, '/api/v1/plugins/i18n/');
  const method = request.method;
  if (!path.startsWith('/api/v1/plugins/i18n/')) return null;

  try {
    if (path === '/api/v1/plugins/i18n/localization') {
      if (method !== 'GET' && method !== 'PUT') return fail('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
      const gate = await requireAdminPermission(request, env, method === 'GET' ? ADMIN_PERMISSIONS.PLUGINS_READ : ADMIN_PERMISSIONS.PLUGINS_WRITE);
      if (!gate.ok) return gate.response;
      return method === 'GET' ? ok(await localizationState(env)) : writeLocalization(env, await readJsonBody(request));
    }

    if (path === '/api/v1/plugins/i18n/ui' && method === 'GET') {
      const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.PLUGINS_READ);
      if (!gate.ok) return gate.response;
      return namespaceSummary(env);
    }

    if (path === '/api/v1/plugins/i18n/export/ui/json' && method === 'GET') {
      const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.PLUGINS_READ);
      if (!gate.ok) return gate.response;
      return exportTranslations(env, url);
    }

    if (path === '/api/v1/plugins/i18n/import/ui/json' && method === 'POST') {
      const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.PLUGINS_WRITE);
      if (!gate.ok) return gate.response;
      return importTranslations(env, await readJsonBody(request));
    }

    // Storefront reads below are public but only exist while the plugin is enabled.
    if (!(await pluginEnabled(env))) {
      return fail('PLUGIN_DISABLED', 'i18n plugin is not enabled', 404);
    }

    const messages = path.match(/^\/api\/v1\/plugins\/i18n\/messages\/([^/]+)$/);
    if (messages && method === 'GET') {
      const locale = decodeURIComponent(messages[1]);
      if (!(await localeExists(env, locale))) return fail('LOCALE_NOT_FOUND', `Unknown locale: ${locale}`, 404);
      const namespaced = await listNamespaces(env, locale);
      const namespace = url.searchParams.get('namespace');
      const data = namespace ? (namespaced[namespace] ? { [namespace]: namespaced[namespace] } : {}) : namespaced;
      return ok(data, PUBLIC_READ);
    }

    const ui = path.match(/^\/api\/v1\/plugins\/i18n\/ui\/([^/]+)\/([^/]+)$/);
    if (ui && (method === 'GET' || method === 'PUT')) {
      const locale = decodeURIComponent(ui[1]);
      const namespace = decodeURIComponent(ui[2]);
      if (!NAMESPACE_PATTERN.test(namespace)) return fail('VALIDATION_ERROR', `Invalid namespace: ${namespace}`, 400);
      if (!(await localeExists(env, locale))) return fail('LOCALE_NOT_FOUND', `Unknown locale: ${locale}`, 404);
      if (method === 'GET') return ok(await listEntries(env, locale, namespace), PUBLIC_READ);
      // Writes are admin-only and answer before anything is stored.
      const gate = await requireAdminPermission(request, env, ADMIN_PERMISSIONS.PLUGINS_WRITE);
      if (!gate.ok) return gate.response;
      const normalized = normalizeEntries(await readJsonBody(request));
      if ('error' in normalized) return normalized.error;
      const statements = writeStatements(env, locale, namespace, normalized.entries);
      if (statements.length > 0) await runBatch(env, statements);
      const saved = Object.values(normalized.entries).filter((value) => value.trim() !== '').length;
      return ok({ saved, removed: statements.length - saved });
    }

    return null;
  } catch (error) {
    return fail('I18N_OPERATION_FAILED', error instanceof Error ? error.message : 'Localization operation failed', 500);
  }
}
