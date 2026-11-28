import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The server-side traffic switch: read from the Core API, cached briefly, and
// closed whenever the answer cannot be trusted.
vi.mock('@/lib/server-api-url', () => ({ resolveServerApiOrigin: vi.fn(async () => 'https://api.bokmoo.example') }));

import { isTrafficCollectionEnabled, resetTrafficSwitchCache } from '@/lib/traffic-server';

const respond = (status: number, payload: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }));

describe('isTrafficCollectionEnabled', () => {
  let clock: number;

  beforeEach(() => {
    resetTrafficSwitchCache();
    clock = Date.UTC(2026, 10, 28, 4);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('is on only when the Core API says so', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { enabled: true } }));
    expect(await isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example/', now: () => clock })).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://api.bokmoo.example/api/v1/traffic/config', expect.objectContaining({ cache: 'no-store' }));

    resetTrafficSwitchCache();
    vi.stubGlobal('fetch', respond(200, { success: true, data: { enabled: false } }));
    expect(await isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example', now: () => clock })).toBe(false);
  });

  it('is closed when the answer is missing or unreadable', async () => {
    const answers = [
      respond(500, { success: false }),
      respond(200, { success: true, data: {} }),
      respond(200, { success: true, data: { enabled: 'yes' } }),
      vi.fn(async () => new Response('not json', { status: 200 })),
      vi.fn(async () => { throw new Error('connection refused'); }),
    ];
    for (const answer of answers) {
      resetTrafficSwitchCache();
      vi.stubGlobal('fetch', answer);
      expect(await isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example', now: () => clock })).toBe(false);
    }
  });

  it('asks once per cache window', async () => {
    vi.stubGlobal('fetch', respond(200, { success: true, data: { enabled: true } }));
    expect(await isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example', now: () => clock })).toBe(true);
    clock += 29_000;
    expect(await isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example', now: () => clock })).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    clock += 2_000;
    vi.stubGlobal('fetch', respond(200, { success: true, data: { enabled: false } }));
    expect(await isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example', now: () => clock })).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after a short wait instead of holding the page', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })));
      const answer = isTrafficCollectionEnabled({ apiOrigin: 'https://api.bokmoo.example', now: () => clock });
      await vi.advanceTimersByTimeAsync(1500);
      expect(await answer).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
