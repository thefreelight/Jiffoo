/**
 * Blue Minimal Sidebar Component for Tenant Application
 *
 * Modern sidebar navigation using Jiffoo Blue Minimal design system.
 * Structure per the reference design: brand block, primary navigation with
 * badge counts, an expandable plugins group (marketplace / installed),
 * gated Job Sources entry, themes, settings, a Pro upsell card, and the
 * account footer. Supports responsive design with mobile overlay.
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useT, useLocale } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { useManagedMode } from '@/lib/managed-mode'

import {
  LayoutDashboard,
  Users,
  Store,
  Archive,
  ClipboardList,
  UsersRound,
  Puzzle,
  LayoutGrid,
  Palette,
  X,
  User,
  Settings,
  LogOut,
  ChevronUp,
  ChevronDown,
  Crown,
  Radar,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useUpdateCheck } from '@/hooks/use-update-check'
import { useJobsAdminCapability } from '@/hooks/use-jobs-admin-capability'
import { useAdminDashboard, useInstalledPlugins } from '@/lib/hooks/use-api'
import { canAccessAnyPermission, getSystemNavHref } from '@/lib/admin-access'
import { ADMIN_PERMISSIONS, type AdminPermission } from 'shared'
import { UserAvatar } from '../ui/user-avatar'

interface NavigationItem {
  id: string;
  nameKey: string;
  fallback: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: readonly AdminPermission[];
}

interface PluginsSubItem {
  id: string;
  nameKey: string;
  fallback: string;
  view: 'marketplace' | 'installed';
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const PLUGINS_SUB_ITEMS: PluginsSubItem[] = [
  {
    id: 'plugins-marketplace',
    nameKey: 'merchant.nav.pluginsMarketplace',
    fallback: '插件市场',
    view: 'marketplace',
    icon: Store,
  },
  {
    id: 'plugins-installed',
    nameKey: 'merchant.nav.installedPlugins',
    fallback: '已安装插件',
    view: 'installed',
    icon: LayoutGrid,
  },
]

interface BlueMinimalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function BlueMinimalSidebar({ isOpen = true, onClose }: BlueMinimalSidebarProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { hasUpdate } = useUpdateCheck()
  const jobsAdminAvailable = useJobsAdminCapability()
  const { record, isManaged } = useManagedMode()
  const { data: dashboardData } = useAdminDashboard()
  const { data: installedPlugins } = useInstalledPlugins()

  // The plugins group splits into marketplace / installed views via a query
  // param; read it from location.search (not useSearchParams) so the layout
  // keeps prerendering without a Suspense boundary.
  const [pluginsView, setPluginsView] = useState<'marketplace' | 'installed'>('marketplace')
  useEffect(() => {
    if (typeof window === 'undefined') return
    setPluginsView(window.location.search.includes('view=installed') ? 'installed' : 'marketplace')
  }, [pathname])

  const pluginsOnActivePath = pathname.includes('/plugins')
  // The reference design shows the plugins group expanded; operators can
  // collapse it and the preference sticks for the session.
  const [pluginsExpanded, setPluginsExpanded] = useState<boolean | null>(null)
  const pluginsOpen = pluginsExpanded ?? true

  const openOrders = useMemo(() => {
    const byStatus = dashboardData?.ordersByStatus as Record<string, number> | undefined
    if (!byStatus) return undefined
    return ['PENDING', 'PAID', 'PROCESSING'].reduce((sum, status) => sum + (byStatus[status] ?? 0), 0)
  }, [dashboardData])

  const installedCount = (installedPlugins as { items?: unknown[] } | undefined)?.items?.length

  // Build navigation config dynamically
  const navigationConfig = useMemo(() => {
    const items: (NavigationItem | 'divider')[] = [
      {
        id: 'dashboard',
        nameKey: 'merchant.nav.dashboard',
        fallback: '仪表板',
        href: '/dashboard',
        icon: LayoutDashboard,
        requiredPermissions: [ADMIN_PERMISSIONS.DASHBOARD_READ],
      },
      {
        id: 'products',
        nameKey: 'merchant.nav.products',
        fallback: '商品',
        href: '/products',
        icon: Store,
        requiredPermissions: [ADMIN_PERMISSIONS.PRODUCTS_READ],
      },
      {
        id: 'inventory',
        nameKey: 'merchant.inventory.title',
        fallback: '库存预测',
        href: '/inventory',
        icon: Archive,
        requiredPermissions: [ADMIN_PERMISSIONS.INVENTORY_READ, ADMIN_PERMISSIONS.INVENTORY_FORECAST],
      },
      {
        id: 'orders',
        nameKey: 'merchant.nav.orders',
        fallback: '订单',
        href: '/orders',
        icon: ClipboardList,
        requiredPermissions: [ADMIN_PERMISSIONS.ORDERS_READ],
      },
      {
        id: 'customers',
        nameKey: 'merchant.nav.customers',
        fallback: '客户',
        href: '/customers',
        icon: Users,
        requiredPermissions: [ADMIN_PERMISSIONS.CUSTOMERS_READ],
      },
      {
        id: 'staff',
        nameKey: 'merchant.nav.staff',
        fallback: 'Staff',
        href: '/staff',
        icon: UsersRound,
        requiredPermissions: [ADMIN_PERMISSIONS.STAFF_READ],
      },
      'divider',
      {
        id: 'plugins',
        nameKey: 'merchant.nav.plugins',
        fallback: '插件',
        href: '/plugins',
        icon: Puzzle,
        requiredPermissions: [ADMIN_PERMISSIONS.PLUGINS_READ],
      },
    ]

    if (jobsAdminAvailable) {
      items.push({
        id: 'jobSources',
        nameKey: 'merchant.nav.jobSources',
        fallback: 'Job Sources',
        href: '/plugins/remoteradar-jobs',
        icon: Radar,
        requiredPermissions: [ADMIN_PERMISSIONS.PLUGINS_READ],
      })
    }

    items.push(
      {
        id: 'themes',
        nameKey: 'merchant.nav.themes',
        fallback: '主题',
        href: '/themes',
        icon: Palette,
        requiredPermissions: [ADMIN_PERMISSIONS.THEMES_READ],
      },
      {
        id: 'system',
        nameKey: 'merchant.nav.systemSettings',
        fallback: '系统设置',
        href: '/settings',
        icon: Settings,
        requiredPermissions: [ADMIN_PERMISSIONS.SETTINGS_READ, ADMIN_PERMISSIONS.HEALTH_READ],
      },
    )

    if (!isManaged || !record) {
      return items
    }

    const packageItem: NavigationItem = {
      id: 'package',
      nameKey: 'merchant.nav.yourPackage',
      fallback: 'Your Package',
      href: '/package',
      icon: ShieldCheck,
      requiredPermissions: [ADMIN_PERMISSIONS.SETTINGS_READ],
    }

    return [items[0], packageItem, ...items.slice(1)] as (NavigationItem | 'divider')[]
  }, [isManaged, record, jobsAdminAvailable])

  // Permission-filtered navigation; entries without requirements stay visible.
  const visibleNavigation = useMemo(
    () => (navigationConfig as (NavigationItem | 'divider')[])
      .filter((item) => item === 'divider' || canAccessAnyPermission(user, item.requiredPermissions)),
    [navigationConfig, user],
  )

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const handleLogout = () => {
    logout()
    router.push(`/${locale}/auth/login`)
  }

  // Build localized href
  const getLocalizedHref = (href: string): string => {
    return `/${locale}${href}`
  }

  // Check if item is active
  const isItemActive = (href: string): boolean => {
    const localizedHref = getLocalizedHref(href)
    return pathname === localizedHref || pathname.startsWith(localizedHref + '/')
  }

  // Handle nav click on mobile
  const handleNavClick = () => {
    if (onClose) {
      onClose()
    }
  }

  const brandTitle = isManaged && record
    ? record.displayBrandName
    : 'Jiffoo'

  const solutionTitle = isManaged && record
    ? record.displaySolutionName
    : 'Management Workspace'

  const brandInitial = brandTitle.trim().charAt(0).toUpperCase() || 'J'

  const ADMIN_ROLES = new Set(['ADMIN', 'OWNER', 'SUPER_ADMIN', 'TENANT_ADMIN'])
  const roleLabel = ADMIN_ROLES.has(String(user?.role))
    ? getText('merchant.nav.roleSuperAdmin', '超级管理员')
    : getText('merchant.nav.roleMember', '成员')

  const renderNavItem = (item: NavigationItem) => {
    const href = getLocalizedHref(item.href)
    const isActive = isItemActive(item.href)
    const Icon = item.icon

    return (
      <div
        key={item.id}
        className={cn(
          'relative flex items-center rounded-xl transition-all duration-200',
          isActive ? 'bg-[#eef4ff]' : 'hover:bg-slate-50',
        )}
      >
        {isActive && (
          <span aria-hidden className="absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-blue-600" />
        )}
        <Link
          href={href}
          onClick={handleNavClick}
          className={cn(
            'flex flex-1 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
            isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900',
          )}
        >
          <Icon className={cn('h-5 w-5 shrink-0 transition-transform', isActive && 'scale-110')} />
          <span className="truncate">{getText(item.nameKey, item.fallback)}</span>

          {item.id === 'orders' && openOrders ? (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
              {openOrders}
            </span>
          ) : null}
          {item.id === 'system' && hasUpdate && (
            <Link
              href={getSystemNavHref(user, locale)}
              className="mr-2 flex items-center"
              aria-label="Update available"
            >
              <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
            </Link>
          )}
        </Link>

        {item.id === 'plugins' && (
          <button
            type="button"
            aria-label={pluginsOpen ? 'Collapse plugins' : 'Expand plugins'}
            onClick={() => setPluginsExpanded(!pluginsOpen)}
            className="mr-2 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
          >
            {pluginsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
    )
  }

  const renderPluginsSubItems = () => {
    const baseHref = getLocalizedHref('/plugins')
    const onPluginsRoute = isItemActive('/plugins')

    return (
      <div className="mb-1 ml-7 space-y-0.5 border-l border-slate-100 pl-3 pt-1">
        {PLUGINS_SUB_ITEMS.map((sub) => {
          const SubIcon = sub.icon
          const subHref = sub.view === 'installed' ? `${baseHref}?view=installed` : baseHref
          const isSubActive = onPluginsRoute && pluginsView === sub.view

          return (
            <Link
              key={sub.id}
              href={subHref}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                isSubActive
                  ? 'bg-[#eef4ff] text-blue-600'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <SubIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{getText(sub.nameKey, sub.fallback)}</span>
              {sub.id === 'plugins-installed' && installedCount ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-bold text-slate-500">
                  {installedCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[232px] h-screen bg-white border-r border-gray-100
          px-4 py-6 flex flex-col flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 font-black text-white shadow-lg shadow-blue-500/30">
              {brandInitial}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-gray-900 leading-none">{brandTitle}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{solutionTitle}</span>
            </div>
          </div>

          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:bg-gray-50 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {visibleNavigation.map((item, index) => {
            if (item === 'divider') {
              return <div key={`divider-${index}`} className="my-2 h-px bg-slate-100" role="presentation" />
            }

            return (
              <div key={item.id}>
                {renderNavItem(item)}
                {item.id === 'plugins' && pluginsOpen && renderPluginsSubItems()}
              </div>
            )
          })}
        </nav>

        {/* Pro upsell card */}
        <button
          type="button"
          className="mt-4 flex w-full shrink-0 items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-3 text-left transition-colors hover:border-indigo-200"
          aria-label={getText('merchant.nav.proTagline', '解锁更多高阶功能')}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <Crown className="h-5 w-5 text-violet-500" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold text-slate-900">Jiffoo Pro</span>
            <span className="truncate text-[11px] text-slate-400">
              {getText('merchant.nav.proTagline', '解锁更多高阶功能')}
            </span>
          </span>
          <ChevronUp className="ml-auto h-4 w-4 shrink-0 -rotate-90 text-slate-300" />
        </button>

        {/* User Account Section */}
        <div className="mt-4 shrink-0 pt-4 border-t border-gray-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-2 rounded-2xl border border-transparent hover:border-gray-100 hover:bg-gray-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
                    <UserAvatar
                      src={user?.avatar}
                      name={user?.firstName}
                      username={user?.username}
                      className="h-full w-full"
                      imageClassName="h-full w-full object-cover"
                      fallbackClassName="h-full w-full bg-blue-50 text-blue-600"
                      textClassName="text-xs"
                    />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-xs font-bold text-gray-900 truncate w-24 text-left">
                      {user?.firstName || user?.username || 'User'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium tracking-wide">
                      {roleLabel}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-[200px] rounded-2xl border-gray-100 shadow-2xl p-2 mb-2">
              <DropdownMenuLabel className="px-3 py-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-900">{user?.firstName || user?.username || 'User'}</p>
                  <p className="text-[10px] text-gray-500 font-medium truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-50" />
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer focus:bg-gray-50"
                onClick={() => router.push(`/${locale}/profile`)}
              >
                <User className="mr-3 h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold">{getText('merchant.header.profile', 'Profile')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer focus:bg-gray-50"
                onClick={() => router.push(`/${locale}/settings`)}
              >
                <Settings className="mr-3 h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold">{getText('merchant.header.settings', 'Settings')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-50" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-xl py-2.5 cursor-pointer focus:bg-red-50 focus:text-red-600 text-red-500">
                <LogOut className="mr-3 h-4 w-4" />
                <span className="text-sm font-semibold">{getText('merchant.header.logout', 'Log out')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  )
}
