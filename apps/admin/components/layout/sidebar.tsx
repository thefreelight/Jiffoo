/**
 * Sidebar Navigation Component for the Admin Application
 *
 * Provides the main navigation sidebar with i18n support.
 * Shopify-style flat navigation with only 5 main menu items.
 * Sub-navigation is handled within page content areas.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
import { useT, useLocale } from 'shared/src/i18n/react'
import { JiffooMark } from '@/components/branding/jiffoo-mark'

import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Menu,
  X,
  Sliders,
  Activity,
  ShieldCheck,
  Bell,
  Palette,
  Code,
} from 'lucide-react'

interface SidebarProps {
  className?: string
  onCloseMobile?: () => void
}

interface NavigationItem {
  nameKey: string;
  fallback: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Base navigation configuration - Shopify style flat menu
// Main items: Dashboard / Products / Orders / Customers / Plugins / System Health
const baseNavigationConfig: NavigationItem[] = [
  {
    nameKey: 'merchant.nav.dashboard',
    fallback: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    nameKey: 'merchant.products.title',
    fallback: 'Products',
    href: '/products',
    icon: Package,
  },
  {
    nameKey: 'merchant.orders.title',
    fallback: 'Orders',
    href: '/orders',
    icon: FileText,
  },
  {
    nameKey: 'merchant.notifications.title',
    fallback: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    nameKey: 'merchant.customers.title',
    fallback: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    nameKey: 'merchant.nav.administrators',
    fallback: 'Administrators',
    href: '/staff',
    icon: ShieldCheck,
  },
  {
    nameKey: 'merchant.nav.plugins',
    fallback: 'Plugins',
    href: '/plugins',
    icon: Sliders,
  },
  {
    nameKey: 'merchant.nav.themes',
    fallback: 'Themes',
    href: '/themes',
    icon: Palette,
  },
  {
    nameKey: 'merchant.storefrontCode.title',
    fallback: 'Tracking & custom code',
    href: '/storefront-code',
    icon: Code,
  },
  {
    nameKey: 'merchant.nav.systemHealth',
    fallback: 'System Health',
    href: '/system/health',
    icon: Activity,
  },
];

export function Sidebar({ className, onCloseMobile }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Build localized href
  const getLocalizedHref = (href: string): string => {
    return `/${locale}${href}`
  }

  return (
    <div className={cn(
      "flex flex-col h-screen bg-surface border-r border-neutral-soft transition-all duration-300 shadow-xl lg:shadow-none",
      isCollapsed ? "w-16" : "w-64 lg:w-56",
      className
    )}>
      {/* Header - Shopify style clean header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-neutral-soft">
        {!isCollapsed && (
          <JiffooMark size="sm" />
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md hover:bg-neutral-soft/60 transition-colors lg:block hidden"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <Menu className="w-4 h-4 text-neutral-strong" />
          ) : (
            <X className="w-4 h-4 text-neutral-strong" />
          )}
        </button>
        <button
          onClick={onCloseMobile}
          className="p-1.5 rounded-md hover:bg-neutral-soft/60 transition-colors lg:hidden"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-neutral-strong" />
        </button>
      </div>

      {/* Navigation - Shopify style flat menu */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {baseNavigationConfig.map((item) => {
          const localizedHref = getLocalizedHref(item.href)
          // Prefix matching for active state - highlights parent when on child routes
          const isActive = pathname === localizedHref || pathname.startsWith(localizedHref + '/')
          const itemName = getText(item.nameKey, item.fallback)

          return (
            <Link
              key={item.fallback}
              href={localizedHref}
              className={cn(
                "group flex items-center px-2.5 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-neutral-faint text-neutral-deepest"
                  : "text-neutral-strong hover:bg-neutral-faint hover:text-neutral-deepest"
              )}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  onCloseMobile?.();
                }
              }}
            >
              <item.icon
                className={cn(
                  "flex-shrink-0 w-5 h-5",
                  isActive ? "text-neutral-deep" : "text-neutral-light group-hover:text-neutral-base",
                  isCollapsed ? "mx-auto" : "mr-2.5"
                )}
              />
              {!isCollapsed && (
                <span className="truncate">{itemName}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
