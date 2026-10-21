// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginWorkspace } from '@/components/plugins/PluginWorkspace';
import { merchant as en } from '../../../packages/shared/src/i18n/messages/en/merchant';

const mocks = vi.hoisted(() => ({ config: vi.fn(), instances: vi.fn(), push: vi.fn() }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], en) ?? key }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
vi.mock('@/components/extensions/PluginLifecycle', () => ({ PluginLifecycle: () => null }));
vi.mock('@/lib/marketplace', () => ({ useMarketplaceStatus: () => ({ data: { configured: false, testSigningMode: false } }) }));
vi.mock('@/lib/hooks/use-api', () => ({ usePluginConfig: mocks.config, usePluginInstances: mocks.instances, useUpdatePluginInstance: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

describe('Plugin workspace category fallback', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    mocks.push.mockReset();
    mocks.instances.mockReturnValue({ data: { items: [{ installationId: 'one', instanceKey: 'default', enabled: false, config: {} }] } });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  const mount = async () => { await act(async () => root.render(<PluginWorkspace slug="fixture" />)); };
  const aboutRow = (label: string) => {
    const term = Array.from(container.querySelectorAll('dt')).find(node => node.textContent === label);
    return term?.nextElementSibling?.textContent ?? '';
  };

  it('renders a stored category outside the declared categories as the existing none text', async () => {
    mocks.config.mockReturnValue({ data: { name: 'Category fixture', category: 'general', source: 'installed',
      declaredCapabilities: ['payment'], configSchema: { type: 'object', properties: {} } }, isLoading: false });
    await mount();
    expect(container.querySelector('#plugin-about')).not.toBeNull();
    expect(aboutRow('Type')).toContain('None yet');
    expect(aboutRow('Declared capabilities')).toContain('Payment method');
  });
  it('skips unknown capability names and keeps the none text when nothing remains', async () => {
    mocks.config.mockReturnValue({ data: { name: 'Capability fixture', category: 'payment', source: 'installed',
      declaredCapabilities: ['not-a-category', 'shipping'], configSchema: { type: 'object', properties: {} } }, isLoading: false });
    await mount();
    expect(aboutRow('Declared capabilities')).toContain('Shipping');
    expect(aboutRow('Declared capabilities')).not.toContain('not-a-category');
    expect(aboutRow('Type')).toContain('Payment method');
    mocks.config.mockReturnValue({ data: { name: 'Capability fixture', category: 'payment', source: 'installed',
      declaredCapabilities: ['not-a-category'], configSchema: { type: 'object', properties: {} } }, isLoading: false });
    await mount();
    expect(aboutRow('Declared capabilities')).toContain('None yet');
  });
});
