const supportedZones = () => (Intl as typeof Intl & { supportedValuesOf(key: 'timeZone'): string[] }).supportedValuesOf('timeZone');

export function isStoreTimezone(value: unknown): value is string {
  return typeof value === 'string' && (value === 'UTC' || supportedZones().includes(value));
}

export function storeTimezones(): string[] { return ['UTC', ...supportedZones()]; }

export function storeLocalToUtc(value: string, timeZone: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match) throw new RangeError('Invalid store date');
  const [, year, month, day, hour, minute, second = '0', fraction = '0'] = match;
  const wall = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const parts = (instant: number) => {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour, +values.minute, +values.second);
  };
  let instant = wall;
  for (let attempt = 0; attempt < 3; attempt++) instant = wall - (parts(instant) - instant);
  if (parts(instant) !== wall) throw new RangeError('Store date does not exist in this timezone');
  return new Date(instant + Number(fraction.padEnd(3, '0'))).toISOString();
}

export function formatStoreDate(value: string | Date, locale: string, timeZone?: string | null, dateOnly = false): string {
  const selectedZone = timeZone?.trim() || 'UTC';
  const date = new Date(value);
  // Keep one zone label, with a numeric offset to distinguish repeated DST hours.
  const offset = dateOnly || selectedZone === 'UTC' ? '' : new Intl.DateTimeFormat('en', { timeZone: selectedZone, timeZoneName: 'longOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')!.value.replace(/^GMT/, '');
  return new Intl.DateTimeFormat(locale, {
    timeZone: selectedZone, year: 'numeric', month: 'short', day: 'numeric',
    ...(!dateOnly ? { hour: '2-digit' as const, minute: '2-digit' as const, hourCycle: 'h23' as const } : {}),
  }).format(date) + ` (${selectedZone}${offset ? ` ${offset}` : ''})`;
}

/** Absolute order-list time; the column header supplies the store timezone. */
export function formatStoreTimestamp(value: string | Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
