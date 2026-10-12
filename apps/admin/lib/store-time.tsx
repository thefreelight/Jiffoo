'use client';
import { createContext, useContext, useState } from 'react';
import { useLocale } from 'shared/src/i18n/react';
import { formatStoreDate } from 'shared';

const StoreTime = createContext({ timezone: 'UTC', now: '1970-01-01T00:00:00Z', setTimezone: (_value: string) => {} });
export function StoreTimeProvider({ timezone, now, children }: { timezone?: string | null; now: string; children: React.ReactNode }) {
  const [selected, setTimezone] = useState(timezone?.trim() || 'UTC');
  return <StoreTime.Provider value={{ timezone: selected, now, setTimezone }}>{children}</StoreTime.Provider>;
}
export function useStoreDate() {
  const context = useContext(StoreTime), locale = useLocale();
  return { ...context, date: (value: string | Date, dateOnly = false) => formatStoreDate(value, locale, context.timezone, dateOnly) };
}
