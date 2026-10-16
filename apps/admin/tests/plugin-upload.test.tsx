// @vitest-environment jsdom
import { ApiErrorCodes } from 'shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { pluginMessage } from 'shared/src/i18n/messages/admin-plugins';
import { PluginUpload } from '@/components/extensions/PluginUpload';
import type { PluginUploadPreview } from '@/lib/plugin-upload';

const { previewApi, installApi, retryApi } = vi.hoisted(() => ({ previewApi: vi.fn(), installApi: vi.fn(), retryApi: vi.fn() }));
vi.mock('@/lib/plugin-upload', async original => ({ ...await original<typeof import('@/lib/plugin-upload')>(), pluginUploadApi: { preview: previewApi, install: installApi, retry: retryApi } }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key === 'common.actions.cancel' ? 'Cancel' : key === 'common.actions.close' ? 'Close' : key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));

function fixture(unsigned = false): PluginUploadPreview {
  return { package: { slug: 'upload-fixture', name: 'Upload fixture', version: '2.0.0', hash: 'hash', trust: unsigned ? 'unsigned' : 'signed', declaredCapabilities: ['shipping'], publisher: unsigned ? null : { publisherId: 'publisher', publisherName: 'Publisher', signingRoot: 'test' } }, current: { version: null, hash: null, state: 'not-installed' }, operation: 'install', compatibility: { compatible: true }, requiresUnsignedConfirmation: unsigned, previewToken: 'token', expiresAt: '2030-01-01T00:00:00Z', migrationPlan: { schemaName: 'plugin_upload_fixture', provisionNamespace: true, changesDatabase: true, applied: [], pending: [{ id: 'one', order: 1, path: 'migrations/001.sql', sha256: '0'.repeat(64) }] } };
}

describe('Plugin upload dialog', () => {
  let root: Root, container: HTMLDivElement, client: QueryClient;
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    previewApi.mockReset().mockResolvedValue(fixture()); installApi.mockReset().mockResolvedValue({ slug: 'upload-fixture', version: '2.0.0', warnings: [] });
    retryApi.mockReset().mockResolvedValue({ slug: 'upload-fixture', version: '2.0.0', warnings: [] });
    await act(async () => root.render(<QueryClientProvider client={client}><PluginUpload testSigningMode /></QueryClientProvider>));
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
  const button = (name: string) => Array.from(document.getElementsByTagName('button')).find(button => button.textContent === name)!;
  const click = async (name: string) => { await act(async () => button(name).click()); };
  const waitForUI = async (assertion: () => void) => { await vi.waitFor(async () => { await act(async () => {}); assertion(); }); };
  async function preview() {
    await click('Upload plugin');
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    await act(async () => { Object.defineProperty(input, 'files', { value: [new File(['zip'], 'fixture.zip')], configurable: true }); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Check package');
    await waitForUI(() => expect(button('Cancel')?.disabled).toBe(false));
  }
  it('starts with no dialog, then shows the package chooser and disables checking without a file', async () => {
    expect(document.querySelector('[role=dialog]')).toBeNull();
    await click('Upload plugin'); expect(button('Check package').disabled).toBe(true);
    expect(document.body.textContent).toContain('up to 10 MB');
  });
  it('previews identity, real signature, declared capabilities and pending database changes', async () => {
    await preview(); expect(document.body.textContent).toContain('Upload fixture');
    expect(document.body.textContent).toContain('Test-signed'); expect(document.body.textContent).toContain('Shipping');
    expect(document.body.textContent).toContain('migrations/001.sql'); expect(document.body.textContent).toContain('1 pending change files');
    expect(installApi).not.toHaveBeenCalled();
  });
  it.each([[ApiErrorCodes.PLUGIN_DOWNGRADE_NOT_SUPPORTED, 'downgrade'], [ApiErrorCodes.PLUGIN_VERSION_CONTENT_CHANGED, 'versionContentChanged'], [ApiErrorCodes.PUBLISHER_CHANGE_FORBIDDEN, 'publisherChanged'], [ApiErrorCodes.SIGNED_UPGRADE_REQUIRED, 'signatureRequired'], [ApiErrorCodes.PACKAGE_CONTENT_MISMATCH, 'signatureInvalid']] as const)('shows the %s preview refusal without installing', async (code, key) => {
    previewApi.mockRejectedValue({ code }); await preview(); expect(document.body.textContent).toContain(en.plugins.upload[key]); expect(installApi).not.toHaveBeenCalled();
  });
  it('disables installation of an incompatible package and retains the reason', async () => {
    previewApi.mockResolvedValue({ ...fixture(), compatibility: { compatible: false, reason: 'Requires API v99' } }); await preview();
    expect(document.body.textContent).toContain('Requires API v99'); expect(button('Confirm installation').disabled).toBe(true);
  });
  it('requires exact unsigned slug confirmation in the preview dialog and finishes disabled', async () => {
    const value = fixture(true); previewApi.mockResolvedValue(value); const invalidate = vi.spyOn(client, 'invalidateQueries'); await preview();
    expect(document.body.textContent).toContain(pluginMessage('en', 'unsignedWarning')); expect(button('Confirm installation').disabled).toBe(true);
    const input = document.querySelector<HTMLInputElement>('input:not([type=file])')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const text of ['wrong', 'upload-fixture']) await act(async () => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(button('Confirm installation').disabled).toBe(false); await click('Confirm installation');
    await waitForUI(() => expect(document.body.textContent).toContain('installed and disabled'));
    expect(installApi).toHaveBeenCalledWith(expect.any(File), value, 'upload-fixture', expect.any(Function));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plugins'] }); expect(document.body.textContent).toContain('installed and disabled');
  });
  it('cancel and reopening clears the file and sends no install request', async () => {
    await preview(); await click('Cancel'); await click('Upload plugin');
    expect(button('Check package').disabled).toBe(true); expect(installApi).not.toHaveBeenCalled();
  });
  it('locks installation while pending, displays real progress, and prevents duplicate submission', async () => {
    let release!: (value: unknown) => void;
    installApi.mockImplementation((_file, _preview, _slug, progress) => { progress({ committedPrefix: 1 }); return new Promise(resolve => { release = resolve; }); });
    await preview(); const confirm = button('Confirm installation');
    await act(async () => { confirm.click(); confirm.click(); }); expect(installApi).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('1 / 1 database changes executed');
    await act(async () => release({ slug: 'upload-fixture', warnings: [] }));
    await waitForUI(() => expect(document.body.textContent).toContain('Installation complete'));
  });
  it('shows a durable recovery requirement and retries the saved package without uploading again', async () => {
    installApi.mockImplementation(async (_file, _preview, _slug, progress) => {
      progress({ operationId: 'saved-operation', phase: 'NEEDS_RECOVERY', terminal: true, committedPrefix: 1 });
      throw { code: 'PLUGIN_MIGRATION_FAILED', phase: 'NEEDS_RECOVERY' };
    });
    await preview(); await click('Confirm installation');
    await waitForUI(() => expect(document.body.textContent).toContain(en.plugins.upload.needsRecovery));
    expect(document.body.textContent).toContain(en.plugins.upload.needsRecovery);
    expect(document.body.textContent).toContain(en.plugins.upload.migrationApplied + ': 1');
    expect(document.body.textContent).not.toContain('Database changes');
    await click(en.plugins.upload.migrationRetry);
    await waitForUI(() => expect(document.body.textContent).toContain('Installation complete'));
    expect(retryApi).toHaveBeenCalledWith('saved-operation', expect.any(Function)); expect(installApi).toHaveBeenCalledTimes(1);
  });
});
