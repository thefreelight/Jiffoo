// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiErrorCodes } from 'shared';
import { AdminApiError } from '../../lib/api';
import { resolveApiErrorMessage } from '../../lib/error-utils';
import { marketplaceErrorKey } from '../../lib/marketplace';
import { pluginUploadErrorKey } from '../../lib/plugin-upload';
import { common as en } from '../../../../packages/shared/src/i18n/messages/en/common';
import { common as hans } from '../../../../packages/shared/src/i18n/messages/zh-Hans/common';
import { common as hant } from '../../../../packages/shared/src/i18n/messages/zh-Hant/common';
import { merchant as enMerchant } from '../../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hansMerchant } from '../../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hantMerchant } from '../../../../packages/shared/src/i18n/messages/zh-Hant/merchant';

describe('Typed localized client error contracts', () => {
  it.each([en, hans, hant])('v2 payment errors preserve their approved localized messages in locale %#', common => {
    const translate = (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], { common }) as string;
    for (const [code, expected] of [
      [ApiErrorCodes.PAYMENT_OUTCOME_UNKNOWN, common.errors.paymentOutcomeUnknown],
      [ApiErrorCodes.PAYMENT_REQUIRES_REVIEW, common.errors.paymentRequiresReview],
      [ApiErrorCodes.PAYMENT_SESSION_STILL_CHARGEABLE, common.errors.paymentSessionStillChargeable],
    ]) expect(resolveApiErrorMessage(new AdminApiError('PRIVATE_PSP_DETAIL', code, undefined, 409), translate)).toBe(expected);
  });
  it.each([
    [ApiErrorCodes.PLUGIN_DATABASE_BUSY, 503, 'Plugin database is busy. Try again shortly.'],
    [ApiErrorCodes.PLUGIN_DATABASE_OUTCOME_UNKNOWN, 502, 'Plugin database commit outcome is unknown. Do not retry automatically.'],
  ] as const)('J database code %s retains its specific safe client message', (code, status, expected) => {
    expect(resolveApiErrorMessage(new AdminApiError('PRIVATE_DATABASE_DETAIL', code, undefined, status), key => key)).toBe(expected);
  });
  it.each([[en, enMerchant], [hans, hansMerchant], [hant, hantMerchant]])('A4 unmatched Core codes never expose server text and use localized status classes in locale %#', (common, merchant) => {
    const translate = (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], { common, merchant }) as string;
    for (const [status, expected] of [[409, common.errors.requestCouldNotBeCompleted], [503, common.errors.temporarilyUnavailable], [502, common.errors.serverError], [500, common.errors.serverError]] as const) {
      const error = new AdminApiError('PRIVATE_SQL raw English server text', ApiErrorCodes.QUOTE_CHANGED, undefined, status);
      expect(resolveApiErrorMessage(error, translate)).toBe(expected);
    }
    expect(pluginUploadErrorKey({ code: ApiErrorCodes.UNKNOWN_MANIFEST_FIELD })).toBe('unknownManifestField');
    expect(merchant.plugins.upload.unknownManifestField.trim()).not.toBe('');
    expect(marketplaceErrorKey({ code: ApiErrorCodes.MARKETPLACE_NOT_CONFIGURED, status: 503 })).toBe('notConfigured');
    for (const code of [ApiErrorCodes.DATABASE_UNAVAILABLE, ApiErrorCodes.SHARED_PROTECTION_UNAVAILABLE]) {
      expect(marketplaceErrorKey({ code, status: 503 })).toBe('unavailable');
    }
  });
  it('A5 validated plugin business text renders as text rather than HTML', () => {
    const error = new AdminApiError('<b>Payment was declined.</b>', ApiErrorCodes.BAD_REQUEST, undefined, 409, 'plugin-business');
    const message = resolveApiErrorMessage(error, key => key);
    expect(renderToStaticMarkup(createElement('p', null, message))).toBe('<p>&lt;b&gt;Payment was declined.&lt;/b&gt;</p>');
  });
});
