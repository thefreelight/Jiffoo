// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthForm } from '../components/auth-form';
import { storefront } from '../../../packages/shared/src/i18n/messages/en/storefront';

const state = vi.hoisted(() => ({ push: vi.fn(), links: [] as Array<{ href: string; onNavigate?: (event: { preventDefault: () => void }) => void }> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('next/link', () => ({ default: ({ href, onNavigate, children }: { href: string; onNavigate?: (event: { preventDefault: () => void }) => void; children: React.ReactNode }) => {
  state.links.push({ href, onNavigate });
  return createElement('a', { href }, children);
} }));
vi.mock('../lib/client-availability', () => ({ availabilityFetch: vi.fn(), useShopAvailability: () => ({ blocked: false, message: '', clear: vi.fn(), capture: vi.fn() }) }));
afterEach(() => { vi.clearAllMocks(); state.links = []; });

it('disables the old authentication form while its route transition is pending, so input cannot be lost into the departing form', async () => {
  let finish!: () => void;
  state.push.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(AuthForm, { mode: 'forgot-password', locale: 'en', labels: storefront.account, next: '/en' })));
    const preventDefault = vi.fn();
    await act(async () => state.links.find((link) => link.href === '/en/login')!.onNavigate!({ preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce(); expect(state.push).toHaveBeenCalledWith('/en/login');
    expect(container.getElementsByTagName('fieldset')[0].disabled).toBe(true);
    expect(container.getElementsByTagName('button')[0].disabled).toBe(true);
    await act(async () => finish());
    expect(container.getElementsByTagName('fieldset')[0].disabled).toBe(false);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
