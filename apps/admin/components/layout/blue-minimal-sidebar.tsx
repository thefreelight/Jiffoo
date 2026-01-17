/**
 * Blue Minimal Sidebar Component for Tenant Application
 *
 * Modern sidebar navigation using Jiffoo Blue Minimal design system.
 * Dynamically shows Agent menu if agent plugin is installed.
 * Supports responsive design with mobile overlay.
 */

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT, useLocale } from 'shared/src/i18n/react'

import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Sliders,
  Palette,
  X
} from 'lucide-react'

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
    id: 'customers',
    nameKey: 'merchant.customers.title',
    fallback: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    id: 'plugins',
    nameKey: 'merchant.plugins.title',
    fallback: 'Plugins',
    href: '/plugins',
    icon: Sliders,
  },
  {
    id: 'themes',
    nameKey: 'merchant.themes.title',
    fallback: 'Themes',
    href: '/themes',
    icon: Palette,
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



  // Build navigation config dynamically
  const navigationConfig = baseNavigationConfig

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated
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
          w-[260px] h-screen bg-white border-r border-[#E2E8F0]
          p-6 flex flex-col flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center text-white font-semibold">
              J
            </div>
            <span className="font-semibold text-lg text-[#0F172A]">Jiffoo Mall</span>
          </div>

          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
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
                  flex items-center gap-3 px-3 py-3 rounded-lg font-medium
                  transition-all duration-150
                  ${isActive
                    ? 'bg-[#EFF6FF] text-[#3B82F6]'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{getText(item.nameKey, item.fallback)}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

