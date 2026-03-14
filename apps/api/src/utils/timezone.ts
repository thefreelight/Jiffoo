type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type === 'literal') continue;
    values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = getZonedParts(date, timeZone);
  const zonedAsUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return zonedAsUtcMs - date.getTime();
}

function utcFromLocalMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const firstOffsetMs = getTimezoneOffsetMs(utcGuess, timeZone);
  const firstPass = new Date(utcGuess.getTime() - firstOffsetMs);
  const secondOffsetMs = getTimezoneOffsetMs(firstPass, timeZone);

  if (secondOffsetMs !== firstOffsetMs) {
    return new Date(utcGuess.getTime() - secondOffsetMs);
  }
  return firstPass;
}

export function normalizeTimezone(timeZone: string | null | undefined): string {
  if (!timeZone) return 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

export function getTodayAndYesterdayRangeUtc(
  timeZone: string,
  referenceDate: Date = new Date()
): {
  startOfTodayUtc: Date;
  startOfYesterdayUtc: Date;
} {
  const safeTimezone = normalizeTimezone(timeZone);
  const zonedNow = getZonedParts(referenceDate, safeTimezone);

  const startOfTodayUtc = utcFromLocalMidnight(
    zonedNow.year,
    zonedNow.month,
    zonedNow.day,
    safeTimezone
  );

  const yesterdayLocalDate = new Date(Date.UTC(zonedNow.year, zonedNow.month - 1, zonedNow.day - 1));
  const startOfYesterdayUtc = utcFromLocalMidnight(
    yesterdayLocalDate.getUTCFullYear(),
    yesterdayLocalDate.getUTCMonth() + 1,
    yesterdayLocalDate.getUTCDate(),
    safeTimezone
  );

  return { startOfTodayUtc, startOfYesterdayUtc };
}
