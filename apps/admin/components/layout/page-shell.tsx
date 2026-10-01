/**
 * Page Shell for Tenant Application
 *
 * Shared page scaffolding for the Jiffoo Blue Minimal design system:
 * light canvas, consistent page header (title, optional description,
 * action slot), and the standard content container.
 */

'use client'

import { cn } from '@/lib/utils'

interface PageShellProps {
  title: string
  description?: string
  /** Right-aligned header actions (buttons, filters, etc.). */
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PageShell({ title, description, actions, children, className }: PageShellProps) {
  return (
    <div className="w-full min-h-screen bg-[#f5f7fb]">
      <div className={cn('mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6', className)}>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  )
}
