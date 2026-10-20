interface I18nEnv extends Pick<Cloudflare.Env, 'DB'> {}

interface StoredLocale {
  locale: string;
  name: string;
  native_name: string;
  direction: 'ltr' | 'rtl';
  fallback_locale: string | null;
  is_default: number;
  is_enabled: number;
  sort_order: number;
}

function publicLocale(row: StoredLocale) {
  return {
    locale: row.locale,
    name: row.name,
    nativeName: row.native_name,
    direction: row.direction,
    ...(row.fallback_locale ? { fallbackLocale: row.fallback_locale } : {}),
    isDefault: row.is_default === 1,
    isEnabled: row.is_enabled === 1,
    sortOrder: row.sort_order,
  };
}

/**
 * Public Store Localization (i18n plugin) locales read for the storefront:
 * the enabled-locale list the shop middleware/proxy consumes as its routing
 * source of truth. Mirrors the plugin's GET /store/locales contract.
 */
export async function tryNativeI18nLocales(request: Request, env: I18nEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const matches = path === '/api/v1/plugins/i18n/store/locales' || path === '/api/v1/i18n/store/locales';
  if (!matches || request.method !== 'GET') return null;

  const installation = await env.DB.prepare(
    "SELECT enabled FROM native_plugin_instances WHERE plugin_slug = 'i18n' AND instance_key = 'default'",
  ).first<{ enabled: number }>();
  if (!installation?.enabled) {
    return Response.json({ success: false, error: { code: 'PLUGIN_DISABLED', message: 'i18n plugin is not enabled' } }, { status: 404 });
  }

  const result = await env.DB.prepare(
    `SELECT * FROM i18n_locales WHERE is_enabled = 1 ORDER BY sort_order ASC`,
  ).all<StoredLocale>();
  return Response.json({
    success: true,
    data: {
      items: (result.results ?? []).map(publicLocale),
      total: result.results?.length ?? 0,
    },
  });
}
