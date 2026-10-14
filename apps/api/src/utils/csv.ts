import { Readable } from 'node:stream';
import { formatStoreTimestamp } from 'shared';

export function csvCell(value: unknown): string {
  let cell = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = "'" + cell;
  return /[",\r\n]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell;
}
export function csvRow(values: unknown[]): string { return values.map(csvCell).join(',') + '\r\n'; }
export function csvTimestamp(value: Date | null, timezone: string): string {
  return value ? formatStoreTimestamp(value, timezone) + ':' + String(value.getUTCSeconds()).padStart(2, '0') : '';
}
export function csvFilename(prefix: string, timezone: string): string {
  return prefix + '-' + formatStoreTimestamp(new Date(), timezone).replace(/[-:]/g, '').replace(' ', '-') + '.csv';
}
export function csvStream(rows: AsyncIterable<string>) { return Readable.from(rows); }
