import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateNativeAdmin = vi.fn();

vi.mock('./auth', () => ({
  authenticateNativeAdmin,
}));

const { tryNativeI18nPlugin } = await import('./i18n-plugin');

type LocaleRow = { locale: string; name: string; native_name: string; is_default: number; is_enabled: number; sort_order: number };

/** In-memory stand-in for the two i18n tables + the store context snapshot. */
function makeEnv(options: { pluginEnabled?: boolean } = {}) {
  const locales: LocaleRow[] = [
    { locale: 'en', name: 'English', native_name: 'English', is_default: 1, is_enabled: 1, sort_order: 0 },
    { locale: 'zh-Hans', name: 'Simplified Chinese', native_name: '简体中文', is_default: 0, is_enabled: 1, sort_order: 1 },
    { locale: 'ja', name: 'Japanese', native_name: '日本語', is_default: 0, is_enabled: 1, sort_order: 2 },
  ];
  const translations = new Map<string, string>();
  let snapshot = JSON.stringify({ storeId: 'store-1', defaultLocale: 'en', supportedLocales: ['en', 'zh-Hans', 'ja'] });
  const state = { pluginEnabled: options.pluginEnabled ?? true };
  const batches: Array<Array<{ sql: string; args: unknown[] }>> = [];
  const entryKey = (locale: string, namespace: string, key: string) => `${locale}|${namespace}|${key}`;

  const execute = (sql: string, args: unknown[]) => {
    if (sql.includes('INSERT INTO i18n_translations')) {
      const [, locale, namespace, key, value] = args as string[];
      translations.set(entryKey(locale, namespace, key), value);
      return;
    }
    if (sql.includes('DELETE FROM i18n_translations') && sql.includes('translation_key = ?3')) {
      translations.delete(entryKey(String(args[0]), String(args[1]), String(args[2])));
      return;
    }
    if (sql.includes('DELETE FROM i18n_translations')) {
      for (const key of [...translations.keys()]) {
        if (key.startsWith(`${args[0]}|${args[1]}|`)) translations.delete(key);
      }
      return;
    }
    if (sql.includes('UPDATE i18n_locales SET is_default')) {
      for (const row of locales) row.is_default = row.locale === args[0] ? 1 : 0;
      return;
    }
    if (sql.includes('UPDATE i18n_locales SET is_enabled')) {
      const row = locales.find((candidate) => candidate.locale === args[0]);
      if (row) row.is_enabled = Number(args[1]);
      return;
    }
    if (sql.includes('UPDATE core_api_snapshots')) {
      const payload = JSON.parse(snapshot) as Record<string, unknown>;
      payload.defaultLocale = args[0];
      payload.supportedLocales = JSON.parse(String(args[1]));
      snapshot = JSON.stringify(payload);
      return;
    }
    throw new Error(`fake DB does not implement: ${sql.slice(0, 60)}`);
  };

  const query = (sql: string, args: unknown[]) => {
    if (sql.includes('native_plugin_instances')) return state.pluginEnabled ? { enabled: 1 } : null;
    if (sql.includes('SELECT locale FROM i18n_locales WHERE locale = ?1')) {
      return locales.find((row) => row.locale === args[0]) ? { locale: args[0] } : null;
    }
    if (sql.includes('SELECT translation_key, value FROM i18n_translations')) {
      const [locale, namespace] = args as string[];
      return (resultsFor(locale, namespace) as unknown);
    }
    if (sql.includes('SELECT namespace, translation_key, value FROM i18n_translations')) {
      const locale = String(args[0]);
      return [...translations.entries()]
        .filter(([key]) => key.startsWith(`${locale}|`))
        .map(([key, value]) => { const [, namespace, translationKey] = key.split('|'); return { namespace, translation_key: translationKey, value }; })
        .sort((a, b) => a.namespace.localeCompare(b.namespace) || a.translation_key.localeCompare(b.translation_key));
    }
    if (sql.includes('COUNT(*)')) {
      const counts = new Map<string, number>();
      for (const key of translations.keys()) {
        const [locale, namespace] = key.split('|');
        const id = `${namespace}|${locale}`;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return [...counts.entries()].map(([id, count]) => { const [namespace, locale] = id.split('|'); return { namespace, locale, count }; });
    }
    if (sql.includes('SELECT locale, name, native_name, is_default, is_enabled FROM i18n_locales')) return locales;
    if (sql.trim() === 'SELECT locale FROM i18n_locales') return locales.map((row) => ({ locale: row.locale }));
    if (sql.includes('SELECT locale FROM i18n_locales ORDER BY sort_order ASC')) return locales.map((row) => ({ locale: row.locale }));
    throw new Error(`fake DB does not implement: ${sql.slice(0, 60)}`);
  };

  const resultsFor = (locale: string, namespace: string) =>
    [...translations.entries()]
      .filter(([key]) => key.startsWith(`${locale}|${namespace}|`))
      .map(([key, value]) => ({ translation_key: key.split('|')[2], value }))
      .sort((a, b) => a.translation_key.localeCompare(b.translation_key));

  const prepare = (sql: string) => {
    const statement = (args: unknown[]) => ({
      sql,
      args,
      first: async () => {
        const rows = query(sql, args);
        return Array.isArray(rows) ? rows[0] ?? null : rows;
      },
      all: async () => ({ results: query(sql, args) as unknown[] }),
    });
    return { ...statement([]), bind: (...args: unknown[]) => statement(args) };
  };
  const batch = async (statements: Array<{ sql: string; args: unknown[] }>) => {
    batches.push(statements.map((statement) => ({ sql: statement.sql, args: statement.args })));
    for (const statement of statements) execute(statement.sql, statement.args);
  };
  const env = { DB: { prepare, batch } } as unknown as Parameters<typeof tryNativeI18nPlugin>[1];
  return { env, locales, translations, batches, snapshot: () => JSON.parse(snapshot) as Record<string, unknown>, state };
}

type Env = ReturnType<typeof makeEnv>['env'];

const request = (path: string, method = 'GET', body?: unknown, admin = true) => new Request(`https://api.bokmoo.test${path}`, {
  method,
  headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(admin ? { authorization: 'Bearer admin-token' } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const call = async (path: string, method = 'GET', body?: unknown, admin = true, env: Env = makeEnv().env) => {
  const response = await tryNativeI18nPlugin(request(path, method, body, admin), env);
  return { status: response?.status ?? 0, body: response ? await response.json() : null };
};

beforeEach(() => {
  authenticateNativeAdmin.mockReset();
  authenticateNativeAdmin.mockImplementation(async (req: Request) => (req.headers.get('authorization') ? { id: 'admin-1', role: 'SUPER_ADMIN' } : null));
});

describe('i18n plugin: store locales (admin workspace)', () => {
  it('serves the localization state the workspace expects', async () => {
    const { status, body } = await call('/api/v1/extensions/plugin/i18n/api/localization');
    expect(status).toBe(200);
    expect(body.data.availableLocales.map((row: { code: string }) => row.code)).toEqual(['en', 'zh-Hans', 'ja']);
    expect(body.data.store).toEqual({ defaultLocale: 'en', supportedLocales: ['en', 'zh-Hans', 'ja'] });
  });

  it('requires an administrator and the plugins permission', async () => {
    expect((await call('/api/v1/extensions/plugin/i18n/api/localization', 'GET', undefined, false)).status).toBe(401);
    expect((await call('/api/v1/extensions/plugin/i18n/api/localization', 'PUT', { defaultLocale: 'ja' }, false)).status).toBe(401);
    expect((await call('/api/v1/extensions/plugin/i18n/api/localization', 'POST')).status).toBe(405);
  });

  it('updates the locale table and the storefront store context together', async () => {
    const { env, snapshot } = makeEnv();
    const { status, body } = await call('/api/v1/extensions/plugin/i18n/api/localization', 'PUT', { defaultLocale: 'ja', supportedLocales: ['ja', 'en'] }, true, env);
    expect(status).toBe(200);
    // Supported locales always follow the plugin's own order, not the request order.
    expect(body.data.store).toEqual({ defaultLocale: 'ja', supportedLocales: ['en', 'ja'] });
    expect(body.data.availableLocales.find((row: { code: string }) => row.code === 'zh-Hans').enabled).toBe(false);
    expect(snapshot().supportedLocales).toEqual(['en', 'ja']);
    expect(snapshot().defaultLocale).toBe('ja');
    // Other fields of the store context survive the json_set.
    expect(snapshot().storeId).toBe('store-1');
  });

  it('always keeps the default locale supported and rejects unknown locales', async () => {
    const { status, body } = await call('/api/v1/extensions/plugin/i18n/api/localization', 'PUT', { defaultLocale: 'zh-Hans', supportedLocales: ['en'] });
    expect(status).toBe(200);
    expect(body.data.store.supportedLocales).toEqual(['en', 'zh-Hans']);
    expect((await call('/api/v1/extensions/plugin/i18n/api/localization', 'PUT', { defaultLocale: 'xx' })).status).toBe(400);
    expect((await call('/api/v1/extensions/plugin/i18n/api/localization', 'PUT', { defaultLocale: 'en', supportedLocales: ['klingon'] })).status).toBe(400);
    expect((await call('/api/v1/extensions/plugin/i18n/api/localization', 'PUT', {})).status).toBe(400);
  });
});

describe('i18n plugin: UI translations', () => {
  it('stores entries for a locale + namespace and removes them on an empty value', async () => {
    const { env, translations } = makeEnv();
    translations.set('ja|theme.esim|Sign in', '旧訳');
    let result = await call('/api/v1/plugins/i18n/ui/ja/theme.esim', 'PUT', { 'Sign in': 'ログイン', 'Log In': '', 'Plans': 'プラン' }, true, env);
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ saved: 2, removed: 1 });
    expect(translations.get('ja|theme.esim|Sign in')).toBe('ログイン');
    expect(translations.has('ja|theme.esim|Log In')).toBe(false);
    expect(translations.get('ja|theme.esim|Plans')).toBe('プラン');

    result = await call('/api/v1/plugins/i18n/ui/ja/theme.esim', 'GET', undefined, true, env);
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ 'Plans': 'プラン', 'Sign in': 'ログイン' });
  });

  it('keeps writes admin-only and validates the payload', async () => {
    const { env } = makeEnv();
    expect((await call('/api/v1/plugins/i18n/ui/ja/theme.esim', 'PUT', { a: 'b' }, false, env)).status).toBe(401);
    expect((await call('/api/v1/plugins/i18n/ui/ja/theme.esim', 'PUT', ['not', 'an', 'object'], true, env)).status).toBe(400);
    expect((await call('/api/v1/plugins/i18n/ui/ja/theme.esim', 'PUT', { a: 42 }, true, env)).status).toBe(400);
    expect((await call('/api/v1/plugins/i18n/ui/ja/Bad Namespace', 'PUT', { a: 'b' }, true, env)).status).toBe(400);
    expect((await call('/api/v1/plugins/i18n/ui/xx/theme.esim', 'PUT', { a: 'b' }, true, env)).status).toBe(404);
    expect((await call('/api/v1/plugins/i18n/ui/xx/theme.esim')).status).toBe(404);
  });

  it('serves storefront reads only while the plugin is enabled', async () => {
    const { env } = makeEnv({ pluginEnabled: false });
    const result = await call('/api/v1/plugins/i18n/ui/ja/theme.esim', 'GET', undefined, false, env);
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('PLUGIN_DISABLED');
  });

  it('merges every namespace for the storefront and can narrow to one', async () => {
    const { env, translations } = makeEnv();
    translations.set('ja|theme.esim|Sign in', 'ログイン');
    translations.set('ja|common|Cancel', 'キャンセル');
    const all = await call('/api/v1/plugins/i18n/messages/ja', 'GET', undefined, false, env);
    expect(all.status).toBe(200);
    expect(all.body.data).toEqual({ common: { Cancel: 'キャンセル' }, 'theme.esim': { 'Sign in': 'ログイン' } });
    const narrowed = await call('/api/v1/plugins/i18n/messages/ja?namespace=theme.esim', 'GET', undefined, false, env);
    expect(narrowed.body.data).toEqual({ 'theme.esim': { 'Sign in': 'ログイン' } });
    expect((await call('/api/v1/plugins/i18n/messages/ja?namespace=missing', 'GET', undefined, false, env)).body.data).toEqual({});
  });

  it('summarizes namespaces with per-locale counts for the editor', async () => {
    const { env, translations } = makeEnv();
    translations.set('ja|theme.esim|Sign in', 'ログイン');
    translations.set('ja|theme.esim|Log In', 'ログイン');
    translations.set('en|theme.esim|Sign in', 'Sign in');
    const result = await call('/api/v1/plugins/i18n/ui', 'GET', undefined, true, env);
    expect(result.body.data).toEqual({
      items: [{ namespace: 'theme.esim', total: 3, locales: { en: 1, ja: 2 } }],
      total: 1,
    });
    expect((await call('/api/v1/plugins/i18n/ui', 'GET', undefined, false, env)).status).toBe(401);
  });

  it('round-trips through export and import, including the bulk shape and replace mode', async () => {
    const source = makeEnv();
    source.translations.set('ja|theme.esim|Sign in', 'ログイン');
    source.translations.set('en|theme.esim|Sign in', 'Sign in');
    const exported = await call('/api/v1/plugins/i18n/export/ui/json?locale=ja', 'GET', undefined, true, source.env);
    expect(exported.body.data).toEqual({ translations: { ja: { 'theme.esim': { 'Sign in': 'ログイン' } } } });
    const exportedAll = await call('/api/v1/plugins/i18n/export/ui/json', 'GET', undefined, true, source.env);
    expect(Object.keys(exportedAll.body.data.translations).sort()).toEqual(['en', 'ja', 'zh-Hans']);

    const target = makeEnv();
    target.translations.set('ja|theme.esim|Stale key', 'stale');
    const imported = await call('/api/v1/plugins/i18n/import/ui/json', 'POST', {
      locale: 'ja', namespace: 'theme.esim', mode: 'replace', entries: { 'Sign in': 'ログイン', 'Empty': '' },
    }, true, target.env);
    expect(imported.body.data).toEqual({ imported: 1, targets: 1 });
    expect([...target.translations.keys()]).toEqual(['ja|theme.esim|Sign in']);

    const bulkEnv = makeEnv();
    const bulk = await call('/api/v1/plugins/i18n/import/ui/json', 'POST', exportedAll.body.data, true, bulkEnv.env);
    expect(bulk.status).toBe(200);
    expect(bulkEnv.translations.get('ja|theme.esim|Sign in')).toBe('ログイン');
    expect(bulkEnv.translations.get('en|theme.esim|Sign in')).toBe('Sign in');
    expect((await call('/api/v1/plugins/i18n/import/ui/json', 'POST', { locale: 'xx', namespace: 'theme.esim', entries: { a: 'b' } })).status).toBe(404);
    expect((await call('/api/v1/plugins/i18n/import/ui/json', 'POST', { locale: 'ja', namespace: 'theme.esim', entries: {} })).status).toBe(400);
    expect((await call('/api/v1/plugins/i18n/import/ui/json', 'POST', { locale: 'ja', namespace: 'theme.esim', entries: { a: 'b' } }, false)).status).toBe(401);
  });

  it('ignores paths that belong to other handlers', async () => {
    expect(await tryNativeI18nPlugin(request('/api/v1/plugins/seo/store/redirects'), makeEnv().env)).toBeNull();
    expect(await tryNativeI18nPlugin(request('/api/v1/plugins/i18n/store/locales'), makeEnv().env)).toBeNull();
  });
});
