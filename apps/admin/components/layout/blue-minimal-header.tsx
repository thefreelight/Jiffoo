/**
 * Blue Minimal Header Component for Tenant Application
 *
 * Modern top header using Jiffoo Blue Minimal design system.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuthStore } from '@/lib/store'
import { useT, useLocale } from 'shared/src/i18n'
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
    return t ? t(key) : fallback
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
    <header className="h-[70px] bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 lg:px-8 flex-shrink-0">
      {/* Left: Menu Button (mobile) + Title Section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-[#0F172A] m-0">{title}</h1>
          <p className="text-sm text-[#64748B] m-0 hidden sm:block">{currentDate}</p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Search Bar - hidden on mobile */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={getText('tenant.header.searchPlaceholder', 'Search...')}
            className="
              w-40 lg:w-60 pl-9 pr-3 py-2
              border border-[#E2E8F0] rounded-md
              bg-[#F8FAFC] text-sm text-[#0F172A]
              placeholder:text-[#64748B]
              focus:outline-none focus:border-[#3B82F6]
              transition-colors duration-150
            "
          />
        </div>

        {/* Action Buttons */}
        <button
          className="relative p-2 rounded-md bg-transparent text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors duration-150"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 min-w-[8px] h-[8px] rounded-full bg-red-500" />
        </button>

        <button
          className="hidden sm:block p-2 rounded-md bg-transparent text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors duration-150"
          aria-label="Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 rounded-md hover:bg-[#F1F5F9] transition-colors">
              <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.username || 'User'}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-medium text-[#64748B]">
                    {(user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.firstName || user?.username || 'User'}</p>
                <p className="text-xs text-[#64748B]">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>{getText('tenant.header.profile', 'Profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>{getText('tenant.header.settings', 'Settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{getText('tenant.header.logout', 'Log out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary Action - hidden on small screens */}
        <button
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-md font-semibold text-sm hover:bg-[#2563EB] transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden lg:inline">{getText('tenant.header.addView', 'Add View')}</span>
        </button>
      </div>
    </header>
  )
}

