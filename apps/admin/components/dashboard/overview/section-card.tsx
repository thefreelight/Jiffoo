/**
 * Shared card shell for the redesigned dashboard overview sections.
 */

'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale } from 'shared/src/i18n/react'

interface SectionCardProps {
  title: string
  action?: {
    label: string
    href: string
  }
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}

export function SectionCard({ title, action, children, className, bodyClassName }: SectionCardProps) {
  const locale = useLocale()

  return (
    <section
      className={cn(
        'flex flex-col rounded-2xl border border-[#eef1f6] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]',
        className,
      )}
    >
      <header className="mb-4 flex shrink-0 items-center justify-between">
        <h3 className="text-[15px] font-bold tracking-tight text-gray-900">{title}</h3>
        {action && (
          <Link
            href={`/${locale}${action.href}`}
            className="group flex items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  )
}
