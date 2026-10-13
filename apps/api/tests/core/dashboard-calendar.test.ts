import { expect, it } from 'vitest';
import { getStoreCalendarDays, getTodayAndYesterdayRangeUtc } from '@/utils/timezone';

it.each([
  ['2026-03-08T18:00:00Z', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 23],
  ['2026-11-01T18:00:00Z', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 25],
])('keeps calendar midnights across New York DST: %s', (reference, today, tomorrow, hours) => {
  const range = getStoreCalendarDays('America/New_York', 14, new Date(reference));
  expect(range.days).toHaveLength(14);
  expect(range.days[13].startUtc.toISOString()).toBe(today);
  expect(range.endUtc.toISOString()).toBe(tomorrow);
  expect((range.endUtc.getTime() - range.days[13].startUtc.getTime()) / 3_600_000).toBe(hours);
  expect(getTodayAndYesterdayRangeUtc('America/New_York', new Date(reference)).startOfTodayUtc).toEqual(range.days[13].startUtc);
});
it('uses true UTC midnight instead of interpreting midnight as 24:00', () => {
  const range = getStoreCalendarDays('UTC', 14, new Date('2026-10-13T12:00:00Z'));
  expect(range.days[0]).toEqual({ date: '2026-09-30', startUtc: new Date('2026-09-30T00:00:00Z') });
  expect(range.endUtc).toEqual(new Date('2026-10-14T00:00:00Z'));
});
