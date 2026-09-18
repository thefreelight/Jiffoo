import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const RAW_CONTEXT = {
  storeId: 'easyeuicc',
  storeName: 'EasyEUICC',
  logo: null,
  status: 'active',
  theme: { slug: 'app-landingpage', version: '0.1.1', config: {} },
  settings: null,
};

function stubFetch(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

async function loadModule() {
  vi.resetModules();
  return import('@/lib/server-store-context');
}

describe('server store context payload parsing', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('accepts the bare store context payload without the success envelope', async () => {
    process.env.API_SERVICE_URL = 'https://api.example.com';
    process.env.SERVER_STORE_CONTEXT_TIMEOUT_MS = '2000';
    vi.stubGlobal('fetch', stubFetch(RAW_CONTEXT));

    const { getServerStoreContext } = await loadModule();
    const context = await getServerStoreContext({ cache: 'force-cache' });

    expect(context?.storeName).toBe('EasyEUICC');
    expect(context?.theme?.slug).toBe('app-landingpage');
  });

  it('accepts enveloped payloads as before', async () => {
    process.env.API_SERVICE_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', stubFetch({ success: true, data: RAW_CONTEXT }));

    const { getServerStoreContext } = await loadModule();
    const context = await getServerStoreContext({ cache: 'force-cache' });

    expect(context?.storeName).toBe('EasyEUICC');
    expect(context?.theme?.slug).toBe('app-landingpage');
  });

  it('falls back when the payload is an unrelated object', async () => {
    process.env.API_SERVICE_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_FALLBACK_STORE_NAME = 'Fallback Store';
    vi.stubGlobal('fetch', stubFetch({ foo: 'bar' }));

    const { getServerStoreContext } = await loadModule();
    const context = await getServerStoreContext({ cache: 'force-cache' });

    expect(context?.storeName).toBe('Fallback Store');
  });
});
