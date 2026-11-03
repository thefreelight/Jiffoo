import type { PluginRecoveryList } from './plugin-upload';

export function isPluginPaused(slug: string, packageUnavailable: boolean, recovery?: PluginRecoveryList): boolean {
  return packageUnavailable || Boolean(recovery?.items.some(item => item.slug === slug &&
    item.operations.some(operation =>
      ['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'].includes(operation.phase))));
}
