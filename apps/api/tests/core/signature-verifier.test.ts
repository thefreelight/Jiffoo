import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isOfficialMarketOnly: vi.fn(),
}));

vi.mock('@/core/admin/extension-installer/official-only', () => ({
  isOfficialMarketOnly: mocks.isOfficialMarketOnly,
}));

import { getSignatureVerifyMode } from '../../src/core/admin/extension-installer/signature-verifier';

describe('signature verifier mode selection', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.isOfficialMarketOnly.mockReset();
    mocks.isOfficialMarketOnly.mockReturnValue(false);
  });

  it('respects explicit optional mode even in official-market-only environments', () => {
    mocks.isOfficialMarketOnly.mockReturnValue(true);
    vi.stubEnv('EXTENSION_SIGNATURE_VERIFY', 'optional');

    expect(getSignatureVerifyMode()).toBe('optional');
  });

  it('falls back to required only when official-market-only mode is active and env is invalid', () => {
    mocks.isOfficialMarketOnly.mockReturnValue(true);
    vi.stubEnv('EXTENSION_SIGNATURE_VERIFY', 'broken');

    expect(getSignatureVerifyMode()).toBe('required');
  });
});
