import { describe, expect, it } from 'vitest';
import { deriveTrustLevel } from '@/core/admin/extension-installer/trust-level';
import type { SignatureVerifyResult } from '@/core/admin/extension-installer/signature-verifier';

describe('Trust level installation contract', () => {
  it('keeps third-party in-process packages within the sole runtime model', () => {
    const signature: SignatureVerifyResult = {
      verified: false,
      mode: 'optional',
      error: 'No signature file provided',
    };

    expect(deriveTrustLevel('local-zip', signature, 'unsigned')).toBe('unsigned');
  });
});
