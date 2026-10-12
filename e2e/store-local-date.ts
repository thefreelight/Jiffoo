export function storeLocalDate(value: string, timeZone: string): string {
  const date = new Date(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
  // datetime-local serializes fractional seconds without trailing zeroes and omits zero seconds.
  const fraction = String(date.getUTCMilliseconds()).padStart(3, '0').replace(/0+$/, '');
  const seconds = parts.second === '00' && !fraction ? '' : `:${parts.second}${fraction ? '.' + fraction : ''}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}${seconds}`;
}
