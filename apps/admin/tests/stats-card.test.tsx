import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { StatsCard } from '../components/dashboard/stats-card';
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key }));
it('omits invented trends, decorative status chips and comparisons without data', () => {
  const html = renderToStaticMarkup(<StatsCard title="Orders" value="0" icon={<span>Orders</span>} />);
  expect(html).not.toMatch(/Awaiting|Stable|Active|vs last month|height:18px/);
  expect(html).toContain('Orders'); expect(html).toContain('>0<');
});
