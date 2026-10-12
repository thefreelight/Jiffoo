import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { StoreTimeProvider } from '../lib/store-time';
import { LastRecordedError } from '../components/plugins/LastRecordedError';
import { storeLocalToUtc } from 'shared';
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key }));
it('plugin error dates use the configured store zone under a different host timezone', () => {
  try {
    vi.stubEnv('TZ', 'UTC');
    const html = renderToStaticMarkup(createElement(StoreTimeProvider, { timezone: 'Asia/Shanghai', now: '2026-10-12T00:00:00Z',
      children: createElement(LastRecordedError, { lastFailureAt: '2026-10-12T00:15:00Z', lastFailureMessage: 'Recorded failure' }) }));
    expect(html).toContain('08:15'); expect(html).toContain('(Asia/Shanghai)');
  } finally { vi.unstubAllEnvs(); }
});
it('audit filter inputs are interpreted in the store zone and reject nonexistent daylight-saving times', () => {
  expect(storeLocalToUtc('2026-10-12T08:15', 'Asia/Shanghai')).toBe('2026-10-12T00:15:00.000Z');
  expect(() => storeLocalToUtc('2026-03-08T02:30', 'America/New_York')).toThrow(RangeError);
});
