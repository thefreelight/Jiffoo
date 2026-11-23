import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiOrigin = vi.fn();
vi.mock('@/lib/server-api-url', () => ({ resolveServerApiOrigin: () => apiOrigin() }));

const { getThemeMessages, pickThemeNamespaces, registerThemeMessages } = await import('@/lib/theme-i18n');

const REGISTRY_KEY = '__JIFFOO_THEME_I18N__';
const root = globalThis as unknown as Record<string, unknown>;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  apiOrigin.mockReset();
  apiOrigin.mockResolvedValue('https://api.example.test');
  delete root[REGISTRY_KEY];
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('registerThemeMessages', () => {
  it('publishes one locale without disturbing the others', () => {
    registerThemeMessages('de', { 'theme.esim': { Password: 'Kennwort' } });
    registerThemeMessages('ja', { 'theme.esim': { Password: 'パスワード' } });
    const messages = (root[REGISTRY_KEY] as { messages: Record<string, unknown> }).messages;
    expect(messages.de).toEqual({ 'theme.esim': { Password: 'Kennwort' } });
    expect(messages.ja).toEqual({ 'theme.esim': { Password: 'パスワード' } });
    // Re-registering a locale replaces its table as a whole (a removed override must not linger).
    registerThemeMessages('de', {});
    expect(messages.de).toEqual({});
  });
});

describe('pickThemeNamespaces', () => {
  it('keeps only theme.* namespaces with string values', () => {
    expect(pickThemeNamespaces({ common: { a: 'b' }, 'theme.esim': { 'Sign in': 'ログイン' }, 'theme.bokmoo': { x: 'y' } }))
      .toEqual({ 'theme.esim': { 'Sign in': 'ログイン' }, 'theme.bokmoo': { x: 'y' } });
    expect(pickThemeNamespaces({ 'theme.esim': { ok: '値', bad: 42 } } as unknown as Record<string, Record<string, string>>)).toEqual({ 'theme.esim': { ok: '値' } });
  });

  it('answers null when there is nothing for a theme', () => {
    expect(pickThemeNamespaces(null)).toBeNull();
    expect(pickThemeNamespaces(undefined)).toBeNull();
    expect(pickThemeNamespaces({ common: { a: 'b' } })).toBeNull();
  });
});

describe('getThemeMessages', () => {
  it('reads the merged plugin messages for the locale', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ success: true, data: { common: { x: 'y' }, 'theme.esim': { Password: 'Kennwort' } } }));
    await expect(getThemeMessages('de')).resolves.toEqual({ 'theme.esim': { Password: 'Kennwort' } });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.example.test/api/v1/plugins/i18n/messages/de');
    expect(vi.mocked(fetch).mock.calls[0][1]?.cache).toBe('no-store');
  });

  it('fails open on a disabled plugin, a network error or a malformed payload', async () => {
    // Fresh locales: the per-locale cache is module state that outlives a test.
    vi.mocked(fetch).mockResolvedValueOnce(json({ success: false }, 404));
    await expect(getThemeMessages('es', { apiOrigin: 'https://api.example.test' })).resolves.toBeNull();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(getThemeMessages('it', { apiOrigin: 'https://api.example.test' })).resolves.toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(getThemeMessages('pt', { apiOrigin: 'https://api.example.test/' })).resolves.toBeNull();
    // The trailing slash of an origin never produces a double slash in the path.
    vi.mocked(fetch).mockResolvedValueOnce(json({ success: true, data: { 'theme.esim': { a: '1' } } }));
    await getThemeMessages('nl', { apiOrigin: 'https://api.example.test/' });
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe('https://api.example.test/api/v1/plugins/i18n/messages/nl');
  });

  it('caches per locale for a minute, then refetches', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(json({ success: true, data: { 'theme.esim': { a: '1' } } }));
    const options = { apiOrigin: 'https://api.example.test' };
    await expect(getThemeMessages('ja', options)).resolves.toEqual({ 'theme.esim': { a: '1' } });
    vi.mocked(fetch).mockResolvedValue(json({ success: true, data: { 'theme.esim': { a: '2' } } }));
    await expect(getThemeMessages('ja', options)).resolves.toEqual({ 'theme.esim': { a: '1' } });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    await expect(getThemeMessages('ja', options)).resolves.toEqual({ 'theme.esim': { a: '2' } });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
