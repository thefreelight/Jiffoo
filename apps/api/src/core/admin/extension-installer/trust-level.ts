import type { PluginTrustLevel } from '@jiffoo/shared';

export function deriveTrustLevel(
  source: string | undefined | null,
): PluginTrustLevel {
  if (source === 'builtin') {
    return 'builtin';
  }

  return 'unsigned';
}
