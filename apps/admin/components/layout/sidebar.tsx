/**
 * Sidebar Navigation Component for Tenant Application
 *
 * Provides the main navigation sidebar with i18n support.
 * Shopify-style flat navigation with only 5 main menu items.
 * Sub-navigation is handled within page content areas.
 * Dynamically shows Agent menu if agent plugin is installed.
 */

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
import { useT, useLocale } from 'shared/src/i18n'
import { useInstalledPlugins } from '@/lib/hooks/use-api'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Menu,
  X,
  Sliders,
  UserCog,
  Palette
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

interface NavigationItem {
  nameKey: string;
  fallback: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Base navigation configuration - Shopify style flat menu
// 5 main items: Dashboard / Products / Orders / Customers / Plugins
// Agent menu is dynamically added if agent plugin is installed
const baseNavigationConfig: NavigationItem[] = [
  {
    nameKey: 'tenant.nav.dashboard',
    fallback: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    nameKey: 'tenant.products.title',
    fallback: 'Products',
    href: '/products',
    icon: Package,
  },
  {
    nameKey: 'tenant.orders.title',
    fallback: 'Orders',
    href: '/orders',
    icon: FileText,
  },
  {
    nameKey: 'tenant.customers.title',
    fallback: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    nameKey: 'tenant.plugins.title',
    fallback: 'Plugins',
    href: '/plugins',
    icon: Sliders,
  },
  {
    nameKey: 'tenant.themes.title',
    fallback: 'Themes',
    href: '/themes',
    icon: Palette,
  },
];

// Agent menu item - shown only when agent plugin is installed
const agentMenuItem: NavigationItem = {
  nameKey: 'tenant.agent.title',
  fallback: 'Agents',
  href: '/agents',
  icon: UserCog,
};

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const locale = useLocale()
  const t = useT()

  // Check if agent plugin is installed
  const { data: installedData } = useInstalledPlugins()
  const isAgentPluginInstalled = useMemo(() => {
    const plugins = installedData?.plugins || []
    return plugins.some((p: { plugin: { slug: string }; enabled: boolean }) =>
      p.plugin.slug === 'affiliate-commission' && p.enabled
    )
  }, [installedData])

  // Build navigation config dynamically
  const navigationConfig = useMemo(() => {
    if (isAgentPluginInstalled) {
      // Insert Agent menu before Plugins
      const pluginsIndex = baseNavigationConfig.findIndex(item => item.href === '/plugins')
      const config = [...baseNavigationConfig]
      config.splice(pluginsIndex, 0, agentMenuItem)
      return config
    }
    return baseNavigationConfig
  }, [isAgentPluginInstalled])

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Build localized href
  const getLocalizedHref = (href: string): string => {
    return `/${locale}${href}`
  }

  return (
    <div className={cn(
      "flex flex-col h-screen bg-gray-50 border-r border-gray-200 transition-all duration-300",
      isCollapsed ? "w-16" : "w-56",
      className
    )}>
      {/* Header - Shopify style clean header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-gray-900 rounded-md flex items-center justify-center">
              <span className="text-white font-semibold text-sm">J</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm tracking-tight">Jiffoo Mall</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md hover:bg-gray-200/60 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <Menu className="w-4 h-4 text-gray-600" />
          ) : (
            <X className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Navigation - Shopify style flat menu */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navigationConfig.map((item) => {
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
                  ? "bg-gray-200/70 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon
                className={cn(
                  "flex-shrink-0 w-5 h-5",
                  isActive ? "text-gray-700" : "text-gray-400 group-hover:text-gray-500",
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
