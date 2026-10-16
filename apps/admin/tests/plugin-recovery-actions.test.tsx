// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { PluginRecovery } from '@/components/extensions/PluginRecovery';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';

const mocks = vi.hoisted(() => ({ retry: vi.fn() }));
const data = { items: [{ slug: 'failed-fixture', markerCount: 0, maintenanceRequired: false, operations: [{ operationId: 'saved-operation', slug: 'failed-fixture', version: '2.0.0', phase: 'NEEDS_RECOVERY', committedPrefix: 1, retryAvailable: true, publicationWarning: false }] }] };
vi.mock('@/lib/plugin-upload', () => ({ pluginUploadApi: { recovery: async () => data, retry: mocks.retry } }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key === 'common.actions.cancel' ? 'Cancel' : key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));
let root: Root, container: HTMLDivElement, client: QueryClient;
afterEach(async () => { await act(async () => root?.unmount()); client?.clear(); container?.remove(); });

it('keeps recovery compact and requires consent in the retry dialog before submitting the retained package once', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); client.setQueryData(['plugin-recovery'], data);
  let release!: () => void; mocks.retry.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
  await act(async () => root.render(<QueryClientProvider client={client}><PluginRecovery /></QueryClientProvider>));
  expect(container.querySelector('input')).toBeNull(); expect(container.textContent).toContain('1 database changes executed');
  const button = (name: string) => Array.from(document.getElementsByTagName('button')).find(button => button.textContent === name)!;
  await act(async () => button('Retry installation').click()); expect(button('Retry retained package').disabled).toBe(true);
  await act(async () => document.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await act(async () => { button('Retry retained package').click(); button('Retry retained package').click(); });
  expect(mocks.retry).toHaveBeenCalledExactlyOnceWith('saved-operation'); expect(button('Cancel').disabled).toBe(true);
  await act(async () => release());
});
