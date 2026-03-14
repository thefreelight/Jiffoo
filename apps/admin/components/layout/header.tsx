/**
 * Header Component
 *
 * Top navigation header for tenant dashboard with i18n support.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { Button } from '../ui/button'
import { UserAvatar } from '../ui/user-avatar'
import { useT, useLocale } from 'shared/src/i18n/react'
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  Settings,
  LogOut,
  User,
  Sun,
  Moon
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
interface HeaderProps {
  title?: string
  onMenuClick?: () => void
}

export function Header({ title = "Dashboard", onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const t = useT()
  const locale = useLocale()
  const [isDark, setIsDark] = useState(false)

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const handleLogout = () => {
    logout()
    // Clear potentially saved redirect path
    sessionStorage.removeItem('redirectPath')
    router.push(`/${locale}/auth/login`)
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    // Add theme toggle logic here
  }

  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Menu Trigger (Mobile) and Title */}
        <div className="flex items-center space-x-3 md:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="p-1 px-2 lg:hidden -ml-2"
          >
            <Menu className="h-6 w-6 text-gray-500" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white truncate max-w-[150px] md:max-w-none">{title}</h1>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Right side - Search, Actions, Profile */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={getText('merchant.header.searchPlaceholder', 'Search...')}
              className="block w-40 md:w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md leading-5 bg-white dark:bg-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2 dark:text-gray-400"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="p-2 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                3
              </span>
            </Button>

            {/* Help */}
            <Button variant="ghost" size="sm" className="p-2">
              <HelpCircle className="h-4 w-4" />
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              className="p-2"
              onClick={() => router.push(`/${locale}/settings`)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-2 focus:ring-0">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800">
                  <UserAvatar
                    src={user?.avatar}
                    name={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined}
                    username={user?.username}
                    className="h-full w-full"
                    imageClassName="h-full w-full object-cover"
                    fallbackClassName="h-full w-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    textClassName="text-xs"
                  />
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || ''}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{getText('merchant.header.myAccount', 'My Account')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/${locale}/profile`)}>
                <User className="mr-2 h-4 w-4" />
                <span>{getText('merchant.header.profile', 'Profile')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/${locale}/settings`)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>{getText('merchant.header.settings', 'Settings')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{getText('merchant.header.logout', 'Log out')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add View Button - Hide on mobile */}
          <Button className="bg-blue-600 hover:bg-blue-700 text-white hidden sm:flex">
            {getText('merchant.header.addView', 'Add View')}
          </Button>
        </div>
      </div>
    </header>
  )
}
