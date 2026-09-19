import { describe, expect, it } from 'vitest';
import { deriveTrustLevel } from '@/core/admin/extension-installer/trust-level';
import type { SignatureVerifyResult } from '@/core/admin/extension-installer/signature-verifier';

describe('Plugin trust levels', () => {
  it('preserves builtin packages regardless of signature metadata', () => {
    expect(deriveTrustLevel('builtin', null, 'unsigned')).toBe('builtin');
    expect(deriveTrustLevel('local-zip', null, 'builtin')).toBe('builtin');
  });

  it('derives signed and unsigned accountability without changing runtime rights', () => {
    const signed: SignatureVerifyResult = { verified: true, mode: 'optional' };
    const unsigned: SignatureVerifyResult = { verified: false, mode: 'optional' };

    expect(deriveTrustLevel('local-zip', signed, 'unsigned')).toBe('signed');
    expect(deriveTrustLevel('local-zip', unsigned, 'signed')).toBe('unsigned');
  });
});
