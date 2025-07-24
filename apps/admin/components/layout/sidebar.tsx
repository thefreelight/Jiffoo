'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import {
  DashboardIcon,
  PersonIcon,
  ArchiveIcon,
  ReaderIcon,
  ChatBubbleIcon,
  CalendarIcon,
  GearIcon,
  ExitIcon,
  HamburgerMenuIcon,
  Cross1Icon,
  BarChartIcon,
  MixerHorizontalIcon,
  LockClosedIcon,
  ComponentInstanceIcon,
  CubeIcon
} from '@radix-ui/react-icons'
import { CurrencyDollarIcon } from '@heroicons/react/24/outline'

interface SidebarProps {
  className?: string
}

interface NavigationItem {
  nameKey: string;
  href: string;
  icon: any;
  current: boolean;
  badge?: string;
  children?: Array<{
    nameKey: string;
    href: string;
  }>;
}

// 导航配置 - 使用翻译键
const getNavigation = (t: (key: string, defaultValue?: string) => string): NavigationItem[] => [
  {
    nameKey: 'nav.dashboard',
    href: '/dashboard',
    icon: DashboardIcon,
    current: false,
  },
  {
    nameKey: 'nav.products',
    href: '/products',
    icon: ArchiveIcon,
    current: false,
    children: [
      { nameKey: 'products.all_products', href: '/products' },
      { nameKey: 'products.add_product', href: '/products/create' },
      { nameKey: 'products.categories', href: '/products/categories' },
      { nameKey: 'products.inventory', href: '/products/inventory' },
    ],
  },
  {
    nameKey: 'nav.orders',
    href: '/orders',
    icon: ReaderIcon,
    current: false,
    children: [
      { nameKey: 'orders.all_orders', href: '/orders' },
      { nameKey: 'orders.pending', href: '/orders/pending' },
      { nameKey: 'orders.processing', href: '/orders/processing' },
      { nameKey: 'orders.shipped', href: '/orders/shipped' },
      { nameKey: 'orders.delivered', href: '/orders/delivered' },
    ],
  },
  {
    nameKey: 'nav.customers',
    href: '/customers',
    icon: PersonIcon,
    current: false,
    children: [
      { nameKey: 'customers.all_customers', href: '/customers' },
      { nameKey: 'customers.groups', href: '/customers/groups' },
      { nameKey: 'customers.reviews', href: '/customers/reviews' },
    ],
  },
  {
    nameKey: 'nav.analytics',
    href: '/analytics',
    icon: BarChartIcon,
    current: false,
    children: [
      { nameKey: 'analytics.sales_report', href: '/analytics/sales' },
      { nameKey: 'analytics.products', href: '/analytics/products' },
      { nameKey: 'analytics.customers', href: '/analytics/customers' },
    ],
  },
  {
    nameKey: 'nav.marketing',
    href: '/marketing',
    icon: ComponentInstanceIcon,
    current: false,
    children: [
      { nameKey: 'marketing.promotions', href: '/marketing/promotions' },
      { nameKey: 'marketing.coupons', href: '/marketing/coupons' },
      { nameKey: 'marketing.emails', href: '/marketing/emails' },
    ],
  },
  {
    nameKey: 'nav.finance',
    href: '/finance',
    icon: CurrencyDollarIcon,
    current: false,
    children: [
      { nameKey: 'finance.revenue', href: '/finance/revenue' },
      { nameKey: 'finance.payments', href: '/finance/payments' },
      { nameKey: 'finance.refunds', href: '/finance/refunds' },
    ],
  },
  {
    nameKey: 'nav.plugins',
    href: '/plugins',
    icon: CubeIcon,
    current: false,
    children: [
      { nameKey: 'plugins.store', href: '/plugins' },
      { nameKey: 'plugins.installed', href: '/plugins?tab=installed' },
      { nameKey: 'plugins.licenses', href: '/plugins/licenses' },
      { nameKey: 'plugins.payment_test', href: '/payment-test' },
    ],
  },
  {
    nameKey: 'nav.marketplace',
    href: '/marketplace',
    icon: ComponentInstanceIcon,
    current: false,
    children: [
      { nameKey: 'marketplace.saas_apps', href: '/marketplace?tab=saas-apps' },
      { nameKey: 'marketplace.auth_plugins', href: '/marketplace?tab=auth-plugins' },
      { nameKey: 'marketplace.my_apps', href: '/marketplace/my-apps' },
      { nameKey: 'marketplace.developer', href: '/marketplace/developer' },
    ],
  },
  {
    nameKey: 'nav.users',
    href: '/users',
    icon: PersonIcon,
    current: false,
    children: [
      { nameKey: 'users.all_users', href: '/users' },
      { nameKey: 'users.roles', href: '/users/roles' },
      { nameKey: 'users.activity', href: '/users/activity' },
    ],
  },
  {
    nameKey: 'nav.settings',
    href: '/settings',
    icon: GearIcon,
    current: false,
    children: [
      { nameKey: 'settings.general', href: '/settings/general' },
      { nameKey: 'settings.payments', href: '/settings/payments' },
      { nameKey: 'settings.shipping', href: '/settings/shipping' },
      { nameKey: 'settings.taxes', href: '/settings/taxes' },
      { nameKey: 'settings.system_updates', href: '/system/updates' },
    ],
  },
];

const getMoreNavigation = (t: (key: string, defaultValue?: string) => string) => [
  {
    nameKey: 'nav.plugin_store',
    href: '/plugin-store',
    icon: CubeIcon,
  },
  {
    nameKey: 'nav.business_model',
    href: '/business-model',
    icon: CurrencyDollarIcon,
  },
  {
    nameKey: 'nav.authentication',
    href: '/auth',
    icon: LockClosedIcon,
  },
  {
    nameKey: 'nav.utility',
    href: '/utility',
    icon: MixerHorizontalIcon,
  },
];

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const pathname = usePathname()
  const { t } = useI18n()

  // 获取翻译后的导航数据
  const navigation = getNavigation(t)
  const moreNavigation = getMoreNavigation(t)

  const toggleExpanded = (nameKey: string) => {
    setExpandedItems(prev =>
      prev.includes(nameKey)
        ? prev.filter(item => item !== nameKey)
        : [...prev, nameKey]
    )
  }

  return (
    <div className={cn(
      "flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">J</span>
            </div>
            <span className="font-semibold text-gray-900">Jiffoo Mall</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? (
            <HamburgerMenuIcon className="w-5 h-5 text-gray-600" />
          ) : (
            <Cross1Icon className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Pages Section */}
        {!isCollapsed && (
          <div className="px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('nav.pages', 'PAGES')}
            </h3>
          </div>
        )}

        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isExpanded = expandedItems.includes(item.nameKey)

          return (
            <div key={item.nameKey}>
              <Link
                href={item.href}
                onClick={() => item.children && toggleExpanded(item.nameKey)}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon
                  className={cn(
                    "flex-shrink-0 w-5 h-5",
                    isActive ? "text-blue-700" : "text-gray-400 group-hover:text-gray-500",
                    isCollapsed ? "mx-auto" : "mr-3"
                  )}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{t(item.nameKey, item.nameKey.split('.')[1])}</span>
                    {item.badge && (
                      <span className="ml-3 inline-block py-0.5 px-2 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {item.children && (
                      <svg
                        className={cn(
                          "ml-auto h-4 w-4 transition-transform",
                          isExpanded ? "rotate-90" : ""
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </>
                )}
              </Link>

              {/* Submenu */}
              {item.children && isExpanded && !isCollapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.nameKey}
                      href={child.href}
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        pathname === child.href
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      {t(child.nameKey, child.nameKey.split('.')[1])}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* More Section */}
        {!isCollapsed && (
          <div className="px-3 py-2 mt-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('nav.more', 'MORE')}
            </h3>
          </div>
        )}

        {moreNavigation.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.nameKey}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon
                className={cn(
                  "flex-shrink-0 w-5 h-5",
                  isActive ? "text-blue-700" : "text-gray-400 group-hover:text-gray-500",
                  isCollapsed ? "mx-auto" : "mr-3"
                )}
              />
              {!isCollapsed && <span>{t(item.nameKey, item.nameKey.split('.')[1])}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
