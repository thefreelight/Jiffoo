import type { PluginTrustLevel } from '@jiffoo/shared';
import type { SignatureVerifyResult } from './signature-verifier';

/** Trust describes publisher accountability, not execution rights. */
export function deriveTrustLevel(
  source: string | undefined | null,
  signatureResult?: SignatureVerifyResult | null,
  manifestTrustLevel?: PluginTrustLevel,
): PluginTrustLevel {
  if (source === 'builtin' || manifestTrustLevel === 'builtin') {
    return 'builtin';
  }

  return signatureResult?.verified ? 'signed' : 'unsigned';
}
