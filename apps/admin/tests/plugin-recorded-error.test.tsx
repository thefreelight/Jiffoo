// @vitest-environment jsdom
import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { PluginsManager } from '@/components/extensions/PluginsManager';
import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';
import { LastRecordedError } from '@/components/plugins/LastRecordedError';

const mocks = vi.hoisted(() => ({ plugin: {} as Record<string, unknown> }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock('@/components/extensions/PluginUpload', () => ({ PluginUpload: () => null }));
vi.mock('@/lib/marketplace', () => ({ useMarketplaceStatus: () => ({ data: { configured: false, testSigningMode: false } }), useMarketplaceCatalog: () => ({}), useMarketplaceInstall: () => ({}), marketplaceErrorKey: () => 'failed' }));
vi.mock('@/lib/hooks/use-api', () => ({
  useInstalledPlugins: () => ({ data: { items: [mocks.plugin] } }), useTogglePlugin: () => ({ isPending: false, mutate: vi.fn() }),
  useUninstallPlugin: () => ({}), useRestorePlugin: () => ({}), usePurgePlugin: () => ({}),
  usePluginConfig: () => ({ data: mocks.plugin }), usePluginInstances: () => ({ data: { items: [{ installationId: 'one', enabled: true, config: {}, updatedAt: 'one' }] } }),
  useUpdatePluginInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
describe('Historical last recorded error display', () => {
  let root: Root, container: HTMLDivElement;
  let queryClient: QueryClient;
  const time = '2026-10-03T00:00:00.000Z', message = '<img src=x onerror=alert(1)> historical failure';
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mocks.plugin = { slug: 'historical-fixture', name: 'Historical fixture', version: '1.0.0', source: 'builtin', enabled: true, config: {}, lastFailureAt: time, lastFailureMessage: message };
  });
  afterEach(async () => { await act(async () => root.unmount()); queryClient.clear(); container.remove(); });
  it.each(['list', 'detail'] as const)('F %s shows a timestamp and literal historical text without changing enabled state or health', async view => {
    await act(async () => root.render(<QueryClientProvider client={queryClient}>{view === 'list' ? <PluginsManager /> : <PluginWorkspace slug="historical-fixture" />}</QueryClientProvider>));
    const group = container.querySelector('[role="group"][aria-label="Last recorded error"]')!;
    expect(group.textContent).toContain(en.plugins.lastRecordedError.label); expect(group.textContent).toContain(message); expect(group.textContent).toContain(en.plugins.lastRecordedError.historical);
    expect(group.getElementsByTagName('time')[0].getAttribute('datetime')).toBe(time); expect(group.getElementsByTagName('time')[0].textContent).not.toBe(''); expect(group.getElementsByTagName('img')).toHaveLength(0);
    expect(mocks.plugin.enabled).toBe(true); expect(Array.from(container.getElementsByTagName('button')).some(button => button.textContent === (view === 'list' ? 'Disable' : 'Disable plugin'))).toBe(true);
    expect(group.getAttribute('role')).toBe('group');
  });
  it.each(['list', 'detail'] as const)('F %s shows no last-error section when there is no recorded error', async view => {
    mocks.plugin = { ...mocks.plugin, lastFailureAt: null, lastFailureMessage: null };
    await act(async () => root.render(<QueryClientProvider client={queryClient}>{view === 'list' ? <PluginsManager /> : <PluginWorkspace slug="historical-fixture" />}</QueryClientProvider>)); expect(container.textContent).not.toContain(en.plugins.lastRecordedError.label);
  });
  it('F absent fields render nothing', async () => { await act(async () => root.render(<LastRecordedError />)); expect(container.textContent).toBe(''); });
  it('G all historical error strings are present in all three locales', () => {
    for (const locale of [hans, hant]) { expect(Object.keys(locale.plugins.lastRecordedError).sort()).toEqual(Object.keys(en.plugins.lastRecordedError).sort()); for (const value of Object.values(locale.plugins.lastRecordedError)) expect(value.length).toBeGreaterThan(0); }
  });
});
