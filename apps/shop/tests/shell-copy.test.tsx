import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LOCALES, getMessages, type Locale } from 'shared/src/i18n';
import { I18nProvider, useT } from 'shared/src/i18n/react';
import { SkipToMain } from '@/components/skip-to-main';
import { OfflineDetector } from '@/components/offline-detector';

// Shell chrome on every storefront page: the skip link sits in the page for
// keyboard and screen-reader users, the notice appears when the network drops.
// Both were English on every storefront.
const KEYS = ['common.shell.skipToMain', 'common.shell.offline', 'common.shell.backOnline', 'common.shell.dismissNotice'];

function withLocale(locale: Locale, children: ReactNode) {
  return <I18nProvider locale={locale} messages={getMessages(locale, 'shop')}>{children}</I18nProvider>;
}

function translate(locale: Locale) {
  const wrapper = ({ children }: { children: ReactNode }) => withLocale(locale, children);
  return renderHook(() => useT(), { wrapper }).result.current!;
}

function go(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

afterEach(() => go(true));

describe('shell chrome copy', () => {
  it.each(LOCALES)('%s: every string is written in the catalog', (locale) => {
    const t = translate(locale);
    for (const key of KEYS) {
      expect(t(key), key).not.toBe(key);
      expect(t(key).trim(), key).not.toBe('');
    }
  });

  it('speaks the storefront’s language: skip link, offline notice and its close button', () => {
    go(false);
    const view = render(withLocale('zh-Hans', <><SkipToMain /><OfflineDetector /></>));
    expect(screen.getByText('跳到主要内容')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toContain('你当前处于离线状态');
    expect(screen.getByRole('button', { name: '关闭提示' })).toBeInTheDocument();
    view.unmount();
  });

  it('says so when the network is back', async () => {
    go(false);
    const view = render(withLocale('zh-Hant', <OfflineDetector />));
    go(true);
    expect((await screen.findByRole('alert')).textContent).toContain('網路已恢復');
    view.unmount();
  });

  it('keeps English where no storefront language is known, and a caller’s own message wins', () => {
    go(false);
    const bare = render(<SkipToMain />);
    expect(bare.getByText('Skip to main content')).toBeInTheDocument();
    bare.unmount();
    const custom = render(withLocale('zh-Hans', <OfflineDetector offlineMessage=" propia " />));
    expect(screen.getByRole('alert').textContent).toContain('propia');
    custom.unmount();
  });
});
