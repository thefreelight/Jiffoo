'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/button'
import {
  MagnifyingGlassIcon,
  BellIcon,
  QuestionMarkCircledIcon,
  GearIcon,
  ExitIcon,
  PersonIcon,
  SunIcon,
  MoonIcon
} from '@radix-ui/react-icons'
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
}

export function Header({ title = "Dashboard" }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [isDark, setIsDark] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    // 这里可以添加主题切换逻辑
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Title and Date */}
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">
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
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2"
            >
              {isDark ? (
                <SunIcon className="h-4 w-4" />
              ) : (
                <MoonIcon className="h-4 w-4" />
              )}
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="p-2 relative">
              <BellIcon className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                3
              </span>
            </Button>

            {/* Help */}
            <Button variant="ghost" size="sm" className="p-2">
              <QuestionMarkCircledIcon className="h-4 w-4" />
            </Button>

            {/* Settings */}
            <Button variant="ghost" size="sm" className="p-2">
              <GearIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-2">
                <img
                  className="h-8 w-8 rounded-full"
                  src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face'}
                  alt={user?.name || 'User'}
                />
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <PersonIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <GearIcon className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <ExitIcon className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add View Button */}
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Add View
          </Button>
        </div>
      </div>
    </header>
  )
}
