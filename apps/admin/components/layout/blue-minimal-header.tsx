/**
 * Blue Minimal Header Component for Tenant Application
 *
 * Modern top header using Jiffoo Blue Minimal design system.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { UserAvatar } from '../ui/user-avatar'
import { useT, useLocale } from 'shared/src/i18n/react'
import {
  Search,
  Bell,
  HelpCircle,
  Settings,
  LogOut,
  User,
  Plus,
  Menu
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

interface BlueMinimalHeaderProps {
  title?: string
  onMenuClick?: () => void
}

export function BlueMinimalHeader({ title = "Dashboard", onMenuClick }: BlueMinimalHeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const t = useT()
  const locale = useLocale()
  const [searchValue, setSearchValue] = useState('')

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const handleLogout = () => {
    logout()
    sessionStorage.removeItem('redirectPath')
    router.push(`/${locale}/auth/login`)
  }

  // Format current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0">
      {/* Left: Menu Button (mobile) + Title Section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-gray-900 m-0 tracking-tight">{title}</h1>
          <p className="text-[10px] font-bold text-gray-400 m-0 hidden sm:block uppercase tracking-widest">{currentDate}</p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 p-1.5 pr-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100 group-hover:scale-105 transition-transform">
                <UserAvatar
                  src={user?.avatar}
                  name={user?.firstName}
                  username={user?.username}
                  className="h-full w-full"
                  imageClassName="h-full w-full object-cover"
                  fallbackClassName="h-full w-full bg-blue-50 text-blue-600"
                  textClassName="text-xs"
                />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-gray-900 leading-none">
                  {user?.firstName || user?.username || 'User'}
                </span>
                <span className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">
                  Store Owner
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-gray-100 shadow-2xl p-2 mt-2">
            <DropdownMenuLabel className="px-3 py-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">{user?.firstName || user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 font-medium truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-50" />
            <DropdownMenuItem
              className="rounded-xl py-2.5 cursor-pointer focus:bg-gray-50"
              onClick={() => router.push(`/${locale}/profile`)}
            >
              <User className="mr-3 h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold">{getText('merchant.header.profile', 'Profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-xl py-2.5 cursor-pointer focus:bg-gray-50"
              onClick={() => router.push(`/${locale}/settings`)}
            >
              <Settings className="mr-3 h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold">{getText('merchant.header.settings', 'Settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-50" />
            <DropdownMenuItem onClick={handleLogout} className="rounded-xl py-2.5 cursor-pointer focus:bg-red-50 focus:text-red-600 text-red-500">
              <LogOut className="mr-3 h-4 w-4" />
              <span className="text-sm font-semibold">{getText('merchant.header.logout', 'Log out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
