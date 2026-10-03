// @vitest-environment jsdom
import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { PluginsManager } from '@/components/extensions/PluginsManager';
import { pluginsApi } from '@/lib/api';
import { pluginLifecycleErrorKey } from '@/lib/plugin-lifecycle';

const mocks = vi.hoisted(() => ({ installed: vi.fn(), uninstall: vi.fn(), restore: vi.fn(), purge: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock('@/components/extensions/PluginUpload', () => ({ PluginUpload: () => null }));
vi.mock('@/lib/marketplace', () => ({ useMarketplaceStatus: () => ({ data: { configured: false, testSigningMode: true } }), useMarketplaceCatalog: () => ({}), useMarketplaceInstall: () => ({}), marketplaceErrorKey: () => 'failed' }));
vi.mock('@/lib/api', async original => ({ ...await original<typeof import('@/lib/api')>(), pluginsApi: { getInstalled: mocks.installed, uninstall: mocks.uninstall, restore: mocks.restore, purge: mocks.purge } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const success = (data: unknown) => ({ success: true, data });
const plugin = (slug = 'removal-fixture', removed = false, state = 'available') => ({ slug, name: slug, version: '1.0.0', source: 'local-zip', enabled: false, uninstalled: removed, packageState: { status: state, code: state === 'available' ? null : state === 'corrupt' ? 'PLUGIN_PACKAGE_CORRUPT' : 'PLUGIN_PACKAGE_UNAVAILABLE' } });

describe('Admin plugin removal', () => {
  let root: Root, container: HTMLDivElement, client: QueryClient;
  let rows: ReturnType<typeof plugin>[];
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); rows = [plugin()];
    mocks.installed.mockReset().mockImplementation(async (_page, _limit, state) => success({ items: rows.filter(row => row.uninstalled === (state === 'removed')), page: 1, limit: 100, total: rows.length, totalPages: 1 }));
    mocks.uninstall.mockReset().mockImplementation(async (slug) => { rows = rows.map(row => row.slug === slug ? { ...row, uninstalled: true } : row); return success({ slug, uninstalled: true }); });
    mocks.restore.mockReset().mockImplementation(async (slug) => { rows = rows.map(row => row.slug === slug ? { ...row, uninstalled: false, enabled: false } : row); return success({ slug, restored: true }); });
    mocks.purge.mockReset().mockImplementation(async (slug) => { rows = rows.filter(row => row.slug !== slug); return success({ slug, purged: true }); });
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.restoreAllMocks(); });
  const waitForState = async (
    state: 'active' | 'removed',
    targets: { present?: string[]; absent?: string[] },
    mutationCompleted = false,
  ) => {
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(client.isFetching({ queryKey: ['plugins'] })).toBe(0);
      expect(client.getQueryState(['plugins', 'installed', state])).toMatchObject({ status: 'success', fetchStatus: 'idle' });
      expect(client.isMutating()).toBe(0);
      if (mutationCompleted) {
        expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success');
        expect(document.querySelector('[role="dialog"]')).toBeNull();
      }
      const articles = Array.from(container.getElementsByTagName('article'));
      for (const name of targets.present ?? []) expect(articles.filter(article => article.getAttribute('aria-label') === name)).toHaveLength(1);
      for (const name of targets.absent ?? []) expect(articles.filter(article => article.getAttribute('aria-label') === name)).toHaveLength(0);
    });
  };
  const render = async (initialFixture = 'removal-fixture') => {
    await act(async () => root.render(<QueryClientProvider client={client}><PluginsManager /></QueryClientProvider>));
    await waitForState('active', { present: [initialFixture] });
  };
  const buttons = (name: string) => Array.from(document.getElementsByTagName('button')).filter(button => button.textContent === name);
  const button = (name: string) => { const matches = buttons(name); expect(matches).toHaveLength(1); return matches[0]; };
  const click = async (name: string) => { await act(async () => button(name).click()); };
  const dialog = () => document.querySelector('[role="dialog"]')!;
  const type = async (value: string) => { const input = document.querySelector('input')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); };

  it('H Removed view shows database metadata and only restore and delete actions while package errors isolate their plugin', async () => {
    rows = [plugin('healthy'), plugin('missing', false, 'unavailable'), plugin('broken', false, 'corrupt'), plugin('removed-fixture', true)];
    await render('healthy'); expect(container.textContent).toContain(en.plugins.lifecycle.packageUnavailable); expect(container.textContent).toContain(en.plugins.lifecycle.packageCorrupt);
    const articles = Array.from(container.getElementsByTagName('article'));
    expect(articles.find(article => article.getAttribute('aria-label') === 'healthy')?.textContent).toContain('Enable');
    for (const slug of ['missing', 'broken']) expect(Array.from(articles.find(article => article.getAttribute('aria-label') === slug)!.getElementsByTagName('button')).find(button => button.textContent === 'Enable')?.disabled).toBe(true);
    await click('Removed'); await waitForState('removed', { present: ['removed-fixture'], absent: ['healthy', 'missing', 'broken'] }); expect(container.textContent).toContain('removed-fixture'); expect(button('Restore')).toBeDefined(); expect(button('Delete plugin')).toBeDefined(); expect(buttons('Enable')).toHaveLength(0); expect(buttons('Uninstall')).toHaveLength(0);
  });
  it('I uninstall dialog states retention, cancel sends nothing and confirmation refreshes active and removed queries', async () => {
    await render(); await click('Uninstall'); expect(dialog().textContent).toContain(en.plugins.lifecycle.uninstallDescription);
    await click('Cancel'); expect(mocks.uninstall).not.toHaveBeenCalled(); await click('Uninstall'); await click('Confirm');
    await waitForState('active', { absent: ['removal-fixture'] }, true);
    expect(mocks.uninstall).toHaveBeenCalledTimes(1);
    expect(mocks.uninstall).toHaveBeenCalledWith('removal-fixture'); await click('Removed'); await waitForState('removed', { present: ['removal-fixture'] }); expect(container.textContent).toContain('removal-fixture');
    expect(mocks.installed.mock.calls.filter(call => call[2] === 'active').length).toBeGreaterThan(1);
  });
  it('I restore dialog states disabled restoration, cancel sends nothing and confirmation returns to the disabled active list', async () => {
    rows = [plugin('active-fixture'), plugin('removal-fixture', true)]; await render('active-fixture'); await click('Removed'); await waitForState('removed', { present: ['removal-fixture'], absent: ['active-fixture'] }); await click('Restore');
    expect(dialog().textContent).toContain(en.plugins.lifecycle.restoreDescription); await click('Cancel'); expect(mocks.restore).not.toHaveBeenCalled();
    await click('Restore'); await click('Confirm'); await waitForState('removed', { absent: ['removal-fixture'] }, true);
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    await click('Installed plugins'); await waitForState('active', { present: ['active-fixture', 'removal-fixture'] }); expect(container.textContent).toContain('removal-fixture'); expect(buttons('Enable')).toHaveLength(2);
  });
  it('I purge dialog honestly describes retained data, requires the exact slug and cancel sends nothing', async () => {
    rows = [plugin('active-fixture'), plugin('removal-fixture', true)]; await render('active-fixture'); await click('Removed'); await waitForState('removed', { present: ['removal-fixture'], absent: ['active-fixture'] }); await click('Delete plugin');
    expect(dialog().textContent).toContain(en.plugins.lifecycle.purgeDescription); expect(button('Confirm').disabled).toBe(true);
    await type('wrong'); expect(button('Confirm').disabled).toBe(true); await click('Cancel'); expect(mocks.purge).not.toHaveBeenCalled();
    await click('Delete plugin'); await type('removal-fixture'); expect(button('Confirm').disabled).toBe(false); await click('Confirm');
    await waitForState('removed', { absent: ['removal-fixture'] }, true); expect(mocks.purge).toHaveBeenCalledTimes(1); expect(mocks.purge).toHaveBeenCalledWith('removal-fixture', 'removal-fixture');
    expect(mocks.installed.mock.calls.filter(call => call[2] === 'removed').length).toBeGreaterThan(1);
  });
  it.each(['uninstall', 'restore', 'purge'] as const)('I %s confirmation cannot double submit while its real mutation promise is pending', async operation => {
    rows = [plugin('active-fixture'), plugin('removal-fixture', operation !== 'uninstall')];
    let release!: (value: unknown) => void; const pending = new Promise(resolve => { release = resolve; }); mocks[operation].mockReturnValue(pending);
    await render('active-fixture'); if (operation !== 'uninstall') { await click('Removed'); await waitForState('removed', { present: ['removal-fixture'], absent: ['active-fixture'] }); }
    if (operation === 'uninstall') rows = [plugin('removal-fixture')];
    const label = { uninstall: 'Uninstall', restore: 'Restore', purge: 'Delete plugin' }[operation];
    const target = buttons(label).at(-1)!; await act(async () => target.click()); if (operation === 'purge') await type('removal-fixture');
    await act(async () => { const confirm = button('Confirm'); confirm.click(); confirm.click(); }); expect(mocks[operation]).toHaveBeenCalledTimes(1);
    expect(button('Working…').disabled).toBe(true); await act(async () => release(success({ slug: 'removal-fixture' })));
    await waitForState(operation === 'uninstall' ? 'active' : 'removed', { present: ['removal-fixture'] }, true);
  });
  it('J unfinished-payment refusal remains visible in the dialog without deleting the installation', async () => {
    rows = [plugin('active-fixture'), plugin('removal-fixture', true)]; mocks.purge.mockRejectedValue({ code: 'PLUGIN_UNFINISHED_PAYMENTS' });
    await render('active-fixture'); await click('Removed'); await waitForState('removed', { present: ['removal-fixture'], absent: ['active-fixture'] }); await click('Delete plugin'); await type('removal-fixture'); await click('Confirm');
    await vi.waitFor(async () => { await act(async () => {}); expect(dialog().textContent).toContain(en.plugins.lifecycle.unfinishedPayments); }); expect(rows.some(row => row.slug === 'removal-fixture')).toBe(true);
  });
  it.each([
    ['PLUGIN_NOT_FOUND', 'notFound'], ['PLUGIN_BUILTIN_PROTECTED', 'builtinProtected'], ['PLUGIN_ALREADY_UNINSTALLED', 'alreadyRemoved'], ['PLUGIN_NOT_UNINSTALLED', 'notRemoved'],
    ['PLUGIN_PURGE_CONFIRMATION_REQUIRED', 'confirmationRequired'], ['PLUGIN_UNFINISHED_PAYMENTS', 'unfinishedPayments'], ['PLUGIN_PACKAGE_UNAVAILABLE', 'packageUnavailable'],
    ['PLUGIN_PACKAGE_CORRUPT', 'packageCorrupt'], ['PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT', 'packageUnavailable'], ['PLUGIN_REINSTALL_REQUIRED', 'reinstallRequired'],
    ['PLUGIN_TEST_SIGNING_DISABLED', 'testSigningDisabled'], ['LAST_PROVIDER_REQUIRED', 'lastProvider'], ['PLUGIN_OPERATION_IN_PROGRESS', 'busy'], ['PLUGIN_OPERATION_LEASE_LOST', 'busy'], ['INTERNAL_SERVER_ERROR', 'failed'],
  ])('J maps %s to a localized lifecycle message', (code, key) => { expect(pluginLifecycleErrorKey({ code })).toBe(key); });
  it('K every lifecycle string is present in English, Simplified Chinese and Traditional Chinese', () => {
    for (const locale of [hans, hant]) { expect(Object.keys(locale.plugins.lifecycle).sort()).toEqual(Object.keys(en.plugins.lifecycle).sort()); for (const value of Object.values(locale.plugins.lifecycle)) expect(value.length).toBeGreaterThan(0); }
  });
});
