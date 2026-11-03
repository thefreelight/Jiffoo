import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPluginBridge } from '../../../packages/plugin-bridge/src/index';
import { pluginThemeNeutralName, pluginThemeVariables } from '../../../packages/shared/src/plugin-pages/theme-vars';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

type StyleElement = {
  textContent: string;
  attributes: Record<string, string>;
  parentNode: unknown;
  setAttribute(name: string, value: string): void;
};

/** A document stub with just enough of the document for the theme stylesheet. */
function stubDocument() {
  const created: StyleElement[] = [];
  const appended: StyleElement[] = [];
  const documentElement = { dataset: {} as Record<string, string> };
  const head = {
    appendChild: (element: StyleElement) => { element.parentNode = head; appended.push(element); return element; },
  };
  const documentStub = {
    head,
    documentElement,
    createElement: () => {
      const element: StyleElement = {
        textContent: '',
        attributes: {},
        parentNode: null,
        setAttribute(name: string, value: string) { element.attributes[name] = value; },
      };
      created.push(element);
      return element;
    },
    querySelector: () => null,
  };
  return { documentStub, created, appended, documentElement };
}

/** The payload of the shell: every theme variable travels under both names. */
function themePayload(entries: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [name, value] of Object.entries(entries)) {
    payload[name] = value;
    payload[pluginThemeNeutralName(name)] = value;
  }
  return payload;
}

/** A bridge that talks to a stubbed shell. */
function stubBridge() {
  const handlers = new Map<string, (event?: unknown) => void>();
  const parent = { postMessage: vi.fn() };
  const window = { addEventListener: (name: string, handler: (event?: unknown) => void) => handlers.set(name, handler),
    removeEventListener: (name: string) => handlers.delete(name) };
  vi.stubGlobal('parent', parent); vi.stubGlobal('window', window);
  vi.stubGlobal('location', { href: 'https://shop.example/api/v1/plugin-assets/id/hash/index.html?shellOrigin=https%3A%2F%2Fshop.example' });
  const bridge = createPluginBridge();
  const welcome = (themeTokens: Record<string, string>) => ({ channel: 'jiffoo.plugin', version: 1, id: 'welcome', type: 'bridge.welcome',
    sessionId: 'session', nonce: 'a'.repeat(64),
    payload: { context: { customer: null, admin: null, locale: 'en', currency: 'USD', colorMode: 'light',
      themeTokens, store: { id: 'system', name: 'Store', url: 'https://shop.example' }, page: { id: 'studio', path: '/studio' }, capabilities: [] },
      pluginToken: 'scoped-token', expiresAt: new Date(Date.now() + 120_000).toISOString() } });
  const send = (data: unknown) => handlers.get('message')?.({ source: parent, origin: 'https://shop.example', data });
  return { bridge, parent, send, welcome };
}

describe('the theme variables of a plugin page', () => {
  it('names every theme variable of a surface and gives it a neutral name', () => {
    const shop = pluginThemeVariables('shop');
    const admin = pluginThemeVariables('admin');
    expect(shop).toHaveLength(44);
    expect(admin).toHaveLength(25);
    expect(shop.every(name => name.startsWith('--shop-'))).toBe(true);
    expect(admin.every(name => name.startsWith('--admin-'))).toBe(true);
    expect(new Set([...shop, ...admin]).size).toBe(69);
    expect(shop).toContain('--shop-core-ground');
    expect(shop).toContain('--shop-extras-primary');
    expect(admin).toContain('--admin-extras-primary-foreground');
    expect(admin).not.toContain('--admin-extras-primary');
    expect(pluginThemeNeutralName('--shop-core-ground')).toBe('--core-ground');
    expect(pluginThemeNeutralName('--shop-extras-primary')).toBe('--extras-primary');
    expect(pluginThemeNeutralName('--admin-core-ground')).toBe('--core-ground');
    expect(pluginThemeNeutralName('--background')).toBe('--background');
  });
});

describe('the bridge of a plugin page', () => {
  it('lays the theme of the host page down on the document of the frame', async () => {
    vi.useFakeTimers();
    const { documentStub, appended, documentElement } = stubDocument();
    vi.stubGlobal('document', documentStub);
    const { bridge, send, welcome } = stubBridge();
    send(welcome(themePayload({ '--shop-core-ground': '#fafafa', '--shop-core-raised': '#ffffff', '--shop-extras-primary': '#111111' })));
    await bridge.ready;
    expect(appended).toHaveLength(1);
    const style = appended[0];
    expect(style.attributes['data-plugin-theme']).toBe('true');
    expect(style.textContent).toContain(':root{');
    expect(style.textContent).toContain('--shop-core-ground:#fafafa;');
    expect(style.textContent).toContain('--core-ground:#fafafa;');
    expect(style.textContent).toContain('--shop-extras-primary:#111111;');
    expect(style.textContent).toContain('--extras-primary:#111111;');
    expect(documentElement.dataset.pluginThemeReady).toBe('true');
  });

  it('drops a variable that carries a hostile value and keeps the others', async () => {
    vi.useFakeTimers();
    const { documentStub, appended } = stubDocument();
    vi.stubGlobal('document', documentStub);
    const { bridge, send, welcome } = stubBridge();
    send(welcome(themePayload({
      '--shop-core-ground': 'url(https://evil.example)',
      '--x-core-y': 'red; } body { display:none',
      '--shop-core-raised': '/* comment */ #ffffff',
      '--shop-core-foreground': 'EXPRESSION(1)',
      '--background': '#ffffff',
      '--shop-core-border': '#eeeeee',
    })));
    await bridge.ready;
    const style = appended[0];
    expect(style.textContent).not.toContain('--shop-core-ground');
    expect(style.textContent).not.toContain('--core-ground');
    expect(style.textContent).not.toContain('--x-core-y');
    expect(style.textContent).not.toContain('display:none');
    expect(style.textContent).not.toContain('evil.example');
    expect(style.textContent).not.toContain('comment');
    expect(style.textContent).not.toContain('EXPRESSION');
    expect(style.textContent).not.toContain('--background');
    expect(style.textContent).toContain('--shop-core-border:#eeeeee;');
  });

  it('updates the one stylesheet when the theme of the host page changes', async () => {
    vi.useFakeTimers();
    const { documentStub, appended } = stubDocument();
    vi.stubGlobal('document', documentStub);
    const { bridge, parent, send, welcome } = stubBridge();
    send(welcome({ '--shop-core-ground': '#fafafa' }));
    await bridge.ready;
    const subscribed = bridge.subscribe(() => undefined);
    await Promise.resolve(); await Promise.resolve();
    const request = parent.postMessage.mock.calls.at(-1)![0];
    send({ ...request, result: { subscribed: true } });
    await subscribed;
    const changed = { ...request, id: 'change', type: 'context.changed', payload: {
      revision: 2, context: { ...welcome({}).payload.context, themeTokens: themePayload({ '--shop-core-ground': '#202020' }) } } };
    send(changed);
    expect(appended).toHaveLength(1);
    expect(appended[0].textContent).toContain('--shop-core-ground:#202020;');
    expect(appended[0].textContent).not.toContain('#fafafa');
  });
});
