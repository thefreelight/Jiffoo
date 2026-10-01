// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';

const { usePluginConfig, usePluginInstances } = vi.hoisted(() => ({
  usePluginConfig: vi.fn(),
  usePluginInstances: vi.fn(),
}));

vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock('@/lib/hooks/use-api', () => ({
  usePluginConfig,
  usePluginInstances,
  useInstalledPlugins: () => ({ data: { items: [] } }),
  useUpdatePluginInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Plugin workspace configuration defaults', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    usePluginConfig.mockReturnValue({
      data: {
        name: 'Config fixture', category: 'payment',
        configSchema: {
          type: 'object',
          properties: {
            instructions: { type: 'string', default: 'Pay manually.' },
            credential: { type: 'string', default: 'never-show', sensitive: true },
          },
        },
      },
      isLoading: false,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows schema defaults only for unset non-sensitive fields and preserves stored values', async () => {
    usePluginInstances.mockReturnValue({
      data: { items: [{ installationId: 'one', updatedAt: 'first', enabled: true, config: {}, configMeta: { secretFields: { credential: { configured: true } } } }] },
    });
    await act(async () => root.render(<PluginWorkspace slug="fixture" />));
    expect(container.querySelector<HTMLInputElement>('#plugin-config-instructions')?.value).toBe('Pay manually.');
    expect(container.querySelector<HTMLInputElement>('#plugin-config-credential')?.value).toBe('');

    usePluginInstances.mockReturnValue({
      data: { items: [{ installationId: 'one', updatedAt: 'second', enabled: true, config: { instructions: 'Merchant value', credential: 'masked' }, configMeta: { secretFields: { credential: { configured: true } } } }] },
    });
    await act(async () => root.render(<PluginWorkspace slug="fixture" />));
    expect(container.querySelector<HTMLInputElement>('#plugin-config-instructions')?.value).toBe('Merchant value');
    expect(container.querySelector<HTMLInputElement>('#plugin-config-credential')?.value).toBe('');
  });
});
