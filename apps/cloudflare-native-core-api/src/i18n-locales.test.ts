import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

const { tryNativeI18nLocales } = await import('./i18n-locales');

function dbWith(rows: Record<string, unknown>[], pluginEnabled = true) {
  return {
    prepare: (sql: string) => ({
      bind: (..._values: unknown[]) => ({
        first: async () => {
          if (sql.includes('native_plugin_instances')) {
            return pluginEnabled ? { enabled: 1 } : null;
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
      all: async () => ({ results: rows }),
      first: async () => {
        if (sql.includes('native_plugin_instances')) {
          return pluginEnabled ? { enabled: 1 } : null;
        }
        return null;
      },
    }),
  };
}

function request(): Request {
  return new Request('https://api.example/api/v1/plugins/i18n/store/locales', { method: 'GET' });
}

describe('tryNativeI18nLocales', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for non-matching paths', async () => {
    const result = await tryNativeI18nLocales(new Request('https://api.example/api/v1/other'), { DB: dbWith([]) } as never);
    expect(result).toBeNull();
  });

  it('returns 404 when the i18n plugin is not enabled', async () => {
    const response = await tryNativeI18nLocales(request(), { DB: dbWith([], false) } as never);
    expect(response?.status).toBe(404);
  });

  it('returns enabled locales in plugin contract shape', async () => {
    const rows = [
      { locale: 'en', name: 'English', native_name: 'English', direction: 'ltr', fallback_locale: null, is_default: 1, is_enabled: 1, sort_order: 0 },
      { locale: 'ja', name: 'Japanese', native_name: '日本語', direction: 'ltr', fallback_locale: null, is_default: 0, is_enabled: 1, sort_order: 3 },
    ];
    const response = await tryNativeI18nLocales(request(), { DB: dbWith(rows) } as never);
    const body = await response?.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.items[0]).toMatchObject({ locale: 'en', isDefault: true, isEnabled: true });
    expect(body.data.items[1]).toMatchObject({ locale: 'ja', nativeName: '日本語' });
  });
});
