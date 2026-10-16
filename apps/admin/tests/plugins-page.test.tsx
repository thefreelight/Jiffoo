// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PluginsPage from '@/app/[locale]/(themed)/plugins/page';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';

const mocks = vi.hoisted(() => ({ active: vi.fn(), removed: vi.fn(), catalog: vi.fn(), recovery: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));
vi.mock('@/lib/plugin-upload', () => ({ pluginUploadApi: { recovery: mocks.recovery } }));
vi.mock('@/components/extensions/PluginUpload', () => ({ PluginUpload: () => <button>Upload plugin</button> }));
vi.mock('@/lib/marketplace', () => ({ useMarketplaceStatus: () => ({ data: { configured: true, testSigningMode: false } }), useMarketplaceCatalog: mocks.catalog, useMarketplaceInstall: () => ({}) }));
vi.mock('@/lib/hooks/use-api', () => ({ useInstalledPlugins: (state: string) => state === 'removed' ? mocks.removed() : mocks.active(), useUninstallPlugin: () => ({}), useRestorePlugin: () => ({}), usePurgePlugin: () => ({}) }));

let root: Root, container: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, '', '/en/plugins');
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.active.mockReturnValue({ data: { items: [{ slug: 'builtin', name: 'Built-in fixture', version: '1.0.0', source: 'builtin', enabled: true }], total: 1 } });
  mocks.removed.mockReturnValue({ data: { items: [], total: 0 } }); mocks.catalog.mockReturnValue({ data: { items: [] } });
  mocks.recovery.mockResolvedValue({ items: [] });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
const mount = async () => { await act(async () => root.render(<QueryClientProvider client={client}><PluginsPage /></QueryClientProvider>)); };
it('shows counted underline tabs, responsive rows and no list enable controls or database check', async () => {
  await mount(); const tabs = Array.from(container.querySelectorAll('[role=tab]'));
  expect(tabs.map(tab => tab.textContent)).toEqual(['Installed1', 'Marketplace0', 'Removed0']);
  expect(container.querySelector('article')?.className).toContain('flex-wrap'); expect(container.querySelector('table')).toBeNull();
  expect(container.textContent).not.toContain(en.plugins.databaseAudit.title);
  expect(Array.from(container.getElementsByTagName('button')).some(button => button.textContent === 'Disable')).toBe(false);
});
it('keeps builtin uninstall disabled and explains the reason in the menu', async () => {
  await mount(); const button = container.querySelector('button[aria-haspopup=menu]')!;
  await act(async () => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  const item = document.querySelector('[role=menuitem]')!;
  expect(item.textContent).toBe('Built-in plugins cannot be uninstalled'); expect(item.getAttribute('aria-disabled')).toBe('true');
});
it.each(['FAILED', 'NEEDS_RECOVERY'])('uses the real %s operation state without claiming that a rolled-back failure paused the running plugin', async phase => {
  mocks.active.mockReturnValue({ data: { items: [{ slug: 'running-fixture', name: 'Running fixture', version: '1.0.0', source: 'local-zip', enabled: true }], total: 1 } });
  mocks.recovery.mockResolvedValue({ items: [{ slug: 'running-fixture', markerCount: 0, maintenanceRequired: false, operations: [{ operationId: 'operation', slug: 'running-fixture', version: '2.0.0', phase, committedPrefix: 0, retryAvailable: true, publicationWarning: false }] }] });
  await mount(); const row = Array.from(container.getElementsByTagName('article')).find(row => row.getAttribute('aria-label') === 'Running fixture')!;
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(container.querySelector('[role=alert]')?.textContent).toContain('running-fixture');
    expect(container.querySelector('[role=alert]')?.textContent).toContain(phase === 'FAILED' ? en.plugins.recovery.failed : en.plugins.recovery.needsRecovery);
    expect(row.textContent).toContain(phase === 'FAILED' ? 'Enabled' : 'Paused');
  });
});
it.each(['loading', 'error', 'empty'] as const)('renders an installed %s state', async state => {
  mocks.active.mockReturnValue(state === 'loading' ? { isLoading: true } : state === 'error' ? { error: new Error('Failed'), refetch: vi.fn() } : { data: { items: [], total: 0 } });
  await mount(); expect(container.textContent).toContain(state === 'loading' ? en.plugins.loading : state === 'error' ? en.plugins.failedToLoadDetails : 'No plugins yet');
});
it('restores the URL tab, switches tabs and leaves the counts based on real totals', async () => {
  window.history.replaceState(null, '', '/en/plugins?tab=removed'); await mount();
  expect(container.querySelector('[role=tab][aria-selected=true]')?.getAttribute('aria-label')).toBe('Removed');
  await act(async () => container.querySelector<HTMLButtonElement>('[role=tab][aria-label=Marketplace]')!.click());
  expect(window.location.search).toBe('?tab=market'); expect(container.textContent).toContain('No plugins yet');
});
