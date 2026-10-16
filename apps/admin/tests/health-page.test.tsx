// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import HealthMonitoringPage from '@/app/[locale]/(themed)/system/health/page';

const mock = vi.hoisted(() => ({ version: '1.2.3', gitSha: 'abcdef0123456789abcdef0123456789abcdef01' }));
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key }));
vi.mock('@/lib/hooks/use-api', () => ({ useHealthSummary: () => ({ data: {
  ...mock, status: 'healthy', uptime: 10, database: { status: 'ok' }, redis: { status: 'ok' }, pluginRuntime: { status: 'ok', loaded: 5 }, worker: { running: true, instances: 2 },
}, isLoading: false, refetch: vi.fn() }) }));
vi.mock('@/lib/plugin-upload', () => ({ pluginUploadApi: { auditSummary: async () => ({ latest: null }), audit: vi.fn() } }));
let container: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
it('shows release version with the short source commit', async () => {
  mock.version = '1.2.3'; mock.gitSha = 'abcdef0123456789abcdef0123456789abcdef01';
  await act(async () => root.render(<QueryClientProvider client={client}><HealthMonitoringPage /></QueryClientProvider>)); expect(container.textContent).toContain('1.2.3 (abcdef01)');
});
it('shows development without a fake semantic version or commit', async () => {
  mock.version = 'development'; mock.gitSha = 'development';
  await act(async () => root.render(<QueryClientProvider client={client}><HealthMonitoringPage /></QueryClientProvider>)); expect(container.textContent).toContain('merchant.health.version: development'); expect(container.textContent).not.toContain('(developm)');
});

it('places the existing plugin database check on system health', async () => {
  await act(async () => root.render(<QueryClientProvider client={client}><HealthMonitoringPage /></QueryClientProvider>));
  expect(container.textContent).toContain('merchant.plugins.databaseAudit.title');
  expect(container.textContent).toContain('merchant.plugins.databaseAudit.scan');
});
