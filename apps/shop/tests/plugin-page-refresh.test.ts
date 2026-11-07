// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PluginPageShell } from 'shared/src/plugin-pages/shell';
import { pluginPageLabels } from 'shared/src/plugin-pages/labels';

/**
 * The refresh of the token of a live plugin page.
 *
 * A refresh that Core refuses for a while — a rate limit, a busy Core, a
 * network error — is not the end of the page: the frame, the session and the
 * state the customer entered stay, and the plugin keeps a valid token. Only a
 * revoked session ends the page.
 */
describe('the refresh of a plugin page', () => {
  let root: Root | undefined, container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function message(data: unknown, source: Window | null): MessageEvent {
    const event = new MessageEvent('message', { data });
    Object.defineProperty(event, 'source', { value: source });
    Object.defineProperty(event, 'origin', { value: 'null' });
    return event;
  }

  async function mount(refreshFailure: unknown, refreshResult?: { pluginToken: string; expiresAt: string; context: unknown }, navigation = { locale: 'en' as 'en' | 'zh-Hans' | 'zh-Hant', surface: 'shop' as 'shop' | 'admin' }) {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const frameUrl = new URL(`/api/v1/plugin-assets/id/${'a'.repeat(64)}/index.html`, location.origin).href;
    const refresh = refreshResult ? vi.fn().mockResolvedValue(refreshResult) : vi.fn().mockRejectedValue(refreshFailure);
    const transport = vi.fn(async (path: string, method: string) => {
      if (path.endsWith('/product-target')) return { path: `/${navigation.locale}/products/item` };
      if (path.endsWith('/customer-target')) return { path: '/customers/customer' };
      if (path.endsWith('/refresh')) return refresh();
      if (method === 'POST' && path.endsWith('/session')) {
        return { sessionId: 'session', frameUrl, pluginToken: 'token', expiresAt: new Date(Date.now() + 120_000).toISOString(),
          guestSecret: null, context: { customer: null, admin: navigation.surface === 'admin' ? { id: 'admin' } : null, page: { id: 'studio', path: '/studio' } } };
      }
      return { revoked: true };
    });
    const navigate = vi.fn();
    const element = createElement(PluginPageShell, { slug: 'imagic', pageId: 'studio', title: 'Studio', surface: navigation.surface, locale: navigation.locale,
      currency: 'USD', store: { id: 'system', name: 'Store', url: '/' }, allowedPaths: ['/products'], labels: pluginPageLabels.en,
      transport: transport as never, navigate, signIn: () => undefined, checkout: () => undefined });
    await act(async () => root!.render(element));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    // The frame of the plugin announces itself, the way the bridge does.
    const frame = container!.querySelector('iframe')!;
    const contentWindow = frame.contentWindow!;
    const posted: Array<Record<string, unknown>> = [];
    const original = contentWindow.postMessage.bind(contentWindow);
    contentWindow.postMessage = ((value: unknown, targetOrigin: string) => { posted.push(value as Record<string, unknown>); original(value, targetOrigin); }) as typeof contentWindow.postMessage;
    await act(async () => { frame.dispatchEvent(new Event('load')); });
    await act(async () => { window.dispatchEvent(message({ channel: 'jiffoo.plugin', version: 1, id: 'hello', type: 'bridge.hello', payload: { supportedVersions: [1] } }, contentWindow)); });
    return { refresh, transport, frame, contentWindow, posted, navigate };
  }

  it('reports viewport space without loosening frame bounds or replacing the frame', async () => {
    const { posted, contentWindow, frame } = await mount(undefined);
    const binding = posted.find(envelope => envelope.type === 'bridge.welcome')!;
    await act(async () => { window.dispatchEvent(message({ channel: 'jiffoo.plugin', version: 1,
      id: 'resize-test', type: 'frame.resize', sessionId: binding.sessionId, nonce: binding.nonce,
      payload: { height: 9000 } }, contentWindow)); });
    expect(frame.style.height).toBe('2000px');
    expect(posted.find(envelope => envelope.id === 'resize-test')?.result).toEqual({ availableHeight: window.innerHeight - 24 });
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    expect(container!.querySelector('iframe')).toBe(frame);
  });

  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
    for (const type of ['navigate', 'commerce.product.open', 'customers.open']) {
      it(`passes one canonical locale prefix to the host for ${type} in ${locale}`, async () => {
        const { posted, contentWindow, navigate } = await mount(undefined, undefined, { locale, surface: type === 'customers.open' ? 'admin' : 'shop' });
        const binding = posted.find(envelope => envelope.type === 'bridge.welcome')!;
        const payload = type === 'navigate' ? { path: '/products' } : type === 'customers.open' ? { customerId: 'customer' } : { variantId: 'c' + 'a'.repeat(24) };
        await act(async () => { window.dispatchEvent(message({ channel: 'jiffoo.plugin', version: 1, id: 'navigate-test', type,
          sessionId: binding.sessionId, nonce: binding.nonce, payload }, contentWindow)); });
        expect(navigate).toHaveBeenCalledWith(`/${locale}/${type === 'customers.open' ? 'customers/customer' : type === 'navigate' ? 'products' : 'products/item'}`);
      });
    }
  }

  it('keeps the page and its frame when Core refuses a refresh for a while', async () => {
    const { refresh } = await mount('RATE_LIMITED');
    expect(container!.querySelector('iframe')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalled();
    // The page is not destroyed: the frame, the session and the state of the
    // customer survive a refused refresh.
    expect(container!.querySelector('[role=alert]')).toBeNull();
    expect(container!.querySelector('iframe')).not.toBeNull();
  });

  it('answers a refused refresh with the token the shell holds', async () => {
    const { posted, contentWindow } = await mount('RATE_LIMITED');
    const welcome = posted.find(envelope => envelope.type === 'bridge.welcome')!;
    await act(async () => { window.dispatchEvent(message({ channel: 'jiffoo.plugin', version: 1, id: 'refresh-1', type: 'token.refresh',
      sessionId: welcome.sessionId, nonce: welcome.nonce }, contentWindow)); });
    // The plugin keeps a valid token: the budget of the session was spent, the
    // token of the shell is still valid.
    const answer = posted.find(envelope => envelope.id === 'refresh-1')!;
    expect(answer.error).toBeUndefined();
    expect(answer.result).toEqual({ pluginToken: 'token', expiresAt: expect.any(String) });
    expect(container!.querySelector('[role=alert]')).toBeNull();
  });

  it('ends the page when the session is revoked', async () => {
    const { refresh } = await mount('PLUGIN_PAGE_SESSION_REVOKED');
    expect(container!.querySelector('iframe')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalled();
    expect(container!.querySelector('[role=alert]')).not.toBeNull();
    expect(container!.querySelector('iframe')).toBeNull();
  });

  it('ends the page when the shell of the admin reports the failure by its code', async () => {
    // The shell of the admin carries the catalogue code in the code of the
    // error and a message for the operator.
    const { refresh } = await mount(Object.assign(new Error('The plugin page session is no longer valid.'), { code: 'PLUGIN_PAGE_SESSION_REVOKED' }));
    expect(container!.querySelector('iframe')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalled();
    expect(container!.querySelector('[role=alert]')).not.toBeNull();
    expect(container!.querySelector('iframe')).toBeNull();
  });

  it('ends the page when the plugin is gone', async () => {
    const { refresh } = await mount('NOT_FOUND');
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalled();
    expect(container!.querySelector('[role=alert]')).not.toBeNull();
    expect(container!.querySelector('iframe')).toBeNull();
  });

  it('keeps the page and its frame when the session is renewed at the end of its window', async () => {
    // Core renews the window of a live session, so the refresh at the end of
    // the window answers with a fresh token. The frame is not unmounted: the
    // file the customer chose and the form they filled in stay in it.
    const { refresh, frame } = await mount(undefined, { pluginToken: 'renewed', expiresAt: new Date(Date.now() + 120_000).toISOString(),
      context: { customer: null, admin: null, page: { id: 'studio', path: '/studio' } } });
    expect(container!.querySelector('iframe')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalled();
    expect(container!.querySelector('[role=alert]')).toBeNull();
    expect(container!.querySelector('iframe')).toBe(frame);
  });

  it('ends the page when the session reached the end of its lifetime', async () => {
    const { refresh } = await mount('PLUGIN_PAGE_SESSION_EXPIRED');
    expect(container!.querySelector('iframe')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(refresh).toHaveBeenCalled();
    expect(container!.querySelector('[role=alert]')).not.toBeNull();
    expect(container!.querySelector('iframe')).toBeNull();
  });
});
