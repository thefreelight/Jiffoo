// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PluginPageShell } from 'shared/src/plugin-pages/shell';
import { pluginPageLabels } from 'shared/src/plugin-pages/labels';

/**
 * The error state of the plugin page shell in every storefront locale.
 *
 * When Core refuses to open the session of the page, the shell says so in the
 * language of the store and offers the retry in the same language. The frame
 * is gone: the page shows the failure, not a broken frame.
 */
describe('the error state of a plugin page', () => {
  let root: Root | undefined, container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Mounts the shell of a page whose session Core refuses. */
  async function mount(locale: 'en' | 'zh-Hans' | 'zh-Hant') {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const transport = vi.fn(async () => { throw new Error('PLUGIN_PAGE_UNAVAILABLE'); });
    const element = createElement(PluginPageShell, { slug: 'imagic', pageId: 'studio', title: 'Studio', surface: 'shop', locale,
      currency: 'USD', store: { id: 'system', name: 'Store', url: '/' }, allowedPaths: [], labels: pluginPageLabels[locale],
      transport: transport as never, navigate: () => undefined, signIn: () => undefined, checkout: () => undefined });
    await act(async () => root!.render(element));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  }

  it('says in the language of the store that the page is unavailable and offers the retry', async () => {
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
      await mount(locale);
      const alert = container!.querySelector('[role=alert]');
      expect(alert, `The ${locale} shell must report the failure`).not.toBeNull();
      expect(alert!.textContent).toContain(pluginPageLabels[locale].unavailable);
      const retry = alert!.querySelector('button');
      expect(retry!.textContent).toBe(pluginPageLabels[locale].retry);
      // The failure replaces the frame: the page never shows a broken frame.
      expect(container!.querySelector('iframe')).toBeNull();
      if (root) await act(async () => root!.unmount());
      container?.remove();
      root = undefined;
      container = undefined;
    }
  });
});
