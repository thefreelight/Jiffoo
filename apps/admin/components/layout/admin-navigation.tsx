'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, type MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useT, useLocale } from 'shared/src/i18n/react';
import { ArrowUpRight, ChevronDown, ChevronsUpDown, Languages, LogOut, PanelLeft, PanelLeftOpen, Store, User } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { usePreferences } from '@/lib/preferences-provider';
import { parseColorMode } from '@/lib/preferences';
import { shellCopy } from '@/lib/shell-copy';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOrderStats } from '@/lib/hooks/use-api';
import { requestAppNavigation } from '@/lib/pending-navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
const navigationIcons = {
  overview: 'M3.5 10.5 12 3.5l8.5 7V20h-5.5v-5.5h-6V20H3.5z',
  orders: 'M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  products: 'M3.5 7.5 12 3.5l8.5 4v9l-8.5 4-8.5-4zM3.5 7.5 12 11.5l8.5-4M12 11.5v9',
  customers: 'M15.5 19.5c0-3-1.6-4.8-3.5-4.8s-3.5 1.8-3.5 4.8M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  notifications: 'M6 9a6 6 0 1 1 12 0c0 6.5 2.5 7.5 2.5 7.5h-17S6 15.5 6 9M10 20a2 2 0 0 0 4 0',
  themes: 'M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.5-.7 1.5-1.4 0-1.1-1-1.5-1-2.4s.7-1.4 1.6-1.4H17a3.5 3.5 0 0 0 3.5-3.5c0-4.5-3.8-8.3-8.5-8.3z',
  plugins: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',
  staff: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M5 20.5c0-3.9 3.1-6 7-6s7 2.1 7 6',
  audit: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  health: 'M3 12h4l2.5-6 5 12 2.5-6h4',
};
const groups = [
  { name: 'store', items: [
    ['dashboard', 'merchant.nav.dashboard', 'Overview', '/dashboard', navigationIcons.overview],
    ['orders', 'merchant.orders.title', 'Orders', '/orders', navigationIcons.orders],
    ['products', 'merchant.products.title', 'Products', '/products', navigationIcons.products],
    ['customers', 'merchant.customers.title', 'Customers', '/customers', navigationIcons.customers],
    ['notifications', 'merchant.notifications.title', 'Notifications', '/notifications', navigationIcons.notifications],
  ] },
  { name: 'extensions', items: [
    ['themes', 'merchant.nav.themes', 'Themes', '/themes', navigationIcons.themes],
    ['plugins', 'merchant.nav.plugins', 'Plugins', '/plugins', navigationIcons.plugins],
    ['storefront-code', 'merchant.storefrontCode.title', 'Tracking & custom code', '/storefront-code', navigationIcons.code],
  ] },
  { name: 'management', items: [
    ['administrators', 'merchant.shell.administrators', 'Administrators', '/staff', navigationIcons.staff],
    ['audit', 'merchant.auditEvents.title', 'Audit records', '/audit-events', navigationIcons.audit],
    ['settings', 'merchant.nav.settings', 'Settings', '/settings', navigationIcons.settings],
    ['health', 'merchant.health.title', 'System Health', '/system/health', navigationIcons.health],
  ] },
] as const;
function RailTooltip({ name, enabled, children }: { name: string; enabled: boolean; children: React.ReactNode }) {
  return enabled ? <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="right">{name}</TooltipContent></Tooltip> : children;
}
export function AppearanceOptions() {
  const { mode, darkAvailable, setMode } = usePreferences();
  const copy = shellCopy[useLocale()];
  return <><DropdownMenuRadioGroup value={mode} onValueChange={value => setMode(parseColorMode(value))}>
    {(['system', 'light', 'dark'] as const).map(value => <DropdownMenuRadioItem key={value} value={value} disabled={value === 'dark' && !darkAvailable}>{copy[value]}</DropdownMenuRadioItem>)}
  </DropdownMenuRadioGroup>{!darkAvailable && <DropdownMenuLabel className="max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">{copy.noDark}</DropdownMenuLabel>}</>;
}
export function AdminNavigation({ storeName, storeUrl, logo, collapsed = false, mobile = false, onNavigate }: {
  storeName: string; storeUrl: string; logo?: string | null; collapsed?: boolean; mobile?: boolean; onNavigate?: () => void;
}) {
  const locale = useLocale(), t = useT(), pathname = usePathname(), router = useRouter();
  const copy = shellCopy[locale], { toggleSidebar } = usePreferences();
  const { user, logout } = useAuthStore();
  const insideProducts = pathname === '/' + locale + '/products' || pathname.startsWith('/' + locale + '/products/');
  const [productPagesOverride, setProductPages] = useState<boolean>();
  const productPages = productPagesOverride ?? insideProducts;
  const { data: orderStats } = useOrderStats();
  const reviewCount = orderStats?.paymentReviewCount ?? 0;
  const [openGroups, setOpenGroups] = useState({ store: true, extensions: true, management: true });
  const label = (key: string, fallback: string) => { const value = t(key); return value === key ? fallback : value; };
  const active = (href: string) => pathname === '/' + locale + href || pathname.startsWith('/' + locale + href + '/');
  const languagePath = (language: string) => '/' + [language, ...pathname.split('/').filter(Boolean).slice(1)].join('/');
  const identity = storeName || copy.store;
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    requestAppNavigation(() => { onNavigate?.(); router.push(href); });
  };
  return <div className="flex h-full w-full min-h-0 flex-col gap-3.5 bg-background px-2.5 py-3 text-[13px] text-foreground">
    <div className={cn('flex h-9 shrink-0 items-center gap-1.5 px-1.5', collapsed && 'justify-center px-0')}>
      {!collapsed && <><div className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-[calc(var(--admin-core-radius-control)*6/7)] text-xs font-semibold', logo ? 'bg-transparent' : 'bg-foreground text-background')}>
        {logo ? <Image src={logo} alt={copy.storeLogo} width={22} height={22} unoptimized className="size-[22px] object-contain" /> : identity.charAt(0).toUpperCase()}
      </div><span className="min-w-0 flex-1 truncate font-medium">{identity}</span></>}
      {!mobile && <RailTooltip name={collapsed ? copy.expand : copy.collapse} enabled={collapsed}><button type="button" aria-label={collapsed ? copy.expand : copy.collapse} aria-expanded={!collapsed} onClick={toggleSidebar} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />}
      </button></RailTooltip>}
    </div>
    <nav aria-label={copy.navigation} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {groups.map((group, index) => <Collapsible key={group.name} open={collapsed || openGroups[group.name]} onOpenChange={open => setOpenGroups(value => ({ ...value, [group.name]: open }))}>
        {collapsed ? index > 0 && <div role="separator" className="mb-3 border-t border-border" /> : <CollapsibleTrigger asChild><button type="button" aria-label={copy[group.name]} className="group mb-px flex h-[26px] w-full items-center justify-between rounded-md px-2 text-xs text-faint">
          <span>{copy[group.name]}</span><ChevronDown aria-hidden="true" className="size-3 transition-transform group-data-[state=closed]:-rotate-90" />
        </button></CollapsibleTrigger>}
        <CollapsibleContent className="space-y-px">
          {group.items.map(([id, key, fallback, href, icon]) => {
            const name = label(key, fallback);
            const selected = active(href) && !(id === 'products' && active('/products/categories'));
            const navLink = <Link data-app-navigation href={'/' + locale + href} aria-label={name} aria-current={selected ? 'page' : undefined} onClick={event => navigate(event, '/' + locale + href)} className={cn('relative flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground', active(href) && 'font-medium text-foreground', collapsed && 'justify-center px-0')}>
              <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg><span className={collapsed ? 'sr-only' : 'truncate'}>{name}</span>
              {id === 'orders' && reviewCount > 0 && <span role="img" aria-label={t('merchant.shell.paymentReviewBadge', { count: reviewCount })} className={cn('ml-auto font-mono text-[11px] text-attention', collapsed && 'absolute right-1 top-1 size-1.5 rounded-full bg-attention')}><span className={collapsed ? 'sr-only' : undefined}>{reviewCount}</span></span>}
            </Link>;
            return <div key={id}><div className={cn('flex items-center rounded-md', selected && 'bg-accent')}><RailTooltip name={name} enabled={collapsed}>{navLink}</RailTooltip>
              {id === 'products' && !collapsed && <button type="button" aria-label={productPages ? copy.collapsePages : copy.expandPages} aria-expanded={productPages} onClick={() => setProductPages(!productPages)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"><ChevronDown aria-hidden="true" className={cn('size-3 transition-transform', !productPages && '-rotate-90')} /></button>}
            </div>{id === 'products' && !collapsed && productPages && <div className="mt-0.5 mb-1 ml-4 border-l border-border pl-[9px]"><Link data-app-navigation href={'/' + locale + '/products/categories'} aria-current={active('/products/categories') ? 'page' : undefined} onClick={event => navigate(event, '/' + locale + '/products/categories')} className={cn('flex h-[30px] items-center rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground', active('/products/categories') && 'bg-accent font-medium text-foreground')}>{label('merchant.contentTranslations.categories', 'Categories')}</Link></div>}</div>;
          })}
        </CollapsibleContent>
      </Collapsible>)}
    </nav>
    <div className="shrink-0 space-y-px border-t border-border pt-2.5">
      <RailTooltip name={copy.viewStore} enabled={collapsed}><a href={storeUrl} target="_blank" rel="noopener noreferrer" aria-label={copy.viewStore} className={cn('flex h-8 items-center gap-2.5 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground', collapsed && 'justify-center px-0')}><Store className="size-4" strokeWidth={1.6} aria-hidden="true" /><span className={collapsed ? 'sr-only' : 'flex-1'}>{copy.viewStore}</span>{!collapsed && <ArrowUpRight className="size-3" aria-hidden="true" />}</a></RailTooltip>
      <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={label('merchant.header.accountMenu', 'Account menu')} className={cn('mt-1 flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 text-left hover:bg-accent', collapsed && 'justify-center px-0')}>
          <UserAvatar src={user?.avatar} name={user?.firstName?.charAt(0)} username={user?.username?.charAt(0)} alt={user?.firstName || user?.username || copy.store} className="size-[26px] shrink-0 rounded-full" fallbackClassName="flex size-[26px] items-center justify-center rounded-full border bg-raised text-muted-foreground" textClassName="text-[11px]" />
          {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate font-medium">{user?.firstName || user?.username || label('merchant.header.profile', 'Profile')}</span><span className="block truncate text-xs text-faint">{user?.email}</span></span><ChevronsUpDown className="size-3 shrink-0 text-faint" aria-hidden="true" /></>}
        </button></DropdownMenuTrigger><DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuItem onSelect={() => { requestAppNavigation(() => { onNavigate?.(); router.push('/' + locale + '/profile'); }); }}><User className="mr-2 size-4" />{label('merchant.header.myAccount', 'My account')}</DropdownMenuItem>
          <DropdownMenuSub><DropdownMenuSubTrigger>{copy.appearance}</DropdownMenuSubTrigger><DropdownMenuSubContent><AppearanceOptions /></DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSub><DropdownMenuSubTrigger><Languages className="mr-2 size-4" />{t('merchant.shell.language')}</DropdownMenuSubTrigger><DropdownMenuSubContent>
            {[['zh-Hans', copy.simplifiedChinese], ['zh-Hant', copy.traditionalChinese], ['en', copy.english]].map(([value, name]) => <DropdownMenuItem key={value} asChild><Link href={languagePath(value)}>{name}</Link></DropdownMenuItem>)}
          </DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => requestAppNavigation(() => { logout(); router.push('/' + locale + '/auth/login'); })}><LogOut className="mr-2 size-4" />{label('merchant.header.logout', 'Log out')}</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
      </div>
    </div>
  </div>;
}
