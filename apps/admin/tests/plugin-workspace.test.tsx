// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';
import { AdminApiError } from '@/lib/api';
import { requestAppNavigation } from '@/lib/pending-navigation';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';

const mocks = vi.hoisted(() => ({ config: vi.fn(), instances: vi.fn(), update: vi.fn(), push: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock('@/components/extensions/PluginLifecycle', () => ({ PluginLifecycle: () => null }));
vi.mock('@/lib/marketplace', () => ({ useMarketplaceStatus: () => ({ data: { configured: false, testSigningMode: false } }) }));
vi.mock('@/lib/hooks/use-api', () => ({ usePluginConfig: mocks.config, usePluginInstances: mocks.instances, useUpdatePluginInstance: () => ({ mutateAsync: mocks.update, isPending: false }) }));

describe('Plugin detail configuration', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    mocks.push.mockReset(); mocks.update.mockReset().mockResolvedValue({ updatedAt: '2026-10-12T12:00:00Z' });
    mocks.config.mockReturnValue({ data: { name: 'Config fixture', category: 'payment', source: 'builtin', trustLevel: 'builtin', configSchema: { type: 'object', properties: { instructions: { type: 'string', title: 'Instructions', default: 'Pay manually.' }, credential: { type: 'string', title: 'Credential', default: 'never-show', sensitive: true } }, required: ['credential'] } }, isLoading: false });
    mocks.instances.mockReturnValue({ data: { items: [{ installationId: 'one', instanceKey: 'default', updatedAt: '2026-10-10T00:00:00Z', enabled: false, config: {}, configMeta: { secretFields: { credential: { configured: true } } } }] } });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  const mount = async () => { await act(async () => root.render(<PluginWorkspace slug="fixture" />)); };
  const input = (field: string) => container.querySelector<HTMLInputElement>('#plugin-config-' + field)!;
  async function fill(field: string, text: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(field), text); input(field).dispatchEvent(new Event('input', { bubbles: true })); }); }
  const button = (name: string) => Array.from(document.getElementsByTagName('button')).find(button => button.textContent === name)!;
  async function click(name: string) { await act(async () => button(name).click()); }

  it('uses defaults only for unset non-sensitive fields, masks secrets and shows saved time', async () => {
    await mount(); expect(input('instructions').value).toBe('Pay manually.'); expect(input('credential').value).toBe('');
    expect(input('credential').placeholder).toContain('Already set'); expect(container.textContent).not.toContain('never-show');
    expect(button('Save configuration').disabled).toBe(true); expect(container.textContent).toContain('2026-10-10');
    mocks.instances.mockReturnValue({ data: { items: [{ installationId: 'one', instanceKey: 'default', updatedAt: '2026-10-11T00:00:00Z', enabled: true, config: { instructions: 'Merchant value', credential: 'masked' }, configMeta: { secretFields: { credential: { configured: true } } } }] } });
    await mount(); expect(input('instructions').value).toBe('Merchant value'); expect(input('credential').value).toBe('');
  });
  it('shows required field names and disables enable until saved required configuration exists', async () => {
    mocks.instances.mockReturnValue({ data: { items: [{ installationId: 'one', instanceKey: 'default', enabled: false, config: {} }] } });
    await mount(); expect(container.textContent).toContain('1 required fields remain before enabling: Credential.');
    expect(button('Enable').disabled).toBe(true); await fill('credential', 'new-secret'); expect(button('Enable').disabled).toBe(true);
  });
  it('tracks dirty inputs, discards changes and does not autosave', async () => {
    await mount(); await fill('instructions', 'Edited'); expect(container.textContent).toContain('Unsaved changes');
    expect(mocks.update).not.toHaveBeenCalled(); await click('Discard changes'); expect(input('instructions').value).toBe('Pay manually.'); expect(button('Save configuration').disabled).toBe(true);
  });
  it('keeps input after failed save and focuses the first invalid field', async () => {
    mocks.update.mockRejectedValue(new AdminApiError('Invalid', 'BAD_REQUEST', { fields: [{ path: 'config.instructions', message: 'Invalid value' }] }, 400));
    await mount(); await fill('instructions', 'Retain my input'); await click('Save configuration');
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(input('instructions').value).toBe('Retain my input'); expect(document.activeElement).toBe(input('instructions'));
      expect(input('instructions').getAttribute('aria-invalid')).toBe('true'); expect(container.textContent).toContain('Could not save');
    });
  });
  it('keeps dirty input if invalidation refreshes the same instance while editing', async () => {
    await mount(); await fill('instructions', 'Do not reset');
    mocks.instances.mockReturnValue({ data: { items: [{ installationId: 'one', instanceKey: 'default', updatedAt: '2026-10-13T00:00:00Z', enabled: false, config: { instructions: 'Server value' } }] } });
    await mount(); expect(input('instructions').value).toBe('Do not reset');
  });
  it('guards navigation with keep editing, discard and save-and-leave actions', async () => {
    await mount(); await fill('instructions', 'Draft'); const destination = vi.fn();
    await act(async () => requestAppNavigation(destination)); expect(destination).not.toHaveBeenCalled();
    await click('Keep editing'); expect(input('instructions').value).toBe('Draft');
    await act(async () => requestAppNavigation(destination)); await click('Leave without saving'); expect(destination).toHaveBeenCalledTimes(1);
  });
  it('saves before leaving and submits configuration separately from enable transitions', async () => {
    await mount(); await fill('instructions', 'Save me'); const destination = vi.fn();
    await act(async () => requestAppNavigation(destination)); await click('Save and leave');
    await vi.waitFor(async () => { await act(async () => {}); expect(destination).toHaveBeenCalledTimes(1); });
    expect(mocks.update).toHaveBeenCalledWith({ slug: 'fixture', installationId: 'one', config: { instructions: 'Save me' } }); expect(destination).toHaveBeenCalledTimes(1);
  });
  it('keeps a failed save-and-leave on the page and returns focus to the invalid input', async () => {
    mocks.update.mockRejectedValue(new AdminApiError('Invalid', 'BAD_REQUEST', { fields: [{ path: 'config.instructions', message: 'Invalid value' }] }, 400));
    await mount(); await fill('instructions', 'Retain me'); const destination = vi.fn();
    await act(async () => requestAppNavigation(destination));
    vi.useFakeTimers();
    try {
      await click('Save and leave');
      expect(destination).not.toHaveBeenCalled(); expect(input('instructions').value).toBe('Retain me');
      // Radix dispatches close auto-focus in a deferred FocusScope unmount callback.
      await act(async () => { await vi.runOnlyPendingTimersAsync(); });
      expect(document.activeElement).toBe(input('instructions'));
    } finally {
      await act(async () => { await vi.runOnlyPendingTimersAsync(); });
      vi.useRealTimers();
    }
  });
  it('lets required manifest defaults be saved before they can enable the plugin', async () => {
    const current = mocks.config().data; mocks.config.mockReturnValue({ data: { ...current, configSchema: { type: 'object', properties: { instructions: { type: 'string', title: 'Instructions', default: 'Default instruction' } }, required: ['instructions'] } } });
    mocks.instances.mockReturnValue({ data: { items: [{ installationId: 'one', instanceKey: 'default', enabled: false, config: {} }] } });
    await mount(); expect(input('instructions').value).toBe('Default instruction'); expect(button('Save configuration').disabled).toBe(false); expect(button('Enable').disabled).toBe(true);
    await click('Save configuration');
    await vi.waitFor(async () => { await act(async () => {}); expect(button('Save configuration').disabled).toBe(true); });
    expect(mocks.update).toHaveBeenCalledWith({ slug: 'fixture', installationId: 'one', config: { instructions: 'Default instruction' } });
  });
  it('returns removed-plugin bookmarks to the removed tab without offering invalid lifecycle actions', async () => {
    mocks.config.mockReturnValue({ data: { name: 'Removed fixture', uninstalled: true } }); await mount();
    expect(container.textContent).toContain(en.plugins.lifecycle.alreadyRemoved); expect(container.querySelector('a')?.getAttribute('href')).toBe('/en/plugins?tab=removed'); expect(container.querySelector('form')).toBeNull();
  });
  it.each(['loading', 'error', 'no fields'] as const)('renders the %s state', async state => {
    mocks.config.mockReturnValue(state === 'loading' ? { isLoading: true } : state === 'error' ? { error: new Error('Failed') } : { data: { name: 'No fields' } });
    await mount(); expect(container.textContent).toContain(state === 'loading' ? en.plugins.loadingPluginDetails : state === 'error' ? en.plugins.failedToLoadDetails : 'No configuration fields.');
  });
});
