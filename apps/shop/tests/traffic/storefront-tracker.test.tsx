import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The storefront page-view tracker: what it sends on load and on an in-page
// navigation, what it leaves out, and who it leaves alone.
const navigation = vi.hoisted(() => ({ pathname: '/en' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

import { StorefrontTracker, buildPageview, visitorOptsOut } from '@/components/storefront-tracker';

const COLLECT = '/api/v1/traffic/collect';
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

type Sent = { url: string; init: RequestInit; body: Record<string, unknown> };

type FetchMock = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function stubCollect(): { fetchMock: FetchMock; sent: () => Sent[] } {
  const fetchMock: FetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  const sent = () => fetchMock.mock.calls.map(([url, init]) => ({ url, init: init ?? {}, body: JSON.parse(String(init?.body)) }));
  return { fetchMock, sent };
}

function setNavigatorFlag(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

beforeEach(() => {
  navigation.pathname = '/en';
  window.history.replaceState({}, '', '/en');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const flag of ['doNotTrack', 'globalPrivacyControl', 'webdriver']) {
    Object.defineProperty(navigator, flag, { value: undefined, configurable: true });
  }
  Object.defineProperty(document, 'referrer', { value: '', configurable: true });
});

describe('visitorOptsOut', () => {
  it('leaves alone a visitor who asked not to be tracked, and an automated browser', () => {
    expect(visitorOptsOut({})).toBe(false);
    expect(visitorOptsOut({ doNotTrack: '0' })).toBe(false);
    expect(visitorOptsOut({ doNotTrack: '1' })).toBe(true);
    expect(visitorOptsOut({ globalPrivacyControl: true })).toBe(true);
    expect(visitorOptsOut({ webdriver: true })).toBe(true);
  });
});

describe('buildPageview', () => {
  it('describes the page and, on a landing page, where it came from', () => {
    const landing = buildPageview({
      hostname: 'www.bokmoo.com', path: '/en', search: '?utm_source=nl', referrer: 'https://www.google.com/', width: 390, zoneOffsetMinutes: 480,
    });
    expect(landing).toEqual({ v: 1, h: 'www.bokmoo.com', p: '/en?utm_source=nl', w: 390, z: 480, r: 'https://www.google.com/' });

    const later = buildPageview({ hostname: 'www.bokmoo.com', path: '/en/cart', search: '', referrer: null, width: 390, zoneOffsetMinutes: 480 });
    expect(later).toEqual({ v: 1, h: 'www.bokmoo.com', p: '/en/cart', w: 390, z: 480 });
  });
});

describe('StorefrontTracker', () => {
  it('counts the landing page view once, as a fire-and-forget same-origin beacon', async () => {
    Object.defineProperty(document, 'referrer', { value: 'https://chatgpt.com/c/abc', configurable: true });
    window.history.replaceState({}, '', '/en/products/japan?q=esim');
    navigation.pathname = '/en/products/japan';
    const { fetchMock, sent } = stubCollect();

    render(<StorefrontTracker />);
    await flush();

    expect(sent()).toHaveLength(1);
    const [{ url, init, body }] = sent();
    expect(url).toBe(COLLECT);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    expect((init.headers as Record<string, string>)['content-type']).toBe('text/plain');
    expect(body).toEqual({
      v: 1, h: 'localhost', p: '/en/products/japan?q=esim', r: 'https://chatgpt.com/c/abc',
      w: window.innerWidth, z: -new Date().getTimezoneOffset(),
    });
    // A failed beacon is swallowed rather than surfaced.
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    navigation.pathname = '/en/cart';
    window.history.replaceState({}, '', '/en/cart');
    expect(() => render(<StorefrontTracker />)).not.toThrow();
  });

  it('still counts a page view once under React Strict Mode', async () => {
    const { sent } = stubCollect();
    render(<StrictMode><StorefrontTracker /></StrictMode>);
    await flush();
    expect(sent()).toHaveLength(1);
  });

  it('counts an in-page navigation without repeating where the page load came from', async () => {
    Object.defineProperty(document, 'referrer', { value: 'https://www.google.com/', configurable: true });
    const { sent } = stubCollect();
    const view = render(<StorefrontTracker />);
    await flush();

    navigation.pathname = '/en/cart';
    window.history.replaceState({}, '', '/en/cart');
    view.rerender(<StorefrontTracker />);
    await flush();
    // The same page again is not another page view.
    view.rerender(<StorefrontTracker />);
    await flush();

    const bodies = sent().map((beacon) => beacon.body);
    expect(bodies.map((body) => body.p)).toEqual(['/en', '/en/cart']);
    expect(bodies[0]?.r).toBe('https://www.google.com/');
    expect(bodies[1]).not.toHaveProperty('r');
  });

  it.each(['doNotTrack', 'globalPrivacyControl', 'webdriver'])('sends nothing when navigator.%s is set', async (flag) => {
    setNavigatorFlag(flag, flag === 'doNotTrack' ? '1' : true);
    const { fetchMock } = stubCollect();
    render(<StorefrontTracker />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
