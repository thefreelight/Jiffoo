'use client';

import { useT } from 'shared/src/i18n/react';
import { cn } from '@/lib/utils';

export interface PluginTrustData {
  publisherId?: string | null;
  source?: string; trustLevel?: string | null; signingRoot?: 'official' | 'test' | null;
}
export function pluginTrustKey(plugin: PluginTrustData, testSigningMode: boolean): string {
  if (plugin.trustLevel === 'builtin' || plugin.source === 'builtin') return 'builtin';
  if (plugin.trustLevel !== 'signed') return 'unsigned';
  if (plugin.signingRoot === null || plugin.signingRoot === undefined) return 'reinstallRequired';
  if (plugin.signingRoot === 'test') return testSigningMode ? 'testSigned' : 'testSigningDisabled';
  return 'verified';
}
export function PluginTrustLabel({ plugin, testSigningMode, compact = false, className }: { plugin: PluginTrustData; testSigningMode: boolean; compact?: boolean; className?: string }) {
  const t = useT();
  const key = pluginTrustKey(plugin, testSigningMode);
  if (compact) return <span className={cn(`inline-flex h-[18px] items-center rounded-md border px-1.5 text-[11px] leading-none ${key === 'unsigned' || key === 'testSigningDisabled' || key === 'reinstallRequired' ? 'border-attention-line text-attention' : 'border-border text-muted-foreground'}`, className)}>{t(`merchant.plugins.marketplace.trust.${key}`)}</span>;
  return <div className="text-[13px]"><span className="font-medium">{t(`merchant.plugins.marketplace.trust.${key}`)}</span>{plugin.publisherId && <span> · {t('merchant.plugins.marketplace.publisher')} {plugin.publisherId}</span>}
    <p className="text-xs text-faint">{t(`merchant.plugins.marketplace.trust.${key}Explanation`)}</p></div>;
}
