import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { boundedPlain, parseEnvelope } from '../../../packages/plugin-bridge/src/protocol';
import { createPluginBridge } from '../../../packages/plugin-bridge/src/index';
import { PluginPageShell } from '../../../packages/shared/src/plugin-pages/shell';
import { pluginPageLabels } from '../../../packages/shared/src/plugin-pages/labels';
import { pluginShellCsp } from '../../../packages/shared/src/plugin-pages/csp';
import { allowedBffRoute } from '../lib/auth-contract';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('bounded plugin bridge boundary', () => {
  it('rejects cycles, non-plain structured clones, deep graphs, poison keys and UTF-8 overflow', () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    let nested: unknown = null; for (let index = 0; index < 20; index++) nested = { nested };
    for (const value of [cycle, nested, new Date(), new Map(), new Uint8Array(4), () => true, { value: NaN }, JSON.parse('{"__proto__":1}'), { text: '界'.repeat(24000) }]) expect(boundedPlain(value)).toBe(false);
    expect(boundedPlain({ message: 'Plain text', count: 2, values: [true, null] })).toBe(true);
    expect(boundedPlain(new Array(1_000_000_000))).toBe(false);
    expect(boundedPlain(Array.from({ length: 8192 }, () => '界'.repeat(1024)))).toBe(false);
    expect(parseEnvelope({ channel: 'jiffoo.plugin', version: 2, id: 'request', type: 'bridge.hello' })).toBeNull();
    expect(parseEnvelope({ channel: 'jiffoo.plugin', version: 1, id: 'request', type: 'token.refresh' })).toBeNull();
  });
  it('ignores sibling sources and wrong origins, then binds only to the exact parent', async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, (event?: unknown) => void>();
    const parent = { postMessage: vi.fn() };
    const window = { addEventListener: (name: string, handler: (event?: unknown) => void) => handlers.set(name, handler),
      removeEventListener: (name: string) => handlers.delete(name) };
    vi.stubGlobal('parent', parent); vi.stubGlobal('window', window);
    vi.stubGlobal('location', { href: 'https://shop.example/api/v1/plugin-assets/id/hash/index.html?shellOrigin=https%3A%2F%2Fshop.example' });
    const bridge = createPluginBridge();
    const welcome = { channel: 'jiffoo.plugin', version: 1, id: 'welcome', type: 'bridge.welcome', sessionId: 'session', nonce: 'a'.repeat(64),
      payload: { context: { customer: null, admin: null, locale: 'en', currency: 'USD', colorMode: 'light',
        themeTokens: {}, store: { id: 'system', name: 'Store', url: 'https://shop.example' }, page: { id: 'studio', path: '/studio' }, capabilities: [] }, pluginToken: 'scoped-token' } };
    const send = (source: unknown, origin: string, data: unknown = welcome) => handlers.get('message')?.({ source, origin, data });
    send({}, 'https://shop.example'); send(parent, 'https://evil.example');
    send(parent, 'https://shop.example', { ...welcome, payload: { context: { customer: null, admin: null }, pluginToken: 'malformed-context' } });
    let ready = false; void bridge.ready.then(() => { ready = true; }); await Promise.resolve();
    expect(ready).toBe(false);
    send(parent, 'https://shop.example'); await bridge.ready;
    expect(await bridge.token()).toBe('scoped-token');
    const pending = bridge.request('context.get'); await Promise.resolve();
    const request = parent.postMessage.mock.calls.at(-1)![0];
    send(parent, 'https://shop.example', { ...request, nonce: 'b'.repeat(64), result: { wrong: true } });
    send(parent, 'https://shop.example', { ...request, result: { customer: null } });
    expect(await pending).toEqual({ customer: null });
    const updates = vi.fn();
    const subscribed = bridge.subscribe(updates);
    await Promise.resolve(); await Promise.resolve();
    const subscription = parent.postMessage.mock.calls.at(-1)![0];
    const changed = { ...subscription, id: 'change', type: 'context.changed', payload: {
      revision: 2, context: { ...welcome.payload.context, locale: 'zh-Hans', colorMode: 'dark' },
    } };
    send(parent, 'https://shop.example', changed);
    send(parent, 'https://shop.example', { ...subscription, result: { subscribed: true } });
    await subscribed;
    send(parent, 'https://shop.example', { ...changed, payload: { ...changed.payload, revision: 1 } });
    send(parent, 'https://shop.example', { ...changed, payload: { revision: 3, context: { admin: null } } });
    expect(updates).toHaveBeenCalledTimes(1);
    expect(await bridge.context()).toMatchObject({ locale: 'zh-Hans', colorMode: 'dark' });
    handlers.get('pagehide')?.();
    await expect(bridge.token()).rejects.toThrow('Bridge closed');
  });
  it('expires an unanswered handshake after ten seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('parent', { postMessage: vi.fn() });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('location', { href: 'https://shop.example/index.html?shellOrigin=https%3A%2F%2Fshop.example' });
    const bridge = createPluginBridge();
    const rejection = expect(bridge.ready).rejects.toThrow('handshake timed out');
    await vi.advanceTimersByTimeAsync(10_000); await rejection;
  });
});

it('shells render a localized accessible loading state without an unadmitted iframe', () => {
  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
    const html = renderToStaticMarkup(createElement(PluginPageShell, { slug: 'studio', pageId: 'home', title: 'Studio', surface: 'shop', locale,
      currency: 'USD', store: { id: 'system', name: 'Store', url: '/' }, allowedPaths: [], labels: pluginPageLabels[locale],
      transport: async () => null, navigate: () => undefined, signIn: () => undefined, checkout: () => undefined }));
    expect(html).toContain('role="status"'); expect(html).toContain(pluginPageLabels[locale].loading); expect(html).not.toContain('<iframe');
  }
});
it('only exact shell BFF routes are admitted and CSP framing is restricted to Core assets', () => {
  expect(allowedBffRoute('POST', '/plugin-pages/studio/session')).toBe(true);
  expect(allowedBffRoute('GET', '/plugin-pages')).toBe(true);
  for (const path of ['/plugin-pages/studio/session/more', '/plugin-pages/../admin/session', '/plugin-pages/studio%2fadmin/session', '/plugin-pages/Studio/session']) expect(allowedBffRoute('POST', path)).toBe(false);
  const policy = pluginShellCsp('https://shop.example');
  expect(policy).toContain('frame-src https://shop.example/api/v1/plugin-assets/;');
  expect(policy).not.toContain('frame-src *');
});
