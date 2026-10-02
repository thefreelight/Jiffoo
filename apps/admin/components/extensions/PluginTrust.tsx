'use client';

import { useT } from 'shared/src/i18n/react';
import { useMarketplaceStatus } from '@/lib/marketplace';

export interface PluginTrustData {
  source?: string; trustLevel?: string | null; signingRoot?: 'official' | 'test' | null;
}
export function pluginTrustKey(plugin: PluginTrustData, testSigningMode: boolean): string {
  if (plugin.trustLevel === 'builtin' || plugin.source === 'builtin') return 'builtin';
  if (plugin.trustLevel !== 'signed') return 'unsigned';
  if (plugin.signingRoot === null || plugin.signingRoot === undefined) return 'reinstallRequired';
  if (plugin.signingRoot === 'test') return testSigningMode ? 'testSigned' : 'testSigningDisabled';
  return 'verified';
}
export function PluginTrustLabel({ plugin, testSigningMode }: { plugin: PluginTrustData; testSigningMode: boolean }) {
  const t = useT();
  const key = pluginTrustKey(plugin, testSigningMode);
  return <div className="text-sm"><span className="font-medium">{t(`merchant.plugins.marketplace.trust.${key}`)}</span>
    <p className="text-cool-base">{t(`merchant.plugins.marketplace.trust.${key}Explanation`)}</p></div>;
}
export function PluginTrust({ plugin }: { plugin: PluginTrustData }) {
  const status = useMarketplaceStatus();
  if (!status.data) return null;
  return <PluginTrustLabel plugin={plugin} testSigningMode={status.data.testSigningMode} />;
}
