/**
 * Admin Sidebar Navigation Component
 *
 * 6 core modules:
 * - Dashboard: Platform overview and metrics
 * - Users: End-user management (role=USER only)
 * - Tenants: Organization/Tenant management
 * - Products: Products and Inventory management (combined)
 * - Orders: Order management
 * - Plugins: Plugin ecosystem management
 */
'use client'

import { Home, Users, Building2, Package, ShoppingCart, Puzzle } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'


export function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()

  // Navigation - 6 core modules
  const navigation = [
    {
      name: t('nav.dashboard', 'Dashboard'),
      href: '/',
      icon: Home,
      description: 'Overview and key metrics'
    },
    {
      name: t('nav.users', 'Users'),
      href: '/users',
      icon: Users,
      description: 'End-user management'
    },
    {
      name: t('nav.tenants', 'Tenants'),
      href: '/tenants',
      icon: Building2,
      description: 'Organization management'
    },
    {
      name: t('nav.products', 'Products'),
      href: '/products',
      icon: Package,
      description: 'Products and inventory'
    },
    {
      name: t('nav.orders', 'Orders'),
      href: '/orders',
      icon: ShoppingCart,
      description: 'Order management'
    },
    {
      name: t('nav.plugins', 'Plugins'),
      href: '/plugins',
      icon: Puzzle,
      description: 'Plugin ecosystem'
    },
  ]

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-blue-600 font-bold text-lg">J</span>
          </div>
          <div className="ml-3">
            <h1 className="text-white font-semibold text-lg">Jiffoo Mall</h1>
            <p className="text-blue-200 text-xs">Super Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5',
                  isActive ? 'text-blue-700' : 'text-gray-400'
                )}
              />
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.description}
                </div>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium text-sm">SA</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">Super Admin</p>
            <p className="text-xs text-gray-500">Platform Manager</p>
          </div>
        </div>
      </div>
    </div>
  )
}
