'use client';
import { useStoreDate } from '@/lib/store-time';
import { useT } from 'shared/src/i18n/react';

export function LastRecordedError({ lastFailureAt, lastFailureMessage }: { lastFailureAt?: string | null; lastFailureMessage?: string | null }) {
  const { date: storeDate } = useStoreDate();
  const t = useT();
  if (!lastFailureAt || !lastFailureMessage) return null;
  const label = t('merchant.plugins.lastRecordedError.label');
  return <section role="group" aria-label={label} className="space-y-2 rounded-lg border border-cool-soft p-3 text-sm text-muted-foreground">
    <p className="font-semibold">{label}</p>
    <time dateTime={lastFailureAt}>{storeDate(lastFailureAt)}</time>
    <p className="whitespace-pre-wrap break-words">{lastFailureMessage}</p>
    <p>{t('merchant.plugins.lastRecordedError.historical')}</p>
  </section>;
}
