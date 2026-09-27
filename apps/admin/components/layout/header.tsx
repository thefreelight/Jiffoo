/**
 * Header Component
 *
 * Top navigation header for the Admin application with i18n support.
 */

'use client'

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
  KeyRound,
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

  return (
    <header className="border-b border-neutral-soft bg-surface px-3 py-3 sm:px-4 sm:py-4 md:px-6">
      <div className="flex items-center justify-between gap-3">
        {/* Left side - Menu Trigger (Mobile) and Title */}
        <div className="flex min-w-0 items-center space-x-2 sm:space-x-3 md:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="p-1 px-2 lg:hidden -ml-2"
          >
            <Menu className="h-6 w-6 text-neutral-base" />
          </Button>
          <div className="min-w-0">
            <h1 className="max-w-[10rem] truncate text-lg font-semibold text-neutral-deepest sm:max-w-[16rem] sm:text-xl md:max-w-none md:text-2xl">{title}</h1>
            <p className="text-xs md:text-sm text-neutral-base hidden sm:block">
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
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3 md:gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-neutral-light" />
            </div>
            <input
              type="text"
              placeholder={getText('merchant.header.searchPlaceholder', 'Search...')}
              className="block w-40 md:w-64 pl-10 pr-3 py-2 border border-neutral-pale rounded-md leading-5 bg-surface placeholder-neutral-base focus:outline-none focus:ring-1 focus:ring-action-base text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="p-2 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-danger-base rounded-full text-xs text-surface flex items-center justify-center">
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
                <div className="h-8 w-8 rounded-full overflow-hidden border border-neutral-soft">
                  <UserAvatar
                    src={user?.avatar}
                    name={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined}
                    username={user?.username}
                    className="h-full w-full"
                    imageClassName="h-full w-full object-cover"
                    fallbackClassName="h-full w-full bg-neutral-faint text-neutral-deep"
                    textClassName="text-xs"
                  />
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-neutral-deepest">
                    {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'User'}
                  </p>
                  <p className="text-xs text-neutral-base">{user?.email || ''}</p>
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
              <DropdownMenuItem onClick={() => router.push(`/${locale}/profile#security`)}>
                <KeyRound className="mr-2 h-4 w-4" />
                <span>{getText('merchant.header.changePassword', 'Change password')}</span>
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
          <Button className="hidden bg-action-strong text-surface hover:bg-action-deep lg:flex">
            {getText('merchant.header.addView', 'Add View')}
          </Button>
        </div>
      </div>
    </header>
  )
}
