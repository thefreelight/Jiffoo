import { expect, it } from 'vitest';
import { storeLocalToUtc, storeTimezones } from 'shared';
import { storeLocalDate } from '../../../e2e/store-local-date';

it('the helper emits canonical fractions and omits zero seconds without losing precision', () => {
  for (const [instant, canonical] of [
    ['2026-10-12T11:35:00.000Z', '2026-10-12T11:35'],
    ['2026-10-12T11:35:00.010Z', '2026-10-12T11:35:00.01'],
    ['2026-10-12T11:35:22.000Z', '2026-10-12T11:35:22'],
    ['2026-10-12T11:35:22.100Z', '2026-10-12T11:35:22.1'],
    ['2026-10-12T11:35:22.460Z', '2026-10-12T11:35:22.46'],
    ['2026-10-12T11:35:22.001Z', '2026-10-12T11:35:22.001'],
  ]) expect(storeLocalDate(instant, 'UTC')).toBe(canonical);
});

it('all millisecond values use canonical input strings and store-zone conversion preserves them exactly', () => {
  for (const zone of ['UTC', 'Asia/Shanghai', 'America/New_York', 'Asia/Kathmandu', 'Pacific/Chatham']) {
    for (let ms = 0; ms < 1000; ms++) {
      const original = new Date(Date.UTC(2026, 9, 12, 11, 35, ms % 2 === 0 ? 0 : 22, ms)).toISOString();
      const canonical = storeLocalDate(original, zone);
      if (canonical.includes('.')) expect(canonical.endsWith('0'), `${zone} ${original}`).toBe(false);
      expect(storeLocalToUtc(canonical, zone)).toBe(original);
    }
  }
}, 30_000);

it('every supported store timezone preserves representative fractions, calendar crossings and UTC boundaries', () => {
  for (const zone of storeTimezones()) {
    for (const original of ['2026-10-12T00:00:00.000Z', '2026-10-12T23:59:59.001Z', '2026-10-12T11:35:22.010Z', '2026-10-12T11:35:22.460Z']) {
      expect(storeLocalToUtc(storeLocalDate(original, zone), zone), `${zone} ${original}`).toBe(original);
    }
  }
}, 30_000);

it('DST gaps are rejected and repeated wall times have the existing deterministic resolution', () => {
  expect(() => storeLocalToUtc('2026-03-08T02:30:00.46', 'America/New_York')).toThrow(RangeError);
  expect(storeLocalToUtc('2026-11-01T01:30:00.46', 'America/New_York')).toBe('2026-11-01T05:30:00.460Z');
  expect(storeLocalToUtc('2026-10-25T02:30:00.001', 'Europe/Berlin')).toBe('2026-10-25T01:30:00.001Z');
  expect(storeLocalToUtc('2024-02-29T00:00:00.01', 'Asia/Kathmandu')).toBe('2024-02-28T18:15:00.010Z');
});
