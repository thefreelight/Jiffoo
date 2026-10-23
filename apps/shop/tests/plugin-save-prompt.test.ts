// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PluginPageShell, type ShellSession } from '../../../packages/shared/src/plugin-pages/shell';
import { pluginPageLabels } from '../../../packages/shared/src/plugin-pages/labels';
import { CHANNEL, VERSION } from '../../../packages/plugin-bridge/src/protocol';

afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each(['shop', 'admin'] as const)('%s requires a Core Save gesture, supports cancellation and closes its modal on identity loss', async surface => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // jsdom has no modal rendering; browser top-layer/focus behavior is covered by CI E2E.
  const show = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  const close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: show }, close: { configurable: true, value: close },
  });
  const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const id = '12345678-1234-4123-8123-123456789abc';
  const origin = location.origin;
  const identity = { id: 'customer', displayName: 'Buyer', email: 'buyer@example.com' };
  const session: ShellSession = { sessionId: id, frameUrl: `${origin}/api/v1/plugin-assets/installation/${'a'.repeat(64)}/index.html`,
    pluginToken: 'scoped-token', expiresAt: new Date(Date.now() + 120_000).toISOString(), guestSecret: null,
    context: { customer: surface === 'shop' ? identity : null, admin: surface === 'admin' ? identity : null, page: { id: 'studio', path: '/studio' } } };
  const transport = vi.fn(async (path: string) => path.endsWith('/session') ? session : { url: `/plugin-downloads/${id}?token=signed` });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(PluginPageShell, { slug: 'studio', pageId: 'studio', title: 'Studio', surface,
      locale: 'en', currency: 'USD', store: { id: 'system', name: 'Shop', url: '/' }, allowedPaths: [], labels: pluginPageLabels.en,
      transport, navigate: vi.fn(), signIn: vi.fn(), checkout: vi.fn() })));
    const frame = container.getElementsByTagName('iframe')[0];
    const source = frame.contentWindow!;
    const post = vi.spyOn(source, 'postMessage');
    await act(async () => { frame.dispatchEvent(new Event('load')); });
    const send = async (data: unknown) => act(async () => { window.dispatchEvent(new MessageEvent('message', { source, origin: 'null', data })); });
    await send({ channel: CHANNEL, version: VERSION, id: 'hello', type: 'bridge.hello', payload: { supportedVersions: [1] } });
    const binding = post.mock.calls.find(([message]) => message.type === 'bridge.welcome')![0];
    let sequence = 0;
    const request = () => send({ channel: CHANNEL, version: VERSION, id: `download-${++sequence}`, type: 'file.download',
      sessionId: id, nonce: binding.nonce, payload: { reference: id } });
    const button = (name: string) => Array.from(container.getElementsByTagName('button')).find(element => element.textContent === name)!;
    await request();
    expect(show).toHaveBeenCalledOnce();
    expect(container.getElementsByTagName('dialog')[0].open).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    await act(async () => button('Cancel').click());
    expect(container.getElementsByTagName('dialog')).toHaveLength(0);
    expect(close).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledTimes(1);
    await request();
    await act(async () => button('Save file').click());
    expect(transport).toHaveBeenCalledWith(`/plugin-pages/studio/sessions/${id}/download`, 'POST', { reference: id });
    expect(anchor).toHaveBeenCalledOnce();
    expect(container.getElementsByTagName('dialog')).toHaveLength(0);
    await request();
    await act(async () => { window.dispatchEvent(new Event('jiffoo:identity-changing')); });
    expect(container.getElementsByTagName('dialog')).toHaveLength(0);
    expect(container.getElementsByTagName('iframe')).toHaveLength(0);
    expect(close).toHaveBeenCalledTimes(3);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
