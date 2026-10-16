'use client';
import { useStoreDate } from '@/lib/store-time';
import { useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';

export function LastRecordedError({ lastFailureAt, lastFailureMessage }: { lastFailureAt?: string | null; lastFailureMessage?: string | null }) {
  const { timezone } = useStoreDate();
  const t = useT();
  if (!lastFailureAt || !lastFailureMessage) return null;
  const label = t('merchant.plugins.lastRecordedError.label');
  return <section role="group" aria-label={label} className="overflow-hidden rounded-lg border border-border">
    <h2 className="border-b border-border px-4 py-3 font-semibold">{label}</h2>
    <div className="space-y-1.5 px-4 py-3"><p className="whitespace-pre-wrap break-all font-mono text-xs">{lastFailureMessage}</p>
    <p className="text-xs text-faint"><time dateTime={lastFailureAt}>{formatStoreTimestamp(lastFailureAt, timezone)}</time> · {t('merchant.plugins.lastRecordedError.historical')}</p></div>
  </section>;
}
