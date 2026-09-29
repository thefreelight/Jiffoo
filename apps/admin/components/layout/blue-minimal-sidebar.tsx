/**
 * Blue Minimal Sidebar Component for the Admin Application
 *
 * Modern sidebar navigation using Jiffoo Blue Minimal design system.
 * Supports responsive design with mobile overlay.
 */

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useT, useLocale } from 'shared/src/i18n/react'
import { cn } from '@/lib/utils'

import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Sliders,
  Bell,
  Activity,
  ShieldCheck,
  ScrollText,
  Palette,
  Code,
  X,
  User,
  Settings,
  LogOut,
  ChevronUp,
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
import { UserAvatar } from '../ui/user-avatar'
import { AdminLanguageSwitcher } from '../i18n/admin-language-switcher'

interface NavigationItem {
  id: string;
  nameKey: string;
  fallback: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Base navigation configuration - Shopify style flat menu
const baseNavigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    nameKey: 'merchant.nav.dashboard',
    fallback: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'products',
    nameKey: 'merchant.products.title',
    fallback: 'Products',
    href: '/products',
    icon: Package,
  },
  {
    id: 'orders',
    nameKey: 'merchant.orders.title',
    fallback: 'Orders',
    href: '/orders',
    icon: FileText,
  },
  {
    id: 'notifications',
    nameKey: 'merchant.notifications.title',
    fallback: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    id: 'customers',
    nameKey: 'merchant.customers.title',
    fallback: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    id: 'administrators',
    nameKey: 'merchant.nav.administrators',
    fallback: 'Administrators',
    href: '/staff',
    icon: ShieldCheck,
  },
  {
    id: 'audit-events',
    nameKey: 'merchant.auditEvents.title',
    fallback: 'Audit log',
    href: '/audit-events',
    icon: ScrollText,
  },
  {
    id: 'plugins',
    nameKey: 'merchant.nav.plugins',
    fallback: 'Plugins',
    href: '/plugins',
    icon: Sliders,
  },
  {
    id: 'themes',
    nameKey: 'merchant.nav.themes',
    fallback: 'Themes',
    href: '/themes',
    icon: Palette,
  },
  {
    id: 'storefront-code',
    nameKey: 'merchant.storefrontCode.title',
    fallback: 'Tracking & custom code',
    href: '/storefront-code',
    icon: Code,
  },
  {
    id: 'settings',
    nameKey: 'merchant.nav.settings',
    fallback: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    id: 'health',
    nameKey: 'merchant.nav.systemHealth',
    fallback: 'System Health',
    href: '/system/health',
    icon: Activity,
  },
];

interface BlueMinimalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  logo?: string | null;
}

export function BlueMinimalSidebar({ isOpen = true, onClose, logo }: BlueMinimalSidebarProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const navigationConfig = baseNavigationConfig

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

  const brandTitle = 'Store Console'
  const solutionTitle = 'Management Workspace'

  const brandInitial = brandTitle.trim().charAt(0).toUpperCase() || 'J'

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-overlay-ink/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[230px] h-screen bg-surface border-r border-neutral-faint
          px-4 py-8 flex flex-col flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between mb-10 px-2">
        <div className="flex items-center gap-3">
          {logo
            ? <Image src={logo} alt="Store Console logo" width={40} height={40} unoptimized
              className="h-10 w-10 object-contain" />
            : <div className="w-10 h-10 bg-gradient-to-br from-action-base to-action-deep rounded-xl flex items-center justify-center text-surface font-black shadow-lg shadow-action-base/30">
                {brandInitial}
              </div>}
          <div className="flex flex-col">
              <span className="font-bold text-base text-neutral-deepest leading-none">{brandTitle}</span>
              <span className="text-[10px] text-neutral-light font-bold uppercase tracking-widest mt-1">{solutionTitle}</span>
          </div>
        </div>

          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-neutral-light hover:bg-neutral-veil hover:text-neutral-deepest"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1">
          {navigationConfig.map((item) => {
            const isActive = isItemActive(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                href={getLocalizedHref(item.href)}
                onClick={handleNavClick}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold
                  transition-all duration-200
                  ${isActive
                    ? 'bg-action-strong text-surface shadow-lg shadow-action-base/20'
                    : 'text-neutral-light hover:bg-neutral-veil hover:text-neutral-deepest'
                  }
                `}
              >
                <Icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                <span>{getText(item.nameKey, item.fallback)}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Account Section */}
        <div className="mt-auto pt-6 border-t border-neutral-veil">
          <AdminLanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label={t('merchant.header.accountMenu')} className="w-full flex items-center justify-between p-2 rounded-2xl border border-transparent hover:border-neutral-faint hover:bg-neutral-veil transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-action-veil flex items-center justify-center overflow-hidden border border-action-faint">
                    <UserAvatar
                      src={user?.avatar}
                      name={user?.firstName}
                      username={user?.username}
                      className="h-full w-full"
                      imageClassName="h-full w-full object-cover"
                      fallbackClassName="h-full w-full bg-action-veil text-action-strong"
                      textClassName="text-xs"
                    />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-xs font-bold text-neutral-deepest truncate w-24 text-left">
                      {user?.firstName || user?.username || 'User'}
                    </span>
                    <span className="text-[10px] text-neutral-light font-bold uppercase tracking-tighter">
                      Store Owner
                    </span>
                  </div>
                </div>
                <ChevronUp className="w-4 h-4 text-neutral-pale group-hover:text-neutral-base transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-[200px] rounded-2xl border-neutral-faint shadow-2xl p-2 mb-2">
              <DropdownMenuLabel className="px-3 py-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-deepest">{user?.firstName || user?.username || 'User'}</p>
                  <p className="text-[10px] text-neutral-base font-medium truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-neutral-veil" />
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer focus:bg-neutral-veil"
                onClick={() => router.push(`/${locale}/profile`)}
              >
                <User className="mr-3 h-4 w-4 text-neutral-light" />
                <span className="text-sm font-semibold">{getText('merchant.header.profile', 'Profile')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl py-2.5 cursor-pointer focus:bg-neutral-veil"
                onClick={() => router.push(`/${locale}/settings`)}
              >
                <Settings className="mr-3 h-4 w-4 text-neutral-light" />
                <span className="text-sm font-semibold">{getText('merchant.header.settings', 'Settings')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-veil" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-xl py-2.5 cursor-pointer focus:bg-danger-veil focus:text-danger-strong text-danger-base">
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
