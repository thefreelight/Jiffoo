/**
 * Blue Minimal Sidebar Component for Tenant Application
 *
 * Modern sidebar navigation using Jiffoo Blue Minimal design system.
 * Supports responsive design with mobile overlay.
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useT, useLocale } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { useManagedMode } from '@/lib/managed-mode'
import { canAccessAnyPermission, getSystemNavHref } from '@/lib/admin-access'

import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Sliders,
  Palette,
  Warehouse,
  X,
  User,
  Settings,
  LogOut,
  ChevronUp,
  Monitor,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { ADMIN_PERMISSIONS, type AdminPermission } from 'shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useUpdateCheck } from '@/hooks/use-update-check'
import { UserAvatar } from '../ui/user-avatar'

interface NavigationItem {
  id: string;
  nameKey: string;
  fallback: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: readonly AdminPermission[];
}

// Base navigation configuration - Shopify style flat menu
const baseNavigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    nameKey: 'merchant.nav.dashboard',
    fallback: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    requiredPermissions: [ADMIN_PERMISSIONS.DASHBOARD_READ],
  },
  {
    id: 'products',
    nameKey: 'merchant.products.title',
    fallback: 'Products',
    href: '/products',
    icon: Package,
    requiredPermissions: [ADMIN_PERMISSIONS.PRODUCTS_READ],
  },
  {
    id: 'inventory',
    nameKey: 'merchant.inventory.title',
    fallback: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    requiredPermissions: [ADMIN_PERMISSIONS.INVENTORY_READ, ADMIN_PERMISSIONS.INVENTORY_FORECAST],
  },
  {
    id: 'orders',
    nameKey: 'merchant.orders.title',
    fallback: 'Orders',
    href: '/orders',
    icon: FileText,
    requiredPermissions: [ADMIN_PERMISSIONS.ORDERS_READ],
  },
  {
    id: 'customers',
    nameKey: 'merchant.customers.title',
    fallback: 'Customers',
    href: '/customers',
    icon: Users,
    requiredPermissions: [ADMIN_PERMISSIONS.CUSTOMERS_READ],
  },
  {
    id: 'staff',
    nameKey: 'merchant.nav.staff',
    fallback: 'Staff',
    href: '/staff',
    icon: ShieldCheck,
    requiredPermissions: [ADMIN_PERMISSIONS.STAFF_READ],
  },
  {
    id: 'plugins',
    nameKey: 'merchant.nav.plugins',
    fallback: 'Plugins',
    href: '/plugins',
    icon: Sliders,
    requiredPermissions: [ADMIN_PERMISSIONS.PLUGINS_READ],
  },
  {
    id: 'themes',
    nameKey: 'merchant.nav.themes',
    fallback: 'Themes',
    href: '/themes',
    icon: Palette,
    requiredPermissions: [ADMIN_PERMISSIONS.THEMES_READ],
  },
  {
    id: 'system',
    nameKey: 'merchant.nav.system',
    fallback: 'System',
    href: '/system/updates',
    icon: Monitor,
    requiredPermissions: [ADMIN_PERMISSIONS.SETTINGS_READ, ADMIN_PERMISSIONS.HEALTH_READ],
  },
];

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
  const { record, isManaged, isLoading } = useManagedMode()

  // Build navigation config dynamically
  const navigationConfig = useMemo(() => {
    if (!isManaged || !record) {
      return baseNavigationConfig
    }

    const packageItem: NavigationItem = {
      id: 'package',
      nameKey: 'merchant.nav.yourPackage',
      fallback: 'Your Package',
      href: '/package',
      icon: ShieldCheck,
      requiredPermissions: [ADMIN_PERMISSIONS.SETTINGS_READ],
    }

    return [baseNavigationConfig[0], packageItem, ...baseNavigationConfig.slice(1)]
  }, [isManaged, record])

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
  const isItemActive = (localizedHref: string): boolean => {
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
    : isLoading
      ? 'Store Console'
      : 'Store Console'

  const solutionTitle = isManaged && record
    ? record.displaySolutionName
    : isLoading
      ? 'Loading workspace'
      : 'Management Workspace'

  const brandInitial = brandTitle.trim().charAt(0).toUpperCase() || 'J'

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
          w-[230px] h-screen bg-white border-r border-gray-100
          px-4 py-8 flex flex-col flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between mb-10 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/30">
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
        <nav className="flex flex-col gap-1 flex-1">
          {navigationConfig
            .filter((item) => canAccessAnyPermission(user, item.requiredPermissions))
            .map((item) => {
              const Icon = item.icon
              const href = item.id === 'system'
                ? getSystemNavHref(user, locale)
                : getLocalizedHref(item.href)
              const isActive = isItemActive(href)

              return (
                <Link
                  key={item.id}
                  href={href}
                  onClick={handleNavClick}
                  className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                >
                  <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                  <span>{getText(item.nameKey, item.fallback)}</span>
                  {/* Update badge for System menu */}
                  {item.id === 'system' && hasUpdate && (
                    <span
                      className="w-2 h-2 rounded-full bg-[#3B82F6] ml-auto"
                      aria-label="Update available"
                    />
                  )}
                </Link>
              )
            })}
        </nav>

        {/* User Account Section */}
        <div className="mt-auto pt-6 border-t border-gray-50">
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
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                      Store Owner
                    </span>
                  </div>
                </div>
                <ChevronUp className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
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
