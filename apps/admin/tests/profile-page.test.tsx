// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ProfilePage from '../app/[locale]/(themed)/profile/page';
import { requestAppNavigation } from '../lib/pending-navigation';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';

const mocks = vi.hoisted(() => ({ update: vi.fn(), push: vi.fn(), replace: vi.fn(), uploading: false }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string, values?: Record<string, string | number>) => {
  if (key === 'common.actions.save') return 'Save'; if (key === 'common.actions.cancel') return 'Cancel';
  const text = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant) ?? key;
  return typeof text === 'string' ? text.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? '')) : key;
} }));
vi.mock('../lib/hooks/use-api', () => ({
  useAccountProfile: () => ({ data: { id: 'one', username: 'Owner', locale: 'en', avatar: null, email: 'owner@example.com', updatedAt: '2026-10-15T00:00:00Z' }, isLoading: false, refetch: vi.fn() }),
  useUpdateAccountProfile: () => ({ mutateAsync: mocks.update, isPending: false }), useUpdateAccountEmail: () => ({ isPending: false }), useChangePassword: () => ({ isPending: false }), useUploadAvatar: () => ({ isPending: mocks.uploading }),
}));
it('saves name and language together and guards navigation while keeping the edited name', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container), resume = vi.fn();
  mocks.update.mockResolvedValue({ username: 'Updated Owner', locale: 'en', updatedAt: '2026-10-15T01:00:00Z' });
  const button = (label: string) => Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === label)!;
  try {
    await act(async () => root.render(<ProfilePage />));
    expect(button('Save').disabled).toBe(true);
    const input = container.querySelector<HTMLInputElement>('input:not([type="file"])')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Updated Owner'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(container.textContent).toContain('Unsaved changes');
    await act(async () => requestAppNavigation(resume));
    expect(resume).not.toHaveBeenCalled(); expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
    await act(async () => button('Keep editing').click()); expect(input.value).toBe('Updated Owner');
    await act(async () => requestAppNavigation(resume));
    await act(async () => button('Save and leave').click());
    expect(mocks.update).toHaveBeenCalledWith({ username: 'Updated Owner', locale: 'en' }); expect(resume).toHaveBeenCalledTimes(1);
    expect(button('Save').disabled).toBe(true); expect(container.textContent).toContain('Saved ·');
  } finally { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
it('offers one visible avatar upload control and prevents duplicate file-input tab stops', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<ProfilePage />));
    const upload = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Upload avatar')!;
    const file = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(file.hidden).toBe(true); expect(getComputedStyle(file).display).toBe('none');
    expect(upload.tagName).toBe('BUTTON'); expect(upload.type).toBe('button'); expect(upload.disabled).toBe(false);
    const choose = vi.spyOn(file, 'click').mockImplementation(() => {});
    await act(async () => { upload.focus(); upload.click(); });
    expect(document.activeElement).toBe(upload); expect(choose).toHaveBeenCalledTimes(1);
    mocks.uploading = true; await act(async () => root.render(<ProfilePage />));
    expect(upload.disabled).toBe(true); expect(file.disabled).toBe(true);
    await act(async () => upload.click()); expect(choose).toHaveBeenCalledTimes(1);
  } finally { mocks.uploading = false; await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});
