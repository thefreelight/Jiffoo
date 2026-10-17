// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import HealthMonitoringPage from '@/app/[locale]/(themed)/system/health/page';
import { StoreTimeProvider } from '@/lib/store-time';
import { pluginUploadApi } from '@/lib/plugin-upload';

const mock = vi.hoisted(() => ({ data: { version: '1.2.3', gitSha: 'abcdef0123456789', status: 'healthy', uptime: 90061, database: { status: 'ok' }, redis: { status: 'ok' }, pluginRuntime: { status: 'ok', loaded: 5 }, worker: { running: true, instances: 2, lastBeatAt: '2026-10-13T00:12:00Z' as string | null } }, loading: false, error: null as Error | null, refetch: vi.fn() }));
vi.mock('shared/src/i18n/react', async () => { const { translate } = await import('./helpers/operations'); return { useLocale: () => 'en', useT: () => translate }; });
vi.mock('@/lib/hooks/use-api', () => ({ useHealthSummary: () => ({ data: mock.loading || mock.error ? undefined : mock.data, isLoading: mock.loading, error: mock.error, refetch: mock.refetch }) }));
vi.mock('@/lib/plugin-upload', () => ({ pluginUploadApi: { auditSummary: async () => ({ latest: null }), audit: vi.fn() } }));
let container: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; mock.data.database.status = 'ok'; mock.data.redis.status = 'ok'; mock.data.worker.running = true; mock.data.worker.lastBeatAt = '2026-10-13T00:12:00Z'; mock.loading = false; mock.error = null; client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
async function render() { await act(async () => root.render(<QueryClientProvider client={client}><StoreTimeProvider timezone="Asia/Shanghai" now="2026-10-13T00:00:00Z"><HealthMonitoringPage /></StoreTimeProvider></QueryClientProvider>)); }
it('shows real service counts, short release commit, exact store-zone heartbeat and database check', async () => { await render(); expect(container.textContent).toContain('1.2.3 · abcdef0'); expect(container.textContent).toContain('2 running'); expect(container.textContent).toContain('2026-10-13 08:12'); expect(container.textContent).toContain('Asia/Shanghai'); expect(container.textContent).toContain('5 plugins loaded'); expect(container.textContent).toContain('Plugin database check'); expect(container.textContent).toContain('1 days 1 hours 1 minutes'); });
it('shows a stopped worker with its recorded heartbeat', async () => { mock.data.worker.running = false; await render(); expect(container.textContent).toContain('Some features are affected'); expect(container.textContent).toContain('2026-10-13 08:12'); });
it('shows neutral copy when no heartbeat exists', async () => { mock.data.worker.running = false; mock.data.worker.lastBeatAt = null; await render(); expect(container.textContent).toContain('No heartbeat recorded'); });
it.each(['redis', 'database'] as const)('shows %s failure without claiming that all services work', async key => { mock.data[key].status = 'error'; await render(); expect(container.textContent).toContain('Your shop may not work correctly'); expect(container.textContent).not.toContain('All services are running.'); });
it('shows loading and request failure and lets the owner refresh', async () => { mock.loading = true; await render(); expect(container.textContent).toContain('Loading system health'); mock.loading = false; mock.error = new Error('Unavailable'); await render(); expect(container.textContent).toContain('Unable to load system health'); await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Refresh now')!.click()); expect(mock.refetch).toHaveBeenCalled(); });
it('does not invent a release hash in development', async () => { mock.data.version = 'development'; mock.data.gitSha = 'development'; await render(); expect(container.textContent).toContain('development'); expect(container.textContent).not.toContain('developm ·'); });
it('keeps scan failures visible and can retry the database check', async () => {
  vi.mocked(pluginUploadApi.audit).mockRejectedValueOnce(new Error()).mockResolvedValueOnce({ latest: { finishedAt: '2026-10-13T00:00:00Z', complete: false, counts: { plugins: 4, blocking: 2, warning: 1 } } } as never);
  await render(); const scan = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Start check')!;
  await act(async () => scan().click()); expect(container.textContent).toContain('Unable to complete the check');
  await act(async () => scan().click()); expect(container.textContent).toContain('The check is incomplete'); expect(container.textContent).toContain('2026-10-13 08:00');
});
