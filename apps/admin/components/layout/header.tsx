'use client'

import { Bell, ChevronDown, Search } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { formatDateTime } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { authApi } from '@/lib/api'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const currentTime = new Date()
  const { t } = useI18n()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const user = authApi.getCurrentUser()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Title and breadcrumb */}
        <div className="flex items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('dashboard.subtitle', 'Platform Agents Management System')}
            </p>
          </div>
        </div>

        {/* Right side - Search, notifications, language switcher, and user menu */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t('search.placeholder', 'Search agents, commissions...')}
              className="block w-80 pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg">
            <Bell className="h-6 w-6" />
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"></span>
          </button>

          {/* Language Switcher */}
          <LanguageSwitcher variant="compact" />

          {/* Current time */}
          <div className="text-sm text-gray-500">
            {formatDateTime(currentTime)}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-gray-50 p-2 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">SA</span>
              </div>
              <div className="ml-3 text-left">
                <p className="text-sm font-medium text-gray-900">{t('user.superAdmin', '超级管理员')}</p>
                <p className="text-xs text-gray-500">{t('user.platformManager', '平台管理员')}</p>
              </div>
              <ChevronDown className="ml-2 h-4 w-4 text-gray-400" />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.email || 'admin@jiffoo.com'}</p>
                  <p className="text-xs text-gray-500">{user?.role || 'SUPER_ADMIN'}</p>
                </div>
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await authApi.logout();
                    // 清除可能保存的重定向路径
                    sessionStorage.removeItem('redirectPath');
                    router.push('/login');
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {t('user.logout', '退出登录')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
