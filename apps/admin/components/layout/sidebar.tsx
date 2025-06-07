'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '../../lib/utils'
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
  CubeIcon,
  GlobeIcon
} from '@radix-ui/react-icons'
import { CurrencyDollarIcon } from '@heroicons/react/24/outline'

interface SidebarProps {
  className?: string
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: DashboardIcon,
    current: false,
  },
  {
    name: 'Products',
    href: '/products',
    icon: ArchiveIcon,
    current: false,
    children: [
      { name: 'All Products', href: '/products' },
      { name: 'Add Product', href: '/products/create' },
      { name: 'Categories', href: '/products/categories' },
      { name: 'Inventory', href: '/products/inventory' },
    ],
  },
  {
    name: 'Orders',
    href: '/orders',
    icon: ReaderIcon,
    current: false,
    children: [
      { name: 'All Orders', href: '/orders' },
      { name: 'Pending', href: '/orders/pending' },
      { name: 'Processing', href: '/orders/processing' },
      { name: 'Shipped', href: '/orders/shipped' },
      { name: 'Delivered', href: '/orders/delivered' },
    ],
  },
  {
    name: 'Customers',
    href: '/customers',
    icon: PersonIcon,
    current: false,
    children: [
      { name: 'All Customers', href: '/customers' },
      { name: 'Customer Groups', href: '/customers/groups' },
      { name: 'Reviews', href: '/customers/reviews' },
    ],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChartIcon,
    current: false,
    children: [
      { name: 'Sales Report', href: '/analytics/sales' },
      { name: 'Product Analytics', href: '/analytics/products' },
      { name: 'Customer Analytics', href: '/analytics/customers' },
    ],
  },
  {
    name: 'Marketing',
    href: '/marketing',
    icon: ComponentInstanceIcon,
    current: false,
    children: [
      { name: 'Promotions', href: '/marketing/promotions' },
      { name: 'Coupons', href: '/marketing/coupons' },
      { name: 'Email Campaigns', href: '/marketing/emails' },
    ],
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: CurrencyDollarIcon,
    current: false,
    children: [
      { name: 'Revenue', href: '/finance/revenue' },
      { name: 'Payments', href: '/finance/payments' },
      { name: 'Refunds', href: '/finance/refunds' },
    ],
  },
  {
    name: 'Plugins',
    href: '/plugins',
    icon: CubeIcon,
    current: false,
    children: [
      { name: 'Plugin Store', href: '/plugins' },
      { name: 'Installed Plugins', href: '/plugins?tab=installed' },
      { name: 'Licenses', href: '/plugins/licenses' },
    ],
  },
  {
    name: 'Marketplace',
    href: '/marketplace',
    icon: ComponentInstanceIcon,
    current: false,
    children: [
      { name: 'SaaS Apps', href: '/marketplace?tab=saas-apps' },
      { name: 'Auth Plugins', href: '/marketplace?tab=auth-plugins' },
      { name: 'My Apps', href: '/marketplace/my-apps' },
      { name: 'Developer Portal', href: '/marketplace/developer' },
    ],
  },
  {
    name: 'Users',
    href: '/users',
    icon: PersonIcon,
    current: false,
    children: [
      { name: 'All Users', href: '/users' },
      { name: 'Roles & Permissions', href: '/users/roles' },
      { name: 'Activity Log', href: '/users/activity' },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: GearIcon,
    current: false,
    children: [
      { name: 'General', href: '/settings/general' },
      { name: 'Payment Methods', href: '/settings/payments' },
      { name: 'Shipping', href: '/settings/shipping' },
      { name: 'Taxes', href: '/settings/taxes' },
    ],
  },
]

const moreNavigation = [
  {
    name: 'Authentication',
    href: '/auth',
    icon: LockClosedIcon,
  },
  {
    name: 'Utility',
    href: '/utility',
    icon: MixerHorizontalIcon,
  },
]

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const pathname = usePathname()

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
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
              PAGES
            </h3>
          </div>
        )}

        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isExpanded = expandedItems.includes(item.name)

          return (
            <div key={item.name}>
              <Link
                href={item.href}
                onClick={() => item.children && toggleExpanded(item.name)}
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
                    <span className="flex-1">{item.name}</span>
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
                      key={child.name}
                      href={child.href}
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        pathname === child.href
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      {child.name}
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
              MORE
            </h3>
          </div>
        )}

        {moreNavigation.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
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
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
