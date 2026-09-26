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
      expect(authErrorMessage(401, 'LOGIN_FAILED', labels, 'login')).toBe(labels.invalidLogin);
      expect(authErrorMessage(403, 'ACCOUNT_INACTIVE', labels, 'login')).toBe(labels.accountInactive);
      expect(labels.tooManyAttempts).not.toBe(labels.verificationFailed);
      expect(labels.tooManyAttempts.length).toBeGreaterThan(10);
    }
  });
  it('I maps unknown auth failures to a generic message and preserves the rate-limit message', () => {
    for (const messages of [english, simplified, traditional]) {
      const labels = messages.account;
      for (const mode of ['login', 'register', 'verify-email', 'reset-password'])
        expect(authErrorMessage(500, 'UNKNOWN_ERROR', labels, mode)).toBe(labels.genericError);
      expect(authErrorMessage(401, 'UNKNOWN_ERROR', labels, 'login')).toBe(labels.genericError);
      expect(authErrorMessage(429, 'RATE_LIMITED', labels, 'register')).toBe(labels.tooManyAttempts);
      expect(labels.genericError).not.toBe(labels.verificationFailed);
    }
  });
});
