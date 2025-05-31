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
  ComponentInstanceIcon
} from '@radix-ui/react-icons'

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
    name: 'Analytics',
    href: '/analytics',
    icon: BarChartIcon,
    current: false,
  },
  {
    name: 'E-commerce',
    href: '/ecommerce',
    icon: ArchiveIcon,
    current: false,
    children: [
      { name: 'Products', href: '/ecommerce/products' },
      { name: 'Orders', href: '/ecommerce/orders' },
      { name: 'Customers', href: '/ecommerce/customers' },
    ],
  },
  {
    name: 'Community',
    href: '/community',
    icon: PersonIcon,
    current: false,
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: ReaderIcon,
    current: false,
  },
  {
    name: 'Job Board',
    href: '/jobs',
    icon: ComponentInstanceIcon,
    current: false,
  },
  {
    name: 'Tasks',
    href: '/tasks',
    icon: MixerHorizontalIcon,
    current: false,
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: ChatBubbleIcon,
    current: false,
    badge: '4',
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: CalendarIcon,
    current: false,
  },
  {
    name: 'Campaigns',
    href: '/campaigns',
    icon: ReaderIcon,
    current: false,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: GearIcon,
    current: false,
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
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-gray-900">Acme Inc.</span>
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
