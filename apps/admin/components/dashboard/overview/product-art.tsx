/**
 * Product artwork placeholder used across the overview cards.
 *
 * Real product photos are not part of the dashboard list payloads, so each
 * product renders as a soft gradient tile with a category glyph.
 */

'use client'

import { Shirt, Footprints, HardHat, Backpack, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProductIconKind = 'shirt' | 'sneaker' | 'cap' | 'pants' | 'backpack'

const ICONS: Record<ProductIconKind, React.ComponentType<{ className?: string }>> = {
  shirt: Shirt,
  sneaker: Footprints,
  cap: HardHat,
  // Lucide ships no trousers glyph at this version; Shirt reads as clothing
  // at thumbnail size, and the per-product gradient keeps rows distinct.
  pants: Shirt,
  backpack: Backpack,
}

interface ProductArtProps {
  icon: ProductIconKind
  art?: string
  className?: string
  iconClassName?: string
}

export function ProductArt({ icon, art = 'from-slate-500 to-slate-700', className, iconClassName }: ProductArtProps) {
  const Icon = ICONS[icon] ?? ShoppingBag

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white/90',
        art,
        className,
      )}
    >
      <Icon className={cn('h-1/2 w-1/2', iconClassName)} />
    </div>
  )
}
