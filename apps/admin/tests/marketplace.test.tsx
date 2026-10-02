// @vitest-environment jsdom
import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { PluginsManager } from '@/components/extensions/PluginsManager';
import { PluginTrustLabel } from '@/components/extensions/PluginTrust';
import { BlueMinimalLayout } from '@/components/layout/blue-minimal-layout';
import { marketplaceApi, marketplaceErrorKey } from '@/lib/marketplace';
import { apiClient } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  status: vi.fn(), catalog: vi.fn(), install: vi.fn(), installed: vi.fn(), pathname: '/en/plugins',
}));
const translate = (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key;
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => translate }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock('@/components/auth/ProtectedRoute', () => ({ default: ({ children }: PropsWithChildren) => <>{children}</> }));
vi.mock('@/components/layout/blue-minimal-sidebar', () => ({ BlueMinimalSidebar: () => null }));
vi.mock('@/lib/hooks/use-api', () => ({ useInstalledPlugins: mocks.installed, useTogglePlugin: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(), apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/marketplace', async (original) => ({
  ...await original<typeof import('@/lib/marketplace')>(),
  useMarketplaceStatus: mocks.status, useMarketplaceCatalog: mocks.catalog, useMarketplaceInstall: mocks.install,
}));

const fixture = (installedVersion: string | null = null) => ({
  id: 'market-plugin', slug: 'market-plugin', name: 'Market plugin', description: 'Signed package', publisherId: 'publisher',
  declaredCapabilities: ['shipping'], installedVersion, updateAvailable: installedVersion === '1.0.0',
  versions: [{ version: '1.0.0', minApiVersion: 'v1', compatible: true }, { version: '2.0.0', minApiVersion: 'v1', compatible: true }, { version: '3.0.0', minApiVersion: 'v99', compatible: false }],
});

describe('Admin marketplace and protected test signing banner', () => {
  let root: Root;
  let container: HTMLDivElement;
  let mutateAsync: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    mocks.pathname = '/en/plugins';
    mocks.status.mockReset().mockReturnValue({ data: { configured: true, testSigningMode: true }, isLoading: false });
    mocks.catalog.mockReturnValue({ data: { items: [fixture()] }, isLoading: false });
    mocks.installed.mockReturnValue({ data: { items: [] } });
    mutateAsync = vi.fn().mockResolvedValue({ slug: 'market-plugin', version: '1.0.0' });
    mocks.install.mockReturnValue({ mutateAsync, isPending: false });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  const render = async (node = <PluginsManager />) => { await act(async () => root.render(node)); };
  const button = (name: string) => Array.from(container.getElementsByTagName('button')).find((button) => button.textContent === name)!;
  const click = async (name: string) => { await act(async () => button(name).click()); };
  const open = async () => { await render(); await click('Marketplace'); };

  it.each(['not configured', 'empty', 'load error'] as const)('B renders the %s marketplace state', async (state) => {
    if (state === 'not configured') mocks.status.mockReturnValue({ data: { configured: false, testSigningMode: false } });
    if (state === 'empty') mocks.catalog.mockReturnValue({ data: { items: [] } });
    if (state === 'load error') mocks.catalog.mockReturnValue({ error: new Error('Upstream failed') });
    await open();
    expect(container.textContent).toContain(state === 'not configured' ? en.plugins.marketplace.notConfigured : state === 'empty' ? en.plugins.marketplace.empty : en.plugins.marketplace.loadError);
    if (state === 'not configured') expect(mocks.catalog).toHaveBeenLastCalledWith(false);
  });

  it('C labels declarations as unverified and verifies at install while incompatible selection is disabled with its reason', async () => {
    await open();
    expect(container.textContent).toContain('Declared capabilities (unverified): shipping');
    expect(container.textContent).toContain('Verified at install');
    await click('Details');
    const select = container.getElementsByTagName('select')[0];
    await act(async () => { select.value = '3.0.0'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.textContent).toContain('Incompatible version: Requires API v99');
    expect(button('Install').disabled).toBe(true);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('C shows an available update and installed selected version', async () => {
    mocks.catalog.mockReturnValue({ data: { items: [fixture('1.0.0')] } });
    await open(); await click('Details');
    expect(container.textContent).toContain('Update available');
    expect(button('Installed').disabled).toBe(true);
  });

  it('D sends only pluginId and version and prevents duplicate submissions until installation completes', async () => {
    let release!: () => void;
    mutateAsync.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    await open(); await click('Details'); await click('Install'); await click('Install');
    expect(mutateAsync.mock.calls).toEqual([[{ pluginId: 'market-plugin', version: '1.0.0' }]]);
    mocks.install.mockReturnValue({ mutateAsync, isPending: true });
    await render(); expect(button('Installing…').disabled).toBe(true);
    await act(async () => release());
    expect(container.textContent).toContain('Plugin installed successfully.');
  });

  it('D update submits the selected version only', async () => {
    mocks.catalog.mockReturnValue({ data: { items: [fixture('1.0.0')] } });
    await open(); await click('Details');
    const select = container.getElementsByTagName('select')[0];
    await act(async () => { select.value = '2.0.0'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Update');
    expect(mutateAsync.mock.calls).toEqual([[{ pluginId: 'market-plugin', version: '2.0.0' }]]);
  });

  it('D marketplace API sends exactly pluginId and version', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: { slug: 'market-plugin', version: '2.0.0' } });
    await marketplaceApi.install('market-plugin', '2.0.0');
    expect(post).toHaveBeenCalledExactlyOnceWith('/extensions/marketplace/install', { pluginId: 'market-plugin', version: '2.0.0' }, { transformResponse: [expect.any(Function)] });
  });

  it('D successful real mutation invalidates both catalog and installed queries', async () => {
    const actual = await vi.importActual<typeof import('@/lib/marketplace')>('@/lib/marketplace');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    vi.spyOn(marketplaceApi, 'install').mockResolvedValue({ slug: 'market-plugin', version: '2.0.0' });
    function Mutation() {
      const mutation = actual.useMarketplaceInstall();
      return <button onClick={() => mutation.mutate({ pluginId: 'market-plugin', version: '2.0.0' })}>Run</button>;
    }
    await render(<QueryClientProvider client={client}><Mutation /></QueryClientProvider>);
    await click('Run');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['extensions', 'marketplace', 'catalog'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plugins', 'installed'] });
    client.clear();
  });

  it.each([
    [404, 'notFound'], [409, 'conflict'], [413, 'tooLarge'], [422, 'invalidPackage'],
    [502, 'unavailable'], [503, 'notConfigured'], [504, 'timeout'], [500, 'genericError'],
  ] as const)('D maps HTTP %s to a visible localized error', async (status, key) => {
    mutateAsync.mockRejectedValue({ status });
    await open(); await click('Details'); await click('Install');
    expect(container.textContent).toContain(en.plugins.marketplace[key]);
  });

  it.each([
    ['MARKETPLACE_PLUGIN_NOT_FOUND', 'notFound'], ['PLUGIN_OPERATION_IN_PROGRESS', 'conflict'], ['PAYLOAD_TOO_LARGE', 'tooLarge'],
    ['MARKETPLACE_DIGEST_MISMATCH', 'invalidPackage'], ['MARKETPLACE_DOWNLOAD_UNAVAILABLE', 'unavailable'], ['MARKETPLACE_NOT_CONFIGURED', 'notConfigured'],
    ['MARKETPLACE_DOWNLOAD_TIMEOUT', 'timeout'], ['PLUGIN_TEST_SIGNING_DISABLED', 'testSigningDisabled'], ['PLUGIN_REINSTALL_REQUIRED', 'reinstallRequired'], ['UNKNOWN', 'genericError'],
  ])('D maps code %s to its clear message', async (code, key) => {
    expect(marketplaceErrorKey({ code })).toBe(key);
    mutateAsync.mockRejectedValue({ code });
    await open(); await click('Details'); await click('Install');
    expect(container.textContent).toContain(en.plugins.marketplace[key as keyof typeof en.plugins.marketplace]);
  });

  it.each([
    [{ trustLevel: 'signed', signingRoot: 'official' }, true, 'Verified'],
    [{ trustLevel: 'signed', signingRoot: 'test' }, true, 'Test-signed'],
    [{ trustLevel: 'unsigned', signingRoot: null }, true, 'Unsigned'],
    [{ trustLevel: 'builtin', signingRoot: null }, true, 'Built-in'],
    [{ trustLevel: 'signed', signingRoot: null }, true, 'Reinstall required'],
    [{ trustLevel: 'signed', signingRoot: 'test' }, false, 'Test signing disabled'],
  ] as const)('E renders trust state %s as %s / %s without verifying a test root', async (plugin, mode, label) => {
    await render(<PluginTrustLabel plugin={plugin} testSigningMode={mode} />);
    expect(container.getElementsByTagName('span')[0].textContent).toBe(label);
    if (plugin.signingRoot === 'test') expect(container.textContent).not.toContain('Verified');
  });

  it('F renders a red banner inside protected main only when mode is on', async () => {
    await render(<BlueMinimalLayout><h1>Dashboard</h1></BlueMinimalLayout>);
    expect(container.getElementsByTagName('main')[0].textContent).toContain('Test signing mode');
    expect(container.getElementsByTagName('strong')[0].parentElement?.className).toContain('bg-danger-strong');
    mocks.status.mockReturnValue({ data: { configured: true, testSigningMode: false } });
    await render(<BlueMinimalLayout><h1>Dashboard</h1></BlueMinimalLayout>);
    expect(container.textContent).not.toContain('Test signing mode');
  });

  it.each(['/en/auth/login', '/en/auth/forgot-password', '/en/install'])('F public page %s renders no banner and makes no status call', async (pathname) => {
    mocks.pathname = pathname;
    await render(<BlueMinimalLayout><h1>Public page</h1></BlueMinimalLayout>);
    expect(container.textContent).not.toContain('Test signing mode');
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it('G every marketplace string is present and nonempty in all three merchant dictionaries', () => {
    const leaves = (value: Record<string, unknown>, prefix = ''): string[] => Object.entries(value).flatMap(([key, item]) => {
      if (typeof item === 'string') { expect(item.trim()).not.toBe(''); return [`${prefix}${key}`]; }
      return leaves(item as Record<string, unknown>, `${prefix}${key}.`);
    });
    expect(leaves(hans.plugins.marketplace).sort()).toEqual(leaves(en.plugins.marketplace).sort());
    expect(leaves(hant.plugins.marketplace).sort()).toEqual(leaves(en.plugins.marketplace).sort());
  });
});
