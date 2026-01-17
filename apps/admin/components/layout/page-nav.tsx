/**
 * Page Navigation Component - Shopify Style
 *
 * Provides secondary navigation within page content areas.
 * Used to replace sidebar submenu with in-page tabs navigation.
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useLocale } from 'shared/src/i18n/react'

interface NavItem {
  label: string
  href: string
  /** Optional: exact match only, default is false */
  exact?: boolean
}

interface PageNavProps {
  items: NavItem[]
  className?: string
}

/**
 * Shopify-style page navigation tabs
 * Renders a horizontal tab bar for in-page navigation
 */
export function PageNav({ items, className }: PageNavProps) {
  const pathname = usePathname()
  const locale = useLocale()

  const getLocalizedHref = (href: string): string => {
    return `/${locale}${href}`
  }

  const isActive = (item: NavItem): boolean => {
    const localizedHref = getLocalizedHref(item.href)
    if (item.exact) {
      return pathname === localizedHref
    }
    // Default: prefix matching
    return pathname === localizedHref || pathname.startsWith(localizedHref + '/')
  }

  return (
    <nav className={cn("border-b border-gray-200", className)}>
      <div className="flex space-x-6">
        {items.map((item) => {
          const active = isActive(item)
          const localizedHref = getLocalizedHref(item.href)

          return (
            <Link
              key={item.href}
              href={localizedHref}
              className={cn(
                "py-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

