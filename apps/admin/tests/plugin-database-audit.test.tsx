// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { PluginDatabaseAudit } from '@/components/extensions/PluginDatabaseAudit';
import { pluginUploadApi, type PluginDatabaseAuditSummary } from '@/lib/plugin-upload';
import { apiClient } from '@/lib/api';

let dictionary: typeof en | typeof hans | typeof hant = en;
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => { const copy = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], dictionary) ?? key; return typeof copy === 'string' ? copy.replace(/\{(\w+)\}/g, (_: string, name: string) => String(values?.[name] ?? `{${name}}`)) : key; } }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), apiClient: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());
function render(data?: PluginDatabaseAuditSummary) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (data) client.setQueryData(['plugin-database-audit'], data);
  try { return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(PluginDatabaseAudit))); }
  finally { client.clear(); }
}
const latest = { reportVersion: 1 as const, startedAt: '2026-10-10T00:00:00.000Z', finishedAt: '2026-10-10T00:00:01.000Z', complete: true, counts: { plugins: 4, blocking: 2, warning: 1 }, processQuiescence: { proven: false as const, authority: 'caller' as const } };
it.each([en, hans, hant])('J latest audit shows scan time and stopped-system limitation in locale %#', locale => {
  dictionary = locale;
  const html = render({ latest });
  expect(html).toContain(locale.plugins.databaseAudit.notice);
  expect(html).toContain(`<time dateTime="${latest.finishedAt}">`);
  expect(html).toContain('2026-10-10 00:00');
  for (const [key, count] of [['installed', 4], ['blocking', 2], ['warnings', 1]] as const) { expect(html).toContain(locale.healthView[key]); expect(html).toContain(`>${count}</dd>`); }
  expect(html).not.toContain(locale.healthView.incomplete);
  expect(Object.keys(locale.plugins.databaseAudit).sort()).toEqual(Object.keys(en.plugins.databaseAudit).sort());
  for (const copy of Object.values(locale.plugins.databaseAudit)) expect(copy.trim()).not.toBe('');
});
it('J missing and incomplete audit summaries never imply upgrade clearance', () => {
  dictionary = en;
  expect(render({ latest: null })).toContain(en.healthView.notScanned);
  expect(render({ latest: { ...latest, complete: false } })).toContain(en.healthView.incomplete);
  expect(render()).toContain(en.healthView.scanning);
});
it('J summary reads are separate from explicit scan requests', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ success: true, data: { latest } });
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: { latest } });
  expect(await pluginUploadApi.auditSummary()).toEqual({ latest });
  expect(get).toHaveBeenCalledExactlyOnceWith('/extensions/plugin/database-audit'); expect(post).not.toHaveBeenCalled();
  expect(await pluginUploadApi.audit()).toEqual({ latest }); expect(post).toHaveBeenCalledExactlyOnceWith('/extensions/plugin/database-audit');
});
