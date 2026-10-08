// @vitest-environment jsdom
import { ApiErrorCodes } from 'shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { PluginUpload } from '@/components/extensions/PluginUpload';
import type { PluginUploadPreview } from '@/lib/plugin-upload';

const { previewApi, installApi } = vi.hoisted(() => ({ previewApi: vi.fn(), installApi: vi.fn() }));
vi.mock('@/lib/plugin-upload', async original => ({ ...await original<typeof import('@/lib/plugin-upload')>(), pluginUploadApi: { preview: previewApi, install: installApi } }));
vi.mock('shared/src/i18n/react', () => ({ useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));

function fixture(operation: PluginUploadPreview['operation'] = 'install', unsigned = false): PluginUploadPreview {
  return { package: { slug: 'upload-fixture', name: 'Upload fixture', version: '2.0.0', hash: 'hash', trust: unsigned ? 'unsigned' : 'signed', declaredCapabilities: ['shipping'], publisher: unsigned ? null : { publisherId: 'publisher', publisherName: 'Publisher', signingRoot: 'test' } },
    current: { version: operation === 'install' ? null : '1.0.0', hash: null, state: operation === 'install' ? 'not-installed' : 'installed' },
    operation, compatibility: { compatible: true }, requiresUnsignedConfirmation: unsigned, previewToken: 'token', expiresAt: '2030-01-01T00:00:00Z',
    migrationPlan: { schemaName: 'plugin_upload_fixture', provisionNamespace: true, changesDatabase: true, applied: [], pending: [{ id: 'one', order: 1, path: 'migrations/001.sql', sha256: '0'.repeat(64) }] } };
}
describe('Local plugin upload', () => {
  let root: Root, container: HTMLDivElement, client: QueryClient;
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    previewApi.mockReset().mockResolvedValue(fixture()); installApi.mockReset().mockResolvedValue({ slug: 'upload-fixture', version: '2.0.0', warnings: [] });
    await act(async () => root.render(<QueryClientProvider client={client}><PluginUpload testSigningMode /></QueryClientProvider>));
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
  const button = (name: string) => Array.from(document.getElementsByTagName('button')).find(button => button.textContent === name)!;
  const click = async (name: string) => { await act(async () => button(name).click()); };
  const file = async (name = 'fixture.zip') => { const input = container.getElementsByTagName('input')[0]; await act(async () => { Object.defineProperty(input, 'files', { value: [new File(['zip'], name)], configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); }); };
  const preview = async () => { await file(); await click('Preview package'); };

  it.each(['install', 'upgrade', 'unchanged'] as const)('J preview renders the %s operation and version', async operation => {
    previewApi.mockResolvedValue(fixture(operation)); await preview();
    expect(container.textContent).toContain(operation === 'upgrade' ? 'Upgrade: 1.0.0 → 2.0.0' : operation === 'unchanged' ? 'Unchanged package: 2.0.0' : 'Install: 2.0.0');
    expect(container.textContent).toContain('Declared capabilities (unverified): shipping');
  });
  it.each([
    [ApiErrorCodes.PLUGIN_DOWNGRADE_NOT_SUPPORTED, 'downgrade'], [ApiErrorCodes.PLUGIN_VERSION_CONTENT_CHANGED, 'versionContentChanged'],
    [ApiErrorCodes.PUBLISHER_CHANGE_FORBIDDEN, 'publisherChanged'], [ApiErrorCodes.SIGNED_UPGRADE_REQUIRED, 'signatureRequired'], [ApiErrorCodes.PACKAGE_CONTENT_MISMATCH, 'signatureInvalid'],
  ] as const)('J preview shows the %s outcome message', async (code, key) => {
    previewApi.mockRejectedValue({ code }); await preview(); expect(container.textContent).toContain(en.plugins.upload[key]); expect(installApi).not.toHaveBeenCalled();
  });
  it('J incompatible preview cannot install and shows the reason', async () => {
    previewApi.mockResolvedValue({ ...fixture(), compatibility: { compatible: false, reason: 'Requires API v99' } }); await preview();
    expect(container.textContent).toContain('Requires API v99'); expect(button('Install package').disabled).toBe(true);
  });
  it('K unsigned installation requires the exact typed slug in a second dialog and refreshes after success', async () => {
    const value = fixture('install', true); previewApi.mockResolvedValue(value); const invalidate = vi.spyOn(client, 'invalidateQueries'); await preview();
    expect(container.textContent).toContain(en.plugins.upload.warning); await click('Continue');
    expect(document.body.textContent).toContain('Confirm unsigned plugin installation'); expect(button('Confirm installation').disabled).toBe(true);
    const input = document.getElementsByTagName('input')[1];
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(input, 'wrong'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(button('Confirm installation').disabled).toBe(true);
    await act(async () => { setter.call(input, 'upload-fixture'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(button('Confirm installation').disabled).toBe(false); await click('Confirm installation');
    expect(installApi.mock.calls[0][1]).toEqual(value); expect(installApi.mock.calls[0][2]).toBe('upload-fixture');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plugins'] }); expect(invalidate).toHaveBeenCalledWith({ queryKey: ['extensions'] });
  });
  it('K cancel sends no final request and a new file resets the preview and confirmation', async () => {
    previewApi.mockResolvedValue(fixture('install', true)); await preview(); await click('Continue');
    const cancel = Array.from(document.getElementsByTagName('button')).filter(button => button.textContent === 'Cancel').at(-1)!;
    await act(async () => cancel.click()); expect(installApi).not.toHaveBeenCalled();
    await file('new.zip'); expect(container.textContent).not.toContain('Upload fixture'); expect(document.body.textContent).not.toContain('Confirm unsigned plugin installation');
  });
  it('K prevents double final submission while the request is pending', async () => {
    let release!: (value: unknown) => void; installApi.mockImplementation(() => new Promise(resolve => { release = resolve; })); await preview();
    await click('Install package'); await click('Install package'); expect(installApi).toHaveBeenCalledTimes(1);
    expect(button('Install package').disabled).toBe(true); await act(async () => release({ slug: 'upload-fixture', version: '2.0.0', warnings: [] }));
  });
  it('L all upload strings exist in en, zh-Hans and zh-Hant', () => {
    const keys = Object.keys(en.plugins.upload).sort(); expect(Object.keys(hans.plugins.upload).sort()).toEqual(keys); expect(Object.keys(hant.plugins.upload).sort()).toEqual(keys);
    for (const dictionary of [en, hans, hant]) for (const value of Object.values(dictionary.plugins.upload)) expect(value.trim()).not.toBe('');
  });
});
