// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { PreferencesProvider } from '../lib/preferences-provider';
import { AdminNavigation, AppearanceOptions } from '../components/layout/admin-navigation';
import { TooltipProvider } from '../components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => 'en', useT: () => (key: string) => key.split('.').slice(1).reduce<any>((value, part) => value?.[part], merchant) ?? key }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/dashboard', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: (props: any) => <img {...props} /> }));
vi.mock('../lib/store', () => ({ useAuthStore: () => ({ user: { firstName: 'Simo', username: 'simo', email: 'simo@example.test' }, logout: vi.fn() }) }));
let root: Root | undefined;
const mount = async (children: ReactNode, collapsed = false, darkAvailable = true) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const element = document.createElement('div'); document.body.append(element); root = createRoot(element);
  await act(async () => root!.render(<PreferencesProvider initialMode="system" initialCollapsed={collapsed} darkAvailable={darkAvailable}><TooltipProvider>{children}</TooltipProvider></PreferencesProvider>));
  return element;
};
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it.each([false, true])('keeps accessible navigation names and focus in rail state %s', async collapsed => {
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" collapsed={collapsed} />, collapsed);
  for (const name of ['Dashboard', 'Products', 'Orders', 'Notifications', 'Customers', 'Administrators', 'Plugins', 'Themes', 'Settings', 'System Health', 'Audit log', 'Tracking & custom code']) {
    const link = Array.from(container.querySelectorAll('a')).find(link => link.getAttribute('aria-label') === name)!;
    expect(link, name).toBeTruthy(); link.focus(); expect(document.activeElement).toBe(link);
  }
  const toggle = container.querySelector('button[aria-label="' + (collapsed ? 'Expand sidebar' : 'Collapse sidebar') + '"]')!;
  expect(toggle.getAttribute('aria-expanded')).toBe(String(!collapsed));
  expect(container.querySelector('button[aria-label="Change language"]')).toBeTruthy();
});
it('group buttons start expanded and change aria-expanded without navigation', async () => {
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  for (const name of ['Store', 'Appearance & extensions', 'Management']) {
    const button = container.querySelector('button[aria-label="' + name + '"]')!;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await act(async () => (button as HTMLElement).click()); expect(button.getAttribute('aria-expanded')).toBe('false');
  }
});
it('disables dark selection and explains the active theme limitation', async () => {
  await mount(<DropdownMenu open><DropdownMenuTrigger>Account menu</DropdownMenuTrigger><DropdownMenuContent><AppearanceOptions /></DropdownMenuContent></DropdownMenu>, false, false);
  const dark = Array.from(document.querySelectorAll('[role="menuitemradio"]')).find(item => item.textContent === 'Dark')!;
  expect(dark.getAttribute('aria-disabled')).toBe('true');
  expect(document.body.textContent).toContain('This theme does not provide a dark appearance.');
});
