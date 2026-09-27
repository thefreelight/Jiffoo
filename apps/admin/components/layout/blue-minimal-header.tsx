/**
 * Blue Minimal Header Component for the Admin Application
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
  KeyRound,
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
    <header className="h-16 bg-surface border-b border-neutral-faint flex items-center justify-between px-8 flex-shrink-0">
      {/* Left: Menu Button (mobile) + Title Section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-neutral-light hover:bg-neutral-veil hover:text-neutral-deepest transition-all"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-neutral-deepest m-0 tracking-tight">{title}</h1>
          <p className="text-[10px] font-bold text-neutral-light m-0 hidden sm:block uppercase tracking-widest">{currentDate}</p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label={t('merchant.header.accountMenu')} className="flex items-center gap-3 p-1.5 pr-3 rounded-2xl hover:bg-neutral-veil transition-all border border-transparent hover:border-neutral-faint group">
              <div className="w-8 h-8 rounded-xl bg-action-veil flex items-center justify-center overflow-hidden border border-action-faint group-hover:scale-105 transition-transform">
                <UserAvatar
                  src={user?.avatar}
                  name={user?.firstName}
                  username={user?.username}
                  className="h-full w-full"
                  imageClassName="h-full w-full object-cover"
                  fallbackClassName="h-full w-full bg-action-veil text-action-strong"
                  textClassName="text-xs"
                />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-neutral-deepest leading-none">
                  {user?.firstName || user?.username || 'User'}
                </span>
                <span className="text-[10px] text-neutral-light font-medium mt-1 uppercase tracking-tighter">
                  Store Owner
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-neutral-faint shadow-2xl p-2 mt-2">
            <DropdownMenuLabel className="px-3 py-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-deepest">{user?.firstName || user?.username || 'User'}</p>
                <p className="text-xs text-neutral-base font-medium truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-neutral-veil" />
            <DropdownMenuItem
              className="rounded-xl py-2.5 cursor-pointer focus:bg-neutral-veil"
              onClick={() => router.push(`/${locale}/profile`)}
            >
              <User className="mr-3 h-4 w-4 text-neutral-light" />
              <span className="text-sm font-semibold">{getText('merchant.header.profile', 'Profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-xl py-2.5 cursor-pointer focus:bg-neutral-veil"
              onClick={() => router.push(`/${locale}/profile#security`)}
            >
              <KeyRound className="mr-3 h-4 w-4 text-neutral-light" />
              <span className="text-sm font-semibold">{getText('merchant.header.changePassword', 'Change password')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-xl py-2.5 cursor-pointer focus:bg-neutral-veil"
              onClick={() => router.push(`/${locale}/settings`)}
            >
              <Settings className="mr-3 h-4 w-4 text-neutral-light" />
              <span className="text-sm font-semibold">{getText('merchant.header.settings', 'Settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-neutral-veil" />
            <DropdownMenuItem onClick={handleLogout} className="rounded-xl py-2.5 cursor-pointer focus:bg-danger-veil focus:text-danger-strong text-danger-base">
              <LogOut className="mr-3 h-4 w-4" />
              <span className="text-sm font-semibold">{getText('merchant.header.logout', 'Log out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
