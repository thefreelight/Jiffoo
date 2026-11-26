import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { LOCALES, getMessages, type Locale } from 'shared/src/i18n';
import { I18nProvider, useT } from 'shared/src/i18n/react';

// Every key the storefront auth routes read on the way to a verified email.
// None of them had catalog copy, so the routes fell back to English on every
// storefront.
const KEYS = [
  'common.errors.loginUnavailable',
  'common.errors.rateLimited',
  'shop.auth.verifyTitle',
  'shop.auth.verifyMessage',
  'shop.auth.register.verifyTitle',
  'shop.auth.register.verifyMessage',
  ...[
    'eyebrow', 'codeTitle', 'codePrompt', 'codeLabel', 'submitCode', 'resend', 'resending', 'resent',
    'resendFailed', 'emailUnavailable', 'codeRejected', 'loadingTitle', 'loadingMessage', 'successTitle',
    'successMessage', 'failedTitle', 'failedMessage', 'missingToken', 'goToLogin',
  ].map((name) => `shop.auth.verifyEmail.${name}`),
];

const CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

function translate(locale: Locale) {
  const messages = getMessages(locale, 'shop');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale={locale} messages={messages}>{children}</I18nProvider>
  );
  const { result } = renderHook(() => useT(), { wrapper });
  return result.current!;
}

describe('verification copy', () => {
  it.each(LOCALES)('%s: every key resolves to catalog copy', (locale) => {
    const t = translate(locale);
    for (const key of KEYS) {
      expect(t(key), key).not.toBe(key);
      expect(t(key).trim(), key).not.toBe('');
    }
  });

  it.each(LOCALES)('%s: the address is interpolated where the copy shows it', (locale) => {
    const t = translate(locale);
    for (const key of ['shop.auth.verifyEmail.codePrompt', 'shop.auth.verifyEmail.resent']) {
      const text = t(key, { email: 'player@example.com' });
      expect(text, key).toContain('player@example.com');
      expect(text, key).not.toContain('{email}');
    }
  });

  it('is written in each locale’s own script', () => {
    const asian = LOCALES.filter((locale) => locale !== 'en' && locale !== 'fr' && locale !== 'de');
    for (const locale of asian) {
      const t = translate(locale);
      for (const key of KEYS) expect(t(key), `${locale} ${key}`).toMatch(CJK);
    }
    for (const locale of ['fr', 'de'] as const) {
      const t = translate(locale);
      for (const key of KEYS) expect(t(key), `${locale} ${key}`).not.toMatch(CJK);
    }
  });
});
