import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { StoreTimeProvider } from '../lib/store-time';
import { LastRecordedError } from '../components/plugins/LastRecordedError';
import { formatStoreDate, formatStoreTimestamp, storeLocalToUtc } from 'shared';
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key }));
it('plugin error dates use the configured store zone under a different host timezone', () => {
  try {
    vi.stubEnv('TZ', 'UTC');
    const html = renderToStaticMarkup(createElement(StoreTimeProvider, { timezone: 'Asia/Shanghai', now: '2026-10-12T00:00:00Z',
      children: createElement(LastRecordedError, { lastFailureAt: '2026-10-12T00:15:00Z', lastFailureMessage: 'Recorded failure' }) }));
    expect(html).toContain('08:15'); expect(html).toContain('(Asia/Shanghai +08:00)');
  } finally { vi.unstubAllEnvs(); }
});
it('an unset store timezone uses UTC independently of the client timezone', () => {
  try {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    for (const timezone of [undefined, null, '', '   ']) {
      const html = renderToStaticMarkup(createElement(StoreTimeProvider, { timezone, now: '2026-10-12T00:00:00Z',
        children: createElement(LastRecordedError, { lastFailureAt: '2026-10-12T00:15:00Z', lastFailureMessage: 'Recorded failure' }) }));
      expect(html).toContain('(UTC)'); expect(html).toContain('00:15');
      expect(formatStoreDate('2026-10-12T00:15:00Z', 'en', timezone)).toContain('(UTC)');
    }
  } finally { vi.unstubAllEnvs(); }
});
it('audit filter inputs are interpreted in the store zone and reject nonexistent daylight-saving times', () => {
  expect(storeLocalToUtc('2026-10-12T08:15', 'Asia/Shanghai')).toBe('2026-10-12T00:15:00.000Z');
  expect(() => storeLocalToUtc('2026-03-08T02:30', 'America/New_York')).toThrow(RangeError);
});
it.each(['en', 'zh-Hans', 'zh-Hant'])('prints the store zone exactly once in %s', locale => {
  const utc = formatStoreDate('2026-10-12T00:15:00Z', locale, 'UTC');
  expect(utc.match(/UTC/g)).toHaveLength(1);
  const shanghai = formatStoreDate('2026-10-12T00:15:00Z', locale, 'Asia/Shanghai');
  expect(shanghai.match(/Asia\/Shanghai/g)).toHaveLength(1);
  expect(shanghai).not.toMatch(/GMT/);
  expect(formatStoreTimestamp('2026-10-12T00:15:00Z', 'Asia/Shanghai')).toBe('2026-10-12 08:15');
  expect(formatStoreTimestamp('2026-10-12T00:15:00Z', 'UTC')).toBe('2026-10-12 00:15');
});
