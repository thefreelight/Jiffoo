// @vitest-environment jsdom
import { act, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { COLOR_MODE_COOKIE, SIDEBAR_COOKIE, parseColorMode, preferenceCookie } from '../lib/preferences';
import { usePreferences } from '../lib/preferences-provider';
const fixture = vi.hoisted(() => ({ mode: 'system', sidebar: '0', dark: true, locale: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => ({ value: name === 'jiffoo_admin_color_mode' ? fixture.mode : fixture.sidebar }) }),
  headers: async () => new Headers(fixture.locale ? { 'x-admin-locale': fixture.locale } : {}),
}));
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'test-font' }) }));
vi.mock('../lib/server-theme', () => ({ getAdminTheme: async () => ({ darkAvailable: fixture.dark }) }));
import RootLayout from '../app/layout';
let hydrated: Root | undefined;
function Probe() {
  const { mode, collapsed, setMode } = usePreferences();
  return <><output>{mode}:{String(collapsed)}</output><button onClick={() => setMode('dark')}>Dark</button></>;
}
afterEach(async () => { if (hydrated) await act(async () => hydrated!.unmount()); hydrated = undefined; fixture.locale = ''; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('uses a supported request locale and falls back to English for an unsupported locale', async () => {
  for (const [locale, expected] of [['zh-Hans', 'zh-Hans'], ['unsupported', 'en']]) {
    fixture.locale = locale;
    expect(renderToString(await RootLayout({ children: <Probe /> }))).toContain('<html lang="' + expected + '"');
  }
});
it.each(['system', 'light', 'dark', 'invalid'])('hydrates the server cookie state identically for %s', async value => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.mode = value; fixture.sidebar = '1'; fixture.dark = true;
  const tree = await RootLayout({ children: <Probe /> });
  const html = renderToString(tree);
  expect(html).toContain('data-color-mode="' + parseColorMode(value) + '"');
  const body = tree.props.children;
  const provider = body.props.children;
  const container = document.createElement('div'); document.body.append(container);
  const server = renderToString(provider); container.innerHTML = server;
  const errors: unknown[] = [];
  await act(async () => { hydrated = hydrateRoot(container, provider, { onRecoverableError: error => errors.push(error) }); });
  expect(container.innerHTML).toBe(server);
  expect(container.querySelector('output')?.textContent).toBe(parseColorMode(value) + ':true');
  expect(errors).toEqual([]);
});
it('a remembered dark preference cannot force a theme without dark values into dark appearance', async () => {
  fixture.mode = 'dark'; fixture.sidebar = 'bad'; fixture.dark = false;
  const tree = await RootLayout({ children: <Probe /> });
  expect(renderToString(tree)).toContain('data-color-mode="light"');
  expect(renderToString(tree)).toContain('data-admin-dark-available="false"');
});
it('limits preference persistence to named host cookies with safe attributes', () => {
  expect(preferenceCookie(COLOR_MODE_COOKIE, 'dark', true)).toBe('jiffoo_admin_color_mode=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
  expect(preferenceCookie(SIDEBAR_COOKIE, '1', false)).not.toContain('Domain=');
});

it('a theme refresh retains page state while updating dark availability', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  fixture.mode = 'system'; fixture.sidebar = '0'; fixture.dark = true;
  function Tabs() { const [tab, setTab] = useState('Shop'); return <button onClick={() => setTab('Admin')}>{tab}</button>; }
  const container = document.createElement('div'); document.body.append(container);
  hydrated = createRoot(container);
  let tree = await RootLayout({ children: <Tabs /> });
  await act(async () => hydrated!.render(tree.props.children.props.children));
  await act(async () => container.querySelector('button')!.click());
  expect(container.textContent).toBe('Admin');
  fixture.dark = false; tree = await RootLayout({ children: <Tabs /> });
  await act(async () => hydrated!.render(tree.props.children.props.children));
  expect(container.textContent).toBe('Admin');
});
