'use client'

/**
 * A product without a photo: a plain tile carrying the product's initial.
 * It stands for that product only, not for a category picture picked by row.
 */

import { cn } from '@/lib/utils'

export function ProductThumb({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-lg bg-[#eef2fb] text-sm font-bold uppercase text-slate-500',
        className,
      )}
    >
      {name.trim().charAt(0) || '?'}
    </span>
  )
}
