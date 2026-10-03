'use client';
import { useLocale, useT } from 'shared/src/i18n/react';

export function LastRecordedError({ lastFailureAt, lastFailureMessage }: { lastFailureAt?: string | null; lastFailureMessage?: string | null }) {
  const locale = useLocale(), t = useT();
  if (!lastFailureAt || !lastFailureMessage) return null;
  const label = t('merchant.plugins.lastRecordedError.label');
  return <section role="group" aria-label={label} className="space-y-2 rounded-lg border border-cool-soft p-3 text-sm text-muted-foreground">
    <p className="font-semibold">{label}</p>
    <time dateTime={lastFailureAt}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastFailureAt))}</time>
    <p className="whitespace-pre-wrap break-words">{lastFailureMessage}</p>
    <p>{t('merchant.plugins.lastRecordedError.historical')}</p>
  </section>;
}
