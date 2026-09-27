import { cn } from '@/lib/utils'

type JiffooMarkProps = {
  className?: string
  compact?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const markSizes = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
}

export function JiffooMark({
  className,
  compact = false,
  label = 'Jiffoo',
  size = 'md',
}: JiffooMarkProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)} aria-label={label}>
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-lg bg-action-strong font-bold text-surface shadow-sm',
          markSizes[size],
        )}
        aria-hidden="true"
      >
        J
      </span>
      {!compact && <span className="text-xl font-bold tracking-normal text-cool-ink">{label}</span>}
    </div>
  )
}
