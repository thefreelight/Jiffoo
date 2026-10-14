// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { merchant } from '../../../packages/shared/src/i18n/messages/en/merchant';
import { merchant as hans } from '../../../packages/shared/src/i18n/messages/zh-Hans/merchant';
import { merchant as hant } from '../../../packages/shared/src/i18n/messages/zh-Hant/merchant';
import { registerNavigationGuard } from '../lib/pending-navigation';
import { PreferencesProvider, usePreferences } from '../lib/preferences-provider';
import { AdminNavigation, AppearanceOptions } from '../components/layout/admin-navigation';
import { TooltipProvider } from '../components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
const state = vi.hoisted(() => ({ locale: 'en', pathname: '/en/dashboard', count: 0, push: vi.fn(), logout: vi.fn() }));
const messages = { en: merchant, 'zh-Hans': hans, 'zh-Hant': hant };
vi.mock('../lib/hooks/use-api', () => ({ useOrderStats: () => ({ data: { paymentReviewCount: state.count } }) }));
vi.mock('shared/src/i18n/react', () => ({ useLocale: () => state.locale, useT: () => (key: string, params?: Record<string, string | number>) => {
  const value = key.split('.').slice(1).reduce<any>((value, part) => value?.[part], messages[state.locale as keyof typeof messages]) ?? key;
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? '{' + name + '}')) : key;
} }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname, useRouter: () => ({ push: state.push }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('next/image', () => ({ default: (props: any) => <img {...props} /> }));
vi.mock('../lib/store', () => ({ useAuthStore: () => ({ user: { firstName: 'Simo', username: 'simo', email: 'simo@example.test' }, logout: state.logout }) }));
beforeEach(() => { state.locale = 'en'; state.pathname = '/en/dashboard'; state.count = 0; state.push.mockClear(); state.logout.mockClear(); });
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
  for (const name of ['Overview', 'Products', 'Orders', 'Notifications', 'Customers', 'Administrators', 'Plugins', 'Themes', 'Settings', 'System Health', 'Audit records', 'Tracking & custom code']) {
    const link = Array.from(container.querySelectorAll('a')).find(link => link.getAttribute('aria-label') === name)!;
    expect(link, name).toBeTruthy(); await act(async () => link.focus()); expect(document.activeElement).toBe(link);
  }
  const toggle = container.querySelector('button[aria-label="' + (collapsed ? 'Expand sidebar' : 'Collapse sidebar') + '"]')!;
  expect(toggle.getAttribute('aria-expanded')).toBe(String(!collapsed));
  expect(container.querySelector('button[aria-label="Change language"]')).toBeNull();
  if (collapsed) {
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(2);
    for (const name of ['Store', 'Appearance & extensions', 'Management']) expect(container.querySelector('button[aria-label="' + name + '"]')).toBeNull();
  }
});
it('group buttons start expanded and change aria-expanded without navigation', async () => {
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  for (const name of ['Store', 'Appearance & extensions', 'Management']) {
    const button = container.querySelector('button[aria-label="' + name + '"]')!;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await act(async () => (button as HTMLElement).click()); expect(button.getAttribute('aria-expanded')).toBe('false');
  }
});
it('keeps rail groups visible and restores the expanded group state without switching control modes', async () => {
  function Navigation() { const { collapsed } = usePreferences(); return <AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" collapsed={collapsed} />; }
  const warning = vi.spyOn(console, 'warn');
  try {
    const container = await mount(<Navigation />);
    const button = (name: string) => container.querySelector<HTMLButtonElement>('button[aria-label="' + name + '"]')!;
    await act(async () => button('Store').click());
    expect(button('Store').getAttribute('aria-expanded')).toBe('false');
    await act(async () => button('Collapse sidebar').click());
    expect(container.querySelector('a[aria-label="Overview"]')).toBeTruthy();
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(2);
    await act(async () => button('Expand sidebar').click());
    expect(button('Store').getAttribute('aria-expanded')).toBe('false');
    expect(warning.mock.calls.flat().join(' ')).not.toMatch(/uncontrolled|controlled/);
  } finally { warning.mockRestore(); }
});
it('disables dark selection and explains the active theme limitation', async () => {
  await mount(<DropdownMenu open><DropdownMenuTrigger>Account menu</DropdownMenuTrigger><DropdownMenuContent><AppearanceOptions /></DropdownMenuContent></DropdownMenu>, false, false);
  const dark = Array.from(document.querySelectorAll('[role="menuitemradio"]')).find(item => item.textContent === 'Dark')!;
  expect(dark.getAttribute('aria-disabled')).toBe('true');
  expect(document.body.textContent).toContain('This theme does not provide a dark appearance.');
});
it.each(['en', 'zh-Hans', 'zh-Hant'] as const)('uses board navigation order in %s', async locale => {
  state.locale = locale; state.pathname = '/' + locale + '/dashboard';
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  const copy = messages[locale];
  expect(Array.from(container.querySelectorAll('nav a')).map(link => link.textContent)).toEqual([
    copy.nav.dashboard, copy.orders.title, copy.products.title, copy.customers.title, copy.notifications.title,
    copy.nav.themes, copy.nav.plugins, copy.storefrontCode.title, copy.shell.administrators, copy.auditEvents.title, copy.nav.settings, copy.health.title,
  ]);
});
it.each(['/en/dashboard', '/en/products', '/en/products/categories', '/en/products/example/edit'])('expands product children from route %s and permits independent toggling', async pathname => {
  state.pathname = pathname;
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  const inside = pathname.startsWith('/en/products');
  const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="' + (inside ? 'Collapse products' : 'Expand products') + '"]')!;
  expect(toggle.getAttribute('aria-expanded')).toBe(String(inside));
  expect(container.querySelector('a[href="/en/products/categories"]') !== null).toBe(inside);
  if (pathname.endsWith('/categories')) {
    expect(container.querySelector('a[href="/en/products/categories"]')?.getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('a[href="/en/products"]')?.className).toContain('font-medium');
    expect(container.querySelector('a[href="/en/products"]')?.getAttribute('aria-current')).toBeNull();
  }
  await act(async () => toggle.click());
  expect(container.querySelector('a[href="/en/products/categories"]') !== null).toBe(!inside);
});
it.each([false, true])('shows the review count or rail dot only for real unresolved reviews: %s', async collapsed => {
  state.count = 3;
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" collapsed={collapsed} />, collapsed);
  const badge = container.querySelector('[aria-label="3 payments awaiting review"]')!;
  expect(badge).toBeTruthy(); expect(badge.textContent).toBe('3');
  expect(badge.getAttribute('role')).toBe('img');
  expect(badge.className.includes('rounded-full')).toBe(collapsed);
});
it('provides every appearance option and persists a selection from the menu', async () => {
  await mount(<DropdownMenu open><DropdownMenuTrigger>Account menu</DropdownMenuTrigger><DropdownMenuContent><AppearanceOptions /></DropdownMenuContent></DropdownMenu>);
  const options = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
  expect(options.map(option => option.textContent)).toEqual(['System', 'Light', 'Dark']);
  expect(options[0].getAttribute('aria-checked')).toBe('true');
  try {
    await act(async () => options[1].click());
    expect(document.documentElement.dataset.colorMode).toBe('light');
    expect(document.cookie).toContain('jiffoo_admin_color_mode=light');
  } finally { delete document.documentElement.dataset.colorMode; }
});
it('keeps the current page in every account-menu language link', async () => {
  state.pathname = '/en/products/categories';
  await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const language = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(item => item.textContent?.trim() === 'Interface language')!;
  await act(async () => { language.focus(); language.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]'));
  expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
    ['简体中文', '/zh-Hans/products/categories'], ['繁體中文', '/zh-Hant/products/categories'], ['English', '/en/products/categories'],
  ]);
});
it('hides the review badge when no payments need review', async () => {
  const container = await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  expect(container.querySelector('[aria-label*="payments awaiting review"]')).toBeNull();
});
it('follows product routes by default and retains an explicit child-collapse choice during navigation', async () => {
  await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  const render = () => root!.render(<PreferencesProvider initialMode="system" initialCollapsed={false} darkAvailable><TooltipProvider><AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" /></TooltipProvider></PreferencesProvider>);
  expect(document.querySelector('a[href="/en/products/categories"]')).toBeNull();
  state.pathname = '/en/products/categories'; await act(async () => render());
  expect(document.querySelector('a[href="/en/products/categories"]')).toBeTruthy();
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Collapse products"]')!.click());
  state.pathname = '/en/products/example/edit'; await act(async () => render());
  expect(document.querySelector('a[href="/en/products/categories"]')).toBeNull();
  expect(document.querySelector('button[aria-label="Expand products"]')?.getAttribute('aria-expanded')).toBe('false');
});
it.each(['My account', 'Log out'])('defers account navigation and side effects for %s until the leave guard resumes', async name => {
  await mount(<AdminNavigation storeName="Local Store" storeUrl="http://localhost:3003/en" />);
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]')!;
  await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  for (const label of ['My account', 'Appearance', 'Interface language', 'Log out']) expect(items.some(item => item.textContent?.trim() === label)).toBe(true);
  expect(items.some(item => item.textContent?.trim() === 'Settings')).toBe(false);
  let resume!: () => void;
  const unregister = registerNavigationGuard(action => { resume = action; return true; });
  try {
    await act(async () => items.find(item => item.textContent?.trim() === name)!.click());
    expect(state.push).not.toHaveBeenCalled(); expect(state.logout).not.toHaveBeenCalled();
    await act(async () => resume());
    expect(state.push).toHaveBeenCalledWith(name === 'My account' ? '/en/profile' : '/en/auth/login');
    expect(state.logout).toHaveBeenCalledTimes(name === 'Log out' ? 1 : 0);
  } finally { unregister(); }
});
