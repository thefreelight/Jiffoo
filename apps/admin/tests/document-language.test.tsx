// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import RootLayout from '../app/layout';
import { DocumentLanguage } from '../components/i18n/document-language';

const state = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers({ 'x-admin-locale': state.locale }) }));
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-variable' }) }));
vi.mock('../lib/server-theme', () => ({ getAdminTheme: async () => ({ darkAvailable: true }) }));
vi.mock('../lib/preferences-provider', () => ({ PreferencesProvider: ({ children }: any) => children }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => state.locale }));
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it.each(['en', 'zh-Hans', 'zh-Hant'])('uses %s in server HTML and hydrates without a mismatch', async locale => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); state.locale = locale;
  const html = renderToStaticMarkup(await RootLayout({ children: <DocumentLanguage /> }));
  expect(html).toContain('<html lang="' + locale + '"');
  document.documentElement.lang = locale;
  const container = document.createElement('div'); document.body.append(container);
  const onRecoverableError = vi.fn();
  await act(async () => { root = hydrateRoot(container, <DocumentLanguage />, { onRecoverableError }); });
  expect(document.documentElement.lang).toBe(locale); expect(onRecoverableError).not.toHaveBeenCalled();
  state.locale = locale === 'zh-Hant' ? 'en' : 'zh-Hant';
  await act(async () => root!.render(<DocumentLanguage />));
  expect(document.documentElement.lang).toBe(state.locale); expect(onRecoverableError).not.toHaveBeenCalled();
});
