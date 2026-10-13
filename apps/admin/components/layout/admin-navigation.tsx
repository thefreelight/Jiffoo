'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useT, useLocale } from 'shared/src/i18n/react';
import { Activity, Bell, ChevronDown, ChevronUp, Code, FileText, Languages, LayoutDashboard, LogOut, Package, Palette, PanelLeftClose, PanelLeftOpen, ScrollText, Settings, ShieldCheck, Sliders, Store, User, Users } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { usePreferences } from '@/lib/preferences-provider';
import { parseColorMode } from '@/lib/preferences';
import { shellCopy } from '@/lib/shell-copy';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminLanguageSwitcher } from '@/components/i18n/admin-language-switcher';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
const groups = [
  { name: 'store', items: [
    ['dashboard', 'merchant.nav.dashboard', 'Overview', '/dashboard', LayoutDashboard],
    ['products', 'merchant.products.title', 'Products', '/products', Package],
    ['orders', 'merchant.orders.title', 'Orders', '/orders', FileText],
    ['notifications', 'merchant.notifications.title', 'Notifications', '/notifications', Bell],
    ['customers', 'merchant.customers.title', 'Customers', '/customers', Users],
  ] },
  { name: 'extensions', items: [
    ['plugins', 'merchant.nav.plugins', 'Plugins', '/plugins', Sliders],
    ['themes', 'merchant.nav.themes', 'Themes', '/themes', Palette],
    ['storefront-code', 'merchant.storefrontCode.title', 'Tracking & custom code', '/storefront-code', Code],
  ] },
  { name: 'management', items: [
    ['administrators', 'merchant.nav.administrators', 'Administrators', '/staff', ShieldCheck],
    ['audit', 'merchant.auditEvents.title', 'Audit log', '/audit-events', ScrollText],
    ['settings', 'merchant.nav.settings', 'Settings', '/settings', Settings],
    ['health', 'merchant.health.title', 'System Health', '/system/health', Activity],
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
  const [productPages, setProductPages] = useState(true);
  const [openGroups, setOpenGroups] = useState({ store: true, extensions: true, management: true });
  const label = (key: string, fallback: string) => { const value = t(key); return value === key ? fallback : value; };
  const active = (href: string) => pathname === '/' + locale + href || pathname.startsWith('/' + locale + href + '/');
  const languagePath = (language: string) => '/' + [language, ...pathname.split('/').filter(Boolean).slice(1)].join('/');
  const identity = storeName || copy.store;
  return <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
    <div className={cn('flex h-16 shrink-0 items-center gap-2 border-b border-border px-3', collapsed && 'justify-center px-1')}>
      {!collapsed && <><div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-raised font-medium">
        {logo ? <Image src={logo} alt="Store Console logo" width={32} height={32} unoptimized className="size-8 object-contain" /> : identity.charAt(0).toUpperCase()}
      </div><span className="min-w-0 flex-1 truncate font-medium">{identity}</span></>}
      {!mobile && <RailTooltip name={collapsed ? copy.expand : copy.collapse} enabled={collapsed}><button type="button" aria-label={collapsed ? copy.expand : copy.collapse} aria-expanded={!collapsed} onClick={toggleSidebar} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
      </button></RailTooltip>}
    </div>
    <nav aria-label={copy.navigation} className={cn('min-h-0 flex-1 overflow-y-auto p-3', collapsed && 'px-2')}>
      {groups.map((group, index) => <Collapsible key={group.name} open={collapsed || openGroups[group.name]} onOpenChange={open => setOpenGroups(value => ({ ...value, [group.name]: open }))} className="mb-4">
        {collapsed ? index > 0 && <div role="separator" className="mb-4 border-t border-border" /> : <CollapsibleTrigger asChild><button type="button" aria-label={copy[group.name]} className="group mb-1 flex h-6 w-full items-center justify-between text-xs text-muted-foreground">
          <span>{copy[group.name]}</span><ChevronDown aria-hidden="true" className="size-3 transition-transform group-data-[state=closed]:-rotate-90" />
        </button></CollapsibleTrigger>}
        <CollapsibleContent className="space-y-1">
          {group.items.map(([id, key, fallback, href, Icon]) => {
            const name = id === 'administrators' ? copy.administrators : label(key, fallback);
            const navLink = <Link href={'/' + locale + href} aria-label={name} aria-current={active(href) ? 'page' : undefined} onClick={onNavigate} className={cn('flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground', active(href) && 'bg-accent text-foreground', collapsed && 'justify-center px-0')}>
              <Icon aria-hidden="true" className="size-4 shrink-0" /><span className={collapsed ? 'sr-only' : 'truncate'}>{name}</span>
            </Link>;
            return <div key={id}><div className="flex items-center gap-1"><RailTooltip name={name} enabled={collapsed}>{navLink}</RailTooltip>
              {id === 'products' && !collapsed && <button type="button" aria-label={productPages ? copy.collapsePages : copy.expandPages} aria-expanded={productPages} onClick={() => setProductPages(!productPages)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"><ChevronDown aria-hidden="true" className={cn('size-3 transition-transform', !productPages && '-rotate-90')} /></button>}
            </div>{id === 'products' && !collapsed && productPages && <div className="my-1 ml-4 border-l border-border pl-3"><Link href={'/' + locale + '/products/categories'} onClick={onNavigate} className="flex h-8 items-center rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground">{label('merchant.contentTranslations.categories', 'Categories')}</Link></div>}</div>;
          })}
        </CollapsibleContent>
      </Collapsible>)}
    </nav>
    <div className={cn('shrink-0 space-y-2 border-t border-border p-3', collapsed && 'px-2')}>
      <RailTooltip name={copy.viewStore} enabled={collapsed}><a href={storeUrl} target="_blank" rel="noopener noreferrer" aria-label={copy.viewStore} className={cn('flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground', collapsed && 'justify-center px-0')}><Store className="size-4" aria-hidden="true" /><span className={collapsed ? 'sr-only' : ''}>{copy.viewStore}</span></a></RailTooltip>
      <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={label('merchant.header.accountMenu', 'Account menu')} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-accent', collapsed && 'flex-none')}>
          <UserAvatar src={user?.avatar} name={user?.firstName} username={user?.username} className="size-8 shrink-0" fallbackClassName="flex size-8 items-center justify-center rounded-md border bg-raised text-foreground" textClassName="text-xs" />
          {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate font-medium">{user?.firstName || user?.username || label('merchant.header.profile', 'Profile')}</span><span className="block truncate text-xs text-muted-foreground">{user?.email}</span></span><ChevronUp className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" /></>}
        </button></DropdownMenuTrigger><DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuItem onSelect={() => { onNavigate?.(); router.push('/' + locale + '/profile'); }}><User className="mr-2 size-4" />{label('merchant.header.profile', 'Profile')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { onNavigate?.(); router.push('/' + locale + '/settings'); }}><Settings className="mr-2 size-4" />{label('merchant.header.settings', 'Settings')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub><DropdownMenuSubTrigger>{copy.appearance}</DropdownMenuSubTrigger><DropdownMenuSubContent><AppearanceOptions /></DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSub><DropdownMenuSubTrigger aria-label="Change language"><Languages className="mr-2 size-4" />{locale === 'en' ? 'English' : locale === 'zh-Hans' ? '简体中文' : '繁體中文'}</DropdownMenuSubTrigger><DropdownMenuSubContent>
            {[['en', 'English'], ['zh-Hans', '简体中文'], ['zh-Hant', '繁體中文']].map(([value, name]) => <DropdownMenuItem key={value} asChild><Link href={languagePath(value)}>{name}</Link></DropdownMenuItem>)}
          </DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { logout(); router.push('/' + locale + '/auth/login'); }}><LogOut className="mr-2 size-4" />{label('merchant.header.logout', 'Log out')}</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
        <AdminLanguageSwitcher compact />
      </div>
    </div>
  </div>;
}
