/**
 * Stock Risk Indicator Component
 *
 * Displays color-coded stock status with tooltip details.
 * Follows Jiffoo Blue Minimal design system from stats-card.tsx
 */

'use client'

import { AlertCircle, CheckCircle, AlertTriangle, Package } from 'lucide-react'
import { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { useT } from 'shared/src/i18n/react'

export type StockRiskLevel = 'HEALTHY' | 'WARNING' | 'DANGER' | 'OVERSTOCK'

interface StockRiskIndicatorProps {
  riskLevel: StockRiskLevel
  currentStock: number
  reorderPoint?: number | null
  daysUntilStockout?: number | null
  recommendedOrder?: number | null
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Risk level configuration
const riskConfig: Record<StockRiskLevel, {
  icon: ReactNode
  label: string
  bgColor: string
  textColor: string
  borderColor: string
}> = {
  HEALTHY: {
    icon: <CheckCircle className="w-full h-full" />,
    label: 'Healthy Stock',
    bgColor: 'bg-[#DCFCE7]',
    textColor: 'text-[#166534]',
    borderColor: 'border-[#22C55E]'
  },
  WARNING: {
    icon: <AlertTriangle className="w-full h-full" />,
    label: 'Approaching Reorder Point',
    bgColor: 'bg-[#FEF3C7]',
    textColor: 'text-[#D97706]',
    borderColor: 'border-[#F59E0B]'
  },
  DANGER: {
    icon: <AlertCircle className="w-full h-full" />,
    label: 'Stockout Risk',
    bgColor: 'bg-[#FEE2E2]',
    textColor: 'text-[#991B1B]',
    borderColor: 'border-[#EF4444]'
  },
  OVERSTOCK: {
    icon: <Package className="w-full h-full" />,
    label: 'Overstock',
    bgColor: 'bg-[#EFF6FF]',
    textColor: 'text-[#3B82F6]',
    borderColor: 'border-[#3B82F6]'
  }
}

// Size configuration
const sizeConfig = {
  sm: {
    icon: 'w-4 h-4',
    padding: 'p-1.5',
    text: 'text-xs'
  },
  md: {
    icon: 'w-5 h-5',
    padding: 'p-2',
    text: 'text-sm'
  },
  lg: {
    icon: 'w-6 h-6',
    padding: 'p-2.5',
    text: 'text-base'
  }
}

export function StockRiskIndicator({
  riskLevel,
  currentStock,
  reorderPoint,
  daysUntilStockout,
  recommendedOrder,
  className,
  showLabel = false,
  size = 'md'
}: StockRiskIndicatorProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const config = riskConfig[riskLevel]
  const sizeStyles = sizeConfig[size]

  // Build tooltip content
  const tooltipLines: string[] = [
    `${getText('merchant.inventory.status', 'Status')}: ${config.label}`,
    `${getText('merchant.inventory.currentStock', 'Current Stock')}: ${currentStock}`
  ]

  if (reorderPoint !== null && reorderPoint !== undefined) {
    tooltipLines.push(`${getText('merchant.inventory.reorderPoint', 'Reorder Point')}: ${reorderPoint}`)
  }

  if (daysUntilStockout !== null && daysUntilStockout !== undefined) {
    tooltipLines.push(`${getText('merchant.inventory.daysUntilStockout', 'Days Until Stockout')}: ${daysUntilStockout}`)
  }

  if (recommendedOrder !== null && recommendedOrder !== undefined) {
    tooltipLines.push(`${getText('merchant.inventory.recommendedOrder', 'Recommended Order')}: ${recommendedOrder}`)
  }

  const tooltipText = tooltipLines.join('\n')

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        className
      )}
      title={tooltipText}
    >
      {/* Icon with colored background */}
      <div
        className={cn(
          "rounded-lg border-2 transition-all hover:scale-110",
          config.bgColor,
          config.borderColor,
          sizeStyles.padding
        )}
      >
        <div className={cn(config.textColor, sizeStyles.icon)}>
          {config.icon}
        </div>
      </div>

      {/* Optional label */}
      {showLabel && (
        <div className="flex flex-col">
          <span className={cn(
            "font-medium",
            config.textColor,
            sizeStyles.text
          )}>
            {config.label}
          </span>
          <span className="text-xs text-[#64748B]">
            {currentStock} {getText('merchant.inventory.units', 'units')}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Helper function to determine risk level based on stock data
 */
export function calculateRiskLevel(
  currentStock: number,
  reorderPoint?: number | null,
  daysUntilStockout?: number | null,
  isOverstock?: boolean
): StockRiskLevel {
  // Overstock takes priority
  if (isOverstock) {
    return 'OVERSTOCK'
  }

  // No reorder point data - assume healthy if we have stock
  if (!reorderPoint) {
    return currentStock > 0 ? 'HEALTHY' : 'DANGER'
  }

  // Stockout risk based on days until stockout
  if (daysUntilStockout !== null && daysUntilStockout !== undefined) {
    if (daysUntilStockout <= 3) {
      return 'DANGER'
    }
    if (daysUntilStockout <= 7) {
      return 'WARNING'
    }
  }

  // Stock level based risk
  if (currentStock < reorderPoint) {
    // Below reorder point
    const ratio = currentStock / reorderPoint
    return ratio < 0.5 ? 'DANGER' : 'WARNING'
  }

  // Healthy stock level
  return 'HEALTHY'
}
