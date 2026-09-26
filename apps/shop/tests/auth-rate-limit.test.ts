import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '../lib/auth-error';
import { storefront as english } from '../../../packages/shared/src/i18n/messages/en/storefront';
import { storefront as simplified } from '../../../packages/shared/src/i18n/messages/zh-Hans/storefront';
import { storefront as traditional } from '../../../packages/shared/src/i18n/messages/zh-Hant/storefront';

describe('Shop registration rate limit', () => {
  it('maps a 429 response to a clear localized message in every storefront locale', () => {
    for (const messages of [english, simplified, traditional]) {
      const labels = messages.account;
      expect(authErrorMessage(429, 'RATE_LIMITED', labels, 'register')).toBe(labels.tooManyAttempts);
      expect(labels.tooManyAttempts).not.toBe(labels.verificationFailed);
      expect(labels.tooManyAttempts.length).toBeGreaterThan(10);
    }
  });
});
