import type { PluginTrustLevel } from '@jiffoo/shared';

export function deriveTrustLevel(
  source: string | undefined | null,
  manifestTrustLevel?: PluginTrustLevel,
): PluginTrustLevel {
  if (source === 'builtin' || manifestTrustLevel === 'builtin') {
    return 'builtin';
  }

  return 'unsigned';
}
